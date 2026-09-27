// The meal edit's arithmetic (#188): grams → numbers on one item, items → the PATCH body, and
// the deep-link query. The tinted line a recomputed detail names the change with is
// `MealUpdated.line` — the engine's `changeLine`, sent on the result rather than composed here;
// and the meal's totals are the SERVER's job on an items-only patch (`editMeal` derives them).

import { describe, expect, it } from "bun:test";
import { mealEditParams, mealEditRequest, scaledItem } from "./meal-edit.ts";
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
const MEAL = { items: [salmon, rice(), broccoli] };

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

describe("mealEditRequest — the PATCH body is items, or null when nothing moved", () => {
  it("is null when the items are the same", () => {
    expect(mealEditRequest(MEAL, MEAL.items)).toBeNull();
  });
  it("sends the edited items and nothing else — the server derives the totals", () => {
    const items = [salmon, scaledItem(rice(), 200), broccoli];
    const req = mealEditRequest(MEAL, items);
    expect(req).toEqual({ items });
    expect(req).not.toHaveProperty("kcal");
    expect(req).not.toHaveProperty("protein_g");
  });
  it("sends the shortened list on a removal", () => {
    expect(mealEditRequest(MEAL, [salmon, broccoli])).toEqual({ items: [salmon, broccoli] });
  });
});

describe("mealEditParams — the ?fix / ?item deep links", () => {
  it("reads the fix flag and a digit item index", () => {
    expect(mealEditParams("fix")).toEqual({ fix: true, item: null });
    expect(mealEditParams("item=2")).toEqual({ fix: false, item: 2 });
    expect(mealEditParams("fix&item=0")).toEqual({ fix: true, item: 0 });
    expect(mealEditParams("")).toEqual({ fix: false, item: null });
    expect(mealEditParams("d=2026-09-27")).toEqual({ fix: false, item: null });
  });
  it("refuses an index that is not all digits — parseInt would have taken '1abc'", () => {
    expect(mealEditParams("item=1abc")).toEqual({ fix: false, item: null });
    expect(mealEditParams("item=-1")).toEqual({ fix: false, item: null });
    expect(mealEditParams("item=")).toEqual({ fix: false, item: null });
  });
});
