// Load a fooddb snapshot export (NDJSON, plain or .gz) into this database's `food_ref`.
//
//   bun src/scripts/foods-load.ts <export.ndjson[.gz]>
//   bun src/scripts/foods-load.ts --from-api [--day YYYY-MM-DD]     the newest final day, from fooddb
//
// `--from-api` reads the key from EAIT__BACKEND__FOODDB_READ_KEY (and the host from
// EAIT__BACKEND__FOODDB_URL, default https://food-api.eait.fit). One export is one read: one credit.
// The key is never printed or put in an argument.
//
// Idempotent: an upsert by id, so a newer day simply overwrites. The database URL comes from
// EAIT__BACKEND__DATABASE_URL and is never printed. Which lines are kept is `foods/snapshot.ts`.

import { gunzipSync } from "node:zlib";
import { loadSnapshotText } from "../backend/foods/snapshot-load.ts";
import { fetchSnapshotExport } from "../backend/foods/snapshot-api.ts";
import { postgresStore } from "../backend/store.pg.ts";

const args = process.argv.slice(2);
const fromApi = args.includes("--from-api");
const dayAt = args.indexOf("--day");
const file = args.find((a, i) => !a.startsWith("--") && (dayAt < 0 || i !== dayAt + 1));
const databaseUrl = process.env.EAIT__BACKEND__DATABASE_URL;
if ((!file && !fromApi) || !databaseUrl) {
  console.error("usage: EAIT__BACKEND__DATABASE_URL=… bun src/scripts/foods-load.ts <export.ndjson[.gz]> | --from-api [--day YYYY-MM-DD]");
  process.exit(1);
}

let text: string;
if (fromApi) {
  const got = await fetchSnapshotExport(process.env.EAIT__BACKEND__FOODDB_READ_KEY ?? "", {
    ...(process.env.EAIT__BACKEND__FOODDB_URL ? { base: process.env.EAIT__BACKEND__FOODDB_URL } : {}),
    ...(dayAt >= 0 && args[dayAt + 1] ? { day: args[dayAt + 1]! } : {}),
  }).catch((e: Error) => { console.error(`[eait] foods-load: ${e.message}`); process.exit(1); });
  console.log(`[eait] foods-load: fetched snapshot ${got.day}`);
  text = got.ndjson;
} else {
  // Whole file in memory (a core day is ~45 MB): readline dropped lines mid-file when awaited inside.
  const bytes = Buffer.from(await Bun.file(file!).arrayBuffer());
  text = (file!.endsWith(".gz") ? gunzipSync(bytes) : bytes).toString("utf8");
}
const store = await postgresStore(databaseUrl);
try {
  const { read, written } = await loadSnapshotText(store, text);
  console.log(`[eait] foods-load: ${read} lines read, ${written} food_ref rows written, ${read - written} skipped`);
} finally {
  await store.close();
}
