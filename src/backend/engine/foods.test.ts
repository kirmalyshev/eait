// The food catalog lookups — name search into food_ref, barcode into off_product.
//
// Both run against the memory store, which is a real implementation of the port rather than a
// mock: the ranking and the precedence rule a test pins here are the Postgres behaviour too,
// because store.contract.test.ts runs the same suite against both.

import { beforeEach, describe, expect, it } from "bun:test";
import { FOOD_SEARCH_MAX_LIMIT, normalizeBarcode, type FoodRef, type OffProduct } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { foodSearch, productByBarcode } from "./foods.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
};

let store: Store;
let deps: EngineDeps;

beforeEach(() => {
  store = memoryStore();
  deps = { store, config: CONFIG, llm: demoPorts(), push: fakePush() };
});

const food = (over: Partial<FoodRef> & { id: string; name: string }): FoodRef => ({
  source: "bls",
  name_de: null, name_en: null, names: {}, category: null,
  kcal_per_100g: null, protein_g_per_100g: null, carbs_g_per_100g: null,
  fat_g_per_100g: null, satfat_g_per_100g: null, fiber_g_per_100g: null,
  sugar_g_per_100g: null, sodium_mg_per_100g: null,
  nutrients: {}, portions: [], source_url: null,
  ...over,
});

const product = (over: Partial<OffProduct> & { barcode: string }): OffProduct => ({
  source: "off", name: "", brand: null, serving_g: null, package_g: null,
  kcal_per_100g: null, protein_g_per_100g: null, carbs_g_per_100g: null,
  fat_g_per_100g: null, satfat_g_per_100g: null, fiber_g_per_100g: null,
  sugar_g_per_100g: null, sodium_mg_per_100g: null,
  nutriscore: null, nova_group: null, ingredients: null, image_url: null, data: {},
  ...over,
});

describe("foodSearch", () => {
  it("finds a food by a case-insensitive name fragment", async () => {
    await store.putFoodRefs([
      food({ id: "bls:1", name: "Haferflocken" }),
      food({ id: "bls:2", name: "Vollkornbrot" }),
    ]);
    const { foods } = await foodSearch(deps, "HAFER");
    expect(foods.map((f) => f.id)).toEqual(["bls:1"]);
  });

  it("matches name_en and name_de, not only the primary name", async () => {
    await store.putFoodRefs([
      food({ id: "bls:1", name: "Haferflocken", name_en: "Oat flakes" }),
      food({ id: "usda-sr:2", name: "Rolled oats" }),
    ]);
    expect((await foodSearch(deps, "oat flakes")).foods.map((f) => f.id)).toEqual(["bls:1"]);
    expect((await foodSearch(deps, "oats")).foods.map((f) => f.id)).toEqual(["usda-sr:2"]);
  });

  it("ranks the name the match lands earliest in first", async () => {
    await store.putFoodRefs([
      food({ id: "bls:1", name: "Vollkorn-Haferflocken" }),   // 'hafer' at position 9
      food({ id: "bls:2", name: "Haferflocken" }),            // position 0
    ]);
    const { foods } = await foodSearch(deps, "hafer");
    expect(foods.map((f) => f.id)).toEqual(["bls:2", "bls:1"]);
  });

  it("never returns more than FOOD_SEARCH_MAX_LIMIT however the caller asks", async () => {
    await store.putFoodRefs(
      Array.from({ length: 60 }, (_, i) => food({ id: `bls:${i}`, name: `Hafer ${i}` })),
    );
    expect((await foodSearch(deps, "hafer", 500)).foods.length).toBe(FOOD_SEARCH_MAX_LIMIT);
  });

  it("names the sources it answered from, once each", async () => {
    await store.putFoodRefs([
      food({ id: "bls:1", name: "Apfel" }),
      food({ id: "bls:3", name: "Apfelmus" }),
      food({ id: "usda-sr:2", name: "Apple", source: "usda-sr" }),
    ]);
    // Two BLS rows still owe ONE citation; the USDA row — CC0, no citation owed — adds none.
    const { attributions } = await foodSearch(deps, "apf");
    expect(attributions.map((a) => a.source)).toEqual(["bls"]);
  });

  it("returns nothing for a query nothing matches", async () => {
    await store.putFoodRefs([food({ id: "bls:1", name: "Hafer" })]);
    const { foods, attributions } = await foodSearch(deps, "quinoa");
    expect(foods).toEqual([]);
    expect(attributions).toEqual([]);
  });
});

describe("productByBarcode", () => {
  it("returns the row for a known barcode", async () => {
    await store.putOffProducts([
      product({ barcode: "4008400401621", name: "Nutella", brand: "Nutella", kcal_per_100g: 539 }),
    ]);
    const { product: hit } = await productByBarcode(deps, "4008400401621");
    expect(hit?.name).toBe("Nutella");
    expect(hit?.source).toBe("off");
  });

  it("answers null on a miss — the label-read path's ordinary answer", async () => {
    const { product: miss, attribution } = await productByBarcode(deps, "9999999999999");
    expect(miss).toBeNull();
    expect(attribution).toBeNull();
  });

  it("returns the OFF attribution beside an OFF product", async () => {
    await store.putOffProducts([product({ barcode: "4008400401621", name: "Nutella" })]);
    const { attribution } = await productByBarcode(deps, "4008400401621");
    expect(attribution?.source).toBe("off");
    expect(attribution?.url).toContain("openfoodfacts.org");
  });
});

describe("normalizeBarcode", () => {
  it("strips separators and accepts the GTIN family", () => {
    expect(normalizeBarcode("4008 400401621")).toBe("4008400401621");
    expect(normalizeBarcode("00400344003345")).toBe("00400344003345");
  });
  it("rejects what is not a product code", () => {
    expect(normalizeBarcode("hello")).toBeNull();
    expect(normalizeBarcode("12")).toBeNull();
    expect(normalizeBarcode("0".repeat(20))).toBeNull();
    expect(normalizeBarcode(12345)).toBeNull();
  });
});
