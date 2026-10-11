// The memory store's own units — the shapes the contract suite cannot reach through the port.
//
// `bankedRunningEnd` and `bankedLapseAt` exist because Postgres's `greatest` IGNORES a null
// subscription end while the shapes `referralBonusEnd` and `Math.max` were called with did not —
// `referralBonusEnd` needs a finite end to run the bank at all, and `Math.max(NaN, x)` is NaN.
// The state that needs it (`referral_banked_days > 0` beside a null `entitlement_expires_at`,
// e.g. a merged account's bank on a survivor with no subscription) is unreachable through the
// Store port today — the bank moves with the clock pair — so this is parity hardening pinned at
// the level where the two implementations can actually disagree.

import { describe, expect, it } from "bun:test";
import { bankedLapseAt, bankedRunningEnd } from "./store.memory.ts";

const day = (n: number, from = 0) => new Date(from + n * 86_400_000).toISOString();

describe("bankedRunningEnd", () => {
  // The fold's running end: `greatest(bonus_until, entitlement_expires_at) + banked` in
  // `store.pg.ts`, where the null end is ignored. `referralBonusEnd` alone drops the bank for a
  // missing end — which is the bug this exists against.
  it("runs the bank from the dated week alone when the subscription end is missing", () => {
    expect(bankedRunningEnd(day(5), 7, null)).toBe(day(12));
    expect(bankedRunningEnd(day(5), 7, undefined)).toBe(day(12));
  });

  it("is unchanged while an end exists: the bank runs from the later of the two", () => {
    expect(bankedRunningEnd(day(5), 7, day(1))).toBe(day(12));
    expect(bankedRunningEnd(day(5), 7, day(20))).toBe(day(27));
    expect(bankedRunningEnd(null, 7, day(20))).toBe(day(27));
    expect(bankedRunningEnd(day(5), 0, day(1))).toBe(day(5));
  });

  it("has nothing to run from when both ends are absent, and says so in the past", () => {
    // Postgres's all-null `greatest` makes the fold arm null, so only the new grant's days land.
    // Here the epoch + the bank is 1970 — `extend` takes `now()` over it and the same days land.
    const end = bankedRunningEnd(null, 7, null);
    expect(end).not.toBeNull();
    expect(Date.parse(end!)).toBeLessThan(Date.now());
  });
});

describe("bankedLapseAt", () => {
  // The spend's lapse instant: `greatest(entitlement_expires_at, bonus_until)` in `store.pg.ts`.
  it("is the dated week's end when the subscription end is missing", () => {
    expect(bankedLapseAt(null, day(5))).toBe(Date.parse(day(5)));
    expect(bankedLapseAt(undefined, day(5))).toBe(Date.parse(day(5)));
  });

  it("is the later of the two when both exist, and the subscription's when no dated week does", () => {
    expect(bankedLapseAt(day(9), day(5))).toBe(Date.parse(day(9)));
    expect(bankedLapseAt(day(2), day(5))).toBe(Date.parse(day(5)));
    expect(bankedLapseAt(day(9), null)).toBe(Date.parse(day(9)));
  });

  it("is -Infinity — no lapse — when neither exists, the all-null `greatest` failing its `< now()`", () => {
    expect(bankedLapseAt(null, null)).toBe(-Infinity);
    expect(bankedLapseAt(undefined, undefined)).toBe(-Infinity);
  });
});
