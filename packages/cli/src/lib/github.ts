import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Candidate } from "./types.js";

const execFileAsync = promisify(execFile);

export interface PullRequest {
  number: number;
  title: string;
  body: string | null;
  url: string;
  author: { login: string } | null;
  headRefName?: string;
  mergedAt: string;
  additions: number;
  deletions: number;
}

export function prToCandidate(pr: PullRequest): Candidate {
  return {
    source: "github",
    id: String(pr.number),
    prNumber: pr.number,
    title: pr.title,
    description: pr.body ?? "",
    author: pr.author?.login ?? "unknown",
    date: pr.mergedAt ? pr.mergedAt.slice(0, 10) : new Date().toISOString().slice(0, 10),
    additions: pr.additions ?? 0,
    deletions: pr.deletions ?? 0,
    url: pr.url,
    branch: pr.headRefName,
  };
}

function explainGhFailure(err: unknown): Error {
  const message = err instanceof Error ? err.message : String(err);
  return new Error(
    `Failed to run "gh". Make sure the GitHub CLI is installed and authenticated (gh auth login).\n${message}`
  );
}

export async function listMergedPullRequests(limit = 50): Promise<PullRequest[]> {
  let stdout: string;
  try {
    const result = await execFileAsync("gh", [
      "pr",
      "list",
      "--state",
      "merged",
      "--limit",
      String(limit),
      "--json",
      "number,title,body,url,author,headRefName,mergedAt,additions,deletions",
    ]);
    stdout = result.stdout;
  } catch (err) {
    throw explainGhFailure(err);
  }
  return JSON.parse(stdout) as PullRequest[];
}

export async function getPullRequestDiff(number: number): Promise<string> {
  try {
    const { stdout } = await execFileAsync("gh", ["pr", "diff", String(number)]);
    return stdout;
  } catch (err) {
    throw explainGhFailure(err);
  }
}
