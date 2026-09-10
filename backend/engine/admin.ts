// The operator's read-only window onto ONE account's content.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT THIS IS FOR. Somebody says "the analysis was wrong", or a reply was strange. The evidence
// exists — the meal row, what the model answered, the photograph, the turn — and until #375/#376
// nothing but Postgres reached it.
//
// THREE RULES, AND THE FIRST IS THE ONE THAT LOOKS LIKE AN EXCEPTION AND IS NOT.
//
//  1. THE STORE READS ARE THE SAME SCOPED ONES THE APP USES. `mealsSince`, `getPhoto` and
//     `chatBefore` already take `userId` as an argument and already refuse another account's rows;
//     nothing here widens a query, and no store method exists for this file. What the admin gets is
//     the right to NAME an account it does not own — the id comes out of the PATH, under the role —
//     which is exactly the shape `/admin/api/users/<uuid>/cap` has had since it was written. The
//     invariant in `AGENTS.md` is about where a query's scope comes from, and it still comes from
//     one id passed as an argument.
//
//     The consequence is worth saying: an admin may not pair one account's id with another's meal.
//     The route hands both to a scoped read, so a mismatched pair is a 404 rather than a photograph.
//
//  2. WHAT IS SHOWN IS WHAT THE PERSON SAW. The thread is the app's OWN projection rather than a
//     second rendering (`adminUserChat`), and the verdicts on a meal are the ones
//     `verdictsFromTargets` → `visibleVerdicts` wrote when it was logged. A panel that computed its
//     own would show a verdict that never existed — and on a support question, seeing what they saw
//     is the whole point. The TARGETS travel with the diary so that a "bad" is readable against the
//     numbers it was judged by rather than being a colour.
//
//  3. READ-ONLY. The admin does not send a message as the coach, and editing somebody's diary from
//     an operator console is a different issue and probably a bad one. Nothing here writes.
//
// The cap and entitlement views live in `entitlement.ts`, where the cap is decided; this file is
// the account's own content.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import {
  explainTargets, localDate, windowStart,
  type ChatHistoryResponse, type FoodTargets, type MealRecord,
} from "@eait/shared";
import { chatHistory } from "./chat.ts";
import type { EngineDeps } from "./deps.ts";

/**
 * The most meals one request may return.
 *
 * A bound rather than a page, because the question is "what did they log around then" and the
 * answer is a window somebody narrows. `mealsSince` bounds by the newest rows, so a window wider
 * than this shows the near end of it — which is the end a support question is about.
 */
export const ADMIN_MEAL_ROWS = 200;

/** How far back the diary opens when the caller names no window. */
const DEFAULT_WINDOW_DAYS = 14;

export interface AdminDiary {
  from: string;
  to: string;
  meals: MealRecord[];
  /**
   * What this account's verdicts were computed against, or null before onboarding.
   *
   * Recomputed from the profile as it is NOW, and that is a limitation rather than a feature: a
   * plan changed since the meal was logged is a plan these numbers no longer describe. It is still
   * the only version of them that exists — nothing stores the targets per meal — and a verdict with
   * no numbers beside it is unreadable.
   */
  targets: FoodTargets | null;
}

/** Null when there is no such account. */
export async function adminUserDiary(
  deps: EngineDeps,
  userId: string,
  window: { from?: string; to?: string },
): Promise<AdminDiary | null> {
  const profile = await deps.store.getProfile(userId);
  if (profile === null) return null;

  const today = localDate(deps.config.timezone);
  const to = window.to ?? today;
  const from = window.from ?? windowStart(to, DEFAULT_WINDOW_DAYS);
  return {
    from,
    to,
    meals: await deps.store.mealsSince(userId, from, to, ADMIN_MEAL_ROWS),
    // `explainTargets` is the one path to a kcal target — the floor is applied inside it, and a
    // second route to one is what `src/shared/targets.ts` refuses in its header.
    targets: profile.onboarded_at === null ? null : explainTargets(profile).targets,
  };
}

/**
 * One account's thread, read back (#376).
 *
 * `chatHistory` AND NOT A SECOND RENDERING. The requirement is that what the operator reads is what
 * the user saw, and that is only true if it is ONE function: a panel with its own projection would
 * drift the first time a line kind was added, and drift silently, because nothing would compare the
 * two. A test asserts that this response and `GET /v1/messages` are equal for the same account.
 *
 * It also inherits the property that makes the Chat tab honest — a meal card is resolved on READ,
 * so it shows the meal as it is NOW and a verdict never outlives the numbers it described.
 *
 * WHAT IS NOT HERE, and it is two of the four things #376 asked for: the intent the router chose,
 * and what the turn cost. Neither is written down anywhere — `routeText` decides an intent and
 * returns it, `openrouter.ts` never reads `usage` off the response, and `chat_messages` has a
 * column for neither. A panel column that is null for every row is worse than a stated gap.
 */
export async function adminUserChat(
  deps: EngineDeps,
  userId: string,
  opts: { before?: number | null; limit?: number },
): Promise<ChatHistoryResponse | null> {
  // An account that does not exist is a 404 rather than an empty thread: "no such person" and "this
  // person has said nothing" are different answers to a support question.
  if (await deps.store.getProfile(userId) === null) return null;
  return chatHistory(deps, userId, opts);
}
