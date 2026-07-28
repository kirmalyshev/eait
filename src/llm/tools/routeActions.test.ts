import { describe, expect, test } from "bun:test";
import {
  answerQuestionTool, submitCorrectionTool, submitRedateTool,
  type AnswerQuestionResult, type SubmitRedateResult,
} from "./routeActions.ts";
import { MAX_DAY_OFFSET } from "../../analyzer.ts";

const VALID_MEAL = {
  isFood: true,
  items: [{ name: "banana", grams: 120, name_en: "banana" }],
  kcal: 107, protein_g: 1.3, carbs_g: 27, fat_g: 0.4,
  satfat_g: 0.1, fiber_g: 3.1, sugar_g: 14, sodium_mg: 1,
  plant_protein_pct: 0, verdicts: {}, confidence: "high", notes: "",
};

/** Validate then execute, the way Mastra does. */
async function run<T>(tool: { inputSchema?: unknown; execute?: unknown }, payload: unknown): Promise<T> {
  const schema = (tool as { inputSchema: { "~standard": { validate(v: unknown): Promise<{ issues?: unknown; value?: unknown }> } } }).inputSchema;
  const validation = await schema["~standard"].validate(payload);
  if (validation.issues) throw new Error(`invalid: ${JSON.stringify(validation.issues)}`);
  const execute = tool.execute as (v: unknown, c: unknown) => Promise<T>;
  return execute(validation.value, {});
}

describe("submit_correction", () => {
  test("carries the full replacement analysis", async () => {
    const out = await run<{ analysis: { kcal: number } }>(submitCorrectionTool, VALID_MEAL);
    expect(out.analysis.kcal).toBe(107);
  });

  test("a partial analysis DEFAULTS the omitted fields rather than being rejected", async () => {
    // Documenting shipped behaviour, not endorsing it. Every field of MealAnalysisSchema except
    // `isFood` carries a `.default()`, and `RouteSchema.analysis` used that same schema — so a
    // partial correction was already accepted and zero-filled on the old path, and
    // `applyCorrection` then wrote those zeros over the meal's real macros. Sharp, pre-existing,
    // and deliberately NOT changed here: a transport migration that also tightened a schema would
    // make any behaviour difference impossible to attribute.
    const out = await run<{ analysis: { kcal: number; protein_g: number } }>(submitCorrectionTool, {
      isFood: true, kcal: 200,
    });
    expect(out.analysis.kcal).toBe(200);
    expect(out.analysis.protein_g).toBe(0);
  });

  test("isFood is the one field with no default — a correction must state it", async () => {
    await expect(run(submitCorrectionTool, { kcal: 200 })).rejects.toThrow(/invalid/);
  });

  test("carries no dayOffset — a correction never moves a meal", async () => {
    // The distinction the router exists to make. `applyCorrection` never touches `date`; moving a
    // meal is submit_redate's job, and a correction that could also re-date would give the model
    // two ways to do one thing and no way for the caller to tell which it meant.
    const out = await run<{ analysis: Record<string, unknown> }>(submitCorrectionTool, {
      ...VALID_MEAL, dayOffset: 3,
    });
    expect(out.analysis).not.toHaveProperty("dayOffset");
  });
});

describe("submit_redate", () => {
  test.each([
    ["in range", 2, 2],
    ["above the window", 99, MAX_DAY_OFFSET],
    ["null", null, 0],
    ["absent", undefined, 0],
  ])("clamps a dayOffset %s", async (_label, sent, expected) => {
    const payload = sent === undefined ? {} : { dayOffset: sent };
    expect((await run<SubmitRedateResult>(submitRedateTool, payload)).dayOffset).toBe(expected);
  });

  test("carries no analysis — a redate leaves macros untouched", async () => {
    const out = await run<Record<string, unknown>>(submitRedateTool, { dayOffset: 1, ...VALID_MEAL });
    expect(out).toEqual({ dayOffset: 1 });
  });
});

describe("answer_question", () => {
  test("returns the answer", async () => {
    expect((await run<AnswerQuestionResult>(answerQuestionTool, { answer: "About 600 kcal." })).answer)
      .toBe("About 600 kcal.");
  });

  test("an empty or whitespace answer is rejected, not sent as a blank message", async () => {
    // processText sends this straight to the user. `routeText` threw on it for the same reason.
    await expect(run(answerQuestionTool, { answer: "   " })).rejects.toThrow(/invalid/);
    await expect(run(answerQuestionTool, { answer: "" })).rejects.toThrow(/invalid/);
  });

  test("trims, so a padded answer is not sent with leading blank lines", async () => {
    expect((await run<AnswerQuestionResult>(answerQuestionTool, { answer: "  hi  " })).answer).toBe("hi");
  });
});
