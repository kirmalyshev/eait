import { describe, expect, test } from "bun:test";
import {
  ExpectationSchema,
  median,
  nutrition5kRowToExpectation,
  pairFixtures,
  renderReport,
  summarize,
  type EvalRun,
} from "./eval.ts";

describe("ExpectationSchema", () => {
  test("kcal is required; macros and total_grams optional", () => {
    expect(ExpectationSchema.safeParse({ kcal: 620 }).success).toBe(true);
    expect(ExpectationSchema.safeParse({}).success).toBe(false);
    const full = ExpectationSchema.safeParse({
      kcal: 620, protein_g: 40, carbs_g: 55, fat_g: 20, total_grams: 340,
    });
    expect(full.success).toBe(true);
  });

  test("rejects non-positive kcal — a zero expectation breaks MAPE and is always a typo", () => {
    expect(ExpectationSchema.safeParse({ kcal: 0 }).success).toBe(false);
    expect(ExpectationSchema.safeParse({ kcal: -100 }).success).toBe(false);
  });
});

describe("nutrition5kRowToExpectation", () => {
  // A real dish_metadata_cafe1.csv line: 6 dish-level fields, then repeating ingredient
  // fields the eval ignores. The real CSV has NO num_ingrs column — ingredients begin at
  // field 7 (an ingr_id), so the mapper reads fields 1–6 only.
  const REAL_ROW =
    "dish_1561662216,300.794281,193.000000,12.387489,28.218290,18.633970," +
    "ingr_0000000508,egg,50.0,72.0,4.8,0.4,6.3";

  test("maps the six dish-level fields; rounds kcal to int, macros/grams to 1dp", () => {
    expect(nutrition5kRowToExpectation(REAL_ROW)).toEqual({
      dishId: "dish_1561662216",
      expectation: { kcal: 301, total_grams: 193, fat_g: 12.4, carbs_g: 28.2, protein_g: 18.6 },
    });
  });

  test("ignores trailing ingredient columns entirely", () => {
    // Same six numbers, zero ingredient fields → identical expectation.
    const bare = "dish_x,300.794281,193.0,12.387489,28.21829,18.63397";
    expect(nutrition5kRowToExpectation(bare).expectation).toEqual(
      nutrition5kRowToExpectation(REAL_ROW).expectation,
    );
  });

  test("throws on a short row rather than emitting NaN ground truth", () => {
    expect(() => nutrition5kRowToExpectation("dish_x,100,200,3")).toThrow(/fields/i);
  });

  test("rejects a non-numeric / non-positive dish via the schema (garbage line)", () => {
    // kcal=0 → ExpectationSchema.positive() rejects; a zeroed row would poison MAPE.
    expect(() => nutrition5kRowToExpectation("dish_x,0,200,3,4,5")).toThrow();
    expect(() => nutrition5kRowToExpectation("dish_x,abc,200,3,4,5")).toThrow();
  });
});

describe("pairFixtures", () => {
  test("pairs image files with same-stem json and reports orphans", () => {
    const { cases, orphans } = pairFixtures([
      "borscht.jpg", "borscht.json",
      "pasta.jpeg", "pasta.json",
      "salad.png", // image without expectation
      "ghost.json", // expectation without image
      ".DS_Store", "notes.txt", // noise is ignored entirely
    ]);
    expect(cases).toEqual([
      { name: "borscht", image: "borscht.jpg", expectation: "borscht.json" },
      { name: "pasta", image: "pasta.jpeg", expectation: "pasta.json" },
    ]);
    expect(orphans.sort()).toEqual(["ghost.json", "salad.png"]);
  });
});

describe("median", () => {
  test("odd and even counts", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([7])).toBe(7);
  });
});

const run = (kcal: number, extras: Partial<EvalRun> = {}): EvalRun => ({
  kcal,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  grams_total: 0,
  ...extras,
});

describe("summarize", () => {
  test("kcal MAE/MAPE over the median of each case's runs", () => {
    const s = summarize([
      { expected: { kcal: 100 }, runs: [run(80), run(90), run(140)] }, // median 90 → err 10
      { expected: { kcal: 200 }, runs: [run(230)] }, // err 30
    ]);
    expect(s.cases).toBe(2);
    expect(s.kcal.mae).toBe(20); // (10+30)/2
    expect(s.kcal.mape).toBeCloseTo(12.5); // (10% + 15%)/2
  });

  test("spread = mean per-case (max-min) across runs, 0 for single runs", () => {
    const s = summarize([
      { expected: { kcal: 100 }, runs: [run(80), run(120)] }, // spread 40
      { expected: { kcal: 200 }, runs: [run(200)] }, // spread 0
    ]);
    expect(s.kcal.spread).toBe(20);
  });

  test("macro MAE computed only over cases that declare the macro", () => {
    const s = summarize([
      { expected: { kcal: 100, protein_g: 30 }, runs: [run(100, { protein_g: 25 })] },
      { expected: { kcal: 100 }, runs: [run(100, { protein_g: 999 })] }, // undeclared → excluded
    ]);
    expect(s.protein_g).toEqual({ mae: 5, cases: 1 });
    expect(s.carbs_g).toBeUndefined(); // no case declared carbs
  });

  test("grams MAPE against declared total_grams", () => {
    const s = summarize([
      { expected: { kcal: 100, total_grams: 400 }, runs: [run(100, { grams_total: 300 })] },
    ]);
    expect(s.grams).toEqual({ mape: 25, cases: 1 });
  });

  test("throws on zero cases rather than reporting a vacuous perfect score", () => {
    expect(() => summarize([])).toThrow(/no cases/i);
  });
});

describe("renderReport", () => {
  test("renders model name and headline numbers", () => {
    const s = summarize([{ expected: { kcal: 100, protein_g: 30 }, runs: [run(90, { protein_g: 25 })] }]);
    const out = renderReport("x-ai/grok-4.5", s);
    expect(out).toContain("x-ai/grok-4.5");
    expect(out).toContain("10"); // kcal MAE
    expect(out).toMatch(/protein/i);
  });
});
