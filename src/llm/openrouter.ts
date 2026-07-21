// OpenRouter (OpenAI-compatible) provider. Every request carries an AbortController timeout;
// 429/5xx get bounded exponential backoff; other non-2xx surface immediately. Latency is logged
// per call. Reads globalThis.fetch at call time so tests can mock it (an override is also allowed).

import type { ChatRequest, LLMProvider } from "./provider.ts";

export interface OpenRouterLogEntry {
  model: string;
  ms: number;
  status: number;
  usage?: unknown;
}

export interface OpenRouterOptions {
  apiKey: string;
  model: string;
  timeoutMs?: number; // default 60000
  maxRetries?: number; // default 2 (429/5xx only)
  retryBaseMs?: number; // default 500
  baseUrl?: string; // default https://openrouter.ai/api/v1
  fetchImpl?: typeof fetch; // default globalThis.fetch (read at call time)
  log?: (entry: OpenRouterLogEntry) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class OpenRouterProvider implements LLMProvider {
  private readonly apiKey: string;
  private readonly model: string;
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly retryBaseMs: number;
  private readonly baseUrl: string;
  private readonly fetchImpl?: typeof fetch;
  private readonly log: (entry: OpenRouterLogEntry) => void;

  constructor(opts: OpenRouterOptions) {
    this.apiKey = opts.apiKey;
    this.model = opts.model;
    this.timeoutMs = opts.timeoutMs ?? 60000;
    this.maxRetries = opts.maxRetries ?? 2;
    this.retryBaseMs = opts.retryBaseMs ?? 500;
    this.baseUrl = opts.baseUrl ?? "https://openrouter.ai/api/v1";
    this.fetchImpl = opts.fetchImpl;
    this.log =
      opts.log ??
      ((e) =>
        // never logs the key or image; latency + status + token usage only
        console.error(`[openrouter] model=${e.model} ms=${e.ms} status=${e.status}`));
  }

  async chat(req: ChatRequest): Promise<string> {
    const url = `${this.baseUrl}/chat/completions`;
    const content: unknown[] = [{ type: "text", text: req.userText }];
    if (req.imageB64) {
      content.push({
        type: "image_url",
        image_url: { url: `data:${req.imageMime ?? "image/jpeg"};base64,${req.imageB64}` },
      });
    }
    const body: Record<string, unknown> = {
      model: this.model,
      messages: [
        { role: "system", content: req.system },
        { role: "user", content },
      ],
    };
    if (req.jsonSchema) {
      body.response_format = {
        type: "json_schema",
        json_schema: { name: "meal_analysis", strict: false, schema: req.jsonSchema },
      };
    }

    const doFetch = this.fetchImpl ?? globalThis.fetch;
    const started = Date.now();

    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      const controller = new AbortController();
      const onAbort = () => controller.abort();
      if (req.signal) {
        if (req.signal.aborted) controller.abort();
        else req.signal.addEventListener("abort", onAbort);
      }
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);

      let res: Response;
      try {
        res = await doFetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://github.com/kirmalyshev/eait",
            "X-Title": "eait",
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
      } catch (err) {
        if (controller.signal.aborted) {
          throw new Error(
            `OpenRouter request aborted (timeout ${this.timeoutMs}ms or caller signal)`,
          );
        }
        throw err;
      } finally {
        clearTimeout(timer);
        if (req.signal) req.signal.removeEventListener("abort", onAbort);
      }

      if (res.status === 429 || res.status >= 500) {
        if (attempt < this.maxRetries) {
          await sleep(this.retryBaseMs * 2 ** attempt);
          continue;
        }
        throw new Error(`OpenRouter ${res.status} after ${attempt + 1} attempt(s)`);
      }
      if (!res.ok) {
        throw new Error(`OpenRouter error ${res.status}: ${await safeText(res)}`);
      }

      const data = (await res.json()) as any;
      const message = data?.choices?.[0]?.message;
      const out: unknown = message?.content ?? message?.tool_calls?.[0]?.function?.arguments;
      this.log({ model: this.model, ms: Date.now() - started, status: res.status, usage: data?.usage });
      if (typeof out !== "string" || out.trim() === "") {
        throw new Error("OpenRouter: no content in response");
      }
      return out;
    }

    throw new Error("OpenRouter: retries exhausted");
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return "<unreadable body>";
  }
}
