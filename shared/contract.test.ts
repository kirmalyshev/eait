import { describe, expect, it } from "bun:test";
import {
  MAX_HEALTH_DAYS_PER_BATCH, MAX_ITEM_NAME, MAX_MEAL_AMOUNT, MAX_MEAL_ITEMS, healthDayBatches,
  healthDaysFrom, healthSyncLanded, isEditMealRequest,
} from "./contract.ts";
import { emptyHealthDay } from "./health.ts";

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

// The first sync reads years of history off the phone, and the route takes at most
// MAX_HEALTH_DAYS_PER_BATCH days per request. The split is here, tested, rather than a loop in
// the app the tests cannot reach.
describe("healthDayBatches", () => {
  const days = (n: number) => Array.from({ length: n }, (_, i) => emptyHealthDay(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`));

  it("sends a small batch as one request", () => {
    expect(healthDayBatches(days(3)).map((b) => b.length)).toEqual([3]);
    expect(healthDayBatches([])).toEqual([]);
  });

  it("splits at the contract's cap and keeps every day exactly once, in order", () => {
    const all = days(MAX_HEALTH_DAYS_PER_BATCH * 2 + 1);
    const out = healthDayBatches(all);
    expect(out.map((b) => b.length)).toEqual([MAX_HEALTH_DAYS_PER_BATCH, MAX_HEALTH_DAYS_PER_BATCH, 1]);
    expect(out.flat()).toEqual(all);
  });
});

// Whether the phone's wide first sync may stop being wide. Here, tested, because the app's
// workspace has no test runner.
describe("healthSyncLanded", () => {
  const day = (date: string) => ({ ...emptyHealthDay(date), steps: 1 });
  const read = [day("2026-09-10"), day("2026-09-09"), day("2021-09-10")];

  it("is every day of the window, not any day: the midnight race drops ONE", () => {
    expect(healthSyncLanded(read, "2021-09-10", 3)).toBe(true);
    expect(healthSyncLanded(read, "2021-09-10", 2)).toBe(false);
  });

  it("does not count a day from before the window, which the server never keeps", () => {
    const withEdge = [...read, day("2021-09-09")];
    expect(healthSyncLanded(withEdge, "2021-09-10", 3)).toBe(true);
  });

  it("is AT LEAST the window: a server whose day has not turned yet may keep one more (#558)", () => {
    const withEdge = [...read, day("2021-09-09")];
    expect(healthSyncLanded(withEdge, "2021-09-10", 4)).toBe(true);
  });
});

// What the phone sends is the window it read. A day before it comes from a sample overlapping the
// window's first midnight, and carries that sample and nothing else.
describe("healthDaysFrom", () => {
  it("drops every day before the window and keeps the rest, in order", () => {
    const d = (date: string) => ({ ...emptyHealthDay(date), steps: 1 });
    const days = [d("2026-09-10"), d("2026-09-04"), d("2026-09-03")];
    expect(healthDaysFrom(days, "2026-09-04").map((x) => x.date)).toEqual(["2026-09-10", "2026-09-04"]);
  });
});
