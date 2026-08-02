// The LLM capability ports.
//
// The engine depends on these FUNCTION TYPES, never on a vendor SDK. Swapping OpenRouter for
// anything else is one file (`openrouter.ts`) plus one line in the composition root, and the
// engine's tests bind fakes to the same three signatures — which is what lets cap enforcement,
// verdict gating and the correction loop be tested without a billed call.

import type { MealAnalysis, Profile, FoodTargets, DayTotals } from "@ieat/shared";

/**
 * What an analyzer returns: every number, and NO verdicts.
 *
 * The model is never asked to judge — `prompt.ts` says so, and `MealAnalysisSchema` has no such
 * field, so zod strips one even when a model volunteers it. The engine derives verdicts from the
 * user's caps instead (`gatedVerdicts`), which is what makes them deterministic and auditable.
 *
 * This type exists because the old signature said `MealAnalysis`, and the implementations closed
 * the gap with `as MealAnalysis` — three casts asserting a field none of those values carried. The
 * typechecker therefore could not see that `proposed` shipped an analyzer's output straight to the
 * app with `verdicts` undefined, and `VerdictRow` indexed into it. In a Release build an unhandled
 * render error is a process abort: `RCTFatal` throws an NSException off the TurboModule queue and
 * the main thread dies wherever it happened to be, which is why three crash reports named three
 * unrelated subsystems and none of them named this.
 *
 * Saying what an analyzer really returns makes "an analysis reached a client unrepaired" a compile
 * error, which is the only version of this guarantee that holds.
 */
export type AnalyzedMeal = Omit<MealAnalysis, "verdicts">;

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

export type AnalyzePhoto = (input: PhotoInput) => Promise<AnalyzedMeal>;

/**
 * What free text turned out to mean.
 *
 * `dayOffset` is whole days back from today, `[0, 7]`. It is CLAMPED at every construction site
 * rather than typed as a bounded number: models commonly emit `null` for "today", and rejecting the
 * whole response over its date field loses a fully correct analysis to a retry loop.
 */
export type RouteResult =
  | { intent: "answer"; text: string }
  | { intent: "meal"; analysis: AnalyzedMeal; dayOffset: number }
  | { intent: "correction"; analysis: AnalyzedMeal }
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
