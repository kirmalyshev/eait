// Weighed-meal fixture composition (issue #6): turn a kitchen-scale ingredient list into the
// ground-truth `Expectation` the accuracy eval consumes. Pure logic only — file I/O and photo
// handling live in the manual runner `scripts/add-fixture.ts`. Not imported by the bot runtime.
//
// WHY THIS EXISTS. A scale gives grams, not calories; something has to turn "180 g chicken breast
// + 210 g cooked rice + 12 g olive oil" into kcal and macros. Doing that by hand is what kills a
// 20-meal eval set: 20 meals x ~5 components is 100 manual lookups, each an opportunity to write
// ground truth that is quietly wrong. This module does it deterministically, and refuses rather
// than guesses when it cannot.
//
// GROUND TRUTH IS NOT EXACT. Composition-table lookup is the same method the published datasets
// use (Nutrition5k weighed ingredients and looked them up too), and it inherits the table's error:
// a few percent for staples, more for anything variable (fat trim on meat, how much oil the pan
// kept). That is well below the ~40% model error being measured, so it does not threaten the
// comparison — but it means a 3% shift in a reported metric is noise, not a result.

import { ExpectationSchema, round1, type Expectation } from "./eval.ts";

/** Composition per 100 g as served. `alcohol_g` appears only where ethanol carries real energy. */
export interface Per100 {
  kcal: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  /** Ethanol grams per 100 g/ml — energy-bearing (7 kcal/g) but not a macro the eval scores. */
  alcohol_g?: number;
}

export interface FoodEntry {
  /** Canonical name, including the preparation state when it changes the numbers. */
  name: string;
  per100: Per100;
  /** Synonyms that resolve to the same entry (regional names, British/American spellings). */
  aliases?: string[];
}

/**
 * Curated composition table, per 100 g AS SERVED — cooked where a food is eaten cooked, because
 * that is what lands on the scale. Weighing 100 g of dry rice and looking up cooked rice (or the
 * reverse) is a ~3x error, so preparation state is part of the name, not a footnote.
 *
 * SINGLE INGREDIENTS ONLY, and only ones whose composition is well established. Composite and
 * branded foods (pelmeni, a shop-bought sauce, protein bars) are deliberately absent: their
 * numbers vary by producer, so a generic row would be invented precision. Those take the inline
 * `@` override, where the package label — the better ground truth — goes in directly.
 *
 * Values: USDA FoodData Central (SR Legacy 2018-04 / Foundation Foods), rounded — EXCEPT the four
 * Russian dairy rows (kefir, both tvorog grades, smetana), which USDA has no entry for at these
 * grades and which come from Skurikhin's Химический состав пищевых продуктов via Calorizator.
 *
 * COOKING METHOD is part of the name wherever it moves the number more than the eval can ignore.
 * Fried potato is the worst case in the table: oven-baked 148, home pan-fried 265, deep-fried 312
 * — a 2x spread on a food that shows up at 200 g. Same for a fat grade (mince, dairy, ham): the
 * grade is in the name and only that grade is claimed.
 *
 * Two known soft spots, recorded rather than hidden. German market grades were never checked
 * against the Bundeslebensmittelschlüssel (not freely queryable): `milk 3.5%` carries USDA's 3.25%
 * whole-milk row, and `yogurt, plain 3.5%` likewise — the values are sourced, the exact grade in
 * the name is not. `milk 1.5%` has no USDA row at all and interpolates between 1% and 2%.
 */
export const FOOD_TABLE: readonly FoodEntry[] = [
  // — meat & poultry, cooked —
  { name: "chicken breast", per100: { kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6 }, aliases: ["chicken breast, cooked"] },
  { name: "chicken thigh", per100: { kcal: 179, protein_g: 24.8, carbs_g: 0, fat_g: 8.2 } },
  { name: "chicken with skin, roasted", per100: { kcal: 239, protein_g: 27, carbs_g: 0, fat_g: 13.6 } },
  { name: "turkey breast", per100: { kcal: 147, protein_g: 30, carbs_g: 0, fat_g: 2 } },
  { name: "beef mince 15%", per100: { kcal: 250, protein_g: 26, carbs_g: 0, fat_g: 15 }, aliases: ["ground beef 15%"] },
  { name: "beef steak, lean", per100: { kcal: 207, protein_g: 29.2, carbs_g: 0, fat_g: 9.1 } },
  { name: "pork chop", per100: { kcal: 231, protein_g: 27, carbs_g: 0, fat_g: 13 } },
  { name: "pork mince", per100: { kcal: 297, protein_g: 26, carbs_g: 0, fat_g: 21 }, aliases: ["ground pork"] },
  { name: "bacon", per100: { kcal: 541, protein_g: 37, carbs_g: 1.4, fat_g: 42 } },
  { name: "pork sausage", per100: { kcal: 300, protein_g: 17, carbs_g: 2, fat_g: 25 } },
  { name: "ham, sliced (11% fat)", per100: { kcal: 164, protein_g: 16.6, carbs_g: 3.6, fat_g: 8.8 } },
  { name: "beef liver", per100: { kcal: 175, protein_g: 27, carbs_g: 5.1, fat_g: 4.7 } },

  // — fish & seafood, cooked —
  { name: "salmon", per100: { kcal: 206, protein_g: 22, carbs_g: 0, fat_g: 12 } },
  { name: "smoked salmon", per100: { kcal: 117, protein_g: 18, carbs_g: 0, fat_g: 4.3 } },
  { name: "cod", per100: { kcal: 105, protein_g: 23, carbs_g: 0, fat_g: 0.9 } },
  { name: "mackerel", per100: { kcal: 262, protein_g: 24, carbs_g: 0, fat_g: 18 } },
  { name: "salted herring", per100: { kcal: 217, protein_g: 24.6, carbs_g: 0, fat_g: 12.4 }, aliases: ["seledka"] },
  { name: "tuna, canned in water", per100: { kcal: 116, protein_g: 26, carbs_g: 0, fat_g: 0.8 } },
  { name: "shrimp", per100: { kcal: 99, protein_g: 24, carbs_g: 0.2, fat_g: 0.3 }, aliases: ["prawns"] },

  // — eggs & dairy —
  { name: "egg", per100: { kcal: 155, protein_g: 13, carbs_g: 1.1, fat_g: 11 }, aliases: ["whole egg", "boiled egg"] },
  { name: "egg white", per100: { kcal: 52, protein_g: 11, carbs_g: 0.7, fat_g: 0.2 } },
  { name: "milk 3.5%", per100: { kcal: 61, protein_g: 3.2, carbs_g: 4.8, fat_g: 3.3 } },
  { name: "milk 1.5%", per100: { kcal: 47, protein_g: 3.4, carbs_g: 4.9, fat_g: 1.5 } },
  { name: "kefir 2.5%", per100: { kcal: 53, protein_g: 3.3, carbs_g: 4, fat_g: 2.5 } },
  { name: "yogurt, plain 3.5%", per100: { kcal: 61, protein_g: 3.5, carbs_g: 4.7, fat_g: 3.3 } },
  { name: "greek yogurt 0%", per100: { kcal: 59, protein_g: 10, carbs_g: 3.6, fat_g: 0.4 } },
  { name: "tvorog 5%", per100: { kcal: 121, protein_g: 17, carbs_g: 3, fat_g: 5 }, aliases: ["quark 5%", "cottage cheese 5%"] },
  { name: "tvorog 9%", per100: { kcal: 159, protein_g: 16, carbs_g: 3, fat_g: 9 }, aliases: ["quark 9%"] },
  { name: "smetana 20%", per100: { kcal: 206, protein_g: 2.8, carbs_g: 3.4, fat_g: 20 }, aliases: ["sour cream 20%", "schmand"] },
  { name: "cheddar", per100: { kcal: 403, protein_g: 25, carbs_g: 1.3, fat_g: 33 } },
  { name: "gouda", per100: { kcal: 356, protein_g: 25, carbs_g: 2.2, fat_g: 27 } },
  { name: "mozzarella", per100: { kcal: 300, protein_g: 22, carbs_g: 2.2, fat_g: 22 } },
  { name: "feta", per100: { kcal: 264, protein_g: 14, carbs_g: 4.1, fat_g: 21 } },
  { name: "parmesan", per100: { kcal: 392, protein_g: 36, carbs_g: 3.2, fat_g: 25 } },
  { name: "cream cheese", per100: { kcal: 342, protein_g: 6, carbs_g: 4, fat_g: 34 } },
  { name: "butter", per100: { kcal: 717, protein_g: 0.9, carbs_g: 0.1, fat_g: 81 } },

  // — grains & starches, cooked as served —
  { name: "rice, cooked", per100: { kcal: 130, protein_g: 2.7, carbs_g: 28, fat_g: 0.3 }, aliases: ["white rice, cooked"] },
  { name: "brown rice, cooked", per100: { kcal: 123, protein_g: 2.7, carbs_g: 26, fat_g: 1 } },
  { name: "buckwheat, cooked", per100: { kcal: 92, protein_g: 3.4, carbs_g: 20, fat_g: 0.6 }, aliases: ["grechka"] },
  { name: "pasta, cooked", per100: { kcal: 158, protein_g: 5.8, carbs_g: 31, fat_g: 0.9 } },
  { name: "couscous, cooked", per100: { kcal: 112, protein_g: 3.8, carbs_g: 23, fat_g: 0.2 } },
  { name: "quinoa, cooked", per100: { kcal: 120, protein_g: 4.4, carbs_g: 21, fat_g: 1.9 } },
  { name: "millet, cooked", per100: { kcal: 119, protein_g: 3.5, carbs_g: 24, fat_g: 1 } },
  { name: "pearl barley, cooked", per100: { kcal: 123, protein_g: 2.3, carbs_g: 28, fat_g: 0.4 } },
  { name: "porridge oats, cooked in water", per100: { kcal: 71, protein_g: 2.5, carbs_g: 12, fat_g: 1.5 } },
  { name: "rolled oats, dry", per100: { kcal: 389, protein_g: 17, carbs_g: 66, fat_g: 7 } },
  { name: "potato, boiled", per100: { kcal: 87, protein_g: 2, carbs_g: 20, fat_g: 0.1 } },
  { name: "potato, deep-fried", per100: { kcal: 312, protein_g: 3.4, carbs_g: 41, fat_g: 15 }, aliases: ["french fries"] },
  { name: "oven fries, baked", per100: { kcal: 148, protein_g: 2.6, carbs_g: 27, fat_g: 3.8 }, aliases: ["pommes"] },
  { name: "white bread", per100: { kcal: 265, protein_g: 9, carbs_g: 49, fat_g: 3.2 } },
  { name: "rye bread", per100: { kcal: 250, protein_g: 8.5, carbs_g: 48, fat_g: 3.3 }, aliases: ["dark bread", "schwarzbrot"] },
  { name: "wholegrain bread", per100: { kcal: 247, protein_g: 13, carbs_g: 41, fat_g: 3.4 }, aliases: ["vollkornbrot"] },

  // — legumes —
  { name: "lentils, cooked", per100: { kcal: 116, protein_g: 9, carbs_g: 20, fat_g: 0.4 } },
  { name: "chickpeas, cooked", per100: { kcal: 164, protein_g: 8.9, carbs_g: 27, fat_g: 2.6 } },
  { name: "kidney beans, cooked", per100: { kcal: 127, protein_g: 8.7, carbs_g: 23, fat_g: 0.5 } },
  { name: "green peas, cooked", per100: { kcal: 84, protein_g: 5.4, carbs_g: 16, fat_g: 0.2 } },
  { name: "tofu, firm", per100: { kcal: 144, protein_g: 17, carbs_g: 3, fat_g: 9 } },

  // — vegetables —
  { name: "tomato", per100: { kcal: 18, protein_g: 0.9, carbs_g: 3.9, fat_g: 0.2 } },
  { name: "cucumber", per100: { kcal: 15, protein_g: 0.7, carbs_g: 3.6, fat_g: 0.1 } },
  { name: "carrot", per100: { kcal: 41, protein_g: 0.9, carbs_g: 10, fat_g: 0.2 } },
  { name: "cabbage", per100: { kcal: 25, protein_g: 1.3, carbs_g: 5.8, fat_g: 0.1 } },
  { name: "sauerkraut", per100: { kcal: 19, protein_g: 0.9, carbs_g: 4.3, fat_g: 0.1 } },
  { name: "onion", per100: { kcal: 40, protein_g: 1.1, carbs_g: 9.3, fat_g: 0.1 } },
  { name: "bell pepper", per100: { kcal: 26, protein_g: 1, carbs_g: 6, fat_g: 0.3 }, aliases: ["paprika"] },
  { name: "broccoli, cooked", per100: { kcal: 35, protein_g: 2.4, carbs_g: 7.2, fat_g: 0.4 } },
  { name: "cauliflower, cooked", per100: { kcal: 23, protein_g: 1.8, carbs_g: 4.1, fat_g: 0.5 } },
  { name: "zucchini, cooked", per100: { kcal: 15, protein_g: 1.1, carbs_g: 2.7, fat_g: 0.4 }, aliases: ["courgette"] },
  { name: "eggplant, cooked", per100: { kcal: 35, protein_g: 0.8, carbs_g: 8.7, fat_g: 0.2 }, aliases: ["aubergine"] },
  { name: "mushrooms, cooked", per100: { kcal: 28, protein_g: 2.2, carbs_g: 5.3, fat_g: 0.5 } },
  { name: "spinach, cooked", per100: { kcal: 23, protein_g: 3, carbs_g: 3.8, fat_g: 0.3 } },
  { name: "lettuce", per100: { kcal: 15, protein_g: 1.4, carbs_g: 2.9, fat_g: 0.2 } },
  { name: "beetroot, boiled", per100: { kcal: 44, protein_g: 1.7, carbs_g: 10, fat_g: 0.2 }, aliases: ["svekla"] },
  { name: "sweetcorn, cooked", per100: { kcal: 96, protein_g: 3.4, carbs_g: 21, fat_g: 1.5 } },
  { name: "avocado", per100: { kcal: 160, protein_g: 2, carbs_g: 8.5, fat_g: 15 } },

  // — fruit —
  { name: "apple", per100: { kcal: 52, protein_g: 0.3, carbs_g: 14, fat_g: 0.2 } },
  { name: "pear", per100: { kcal: 57, protein_g: 0.4, carbs_g: 15, fat_g: 0.1 } },
  { name: "banana", per100: { kcal: 89, protein_g: 1.1, carbs_g: 23, fat_g: 0.3 } },
  { name: "orange", per100: { kcal: 47, protein_g: 0.9, carbs_g: 12, fat_g: 0.1 } },
  { name: "grapes", per100: { kcal: 69, protein_g: 0.7, carbs_g: 18, fat_g: 0.2 } },
  { name: "strawberry", per100: { kcal: 32, protein_g: 0.7, carbs_g: 7.7, fat_g: 0.3 } },
  { name: "blueberry", per100: { kcal: 57, protein_g: 0.7, carbs_g: 14, fat_g: 0.3 } },
  { name: "watermelon", per100: { kcal: 30, protein_g: 0.6, carbs_g: 7.6, fat_g: 0.2 } },

  // — fats, nuts & seeds —
  { name: "olive oil", per100: { kcal: 884, protein_g: 0, carbs_g: 0, fat_g: 100 } },
  { name: "sunflower oil", per100: { kcal: 884, protein_g: 0, carbs_g: 0, fat_g: 100 } },
  { name: "mayonnaise", per100: { kcal: 680, protein_g: 1, carbs_g: 2.7, fat_g: 75 } },
  { name: "almonds", per100: { kcal: 579, protein_g: 21, carbs_g: 22, fat_g: 50 } },
  { name: "walnuts", per100: { kcal: 654, protein_g: 15, carbs_g: 14, fat_g: 65 } },
  { name: "peanuts", per100: { kcal: 567, protein_g: 26, carbs_g: 16, fat_g: 49 } },
  { name: "peanut butter", per100: { kcal: 588, protein_g: 25, carbs_g: 20, fat_g: 50 } },
  { name: "sunflower seeds", per100: { kcal: 584, protein_g: 21, carbs_g: 20, fat_g: 51 } },

  // — sweeteners, condiments & drinks —
  { name: "sugar", per100: { kcal: 387, protein_g: 0, carbs_g: 100, fat_g: 0 } },
  { name: "honey", per100: { kcal: 304, protein_g: 0.3, carbs_g: 82, fat_g: 0 } },
  { name: "dark chocolate 70%", per100: { kcal: 598, protein_g: 7.8, carbs_g: 46, fat_g: 43 } },
  { name: "milk chocolate", per100: { kcal: 535, protein_g: 7.7, carbs_g: 59, fat_g: 30 } },
  { name: "ketchup", per100: { kcal: 101, protein_g: 1.3, carbs_g: 26, fat_g: 0.1 } },
  { name: "soy sauce", per100: { kcal: 53, protein_g: 8.1, carbs_g: 4.9, fat_g: 0.6 } },
  { name: "orange juice", per100: { kcal: 45, protein_g: 0.7, carbs_g: 10, fat_g: 0.2 } },
  { name: "cola", per100: { kcal: 42, protein_g: 0, carbs_g: 10.6, fat_g: 0 } },
  { name: "beer", per100: { kcal: 43, protein_g: 0.5, carbs_g: 3.6, fat_g: 0, alcohol_g: 3.9 } },
  { name: "dry red wine", per100: { kcal: 85, protein_g: 0.1, carbs_g: 2.6, fat_g: 0, alcohol_g: 10.6 } },
];

/**
 * Lookup key: lowercase, everything but letters/digits/`%` collapsed to single spaces. So
 * "Rice, Cooked", "rice cooked" and "rice,cooked" are one key.
 *
 * DIGITS are the load-bearing part, not the `%`: they are what keeps "milk 3.5%" distinct from
 * "milk 1.5%", i.e. one fat grade from another. Dropping `%` would be harmless on today's table;
 * dropping digits would collapse three pairs of entries into one key each. Exported so the table's
 * duplicate-key test checks THIS function rather than a copy of it — a test that re-implements the
 * key function cannot see a regression in it.
 */
export const normalize = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

const INDEX = new Map<string, Per100>();
/** Normalized key → canonical name, for building suggestions out of a miss. */
const CANONICAL = new Map<string, string>();
for (const entry of FOOD_TABLE) {
  for (const key of [entry.name, ...(entry.aliases ?? [])]) {
    INDEX.set(normalize(key), entry.per100);
    CANONICAL.set(normalize(key), entry.name);
  }
}

/** Composition for a food name or alias; `undefined` if the table does not carry it. */
export function lookupFood(name: string): Per100 | undefined {
  return INDEX.get(normalize(name));
}

/** Levenshtein distance, capped implicitly by the short strings involved (food name tokens). */
function editDistance(a: string, b: string): number {
  // Single-row DP: only the previous row is ever needed, and these are 3-12 char tokens.
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(Math.min(row[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost));
    }
    prev = row;
  }
  return prev[b.length]!;
}

/** A query token matches a name token on prefix, or (for real words) within one or two typos. */
function tokenMatches(query: string, target: string): boolean {
  if (query === target) return true;
  // Prefix matching needs real length on BOTH sides. Short function words in the table's names are
  // the problem: with no floor, "instant noodles" suggests "porridge oats, cooked in water" and
  // "tuna, canned in water", matched purely on the token "in".
  if (query.length >= 3 && target.length >= 3 && (target.startsWith(query) || query.startsWith(target))) {
    return true;
  }
  if (query.length < 4) return false; // too short to fuzzy-match without matching everything
  return editDistance(query, target) <= (query.length > 6 ? 2 : 1);
}

/**
 * Canonical names plausibly meant by `name`, best first, at most five. Exists so an unknown
 * ingredient fails with "did you mean" instead of sending someone to read the table — the table is
 * ~100 rows and a person mid-fixture will not go looking.
 */
export function suggestFoods(name: string): string[] {
  const queryTokens = normalize(name).split(" ").filter(Boolean);
  if (queryTokens.length === 0) return [];
  const scored: { name: string; score: number }[] = [];
  for (const [key, canonical] of CANONICAL) {
    const targetTokens = key.split(" ");
    const score = queryTokens.filter((q) => targetTokens.some((t) => tokenMatches(q, t))).length;
    if (score > 0) scored.push({ name: canonical, score });
  }
  // Sort by matched-token count, then alphabetically so the list is stable run to run. Dedupe:
  // two aliases of one entry both resolve to the same canonical name.
  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  return [...new Set(scored.map((s) => s.name))].slice(0, 5);
}

/** One weighed component of a meal: what it was, how much of it, and what 100 g of it contains. */
export interface Component {
  name: string;
  grams: number;
  per100: Per100;
}

/**
 * `40/3.4/4/1` → per-100g composition. kcal alone is allowed; a partial macro list is not.
 * `whole` is the full component line, quoted in errors: a bare trailing `@` leaves `spec` empty,
 * and `"" has a blank per-100g field` names nothing the user can find in what they typed.
 */
function parseOverride(spec: string, whole: string): Per100 {
  const parts = spec.split("/").map((p) => p.trim());
  if (parts.length !== 1 && parts.length !== 4) {
    throw new Error(
      `"${whole}" is not a per-100g composition — expected kcal or kcal/protein/carbs/fat`,
    );
  }
  // Blank BEFORE numeric: `Number("")` and `Number(" ")` are both 0, so an empty field would pass
  // the numeric check and become real ground truth — "40//4/1" silently declaring zero protein, a
  // bare "@" silently declaring a zero-calorie food. That is the same silent-zero failure an
  // unknown ingredient is already protected from, and it is worse here because there is no name to
  // look wrong. A blank is a slipped keystroke, and a slipped keystroke must never read as a
  // measurement.
  if (parts.some((p) => p === "")) {
    throw new Error(`"${whole}" has a blank per-100g field — every value must be given explicitly`);
  }
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) {
    throw new Error(`"${whole}": per-100g values must be non-negative numbers`);
  }
  const [kcal, protein_g, carbs_g, fat_g] = nums as [number, number?, number?, number?];
  return parts.length === 1 ? { kcal } : { kcal, protein_g, carbs_g, fat_g };
}

/**
 * One line of a weighed meal:
 *
 *   `chicken breast: 180`               — grams on the scale, composition from the table
 *   `pelmeni: 250 @ 275`                — kcal per 100 g off the package label
 *   `kefir 1%: 250 @ 40/3.4/4/1`        — kcal/protein/carbs/fat per 100 g off the label
 *
 * An override always wins over a table row of the same name: someone who typed the label has the
 * actual product in hand, which beats a generic row. Every other malformed or unknown input
 * throws — there is no default composition, because a silently-zero ingredient understates the
 * ground truth and would surface later as fake model over-estimation.
 */
export function parseComponent(spec: string): Component {
  const colon = spec.indexOf(":");
  if (colon === -1) throw new Error(`"${spec}" is not "<food>: <grams>"`);
  const name = spec.slice(0, colon).trim();
  if (!name) throw new Error(`"${spec}" has an empty food name`);
  // An `@` left of the colon is a misplaced override, not part of a food name. Without this it is
  // absorbed into the name, `normalize` strips it, the table lookup succeeds, and the user gets a
  // generic table row while believing they supplied a label — a silently ignored instruction.
  if (name.includes("@")) {
    throw new Error(`"${spec}" puts @ in the food name — the override goes after the grams`);
  }

  const rest = spec.slice(colon + 1);
  const at = rest.indexOf("@");
  if (at !== -1 && rest.indexOf("@", at + 1) !== -1) {
    throw new Error(`"${spec}" has more than one @ override`);
  }
  const gramsText = (at === -1 ? rest : rest.slice(0, at)).trim();
  const grams = Number(gramsText);
  if (!Number.isFinite(grams) || grams <= 0) {
    throw new Error(`"${spec}": grams must be a positive number, got "${gramsText}"`);
  }

  if (at !== -1) return { name, grams, per100: parseOverride(rest.slice(at + 1).trim(), spec) };

  const per100 = lookupFood(name);
  if (!per100) {
    const hints = suggestFoods(name);
    throw new Error(
      `"${name}" is not in the food table` +
        (hints.length ? ` — did you mean: ${hints.join(", ")}?` : "") +
        ` (or give the label directly: "${name}: ${grams} @ kcal/protein/carbs/fat")`,
    );
  }
  return { name, grams, per100 };
}

const MACROS = ["protein_g", "carbs_g", "fat_g"] as const;

/**
 * Weighed components → the `<name>.json` ground truth the eval reads.
 *
 * A macro is reported ONLY when every component declares it. Summing the ones that do would
 * produce ground truth that is wrong LOW, and the eval would score the missing grams as model
 * error — a fabricated result that looks exactly like a real one. `Expectation` makes macros
 * optional precisely so "we don't know" has somewhere to land; kcal has no such escape, so every
 * component must carry it (the table always does, and the override requires it).
 *
 * `total_grams` is the sum, and is the single most valuable field here: portion is the larger half
 * of the model's kcal error, and a scale is the only way to know the true number.
 */
export function buildExpectation(specs: string[]): Expectation {
  if (specs.length === 0) throw new Error("a meal needs at least one weighed component");
  const components = specs.map(parseComponent);

  let kcal = 0;
  let total_grams = 0;
  const macroSums: Record<(typeof MACROS)[number], number | undefined> = {
    protein_g: 0, carbs_g: 0, fat_g: 0,
  };
  for (const c of components) {
    const scale = c.grams / 100;
    kcal += c.per100.kcal * scale;
    total_grams += c.grams;
    for (const macro of MACROS) {
      const value = c.per100[macro];
      // One component lacking a macro poisons that macro for the whole meal — undefined is sticky.
      if (value === undefined) macroSums[macro] = undefined;
      else if (macroSums[macro] !== undefined) macroSums[macro]! += value * scale;
    }
  }

  if (Math.round(kcal) === 0) {
    throw new Error(
      "the weighed components sum to 0 kcal — a zero-calorie meal is not usable ground truth",
    );
  }

  // Omit-vs-undefined: `flatMap` skips the key entirely rather than writing `"protein_g": null`
  // into the fixture, which ExpectationSchema would reject on the next read. Note this invariant
  // rests on flatMap alone — zod does NOT strip an explicit `undefined`, so writing the key with an
  // undefined value would put it in the JSON. Same pattern (and reason) as `summarize` in eval.ts.
  //
  // The schema stays the authority on what valid ground truth is, rather than being duplicated as
  // hand-written guards here — it catches cases the arithmetic above cannot, e.g. a sub-0.05 g
  // component whose rounded `total_grams` is 0. Wrapped so that failure names the cause instead of
  // surfacing a raw zod dump about a field the user never typed.
  const candidate = {
    kcal: Math.round(kcal),
    total_grams: round1(total_grams),
    ...Object.fromEntries(
      MACROS.flatMap((m) => (macroSums[m] === undefined ? [] : [[m, round1(macroSums[m]!)]])),
    ),
  };
  try {
    return ExpectationSchema.parse(candidate);
  } catch (e) {
    throw new Error(
      `the weighed components do not form usable ground truth: ${(e as Error).message}`,
    );
  }
}
