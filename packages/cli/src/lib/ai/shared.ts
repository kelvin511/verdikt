import type { DraftADRInput } from "./types.js";

export const MAX_DIFF_CHARS = 12000;

export const SYSTEM_PROMPT = [
  "You draft Architectural Decision Records (ADRs) from a merged pull request or commit.",
  "Write a concise, readable ADR body in Markdown with exactly these sections,",
  "in this order: ## Context, ## Decision, ## Consequences.",
  "Do not include a top-level title heading — the caller adds that separately.",
  "Base the ADR only on the title, description, and diff provided.",
].join(" ");

export function buildUserPrompt(input: DraftADRInput, diff: string): string {
  return [
    `Title: ${input.title}`,
    "",
    "Description:",
    input.description.trim() || "(none provided)",
    "",
    "Diff (may be truncated):",
    diff || "(no diff available)",
  ].join("\n");
}
