import { describe, expect, test } from "bun:test";
import {
  habitOf, inRollout, matchesSegment, rolloutBucket, validateCampaignInput, validateSegment,
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
    expect(matchesSegment({ streakBand: ["strong"] }, facts({ streakBand: "strong" }))).toBe(true);
    expect(matchesSegment({ streakBand: ["strong"] }, facts({ streakBand: "building" }))).toBe(false);
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
  test("seven in a row is strong", () => {
    const days = Array.from({ length: 7 }, (_, i) => `2026-10-0${8 - i}`);
    expect(habitOf(days, today).streakBand).toBe("strong");
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
  const ok = { name: "Win-back", templateKey: "campaign:win-back", segment: {}, localSendTime: "18:30", rolloutPct: 10, promotional: true };
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
