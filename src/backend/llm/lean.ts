// The lean photo answer (ieat-app#1989, eait#607): the L1 prompt's schema, and the widening that
// turns it back into the `AnalyzedMeal` every downstream seam already expects.
//
// L1 asks the model for LESS than `MealAnalysisSchema` and measures shorter: per item only a name,
// the canonical English name, grams and the food's energy density — plus ONE set of meal-level
// macros for everything on the plate. Grounding then prices the items it can match from `food_ref`
// (`ground.ts`, unchanged), and the model's meal-level macros are the pool an unmatched item's
// share is split out of, by kcal. `prompt.photo-lean` (admin_switches) is the switch; `analysis_lean`
// (llm_prompts) is the text.

import { z } from "zod";
import type { MealItem } from "@eait/shared";
import type { AnalyzedMeal } from "./port.ts";
import { MealAnalysisSchema } from "./prompt.ts";

export const LeanItemSchema = z.object({
  name: z.string().min(1),
  name_en: z.string().min(1),
  grams: z.number().nonnegative(),
  kcal_per_100g: z.number().nonnegative(),
  role: z.enum(["cooking-fat"]).optional(),
});
export const LeanSchema = z.object({
  isFood: z.boolean(),
  scale: MealAnalysisSchema.shape.scale,
  items: z.array(LeanItemSchema),
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string(),
  question: MealAnalysisSchema.shape.question,
});

/** Lean answer -> the full shape: per-item kcal from density, meal macros shared by kcal as the no-match fallback. */
export function widen(l: z.infer<typeof LeanSchema>): z.infer<typeof MealAnalysisSchema> {
  const kc = l.items.map((i) => (i.grams * i.kcal_per_100g) / 100);
  const sum = kc.reduce((s, k) => s + k, 0) || 1;
  const share = (v: number, k: number) => Math.round(((v * k) / sum) * 10) / 10;
  return {
    ...l,
    satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0,
    items: l.items.map((i, n) => ({
      ...i, kcal: Math.round(kc[n]!),
      protein_g: share(l.protein_g, kc[n]!), carbs_g: share(l.carbs_g, kc[n]!), fat_g: share(l.fat_g, kc[n]!),
    })),
  };
}

/**
 * One streamed lean item as the `MealItem` the wire already carries (#607): kcal priced from the
 * density, and NO macros — they cannot be split while the meal-level pool is still streaming, and
 * the shared type marks them optional exactly so a row can be sent before they exist.
 */
export function leanStreamItem(i: z.infer<typeof LeanItemSchema>): MealItem {
  return { ...i, kcal: Math.round((i.grams * i.kcal_per_100g) / 100) };
}

/**
 * A full answer as the lean schema would carry it — the shape the demo analyzer streams when it is
 * asked for the lean one, so `--demo` walks the same item events a billed lean turn does.
 */
export function toLean(analysis: AnalyzedMeal): z.infer<typeof LeanSchema> {
  const { satfat_g: _s, fiber_g: _f, sugar_g: _u, sodium_mg: _n, ...rest } = analysis;
  return {
    ...rest,
    // `MealAnalysis.confidence` is a plain string; an analyzer's own values are the enum's three.
    confidence: analysis.confidence as z.infer<typeof LeanSchema>["confidence"],
    items: analysis.items.map((i) => ({
      name: i.name,
      name_en: i.name_en ?? i.name,
      grams: i.grams,
      kcal_per_100g: i.kcal_per_100g ?? 0,
      ...(i.role !== undefined ? { role: i.role } : {}),
    })),
  };
}
