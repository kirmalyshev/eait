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
import { logMail } from "../mail/log.ts";
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
  deps = { store, config: CONFIG, llm: demoPorts(), push: fakePush(), mail: logMail() };
});

const food = (over: Partial<FoodRef> & { id: string; name: string }): FoodRef => ({
  source: "bls",
  name_de: null, name_en: null, names: {}, category: null,
  kcal_per_100g: null, protein_g_per_100g: null, carbs_g_per_100g: null,
  fat_g_per_100g: null, satfat_g_per_100g: null, fiber_g_per_100g: null,
  sugar_g_per_100g: null, sodium_mg_per_100g: null,
  nutrients: {}, portions: [], source_url: null, attribution: [],
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
    const { product: hit } = await productByBarcode(deps, "u1", "4008400401621");
    expect(hit?.name).toBe("Nutella");
    expect(hit?.source).toBe("off");
  });

  it("answers null on a miss — the label-read path's ordinary answer", async () => {
    const { product: miss, attribution } = await productByBarcode(deps, "u1", "9999999999999");
    expect(miss).toBeNull();
    expect(attribution).toBeNull();
  });

  it("returns the OFF attribution beside an OFF product", async () => {
    await store.putOffProducts([product({ barcode: "4008400401621", name: "Nutella" })]);
    const { attribution } = await productByBarcode(deps, "u1", "4008400401621");
    expect(attribution?.source).toBe("off");
    expect(attribution?.url).toContain("openfoodfacts.org");
  });
});

// The read-through: a barcode `off_product` does not know is asked of fooddb's OFF layer
// (`GET /v1/products/{barcode}?include=off&country=<cc>`), stored, and answered — and a miss on
// fooddb's side is cached briefly so a scan loop never hammers it. A dead or slow fooddb is a
// clean miss, never a hang and never an error the scanner sees.
describe("productByBarcode read-through", () => {
  // A resolved fooddb product, as `GET /v1/products/{barcode}?include=off` answers it — every
  // field `{value, source, licence, record}`, nutrients under `per_100` by INFOODS tagname.
  const resolved = (over: Record<string, unknown> = {}): Record<string, unknown> => {
    const tag = { source: "off", licence: "ODbL-1.0", record: "off:08437010746015" };
    const nutrient = { unit: "g", basis: "100g", source: "off", licence: "ODbL-1.0", observed_at: "2025-01-01" };
    return {
      id: 7,
      records: ["off:08437010746015"],
      gtin14: [{ ...tag, value: "08437010746015" }],
      snapshot: "2026-10-13",
      name: { ...tag, value: "Lentejas cocidas" },
      brand: { ...tag, value: "Luengo" },
      lang: { ...tag, value: "es" },
      serving_text: { ...tag, value: "60 g" },
      serving_g: { ...tag, value: 60 },
      category: { ...tag, value: "en:canned-legumes" },
      flags: { ...tag, value: [] },
      per_100: {
        ENERC_KCAL: { ...nutrient, value: 116, unit: "kcal" },
        PROCNT: { ...nutrient, value: 9 },
        CHOCDF: { ...nutrient, value: 10.4 },
        FAT: { ...nutrient, value: 4.1 },
      },
      seals: null,
      attribution: [],
      ...over,
    };
  };

  const okJson = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  /** A fetchFn that records every URL it was asked for, answered by `handler`. */
  const spyFetch = (handler: (url: string) => Response | Promise<Response>) => {
    const calls: string[] = [];
    const fetchFn = async (url: string) => { calls.push(url); return handler(url); };
    return { calls, fetchFn };
  };

  const withReadKey = () => { deps.config = { ...deps.config, fooddbReadKey: "read-key" }; };

  it("a miss asks fooddb, stores the product and answers it — the second lookup hits the cache", async () => {
    withReadKey();
    const { calls, fetchFn } = spyFetch(() => okJson({ items: [resolved()] }));
    const uid = await store.createUser("en");

    const { product: first } = await productByBarcode(deps, uid, "8437010746015", { fetchFn });
    expect(calls.length).toBe(1);
    expect(calls[0]).toContain("/v1/products/8437010746015");
    expect(calls[0]).toContain("include=off");
    expect(first?.name).toBe("Lentejas cocidas");
    expect(first?.brand).toBe("Luengo");
    expect(first?.serving_g).toBe(60);
    expect(first?.kcal_per_100g).toBe(116);
    expect(first?.source).toBe("off");

    const { product: second } = await productByBarcode(deps, uid, "8437010746015", { fetchFn });
    expect(calls.length).toBe(1);
    expect(second?.barcode).toBe("8437010746015");
    expect((await store.offProductByBarcode("8437010746015"))?.name).toBe("Lentejas cocidas");
  });

  it("carries the OFF credit a read-through product owes", async () => {
    withReadKey();
    const { fetchFn } = spyFetch(() => okJson({ items: [resolved()] }));
    const { attribution } = await productByBarcode(deps, "u1", "8437010746015", { fetchFn });
    expect(attribution?.source).toBe("off");
    expect(attribution?.url).toContain("openfoodfacts.org");
  });

  it("a fooddb 404 is a cached miss — a scan loop never re-asks it", async () => {
    withReadKey();
    const { calls, fetchFn } = spyFetch(() => new Response("not found", { status: 404 }));
    const uid = await store.createUser("en");
    expect((await productByBarcode(deps, uid, "4607025392110", { fetchFn })).product).toBeNull();
    expect((await productByBarcode(deps, uid, "4607025392110", { fetchFn })).product).toBeNull();
    expect(calls.length).toBe(1);
  });

  it("a dead fooddb is a clean miss — cached briefly, never a hang or an error", async () => {
    withReadKey();
    const { calls, fetchFn } = spyFetch(() => { throw new Error("connect ECONNREFUSED"); });
    const uid = await store.createUser("en");
    const { product, attribution } = await productByBarcode(deps, uid, "4607025392110", { fetchFn });
    expect(product).toBeNull();
    expect(attribution).toBeNull();
    await productByBarcode(deps, uid, "4607025392110", { fetchFn });
    expect(calls.length).toBe(1);
  });

  it("never asks fooddb without a read key", async () => {
    const { calls, fetchFn } = spyFetch(() => okJson({ items: [resolved()] }));
    const { product } = await productByBarcode(deps, "u1", "8437010746015", { fetchFn });
    expect(product).toBeNull();
    expect(calls.length).toBe(0);
  });

  it("asks with the caller's country when the profile holds a two-letter code", async () => {
    withReadKey();
    const { calls, fetchFn } = spyFetch(() => okJson({ items: [resolved()] }));
    const uid = await store.createUser("en");
    await store.patchProfile(uid, { country: "es" });
    await productByBarcode(deps, uid, "8437010746015", { fetchFn });
    expect(calls[0]).toContain("country=es");
  });

  it("sends no country for 'other' or an unset profile", async () => {
    withReadKey();
    const { calls, fetchFn } = spyFetch(() => okJson({ items: [resolved()] }));
    const other = await store.createUser("en");
    await store.patchProfile(other, { country: "other" });
    await productByBarcode(deps, other, "8437010746015", { fetchFn });
    const unset = await store.createUser("en");
    await productByBarcode(deps, unset, "4607025392110", { fetchFn });
    expect(calls[0]).not.toContain("country=");
    expect(calls[1]).not.toContain("country=");
  });

  it("a product fooddb knows only in core stores under its own source, never 'off'", async () => {
    withReadKey();
    const fdc = { source: "fdc", licence: "CC0-1.0", record: "fdc:2345678" };
    const core = resolved({
      records: ["fdc:2345678"],
      gtin14: [{ ...fdc, value: "08437010746015" }],
      name: { ...fdc, value: "Lentils, canned" },
      brand: { ...fdc, value: "Luengo" },
      lang: { ...fdc, value: "en" },
      serving_text: null, serving_g: null, category: null, flags: null,
      per_100: {
        ENERC_KCAL: { value: 114, unit: "kcal", basis: "100g", source: "fdc", licence: "CC0-1.0", observed_at: "2025-01-01" },
      },
      attribution: [],
    });
    const { fetchFn } = spyFetch(() => okJson({ items: [core] }));
    const { product: p, attribution } = await productByBarcode(deps, "u1", "8437010746015", { fetchFn });
    expect(p?.source).toBe("usda-branded");
    expect(p?.kcal_per_100g).toBe(114);
    // USDA is CC0: no citation is owed, and none is shown.
    expect(attribution).toBeNull();
    expect((await store.offProductByBarcode("8437010746015"))?.source).toBe("usda-branded");
  });

  it("a merged product that OFF data serves keeps the ODbL credit", async () => {
    withReadKey();
    const merged = resolved({
      records: ["fdc:2345678", "off:08437010746015"],
      name: { value: "Lentils, canned", source: "fdc", licence: "CC0-1.0", record: "fdc:2345678" },
    });
    const { fetchFn } = spyFetch(() => okJson({ items: [merged] }));
    const { product: p, attribution } = await productByBarcode(deps, "u1", "8437010746015", { fetchFn });
    expect(p?.name).toBe("Lentils, canned");
    expect(p?.source).toBe("off");
    expect(attribution?.source).toBe("off");
  });

  it("a resolved product with no name is a miss, and stores nothing", async () => {
    withReadKey();
    const { calls, fetchFn } = spyFetch(() => okJson({ items: [resolved({ name: null })] }));
    expect((await productByBarcode(deps, "u1", "8437010746015", { fetchFn })).product).toBeNull();
    expect(await store.offProductByBarcode("8437010746015")).toBeNull();
    expect(calls.length).toBe(1);
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
