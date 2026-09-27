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
