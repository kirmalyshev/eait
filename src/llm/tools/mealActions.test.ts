import { describe, expect, test } from "bun:test";
import { submitMealTool, type SubmitMealResult } from "./mealActions.ts";
import type { z } from "zod";

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
    // inputSchema has .parse at runtime (StandardSchemaWithJSON is Zod-compatible)
    const input = (submitMealTool.inputSchema as unknown as z.ZodSchema).parse({ ...VALID_MEAL, dayOffset: 1 });
    const stubContext = {};
    const result = (await (submitMealTool.execute as unknown as (input: unknown, context: unknown) => Promise<SubmitMealResult>)(input, stubContext)) as SubmitMealResult;

    expect(result.dayOffset).toBe(1);
    expect(result.analysis.items[0].name).toBe("banana");
    expect(result.analysis).not.toHaveProperty("dayOffset");
  });

  test("rejects a dayOffset outside [0, MAX_DAY_OFFSET]", () => {
    expect(() => (submitMealTool.inputSchema as unknown as z.ZodSchema).parse({ ...VALID_MEAL, dayOffset: 99 })).toThrow();
  });

  test("rejects a missing dayOffset — the model must always state which day", () => {
    expect(() => (submitMealTool.inputSchema as unknown as z.ZodSchema).parse(VALID_MEAL)).toThrow();
  });
});
