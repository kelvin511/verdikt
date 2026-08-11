export type CandidateSource = "git" | "github";

/**
 * A generalized decision candidate — either a commit/merge from local git
 * history, or a merged PR fetched via the GitHub CLI. `scan` and `serve`
 * operate on this shape so the rest of the tool doesn't care which source
 * produced it.
 */
export interface Candidate {
  source: CandidateSource;
  /** Short, human-readable identifier: short SHA for git, "123" for GitHub PRs. */
  id: string;
  title: string;
  description: string;
  author: string;
  /** YYYY-MM-DD */
  date: string;
  additions: number;
  deletions: number;
  url?: string;
  /** Branch name, when it can be determined (merge commits, PR head branch). */
  branch?: string;
  isMerge?: boolean;
  /** Full commit SHA — git source only. */
  sha?: string;
  /** First parent SHA, used to diff a merge commit — git source only. */
  parentSha?: string;
  /** PR number — github source only. */
  prNumber?: number;
}
