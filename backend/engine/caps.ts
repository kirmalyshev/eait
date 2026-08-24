// Spend caps. The only thing standing between a public app and an unbounded model bill.
//
// Two scopes, and they are not the same guard. The per-user cap is a fairness/abuse limit. The
// global cap is a budget limit on the whole instance, and it is what makes it safe to run without
// an allowlist — which matters, because the funnel this app sits at the end of requires strangers
// to be able to use it without gatekeeping.

import type { Refusal } from "@ieat/shared";
import type { EngineDeps } from "./deps.ts";
import { dailyPhotoCap, entitlementFor } from "./entitlement.ts";

export type CapScope = "photo" | "text";

/**
 * Null when the request may proceed, a refusal when it may not.
 *
 * A text turn is checked against the GLOBAL budget only. Charging a question against the per-user
 * photo allowance would mean asking "how much protein have I had" costs the user a meal they could
 * have logged, which is the kind of accounting that quietly teaches people not to use the chat.
 */
export async function checkCaps(
  deps: EngineDeps,
  userId: string,
  date: string,
  scope: CapScope,
): Promise<Refusal | null> {
  const { store, config } = deps;

  if (config.globalDailyAnalysisCap > 0) {
    const global = await store.countGlobalAnalyses(date);
    if (global >= config.globalDailyAnalysisCap) return { kind: "cap-exceeded", scope: "global" };
  }

  if (scope === "photo") {
    // The paid tier is a BIGGER per-user cap, never an exemption from the global one above — a
    // subscription buys a larger share of the instance budget, not the right to exhaust it.
    //
    // Read from the store on every photo rather than carried in the session, and that is the point:
    // a subscription that lapsed an hour ago must stop working an hour ago. An entitlement cached
    // for the life of a bearer token would be cached for up to 180 days.
    const cap = dailyPhotoCap(config, (await entitlementFor(deps, userId)).active);
    if (cap > 0) {
      // Photos only — `countUserPhotos` excludes text turns, which is the half of this rule that a
      // shared counter silently broke until a test caught it.
      const mine = await store.countUserPhotos(userId, date);
      if (mine >= cap) return { kind: "cap-exceeded", scope: "user" };
    }
  }

  return null;
}
