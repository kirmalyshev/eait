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
  /**
   * Whether the CURRENT period is a free trial rather than a paid one.
   *
   * The store knows and nothing else can work it out: an expiry seven days out and an expiry a year
   * out are the same shape, and two days before a yearly renewal looks exactly like two days before
   * a trial ends. Without this the trial reminders fire before every renewal — telling somebody who
   * pays that "the free week ends" and that they can stop it and pay nothing.
   *
   * False for an account that has never bought anything, and false for a stored entitlement written
   * before this field existed. That is the safe direction: the failure is a reminder that does not
   * arrive, not a wrong one that does.
   */
  trial: boolean;
}

/** What an account that has never purchased looks like. The overwhelmingly common case. */
export const NO_ENTITLEMENT: Entitlement = { active: false, expiresAt: null, trial: false };

/**
 * Whether a failed analysis just spent the free sample. A cap is charged before the model is asked
 * (a cap that only counts successes is one a retry loop walks through), so on the sample an
 * upstream failure spends it, and every surface that invites a retry must say so instead — the
 * retry would meet a 402. One predicate, so the surfaces that word it cannot disagree on the fact.
 */
export const sampleSpent = (
  p: { limits: { sampleUsed: boolean }; entitlement: { active: boolean } } | null | undefined,
): boolean => !!p && p.limits.sampleUsed && !p.entitlement.active;

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
