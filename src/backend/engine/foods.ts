// The reference food catalog: name search into `food_ref`, barcode lookup into `off_product`.
//
// The catalog is global — the rows belong to nobody, so nothing here is scoped and no query can
// be widened past one account. `productByBarcode` still takes the caller's `userId`, for ONE
// thing only: their profile's `country`, the preference hint fooddb ranks a barcode's records
// by. `onboardingContent` is the same kind of read. The attribution each response carries is
// what the licences (CC BY for the national tables, ODbL for Open Food Facts) require a UI to
// show beside the data.

import {
  FOOD_SEARCH_LIMIT, FOOD_SEARCH_MAX_LIMIT, foodAttributions,
  type FoodSearchResponse, type OffProduct, type ProductResponse,
} from "@eait/shared";
import { fetchFooddbProduct } from "../foods/product-api.ts";
import { offProductFromResolved } from "../foods/product.ts";
import type { EngineDeps } from "./deps.ts";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

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
 *
 * A miss READS THROUGH to fooddb (#639): the OFF layer asked with the caller's `country`, the
 * answer stored in `off_product` and served. A miss on fooddb's side — 404, a refusal, a dead
 * host — is cached briefly, so a scan loop never hammers fooddb for the same code, and the user
 * always gets a clean `null` back, never a hang and never an error string.
 */
export async function productByBarcode(
  deps: EngineDeps, userId: string, barcode: string,
  net: { fetchFn?: Fetch } = {},
): Promise<ProductResponse> {
  const product = (await deps.store.offProductByBarcode(barcode)) ?? (await readThrough(deps, userId, barcode, net));
  return { product, attribution: product ? (foodAttributions([product.source])[0] ?? null) : null };
}

/** Read-through state, per deps instance: the negative cache and the in-flight dedupe. */
interface ReadThrough {
  /** barcode → epoch ms until which fooddb's miss (or failure) is trusted without re-asking. */
  misses: Map<string, number>;
  /** barcode → the fetch already running for it, so parallel scans share one request. */
  inflight: Map<string, Promise<OffProduct | null>>;
}
const readThroughs = new WeakMap<EngineDeps, ReadThrough>();
const rt = (deps: EngineDeps): ReadThrough => {
  let r = readThroughs.get(deps);
  if (!r) readThroughs.set(deps, (r = { misses: new Map(), inflight: new Map() }));
  return r;
};

/** The `country` hint fooddb gets — a two-letter code or nothing, never a raw free-text answer. */
const fooddbCountry = (country: string | null | undefined): string | null =>
  country && /^[a-zA-Z]{2}$/.test(country.trim()) ? country.trim().toLowerCase() : null;

async function readThrough(
  deps: EngineDeps, userId: string, barcode: string, net: { fetchFn?: Fetch },
): Promise<OffProduct | null> {
  if (!deps.config.fooddbReadKey.trim()) return null;
  const state = rt(deps);
  const until = state.misses.get(barcode);
  if (until !== undefined && Date.now() < until) return null;
  const running = state.inflight.get(barcode);
  if (running) return running;
  const work = (async () => {
    try {
      const country = fooddbCountry((await deps.store.getProfile(userId))?.country);
      const item = await fetchFooddbProduct(deps.config.fooddbReadKey, barcode, {
        base: deps.config.fooddbUrl, country,
        timeoutMs: deps.config.fooddbTimeoutMs,
        ...(net.fetchFn ? { fetchFn: net.fetchFn } : {}),
      });
      const row = item ? offProductFromResolved(barcode, item) : null;
      if (!row) return null;
      // The upsert's own precedence rule can still refuse the row — a `label-ocr` read that
      // landed in the meantime wins — so what is answered is what the table now holds.
      await deps.store.putOffProducts([row]);
      return (await deps.store.offProductByBarcode(barcode)) ?? row;
    } catch (e) {
      // Logged, never returned: a scanner's answer to a dead fooddb is an ordinary miss.
      console.error(`[eait] off read-through failed: ${(e as Error)?.message ?? e}`);
      return null;
    }
  })();
  state.inflight.set(barcode, work);
  try {
    const found = await work;
    if (found === null) state.misses.set(barcode, Date.now() + deps.config.fooddbMissTtlMs);
    return found;
  } finally {
    state.inflight.delete(barcode);
  }
}
