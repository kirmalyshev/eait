import { describe, expect, test } from "bun:test";
import {
  ExpectationSchema,
  labelsAgree,
  nutrition5kRowToExpectation,
  nutritionverseRowToExpectation,
  pairFixtures,
  renderCoverage,
  renderReport,
  representativeRun,
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

describe("nutritionverseRowToExpectation", () => {
  // 13 dish-level fields, then 13 per ingredient. Real row shape from
  // nutritionverse_dish_metadata3.csv: dish_id, total_food_weight, total_calories, total_fats,
  // total_carbohydrates, total_protein, then micros, then the ingredient blocks.
  const ingredient = (name: string) => `,${name},156.0,95.7,0.33,22.8,0.5,0.01,0.0002,0.009,0.19,0.008,0.0,0.0`;
  const dish = (head: string, ingredients = 1) =>
    head + Array.from({ length: ingredients }, (_, i) => ingredient(`food-${i}`)).join("");

  test("maps the dish-level totals", () => {
    const { dishId, expectation } = nutritionverseRowToExpectation(
      dish("7,165.0,95.72999999999999,0.33359999999999995,22.7958,0.5048999999999999,0,0,0,0,0,0,0"),
    );
    expect(dishId).toBe("7");
    expect(expectation.kcal).toBe(96);
    expect(expectation.total_grams).toBe(165);
    expect(expectation.fat_g).toBe(0.3);
    expect(expectation.carbs_g).toBe(22.8);
    expect(expectation.protein_g).toBe(0.5);
  });

  test("mass and kcal are NOT in the Nutrition5k order", () => {
    // Nutrition5k is dish_id,kcal,mass,...; NutritionVerse is dish_id,MASS,kcal,... Reading one
    // with the other's field order yields a plausible dish (both are positive numbers in the same
    // rough range) whose every metric is wrong — no parse error anywhere. Pinned so a future
    // "shared CSV mapper" refactor cannot quietly merge the two.
    const { expectation } = nutritionverseRowToExpectation(dish("1,400,800,10,20,30,0,0,0,0,0,0,0"));
    expect(expectation.total_grams).toBe(400);
    expect(expectation.kcal).toBe(800);
  });

  test("accepts the full 1..7 ingredient range", () => {
    for (const n of [1, 4, 7]) {
      const row = dish("2,300,500,10,20,30,0,0,0,0,0,0,0", n);
      expect(nutritionverseRowToExpectation(row).expectation.kcal).toBe(500);
    }
  });

  test("rejects a row whose column count is not 13 + 13n", () => {
    // The failure this guards is column drift in a re-released CSV: shifted fields still parse as
    // numbers, so without a shape check every fixture silently becomes wrong ground truth.
    expect(() => nutritionverseRowToExpectation("1,400,800,10,20,30,0,0,0,0,0,0,0")).toThrow(/13/);
    expect(() => nutritionverseRowToExpectation(dish("1,400,800,10,20,30,0,0,0,0,0,0,0") + ",oops")).toThrow(/13/);
  });

  test("rejects a non-numeric or zero-mass row", () => {
    expect(() => nutritionverseRowToExpectation(dish("1,400,abc,10,20,30,0,0,0,0,0,0,0"))).toThrow();
    expect(() => nutritionverseRowToExpectation(dish("1,0,800,10,20,30,0,0,0,0,0,0,0"))).toThrow();
  });
});

describe("labelsAgree — the photo-vs-ground-truth gate for NutritionVerse", () => {
  // Measured against the real archive: image dish_N does map to CSV dish_id N (mean Jaccard 0.80
  // at offset 0 vs ~0.43 at ±1), but a handful of dishes carry a photo of an entirely different
  // meal. Those are the dangerous ones — plausible ground truth, wrong food, no error anywhere.

  test("keeps a dish whose photo and ground truth share a food", () => {
    expect(labelsAgree(["hamburger", "plain-toast"], ["hamburger", "plain-toast"])).toBe(true);
    expect(labelsAgree(["rib", "carrot"], ["rib", "rib", "carrot"])).toBe(true);
  });

  test("tolerates the two vocabularies naming the same food differently", () => {
    // The COCO categories and the CSV food_item_type columns are separate vocabularies. Rejecting
    // on exact-name mismatch would throw away ~7 good dishes for a naming suffix.
    expect(labelsAgree(["costco-cucumber-sushi-roll"], ["costco-cucumber-sushi-roll-1"])).toBe(true);
    expect(labelsAgree(["carrot", "chocolate-granola-bar"], ["nature-valley-granola-bar"])).toBe(true);
    expect(labelsAgree(["costco-salad-sushi-roll"], ["costco-california-sushi-roll-1"])).toBe(true);
  });

  test("REJECTS a dish whose photo is a different meal entirely", () => {
    // The three real offenders in the shipped archive. Each would contribute ground truth for food
    // that is not in the picture — the model would be scored as wrong for being right.
    expect(labelsAgree(["red-yellow-apple"], ["half-bread-loaf", "lobster"])).toBe(false);
    expect(labelsAgree(["asian-pear"], ["stack-of-tofu-4pc", "salad-chicken-strip"])).toBe(false);
    expect(
      labelsAgree(["half-minced-shrimp", "chicken-sandwich"], ["hamburger", "lamb-shank", "red-apple"]),
    ).toBe(false);
  });

  test("an empty side is not agreement — absent evidence must not admit the dish", () => {
    expect(labelsAgree([], ["hamburger"])).toBe(false);
    expect(labelsAgree(["hamburger"], [])).toBe(false);
  });

  test("ignores pure noise tokens that would make everything agree", () => {
    // Without a stop-list, shared filler ("of", "with", a bare digit) matches almost any pair.
    expect(labelsAgree(["stack-of-tofu-4pc"], ["bowl-of-rice"])).toBe(false);
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

const run = (kcal: number, extras: Partial<EvalRun> = {}): EvalRun => ({
  kcal,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  grams_total: 0,
  ...extras,
});

describe("representativeRun", () => {
  test("returns the median-kcal run for odd counts", () => {
    const mid = run(200, { grams_total: 50 });
    expect(representativeRun([run(300), mid, run(100)])).toBe(mid);
  });

  test("returns a REAL run (the lower middle) for even counts, never an average", () => {
    const lower = run(100, { grams_total: 10 });
    const rep = representativeRun([run(200, { grams_total: 20 }), lower]);
    expect(rep).toBe(lower); // identity, not a synthesized {kcal:150} object
  });

  test("throws on zero runs instead of returning undefined downstream", () => {
    expect(() => representativeRun([])).toThrow(/no runs/i);
  });

  test("does not mutate the caller's array", () => {
    const runs = [run(300), run(100), run(200)];
    representativeRun(runs);
    expect(runs.map((r) => r.kcal)).toEqual([300, 100, 200]);
  });
});

describe("summarize", () => {
  test("kcal MAE/MAPE over the representative run of each case", () => {
    const s = summarize([
      { expected: { kcal: 100 }, runs: [run(80), run(90), run(140)] }, // median 90 → err 10
      { expected: { kcal: 200 }, runs: [run(230)] }, // err 30
    ]);
    expect(s.cases).toBe(2);
    expect(s.kcal.mae).toBe(20); // (10+30)/2
    expect(s.kcal.mape).toBeCloseTo(12.5); // (10% + 15%)/2
  });

  test("spread averages only cases that HAVE ≥2 runs, and says how many those were", () => {
    // Averaging a single-run case's structural 0 into the spread would understate the real
    // disagreement — here it would report 20 for a model whose only measured spread was 40.
    const s = summarize([
      { expected: { kcal: 100 }, runs: [run(80), run(120)] }, // spread 40
      { expected: { kcal: 200 }, runs: [run(200)] }, // one run: no spread to measure
    ]);
    expect(s.kcal.spread).toEqual({ kcal: 40, cases: 1 });
  });

  test("spread is absent at one run per case — not a reproducibility claim from one sample", () => {
    // --runs 1 is the default, so this is the common path. "run spread 0" off a single sample
    // reads as "perfectly reproducible" when nothing about reproducibility was measured.
    const s = summarize([{ expected: { kcal: 100 }, runs: [run(80)] }]);
    expect(s.kcal.spread).toBeUndefined();
    expect(renderReport("m", s)).toContain("run spread n/a");
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

  test("throws on a case with zero runs rather than reporting NaN", () => {
    // median([]) used to be NaN and max(...[])-min(...[]) -Infinity, both printed as real numbers.
    expect(() => summarize([{ expected: { kcal: 100 }, runs: [] }])).toThrow(/no runs/i);
  });

  test("every case metric comes from ONE run — no field is ranked independently", () => {
    // The regression that motivated representativeRun. Ground truth 200 kcal / 100 g = 2.0 kcal/g.
    // Ranking each field on its own would take the median kcal (200, from run B) and the median
    // grams (100, from run C) and report a density of 2.0 — a PERFECT score, from three runs whose
    // real densities were 10.0, 0.2 and 3.0. Zero error must never be reportable that way.
    const s = summarize([
      {
        expected: { kcal: 200, total_grams: 100 },
        runs: [
          run(100, { grams_total: 10 }), // density 10.0
          run(200, { grams_total: 1000 }), // density 0.2  ← median kcal
          run(300, { grams_total: 100 }), // density 3.0
        ],
      },
    ]);
    // Representative = the median-kcal run, so grams 1000 and density 0.2 travel with kcal 200.
    expect(s.grams!.mape).toBeCloseTo(900); // 1000 g vs 100 g
    expect(s.decomp!.densityMape).toBeCloseTo(90); // 0.2 vs 2.0
    expect(s.decomp!.densityMape).not.toBe(0); // the bug reported exactly 0 here
  });
});

describe("summarize — signed bias", () => {
  // MAE/MAPE are absolute: a model that is 30% high on every meal and one that scatters ±30%
  // score identically, yet the first is fixable with one prompt line and the second is not.
  // Bias is the geometric mean of est/true, minus 1, as a percent. RECIPROCAL errors cancel —
  // 2x and 0.5x give 0. Symmetric-looking percentages do not: +30% and -30% are ratios 1.3 and
  // 0.7, whose geometric mean is -4.6%.

  test("symmetric errors cancel — zero bias, half over", () => {
    // Also the test that discriminates the estimator: the ARITHMETIC mean of the ratios would
    // report (2 + 0.5)/2 = 1.25 → +25%. Only the geometric mean gives 0.
    const s = summarize([
      { expected: { kcal: 100 }, runs: [run(200)] }, // 2x over
      { expected: { kcal: 100 }, runs: [run(50)] }, // 2x under
    ]);
    expect(s.kcal.mape).toBeCloseTo(75); // absolute error is large...
    expect(s.kcal.bias!.pct).toBeCloseTo(0); // ...but there is no systematic direction
    expect(s.kcal.over!.pct).toBe(50);
  });

  test("a uniformly high model reports its exact multiplicative bias", () => {
    const s = summarize([
      { expected: { kcal: 100 }, runs: [run(150)] },
      { expected: { kcal: 400 }, runs: [run(600)] },
    ]);
    expect(s.kcal.bias!.pct).toBeCloseTo(50); // every meal 1.5x
    expect(s.kcal.over!.pct).toBe(100);
  });

  test("bias is negative when the model under-estimates", () => {
    const s = summarize([{ expected: { kcal: 100 }, runs: [run(50)] }]);
    expect(s.kcal.bias!.pct).toBeCloseTo(-50);
    expect(s.kcal.over!.pct).toBe(0);
  });

  test("bias carries its own case count — it can cover fewer cases than MAPE", () => {
    // A zero estimate has no log ratio, so bias drops it while MAPE keeps it. Printing the two
    // side by side without denominators is how a report misleads.
    const s = summarize([
      { expected: { kcal: 100 }, runs: [run(200)] },
      { expected: { kcal: 100 }, runs: [run(0)] }, // no log ratio
    ]);
    expect(s.cases).toBe(2);
    expect(s.kcal.bias!.cases).toBe(1);
  });

  test("an exact hit is neither over nor under — it leaves the over/under denominator", () => {
    // Counting a perfect estimate as "not over" would drag the number below the 50% baseline and
    // read as a systematic under-estimate that isn't there.
    const s = summarize([
      { expected: { kcal: 100 }, runs: [run(150)] }, // over
      { expected: { kcal: 100 }, runs: [run(100)] }, // exact
    ]);
    expect(s.kcal.over).toEqual({ pct: 100, cases: 1 });
  });

  test("every case an exact hit → over is absent, not a misleading 0%", () => {
    const s = summarize([{ expected: { kcal: 100 }, runs: [run(100)] }]);
    expect(s.kcal.over).toBeUndefined();
    expect(s.kcal.bias!.pct).toBeCloseTo(0);
  });

  test("a zero kcal estimate has no log ratio — bias is omitted, never reported as unbiased", () => {
    const s = summarize([{ expected: { kcal: 100 }, runs: [run(0)] }]);
    expect(s.kcal.bias).toBeUndefined();
    expect(s.kcal.mape).toBeCloseTo(100); // the absolute metrics still cover the case
  });

  test("signed decomposition attributes the direction to grams or density", () => {
    // Pure density over-estimate: portion right, richness 1.6x high.
    const dense = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(800, { grams_total: 250 })] },
    ]);
    expect(dense.decomp!.gramsBias!.pct).toBeCloseTo(0);
    expect(dense.decomp!.densityBias!.pct).toBeCloseTo(60);

    // Pure portion over-estimate: richness right, grams 1.6x high.
    const big = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(800, { grams_total: 400 })] },
    ]);
    expect(big.decomp!.gramsBias!.pct).toBeCloseTo(60);
    expect(big.decomp!.densityBias!.pct).toBeCloseTo(0);
  });

  test("component bias is geometric too — a 2x over and a 2x under portion cancel", () => {
    // Guards the estimator on the DECOMPOSITION side: the arithmetic mean of the ratios would
    // report +25% portion bias for a model whose portion errors cancel exactly.
    const s = summarize([
      { expected: { kcal: 200, total_grams: 100 }, runs: [run(400, { grams_total: 200 })] },
      { expected: { kcal: 400, total_grams: 200 }, runs: [run(200, { grams_total: 100 })] },
    ]);
    expect(s.decomp!.cases).toBe(2);
    expect(s.decomp!.gramsBias!.pct).toBeCloseTo(0);
    expect(s.decomp!.densityBias!.pct).toBeCloseTo(0);
  });

  test("grams under + density over hides inside a ZERO kcal bias", () => {
    // 200 g true @ 2 kcal/g = 400 kcal. Model: 100 g @ 4 kcal/g = 400 kcal — the kcal error is
    // exactly 0, yet both components are 2x wrong in opposite directions. The absolute KCAL
    // metrics see nothing (MAE 0); grams MAPE 50% and density MAPE 100% do flag it. What the
    // signed split adds is WHICH WAY each component errs.
    const s = summarize([
      { expected: { kcal: 400, total_grams: 200 }, runs: [run(400, { grams_total: 100 })] },
    ]);
    expect(s.kcal.mae).toBe(0); // the kcal metrics are blind to it
    expect(s.kcal.bias!.pct).toBeCloseTo(0);
    expect(s.grams!.mape).toBeCloseTo(50); // the component metrics are not
    expect(s.decomp!.densityMape).toBeCloseTo(100);
    expect(s.decomp!.gramsBias!.pct).toBeCloseTo(-50); // half the true weight
    expect(s.decomp!.densityBias!.pct).toBeCloseTo(100); // twice the true richness
  });

  test("the two decomposition biases always cover the same cases", () => {
    // They are printed as a two-way split of one error budget, so different denominators would
    // make the split incoherent. A zero-kcal run drops out of BOTH, not just density.
    const s = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(0, { grams_total: 500 })] },
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(600, { grams_total: 300 })] },
    ]);
    expect(s.decomp!.gramsBias!.cases).toBe(s.decomp!.densityBias!.cases);
    expect(s.decomp!.gramsBias!.cases).toBe(1);
  });
});

describe("summarize — grams vs density decomposition", () => {
  // kcal = grams × density, so every kcal error carries a portion component and a richness
  // component — usually both, sometimes in opposite directions, occasionally cancelling exactly.
  // A density-dominated split is the evidence #8 (DB grounding) is gated on; the portion side is
  // now #31 (measuring the shipped side-view gain), not #11, which shipped 2026-07-24.

  test("pure density error: right grams, wrong kcal/g", () => {
    // true 500 kcal @ 250 g = 2.0 kcal/g; model says 800 kcal @ 250 g = 3.2 kcal/g
    const s = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(800, { grams_total: 250 })] },
    ]);
    expect(s.grams!.mape).toBeCloseTo(0); // portion is spot on
    expect(s.decomp!.densityMape).toBeCloseTo(60); // all the error is richness
    expect(s.decomp!.gramsSharePct).toBeCloseTo(0); // none of the magnitude is portion
    expect(s.decomp!.gramsDominated).toEqual({ pct: 0, cases: 1 }); // density-dominated
    // Pinned by value, not just relative order: a swap of the two fields must fail here.
    expect(s.decomp!.gramsLogMae).toBe(0);
    expect(s.decomp!.densityLogMae).toBeCloseTo(Math.log(1.6), 10);
  });

  test("pure grams error: right kcal/g, wrong portion", () => {
    // true 500 kcal @ 250 g = 2.0 kcal/g; model 800 kcal @ 400 g = 2.0 kcal/g (density identical)
    const s = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(800, { grams_total: 400 })] },
    ]);
    expect(s.grams!.mape).toBeCloseTo(60); // portion is 60% high
    expect(s.decomp!.densityMape).toBeCloseTo(0); // richness is spot on
    expect(s.decomp!.gramsSharePct).toBeCloseTo(100);
    expect(s.decomp!.gramsDominated).toEqual({ pct: 100, cases: 1 });
    expect(s.decomp!.gramsLogMae).toBeCloseTo(Math.log(1.6), 10);
    expect(s.decomp!.densityLogMae).toBe(0);
  });

  test("decomp aggregates over only the DECOMPOSABLE cases, not all cases", () => {
    // The denominator matters: 1 of 2 decomposable is 50%, 1 of 3 total would be 33%. Every
    // single-case test would pass under either, which is why this one is multi-case.
    const s = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(800, { grams_total: 400 })] }, // grams
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(800, { grams_total: 250 })] }, // density
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(800, { grams_total: 0 })] }, // dropped
    ]);
    expect(s.cases).toBe(3);
    expect(s.grams!.cases).toBe(3); // portion MAPE keeps the zero-gram case
    expect(s.decomp!.cases).toBe(2); // the decomposition cannot
    expect(s.decomp!.gramsDominated).toEqual({ pct: 50, cases: 2 });
  });

  test("decomp is omitted when no case declares total_grams (density needs grams)", () => {
    const s = summarize([{ expected: { kcal: 500 }, runs: [run(800)] }]);
    expect(s.decomp).toBeUndefined();
  });

  test("a zero-grams run (empty model output) is excluded from decomp, not divided by zero", () => {
    const s = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(800, { grams_total: 0 })] },
    ]);
    expect(s.decomp).toBeUndefined(); // the only case was undecomposable → no decomp block
  });

  test("a zero-kcal run is excluded too — ln(0) would be -Infinity", () => {
    // A plausible model answer for water or black coffee. Without the guard densityLogMae becomes
    // Infinity and destroys the mean for EVERY other case in the same run.
    const s = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(0, { grams_total: 250 })] },
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(600, { grams_total: 300 })] },
    ]);
    expect(s.decomp!.cases).toBe(1);
    expect(Number.isFinite(s.decomp!.densityLogMae)).toBe(true);
    expect(Number.isFinite(s.decomp!.gramsLogMae)).toBe(true);
  });

  test("an exact hit is not evidence for either lever", () => {
    // Both components are 0, so neither dominates. Counting the tie as grams would mean a model
    // that got everything right votes for portion technique — and votes harder as it improves.
    const s = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(500, { grams_total: 250 })] },
    ]);
    expect(s.decomp!.gramsDominated).toBeUndefined();
    expect(s.decomp!.gramsSharePct).toBe(50); // no error to apportion
  });

  test("the exact mirror-error case ties and is excluded from the vote", () => {
    // 2x under on grams, 2x over on density: |ln 0.5| === |ln 2| exactly in IEEE, so this is a
    // hard tie, not a floating-point near-miss. It used to be attributed to grams.
    const s = summarize([
      { expected: { kcal: 400, total_grams: 200 }, runs: [run(400, { grams_total: 100 })] },
    ]);
    expect(s.decomp!.gramsDominated).toBeUndefined();
    expect(s.decomp!.gramsSharePct).toBeCloseTo(50); // equal magnitudes, equal share
  });

  test("magnitude share and per-case vote can disagree — both are reported", () => {
    // Two mildly grams-driven cases outvote one badly density-driven case, but the density case
    // carries most of the actual error. The share answers "which lever is bigger"; the vote
    // answers "how often". A reader given only the vote would pick the wrong lever.
    const s = summarize([
      { expected: { kcal: 200, total_grams: 100 }, runs: [run(210, { grams_total: 105 })] },
      { expected: { kcal: 200, total_grams: 100 }, runs: [run(210, { grams_total: 105 })] },
      { expected: { kcal: 200, total_grams: 100 }, runs: [run(400, { grams_total: 100 })] },
    ]);
    expect(s.decomp!.gramsDominated!.pct).toBeCloseTo(66.7, 0); // grams wins the vote
    expect(s.decomp!.gramsSharePct).toBeLessThan(20); // density carries the magnitude
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

  test("a negative bias renders with its minus sign", () => {
    // A bias printed without its sign is worse than not printing it: it inverts the conclusion.
    const s = summarize([{ expected: { kcal: 100 }, runs: [run(50)] }]);
    expect(renderReport("m", s)).toContain("BIAS -50%");
  });

  test("a positive bias renders with an explicit plus", () => {
    const s = summarize([{ expected: { kcal: 100 }, runs: [run(150)] }]);
    expect(renderReport("m", s)).toContain("BIAS +50%");
  });

  test("every partial-coverage number prints its own denominator", () => {
    const s = summarize([
      { expected: { kcal: 100 }, runs: [run(0)] }, // in MAPE, out of bias
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(800, { grams_total: 400 })] },
    ]);
    const out = renderReport("m", s);
    expect(out).toContain("(2 cases)"); // the model header covers both
    expect(out).toMatch(/BIAS [+-][\d.]+% \(1 case\)/); // bias covers only one, singular
  });

  test("an unknown bias renders as n/a — it never suppresses the line or reads as zero", () => {
    const s = summarize([{ expected: { kcal: 100 }, runs: [run(0)] }]);
    const out = renderReport("m", s);
    expect(out).toContain("BIAS n/a");
    expect(out).not.toMatch(/BIAS [+-]?0%/);
  });

  test("renders every decomposition line", () => {
    // Without this, deleting the whole decomp block, or relabelling grams as density, is invisible.
    const s = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(800, { grams_total: 250 })] },
    ]);
    const out = renderReport("m", s);
    expect(out).toContain("density MAPE 60.0% (1 case)"); // float, so one decimal place
    expect(out).toContain("grams |ln| 0 vs density |ln| 0.5");
    expect(out).toContain("0% of the error magnitude is grams");
    expect(out).toContain("grams-dominated in 0% of 1 case");
    expect(out).toContain("bias direction: portion 0% · richness +60%");
  });

  test("renders the signed portion/richness split when both are known", () => {
    const s = summarize([
      { expected: { kcal: 400, total_grams: 200 }, runs: [run(400, { grams_total: 100 })] },
    ]);
    const out = renderReport("m", s);
    expect(out).toContain("portion -50%");
    expect(out).toContain("richness +100%");
  });

  test("says so explicitly when no case strictly dominated, rather than going quiet", () => {
    const s = summarize([
      { expected: { kcal: 500, total_grams: 250 }, runs: [run(500, { grams_total: 250 })] },
    ]);
    const out = renderReport("m", s);
    expect(out).not.toMatch(/grams-dominated in/);
    expect(out).toContain("no case strictly dominated");
  });
});

describe("renderCoverage", () => {
  // The report is the artifact that gets archived and pasted into an issue. Exclusions announced
  // only on stderr disappear the moment anyone redirects stdout to a file.

  test("a complete run states its completeness and adds no warning", () => {
    const out = renderCoverage({
      fixtures: 30, evaluated: 30, refused: 0, failed: 0, runsRequested: 30, runsCompleted: 30,
    });
    expect(out).toContain("30/30 fixtures evaluated");
    expect(out).toContain("runs 30/30");
    expect(out).not.toMatch(/WARNING/);
  });

  test("refusals are counted apart from failures — one is an accuracy result", () => {
    const out = renderCoverage({
      fixtures: 30, evaluated: 20, refused: 7, failed: 3, runsRequested: 30, runsCompleted: 20,
    });
    expect(out).toContain("20/30 fixtures evaluated");
    expect(out).toContain("7 refused (isFood=false)");
    expect(out).toContain("3 all-runs-failed");
  });

  test("partial coverage warns that the numbers are not cross-model comparable", () => {
    // The dropped cases are the ambiguous photos, so a model that refuses more scores better on
    // what remains. A reader comparing two evaluated counts must be told before they do it.
    const out = renderCoverage({
      fixtures: 30, evaluated: 22, refused: 8, failed: 0, runsRequested: 30, runsCompleted: 22,
    });
    expect(out).toMatch(/WARNING/);
    expect(out).toMatch(/not comparable/);
  });

  test("thinned runs warn even when every case survived", () => {
    // 3 runs requested per case, some failed: the case count is unchanged, so this exclusion is
    // invisible unless the run tally is reported.
    const out = renderCoverage({
      fixtures: 30, evaluated: 30, refused: 0, failed: 0, runsRequested: 90, runsCompleted: 62,
    });
    expect(out).toContain("runs 62/90");
    expect(out).toMatch(/WARNING/);
  });
});
