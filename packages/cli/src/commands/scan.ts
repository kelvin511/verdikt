import prompts from "prompts";
import { findRepoRoot, verdiktDir } from "../lib/paths.js";
import { listMergedPullRequests, getPullRequestDiff, prToCandidate } from "../lib/github.js";
import { listGitCandidates, getCommitDiff } from "../lib/gitlog.js";
import { filterCandidates } from "../lib/heuristics.js";
import { buildADRMarkdown, saveADR, templateCandidate } from "../lib/adr.js";
import { draftADR } from "../lib/claude.js";
import type { Candidate } from "../lib/types.js";

export type ScanSource = "git" | "github";

export interface ScanOptions {
  all?: boolean;
  ai?: boolean;
  source?: ScanSource;
  limit?: number;
  sizeThreshold?: number;
  since?: string;
}

async function fetchCandidates(repoRoot: string, options: ScanOptions): Promise<Candidate[]> {
  if (options.source === "github") {
    console.log("Fetching merged pull requests via gh CLI...");
    const prs = await listMergedPullRequests(options.limit ?? 50);
    return prs.map(prToCandidate);
  }

  console.log("Scanning git history across all branches...");
  return listGitCandidates(repoRoot, {
    limit: options.limit ?? 200,
    since: options.since,
  });
}

async function fetchDiff(repoRoot: string, candidate: Candidate): Promise<string> {
  if (candidate.source === "github" && candidate.prNumber !== undefined) {
    return getPullRequestDiff(candidate.prNumber);
  }
  if (candidate.sha) {
    return getCommitDiff(repoRoot, candidate.sha, candidate.parentSha);
  }
  return "";
}

function describeCandidate(c: Candidate): string {
  const stats = `(+${c.additions}/-${c.deletions})`;
  if (c.source === "github") {
    return `#${c.id} ${c.title} ${stats}`;
  }
  const kind = c.isMerge ? "merge" : "commit";
  return `${c.id} [${kind}] ${c.title} ${stats}`;
}

export async function runScan(options: ScanOptions): Promise<void> {
  const repoRoot = await findRepoRoot();
  const outDir = verdiktDir(repoRoot);

  const candidates = await fetchCandidates(repoRoot, options);
  const matched = filterCandidates(candidates, options.sizeThreshold);

  if (matched.length === 0) {
    console.log(
      "No candidate decisions found. Try lowering --size-threshold, widening --since, or tagging a commit/PR with [ADR]."
    );
    return;
  }

  let selected: Candidate[] = matched;
  if (!options.all) {
    const response = await prompts({
      type: "multiselect",
      name: "items",
      message: `Found ${matched.length} candidate decision(s). Select which to turn into ADRs:`,
      choices: matched.map((c) => ({
        title: describeCandidate(c),
        value: c,
        selected: true,
      })),
    });
    selected = (response.items as Candidate[] | undefined) ?? [];
  }

  if (selected.length === 0) {
    console.log("Nothing selected. Exiting.");
    return;
  }

  for (const candidate of selected) {
    let body: string;
    if (options.ai) {
      console.log(`Drafting ADR for ${candidate.id} with Claude...`);
      const diff = await fetchDiff(repoRoot, candidate);
      body = await draftADR({ title: candidate.title, description: candidate.description, diff });
    } else {
      body = templateCandidate(candidate);
    }

    const adr = buildADRMarkdown(candidate, body);
    const savedPath = saveADR(outDir, adr);
    console.log(`Saved ${savedPath}`);
  }

  console.log('\nDone. Run "verdikt serve" to view your ADRs.');
}
