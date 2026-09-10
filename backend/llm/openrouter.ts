// OpenRouter transport. Thin on purpose: it owns HTTP and image encoding, and nothing else.
//
// The prompts and the schemas live in `prompt.ts`; this file never authors either. That split is
// what makes swapping the provider a one-file change, and it is what lets an accuracy eval compare
// two transports without wondering whether they were asked different questions.

import { z } from "zod";
import { cleanSuggestions, splitLines } from "@eait/shared";
import type { AnalyzePhoto, ClassifyRestrictions, Coach, CoachTools, GlancePhoto, LlmPorts, OnCost, RouteResult, RouteText } from "./port.ts";
import { GatewayRefusal, MAX_COACH_ROUNDS, clampDayOffset, imageMime } from "./port.ts";
import {
  COACH_TOOL_DEFS, ClassifySchema, CoachReplySchema, GLANCE_MAX_TOKENS, MealAnalysisSchema, RouteSchema, SYSTEM,
  SYSTEM_CLASSIFY, SYSTEM_COACH, SYSTEM_GLANCE, SYSTEM_ROUTE, SYSTEM_TEXT_CORRECTION, SYSTEM_TEXT_MEAL,
  buildClassifyText, buildCoachContext, buildGlanceText, buildRouteText, buildTextCorrectionText, buildTextMealText,
  buildUserText, coachLine,
} from "./prompt.ts";

interface Options {
  apiKey: string;
  /** The analyzer and the router. Needs vision. */
  model: string;
  /** The coach. Text only, and its own setting — `EAIT__BACKEND__LLM_CHAT_MODEL`. */
  chatModel: string;
  /**
   * The glance — one sentence while the analyzer works, on a model that does NOT reason.
   * `EAIT__BACKEND__LLM_GLANCE_MODEL`; empty or absent disables the port (it throws, and the
   * engine never calls it then).
   */
  glanceModel?: string | undefined;
  /** Where the chat-completions call goes. From `EAIT__BACKEND__LLM_BASE_URL`; the composition root supplies it. */
  baseUrl: string;
  /** How long one call may hang. From `EAIT__BACKEND__LLM_TIMEOUT_MS`. */
  timeoutMs: number;
  /** The completion bound for one call. From `EAIT__BACKEND__LLM_MAX_TOKENS`. */
  maxTokens: number;
  /**
   * Sent as `reasoning: { effort }` on every schema call when set. From
   * `EAIT__BACKEND__LLM_REASONING_EFFORT`; empty means the model decides, which is what measured
   * at a median 37 s to first token on grok-4.5 (2026-09-05, docs/ACCURACY.md).
   */
  reasoningEffort?: string | undefined;
  /** Injected in tests so the ports can be exercised without a billed call. */
  fetchImpl?: typeof fetch;
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

/** How long the glance may take. Measured at 0.9 s; past this the card has long overtaken it. */
const GLANCE_TIMEOUT_MS = 15_000;

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
  ): Promise<{ choices?: Choice[] }> {
    // A model call that hangs used to hang FOREVER: the provider accepts the connection, never
    // answers, and holds the request, the photo and a worker slot until the process restarts.
    // Vision inference is slow, so the budget is generous — but it is finite.
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), budgetMs);
    let res: Response;
    let cost: number | null = null;
    try {
      res = await doFetch(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${opts.apiKey}`,
          "content-type": "application/json",
          "x-title": "eait",
        },
        body: JSON.stringify(onDelta ? { ...(body as object), stream: true } : body),
        signal: abort.signal,
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
        ...(opts.reasoningEffort ? { reasoning: { effort: opts.reasoningEffort } } : {}),
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
      const payload = await send(body, billed || attempt > 0, left, onDelta, onCost);
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
    const content: Content = [
      { type: "text", text: buildUserText(input.profile, input.targets, {
        ...(input.caption !== undefined ? { caption: input.caption } : {}),
        ...(input.localTime !== undefined ? { localTime: input.localTime } : {}),
        ...(input.repertoire !== undefined ? { repertoire: input.repertoire } : {}),
        ...(input.portionPriors !== undefined ? { portionPriors: input.portionPriors } : {}),
      }) },
      ...input.images.map((b) => ({ type: "image_url" as const, image_url: { url: toDataUrl(b) } })),
    ];
    return await complete(SYSTEM, content, MealAnalysisSchema, "meal_analysis", false, onDelta, undefined, input.onCost);
  };

  const glancePhoto: GlancePhoto = async (input) => {
    if (!opts.glanceModel) throw new Error("glance disabled");
    const body = {
      model: opts.glanceModel,
      max_tokens: GLANCE_MAX_TOKENS,
      temperature: 0.2,
      // The whole point of this call. A model that reasons here answers after the analyzer does;
      // grok-4.3 with this off measured 0.9 s to first token, grok-4.5 refuses the setting.
      reasoning: { enabled: false },
      messages: [
        { role: "system" as const, content: SYSTEM_GLANCE },
        { role: "user" as const, content: [
          { type: "text" as const, text: buildGlanceText(input.lang) },
          ...input.images.map((b) => ({ type: "image_url" as const, image_url: { url: toDataUrl(b) } })),
        ] },
      ],
    };
    // `billed: true`: the analysis beside this call is charged whatever this one does, so a gateway
    // status here is a plain error and refunds nothing. Its own budget, well under the analyzer's:
    // a glance that has not answered in fifteen seconds is one nobody is waiting for any more, and
    // the call is holding the image bytes until it settles.
    const raw = (await send(body, true, GLANCE_TIMEOUT_MS, undefined, input.onCost)).choices?.[0]?.message?.content ?? "";
    const line = raw.split("\n")[0]!.trim();
    if (line === "") throw new Error("glance returned nothing");
    return line;
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
    let out = await complete(SYSTEM_ROUTE, text, RouteSchema, "route", false, undefined, deadline, input.onCost);

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
      const content: Content = images.length
        ? [
          { type: "text", text: correction },
          ...images.map((b) => ({ type: "image_url" as const, image_url: { url: toDataUrl(b) } })),
        ]
        : correction;
      const analysis = await complete(
        SYSTEM_TEXT_CORRECTION,
        content,
        MealAnalysisSchema,
        "text-correction",
        // The router call above already generated and was billed — the same rule as the meal branch.
        true,
        undefined,
        deadline,
        input.onCost,
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
        undefined,
        deadline,
        input.onCost,
      );
      out = { ...out, analysis };
    }

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

  const classifyRestrictions: ClassifyRestrictions = async (text) => {
    const out = await complete(SYSTEM_CLASSIFY, buildClassifyText(text), ClassifySchema, "restrictions");
    return out.tags;
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
    const messages: AgentMessage[] = [
      { role: "system", content: `${SYSTEM_COACH}\n\n${buildCoachContext(input.context)}` },
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
        reasoning: { effort: "low" },
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
      const choice = (await send(body, true, left, undefined, input.onCost)).choices?.[0];
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
        return { reply, suggestions: cleanSuggestions(p.suggestions) };
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
  return { analyzePhoto, glancePhoto, routeText, classifyRestrictions, coach, canned: false };
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
