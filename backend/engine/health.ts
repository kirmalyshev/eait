// Health metrics imported from the user's phone, and the one thing they are allowed to change.
//
// The arithmetic that turns raw samples into days lives in `@eait/shared` and runs on the phone —
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
  HEALTH_RETENTION_DAYS, dateMinus, isAcceptableWeightKg, localDate, sanitizeHealthDay,
  windowStart,
  type HealthDay, type HealthDaysResponse, type HealthResponse,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { profileView } from "./profile.ts";

// How far back a day may be dated and still be stored is `dateMinus(today, HEALTH_RETENTION_DAYS)`,
// and the widest trend a client may read is `windowStart(today, HEALTH_RETENTION_DAYS)` — ONE DAY
// NARROWER, which is not a typo. The ingest slack absorbs the phone-server midnight race described
// at the bound itself. The consequence is that the oldest storable day is not servable, which is
// real and is filed, not fixed here. The contract owns the number because the phone's first sync
// and the diary's window have to agree with it.

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
  // ONE DAY WIDER THAN `healthTrend` SERVES, AND LEFT THAT WAY DELIBERATELY. The slack absorbs the
  // phone-server midnight race: a first sync started at 23:59:58 reads five years of samples and
  // posts five batches, and the server's `today` can roll over before the first one lands. Without
  // the extra day the oldest day is then dropped with no signal, and `syncHealth` sets its
  // first-sync flag unconditionally, so the wide read is never retried for the life of the
  // process. Narrowing it to `windowStart` is filed rather than done here.
  const oldest = dateMinus(today, HEALTH_RETENTION_DAYS);

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

  const measuredAt = measurementInstant(weightMeasuredAt, newest.date);
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

  const window = Math.max(1, Math.min(HEALTH_RETENTION_DAYS, Math.floor(days) || 1));
  const since = windowStart(localDate(deps.config.timezone), window);
  return { days: await deps.store.healthDaysSince(userId, since) };
}

/**
 * When the newest weight was measured, as far as this server is willing to believe.
 *
 * THE CLIENT DOES NOT GET TO STAMP THE FUTURE. `weightMeasuredAt` is read off a sample by the
 * phone, and the phone's clock is the phone's business — a device running a year fast, or a client
 * that simply says so, would otherwise write a stamp that beats every honest measurement after it.
 * The user's own manual edit would still land (that path stamps `now()` unconditionally), but every
 * subsequent Apple Health weight would lose the comparison and be dropped, silently, for as long as
 * the fabricated stamp stayed in the future. A measurement cannot have been taken later than now,
 * so anything ahead of now is held to now.
 *
 * A stamp that is not a time at all falls back to the day's own end, exactly as a missing one does.
 * Treating it as "no newer measurement" instead would throw the weight away over a malformed field
 * that carries no information either way.
 *
 * The fallback is deliberately not the local end of day: it is only ever compared against another
 * stored instant, and being at most a few hours generous on a path the shipped client never takes
 * is not worth a second zone computation that could itself be wrong.
 */
function measurementInstant(claimed: string | undefined, date: string): string {
  const claimedAt = claimed === undefined ? Number.NaN : Date.parse(claimed);
  // The end of the day the reading is filed under. Clamped by the same rule, which only ever bites
  // for TODAY: an older day's end is already in the past, so the anti-replay property survives.
  const at = Number.isNaN(claimedAt) ? Date.parse(`${date}T23:59:59.999Z`) : claimedAt;

  const now = Date.now();
  return new Date(Math.min(at, now)).toISOString();
}

/** True when `incoming` is strictly newer. An unknown existing time loses — anything beats nothing. */
function isNewerMeasurement(incoming: string, existing: string | null): boolean {
  const at = Date.parse(incoming);
  if (Number.isNaN(at)) return false;
  if (existing === null) return true;
  const prev = Date.parse(existing);
  return Number.isNaN(prev) || at > prev;
}
