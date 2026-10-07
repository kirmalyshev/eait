// The catalog supplies the nutrition; the model supplies the picture. A miss keeps the model's number.

import { describe, expect, test } from "bun:test";
import type { FoodRef } from "@eait/shared";
import type { AnalyzedMeal } from "../llm/port.ts";
import type { EngineDeps } from "./deps.ts";
import { groundAnalysis, lookupWords, pickFood } from "./ground.ts";
import { prepareAnalysis } from "./analysis.ts";

const ref = (name_en: string, kcal: number | null, over: Partial<FoodRef> = {}): FoodRef => ({
  id: `usda-sr:${name_en}`, source: "usda-sr", name: name_en, name_de: null, name_en, names: {}, category: null,
  kcal_per_100g: kcal, protein_g_per_100g: 10, carbs_g_per_100g: 20, fat_g_per_100g: 5,
  satfat_g_per_100g: null, fiber_g_per_100g: null, sugar_g_per_100g: null, sodium_mg_per_100g: null,
  nutrients: {}, portions: [],
  ...over,
} as FoodRef);

const depsWith = (catalog: FoodRef[] | Error): EngineDeps => ({
  store: {
    foodCandidates: async (w: string[]) => {
      if (catalog instanceof Error) throw catalog;
      return catalog.filter((f) => w.every((x) => f.name_en!.toLowerCase().includes(x)));
    },
  },
} as unknown as EngineDeps);

const meal = (items: AnalyzedMeal["items"]): AnalyzedMeal => ({
  isFood: true, items, kcal: 999, protein_g: 1, carbs_g: 1, fat_g: 1,
  satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0, confidence: "high", notes: "",
});
const model = (name_en: string, grams: number, kcal_per_100g = 150) => ({
  name: name_en, name_en, grams, kcal: grams * kcal_per_100g / 100, protein_g: 3, carbs_g: 4, fat_g: 2, kcal_per_100g,
});

describe("grounding items in the catalog", () => {
  test("a hit takes the catalog's density and multiplies by the grams", async () => {
    const { analysis, grounded } = await groundAnalysis(depsWith([ref("chicken breast", 165)]), meal([model("chicken breast", 200, 150)]));
    expect(grounded).toBe(1);
    expect(analysis.items[0]).toMatchObject({ kcal: 330, protein_g: 20, carbs_g: 40, fat_g: 10, kcal_per_100g: 165 });
  });

  test("a miss keeps the model's own numbers, whole", async () => {
    const original = meal([model("dragonfruit sorbet", 120)]);
    const { analysis, grounded } = await groundAnalysis(depsWith([ref("chicken breast", 165)]), original);
    expect(grounded).toBe(0);
    expect(analysis.items).toEqual(original.items);
  });

  test("a catalog that throws is a miss, not a failed meal", async () => {
    const original = meal([model("rice", 100)]);
    const { analysis } = await groundAnalysis(depsWith(new Error("db down")), original);
    expect(analysis.items).toEqual(original.items);
  });

  test("a row missing a macro is not used", async () => {
    const { grounded } = await groundAnalysis(depsWith([ref("rice", 130, { protein_g_per_100g: null })]), meal([model("rice", 100, 130)]));
    expect(grounded).toBe(0);
  });

  test("raw rice does not stand in for a plate of cooked rice", async () => {
    const original = meal([model("rice", 150, 130)]);
    const { grounded } = await groundAnalysis(depsWith([ref("rice", 365)]), original);
    expect(grounded).toBe(0);
  });

  test("a longer catalog name that contains every word matches; one whose density disagrees does not", async () => {
    const long = ref("chicken breast meat only cooked roasted", 165);
    expect((await groundAnalysis(depsWith([long]), meal([model("chicken breast", 100, 150)]))).grounded).toBe(1);
    expect((await groundAnalysis(depsWith([ref("rice pudding", 400)]), meal([model("rice", 100, 130)]))).grounded).toBe(0);
  });

  test("a mixed plate is grounded per item and the totals become the sum", async () => {
    const { analysis, grounded } = await groundAnalysis(
      depsWith([ref("egg", 143)]), meal([model("egg", 100, 150), model("mystery stew", 100, 100)]),
    );
    expect(grounded).toBe(1);
    expect(prepareAnalysis(analysis).analysis.kcal).toBe(143 + 100);
  });

  test("not-food and an empty plate pass through untouched", async () => {
    const none = { ...meal([]), isFood: false };
    expect((await groundAnalysis(depsWith([]), none)).analysis).toBe(none);
  });
});

describe("ranking the candidates", () => {
  const item = (name_en: string, d: number) => ({ name: name_en, name_en, grams: 100, kcal_per_100g: d });
  const pick = (name_en: string, d: number, rows: FoodRef[]) => pickFood(item(name_en, d), rows)?.name_en ?? null;

  test("the food leads the name: the generic entry beats a tart, a pineapple and a branded product", () => {
    const rows = [ref("Apple tart", 227), ref("Pineapple, raw", 50), ref("Lean Pockets, Apple", 250), ref("Apples, raw, all varieties", 52)];
    expect(pick("apple", 53, rows)).toBe("Apples, raw, all varieties");
  });
  test("a named preparation picks the row prepared that way, and plain defaults to raw", () => {
    const rows = [ref("Chicken, breast, raw", 120), ref("Chicken, breast, cooked, fried", 220), ref("Chicken, breast, cooked, roasted", 165)];
    expect(pick("fried chicken breast", 200, rows)).toBe("Chicken, breast, cooked, fried");
    expect(pick("chicken breast", 130, rows)).toBe("Chicken, breast, raw");
  });
  test("meatless is never a match for meat, unless the model said so", () => {
    const rows = [ref("Meatballs, meatless", 197)];
    expect(pick("meatballs", 180, rows)).toBeNull();
    expect(pick("meatless meatballs", 180, rows)).toBe("Meatballs, meatless");
  });
  test("a poor best candidate is a miss", () => {
    expect(pick("mini quiche", 233, [ref("Egg tart, quiche style lorraine pie pastry", 233)])).toBeNull();
  });
  test("the lookup drops preparation and filler words and stems plurals", () => {
    expect(lookupWords("Fried chicken drumsticks with the skin")).toEqual(["chicken", "drumstick", "skin"]);
  });
});
