import { describe, expect, test } from "bun:test";
import { modelRouterId, SUPPORTED_PROVIDERS } from "./model.ts";

describe("modelRouterId", () => {
  test("joins provider and model into Mastra's router id", () => {
    expect(modelRouterId({ llmProvider: "openrouter", llmModel: "x-ai/grok-4.5" }))
      .toBe("openrouter/x-ai/grok-4.5");
  });

  test("an unknown provider throws, naming the variable and what IS supported", () => {
    // The contract inherited verbatim from factory.ts: a typo in LLM_PROVIDER kills startup rather
    // than silently sending meals to the wrong vendor. Mastra's router would otherwise accept
    // "openrouterr/..." as a provider it simply has no key for, and fail later, per call.
    expect(() => modelRouterId({ llmProvider: "openrouterr", llmModel: "x-ai/grok-4.5" }))
      .toThrow(/LLM_PROVIDER.*openrouterr.*supported.*openrouter/s);
  });

  test("case and surrounding whitespace do not decide whether the bot boots", () => {
    expect(modelRouterId({ llmProvider: "  OpenRouter ", llmModel: " x-ai/grok-4.5 " }))
      .toBe("openrouter/x-ai/grok-4.5");
  });

  test("an already-prefixed model is not prefixed twice", () => {
    // `openrouter/openrouter/x-ai/grok-4.5` resolves to a model id that does not exist, and the
    // failure arrives per-call from the vendor rather than at startup — the exact class of silent
    // misconfiguration this module exists to convert into a boot error.
    expect(modelRouterId({ llmProvider: "openrouter", llmModel: "openrouter/x-ai/grok-4.5" }))
      .toBe("openrouter/x-ai/grok-4.5");
  });

  test("an empty model is a misconfiguration, not a request for a default", () => {
    expect(() => modelRouterId({ llmProvider: "openrouter", llmModel: "  " }))
      .toThrow(/LLM_MODEL/);
  });

  test("openrouter is registered", () => {
    expect(SUPPORTED_PROVIDERS).toContain("openrouter");
  });
});
