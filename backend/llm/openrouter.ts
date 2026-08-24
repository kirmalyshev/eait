// OpenRouter transport. Thin on purpose: it owns HTTP and image encoding, and nothing else.
//
// The prompts and the schemas live in `prompt.ts`; this file never authors either. That split is
// what makes swapping the provider a one-file change, and it is what lets an accuracy eval compare
// two transports without wondering whether they were asked different questions.

import { z } from "zod";
import type { AnalyzePhoto, ClassifyRestrictions, LlmPorts, RouteResult, RouteText } from "./port.ts";
import { clampDayOffset } from "./port.ts";
import {
  ClassifySchema, MealAnalysisSchema, RouteSchema, SYSTEM, SYSTEM_CLASSIFY, SYSTEM_ROUTE,
  SYSTEM_TEXT_MEAL, buildClassifyText, buildRouteText, buildTextMealText, buildUserText,
} from "./prompt.ts";

interface Options {
  apiKey: string;
  model: string;
  /** Where the chat-completions call goes. From `EAIT__BACKEND__LLM_BASE_URL`; the composition root supplies it. */
  baseUrl: string;
  /** How long one call may hang. From `EAIT__BACKEND__LLM_TIMEOUT_MS`. */
  timeoutMs: number;
  /** Injected in tests so the ports can be exercised without a billed call. */
  fetchImpl?: typeof fetch;
}

type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
interface Message { role: "system" | "user"; content: Content }

/**
 * Data URL for one image. The mime type is read from the magic bytes rather than trusted from the
 * upload's filename: a client that mislabels a PNG as JPEG gets a silent model-side decode failure,
 * which surfaces as "the AI is bad at my food" rather than as an error anyone can act on.
 */
function toDataUrl(bytes: Uint8Array): string {
  const mime =
    bytes[0] === 0xff && bytes[1] === 0xd8 ? "image/jpeg"
    : bytes[0] === 0x89 && bytes[1] === 0x50 ? "image/png"
    : bytes[0] === 0x52 && bytes[1] === 0x49 ? "image/webp"
    : "image/jpeg";
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

export function openRouterPorts(opts: Options): LlmPorts {
  const doFetch = opts.fetchImpl ?? fetch;
  const url = opts.baseUrl;

  /**
   * One chat completion, validated against `schema`.
   *
   * Two things worth noting. First, the response is validated, not trusted — a model that returns
   * prose where an object was demanded must fail loudly here rather than three layers down where
   * the failure looks like a database problem. Second, a validation failure gets exactly ONE retry,
   * with the errors fed back: retrying forever on a model that cannot satisfy the schema burns the
   * user's cap on a request that was never going to succeed.
   */
  async function complete<T>(
    system: string,
    content: Content,
    schema: z.ZodType<T>,
    schemaName: string,
  ): Promise<T> {
    const messages: Message[] = [{ role: "system", content: system }, { role: "user", content }];
    let lastError = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      const body = {
        model: opts.model,
        messages: attempt === 0 ? messages : [
          ...messages,
          {
            role: "user" as const,
            content: `Your previous reply did not satisfy the required shape: ${lastError}. Reply again with valid JSON only.`,
          },
        ],
        response_format: {
          type: "json_schema" as const,
          json_schema: { name: schemaName, schema: z.toJSONSchema(schema, { io: "output" }) },
        },
      };

      // A model call that hangs used to hang FOREVER: the provider accepts the connection, never
      // answers, and holds the request, the photo and a worker slot until the process restarts.
      // Vision inference is slow, so the budget is generous — but it is finite.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), opts.timeoutMs);
      let res: Response;
      try {
        res = await doFetch(url, {
          method: "POST",
          headers: {
            authorization: `Bearer ${opts.apiKey}`,
            "content-type": "application/json",
            "x-title": "ieat",
          },
          body: JSON.stringify(body),
          signal: abort.signal,
        });
      } catch (e) {
        // Reported as a timeout rather than as whatever the runtime called it, because the caller
        // turns this into "the analysis didn't come back" and the log is where the detail belongs.
        if (abort.signal.aborted) throw new Error(`llm timeout after ${opts.timeoutMs}ms`);
        throw e;
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        // The status and a short body go to the log; neither reaches the client. An upstream error
        // string can echo the prompt, which carries the user's medical free text.
        const detail = (await res.text()).slice(0, 500);
        throw new Error(`llm http ${res.status}: ${detail}`);
      }

      const payload = await res.json() as { choices?: { message?: { content?: string } }[] };
      const raw = payload.choices?.[0]?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        lastError = "not valid JSON";
        continue;
      }
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
      lastError = result.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ").slice(0, 300);
    }
    throw new Error(`llm did not satisfy ${schemaName}: ${lastError}`);
  }

  const analyzePhoto: AnalyzePhoto = async (input) => {
    const content: Content = [
      { type: "text", text: buildUserText(input.profile, input.targets, {
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.localTime !== undefined ? { localTime: input.localTime } : {}),
        ...(input.repertoire !== undefined ? { repertoire: input.repertoire } : {}),
      }) },
      ...input.images.map((b) => ({ type: "image_url" as const, image_url: { url: toDataUrl(b) } })),
    ];
    return complete(SYSTEM, content, MealAnalysisSchema, "meal_analysis");
  };

  const routeText: RouteText = async (input) => {
    const text = buildRouteText({
      text: input.text, profile: input.profile, targets: input.targets,
      todayMeals: input.todayMeals, week: input.week,
      ...(input.focusMeal !== undefined ? { focusMeal: input.focusMeal } : {}),
    });
    let out = await complete(SYSTEM_ROUTE, text, RouteSchema, "route");

    // The decision and the work, separated — but only when the model made us.
    //
    // `SYSTEM_ROUTE` asks for "a full analysis, same rules as a photo", and those rules live in
    // `SYSTEM`, which this call never sees. grok-4.5 answers `intent: "meal"` with no analysis on
    // every food message, and keeps doing it when `complete()` feeds the validation error back. A
    // second call that asks ONLY for `MealAnalysisSchema` — the shape the photo path gets right
    // every time — is what actually produces the numbers.
    //
    // Deliberately not the default path: a router that supplies the analysis costs one call, and
    // this only spends a second one when the first came back without it.
    if ((out.intent === "meal" || out.intent === "correction") && !out.analysis) {
      const analysis = await complete(
        SYSTEM_TEXT_MEAL,
        buildTextMealText({ text: input.text, profile: input.profile, targets: input.targets }),
        MealAnalysisSchema,
        "text-meal",
      );
      out = { ...out, analysis };
    }

    // The one place a `RouteResult` is constructed. Every dayOffset-bearing branch clamps, and a
    // branch that claims something this call cannot do — a correction or a re-date with no focus
    // meal — degrades to `answer` rather than throwing, because the model usually explains itself
    // in `text` and an exception is a worse reply than that explanation.
    //
    // What it may NOT do is degrade to an EMPTY reply. That is what it used to do, and it is how a
    // model omitting `analysis` on a `meal` turned every "two boiled eggs and a slice of rye bread"
    // into a blank chat bubble — no error, no log, and a user who reasonably concluded their food
    // had been understood. `RouteSchema` now refuses that response so `complete()` retries it, and
    // the guard below refuses to invent a reply when there is genuinely nothing to say: this
    // transport owns HTTP and image encoding and nothing else, so it raises, and `handleText`
    // turns that into `analysis-failed` — which the app renders as an actual message.
    switch (out.intent) {
      case "meal":
        if (!out.analysis) break;
        return { intent: "meal", analysis: out.analysis, dayOffset: clampDayOffset(out.dayOffset) };
      case "correction":
        if (!out.analysis || !input.focusMeal) break;
        return { intent: "correction", analysis: out.analysis };
      case "redate":
        if (!input.focusMeal) break;
        return { intent: "redate", dayOffset: clampDayOffset(out.dayOffset) };
      case "answer":
        break;
    }

    const reply = out.text ?? "";
    if (reply.trim() === "") {
      throw new Error(`route returned intent "${out.intent}" with an empty answer and nothing to act on`);
    }
    return { intent: "answer", text: reply } satisfies RouteResult;
  };

  const classifyRestrictions: ClassifyRestrictions = async (text) => {
    const out = await complete(SYSTEM_CLASSIFY, buildClassifyText(text), ClassifySchema, "restrictions");
    return out.tags;
  };

  return { analyzePhoto, routeText, classifyRestrictions };
}
