// The seam between what a model answered and what the engine may store.
//
// The defect this exists for: a model that lists the items correctly and then writes a total that
// is not their sum. The user sees a card whose rows add up to one number and whose header says
// another, and the diary agrees with the header. The items are the working the model showed, so
// the header is their sum — always, and the tolerance decides only what the card says about it.

import { describe, expect, test } from "bun:test";
import type { AnalyzedMeal } from "../llm/port.ts";
import { prepareAnalysis } from "./analysis.ts";

/** One item worth `kcal`, with macros that are its own and nothing else's. */
const item = (kcal: number, over: Partial<AnalyzedMeal["items"][number]> = {}) => ({
  name: "Something", grams: 100, kcal,
  protein_g: kcal / 10, carbs_g: kcal / 5, fat_g: kcal / 20,
  kcal_per_100g: kcal, ...over,
});

/** A plate whose items sum to 400 kcal, 40 g protein, 80 g carbs, 20 g fat. */
const plate = (over: Partial<AnalyzedMeal> = {}): AnalyzedMeal => ({
  isFood: true,
  items: [item(300), item(100)],
  kcal: 400, protein_g: 40, carbs_g: 80, fat_g: 20,
  satfat_g: 6, fiber_g: 7, sugar_g: 8, sodium_mg: 900,
  confidence: "high", notes: "",
  ...over,
});

describe("reconciling totals against the items", () => {
  test("the totals are the sum of the items, whatever the model wrote", () => {
    const { analysis } = prepareAnalysis(plate({ kcal: 500 }));
    expect(analysis.kcal).toBe(400);
    expect(analysis.protein_g).toBe(40);
    expect(analysis.carbs_g).toBe(80);
    expect(analysis.fat_g).toBe(20);
  });

  test("a total inside the tolerance is summed too, and keeps its confidence", () => {
    // 50 kcal out over a 400 kcal plate is inside 15%. The header is still the rows — there is only
    // ever one number on the card — but a gap this size is not worth saying anything about.
    const { analysis } = prepareAnalysis(plate({ kcal: 450, confidence: "medium" }));
    expect(analysis.kcal).toBe(400);
    expect(analysis.confidence).toBe("medium");
  });

  test("a total outside the tolerance costs the analysis a step of confidence", () => {
    // It was wrong about something it could check itself. The card says "rough estimate" louder and
    // the correction nudge gets louder with it — which is the whole point of the field.
    for (const [before, after] of [["high", "medium"], ["medium", "low"], ["low", "low"]] as const) {
      const { analysis } = prepareAnalysis(plate({ kcal: 500, confidence: before }));
      expect(analysis.kcal).toBe(400);
      expect(analysis.confidence).toBe(after);
    }
  });

  test("exactly at the tolerance is not yet disagreement", () => {
    const { analysis } = prepareAnalysis(plate({ kcal: 460 }));
    expect(analysis.kcal).toBe(400);
    expect(analysis.confidence).toBe("high");
  });

  test("the four totals with no per-item field are never touched", () => {
    // satfat, fibre, sugar and sodium have no per-item counterpart, so there is nothing to sum them
    // from. Replacing them with a zero would be the reconciler inventing a number.
    const { analysis } = prepareAnalysis(plate({ kcal: 500 }));
    expect([analysis.satfat_g, analysis.fiber_g, analysis.sugar_g, analysis.sodium_mg])
      .toEqual([6, 7, 8, 900]);
  });

  test("small plates get a floor, not a percentage", () => {
    // 15% of a 40 kcal snack is 6 kcal, which is inside the noise of any estimate of anything. A
    // percentage alone would downgrade the confidence of a plate nobody got wrong.
    const snack = { items: [item(40)], protein_g: 4, carbs_g: 8, fat_g: 2 };
    const at = (kcal: number) => prepareAnalysis(plate({ ...snack, kcal })).analysis;
    // The total is the row either way; what the floor buys is the confidence.
    expect([at(45).kcal, at(65).kcal, at(90).kcal]).toEqual([40, 40, 40]);
    expect([at(45).confidence, at(65).confidence]).toEqual(["high", "high"]);
    // Past the floor it is a disagreement like any other.
    expect(at(90).confidence).toBe("medium");
  });

  test("an item with no numbers on it stops the reconciliation, rather than counting as zero", () => {
    // The shared `MealItem` keeps all four optional and an edit may store an item carrying only a
    // name and its grams, so `?? 0` over one of those would reconcile the plate DOWNWARDS to a
    // number nobody estimated — silently, and always in the direction of under-counting.
    const { analysis } = prepareAnalysis(plate({
      items: [item(300), { name: "Soup", grams: 400 }], kcal: 700,
    }));
    expect(analysis.kcal).toBe(700);
    expect(analysis.confidence).toBe("high");
  });

  test("items that sum to nothing are working that says nothing", () => {
    // Every row present and every row zero. The tolerance collapses to the floor, the difference
    // trips it, and a plate's calories are deleted — the loudest possible version of the same bug.
    const { analysis } = prepareAnalysis(plate({
      items: [item(0), item(0)], kcal: 620,
    }));
    expect(analysis.kcal).toBe(620);
    expect(analysis.confidence).toBe("high");
  });

  test("an image with no food in it passes through whole", () => {
    const nothing = plate({ isFood: false, items: [], kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 });
    expect((prepareAnalysis(nothing)).analysis).toEqual(nothing);
  });

  test("a not-food answer keeps its numbers even when they are not zero", () => {
    // Nothing downstream reads them — `logPhotoMeal` returns `not-food` before it writes — and a
    // reconciler that rewrote them would be answering a question nobody asked.
    const odd = plate({ isFood: false, items: [], kcal: 500 });
    expect((prepareAnalysis(odd)).analysis.kcal).toBe(500);
  });

  test("an empty plate is left alone rather than zeroed", () => {
    // A model that returns totals and no items has failed to itemise, not eaten nothing. Summing
    // zero rows and believing the sum would throw the whole meal away.
    const { analysis } = prepareAnalysis(plate({ items: [], kcal: 300 }));
    expect(analysis.kcal).toBe(300);
    expect(analysis.confidence).toBe("high");
  });
});

describe("the prompt-side fields", () => {
  const SCALE = { reference: "dinner plate", plate_diameter_cm: 27 };
  const QUESTION = { text: "Was there oil on the salad?", options: ["Yes", "No"] };

  test("scale and the question are stripped from what may be stored", () => {
    const { analysis } = prepareAnalysis(plate({ scale: SCALE, question: QUESTION }));
    expect(analysis).not.toHaveProperty("scale");
    expect(analysis).not.toHaveProperty("question");
  });

  test("the question is handed to the caller instead", () => {
    const out = prepareAnalysis(plate({ question: QUESTION }));
    expect(out.question).toEqual(QUESTION);
  });

  test("no question is null, not undefined — the caller branches on it", () => {
    expect((prepareAnalysis(plate())).question).toBeNull();
    expect((prepareAnalysis(plate({ question: null }))).question).toBeNull();
  });

  test("they are stripped from a not-food answer too", () => {
    // The early return is the branch a strip is easiest to forget on.
    const { analysis } = prepareAnalysis(plate({ isFood: false, items: [], scale: null, question: QUESTION }));
    expect(analysis).not.toHaveProperty("scale");
    expect(analysis).not.toHaveProperty("question");
  });
});
