export type ADRSource = "git" | "github";

export interface ADRSummary {
  slug: string;
  title: string;
  date: string;
  source: ADRSource;
  /** Short SHA for git-sourced ADRs, PR number (as a string) for github-sourced ones. */
  ref: string;
  author: string;
  status: string;
  url?: string;
  branch?: string;
}

export interface ADRDetail extends ADRSummary {
  content: string;
}

export async function fetchADRs(): Promise<ADRSummary[]> {
  const res = await fetch("/api/adrs");
  if (!res.ok) throw new Error("Failed to fetch ADRs");
  return res.json();
}

export async function fetchADR(slug: string): Promise<ADRDetail> {
  const res = await fetch(`/api/adrs/${encodeURIComponent(slug)}`);
  if (!res.ok) throw new Error("Failed to fetch ADR");
  return res.json();
}

export function refLabel(adr: Pick<ADRSummary, "source" | "ref">): string {
  return adr.source === "github" ? `PR #${adr.ref}` : `commit ${adr.ref}`;
}
