// Free-text routing through the Mastra agent — migration stage 3
// (`docs/design/2026-07-28-mastra-engine-boundary.md`). Replaces `analyzer.ts:routeText`.
//
// THE PROMPT IS REUSED, NOT REWRITTEN — `SYSTEM_ROUTE` and `buildRouteText` come from `analyzer.ts`
// verbatim, the same discipline the photo path carries.
//
// WHERE THE FOUR INTENTS WENT. `routeText` returned a discriminated union parsed out of one JSON
// blob; here each intent is a terminal tool, and the union is reconstructed from which one fired.
// Every guard that union earned is preserved, because each was a bug once:
//
//   - correction/redate without a focus meal → salvaged as a question if the model also produced
//     an answer, else a loud throw. The model is TOLD they are unavailable; this is what happens
//     when it ignores that.
//   - isFood:false on a meal-producing intent → throw. A "correction" to not-food would still
//     render a card and land in daily totals.
//   - `gated()` on both meal-producing intents → the verdict gate, whose absence on the photo
//     agent path was this migration's first measured bug.
//   - `clampDayOffset` → inside the tools themselves (`submit_meal`, `submit_redate`).
//
// WHY EVERY TOOL STAYS REGISTERED even when there is no focus meal. Mastra can subset tools per
// call, which would make an unavailable intent structurally unreachable — attractive, and NOT what
// this does. `routeText`'s salvage path exists because the model DOES pick correction without a
// focus meal, and when it does it usually also writes a serviceable answer; subsetting would turn
// that into a retry loop or a refusal instead of the answer the user actually gets today. Parity
// first; tightening is a separate change with its own evidence.

import type { Agent } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";
import { LOOKUP_GUIDANCE } from "./agent.ts";
import { stopAtTerminalTool, ROUTER_TOOLS, LOOKUP_TOOL, MEAL_LOOKUP_TOOL } from "./stop.ts";
import { SYSTEM_ROUTE, TARGETING_GUIDANCE, buildRouteText, gated } from "../analyzer.ts";
import { agentThreadId } from "../db.ts";
import type { RouteContext, RouteResult } from "../analyzer.ts";
import type { SubmitMealResult } from "./tools/mealActions.ts";
import type {
  AskWhichMealResult, SubmitCorrectionResult, SubmitRedateResult,
} from "./tools/routeActions.ts";
import type { Profile } from "../types.ts";

/** Mastra resolves a failed tool-call validation to this instead of throwing. */
const isToolError = (v: unknown): v is { error: true; message?: string } =>
  typeof v === "object" && v !== null && (v as { error?: unknown }).error === true;

// The router's four terminal tools come from `stop.ts`, not a second list here: the stop condition
// and this dispatch must agree about what ends a turn, and two arrays is how they stop agreeing.
type TerminalName = (typeof ROUTER_TOOLS)[number];

/** How much conversation the router replays. See the memory note in `routeTextViaAgent`. */
const ROUTER_HISTORY_TURNS = 10;

/**
 * Route one free-text message. Returns the same `RouteResult` union `routeText` does, so
 * `processText`'s dispatch is unchanged.
 *
 * `requestContext` is bound by the CALLER from the authenticated user, never from model output.
 */
export async function routeTextViaAgent(
  agent: Agent,
  text: string,
  profile: Profile,
  ctx: RouteContext,
  requestContext: RequestContext,
): Promise<RouteResult> {
  const result = await agent.generate(
    [{ role: "user", content: [{ type: "text", text: buildRouteText(text, profile, ctx) }] }],
    {
      // Appended, not assumed: Mastra's per-call `instructions` REPLACES the agent's, so passing
      // SYSTEM_ROUTE alone dropped the agent's guidance on how to use `search_food_db` and the model was
      // offered the tool with nothing telling it to pass confusable alternatives. Measured.
      instructions: `${SYSTEM_ROUTE}\n\n${LOOKUP_GUIDANCE}\n\n${TARGETING_GUIDANCE}`,
      requestContext,
      // The one flow that KEEPS memory — conversational continuity is the point here (#45), and
      // unlike a photo turn there are no image parts to drag along. Keyed on the Telegram user from
      // the PROFILE: a thread id a model could influence is a thread id it could point at somebody
      // else's conversation.
      //
      // BOUNDED explicitly. Left at the default, the replayed history grows every turn, and this
      // prompt already carries today's meals, the week's totals and the targets as structured
      // context — which answers "what did I eat" far better than raw transcript ever will. History
      // is here for "what did I just ask you", and that needs a handful of turns, not all of them.
      memory: {
        // `agentThreadId`, not a template here: `deleteUser` erases this thread on /delete, and two
        // copies of the key is how a rename leaves a deleted user's conversation history behind.
        thread: agentThreadId(profile.telegram_id),
        resource: String(profile.telegram_id),
        options: { lastMessages: ROUTER_HISTORY_TURNS },
      },
      maxSteps: 6,
      // The router's equivalent of the old path's `response_format: json_schema`. Without it the
      // model may answer in prose, which here means no terminal tool and a thrown error where the
      // user should have got a reply — the failure mode measured on the photo path.
      toolChoice: "required",
      // `toolChoice: "required"` applies to EVERY step, so without this the loop cannot end: the model
      // is forbidden from replying in prose even after it has submitted, and burns maxSteps producing
      // answers nobody reads. Measured at 6 model calls for one photo.
      stopWhen: stopAtTerminalTool,
      // `submit_restrictions` is registered on the agent but belongs to onboarding; it would end
      // this turn on a tool this function cannot dispatch. Grounding stays available — a text meal
      // is estimated from prose and benefits from the composition table as much as a photo does.
      activeTools: [...ROUTER_TOOLS, LOOKUP_TOOL, MEAL_LOOKUP_TOOL],
    },
  );

  const calls = ((result as { toolResults?: unknown[] }).toolResults ?? []) as {
    payload?: { toolName?: string; result?: unknown };
  }[];
  // The LAST terminal call wins: a turn that also called `search_food_db` ends with whichever tool
  // ran last, and a retry after a validation error supersedes the attempt it corrected.
  const terminal = calls
    .filter((c) => (ROUTER_TOOLS as readonly string[]).includes(c.payload?.toolName ?? ""))
    .at(-1);

  if (!terminal) {
    throw new Error("routeTextViaAgent: the agent finished without calling a terminal tool");
  }
  const name = terminal.payload!.toolName as TerminalName;
  const payload = terminal.payload!.result;
  if (isToolError(payload)) {
    throw new Error(`routeTextViaAgent: ${name} failed validation: ${payload.message ?? "unknown"}`);
  }

  if (name === "answer_question") {
    return { intent: "question", answer: (payload as { answer: string }).answer };
  }

  if (name === "ask_which_meal") {
    const { mealIds, question } = payload as AskWhichMealResult;
    return { intent: "choose", mealIds, question };
  }

  // Correction and redate need a TARGET, and there are now two ways to have one: the reply's focus
  // meal, or a `mealId` the agent found with `find_meals`. Only when it has NEITHER is this the
  // drift the original guard was written for — salvage an answer if the agent produced one anyway,
  // else make it loud. (The guard itself is unchanged in spirit; what counts as a target grew.)
  const targeted = (payload as { mealId?: string }).mealId;
  if ((name === "submit_correction" || name === "submit_redate") && !ctx.focusMeal && !targeted) {
    const salvaged = calls
      .filter((c) => c.payload?.toolName === "answer_question")
      .map((c) => c.payload?.result)
      .filter((r) => !isToolError(r))
      .at(-1) as { answer?: string } | undefined;
    if (salvaged?.answer?.trim()) {
      console.warn(`[eait] router: ${name} without a target, salvaged as question`);
      return { intent: "question", answer: salvaged.answer.trim() };
    }
    throw new Error(`routeTextViaAgent: ${name} without a target (no focus meal, no mealId)`);
  }

  if (name === "submit_redate") {
    const { dayOffset, mealId } = payload as SubmitRedateResult;
    return { intent: "redate", dayOffset, ...(mealId ? { mealId } : {}) };
  }

  // Typed against what the tools' `execute` actually returns, rather than cast: if either tool's
  // result shape changes, this stops compiling instead of silently handing `gated` something that
  // is not a MealAnalysis.
  const { analysis } = payload as SubmitMealResult | SubmitCorrectionResult;
  // Both meal-producing intents must describe food — a "correction" to not-food would still render
  // a meal card and land in daily totals.
  if (!analysis.isFood) throw new Error(`routeTextViaAgent: ${name} with isFood=false`);

  if (name === "submit_correction") {
    const { mealId } = payload as SubmitCorrectionResult;
    return { intent: "correction", analysis: gated(analysis, profile), ...(mealId ? { mealId } : {}) };
  }
  return {
    intent: "meal",
    analysis: gated(analysis, profile),
    dayOffset: (payload as SubmitMealResult).dayOffset,
  };
}
