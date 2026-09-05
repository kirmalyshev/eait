// The HTTP contract, imported by BOTH the server that implements it and the client that calls it.
//
// This is the reason the repo is a monorepo. In two repos the contract is a document that goes
// stale; here, renaming a field breaks `bun run typecheck` in the app and the backend in the same
// command. Nothing in this file may import from `src/backend` or `src/mobile`.

import type {
  ActivityLevel, DailyTotals, DayTotals, Goal, Lang, MealItem, MealRecord, Pace, Profile, Sex,
} from "./types.ts";
import type { OnboardingContent, OnboardingEvent } from "./onboarding.ts";
import type { TargetBasis } from "./targets.ts";
import type { ConfirmMealResult, HandleTextResult, LogPhotoResult, MealUpdated, TargetGone } from "./results.ts";
import type { HealthDay } from "./health.ts";
import type { Entitlement } from "./entitlement.ts";
import type { ScriptedLineId } from "./chat.ts";
import type { ChatPromptId } from "./onboarding-chat.ts";
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
  "subscription-required": 402,
  "analysis-failed": 502,
  "unsupported-image": 415,
  "no-photo": 404,
} as const;
export type RefusalKind = keyof typeof REFUSAL_STATUS;

/**
 * The server's effective limits, as told to the client.
 *
 * These are ENV-CONFIGURED on the server (`EAIT__BACKEND__MAX_UPLOAD_MB`, `EAIT__BACKEND__MAX_PHOTOS_PER_MEAL`) and therefore
 * differ between environments — which is exactly why they are sent rather than compiled into the
 * app. A limit the server enforces and the client separately hardcodes is two numbers that must
 * agree, and the failure when they stop agreeing is a user picking four photos and being refused
 * by a server that allows two.
 *
 * The constants below are the DEFAULTS and the fallback for a client that has not loaded a profile
 * yet. They are not the authority; the server is.
 */
export interface Limits {
  maxUploadBytes: number;
  maxPhotosPerMeal: number;
  /**
   * Photos an ENTITLED account may have analyzed today; zero means no daily cap on this server.
   * Without an entitlement the number is moot — `sampleUsed` is the whole story — and it is sent
   * unconditionally because the app must never work it out: the server decides the tier.
   */
  dailyPhotoCap: number;
  /**
   * Whether this account has spent its one sample analysis. There is no free tier: the sample is
   * the onboarding's first verdict, and every analysis after it is refused with
   * `subscription-required` until the RevenueCat webhook has written an entitlement. The app
   * reads this beside `entitlement.active` to open the paywall on launch instead of on the first
   * refusal — but the refusal is the authority, and the sheet is only its rendering.
   */
  sampleUsed: boolean;
  /**
   * How many days back the diary can be asked about, counting today.
   *
   * IT BOUNDS THE MARKS, NOT THE DAYS. The date picker draws a month at a time and marks the days
   * that have meals on them; the marks come from `GET /v1/diary/week`, which refuses a window
   * wider than this. `GET /v1/diary/day` refuses nothing — it validates the shape of a date and
   * no more — so a day outside this window is still perfectly viewable, and the picker still
   * offers it. What the picker cannot do out there is say whether it has meals on it.
   *
   * Sent rather than compiled in, because that boundary is where the app is most tempted to
   * invent: a month drawn with no dots is indistinguishable from a month nobody ate in, and
   * neither the label nor the footer may claim the second when it only knows the first.
   */
  diaryWindowDays: number;
}

/** Fallback only — see `Limits`. Total upload size, above which a large POST is a DoS. */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
/** Fallback only — see `Limits`. Several angles of ONE plate, one analysis, one billed call. */
export const MAX_PHOTOS_PER_MEAL = 4;
/**
 * How far back this product looks, in days: five years.
 *
 * ONE NUMBER, FOUR JOBS, and they must agree. It is how old a health row may be and still be
 * stored (`engine/health.ts`), the widest trend a client may read back, how far the phone's FIRST
 * sync reaches into the health store (`lib/health/index.ts`), and — below — how far the diary's
 * per-day totals can be asked for, because the health screen draws intake on the same axis as
 * energy burned and two series with two horizons is a chart whose left half is silent about food.
 *
 * Five years rather than the two it used to be because the screen has a year view now, and a year
 * view over two years is two points. It is also what bounds rows per user: accounts are free and
 * the health route is not billed, so without a window a client could write four hundred distinct
 * dates per request, spanning centuries, for as long as it cared to. The `(user_id, date)` key
 * stops one date being stored twice; it does nothing about a client that simply never repeats one.
 */
export const HEALTH_RETENTION_DAYS = 5 * 365 + 1;

/**
 * How far back the diary answers for. THE AUTHORITY, imported by the route that enforces it and
 * sent to the app in `Limits.diaryWindowDays` — one number, not a matched pair. Tied to the
 * health horizon for the reason given there.
 */
export const DIARY_WINDOW_DAYS = HEALTH_RETENTION_DAYS;

export const ROUTES = {
  health: "/health",
  authDevice: "/v1/auth/device",
  authApple: "/v1/auth/apple",
  authGoogle: "/v1/auth/google",
  /** Drops the caller's own token. Sign-out, not account deletion. */
  authSignOut: "/v1/auth/signout",
  /** The identities linked to this account, so settings can show what is connected. */
  identities: "/v1/auth/identities",
  profile: "/v1/profile",
  /** GET — the onboarding copy this server is currently serving. Editable in the admin. */
  onboarding: "/v1/onboarding",
  /** POST — a batch of onboarding funnel events. Fire-and-forget from the app's point of view. */
  onboardingEvents: "/v1/onboarding/events",
  photo: "/v1/meals/photo",
  /** POST — one turn. GET `?before=<seq>&limit=N` — the thread, newest page first. */
  messages: "/v1/messages",
  /** POST — the user's own words and Spud's SCRIPTED lines by id. See `AppendLinesRequest`. */
  messagesLines: "/v1/messages/lines",
  /**
   * POST — register this device's Expo push token. DELETE — drop it. See `PushTokenRequest`.
   *
   * The token is how the 20:30 line reaches a phone at all, and it is the only thing about a
   * device this server keeps. Erased with the account, like everything else that names one.
   */
  pushToken: "/v1/push/token",
  /** PATCH — the manual edit path. See `EditMealRequest`. */
  meal: (id: string) => `/v1/meals/${encodeURIComponent(id)}`,
  /** One stored photo of one of the caller's meals, by position. Bytes with their mime; 404 otherwise. */
  mealPhoto: (id: string, n: number) => `/v1/meals/${encodeURIComponent(id)}/photos/${n}`,
  /** Run the analyzer again over the stored photos. Charged like a photo. */
  mealReanalyze: (id: string) => `/v1/meals/${encodeURIComponent(id)}/reanalyze`,
  pendingConfirm: (id: string) => `/v1/meals/pending/${encodeURIComponent(id)}/confirm`,
  pendingCancel: (id: string) => `/v1/meals/pending/${encodeURIComponent(id)}/cancel`,
  day: "/v1/diary/day",
  week: "/v1/diary/week",
  account: "/v1/account",

  // Note the distinction from `health` above, which is the LIVENESS probe the deploy watches.
  // These two are the user's health metrics, and they are authenticated and versioned.
  /** GET `?days=N` — the health trend this account has stored. Daily aggregates, never samples. */
  healthTrend: "/v1/health",
  /** POST — a batch of daily health aggregates read off the phone's health store. Upserted. */
  healthDays: "/v1/health/days",

  // ── The mailing list ──────────────────────────────────────────────────────────────────────
  //
  // The only two routes here that no app ever calls. They exist for the landing page, they are
  // unauthenticated, and they take FORM ENCODING rather than JSON — because the page that posts to
  // them carries no JavaScript, and a plain <form> is the only way to submit without any.
  //
  // A subscriber is deliberately NOT a user. There is no row linking the two, and there cannot be:
  // the app's promise is that it never stores an email address, and that stays literally true
  // because this list lives beside the accounts rather than inside them. It also means leaving the
  // list is its own action with its own token, not something buried in account deletion.
  /** POST, form-encoded, unauthenticated. Fields: `email`, and the honeypot `company`. */
  subscribe: "/v1/subscribe",
  /**
   * GET `?t=<token>`. The confirmation half of double opt-in — the link in the one email this
   * product sends. Until it is followed the address is on no list at all, and if it never is, the
   * row is deleted within days: an address somebody typed into a form is not consent, and holding
   * one that was never confirmed is holding personal data with no basis for it.
   */
  subscribeConfirm: "/v1/subscribe/confirm",
  /** GET `?t=<token>`. The withdrawal half — one click, no login, no confirmation screen. */
  unsubscribe: "/v1/unsubscribe",
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

/** Where an identity came from. `device` is the anonymous one every install starts with. */
export const PROVIDERS = ["device", "apple", "google"] as const;
export type Provider = (typeof PROVIDERS)[number];

/**
 * Sign in with Apple / Google.
 *
 * The client sends the provider's ID TOKEN. The server verifies its signature against the
 * provider's JWKS and reads the subject out of the verified claims — it never accepts a
 * client-asserted user id, because a client-asserted identity is not an identity.
 *
 * If the request carries a bearer token, this LINKS the identity to that account instead of
 * creating a new one. That is what lets a user try the app anonymously and keep their meals when
 * they sign in — and it is the fix for the anonymous account's real weakness, which is that losing
 * the device loses everything.
 */
export interface AuthProviderRequest {
  /** The provider's ID token (JWT). Verified server-side. */
  idToken: string;
  /**
   * The raw nonce the client generated for this sign-in, if it used one.
   *
   * Apple puts the SHA-256 of the nonce in the token for native sign-in, so the server compares
   * against both the raw value and its hash. Replay protection is worth the extra field.
   */
  nonce?: string;
}

/** What happened to the account when an identity was presented. */
export type LinkOutcome =
  /** No account existed for this identity, and no anonymous session was supplied — a new one. */
  | "created"
  /** The identity was attached to the caller's existing (anonymous) account. Nothing moved. */
  | "linked"
  /** The identity already had an account; the caller's anonymous data was moved into it. */
  | "merged"
  /** The identity already had an account and the caller already had a real one. Just signed in. */
  | "switched"
  /** The identity was already on this account. A no-op sign-in. */
  | "already";

export interface AuthProviderResponse {
  token: string;
  userId: string;
  outcome: LinkOutcome;
  /** True when the account still needs onboarding — the app routes on this, not on `outcome`. */
  onboarded: boolean;
  /** Meals moved from the anonymous account on a `merged` outcome. Shown to the user. */
  mergedMeals?: number;
}

export interface IdentitiesResponse {
  identities: { provider: Provider; linkedAt: string }[];
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
  /**
   * What this server will actually accept. Carried here because the profile is fetched at boot and
   * on every refresh, so the app learns the limits of the environment it is talking to instead of
   * assuming the ones it was compiled with.
   */
  limits: Limits;
  /**
   * The IANA zone this server computes calendar dates in.
   *
   * Sent for the same reason `limits` is: it is server configuration the client must agree with
   * rather than assume. The app aggregates health samples into days BEFORE sending them, and if it
   * used the device's zone while the server dated meals in this one, a day's food and that same
   * day's health would describe two different twenty-four-hour windows — on one screen, invisibly,
   * and only for people who travel.
   */
  timezone: string;
  /**
   * The paid tier, as the SERVER sees it.
   *
   * The store told RevenueCat, RevenueCat told this server by webhook, and this is the answer. The
   * app has its own copy from the purchases SDK and must not branch on it for anything the server
   * enforces: the two disagree for a few seconds after every purchase, and only one of them is the
   * one refusing requests. `limits.dailyPhotoCap` above is already computed from this.
   */
  entitlement: Entitlement;
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
  /**
   * The age typed in onboarding. The server derives `birth_year` from it with ITS clock — a device
   * sitting across a UTC year boundary derived a year off by one and got a legitimate
   * sixteen-year-old refused. Never null: clearing the field goes through `birth_year: null`.
   */
  age?: number;
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

// ── Onboarding ───────────────────────────────────────────────────────────────────────────────

/**
 * The onboarding copy, as this server currently has it.
 *
 * The app ships with `DEFAULT_ONBOARDING_CONTENT` compiled in and renders from that immediately,
 * then replaces it when this arrives. So the fetch is an ENHANCEMENT, never a gate: an onboarding
 * that waits for the network is an onboarding that shows a spinner as its first screen.
 */
export interface OnboardingContentResponse {
  content: OnboardingContent;
}

/**
 * A batch of funnel events.
 *
 * Batched rather than sent per-event because onboarding is exactly when a user is least likely to
 * have a good connection — a fresh install, often on cellular, often walking. The app keeps its own
 * copy on disk and flushes what it can; the ids make a re-flush idempotent.
 */
export interface OnboardingEventsRequest {
  events: OnboardingEvent[];
}

export interface OnboardingEventsResponse {
  accepted: number;
}

/** Bounded so one client cannot post a million rows. The app flushes well under this. */
export const MAX_ONBOARDING_EVENTS_PER_BATCH = 100;

// ── Meals ────────────────────────────────────────────────────────────────────────────────────

/** How a meal card came to be in the thread. Wording only; the card reads the meal as it is now. */
export type ChatEvent = "logged" | "updated" | "redated";

/**
 * One line of the conversation, as the SERVER kept it.
 *
 * The thread is stored server-side and the Chat tab is its continuation, so a reinstall or a second
 * device opens on the same conversation. A photo is a bubble that names its meal — the bytes are
 * fetched through the scoped photo route and never carried in a line. A meal card carries the meal's
 * CURRENT record (or null once it is gone), never a copy taken at the time: a stored verdict
 * would describe numbers that have since changed. A proposal's words are in the thread when they are
 * said; its card only once confirmed. `seq` is an opaque cursor, monotonic across the whole store:
 * treat it as an ordering, never as a count of anything.
 */
export type ChatEntry =
  /** `pendingId`: set when this turn proposed a meal; the confirmed meal carries the same id, so "was it logged" is "is there a card with it". */
  | { id: string; seq: number; ts: string; role: "user"; kind: "text"; text: string; clientId: string | null; pendingId: string | null }
  /** `mealId`: the meal the photo logged, so the bubble can fetch the picture; null on lines from before photos were kept. */
  | { id: string; seq: number; ts: string; role: "user"; kind: "photo"; text: string | null; mealId: string | null }
  | { id: string; seq: number; ts: string; role: "assistant"; kind: "text"; text: string }
  /** `mealId` outlives the meal: `meal` is null once it is deleted, and "was this proposal logged" reads the id. */
  | { id: string; seq: number; ts: string; role: "assistant"; kind: "meal"; event: ChatEvent; mealId: string | null; meal: MealRecord | null };

export interface ChatHistoryResponse {
  /** Oldest first within the page. */
  entries: ChatEntry[];
  /** Pass back as `before` for the next older page; null once the start of the thread is in hand. */
  before: number | null;
}

/**
 * `POST /v1/messages/lines`. What the APP may put in the thread without a model turn: the user's
 * own words (an onboarding answer, a choice) and Spud's scripted lines BY ID — never assistant
 * prose from the client. All-or-nothing: one bad line and nothing is written.
 */
export interface AppendLinesRequest {
  lines: AppendLine[];
}
/** One batch's bound — an onboarding's worth of turns. Over it, the whole batch is refused. */
export const MAX_APPEND_LINES_PER_BATCH = 50;
/** One user line — an onboarding answer or a sentence at Spud. The composer and the caption cap at it. */
export const MAX_USER_LINE = 500;
/** A profile free-text field (the medical free text, allergies, avoided products): prose, not a line. */
export const MAX_PROFILE_TEXT = 2000;
export type AppendLine =
  | { role: "user"; text: string }
  | { role: "assistant"; scripted: ScriptedLineId; params?: Record<string, string> }
  /**
   * One QUESTION from onboarding, by coordinate — never by text.
   *
   * The chat flow asks in the app and the words come from `GET /v1/onboarding`, so the phone is
   * repeating a sentence the server already served. It still may not SEND that sentence: the rule
   * is that a client names a line and the server owns the words, and a route that took onboarding
   * prose on trust would be a route that takes any prose on trust. So the phone names which prompt
   * and which of its bubbles, and the server looks the text up in its OWN copy — which also means
   * an admin edit lands in the thread rather than the string a stale app had cached.
   */
  | { role: "assistant"; ask: { prompt: ChatPromptId; line: number } };
export interface AppendLinesResponse {
  appended: number;
  /** Why nothing was appended: a line the client should fix, or a thread that is full and must stop. */
  reason?: "bad-line" | "thread-full";
}

/** A client id on a turn: ≤ `MAX_CLIENT_ID` chars, echoed on the stored user line so the phone can tell its own bubble from a repeat of the same words. */
export const MAX_CLIENT_ID = 64;

/** `POST /v1/messages`. `focusMealId` names the meal a correction applies to. */
export interface MessageRequest {
  text: string;
  /** The phone's id for this turn. Stored on the user line and returned in `ChatEntry`; never interpreted. */
  clientId?: string;
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

const EDIT_NUMBERS = ["kcal", "protein_g", "carbs_g", "fat_g", "satfat_g", "fiber_g", "sugar_g", "sodium_mg"] as const;
const ITEM_NUMBERS = ["kcal", "protein_g", "carbs_g", "fat_g", "kcal_per_100g"] as const;
const ITEM_KEYS: ReadonlySet<string> = new Set(["name", "grams", "name_en", "role", ...ITEM_NUMBERS]);
/** An edit's items are bounded like every other client string: their names reach every later prompt that day. */
export const MAX_MEAL_ITEMS = 50;
export const MAX_ITEM_NAME = 120;
/** A ceiling on any amount an edit carries: it ends up in a verdict and in a stored sentence. */
export const MAX_MEAL_AMOUNT = 1_000_000;
const amount = (v: unknown): boolean => typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= MAX_MEAL_AMOUNT;

/** A body is a cast, not a validation: the numbers here end up in a verdict and in a stored sentence. */
export function isEditMealRequest(body: unknown): body is EditMealRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
  const b = body as Record<string, unknown>;
  for (const k of EDIT_NUMBERS) {
    const v = b[k];
    if (v !== undefined && !amount(v)) return false;
  }
  if (b.items !== undefined) {
    if (!Array.isArray(b.items) || b.items.length > MAX_MEAL_ITEMS) return false;
    for (const i of b.items as unknown[]) {
      if (typeof i !== "object" || i === null) return false;
      const item = i as Record<string, unknown>;
      // Stored as given, so an undeclared key would be a body of any size that passes every bound.
      if (Object.keys(item).some((k) => !ITEM_KEYS.has(k))) return false;
      if (typeof item.name !== "string" || item.name.length > MAX_ITEM_NAME || !amount(item.grams)) return false;
      if (item.name_en !== undefined && (typeof item.name_en !== "string" || item.name_en.length > MAX_ITEM_NAME)) return false;
      // Allowed through so an edit can KEEP the role the analyzer gave an item, checked against the
      // one value the type has rather than bounded as a string: it is stored as given, and a row
      // claiming a role nothing implements is a lie the repertoire and every later reader believe.
      if (item.role !== undefined && item.role !== "cooking-fat") return false;
      for (const k of ITEM_NUMBERS) if (item[k] !== undefined && !amount(item[k])) return false;
    }
  }
  return true;
}

export type EditMealResponse = MealUpdated | TargetGone;

// ── Push ────────────────────────────────────────────────────────────────────────────────────

/**
 * One device's push token, as Expo's push service issues it (`ExponentPushToken[...]`).
 *
 * `POST` registers it and is idempotent per (user, token): the app re-registers on every launch
 * because a token is not stable — it changes on reinstall, on restore from a backup, and whenever
 * Apple decides to reissue one — so a register that duplicated rows would grow a table of devices
 * that answer `DeviceNotRegistered` forever. `DELETE` drops it, and is what the app calls when
 * somebody turns notifications off: a token the server keeps is a message it will try to send.
 *
 * `platform` is on the wire because the shape of this problem is per-platform and Android will not
 * be a different route. There is exactly one accepted value today.
 */
export interface PushTokenRequest {
  token: string;
  platform: "ios";
}

/** A bound on a value that is stored per device and re-sent on every launch. Expo's are ~40 chars. */
export const MAX_PUSH_TOKEN = 200;

/**
 * Expo's own token shape, checked BEFORE anything is stored.
 *
 * Not a security boundary — the token is the caller's own — but a shape check is what stops the
 * table filling with strings that can never be delivered to, and what makes "this account has a
 * device" mean something when the evening sweep asks.
 */
export function isPushToken(v: unknown): v is string {
  return typeof v === "string" && v.length <= MAX_PUSH_TOKEN
    && /^Expo(?:nent)?PushToken\[[^\s\[\]]+\]$/.test(v);
}

export function isPushTokenRequest(body: unknown): body is PushTokenRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return isPushToken(b.token) && b.platform === "ios";
}

/** What a register or an unregister answers. `registered` is the state AFTER the call. */
export interface PushTokenResponse {
  registered: boolean;
}

// ── Health ───────────────────────────────────────────────────────────────────────────────────

/**
 * A batch of daily health aggregates, read off the phone's health store.
 *
 * DAYS, not samples. The phone aggregates first (`aggregateDays` in `health.ts`) and sends the
 * result, so what crosses the wire and what is stored is the handful of numbers this product uses
 * rather than a per-second heart rate series it has no use for. Special-category data that is not
 * needed is data whose only property is risk.
 *
 * Idempotent: a day already stored is overwritten, not duplicated. The app re-reads a rolling
 * window on every sync — health data arrives late, so a sync that only looks forward misses the
 * scale that synced hours after the weigh-in and the sleep written the next morning.
 */
export interface HealthDaysRequest {
  days: HealthDay[];
  /**
   * When the newest weight reading was TAKEN, as the phone read it off the sample.
   *
   * Optional, and the server derives a conservative value from the day's own date when it is
   * absent — never from its own clock, which would let a stale batch replayed later beat a
   * correction the user typed in the meantime. See `engine/health.ts`.
   */
  weightMeasuredAt?: string;
}

export interface HealthDaysResponse {
  /** How many days were stored. A day carrying nothing usable is dropped, not counted. */
  accepted: number;
  /**
   * The profile as it stands AFTER the batch, present only when a weight reading moved it.
   *
   * Returned rather than left for the client to re-fetch because a new weight means a new calorie
   * target, and the alternative is a screen showing the old plan until something else happens to
   * refresh it.
   */
  profile?: ProfileResponse;
}

export interface HealthResponse {
  /** Most recent first. */
  days: HealthDay[];
}

/**
 * Bounded so one request cannot carry a decade. A rolling sync sends days; the FIRST sync sends
 * `HEALTH_RETENTION_DAYS` of them and goes through `healthDayBatches` to fit.
 */
export const MAX_HEALTH_DAYS_PER_BATCH = 400;

/** `days` split into requests the route will accept, in order. Empty in, nothing out. */
export function healthDayBatches(days: readonly HealthDay[]): HealthDay[][] {
  const out: HealthDay[][] = [];
  for (let i = 0; i < days.length; i += MAX_HEALTH_DAYS_PER_BATCH) {
    out.push(days.slice(i, i + MAX_HEALTH_DAYS_PER_BATCH));
  }
  return out;
}

/**
 * The window the app re-reads on every sync. See `HealthDaysRequest` for why it looks backwards.
 *
 * The FIRST sync of a process reads `HEALTH_RETENTION_DAYS` instead — the rolling window is the
 * steady state and is deliberately short, it exists to catch data that arrived late, not to move
 * history. But a user who connects Health today has years of it already, and a year view that
 * fills in one day per launch is a year view nobody will ever see filled.
 */
export const HEALTH_SYNC_LOOKBACK_DAYS = 7;

// ── Diary ────────────────────────────────────────────────────────────────────────────────────

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

/** The streamed shape of `POST /v1/meals/photo` when `accept` includes `NDJSON`. */
export const NDJSON = "application/x-ndjson";
/**
 * One line of the stream. Zero or one `glance`, zero or more `item`, then the `LogPhotoResult`
 * as the LAST line — refusals included, because the 200 went out with the first byte. An
 * `item` with `index: 0` after others means the analyzer started over (a schema retry).
 */
export type PhotoEvent =
  | { kind: "glance"; text: string }
  | { kind: "item"; index: number; item: MealItem }
  | LogPhotoResult;
export type MessageResponse = HandleTextResult;
export type PendingResponse = ConfirmMealResult | { kind: "cancelled" } | { kind: "expired" };
