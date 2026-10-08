// A snapshot's NDJSON text into `food_ref`: the one loop the script and the daily refresh share.

import type { FoodRef } from "../../shared/index.ts";
import type { Store } from "../store.ts";
import { foodRefFromSnapshotLine, type SnapshotLine } from "./snapshot.ts";

const BATCH = 500;

/** Upserts every kept line; an upsert by id, so loading the same text twice changes nothing. */
export async function loadSnapshotText(store: Pick<Store, "putFoodRefs">, text: string): Promise<{ read: number; written: number }> {
  let read = 0, written = 0, batch: FoodRef[] = [];
  const flush = async () => { if (batch.length) written += await store.putFoodRefs(batch); batch = []; };
  for (const line of text.split("\n")) {
    if (!line.trim()) continue;
    read++;
    const row = foodRefFromSnapshotLine(JSON.parse(line) as SnapshotLine);
    if (row) batch.push(row);
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  return { read, written };
}
