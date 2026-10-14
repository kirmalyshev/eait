// Nutrition per 100 g from the reference catalog, for the items a model recognised.
//
// The model's job is the picture: what is on the plate and how many grams. The catalog's job is
// what a gram of it contains. An item the catalog can match with confidence takes the catalog's
// density and its macros are `grams × density`; an item it cannot match keeps the model's own
// estimate, so a miss is never a blank and never a refusal. Totals are not touched here —
// `prepareAnalysis` re-sums them from the items, the same seam every analyzer output passes.
//
// Local catalog only (`food_ref`, loaded from the nightly fooddb snapshot): fooddb's README says
// eait never calls the service live, and a lookup here must not be able to fail a meal.
//
// #615: THE ROW IS CHOSEN BY NAME ONLY. The model's `kcal_per_100g` is an answer, not evidence —
// it is used only when the catalog has no match (the item keeps it, as above), never to filter or
// rank catalog rows. The catalog's own wording decides: generic reference entries over branded or
// restaurant ones, the served form of a staple over its dry form, a preparation the name asks for,
// and a row made FROM the food is not the food.

import {
  MAX_MEAL_AMOUNT, MAX_SNAPSHOT_ATTRIBUTION, MAX_SNAPSHOT_ATTRIBUTIONS, MAX_SNAPSHOT_NAME, SNAPSHOT_MICROS,
  type FoodRef, type FoodSnapshot, type MealItem,
} from "@eait/shared";
import type { AnalyzedMeal } from "../llm/port.ts";
import type { SwitchKey } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { switchOn } from "./switches.ts";
import {
  analyzeFoodRow, norm, singular, words, STATES, SUBSTITUTE,
  CLS_OTHER, CLS_FILLER, CLS_PRODUCT, CLS_COMPOSITE, CLS_PORTION, CLS_CAP,
  type RowAnalysis,
} from "../food-index.ts";

/** A best candidate scoring below this is a miss: the model's own estimate beats a poor match. */
const FLOOR = -6;

/** Words in a recognised name that carry no food: dropped from the lookup, not required of the row. */
const STOP = new Set(["with", "and", "in", "of", "the", "plain", "pieces", "piece", "slice", "slices", "whole", "cooking"]);
/** What the model says about preparation -> the catalog's word for it. */
const COOKED_AS: Record<string, string[]> = {
  roast: ["roasted"], roasted: ["roasted"], fried: ["fried"], fry: ["fried"],
  grilled: ["grilled", "broiled"], boiled: ["boiled"], baked: ["baked"], toasted: ["toasted"],
  steamed: ["steamed"], cooked: ["cooked"], smoked: ["smoked"], braised: ["braised"], mashed: ["mashed"],
};
/**
 * Foods only ever eaten cooked: when the name names no preparation, the served row is the honest
 * default — "rice" on a plate is cooked rice, and its dry row (3x the density) is the wrong answer.
 * Everything else defaults to the fresh form ("apple" is raw).
 */
const SERVES_COOKED = new Set([
  // grains and cereals
  "rice", "pasta", "noodle", "noodles", "spaghetti", "macaroni", "couscous", "quinoa", "millet",
  "bulgur", "barley", "farro", "polenta", "grits", "oatmeal", "oats", "buckwheat", "amaranth",
  "teff", "sorghum", "semolina", "tapioca", "orzo", "wheat",
  // legumes
  "beans", "chickpea", "chickpeas", "lentil", "lentils", "peas", "edamame",
  // tubers and usually-cooked vegetables
  "potato", "potatoes", "yam", "cassava", "taro", "plantain", "eggplant", "aubergine", "artichoke",
  "asparagus", "corn", "okra", "sprouts",
  // proteins
  "chicken", "beef", "pork", "lamb", "veal", "turkey", "duck", "goose", "fish", "salmon", "tuna",
  "cod", "haddock", "tilapia", "trout", "sardines", "shrimp", "prawns", "mussels", "squid",
  "octopus", "bacon", "ham", "sausage", "meat", "meatball", "meatballs", "steak", "liver",
  "egg", "eggs", "hamburger", "cheeseburger",
]);
type Complete = FoodRef & {
  kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number;
};
const complete = (f: FoodRef): f is Complete =>
  f.kcal_per_100g !== null && f.protein_g_per_100g !== null && f.carbs_g_per_100g !== null && f.fat_g_per_100g !== null;

/** Spellings the catalog does not share with the model (A3b): rewritten before lookup AND scoring. */
const REWRITES: [RegExp, string][] = [
  [/\bmeatloaf\b/gi, "meat loaf"], [/\bomelets?\b/gi, "omelette"],
  [/\bbreadsticks?\b/gi, "bread stick"], [/\bpork knuckle\b/gi, "ham knuckle"],
  // #615: the generic rows are spelled "hamburger" and "toasted bread"; the words a model says
  // ("burger", "toast") otherwise reach only the branded rows. "burger" survives in "burger king"
  // — there the brand IS the query.
  [/\bcheese\s+burgers?\b/gi, "cheeseburger"], [/\bburgers?\b(?!\s+king)/gi, "hamburger"],
  [/\btoasts?\b/gi, "toasted bread"],
  // The plate calls it "french fries"; the catalog calls it "potatoes, french fried". The rewrite
  // keeps "fried" as the wanted preparation and lets "potato" name the food (#615 review).
  [/\bfrench fries\b/gi, "french fried potatoes"], [/\bfries\b/gi, "french fried potatoes"],
];
const rewrite = (name: string) => REWRITES.reduce((s, [re, to]) => s.replace(re, to), name);

/** "X roll" is sushi unless X says it is bread, pastry or a spring/egg roll. */
const NON_SUSHI_ROLL = /\b(cinnamon|dinner|egg|spring|sausage|kaiser|crescent|lobster|jelly|swiss|cabbage|bread|summer|sweet)\s+rolls?\b/i;
const isSushi = (name: string) =>
  /\bsushi\b/i.test(name) || (/\brolls?\b/i.test(name) && !NON_SUSHI_ROLL.test(name));
/** Sushi is looked up as `sushi` and scored as `sushi maki <filling>`. */
const sushiName = (name: string) => {
  const filling = words(name).filter((w) => !["sushi", "roll", "rolls", "maki"].includes(w) && !STOP.has(w) && !COOKED_AS[w]);
  return ["sushi", "maki", ...filling].join(" ");
};

/** Size and quality words that may lead a name; they must never change the row, so they are not required. */
const MODIFIERS = new Set([
  "small", "large", "big", "medium", "mini", "half", "fresh", "homemade", "sliced", "diced", "chopped",
]);

/** The name without its leading modifiers, or null when there are none. Never drops a noun. */
const dropModifiers = (name: string): string | null => {
  const w = name.trim().split(/\s+/);
  const all = new Set([...MODIFIERS, ...STATES, ...Object.keys(COOKED_AS)]);
  let i = 0;
  while (i < w.length - 1 && all.has(w[i]!.toLowerCase())) i++;
  return i > 0 ? w.slice(i).join(" ") : null;
};

/** The preparation the name asks for, in the catalog's spelling, or [] when it asks none. */
const wantedStates = (q: string[]): string[] => q.flatMap((t) => COOKED_AS[t] ?? (STATES.has(t) ? [t] : []));

/** The words a row must carry: the query without stop words, preparation words and leading modifiers. */
export const lookupWords = (nameEn: string): string[] => {
  const n = rewrite(nameEn);
  if (isSushi(n)) return ["sushi"];
  const q = words(n);
  const stripped = q.filter((w) => !STOP.has(w) && !COOKED_AS[w] && !STATES.has(w));
  let i = 0;
  while (i < stripped.length - 1 && MODIFIERS.has(stripped[i]!)) i++;
  return stripped.slice(i).map(singular);
};

/**
 * How well a row answers a recognised name; higher is better. Name only (#615): the head noun
 * first (USDA writes "Chicken, breast, ..." — the food is the first word, the rest qualify it),
 * the preparation the name asked for, the served form of a staple or the fresh form of anything
 * else, generic reference entries over branded and composite ones — and a row made FROM the food,
 * or a portion OF it, is not the food.
 */
/**
 * The facts about the QUERY that every candidate reuses: the query's canonical stems, the
 * preparation it asked for, whether it names a served-cooked staple. Computed once in `pickFood`
 * so a 300-row pool pays it once, not 300 times.
 */
/**
 * A species word in the query. When the query names one ("pork steak"), an implied default is
 * never added — the asker already said whose.
 */
const SPECIES = new Set([
  "beef", "veal", "pork", "bacon", "ham", "lamb", "mutton", "sheep", "goat", "horse", "venison",
  "chicken", "turkey", "duck", "goose", "fish", "salmon", "tuna", "cod", "haddock", "tilapia",
  "trout", "sardine", "herring", "mackerel", "shrimp", "prawn", "crab", "lobster", "squid", "octopus",
]);
/**
 * The species a bare food word means: "a steak" is a beef steak until the name says otherwise —
 * a "Pork steak" row is a DIFFERENT head food for it, not a shorter-named win (#637). Joins the
 * query's match set, so a row naming the implied species neither gains an extra nor loses its
 * head. Keys and values are normed stems.
 */
const IMPLIED_SPECIES: Record<string, string> = { steak: "beef" };

interface QueryContext {
  /** Every query word, normed, plus the implied species — the match set for extra/head/brand. */
  qAll: Set<string>;
  /** qAll as an array: iterated once per candidate's flags. */
  qArr: string[];
  wantState: Set<string>; servesCooked: boolean;
}
const queryContext = (nameEn: string): QueryContext => {
  const q = words(nameEn);
  const qSet = new Set(q.map(norm));
  const qAll = new Set(qSet);
  if (![...qSet].some((t) => SPECIES.has(t)))
    for (const t of qSet) { const s = IMPLIED_SPECIES[t]; if (s) qAll.add(s); }
  return {
    qAll, qArr: [...qAll],
    wantState: new Set(wantedStates(q)),
    servesCooked: q.map(singular).some((t) => SERVES_COOKED.has(t)),
  };
};

interface Scored { s: number; sHard: number; extras: number; headOk: boolean }
function scoreFoodIn(ctx: QueryContext, f: Complete, a: RowAnalysis, out: Scored): void {
  const { qAll, qArr, wantState, servesCooked } = ctx;
  // Matched stems per class, from ONE lookup per query stem (the row's tokens never re-enter the
  // loop — scoring the whole intersection stays under a millisecond, #637).
  let mOther = 0, mFiller = 0, mProduct = 0, mComposite = 0, mPortion = 0, mCap = 0;
  for (const t of qArr) {
    const b = a.flags.get(t);
    if (b === undefined) continue;
    if (b & CLS_OTHER) mOther++;
    if (b & CLS_FILLER) mFiller++;
    if (b & CLS_PRODUCT) mProduct++;
    if (b & CLS_COMPOSITE) mComposite++;
    if (b & CLS_PORTION) mPortion++;
    if (b & CLS_CAP) mCap++;
  }
  // A product made from the food, or another dish, is simply out.
  if (a.nProducts > mProduct) { out.s = out.sHard = -Infinity; out.extras = 0; out.headOk = false; return; }
  const extraHard = a.nOthers - mOther, extraSoft = a.nFillers - mFiller;
  const extrasTerm = Math.min(4, extraHard + extraSoft * 0.15);
  let s = -extrasTerm;

  // The head says what the row IS — first word of a comma-inverted name, last content word of a
  // natural-order one (`food-index.ts`). "Sugar-apples" is a sweetsop, not sugar — a hyphenated
  // head whose far half the name never said is a head the name never said.
  const headOk = a.headParts ? a.headParts.every((p) => qAll.has(norm(p))) : qAll.has(a.headStem!);
  if (!headOk) s -= 3;

  s -= 4 * (a.nComposites - mComposite);
  s -= 4 * (a.nPortions - mPortion);
  // A row whose name carries a brand (the catalog spells brands in caps) is a worse generic
  // answer, unless the name said the brand.
  s -= 4 * (a.nCaps - mCap);

  // The row's preparation states, precomputed into stRaw/stLight/stHard/stCooked: "cooked" is
  // its own case (every prepared row carries it, so it never tells two forms apart).
  let wanted = false;
  if (wantState.size > 0) for (const t of a.states) if (wantState.has(t)) { wanted = true; break; }
  if (wantState.size > 0) s += wanted ? 3 : a.stRaw ? -2 : 0;
  else if (servesCooked) {
    // A staple on a plate is served: the plainly cooked form first, a named preparation next, the
    // dry form last.
    s += a.stLight ? 1.5 : a.stHard ? 1 : a.stCooked ? 1 : a.stRaw ? -2.5 : 0;
  } else {
    // Anything else is the fresh form by default, a plain row over a prepared one.
    s += a.stRaw ? 1 : a.stHard ? -2.5 : a.states.length > 0 ? -0.5 : 0;
  }
  // s carries the historical usda-sr point, so a winning usda row keeps its floor headroom; sHard
  // drops it together with the soft-extras discount: the same-food group is a question of name
  // alone — a preferred source never decides who ties, only which tie it answers (#637 step 2).
  const usda = f.source === "usda-sr" ? 1 : 0;
  out.s = s + usda;
  out.sHard = s + extrasTerm - Math.min(4, extraHard);
  out.extras = extraHard + extraSoft;
  out.headOk = headOk;
}

export function scoreFood(nameEn: string, f: Complete): number {
  const out = { s: 0, sHard: 0, extras: 0, headOk: false };
  scoreFoodIn(queryContext(nameEn), f, analyzeFoodRow(f), out);
  return out.s;
}

/**
 * The tables a same-food tie prefers, earliest first: the reference table that held the +1 bonus
 * before #637, then the older national tables, the newest additions last — a new table earns
 * wins by score, never by being shorter. `recipe` is not a table at all but dishes computed FROM
 * the tables' rows, so it ranks below every one of them — fooddb's resolver holds the same rule.
 */
const SOURCE_ORDER: string[] = ["usda-sr", "ciqual", "frida", "matvaretabellen", "cofid", "bls", "fineli", "recipe"];

/**
 * The user's own table first (#637 step 2): `users.country` picks the national table the tie
 * prefers — de/at → bls, fr → ciqual, no → matvaretabellen, dk → frida, gb/ie → cofid — and every
 * other value, null included, keeps usda-sr first. It can only ever order candidates that already
 * name the same food; it never outweighs a name mismatch.
 */
const COUNTRY_SOURCE: Record<string, string> = {
  de: "bls", at: "bls", fr: "ciqual", no: "matvaretabellen", dk: "frida", gb: "cofid", ie: "cofid",
};
export const preferredSources = (country: string | null | undefined): string[] => {
  const table = COUNTRY_SOURCE[country?.toLowerCase() ?? ""];
  return table ? [table, ...SOURCE_ORDER.filter((s) => s !== table)] : SOURCE_ORDER;
};

/** The catalog row to believe for this item among `candidates`, or null. */
export function pickFood(
  nameEn: string, candidates: FoodRef[], sources: readonly string[] = SOURCE_ORDER,
): Complete | null {
  const raw = rewrite(nameEn.trim());
  if (!raw) return null;
  const name = isSushi(raw) ? sushiName(raw) : raw;
  const ctx = queryContext(name);
  const nameIsSubstitute = SUBSTITUTE.test(name);
  // One scoring pass; `group` keeps only rows still in reach of the best hard score, so the
  // largest pools stay well under the per-item millisecond budget (#637).
  const out: Scored = { s: 0, sHard: 0, extras: 0, headOk: false };
  let bestHard = -Infinity;
  const group: { f: Complete; s: number; sHard: number; extras: number; headOk: boolean }[] = [];
  for (const f of candidates) {
    if (!complete(f)) continue;
    const a = analyzeFoodRow(f);
    if (a.substitute && !nameIsSubstitute) continue;
    scoreFoodIn(ctx, f, a, out);
    if (out.sHard > bestHard) {
      bestHard = out.sHard;
      for (let i = group.length - 1; i >= 0; i--)
        if (group[i]!.sHard < bestHard - 0.01) group.splice(i, 1);
    }
    if (out.sHard >= bestHard - 0.01)
      group.push({ f, s: out.s, sHard: out.sHard, extras: out.extras, headOk: out.headOk });
  }
  // #637: a tie must not break toward the shorter name alone. The tie group is the same food —
  // level on the hard score (soft extras aside) and agreeing whether the head is the asked food —
  // and inside it the preferred table answers, then the row the query covers best, then the
  // shorter name and the id, deterministic.
  const headInGroup = group.some((c) => c.headOk);
  let best: Complete | null = null, bScore = -Infinity, bExtras = Infinity, bPref = Infinity, bId = "";
  for (const c of group) {
    if (headInGroup && !c.headOk) continue;
    // A source the order has not met sorts last, never first — an unanswered `indexOf` (-1)
    // must not win a tie.
    const i = sources.indexOf(c.f.source);
    const pref = i < 0 ? Infinity : i;
    const better = best === null || pref < bPref
      || (pref === bPref && (c.extras < bExtras
        || (c.extras === bExtras && (c.f.name_en!.length < best.name_en!.length
          || (c.f.name_en!.length === best.name_en!.length && c.f.id < bId)))));
    if (better) { best = c.f; bScore = c.s; bExtras = c.extras; bPref = pref; bId = c.f.id; }
  }
  return best && bScore >= FLOOR ? best : null;
}

/** Full name first; on a miss, once more without its leading modifiers (A3b). */
async function findFood(
  deps: EngineDeps, item: MealItem, sources: readonly string[],
): Promise<Complete | null> {
  const attempt = async (name: string) => {
    const w = lookupWords(name);
    return w.length === 0 ? null : pickFood(name, await deps.store.foodCandidates(w), sources);
  };
  const hit = await attempt(item.name_en!);
  if (hit) return hit;
  const bare = dropModifiers(rewrite(item.name_en!));
  return bare ? attempt(bare) : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The read-only row copy a grounded item carries (#562): name, source, per-100 g macros and the
 * row's own attribution texts, verbatim. Stored WITH the meal — a catalog refresh changes
 * `food_ref` and never a stored meal, which is why edits recompute from this and not the row.
 */
const foodSnapshot = (f: Complete): FoodSnapshot => ({
  // Clamped to the bounds `isEditMealRequest` accepts, so a catalog row that ever exceeded one
  // could not make the meal it grounded uneditable by echo (#562).
  name: f.name.slice(0, MAX_SNAPSHOT_NAME),
  source: f.source,
  per100: {
    kcal: f.kcal_per_100g, protein_g: f.protein_g_per_100g, carbs_g: f.carbs_g_per_100g, fat_g: f.fat_g_per_100g,
    // Only a value `isEditMealRequest` would accept back: an out-of-bound one is left out, not clamped.
    ...Object.fromEntries(SNAPSHOT_MICROS.flatMap((k) => {
      const v = f[`${k}_per_100g` as const];
      return v !== null && v !== undefined && Number.isFinite(v) && v >= 0 && v <= MAX_MEAL_AMOUNT ? [[k, v]] : [];
    })),
  },
  attribution: (f.attribution ?? []).slice(0, MAX_SNAPSHOT_ATTRIBUTIONS).map((t) => t.slice(0, MAX_SNAPSHOT_ATTRIBUTION)),
});

/**
 * The item at its own grams with a snapshot's nutrition: `grams × per100`, catalog-exact.
 * Shared by grounding (the row it just picked) and by `editMeal` (the STORED item's snapshot,
 * so an edit to grams stays catalog-exact while a client-sent `food` never lands).
 */
export function recomputeFromSnapshot(item: MealItem, food: FoodSnapshot): MealItem {
  const k = item.grams / 100;
  return {
    ...item,
    kcal: Math.round(food.per100.kcal * k),
    protein_g: round1(food.per100.protein_g * k),
    carbs_g: round1(food.per100.carbs_g * k),
    fat_g: round1(food.per100.fat_g * k),
    kcal_per_100g: food.per100.kcal,
    food,
  };
}

/**
 * The meal's satfat, fibre, sugar and sodium from the catalog, PER NUTRIENT (#566): a nutrient is
 * `Σ grams × per100 / 100` only when every item is grounded and its snapshot carries that nutrient.
 * Any other nutrient is absent, and the caller keeps the model's (or the scaled stored) figure.
 */
export function catalogMicros(items: readonly MealItem[]): Partial<Record<typeof SNAPSHOT_MICROS[number], number>> {
  const out: Partial<Record<typeof SNAPSHOT_MICROS[number], number>> = {};
  if (items.length === 0) return out;
  for (const k of SNAPSHOT_MICROS) {
    if (items.every((i) => i.food?.per100[k] !== undefined)) {
      out[k] = round1(items.reduce((s, i) => s + (i.grams * (i.food?.per100[k] ?? 0)) / 100, 0));
    }
  }
  return out;
}

/** The item with the catalog's nutrition and provenance for its grams. */
function groundItem(item: MealItem, f: Complete): MealItem {
  // `ref` last: a stale one on the incoming item could never survive the row we just chose.
  return { ...recomputeFromSnapshot(item, foodSnapshot(f)), ref: f.id };
}

/**
 * Ground every item the catalog can. A lookup that throws is a miss: the catalog is a refinement of
 * an answer the model already gave, so its failure costs accuracy and never the meal.
 */
export async function groundAnalysis(
  deps: EngineDeps, analysis: AnalyzedMeal, country: string | null = null,
): Promise<{ analysis: AnalyzedMeal; grounded: number }> {
  if (!analysis.isFood || analysis.items.length === 0) return { analysis, grounded: 0 };
  const sources = preferredSources(country);
  let grounded = 0;
  const items = await Promise.all(analysis.items.map(async (item) => {
    if (!item.name_en?.trim() || !(item.grams > 0)) return item;
    try {
      const hit = await findFood(deps, item, sources);
      if (!hit) return item;
      grounded++;
      return groundItem(item, hit);
    } catch (e) {
      console.error(`[eait] food lookup failed: ${(e as Error).message}`);
      return item;
    }
  }));
  console.error(`[eait] grounding: ${grounded}/${items.length} items from the catalog`);
  return { analysis: { ...analysis, ...catalogMicros(items), items }, grounded };
}

/**
 * `groundAnalysis` behind the admin's switch, read per request (#563). Off hands the analysis
 * back exactly as the model returned it.
 */
export async function groundWhenOn(
  deps: EngineDeps, key: SwitchKey, analysis: AnalyzedMeal, country: string | null = null,
): Promise<{ analysis: AnalyzedMeal; grounded: number }> {
  return (await switchOn(deps, key)) ? groundAnalysis(deps, analysis, country) : { analysis, grounded: 0 };
}

/**
 * One catalog row logged as a meal, with no model in between (food search, one tap): a single item
 * at `grams`, nutrition `grams × per100` from the row's own snapshot, and the micros the row
 * carries. `null` when the row lacks a macro — a catalog log never invents the missing one.
 */
export function mealFromFood(food: FoodRef, grams: number, name: string): AnalyzedMeal | null {
  if (!complete(food)) return null;
  const item = groundItem({ name, name_en: food.name_en ?? food.name, grams }, food);
  const micros = catalogMicros([item]);
  return {
    isFood: true,
    items: [item],
    kcal: item.kcal!, protein_g: item.protein_g!, carbs_g: item.carbs_g!, fat_g: item.fat_g!,
    satfat_g: micros.satfat_g ?? 0, fiber_g: micros.fiber_g ?? 0, sugar_g: micros.sugar_g ?? 0, sodium_mg: micros.sodium_mg ?? 0,
    confidence: "high",
    notes: "",
  };
}
