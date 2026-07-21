import { describe, expect, test } from "bun:test";
import { createProvider } from "./factory.ts";
import { OpenRouterProvider } from "./openrouter.ts";

const base = { openrouterApiKey: "k", llmModel: "m", llmTimeoutMs: 1000 };

describe("createProvider", () => {
  test("builds an OpenRouter provider for LLM_PROVIDER=openrouter", () => {
    const p = createProvider({ ...base, llmProvider: "openrouter" });
    expect(p).toBeInstanceOf(OpenRouterProvider);
  });

  test("is case- and whitespace-insensitive", () => {
    expect(createProvider({ ...base, llmProvider: " OpenRouter " })).toBeInstanceOf(
      OpenRouterProvider,
    );
  });

  // Silently falling back would send a user's meals to a provider they didn't configure.
  test("throws on an unknown provider instead of falling back", () => {
    expect(() => createProvider({ ...base, llmProvider: "totally-made-up" })).toThrow(
      /LLM_PROVIDER/,
    );
  });

  test("names the supported providers in the error", () => {
    expect(() => createProvider({ ...base, llmProvider: "nope" })).toThrow(/openrouter/);
  });
});
