import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MealAnalysisSchema, MAX_DAY_OFFSET } from "../../analyzer.ts";

export interface SubmitMealResult {
  analysis: z.infer<typeof MealAnalysisSchema>;
  dayOffset: number;
}

/**
 * The terminal tool for a NEW meal (photo or free text describing food eaten). Its `inputSchema`
 * IS the validation boundary today's `RouteSchema`/`MealAnalysisSchema.safeParse` played —
 * Mastra validates the model's tool-call arguments against this schema before `execute` runs, so
 * an out-of-contract call never reaches the handler. `execute` does no db work; a later plan's
 * `bot.ts` still owns rendering + persistence from whatever this returns.
 */
export const submitMealTool = createTool({
  id: "submit_meal",
  description:
    "Call this exactly once, as the LAST step of the turn, when the user's message describes " +
    "food they actually ate. Carries the full nutrition analysis and which day it was eaten.",
  inputSchema: MealAnalysisSchema.extend({
    dayOffset: z
      .number()
      .int()
      .min(0)
      .max(MAX_DAY_OFFSET)
      .describe("Whole days before today the food was eaten: 0 = today, 1 = yesterday, up to 7."),
  }),
  execute: async (inputData): Promise<SubmitMealResult> => {
    const { dayOffset, ...analysis } = inputData;
    return { analysis, dayOffset };
  },
});
