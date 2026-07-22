import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { OpenRouterProvider } from "./openrouter.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function jsonResponse(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("OpenRouterProvider.chat — request shape", () => {
  let calls: Array<{ url: string; init: any }>;
  beforeEach(() => {
    calls = [];
    globalThis.fetch = (async (url: string, init: any) => {
      calls.push({ url, init });
      return jsonResponse({ choices: [{ message: { content: '{"isFood":true}' } }] });
    }) as any;
  });

  test("posts to OpenRouter with auth, model, image, and response_format; returns content", async () => {
    const p = new OpenRouterProvider({ apiKey: "test-key", model: "openai/gpt-5.2", log: () => {} });
    const out = await p.chat({
      system: "sys",
      userText: "analyze this",
      imageB64: "QUJD",
      jsonSchema: { type: "object" },
    });
    expect(out).toBe('{"isFood":true}');

    expect(calls.length).toBe(1);
    const { url, init } = calls[0]!;
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test-key");

    const body = JSON.parse(init.body);
    expect(body.model).toBe("openai/gpt-5.2");
    const userMsg = body.messages.find((m: any) => m.role === "user");
    const img = userMsg.content.find((c: any) => c.type === "image_url");
    expect(img.image_url.url).toContain("data:image/jpeg;base64,QUJD");
    const sysMsg = body.messages.find((m: any) => m.role === "system");
    expect(sysMsg.content).toBe("sys");
    expect(body.response_format).toBeDefined();
    expect(body.response_format.type).toBe("json_schema");
  });

  test("omits image + response_format when not provided", async () => {
    const p = new OpenRouterProvider({ apiKey: "k", model: "m", log: () => {} });
    await p.chat({ system: "s", userText: "u" });
    const body = JSON.parse(calls[0]!.init.body);
    const userMsg = body.messages.find((m: any) => m.role === "user");
    expect(userMsg.content.some((c: any) => c.type === "image_url")).toBe(false);
    expect(body.response_format).toBeUndefined();
  });

  test("forwards temperature when set; omits it when unset (provider default)", async () => {
    const p = new OpenRouterProvider({ apiKey: "k", model: "m", log: () => {} });
    await p.chat({ system: "s", userText: "u", temperature: 0.2 });
    expect(JSON.parse(calls[0]!.init.body).temperature).toBe(0.2);
    await p.chat({ system: "s", userText: "u" });
    expect(JSON.parse(calls[1]!.init.body).temperature).toBeUndefined();
  });
});

describe("OpenRouterProvider.chat — timeout", () => {
  test("aborts and throws when the request outlives the timeout", async () => {
    globalThis.fetch = ((_url: string, init: any) =>
      new Promise((_resolve, reject) => {
        init.signal.addEventListener("abort", () =>
          reject(new DOMException("The operation was aborted", "AbortError")),
        );
      })) as any;
    const p = new OpenRouterProvider({
      apiKey: "k",
      model: "m",
      timeoutMs: 5,
      maxRetries: 0,
      log: () => {},
    });
    await expect(p.chat({ system: "s", userText: "u" })).rejects.toThrow(/timeout|abort/i);
  });
});

describe("OpenRouterProvider.chat — backoff on 429/5xx", () => {
  test("retries a 429 up to maxRetries then surfaces it", async () => {
    let n = 0;
    globalThis.fetch = (async () => {
      n++;
      return new Response("rate limited", { status: 429 });
    }) as any;
    const p = new OpenRouterProvider({
      apiKey: "k",
      model: "m",
      maxRetries: 2,
      retryBaseMs: 0,
      log: () => {},
    });
    await expect(p.chat({ system: "s", userText: "u" })).rejects.toThrow(/429/);
    expect(n).toBe(3); // initial + 2 retries
  });

  test("retries a 500 then succeeds", async () => {
    let n = 0;
    globalThis.fetch = (async () => {
      n++;
      if (n < 3) return new Response("boom", { status: 500 });
      return jsonResponse({ choices: [{ message: { content: "ok" } }] });
    }) as any;
    const p = new OpenRouterProvider({
      apiKey: "k",
      model: "m",
      maxRetries: 2,
      retryBaseMs: 0,
      log: () => {},
    });
    expect(await p.chat({ system: "s", userText: "u" })).toBe("ok");
    expect(n).toBe(3);
  });

  test("throws on a non-retryable 4xx", async () => {
    globalThis.fetch = (async () => new Response("bad", { status: 400 })) as any;
    const p = new OpenRouterProvider({ apiKey: "k", model: "m", maxRetries: 2, log: () => {} });
    await expect(p.chat({ system: "s", userText: "u" })).rejects.toThrow(/400/);
  });
});
