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

import {
  MAX_SNAPSHOT_ATTRIBUTION, MAX_SNAPSHOT_ATTRIBUTIONS, MAX_SNAPSHOT_NAME,
  type FoodRef, type FoodSnapshot, type MealItem,
} from "@eait/shared";
import type { AnalyzedMeal } from "../llm/port.ts";
import type { SwitchKey } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { switchOn } from "./switches.ts";

const POOL = 300;
/** A best candidate scoring below this is a miss: the model's own estimate beats a poor match. */
const FLOOR = -6;
/**
 * How far the catalog's density may sit from the model's own. Raw rice (365 kcal/100 g) against a
 * plate of cooked rice (130) is a 2.8x gap and a wrong answer by 180%.
 */
const DENSITY_BAND = 2;

const words = (s: string): string[] => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
/** For COMPARING words only ("apple" = "apples", "tomatoes" = "tomato"): the lookup keeps words whole. */
const stem = (w: string) => w.replace(/ies$/, "y").replace(/es$/, "").replace(/s$/, "").replace(/e$/, "");
const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/** Words in a recognised name that carry no food: dropped from the lookup, not required of the row. */
const STOP = new Set(["with", "and", "in", "of", "the", "plain", "pieces", "piece", "slice", "slices", "whole"]);
/** What the model says about preparation -> the catalog's word for it. */
const COOKED_AS: Record<string, string[]> = {
  roast: ["roasted"], fried: ["fried"], fry: ["fried"], grilled: ["grilled", "broiled"], boiled: ["boiled"],
  baked: ["baked"], toasted: ["toasted"], steamed: ["steamed"], cooked: ["cooked"],
};
const STATES = new Set(["raw", "cooked", "roasted", "fried", "grilled", "broiled", "boiled", "baked", "toasted", "steamed", "stewed"]);
/** USDA's descriptive filler ("Chicken, broilers or fryers, ... meat only"): length without meaning. */
const FILLER = new Set([
  "broilers", "or", "fryers", "meat", "only", "skin", "boneless", "skinless", "with", "without", "separable", "lean",
  "fat", "trimmed", "all", "grades", "choice", "select", "retail", "cuts", "fresh", "unprepared", "cooked", "oven",
  "pan", "whole", "commercial", "bone", "small", "large", "medium", "regular", "generic", "type", "from", "not",
  "enriched", "unenriched", "includes", "eaten",
]);
/** A word that makes a row a product made FROM the food, or a stand-in for it, unless the query said it. */
const COMPOSITE = new Set([
  "tart", "jelly", "pudding", "sandwich", "pie", "soup", "nectar", "juice", "dried", "canned", "babyfood", "formula",
  "restaurant", "frozen", "sauce", "cake", "cookie", "cereal", "drink", "beverage", "candy", "snack", "spread",
  "salad", "dessert", "pastry", "pastries", "bar", "flavor", "mix", "fast", "brand", "kit", "spray", "prepacked",
  "nuggets", "stick", "sticks", "yogurt", "french", "school", "lunch", "burger",
]);
/** Never a match for a food that did not name it. */
const SUBSTITUTE = /\b(meatless|vegetarian|vegan|imitation|analog|substitute)\b/i;

type Complete = FoodRef & {
  kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number;
};
const complete = (f: FoodRef): f is Complete =>
  f.kcal_per_100g !== null && f.protein_g_per_100g !== null && f.carbs_g_per_100g !== null && f.fat_g_per_100g !== null;

/** The words a row must carry: the query without stop words and without preparation words. */
export const lookupWords = (nameEn: string): string[] =>
  words(nameEn).filter((w) => !STOP.has(w) && !COOKED_AS[w]).map(singular);

/**
 * How well a row answers a recognised name; higher is better. The head noun first (USDA writes
 * "Chicken, breast, ..." and "Apples, raw" — the food is the first word, the rest qualify it),
 * the preparation the model named, raw as the default, generic over composite, and the model's own
 * density as the tie-breaker between otherwise equal rows.
 */
export function scoreFood(nameEn: string, density: number | undefined, f: Complete): number {
  const q = words(nameEn), qStems = q.map(stem);
  const rowWords = words(f.name_en ?? f.name);
  const wantState = q.flatMap((t) => COOKED_AS[t] ?? []);
  const rowStates = rowWords.filter((t) => STATES.has(t));
  const extras = rowWords.filter((t) => !qStems.includes(stem(t)) && !STATES.has(t));
  let s = -Math.min(4, extras.filter((t) => !FILLER.has(t)).length + extras.filter((t) => FILLER.has(t)).length * 0.15);
  if (!qStems.includes(stem(rowWords[0] ?? ""))) s -= 3;
  s -= rowWords.filter((t) => COMPOSITE.has(t) && !q.includes(t)).length * 4;
  if (wantState.length > 0) s += rowStates.some((t) => wantState.includes(t)) ? 3 : rowStates.includes("raw") ? -2 : 0;
  else if (rowStates.includes("raw")) s += 1.5;
  if (f.source === "usda-sr") s += 1;
  if (density !== undefined && density > 0) s -= Math.abs(Math.log(f.kcal_per_100g / density)) * 3;
  return s;
}

/** The catalog row to believe for this item among `candidates`, or null. */
export function pickFood(item: MealItem, candidates: FoodRef[]): Complete | null {
  const name = item.name_en?.trim();
  if (!name) return null;
  const d = item.kcal_per_100g;
  const usable = candidates.filter(complete).filter((f) =>
    (d === undefined || d <= 0 || (f.kcal_per_100g <= d * DENSITY_BAND && f.kcal_per_100g >= d / DENSITY_BAND))
    && (!SUBSTITUTE.test(f.name_en ?? f.name) || SUBSTITUTE.test(name)));
  let best: Complete | null = null, bestScore = -Infinity;
  for (const f of usable) {
    const sc = scoreFood(name, d, f);
    if (sc > bestScore) { best = f; bestScore = sc; }
  }
  return best && bestScore >= FLOOR ? best : null;
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
  per100: { kcal: f.kcal_per_100g, protein_g: f.protein_g_per_100g, carbs_g: f.carbs_g_per_100g, fat_g: f.fat_g_per_100g },
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
  deps: EngineDeps, analysis: AnalyzedMeal,
): Promise<{ analysis: AnalyzedMeal; grounded: number }> {
  if (!analysis.isFood || analysis.items.length === 0) return { analysis, grounded: 0 };
  let grounded = 0;
  const items = await Promise.all(analysis.items.map(async (item) => {
    if (!item.name_en?.trim() || !(item.grams > 0)) return item;
    try {
      const w = lookupWords(item.name_en);
      const hit = w.length === 0 ? null : pickFood(item, await deps.store.foodCandidates(w, POOL));
      if (!hit) return item;
      grounded++;
      return groundItem(item, hit);
    } catch (e) {
      console.error(`[eait] food lookup failed: ${(e as Error).message}`);
      return item;
    }
  }));
  console.error(`[eait] grounding: ${grounded}/${items.length} items from the catalog`);
  return { analysis: { ...analysis, items }, grounded };
}

/**
 * `groundAnalysis` behind the admin's switch, read per request (#563). Off hands the analysis
 * back exactly as the model returned it.
 */
export async function groundWhenOn(
  deps: EngineDeps, key: SwitchKey, analysis: AnalyzedMeal,
): Promise<{ analysis: AnalyzedMeal; grounded: number }> {
  return (await switchOn(deps, key)) ? groundAnalysis(deps, analysis) : { analysis, grounded: 0 };
}
