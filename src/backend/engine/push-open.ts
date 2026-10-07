// A push was opened (#1759): the phone reports it, the admin reads the funnel.
//
// Both halves are thin on purpose. Whose send an id is gets decided by the store (`recordPushOpen`
// selects through `send_log`), so there is nothing here to get wrong about scoping — and the answer
// is `{ ok: true }` whether the open was recorded, was a repeat, or named an account's send that is
// not the caller's. A route that distinguished them would let a caller probe for other accounts'
// send ids.

import type { PushOpenRequest, PushOpenResponse } from "@eait/shared";
import type { PushStatRow } from "../store.ts";
import type { EngineDeps } from "./deps.ts";

/** The widest window the admin view reads. A bound rather than a page: it is a per-day table. */
export const PUSH_STATS_MAX_DAYS = 90;
const DEFAULT_DAYS = 7;

export async function recordPushOpen(
  deps: EngineDeps, userId: string, body: PushOpenRequest,
): Promise<PushOpenResponse> {
  await deps.store.recordPushOpen(userId, body.sendId, body.action ?? "tap");
  return { ok: true };
}

export interface PushOpenView {
  days: number;
  /** The zone each row's `day` is dated in: the instance's, as the evening line is. */
  timezone: string;
  rows: PushStatRow[];
}

export async function pushOpenView(deps: EngineDeps, days: number): Promise<PushOpenView> {
  const bounded = Number.isFinite(days)
    ? Math.min(PUSH_STATS_MAX_DAYS, Math.max(1, Math.floor(days)))
    : DEFAULT_DAYS;
  const timezone = deps.config.timezone;
  return { days: bounded, timezone, rows: await deps.store.pushOpenStats(bounded, timezone) };
}
