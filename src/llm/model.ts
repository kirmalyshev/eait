// `LLM_PROVIDER` + `LLM_MODEL` → a Mastra model-router id. This is `factory.ts`'s job re-homed onto
// Mastra, and it keeps that module's one non-negotiable contract: an unknown provider dies at
// STARTUP, never silently falls back and never degrades into per-call failures.
//
// Mastra resolves `openrouter/<model>` itself — `@mastra/core`'s provider registry already carries
// `openrouter` with `https://openrouter.ai/api/v1` and `apiKeyEnvVar: OPENROUTER_API_KEY`, so no AI
// SDK provider package is needed (verified by a live call). That convenience is also the hazard this
// module exists for: the router happily accepts a provider string it has no credentials for and
// fails later, once per meal, which reads as "the model is flaky" rather than "the env is wrong".

/** Providers this app is wired for. Mastra knows many more; this is the list WE support. */
export const SUPPORTED_PROVIDERS = ["openrouter"] as const;
export type SupportedProvider = (typeof SUPPORTED_PROVIDERS)[number];

const isSupported = (v: string): v is SupportedProvider =>
  (SUPPORTED_PROVIDERS as readonly string[]).includes(v);

/** The config fields a model id is built from — the Mastra-era shrink of `ProviderConfig`. The
 * API key is absent on purpose: Mastra reads it from the environment via the provider registry, so
 * threading it through here would create a second, divergent source for the same secret. */
export interface ModelConfig {
  llmProvider: string;
  llmModel: string;
}

export function modelRouterId(config: ModelConfig): string {
  const provider = config.llmProvider.trim().toLowerCase();
  if (!isSupported(provider)) {
    throw new Error(
      `Unknown LLM_PROVIDER "${config.llmProvider}" — supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
    );
  }
  const model = config.llmModel.trim();
  if (!model) {
    throw new Error(`LLM_MODEL is empty — set it to a model id, e.g. "x-ai/grok-4.5"`);
  }
  // A model already carrying its provider prefix is passed through rather than prefixed again:
  // `openrouter/openrouter/x-ai/grok-4.5` is a model id that exists nowhere, and the vendor reports
  // it per call rather than at boot.
  return model.startsWith(`${provider}/`) ? model : `${provider}/${model}`;
}
