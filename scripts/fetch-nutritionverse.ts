#!/usr/bin/env bun
// Turn a NutritionVerse-Real archive into weighed-meal eval fixtures (#6).
//
// PUBLIC data, NO billed LLM calls, NO auth. Why this dataset is the better baseline: its photos
// are handheld iPhone shots at RANDOM ANGLES of real composed dishes (1-7 ingredients), and its
// ground truth was produced the same way as our own protocol — every ingredient weighed, nutrition
// from packaging or the Canada Nutrient File. Nutrition5k, by contrast, is a fixed overhead rig on
// US cafeteria trays: it measures model capability under conditions no user reproduces, and
// portion is the larger half of our error budget.
//
// Still not Russian/German home cooking — that gap only your own weighed meals close. This narrows
// it; it does not close it.
//
// LICENSE: CC BY-NC-SA 4.0 (Tai et al., 2024) — NON-COMMERCIAL. Fixtures land in the gitignored
// eval/ tree and are never committed or redistributed. If eait ever monetizes, they must go;
// Nutrition5k (CC BY 4.0) carries no such restriction, which is a reason to keep both.
//
//   # once, ~1.1 GB, no account needed:
//   curl -L -o ~/Downloads/nutritionverse-real.zip \
//     https://www.kaggle.com/api/v1/datasets/download/nutritionverse/nutritionverse-real
//
//   bun run scripts/fetch-nutritionverse.ts --archive ~/Downloads/nutritionverse-real.zip
//     [--n 30] [--min-kcal 150] [--dir eval/nutritionverse]
//
// Default --dir is a SUBDIRECTORY on purpose: one eval run over a directory produces one
// aggregate, and averaging cafeteria trays together with handheld home dishes measures neither.
// Re-runs are idempotent — an existing pair counts toward --n and is not re-extracted.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgv } from "../src/argv.ts";
import { labelsAgree, nutritionverseRowToExpectation, type Expectation } from "../src/eval.ts";

const CSV_ENTRY = "*nutritionverse_dish_metadata3.csv";
const COCO_ENTRY = "*_annotations.coco.json";
const IMAGE_GLOB = "*images/dish_*.jpg";

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

let argv;
try {
  argv = parseArgv(process.argv.slice(2), {
    valued: ["archive", "n", "min-kcal", "max-dim", "dir"],
    boolean: [],
  });
} catch (e) {
  fail(`${(e as Error).message} (see the header of this file for usage)`, 2);
}

const archive = argv.values.archive ?? fail("--archive <path-to-zip> is required", 2);
if (!existsSync(archive)) {
  fail(
    `archive not found: ${archive}\n` +
      "  curl -L -o ~/Downloads/nutritionverse-real.zip \\\n" +
      "    https://www.kaggle.com/api/v1/datasets/download/nutritionverse/nutritionverse-real",
  );
}
const num = (name: string, fallback: number, min: number): number => {
  const raw = argv.values[name];
  if (raw === undefined) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < min) fail(`--${name} must be a number >= ${min}`, 2);
  return v;
};
const n = num("n", 30, 1);
const minKcal = num("min-kcal", 150, 0);
// Telegram's largest PhotoSize is 1280 on the long edge, so that is the biggest image the bot ever
// analyzes. The archive ships 3024x4032 (12 MP) originals — evaluating on those measures the model
// on ~9x the pixels production ever sends it, and it is also ~18x slower per call (measured: ~3 min
// vs ~10 s against the 640x480 Nutrition5k set). Downscaling makes the eval match the bot AND makes
// the two datasets comparable on something other than resolution. `--max-dim 0` keeps originals.
const maxDim = num("max-dim", 1280, 0);
const dir = argv.values.dir ?? "eval/nutritionverse";

/**
 * Shrink a written fixture in place to `maxDim` on its long edge. `sips` ships with macOS;
 * ImageMagick covers Linux. Returns false when neither exists, so the caller can say the fixtures
 * are full-resolution rather than let a silent no-op be mistaken for a resize — the whole point is
 * that the eval runs on the resolution production sees, and being wrong about that quietly is
 * worse than not doing it.
 */
async function shrink(path: string, maxDim: number): Promise<boolean> {
  const attempts = [
    ["sips", "-Z", String(maxDim), path, "--out", path],
    ["magick", path, "-resize", `${maxDim}x${maxDim}>`, path],
  ];
  for (const cmd of attempts) {
    try {
      const p = Bun.spawn(cmd, { stdout: "ignore", stderr: "ignore" });
      if ((await p.exited) === 0) return true;
    } catch {
      // binary not on PATH — try the next one
    }
  }
  return false;
}

/** `unzip -p` streams ONE entry to stdout — no temp files, and no need to expand 1.1 GB to take 30. */
async function unzip(args: string[]): Promise<Uint8Array> {
  const p = Bun.spawn(["unzip", ...args], { stdout: "pipe", stderr: "pipe" });
  const [out, err, code] = await Promise.all([
    new Response(p.stdout).arrayBuffer(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  // `unzip` exits 1 for warnings (e.g. some entries skipped) while still producing correct output,
  // so the byte count is the real success test, not the exit code alone.
  if (code > 1 || out.byteLength === 0) {
    fail(`unzip ${args.join(" ")} failed (exit ${code}): ${err.trim().slice(0, 300)}`);
  }
  return new Uint8Array(out);
}

const csv = new TextDecoder().decode(await unzip(["-p", archive, CSV_ENTRY]));
const rows = new Map<string, Expectation>();
const csvItems = new Map<string, string[]>();
let malformed = 0;
for (const line of csv.split("\n").slice(1)) {
  const t = line.trim();
  if (!t) continue;
  try {
    const { dishId, expectation } = nutritionverseRowToExpectation(t);
    // Tiny single-item plates make kcal MAPE meaningless — a 30 kcal miss on a 23 kcal dish reads
    // as 130% error and drowns the meal-sized cases the bot actually sees.
    if (expectation.kcal >= minKcal) {
      rows.set(dishId, expectation);
      // The adapter now keeps the ingredient names (A0), so the agreement gate reads them from the
      // expectation instead of re-slicing the row here. Two copies of that block-head indexing,
      // one carrying a hardcoded 13 against the adapter's NV_BLOCK, could drift apart and leave
      // the gate judging different names than the fixture records.
      csvItems.set(dishId, expectation.items ?? []);
    }
  } catch {
    malformed++;
  }
}
if (rows.size === 0) fail(`no dish rows >=${minKcal} kcal parsed from ${archive}`);

// Segmentation labels, used ONLY to check that each photo shows the food its row claims. A few
// dishes in this archive pair a photo with an unrelated meal's numbers — dish 2 is an apple
// described as bread and lobster. Nothing about those fails on its own: the numbers are
// well-formed and meal-sized, so the model gets scored as badly wrong for reading the picture
// correctly. See `labelsAgree` for why the test is a shared token rather than a shared name.
const coco = JSON.parse(new TextDecoder().decode(await unzip(["-p", archive, COCO_ENTRY]))) as {
  images: { id: number; file_name: string }[];
  annotations: { image_id: number; category_id: number }[];
  categories: { id: number; name: string }[];
};
const categoryName = new Map(coco.categories.map((c) => [c.id, c.name]));
const labelsByImage = new Map<number, Set<string>>();
for (const a of coco.annotations) {
  if (!labelsByImage.has(a.image_id)) labelsByImage.set(a.image_id, new Set());
  labelsByImage.get(a.image_id)!.add(categoryName.get(a.category_id) ?? "");
}
// Richest annotation across the dish's ~4 photos: any single shot may have been partly labelled,
// and an under-labelled photo would fail the gate for a dish that is actually sound.
const imageLabels = new Map<string, Set<string>>();
for (const im of coco.images) {
  const m = /^dish_(\d+)_/.exec(im.file_name);
  const labels = labelsByImage.get(im.id);
  if (!m || !labels) continue;
  const id = m[1]!;
  if ((imageLabels.get(id)?.size ?? 0) < labels.size) imageLabels.set(id, labels);
}

// Group image entries by dish id. Anchored on the TRAILING underscore: "dish_10_" and "dish_100_"
// share a prefix, so a startsWith match would file every dish_100 photo under dish 10 and score it
// against the wrong ground truth — silently, since both are valid dishes.
const listing = new TextDecoder().decode(await unzip(["-Z1", archive, IMAGE_GLOB]));
const imagesByDish = new Map<string, string[]>();
for (const entry of listing.split("\n")) {
  const m = /(^|\/)dish_(\d+)_[^/]*\.jpg$/.exec(entry.trim());
  if (!m) continue;
  const id = m[2]!;
  if (!imagesByDish.has(id)) imagesByDish.set(id, []);
  imagesByDish.get(id)!.push(entry.trim());
}

// Only dishes with BOTH ground truth and a photo are candidates; ~26 of 251 have no image.
// Strided across the sorted id list so the sample spans the dataset rather than clustering at
// dish 1, and sorted numerically so "10" does not land between "1" and "2".
let disagreed = 0;
const usable = [...rows.keys()]
  .filter((id) => imagesByDish.has(id))
  .filter((id) => {
    const agrees = labelsAgree([...(imageLabels.get(id) ?? [])], csvItems.get(id) ?? []);
    if (!agrees) disagreed++;
    return agrees;
  })
  .sort((a, b) => Number(a) - Number(b));
if (usable.length === 0) fail("no dish has both metadata and an image — is this the right archive?");
const stride = Math.max(1, Math.floor(usable.length / n));
const picked: string[] = [];
for (let i = 0; i < usable.length && picked.length < n; i += stride) picked.push(usable[i]!);

console.log(
  `${rows.size} dishes >=${minKcal}kcal · ${usable.length} usable · taking ${picked.length}` +
    (disagreed ? ` · ${disagreed} dropped (photo disagrees with its ground truth)` : "") +
    (malformed ? ` · ${malformed} malformed row(s) skipped` : ""),
);
console.log(`license: CC BY-NC-SA 4.0 — non-commercial, do not commit or redistribute\n`);

mkdirSync(dir, { recursive: true });
let saved = 0;
let noResizer = false;
for (const id of picked) {
  const imgPath = join(dir, `nv_${id}.jpg`);
  const jsonPath = join(dir, `nv_${id}.json`);
  if (existsSync(imgPath) && existsSync(jsonPath)) {
    saved++;
    continue;
  }
  // Deterministic pick among the ~4 photos per dish, so re-running yields the same fixture set and
  // two eval runs stay comparable.
  const entry = [...imagesByDish.get(id)!].sort()[0]!;
  const bytes = await unzip(["-p", archive, entry]);
  const e = rows.get(id)!;
  // JSON first: it is the half that cannot be re-derived, and a photo with no ground truth beside
  // it is an orphan the eval reports. Same ordering rule as add-fixture.ts.
  writeFileSync(jsonPath, `${JSON.stringify(e)}\n`);
  writeFileSync(imgPath, bytes);
  if (maxDim > 0 && !(await shrink(imgPath, maxDim))) noResizer = true;
  saved++;
  const kb = Math.round(Bun.file(imgPath).size / 1024);
  console.log(`  nv_${id}: kcal=${e.kcal} grams=${e.total_grams} (${kb}kb)`);
}

if (noResizer) {
  console.warn(
    `\nWARNING: neither sips nor ImageMagick found — fixtures are FULL RESOLUTION (12 MP).\n` +
      `  The bot only ever sees ~${maxDim}px (Telegram's largest PhotoSize), so these numbers are\n` +
      `  not what production would produce, and each call is far slower. Install ImageMagick, or\n` +
      `  pass --max-dim 0 to accept full resolution deliberately.`,
  );
}
console.log(`\n${saved} fixture pair(s) in ${dir}/`);
console.log(`run it: OPENROUTER_API_KEY=... bun run scripts/eval-meals.ts --dir ${dir}`);
