// Logging a meal, and editing one after the fact.
//
// TWO INVARIANTS THIS FILE CARRIES:
//
//  1. IMAGES ARE EPHEMERAL. Bytes are read into memory, handed to the analyzer, and dropped. No
//     disk write, no object store, no staging directory "just for retries". This is the product's
//     invariant, not the Telegram bot's, and a second front end is exactly where it would quietly
//     be broken.
//  2. VERDICTS ARE COMPUTED HERE, NEVER ACCEPTED. Not from the model, and not from the client. They
//     are derived from the user's caps after every write — including every manual edit — so a
//     verdict can never describe numbers that have since changed.

import {
  type DailyTotals, type EditMealRequest, type LogPhotoResult, type MealAnalysis, type MealHint,
  type MealItem, type MealLogged, type MealRecord, type MealUpdated, type TargetGone,
  type ConfirmMealResult, explainTargets, verdictsFromTargets, visibleVerdicts,
} from "@ieat/shared";
import { localDate, localTime } from "../dates.ts";
import type { EngineDeps } from "./deps.ts";
import { checkCaps } from "./caps.ts";
import type { AnalyzedMeal } from "../llm/port.ts";

/** Images arrive as thunks so nothing is READ until the caps have passed. */
export interface LogPhotoInput {
  images: (() => Promise<Uint8Array>)[];
  caption?: string;
}

/** Sum a day's meals. The single place totals are produced, so two views cannot disagree. */
export function sumTotals(meals: readonly MealRecord[]): DailyTotals {
  const t: DailyTotals = {
    kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0,
  };
  for (const m of meals) {
    t.kcal += m.kcal; t.protein_g += m.protein_g; t.carbs_g += m.carbs_g; t.fat_g += m.fat_g;
    t.satfat_g += m.satfat_g; t.fiber_g += m.fiber_g; t.sugar_g += m.sugar_g; t.sodium_mg += m.sodium_mg;
  }
  return t;
}

/**
 * Which nudge to show under a freshly logged meal.
 *
 * Not decoration. The incumbent's second-largest complaint cluster is wrong estimates and its
 * smallest is "fixing a wrong result doesn't work" — a correction loop nobody can find is the same
 * as not having one. A low-confidence analysis says so and invites the fix immediately.
 */
function hintFor(analysis: AnalyzedMeal): MealHint {
  return analysis.confidence === "low" ? "lowConfidence" : "correction";
}

/**
 * Recompute the verdicts for an analysis against the user's current caps, then gate them.
 *
 * Exported because `handleText` needs it too. A proposed meal is the ONE analysis the app renders
 * without a store round-trip, so it is the one place an analyzer's raw output — which has no
 * `verdicts` field at all — could reach a client, and did.
 */
export async function gatedVerdicts(deps: EngineDeps, userId: string, a: {
  kcal: number; satfat_g: number; sodium_mg: number;
}) {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return {};
  const { targets } = explainTargets(profile);
  // Belt and braces, both cheap, both on a medical claim: derive only declared dimensions, then
  // filter for declared dimensions again.
  return visibleVerdicts(verdictsFromTargets(a, targets), profile.restrictions);
}

export async function logPhotoMeal(
  deps: EngineDeps,
  userId: string,
  input: LogPhotoInput,
): Promise<LogPhotoResult> {
  const profile = await deps.store.getProfile(userId);
  if (!profile || profile.onboarded_at === null) return { kind: "not-onboarded" };

  const zone = deps.config.timezone;
  const date = localDate(zone);

  const refusal = await checkCaps(deps, userId, date, "photo");
  if (refusal) return refusal;

  // Recorded BEFORE the call. A failed model call still costs money, so a cap that only counts
  // successes is a cap a retry loop walks straight through.
  await deps.store.recordAnalysis(userId, date, "photo");

  const images = await Promise.all(input.images.map((read) => read()));
  const { targets } = explainTargets(profile);

  let analysis: AnalyzedMeal;
  try {
    analysis = await deps.llm.analyzePhoto({
      images, profile, targets,
      ...(input.caption !== undefined ? { caption: input.caption } : {}),
      localTime: localTime(zone),
      repertoire: await buildRepertoire(deps, userId, date),
    });
  } catch (e) {
    // Logged, never returned: the message can carry the prompt, and the prompt carries the user's
    // medical free text.
    console.error(`[ieat] photo analysis failed: ${(e as Error).message}`);
    return { kind: "analysis-failed" };
  }
  // `images` goes out of scope here and is never written anywhere. That is the whole mechanism.

  if (!analysis.isFood) return { kind: "not-food" };

  const record: MealRecord = {
    ...analysis,
    id: crypto.randomUUID(),
    user_id: userId,
    ts: new Date().toISOString(),
    date,
    verdicts: await gatedVerdicts(deps, userId, analysis),
    corrected: false,
    model: deps.config.llmModel,
  };
  await deps.store.insertMeal(record);

  const totals = sumTotals(await deps.store.mealsForDate(userId, date));
  return {
    kind: "logged", mealId: record.id, analysis: { ...analysis, verdicts: record.verdicts },
    totals, date, hint: hintFor(analysis),
  } satisfies MealLogged;
}

/**
 * The manual edit — "possibility to edit the LLM answer", in its direct form.
 *
 * The natural-language form goes through `handleText` and ends up here too, so both paths share one
 * write, one verdict recomputation, and one `corrected` flag. There is deliberately no way to edit
 * a meal without recomputing verdicts.
 */
export async function editMeal(
  deps: EngineDeps,
  userId: string,
  mealId: string,
  patch: EditMealRequest,
): Promise<MealUpdated | TargetGone> {
  const existing = await deps.store.getMeal(userId, mealId);
  // Scoped read: another user's meal id resolves to null here, indistinguishable from a deleted one.
  if (!existing) return { kind: "target-gone", on: "correction" };

  const merged = {
    items: patch.items ?? existing.items,
    kcal: patch.kcal ?? existing.kcal,
    protein_g: patch.protein_g ?? existing.protein_g,
    carbs_g: patch.carbs_g ?? existing.carbs_g,
    fat_g: patch.fat_g ?? existing.fat_g,
    satfat_g: patch.satfat_g ?? existing.satfat_g,
    fiber_g: patch.fiber_g ?? existing.fiber_g,
    sugar_g: patch.sugar_g ?? existing.sugar_g,
    sodium_mg: patch.sodium_mg ?? existing.sodium_mg,
  };

  const updated = await deps.store.updateMeal(userId, mealId, {
    ...merged,
    verdicts: await gatedVerdicts(deps, userId, merged),
    corrected: true,
  });
  // Not redundant with the read above: the row can vanish between the two (a concurrent account
  // delete). A correction that silently succeeded against nothing is worse than one that says so.
  if (!updated) return { kind: "target-gone", on: "correction" };

  const totals = sumTotals(await deps.store.mealsForDate(userId, updated.date));
  return { kind: "updated", mealId, analysis: toAnalysis(updated), totals, date: updated.date, via: "manual" };
}

/** Apply an LLM-produced correction. Same write path as a manual edit; only `via` differs. */
export async function applyCorrection(
  deps: EngineDeps,
  userId: string,
  mealId: string,
  analysis: AnalyzedMeal,
): Promise<MealUpdated | TargetGone> {
  const res = await editMeal(deps, userId, mealId, {
    items: analysis.items, kcal: analysis.kcal, protein_g: analysis.protein_g,
    carbs_g: analysis.carbs_g, fat_g: analysis.fat_g, satfat_g: analysis.satfat_g,
    fiber_g: analysis.fiber_g, sugar_g: analysis.sugar_g, sodium_mg: analysis.sodium_mg,
  });
  return res.kind === "updated" ? { ...res, via: "nl" } : res;
}

/** A stored row, back to the analysis shape a card renders. */
export function toAnalysis(m: MealRecord): MealAnalysis {
  return {
    isFood: m.isFood, items: m.items as MealItem[], kcal: m.kcal, protein_g: m.protein_g,
    carbs_g: m.carbs_g, fat_g: m.fat_g, satfat_g: m.satfat_g, fiber_g: m.fiber_g,
    sugar_g: m.sugar_g, sodium_mg: m.sodium_mg, verdicts: m.verdicts, confidence: m.confidence,
    notes: m.notes,
  };
}

export async function confirmPendingMeal(
  deps: EngineDeps,
  userId: string,
  pendingId: string,
): Promise<ConfirmMealResult | { kind: "expired" }> {
  const pending = await deps.store.getPending(userId, pendingId);
  if (!pending) return { kind: "expired" };

  const record: MealRecord = {
    ...pending.analysis,
    id: crypto.randomUUID(),
    user_id: userId,
    ts: new Date().toISOString(),
    date: pending.date,
    verdicts: await gatedVerdicts(deps, userId, pending.analysis),
    corrected: false,
    model: deps.config.llmModel,
  };
  await deps.store.insertMeal(record);
  // Confirm and drop collapse: this response IS the delivery, so there is no window in which the
  // meal is logged but the user has seen nothing.
  await deps.store.dropPending(userId, pendingId);

  const totals = sumTotals(await deps.store.mealsForDate(userId, pending.date));
  return {
    kind: "logged", mealId: record.id, analysis: { ...pending.analysis, verdicts: record.verdicts },
    totals, date: pending.date, hint: hintFor(pending.analysis),
  };
}

export async function cancelPendingMeal(
  deps: EngineDeps,
  userId: string,
  pendingId: string,
): Promise<{ kind: "cancelled" } | { kind: "expired" }> {
  const pending = await deps.store.getPending(userId, pendingId);
  if (!pending) return { kind: "expired" };
  await deps.store.dropPending(userId, pendingId);
  return { kind: "cancelled" };
}

/**
 * Foods this user logs most often, most frequent first.
 *
 * An IDENTIFICATION prior and nothing else — the prompt says so explicitly. It exists because the
 * same person eats the same twenty things, and knowing that is the difference between "rice" and
 * "the bulgur he has four times a week". It must never touch a number.
 */
async function buildRepertoire(deps: EngineDeps, userId: string, today: string): Promise<string[]> {
  const { dateMinus } = await import("../dates.ts");
  const since = dateMinus(today, 30);
  const days = await deps.store.totalsSince(userId, since);
  const counts = new Map<string, number>();
  for (const d of days) {
    for (const meal of await deps.store.mealsForDate(userId, d.date)) {
      for (const item of meal.items) {
        const key = item.name_en ?? item.name;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 20).map(([name]) => name);
}
