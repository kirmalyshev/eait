// Per-user daily targets, free-text restriction parsing, and the verdict-visibility gate.
// Generic by default; kidney/LDL caps apply ONLY when the user declared them (spec §9).

import type { FoodTargets, MealVerdicts, Profile } from "./types.ts";

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
