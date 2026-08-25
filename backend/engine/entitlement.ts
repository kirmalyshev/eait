// The paid tier: what an account is entitled to, and how a store event becomes that.
//
// ONE RULE ABOVE THE OTHERS: the paid daily photo cap is decided HERE, by `dailyPhotoCap`, and
// nowhere else. Two things need it — `checkCaps`, which refuses the request, and the profile's `limits`,
// which tells the app what to show — and two independently-written copies of one number is the
// failure this repo already documented for upload limits: the app says twelve photos left and the
// server refuses at three, and the user meets that as a refusal after they have chosen a photo.
//
// The webhook is the only way anything in here becomes true. There is no route by which a client
// can grant itself an entitlement, and there must never be one: the app's copy of its own
// subscription comes from the purchases SDK and is a rendering hint, not a credential.

import { entitlementActive, entitlementLive, type Entitlement } from "@ieat/shared";
import type { Config } from "../config.ts";
import type { EntitlementPatch } from "../store.ts";
import type { EngineDeps } from "./deps.ts";

/**
 * The photos-per-day allowance of an ENTITLED account, resolved in one place.
 *
 * There is no unentitled allowance to resolve: without an entitlement the account has the sample
 * (`config.freeAnalyses`, checked in `checkCaps`) and nothing per day.
 */
export function dailyPhotoCap(config: Config): number {
  return config.paidDailyPhotoCap;
}

/** This account's paid tier, in the shape the profile response carries. */
export async function entitlementFor(deps: EngineDeps, userId: string): Promise<Entitlement> {
  const stored = await deps.store.getEntitlement(userId);
  const now = Date.now();
  // THE DATE IS ONLY SENT WHEN IT IS THE GRANT KEEPING THEM IN. `expiresAt` is the subscription's
  // end and is never cleared, so a lifetime holder whose monthly lapsed still has a past date on
  // the record — and reporting it raw made the settings screen say "Active until 3 January" beside
  // a "Manage subscription" button opening a Customer Center with no subscription in it. The three
  // states `Entitlement` documents are the three the app is allowed to see.
  return {
    active: entitlementLive(stored, now),
    expiresAt: entitlementActive(stored?.expiresAt, now) ? stored?.expiresAt ?? null : null,
    // The trial is a property of the SUBSCRIPTION period, so it is only claimed while that period
    // is live — and never for a lifetime holder, whose reminders would announce a charge that will
    // not happen.
    trial: stored?.trial === true && stored?.lifetimeProductId === null &&
      entitlementActive(stored?.expiresAt, now),
  };
}

/**
 * The fields this server reads out of a RevenueCat webhook delivery.
 *
 * A SUBSET, deliberately. The payload carries price, currency, country, store, offer codes and the
 * rest of a purchase, and none of it is asked for: what is not extracted cannot be stored, and a
 * table holding what somebody paid and where they live is a table with a different legal weight
 * from one holding an expiry date.
 */
export interface RevenueCatEvent {
  /** OUR user id. The app calls `Purchases.logIn(userId)`, so this is the account it names. */
  appUserId: string;
  /**
   * RevenueCat's event type, verbatim, or "" when the delivery omitted it.
   *
   * Read for exactly one reason: an event with NO EXPIRY can be a lifetime purchase (grant it
   * forever) or a billing issue (change nothing), and the expiry alone cannot tell those apart.
   * Never matched exhaustively — RevenueCat adds types, and an unknown one must fall through to
   * "change nothing" rather than to an exception.
   */
  type: string;
  /** Every entitlement this event touches. Only the configured one grants the tier. */
  entitlementIds: string[];
  /** When the entitlement lapses, in epoch ms. Null on an event that grants nothing. */
  expirationAtMs: number | null;
  productId: string;
  /**
   * From `period_type`: this period is a free trial rather than a paid one.
   *
   * Extracted, where the rest of the payload deliberately is not, because it is the only signal
   * that separates a trial ending from a subscription renewing — and the two trial reminders are
   * addressed at one of those and would be a lie about the other.
   */
  trial: boolean;
  /** When the STORE generated the event. The ordering key — see `Store.putEntitlement`. */
  eventTimestampMs: number;
  /** From `environment`: an App Store sandbox or Test Store purchase, not a real one. */
  sandbox: boolean;
}

export type ApplyOutcome =
  /** Written. */
  | { applied: true }
  /** Read and deliberately ignored; `reason` is for the log, never for the caller's status code. */
  | { applied: false; reason: "other-entitlement" | "no-expiry" | "not-applied" | "sandbox" };

/**
 * The one-time purchase. A non-consumable has no period, so this is the event that arrives with
 * `expiration_at_ms: null` and MEANS something — everything else with a null expiry does not.
 */
const PERPETUAL_GRANT = "NON_RENEWING_PURCHASE";

/**
 * Events that END a purchase. A refund of a one-time purchase arrives as `CANCELLATION`, and
 * without this the lifetime unlock would be the one thing in this system nothing could take back:
 * refunded at Apple, still paid here, forever.
 */
const REVOCATIONS = new Set(["CANCELLATION", "EXPIRATION"]);

/**
 * Fold one webhook delivery into this account's entitlement.
 *
 * Every refusal below is a 200 to RevenueCat, not an error. A webhook that answers with a failure
 * gets retried, and retrying an event that was correctly ignored just means being told the same
 * irrelevant thing all day. The only 4xx this flow has is a bad credential, and that is decided
 * before anything here runs.
 *
 * `parseRevenueCatEvent` has already checked the shape. What is left here is meaning.
 */
export async function applyRevenueCatEvent(
  deps: EngineDeps,
  event: RevenueCatEvent,
): Promise<ApplyOutcome> {
  // An event about some other entitlement is not an event about the paid tier. A project can carry
  // a lifetime unlock or an internal comp alongside it, and treating "any entitlement at all" as
  // this one would sell the tier to whoever holds any of them.
  if (!event.entitlementIds.includes(deps.config.revenueCatEntitlementId)) {
    return { applied: false, reason: "other-entitlement" };
  }

  // A simulated purchase grants nothing real. The deployed host opts in only while purchases are
  // exercised from development and TestFlight builds (`ieat_revenuecat_accept_sandbox`), and must
  // opt out the day the listing goes live.
  if (event.sandbox && !deps.config.revenueCatAcceptSandbox) return { applied: false, reason: "sandbox" };

  const patch = patchFor(event);
  if (patch === IGNORE) return { applied: false, reason: "no-expiry" };

  // `not-applied` covers BOTH of the store's refusals — an id we never issued, and an event older
  // than the one already applied — and does not pretend to tell them apart: the write is one
  // statement whose WHERE clause carries both conditions, and splitting the reason would mean a
  // second query asking a question nothing acts on. Both are ordinary, and both answer 200.
  const written = await deps.store.putEntitlement(event.appUserId, {
    ...patch,
    productId: event.productId,
    eventAt: new Date(event.eventTimestampMs).toISOString(),
  });
  return written ? { applied: true } : { applied: false, reason: "not-applied" };
}

/** This delivery changes neither grant. */
const IGNORE = Symbol("ignore");

/**
 * Which of the two grants this delivery speaks for, or IGNORE.
 *
 * READS NOTHING. Every condition that depends on what is already stored is a condition ON THE
 * WRITE, enforced inside the store's single statement. An earlier version read the current record
 * and decided here, which was wrong in a way that only ever showed up as money: two deliveries for
 * one account can be in flight at once, nothing wraps the read and the write in a transaction, and
 * the webhook answers 200 either way, so a decision made from a stale read is dropped permanently
 * rather than retried.
 *
 * The two grants are separate and each delivery touches exactly one:
 *
 *   an expiry in the payload   the SUBSCRIPTION's new end. Every subscription event, i.e. nearly
 *                              all of them. Says nothing about a lifetime unlock and leaves it be.
 *   NON_RENEWING_PURCHASE      the lifetime unlock, which has no period to report. Leaves any
 *                              subscription's end date exactly where it was.
 *   CANCELLATION/EXPIRATION    the unlock's refund, cleared only if the stored unlock came from
 *     with no expiry           this same product. On a running subscription that same event means
 *                              "will not renew", and the month already paid for is still owed.
 *   anything else with none    a transfer, a billing issue, a product change. Changes nothing.
 *
 * KNOWN AND ACCEPTED: a refund delivered BEFORE the purchase it refunds is dropped, because there
 * is no unlock recorded for it to clear. The alternative would be worse than it looks — a write
 * with nothing to anchor it still stamps the ordering key, so the purchase that followed would be
 * refused as the older event, permanently, and a paying customer would be locked out of the account
 * they had just bought.
 */
function patchFor(event: RevenueCatEvent): Pick<EntitlementPatch, "expiresAt" | "lifetimeProductId"> | typeof IGNORE {
  if (event.expirationAtMs !== null) {
    return { expiresAt: new Date(event.expirationAtMs).toISOString() };
  }
  // A perpetual grant that cannot name what was bought is not one. Its product id is what the
  // refund must later match, so storing "" would create an unlock that any product-less event could
  // clear — and one that nothing in a support conversation could identify.
  if (event.type === PERPETUAL_GRANT) {
    return event.productId === "" ? IGNORE : { lifetimeProductId: event.productId };
  }
  if (!REVOCATIONS.has(event.type)) return IGNORE;
  return { lifetimeProductId: null };
}
