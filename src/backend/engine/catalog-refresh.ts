// Keep `food_ref` current with fooddb's newest final snapshot.
//
// One pull per new day: the day is checked first (a cheap list call) and the export, ~45 MB, is
// fetched only when it is a day this process has not loaded. A deploy restarts the process and
// forgets the day, so the first refresh after one reloads once: an idempotent upsert, no harm done.
// ROWS A SNAPSHOT NO LONGER HOLDS ARE NOT REMOVED: a food that fooddb merged away stays matchable
// here, which costs a stale row at worst and cannot cost a meal.
//
// A refusal or an outage is a RESULT, never a throw: the catalog refines answers the model already
// gave, so its being stale must not be able to take anything else down. No message here includes
// the key (`snapshot-api.ts` never puts it in one).

import { loadSnapshotText } from "../foods/snapshot-load.ts";
import { fetchSnapshotExport, newestFinalDay } from "../foods/snapshot-api.ts";
import type { EngineDeps } from "./deps.ts";

export type CatalogRefresh =
  | { kind: "no-key" }
  | { kind: "unchanged"; day: string }
  | { kind: "loaded"; day: string; read: number; written: number }
  | { kind: "failed"; message: string };

export async function refreshCatalog(
  deps: Pick<EngineDeps, "store">,
  opts: { key: string; base?: string; lastDay?: string | undefined; fetchFn?: (url: string, init?: RequestInit) => Promise<Response> },
): Promise<CatalogRefresh> {
  if (!opts.key.trim()) return { kind: "no-key" };
  const net = { ...(opts.base ? { base: opts.base } : {}), ...(opts.fetchFn ? { fetchFn: opts.fetchFn } : {}) };
  try {
    const day = await newestFinalDay(opts.key, net);
    if (day === opts.lastDay) return { kind: "unchanged", day };
    const got = await fetchSnapshotExport(opts.key, { ...net, day });
    return { kind: "loaded", day, ...(await loadSnapshotText(deps.store, got.ndjson)) };
  } catch (e) {
    return { kind: "failed", message: (e as Error).message };
  }
}
