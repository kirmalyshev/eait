// The engine's public surface. A front end imports from HERE and from nowhere deeper — that is the
// whole contract, and it is what keeps the HTTP API a front end rather than the engine itself.

export type { EngineDeps } from "./deps.ts";
export { checkCaps, type CapScope } from "./caps.ts";
export { adminUserChat, adminUserDiary, ADMIN_MEAL_ROWS, type AdminDiary } from "./admin.ts";
export {
  adminUsers, applyRevenueCatEvent, dailyPhotoCap, entitlementFor, freeAnalysesFor, setUserCap,
  userCap,
  type AdminUser, type AdminUsers, type ApplyOutcome, type RevenueCatEvent, type UserCap,
} from "./entitlement.ts";
export {
  logPhotoMeal, editMeal, applyCorrection, attachPhotos, confirmPendingMeal, cancelPendingMeal, pendingMeals, reanalyzeMeal, sumTotals,
  toAnalysis, type LogPhotoInput,
} from "./meals.ts";
export { handleText, type HandleTextInput } from "./text.ts";
export { deleteLine, editLine, type EditLineInput } from "./lines.ts";
export { coachTurn, coachTools, recentLines, COACH_HISTORY_LINES } from "./coach.ts";
export { appendLines, chatHistory } from "./chat.ts";
export { day, week, MAX_WINDOW_DAYS } from "./diary.ts";
export {
  collectPushReceipts, dailyNotification, eveningSweep, msUntilNextEveningLine, notificationCopy,
  resetNotificationCopy, saveNotificationCopy, RECEIPT_DELAY_MS,
  type DailyNotification, type SweepResult,
} from "./notify.ts";
export { profileView, patchProfile, type PatchOutcome } from "./profile.ts";
export { mintPairingCode, redeemPairingCode } from "./pairing.ts";
export { recordHealthDays, healthTrend, pruneAgedHealthDays } from "./health.ts";
export {
  signInWithProvider, identitiesFor, isAnonymous, linkTelegram, revokeAppleIdentity, unlinkIdentity,
} from "./identity.ts";
export {
  onboardingContent, saveOnboardingContent, resetOnboardingContent, recordOnboardingEvents,
  adminMetrics, type AdminMetricsView,
  onboardingFunnel,
} from "./onboarding.ts";
// The onboarding sequence lives in `@eait/shared` so the app derives the same "what's next" the
// server validates against. Re-exported here only so engine callers have one import.
export { stepApplies, ONBOARDING_STEPS, type OnboardingStep } from "@eait/shared";
