#!/usr/bin/env bun
// Fetch a Nutrition5k sample as weighed-meal eval fixtures — the zero-effort accuracy baseline
// for the model A/B (#7), pending real weighed home meals (#6).
//
// PUBLIC data, NO billed LLM calls, NO auth: pulls overhead RGB photos + dish macros from the
// public GCS bucket into the gitignored eval/ dir. Nutrition5k is Google-cafeteria (Western)
// food, so this measures MODEL CAPABILITY, not eait's Russian/German home cuisine — the real
// weighed meals stay the cuisine-calibration layer. CC BY 4.0 (Thames et al., CVPR 2021).
//
//   bun run scripts/fetch-nutrition5k.ts [--n 30] [--min-kcal 150] [--dir eval] [--meta eval/_meta]
//
// --min-kcal drops Nutrition5k's many tiny single-ingredient "dishes" (a 3 kcal plate makes kcal
// MAPE meaningless — a 30 kcal guess reads as 900% error), keeping the sample meal-representative.
// Set --min-kcal 0 to disable. Prereq: the two dish-metadata CSVs already in --meta
// (dish_metadata_cafe{1,2}.csv). Re-runs are idempotent — an existing <dish>.png + <dish>.json
// pair counts toward --n and is not re-fetched.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type Expectation, nutrition5kRowToExpectation } from "../src/eval.ts";

const BASE = "https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset";
const imageUrl = (dishId: string) => `${BASE}/imagery/realsense_overhead/${dishId}/rgb.png`;

function arg(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1]! : fallback;
}

const n = Number(arg("n", "30"));
if (!Number.isInteger(n) || n < 1) {
  console.error("--n must be a positive integer");
  process.exit(1);
}
const minKcal = Number(arg("min-kcal", "150"));
if (!Number.isFinite(minKcal) || minKcal < 0) {
  console.error("--min-kcal must be a non-negative number");
  process.exit(1);
}
const dir = arg("dir", "eval");
const metaDir = arg("meta", "eval/_meta");

// Parse every dish row from both cafes. Malformed lines are skipped (not fatal) — the CSV's
// trailing blank line and any short/garbage row are filtered here rather than poisoning fixtures.
const rows: { dishId: string; expectation: Expectation }[] = [];
for (const csv of ["dish_metadata_cafe1.csv", "dish_metadata_cafe2.csv"]) {
  const path = join(metaDir, csv);
  if (!existsSync(path)) {
    console.error(
      `missing ${path} — download it first:\n` +
        `  curl -s -o ${path} ${BASE}/metadata/${csv}`,
    );
    process.exit(1);
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t) continue;
    try {
      const parsed = nutrition5kRowToExpectation(t);
      if (parsed.expectation.kcal >= minKcal) rows.push(parsed); // drop tiny single-ingredient plates
    } catch {
      // malformed dish row — skip, don't abort the whole pull
    }
  }
}
if (rows.length === 0) {
  console.error(`no parseable dish rows in ${metaDir}/ — are the CSVs intact?`);
  process.exit(1);
}

// Deterministic, spread-out candidate order: stride across the sorted list so the sample spans
// the whole dataset, not the first N clustered dishes. Oversample 3× because only ~70% of dishes
// carry an overhead RGB image (the RealSense subset); the rest are probed and skipped.
rows.sort((a, b) => a.dishId.localeCompare(b.dishId));
const stride = Math.max(1, Math.floor(rows.length / (n * 3)));
const candidates: typeof rows = [];
for (let i = 0; i < rows.length; i += stride) candidates.push(rows[i]!);

console.log(
  `${rows.length} dishes >=${minKcal}kcal · ${candidates.length} strided candidates · target ${n}\n`,
);

let saved = 0;
let probed = 0;
let imageless = 0;
for (const c of candidates) {
  if (saved >= n) break;
  const imgPath = join(dir, `${c.dishId}.png`);
  const jsonPath = join(dir, `${c.dishId}.json`);
  if (existsSync(imgPath) && existsSync(jsonPath)) {
    saved++; // already pulled on a prior run — counts toward --n, don't re-fetch
    continue;
  }
  probed++;
  const res = await fetch(imageUrl(c.dishId));
  if (!res.ok) {
    imageless++; // no overhead RGB for this dish — expected for ~30% of them
    continue;
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  writeFileSync(imgPath, bytes);
  writeFileSync(jsonPath, JSON.stringify(c.expectation) + "\n");
  saved++;
  console.log(`  ${c.dishId}: kcal=${c.expectation.kcal} grams=${c.expectation.total_grams} (${bytes.length}b)`);
}

console.log(
  `\n${saved} fixture pair(s) in ${dir}/ — probed ${probed}, ${imageless} imageless-skipped`,
);
if (saved < n) {
  console.warn(
    `only ${saved}/${n} pulled — candidate pool exhausted; the imageless rate ran high. ` +
      `Re-run to widen the stride, or lower --n.`,
  );
}
