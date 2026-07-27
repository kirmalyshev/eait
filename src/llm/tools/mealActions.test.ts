import { describe, expect, test } from "bun:test";
import { submitMealTool, type SubmitMealResult } from "./mealActions.ts";

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

  test("rejects a dayOffset outside [0, MAX_DAY_OFFSET]", async () => {
    const inputSchema = submitMealTool.inputSchema!;
    const validation = await inputSchema["~standard"].validate({ ...VALID_MEAL, dayOffset: 99 });
    expect(validation.issues).toBeDefined();
    expect(validation.issues?.length).toBeGreaterThan(0);
  });

  test("rejects a missing dayOffset — the model must always state which day", async () => {
    const inputSchema = submitMealTool.inputSchema!;
    const validation = await inputSchema["~standard"].validate(VALID_MEAL);
    expect(validation.issues).toBeDefined();
    expect(validation.issues?.length).toBeGreaterThan(0);
  });
});
