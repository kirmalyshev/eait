// The meal edit's arithmetic (#188): grams → numbers on one item, items+totals → the PATCH
// body, and the one tinted line a recomputed detail names the change with ("Rice 150 → 200 g ·
// 540 → 605 kcal" — the boards' `CHANGED` row, the change half of `changeLine` without the
// verdict tail the thread carries).

import { describe, expect, it } from "bun:test";
import { mealEditRequest, scaledItem } from "./meal-edit.ts";
import { changeBrief } from "./app/meal-copy.ts";
import type { MealItem } from "./types.ts";

const rice = (over: Partial<MealItem> = {}): MealItem => ({
  name: "Rice", name_en: "rice", grams: 150, kcal: 195, kcal_per_100g: 130,
  protein_g: 3, carbs_g: 42, fat_g: 0.6, ...over,
});
const salmon: MealItem = {
  name: "Salmon", name_en: "salmon", grams: 140, kcal: 290, kcal_per_100g: 207,
  protein_g: 30, carbs_g: 0, fat_g: 18,
};
const broccoli: MealItem = { name: "Broccoli", name_en: "broccoli", grams: 90, kcal: 55 };
const MEAL = {
  items: [salmon, rice(), broccoli],
  kcal: 540, protein_g: 34, carbs_g: 48, fat_g: 23,
  satfat_g: 5, fiber_g: 6, sugar_g: 3, sodium_mg: 320,
};

describe("scaledItem — one ingredient at a new amount", () => {
  it("scales kcal by the item's own density when it has one", () => {
    expect(scaledItem(rice(), 200)).toMatchObject({ grams: 200, kcal: 260 });
  });
  it("scales the macros proportionally, keeping a tenth", () => {
    const s = scaledItem(rice(), 200);
    expect(s.protein_g).toBe(4);        // 3 × 4/3
    expect(s.carbs_g).toBe(56);         // 42 × 4/3
    expect(s.fat_g).toBe(0.8);          // 0.6 × 4/3
  });
  it("scales kcal proportionally when no density is stored", () => {
    expect(scaledItem(broccoli, 180).kcal).toBe(110);
  });
  it("keeps name_en and role — they are the repertoire's keys, not display", () => {
    expect(scaledItem({ ...rice(), role: "cooking-fat" }, 300).role).toBe("cooking-fat");
    expect(scaledItem(rice(), 300).name_en).toBe("rice");
  });
});

describe("mealEditRequest — the PATCH body, or null when nothing moved", () => {
  it("is null when the items are the same", () => {
    expect(mealEditRequest(MEAL, MEAL.items)).toBeNull();
  });
  it("carries the edited items and the totals shifted by the item's delta", () => {
    const items = [salmon, scaledItem(rice(), 200), broccoli];
    const req = mealEditRequest(MEAL, items);
    expect(req).not.toBeNull();
    expect(req!.items![1]).toMatchObject({ name: "Rice", grams: 200, kcal: 260 });
    // 540 + (260 − 195) — the item carries the delta, never a recomputed guess.
    expect(req!.kcal).toBe(605);
    expect(req!.protein_g).toBeCloseTo(35, 5);
    expect(req!.carbs_g).toBeCloseTo(62, 5);
  });
  it("subtracts a removed ingredient's reported numbers", () => {
    const req = mealEditRequest(MEAL, [salmon, broccoli]);
    expect(req!.items).toHaveLength(2);
    expect(req!.kcal).toBe(345);
    expect(req!.carbs_g).toBeCloseTo(6, 5);
  });
  it("never touches a total the items do not report", () => {
    const req = mealEditRequest(MEAL, [salmon, broccoli]);
    expect(req!.satfat_g).toBeUndefined();
    expect(req!.sodium_mg).toBeUndefined();
  });
});

describe("changeBrief — the tinted line on the recomputed detail", () => {
  it("names the grams that moved and the meal's kcal", () => {
    const after = { ...MEAL, kcal: 605, items: [salmon, scaledItem(rice(), 200), broccoli] };
    expect(changeBrief(MEAL, after, "en")).toBe("Rice 150 → 200 g · 540 → 605 kcal");
  });
  it("is the kcal pair alone when no item moved", () => {
    expect(changeBrief(MEAL, { ...MEAL, kcal: 480 }, "en")).toBe("540 → 480 kcal");
  });
  it("is null when nothing nameable changed — the rename case", () => {
    const after = { ...MEAL, items: MEAL.items.map((i) => ({ ...i, name: `${i.name} bis` })) };
    expect(changeBrief(MEAL, after, "en")).toBeNull();
  });
  it("speaks the account's language", () => {
    const after = { ...MEAL, kcal: 605, items: [salmon, scaledItem(rice(), 200), broccoli] };
    const line = changeBrief(MEAL, after, "de")!;
    expect(line).toContain("540 → 605");
    expect(line).toContain("kcal");
  });
});
