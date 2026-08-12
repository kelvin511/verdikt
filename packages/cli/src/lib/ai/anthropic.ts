import Anthropic from "@anthropic-ai/sdk";
import type { AIProvider, DraftADRInput, DraftADRResult } from "./types.js";
import { MAX_DIFF_CHARS, SYSTEM_PROMPT, buildUserPrompt } from "./shared.js";

// Anthropic's aliases (like this one) are stable, curated pointers, not a
// rotating free-tier lineup — no live-fetch self-healing needed here the
// way OpenRouter/Google's free models require.
const DEFAULT_MODEL = "claude-opus-5";

export const anthropicProvider: AIProvider = {
  name: "Anthropic Claude",

  async draftADR(input: DraftADRInput): Promise<DraftADRResult> {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error(
        "ANTHROPIC_API_KEY is not set. Get a key at https://console.anthropic.com/settings/keys, or use --provider openrouter / --provider google for a free option."
      );
    }

    const client = new Anthropic({ apiKey });
    const model = process.env.VERDIKT_MODEL ?? DEFAULT_MODEL;
    const diff = input.diff.slice(0, MAX_DIFF_CHARS);

    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(input, diff) }],
    });

    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );
    if (!textBlock) {
      throw new Error("Claude did not return a text response for this ADR draft.");
    }
    return { content: textBlock.text, model };
  },
};
