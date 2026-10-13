import { simpleGit } from "simple-git";
import type { Candidate } from "./types.js";

// Unit/record separators — practically never appear in commit metadata, so
// they let us split a single `git log` call back into structured records
// without a fragile line-based parser.
const FIELD_SEP = "\x1f";
const RECORD_SEP = "\x1e";

export interface GitScanOptions {
  /** Cap on the number of commits considered, across all branches. */
  limit?: number;
  /** Only include commits after this point, e.g. "30 days ago" or "2026-01-01". */
  since?: string;
}

/**
 * Walks the full history of every local and remote-tracking branch (git log
 * --all) and returns one candidate per commit, with additions/deletions
 * computed against each commit's first parent. This is what makes scanning
 * source-independent of GitHub — it works on any git repo, any host, no
 * `gh` required.
 *
 * Line counts come from `--numstat` in the same `git log` call (merges diffed
 * against their first parent) — one subprocess total instead of one per
 * commit, which is what made large histories slow to scan.
 */
export async function listGitCandidates(
  repoRoot: string,
  options: GitScanOptions = {}
): Promise<Candidate[]> {
  const git = simpleGit(repoRoot);

  const args = [
    "log",
    "--all",
    "--date=short",
    "--numstat",
    "--diff-merges=first-parent",
    // Record separator leads each record so the numstat lines git prints
    // after the formatted header land in the same record, as its last field.
    `--pretty=format:${RECORD_SEP}%H${FIELD_SEP}%h${FIELD_SEP}%an${FIELD_SEP}%ad${FIELD_SEP}%P${FIELD_SEP}%s${FIELD_SEP}%b${FIELD_SEP}`,
  ];
  if (options.since) args.push(`--since=${options.since}`);
  if (options.limit) args.push(`--max-count=${options.limit}`);

  let raw: string;
  try {
    raw = await git.raw(args);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/does not have any commits yet|unknown revision or path/i.test(message)) {
      // A freshly-initialized repo with no commits. Nothing to scan yet.
      return [];
    }
    throw new Error(`Failed to read git history.\n${message}`);
  }

  const records = raw
    .split(RECORD_SEP)
    .map((r) => r.trim())
    .filter(Boolean);

  const candidates: Candidate[] = [];
  for (const record of records) {
    const [fullSha, shortSha, author, date, parentsRaw, subject, body = "", numstat = ""] =
      record.split(FIELD_SEP);
    if (!fullSha) continue;

    const parents = parentsRaw.trim().split(/\s+/).filter(Boolean);
    const isMerge = parents.length > 1;
    const parentSha = parents[0];

    const stat = sumNumstat(numstat);

    candidates.push({
      source: "git",
      id: shortSha,
      sha: fullSha,
      parentSha: isMerge ? parentSha : undefined,
      title: subject.trim(),
      description: body.trim(),
      author: author.trim(),
      date: date.trim(),
      branch: isMerge ? extractBranchName(subject) : undefined,
      isMerge,
      additions: stat.additions,
      deletions: stat.deletions,
    });
  }

  return candidates;
}

function sumNumstat(output: string): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const line of output.split("\n")) {
    const [a, d] = line.split("\t");
    const added = Number(a);
    const deleted = Number(d);
    if (Number.isFinite(added)) additions += added;
    if (Number.isFinite(deleted)) deletions += deleted;
  }
  return { additions, deletions };
}

/** Full diff text for a single commit, used for `--ai` drafting. */
export async function getCommitDiff(
  repoRoot: string,
  sha: string,
  parentSha?: string
): Promise<string> {
  const git = simpleGit(repoRoot);
  const range = parentSha ? `${parentSha}..${sha}` : `${sha}^..${sha}`;
  try {
    return await git.raw(["diff", range]);
  } catch {
    return await git.raw(["show", sha]);
  }
}

function extractBranchName(subject: string): string | undefined {
  let m = subject.match(/Merge branch '([^']+)'/);
  if (m) return m[1];
  m = subject.match(/Merge remote-tracking branch '([^']+)'/);
  if (m) return m[1];
  m = subject.match(/Merge pull request #\d+ from [^/]+\/(.+)$/);
  if (m) return m[1];
  return undefined;
}
