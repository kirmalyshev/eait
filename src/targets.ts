// Per-user daily targets, free-text restriction parsing, and the verdict-visibility gate.
// Generic by default; kidney/LDL caps apply ONLY when the user declared them (spec §9).

import type { FoodTargets, MealVerdicts, Profile, Verdict } from "./types.ts";

const KCAL_BY_GOAL = { lose: 1800, maintain: 2100, gain: 2400 } as const;
const PROTEIN_BASELINE_G = 100;
// 1.6 g/kg — low end of the sports-nutrition consensus band; clamped so an extreme
// bodyweight cannot produce an absurd target.
const PROTEIN_PER_KG = 1.6;
const PROTEIN_MIN_G = 80;
const PROTEIN_MAX_G = 180;
const SATFAT_CAP_LDL_G = 13; // AHA-style saturated-fat ceiling
const SODIUM_CAP_KIDNEYS_MG = 2000; // renal-diet sodium ceiling

export function targetsFor(profile: Profile): FoodTargets {
  const kcal = KCAL_BY_GOAL[profile.goal ?? "maintain"];
  const anchor = proteinAnchorKg(profile);
  const protein_g = anchor
    ? Math.min(PROTEIN_MAX_G, Math.max(PROTEIN_MIN_G, Math.round(anchor * PROTEIN_PER_KG)))
    : PROTEIN_BASELINE_G;
  const targets: FoodTargets = { kcal, protein_g };
  // Typed lookup, not a bare string literal: a typo here would silently drop a cap the user asked
  // for, the same class of failure `visibleVerdicts` exists to prevent on the verdict side.
  const declared = (tag: RestrictionTag) => profile.restrictions.includes(tag);
  if (declared("ldl")) targets.satfat_g = SATFAT_CAP_LDL_G;
  if (declared("kidneys")) targets.sodium_mg = SODIUM_CAP_KIDNEYS_MG;
  return targets;
}

/**
 * The bodyweight the protein target scales against: the GOAL weight when cutting (a calorie deficit
 * risks lean mass, so protein is anchored to where the user is heading), otherwise current
 * bodyweight. Null when no usable weight is known — the caller falls back to the flat baseline.
 * Kcal deliberately stays goal-banded; a bodyweight-delta→calorie formula is out of scope (it needs
 * safe-rate-of-loss logic this photo-logger has no business inventing).
 */
function proteinAnchorKg(p: Profile): number | null {
  if (p.goal === "lose" && p.target_weight_kg) return p.target_weight_kg;
  return p.weight_kg ?? null;
}

/**
 * Signed kilograms from current to target (current − target): positive = still to lose, negative =
 * still to gain, 0 = at goal. Null when either weight is unknown. Feeds the /me progress line and
 * the analyzer's goal framing; it never changes the numeric targets.
 */
export function weightRemainingKg(p: Profile): number | null {
  if (!p.weight_kg || !p.target_weight_kg) return null;
  return Math.round((p.weight_kg - p.target_weight_kg) * 10) / 10;
}

// Ordered so output tags are stable regardless of input order. Substring match catches
// inflected forms (почками, сахара, cholesterol) without a full morphology pass.
const RESTRICTION_MAP = [
  { tag: "kidneys", keywords: ["почк", "kidney", "ckd", "renal"] },
  { tag: "ldl", keywords: ["холестер", "ldl", "cholesterol"] },
  { tag: "vegan", keywords: ["веган", "vegan"] },
  { tag: "lowsugar", keywords: ["сахар", "sugar"] },
] as const satisfies ReadonlyArray<{ tag: string; keywords: readonly string[] }>;

/**
 * The complete restriction vocabulary. Anything outside it is meaningless to `targetsFor` and
 * to the analyzer prompt, so the LLM classifier validates against this exact list — one source
 * of truth, no drift between the keyword pass and the fallback.
 *
 * It is a literal union, not string[], so `me.restriction.${tag}` is a checkable catalog key.
 */
export const RESTRICTION_TAGS = RESTRICTION_MAP.map((r) => r.tag) as RestrictionTag[];
export type RestrictionTag = (typeof RESTRICTION_MAP)[number]["tag"];

export function isRestrictionTag(v: string): v is RestrictionTag {
  return (RESTRICTION_TAGS as string[]).includes(v);
}

/**
 * Which restriction tag unlocks which verdict dimension — the lookup the gate consults, not the
 * gate itself (that is `visibleVerdicts`). `weight` is absent on purpose: it applies
 * to every user and is never gated. `lowsugar` and `vegan` are absent because they carry no
 * verdict dimension — declaring them must not open a medical one.
 */
const GATING_TAG = { ldl: "ldl", kidneys: "kidneys" } as const satisfies Record<
  Exclude<keyof MealVerdicts, "weight">,
  RestrictionTag
>;

/**
 * Drop verdicts for dimensions the user did not declare.
 *
 * The analyzer prompt already instructs the model not to judge undeclared dimensions, but an
 * instruction is a request, not a guarantee — in the live database, users who declared only
 * `lowsugar`, and users who declared nothing at all, both had meals carrying `ldl` and `kidneys`
 * verdicts. Someone who never ticked "cholesterol" should not be shown a cholesterol judgement on
 * their food.
 *
 * Applied at both ends on purpose: at every analyzer exit (`gated` in analyzer.ts — photo, text
 * meal, and correction) so an undeclared verdict is never persisted, and at both renderers so a
 * row written before this gate — or one whose owner has since UNTICKED the restriction — stops
 * being displayed. The render half is what keeps working after the one-shot backfill (migration 8)
 * has run: a user who un-ticks tomorrow needs the same protection with no migration to apply.
 *
 * This is a one-way filter, NOT reconciliation between the two axes: un-ticking a tag still edits
 * no stored prose and no other field (see the independence rule in src/AGENTS.md).
 */
export function visibleVerdicts(
  verdicts: MealVerdicts,
  restrictions: readonly string[],
): MealVerdicts {
  const out: MealVerdicts = {};
  if (verdicts.weight !== undefined) out.weight = verdicts.weight;
  // Object.keys, not entries: entries widens the key to `string` and would need the cast twice.
  for (const dimension of Object.keys(GATING_TAG) as (keyof typeof GATING_TAG)[]) {
    const v = verdicts[dimension];
    if (v !== undefined && restrictions.includes(GATING_TAG[dimension])) out[dimension] = v;
  }
  return out;
}

/** Free text -> tags. Unknown words are dropped; `classifyRestrictions` is the LLM fallback. */
export function parseRestrictions(text: string): string[] {
  const hay = text.toLowerCase();
  const tags: string[] = [];
  for (const { tag, keywords } of RESTRICTION_MAP) {
    if (keywords.some((k) => hay.includes(k))) tags.push(tag);
  }
  return tags;
}

/**
 * Share of a day's allowance above which one meal is `warn`, and above which it is `bad`.
 *
 * A POLICY CHOICE, not a measurement, and worth naming as such. The reasoning is arithmetic rather
 * than clinical: roughly three meals make a day, so a meal at a third of the allowance is on plan,
 * and one carrying more than half the day's budget is not — whatever the remaining meals look like.
 * Every dimension uses the same rule, so a verdict means the same thing wherever it appears.
 */
const WARN_SHARE = 1 / 3;
const BAD_SHARE = 1 / 2;

/** Where one meal's number falls against a whole day's allowance. */
function shareVerdict(value: number, dailyAllowance: number): Verdict {
  const share = value / dailyAllowance;
  if (share > BAD_SHARE) return "bad";
  if (share > WARN_SHARE) return "warn";
  return "good";
}

/**
 * Derive the meal's verdicts from the user's caps, instead of asking the model to judge.
 *
 * WHY THIS EXISTS. Verdicts used to be authored by the model, from the model's own macros. The
 * moment any downstream step revises a number — a composition-table lookup replacing 5 g of
 * saturated fat with 20 g — the verdict beside it describes numbers that no longer exist. A
 * reassuring `ldl: "good"` printed over a damning figure is worse than either alone, and it lands
 * on a card belonging to someone who declared a medical restriction and may act on it.
 *
 * Computing verdicts from the caps `targetsFor` already produces makes them deterministic,
 * auditable, and correct by construction after any substitution. It also stops the model judging
 * at all, which removes the reason the verdict gate had to exist in the first place — though the
 * gate stays, because defence in depth on a medical claim costs nothing.
 *
 * Only dimensions the user actually declared get a verdict: a cap is absent from `targets` exactly
 * when its restriction was not declared, so an undeclared dimension cannot be produced here even
 * by accident. `weight` applies to everyone and is judged against the kcal target.
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
