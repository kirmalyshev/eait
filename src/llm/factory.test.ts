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

  // Only "constructor" was ever a live hole: it resolved to the Object constructor, and
  // Object(config) handed the config back as the "provider", so nothing threw at all.
  // "__proto__" threw, but as "build is not a function" with no mention of LLM_PROVIDER.
  test.each(["constructor", "__proto__"])(
    "rejects the prototype key %p that used to slip past the guard",
    (key) => {
      expect(() => createProvider({ ...base, llmProvider: key })).toThrow(/LLM_PROVIDER/);
    },
  );

  // These were never reachable — .toLowerCase() mangles them to "tostring" etc., which match
  // nothing. Kept as a cheap regression net in case the lookup ever stops normalizing case.
  test.each(["toString", "valueOf", "hasOwnProperty"])("rejects %p", (key) => {
    expect(() => createProvider({ ...base, llmProvider: key })).toThrow(/LLM_PROVIDER/);
  });

  test("lists the registered providers, so the error can't degrade to an empty set", () => {
    // Object.keys over a null-prototype table: swapping it for a Map would silently yield [].
    expect(() => createProvider({ ...base, llmProvider: "nope" })).toThrow(
      /supported: openrouter$/,
    );
  });

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

  // Third constructor argument. Without this, deleting `timeoutMs: c.llmTimeoutMs` from the
  // factory leaves every request on OpenRouterProvider's 60s default and no test notices.
  test("passes llmTimeoutMs through — a dropped timeout is silent otherwise", async () => {
    const p = createProvider({ ...base, llmProvider: "openrouter", llmTimeoutMs: 25 });
    const original = globalThis.fetch;
    // Never settles: only the provider's own timeout can end this call.
    globalThis.fetch = ((_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch;
    const started = performance.now();
    try {
      await expect(p.chat({ system: "s", userText: "u" })).rejects.toThrow();
    } finally {
      globalThis.fetch = original;
    }
    // Comfortably under the 60s default, so this fails if the timeout is not wired through.
    expect(performance.now() - started).toBeLessThan(5000);
  });
});
