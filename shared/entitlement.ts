// Whether an account is on the paid tier.
//
// The paid tier is bought through the App Store — Apple already holds the card, which is what
// keeps `no card, no trial` literally true — and RevenueCat is what tells THIS server about it.
// So the only thing an entitlement is, here, is an instant it lapses at.
//
// This lives in `src/shared` rather than in the backend because it is a rule both sides state:
// the server decides `active` and enforces the cap that follows from it, and the app renders what
// it was told. Neither may invent its own answer — a client that computed its own entitlement
// would be a client that could grant itself one.

/**
 * The paid-tier state of one account, as told to the client.
 *
 * `expiresAt` is present so a settings screen can say when the subscription renews or ends. It is
 * NOT what the app should branch on: `active` is, because the server is the one that knows what
 * "now" is and what grace period the store granted. A null `expiresAt` with `active: false` is the
 * ordinary state of everyone who has never bought anything.
 */
export interface Entitlement {
  active: boolean;
  /** ISO instant, or null when this account has never had an entitlement at all. */
  expiresAt: string | null;
}

/** What an account that has never purchased looks like. The overwhelmingly common case. */
export const NO_ENTITLEMENT: Entitlement = { active: false, expiresAt: null };

/**
 * Is an entitlement expiring at `expiresAt` still live at `now`?
 *
 * The store's own grace and billing-retry periods are already baked into the expiry RevenueCat
 * sends, so there is deliberately no second grace window here — adding one would extend a
 * subscription past the point the store itself considers it over.
 *
 * An unparseable value is NOT entitled. It is the safe direction: the failure of a bad timestamp
 * is somebody being asked to subscribe again, not somebody holding a permanent free pass that no
 * webhook can ever revoke.
 */
export function entitlementActive(expiresAt: string | null | undefined, now: number): boolean {
  if (!expiresAt) return false;
  const at = Date.parse(expiresAt);
  return Number.isFinite(at) && at > now;
}
