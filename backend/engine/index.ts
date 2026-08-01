// The engine's public surface. A front end imports from HERE and from nowhere deeper — that is the
// whole contract, and it is what keeps the HTTP API a front end rather than the engine itself.

export type { EngineDeps } from "./deps.ts";
export { checkCaps, type CapScope } from "./caps.ts";
export {
  logPhotoMeal, editMeal, applyCorrection, confirmPendingMeal, cancelPendingMeal, sumTotals,
  toAnalysis, type LogPhotoInput,
} from "./meals.ts";
export { handleText, PENDING_TTL_MS, type HandleTextInput } from "./text.ts";
export { day, week, MAX_WINDOW_DAYS } from "./diary.ts";
export { profileView, patchProfile, classifyRestrictions, type PatchOutcome } from "./profile.ts";
// The onboarding sequence lives in `@ieat/shared` so the app derives the same "what's next" the
// server validates against. Re-exported here only so engine callers have one import.
export { nextStep, stepApplies, ONBOARDING_STEPS, type OnboardingStep } from "@ieat/shared";
