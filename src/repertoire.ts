// What this person actually eats, derived from their own diary (design:
// docs/design/2026-07-27-analysis-quality.md, lever A1). Pure — the db read lives in `db.ts`.
//
// The bot has every meal the user ever logged and used none of it when analysing the next photo.
// So a correction was applied to one row and forgotten: told "that is bulgur, not couscous", it
// made the identical mistake the following week. A repertoire turns that history into a prior.
//
// The risk is anchoring, and it is SYMMETRIC: a prior naming bulgur helps when bulgur was eaten
// and hurts when couscous was. That is the same failure class as the round-up hedge deleted from
// the prompt (see analyzer.ts) — a nudge in one direction only pays if the model errs in the
// other. So the prompt line built from this is hedged, and the adversarial case (a prior holding
// the confusable-but-WRONG name) is what decides whether this ships at all.

import type { MealItem } from "./types.ts";

/**
 * How many foods reach the prompt. Small on purpose: the prior exists to break ties on ambiguous
 * grains and staples, not to describe the user's entire diet. A list long enough to compete with
 * the photo for the model's attention is a list that overrides it.
 */
export const REPERTOIRE_MAX = 15;

/** A meal as the repertoire cares about it: what was in it, and whether the user vouched for it. */
export interface RepertoireRow {
  items: readonly MealItem[];
  /** `meals.corrected` — the user edited this meal, so its names are verified rather than guessed. */
  corrected: boolean;
}

/**
 * A corrected meal counts for this many unverified ones.
 *
 * Set above 1 deliberately: a name the principal fixed by hand is the only ground truth in the
 * system, and a name the model produced unchallenged is exactly the thing being corrected. If one
 * correction did not outweigh a couple of unverified logs, the prior would keep re-teaching the
 * model the mistake the user had already taken the trouble to fix.
 */
const CORRECTED_WEIGHT = 3;

/** Grouping key only — never displayed. Case and stray spacing are not different foods. */
const key = (name: string): string => name.trim().toLowerCase();

/**
 * Top foods from a user's recent meals, most-eaten first.
 *
 * `rows` must arrive NEWEST FIRST: ties resolve toward what was eaten most recently, so a food from
 * this month outranks an equally-frequent one from last year.
 */
export function buildRepertoire(rows: readonly RepertoireRow[]): string[] {
  const weight = new Map<string, number>();
  const spelling = new Map<string, Map<string, number>>();
  const firstSeen = new Map<string, number>();

  rows.forEach((row, index) => {
    // Once per MEAL, not once per item: three helpings of rice on one plate is one data point
    // about what this person eats, and counting per item would let a single many-component dish
    // dominate the entire prior.
    const seenHere = new Set<string>();
    for (const item of row.items) {
      const k = key(item.name ?? "");
      if (!k || seenHere.has(k)) continue;
      seenHere.add(k);
      weight.set(k, (weight.get(k) ?? 0) + (row.corrected ? CORRECTED_WEIGHT : 1));
      if (!firstSeen.has(k)) firstSeen.set(k, index);
      const forms = spelling.get(k) ?? new Map<string, number>();
      const display = item.name.trim();
      forms.set(display, (forms.get(display) ?? 0) + 1);
      spelling.set(k, forms);
    }
  });

  return [...weight.entries()]
    .sort((a, b) => b[1] - a[1] || firstSeen.get(a[0])! - firstSeen.get(b[0])!)
    .slice(0, REPERTOIRE_MAX)
    .map(([k]) => {
      // Report the spelling the user sees most often, not the lowercased grouping key — the prior
      // is read by a model that will echo it back into `items[].name`.
      const forms = [...spelling.get(k)!.entries()].sort((a, b) => b[1] - a[1]);
      return forms[0]![0];
    });
}
