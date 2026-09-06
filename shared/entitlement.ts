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
 * "now" is and what grace period the store granted.
 *
 * NULL `expiresAt` MEANS TWO DIFFERENT THINGS AND `active` IS WHAT SEPARATES THEM:
 *
 *   { active: false, expiresAt: null }  never bought anything — the overwhelmingly common state
 *   { active: true,  expiresAt: null }  the LIFETIME unlock: entitled, with nothing to expire
 *   { active: true,  expiresAt: <date> } a subscription — or a lifetime holder who ALSO has one,
 *                                        which is why the app must branch on `active`, not on the
 *                                        presence of a date
 *
 * That is why nothing may infer "not entitled" from a missing date, and why a screen renders the
 * date only when there is one. The lifetime product is a non-consumable, so the store itself has
 * no period to report: RevenueCat sends `expiration_at_ms: null` and there is no honest instant
 * to invent. A far-future sentinel was the alternative and was rejected — every reader would have
 * to know the magic value, and the first one that did not would print the year 9999 to a customer.
 */
export interface Entitlement {
  active: boolean;
  /** ISO instant the tier lapses at. Null means never bought, or bought forever — see above. */
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
/**
 * What an account gets before the app asks for money — the sample, over its whole lifetime.
 *
 * It lives here rather than in the server's `configDefaults()` because the LANDING PAGE quotes it,
 * and the landing image ships `src/shared` and not `src/backend`: importing the server config from
 * the copy broke `docker build` with `Cannot find module '../config.ts'` and nothing before it.
 * Same reason `KCAL_FLOOR` is here. `EAIT__BACKEND__FREE_ANALYSES` still overrides it per instance;
 * this is the default the copy is written against.
 *
 * FIFTEEN since 2026-09-06 — three days of meals. It was one, then three (#96, 2026-09-02): one
 * analysis answers "what does it say about my food" and nothing else, a day of meals is what lets
 * the sample show the diary filling up against the target, and three days is what lets it show a
 * trend. The anxiety it buys off — "I will be charged again" — is the largest complaint cluster in
 * the review corpus (`marketing/research/2026-09-02-jtbd.md` J4). The cost is more billed calls
 * per non-payer, still bounded by the paid daily cap and by `globalDailyAnalysisCap`. It is a
 * LIFETIME count, not a per-day one, and it is the DEFAULT: the admin can give one account its
 * own number (`Store.setFreeAnalyses`).
 */
export const FREE_ANALYSES = 15;

export const NO_ENTITLEMENT: Entitlement = { active: false, expiresAt: null, trial: false };

/**
 * Whether a failed analysis just spent the free sample. A cap is charged before the model is asked
 * (a cap that only counts successes is one a retry loop walks through), so on the sample an
 * upstream failure MAY spend it — the server gives it back only when the gateway refused before
 * generating anything. Which happened is not knowable here, so every surface that invites a retry
 * reads a profile fetched at the failure and words itself from THAT: the retry meets a 402 or it
 * does not. One predicate, so the surfaces cannot disagree on the fact.
 */
// OPTIONAL ALL THE WAY DOWN, even though the types say these fields are required. A shipped app
// outlives its server, and a server that predates the paid tier answers /v1/profile with no
// `entitlement` at all — which typechecks perfectly and then throws on the dereference. That was
// seen for real against a running demo server on 2026-08-25 and guarded in `paywall.tsx`; this
// predicate is called from the chat, the camera and the meal screen, and had the same hole.
export const sampleSpent = (
  p: { limits?: { sampleUsed?: boolean }; entitlement?: { active?: boolean } } | null | undefined,
): boolean => !!p?.limits?.sampleUsed && !p?.entitlement?.active;

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

/**
 * Is a STORED entitlement record live at `now`?
 *
 * TWO INDEPENDENT GRANTS, and collapsing them into one field is a bug this code already shipped
 * once. A customer can hold a subscription (a period, ending on a date) AND the lifetime unlock
 * (no period at all), because both grant the same entitlement. When one field carried both, the
 * lifetime overwrote the subscription's end date — so refunding the lifetime left somebody who was
 * still paying for their monthly plan locked out until its next renewal.
 *
 * So: `lifetimeProductId` is the unlock, `expiresAt` is the subscription, neither speaks for the
 * other, and the account is entitled if EITHER says so. The absence of the RECORD is what means
 * "never bought anything".
 */
export function entitlementLive(
  record: { expiresAt: string | null; lifetimeProductId: string | null } | null | undefined,
  now: number,
): boolean {
  if (!record) return false;
  return record.lifetimeProductId !== null || entitlementActive(record.expiresAt, now);
}
