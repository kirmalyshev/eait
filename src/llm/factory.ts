// The one place that maps LLM_PROVIDER -> a concrete LLMProvider. Callers (startBot, scripts)
// go through here so adding a backend is one entry in PROVIDERS, and a typo in LLM_PROVIDER
// fails loudly at startup rather than silently sending meals to the wrong vendor.

import type { LLMProvider } from "./provider.ts";
import { OpenRouterProvider } from "./openrouter.ts";

/**
 * The config fields providers are built from. `openrouterApiKey` is vendor-specific and sits here
 * only because OpenRouter is the sole backend; a second vendor should take its credential from a
 * narrower per-provider shape rather than widening this one into a bag of every vendor key.
 */
export interface ProviderConfig {
  llmProvider: string;
  openrouterApiKey: string;
  llmModel: string;
  llmTimeoutMs: number;
}

// `__proto__: null` in an object literal, not Object.assign(Object.create(null), …): both give a
// null-prototype table, but Object.create(null) is typed `any`, which collapses the whole
// expression to `any` and silently turns the Record<> annotation below into decoration — a
// wrong-shaped provider entry would then compile clean. A literal stays structurally checked.
//
// Why null-prototype at all: with a plain {} literal, LLM_PROVIDER=constructor resolves to the
// Object constructor — truthy and callable — and Object(config) hands back the config itself.
// Nothing crashes. The bot boots, and every photo answers "analysis failed" forever while
// onboarding silently drops restrictions, because both call sites catch the resulting TypeError.
// Silent permanent degradation, not a crash. The hasOwn guard below independently closes the same
// hole; keep both, and don't delete one on the grounds that the other suffices.
type ProviderTable = Record<string, (c: ProviderConfig) => LLMProvider>;

// Annotated separately so the literal is structurally checked: a wrong-shaped entry is a compile
// error here. Inlining it into the Object.assign below would not be — Object.create(null) is typed
// `any`, which collapses the whole expression to `any` and turns the annotation into decoration.
const REGISTERED: ProviderTable = {
  openrouter: (c) =>
    new OpenRouterProvider({
      apiKey: c.openrouterApiKey,
      model: c.llmModel,
      timeoutMs: c.llmTimeoutMs,
    }),
};

const PROVIDERS: ProviderTable = Object.assign(Object.create(null), REGISTERED);

const SUPPORTED_PROVIDERS = Object.keys(PROVIDERS);

export function createProvider(config: ProviderConfig): LLMProvider {
  const key = config.llmProvider.trim().toLowerCase();
  const build = Object.hasOwn(PROVIDERS, key) ? PROVIDERS[key] : undefined;
  if (!build) {
    throw new Error(
      `Unknown LLM_PROVIDER "${config.llmProvider}" — supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
    );
  }
  return build(config);
}
