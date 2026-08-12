import type { AIProvider, DraftADRInput, DraftADRResult } from "./types.js";
import { MAX_DIFF_CHARS, SYSTEM_PROMPT, buildUserPrompt } from "./shared.js";

// Last-resort fallback if the live model list can't be fetched. Google
// retires dated model versions over time — the real source of truth is the
// live pick below, which prefers Google's own rolling "-latest" aliases.
const FALLBACK_MODEL = "gemini-flash-latest";

interface GeminiModel {
  name: string;
  supportedGenerationMethods?: string[];
}

interface GeminiModelsResponse {
  models?: GeminiModel[];
}

interface GeminiChatResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
}

// The ListModels response has no clean text-vs-audio/image modality field
// like OpenRouter's — some non-text models (Lyria music generation, at
// least) still claim generateContent support. Exclude known non-text
// families by name so a fallback pick can't land on one.
const NON_TEXT_MODEL_PATTERN = /lyria|imagen|veo|embedding|aqa/i;

async function pickLiveModel(apiKey: string): Promise<string | null> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
  );
  if (!res.ok) return null;

  const data = (await res.json()) as GeminiModelsResponse;
  const names = (data.models ?? [])
    .filter((m) => (m.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""))
    .filter((n) => !NON_TEXT_MODEL_PATTERN.test(n));

  if (names.length === 0) return null;

  // Prefer Google's rolling aliases (won't go stale the way a dated model
  // does), favoring "flash" for cost/speed, then any other "-latest" alias.
  // If none of those exist, fall back to the hardcoded default rather than
  // guessing at an arbitrary remaining entry.
  return (
    names.find((n) => n === "gemini-flash-latest") ??
    names.find((n) => n.endsWith("-latest") && n.includes("flash")) ??
    names.find((n) => n.endsWith("-latest")) ??
    null
  );
}

// Memoized per process so a multi-candidate `scan --ai --all` run doesn't
// refetch the catalog once per ADR.
let cachedLiveModel: Promise<string | null> | null = null;

async function resolveModel(apiKey: string): Promise<string> {
  if (process.env.VERDIKT_MODEL) return process.env.VERDIKT_MODEL;

  if (!cachedLiveModel) {
    cachedLiveModel = pickLiveModel(apiKey).catch(() => null);
  }
  return (await cachedLiveModel) ?? FALLBACK_MODEL;
}

export const googleProvider: AIProvider = {
  name: "Google Gemini",

  async draftADR(input: DraftADRInput): Promise<DraftADRResult> {
    const apiKey = process.env.GOOGLE_API_KEY ?? process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error(
        "GOOGLE_API_KEY (or GEMINI_API_KEY) is not set. Get a free key at https://aistudio.google.com/apikey."
      );
    }

    const model = await resolveModel(apiKey);
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

    const data = (await res.json().catch(() => ({}))) as GeminiChatResponse;

    if (!res.ok) {
      throw new Error(
        `Google Gemini request failed (${res.status}) using model "${model}": ${data.error?.message ?? res.statusText}`
      );
    }

    const content = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("");
    if (!content) {
      throw new Error("Gemini did not return a text response for this ADR draft.");
    }
    return { content, model };
  },
};
