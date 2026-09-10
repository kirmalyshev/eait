// The operator's read-only window onto ONE account's content.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THREE RULES, AND THE FIRST IS THE ONE THAT LOOKS LIKE AN EXCEPTION AND IS NOT.
//
//  1. THE STORE READS ARE THE SAME SCOPED ONES THE APP USES. `chatBefore` already takes `userId`
//     as an argument and already refuses another account's rows; nothing here widens a query, and
//     no new store method exists for this. What the admin gets is the right to NAME an account it
//     does not own — the id comes out of the PATH, under the role — which is exactly the shape
//     `/admin/api/users/<uuid>/cap` has had since it was written. The invariant in `AGENTS.md` is
//     about where a query's scope comes from, and it still comes from one id passed as an argument.
//
//  2. IT IS THE APP'S OWN PROJECTION, not a second rendering. See `adminUserChat`.
//
//  3. READ-ONLY. The admin does not send a message as the coach, and nothing here writes.
//
// The cap and entitlement views live in `entitlement.ts`, where the cap is decided; this file is
// the account's own content.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import type { ChatHistoryResponse } from "@eait/shared";
import { chatHistory } from "./chat.ts";
import type { EngineDeps } from "./deps.ts";

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
