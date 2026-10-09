// OpenRouter transport. Thin on purpose: it owns HTTP and image encoding, and nothing else.
//
// The prompts and the schemas live in `prompt.ts`; this file never authors either. That split is
// what makes swapping the provider a one-file change, and it is what lets an accuracy eval compare
// two transports without wondering whether they were asked different questions.
//
// It no longer IMPORTS the six system prompts, because an instance may be serving a stored override
// of any of them: `opts.prompts` resolves all six once per turn and the composition root is what
// joins that to a store. Absent, it is `PROMPT_DEFAULTS` — the constants this file used to import,
// so a test that says nothing about prompts gets exactly what it got before. What did not change is
// that no prompt string is written HERE.

import { z } from "zod";
import { cleanSuggestions, splitLines } from "@eait/shared";
import type { AnalyzePhoto, Coach, CoachTools, LlmPorts, OnCost, RouteResult, RouteText } from "./port.ts";
import { GatewayRefusal, MAX_COACH_ROUNDS, clampDayOffset, emptyEstimate, imageMime } from "./port.ts";
import {
  COACH_TOOL_DEFS, CoachReplySchema, EMPTY_ESTIMATE_RETRY, MealAnalysisSchema, PROMPT_DEFAULTS,
  RouteSchema, buildCoachContext, buildRouteText, buildTextCorrectionText,
  buildTextMealText, buildUserText, coachLine, type Prompts,
} from "./prompt.ts";

interface Options {
  apiKey: string;
  /** The analyzer and the router. Needs vision. */
  model: string;
  /** The coach. Text only, and its own setting — `EAIT__BACKEND__LLM_CHAT_MODEL`. */
  chatModel: string;
  /** Where the chat-completions call goes. From `EAIT__BACKEND__LLM_BASE_URL`; the composition root supplies it. */
  baseUrl: string;
  /** How long one call may hang. From `EAIT__BACKEND__LLM_TIMEOUT_MS`. */
  timeoutMs: number;
  /** The completion bound for one call. From `EAIT__BACKEND__LLM_MAX_TOKENS`. */
  maxTokens: number;
  /**
   * Sent as `reasoning: { effort }` on every schema call when set — and as
   * `reasoning: { enabled: false }` when set to `off`, the only shape a model that can reason
   * cannot talk its way around (`{ effort: "none" }` is not a value OpenRouter honours on every
   * provider). From `EAIT__BACKEND__LLM_REASONING_EFFORT`; empty means the model decides, which
   * is what measured at a median 37 s to first token on grok-4.5 (2026-09-05, docs/ACCURACY.md).
   */
  reasoningEffort?: string | undefined;
  /**
   * Pins the nutrition calls — the analyzer, the router, every correction, all running on `model` —
   * to these OpenRouter providers, with no fallback. The privacy page promises the photo reaches
   * OpenRouter and the provider serving our model and NOBODY ELSE, so routing may not roam to
   * whoever is cheapest that hour. The coach (`chatModel`) is deliberately not pinned: it has its
   * own provider list and its own privacy story. From `EAIT__BACKEND__LLM_PROVIDER_ORDER`.
   */
  providerOrder?: string[] | undefined;
  /**
   * Models OpenRouter may try after `model` on a rate limit or downtime (`models: [model, ...]`),
   * on the same nutrition calls and under the same provider pin. Never the coach. From
   * `EAIT__BACKEND__LLM_FALLBACK_MODELS`.
   */
  fallbackModels?: string[] | undefined;
  /**
   * `openrouter` (the default) or `openai`: any server that speaks plain OpenAI chat completions —
   * Ollama, vLLM, LM Studio, llama.cpp, Together, Groq. Those have no `reasoning`, `provider` or
   * `models` field and a strict one refuses a body that carries them, so `openai` sends none of the
   * three, no `x-title`, and no `authorization` when `apiKey` is empty (a local server wants none).
   * From `EAIT__BACKEND__LLM_PROVIDER=openai-compatible`.
   */
  dialect?: "openrouter" | "openai";
  /** Injected in tests so the ports can be exercised without a billed call. */
  fetchImpl?: typeof fetch;
  /**
   * Where the five system prompts come from, resolved once per turn.
   *
   * ABSENT MEANS THE COMPILED-IN ONES, which is what this transport sent before there was a table
   * and is what every test that does not care gets. The composition root supplies
   * `() => loadPrompts(store)`; this file still does not reach a store, and still authors no
   * prompt of its own.
   */
  prompts?: () => Promise<Prompts>;
}

type Content = string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[];
interface Message { role: "system" | "user"; content: Content }

/** A tool call as the API reports it, and the messages of an agent turn. */
interface ToolCall { id: string; type: "function"; function: { name: string; arguments: string } }
type AgentMessage =
  | { role: "system" | "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };
interface Choice { finish_reason?: string; message?: { content?: string | null; tool_calls?: ToolCall[] } }

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
 * which surfaces as "the AI is bad at my food" rather than as an error anyone can act on. Unknown
 * bytes never get here — `logPhotoMeal` refuses them before the analysis is charged.
 */
function toDataUrl(bytes: Uint8Array): string {
  const mime = imageMime(bytes) ?? "image/jpeg";
  return `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`;
}

/**
 * OpenRouter's `usage.cost` — credits, which are US dollars — or null when a reply carried none.
 * Null on a BYOK request too: there `cost` is only OpenRouter's fee and the inference is billed
 * upstream, so it would read as a whole bill that is a few percent of one.
 */
function costOf(usage: unknown): number | null {
  const u = usage as { cost?: unknown; is_byok?: unknown } | null | undefined;
  return typeof u?.cost === "number" && u.is_byok !== true ? u.cost : null;
}

export function openRouterPorts(opts: Options): LlmPorts {
  const doFetch = opts.fetchImpl ?? fetch;
  const url = opts.baseUrl;
  const openRouter = (opts.dialect ?? "openrouter") === "openrouter";
  const headers: Record<string, string> = {
    ...(openRouter || opts.apiKey !== "" ? { authorization: `Bearer ${opts.apiKey}` } : {}),
    "content-type": "application/json",
    ...(openRouter ? { "x-title": "eait" } : {}),
  };
  /**
   * ONE RESOLUTION PER PORT CALL, not per HTTP request: `routeText` can make two model calls and
   * resolves once, so a prompt edit landing between them cannot analyse a meal under different
   * instructions from the ones that classified it. Never throws:
   * `loadPrompts` answers with the compiled-in prompts on any failure.
   */
  const prompts = opts.prompts ?? (async () => PROMPT_DEFAULTS);

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
  /**
   * One HTTP round trip: the timeout, the status handling, the parse. Shared by the schema calls
   * and the coach loop, so there is one place a hung provider is abandoned and one place a
   * gateway status becomes a refund or does not.
   */
  async function send(
    body: unknown,
    billed: boolean,
    budgetMs = opts.timeoutMs,
    /** Given, the call streams and every VISIBLE content delta is handed here as it arrives. */
    onDelta?: (text: string) => void,
    /** Told what the provider said this call cost — once, however the call ends. */
    onCost?: OnCost,
    /** The turn's own cutoff, when this call is part of one — fires earlier than `budgetMs` only
     *  when the request the call serves is already settled unknown (#276). */
    cutoff?: AbortSignal,
  ): Promise<{ choices?: Choice[] }> {
    // A call whose turn already settled against it never reaches the wire again: #70's parallel
    // analysis aborts the moment the router names an intent that does not want it, and the next
    // attempt's fetch would be money spent on a reply nobody awaits.
    if (cutoff?.aborted) throw cutoff.reason ?? new Error("aborted");
    // A model call that hangs used to hang FOREVER: the provider accepts the connection, never
    // answers, and holds the request, the photo and a worker slot until the process restarts.
    // Vision inference is slow, so the budget is generous — but it is finite.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), budgetMs);
    const signal = cutoff === undefined ? abort.signal : AbortSignal.any([abort.signal, cutoff]);
    let res: Response;
    let cost: number | null = null;
    try {
      res = await doFetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(onDelta ? { ...(body as object), stream: true } : body),
        signal,
      });

      if (!res.ok) {
        // The status and a short body go to the log; neither reaches the client. An upstream error
        // string can echo the prompt, which carries the user's medical free text.
        const detail = (await res.text()).slice(0, 500);
        const message = `llm http ${res.status}: ${detail}`;
        const unrouted = UNROUTED.has(res.status) && !billed;
        throw unrouted ? new GatewayRefusal(res.status, message) : new Error(message);
      }
      if (!onDelta) {
        const payload = await res.json() as { choices?: Choice[]; usage?: unknown };
        cost = costOf(payload.usage);
        return payload;
      }

      // THE STREAMED SHAPE IS REASSEMBLED INTO THE NON-STREAMED ONE, so `complete()` validates and
      // retries exactly as before. `reasoning` deltas are never forwarded: they are the model's
      // thinking, and the pending card must show only what the card will. The abort timer stays
      // armed until the last chunk, because a provider can open the stream and then stall.
      let content = "";
      let finish: string | undefined;
      let carry = "";
      const reader = res.body!.pipeThrough(new TextDecoderStream()).getReader();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const split = splitLines(carry, value);
        carry = split.carry;
        for (const line of split.lines) {
          if (!line.startsWith("data:")) continue;
          const data = line.slice(5).trim();
          if (data === "[DONE]") continue;
          let j: { choices?: { delta?: { content?: string | null }; finish_reason?: string | null }[]; error?: unknown; usage?: unknown };
          try { j = JSON.parse(data); } catch { continue; }
          // A mid-stream error is a status that never had a status line: the content stops, the
          // parse below fails, and without this the log says "not valid JSON" and nothing else.
          if (j.error) console.error(`[eait] llm stream error: ${JSON.stringify(j.error).slice(0, 300)}`);
          // Every stream ends with one chunk carrying the request's usage, just before [DONE].
          if (j.usage !== undefined) cost = costOf(j.usage);
          const ch = j.choices?.[0];
          if (!ch) continue;
          if (typeof ch.delta?.content === "string" && ch.delta.content !== "") {
            content += ch.delta.content;
            onDelta(ch.delta.content);
          }
          if (ch.finish_reason) finish = ch.finish_reason;
        }
      }
      return { choices: [{ ...(finish ? { finish_reason: finish } : {}), message: { content } }] };
    } catch (e) {
      // Reported as a timeout rather than as whatever the runtime called it, because the caller
      // turns this into "the analysis didn't come back" and the log is where the detail belongs.
      if (abort.signal.aborted) throw new Error(`llm timeout after ${budgetMs}ms`);
      // The turn's cutoff, not this call's budget: the reason names the stage the turn died in.
      if (cutoff?.aborted) throw cutoff.reason ?? e;
      throw e;
    } finally {
      clearTimeout(timer);
      onCost?.(cost);
    }
  }

  /**
   * ONE DEADLINE, NOT ONE PER CALL — the rule `coach` has always followed, applied here (#153).
   *
   * `send` used to be given `opts.timeoutMs` afresh for every HTTP call, so the schema retry below
   * doubled the wall clock a single `complete()` could occupy, and `routeText` calling `complete()`
   * twice doubled it again: four calls, 360 s at the shipped 90 s budget, every second billed while
   * the phone had stopped waiting long before. A caller that spans several calls passes its own
   * deadline and each call gets whatever is left; one that does not gets a budget of its own, which
   * is what the default expresses.
   *
   * It changes WHICH turns fail rather than making slow ones faster: a routing call that takes most
   * of the budget followed by an analysis that needs the rest is refused now where it used to
   * succeed. That is the trade, and it is the one #153 asked for — a turn nobody is waiting for is
   * not worth paying for.
   */
  async function complete<T>(
    system: string,
    content: Content,
    schema: z.ZodType<T>,
    schemaName: string,
    /** A call in this turn has already generated, so nothing here can be given back. */
    billed = false,
    onDelta?: (text: string) => void,
    /** When the whole turn must be done. Defaults to one budget for this `complete()` alone. */
    deadline = Date.now() + opts.timeoutMs,
    onCost?: OnCost,
    /** The turn's cutoff, forwarded to every HTTP call this makes (#276). */
    cutoff?: AbortSignal,
  ): Promise<T> {
    const messages: Message[] = [{ role: "system", content: system }, { role: "user", content }];
    let lastError = "";
    let retried429 = false;

    for (let attempt = 0; attempt < 2; attempt++) {
      const body = {
        model: opts.model,
        ...(openRouter && opts.fallbackModels && opts.fallbackModels.length > 0 ? { models: [opts.model, ...opts.fallbackModels] } : {}),
        // Named on every call, because omitting it does not mean "no limit". The provider fills in
        // the model's own ceiling — 65536, forty times a measured analysis — and reserves credit
        // for the whole of it before routing, so an unbounded request is refused (402) on a balance
        // that would have paid for the real call eighteen times over. That is what happened to the
        // first real user's first photo.
        max_tokens: opts.maxTokens,
        // Named on every call, so the provider's own default cannot drift under us: every call
        // this app makes wants the same answer twice.
        temperature: 0.2,
        ...(!openRouter ? {} : opts.reasoningEffort === "off"
          ? { reasoning: { enabled: false } }
          : opts.reasoningEffort ? { reasoning: { effort: opts.reasoningEffort } } : {}),
        // Pinned, when configured: the privacy page names OpenRouter + the serving provider and
        // nobody else, so the request may not fall back to a provider it does not name.
        ...(openRouter && opts.providerOrder && opts.providerOrder.length > 0
          ? { provider: { order: opts.providerOrder, allow_fallbacks: false } } : {}),
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

      // `attempt > 0` means the first attempt answered 200 and was billed for a reply that missed
      // the schema. Nothing after that first completion is free, whatever the status says.
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`llm ran past ${opts.timeoutMs}ms before ${schemaName}`);
      let payload: Awaited<ReturnType<typeof send>>;
      try {
        payload = await send(body, billed || attempt > 0, left, onDelta, onCost, cutoff);
      } catch (e) {
        // An unrouted 429 generated nothing: one jittered retry inside this same deadline (#1144).
        if (!(e instanceof GatewayRefusal && e.status === 429) || retried429) throw e;
        retried429 = true;
        const wait = 1500 + Math.random() * 1500;
        if (deadline - Date.now() - wait <= 0) throw e;
        console.error(`[eait] llm 429 on ${schemaName}; retrying once in ${Math.round(wait)}ms`);
        await new Promise((r) => setTimeout(r, wait));
        payload = await send(body, billed || attempt > 0, deadline - Date.now(), onDelta, onCost, cutoff);
      }
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

  const analyzePhoto: AnalyzePhoto = async (input, onDelta) => {
    const { analysis } = await prompts();
    const content: Content = [
      { type: "text", text: buildUserText(input.profile, input.targets, {
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.localTime !== undefined ? { localTime: input.localTime } : {}),
        ...(input.repertoire !== undefined ? { repertoire: input.repertoire } : {}),
        ...(input.portionPriors !== undefined ? { portionPriors: input.portionPriors } : {}),
      }) },
      ...input.images.map((b) => ({ type: "image_url" as const, image_url: { url: toDataUrl(b) } })),
    ];
    return await complete(analysis, content, MealAnalysisSchema, "meal_analysis", false, onDelta, undefined, input.onCost, input.signal);
  };

  const routeText: RouteText = async (input) => {
    const text = buildRouteText({
      text: input.text, profile: input.profile, targets: input.targets,
      todayMeals: input.todayMeals, week: input.week,
      ...(input.focusMeal !== undefined ? { focusMeal: input.focusMeal } : {}),
      ...(input.question !== undefined ? { question: input.question } : {}),
      ...(input.recent !== undefined ? { recent: input.recent } : {}),
    });
    // THE WHOLE TURN SHARES ONE DEADLINE, the shape `coach` below already has (#153). The routing
    // call and the focused analysis behind it are one turn to the user and one wait on the phone,
    // so they are one budget here — `undefined` in each call below is the `onDelta` this route has
    // never had, and the argument after it is the deadline.
    const deadline = Date.now() + opts.timeoutMs;
    const P = await prompts();

    // THE MEAL ANALYSIS DOES NOT WAIT ON THE ROUTER (#70). The focused `text-meal` call needs
    // nothing the routing call produces — its inputs are the words, the profile and the day — so
    // on a turn with no focus meal it is fired NOW, in parallel, and awaited when the intent is
    // `meal` and the router did not do the work. Measured on the shipped provider: routing 3–9 s,
    // the analysis ~25 s, strictly sequential until this — a meal logged over chat waited on both
    // ends of a call that could have started at once. A question or a re-date is the price: one
    // analysis the intent never uses, aborted the moment the router says so (a few cents of a cent).
    //
    // Not with a focus meal: the parallel call would be the CORRECTION prompt, which attaches the
    // meal's stored photographs — and a question asked over a meal in focus must not read a row of
    // them, let alone pay to send them (see `loadFocusImages`). Those turns stay sequential.
    //
    // Its deltas are BUFFERED until the router confirms the intent: an `answer` turn must not
    // stream the items of a meal that does not exist. On confirm they replay in order and the
    // rest pass through live.
    const specAbort = new AbortController();
    const specCutoff = input.signal === undefined
      ? specAbort.signal
      : AbortSignal.any([specAbort.signal, input.signal]);
    const specBuffered: string[] = [];
    let specConfirmed = false;
    const specDelta = input.onDelta === undefined ? undefined
      : (d: string) => { if (specConfirmed) input.onDelta!(d); else specBuffered.push(d); };
    const routing = complete(P.route, text, RouteSchema, "route", false, undefined, deadline, input.onCost, input.signal);
    const spec = input.focusMeal === undefined
      ? complete(
        P.text_meal,
        buildTextMealText({ text: input.text, profile: input.profile, targets: input.targets, todayMeals: input.todayMeals }),
        MealAnalysisSchema,
        "text-meal",
        // A second call by accounting: the routing call beside it is this turn's first, so a
        // gateway status here generated something already or shares a refusal the router owns.
        true,
        specDelta,
        deadline,
        input.onCost,
        specCutoff,
      )
      : null;
    // Settled either way: an intent that does not use it must not leave a rejection unlistened.
    spec?.catch(() => {});

    let out: Awaited<typeof routing>;
    try {
      out = await routing;
    } catch (e) {
      specAbort.abort();
      throw e;
    }
    /** The spec is this branch's analysis: confirm it (replaying what streamed early) and await it. */
    const takeSpec = async () => {
      specConfirmed = true;
      if (input.onDelta !== undefined) for (const d of specBuffered) input.onDelta(d);
      return await spec!;
    };

    // The decision and the work, separated — but only when the model made us.
    //
    // The router prompt asks for "a full analysis, same rules as a photo", and those rules live in
    // the ANALYSIS prompt, which this call never sees. grok-4.5 answers `intent: "meal"` with no analysis on
    // every food message, and keeps doing it when `complete()` feeds the validation error back. A
    // second call that asks ONLY for `MealAnalysisSchema` — the shape the photo path gets right
    // every time — is what actually produces the numbers.
    //
    // Deliberately not the default path: a router that supplies the analysis costs one call, and
    // this only spends a second one when the first came back without it — or with the degenerate
    // version of one (`isFood` true, not one item), which the same focused call replaces (#248).
    //
    // A CORRECTION GETS ITS OWN PROMPT, and the difference is not cosmetic. The meal prompt carries
    // the user's message and nothing else, so a chip's "In oil" analysed as a meal is a plate
    // consisting of one serving of oil — which `applyCorrection` then writes over the food they
    // actually ate. The correction prompt is handed the plate and the standing question instead.
    // With no focus meal there is nothing to correct, the switch below degrades to `answer`
    // whatever comes back, and buying an analysis first is buying one to throw away.
    if (out.intent === "correction" && (!out.analysis || emptyEstimate(out.analysis)) && input.focusMeal) {
      // The stored photographs ride along as image parts, and ONLY here: the routing call above
      // runs on every text turn from a meal screen and must not pay for images. A meal with none
      // sends the plain string it always did.
      const images = input.loadFocusImages ? await input.loadFocusImages() : [];
      const correction = buildTextCorrectionText({
        text: input.text, profile: input.profile, targets: input.targets,
        focusMeal: input.focusMeal,
        ...(input.question !== undefined ? { question: input.question } : {}),
        ...(images.length ? { photos: images.length } : {}),
      });
      const withImages = (t: string): Content => images.length
        ? [
          { type: "text", text: t },
          ...images.map((b) => ({ type: "image_url" as const, image_url: { url: toDataUrl(b) } })),
        ]
        : t;
      let analysis = await complete(
        P.text_correction,
        withImages(correction),
        MealAnalysisSchema,
        "text-correction",
        // The router call above already generated and was billed — the same rule as the meal branch.
        true,
        input.onDelta,
        deadline,
        input.onCost,
        input.signal,
      );
      // One more draw on the degenerate answer — see the meal branch below.
      if (emptyEstimate(analysis)) {
        analysis = await complete(P.text_correction, withImages(correction + EMPTY_ESTIMATE_RETRY), MealAnalysisSchema, "text-correction", true, input.onDelta, deadline, input.onCost, input.signal);
      }
      out = { ...out, analysis };
    } else if (out.intent === "meal" && (!out.analysis || emptyEstimate(out.analysis))) {
      const mealText = buildTextMealText({ text: input.text, profile: input.profile, targets: input.targets, todayMeals: input.todayMeals });
      // `spec` IS this call, already in flight since the turn began — null only when a focus meal
      // was present, whose speculation is the correction prompt and not this one.
      let analysis = spec !== null ? await takeSpec() : await complete(
        P.text_meal,
        mealText,
        MealAnalysisSchema,
        "text-meal",
        // The router call above already generated and was billed, so a gateway refusal on this one
        // is not free and the turn stays charged.
        true,
        input.onDelta,
        deadline,
        input.onCost,
        input.signal,
      );
      // The degenerate answer to a description it will not itemise is `isFood` with NOT ONE ITEM
      // (#248): schema-valid, and refusing it hands the user a failure over a real meal. One more
      // draw — with the emptiness named in the prompt this time — lands the items; a second empty
      // is still refused by the caller, never retried forever.
      if (emptyEstimate(analysis)) {
        analysis = await complete(P.text_meal, mealText + EMPTY_ESTIMATE_RETRY, MealAnalysisSchema, "text-meal", true, input.onDelta, deadline, input.onCost, input.signal);
      }
      out = { ...out, analysis };
    }
    // The speculation the intent did not take is done here: a question, a re-date, a correction
    // the CORRECTION prompt answers for itself, and a router that supplied the analysis all stop
    // its fetch — what it generated so far was already billed either way.
    if (!specConfirmed) specAbort.abort();

    // The one place a `RouteResult` is constructed. Every dayOffset-bearing branch clamps, and a
    // branch that claims something this call cannot do — a correction or a re-date with no focus
    // meal — degrades to `answer` rather than throwing, because the model usually explains itself
    // in `text` and an exception is a worse reply than that explanation.
    //
    // An EMPTY `text` on an `answer` is passed through, not refused here. It used to be refused,
    // because the router's sentence was the reply and an empty one reached the phone as a blank
    // bubble. The reply is the coach's now, and the router's sentence is only its fallback — so the
    // decision "is there anything to say" belongs to `handleText`, which has the coach's answer in
    // hand: it refuses with `analysis-failed` only when the coach failed AND this text is empty.
    // A small router model answers `answer` with no text often enough that refusing here would
    // take the coach down with it.
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

    return { intent: "answer", text: (out.text ?? "").trim() } satisfies RouteResult;
  };

  /**
   * The agent loop. System (rules + context), the replayed thread, the message; then rounds: a
   * reply ends it, a tool call is executed through the engine's closure and its result appended,
   * and the round after `MAX_COACH_ROUNDS` is sent with `tool_choice: "none"` so the model has to
   * answer with what it has. Every call is billed — the router already generated this turn.
   *
   * THE WHOLE TURN SHARES ONE `timeoutMs`, not one per call. The phone gives up at twice the
   * server's budget — a router call and one behind it — and five calls each allowed the full
   * budget would keep this process working, and paying, for minutes after the app had stopped
   * waiting. A round that finds the budget spent throws, and `handleText` answers from the router.
   */
  const coach: Coach = async (input, tools) => {
    const defs = COACH_TOOL_DEFS.filter((d) => Object.hasOwn(tools, d.function.name));
    const deadline = Date.now() + opts.timeoutMs;
    const { coach: persona } = await prompts();
    const messages: AgentMessage[] = [
      { role: "system", content: `${persona}\n\n${buildCoachContext(input.context)}` },
      ...input.history.map((h): AgentMessage => ({ role: h.role, content: coachLine(h.text) })),
      { role: "user", content: coachLine(input.text) },
    ];
    for (let round = 0; ; round++) {
      const last = round >= MAX_COACH_ROUNDS;
      // THE SCHEMA AND THE TOOLS DO NOT GO TOGETHER. A JSON schema is enforced as a grammar over
      // the content, and a tool call is not content — so a request carrying both cannot make one,
      // and every round answered with a sentence about the data it would have fetched. Measured
      // against a local model, 0 tool calls in 12 questions; without the schema, the first reply
      // was the call. So the schema rides only where no tool may be called: the forced last
      // round, and a turn that has no tools at all. The system prompt asks for the JSON shape on
      // every round, and prose is tolerated below, so the chips are the most a free round can lose.
      const mayCallTools = defs.length > 0 && !last;
      const body = {
        model: opts.chatModel,
        max_tokens: opts.maxTokens,
        // Warmer than the analyzer's 0.2: this is prose, and the same sentence twice is not the
        // goal. Low, still — the numbers in it are the context's, not the sampler's.
        temperature: 0.4,
        // A chat answer wants seconds. OpenRouter normalises this across the providers that
        // reason and ignores it on the ones that do not.
        ...(openRouter ? { reasoning: { effort: "low" } } : {}),
        messages,
        ...(mayCallTools ? {} : {
          response_format: {
            type: "json_schema" as const,
            json_schema: { name: "coach_reply", schema: z.toJSONSchema(CoachReplySchema, { io: "output" }) },
          },
        }),
        ...(defs.length > 0 ? { tools: defs } : {}),
        ...(defs.length > 0 && last ? { tool_choice: "none" as const } : {}),
      };
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`coach ran past ${opts.timeoutMs}ms over ${round} tool round(s)`);
      const choice = (await send(body, true, left, undefined, input.onCost, input.signal)).choices?.[0];
      const calls = choice?.message?.tool_calls ?? [];
      if (calls.length > 0 && !last) {
        messages.push({ role: "assistant", content: choice?.message?.content ?? null, tool_calls: calls });
        for (const call of calls) {
          messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(await runTool(tools, call)) });
        }
        continue;
      }

      const raw = (choice?.message?.content ?? "").trim();
      if (raw === "") throw new Error(`coach returned an empty reply after ${round} tool round(s)`);
      let parsed: unknown = null;
      try { parsed = JSON.parse(raw); } catch { /* prose, handled below */ }
      // A model that answered with a bare JSON string said a sentence, in quotes. Take the sentence.
      if (typeof parsed === "string") parsed = { reply: parsed };
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        const reply = typeof p.reply === "string" ? p.reply.trim() : "";
        if (reply === "") throw new Error("coach returned JSON with an empty reply");
        // `focus` passes as the model wrote it — a string or nothing; the engine is the one
        // that decides whether what was named is a nutrient the bar knows.
        return {
          reply, suggestions: cleanSuggestions(p.suggestions),
          ...(typeof p.focus === "string" ? { focus: p.focus } : {}),
        };
      }
      // A reply cut off mid-JSON is not prose; it is a bound too tight, and naming it beats
      // rendering half an object as a sentence.
      if (choice?.finish_reason === "length") {
        throw new Error(`llm truncated coach_reply at max_tokens=${opts.maxTokens}; raise EAIT__BACKEND__LLM_MAX_TOKENS`);
      }
      // Prose where JSON was asked for: still the answer. The chips are the only thing lost.
      return { reply: raw, suggestions: [] };
    }
  };

  // Not canned: these answers cost money and describe the photograph. `GET /health` reports it.
  return { analyzePhoto, routeText, coach, canned: false };
}

/**
 * One tool call, executed — or refused in a shape the model can read and recover from.
 *
 * Nothing here throws: a tool the engine did not supply, arguments that are not JSON, or a
 * closure that failed all become `{ error }` on the tool message, and the model answers with
 * what it has. The failure's own text goes to the log and not to the model, because it can carry
 * a query and the query can carry the user's medical free text.
 */
async function runTool(tools: CoachTools, call: ToolCall): Promise<unknown> {
  // A refused call is logged by name and reason, never by its arguments: a model that keeps
  // sending calls this loop cannot run is invisible from the outside otherwise — every turn still
  // answers, just without the data — and the arguments are model output that may quote the user.
  const refuse = (error: string) => {
    console.warn(`[eait] coach tool call refused: ${call.function.name} — ${error}`);
    return { error };
  };
  const fn = tools[call.function.name];
  if (!fn) return refuse("unknown tool");
  let args: unknown;
  try {
    args = JSON.parse(call.function.arguments || "{}");
  } catch {
    return refuse("arguments were not valid JSON");
  }
  if (typeof args !== "object" || args === null || Array.isArray(args)) return refuse("arguments must be an object");
  try {
    return await fn(args as Record<string, unknown>);
  } catch (e) {
    console.error(`[eait] coach tool ${call.function.name} failed: ${(e as Error)?.message ?? e}`);
    return { error: "the tool failed" };
  }
}
