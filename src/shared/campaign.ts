// Manual push campaigns: the vocabulary both the admin and the runner read.
//
// A segment is a fixed ALLOWLIST of predicates, each an enum or a boolean, checked in code against
// facts about one account. It is never free-form SQL and never a stored expression: an operator
// picks from what is listed here, and an unknown key is refused rather than ignored (a typo that
// silently widened the audience would be a broadcast to everybody).

import { CAMPAIGN_VARIANTS, isCampaignTemplateKey, type CampaignTemplateKey } from "./push-templates.ts";
import { LANGS, type Lang } from "./types.ts";

export const CAMPAIGN_STATUSES = ["draft", "scheduled", "running", "paused", "done", "killed"] as const;
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number];

export const ENTITLEMENT_STATES = ["active", "trial", "none"] as const;
export type EntitlementState = (typeof ENTITLEMENT_STATES)[number];

/**
 * Consecutive logged days ending today or yesterday: none, or any streak. There is no longer a
 * "strong" band: a streak of CAMPAIGN_STREAK_GUARD_DAYS or more is never reached, so only a streak of
 * 1 or 2 can be selected at all.
 */
export const STREAK_BANDS = ["none", "building"] as const;
export type StreakBand = (typeof STREAK_BANDS)[number];

/** Days since the last logged day: 0, 1-2, 3-6, 7+, or never logged. */
export const SINCE_LOG_BANDS = ["today", "recent", "lapsing", "lapsed", "never"] as const;
export type SinceLogBand = (typeof SINCE_LOG_BANDS)[number];

export interface Segment {
  langs?: Lang[];
  entitlement?: EntitlementState[];
  onboarded?: boolean;
  streakBand?: StreakBand[];
  sinceLog?: SinceLogBand[];
  /** The "tips and offers" consent. */
  tipsConsent?: boolean;
  /** Only the staff allowlist. */
  staffOnly?: boolean;
}

/** Everything a segment can ask about one account, computed once per account per batch. */
export interface SegmentFacts {
  lang: Lang;
  entitlement: EntitlementState;
  onboarded: boolean;
  /** Consecutive logged days. Not a segment predicate: a campaign never reaches a streak of 3 or more. */
  streakDays: number;
  streakBand: StreakBand;
  sinceLog: SinceLogBand;
  tipsConsent: boolean;
  staff: boolean;
}

export type SegmentValidation = { ok: true; segment: Segment } | { ok: false; errors: string[] };

const ENUMS: Record<string, readonly string[]> = {
  langs: LANGS, entitlement: ENTITLEMENT_STATES, streakBand: STREAK_BANDS, sinceLog: SINCE_LOG_BANDS,
};
const BOOLEANS = ["onboarded", "tipsConsent", "staffOnly"] as const;

/** Refuses what is not on the allowlist. Returns a copy holding only allowlisted keys. */
export function validateSegment(input: unknown): SegmentValidation {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["segment must be an object"] };
  }
  const errors: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    const allowed = ENUMS[key];
    if (allowed) {
      if (!Array.isArray(value) || value.length === 0 || !value.every((v) => typeof v === "string" && allowed.includes(v))) {
        errors.push(`${key} must be a non-empty list of: ${allowed.join(", ")}`);
      } else out[key] = [...new Set(value)];
    } else if ((BOOLEANS as readonly string[]).includes(key)) {
      if (typeof value !== "boolean") errors.push(`${key} must be true or false`);
      else out[key] = value;
    } else errors.push(`unknown predicate: ${key}`);
  }
  return errors.length > 0 ? { ok: false, errors } : { ok: true, segment: out as Segment };
}

/** True when every predicate the segment names holds for this account. */
export function matchesSegment(segment: Segment, f: SegmentFacts): boolean {
  if (segment.langs && !segment.langs.includes(f.lang)) return false;
  if (segment.entitlement && !segment.entitlement.includes(f.entitlement)) return false;
  if (segment.onboarded !== undefined && segment.onboarded !== f.onboarded) return false;
  if (segment.streakBand && !segment.streakBand.includes(f.streakBand)) return false;
  if (segment.sinceLog && !segment.sinceLog.includes(f.sinceLog)) return false;
  if (segment.tipsConsent !== undefined && segment.tipsConsent !== f.tipsConsent) return false;
  if (segment.staffOnly !== undefined && segment.staffOnly !== f.staff) return false;
  return true;
}

const DAY_MS = 86_400_000;
const dayNumber = (d: string): number => Date.parse(`${d}T00:00:00Z`) / DAY_MS;

/**
 * Streak and last-log band from the dates an account logged a meal on (any order, `YYYY-MM-DD`),
 * read against `today` in the account's zone. A streak survives today not being logged yet.
 */
export function habitOf(
  loggedDates: readonly string[], today: string,
): { streakDays: number; streakBand: StreakBand; sinceLog: SinceLogBand } {
  const days = new Set(loggedDates.filter((d) => d <= today).map(dayNumber));
  if (days.size === 0) return { streakDays: 0, streakBand: "none", sinceLog: "never" };
  const t = dayNumber(today);
  const last = Math.max(...days);
  const gap = t - last;
  let streak = 0;
  if (gap <= 1) for (let d = last; days.has(d); d--) streak++;
  return {
    streakDays: streak,
    streakBand: streak === 0 ? "none" : "building",
    sinceLog: gap === 0 ? "today" : gap <= 2 ? "recent" : gap <= 6 ? "lapsing" : "lapsed",
  };
}

/**
 * A streak this long is the habit line's to protect: no campaign reaches such an account, whatever
 * its segment says. A rule, not a predicate, so no segment can switch it off.
 */
export const CAMPAIGN_STREAK_GUARD_DAYS = 3;

/** FNV-1a, 32 bit: stable across runtimes and processes, which a rollout must be. */
function fnv1a(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** 0..99, fixed per (user, campaign). */
export function rolloutBucket(userId: string, campaignId: string): number {
  return fnv1a(`${campaignId}:${userId}`) % 100;
}

/** Raising `pct` only adds users: the bucket is fixed, the threshold moves. */
export function inRollout(userId: string, campaignId: string, pct: number): boolean {
  return rolloutBucket(userId, campaignId) < pct;
}

/** The largest share an A/B holdout may keep out. */
export const MAX_HOLDOUT_PCT = 10;

/**
 * Which of a campaign's `n` variants this account gets: `fnv1a("variant:campaign:user") % n`. A function
 * of the pair alone, so there is no assignment table, and a salt of its own so it is independent of the
 * rollout bucket and the holdout.
 */
export function variantOf(userId: string, campaignId: string, n: number): number {
  return n <= 1 ? 0 : fnv1a(`variant:${campaignId}:${userId}`) % n;
}

/**
 * True when this account is held out: a SEPARATE salt from the rollout, so the held-out are a random
 * share of whoever the rollout reaches rather than its lowest buckets. Raising the percentage only adds.
 */
export function inHoldout(userId: string, campaignId: string, pct: number): boolean {
  return pct > 0 && fnv1a(`holdout:${campaignId}:${userId}`) % 100 < pct;
}

export interface RateGroup { n: number; x: number }

export interface RateComparison {
  treatedRate: number;
  holdoutRate: number;
  /** Treated minus holdout. */
  diff: number;
  /** 95% interval on `diff`, the normal approximation: enough to tell a clear effect from noise. */
  lo: number;
  hi: number;
  /** The interval excludes zero. */
  significant: boolean;
}

/** Treated minus holdout conversion, with a simple 95% CI. Null when either group is empty. */
export function compareRates(treated: RateGroup, holdout: RateGroup): RateComparison | null {
  if (treated.n <= 0 || holdout.n <= 0) return null;
  const p1 = treated.x / treated.n;
  const p2 = holdout.x / holdout.n;
  const se = Math.sqrt((p1 * (1 - p1)) / treated.n + (p2 * (1 - p2)) / holdout.n);
  const diff = p1 - p2;
  const lo = diff - 1.96 * se;
  const hi = diff + 1.96 * se;
  return { treatedRate: p1, holdoutRate: p2, diff, lo, hi, significant: lo > 0 || hi < 0 };
}

export interface CampaignInput {
  name: string;
  templateKey: CampaignTemplateKey;
  segment: Segment;
  /** `HH:MM`, the account's own local time. */
  localSendTime: string;
  rolloutPct: number;
  /** A promotional campaign only reaches accounts with "tips and offers" ON, whatever the segment says. */
  promotional: boolean;
  /** 1-4 copy variants; an account gets `variantOf(user, campaign, variants)`. */
  variants: number;
  /** 0-10: the share of the rolled-out audience kept out, logged as `would_have_sent`. */
  holdoutPct: number;
}

export type CampaignValidation = { ok: true; input: CampaignInput } | { ok: false; errors: string[] };

export function validateCampaignInput(raw: unknown): CampaignValidation {
  const r = (typeof raw === "object" && raw !== null ? raw : {}) as Record<string, unknown>;
  const errors: string[] = [];
  const name = typeof r.name === "string" ? r.name.trim() : "";
  if (name.length === 0 || name.length > 80) errors.push("name must be 1-80 characters");
  if (!isCampaignTemplateKey(r.templateKey)) {
    errors.push("templateKey must be campaign:<slug> (lowercase words joined by hyphens, not a system message name)");
  }
  const seg = validateSegment(r.segment ?? {});
  if (!seg.ok) errors.push(...seg.errors);
  if (typeof r.localSendTime !== "string" || !/^([01]\d|2[0-3]):[0-5]\d$/.test(r.localSendTime)) {
    errors.push("localSendTime must be HH:MM, 00:00-23:59");
  }
  if (!Number.isInteger(r.rolloutPct) || (r.rolloutPct as number) < 0 || (r.rolloutPct as number) > 100) {
    errors.push("rolloutPct must be a whole number 0-100");
  }
  if (typeof r.promotional !== "boolean") errors.push("promotional must be true or false");
  const variants = r.variants === undefined ? 1 : r.variants;
  if (!Number.isInteger(variants) || (variants as number) < 1 || (variants as number) > CAMPAIGN_VARIANTS.length) {
    errors.push(`variants must be a whole number 1-${CAMPAIGN_VARIANTS.length}`);
  }
  const holdoutPct = r.holdoutPct === undefined ? 0 : r.holdoutPct;
  if (!Number.isInteger(holdoutPct) || (holdoutPct as number) < 0 || (holdoutPct as number) > MAX_HOLDOUT_PCT) {
    errors.push(`holdoutPct must be a whole number 0-${MAX_HOLDOUT_PCT}`);
  }
  if (errors.length > 0 || !seg.ok) return { ok: false, errors };
  return {
    ok: true,
    input: {
      name, templateKey: r.templateKey as CampaignTemplateKey, segment: seg.segment,
      localSendTime: r.localSendTime as string, rolloutPct: r.rolloutPct as number,
      promotional: r.promotional as boolean, variants: variants as number, holdoutPct: holdoutPct as number,
    },
  };
}
