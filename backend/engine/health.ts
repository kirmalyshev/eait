// Health metrics imported from the user's phone, and the one thing they are allowed to change.
//
// The arithmetic that turns raw samples into days lives in `@ieat/shared` and runs on the phone —
// see `health.ts` there for why. What lives HERE is the part that must not be client-side: the
// validation, the user scoping, and the single rule about when an imported weight may move the
// calorie target.
//
// ONE METRIC HAS AN EFFECT, AND IT IS WEIGHT. Activity, energy and sleep are stored and shown and
// change nothing. The activity multiplier already prices activity into TDEE, so adding active
// energy on top of it double-counts, inflates the target, and quietly erases the deficit the user
// asked for — and a target that also moved every day would be one nobody could plan against.
// `targets.ts` is untouched by this file.

import {
  dateMinus, isAcceptableWeightKg, localDate, sanitizeHealthDay,
  type HealthDay, type HealthDaysResponse, type HealthResponse,
} from "@ieat/shared";
import type { EngineDeps } from "./deps.ts";
import { profileView } from "./profile.ts";

/** The longest trend a client may ask for. A year of daily rows is already a large response. */
export const MAX_TREND_DAYS = 365;

/**
 * How far back a day may be dated and still be stored. Two years.
 *
 * THIS IS WHAT BOUNDS ROWS PER USER. Accounts are free and this route is not billed, so without a
 * window a client can write four hundred distinct dates per request, spanning centuries, for as
 * long as it cares to. The `(user_id, date)` key stops one date being stored twice; it does nothing
 * about a client that simply never repeats one.
 *
 * Two years is also the honest limit of the product's interest: nothing here reads further back
 * than a year, and a health row from 2004 is not a trend, it is ballast.
 */
export const MAX_HEALTH_AGE_DAYS = 730;

/**
 * Store a batch of days, and sync the weight if this batch carries a newer one.
 *
 * Returns null when the account has not onboarded. Health data is special-category and the basis
 * for holding it is the consent given at the end of onboarding; accepting it before then would be
 * storing it with no basis at all.
 *
 * `weightMeasuredAt` is when the newest weight reading was TAKEN, as the phone read it off the
 * sample. When a client does not send one, it is derived from the day's own date rather than from
 * the clock: a weight filed under 2026-03-10 was measured no later than the end of that day, and
 * deriving it that way means a stale batch replayed later can never beat a correction the user made
 * in the meantime. Falling back to `now()` would do exactly that.
 */
export async function recordHealthDays(
  deps: EngineDeps,
  userId: string,
  days: HealthDay[],
  weightMeasuredAt?: string,
): Promise<HealthDaysResponse | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile || profile.onboarded_at === null) return null;

  // The storable window, computed once. A FUTURE date is refused rather than clamped: a phone with
  // a wrong clock is the usual cause, and filing today's steps under tomorrow makes the row wrong
  // when tomorrow actually arrives.
  const today = localDate(deps.config.timezone);
  const oldest = dateMinus(today, MAX_HEALTH_AGE_DAYS);

  // Every day is validated here, on the server. A metric outside its plausible range is nulled and
  // the rest of the day survives; a day with no usable date, nothing in it at all, or a date
  // outside the window is dropped whole. Answering 422 instead would make the phone retry a batch
  // that can never succeed.
  const clean: HealthDay[] = [];
  for (const day of days) {
    const ok = sanitizeHealthDay(day);
    if (!ok) continue;
    if (ok.date > today || ok.date < oldest) continue;
    clean.push(ok);
  }
  if (clean.length === 0) return { accepted: 0 };

  await deps.store.putHealthDays(userId, clean);

  // ── the one metric with an effect ──
  const newest = clean
    .filter((d) => d.weight_kg !== null)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!newest || !isAcceptableWeightKg(newest.weight_kg!)) return { accepted: clean.length };

  const measuredAt = weightMeasuredAt ?? endOfDay(newest.date);
  if (!isNewerMeasurement(measuredAt, profile.weight_measured_at)) {
    return { accepted: clean.length };
  }

  await deps.store.patchProfile(userId, {
    weight_kg: newest.weight_kg,
    weight_measured_at: measuredAt,
  });

  // The fresh view, so the app's plan updates without a second round trip. A new weight is a new
  // calorie target, and the alternative is a screen showing the old one until something else
  // happens to refresh it.
  const view = await profileView(deps, userId);
  return { accepted: clean.length, ...(view ? { profile: view } : {}) };
}

/** The trend this account has stored. Scoped, most recent first. Null when not onboarded. */
export async function healthTrend(
  deps: EngineDeps,
  userId: string,
  days: number,
): Promise<HealthResponse | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile || profile.onboarded_at === null) return null;

  const window = Math.max(1, Math.min(MAX_TREND_DAYS, Math.floor(days) || 1));
  const since = dateMinus(localDate(deps.config.timezone), window - 1);
  return { days: await deps.store.healthDaysSince(userId, since) };
}

/**
 * The latest instant a reading filed under `date` could have been taken.
 *
 * Deliberately not the local end of day: this value is only ever compared against another stored
 * instant to decide which measurement is newer, and being at most a few hours generous on a
 * fallback path the shipped client never takes is not worth a second zone computation that could
 * itself be wrong.
 */
function endOfDay(date: string): string {
  return `${date}T23:59:59.999Z`;
}

/** True when `incoming` is strictly newer. An unknown existing time loses — anything beats nothing. */
function isNewerMeasurement(incoming: string, existing: string | null): boolean {
  const at = Date.parse(incoming);
  if (Number.isNaN(at)) return false;
  if (existing === null) return true;
  const prev = Date.parse(existing);
  return Number.isNaN(prev) || at > prev;
}
