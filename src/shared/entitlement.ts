// Whether an account is on the paid tier.
//
// The paid tier is bought through the App Store — Apple already holds the card, which is what
// keeps `no card, no trial` literally true — and RevenueCat is what tells THIS server about it.
// So the only thing an entitlement is, here, is an instant it lapses at.
//
// This lives in `shared` rather than in the backend because it is a rule both sides state:
// the server decides `active` and enforces the cap that follows from it, and the app renders what
// it was told. Neither may invent its own answer — a client that computed its own entitlement
// would be a client that could grant itself one.

import { localDate } from "./dates.ts";

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
  /**
   * Whether this account bought something once and nothing it bought keeps it in now — a
   * subscription that ended, or a lifetime unlock that was refunded. The app asks it to RESUBSCRIBE
   * rather than to subscribe, and nothing on the phone could tell the two apart without this: the
   * server blanks `expiresAt` the moment a grant stops keeping somebody in.
   *
   * False for an account that never bought anything and for one entitled now. OPTIONAL because a
   * server older than the field sends none, which the app reads as false: "subscribe" is the ask
   * true of both people. `entitlementFor` always sends it.
   */
  lapsed?: boolean;
  /**
   * Which day of the free week today is — the "5" of "free week · day 5" the Subscription row
   * shows — or null when the account is not on one. Computed server-side (`trialDay` below), so a
   * client renders it and never counts days itself: two counters would drift apart.
   *
   * OPTIONAL for the reason `lapsed` is — a server older than the field sends none.
   */
  trialDay?: number | null;
}

/** What an account that has never purchased looks like. The overwhelmingly common case. */
/**
 * What an account gets before the app asks for money — the sample, over its whole lifetime.
 *
 * It lives here rather than in the server's `configDefaults()` because the LANDING PAGE quotes it,
 * and the landing image ships `shared` and not `backend`: importing the server config from
 * the copy broke `docker build` with `Cannot find module '../config.ts'` and nothing before it.
 * Same reason `KCAL_FLOOR` is here. `EAIT__BACKEND__FREE_ANALYSES` still overrides it per instance;
 * this is the default the copy is written against.
 *
 * ONE since 2026-09-25 (#44), and that is the principal's decision for the v5 onboarding: the
 * plan is followed by a soft offer, closing it gives ONE meal on us, photographed or told, and its
 * verdict against the plan is followed by the offer that holds. This number is what makes it hold:
 * `checkCaps` answers the second analysis with `subscription-required`, and no client adds a lock
 * of its own. A manual correction (`EditMealRequest`) is not an analysis, so the free meal can
 * still be corrected; a TEXT correction is one and meets the 402.
 * History: one, then three (#96, 2026-09-02), then fifteen — three days of meals — on 2026-09-06,
 * to buy off the "I will be charged again" anxiety (`marketing/research/2026-09-02-jtbd.md` J4).
 * v5 answers that anxiety differently: nothing is asked for until the plan and the first verdict
 * are on the screen. It is a LIFETIME count, not a per-day one, and it is the DEFAULT: the admin
 * can give one account its own number (`Store.setFreeAnalyses`), and `EAIT__BACKEND__FREE_ANALYSES`
 * overrides it per instance.
 */
export const FREE_ANALYSES = 1;

export const NO_ENTITLEMENT: Entitlement = { active: false, expiresAt: null, trial: false, lapsed: false };

/**
 * The free week's length. Written once because "day 5 of 7" and the day-5/day-6 reminder names are
 * the same week counted two ways; a number that ever changed would have to change in one place.
 */
export const TRIAL_WEEK_DAYS = 7;

/**
 * Which day of the free week `today` is — the "5" of "free week · day 5" (#97).
 *
 * COUNTED OFF THE EXPIRY DATE, NOT THE START, for the reason `trialReminderDates` gives: the
 * expiry is what the store can move (a billing retry extends it) and what the client is told.
 * Anchored there, this number and the "two days to go" reminder can never disagree — day 5 IS two
 * days before the expiry date, by both definitions. A start-counted day would need the trial's
 * length the store never sees (RevenueCat sends no duration).
 *
 * Null the moment the period is not a live trial: never bought, converted to paid, lapsed, or an
 * expiry that does not parse. Day 1 is the first day of the week and day 7 the expiry's own date;
 * an expiry pushed beyond the week still answers 1 rather than a day 0 nobody can draw.
 */
export function trialDay(
  entitlement: { active: boolean; trial?: boolean; expiresAt: string | null },
  timezone: string,
  now: number = Date.now(),
): number | null {
  if (!entitlement.active || !entitlement.trial) return null;
  if (!entitlementActive(entitlement.expiresAt, now)) return null;
  const expiry = localDate(timezone, new Date(Date.parse(entitlement.expiresAt!)));
  const today = localDate(timezone, new Date(now));
  // Calendar-day difference: both are UTC-midnight strings, so the subtraction is exact.
  const left = Math.round((Date.parse(expiry) - Date.parse(today)) / 86_400_000);
  return Math.max(1, TRIAL_WEEK_DAYS - left);
}

/**
 * What the app offers where the camera button and the composer were, once this account cannot log
 * a meal: `"resubscribe"` once something it bought has ended, `"subscribe"` otherwise, and null while
 * a meal can still be logged. Read off the SERVER's profile, like `sampleSpent`, never the SDK's.
 */
export const blockedAsk = (
  p: { limits?: { sampleUsed?: boolean }; entitlement?: { active?: boolean; lapsed?: boolean } } | null | undefined,
): "subscribe" | "resubscribe" | null =>
  !sampleSpent(p) ? null : p?.entitlement?.lapsed ? "resubscribe" : "subscribe";

/**
 * Whether the turn that just finished may have spent the last of the sample, so the profile is worth
 * re-reading: `blockedAsk` is read off it, and nothing re-reads it when an analysis SUCCEEDS. An
 * unentitled account with at most one analysis left — or a profile too old to carry the count, which
 * re-reads, the safe direction.
 */
export const mayHaveSpentSample = (
  p: { limits?: { sampleRemaining?: number }; entitlement?: { active?: boolean } } | null | undefined,
): boolean => !!p && !p.entitlement?.active && (p.limits?.sampleRemaining ?? 0) <= 1;

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
