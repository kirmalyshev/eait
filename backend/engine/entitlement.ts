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

import { entitlementActive, type Entitlement } from "@ieat/shared";
import type { Config } from "../config.ts";
import type { StoredEntitlement } from "../store.ts";
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
  return {
    active: entitlementActive(stored?.expiresAt, Date.now()),
    expiresAt: stored?.expiresAt ?? null,
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
  /** Every entitlement this event touches. Only the configured one grants the tier. */
  entitlementIds: string[];
  /** When the entitlement lapses, in epoch ms. Null on an event that grants nothing. */
  expirationAtMs: number | null;
  productId: string;
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

  // No expiry means the event grants nothing that can lapse — a transfer, a billing issue, a
  // product change with no period attached. Writing a null would be indistinguishable from never
  // having subscribed, and writing "now" would be inventing a cancellation the store did not send.
  // Leaving the stored state alone is the only honest option: a real revocation arrives as an
  // event whose expiry is in the past, and that one IS applied.
  if (event.expirationAtMs === null) return { applied: false, reason: "no-expiry" };

  const stored: StoredEntitlement = {
    expiresAt: new Date(event.expirationAtMs).toISOString(),
    productId: event.productId,
    eventAt: new Date(event.eventTimestampMs).toISOString(),
  };

  // `not-applied` covers BOTH of the store's refusals — an id we never issued, and an event older
  // than the one already applied — and does not pretend to tell them apart: the write is one
  // statement whose WHERE clause carries both conditions, and splitting the reason would mean a
  // second query asking a question nothing acts on. Both are ordinary, and both answer 200.
  const written = await deps.store.putEntitlement(event.appUserId, stored);
  return written ? { applied: true } : { applied: false, reason: "not-applied" };
}
