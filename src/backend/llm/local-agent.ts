// A local coding-agent CLI as the model provider — `claude -p`, `codex exec`.
//
// The same three ports as `openrouter.ts`, backed by a spawned process instead of an HTTP call:
// the prompt goes in on stdin, the answer comes back on stdout or in a file the CLI was asked to
// write, and zod still has the last word on the shape. Selected by
// `EAIT__BACKEND__LLM_PROVIDER=claude-cli|codex-cli`, wired in `index.ts`.
//
// WHERE IT MAY RUN. Development and self-hosted only. The CLIs are paid for by a subscription
// bound to the operator's account and authenticated on the host, and the prod container carries
// no binary and no credentials — `index.ts` probes the binary at boot and refuses to start
// without it, so a `*-cli` provider in the prod image cannot come up by accident. One running
// there means somebody installed the CLI and its auth on purpose.
//
// SAFETY. The prompt carries the user's medical free text, and a coding agent's idea of "ignore
// your instructions" is to obey — so the CLIs run stripped of everything a reply does not need:
// claude under `--restricted` (no command-running tools, file tools confined to the working
// directory) with `--permission-prompts none` and only Read allowed, codex under
// `--sandbox read-only`. The working directory is a scratch dir made for the call, holds nothing
// but the call's own photos, and is removed when the call ends. The prompt itself travels on
// stdin, not in argv, where `ps` would print the user's words for every process on the box.
//
// COST. There is no per-token price, so the caps are all that still applies — a turn is charged
// before the model is asked exactly as with OpenRouter. claude's result envelope reports
// `total_cost_usd`, its own accounting of the subscription inference, and that is forwarded to
// `onCost` like `usage.cost`. codex reports nothing, so its calls land as "unpriced", which
// `addCost` already understands.
//
// NO STREAMING. A CLI is one process and one reply, so `onDelta` is accepted and never called —
// the port's contract covers the one-shot shape, and the phone waits on the same deadline either
// way.
//
// THE TOOL PROTOCOL IS IN-BAND. A spawned CLI cannot reach the engine's tool closures, so the
// coach's tools are described in the prompt as JSON and a round's answer is either
// `{"tool_calls":[…]}` — executed here and fed back on the next spawn — or the reply object.
// Each round re-sends the whole transcript: the CLIs' resume modes differ and re-sending is the
// shape that works on all of them.
//
// Adding a CLI is one entry in `ADAPTERS`: how to invoke it for one prompt, and where its answer
// lands. A CLI that cannot read a photo is not one: vision is not optional here.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod";
import { cleanSuggestions } from "@eait/shared";
import type { AnalyzePhoto, Coach, CoachTools, LlmPorts, OnCost, RouteResult, RouteText } from "./port.ts";
import { MAX_COACH_ROUNDS, clampDayOffset, emptyEstimate, imageMime } from "./port.ts";
import {
  COACH_TOOL_DEFS, EMPTY_ESTIMATE_RETRY, MealAnalysisSchema, PROMPT_DEFAULTS, RouteSchema,
  buildCoachContext, buildRouteText, buildTextCorrectionText, buildTextMealText, buildUserText,
  coachLine, type Prompts,
} from "./prompt.ts";

/** The `EAIT__BACKEND__LLM_PROVIDER` values this file serves. `config.ts` validates against it. */
export const AGENT_PROVIDERS = ["claude-cli", "codex-cli"] as const;
export type AgentProvider = typeof AGENT_PROVIDERS[number];
export function isAgentProvider(v: string): v is AgentProvider {
  return (AGENT_PROVIDERS as readonly string[]).includes(v);
}

interface Options {
  provider: AgentProvider;
  /** The shared turn budget — same role as `openrouter.ts`'s `timeoutMs`. */
  timeoutMs: number;
  /**
   * At most this many agent processes at once. A coding agent is a heavyweight child — a whole
   * runtime per call — and an unbounded fan-out is a laptop that stops answering. From
   * `EAIT__BACKEND__LLM_AGENT_CONCURRENCY`; the route's speculative pair is what the default (2)
   * is sized for.
   */
  concurrency: number;
  /**
   * `--model` for the analyzer/router calls, `chatModel` for the coach — the CLI's OWN model
   * spelling, passed only when the operator set `EAIT__BACKEND__LLM_MODEL` /
   * `EAIT__BACKEND__LLM_CHAT_MODEL` explicitly: the compiled-in defaults are OpenRouter ids and
   * would name a model the CLI does not have. Unset means the CLI's own default.
   */
  model?: string | undefined;
  chatModel?: string | undefined;
  /** The binary to run — overrides the adapter's PATH lookup. The tests point it at a fixture. */
  command?: string | undefined;
  /** Where per-call scratch dirs are made — `$TMPDIR` unless a test says otherwise. */
  scratchDir?: string | undefined;
  /** Same contract as `openrouter.ts`'s: absent is the compiled-in prompts. */
  prompts?: () => Promise<Prompts>;
}

/** What one spawn is asked to answer. `images` is byte arrays; they land in the scratch dir. */
interface AgentRequest {
  system: string;
  user: string;
  images: Uint8Array[];
  model?: string | undefined;
}

/** One CLI, as two functions: how a call is invoked and where its answer lands. */
interface AgentAdapter {
  bin: string;
  /** argv minus the prompt — that goes on stdin, never in argv (see the header). */
  argv(bin: string, call: { system: string; imageNames: string[]; model?: string | undefined; dir: string }): string[];
  /** The stdin payload — the prompt, plus whatever the CLI needs to be told about the photos. */
  stdin(call: { system: string; user: string; imageNames: string[] }): string;
  /** The model's answer text and any price the run reported, or a thrown error. */
  answer(exit: { code: number; stdout: string; stderr: string; dir: string }): { text: string; usd: number | null };
}

const IMAGE_EXT: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const ADAPTERS: Record<AgentProvider, AgentAdapter> = {
  /**
   * `claude -p`: prompt on stdin, `--output-format json` envelope on stdout, its `result` field
   * the answer and `total_cost_usd` the price. `--restricted` removes the command-running tools
   * and confines the file tools to the working directory — the scratch dir, which is why the
   * photo names it is told are relative. Read is the only tool it may need (the photos).
   */
  "claude-cli": {
    bin: "claude",
    argv(bin, { system, model }) {
      return [
        bin, "-p", "--output-format", "json",
        "--restricted", "--permission-prompts", "none", "--allowedTools", "Read",
        "--system-prompt", system,
        ...(model ? ["--model", model] : []),
      ];
    },
    stdin({ user, imageNames }) {
      return imageNames.length === 0 ? user
        : `${user}\n\nThe meal photo(s) are files in the working directory: ${imageNames.join(", ")}. Read each of them with the Read tool, then answer.`;
    },
    answer({ code, stdout, stderr }) {
      let env: Record<string, unknown>;
      try {
        env = JSON.parse(stdout) as Record<string, unknown>;
      } catch {
        throw new Error(`claude -p exited ${code} without a JSON envelope: ${(stderr || stdout).slice(0, 300)}`);
      }
      if (code !== 0 || env.is_error === true) {
        throw new Error(`claude -p failed (${String(env.subtype ?? `exit ${code}`)}): ${String(env.result ?? stderr).slice(0, 300)}`);
      }
      return {
        text: String(env.result ?? ""),
        usd: typeof env.total_cost_usd === "number" ? env.total_cost_usd : null,
      };
    },
  },
  /**
   * `codex exec`: prompt on stdin (`-`), the last agent message written to a file rather than dug
   * out of the transcript on stdout, images attached with `--image`. Read-only sandbox for the
   * same reason claude runs `--restricted`: the prompt is user-influenced text.
   */
  "codex-cli": {
    bin: "codex",
    argv(bin, { imageNames, model, dir }) {
      return [
        bin, "exec", "--skip-git-repo-check", "--sandbox", "read-only",
        "-o", join(dir, "last-message.txt"),
        ...imageNames.flatMap((n) => ["--image", n]),
        ...(model ? ["-m", model] : []),
        "-",
      ];
    },
    stdin({ system, user, imageNames }) {
      return `${system}\n\n${user}`
        + (imageNames.length === 0 ? "" : "\n\nThe meal photo(s) are attached to this message.");
    },
    answer({ code, stdout, stderr, dir }) {
      const file = join(dir, "last-message.txt");
      const text = existsSync(file) ? readFileSync(file, "utf8").trim() : "";
      if (text !== "") return { text, usd: null };
      throw new Error(`codex exec exited ${code} and wrote no last message: ${(stderr || stdout).slice(-300)}`);
    },
  },
};

/**
 * Probe the binary at boot — `provider --version` — and answer with its version line.
 *
 * The whole "never in prod by accident" guard: a host without the CLI (the prod image, a laptop
 * that never installed it) fails HERE, before the first request is answered by nothing. A server
 * that says it is answering with a real model and is not is worse than one that will not start.
 */
export async function probeAgentCli(provider: AgentProvider, command?: string): Promise<string> {
  const bin = command ?? ADAPTERS[provider].bin;
  const path = Bun.which(bin);
  if (path === null) throw new Error(`no "${bin}" on PATH`);
  const proc = Bun.spawn([path, "--version"], { stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => { try { proc.kill(); } catch { /* already gone */ } }, 10_000);
  try {
    const code = await proc.exited;
    const out = await new Response(proc.stdout).text();
    if (code !== 0) throw new Error(`"${bin} --version" exited ${code}`);
    return out.trim().split("\n")[0] ?? bin;
  } finally {
    clearTimeout(timer);
  }
}

/** At most `max` of `fn` at once — the bound on heavyweight agent processes per instance. */
function gate(max: number): <T>(fn: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiters: (() => void)[] = [];
  return async function run<T>(fn: () => Promise<T>): Promise<T> {
    while (running >= max) await new Promise<void>((r) => waiters.push(r));
    running++;
    try {
      return await fn();
    } finally {
      running--;
      waiters.shift()?.();
    }
  };
}

/**
 * The model's JSON out of whatever prose wrapped it: a markdown fence, a lead-in sentence. The
 * schema retry in `complete()` is for a reply that parsed but missed the shape; this is the step
 * before it.
 */
function extractJson(raw: string): unknown {
  const t = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(t);
  } catch { /* not the whole answer */ }
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(t.slice(a, b + 1));
    } catch { /* falls through */ }
  }
  return undefined;
}

/** A `{"tool_calls":[{"name":"…","arguments":{…}}]}` answer's calls, or none. */
function toolCallsOf(parsed: unknown): { name: string; arguments: unknown }[] {
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return [];
  const calls = (parsed as Record<string, unknown>).tool_calls;
  if (!Array.isArray(calls)) return [];
  return calls.filter(
    (c): c is { name: string; arguments: unknown } =>
      typeof c === "object" && c !== null && typeof (c as Record<string, unknown>).name === "string",
  ).slice(0, 3);
}

export function localAgentPorts(opts: Options): LlmPorts {
  const adapter = ADAPTERS[opts.provider];
  const bin = opts.command ?? adapter.bin;
  const scratchRoot = opts.scratchDir ?? tmpdir();
  const prompts = opts.prompts ?? (async () => PROMPT_DEFAULTS);
  const slot = gate(Math.max(1, opts.concurrency));

  /**
   * One spawn: scratch dir, photos written into it, prompt on stdin, answer out of the adapter,
   * cost reported once. The scratch dir is removed in the `finally` — it holds a user's photos
   * for the length of one call and no longer.
   */
  async function send(
    call: AgentRequest, budgetMs: number, onCost?: OnCost, cutoff?: AbortSignal,
  ): Promise<string> {
    if (cutoff?.aborted) throw cutoff.reason ?? new Error("aborted");
    return slot(async () => {
      mkdirSync(scratchRoot, { recursive: true });
      const dir = mkdtempSync(join(scratchRoot, "eait-agent-"));
      const imageNames = call.images.map((b, i) => `image-${i}.${IMAGE_EXT[imageMime(b) ?? "image/jpeg"]}`);
      imageNames.forEach((n, i) => writeFileSync(join(dir, n), call.images[i]!));
      let cost: number | null = null;
      try {
        const path = Bun.which(bin) ?? bin;
        const proc = Bun.spawn(adapter.argv(path, { system: call.system, imageNames, model: call.model, dir }), {
          cwd: dir,
          stdin: new Blob([adapter.stdin({ system: call.system, user: call.user, imageNames })]),
          stdout: "pipe",
          stderr: "pipe",
        });
        const stdoutP = new Response(proc.stdout).text();
        const stderrP = new Response(proc.stderr).text();
        let timedOut = false;
        const timer = setTimeout(() => {
          timedOut = true;
          try { proc.kill(); } catch { /* already gone */ }
        }, budgetMs);
        const onCut = () => { try { proc.kill(); } catch { /* already gone */ } };
        cutoff?.addEventListener("abort", onCut);
        try {
          const code = await proc.exited;
          const stdout = await stdoutP;
          const stderr = await stderrP;
          if (timedOut) throw new Error(`llm timeout after ${budgetMs}ms (${opts.provider})`);
          if (cutoff?.aborted) throw cutoff.reason ?? new Error("aborted");
          const out = adapter.answer({ code, stdout, stderr, dir });
          cost = out.usd;
          return out.text;
        } finally {
          clearTimeout(timer);
          cutoff?.removeEventListener("abort", onCut);
        }
      } finally {
        rmSync(dir, { recursive: true, force: true });
        onCost?.(cost);
      }
    });
  }

  /**
   * One prompt, validated against `schema` — the `openrouter.ts` contract transplanted onto a
   * process: a reply that misses the shape gets ONE retry with the errors fed back, and that is
   * it. The JSON grammar the API enforced is an instruction here instead, appended to the system
   * prompt; `extractJson` strips whatever wrapped it.
   */
  async function complete<T>(
    call: AgentRequest,
    schema: z.ZodType<T>,
    schemaName: string,
    deadline: number,
    onCost?: OnCost,
    cutoff?: AbortSignal,
  ): Promise<T> {
    const system = `${call.system}\n\nAnswer with a single JSON object that satisfies this JSON schema — no prose, no markdown fences, nothing else:\n${JSON.stringify(z.toJSONSchema(schema, { io: "output" }))}`;
    let lastError = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`llm ran past ${opts.timeoutMs}ms before ${schemaName}`);
      const user = attempt === 0 ? call.user
        : `${call.user}\n\nYour previous reply did not satisfy the required shape: ${lastError}. Reply again with valid JSON only.`;
      const reply = await send({ ...call, system, user }, left, onCost, cutoff);
      const parsed = extractJson(reply);
      if (parsed === undefined) {
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
    const { analysis } = await prompts();
    const user = buildUserText(input.profile, input.targets, {
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
      ...(input.localTime !== undefined ? { localTime: input.localTime } : {}),
      ...(input.repertoire !== undefined ? { repertoire: input.repertoire } : {}),
      ...(input.portionPriors !== undefined ? { portionPriors: input.portionPriors } : {}),
    });
    return await complete(
      { system: analysis, user, images: input.images, model: opts.model },
      MealAnalysisSchema, "meal_analysis",
      Date.now() + opts.timeoutMs, input.onCost, input.signal,
    );
  };

  const routeText: RouteText = async (input) => {
    const deadline = Date.now() + opts.timeoutMs;
    const text = buildRouteText({
      text: input.text, profile: input.profile, targets: input.targets,
      todayMeals: input.todayMeals, week: input.week,
      ...(input.focusMeal !== undefined ? { focusMeal: input.focusMeal } : {}),
      ...(input.question !== undefined ? { question: input.question } : {}),
      ...(input.recent !== undefined ? { recent: input.recent } : {}),
    });
    const P = await prompts();

    // THE SAME SPECULATION AS `openrouter.ts` (#70): the focused `text-meal` call needs nothing
    // the router produces, so on a turn with no focus meal it is fired in parallel and awaited
    // when the intent is `meal`. The price of a question is one spawned agent nobody reads.
    const specAbort = new AbortController();
    const specCutoff = input.signal === undefined
      ? specAbort.signal
      : AbortSignal.any([specAbort.signal, input.signal]);
    const routing = complete(
      { system: P.route, user: text, images: [], model: opts.model },
      RouteSchema, "route", deadline, input.onCost, input.signal,
    );
    const spec = input.focusMeal === undefined
      ? complete(
        { system: P.text_meal, user: buildTextMealText({ text: input.text, profile: input.profile, targets: input.targets, todayMeals: input.todayMeals }), images: [], model: opts.model },
        MealAnalysisSchema, "text-meal", deadline, input.onCost, specCutoff,
      )
      : null;
    spec?.catch(() => {});

    let out: Awaited<typeof routing>;
    try {
      out = await routing;
    } catch (e) {
      specAbort.abort();
      throw e;
    }
    let specUsed = false;

    if (out.intent === "correction" && (!out.analysis || emptyEstimate(out.analysis)) && input.focusMeal) {
      // The stored photographs ride along, and only here — the routing call above runs on every
      // text turn from a meal screen and must not pay for images.
      const images = input.loadFocusImages ? await input.loadFocusImages() : [];
      const correction = buildTextCorrectionText({
        text: input.text, profile: input.profile, targets: input.targets,
        focusMeal: input.focusMeal,
        ...(input.question !== undefined ? { question: input.question } : {}),
        ...(images.length ? { photos: images.length } : {}),
      });
      let analysis = await complete(
        { system: P.text_correction, user: correction, images, model: opts.model },
        MealAnalysisSchema, "text-correction", deadline, input.onCost, input.signal,
      );
      if (emptyEstimate(analysis)) {
        analysis = await complete(
          { system: P.text_correction, user: correction + EMPTY_ESTIMATE_RETRY, images, model: opts.model },
          MealAnalysisSchema, "text-correction", deadline, input.onCost, input.signal,
        );
      }
      out = { ...out, analysis };
    } else if (out.intent === "meal" && (!out.analysis || emptyEstimate(out.analysis))) {
      const mealText = buildTextMealText({ text: input.text, profile: input.profile, targets: input.targets, todayMeals: input.todayMeals });
      let analysis = spec !== null ? (specUsed = true, await spec) : await complete(
        { system: P.text_meal, user: mealText, images: [], model: opts.model },
        MealAnalysisSchema, "text-meal", deadline, input.onCost, input.signal,
      );
      if (emptyEstimate(analysis)) {
        analysis = await complete(
          { system: P.text_meal, user: mealText + EMPTY_ESTIMATE_RETRY, images: [], model: opts.model },
          MealAnalysisSchema, "text-meal", deadline, input.onCost, input.signal,
        );
      }
      out = { ...out, analysis };
    }
    if (!specUsed) specAbort.abort();

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
   * The agent loop, in-band. The tools are JSON in the system prompt, a round's answer is either
   * a `tool_calls` object — executed through the engine's closures and appended to the
   * transcript — or the reply object the schema describes. The round after `MAX_COACH_ROUNDS`
   * goes without the tool section, so the model has to answer with what it has.
   *
   * THE WHOLE TURN SHARES ONE `timeoutMs`, same rule as `openrouter.ts` (#153): a round that
   * finds the budget spent throws, and `handleText` answers from the router.
   */
  const coach: Coach = async (input, tools) => {
    const defs = COACH_TOOL_DEFS.filter((d) => Object.hasOwn(tools, d.function.name));
    const deadline = Date.now() + opts.timeoutMs;
    const { coach: persona } = await prompts();
    const system = [
      persona,
      buildCoachContext(input.context),
      ...(defs.length > 0 ? [
        `To fetch more of the user's data, reply with ONLY a JSON object {"tool_calls":[{"name":"<name>","arguments":{…}}]} naming one or more of these tools:\n${JSON.stringify(defs.map((d) => d.function))}`,
      ] : []),
      `To answer, reply with ONLY a JSON object {"reply":"…","suggestions":["…"],"focus":"<optional nutrient name>"} — no prose outside the JSON.`,
    ].join("\n\n");
    const transcript = [
      ...input.history.map((h) => `- ${h.role === "user" ? "user" : (h.speaker ?? "Spud")}: ${coachLine(h.text)}`),
      `- user: ${coachLine(input.text)}`,
    ];
    for (let round = 0; ; round++) {
      const last = round >= MAX_COACH_ROUNDS || defs.length === 0;
      const left = deadline - Date.now();
      if (left <= 0) throw new Error(`coach ran past ${opts.timeoutMs}ms over ${round} tool round(s)`);
      const user = transcript.join("\n") + (last ? "\n\nAnswer now — no more data fetches." : "");
      const raw = (await send(
        { system, user, images: [], model: opts.chatModel }, left, input.onCost, input.signal,
      )).trim();
      if (raw === "") throw new Error(`coach returned an empty reply after ${round} tool round(s)`);
      let parsed: unknown = extractJson(raw);
      const calls = toolCallsOf(parsed);
      if (calls.length > 0 && !last) {
        transcript.push(`- Spud: ${coachLine(raw)}`);
        for (const call of calls) {
          const result = await runTool(tools, call.name, call.arguments);
          transcript.push(`tool ${call.name} answered: ${JSON.stringify(result).slice(0, 12_000)}`);
        }
        continue;
      }

      // The reply — the same leniency as `openrouter.ts`: a bare JSON string is a sentence, an
      // object is the schema's shape, and prose where JSON was asked for is still the answer.
      if (typeof parsed === "string") parsed = { reply: parsed };
      if (typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)) {
        const p = parsed as Record<string, unknown>;
        const reply = typeof p.reply === "string" ? p.reply.trim() : "";
        if (reply === "") throw new Error("coach returned JSON with an empty reply");
        return {
          reply,
          suggestions: cleanSuggestions(p.suggestions),
          ...(typeof p.focus === "string" ? { focus: p.focus } : {}),
        };
      }
      return { reply: raw, suggestions: [] };
    }
  };

  // Not canned: these answers are a real model's and describe the photograph. `GET /health`
  // reports it.
  return { analyzePhoto, routeText, coach, canned: false };
}

/**
 * One in-band tool call, executed — or refused in a shape the model can read and recover from.
 * Same rule as `openrouter.ts`'s `runTool`: nothing here throws, and the failure's own text goes
 * to the log rather than to the model, because it can carry a query and the query can carry the
 * user's medical free text.
 */
async function runTool(tools: CoachTools, name: string, args: unknown): Promise<unknown> {
  const refuse = (error: string) => {
    console.warn(`[eait] coach tool call refused: ${name} — ${error}`);
    return { error };
  };
  const fn = tools[name];
  if (!fn) return refuse("unknown tool");
  if (typeof args !== "object" || args === null || Array.isArray(args)) return refuse("arguments must be an object");
  try {
    return await fn(args as Record<string, unknown>);
  } catch (e) {
    console.error(`[eait] coach tool ${name} failed: ${(e as Error)?.message ?? e}`);
    return { error: "the tool failed" };
  }
}
