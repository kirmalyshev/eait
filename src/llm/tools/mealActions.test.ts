import { describe, expect, test } from "bun:test";
import { submitMealTool, type SubmitMealResult } from "./mealActions.ts";
import { MAX_DAY_OFFSET } from "../../analyzer.ts";

const VALID_MEAL = {
  isFood: true,
  items: [{ name: "banana", grams: 120, name_en: "banana" }],
  kcal: 107,
  protein_g: 1.3,
  carbs_g: 27,
  fat_g: 0.4,
  satfat_g: 0.1,
  fiber_g: 3.1,
  sugar_g: 14,
  sodium_mg: 1,
  plant_protein_pct: 0,
  verdicts: {},
  confidence: "high",
  notes: "",
};

describe("submitMealTool", () => {
  test("accepts a valid meal payload and separates analysis from dayOffset", async () => {
    // Standard Schema v1: inputSchema["~standard"].validate returns Result<T> with either {value} or {issues}
    const inputSchema = submitMealTool.inputSchema!;
    const validation = await inputSchema["~standard"].validate({ ...VALID_MEAL, dayOffset: 1 });
    if (validation.issues) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.issues)}`);
    }
    const input = validation.value;

    const execute = submitMealTool.execute!;
    const stubContext = {} as Parameters<typeof execute>[1];
    const result = (await execute(input, stubContext)) as SubmitMealResult;

    expect(result.dayOffset).toBe(1);
    expect(result.analysis.items[0].name).toBe("banana");
    expect(result.analysis).not.toHaveProperty("dayOffset");
  });

  /** Validate then execute, the way Mastra does — the clamp lives in `execute`, not the schema. */
  async function submit(payload: unknown): Promise<SubmitMealResult> {
    const validation = await submitMealTool.inputSchema!["~standard"].validate(payload);
    if (validation.issues) {
      throw new Error(`Validation failed: ${JSON.stringify(validation.issues)}`);
    }
    const execute = submitMealTool.execute!;
    return (await execute(validation.value, {} as Parameters<typeof execute>[1])) as SubmitMealResult;
  }

  // These four replace two earlier tests that asserted the OPPOSITE — that an out-of-contract or
  // missing dayOffset is REJECTED. That contract was wrong, and wrong in a way that loses data.
  // `RouteSchema` on the shipped path types dayOffset as `z.unknown().optional()` and clamps,
  // with a comment saying why: models commonly emit `null` for same-day. Rejecting the call does
  // not get a better date — Mastra hands the model an error and asks it to retry, and a model that
  // keeps emitting null exhausts maxSteps, so a fully correct meal analysis is DISCARDED over its
  // date field. Clamping keeps the meal and files it under today, exactly as the old path does.
  test.each([
    ["above the window", 99, MAX_DAY_OFFSET],
    ["null — the value models emit for same-day", null, 0],
    ["a stringy number", "1", 0],
    ["fractional", 2.5, 2],
  ])("clamps a dayOffset %s rather than losing the meal", async (_label, sent, expected) => {
    const result = await submit({ ...VALID_MEAL, dayOffset: sent });
    expect(result.dayOffset).toBe(expected);
    // The point of clamping instead of rejecting: the analysis survives.
    expect(result.analysis.items[0].name).toBe("banana");
  });

  test("a missing dayOffset means today, not a rejected meal", async () => {
    const result = await submit(VALID_MEAL);
    expect(result.dayOffset).toBe(0);
    expect(result.analysis.kcal).toBe(107);
  });
});
