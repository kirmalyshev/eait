// Spend caps. The only thing standing between a public app and an unbounded model bill.
//
// Two scopes, and they are not the same guard. The per-user cap is a fairness/abuse limit. The
// global cap is a budget limit on the whole instance, and it is what makes it safe to run without
// an allowlist — which matters, because the funnel this app sits at the end of requires strangers
// to be able to use it without gatekeeping.

import type { Refusal } from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { GatewayRefusal, type OnCost } from "../llm/port.ts";
import { dailyPhotoCap, entitlementFor, freeAnalysesFor } from "./entitlement.ts";

export type CapScope = "photo" | "text";

/**
 * Null when the request may proceed, a refusal when it may not.
 *
 * Without an entitlement the account has the SAMPLE and nothing else: `freeAnalysesFor`
 * analyses over its lifetime, photo or text alike — a sentence must not be the free way
 * around the ask. With one, photos meet the paid daily cap and text turns meet only the global
 * budget: charging a question against the photo allowance would mean asking "how much protein
 * have I had" costs the user a meal they could have logged, which quietly teaches people not to
 * use the chat.
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

  // Read from the store on every request rather than carried in the session, and that is the
  // point: a subscription that lapsed an hour ago must stop working an hour ago. An entitlement
  // cached for the life of a bearer token would be cached for up to 180 days.
  const entitled = (await entitlementFor(deps, userId)).active;
  if (!entitled) {
    const spent = await store.countUserAnalyses(userId);
    return spent >= (await freeAnalysesFor(deps, userId)) ? { kind: "subscription-required" } : null;
  }

  // The paid tier is a BIGGER per-user cap, never an exemption from the global one above — a
  // subscription buys a larger share of the instance budget, not the right to exhaust it.
  if (scope === "photo") {
    const cap = dailyPhotoCap(config);
    if (cap > 0) {
      // Photos only — `countUserPhotos` excludes text turns, which is the half of this rule that a
      // shared counter silently broke until a test caught it.
      const mine = await store.countUserPhotos(userId, date);
      if (mine >= cap) return { kind: "cap-exceeded", scope: "user" };
    }
  }

  return null;
}

/**
 * Charge one analysis, BEFORE the model is asked, and return where its calls report their cost.
 *
 * The cost arrives after the charge and is ADDED to it, because one charge pays for several calls
 * — a schema retry, the router's second call, the coach's rounds, the glance — and the glance lands
 * whenever it lands. A write that fails is a log line: the turn is paid for either way (#484).
 */
export async function charge(deps: EngineDeps, userId: string, date: string, scope: CapScope): Promise<OnCost> {
  const id = await deps.store.recordAnalysis(userId, date, scope);
  return (usd) => {
    void deps.store.addCost(userId, id, usd).then(
      // Refunded or merged away while a call was still out — the glance beside a refused analyzer.
      (landed) => { if (!landed) console.error(`[eait] cost not recorded: analysis ${id} is gone (${usd ?? "unpriced"})`); },
      (e: unknown) => { console.error(`[eait] cost not recorded: ${(e as Error)?.message ?? e}`); },
    );
  };
}

/**
 * The other half of charging before the call: give the analysis back when the gateway refused
 * before generating anything, and only then.
 *
 * Lives beside `checkCaps` because it is the same rule read backwards, and because both charge
 * sites must answer it identically — a typed first meal that burns a sample a photo would have kept
 * is the bug this exists to prevent. Anything that is not a `GatewayRefusal` may have cost real
 * money and stays charged.
 *
 * Never throws. The caller is already inside a catch, handling a failure it is about to word for
 * the user; a store that cannot delete must not turn that handled failure into a 500 — and must not
 * swallow the log line the caller writes after it.
 */
export async function refundGatewayRefusal(
  deps: EngineDeps,
  userId: string,
  date: string,
  scope: CapScope,
  e: unknown,
): Promise<boolean> {
  if (!(e instanceof GatewayRefusal)) return false;
  return await deps.store.undoAnalysis(userId, date, scope).catch((x: unknown) => {
    console.error(`[eait] refund failed: ${(x as Error)?.message ?? x}`);
    return false;
  });
}
