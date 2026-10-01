// The Progress surface's shared rules — the weight card's state (#95), so the web screen and the
// phone's Progress take the same branch rather than two readings of design-pro's ruling.
//
// THE THRESHOLD IS "A TREND NEEDS TWO POINTS", not "the log is empty" — onboarding writes the
// first weigh-in row (#84), so a brand-new account lands on `one`, and `empty` is the
// legacy/import account that truly logged nothing.

import type { WeightEntry } from "./contract.ts";

/**
 * What the weight card shows. `inRange` is the range-filtered log `/v1/weights` returns;
 * `latest` is the same response's overall newest entry — they are different questions, and the
 * range must never be changed for the user (design-pro, #95).
 *
 * - `empty`: no weigh-in anywhere. The card draws the chart's frame, "—" for the number, and the
 *   log-a-weight line.
 * - `one`: exactly one point in the range — its dot with its value and date, and the
 *   log-another line.
 * - `none-in-range`: weigh-ins exist but the selected window holds none. The number is the
 *   LATEST overall, with its date, beside the empty frame and the range-named line.
 * - `trend`: two or more points — the chart, endpoint labels and dates.
 */
export type WeightCard =
  | { kind: "empty" }
  | { kind: "one"; point: WeightEntry }
  | { kind: "none-in-range"; latest: WeightEntry }
  | { kind: "trend"; points: readonly WeightEntry[] };

export function weightCard(inRange: readonly WeightEntry[], latest: WeightEntry | null): WeightCard {
  if (latest === null) return { kind: "empty" };
  if (inRange.length === 0) return { kind: "none-in-range", latest };
  if (inRange.length === 1) return { kind: "one", point: inRange[0]! };
  return { kind: "trend", points: inRange };
}

// ── The body trend's read ────────────────────────────────────────────────────────────────────
//
// Which of the pace words the weigh-in log earns. The classification is a comparison against the
// plan's OWN pace ladder — `PACE_KG_PER_WEEK` in `targets.ts` — so "slower than the pace you
// chose" is the same comparison wherever the sentence is drawn, and a client may not substitute
// its own thresholds (the phone's first version used 0.8×/1.3× the applied rate, which read the
// same data three different ways as soon as a guard moved the applied rate off the rung).

import { PACE_KG_PER_WEEK } from "./targets.ts";
import type { Goal, Pace } from "./types.ts";

/**
 * The ladder's midpoint boundaries: below `easy` lands the bottom rung too (0.125kg/week is a
 * half-step below it), and above `push` extends it symmetrically, so every rate lands on a rung.
 */
const RUNG_RATES = [PACE_KG_PER_WEEK.easy, PACE_KG_PER_WEEK.steady, PACE_KG_PER_WEEK.push];
const RUNG_BOUNDS = [
  RUNG_RATES[0]! - (RUNG_RATES[1]! - RUNG_RATES[0]!) / 2,
  (RUNG_RATES[0]! + RUNG_RATES[1]!) / 2,
  (RUNG_RATES[1]! + RUNG_RATES[2]!) / 2,
  RUNG_RATES[2]! + (RUNG_RATES[2]! - RUNG_RATES[1]!) / 2,
];

/**
 * The rung a weekly rate belongs to, as an index on the pace ladder: 0 easy, 1 steady, 2 push —
 * and −1/3 for a rate below the bottom rung or past the top one. A rate can sit nowhere else.
 */
export function paceRung(kgPerWeek: number): number {
  if (kgPerWeek < RUNG_BOUNDS[0]!) return -1;
  if (kgPerWeek <= RUNG_BOUNDS[1]!) return 0;
  if (kgPerWeek <= RUNG_BOUNDS[2]!) return 1;
  if (kgPerWeek <= RUNG_BOUNDS[3]!) return 2;
  return 3;
}

/** Which of the body screen's sentences the trend earns. */
export type PaceReading = "flat" | "drift" | "slow" | "on-pace" | "fast";

export interface BodyTrend {
  /** last − first over the drawn span, signed. */
  deltaKg: number;
  /** The delta as a weekly rate — |deltaKg| scaled to a week, never negative. */
  kgPerWeek: number;
  /** |target − latest|, the "to go" figure. 0 when there is no target. */
  toTargetKg: number;
  reading: PaceReading;
}

const DAY_MS = 86400000;

/**
 * The body card's arithmetic, once: the span's delta, its weekly rate, the distance left to the
 * target, and which of the pace words that rate earns.
 *
 * `flat` — a maintainer, no goal, or a span that moved less than a scale's precision (0.05kg).
 * `drift` — movement away from the goal's direction.
 * Otherwise the observed rung is set beside the pace the plan was built on: below it is `slow`,
 * on it `on-pace`, above it `fast` — the last is the care case, a crash pace is a thing to say.
 */
export function bodyTrend(
  weights: readonly WeightEntry[],
  goal: Goal | null,
  targetKg: number | null,
  pace: Pace,
): BodyTrend | null {
  const first = weights[0];
  const last = weights[weights.length - 1];
  if (!first || !last || weights.length < 2) return null;

  const deltaKg = Math.round((last.kg - first.kg) * 10) / 10;
  const spanDays = Math.max(
    1,
    Math.round((Date.parse(`${last.date}T00:00:00Z`) - Date.parse(`${first.date}T00:00:00Z`)) / DAY_MS),
  );
  const kgPerWeek = Math.abs(deltaKg) * 7 / spanDays;
  const toTargetKg = targetKg === null ? 0
    : Math.abs(Math.round((targetKg - last.kg) * 10) / 10);

  let reading: PaceReading = "flat";
  if (goal === "lose" || goal === "gain") {
    const toward = goal === "lose" ? deltaKg < 0 : deltaKg > 0;
    if (Math.abs(deltaKg) < 0.05) reading = "flat";
    else if (!toward) reading = "drift";
    else {
      const gap = paceRung(kgPerWeek) - paceRung(PACE_KG_PER_WEEK[pace]);
      reading = gap < 0 ? "slow" : gap > 0 ? "fast" : "on-pace";
    }
  }
  return { deltaKg, kgPerWeek, toTargetKg, reading };
}
