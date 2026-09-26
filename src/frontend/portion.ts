// The first meal's manual correction, as data (#42): "What it was" and a Portion, turned into the
// `EditMealRequest` that `PATCH /v1/meals/:id` already speaks.
//
// PURE AND DOM-FREE ON PURPOSE, and beside `copy.ts` rather than inside `main.ts`: the browser
// tsconfig has `types: []`, so the arithmetic a test must reach cannot live behind a DOM it would
// have to fake. `test/portion.test.ts` is the bun half.
//
// THE EDIT IS THE FREE MEAL'S SECOND HALF. The sample is ONE analysis, so a correction that asked
// the model — a text correction through `/v1/messages` — is a billed turn and would meet the 402
// the moment "Correct meal" mattered most. This one sends numbers the client already holds, the
// route charges nothing for it, and the verdicts come back recomputed off the user's caps exactly
// like every other write: the request carries items and totals, never `verdicts`.

import type { MealAnalysis, MealItem } from "@eait/shared";
import type { EditMealRequest } from "@eait/shared/contract";

/** The three portions the edit screen offers, as the factor each scales the plate by. */
export type Portion = "small" | "regular" | "large";
export const PORTION_FACTOR: Record<Portion, number> = { small: 0.75, regular: 1, large: 1.25 };

/** Whole units where the analyzer reports them (kcal, grams, mg); a tenth where it keeps one. */
const whole = (n: number, f: number): number => Math.round(n * f);
const tenth = (n: number, f: number): number => Math.round(n * f * 10) / 10;
const itemTenth = (n: number | undefined, f: number): number | undefined =>
  n === undefined ? undefined : tenth(n, f);

/** The whole meal's name as the field shows it: every item, in order (#49). */
export const mealTitle = (items: readonly Pick<MealItem, "name">[]): string =>
  items.map((i) => i.name).join(", ");

/**
 * The request a save sends, or NULL when the save changes nothing.
 *
 * NULL IS THE POINT (#49). A save with the name as it was and a Regular portion changes no number,
 * so it sends nothing: no write, and no "Updated" written into the thread about a meal that did
 * not change.
 *
 * THE FIELD IS THE WHOLE MEAL. It is prefilled with `mealTitle` (every item), so a changed name
 * says the whole plate was something else: it becomes ONE item under that name, carrying the
 * plate's grams and totals. Renaming only the first row once turned "Grilled salmon, rice, green
 * salad" into that name plus the old "Basmati rice" row. The new item has no `name_en` and no
 * `kcal_per_100g`: both belonged to foods the plate is no longer called, and the repertoire and
 * the portion priors would keep that noise forever. An unchanged name keeps every item and only
 * scales them.
 */
export function firstMealEdit(
  meal: Pick<MealAnalysis,
    "items" | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "satfat_g" | "fiber_g" | "sugar_g" | "sodium_mg">,
  whatItWas: string,
  portion: Portion,
): EditMealRequest | null {
  const f = PORTION_FACTOR[portion];
  const name = whatItWas.trim();
  const renamed = name !== "" && name !== mealTitle(meal.items);
  if (!renamed && portion === "regular") return null;
  const totals = {
    kcal: whole(meal.kcal, f),
    protein_g: tenth(meal.protein_g, f),
    carbs_g: tenth(meal.carbs_g, f),
    fat_g: tenth(meal.fat_g, f),
    satfat_g: tenth(meal.satfat_g, f),
    fiber_g: tenth(meal.fiber_g, f),
    sugar_g: tenth(meal.sugar_g, f),
    sodium_mg: whole(meal.sodium_mg, f),
  };
  if (renamed && meal.items.length > 0) {
    const grams = meal.items.reduce((g, i) => g + i.grams, 0);
    return {
      items: [{
        name, grams: whole(grams, f),
        kcal: totals.kcal, protein_g: totals.protein_g, carbs_g: totals.carbs_g, fat_g: totals.fat_g,
      }],
      ...totals,
    };
  }
  const items: MealItem[] = meal.items.map((item) => ({
    ...item,
    grams: whole(item.grams, f),
    kcal: item.kcal === undefined ? undefined : whole(item.kcal, f),
    protein_g: itemTenth(item.protein_g, f),
    carbs_g: itemTenth(item.carbs_g, f),
    fat_g: itemTenth(item.fat_g, f),
    // `kcal_per_100g` is a density — a property of the food, not of how much of it was on the
    // plate. Scaling it would quietly corrupt the next substitution that reads it.
  }));
  return { items, ...totals };
}
