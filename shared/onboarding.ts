// The onboarding sequence. Shared, because both sides need the same answer to "what comes next".
//
// FIELD-DERIVED, NOT A STEP COUNTER. The current question is whichever field is still null. A
// counter loses its place when the app is killed mid-flow or reinstalled, and the failure is not
// symmetric: being asked your height twice is annoying, but being skipped past a question the
// target math needs produces a number computed from a default nobody chose.
//
// The server owns the truth (it validates and stores), and the app derives the same value locally
// so it can render the next screen without a round trip. One implementation, so they cannot
// disagree about what "next" means.

import type { Profile } from "./types.ts";

/** The questions, in order. Each names the profile field that answers it. */
export const ONBOARDING_STEPS = [
  "goal", "sex", "birth_year", "height_cm", "weight_kg", "target_weight_kg", "activity", "pace",
  "country", "restrictions",
] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

/**
 * Whether a step applies to this profile at all.
 *
 * A maintaining user is asked neither a target weight nor a pace: both are questions about a
 * change they are not making, and a required field with no meaning is how a flow acquires a "skip"
 * button that then has to be handled at every later step.
 */
export function stepApplies(step: OnboardingStep, p: Profile): boolean {
  if (p.goal === "maintain" && (step === "target_weight_kg" || step === "pace")) return false;
  return true;
}

/**
 * The next unanswered question, or null when the profile is complete.
 *
 * `restrictions` is last and is always considered unanswered until onboarding is marked complete:
 * an empty array is a real answer ("none of these"), indistinguishable from "never asked" by
 * inspection, so the completion flag carries that bit instead.
 */
export function nextStep(p: Profile): OnboardingStep | null {
  for (const step of ONBOARDING_STEPS) {
    if (!stepApplies(step, p)) continue;
    if (step === "restrictions") continue;
    if (p[step] === null) return step;
  }
  return p.onboarded_at === null ? "restrictions" : null;
}

/** How far through the flow this profile is, for a progress indicator. */
export function onboardingProgress(p: Profile): { index: number; total: number } {
  const applicable = ONBOARDING_STEPS.filter((s) => stepApplies(s, p));
  const current = nextStep(p);
  return {
    index: current === null ? applicable.length : applicable.indexOf(current),
    total: applicable.length,
  };
}
