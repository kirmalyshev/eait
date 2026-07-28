// Photo analysis through the Mastra agent. Reached from `bot.ts` and `api/` alike via the
// `AnalyzePhoto` port (`llm/analyzePort.ts`) — this is the ONLY photo path the app has.
// Design: `docs/design/2026-07-28-mastra-engine-boundary.md`.
//
// THE PROMPT IS REUSED, NOT REWRITTEN. `SYSTEM` and `buildUserText` are imported from
// `analyzer.ts` verbatim. That text carries the estimation protocol, the deleted round-up hedge,
// the cuisine/country/repertoire priors, the per-item macro instruction and the verdict contract —
// each measured or argued for. Re-authoring it for the new engine would turn a transport migration
// into a simultaneous accuracy experiment, and no eval could then tell which of the two moved the
// numbers. The migration is a transport change, and this file keeps it one.
//
// THE PARSE BOUNDARY MOVES, AND ITS FAILURE MODE CHANGES WITH IT. On the old path an invalid
// payload makes `safeParse` throw, `bot.ts` shows `errors.analyzeFailed`, and no row is written.
// Mastra does not throw: a tool call failing `inputSchema` validation resolves to an error-shaped
// result `{error: true, message, validationErrors}` which is fed back for a retry. So a
// `submit_meal` result is a discriminated union, and reading `.analysis` off the error shape would
// crash exactly where the old path failed loudly and cleanly. That check is the reason this file
// exists rather than a two-line call.

import type { Agent } from "@mastra/core/agent";
import { SYSTEM, buildUserText, MealAnalysisSchema, gated } from "../analyzer.ts";
import type { MealAnalysis, MealContext, Profile } from "../types.ts";

/** Mastra resolves a failed tool-call validation to this instead of throwing. */
interface ToolError {
  error: true;
  message?: string;
  validationErrors?: unknown;
}

const isToolError = (v: unknown): v is ToolError =>
  typeof v === "object" && v !== null && (v as { error?: unknown }).error === true;

/**
 * Analyze one meal's photos through the agent, returning the same `MealAnalysis` the old path does.
 *
 * `userId` is bound into the request context by the CALLER, never taken from anything the model
 * produces — the constitutional rule in `llm/context.ts`. It is required here rather than optional
 * so a caller cannot forget it and silently get an unscoped agent turn.
 */
export async function analyzeMealViaAgent(
  agent: Agent,
  images: readonly Uint8Array[],
  profile: Profile,
  requestContext: unknown,
  context?: MealContext,
): Promise<MealAnalysis> {
  // Memory is keyed on the Telegram user, per the design. Both values come from the PROFILE, never
  // from anything the model produced — a thread id a model could influence is a thread id it could
  // point at somebody else's conversation.
  const memoryKey = { thread: `u${profile.telegram_id}`, resource: String(profile.telegram_id) };
  if (images.length === 0) throw new Error("analyzeMealViaAgent: no images");

  const result = await agent.generate(
    [
      {
        role: "user",
        content: [
          { type: "text", text: buildUserText(profile, context, images.length > 1) },
          // Every image in ONE message, as the old path does: several photos are different angles
          // of a single meal, and splitting them across messages would invite the agent to treat
          // them as separate dishes.
          ...images.map((bytes) => ({ type: "image" as const, image: bytes })),
        ],
      },
    ],
    {
      instructions: SYSTEM,
      requestContext: requestContext as never,
      memory: memoryKey,
      // The agent must be able to look a food up and THEN submit, so a single step cannot be the
      // limit. Bounded anyway: a runaway loop on a photo is a bill, not a hang.
      maxSteps: 6,
      // MEASURED, not precautionary. The old path forced structure with
      // `response_format: json_schema`; leaving toolChoice at its "auto" default dropped that
      // guarantee, and the parity harness lost roughly one photo in four to
      // "finished without calling submit_meal" — the model answering in prose instead. It
      // reproduced with grounding on and off, on different fixtures each run, so it is the missing
      // forcing and not a tool-loop artefact. The user's meal was simply gone.
      toolChoice: "required",
    },
  );

  // Find the terminal tool call among the steps. Not `toolResults.at(-1)`: a turn that also called
  // `search_food_db` ends with whichever tool ran last, and reading the food lookup as the analysis
  // would be a type error at best and a silently empty meal at worst.
  const calls = ((result as { toolResults?: unknown[] }).toolResults ?? []) as {
    payload?: { toolName?: string; result?: unknown };
  }[];
  const submitted = calls.filter((c) => c.payload?.toolName === "submit_meal");

  if (submitted.length === 0) {
    // Fail loudly, mirroring the old path's contract: no analysis means no row, never a partial
    // meal assembled from whatever the agent happened to say in prose.
    throw new Error("analyzeMealViaAgent: the agent finished without calling submit_meal");
  }
  // The LAST submit_meal wins if the agent retried after a validation error — the earlier ones are
  // the rejected attempts, and Mastra fed them back precisely so they would be superseded.
  const payload = submitted[submitted.length - 1]!.payload?.result;

  if (isToolError(payload)) {
    throw new Error(
      `analyzeMealViaAgent: submit_meal failed validation: ${payload.message ?? "unknown"}`,
    );
  }

  // `submit_meal`'s execute returns { analysis, dayOffset } — dayOffset belongs to the text-meal
  // flow and means nothing for a photo, which is always logged on the day it was sent.
  const { analysis } = payload as { analysis: unknown };

  // Re-validated even though Mastra already checked the tool call against the same schema. The
  // tool's `inputSchema` and this parse are the same contract, but this function's RETURN type is
  // what every caller trusts, and a defaulted or coerced field must land identically to the old
  // path — otherwise the two engines could disagree on a meal neither of them got wrong.
  //
  // `gated` is the fourth exit of the verdict gate and is NOT optional. Without it the model's own
  // verdicts reach the card and the row: this path shipped returning `verdicts.kidneys` for a
  // profile that declared only `ldl`. The gate discards the model's verdicts entirely and recomputes
  // them from the user's caps, so it also keeps the two engines agreeing on a dimension the model
  // is not trusted to judge in the first place.
  return gated(MealAnalysisSchema.parse(analysis), profile);
}
