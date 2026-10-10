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

import { dateMinus, localDate } from "./dates.ts";

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
   * pays that "the free trial ends" and that they can stop it and pay nothing.
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
   * How many calendar days are left on the trial — the "day {n}" of "free trial · day {n}" the
   * Subscription row shows is `len − daysLeft`, with `len` read where the truth lives (the store's
   * own intro period on the phone, `paywall.trialDays` on the web) — or null when the account is
   * not on one. Counted off the EXPIRY (`trialDaysLeft` below), never the start: the expiry is
   * what the webhook delivers and what the store can move, so this one number is length-agnostic —
   * a 3-day trial and a 7-day one need nothing but their own end.
   *
   * OPTIONAL for the reason `lapsed` is — a server older than the field sends none.
   */
  trialDaysLeft?: number | null;
  /**
   * The subscription's store product id — RevenueCat's `product_id`, e.g. `yearly` — while a
   * subscription grant is live, so a client can ask the STORE what the renewal costs rather than
   * compile a price in. Null while no subscription period is live (a lifetime unlock is a
   * different grant and does not renew). OPTIONAL like `lapsed` — a server older than the field
   * sends none, and a client that cannot name the product shows the renewal without its price.
   */
  productId?: string | null;
  /**
   * The end of the referral week (#899) — a friend's free week, or the weeks a referrer earned —
   * while it is the ONLY grant keeping this account in, else null. Sent on that condition for the
   * reason `expiresAt` is: a date beside a live subscription or a lifetime unlock would describe a
   * grant that is not the one in force. With it, `{ active: true, expiresAt: null }` is the
   * referral week and not the lifetime unlock. OPTIONAL like `lapsed`.
   */
  bonusUntil?: string | null;
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
 * What the Subscription row IS, as one of five words (#175) — the board's "free trial · day 2" is
 * the trial state, and an empty value was the row saying nothing about the four others.
 *
 * The WORDS stay with each client's copy table; the STATE is the same rule on every surface.
 * `trialDaysLeft` wins because the server only counts it while a trial is live. A paid period reads
 * `until` its expiry — never "renews", because the store does not tell this server whether the
 * period renews. `ended` carries the expiry when the record still has one (the engine blanks it
 * when a grant stops counting, so a lapsed row usually answers `date: null`). And `free` is the
 * answer for an account that never bought — the overwhelmingly common state, now named.
 */
export type SubscriptionState =
  | { kind: "trial"; daysLeft: number }
  | { kind: "until"; date: string }
  | { kind: "lifetime" }
  | { kind: "ended"; date: string | null }
  | { kind: "free" };

export const subscriptionState = (e: Entitlement): SubscriptionState => {
  if (e.trialDaysLeft != null) return { kind: "trial", daysLeft: e.trialDaysLeft };
  if (e.active && e.expiresAt === null && e.bonusUntil) return { kind: "until", date: e.bonusUntil };
  if (e.active) return e.expiresAt === null ? { kind: "lifetime" } : { kind: "until", date: e.expiresAt };
  if (e.lapsed === true) return { kind: "ended", date: e.expiresAt };
  return { kind: "free" };
};

/**
 * The trial's canonical length in days — the "one length everywhere" ruling (ieat-app#1591):
 * App Store introductory offers AND the web's `WEB_TRIAL_DAYS` are configured to the same number.
 *
 * It is the FALLBACK, never the claim: the phone reads the intro period off the store's own
 * product (`freeTrialDays`), the web reads the operator's `trialDays`, and this constant answers
 * only when neither can — an intro absent from the store payload, a paywall the host never
 * configured.
 */
export const TRIAL_DAYS = 3;

/**
 * The one day a trial gets a reminder, as `YYYY-MM-DD` in `tz` — the day BEFORE the expiry.
 *
 * Derived from the EXPIRY rather than from the start, because the expiry is what the app is told
 * (`ProfileResponse.entitlement.expiresAt`) and what the store can move — a billing retry extends
 * it, and a reminder counted forwards from a purchase date would then fire in the middle of a
 * trial that is still running. Counted off the end it is also length-agnostic (ieat-app#1591):
 * a 3-day trial and a 7-day one both get exactly "the day before it ends", which is never on or
 * after the expiry — the "never the day after" promise.
 *
 * Null when there is no expiry, when it does not parse, or when it has already passed — all three
 * mean there is nothing to remind anybody about.
 */
export function trialReminderDate(
  expiresAt: string | null | undefined,
  tz: string,
  now: number = Date.now(),
): string | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at) || at <= now) return null;
  return dateMinus(localDate(tz, new Date(at)), 1);
}

/**
 * The reminder date of a live TRIAL, or null when this entitlement is not one.
 *
 * The gate `trialReminderDate` does not have, and the reason both sides call this rather than
 * that: the raw arithmetic answers "the day before the expiry" for ANY expiry, and the day before
 * a yearly renewal has exactly that shape. `entitlement.trial` is the only thing that separates
 * them, and it comes from the store by way of the RevenueCat webhook — no duration heuristic can,
 * because it is looking at the same day either way.
 */
export function trialReminder(
  entitlement: Entitlement,
  timezone: string,
  now: number = Date.now(),
): string | null {
  if (!entitlement.active || !entitlement.trial) return null;
  return trialReminderDate(entitlement.expiresAt, timezone, now);
}


/**
 * How many calendar days are left on the trial — 1 the day before the expiry date, 0 on it (#97).
 *
 * COUNTED OFF THE EXPIRY DATE, NOT THE START, for the reason `trialReminders` gives: the
 * expiry is what the store can move (a billing retry extends it) and what the client is told.
 * The trial's LENGTH is never needed — "the day before it ends" is a reminder both a 3-day and a
 * 7-day trial get the same way, and "day {n}" is `len − daysLeft` where `len` is the client's own
 * reading of the length (the store's intro period on the phone, `paywall.trialDays` on the web).
 * A start-counted day would need the trial's length the store never sends (RevenueCat reports no
 * duration).
 *
 * Null the moment the period is not a live trial: never bought, converted to paid, lapsed, or an
 * expiry that does not parse.
 */
export function trialDaysLeft(
  entitlement: { active: boolean; trial?: boolean; expiresAt: string | null },
  timezone: string,
  now: number = Date.now(),
): number | null {
  if (!entitlement.active || !entitlement.trial) return null;
  if (!entitlementActive(entitlement.expiresAt, now)) return null;
  const expiry = localDate(timezone, new Date(Date.parse(entitlement.expiresAt!)));
  const today = localDate(timezone, new Date(now));
  // Calendar-day difference: both are UTC-midnight strings, so the subtraction is exact.
  return Math.max(0, Math.round((Date.parse(expiry) - Date.parse(today)) / 86_400_000));
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
 * The referral week's effective end (#899): the dated week (`bonus_until`), then the days BANKED
 * behind the subscription, counted from whichever of the two ends later. Banked days follow the
 * subscription as it renews and arrive exactly when it stops — and are never used up by a dated
 * week still running then (review 5). Null when there is neither. This is the third input
 * `entitlementLive` takes and what `Entitlement.bonusUntil` reports.
 */
export function referralBonusEnd(
  bonusUntil: string | null, bankedDays: number, subscriptionExpiresAt: string | null | undefined,
): string | null {
  const end = subscriptionExpiresAt ? Date.parse(subscriptionExpiresAt) : NaN;
  const dated = bonusUntil ? Date.parse(bonusUntil) : NaN;
  const datedOrNone = Number.isFinite(dated) ? dated : -Infinity;
  // The bank runs after BOTH have run out, never alongside the dated week.
  const banked = bankedDays > 0 && Number.isFinite(end) ? Math.max(datedOrNone, end) + bankedDays * 86_400_000 : NaN;
  const at = Number.isFinite(banked) ? banked : datedOrNone;
  return Number.isFinite(at) ? new Date(at).toISOString() : null;
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
 *
 * `bonusUntil` is the THIRD grant (#899): the referral week, granted by this server rather than
 * bought, so it lives beside the record and not in it — a friend on their free week has bought
 * nothing, and the record's absence must keep saying so (`lapsed` reads it). REQUIRED, null when
 * there is none, so every caller has to say what it knows: a reader that left it out would be a
 * second opinion about "paid" that disagrees with the cap for a week.
 */
export function entitlementLive(
  record: { expiresAt: string | null; lifetimeProductId: string | null } | null | undefined,
  now: number,
  bonusUntil: string | null | undefined,
): boolean {
  if (entitlementActive(bonusUntil, now)) return true;
  if (!record) return false;
  return record.lifetimeProductId !== null || entitlementActive(record.expiresAt, now);
}
