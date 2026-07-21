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

// Object.create(null), not {}: a plain literal inherits Object.prototype, so LLM_PROVIDER=constructor
// would resolve to the Object constructor — truthy, callable, and Object(config) hands back the config
// itself. The bot would boot clean and only die on the first meal photo. A null-prototype table (plus
// the hasOwn guard below) makes every non-registered value take the error path.
const PROVIDERS: Record<string, (c: ProviderConfig) => LLMProvider> = Object.assign(
  Object.create(null),
  {
    openrouter: (c: ProviderConfig) =>
      new OpenRouterProvider({
        apiKey: c.openrouterApiKey,
        model: c.llmModel,
        timeoutMs: c.llmTimeoutMs,
      }),
  },
);

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
