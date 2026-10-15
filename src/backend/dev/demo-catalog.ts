// The catalog rows `--demo` boots with (ieat-app #1954), so the shipping grounding path has one
// row to find. Written against the Store interface like seed.ts; it never touches the demo
// analyzer, which stays as poor as the real one.
//
// The first row matches the canned "chicken breast" at the SAME per-100 g the demo already uses
// (165 kcal / 31 P / 0 C / 3.6 F), so no number on any screen or baseline moves. Two attribution
// texts: the merged-source case. "green salad with dressing" has no row on purpose — it is the
// estimate.
//
// The four after it are the food search's (ieat-app#909) results: a fruit, a nut, a grain, each with
// the named serving one tap logs. None of them is a word the canned meals or the e2e's typed meals
// use, so no grounding, and no number anywhere else, moves. CC0 (usda-foundation): no attribution.

import type { FoodRef } from "../../shared/foods.ts";
import type { Store } from "../store.ts";

export const DEMO_CATALOG: readonly FoodRef[] = [
  {
    id: "matvaretabellen:demo-chicken-breast",
    source: "matvaretabellen",
    name: "Chicken breast, grilled",
    name_de: null,
    name_en: "Chicken breast, grilled",
    names: {},
    category: null,
    kcal_per_100g: 165,
    protein_g_per_100g: 31,
    carbs_g_per_100g: 0,
    fat_g_per_100g: 3.6,
    satfat_g_per_100g: null,
    fiber_g_per_100g: null,
    sugar_g_per_100g: null,
    sodium_mg_per_100g: null,
    nutrients: {},
    portions: [],
    source_url: null,
    attribution: [
      "Contains data from Matvaretabellen (https://www.matvaretabellen.no), Norwegian Food Safety Authority, made available under the Norwegian Licence for Open Government Data (NLOD) 2.0.",
      "Frida Food Data (https://frida.fooddata.dk), National Food Institute, Technical University of Denmark. CC BY 4.0.",
    ],
  },
  {
    id: "usda-foundation:demo-banana",
    source: "usda-foundation",
    name: "Banana, raw",
    name_de: null,
    name_en: "Banana, raw",
    names: {},
    category: null,
    kcal_per_100g: 89,
    protein_g_per_100g: 1.1,
    carbs_g_per_100g: 22.8,
    fat_g_per_100g: 0.3,
    satfat_g_per_100g: null,
    fiber_g_per_100g: null,
    sugar_g_per_100g: null,
    sodium_mg_per_100g: null,
    nutrients: {},
    portions: [{ label: "1 medium", grams: 118 }],
    source_url: null,
    attribution: [],
  },
  {
    id: "usda-foundation:demo-apple",
    source: "usda-foundation",
    name: "Apple, raw",
    name_de: null,
    name_en: "Apple, raw",
    names: {},
    category: null,
    kcal_per_100g: 52,
    protein_g_per_100g: 0.3,
    carbs_g_per_100g: 13.8,
    fat_g_per_100g: 0.2,
    satfat_g_per_100g: null,
    fiber_g_per_100g: null,
    sugar_g_per_100g: null,
    sodium_mg_per_100g: null,
    nutrients: {},
    portions: [{ label: "1 medium", grams: 182 }],
    source_url: null,
    attribution: [],
  },
  {
    id: "usda-foundation:demo-almonds",
    source: "usda-foundation",
    name: "Almonds",
    name_de: null,
    name_en: "Almonds",
    names: {},
    category: null,
    kcal_per_100g: 579,
    protein_g_per_100g: 21.2,
    carbs_g_per_100g: 21.6,
    fat_g_per_100g: 49.9,
    satfat_g_per_100g: null,
    fiber_g_per_100g: null,
    sugar_g_per_100g: null,
    sodium_mg_per_100g: null,
    nutrients: {},
    portions: [{ label: "1 handful", grams: 28 }],
    source_url: null,
    attribution: [],
  },
  {
    id: "usda-foundation:demo-oats",
    source: "usda-foundation",
    name: "Oatmeal, cooked",
    name_de: null,
    name_en: "Oatmeal, cooked",
    names: {},
    category: null,
    kcal_per_100g: 71,
    protein_g_per_100g: 2.5,
    carbs_g_per_100g: 12,
    fat_g_per_100g: 1.5,
    satfat_g_per_100g: null,
    fiber_g_per_100g: null,
    sugar_g_per_100g: null,
    sodium_mg_per_100g: null,
    nutrients: {},
    portions: [{ label: "1 cup", grams: 234 }],
    source_url: null,
    attribution: [],
  },
];

export async function loadDemoCatalog(store: Store): Promise<void> {
  await store.putFoodRefs([...DEMO_CATALOG]);
}
