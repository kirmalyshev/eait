// The meal edit's arithmetic (#188) — what the web's "Edit ingredient" panel and the phone's
// own send to `PATCH /v1/meals/:id`, and what the "a change, named" line diffs on.
//
// TWO RULES IT CARRIES:
//
//  1. AN ITEM'S OWN DENSITY WINS. `kcal_per_100g` is what a substitution rescales by, said in
//     MealItem's own comment; an item without one falls back to plain proportion — the same
//     rule `firstMealEdit` applies to a whole plate, so a grams edit and a portion agree where
//     they meet.
//  2. THE MEAL'S TOTALS MOVE BY THE ITEMS' DELTAS, never by a recomputed guess. An item reports
//     kcal and the three macros only, so satfat/fibre/sugar/sodium leave the request untouched;
//     verdicts are recomputed server-side off the user's caps after every write either way, so
//     nothing a client sends can paint over them.

import type { EditMealRequest } from "./contract.ts";
import type { MealAnalysis, MealItem } from "./types.ts";

const tenth = (n: number): number => Math.round(n * 10) / 10;
const whole = (n: number): number => Math.round(n);
/** An item's canonical key — `portionCorrections` and `changeLine` match on the same. */
const key = (i: MealItem): string => i.name_en ?? i.name;

/**
 * One item at a new amount: the grams the editor typed, its kcal off the stored density (the
 * proportion only when there is none), and the macros scaled in step. `name_en` and `role`
 * survive untouched — they are the repertoire's keys, not display.
 */
export function scaledItem(item: MealItem, grams: number): MealItem {
  const f = item.grams > 0 ? grams / item.grams : 0;
  const macro = (v: number | undefined): number | undefined =>
    v === undefined ? undefined : tenth(v * f);
  return {
    ...item,
    grams,
    kcal: item.kcal_per_100g !== undefined ? whole(item.kcal_per_100g * grams / 100)
      : item.kcal !== undefined ? whole(item.kcal * f) : undefined,
    protein_g: macro(item.protein_g),
    carbs_g: macro(item.carbs_g),
    fat_g: macro(item.fat_g),
  };
}

/** The items whose grams moved, matched on the canonical key; the name shown is AFTER's. */
export function movedItems(
  before: readonly MealItem[],
  after: readonly MealItem[],
): { item: MealItem; gramsBefore: number }[] {
  const was = new Map(before.map((i) => [key(i), i.grams]));
  return after.flatMap((i) => {
    const g = was.get(key(i));
    return g !== undefined && g !== i.grams ? [{ item: i, gramsBefore: g }] : [];
  });
}

const ITEM_TOTALS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;
const sum = (list: readonly MealItem[], f: typeof ITEM_TOTALS[number]): number =>
  list.reduce((n, i) => n + (i[f] ?? 0), 0);

/**
 * The `PATCH /v1/meals/:id` body for an edited item list — or NULL when nothing moved, so a
 * Done pressed unchanged writes nothing (#49's rule: no card about a meal that did not change).
 *
 * Each total the items report shifts by the items' delta (a rescaled rice carries +65 kcal onto
 * the meal; a removed one carries −195); a total no item reports — satfat, fibre, sugar, sodium —
 * is left out of the request, so the stored figure stands rather than wearing a guessed delta.
 */
export function mealEditRequest(
  meal: Pick<MealAnalysis, "items" | "kcal" | "protein_g" | "carbs_g" | "fat_g">,
  items: MealItem[],
): EditMealRequest | null {
  const same = meal.items.length === items.length && meal.items.every((o, i) => {
    const it = items[i]!;
    return key(o) === key(it) && o.grams === it.grams && ITEM_TOTALS.every((f) => o[f] === it[f]);
  });
  if (same) return null;
  const req: EditMealRequest = { items };
  for (const f of ITEM_TOTALS) {
    const delta = sum(items, f) - sum(meal.items, f);
    if (delta !== 0) req[f] = Math.max(0, f === "kcal" ? whole(meal[f] + delta) : tenth(meal[f] + delta));
  }
  return req;
}
