// One barcoded product from fooddb, fetched live — the read-through half of the OFF layer (#639).
//
// `snapshot-api.ts` pulls the whole catalog on a new `built_at` (checked hourly); this answers a
// single barcode that `off_product` missed, on the scan path — so it is held to a SHORT timeout
// and a 404 is an ordinary answer, not an error. `include=off` asks for the core+off layers, the
// only way a barcode the core tables also know (an fdc branded row) is found. `country` is a
// preference hint only: a fooddb without the parameter ignores the query, so the call works
// either way.
// The key travels in the Authorization header and nowhere else; no message here includes it,
// a header or the URL's query.

import { FOODDB_URL_DEFAULT } from "./snapshot-api.ts";

type Fetch = (url: string, init?: RequestInit) => Promise<Response>;

/** What a refusal says, by status. 404 is a miss and never reaches this map. */
const REFUSED: Record<number, string> = {
  401: "the read key was refused (EAIT__BACKEND__FOODDB_READ_KEY)",
  402: "the account is out of credits - buy a pack in the fooddb portal",
  403: "the key has no read scope",
  422: "fooddb refused the request",
};

/** A served field: its value with the source, licence and record it was resolved from. */
interface Tagged<T> { value: T; source?: string; licence?: string; record?: string | null }

/**
 * The product fooddb's resolver answers with — the same per-field shape a snapshot line carries,
 * plus the records it was merged from and the nutrient values under `per_100` by INFOODS tagname.
 * Every field is optional: a barcode can resolve to very little.
 */
export interface ResolvedProduct {
  id?: number;
  records?: string[];
  gtin14?: Tagged<string>[];
  snapshot?: string | null;
  name?: Tagged<string> | null;
  brand?: Tagged<string> | null;
  lang?: Tagged<string> | null;
  serving_text?: Tagged<string> | null;
  serving_g?: Tagged<number> | null;
  category?: Tagged<string> | null;
  flags?: Tagged<string[]> | null;
  per_100?: Record<string, { value?: number; unit?: string; basis?: string; source?: string }>;
  attribution?: { source?: string; licence?: string; text?: string }[];
  seals?: unknown;
}

/**
 * The product behind `barcode`, or null when fooddb does not know it. Throws on a refusal, a
 * server error or a dead host — the caller decides what a failure means; a miss is not one.
 */
export async function fetchFooddbProduct(
  key: string,
  barcode: string,
  opts: { base?: string; country?: string | null; timeoutMs?: number; fetchFn?: Fetch } = {},
): Promise<ResolvedProduct | null> {
  if (!key.trim()) throw new Error("no fooddb read key: set EAIT__BACKEND__FOODDB_READ_KEY");
  const base = (opts.base ?? FOODDB_URL_DEFAULT).replace(/\/+$/, "");
  const params = new URLSearchParams({ include: "off" });
  if (opts.country) params.set("country", opts.country);
  const res = await (opts.fetchFn ?? fetch)(`${base}/v1/products/${encodeURIComponent(barcode)}?${params}`, {
    headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
    signal: opts.timeoutMs !== undefined ? AbortSignal.timeout(opts.timeoutMs) : null,
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fooddb ${res.status}: ${REFUSED[res.status] ?? "request failed"}`);
  const body = (await res.json()) as { items?: ResolvedProduct[] };
  return body.items?.[0] ?? null;
}
