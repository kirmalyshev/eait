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

  // A plain object literal inherits Object.prototype, so a lookup by these keys finds a
  // truthy member and skips the guard. "constructor" is the dangerous one: Object(config)
  // returns the config itself, so the bot boots "fine" and only dies on the first meal photo.
  test.each(["constructor", "__proto__", "toString", "valueOf", "hasOwnProperty"])(
    "rejects the inherited Object.prototype key %p",
    (key) => {
      expect(() => createProvider({ ...base, llmProvider: key })).toThrow(/LLM_PROVIDER/);
    },
  );

  test("rejects an empty provider rather than defaulting", () => {
    expect(() => createProvider({ ...base, llmProvider: "   " })).toThrow(/LLM_PROVIDER/);
  });

  test("passes the config through to the provider", async () => {
    const p = createProvider({
      llmProvider: "openrouter",
      openrouterApiKey: "secret-key",
      llmModel: "vendor/model-x",
      llmTimeoutMs: 4242,
    });
    // Assert the wiring, not just the class: a swapped argument would still be instanceof.
    let seen: RequestInit | undefined;
    const original = globalThis.fetch;
    globalThis.fetch = (async (_url: string, init: RequestInit) => {
      seen = init;
      return new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }) as unknown as typeof fetch;
    try {
      await p.chat({ system: "s", userText: "u" });
    } finally {
      globalThis.fetch = original;
    }
    expect((seen!.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
    expect(JSON.parse(seen!.body as string).model).toBe("vendor/model-x");
  });
});
