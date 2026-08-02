// The engine's public surface. A front end imports from HERE and from nowhere deeper — that is the
// whole contract, and it is what makes `tg_bot/` and `api/` peers rather than one being a special
// case of the other.

export type { EngineDeps, UserId } from "./deps.ts";
export {
  logPhotoMeal, confirmPendingMeal, cancelPendingMeal, dropPendingMeal, type LogPhotoInput,
} from "./meals.ts";
export { handleText, type HandleTextInput, PENDING_TTL_MS } from "./text.ts";
export {
  applyPendingEdit, cancelPendingEdit, dropPendingEdit, resolveMealChoice, type ResolvedChoice,
} from "./edits.ts";
export { day, week, MAX_WINDOW_DAYS, type DayView } from "./diary.ts";
export {
  advanceOnboarding, type AdvanceOnboardingInput, type TranslatorFactory,
} from "./onboarding.ts";
export {
  openSettings, applySettingsAction, submitSettingsInput, setUserLanguage,
  type SettingsResult, type SetLanguageResult,
} from "./settings.ts";
export { profileFromRow, mealRecordToAnalysis, replyFormatFor } from "./profile.ts";
export { effectiveGlobalCap, checkCaps, CAP_KEY } from "./caps.ts";
export {
  readCap, setCap, allowUser, denyUser, listAllowed, isAdminRefusal,
  type AdminRefusal, type AllowlistResult, type CapChange, type CapStatus,
} from "./admin.ts";
export type {
  Answered, ApplyEditResult, ConfirmMealResult, EditProposed, HandleTextResult, LogPhotoResult,
  MealChoice, MealChoiceNeeded, MealHint, MealLogged, MealProposed, MealRedated, MealUpdated,
  Refusal, TargetGone,
} from "./results.ts";
export { isMeal } from "./results.ts";
