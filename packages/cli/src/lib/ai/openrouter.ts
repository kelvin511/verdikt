import type { AIProvider, DraftADRInput } from "./types.js";
import { MAX_DIFF_CHARS, SYSTEM_PROMPT, buildUserPrompt } from "./shared.js";

// OpenRouter proxies many providers behind one OpenAI-compatible API and
// includes several free-tier (":free" suffixed) models. This default can
// go stale as OpenRouter rotates its free lineup — override with
// VERDIKT_MODEL if it does.
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct:free";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

export const openrouterProvider: AIProvider = {
  name: "OpenRouter",

  async draftADR(input: DraftADRInput): Promise<string> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set. Get a free key at https://openrouter.ai/keys."
      );
    }

    const model = process.env.VERDIKT_MODEL ?? DEFAULT_MODEL;
    const diff = input.diff.slice(0, MAX_DIFF_CHARS);

    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/verdikt-dev/verdikt",
        "X-Title": "Verdikt",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: buildUserPrompt(input, diff) },
        ],
      }),
    });

    const data = (await res.json().catch(() => ({}))) as OpenRouterResponse;

    if (!res.ok) {
      throw new Error(
        `OpenRouter request failed (${res.status}): ${data.error?.message ?? res.statusText}`
      );
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter did not return a text response for this ADR draft.");
    }
    return content;
  },
};
