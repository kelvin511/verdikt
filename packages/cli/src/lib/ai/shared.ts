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

const RETRYABLE_STATUS = new Set([429, 500, 502, 503]);
const MAX_RETRIES = 3;

/**
 * fetch() that backs off and retries rate-limit/overload responses. Free
 * tiers (Gemini, OpenRouter) return 429s quickly once several ADRs draft in
 * parallel; without this one throttled request would abort the whole scan.
 */
export async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, init);
    if (!RETRYABLE_STATUS.has(res.status) || attempt === MAX_RETRIES) return res;

    const retryAfter = Number(res.headers.get("retry-after"));
    const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : 2000 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
