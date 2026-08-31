// OpenRouter transport. Thin on purpose: it owns HTTP and image encoding, and nothing else.
//
// The prompts and the schemas live in `prompt.ts`; this file never authors either. That split is
// what makes swapping the provider a one-file change, and it is what lets an accuracy eval compare
// two transports without wondering whether they were asked different questions.

import { z } from "zod";
import type { AnalyzePhoto, ClassifyRestrictions, LlmPorts, RouteResult, RouteText } from "./port.ts";
import { GatewayRefusal, clampDayOffset } from "./port.ts";
import {
  ClassifySchema, MealAnalysisSchema, RouteSchema, SYSTEM, SYSTEM_CLASSIFY, SYSTEM_ROUTE,
  SYSTEM_TEXT_CORRECTION, SYSTEM_TEXT_MEAL, buildClassifyText, buildRouteText,
  buildTextCorrectionText, buildTextMealText, buildUserText,
} from "./prompt.ts";

interface Options {
  apiKey: string;
  model: string;
  /** Where the chat-completions call goes. From `EAIT__BACKEND__LLM_BASE_URL`; the composition root supplies it. */
  baseUrl: string;
  /** How long one call may hang. From `EAIT__BACKEND__LLM_TIMEOUT_MS`. */
  timeoutMs: number;
  /** The completion bound for one call. From `EAIT__BACKEND__LLM_MAX_TOKENS`. */
  maxTokens: number;
  /** Injected in tests so the ports can be exercised without a billed call. */
  fetchImpl?: typeof fetch;
}

type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
interface Message { role: "system" | "user"; content: Content }

/**
 * Statuses OpenRouter answers with BEFORE it routes the request to a model: bad credentials, no
 * credit, rate limited, no provider available. Nothing was generated, so nothing was billed, and
 * the account's analysis is given back rather than spent (`GatewayRefusal`).
 *
 * Deliberately short. A 408 or a 502 may name a model that already ran, and charging on ambiguity
 * is the safe direction here — the alternative refunds calls this instance actually paid for.
 *
 * The status is only half the question. One engine charge can pay for SEVERAL calls — the schema
 * retry below, and `routeText`'s focused second call — and the ones after the first follow a 200
 * that generated tokens. A gateway status there is a refusal of a call we had already paid for, so
 * it stays a plain `Error`: `billed` is what carries that, and it is why the class is raised here
 * rather than derived from a status by the engine.
 */
const UNROUTED = new Set([401, 402, 429, 503]);

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
   * user's cap on a request that was never going to succeed. A reply the provider cut off at
   * `max_tokens` gets ZERO retries — see the `finish_reason` handling below for why that one is
   * different.
   */
  async function complete<T>(
    system: string,
    content: Content,
    schema: z.ZodType<T>,
    schemaName: string,
    /** A call in this turn has already generated, so nothing here can be given back. */
    billed = false,
  ): Promise<T> {
    const messages: Message[] = [{ role: "system", content: system }, { role: "user", content }];
    let lastError = "";

    for (let attempt = 0; attempt < 2; attempt++) {
      const body = {
        model: opts.model,
        // Named on every call, because omitting it does not mean "no limit". The provider fills in
        // the model's own ceiling — 65536, forty times a measured analysis — and reserves credit
        // for the whole of it before routing, so an unbounded request is refused (402) on a balance
        // that would have paid for the real call eighteen times over. That is what happened to the
        // first real user's first photo.
        max_tokens: opts.maxTokens,
        // Named on every call, so the provider's own default cannot drift under us: every call
        // this app makes wants the same answer twice.
        temperature: 0.2,
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
            "x-title": "eait",
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
        const message = `llm http ${res.status}: ${detail}`;
        // `attempt > 0` means the first attempt answered 200 and was billed for a reply that missed
        // the schema. Nothing after that first completion is free, whatever the status says.
        const unrouted = UNROUTED.has(res.status) && !billed && attempt === 0;
        throw unrouted ? new GatewayRefusal(res.status, message) : new Error(message);
      }

      const payload = await res.json() as {
        choices?: { finish_reason?: string; message?: { content?: string } }[];
      };
      const choice = payload.choices?.[0];
      // `length` means generation stopped at the bound. It is checked only where the reply turned
      // out to be UNUSABLE, never before the parse: with a JSON schema the model writes its closing
      // brace and then a newline, so a cut landing in that whitespace flags a complete answer — and
      // a gateway behind `baseUrl` may flag conservatively. Refusing one of those would fail an
      // analysis that had already been charged, over trailing whitespace.
      //
      // Where the reply IS unusable, the bound is terminal rather than another attempt: the retry
      // re-sends a LONGER prompt against the SAME bound with no instruction to be shorter. Reasoning
      // length varies, so such a retry is not impossible — it is unreliable, and it costs a second
      // bound's worth of billed tokens to end in "not valid JSON", which sends the next reader to
      // the model instead of to the setting. Naming the bound once beats paying to guess twice.
      const truncated = choice?.finish_reason === "length";
      const bail: () => never = () => {
        throw new Error(
          `llm truncated ${schemaName} at max_tokens=${opts.maxTokens}; raise EAIT__BACKEND__LLM_MAX_TOKENS`,
        );
      };
      const raw = choice?.message?.content ?? "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        if (truncated) bail();
        lastError = "not valid JSON";
        continue;
      }
      const result = schema.safeParse(parsed);
      if (result.success) return result.data;
      if (truncated) bail();
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
        ...(input.portionPriors !== undefined ? { portionPriors: input.portionPriors } : {}),
      }) },
      ...input.images.map((b) => ({ type: "image_url" as const, image_url: { url: toDataUrl(b) } })),
    ];
    return await complete(SYSTEM, content, MealAnalysisSchema, "meal_analysis");
  };

  const routeText: RouteText = async (input) => {
    const text = buildRouteText({
      text: input.text, profile: input.profile, targets: input.targets,
      todayMeals: input.todayMeals, week: input.week,
      ...(input.focusMeal !== undefined ? { focusMeal: input.focusMeal } : {}),
      ...(input.question !== undefined ? { question: input.question } : {}),
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
    //
    // A CORRECTION GETS ITS OWN PROMPT, and the difference is not cosmetic. The meal prompt carries
    // the user's message and nothing else, so a chip's "In oil" analysed as a meal is a plate
    // consisting of one serving of oil — which `applyCorrection` then writes over the food they
    // actually ate. The correction prompt is handed the plate and the standing question instead.
    // With no focus meal there is nothing to correct, the switch below degrades to `answer`
    // whatever comes back, and buying an analysis first is buying one to throw away.
    if (out.intent === "correction" && !out.analysis && input.focusMeal) {
      const analysis = await complete(
        SYSTEM_TEXT_CORRECTION,
        buildTextCorrectionText({
          text: input.text, profile: input.profile, targets: input.targets,
          focusMeal: input.focusMeal,
          ...(input.question !== undefined ? { question: input.question } : {}),
        }),
        MealAnalysisSchema,
        "text-correction",
        // The router call above already generated and was billed — the same rule as the meal branch.
        true,
      );
      out = { ...out, analysis };
    } else if (out.intent === "meal" && !out.analysis) {
      const analysis = await complete(
        SYSTEM_TEXT_MEAL,
        buildTextMealText({ text: input.text, profile: input.profile, targets: input.targets }),
        MealAnalysisSchema,
        "text-meal",
        // The router call above already generated and was billed, so a gateway refusal on this one
        // is not free and the turn stays charged.
        true,
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
