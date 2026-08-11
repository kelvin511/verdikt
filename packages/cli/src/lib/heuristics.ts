import type { Candidate } from "./types.js";

const ADR_TAG_PATTERN = /\[adr\]/i;
const DEFAULT_SIZE_THRESHOLD = 100;

export function isCandidateDecision(
  candidate: Candidate,
  sizeThreshold: number = DEFAULT_SIZE_THRESHOLD
): boolean {
  const taggedManually =
    ADR_TAG_PATTERN.test(candidate.title) || ADR_TAG_PATTERN.test(candidate.description ?? "");
  const diffSize = (candidate.additions ?? 0) + (candidate.deletions ?? 0);
  return taggedManually || diffSize >= sizeThreshold;
}

export function filterCandidates(
  candidates: Candidate[],
  sizeThreshold?: number
): Candidate[] {
  return candidates.filter((c) => isCandidateDecision(c, sizeThreshold));
}
