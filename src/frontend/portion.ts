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

/**
 * The request a save sends: every item's grams and numbers scaled, the totals scaled the same, and
 * the first item renamed when the field says the plate was something else.
 *
 * THE RENAME KEEPS THE REST OF THE PLATE. "What it was" is one line and the items are several rows:
 * it rewrites the first — the name the card leads with — and leaves the others, rather than asking
 * one field to parse a plate back into items.
 *
 * A renamed item drops `name_en`. That key is what the repertoire and the portion priors group by,
 * and it is only true while the name still is that food; "chicken breast" measured under a plate
 * the user just called "chicken and chips" is noise the median keeps forever.
 */
export function firstMealEdit(
  meal: Pick<MealAnalysis,
    "items" | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "satfat_g" | "fiber_g" | "sugar_g" | "sodium_mg">,
  whatItWas: string,
  portion: Portion,
): EditMealRequest {
  const f = PORTION_FACTOR[portion];
  const rename = whatItWas.trim();
  const items: MealItem[] = meal.items.map((item, i) => {
    const scaled: MealItem = {
      ...item,
      grams: whole(item.grams, f),
      kcal: item.kcal === undefined ? undefined : whole(item.kcal, f),
      protein_g: itemTenth(item.protein_g, f),
      carbs_g: itemTenth(item.carbs_g, f),
      fat_g: itemTenth(item.fat_g, f),
      // `kcal_per_100g` is a density — a property of the food, not of how much of it was on the
      // plate. Scaling it would quietly corrupt the next substitution that reads it.
    };
    if (i === 0 && rename !== "" && rename !== item.name) {
      scaled.name = rename;
      delete scaled.name_en;
    }
    return scaled;
  });
  return {
    items,
    kcal: whole(meal.kcal, f),
    protein_g: tenth(meal.protein_g, f),
    carbs_g: tenth(meal.carbs_g, f),
    fat_g: tenth(meal.fat_g, f),
    satfat_g: tenth(meal.satfat_g, f),
    fiber_g: tenth(meal.fiber_g, f),
    sugar_g: tenth(meal.sugar_g, f),
    sodium_mg: whole(meal.sodium_mg, f),
  };
}
