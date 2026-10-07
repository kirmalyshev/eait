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

import type { FoodRef, MealItem } from "@eait/shared";
import type { AnalyzedMeal } from "../llm/port.ts";
import type { EngineDeps } from "./deps.ts";

const CANDIDATES = 5;
/**
 * How far the catalog's density may sit from the model's own for the match to be believed. Raw rice
 * (365 kcal/100 g) against a plate of cooked rice (130) is a 2.8× gap and a wrong answer by 180%;
 * a real match is within the model's noise. Outside this band the model's estimate stands.
 */
const DENSITY_BAND = 2;

const words = (s: string): string[] => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);

type Complete = FoodRef & {
  kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number;
};
const complete = (f: FoodRef): f is Complete =>
  f.kcal_per_100g !== null && f.protein_g_per_100g !== null && f.carbs_g_per_100g !== null && f.fat_g_per_100g !== null;

/** The catalog row to believe for this item, or null. Exact English name first, then every query word present. */
export function pickFood(item: MealItem, candidates: FoodRef[]): Complete | null {
  const key = item.name_en?.trim().toLowerCase();
  if (!key) return null;
  const want = words(key);
  const usable = candidates.filter(complete).filter((f) => {
    const d = item.kcal_per_100g;
    return d === undefined || d <= 0 || (f.kcal_per_100g <= d * DENSITY_BAND && f.kcal_per_100g >= d / DENSITY_BAND);
  });
  const nameOf = (f: FoodRef) => (f.name_en ?? f.name).toLowerCase();
  return usable.find((f) => nameOf(f) === key)
    ?? usable.find((f) => { const have = words(nameOf(f)); return want.length > 0 && want.every((w) => have.includes(w)); })
    ?? null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/** The item with the catalog's nutrition for its grams. */
function groundItem(item: MealItem, f: Complete): MealItem {
  const k = item.grams / 100;
  return {
    ...item,
    kcal: Math.round(f.kcal_per_100g * k),
    protein_g: round1(f.protein_g_per_100g * k),
    carbs_g: round1(f.carbs_g_per_100g * k),
    fat_g: round1(f.fat_g_per_100g * k),
    kcal_per_100g: f.kcal_per_100g,
  };
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
      const hit = pickFood(item, await deps.store.searchFoods(item.name_en.trim(), CANDIDATES));
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
