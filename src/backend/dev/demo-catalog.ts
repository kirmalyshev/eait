// The catalog rows `--demo` boots with (ieat-app #1954), so the shipping grounding path has one
// row to find. Written against the Store interface like seed.ts; it never touches the demo
// analyzer, which stays as poor as the real one.
//
// ONE row, matching the canned "chicken breast" at the SAME per-100 g the demo already uses
// (165 kcal / 31 P / 0 C / 3.6 F), so no number on any screen or baseline moves. Two attribution
// texts: the merged-source case. "green salad with dressing" has no row on purpose — it is the
// estimate.

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
      "Contains data from Frida (https://frida.fooddata.dk), DTU National Food Institute, made available under CC BY 4.0.",
    ],
  },
];

export async function loadDemoCatalog(store: Store): Promise<void> {
  await store.putFoodRefs([...DEMO_CATALOG]);
}
