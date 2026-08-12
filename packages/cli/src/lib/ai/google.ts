import type { AIProvider, DraftADRInput } from "./types.js";
import { MAX_DIFF_CHARS, SYSTEM_PROMPT, buildUserPrompt } from "./shared.js";

// "-latest" is a rolling alias Google maintains, so this stays valid even
// as they retire specific dated models (gemini-2.0-flash, for one, is
// already gone as of 2026-08). Confirm current options any time via:
//   GET https://generativelanguage.googleapis.com/v1beta/models?key=$GOOGLE_API_KEY
// Override with VERDIKT_MODEL if you want to pin a specific version.
const DEFAULT_MODEL = "gemini-flash-latest";

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

export const googleProvider: AIProvider = {
  name: "Google Gemini",

  async draftADR(input: DraftADRInput): Promise<string> {
    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_API_KEY (or GEMINI_API_KEY) is not set. Get a free key at https://aistudio.google.com/apikey."
      );
    }

    const model = process.env.VERDIKT_MODEL ?? DEFAULT_MODEL;
    const diff = input.diff.slice(0, MAX_DIFF_CHARS);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${apiKey}`;

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: buildUserPrompt(input, diff) }] }],
        generationConfig: { maxOutputTokens: 4096 },
      }),
    });

    const data = (await res.json().catch(() => ({}))) as GeminiResponse;

    if (!res.ok) {
      throw new Error(
        `Google Gemini request failed (${res.status}): ${data.error?.message ?? res.statusText}`
      );
    }

    const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!content) {
      throw new Error("Gemini did not return a text response for this ADR draft.");
    }
    return content;
  },
};
