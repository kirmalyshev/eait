// The lean photo answer (ieat-app#1989, eait#607): what the L1 prompt's shape widens into, and
// what a streamed lean item becomes on the wire.

import { describe, expect, test } from "bun:test";
import { LeanSchema, leanStreamItem, widen } from "./lean.ts";
import { prepareAnalysis } from "../engine/analysis.ts";

const LEAN = {
  isFood: true,
  scale: { reference: "dinner plate", plate_diameter_cm: 26 },
  items: [
    { name: "Rice", name_en: "white rice, cooked", grams: 200, kcal_per_100g: 130 },
    { name: "Chicken", name_en: "chicken breast", grams: 150, kcal_per_100g: 165 },
    { name: "Olive oil (cooking)", name_en: "cooking oil", grams: 10, kcal_per_100g: 884, role: "cooking-fat" },
  ],
  kcal: 900, protein_g: 60, carbs_g: 80, fat_g: 30,
  confidence: "medium", notes: "estimated by eye", question: null,
} as const;

describe("widen", () => {
  const out = widen(LeanSchema.parse(LEAN));

  test("an item's kcal is grams × kcal_per_100g, never asked of the model", () => {
    expect(out.items.map((i) => i.kcal)).toEqual([260, 248, 88]);
  });

  test("an ungrounded item's macros are the meal's, split by its share of the kcal", () => {
    // 260 + 247.5 + 88.4 = 595.9 kcal of item mass — the shares divide over the UNROUNDED
    // densities — and each share is then rounded to a tenth, as a model-written number would be.
    expect(out.items[0]!.protein_g).toBe(26.2);
    expect(out.items[1]!.carbs_g).toBe(33.2);
    expect(out.items[2]!.fat_g).toBe(4.5);
    // And the shares hand the whole pool out: nothing is estimated twice or lost.
    expect(out.items.reduce((s, i) => s + i.protein_g, 0)).toBeCloseTo(60, 0);
  });

  test("the micros the lean schema does not ask for come back as zero, not absent", () => {
    expect(out).toMatchObject({ satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0 });
  });

  test("the role mark survives the widening", () => {
    expect(out.items[2]!.role).toBe("cooking-fat");
  });

  test("the stored meal's totals are the sum of the items, never the model's meal estimate", () => {
    // widen keeps the model's meal-level numbers so the split has a pool; `prepareAnalysis` —
    // the seam every analyzer answer passes — then re-sums them off the items.
    const { analysis } = prepareAnalysis(out);
    expect(analysis.kcal).toBe(260 + 248 + 88);
    expect(analysis.items.reduce((s, i) => s + (i.protein_g ?? 0), 0)).toBeCloseTo(analysis.protein_g, 0);
  });

  test("an item of zero grams does not divide by zero", () => {
    const zeroed = widen(LeanSchema.parse({
      ...LEAN, items: [{ name: "Rice", name_en: "rice", grams: 0, kcal_per_100g: 0 }],
    }));
    expect(zeroed.items[0]!.kcal).toBe(0);
    expect(zeroed.items[0]!.protein_g).toBe(0);
  });
});

describe("leanStreamItem", () => {
  test("a lean item becomes the MealItem the wire already carries: kcal filled, macros absent", () => {
    const item = leanStreamItem(LeanSchema.shape.items.element.parse(
      { name: "Rice", name_en: "rice", grams: 200, kcal_per_100g: 130 },
    ));
    expect(item).toEqual({ name: "Rice", name_en: "rice", grams: 200, kcal_per_100g: 130, kcal: 260 });
    expect(item).not.toHaveProperty("protein_g");
  });
});
