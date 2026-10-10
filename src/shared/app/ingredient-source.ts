// Where an ingredient's numbers come from (ieat-app #1954), drawn once for the phone's and the
// web's Edit ingredient. The card reads ONLY the item — `ref`, `food`, and the item's own stored
// figures — and `FOOD_SOURCES`: nothing is computed here, because the server re-derives both on
// every write and the card shows what came back.

import { FOOD_SOURCES } from "../foods.ts";
import type { Lang } from "../lang.ts";
import { fill, kcalNumbers, numbers, UNIT_KCAL } from "../lang.ts";
import type { MealItem } from "../types.ts";
import { chatScreenCopyFor } from "./chat-copy.ts";
import { mealCopyFor } from "./meal-copy.ts";

/** One row of four figures: `value` already formatted, `caption` its label. */
export interface SourceFigures {
  label: string;
  columns: { value: string; caption: string }[];
}

export interface IngredientSourceCard {
  /** "From the food table" or "Estimate". */
  label: string;
  /** The row's own name, the table's display name and every attribution — absent on an estimate. */
  row?: string;
  table?: string;
  credits: string[];
  /** Per 100 g (table only), then the item's own amount. */
  figures: SourceFigures[];
}

export function ingredientSourceCard(item: MealItem, lang: Lang): IngredientSourceCard {
  const mc = mealCopyFor(lang);
  const macro = chatScreenCopyFor(lang).macroLabels;
  const gram = (v: number): string => fill(mc.phoneGrams, { n: numbers(lang)(v) });
  const kn = kcalNumbers(lang);
  const columns = (kcal: number | undefined, p: number | undefined, c: number | undefined, f: number | undefined) => {
    const out: SourceFigures["columns"] = [];
    if (kcal !== undefined) out.push({ value: kn(Math.round(kcal)), caption: UNIT_KCAL[lang] });
    if (p !== undefined) out.push({ value: gram(p), caption: macro.protein });
    if (c !== undefined) out.push({ value: gram(c), caption: macro.carbs });
    if (f !== undefined) out.push({ value: gram(f), caption: macro.fat });
    return out;
  };
  const mine: SourceFigures = {
    label: fill(mc.phoneSourceFor, { amount: gram(item.grams) }),
    columns: columns(item.kcal, item.protein_g, item.carbs_g, item.fat_g),
  };
  const food = item.ref !== undefined ? item.food : undefined;
  if (food === undefined) {
    return { label: mc.phoneSourceEstimate, credits: [], figures: [mine] };
  }
  const p = food.per100;
  return {
    label: mc.phoneSourceFromTable,
    row: food.name,
    // A `ref` prefix `FOOD_SOURCES` has not met is shown unnamed rather than invented.
    ...(FOOD_SOURCES[food.source] !== undefined ? { table: FOOD_SOURCES[food.source]!.name } : {}),
    credits: food.attribution,
    figures: [
      { label: fill(mc.phoneSourcePer, { amount: gram(100) }), columns: columns(p.kcal, p.protein_g, p.carbs_g, p.fat_g) },
      mine,
    ],
  };
}
