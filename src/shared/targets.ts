// Per-user daily targets, the safety floor, the restriction vocabulary, and the verdict-visibility gate.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY THIS FILE IS THE MOST SAFETY-CRITICAL ONE IN THE REPO
//
// `eait` bands calories by goal alone — 1800/2100/2400 flat — and its comment says a
// bodyweight-delta formula is "out of scope (it needs safe-rate-of-loss logic this photo-logger has
// no business inventing)". That is a correct call for a Telegram bot. It is not a viable call for
// an App Store product in the health & fitness category, where a personal number is the thing users
// arrive for. So eait computes one — and computing one is precisely what creates the failure mode
// that put eleven one-star reviews on the incumbent:
//
//   "Went through the onboarding and was then given a daily calorie goal of 569. In what world is
//    that enough for a grown woman?"                              — Cal AI, 1★, 2026-03-14, GB
//   "Told me to eat 900 calories a day…. There was a link to a Harvard source that stated going
//    under 1,200 cals a day for woman can be extremely dangerous"  — Cal AI, 1★, 2026-04-20, US
//
// (`marketing/research/2026-07-28-calai-app-store-review-brief.md` §3.4. That doc's
// standing instruction is explicit: do not attack unsafe targets until our own goal-setting has a
// documented floor. This file is that floor, and `explainTargets` is the "and says so" half.)
//
// Three guards, in order:
//   1. the deficit is capped at a share of TDEE, so the number scales with the person;
//   2. an absolute kcal floor by sex, which no computation may go under;
//   3. a target bodyweight below the healthy BMI band is refused outright, not merely warned about.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import type {
  ActivityLevel, FoodTargets, MealVerdicts, Pace, Profile, Sex, Verdict,
} from "./types.ts";

// ── Safety constants ─────────────────────────────────────────────────────────────────────────

/**
 * The absolute daily floor, by sex. Nothing in this module may return below it, whatever the
 * arithmetic upstream produced.
 *
 * These are the widely-published minimums for unsupervised dieting (1200 kcal for women, 1500 for
 * men) — the same 1200 figure the reviewer above cited Harvard for. They are a POLICY FLOOR, not a
 * clinical judgement about any individual: a supervised very-low-calorie diet is a real thing, and
 * this app is not supervision.
 */
export const KCAL_FLOOR: Record<Sex, number> = { female: 1200, male: 1500 };

/** Floor used when sex is unknown — the higher of the two, because guessing low is the harmful way. */
export const KCAL_FLOOR_UNKNOWN = 1500;

/** The largest share of maintenance we will subtract. 20% is the standard "moderate deficit" band. */
export const MAX_DEFICIT_SHARE = 0.2;
/** Surpluses are capped tighter: past this, the surplus is fat, not muscle. */
export const MAX_SURPLUS_SHARE = 0.15;

/** Weekly rate of change per pace, in kg/week. `push` sits at the top of the sustainable band. */
const PACE_KG_PER_WEEK: Record<Pace, number> = { easy: 0.25, steady: 0.5, push: 0.75 };

/**
 * Energy in one kg of body mass. The classic 7700 kcal/kg figure.
 *
 * Exported for `projection.ts`, which must divide by the SAME constant this file multiplies by —
 * a projection derived from a different figure would disagree with the pace it is projecting.
 */
export const KCAL_PER_KG = 7700;

/** Below this BMI we will not set a target weight. 18.5 is the WHO underweight threshold. */
export const MIN_TARGET_BMI = 18.5;

/** Under-16s are refused: growth-phase energy needs are not what these equations model. */
export const MIN_AGE = 16;
const MAX_AGE = 100;

/**
 * The bodyweight this product will accept, in kilograms.
 *
 * ONE range, applied on every path that can set `weight_kg` — the manual profile form and the
 * Apple Health import both. It lived only in the profile validator until the import existed, and a
 * second copy there would have been two numbers that must agree; the failure when they stop
 * agreeing is a weight the form refuses being written by a sync, and a calorie target computed
 * from it.
 */
export const MIN_WEIGHT_KG = 30;
export const MAX_WEIGHT_KG = 400;

/** True for a bodyweight this product is willing to compute a calorie target from. */
export function isAcceptableWeightKg(kg: number): boolean {
  return Number.isFinite(kg) && kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG;
}

const ACTIVITY_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  athlete: 1.9,
};

// ── Protein (unchanged from eait) ────────────────────────────────────────────────────────────

const PROTEIN_BASELINE_G = 100;
const PROTEIN_PER_KG = 1.6; // low end of the sports-nutrition consensus band
const PROTEIN_MIN_G = 80;
const PROTEIN_MAX_G = 180;
const SATFAT_CAP_LDL_G = 13; // AHA-style saturated-fat ceiling
const SODIUM_CAP_KIDNEYS_MG = 2000; // renal-diet sodium ceiling

/** Flat fallback bands — eait's original numbers, used when anthropometrics are unknown. */
const KCAL_BY_GOAL = { lose: 1800, maintain: 2100, gain: 2400 } as const;

// ── The computation ──────────────────────────────────────────────────────────────────────────

/**
 * Everything behind the number, so the app can show its work.
 *
 * This is not diagnostics. A user who is told "1,450 kcal" and nothing else has been handed an
 * assertion; a user who is told "your maintenance is 2,100, we subtracted 20%, and we stopped at
 * your floor of 1,200" has been handed a reason. The second is the honest product and it is also
 * the defensible one — `floorApplied` is what the UI reads to explain itself.
 */
export interface TargetBasis {
  /** Mifflin-St Jeor basal rate, or null when anthropometrics were incomplete. */
  bmr: number | null;
  /** Maintenance = BMR × activity factor. Null when BMR is null (flat-band fallback in use). */
  tdee: number | null;
  /** What the chosen pace asked for, signed: negative cuts, positive adds. */
  requestedDeltaKcal: number;
  /** What was actually applied after the share cap. */
  appliedDeltaKcal: number;
  /** True when `MAX_DEFICIT_SHARE`/`MAX_SURPLUS_SHARE` bit before the floor did. */
  shareCapApplied: boolean;
  /** The floor that was in force for this user. */
  floorKcal: number;
  /** True when the floor is the reason the number is what it is. The UI MUST surface this. */
  floorApplied: boolean;
  /** True when no BMR could be computed and the flat goal band was used instead. */
  usedFallbackBand: boolean;
}

export interface TargetOutcome {
  targets: FoodTargets;
  basis: TargetBasis;
}

/** Mifflin-St Jeor. Returns null unless every input it needs is present and in range. */
export function basalMetabolicRate(p: Profile, today = new Date()): number | null {
  const age = ageFrom(p.birth_year, today);
  if (age === null || p.sex === null || !p.height_cm || !p.weight_kg) return null;
  if (p.height_cm < 100 || p.height_cm > 250) return null;
  if (p.weight_kg < 30 || p.weight_kg > 400) return null;
  const base = 10 * p.weight_kg + 6.25 * p.height_cm - 5 * age;
  return Math.round(p.sex === "male" ? base + 5 : base - 161);
}

/** Age in whole years, or null when the birth year is missing or out of the supported band. */
export function ageFrom(birthYear: number | null, today = new Date()): number | null {
  if (birthYear === null) return null;
  const age = today.getUTCFullYear() - birthYear;
  if (!Number.isInteger(age) || age < MIN_AGE || age > MAX_AGE) return null;
  return age;
}

/** Body Mass Index. Null when either input is missing. */
export function bmi(weightKg: number | null, heightCm: number | null): number | null {
  if (!weightKg || !heightCm) return null;
  const m = heightCm / 100;
  return Math.round((weightKg / (m * m)) * 10) / 10;
}

/**
 * Whether a target bodyweight may be accepted.
 *
 * REFUSED, not warned. A warning is a thing a user clicks past, and the users most likely to click
 * past it are the ones the check exists for. The caller shows `minHealthyKg` and asks again.
 */
export function checkTargetWeight(
  targetKg: number,
  heightCm: number | null,
): { ok: true } | { ok: false; reason: "below-healthy-bmi"; minHealthyKg: number } {
  if (!heightCm) return { ok: true }; // nothing to check against; onboarding asks for height first
  const m = heightCm / 100;
  const minHealthyKg = Math.ceil(MIN_TARGET_BMI * m * m);
  if (targetKg < minHealthyKg) return { ok: false, reason: "below-healthy-bmi", minHealthyKg };
  return { ok: true };
}

/**
 * The user's daily targets, with the reasoning that produced them.
 *
 * Order of operations matters and is asserted by test: compute maintenance → ask the pace for a
 * delta → clamp the delta to a share of maintenance → apply → clamp the RESULT to the floor. Doing
 * the floor first and the share cap second would let a large share cap pull the number back under
 * the floor, which is the exact bug this whole file exists to prevent.
 */
export function explainTargets(profile: Profile, today = new Date()): TargetOutcome {
  const floorKcal = profile.sex ? KCAL_FLOOR[profile.sex] : KCAL_FLOOR_UNKNOWN;
  const bmrValue = basalMetabolicRate(profile, today);

  if (bmrValue === null) {
    // No usable anthropometrics — fall back to eait's flat bands. Still floored: the bands sit
    // above every floor today, but a band edited to 1,100 tomorrow must not become a shipped target.
    const band = KCAL_BY_GOAL[profile.goal ?? "maintain"];
    const kcal = Math.max(floorKcal, band);
    return {
      targets: withCaps({ kcal, protein_g: proteinTarget(profile) }, profile),
      basis: {
        bmr: null, tdee: null, requestedDeltaKcal: 0, appliedDeltaKcal: 0,
        shareCapApplied: false, floorKcal, floorApplied: kcal > band, usedFallbackBand: true,
      },
    };
  }

  const tdee = Math.round(bmrValue * ACTIVITY_FACTOR[profile.activity ?? "sedentary"]);
  const goal = profile.goal ?? "maintain";
  const pace = profile.pace ?? "steady";

  // What the pace asks for, before any safety is applied.
  const weeklyKg = goal === "maintain" ? 0 : PACE_KG_PER_WEEK[pace];
  const magnitude = Math.round((weeklyKg * KCAL_PER_KG) / 7);
  const requestedDeltaKcal = goal === "lose" ? -magnitude : goal === "gain" ? magnitude : 0;

  // Guard 1 — the share cap. Scales with the person, so a 55 kg woman and a 110 kg man are not
  // handed the same absolute deficit for the same requested rate.
  const limit = Math.round(tdee * (requestedDeltaKcal < 0 ? MAX_DEFICIT_SHARE : MAX_SURPLUS_SHARE));
  const appliedDeltaKcal = clampMagnitude(requestedDeltaKcal, limit);
  const shareCapApplied = appliedDeltaKcal !== requestedDeltaKcal;

  // Guard 2 — the floor. Last, and unconditional.
  const beforeFloor = tdee + appliedDeltaKcal;
  const kcal = Math.max(floorKcal, beforeFloor);

  return {
    targets: withCaps({ kcal, protein_g: proteinTarget(profile) }, profile),
    basis: {
      bmr: bmrValue, tdee, requestedDeltaKcal, appliedDeltaKcal, shareCapApplied,
      floorKcal, floorApplied: kcal > beforeFloor, usedFallbackBand: false,
    },
  };
}

/** The targets alone, for callers that do not render the reasoning (the analyzer prompt, verdicts). */
export function targetsFor(profile: Profile, today = new Date()): FoodTargets {
  return explainTargets(profile, today).targets;
}

/** Clamp a signed value to ±limit without changing its sign. */
function clampMagnitude(value: number, limit: number): number {
  return Math.sign(value) * Math.min(Math.abs(value), Math.abs(limit));
}

/**
 * Protein target. Unchanged from eait: 1.6 g/kg, anchored to the GOAL weight when cutting (a
 * deficit risks lean mass, so protein tracks where the user is heading), clamped so an extreme
 * bodyweight cannot produce an absurd number.
 */
function proteinTarget(p: Profile): number {
  const anchor = p.goal === "lose" && p.target_weight_kg ? p.target_weight_kg : p.weight_kg;
  if (!anchor) return PROTEIN_BASELINE_G;
  return Math.min(PROTEIN_MAX_G, Math.max(PROTEIN_MIN_G, Math.round(anchor * PROTEIN_PER_KG)));
}

/**
 * Attach the restriction caps. Typed lookup, not a bare string literal: a typo here would silently
 * drop a cap the user asked for — the same class of failure `visibleVerdicts` guards on the verdict
 * side. Built by conditional spread because `exactOptionalPropertyTypes` is on and an explicitly
 * `undefined` cap is not the same thing as an absent one to `verdictsFromTargets`.
 */
function withCaps(base: FoodTargets, profile: Profile): FoodTargets {
  const declared = (tag: RestrictionTag) => profile.restrictions.includes(tag);
  return {
    ...base,
    ...(declared("ldl") ? { satfat_g: SATFAT_CAP_LDL_G } : {}),
    ...(declared("kidneys") ? { sodium_mg: SODIUM_CAP_KIDNEYS_MG } : {}),
  };
}

/** Signed kilograms from current to target: positive = still to lose. Null when either is unknown. */
export function weightRemainingKg(p: Profile): number | null {
  if (!p.weight_kg || !p.target_weight_kg) return null;
  return Math.round((p.weight_kg - p.target_weight_kg) * 10) / 10;
}

// ── Restrictions ─────────────────────────────────────────────────────────────────────────────

/**
 * The complete restriction vocabulary. Anything outside it is meaningless to `targetsFor` and to
 * the analyzer prompt, so `patchProfile` stores only tags from this exact list.
 *
 * Ordered so stored tags are stable regardless of input order: `patchProfile` walks this list
 * rather than the request, and onboarding offers the options in it.
 */
export const RESTRICTION_TAGS = ["kidneys", "ldl", "vegan", "lowsugar"] as const;
export type RestrictionTag = (typeof RESTRICTION_TAGS)[number];

export function isRestrictionTag(v: string): v is RestrictionTag {
  return (RESTRICTION_TAGS as readonly string[]).includes(v);
}

// ── Verdicts ─────────────────────────────────────────────────────────────────────────────────

/**
 * Which restriction tag unlocks which verdict dimension. `weight` is absent on purpose: it applies
 * to every user and is never gated. `lowsugar`/`vegan` are absent because they carry no verdict
 * dimension — declaring them must never open a medical one.
 */
const GATING_TAG = { ldl: "ldl", kidneys: "kidneys" } as const satisfies Record<
  Exclude<keyof MealVerdicts, "weight">,
  RestrictionTag
>;

/**
 * Drop verdicts for dimensions the user did not declare.
 *
 * The prompt already instructs the model not to judge undeclared dimensions, but an instruction is
 * a request, not a guarantee — in eait's live database, users who declared only `lowsugar`, and
 * users who declared nothing at all, both had meals carrying `ldl` and `kidneys` verdicts. Someone
 * who never ticked "cholesterol" should not be shown a cholesterol judgement on their food.
 *
 * Applied at BOTH ends: at every analyzer exit so an undeclared verdict is never persisted, and at
 * render so a row written before this gate — or one whose owner has since UNTICKED the restriction
 * — stops being displayed. A one-way filter, never reconciliation between the two axes.
 */
export function visibleVerdicts(
  verdicts: MealVerdicts,
  restrictions: readonly string[],
): MealVerdicts {
  const out: MealVerdicts = {};
  if (verdicts.weight !== undefined) out.weight = verdicts.weight;
  for (const dimension of Object.keys(GATING_TAG) as (keyof typeof GATING_TAG)[]) {
    const v = verdicts[dimension];
    if (v !== undefined && restrictions.includes(GATING_TAG[dimension])) out[dimension] = v;
  }
  return out;
}

/**
 * Share of a day's allowance above which one meal is `warn`, and above which it is `bad`.
 *
 * A POLICY CHOICE, not a measurement. The reasoning is arithmetic rather than clinical: roughly
 * three meals make a day, so a meal at a third of the allowance is on plan, and one carrying more
 * than half the day's budget is not — whatever the remaining meals look like.
 *
 * EXPORTED because the landing page's hero card hand-writes a sample meal and the three verdicts
 * beside it, and a typed verdict that disagrees with the numbers next to it is exactly what
 * `verdictsFromTargets` exists to prevent everywhere else. Its test reconciles the two against
 * these, so the marketing page cannot show a judgement the engine would not produce.
 */
export const WARN_SHARE = 1 / 3;
export const BAD_SHARE = 1 / 2;

function shareVerdict(value: number, dailyAllowance: number): Verdict {
  const share = value / dailyAllowance;
  if (share > BAD_SHARE) return "bad";
  if (share > WARN_SHARE) return "warn";
  return "good";
}

/**
 * Derive verdicts from the user's caps instead of asking the model to judge.
 *
 * Verdicts used to be authored by the model, from the model's own macros. The moment any downstream
 * step revises a number — including the user editing it by hand, which this app makes a headline
 * feature — the verdict beside it describes numbers that no longer exist. A reassuring
 * `ldl: "good"` printed over a damning figure is worse than either alone, and it lands on a card
 * belonging to someone who declared a medical restriction and may act on it.
 *
 * Computing verdicts from the caps makes them deterministic, auditable, and correct by construction
 * after ANY edit. Only declared dimensions can be produced: a cap is absent from `targets` exactly
 * when its restriction was not declared.
 */
export function verdictsFromTargets(
  meal: { kcal: number; satfat_g: number; sodium_mg: number },
  targets: FoodTargets,
): MealVerdicts {
  const out: MealVerdicts = { weight: shareVerdict(meal.kcal, targets.kcal) };
  if (targets.satfat_g !== undefined) out.ldl = shareVerdict(meal.satfat_g, targets.satfat_g);
  if (targets.sodium_mg !== undefined) out.kidneys = shareVerdict(meal.sodium_mg, targets.sodium_mg);
  return out;
}
