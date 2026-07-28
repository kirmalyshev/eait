import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MealAnalysisSchema, MAX_DAY_OFFSET, clampDayOffset } from "../../analyzer.ts";

export interface SubmitMealResult {
  analysis: z.infer<typeof MealAnalysisSchema>;
  dayOffset: number;
}

/**
 * The terminal tool for a NEW meal (photo or free text describing food eaten). Its `inputSchema`
 * IS the validation boundary today's `RouteSchema`/`MealAnalysisSchema.safeParse` played — but the
 * failure mode is NOT the same. `safeParse` throws (via `analyzer.ts`'s fail-loud contract) on an
 * invalid payload. Mastra does not: when the model's tool-call arguments fail `inputSchema`
 * validation, `execute` never runs, but the call does not throw either — Mastra instead resolves
 * the tool call to an error-shaped result (verified empirically):
 *   `{ error: true, message: string, validationErrors: unknown }`
 * and feeds that back to the model so it can retry. So a `submit_meal` tool result's
 * `payload.result` is really a discriminated union — this error shape, or `SubmitMealResult` —
 * never a thrown exception. Whoever wires this into `bot.ts` next (a later plan) MUST check for
 * `error === true` before trusting `payload.result` as a `SubmitMealResult`; naively reading
 * `.analysis.items[0].name` off an error payload will crash exactly where today's `safeParse`
 * fails loudly and cleanly instead. `execute` does no db work either way; a later plan's `bot.ts`
 * still owns rendering + persistence from whatever this returns.
 */
export const submitMealTool = createTool({
  id: "submit_meal",
  description:
    "Call this exactly once, as the LAST step of the turn, when the user's message describes " +
    "food they actually ate. Carries the full nutrition analysis and which day it was eaten.",
  inputSchema: MealAnalysisSchema.extend({
    // `unknown`, not `number`, and the reason is the same one `RouteSchema` gives: models commonly
    // emit `null` for same-day, and a strict type REJECTS THE WHOLE CALL over it. On the old path
    // that cost nothing because `clampDayOffset` normalized any junk; here a rejected call comes
    // back error-shaped, the model retries, and a model that keeps emitting null exhausts maxSteps
    // — losing a meal the shipped path files at offset 0. The bound lives in `describe` (which the
    // model reads) and in `clampDayOffset` (which enforces it), not in a type that can veto a
    // perfectly good analysis over its date field.
    dayOffset: z
      .unknown()
      .optional()
      .describe(
        `Whole days before today the food was eaten: 0 = today, 1 = yesterday, up to ${MAX_DAY_OFFSET}.`,
      ),
  }),
  execute: async (inputData): Promise<SubmitMealResult> => {
    const { dayOffset, ...analysis } = inputData;
    // Clamped HERE so the tool's declared return type is honest — `SubmitMealResult.dayOffset` is a
    // number in `[0, 7]` whatever the model sent. Out-of-contract values warn, matching `routeText`:
    // the clamp keeps the meal, the warning keeps model drift visible to the operator.
    const clamped = clampDayOffset(dayOffset);
    if (dayOffset !== undefined && dayOffset !== clamped) {
      console.warn(
        `[eait] submit_meal: dayOffset ${JSON.stringify(dayOffset)} out of contract → ${clamped}`,
      );
    }
    return { analysis, dayOffset: clamped };
  },
});
