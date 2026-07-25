#!/usr/bin/env bun
// Record ONE weighed meal as an eval fixture (issue #6). Free and offline — no LLM call, no
// network, nothing billed. `eval-meals.ts` is the script that spends money; this one only writes
// the ground truth it reads.
//
//   bun run scripts/add-fixture.ts --dir eval/weighed \
//     --photo ~/Downloads/IMG_4821.jpg --name 2026-07-26-lunch \
//     "chicken breast: 180" "rice, cooked: 210" "olive oil: 12" "cucumber: 90"
//
//   --photo <path>   the meal photo, taken BEFORE eating (jpg/jpeg/png/webp)
//   --name <stem>    fixture name; becomes <dir>/<stem>.<ext> + <dir>/<stem>.json
//                    (defaults to the photo's filename, which must be filesystem-safe)
//   --dir <dir>      fixture dir (default: eval, gitignored). Prefer a SUBDIRECTORY: plain eval/
//                    is also where fetch-nutrition5k.ts writes its baseline, and one aggregate
//                    over both sets mixes cafeteria trays with home meals.
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

import { copyFileSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join } from "node:path";
import { parseArgv } from "../src/argv.ts";
import { FOOD_TABLE, buildExpectation, parseComponent } from "../src/fixture.ts";

// Exit codes match eval-meals.ts so a wrapper can treat both scripts alike: 2 = bad arguments,
// 1 = good arguments but the world was not as required (missing photo, name already taken).
function fail(message: string, code = 1): never {
  console.error(message);
  process.exit(code);
}

// ONE left-to-right pass owns both flag values and positional components — see src/argv.ts for
// why. An unknown flag, a missing value, or a repeated valued flag is an error here rather than a
// silently dropped weighed component.
let argv;
try {
  argv = parseArgv(process.argv.slice(2), {
    valued: ["photo", "name", "dir"],
    boolean: ["dry-run", "force", "foods"],
  });
} catch (e) {
  fail(`${(e as Error).message} (see the header of this file for usage)`, 2);
}
const flag = (name: string): boolean => argv.flags.has(name);

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

const photo = argv.values.photo ?? fail("--photo <path> is required (see the header of this file)", 2);
const dir = argv.values.dir ?? "eval";
const components = argv.positional;
if (components.length === 0) {
  fail('no weighed components given — e.g. "chicken breast: 180" "rice, cooked: 210"', 2);
}
// A component in the value slot ("--dir" with its value forgotten) parses as a perfectly valid
// directory name, so the parser cannot catch it — but no real directory is named "cucumber: 100".
if (/:\s*[\d.]/.test(dir)) {
  fail(`--dir looks like a weighed component ("${dir}") — did you forget its value?`, 2);
}
if (existsSync(dir) && !statSync(dir).isDirectory()) fail(`--dir is not a directory: ${dir}`, 2);

if (!existsSync(photo) || !statSync(photo).isFile()) fail(`photo not found: ${photo}`);
const ext = extname(photo).toLowerCase();
// Must match the IMAGE_EXT pairing rule in src/eval.ts — an extension the eval does not recognize
// would leave the .json an orphan and the case would never run.
if (![".jpg", ".jpeg", ".png", ".webp"].includes(ext)) {
  fail(`unsupported image extension "${ext}" — the eval pairs .jpg/.jpeg/.png/.webp only`);
}

// Default the name from the photo, but keep it filesystem-safe: this string becomes a path, and a
// "../" in it would write outside the fixture dir. The message names whichever one is actually at
// fault — phone filenames contain spaces, so the defaulted path is the common failure, and
// blaming a `--name` the user never passed sends them looking in the wrong place.
const explicitName = argv.values.name;
const name = explicitName ?? basename(photo, extname(photo));
if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(name)) {
  fail(
    explicitName !== undefined
      ? `--name must be alphanumeric with . _ - (got "${name}") — it becomes a filename`
      : `the photo's filename ("${name}") is not usable as a fixture name — pass --name <stem>`,
    2,
  );
}

const imagePath = join(dir, `${name}${ext}`);
const jsonPath = join(dir, `${name}.json`);
// EVERY allowed extension, not just the incoming one. `pairFixtures` keys on the stem, so a stem
// carrying two images (lunch.jpg from Monday, lunch.webp recorded today) resolves to whichever
// readdir returns last — and reports NO orphan, so the eval claims full coverage while silently
// scoring one photo against the other's ground truth. Checking only `imagePath` let that through
// with or without --force.
const IMAGE_EXTS = [".jpg", ".jpeg", ".png", ".webp"];
const siblings = IMAGE_EXTS.map((e) => join(dir, `${name}${e}`));
// Checked BEFORE the numbers are computed and printed: this is a complaint about the name, and
// printing a full breakdown that is then refused reads as if the numbers were the problem. Ground
// truth is expensive to produce and impossible to reconstruct once the meal is eaten, so
// overwriting is opt-in — a silent clobber here destroys a measurement, not a build artifact.
if (!flag("dry-run") && !flag("force") && [...siblings, jsonPath].some(existsSync)) {
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

// Plausibility, as a warning rather than a rule. The ceiling is about MEALS, not components: the
// table itself holds several foods above it (walnuts 6.5, mayonnaise 6.8, butter 7.2, and oil at
// the 9 kcal/g pure-fat limit), but a whole plate averaging over 6 almost always means a weight was
// entered in the wrong unit, or a digit was dropped. Below 0.2 means the opposite. Neither bound is
// impossible, so neither blocks the write.
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

// The JSON goes FIRST, and exclusively, because creating it is the only atomic step available —
// it is what claims the stem. The existsSync guard above is a friendly pre-check, not a lock: two
// concurrent runs with the same --name both pass it, and letting the filesystem arbitrate means
// the loser is told rather than silently overwritten.
//
// Order matters beyond the race. Copying the photo first and rolling it back on failure looks
// equivalent and is not: the rollback assumes it owns that path, so the LOSER of a race deletes
// the WINNER's photo and leaves ground truth with no image.
try {
  writeFileSync(jsonPath, `${JSON.stringify(expectation)}\n`, { flag: flag("force") ? "w" : "wx" });
} catch (e) {
  fail(`could not write ${jsonPath}: ${(e as Error).message}`);
}

try {
  // Clear the stem before copying: --force must not leave a second image behind (see `siblings`),
  // and the copy must land on a fresh path rather than writing THROUGH an existing symlink —
  // copyFileSync follows the link, which would put photo bytes into whatever it points at,
  // outside the fixture dir entirely.
  for (const p of siblings) rmSync(p, { force: true });
  copyFileSync(photo, imagePath);
} catch (e) {
  // Ground truth with no photo is a fixture that can never run. Take back the JSON this run
  // created so a failed run leaves the directory as it found it.
  rmSync(jsonPath, { force: true });
  fail(`could not copy the photo to ${imagePath}: ${(e as Error).message} (removed the ground truth)`);
}
console.log(`\nwrote ${imagePath} + ${jsonPath}`);
console.log(`run it: OPENROUTER_API_KEY=... bun run scripts/eval-meals.ts --dir ${dir}`);
