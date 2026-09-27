// The reference food catalog: name search into `food_ref`, barcode lookup into `off_product`.
//
// Neither function takes a `userId` — the catalog is global, so there is nothing to scope and no
// query here that could be widened past one account. `onboardingContent` is the same kind of read.
// The attribution each response carries is what the licences (CC BY for the national tables, ODbL
// for Open Food Facts) require a UI to show beside the data.

import {
  FOOD_SEARCH_LIMIT, FOOD_SEARCH_MAX_LIMIT, foodAttributions,
  type FoodSearchResponse, type ProductResponse,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";

/**
 * Name search over the generic-food catalog. `limit` is clamped here rather than trusted from the
 * route, so no caller can turn a search into a table scan by asking for more.
 */
export async function foodSearch(deps: EngineDeps, query: string, limit?: number): Promise<FoodSearchResponse> {
  const cap = limit === undefined
    ? FOOD_SEARCH_LIMIT
    : Math.min(Math.max(Math.floor(limit), 1), FOOD_SEARCH_MAX_LIMIT);
  const foods = await deps.store.searchFoods(query.trim(), cap);
  return { foods, attributions: foodAttributions(foods.map((f) => f.source)) };
}

/**
 * One barcoded product, or `product: null`. The barcode arrives already normalised — the route
 * runs `normalizeBarcode` and answers 400 on what is not a product code — because the normalizer
 * is shared and both sides agree on what a barcode IS before a query is ever made.
 */
export async function productByBarcode(deps: EngineDeps, barcode: string): Promise<ProductResponse> {
  const product = await deps.store.offProductByBarcode(barcode);
  return { product, attribution: product ? (foodAttributions([product.source])[0] ?? null) : null };
}
