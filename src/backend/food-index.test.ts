// The in-memory index behind `foodCandidates` (#615). It answers the same contract the SQL did:
// every query word present as a whole word or a plural, only rows with all four macros, shortest
// name first — but without a round-trip.

import { describe, expect, test } from "bun:test";
import type { FoodRef } from "@eait/shared";
import { buildFoodIndex } from "./food-index.ts";

const ref = (name_en: string | null, over: Partial<FoodRef> = {}): FoodRef => ({
  id: `usda-sr:${name_en}`, source: "usda-sr", name: name_en ?? "x", name_de: null, name_en,
  names: {}, category: null,
  kcal_per_100g: 100, protein_g_per_100g: 10, carbs_g_per_100g: 20, fat_g_per_100g: 5,
  satfat_g_per_100g: null, fiber_g_per_100g: null, sugar_g_per_100g: null, sodium_mg_per_100g: null,
  nutrients: {}, portions: [], source_url: null, attribution: [],
  ...over,
} as FoodRef);

const names = (idx: ReturnType<typeof buildFoodIndex>, words: string[], limit = 300) =>
  idx.candidates(words, limit).map((f) => f.name_en);

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

  test("shortest name first, then alphabetical, bounded by limit", () => {
    const idx = buildFoodIndex([
      ref("Rice, white, long-grain, regular, enriched, cooked"),
      ref("Rice, white, cooked"),
      ref("Rice, cooked"),
    ]);
    expect(names(idx, ["rice", "cooked"], 2)).toEqual(["Rice, cooked", "Rice, white, cooked"]);
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
