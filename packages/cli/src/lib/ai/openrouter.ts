import type { AIProvider, DraftADRInput, DraftADRResult } from "./types.js";
import { MAX_DIFF_CHARS, SYSTEM_PROMPT, buildUserPrompt } from "./shared.js";

// Last-resort fallback if the live model list can't be fetched. OpenRouter
// rotates its free lineup, so this can go stale — the real source of truth
// is the live pick below.
const FALLBACK_MODEL = "openai/gpt-oss-20b:free";
const MODELS_URL = "https://openrouter.ai/api/v1/models";
const CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";

// Publishers whose free models have generally held up well for
// instruction-following/drafting tasks. Not exhaustive — just a tiebreaker
// so we don't land on an obscure or narrowly-scoped free model.
const PREFERRED_PUBLISHERS = ["openai/", "google/", "meta-llama/", "mistralai/", "qwen/", "nvidia/"];

interface OpenRouterModel {
  id: string;
  pricing?: { prompt?: string; completion?: string };
  context_length?: number;
  architecture?: { input_modalities?: string[]; output_modalities?: string[] };
}

interface OpenRouterModelsResponse {
  data?: OpenRouterModel[];
}

interface OpenRouterChatResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message?: string };
}

function isFree(model: OpenRouterModel): boolean {
  if (model.id.endsWith(":free")) return true;
  const prompt = Number(model.pricing?.prompt ?? "1");
  const completion = Number(model.pricing?.completion ?? "1");
  return prompt === 0 && completion === 0;
}

// The catalog also includes non-chat models (music/image generation, etc.)
// that happen to be free and otherwise look like a normal entry — plain
// text in, plain text out is the only shape our chat-completions call
// actually works with.
function isTextChatModel(model: OpenRouterModel): boolean {
  const inputs = model.architecture?.input_modalities ?? [];
  const outputs = model.architecture?.output_modalities ?? [];
  return outputs.length === 1 && outputs[0] === "text" && inputs.includes("text");
}

async function pickLiveFreeModel(): Promise<string | null> {
  const res = await fetch(MODELS_URL);
  if (!res.ok) return null;

  const data = (await res.json()) as OpenRouterModelsResponse;
  const free = (data.data ?? []).filter((m) => isFree(m) && isTextChatModel(m));
  if (free.length === 0) return null;

  const preferred = free.filter((m) => PREFERRED_PUBLISHERS.some((p) => m.id.startsWith(p)));
  const pool = preferred.length > 0 ? preferred : free;

  pool.sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0));
  return pool[0].id;
}

// Memoized per process so a multi-candidate `scan --ai --all` run doesn't
// refetch the catalog once per ADR.
let cachedLiveModel: Promise<string | null> | null = null;

async function resolveModel(): Promise<string> {
  if (process.env.VERDIKT_MODEL) return process.env.VERDIKT_MODEL;

  if (!cachedLiveModel) {
    cachedLiveModel = pickLiveFreeModel().catch(() => null);
  }
  return (await cachedLiveModel) ?? FALLBACK_MODEL;
}

export const openrouterProvider: AIProvider = {
  name: "OpenRouter",

  async draftADR(input: DraftADRInput): Promise<DraftADRResult> {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error(
        "OPENROUTER_API_KEY is not set. Get a free key at https://openrouter.ai/keys."
      );
    }

    const model = await resolveModel();
    const diff = input.diff.slice(0, MAX_DIFF_CHARS);

    const res = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://github.com/kelvin511/verdikt",
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

    const data = (await res.json().catch(() => ({}))) as OpenRouterChatResponse;

    if (!res.ok) {
      throw new Error(
        `OpenRouter request failed (${res.status}) using model "${model}": ${data.error?.message ?? res.statusText}`
      );
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("OpenRouter did not return a text response for this ADR draft.");
    }
    return { content, model };
  },
};
