// The weigh-in log — the Progress chart's data and the goal bar's arc (#84).
//
// One person's weight arrives by two doors: `health_days.weight_kg` is what the phone's health
// store synced, and the `weights` table is what she TYPED (`PATCH /v1/profile`). The merged log is
// one entry per date — a typed correction is the user's own word for that day and beats the
// imported reading, which is also the tie the goal bar's `start` needs: on the onboarding day the
// PATCH's row stands over whatever the scale reported that morning.
//
// No client does any of this: not the merge, not the range's start date (the server computes it
// from `range` in the account's zone), and not the goal arithmetic (`projectGoal`, on the stored
// plan — the projection a client derived would disagree with the plan the same screen shows).

import {
  bmi, bmiRange, dateMinusMonths, explainTargets, localDate, projectGoal, projectionMonth, windowStart,
  type PlanProjection, type Profile, type TargetOutcome, type WeightEntry, type WeightsResponse,
  type WeightRange,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";

/**
 * The lowest date `range` reaches. Computed HERE, in the server's zone: "6M" is six calendar
 * months — with the day clamped rather than rolled, the way `dateMinusMonths` spells it — and
 * `all` is the whole log, which nothing older than year one can precede.
 */
function rangeStart(range: WeightRange, today: string): string {
  switch (range) {
    case "90D": return windowStart(today, 90);
    case "6M": return dateMinusMonths(today, 6);
    case "1Y": return dateMinusMonths(today, 12);
    case "all": return "0001-01-01";
  }
}

/**
 * Both halves of the weigh-in log, merged to one entry per date, oldest first — chart order, the
 * order `weightChart` reads its endpoints off.
 *
 * The manual row wins a shared date: it is what the user TYPED, and a typed correction of an
 * imported reading is the correction, not a duplicate. Health rows with no weight carry nothing.
 */
export async function mergedWeights(
  deps: EngineDeps,
  userId: string,
  since: string,
): Promise<WeightEntry[]> {
  const [manual, health] = await Promise.all([
    deps.store.weightsSince(userId, since),
    deps.store.healthDaysSince(userId, since),
  ]);
  const byDate = new Map<string, WeightEntry>();
  for (const d of health) {
    if (d.weight_kg !== null) byDate.set(d.date, { date: d.date, kg: d.weight_kg, source: "health" });
  }
  for (const w of manual) byDate.set(w.date, { date: w.date, kg: w.kg, source: "manual" });
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** `GET /v1/weights`. Null when the account has no profile — the surface turns that into a 403. */
export async function weights(
  deps: EngineDeps,
  userId: string,
  range: WeightRange,
): Promise<WeightsResponse | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const zone = deps.config.timezone;
  const since = rangeStart(range, localDate(zone));
  const outcome = explainTargets(profile);
  // The whole log, read once: the range slice is a filter on it, the projection's `currentKg` is
  // its newest entry, and the BMI is that same newest weigh-in — three answers, one scan.
  const log = await mergedWeights(deps, userId, rangeStart("all", ""));
  const value = bmi(log.at(-1)?.kg ?? profile.weight_kg, profile.height_cm);
  return {
    weights: log.filter((e) => e.date >= since),
    // The newest weigh-in whatever the range cut — the card's current figure and its
    // none-in-range state read this, the trend's endpoints read the filtered list.
    latest: log.at(-1) ?? null,
    projection: planProjection(profile, outcome, log, zone),
    bmi: value === null ? null : { value, range: bmiRange(value) },
  };
}

/**
 * `WeightsResponse.projection` — the goal arc the Progress bar draws, or null where no honest one
 * exists.
 *
 * `currentKg` is the NEWEST weigh-in in the merged log — where she actually is — not the profile's
 * stored `weight_kg`, which is what the plan was computed on and stops being "now" the moment a
 * newer scale reading lands. `startKg` is where the plan STARTED: the earliest weigh-in dated on
 * or after `onboarded_at`, so a health backfill predating the account never claims the slot; with
 * none that recent it is the earliest logged at all, and with none at all it is `currentKg`.
 * One re-anchor (`ieat-app#1486`): when the newest weigh-in sits FURTHER from the target than that
 * start — an account that gained back over the start of a lose plan, or fell under a gain one's —
 * the arc begins there instead. "74 → 68 · 0kg down · 25 to go" is three numbers describing two
 * different journeys; the card's headline, "down" and "to go" must agree on ONE start, and the
 * honest one is where she is.
 *
 * `projectGoal` runs on the plan as STORED — `basis` is `explainTargets(profile)`'s own, so the
 * rate it projects is the rate the displayed plan actually imposes — with only the current weight
 * substituted. The month's wording is the account's language, not the server's.
 */
function planProjection(
  profile: Profile,
  outcome: TargetOutcome,
  log: WeightEntry[],
  zone: string,
): PlanProjection | null {
  const currentKg = log.length > 0 ? log[log.length - 1]!.kg : profile.weight_kg;
  if (currentKg === null) return null;

  const onboardedDate = profile.onboarded_at === null
    ? null
    : localDate(zone, new Date(profile.onboarded_at));
  const afterOnboarding = onboardedDate === null ? [] : log.filter((e) => e.date >= onboardedDate);
  const planStartKg = (afterOnboarding[0] ?? log[0])?.kg ?? currentKg;

  const goal = projectGoal({ ...profile, weight_kg: currentKg }, outcome.basis);
  if (goal === null) return null;
  const targetKg = profile.target_weight_kg!; // projectGoal's null covers its absence
  // The re-anchor the comment above names: `current` on the far side of `start` from `target`
  // means the plan's start is behind her, and the bar's left edge is where she stands.
  const startKg = Math.sign(planStartKg - currentKg) === Math.sign(targetKg - planStartKg)
    ? currentKg
    : planStartKg;
  return {
    startKg,
    currentKg,
    targetKg,
    weeks: goal.weeks,
    kgPerWeek: goal.kgPerWeek,
    month: projectionMonth(new Date(), goal.weeks, profile.lang),
    beyondHorizon: goal.beyondHorizon,
  };
}
