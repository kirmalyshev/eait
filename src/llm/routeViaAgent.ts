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
import { stopAtTerminalTool } from "./stop.ts";
import { SYSTEM_ROUTE, buildRouteText, gated } from "../analyzer.ts";
import type { RouteContext, RouteResult } from "../analyzer.ts";
import type { Profile } from "../types.ts";

/** Mastra resolves a failed tool-call validation to this instead of throwing. */
const isToolError = (v: unknown): v is { error: true; message?: string } =>
  typeof v === "object" && v !== null && (v as { error?: unknown }).error === true;

const TERMINAL = ["submit_meal", "submit_correction", "submit_redate", "answer_question"] as const;
type TerminalName = (typeof TERMINAL)[number];

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
  requestContext: unknown,
): Promise<RouteResult> {
  const result = await agent.generate(
    [{ role: "user", content: [{ type: "text", text: buildRouteText(text, profile, ctx) }] }],
    {
      instructions: SYSTEM_ROUTE,
      requestContext: requestContext as never,
      // Memory keyed on the Telegram user, from the PROFILE. A thread id a model could influence
      // is a thread id it could point at somebody else's conversation.
      memory: { thread: `u${profile.telegram_id}`, resource: String(profile.telegram_id) },
      maxSteps: 6,
      // The router's equivalent of the old path's `response_format: json_schema`. Without it the
      // model may answer in prose, which here means no terminal tool and a thrown error where the
      // user should have got a reply — the failure mode measured on the photo path.
      toolChoice: "required",
      // `toolChoice: "required"` applies to EVERY step, so without this the loop cannot end: the model
      // is forbidden from replying in prose even after it has submitted, and burns maxSteps producing
      // answers nobody reads. Measured at 6 model calls for one photo.
      stopWhen: stopAtTerminalTool,
    },
  );

  const calls = ((result as { toolResults?: unknown[] }).toolResults ?? []) as {
    payload?: { toolName?: string; result?: unknown };
  }[];
  // The LAST terminal call wins: a turn that also called `search_food_db` ends with whichever tool
  // ran last, and a retry after a validation error supersedes the attempt it corrected.
  const terminal = calls
    .filter((c) => TERMINAL.includes(c.payload?.toolName as TerminalName))
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

  // Correction and redate both require a focus meal. Salvage an answer if the agent produced one
  // anyway, else make the drift loud — `routeText`'s behaviour, preserved verbatim.
  if ((name === "submit_correction" || name === "submit_redate") && !ctx.focusMeal) {
    const salvaged = calls
      .filter((c) => c.payload?.toolName === "answer_question")
      .map((c) => c.payload?.result)
      .filter((r) => !isToolError(r))
      .at(-1) as { answer?: string } | undefined;
    if (salvaged?.answer?.trim()) {
      console.warn(`[eait] router: ${name} without focus meal, salvaged as question`);
      return { intent: "question", answer: salvaged.answer.trim() };
    }
    throw new Error(`routeTextViaAgent: ${name} without focus meal`);
  }

  if (name === "submit_redate") {
    return { intent: "redate", dayOffset: (payload as { dayOffset: number }).dayOffset };
  }

  const { analysis } = payload as { analysis: { isFood: boolean } };
  // Both meal-producing intents must describe food — a "correction" to not-food would still render
  // a meal card and land in daily totals.
  if (!analysis.isFood) throw new Error(`routeTextViaAgent: ${name} with isFood=false`);

  if (name === "submit_correction") {
    return { intent: "correction", analysis: gated(analysis as never, profile) };
  }
  return {
    intent: "meal",
    analysis: gated(analysis as never, profile),
    dayOffset: (payload as { dayOffset: number }).dayOffset,
  };
}
