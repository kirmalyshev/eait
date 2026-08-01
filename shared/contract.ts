// The HTTP contract, imported by BOTH the server that implements it and the client that calls it.
//
// This is the reason the repo is a monorepo. In two repos the contract is a document that goes
// stale; here, renaming a field breaks `bun run typecheck` in the app and the backend in the same
// command. Nothing in this file may import from `src/backend` or `src/mobile`.

import type {
  ActivityLevel, DailyTotals, DayTotals, Goal, Lang, MealItem, MealRecord, Pace, Profile, Sex,
} from "./types.ts";
import type { TargetBasis } from "./targets.ts";
import type { ConfirmMealResult, HandleTextResult, LogPhotoResult, MealUpdated, TargetGone } from "./results.ts";
import type { FoodTargets } from "./types.ts";

/** Bumped when a change is not backwards compatible. Shipped apps outlive the server they were built against. */
export const API_VERSION = "v1";

/**
 * Refusals map to status codes ONCE, here, so the server's encoder and the client's decoder cannot
 * disagree. `not-onboarded` is 403 rather than 401 on purpose: the caller authenticated fine, they
 * simply have no profile yet, and a 401 sends a well-behaved client into a token-refresh loop it
 * can never win.
 */
export const REFUSAL_STATUS = {
  "not-onboarded": 403,
  "not-food": 422,
  "cap-exceeded": 429,
  "analysis-failed": 502,
} as const;
export type RefusalKind = keyof typeof REFUSAL_STATUS;

/** Total size an upload may reach in memory. A cap is what keeps a large POST from being a DoS. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/** One meal may be photographed from several angles. More than this is not a meal, it is a bug. */
export const MAX_PHOTOS_PER_MEAL = 4;

export const ROUTES = {
  health: "/health",
  authDevice: "/v1/auth/device",
  profile: "/v1/profile",
  photo: "/v1/meals/photo",
  messages: "/v1/messages",
  /** PATCH — the manual edit path. See `EditMealRequest`. */
  meal: (id: string) => `/v1/meals/${encodeURIComponent(id)}`,
  pendingConfirm: (id: string) => `/v1/meals/pending/${encodeURIComponent(id)}/confirm`,
  pendingCancel: (id: string) => `/v1/meals/pending/${encodeURIComponent(id)}/cancel`,
  day: "/v1/diary/day",
  week: "/v1/diary/week",
  account: "/v1/account",
} as const;

// ── Auth ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Device-token authentication.
 *
 * eait's API ships with `resolveUserId` deliberately unwired — it returns null so every route
 * answers 401, "deliberately useless rather than deliberately open", and its AGENTS.md says wiring
 * a real scheme "is its own decision and its own doc". This is that decision.
 *
 * A client generates a random device id once, keeps it in the Keychain (`expo-secure-store`), and
 * trades it for a bearer token. No email, no password, no card — which is not laziness: the largest
 * complaint cluster against the incumbent, by a factor of four, is the card-first trial (238
 * reviews). Nothing to cancel is a product property, and it starts here.
 */
export interface AuthDeviceRequest {
  /** Opaque, client-generated, ≥32 chars. The server never derives meaning from it. */
  deviceId: string;
  /** BCP-47-ish; the server narrows it to a supported `Lang` and falls back to `en`. */
  locale?: string;
}
export interface AuthDeviceResponse {
  token: string;
  userId: string;
  /** True the first time this device id was seen — the app routes to onboarding on true. */
  created: boolean;
}

// ── Profile ──────────────────────────────────────────────────────────────────────────────────

/** Profile plus everything derived from it, so the app never recomputes targets locally. */
export interface ProfileResponse {
  profile: Profile;
  targets: FoodTargets;
  /** Why the targets are what they are. `basis.floorApplied` MUST be surfaced to the user. */
  basis: TargetBasis;
  /** Null until onboarding completes. */
  onboarded: boolean;
}

/**
 * A partial profile update. Every field optional; absent means "leave alone", explicit `null` means
 * "clear". Onboarding is just a sequence of these — the server derives the next step from which
 * fields are still null rather than trusting a client-side step counter, so a user who kills the
 * app mid-flow resumes where they actually are.
 */
export interface PatchProfileRequest {
  lang?: Lang;
  goal?: Goal | null;
  sex?: Sex | null;
  birth_year?: number | null;
  height_cm?: number | null;
  weight_kg?: number | null;
  target_weight_kg?: number | null;
  activity?: ActivityLevel | null;
  pace?: Pace | null;
  country?: string | null;
  restrictions?: string[];
  medical_limitations?: string | null;
  food_allergies?: string | null;
  product_limitations?: string | null;
  /** Set true exactly once, by the last onboarding screen, after consent. */
  complete_onboarding?: boolean;
}

/**
 * A rejected profile patch. 422, and the app re-asks the question rather than clicking past it.
 * `target-weight-below-healthy-bmi` is the anorexia guard in `targets.ts`; it is a refusal, not a
 * warning, because a warning is a thing the users it exists for will click past.
 */
export interface ProfileRejected {
  error: "invalid-profile";
  field: keyof PatchProfileRequest;
  reason: "target-weight-below-healthy-bmi" | "age-below-minimum" | "out-of-range";
  /** Present for `target-weight-below-healthy-bmi` — what the app shows as the lowest it accepts. */
  minHealthyKg?: number;
}

// ── Meals ────────────────────────────────────────────────────────────────────────────────────

/** `POST /v1/messages`. `focusMealId` names the meal a correction applies to. */
export interface MessageRequest {
  text: string;
  /**
   * Safe to accept from the client because every engine read is user-scoped: naming someone else's
   * meal resolves to nothing rather than to their row. Asserted by test in the backend.
   */
  focusMealId?: string;
}

/**
 * `PATCH /v1/meals/:id` — the manual edit. The other half of "you can edit the LLM's answer",
 * alongside the natural-language path through `/v1/messages`.
 *
 * The client sends the numbers it wants stored. It does NOT send `verdicts`, and the field does not
 * exist on this type: verdicts are recomputed server-side from the user's caps after every edit
 * (`verdictsFromTargets` → `visibleVerdicts`). A client that could set them could paint "good" over
 * a meal that blows a medical cap, and the person reading that card declared a medical restriction.
 */
export interface EditMealRequest {
  items?: MealItem[];
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  satfat_g?: number;
  fiber_g?: number;
  sugar_g?: number;
  sodium_mg?: number;
}

export type EditMealResponse = MealUpdated | TargetGone;

export interface DayResponse {
  date: string;
  meals: MealRecord[];
  totals: DailyTotals;
  targets: FoodTargets;
}

export interface WeekResponse {
  days: DayTotals[];
}

/** Every error body the API can produce, other than the refusals above. */
export interface ErrorResponse {
  error: string;
  [k: string]: unknown;
}

// Response aliases, so a handler and a client method can be declared against the same name.
export type PhotoResponse = LogPhotoResult;
export type MessageResponse = HandleTextResult;
export type PendingResponse = ConfirmMealResult | { kind: "cancelled" } | { kind: "expired" };
