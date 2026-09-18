// A user's own line, edited or deleted (#608). Messenger semantics and nothing else: a photo line
// IS its meal, a text line is words already applied, an assistant line is not the user's to touch.

import type { DeleteLineResponse, EditLineLast, OUTCOME_UNKNOWN, PhotoEvent, TargetGone } from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { rewriteMeal } from "./meals.ts";

export interface EditLineInput {
  /** The new note. Empty is a re-read with no note. */
  text: string;
  /** Angles to ADD; the stored photos stay. Thunks, so nothing is read until the caps have passed. */
  images: (() => Promise<Uint8Array>)[];
}

const GONE: TargetGone = { kind: "target-gone", on: "correction" };

/**
 * Delete the caller's line. A photo line whose meal exists takes the meal, its photos and every
 * card for it — the meal was that message. A photo line with no meal, or a text line, goes alone;
 * a text line's held proposal is dropped with it, so no card can answer a message that is gone.
 * Every read and write is scoped: another account's id is `target-gone`, never a 404 and never
 * a row.
 */
export async function deleteLine(
  deps: EngineDeps, userId: string, lineId: string,
): Promise<DeleteLineResponse | TargetGone | { kind: "bad-request" }> {
  const line = await deps.store.getLine(userId, lineId);
  if (!line) return GONE;
  if (line.role !== "user") return { kind: "bad-request" };
  // A line is its meal, typed or photographed: a confirmed proposal is stored under the proposal's id.
  const mealId = line.kind === "photo" ? line.mealId : line.pendingId;
  if (mealId !== null) {
    const meal = await deps.store.getMeal(userId, mealId);
    if (meal) {
      // The meal first: a line that outlives its meal reads as a photo of nothing, which the
      // cards already know how to be; a meal that outlives its line is a diary row nobody sent.
      await deps.store.deleteMeal(userId, meal.id);
      await deps.store.deleteMealLines(userId, meal.id);
      await deps.store.deleteLine(userId, lineId);
      return { kind: "deleted", mealId: meal.id, date: meal.date };
    }
  }
  if (line.kind === "text" && line.pendingId !== null) await deps.store.dropPending(userId, line.pendingId);
  await deps.store.deleteLine(userId, lineId);
  return { kind: "deleted", mealId: null, date: null };
}

/**
 * Edit the caller's photo line: the analyzer reads every photo again — the stored ones and the
 * angles added here — with the new words as the caption, the meal's numbers change with
 * `corrected: false`, and then, and only then, the line's words change. A refused or failed turn
 * changes neither, so they can never disagree. The photo bound is counted against what is
 * stored, before anything is charged; the added angles themselves are not read until
 * `rewriteMeal`'s spine has passed the caps — the same moment it reads the stored bytes it reads
 * them alongside — so a capped account's angle is never opened, and it is sniffed exactly once,
 * after the caps and before the charge. Text lines are not editable: numbers already applied stay
 * applied.
 */
export async function editLine(
  deps: EngineDeps, userId: string, lineId: string, input: EditLineInput,
  onEvent?: (event: PhotoEvent) => void,
): Promise<Exclude<EditLineLast, { kind: typeof OUTCOME_UNKNOWN }>> {
  const line = await deps.store.getLine(userId, lineId);
  if (!line) return GONE;
  if (line.role !== "user" || line.kind !== "photo") return { kind: "bad-request" };
  if (line.mealId === null) return GONE;
  const existing = await deps.store.getMeal(userId, line.mealId);
  if (!existing) return GONE;
  const limit = deps.config.maxPhotosPerMeal;
  if ((existing.photos ?? 0) + input.images.length > limit) return { kind: "too-many", limit };
  const profile = await deps.store.getProfile(userId);
  if (!profile || profile.onboarded_at === null) return { kind: "not-onboarded" };

  const text = input.text.trim();
  const out = await rewriteMeal(deps, userId, existing, profile, text || undefined,
    () => Promise.all(input.images.map((read) => read())), onEvent);
  if (out.kind !== "updated") return out;
  // LAST. The numbers describe the photos and these words now; a line that changed before a
  // refused turn would describe an analysis that never happened.
  await deps.store.updateLineText(userId, lineId, text || null);
  return out;
}
