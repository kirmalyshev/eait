// How long the plan takes, if the plan holds.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE ONE RULE: PROJECT THE APPLIED DELTA, NEVER THE REQUESTED ONE
//
// A user picks a pace. `targets.ts` may then refuse to honour it — the deficit is capped at a share
// of maintenance, and under that sits an absolute floor no computation may cross. When either guard
// bites, the rate the app is actually working towards is SLOWER than the rate the user asked for.
//
// A projection computed from `requestedDeltaKcal` would print a date the app has already decided
// not to pursue. It would also be the single most quotable sentence in a one-star review, and the
// category has eleven of those already for the adjacent failure — handing out a number with no
// arithmetic behind it (`marketing/research/2026-07-28-calai-app-store-review-brief.md` §3.4).
//
// So: `appliedDeltaKcal`, always. When the floor cut a 550 kcal deficit down to 84, this module
// says sixty-five weeks and not ten, and that is the whole reason it exists.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// WHAT IT DELIBERATELY DOES NOT PRODUCE. No day-precise date and no weight curve. The incumbent's
// onboarding draws both; both are false precision on a horizon measured in months, and a curve
// implies a smoothness that bodyweight does not have. Weeks and a month name is what the arithmetic
// actually supports.

import { monthYear } from "./lang.ts";
import { explainTargets, KCAL_PER_KG, type TargetBasis } from "./targets.ts";
import type { Lang, Pace, Profile } from "./types.ts";

/**
 * Past this, a date stops being motivating and starts being discouraging — and it is also where the
 * arithmetic stops meaning much, because nobody holds a deficit for two years without their
 * maintenance moving underneath them.
 */
export const PROJECTION_HORIZON_WEEKS = 104;

export interface GoalProjection {
  /** Whole weeks to the target, rounded. Reported even when past the horizon. */
  weeks: number;
  /** The honest rate, derived from what was applied. Always positive — direction is implicit. */
  kgPerWeek: number;
  /** Kilograms between here and the target. */
  kgToGo: number;
  /** True past `PROJECTION_HORIZON_WEEKS`. The UI says "over two years" rather than naming a date. */
  beyondHorizon: boolean;
}

/**
 * Weeks to the goal weight, or null when no honest projection exists.
 *
 * Null in every case where a number would be an invention rather than a calculation: a maintainer
 * has nowhere to arrive, a fallback band is not personal arithmetic, a zero delta never arrives,
 * and a delta pointing away from the target arrives at the wrong place. Each of those is a real
 * state a profile can be in, and each one is a sentence this screen must not print.
 */
export function projectGoal(p: Profile, basis: TargetBasis): GoalProjection | null {
  // A flat goal band is not a computation about this person, so nothing derived from it is either.
  if (basis.usedFallbackBand) return null;

  const now = p.weight_kg;
  const target = p.target_weight_kg;
  if (now === null || target === null) return null;

  const kgToGo = Math.abs(target - now);
  if (kgToGo === 0) return null;

  const delta = basis.appliedDeltaKcal;
  if (delta === 0) return null;

  // The direction the body has to move, against the direction the calorie delta moves it. These
  // disagree when a target was set below the current weight and the guards turned the deficit into
  // a surplus, or vice versa — rare, and a date would be actively wrong rather than merely vague.
  const mustLose = target < now;
  if (mustLose !== delta < 0) return null;

  const kgPerWeek = (Math.abs(delta) * 7) / KCAL_PER_KG;
  const weeks = Math.round(kgToGo / kgPerWeek);

  return {
    weeks,
    kgPerWeek,
    kgToGo,
    beyondHorizon: weeks > PROJECTION_HORIZON_WEEKS,
  };
}

/**
 * The projection for a pace the user is still choosing.
 *
 * The target screen shows a date beside the pace picker, before anything is saved. It must be the
 * SAME date the summary will show, so the candidate answers are run through `explainTargets` —
 * guards and all — and then through `projectGoal` like any stored profile. This is why activity is
 * asked before the target screen: without it the arithmetic would be guessing the multiplier, and
 * the preview would print a rate the guards are about to refuse.
 */
export function previewProjection(p: Profile, targetKg: number, pace: Pace): GoalProjection | null {
  // An admin-reordered flow can put the target screen before activity. A stored target may let
  // `explainTargets` default the multiplier; a preview may not — it would be a date derived from
  // an answer nobody gave. No multiplier, no date.
  if (p.activity === null) return null;
  const candidate: Profile = { ...p, target_weight_kg: targetKg, pace };
  return projectGoal(candidate, explainTargets(candidate).basis);
}

/**
 * The month a projection lands in, as "November 2026" — or "novembre 2026", or "tháng 11 năm 2026".
 *
 * `Intl.DateTimeFormat` (`monthYear` in `lang.ts`), not a table. Twelve English strings lived here
 * with a comment saying Hermes had once answered a numeric month for `toLocaleString`; that was a
 * reduced-ICU build, both runtimes this ships on carry a full one, and twelve names in a table is
 * eighty-four names the day a second language lands. Every language's month name is CLDR's, which
 * is the one place this repo should not be inventing words.
 *
 * Calendar arithmetic via `setDate`, never a fixed span of milliseconds: adding 98 × 24 h across a
 * DST transition lands a day early, twice a year, and never reproducibly. `setDate` rolls the
 * calendar, which is what "fourteen weeks from Thursday" actually means.
 */
export function projectionMonth(from: Date, weeks: number, lang: Lang = "en"): string {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + weeks * 7);
  // UTC in the formatter, and the date was rolled in LOCAL time by `setDate` above — so the pair
  // agree only up to a few hours around a month boundary. That is deliberate: the sentence is
  // "around November 2026" on a horizon of months, and pinning a zone here would be false
  // precision on top of an estimate that is already ± weeks.
  return monthYear(lang, new Date(Date.UTC(d.getFullYear(), d.getMonth(), 15)));
}
