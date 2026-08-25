import { describe, expect, it } from "bun:test";
import { MAX_ITEM_NAME, MAX_MEAL_AMOUNT, MAX_MEAL_ITEMS, isEditMealRequest } from "./contract.ts";

// The manual edit's body is the one place a client sends numbers the thread then repeats as Spud's
// sentence. A shape check at the boundary keeps "Updated — NaN kcal" out of a permanent line.
describe("isEditMealRequest", () => {
  it("accepts finite non-negative numbers and well-formed items, each optional", () => {
    expect(isEditMealRequest({})).toBe(true);
    expect(isEditMealRequest({ kcal: 320, protein_g: 0 })).toBe(true);
    expect(isEditMealRequest({ items: [{ name: "egg", grams: 50 }] })).toBe(true);
  });

  it("refuses anything that is not a number where a number belongs", () => {
    expect(isEditMealRequest({ kcal: "abc" })).toBe(false);
    expect(isEditMealRequest({ sodium_mg: Number.NaN })).toBe(false);
    expect(isEditMealRequest({ fat_g: -1 })).toBe(false);
    // A ceiling too: the number ends up in a verdict and in a stored sentence.
    expect(isEditMealRequest({ kcal: MAX_MEAL_AMOUNT + 1 })).toBe(false);
    expect(isEditMealRequest({ items: [{ name: "egg", grams: MAX_MEAL_AMOUNT + 1 }] })).toBe(false);
    expect(isEditMealRequest({ kcal: MAX_MEAL_AMOUNT })).toBe(true);
    expect(isEditMealRequest({ items: "egg" })).toBe(false);
    expect(isEditMealRequest({ items: [{ grams: 50 }] })).toBe(false);
    // An item's own numbers render on the card and rescale on edit: the same rule as the totals.
    expect(isEditMealRequest({ items: [{ name: "egg", grams: -50 }] })).toBe(false);
    expect(isEditMealRequest({ items: [{ name: "egg", grams: 50, kcal: "boom" }] })).toBe(false);
    expect(isEditMealRequest({ items: [{ name: "egg", grams: 50, kcal_per_100g: -1 }] })).toBe(false);
    expect(isEditMealRequest({ items: [{ name: "egg", grams: 50, name_en: 7 }] })).toBe(false);
    expect(isEditMealRequest({ items: [{ name: "egg", grams: 50, name_en: "egg", kcal: 78, kcal_per_100g: 155 }] })).toBe(true);
    expect(isEditMealRequest(null)).toBe(false);
    // Bounded like every other client string: an item's name reaches every later prompt that day.
    expect(isEditMealRequest({ items: Array.from({ length: MAX_MEAL_ITEMS + 1 }, () => ({ name: "egg", grams: 1 })) })).toBe(false);
    expect(isEditMealRequest({ items: [{ name: "x".repeat(MAX_ITEM_NAME + 1), grams: 1 }] })).toBe(false);
    expect(isEditMealRequest({ items: [{ name: "egg", grams: 1, name_en: "x".repeat(MAX_ITEM_NAME + 1) }] })).toBe(false);
    expect(isEditMealRequest({ items: [{ name: "x".repeat(MAX_ITEM_NAME), grams: 1 }] })).toBe(true);
    // An item is stored as given, so a key nobody declared is a body of any size that passes every bound.
    expect(isEditMealRequest({ items: [{ name: "egg", grams: 1, junk: "x" }] })).toBe(false);
    expect(isEditMealRequest([])).toBe(false);
  });
});
