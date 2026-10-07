// Load a fooddb snapshot export (NDJSON, plain or .gz) into this database's `food_ref`.
//
//   bun src/scripts/foods-load.ts <export.ndjson[.gz]>
//
// Idempotent: an upsert by id, so a newer day simply overwrites. The database URL comes from
// EAIT__BACKEND__DATABASE_URL and is never printed. Which lines are kept is `foods/snapshot.ts`.

import { gunzipSync } from "node:zlib";
import type { FoodRef } from "../shared/index.ts";
import { foodRefFromSnapshotLine, type SnapshotLine } from "../backend/foods/snapshot.ts";
import { postgresStore } from "../backend/store.pg.ts";

const file = process.argv[2];
const databaseUrl = process.env.EAIT__BACKEND__DATABASE_URL;
if (!file || !databaseUrl) {
  console.error("usage: EAIT__BACKEND__DATABASE_URL=… bun src/scripts/foods-load.ts <export.ndjson[.gz]>");
  process.exit(1);
}

// Whole file in memory (a core day is ~45 MB): readline dropped lines mid-file when awaited inside.
const bytes = Buffer.from(await Bun.file(file).arrayBuffer());
const lines = (file.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8").split("\n");
const store = await postgresStore(databaseUrl);
try {
  let read = 0, written = 0, batch: FoodRef[] = [];
  const flush = async () => { if (batch.length) written += await store.putFoodRefs(batch); batch = []; };
  for (const text of lines) {
    if (!text.trim()) continue;
    read++;
    const row = foodRefFromSnapshotLine(JSON.parse(text) as SnapshotLine);
    if (row) batch.push(row);
    if (batch.length >= 500) await flush();
  }
  await flush();
  console.log(`[eait] foods-load: ${read} lines read, ${written} food_ref rows written, ${read - written} skipped`);
} finally {
  await store.close();
}
