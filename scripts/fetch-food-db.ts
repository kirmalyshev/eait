#!/usr/bin/env bun
// Build the local food-composition table (#8) from public datasets. FREE, no account, no API key,
// no billed calls — plain HTTPS downloads of public-domain data.
//
//   bun run scripts/fetch-food-db.ts            # ~9 MB download, writes data/food-db/foods.jsonl
//   bun run scripts/fetch-food-db.ts --sources sr_legacy
//   bun run scripts/fetch-food-db.ts --out data/food-db/foods.jsonl --keep-archives
//
// SOURCE. USDA FoodData Central, SR Legacy + Foundation Foods. Chosen because it is the only major
// table that is simultaneously PUBLIC DOMAIN (no attribution or share-alike obligation on
// self-hosters), bulk-downloadable, and English — which is the lookup notation (see src/food_db.ts).
// Values are already per 100 g.
//
// Deliberately NOT included, and why, so nobody re-derives these decisions:
//   - BLS 4.0 (German, 7,140 foods incl. prepared dishes) is free to USE but has no bulk download
//     or API — website search only. Higher relevance for German food; not scriptable today.
//   - Open Food Facts covers packaged/branded products under ODbL, whose share-alike terms attach
//     to a redistributed derived database. Worth adding for barcode items, as its own source.
//   - Russia has no open machine-readable table. See docs/NUTRITION_DB.md.
//
// Idempotent: an existing archive is reused unless --refresh. Output is a JSONL file, one FoodRow
// per line, in the gitignored data/ tree — never committed.

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgv } from "../src/argv.ts";
import {
  NUTRIENT_IDS,
  cofidFoodRow,
  parseCsvLine,
  parseXlsxSheet,
  usdaFoodRow,
  type FoodRow,
} from "../src/food_db.ts";

// `dataType` is NOT decoration. Each archive's food.csv carries every row type FDC uses, and only
// one of them is a food: the Foundation archive holds 411 `foundation_food` rows among 62k lab
// sub-samples, 7.2k market acquisitions and 3.7k sample records. Without this filter the importer
// treats acquisition paperwork as edible and reports tens of thousands of "skipped" entries that
// were never candidates.
const SOURCES = {
  sr_legacy: {
    url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip",
    label: "USDA SR Legacy (~7.8k generic foods)",
    dataType: "sr_legacy_food",
  },
  foundation: {
    url: "https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_foundation_food_csv_2025-04-24.zip",
    label: "USDA Foundation Foods (lab-analysed core foods)",
    dataType: "foundation_food",
  },
} as const;

// CoFID is a different shape (one xlsx, not a CSV bundle) and earns its own path. It is here for
// one reason: a meal photo shows DISHES, and USDA is an ingredient table. CoFID carries composite
// dishes under names a model actually emits — "Lasagne, homemade", "Shepherd's pie, homemade",
// "Risotto, chicken, homemade" — which is coverage USDA cannot provide at any matching quality.
// Open Government Licence v3: reuse including commercial, so self-hosters inherit no obligation.
const COFID = {
  url:
    "https://assets.publishing.service.gov.uk/media/60538b91e90e07527df82ae4/" +
    "McCance_Widdowsons_Composition_of_Foods_Integrated_Dataset_2021..xlsx",
  label: "UK CoFID (McCance & Widdowson) — ~3,300 foods INCLUDING prepared dishes",
  /** "1.3 Proximates" — energy and macros. Other sheets carry vitamins/inorganics we do not use. */
  sheetName: "1.3 Proximates",
  /** Rows 1-3 are a three-line header (long names, short codes, units) before any food. */
  headerRows: 3,
} as const;
type SourceName = keyof typeof SOURCES;

function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

let argv;
try {
  argv = parseArgv(process.argv.slice(2), {
    valued: ["sources", "out", "cache"],
    boolean: ["refresh", "keep-archives"],
  });
} catch (e) {
  fail(`${(e as Error).message} (see the header of this file for usage)`, 2);
}

const ALL_SOURCES = [...Object.keys(SOURCES), "cofid"];
const requested = (argv.values.sources ?? ALL_SOURCES.join(","))
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
for (const s of requested) {
  if (!ALL_SOURCES.includes(s)) fail(`unknown source "${s}" — known: ${ALL_SOURCES.join(", ")}`, 2);
}
if (requested.length === 0) fail("--sources listed no usable source names", 2);
const out = argv.values.out ?? "data/food-db/foods.jsonl";
const cacheDir = argv.values.cache ?? "data/food-db/cache";

async function run(cmd: string[]): Promise<Uint8Array> {
  const p = Bun.spawn(cmd, { stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(p.stdout).arrayBuffer(),
    new Response(p.stderr).text(),
    p.exited,
  ]);
  // unzip exits 1 on non-fatal warnings while still producing correct output, so byte count is the
  // real success test.
  if (code > 1 || stdout.byteLength === 0) {
    fail(`${cmd[0]} failed (exit ${code}): ${stderr.trim().slice(0, 300)}`);
  }
  return new Uint8Array(stdout);
}

mkdirSync(cacheDir, { recursive: true });
mkdirSync(dirname(out), { recursive: true });

const rows: FoodRow[] = [];
const seen = new Set<string>();
let skippedNoEnergy = 0;

for (const name of requested.filter((s) => s in SOURCES) as SourceName[]) {
  const src = SOURCES[name];
  const zip = join(cacheDir, `${name}.zip`);
  if (existsSync(zip) && !argv.flags.has("refresh")) {
    console.log(`${name}: using cached ${zip}`);
  } else {
    console.log(`${name}: downloading ${src.label}`);
    const res = await fetch(src.url);
    if (!res.ok) fail(`${name}: download failed — HTTP ${res.status} for ${src.url}`);
    writeFileSync(zip, new Uint8Array(await res.arrayBuffer()));
  }

  // The two CSVs we need. `-p` streams one entry to stdout, so the 35 MB nutrient table is never
  // written to disk uncompressed.
  const foodCsv = new TextDecoder().decode(await run(["unzip", "-p", zip, "*/food.csv"]));
  const nutrientCsv = new TextDecoder().decode(await run(["unzip", "-p", zip, "*/food_nutrient.csv"]));

  // fdc_id -> description. Column positions are read from the header rather than assumed: the
  // 2018 and 2025 releases are the same shape today, but a reordered column would otherwise
  // silently swap descriptions for category ids.
  const foodLines = foodCsv.split("\n");
  const foodHeader = parseCsvLine(foodLines[0] ?? "");
  const idCol = foodHeader.indexOf("fdc_id");
  const descCol = foodHeader.indexOf("description");
  const typeCol = foodHeader.indexOf("data_type");
  if (idCol === -1 || descCol === -1 || typeCol === -1) {
    fail(
      `${name}: food.csv is missing fdc_id/description/data_type — header was [${foodHeader.join(", ")}]`,
    );
  }
  const description = new Map<string, string>();
  let nonFood = 0;
  for (const line of foodLines.slice(1)) {
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    if (!f[idCol] || !f[descCol]) continue;
    if (f[typeCol] !== src.dataType) {
      nonFood++; // lab sub-sample, market acquisition, etc — see the SOURCES comment
      continue;
    }
    description.set(f[idCol]!, f[descCol]!);
  }
  if (description.size === 0) {
    fail(
      `${name}: no rows of data_type "${src.dataType}" in food.csv — the release layout may have changed`,
    );
  }

  const nutrientLines = nutrientCsv.split("\n");
  const nHeader = parseCsvLine(nutrientLines[0] ?? "");
  const nFdc = nHeader.indexOf("fdc_id");
  const nId = nHeader.indexOf("nutrient_id");
  const nAmount = nHeader.indexOf("amount");
  if (nFdc === -1 || nId === -1 || nAmount === -1) {
    fail(`${name}: food_nutrient.csv is missing expected columns — header was [${nHeader.join(", ")}]`);
  }
  const wanted = new Set<number>(Object.values(NUTRIENT_IDS));
  const amounts = new Map<string, Map<number, number>>();
  for (const line of nutrientLines.slice(1)) {
    if (!line.trim()) continue;
    const f = parseCsvLine(line);
    const nutrientId = Number(f[nId]);
    if (!wanted.has(nutrientId)) continue; // 8 of ~150 nutrients; skip the rest before parsing more
    const fdcId = f[nFdc]!;
    const amount = Number(f[nAmount]);
    if (!Number.isFinite(amount)) continue;
    if (!amounts.has(fdcId)) amounts.set(fdcId, new Map());
    amounts.get(fdcId)!.set(nutrientId, amount);
  }

  let added = 0;
  for (const [fdcId, desc] of description) {
    const row = usdaFoodRow(fdcId, desc, amounts.get(fdcId) ?? new Map());
    if (!row) {
      skippedNoEnergy++;
      continue;
    }
    // Foundation and SR Legacy overlap; first source wins so re-ordering --sources cannot silently
    // change which row a name resolves to.
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
    added++;
  }
  console.log(
    `${name}: ${added} foods with energy (${description.size} of data_type ${src.dataType}` +
      (nonFood ? `, ${nonFood} non-food rows ignored` : "") + ")",
  );
  if (!argv.flags.has("keep-archives")) rmSync(zip, { force: true });
}

if (requested.includes("cofid")) {
  const zip = join(cacheDir, "cofid.xlsx");
  if (existsSync(zip) && !argv.flags.has("refresh")) {
    console.log(`cofid: using cached ${zip}`);
  } else {
    console.log(`cofid: downloading ${COFID.label}`);
    const res = await fetch(COFID.url);
    if (!res.ok) fail(`cofid: download failed — HTTP ${res.status}`);
    writeFileSync(zip, new Uint8Array(await res.arrayBuffer()));
  }

  // An xlsx IS a zip of XML, so the same `unzip -p` streaming works. The sheet is found by NAME via
  // workbook.xml + its rels rather than by guessing a file number: sheet order is not part of the
  // format's contract, and silently reading the wrong sheet would import vitamin columns as macros.
  const workbook = new TextDecoder().decode(await run(["unzip", "-p", zip, "xl/workbook.xml"]));
  const rid = new RegExp(`<sheet name="${COFID.sheetName}"[^>]*r:id="(rId\\d+)"`).exec(workbook)?.[1];
  if (!rid) fail(`cofid: sheet "${COFID.sheetName}" not found — the release layout may have changed`);
  const rels = new TextDecoder().decode(await run(["unzip", "-p", zip, "xl/_rels/workbook.xml.rels"]));
  const target = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(rels)?.[1];
  if (!target) fail(`cofid: no relationship for ${rid}`);

  const sharedXml = new TextDecoder().decode(await run(["unzip", "-p", zip, "xl/sharedStrings.xml"]));
  // <si> may hold several <t> runs (rich text); joining them keeps the whole food name.
  const shared = [...sharedXml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((si) =>
    [...si[1]!.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((t) => t[1]!).join(""),
  );
  const sheetXml = new TextDecoder().decode(await run(["unzip", "-p", zip, `xl/${target}`]));

  let added = 0;
  let skipped = 0;
  for (const cells of parseXlsxSheet(sheetXml, shared).slice(COFID.headerRows)) {
    const row = cofidFoodRow(cells);
    if (!row) {
      skipped++;
      continue;
    }
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    rows.push(row);
    added++;
  }
  if (added === 0) fail("cofid: parsed no foods — the sheet layout may have changed");
  console.log(`cofid: ${added} foods with energy${skipped ? ` (${skipped} rows without usable energy)` : ""}`);
  if (!argv.flags.has("keep-archives")) rmSync(zip, { force: true });
}

if (rows.length === 0) fail("no foods parsed — the source layout may have changed");

rows.sort((a, b) => a.id.localeCompare(b.id));
writeFileSync(out, rows.map((r) => JSON.stringify(r)).join("\n") + "\n");

const bytes = readFileSync(out).length;
console.log(`\n${rows.length} foods → ${out} (${Math.round(bytes / 1024)} kb)`);
if (skippedNoEnergy) {
  // Announced, not hidden: these are mostly water/spice entries with no energy row, but a large
  // count would mean the nutrient join broke rather than that the data is sparse.
  console.log(`${skippedNoEnergy} entries skipped for having no usable energy value`);
}
// Provenance must name every source actually included: USDA is public domain, CoFID is OGL v3
// and carries an attribution requirement. Printing only the first would understate the obligation.
const used = requested.map((s) => (s === "cofid" ? "UK CoFID (Open Government Licence v3 — attribution required)" : "USDA FoodData Central (public domain)"));
console.log(`sources: ${[...new Set(used)].join(" + ")}`);
