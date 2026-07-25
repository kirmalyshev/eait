#!/usr/bin/env bun
// Record ONE weighed meal as an eval fixture (issue #6). Free and offline — no LLM call, no
// network, nothing billed. `eval-meals.ts` is the script that spends money; this one only writes
// the ground truth it reads.
//
//   bun run scripts/add-fixture.ts --photo ~/Downloads/IMG_4821.jpg --name 2026-07-26-lunch \
//     "chicken breast: 180" "rice, cooked: 210" "olive oil: 12" "cucumber: 90"
//
//   --photo <path>   the meal photo, taken BEFORE eating (jpg/jpeg/png/webp)
//   --name <stem>    fixture name; becomes eval/<stem>.<ext> + eval/<stem>.json
//   --dir <dir>      fixture dir (default: eval, gitignored)
//   --dry-run        print the computed ground truth, write nothing
//   --force          overwrite an existing fixture of the same name
//   --foods          print the food table and exit
//
// Component syntax — one quoted argument per weighed item:
//   "chicken breast: 180"            grams on the scale, composition from the food table
//   "pelmeni: 250 @ 275"             kcal per 100 g, off the package label
//   "kefir 1%: 250 @ 40/3.4/4/1"     kcal/protein/carbs/fat per 100 g, off the label
//
// The photo is COPIED into the fixture dir, never moved — the original stays where it was.

import { copyFileSync, existsSync, mkdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { FOOD_TABLE, buildExpectation, parseComponent } from "../src/fixture.ts";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

// Same contract as eval-meals.ts: a flag with no value is a typo, not a request for the default.
function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1) return fallback;
  const value = process.argv[i + 1];
  if (!value || value.startsWith("--")) fail(`--${name} was given with no value`);
  return value;
}
const flag = (name: string): boolean => process.argv.includes(`--${name}`);

if (flag("foods")) {
  console.log(`${FOOD_TABLE.length} foods, per 100 g as served (kcal · protein/carbs/fat):\n`);
  for (const f of FOOD_TABLE) {
    const p = f.per100;
    const aliases = f.aliases?.length ? `  [${f.aliases.join(", ")}]` : "";
    console.log(
      `  ${f.name.padEnd(34)} ${String(p.kcal).padStart(4)} · ` +
        `${p.protein_g}/${p.carbs_g}/${p.fat_g}${aliases}`,
    );
  }
  console.log("\nAnything not listed takes its numbers inline: \"name: grams @ kcal/protein/carbs/fat\"");
  process.exit(0);
}

const photo = arg("photo") ?? fail("--photo <path> is required (see the header of this file)");
const dir = arg("dir", "eval")!;
// Everything that is not a flag or a flag's value is a weighed component.
const flagsWithValues = new Set(["--photo", "--name", "--dir"]);
const components = process.argv.slice(2).filter((a, i, all) => {
  const prev = all[i - 1];
  return !a.startsWith("--") && !(prev && flagsWithValues.has(prev));
});
if (components.length === 0) {
  fail('no weighed components given — e.g. "chicken breast: 180" "rice, cooked: 210"');
}

if (!existsSync(photo) || !statSync(photo).isFile()) fail(`photo not found: ${photo}`);
const ext = extname(photo).toLowerCase();
// Must match the IMAGE_EXT pairing rule in src/eval.ts — an extension the eval does not recognize
// would leave the .json an orphan and the case would never run.
if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
  fail(`unsupported image extension "${ext}" — the eval pairs .jpg/.jpeg/.png/.webp only`);
}

// Default the name from the photo, but keep it filesystem-safe: this string becomes a path, and a
// "../" in it would write outside the fixture dir.
const name = arg("name") ?? basename(photo, extname(photo));
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
  fail(`--name must be alphanumeric with . _ - (got "${name}") — it becomes a filename`);
}

const imagePath = join(dir, `${name}${ext}`);
const jsonPath = join(dir, `${name}.json`);
// Checked BEFORE the numbers are computed and printed: this is a complaint about the name, and
// printing a full breakdown that is then refused reads as if the numbers were the problem. Ground
// truth is expensive to produce and impossible to reconstruct once the meal is eaten, so
// overwriting is opt-in — a silent clobber here destroys a measurement, not a build artifact.
if (!flag("dry-run") && !flag("force") && (existsSync(imagePath) || existsSync(jsonPath))) {
  fail(`fixture "${name}" already exists in ${dir}/ — pick another --name, or pass --force`);
}

// Parse every component before touching the filesystem, so a typo in the last one does not leave a
// half-written fixture (a copied photo with no ground truth is an orphan the eval would report).
let parsed;
let expectation;
try {
  parsed = components.map(parseComponent);
  expectation = buildExpectation(components);
} catch (e) {
  fail(`${(e as Error).message}`);
}

const totalGrams = expectation.total_grams!;
console.log(`fixture: ${name}  (${parsed.length} weighed component(s))\n`);
for (const c of parsed) {
  const kcal = (c.per100.kcal * c.grams) / 100;
  // Share of the meal's calories: the number that makes a mistyped weight obvious. "olive oil 120 g"
  // instead of 12 g reads as a plausible line on its own, and as 60% of lunch in this column.
  const share = (kcal / expectation.kcal) * 100;
  console.log(
    `  ${c.name.padEnd(30)} ${String(c.grams).padStart(6)} g  ` +
      `${String(Math.round(kcal)).padStart(5)} kcal  ${share.toFixed(0).padStart(3)}%`,
  );
}
console.log(`\n  ${"TOTAL".padEnd(30)} ${String(totalGrams).padStart(6)} g  ${String(expectation.kcal).padStart(5)} kcal`);
const macros = (["protein_g", "carbs_g", "fat_g"] as const)
  .map((m) => `${m.replace("_g", "")} ${expectation[m] ?? "n/a"}`)
  .join(" · ");
console.log(`  ${" ".repeat(30)} ${macros}`);
if (expectation.protein_g === undefined) {
  // Not an error: kcal + grams alone is a perfectly good fixture, and the eval reports macros only
  // for cases that declare them. But it is worth knowing you gave one up.
  console.log("  note: at least one component declared kcal only, so macros are omitted entirely");
}

// Plausibility, as a warning rather than a rule: pure fat is 9 kcal/g and nuts reach ~5.8, so a
// meal above 6 almost always means a weight was entered in the wrong unit (ounces, or a missing
// digit). Below 0.2 means the opposite. Neither is impossible, so neither blocks the write.
const density = expectation.kcal / totalGrams;
if (density > 6 || density < 0.2) {
  console.log(
    `  WARNING: ${density.toFixed(1)} kcal/g is outside the plausible range for a meal — ` +
      "check the weights (grams, not ounces) before trusting this as ground truth",
  );
}

if (flag("dry-run")) {
  console.log("\n--dry-run: nothing written");
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
copyFileSync(photo, imagePath);
writeFileSync(jsonPath, `${JSON.stringify(expectation)}\n`);
console.log(`\nwrote ${imagePath} + ${jsonPath}`);
console.log(`run it: OPENROUTER_API_KEY=... bun run scripts/eval-meals.ts --dir ${dir}`);
