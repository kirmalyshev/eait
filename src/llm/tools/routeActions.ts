import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import { MealAnalysisSchema, MAX_DAY_OFFSET, clampDayOffset } from "../../analyzer.ts";
import { RESTRICTION_TAGS } from "../../targets.ts";

// The three remaining terminal tools, completing the set `routeText`'s four-intent union used to
// carry (`submit_meal` in mealActions.ts is the fourth). Each one's `inputSchema` is the validation
// boundary `RouteSchema.safeParse` was — with the same caveat that governs every tool here: Mastra
// does NOT throw on a failed validation, it resolves the call to `{error: true, ...}` and feeds it
// back for a retry. Callers check for that shape before trusting a result.
//
// NONE of them touch the database. `execute` returns the payload and the caller
// (`routeViaAgent.ts` → `bot.ts`) still owns persistence, exactly as the old path did — the router
// decided, `processText` acted. Putting `applyCorrection` inside a tool would put a write behind a
// model's decision to call it, and behind Mastra's retry loop, where a retried call is a second
// write.

export interface SubmitCorrectionResult {
  analysis: z.infer<typeof MealAnalysisSchema>;
}

/**
 * Corrects the FOCUS meal — the one the user replied to. Carries a full replacement analysis, not
 * a delta: the old path returned `{intent:"correction", analysis}` and `applyCorrection` overwrote
 * the row's macros wholesale, so a partial payload would leave a meal half-corrected with no way to
 * tell which half.
 */
export const submitCorrectionTool = createTool({
  id: "submit_correction",
  description:
    "Call this exactly once, as the LAST step of the turn, ONLY when a focus meal was provided " +
    "and the user's message corrects that meal's estimate. Carries the FULL updated analysis, " +
    "not just the changed fields. The meal keeps its original date — use submit_redate to move it.",
  inputSchema: MealAnalysisSchema,
  execute: async (inputData): Promise<SubmitCorrectionResult> => ({ analysis: inputData }),
});

export interface SubmitRedateResult {
  dayOffset: number;
}

/**
 * Moves the focus meal to another day. Carries no analysis — macros are unchanged, which is the
 * whole distinction from a correction.
 */
export const submitRedateTool = createTool({
  id: "submit_redate",
  description:
    "Call this exactly once, as the LAST step of the turn, ONLY when a focus meal was provided " +
    'and the user asks to MOVE that meal to a different day ("move this to yesterday", "this was ' +
    '2 days ago") without changing what was eaten.',
  inputSchema: z.object({
    // Permissive-then-clamped for the reason spelled out in mealActions.ts: a strict number vetoes
    // the whole call over a null, and under Mastra that is a retry rather than a loud failure.
    dayOffset: z
      .unknown()
      .optional()
      .describe(
        `Whole days before today to file the meal under: 0 = today, 1 = yesterday, up to ${MAX_DAY_OFFSET}.`,
      ),
  }),
  execute: async (inputData): Promise<SubmitRedateResult> => {
    const clamped = clampDayOffset(inputData.dayOffset);
    // A redate with NO target ("move this back") would silently file the meal under today — a
    // no-op if it is already today, an unintended move otherwise. Warned, exactly as routeText
    // warns, so the operator sees the model under-specifying moves.
    if (inputData.dayOffset === undefined) {
      console.warn("[eait] submit_redate: no dayOffset given → defaulting to today (0)");
    } else if (inputData.dayOffset !== clamped) {
      console.warn(
        `[eait] submit_redate: dayOffset ${JSON.stringify(inputData.dayOffset)} out of contract → ${clamped}`,
      );
    }
    return { dayOffset: clamped };
  },
});

export interface AnswerQuestionResult {
  answer: string;
}

/**
 * The catch-all terminal tool: questions, chat, and anything that is not a meal action.
 *
 * `min(1)` after trimming, mirroring `routeText`'s "question intent without answer" throw. An empty
 * answer is not a cheap degradation — `processText` sends it straight to the user, so it would
 * surface as the bot replying with a blank message.
 */
export const answerQuestionTool = createTool({
  id: "answer_question",
  description:
    "Call this exactly once, as the LAST step of the turn, for a question, a comment, or any " +
    "message that is not food the user ate and not a change to an existing meal. Answer helpfully " +
    "and concisely from the diary context provided, in the user's language.",
  inputSchema: z.object({
    answer: z.string().trim().min(1).describe("The reply shown to the user, in their language."),
  }),
  execute: async (inputData): Promise<AnswerQuestionResult> => ({ answer: inputData.answer }),
});

export interface SubmitRestrictionsResult {
  tags: string[];
}

/**
 * The onboarding classifier's terminal tool — free-text restrictions onto the closed four-tag
 * vocabulary, for input the keyword pass in `targets.ts` could not match (typically because it is
 * in a language nobody wrote keywords for).
 *
 * The vocabulary is NOT enumerated in this schema, deliberately. `classifyRestrictions` accepted
 * `z.array(z.string())` and filtered the result through `isRestrictionTag` afterwards, so an
 * off-vocabulary tag was simply dropped and the good ones kept. A `z.enum` here would instead fail
 * the whole call and trigger a Mastra retry — turning "three good tags and one invented one" into
 * a round trip, and eventually into no tags at all on a path that runs once per user and cannot be
 * retried by them. The caller still filters; the description carries the vocabulary for the model.
 */
export const submitRestrictionsTool = createTool({
  id: "submit_restrictions",
  // Vocabulary derived from RESTRICTION_TAGS, never spelled out here: `targets.ts` owns the closed
  // set, and a hardcoded copy would keep advertising a tag that had been renamed or removed.
  description:
    "Call this exactly once to report which dietary/health restriction tags the user's free-text " +
    `answer maps onto. Use ONLY these tags: ${RESTRICTION_TAGS.join(", ")}. Use an empty array if ` +
    "the text matches none of them — do not stretch a tag to fit.",
  inputSchema: z.object({
    tags: z.array(z.string()).default([]).describe("Matching tags from the fixed vocabulary."),
  }),
  execute: async (inputData): Promise<SubmitRestrictionsResult> => ({ tags: inputData.tags }),
});
