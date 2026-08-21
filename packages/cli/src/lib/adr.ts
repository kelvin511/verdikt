import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Candidate } from "./types.js";
import { formatFileList, topDirectories, type FileChangeSummary } from "./diffsummary.js";

function slugify(title: string): string {
  return (
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 60) || "untitled"
  );
}

export interface ADRFile {
  filename: string;
  content: string;
}

export function buildADRMarkdown(candidate: Candidate, body: string): ADRFile {
  const filename = `${candidate.date}-${slugify(candidate.title)}.md`;

  const frontmatter: Record<string, unknown> = {
    title: candidate.title,
    date: candidate.date,
    source: candidate.source,
    ref: candidate.id,
    author: candidate.author,
    status: "accepted",
  };
  if (candidate.url) frontmatter.url = candidate.url;
  if (candidate.branch) frontmatter.branch = candidate.branch;
  if (candidate.source === "github" && candidate.prNumber !== undefined) {
    frontmatter.pr_number = candidate.prNumber;
  }

  const content = matter.stringify(body.trim() + "\n", frontmatter);
  return { filename, content };
}

export function saveADR(verdiktDir: string, adr: ADRFile): string {
  fs.mkdirSync(verdiktDir, { recursive: true });
  const fullPath = path.join(verdiktDir, adr.filename);
  fs.writeFileSync(fullPath, adr.content, "utf8");
  return fullPath;
}

function originLine(candidate: Candidate): string {
  if (candidate.source === "github") {
    return `PR #${candidate.prNumber} by @${candidate.author}, merged ${candidate.date}.`;
  }
  const branchNote = candidate.branch ? ` (branch \`${candidate.branch}\`)` : "";
  const kind = candidate.isMerge ? `Merge commit ${candidate.id}${branchNote}` : `Commit ${candidate.id}`;
  return `${kind} by ${candidate.author}, ${candidate.date}.`;
}

// --- Commit message analysis -----------------------------------------

const CONVENTIONAL_COMMIT_TYPES: Record<string, string> = {
  feat: "Feature",
  fix: "Bug fix",
  refactor: "Refactor",
  docs: "Documentation",
  test: "Tests",
  chore: "Chore",
  perf: "Performance",
  build: "Build",
  ci: "CI",
  style: "Style",
  revert: "Revert",
};

const CONVENTIONAL_COMMIT_PATTERN = /^(\w+)(\([\w./-]+\))?!?:\s*.+/;

function classifyCommitType(title: string): string | null {
  const match = title.match(CONVENTIONAL_COMMIT_PATTERN);
  if (!match) return null;
  return CONVENTIONAL_COMMIT_TYPES[match[1].toLowerCase()] ?? null;
}

function extractBullets(description: string): string[] {
  return description
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => /^[-*]\s+/.test(l))
    .map((l) => l.replace(/^[-*]\s+/, ""));
}

// --- File-change-driven inference --------------------------------------

const DEPENDENCY_FILE_PATTERN = /(^|\/)(package(-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|requirements.*\.txt|go\.(mod|sum)|Cargo\.(toml|lock))$/;
const CI_FILE_PATTERN = /^\.github\/workflows\//;
const MIGRATION_PATTERN = /migrat(ion|e)/i;

function inferConsequences(files: FileChangeSummary | undefined): string | null {
  if (!files || files.totalFiles === 0) return null;

  const allPaths = [
    ...files.added,
    ...files.modified,
    ...files.deleted,
    ...files.renamed.map((r) => r.to),
  ];

  const notes: string[] = [];
  if (allPaths.some((p) => DEPENDENCY_FILE_PATTERN.test(p))) {
    notes.push("Dependency manifests changed — review the lockfile diff before relying on reproducible installs.");
  }
  if (allPaths.some((p) => CI_FILE_PATTERN.test(p))) {
    notes.push("CI workflow changed — build/test/deploy behavior may differ on the next run.");
  }
  if (allPaths.some((p) => MIGRATION_PATTERN.test(p))) {
    notes.push("Touches migration-related files — check for required schema/data migration steps.");
  }
  if (files.deleted.length > 0) {
    notes.push(`Removes ${files.deleted.length} file(s) — confirm nothing else still references them.`);
  }

  return notes.length > 0 ? notes.map((n) => `- ${n}`).join("\n") : null;
}

export function templateCandidate(candidate: Candidate, files?: FileChangeSummary): string {
  const lines: string[] = [];

  // Context: where this came from, then what it touched (files first).
  lines.push("## Context", "", originLine(candidate));
  if (files && files.totalFiles > 0) {
    const dirs = topDirectories(files);
    const scope = dirs ? ` across ${dirs}` : "";
    lines.push(`Touches ${files.totalFiles} file(s)${scope}.`);
  }
  lines.push("");

  // Decision: commit-message analysis, informed by what actually changed.
  lines.push("## Decision", "");
  const commitType = classifyCommitType(candidate.title);
  if (commitType) lines.push(`**Type:** ${commitType}`, "");

  const bullets = extractBullets(candidate.description);
  if (bullets.length > 0) {
    lines.push(...bullets.map((b) => `- ${b}`));
  } else if (candidate.description.trim()) {
    lines.push(candidate.description.trim());
  } else {
    lines.push("_No description provided._");
  }

  if (files) {
    const fileLines: string[] = [];
    if (files.added.length) fileLines.push(`- Added: ${formatFileList(files.added)}`);
    if (files.modified.length) fileLines.push(`- Modified: ${formatFileList(files.modified)}`);
    if (files.deleted.length) fileLines.push(`- Deleted: ${formatFileList(files.deleted)}`);
    if (files.renamed.length) {
      fileLines.push(
        `- Renamed: ${files.renamed.map((r) => `\`${r.from}\` → \`${r.to}\``).join(", ")}`
      );
    }
    if (fileLines.length > 0) lines.push("", ...fileLines);
  }
  lines.push("");

  // Consequences: only claim what's inferable from the change itself.
  lines.push("## Consequences", "");
  lines.push(
    inferConsequences(files) ??
      "_Not documented — regenerate with `--ai` for a fuller draft, or edit this file directly._"
  );

  return lines.join("\n");
}
