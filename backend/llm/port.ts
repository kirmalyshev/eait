// The LLM capability ports.
//
// The engine depends on these FUNCTION TYPES, never on a vendor SDK. Swapping OpenRouter for
// anything else is one file (`openrouter.ts`) plus one line in the composition root, and the
// engine's tests bind fakes to the same three signatures — which is what lets cap enforcement,
// verdict gating and the correction loop be tested without a billed call.

import type { MealAnalysis, Profile, FoodTargets, DayTotals } from "@ieat/shared";

export interface PhotoInput {
  /** Several images are ANGLES OF ONE MEAL, not several meals. One analysis, one billed call. */
  images: Uint8Array[];
  profile: Profile;
  targets: FoodTargets;
  caption?: string;
  /** HH:MM local — lets the model infer breakfast/lunch/dinner, which measurably helps portioning. */
  localTime?: string;
  /** Foods this user has logged before, most-eaten first. A prior for IDENTIFICATION only; it must
   *  never touch a number. */
  repertoire?: readonly string[];
}

export type AnalyzePhoto = (input: PhotoInput) => Promise<MealAnalysis>;

/**
 * What free text turned out to mean.
 *
 * `dayOffset` is whole days back from today, `[0, 7]`. It is CLAMPED at every construction site
 * rather than typed as a bounded number: models commonly emit `null` for "today", and rejecting the
 * whole response over its date field loses a fully correct analysis to a retry loop.
 */
export type RouteResult =
  | { intent: "answer"; text: string }
  | { intent: "meal"; analysis: MealAnalysis; dayOffset: number }
  | { intent: "correction"; analysis: MealAnalysis }
  | { intent: "redate"; dayOffset: number };

export interface TextInput {
  text: string;
  profile: Profile;
  targets: FoodTargets;
  /** Today's meals, so "what have I eaten" is answered from data rather than from a transcript. */
  todayMeals: { items: string[]; kcal: number; protein_g: number }[];
  /** The last week's per-day sums — the other half of the router's context. */
  week: DayTotals[];
  /** The meal a correction would apply to. Absent means corrections are not available this turn. */
  focusMeal?: MealAnalysis;
}

export type RouteText = (input: TextInput) => Promise<RouteResult>;

/** Free text → restriction tags, when the keyword pass found nothing. Validated against the closed
 *  vocabulary by the caller; anything outside it is dropped. */
export type ClassifyRestrictions = (text: string) => Promise<string[]>;

export interface LlmPorts {
  analyzePhoto: AnalyzePhoto;
  routeText: RouteText;
  classifyRestrictions: ClassifyRestrictions;
}

/** Clamp to an integer in `[0, MAX_DAY_OFFSET]`, warning when the value was out of contract. */
export const MAX_DAY_OFFSET = 7;
export function clampDayOffset(v: unknown): number {
  const n = Math.round(Number(v ?? 0));
  if (!Number.isFinite(n)) return 0;
  if (n < 0 || n > MAX_DAY_OFFSET) {
    console.warn(`[ieat] dayOffset out of contract: ${String(v)} -> clamped`);
    return Math.min(MAX_DAY_OFFSET, Math.max(0, n));
  }
  return n;
}
