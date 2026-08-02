// The lifecycle of an edit the MODEL targeted — proposed, then approved, cancelled, or disambiguated.
//
// WHY THIS EXISTS AT ALL. A reply-based correction applies the moment it is routed: the user
// long-pressed a specific card, so there is nothing to confirm. An edit targeted from the
// conversation has no such anchor — the agent read a sentence, searched the diary and chose. That
// is a good guess, not a certainty, and a wrong guess writes a number into daily totals with
// nothing on screen naming which meal moved. So it waits for a tap, exactly as a text meal does.
//
// WHAT IS NOT HERE. No rendering, no i18n, no message ids — the surface turns these results into a
// card and a keyboard. And no routing: `text.ts` owns the model call, this owns what happens to
// what it decided.

import {
  applyCorrection, dailyTotals, deletePendingEdit, getPendingEdit, getUser, mealById, setMealDate,
} from "../db.ts";
import { mealRecordToAnalysis } from "./profile.ts";
import { PENDING_TTL_MS } from "./text.ts";
import type { EngineDeps, UserId } from "./deps.ts";
import type { ApplyEditResult } from "./results.ts";

/**
 * Apply an edit the user approved.
 *
 * Order of checks mirrors `confirmPendingMeal`, and for the same reason: the PENDING ROW is read
 * first, so a tap after a `/delete` gets "that expired" — which the user can act on — rather than
 * "you are not onboarded". A user-scoped read, so a forwarded or foreign id sees nothing.
 *
 * The row is NOT deleted here. The surface drops it after the card has actually been sent
 * (`dropPendingEdit`), so a failed send leaves a re-tappable offer instead of an applied edit the
 * user never saw. Both writes are idempotent — `applyCorrection` overwrites with the same values,
 * `setMealDate` sets the same date — so the re-tap converges.
 */
export async function applyPendingEdit(
  deps: EngineDeps,
  userId: UserId,
  pendingId: string,
): Promise<ApplyEditResult> {
  const { db } = deps;
  const pending = await getPendingEdit(db, pendingId, userId);
  if (!pending) return { kind: "expired" };

  const u = await getUser(db, userId);
  if (!u || u.state !== "active") return { kind: "not-onboarded" };

  // The lazy sweep only runs on inserts, so a confirm card can outlive the TTL on screen. Honoured
  // here too, or "expired" and the actual lifetime disagree.
  if (Date.parse(pending.ts) < Date.now() - PENDING_TTL_MS) {
    await deletePendingEdit(db, pendingId, userId);
    return { kind: "expired" };
  }

  // A `choose` row is not an edit — it is a question, and its buttons go to `resolveMealChoice`.
  // Reaching here means the surface wired a namespace wrongly; loud, and refused.
  if (pending.kind === "choose" || !pending.meal_id) {
    console.error(`[eait] applyPendingEdit on a ${pending.kind} row id=${pendingId} user=${userId}`);
    return { kind: "expired" };
  }

  // The meal can vanish between proposal and tap (a /delete race, a second instance). Read it first
  // so a 0-row write is never reported as applied, and so a re-date has macros for its card.
  const meal = await mealById(db, userId, pending.meal_id);
  if (!meal) {
    return { kind: "target-gone", on: pending.kind === "redate" ? "redate" : "correction" };
  }

  if (pending.kind === "correction") {
    if (!(await applyCorrection(db, meal.id, userId, pending.analysis!))) {
      return { kind: "target-gone", on: "correction" };
    }
    return {
      kind: "updated",
      mealId: meal.id,
      analysis: pending.analysis!,
      // The corrected meal keeps its OWN date, and these totals are for that date — not today's.
      totals: await dailyTotals(db, userId, meal.date),
      date: meal.date,
    };
  }

  const newDate = pending.new_date!;
  if (!(await setMealDate(db, meal.id, userId, newDate))) {
    return { kind: "target-gone", on: "redate" };
  }
  // The one sanctioned date mutation gets an audit line, as the reply-based path does — a "why did
  // my breakfast jump days" report is otherwise untraceable.
  console.log(
    `[eait] redate (chat-targeted) user=${userId} meal=${meal.id} ${meal.date}→${newDate}`,
  );
  return {
    kind: "redated",
    mealId: meal.id,
    // Macros unchanged — that is the whole distinction from a correction.
    analysis: mealRecordToAnalysis(meal),
    totals: await dailyTotals(db, userId, newDate),
    date: newDate,
  };
}

/** The user declined. Nothing was written, so this only clears the offer. */
export async function cancelPendingEdit(
  deps: EngineDeps,
  userId: UserId,
  pendingId: string,
): Promise<{ kind: "cancelled" } | { kind: "expired" }> {
  return (await deletePendingEdit(deps.db, pendingId, userId))
    ? { kind: "cancelled" }
    : { kind: "expired" };
}

/**
 * Drop a pending edit once its card is delivered. Idempotent from the caller's side: `false` means
 * a sweep or a concurrent tap got there first, which is harmless but worth a trace.
 */
export async function dropPendingEdit(
  deps: EngineDeps,
  userId: UserId,
  pendingId: string,
): Promise<boolean> {
  const gone = await deletePendingEdit(deps.db, pendingId, userId);
  if (!gone) console.warn(`[eait] pending edit ${pendingId} vanished before drop user=${userId}`);
  return gone;
}

/** What a tap on a disambiguation button resolves to: the message to replay, and against which meal. */
export interface ResolvedChoice {
  text: string;
  mealId: string;
}

/**
 * Resolve a tap on one of the candidate buttons.
 *
 * Returns the user's ORIGINAL message plus the meal they picked, for the caller to replay through
 * `handleText` with that meal as the focus. The replay is the point: the second pass is an ordinary
 * unambiguous edit, so there is no half-finished correction for this layer to keep in step with a
 * changing diary — and the user's tap has made the target as explicit as a reply would.
 *
 * `index`, not a meal id, because the caller is Telegram callback data: two UUIDs do not fit in 64
 * bytes. It also means a tampered payload can only ever select one of the candidates this row
 * already offered, rather than name an arbitrary meal.
 */
export async function resolveMealChoice(
  deps: EngineDeps,
  userId: UserId,
  pendingId: string,
  index: number,
): Promise<ResolvedChoice | undefined> {
  const pending = await getPendingEdit(deps.db, pendingId, userId);
  if (!pending || pending.kind !== "choose" || !pending.candidates) return undefined;
  if (Date.parse(pending.ts) < Date.now() - PENDING_TTL_MS) {
    await deletePendingEdit(deps.db, pendingId, userId);
    return undefined;
  }
  const mealId = pending.candidates[index];
  if (!Number.isInteger(index) || mealId === undefined) return undefined;
  // The meal must still exist: replaying against a deleted row would route with a focus meal the
  // engine then cannot load, which surfaces as the generic failure rather than "it's gone".
  if (!(await mealById(deps.db, userId, mealId))) return undefined;
  return { text: pending.source_text ?? "", mealId };
}
