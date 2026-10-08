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
  estimatePhoto, logPhotoMeal, editMeal, applyCorrection, attachPhotos, changeLine, confirmPendingMeal, cancelPendingMeal, pendingMeals, reanalyzeMeal, redateMeal, sumTotals,
  toAnalysis, type LogPhotoInput,
} from "./meals.ts";
export { handleText, type HandleTextInput } from "./text.ts";
export { drainJobs, startJobs, followPhotoJob, listJobs, photoJob, queuePhoto, queueMealUpdate, removePhotoJob } from "./photo-queue.ts";
export { deleteLine, deleteMealById, editLine, type EditLineInput } from "./lines.ts";
export { coachTurn, coachTools, recentLines, COACH_HISTORY_LINES } from "./coach.ts";
export { appendLines, chatHistory } from "./chat.ts";
export { sendAdminPush, type AdminPushResult } from "./admin-push.ts";
export { day, days, week, MAX_WINDOW_DAYS } from "./diary.ts";
export { weights, mergedWeights } from "./weights.ts";
export {
  collectPushReceipts, dailyNotification, isStaffAccount, pushTick, sendLogged, sendTestPush, notificationCopy,
  RECEIPT_DELAY_MS,
  type DailyNotification, type TickResult, type TestPushResult,
} from "./notify.ts";
export {
  campaignOverview, createCampaign, dryRunCampaign, runCampaigns, setCampaignStatus, setCampaignsKilled,
  testSendCampaign, updateCampaign,
  type CampaignOverview, type CampaignRunResult, type CampaignTestResult, type DryRunResult,
} from "./campaign.ts";
export { recordPushOpen, recordPushDelivered, pushOpenView, PUSH_STATS_MAX_DAYS, type PushOpenView } from "./push-open.ts";
export { pushConsent, setPushConsent, pushOffersAllowed } from "./push-consent.ts";
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
export { livePrompts, promptHistory, savePrompt, type PromptView, type PromptSave } from "./prompts.ts";
export { foodSearch, productByBarcode } from "./foods.ts";
export { listPushTemplates, reviewPushTemplate, savePushTemplate, type PushTemplateListing } from "./push-templates.ts";
// The onboarding sequence lives in `@eait/shared` so the app derives the same "what's next" the
// server validates against. Re-exported here only so engine callers have one import.
export { stepApplies, ONBOARDING_STEPS, type OnboardingStep } from "@eait/shared";
