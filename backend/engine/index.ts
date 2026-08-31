// The engine's public surface. A front end imports from HERE and from nowhere deeper — that is the
// whole contract, and it is what keeps the HTTP API a front end rather than the engine itself.

export type { EngineDeps } from "./deps.ts";
export { checkCaps, type CapScope } from "./caps.ts";
export {
  applyRevenueCatEvent, dailyPhotoCap, entitlementFor,
  type ApplyOutcome, type RevenueCatEvent,
} from "./entitlement.ts";
export {
  logPhotoMeal, editMeal, applyCorrection, confirmPendingMeal, cancelPendingMeal, sumTotals,
  toAnalysis, type LogPhotoInput,
} from "./meals.ts";
export { handleText, type HandleTextInput } from "./text.ts";
export { appendLines, chatHistory } from "./chat.ts";
export { day, week, MAX_WINDOW_DAYS } from "./diary.ts";
export {
  collectPushReceipts, dailyNotification, eveningSweep, msUntilNextEveningLine, notificationCopy,
  resetNotificationCopy, saveNotificationCopy, RECEIPT_DELAY_MS,
  type DailyNotification, type SweepResult,
} from "./notify.ts";
export { profileView, patchProfile, classifyRestrictions, type PatchOutcome } from "./profile.ts";
export { recordHealthDays, healthTrend } from "./health.ts";
export { signInWithProvider, identitiesFor, isAnonymous, revokeAppleIdentity } from "./identity.ts";
export {
  onboardingContent, saveOnboardingContent, resetOnboardingContent, recordOnboardingEvents,
  onboardingFunnel,
} from "./onboarding.ts";
// The onboarding sequence lives in `@ieat/shared` so the app derives the same "what's next" the
// server validates against. Re-exported here only so engine callers have one import.
export { stepApplies, ONBOARDING_STEPS, type OnboardingStep } from "@ieat/shared";
