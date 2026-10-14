// The in-memory index behind `foodCandidates` (#615). It answers the same contract the SQL did:
// every query word present as a whole word or a plural, only rows with all four macros, shortest
// name first — but without a round-trip.

import { describe, expect, test } from "bun:test";
import type { FoodRef } from "@eait/shared";
import { buildFoodIndex } from "./food-index.ts";
import { lookupWords } from "./engine/ground.ts";

const ref = (name_en: string | null, over: Partial<FoodRef> = {}): FoodRef => ({
  id: `usda-sr:${name_en}`, source: "usda-sr", name: name_en ?? "x", name_de: null, name_en,
  names: {}, category: null,
  kcal_per_100g: 100, protein_g_per_100g: 10, carbs_g_per_100g: 20, fat_g_per_100g: 5,
  satfat_g_per_100g: null, fiber_g_per_100g: null, sugar_g_per_100g: null, sodium_mg_per_100g: null,
  nutrients: {}, portions: [], source_url: null, attribution: [],
  ...over,
} as FoodRef);

const names = (idx: ReturnType<typeof buildFoodIndex>, words: string[]) =>
  idx.candidates(words).map((f) => f.name_en);

describe("the food index answers the foodCandidates contract", () => {
  test("every word must appear, as a whole word or a plural", () => {
    const idx = buildFoodIndex([
      ref("Apples, raw, all varieties"),
      ref("Apple tart"),
      ref("Pineapple, raw"),
      ref("Pineapple tart"),
    ]);
    expect(names(idx, ["apple"])).toEqual(["Apple tart", "Apples, raw, all varieties"]);
    expect(names(idx, ["apple", "raw"])).toEqual(["Apples, raw, all varieties"]);
  });

  test("plurals match both ways: tomato/tomatoes, cherry/cherries, noodle/noodles", () => {
    const idx = buildFoodIndex([
      ref("Tomatoes, red, ripe, raw"),
      ref("Cherries, sweet, raw"),
      ref("Rice noodles, cooked"),
    ]);
    expect(names(idx, ["tomato"])).toEqual(["Tomatoes, red, ripe, raw"]);
    expect(names(idx, ["tomatoes"])).toEqual(["Tomatoes, red, ripe, raw"]);
    expect(names(idx, ["cherry"])).toEqual(["Cherries, sweet, raw"]);
    expect(names(idx, ["cherries"])).toEqual(["Cherries, sweet, raw"]);
    expect(names(idx, ["noodle"])).toEqual(["Rice noodles, cooked"]);
    expect(names(idx, ["noodles"])).toEqual(["Rice noodles, cooked"]);
  });

  test("shortest name first, then alphabetical", () => {
    const idx = buildFoodIndex([
      ref("Rice, white, long-grain, regular, enriched, cooked"),
      ref("Rice, white, cooked"),
      ref("Rice, cooked"),
    ]);
    expect(names(idx, ["rice", "cooked"])).toEqual([
      "Rice, cooked", "Rice, white, cooked", "Rice, white, long-grain, regular, enriched, cooked",
    ]);
  });

  // #637: a frequent token (300+ rows carrying it) must not evict the long-named right row from
  // the pool before the scorer sees it — "fried chicken" found 300 shorter "chicken" rows first.
  test("the pool is the whole intersection, not the first N by name length", () => {
    const idx = buildFoodIndex([
      ref("Chicken, broilers or fryers, meat only, cooked, fried", { id: "usda-sr:right" }),
      ...Array.from({ length: 400 }, (_, i) => ref(`Chicken c${i}`, { id: `bls:c${i}` })),
    ]);
    const pool = idx.candidates(["chicken"]);
    expect(pool.length).toBe(401);
    expect(pool.some((f) => f.id === "usda-sr:right")).toBe(true);
  });

  test("a row without every macro is not a candidate; a row with no English name is not either", () => {
    const idx = buildFoodIndex([
      ref("Beans, white, raw"),
      ref("Beans, no protein", { protein_g_per_100g: null }),
      ref(null, { id: "ciqual:1", name: "Haricots" }),
    ]);
    expect(names(idx, ["beans"])).toEqual(["Beans, white, raw"]);
    expect(idx.size).toBe(1);
  });

  test("matching is case-insensitive", () => {
    const idx = buildFoodIndex([ref("BURGER KING, Hamburger")]);
    expect(names(idx, ["hamburger"])).toEqual(["BURGER KING, Hamburger"]);
  });

  test("upsert indexes new rows and replaces a row by id", () => {
    const idx = buildFoodIndex([ref("Apples, raw")]);
    idx.upsert([ref("Bananas, raw"), ref("Apples, dried", { id: "usda-sr:Apples, raw" })]);
    expect(names(idx, ["apple"])).toEqual(["Apples, dried"]);
    expect(names(idx, ["banana"])).toEqual(["Bananas, raw"]);
    expect(idx.size).toBe(2);
  });
});

// #615 review: the query path is `lookupWords` (which singularises), not a raw word — the test
// that indexed "cherries" and queried "cherries" could not see that lookupWords sends
// "cherrie". Go through BOTH sides the way `findFood` does.
describe("the index answers the words lookupWords actually sends", () => {
  const candidates = (idx: ReturnType<typeof buildFoodIndex>, name: string) =>
    names(idx, lookupWords(name));

  test("berries, fries, cookies and pies: the singular guesses cover what singular() emits", () => {
    const idx = buildFoodIndex([
      ref("Strawberries, raw"),
      ref("Blueberries, raw"),
      ref("Potatoes, french fried, all types, salt added, frozen, home-prepared, oven heated"),
      ref("Cookies, chocolate chip, commercially prepared, regular, higher fat, unenriched"),
      ref("Pie, apple, commercially prepared, enriched flour"),
    ]);
    expect(candidates(idx, "strawberries")).toEqual(["Strawberries, raw"]);
    expect(candidates(idx, "strawberry")).toEqual(["Strawberries, raw"]);
    expect(candidates(idx, "blueberries")).toEqual(["Blueberries, raw"]);
    expect(candidates(idx, "french fries").length).toBeGreaterThan(0);
    expect(candidates(idx, "chocolate chip cookie")).toEqual([
      "Cookies, chocolate chip, commercially prepared, regular, higher fat, unenriched",
    ]);
    expect(candidates(idx, "apple pie")).toEqual(["Pie, apple, commercially prepared, enriched flour"]);
  });
});
