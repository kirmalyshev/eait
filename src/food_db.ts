// Food composition store (#8): a local table of per-100 g nutrition, keyed by ENGLISH name, used to
// replace the model's macro arithmetic with a lookup. Pure logic — downloading and normalizing the
// source datasets lives in `scripts/fetch-food-db.ts`.
//
// WHAT THIS FIXES, AND WHAT IT DOES NOT. Measured over 60 evaluated dishes, the log-log slope of
// the model's estimate against truth is 0.47 for kcal, 0.67 for grams, 0.81 for density (kcal/g).
// A lookup replaces density — both its 15-20% scatter and its 0.81 slope — which lifts the kcal
// slope to roughly the grams slope. It cannot touch grams: the model still decides how much food is
// on the plate, and that is the larger half of the error. Full analysis in docs/NUTRITION_DB.md.
//
// ENGLISH IS THE LOOKUP NOTATION. The source tables that are open, bulk-downloadable and
// unencumbered are English (USDA FoodData Central is public domain). Rather than carry a
// translation table per locale, the analyzer emits a canonical English name beside whatever the
// user sees, and that canonical name is what is matched here. User-facing copy stays in
// `i18n/locales/*.json` exactly as before — nothing about this layer is displayed.
//
// NOT WIRED IN YET. `buildFoodIndex`/`find` are complete and fully tested, but nothing in
// `analyzer.ts` calls them — `items[].name_en` (the lookup key this module expects) is emitted by
// the model today with no downstream consumer. The "replace the model's macro arithmetic" step
// above is future work; this file and its build script (`scripts/fetch-food-db.ts`) are the
// prepared, unwired seam it will land on.

/** FoodData Central nutrient ids. 1008 is kcal; 1062 is the SAME nutrient in kJ — never that one. */
export const NUTRIENT_IDS = {
  kcal: 1008,
  protein_g: 1003,
  fat_g: 1004,
  carbs_g: 1005,
  satfat_g: 1258,
  fiber_g: 1079,
  sugar_g: 2000,
  sodium_mg: 1093,
} as const;

/** One food's composition per 100 g as stored. Optional fields mean NOT MEASURED, never zero. */
export interface FoodRow {
  /** Namespaced so rows from a second source can never collide: `usda:173688`. */
  id: string;
  /** English description, as published by the source. */
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  satfat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
}

/**
 * One CSV line into fields, RFC4180-style: quoted fields may contain commas, and a doubled quote
 * inside a quoted field is one literal quote.
 *
 * Worth writing rather than splitting on commas, because USDA food descriptions are full of them
 * ("Biscuits, Artificial Flavor, refrigerated dough"). A naive split shifts every later column, so
 * the food silently takes another food's numbers — no error, no crash, just wrong nutrition.
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i]!;
    if (inQuotes) {
      if (c !== '"') field += c;
      else if (line[i + 1] === '"') {
        field += '"';
        i++;
      } else inQuotes = false;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") {
      fields.push(field);
      field = "";
    } else field += c;
  }
  fields.push(field);
  return fields;
}

/**
 * Lookup key: lowercase, punctuation collapsed to single spaces. Digits and `%` survive because
 * they carry meaning — "milk, 1% fat" and "milk, 2% fat" are different foods, and dropping the
 * digit would merge them.
 */
export const normalizeFoodName = (s: string): string =>
  s.toLowerCase().replace(/[^a-z0-9%]+/g, " ").trim();

/**
 * Crude singularisation, enough for food nouns: USDA writes "Bananas, raw" and "Apples, raw" while
 * a model emits "banana". Without folding these together the correct row is invisible to the query
 * and some unrelated row wins by default — which is how "banana, raw" first resolved to
 * "Pepper, banana, raw".
 *
 * Deliberately not a real stemmer. It only strips a trailing plural, and leaves short words and
 * -ss endings alone, so "oats" and "grass" survive intact.
 */
const singular = (t: string): string => {
  if (t.length <= 3 || t.endsWith("ss")) return t;
  if (t.endsWith("ies")) return `${t.slice(0, -3)}y`;
  if (t.endsWith("oes") || t.endsWith("hes") || t.endsWith("ses")) return t.slice(0, -2);
  return t.endsWith("s") ? t.slice(0, -1) : t;
};

const tokenSet = (normalized: string): Set<string> =>
  new Set(normalized.split(" ").filter(Boolean).map(singular));

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Build a `FoodRow` from a FoodData Central food plus its nutrient amounts (already per 100 g).
 *
 * Returns null rather than a partial row when energy is missing or non-positive: a food with no
 * kcal cannot ground a meal estimate, and admitting it would put a 0-kcal entry in the index where
 * a fuzzy match could later select it. Absent macros are OMITTED, not zeroed — "not measured" and
 * "contains none" are different claims, and a fabricated zero would be summed into a user's daily
 * total as though it were fact.
 */
export function usdaFoodRow(
  fdcId: string,
  description: string,
  amounts: ReadonlyMap<number, number>,
): FoodRow | null {
  const kcal = amounts.get(NUTRIENT_IDS.kcal);
  if (kcal === undefined || !Number.isFinite(kcal) || kcal < 0) return null;
  const get = (id: number): number | undefined => {
    const v = amounts.get(id);
    return v !== undefined && Number.isFinite(v) && v >= 0 ? round1(v) : undefined;
  };
  const row: FoodRow = {
    id: `usda:${fdcId}`,
    name: description,
    kcal: Math.round(kcal),
    protein_g: get(NUTRIENT_IDS.protein_g) ?? 0,
    carbs_g: get(NUTRIENT_IDS.carbs_g) ?? 0,
    fat_g: get(NUTRIENT_IDS.fat_g) ?? 0,
  };
  for (const key of ["satfat_g", "fiber_g", "sugar_g", "sodium_mg"] as const) {
    const v = get(NUTRIENT_IDS[key]);
    if (v !== undefined) row[key] = v;
  }
  return row;
}

/** `A` → 0, `Z` → 25, `AA` → 26. Column letters in an xlsx cell reference are base-26-ish. */
const columnIndex = (ref: string): number => {
  let n = 0;
  for (const c of ref) n = n * 26 + (c.charCodeAt(0) - 64);
  return n - 1;
};

/**
 * One xlsx worksheet's XML into rows of cell strings, resolving shared-string references.
 *
 * Written rather than taken as a dependency: the file is already open XML inside a zip, only one
 * sheet is needed, and the alternative is a spreadsheet library in a project that has none.
 *
 * Each cell is placed at the index its OWN column reference gives. xlsx omits empty cells entirely,
 * so consuming them positionally would slide every later value one column left — the same silent
 * column-shift that the CSV parser above exists to prevent, and just as undetectable afterwards.
 */
export function parseXlsxSheet(sheetXml: string, sharedStrings: readonly string[]): string[][] {
  const rows: string[][] = [];
  for (const rowMatch of sheetXml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)) {
    const cells: string[] = [];
    for (const cell of rowMatch[1]!.matchAll(/<c r="([A-Z]+)\d+"([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const idx = columnIndex(cell[1]!);
      const body = cell[3] ?? "";
      const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
      // t="s" makes the value an index into the shared-string table, not the text itself.
      const value = /t="s"/.test(cell[2]!) ? (sharedStrings[Number(raw)] ?? "") : raw;
      while (cells.length < idx) cells.push("");
      cells[idx] = value;
    }
    rows.push(cells);
  }
  return rows;
}

/** Column positions in CoFID's "1.3 Proximates" sheet (2021 release). */
const COFID = { code: 0, name: 1, protein_g: 9, fat_g: 10, carbs_g: 11, kcal: 12 } as const;

/**
 * One row of CoFID's Proximates sheet into a `FoodRow`.
 *
 * CoFID matters because it carries **composite dishes** — "Lasagne, homemade", "Shepherd's pie,
 * homemade", "Risotto, chicken, homemade" — which USDA almost entirely lacks. A meal photo shows
 * dishes, not ingredients, so this is coverage USDA cannot provide at any matching quality.
 * Open Government Licence v3: reuse including commercial, so self-hosters inherit no obligation.
 *
 * Two sentinels have to be told apart. "Tr" is a trace amount and genuinely means zero. "N" means
 * the nutrient was never analysed — storing 0 for it would assert the food contains none, and that
 * fabricated zero would be summed into a user's daily total as fact.
 */
export function cofidFoodRow(cells: readonly string[]): FoodRow | null {
  const cell = (i: number): string => (cells[i] ?? "").trim();
  const num = (i: number): number | undefined => {
    const raw = cell(i);
    if (!raw || raw === "N") return undefined; // not measured
    if (raw === "Tr") return 0; // trace really is zero
    const v = Number(raw.replace(/[^0-9.-]/g, "")); // some cells carry a qualifier character
    return Number.isFinite(v) && v >= 0 ? round1(v) : undefined;
  };
  const name = cell(COFID.name);
  const kcal = num(COFID.kcal);
  const code = cell(COFID.code);
  // `id` is the namespace that keeps two sources' rows from ever colliding — a blank code must not
  // silently fall back to the name, or two blank-code rows sharing a name would collide too.
  if (!name || !code || kcal === undefined) return null;
  return {
    id: `cofid:${code}`,
    name,
    kcal: Math.round(kcal),
    protein_g: num(COFID.protein_g) ?? 0,
    carbs_g: num(COFID.carbs_g) ?? 0,
    fat_g: num(COFID.fat_g) ?? 0,
  };
}

/**
 * Tokens that appear in a large share of descriptions and so carry almost no identifying power on
 * their own. They still COUNT when they co-occur with real food words — "cooked" is what separates
 * cooked rice from raw rice — they just cannot carry a match by themselves.
 */
const WEAK_TOKENS = new Set([
  "and", "or", "with", "without", "the", "of", "in", "all", "types", "commodity",
  "usda", "includes", "made", "from", "not", "only", "regular",
]);

/**
 * Preparation and state words. These have the opposite role to WEAK_TOKENS and the distinction is
 * load-bearing: they DISCRIMINATE (cooked rice and raw rice differ ~3x, which is the single worst
 * error this layer can make) but they IDENTIFY nothing on their own. So they are required to match
 * like any other token, while a query consisting only of them resolves to null rather than to
 * whichever food happens to share the word.
 */
const PREPARATION_TOKENS = new Set([
  "cooked", "raw", "roasted", "boiled", "fried", "baked", "grilled", "steamed", "braised",
  "stewed", "dried", "dry", "frozen", "canned", "fresh", "prepared", "unprepared", "cured",
  "smoked", "salted", "sweetened", "unsweetened", "drained", "sliced", "chopped", "ground",
]);

export interface FoodIndex {
  /** Best English match, or null when nothing scores above the confidence floor. */
  find(query: string): FoodRow | null;
  size: number;
}

/**
 * Index `rows` for English name lookup.
 *
 * Scoring is deliberately asymmetric. Every query token must be accounted for — recall over the
 * QUERY is what decides correctness, because a query token the candidate lacks ("raw", "cooked")
 * is exactly the difference that makes a match wrong by 3x. Extra tokens in the candidate are only
 * lightly penalised, since USDA descriptions are far more verbose than anything a model emits
 * ("Chicken, broilers or fryers, breast, meat only, cooked, roasted" for "chicken breast, cooked").
 *
 * Below the floor it returns null. That is the whole point: the model's own macros are a fair
 * guess, while a confidently-returned wrong row is worse than a guess because everything
 * downstream treats it as fact.
 */
export function buildFoodIndex(rows: readonly FoodRow[]): FoodIndex {
  const exact = new Map<string, FoodRow>();
  const entries: { row: FoodRow; tokens: Set<string>; head: Set<string> }[] = [];
  for (const row of rows) {
    const key = normalizeFoodName(row.name);
    if (!exact.has(key)) exact.set(key, row);
    entries.push({
      row,
      tokens: tokenSet(key),
      // USDA puts food identity before the first comma and qualifiers after it: "Pepper, banana,
      // raw" is a pepper. Keeping the head separate is what lets a qualifier be optional while an
      // identity word is not.
      head: tokenSet(normalizeFoodName(row.name.split(",")[0] ?? "")),
    });
  }

  // How many rows each token HEADS. USDA files whole classes of food under a category word —
  // "Fish, salmon, ...", "Beef, ground, ...", "Pork, fresh, ..." — and a model says "salmon", never
  // "fish". Strict head containment therefore rejected the correct row for anything filed this way.
  //
  // A head token counts as a taxonomy prefix by how many rows it heads, measured on the corpus
  // rather than from a hand-written list of category words. The separation is clear at the extremes
  // (beef heads 960 rows, fish 230, pork 324; pepper heads 1, banana 0) and blurred in the middle,
  // which is tolerable because relaxing this rule cannot invent a match: every strong query token
  // must still be present, so it only admits candidates that already contain every word asked for.
  const headCount = new Map<string, number>();
  for (const { head } of entries) for (const t of head) headCount.set(t, (headCount.get(t) ?? 0) + 1);
  const TAXONOMY_HEAD_MIN = 50;

  // Inverse document frequency over the indexed names. A token appearing in almost every row
  // ("cooked") carries no identity; one appearing in a handful ("glutinous") carries a lot.
  const docFreq = new Map<string, number>();
  for (const { tokens } of entries) for (const t of tokens) docFreq.set(t, (docFreq.get(t) ?? 0) + 1);
  const idf = new Map<string, number>();
  for (const [t, df] of docFreq) idf.set(t, Math.log(entries.length / df));
  // An unseen token is maximally surprising, so it must not score as free.
  const maxIdf = Math.log(Math.max(entries.length, 2));

  return {
    size: rows.length,
    find(query: string): FoodRow | null {
      const key = normalizeFoodName(query);
      if (!key) return null;
      const hit = exact.get(key);
      if (hit) return hit;

      const queryTokens = [...tokenSet(key)];
      const asked = new Set(queryTokens);
      const strong = queryTokens.filter((t) => !WEAK_TOKENS.has(t));
      // At least one token must actually NAME a food. A query of pure filler or pure preparation
      // state ("cooked") would otherwise return whichever row happens to share the word — an
      // arbitrary food delivered with full confidence.
      if (!strong.some((t) => !PREPARATION_TOKENS.has(t))) return null;

      let best: FoodRow | null = null;
      let bestScore = -Infinity;
      for (const { row, tokens, head } of entries) {
        // EVERY strong query token must be present. This is the cooking-state guard: "rice cooked"
        // cannot match a raw row, because "cooked" is missing from it.
        if (!strong.every((t) => tokens.has(t))) continue;
        // And the candidate's IDENTITY may not introduce a word the query never asked for. This is
        // what separates "Bananas, raw" from "Pepper, banana, raw", "Potatoes" from "Sweet potato",
        // and "Chicken, ... breast" from "Chicken breast tenders, breaded". Qualifiers after the
        // first comma stay optional; the head does not.
        if (
          ![...head].every(
            (t) =>
              asked.has(t) ||
              WEAK_TOKENS.has(t) ||
              (headCount.get(t) ?? 0) >= TAXONOMY_HEAD_MIN, // category prefix, not identity
          )
        ) {
          continue;
        }
        // Among survivors, penalise each unasked-for token by its RARITY rather than counting them.
        // Counting favours whichever description is shortest, which is how "rice, white, cooked"
        // picked "glutinous, unenriched" over plain long-grain, and "chicken thigh" picked the SKIN
        // row: niche variants are tersely worded while the canonical entry is verbose ("Chicken,
        // broilers or fryers, breast, meat only, cooked, roasted"). A rare extra word like
        // "glutinous", "chinese" or "skin" changes which food this is; a common one like "boiled"
        // or "drained" does not, and rarity separates them without a hand-written list.
        // MAX rarity, not the sum. Summing punishes verbosity, and USDA's canonical entries are the
        // verbose ones — "Chicken, broilers or fryers, breast, meat only, cooked, roasted" against
        // the terse variant "Chicken, skin (drumsticks and thighs)". Several ordinary words
        // ("boiled", "drained", "without", "salt") should cost less than one telling word
        // ("glutinous", "chinese", "skin"), and only the max behaves that way. Count breaks ties.
        let worst = 0;
        let extra = 0;
        for (const t of tokens) {
          if (asked.has(t)) continue;
          extra++;
          worst = Math.max(worst, idf.get(t) ?? maxIdf);
        }
        const score = -(worst + extra * 0.01);
        if (score > bestScore) {
          bestScore = score;
          best = row;
        }
      }
      return best;
    },
  };
}
