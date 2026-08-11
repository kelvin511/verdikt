import fs from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { Candidate } from "./types.js";

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

export function templateCandidate(candidate: Candidate): string {
  const description = candidate.description.trim() || "_No description provided._";
  return [
    "## Context",
    "",
    originLine(candidate),
    "",
    "## Decision",
    "",
    description,
    "",
    "## Consequences",
    "",
    "_Not documented — regenerate with `--ai` for a fuller draft, or edit this file directly._",
  ].join("\n");
}
