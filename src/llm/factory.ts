// The one place that maps LLM_PROVIDER -> a concrete LLMProvider. Callers (startBot, scripts)
// go through here so adding a backend is one entry in PROVIDERS, and a typo in LLM_PROVIDER
// fails loudly at startup rather than silently sending meals to the wrong vendor.

import type { LLMProvider } from "./provider.ts";
import { OpenRouterProvider } from "./openrouter.ts";

/** Just the config fields a provider needs — keeps this usable from tests and scripts. */
export interface ProviderConfig {
  llmProvider: string;
  openrouterApiKey: string;
  llmModel: string;
  llmTimeoutMs: number;
}

const PROVIDERS: Record<string, (c: ProviderConfig) => LLMProvider> = {
  openrouter: (c) =>
    new OpenRouterProvider({
      apiKey: c.openrouterApiKey,
      model: c.llmModel,
      timeoutMs: c.llmTimeoutMs,
    }),
};

export const SUPPORTED_PROVIDERS = Object.keys(PROVIDERS);

export function createProvider(config: ProviderConfig): LLMProvider {
  const key = config.llmProvider.trim().toLowerCase();
  const build = PROVIDERS[key];
  if (!build) {
    throw new Error(
      `Unknown LLM_PROVIDER "${config.llmProvider}" — supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
    );
  }
  return build(config);
}
