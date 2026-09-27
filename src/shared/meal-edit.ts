// The meal edit's arithmetic (#188) — what the web's "Edit ingredient" panel and the phone's
// own send to `PATCH /v1/meals/:id`, and the deep links that open those panels.
//
// TWO RULES IT CARRIES:
//
//  1. AN ITEM'S OWN DENSITY WINS. `kcal_per_100g` is what a substitution rescales by, said in
//     MealItem's own comment; an item without one falls back to plain proportion — the same
//     rule `firstMealEdit` applies to a whole plate, so a grams edit and a portion agree where
//     they meet.
//  2. THE CLIENT SENDS ITEMS, NEVER MEAL TOTALS. `editMeal` derives the meal's kcal and macros
//     from the items on an items-only patch — totals the client computed would be a second copy
//     of that rule. Verdicts are recomputed server-side off the user's caps after every write
//     either way, so nothing a client sends can paint over them.

import type { EditMealRequest } from "./contract.ts";
import type { MealAnalysis, MealItem } from "./types.ts";

const tenth = (n: number): number => Math.round(n * 10) / 10;
const whole = (n: number): number => Math.round(n);

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

const ITEM_TOTALS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;

/**
 * The `PATCH /v1/meals/:id` body for an edited item list — `{ items }` and nothing else; the
 * server derives the meal's totals from them — or NULL when nothing moved, so a Done pressed
 * unchanged writes nothing (#49's rule: no card about a meal that did not change).
 */
export function mealEditRequest(
  meal: Pick<MealAnalysis, "items">,
  items: MealItem[],
): EditMealRequest | null {
  const same = meal.items.length === items.length && meal.items.every((o, i) => {
    const it = items[i]!;
    return o.name === it.name && o.name_en === it.name_en && o.grams === it.grams &&
      ITEM_TOTALS.every((f) => o[f] === it[f]);
  });
  return same ? null : { items };
}

/**
 * The `#/meal/<id>` deep links' query (#188): `fix` opens the fix sheet, `item=<n>` the
 * ingredient's editor. `item` accepts digits only — `parseInt("1abc")` must not open a row.
 */
export function mealEditParams(query: string): { fix: boolean; item: number | null } {
  const p = new URLSearchParams(query);
  const raw = p.get("item");
  return { fix: p.has("fix"), item: raw !== null && /^\d+$/.test(raw) ? Number(raw) : null };
}
