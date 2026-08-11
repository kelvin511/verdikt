import type { AIProvider } from "./types.js";
import { anthropicProvider } from "./anthropic.js";
import { openrouterProvider } from "./openrouter.js";
import { googleProvider } from "./google.js";

export type ProviderName = "anthropic" | "openrouter" | "google";

const PROVIDERS: Record<ProviderName, AIProvider> = {
  anthropic: anthropicProvider,
  openrouter: openrouterProvider,
  google: googleProvider,
};

const ENV_KEYS: Record<ProviderName, string[]> = {
  openrouter: ["OPENROUTER_API_KEY"],
  google: ["GOOGLE_API_KEY", "GEMINI_API_KEY"],
  anthropic: ["ANTHROPIC_API_KEY"],
};

// Preference order when no --provider / VERDIKT_AI_PROVIDER is given:
// free-tier-friendly providers first, Claude (paid) last.
const AUTO_DETECT_ORDER: ProviderName[] = ["openrouter", "google", "anthropic"];

function isKnownProvider(name: string): name is ProviderName {
  return name in PROVIDERS;
}

/**
 * Picks which AI provider to use for `--ai` drafting: an explicit --provider
 * flag wins, then VERDIKT_AI_PROVIDER, then whichever provider has an API
 * key set — checked in free-tier-first order — and finally a helpful error
 * if nothing is configured.
 */
export function resolveAIProvider(explicit?: string): AIProvider {
  if (explicit) {
    if (!isKnownProvider(explicit)) {
      throw new Error(
        `Unknown --provider "${explicit}". Choose one of: ${Object.keys(PROVIDERS).join(", ")}.`
      );
    }
    return PROVIDERS[explicit];
  }

  const envChoice = process.env.VERDIKT_AI_PROVIDER;
  if (envChoice) {
    if (!isKnownProvider(envChoice)) {
      throw new Error(
        `Unknown VERDIKT_AI_PROVIDER "${envChoice}". Choose one of: ${Object.keys(PROVIDERS).join(", ")}.`
      );
    }
    return PROVIDERS[envChoice];
  }

  for (const name of AUTO_DETECT_ORDER) {
    if (ENV_KEYS[name].some((key) => process.env[key])) {
      return PROVIDERS[name];
    }
  }

  throw new Error(
    [
      "No AI provider configured for --ai. Set one of these environment variables:",
      "  OPENROUTER_API_KEY               free-tier models — https://openrouter.ai/keys",
      "  GOOGLE_API_KEY / GEMINI_API_KEY  free tier — https://aistudio.google.com/apikey",
      "  ANTHROPIC_API_KEY                Claude, paid — https://console.anthropic.com/settings/keys",
      "...or pass --provider explicitly.",
    ].join("\n")
  );
}
