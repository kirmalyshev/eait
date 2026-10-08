import { describe, expect, test } from "bun:test";
import { CAMPAIGN_VARIANTS } from "./push-templates.ts";
import {
  compareRates, inHoldout, variantOf, habitOf, inRollout, matchesSegment, rolloutBucket, validateCampaignInput, validateSegment,
  type SegmentFacts,
} from "./campaign.ts";

const facts = (over: Partial<SegmentFacts> = {}): SegmentFacts => ({
  lang: "en", entitlement: "none", onboarded: true, streakBand: "none", sinceLog: "never",
  tipsConsent: true, staff: false, streakDays: 0, ...over,
});

describe("validateSegment", () => {
  test("accepts the allowlisted predicates", () => {
    const r = validateSegment({ langs: ["de", "en"], entitlement: ["active"], onboarded: true, tipsConsent: true });
    expect(r.ok).toBe(true);
  });
  test("refuses an unknown key, never ignores it", () => {
    const r = validateSegment({ langs: ["en"], where: "1=1" });
    expect(r).toEqual({ ok: false, errors: ["unknown predicate: where"] });
  });
  test("refuses a value outside its enum", () => {
    expect(validateSegment({ langs: ["xx"] }).ok).toBe(false);
    expect(validateSegment({ streakBand: ["huge"] }).ok).toBe(false);
    expect(validateSegment({ onboarded: "yes" }).ok).toBe(false);
  });
  test("an empty list matches nobody and is refused", () => {
    expect(validateSegment({ langs: [] }).ok).toBe(false);
  });
});

describe("matchesSegment", () => {
  test("an empty segment matches everyone", () => expect(matchesSegment({}, facts())).toBe(true));
  test("every predicate must hold", () => {
    const s = { langs: ["de" as const], entitlement: ["active" as const] };
    expect(matchesSegment(s, facts({ lang: "de", entitlement: "active" }))).toBe(true);
    expect(matchesSegment(s, facts({ lang: "de", entitlement: "none" }))).toBe(false);
    expect(matchesSegment(s, facts({ lang: "en", entitlement: "active" }))).toBe(false);
  });
  test("onboarded, tips consent, staff", () => {
    expect(matchesSegment({ onboarded: false }, facts({ onboarded: true }))).toBe(false);
    expect(matchesSegment({ tipsConsent: true }, facts({ tipsConsent: false }))).toBe(false);
    expect(matchesSegment({ staffOnly: true }, facts({ staff: false }))).toBe(false);
    expect(matchesSegment({ staffOnly: true }, facts({ staff: true }))).toBe(true);
  });
  test("streak band and days since last log", () => {
    expect(matchesSegment({ streakBand: ["building"] }, facts({ streakBand: "building" }))).toBe(true);
    expect(matchesSegment({ streakBand: ["building"] }, facts({ streakBand: "none" }))).toBe(false);
    expect(validateSegment({ streakBand: ["strong"] }).ok).toBe(false);
    expect(matchesSegment({ sinceLog: ["lapsed", "never"] }, facts({ sinceLog: "never" }))).toBe(true);
    expect(matchesSegment({ sinceLog: ["today"] }, facts({ sinceLog: "recent" }))).toBe(false);
  });
});

describe("habitOf", () => {
  const today = "2026-10-08";
  test("no days logged", () => expect(habitOf([], today)).toEqual({ streakDays: 0, streakBand: "none", sinceLog: "never" }));
  test("logged today, three in a row", () => {
    expect(habitOf(["2026-10-08", "2026-10-07", "2026-10-06"], today)).toEqual({ streakDays: 3, streakBand: "building", sinceLog: "today" });
  });
  test("a streak survives a day not yet logged", () => {
    expect(habitOf(["2026-10-07", "2026-10-06"], today).streakBand).toBe("building");
  });
  test("seven in a row is still just a streak, counted in days", () => {
    const days = Array.from({ length: 7 }, (_, i) => `2026-10-0${8 - i}`);
    expect(habitOf(days, today)).toMatchObject({ streakDays: 7, streakBand: "building" });
  });
  test("the last-log band holds at any age: 59, 60, 61 and 400 days are lapsed, nothing logged is never", () => {
    const ago = (n: number) => new Date(Date.parse("2026-10-08T00:00:00Z") - n * 86_400_000).toISOString().slice(0, 10);
    for (const n of [59, 60, 61, 400]) expect(habitOf([ago(n)], today).sinceLog).toBe("lapsed");
    expect(habitOf([], today).sinceLog).toBe("never");
  });
  test("a gap breaks the streak and sets the band for days since", () => {
    expect(habitOf(["2026-10-01"], today)).toEqual({ streakDays: 0, streakBand: "none", sinceLog: "lapsed" });
    expect(habitOf(["2026-10-05"], today).sinceLog).toBe("lapsing");
    expect(habitOf(["2026-10-06"], today).sinceLog).toBe("recent");
  });
});

describe("rollout", () => {
  test("the bucket is stable and in 0..99", () => {
    const b = rolloutBucket("user-1", "camp-1");
    expect(b).toBe(rolloutBucket("user-1", "camp-1"));
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(100);
  });
  test("raising the percentage only ever adds users", () => {
    const users = Array.from({ length: 500 }, (_, i) => `u${i}`);
    let prev = new Set<string>();
    for (let pct = 0; pct <= 100; pct += 5) {
      const now = new Set(users.filter((u) => inRollout(u, "camp-1", pct)));
      for (const u of prev) expect(now.has(u)).toBe(true);
      prev = now;
    }
    expect(prev.size).toBe(500);
    expect(users.filter((u) => inRollout(u, "camp-1", 0))).toHaveLength(0);
  });
  test("a percentage lands near its share", () => {
    const users = Array.from({ length: 2000 }, (_, i) => `u${i}`);
    const n = users.filter((u) => inRollout(u, "camp-2", 30)).length;
    expect(n).toBeGreaterThan(500);
    expect(n).toBeLessThan(700);
  });
  test("two campaigns do not pick the same people", () => {
    const users = Array.from({ length: 500 }, (_, i) => `u${i}`);
    const a = users.filter((u) => inRollout(u, "camp-a", 20));
    expect(a.every((u) => inRollout(u, "camp-b", 20))).toBe(false);
  });
});

describe("validateCampaignInput", () => {
  const ok = { name: "Win-back", templateKey: "campaign:win-back", segment: {}, localSendTime: "18:30", rolloutPct: 10, promotional: true, variants: 2, holdoutPct: 5 };
  test("accepts a complete campaign", () => expect(validateCampaignInput(ok).ok).toBe(true));
  test("refuses a bad time, percentage, template or name", () => {
    expect(validateCampaignInput({ ...ok, localSendTime: "25:00" }).ok).toBe(false);
    expect(validateCampaignInput({ ...ok, localSendTime: "9:00" }).ok).toBe(false);
    expect(validateCampaignInput({ ...ok, rolloutPct: 101 }).ok).toBe(false);
    expect(validateCampaignInput({ ...ok, rolloutPct: 1.5 }).ok).toBe(false);
    expect(validateCampaignInput({ ...ok, templateKey: "nope" }).ok).toBe(false);
    for (const k of ["nudge", "evening", "trial-end", "campaign:evening", "campaign:streak", "campaign:", "campaign:Bad Slug", "campaign:a_b", "streak"]) {
      expect(validateCampaignInput({ ...ok, templateKey: k }).ok).toBe(false);
    }
    expect(validateCampaignInput({ ...ok, name: "  " }).ok).toBe(false);
  });
});

describe("A/B assignment", () => {
  const ids = Array.from({ length: 10_000 }, (_, i) => `user-${i}-${(i * 2654435761) % 99991}`);

  test("is deterministic, and a function of user AND campaign", () => {
    expect(variantOf("u1", "c1", 3)).toBe(variantOf("u1", "c1", 3));
    const differs = ids.slice(0, 200).some((u) => variantOf(u, "c1", 2) !== variantOf(u, "c2", 2));
    expect(differs).toBe(true);
  });
  test("stays inside 0..n-1, and one variant is always 0", () => {
    for (const u of ids.slice(0, 500)) {
      expect(variantOf(u, "c", 1)).toBe(0);
      const v = variantOf(u, "c", 4);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(4);
    }
  });
  test("is balanced on 10k ids, for 2, 3 and 4 variants", () => {
    for (const n of [2, 3, 4]) {
      const counts = Array<number>(n).fill(0);
      for (const u of ids) counts[variantOf(u, "camp-a", n)]!++;
      for (const c of counts) expect(Math.abs(c / ids.length - 1 / n)).toBeLessThan(0.02);
    }
  });
  test("names at most four variants, the first is the default", () => {
    expect(CAMPAIGN_VARIANTS).toEqual(["default", "b", "c", "d"]);
  });
});

describe("holdout", () => {
  const ids = Array.from({ length: 10_000 }, (_, i) => `user-${i}`);

  test("holds out about its percentage, and 0 holds out nobody", () => {
    expect(ids.filter((u) => inHoldout(u, "c1", 0))).toHaveLength(0);
    for (const pct of [5, 10]) {
      const n = ids.filter((u) => inHoldout(u, "c1", pct)).length;
      expect(Math.abs(n / ids.length - pct / 100)).toBeLessThan(0.015);
    }
  });
  test("raising the holdout only adds accounts", () => {
    const five = new Set(ids.filter((u) => inHoldout(u, "c1", 5)));
    for (const u of ids.filter((x) => inHoldout(x, "c1", 10))) void u;
    for (const u of five) expect(inHoldout(u, "c1", 10)).toBe(true);
  });
  test("uses its own salt: it is not the rollout bucket, nor the variant", () => {
    const held = ids.filter((u) => inHoldout(u, "c1", 10));
    // If the holdout shared the rollout salt, the held-out would be the lowest rollout buckets.
    expect(held.every((u) => inRollout(u, "c1", 10))).toBe(false);
    // And it is not tied to a variant: both variants appear among the held-out.
    expect(new Set(held.map((u) => variantOf(u, "c1", 2))).size).toBe(2);
  });
  test("is disjoint from the treated by construction: one predicate decides", () => {
    const campaign = "c1";
    const treated = ids.filter((u) => inRollout(u, campaign, 60) && !inHoldout(u, campaign, 10));
    const held = ids.filter((u) => inRollout(u, campaign, 60) && inHoldout(u, campaign, 10));
    expect(treated.filter((u) => held.includes(u))).toHaveLength(0);
    expect(treated.length + held.length).toBe(ids.filter((u) => inRollout(u, campaign, 60)).length);
  });
});

describe("compareRates", () => {
  test("arithmetic: rates, difference and a 95% interval", () => {
    const r = compareRates({ n: 1000, x: 300 }, { n: 100, x: 20 })!;
    expect(r.treatedRate).toBeCloseTo(0.3, 10);
    expect(r.holdoutRate).toBeCloseTo(0.2, 10);
    expect(r.diff).toBeCloseTo(0.1, 10);
    const se = Math.sqrt((0.3 * 0.7) / 1000 + (0.2 * 0.8) / 100);
    expect(r.lo).toBeCloseTo(0.1 - 1.96 * se, 10);
    expect(r.hi).toBeCloseTo(0.1 + 1.96 * se, 10);
    expect(r.lo).toBeGreaterThan(0);
    expect(r.significant).toBe(true);
    const noise = compareRates({ n: 100, x: 30 }, { n: 100, x: 25 })!;
    expect(noise.lo).toBeLessThan(0);
    expect(noise.hi).toBeGreaterThan(0);
    expect(noise.significant).toBe(false);
  });
  test("a large clean difference is significant", () => {
    const r = compareRates({ n: 5000, x: 2500 }, { n: 500, x: 100 })!;
    expect(r.significant).toBe(true);
    expect(r.lo).toBeGreaterThan(0);
  });
  test("a negative effect is significant on the other side", () => {
    const r = compareRates({ n: 5000, x: 500 }, { n: 500, x: 250 })!;
    expect(r.hi).toBeLessThan(0);
    expect(r.significant).toBe(true);
  });
  test("has no answer without both groups, and identical groups give a zero difference", () => {
    expect(compareRates({ n: 0, x: 0 }, { n: 10, x: 1 })).toBeNull();
    expect(compareRates({ n: 10, x: 1 }, { n: 0, x: 0 })).toBeNull();
    const same = compareRates({ n: 100, x: 10 }, { n: 100, x: 10 })!;
    expect(same.diff).toBe(0);
    expect(same.significant).toBe(false);
  });
  test("zero or full rates do not divide by zero", () => {
    const r = compareRates({ n: 50, x: 0 }, { n: 50, x: 50 })!;
    expect(Number.isFinite(r.lo) && Number.isFinite(r.hi)).toBe(true);
  });
});

describe("campaign input: variants and holdout", () => {
  const base = { name: "Win-back", templateKey: "campaign:win-back", segment: {}, localSendTime: "18:30", rolloutPct: 10, promotional: false };
  test("default to one variant and no holdout", () => {
    const r = validateCampaignInput(base);
    expect(r.ok && r.input).toMatchObject({ variants: 1, holdoutPct: 0 });
  });
  test("accept 1-4 variants and a 0-10% holdout", () => {
    expect(validateCampaignInput({ ...base, variants: 4, holdoutPct: 10 }).ok).toBe(true);
  });
  test("refuse 0 or 5 variants, a fractional count, and a holdout over 10 or negative", () => {
    for (const v of [0, 5, 1.5, "2"]) expect(validateCampaignInput({ ...base, variants: v }).ok).toBe(false);
    for (const h of [-1, 11, 2.5, "5"]) expect(validateCampaignInput({ ...base, holdoutPct: h }).ok).toBe(false);
  });
});
