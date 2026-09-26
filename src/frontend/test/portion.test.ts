// The first meal's manual correction as data (#42): what "What it was" plus a Portion sends to
// `PATCH /v1/meals/:id`.
//
// IN `test/` FOR THE REASON `client.test.ts` GIVES: the module under test is browser code with no
// DOM in it, and this is the tsconfig with bun's types.
//
// Why these numbers are what they are: the edit is UNCHARGED and the sample is one analysis, so a
// correction may never ask the model — the client scales the plate it already holds, and the server
// recomputes the verdicts on what it stores. The scaling is the arithmetic the whole path shares.

import { describe, expect, it } from "bun:test";
import { PORTION_FACTOR, firstMealEdit } from "../portion.ts";
import type { MealAnalysis } from "@eait/shared";

type Scaled = Pick<MealAnalysis,
  "items" | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "satfat_g" | "fiber_g" | "sugar_g" | "sodium_mg">;

const MEAL: Scaled = {
  items: [
    { name: "Grilled chicken breast", name_en: "chicken breast", grams: 180, kcal: 297, protein_g: 55.8, carbs_g: 0, fat_g: 6.5, kcal_per_100g: 165 },
    { name: "Basmati rice", name_en: "white rice, cooked", grams: 200, kcal: 260, protein_g: 5.4, carbs_g: 56, fat_g: 0.6, kcal_per_100g: 130 },
  ],
  kcal: 557, protein_g: 61.2, carbs_g: 56, fat_g: 7.1, satfat_g: 2.1, fiber_g: 2, sugar_g: 8.4, sodium_mg: 540,
};

describe("firstMealEdit", () => {
  it("scales every item's grams and numbers, and the totals, by the portion", () => {
    const edit = firstMealEdit(MEAL, "", "small");
    expect(PORTION_FACTOR.small).toBe(0.75);
    expect(edit.items?.[0]).toMatchObject({ grams: 135, kcal: 223, protein_g: 41.8, fat_g: 4.9 });
    expect(edit.items?.[1]).toMatchObject({ grams: 150, kcal: 195, protein_g: 4.1, carbs_g: 42 });
    // The totals follow the same factor — a plate whose rows disagree with its own total is the
    // shape `prepareAnalysis` reconciles, and a client-invented mismatch is the same lie.
    expect(edit).toMatchObject({ kcal: 418, protein_g: 45.9, sodium_mg: 405 });
  });

  it("leaves the numbers alone on Regular", () => {
    const edit = firstMealEdit(MEAL, "", "regular");
    expect(edit.items?.[0]).toMatchObject({ grams: 180, kcal: 297, protein_g: 55.8 });
    expect(edit.kcal).toBe(557);
  });

  it("grows them on Large", () => {
    const edit = firstMealEdit(MEAL, "", "large");
    expect(PORTION_FACTOR.large).toBe(1.25);
    expect(edit.items?.[0]).toMatchObject({ grams: 225 });
    expect(edit.kcal).toBe(696);
  });

  it("never scales a density — kcal_per_100g is per 100 g whatever the portion", () => {
    const edit = firstMealEdit(MEAL, "", "small");
    expect(edit.items?.[0]?.kcal_per_100g).toBe(165);
  });

  it("renames the only item of a one-item meal", () => {
    const one: Scaled = { ...MEAL, items: [MEAL.items[0]!] };
    const edit = firstMealEdit(one, "Caesar salad", "regular");
    expect(edit.items).toHaveLength(1);
    expect(edit.items?.[0]?.name).toBe("Caesar salad");
  });

  it("renames the first of several and keeps the rest", () => {
    const edit = firstMealEdit(MEAL, "Chicken and chips", "regular");
    expect(edit.items?.[0]?.name).toBe("Chicken and chips");
    expect(edit.items?.[1]?.name).toBe("Basmati rice");
    // The canonical key goes with the name it belonged to: grouping "Chicken and chips" under
    // `chicken breast` would teach the portion priors a food this plate did not have.
    expect(edit.items?.[0]?.name_en).toBeUndefined();
    expect(edit.items?.[1]?.name_en).toBe("white rice, cooked");
  });

  it("keeps the names — and the canonical keys — when the field comes back empty or unchanged", () => {
    for (const what of ["", "   ", "Grilled chicken breast"]) {
      const edit = firstMealEdit(MEAL, what, "small");
      expect(edit.items?.[0]?.name).toBe("Grilled chicken breast");
      expect(edit.items?.[0]?.name_en).toBe("chicken breast");
    }
  });

  it("sends no items there are none of, rather than inventing one", () => {
    const edit = firstMealEdit({ ...MEAL, items: [] }, "anything", "small");
    expect(edit.items).toEqual([]);
    expect(edit.kcal).toBe(418);
  });
});
