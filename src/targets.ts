// Per-user daily targets + free-text restriction parsing.
// Generic by default; kidney/LDL caps apply ONLY when the user declared them (spec §9).

import type { FoodTargets, Profile } from "./types.ts";

const KCAL_BY_GOAL = { lose: 1800, maintain: 2100, gain: 2400 } as const;
const PROTEIN_BASELINE_G = 100;
const SATFAT_CAP_LDL_G = 13; // AHA-style saturated-fat ceiling
const SODIUM_CAP_KIDNEYS_MG = 2000; // renal-diet sodium ceiling

export function targetsFor(profile: Profile): FoodTargets {
  const kcal = KCAL_BY_GOAL[profile.goal ?? "maintain"];
  const targets: FoodTargets = { kcal, protein_g: PROTEIN_BASELINE_G };
  if (profile.restrictions.includes("ldl")) targets.satfat_g = SATFAT_CAP_LDL_G;
  if (profile.restrictions.includes("kidneys")) targets.sodium_mg = SODIUM_CAP_KIDNEYS_MG;
  return targets;
}

// Ordered so output tags are stable regardless of input order. Substring match catches
// inflected forms (почками, сахара, cholesterol) without a full morphology pass.
const RESTRICTION_MAP: Array<{ tag: string; keywords: string[] }> = [
  { tag: "kidneys", keywords: ["почк", "kidney", "ckd", "renal"] },
  { tag: "ldl", keywords: ["холестер", "ldl", "cholesterol"] },
  { tag: "vegan", keywords: ["веган", "vegan"] },
  { tag: "lowsugar", keywords: ["сахар", "sugar"] },
];

/**
 * The complete restriction vocabulary. Anything outside it is meaningless to `targetsFor` and
 * to the analyzer prompt, so the LLM classifier validates against this exact list — one source
 * of truth, no drift between the keyword pass and the fallback.
 */
export const RESTRICTION_TAGS = RESTRICTION_MAP.map((r) => r.tag);

/** Free text -> tags. Unknown words are dropped; `classifyRestrictions` is the LLM fallback. */
export function parseRestrictions(text: string): string[] {
  const hay = text.toLowerCase();
  const tags: string[] = [];
  for (const { tag, keywords } of RESTRICTION_MAP) {
    if (keywords.some((k) => hay.includes(k))) tags.push(tag);
  }
  return tags;
}
