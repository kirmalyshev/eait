// The HTTP contract, imported by BOTH the server that implements it and the client that calls it.
//
// This is the reason the repo is a monorepo. In two repos the contract is a document that goes
// stale; here, renaming a field breaks `bun run typecheck` in the app and the backend in the same
// command. Nothing in this file may import from `backend` or `src/mobile`.

import type {
  ActivityLevel, DailyTotals, DayTotals, Goal, Lang, MealItem, MealRecord, Pace, Profile, Sex,
  Struggle, StreakGoal, Units,
} from "./types.ts";
import type { Diet, MedicalTag } from "./targets.ts";
import type { OnboardingContent, OnboardingEvent } from "./onboarding.ts";
import type { TargetBasis } from "./targets.ts";
import type { ChatSpeaker, ConfirmMealResult, HandleTextResult, LogPhotoResult, MealProposed, MealRedated, MealUpdated, Refusal, TargetGone } from "./results.ts";
import type { HealthDay } from "./health.ts";
import type { BmiRange } from "./scores.ts";
import { WEIGHT_RANGES, type ChartDay, type WeightRange } from "./ui/charts.ts";
import type { Entitlement } from "./entitlement.ts";
import type { WebPaywall } from "./paywall.ts";
import type { ScriptedLineId } from "./chat.ts";
import type { ChatPromptId } from "./onboarding-chat.ts";
import type { FoodTargets } from "./types.ts";
import { SNAPSHOT_MICROS, type FoodAttribution, type FoodRef, type OffProduct } from "./foods.ts";

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
  /**
   * The account carries no Apple or Google identity — sign-up has not happened. An analysis,
   * the free one included, is refused before anything is charged: the sample is never spent
   * anonymously. 403 for the same reason `not-onboarded` is: the caller authenticated fine.
   */
  "identity-required": 403,
  "not-food": 422,
  "cap-exceeded": 429,
  "subscription-required": 402,
  "analysis-failed": 502,
  "unsupported-image": 415,
  "no-photo": 404,
  /**
   * Email sign-in (#569): the code typed did not match the live one, and it may be tried again —
   * five wrong tries burn it, which is when `code-dead` takes over. 401 like `sign-in-failed`,
   * because a wrong credential is not a malformed request.
   */
  "code-wrong": 401,
  /**
   * The code can never match again: expired (ten minutes), already used, burnt by five wrong
   * tries, superseded by a newer send — or never sent. One answer for all of them, 410 because
   * the resource is gone rather than the guess wrong.
   */
  "code-dead": 410,
} as const;
export type RefusalKind = keyof typeof REFUSAL_STATUS;

/**
 * A streamed route's LAST line when the server itself failed mid-turn (#514): the JSON path's 500
 * `internal`, in-band because the 200 went out with the first byte. The photo route writes it, and
 * so does the text turn since it streams too (#508).
 *
 * NOT A REFUSAL, AND NOT `analysis-failed`. The throw can come after the meal was inserted, so
 * nobody knows whether it was logged, and every client words it that way: "try again" would pay
 * for the meal twice and log it twice. A stream that closes with no last line is the same unknown.
 * `analysis-failed` stays what the engine returns and nothing else.
 */
export const OUTCOME_UNKNOWN = "outcome-unknown";

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
   * Whether this account has spent its sample. There is no free tier: the sample is
   * `EAIT__BACKEND__FREE_ANALYSES` analyses over the account's lifetime — the instance default;
   * the admin can give one account its own number — and every analysis after them is refused with
   * `subscription-required` until the RevenueCat webhook has written an entitlement. The app
   * reads this beside `entitlement.active` to open the paywall on launch instead of on the first
   * refusal — but the refusal is the authority, and the sheet is only its rendering.
   */
  sampleUsed: boolean;
  /**
   * How many of the sample's analyses are LEFT. Zero whenever `sampleUsed` is true.
   *
   * `sampleUsed` alone was the whole story while the sample was one analysis: false meant "all of
   * it is there". At three it means "one or two or three of it is there", and every surface that
   * tried to word that from the boolean either lied ("your sample is unspent" to somebody two
   * meals in) or went vague. The server knows the number, so it sends it — the same rule as
   * `dailyPhotoCap` right above, and the reason neither is compiled into the app.
   *
   * An entitled account gets 0 here too: the sample is not what it is spending.
   */
  sampleRemaining: number;
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
  /**
   * The server's budget for ONE model call, in ms — `EAIT__BACKEND__LLM_TIMEOUT_MS` as this server
   * is actually running it.
   *
   * SENT, BECAUSE IT IS ENV-CONFIGURED. It differs between environments and production sets it
   * explicitly, so an app that computed its wait from a number compiled into its binary is the
   * second copy this interface exists to abolish — and the failure is silent in the worst
   * direction: the phone abandons a turn the server is still running and still billing, with no
   * error on either side.
   *
   * THE PER-CALL NUMBER RATHER THAN A WAIT, because how many budgets a turn spends depends on the
   * ROUTE and only the client knows which one it is about to call. `clientModelTimeoutMs` turns it
   * into a wait with `PHOTO_MODEL_CALLS` or `TEXT_MODEL_CALLS`; `DEFAULT_MODEL_TIMEOUT_MS` is the
   * fallback for a client with no profile yet, exactly as `maxPhotosPerMeal` is.
   */
  modelCallTimeoutMs: number;
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
 * THE FIRST JOB IS TWO BOUNDS, not one. `recordHealthDays` refuses a day older than this on the way
 * IN, and `pruneAgedHealthDays` deletes a stored day once it ages past it — at startup and once a
 * day. Only the ingest bound existed until #562, so "still be stored" was true of what the product
 * would serve and false of what the database held: a day accepted five years ago simply stayed.
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
 *
 * DEPRECATED (#103) with the `days`-window read it bounds — see {@link ROUTES.week}. The range
 * read's bound is {@link DIARY_RANGE_MAX_DAYS}, a contract constant rather than a sent limit for
 * the same reason `MAX_HEALTH_DAYS_PER_BATCH` is one: it is not env-configured, so the shared
 * package is already the single authority on both sides.
 */
export const DIARY_WINDOW_DAYS = HEALTH_RETENTION_DAYS;

/**
 * The widest span `GET /v1/diary/days` answers, in calendar days. Thirty-one is a month: the
 * picker's grid and the week strip ask for the days they draw and no more, and a cap is what
 * keeps a dense per-day answer from becoming the whole diary in one response.
 */
export const DIARY_RANGE_MAX_DAYS = 31;

/**
 * What the liveness probe answers.
 *
 * DECLARED HERE BECAUSE A SHELL SCRIPT PARSES IT. `scripts/screenshots.sh` reads `demo` to decide
 * whether it may take the App Store frames that reach the analyzer: the canned one writes "Demo
 * analyzer — these numbers are canned" into the meal card, and that sentence then lives in a
 * picture no test can read (#66). For a fortnight the only statement of this shape anywhere was a
 * `case` in that script.
 *
 * `demo` is read off the LLM ports rather than off config — see the note at the route.
 */
export interface LivenessResponse {
  ok: true;
  demo: boolean;
}

export const ROUTES = {
  /** Liveness, unauthenticated. Answers {@link LivenessResponse}. */
  health: "/health",
  authDevice: "/v1/auth/device",
  authApple: "/v1/auth/apple",
  authGoogle: "/v1/auth/google",
  /**
   * POST — send a six-digit sign-in code to `email` (#569). Answers 204 whether or not the
   * address has an account, so the route cannot enumerate one; a malformed address is a 400 and
   * a spent send allowance a 429.
   */
  authEmailCode: "/v1/auth/email/code",
  /**
   * POST — trade `email` + the six-digit `code` for {@link AuthProviderResponse}, the same shape
   * Apple and Google return. `code-wrong` is 401, `code-dead` 410, the sign-in allowance 429.
   * Optionally authenticated, like the other two providers: a bearer links the identity to the
   * caller's account.
   */
  authEmailVerify: "/v1/auth/email/verify",
  /** Drops the caller's own token. Sign-out, not account deletion. */
  authSignOut: "/v1/auth/signout",
  /**
   * POST, under a bearer — drops EVERY token of the caller's account (#247).
   *
   * The mitigation for the one risk pairing codes introduce: an intercepted code buys a full
   * session until it idles out, and until this there was no way to end it. Same answer for a lost
   * phone, and for a browser paired on a machine somebody no longer has.
   *
   * It signs the CALLING device out too, which is correct and has to be said on the button: there
   * is no way to end every other session without ending this one, because nothing about a token
   * says which device is holding it.
   */
  authSignOutEverywhere: "/v1/auth/signout/all",
  /**
   * POST, under a bearer — mints a short-lived code that hands a BROWSER a session on the caller's
   * own account. Answers {@link PairCodeResponse}.
   *
   * The account it names is the caller's, resolved from the token like every other route here; the
   * body is not read at all. Redemption is `POST /start/pair`, which mints the ordinary session
   * token the OAuth callback mints, so nothing downstream learns a new auth path.
   */
  authPair: "/v1/auth/pair",
  /** The identities linked to this account, so settings can show what is connected. */
  identities: "/v1/auth/identities",
  /**
   * DELETE, under the bearer — unlink one provider from the caller's own account (#246).
   *
   * The provider is in the PATH and the subject is never in the request: the server resolves it
   * from the caller's own identities, so a body naming somebody else's link names nothing.
   *
   * REMOVING THE LAST WAY IN ERASES THE ACCOUNT, atomically, and the answer says which happened —
   * see {@link UnlinkResponse}. `device` is refused: it is the anonymous credential the install
   * was born with rather than something a person linked, and dropping it would let a signed-out
   * session be locked out of an account that still exists.
   */
  identity: (provider: Provider) => `/v1/auth/identities/${encodeURIComponent(provider)}`,
  profile: "/v1/profile",
  /** GET — the onboarding copy this server is currently serving. Editable in the admin. */
  onboarding: "/v1/onboarding",
  /** POST — a batch of onboarding funnel events. Fire-and-forget from the app's point of view. */
  onboardingEvents: "/v1/onboarding/events",
  /**
   * POST, multipart: `photo` (one to `maxPhotosPerMeal` angles of one meal), `caption`, and the two
   * fields every billed turn carries — `clientId` and `capturedAt`, as {@link MessageRequest} says.
   */
  photo: "/v1/meals/photo",
  /**
   * POST, multipart like `photo`, `clientId` REQUIRED (the `idempotency-key` header or the field):
   * it is the job's id. Answers 202 {@link PhotoQueuedResponse} once the upload is in; the analysis
   * runs to the end server-side whether or not the client stays (ieat-app#1318).
   */
  photoQueue: "/v1/meals/photo/queue",
  /**
   * GET — the job as a {@link PhotoJob}; with `accept: NDJSON` one snapshot per change, the settled
   * one last. DELETE — remove it: a running job's meal is dropped when it lands, a logged one's now.
   */
  photoJob: (id: string) => `/v1/meals/photo/queue/${encodeURIComponent(id)}`,
  /**
   * GET `?state=active|settled|all&since=<ISO 8601>&cursor=<opaque>` (default `active`) — every job
   * of the caller as a {@link JobsResponse}, each entry the same snapshot {@link ROUTES.photoJob}
   * gives for it. Polling is the design: `since` returns what changed after it (ieat-app#1400).
   */
  jobs: "/v1/jobs",
  /**
   * POST, JSON {@link MealUpdateRequest} with `clientId` REQUIRED (the `idempotency-key` header or
   * the field): the job's id, followed and removed on {@link ROUTES.photoJob} like a photo's.
   * Answers 202 {@link PhotoQueuedResponse}; the change runs on server-side (ieat-app#1347).
   */
  mealUpdateQueue: "/v1/meals/update/queue",
  /**
   * POST, multipart: `photo` (one to `maxPhotosPerMeal` angles). The iOS App Clip's estimate: an
   * ANONYMOUS device account only (403 `anonymous-only` otherwise), charged to its sample, nothing
   * stored but the charge. Answers {@link ClipEstimateResponse}.
   */
  clipEstimate: "/v1/clip/estimate",
  /**
   * POST — one turn; with `accept: NDJSON` it STREAMS (#508): a blank keepalive line while the model
   * is silent, {@link PhotoProgress} lines while the analysis behind the router produces items
   * (#70), then the {@link MessageResponse} as the last line, refusals and `target-gone` included.
   * GET `?before=<seq>&limit=N` — the thread, newest page first.
   */
  messages: "/v1/messages",
  /** POST — the user's own words and Spud's SCRIPTED lines by id. See `AppendLinesRequest`. */
  messagesLines: "/v1/messages/lines",
  /**
   * DELETE — the caller's own line, by id (#608). A photo line is its meal: the meal, its photos
   * and every card for it go with the line; a text line goes alone. PATCH — multipart like
   * `ROUTES.photo` (`text`, zero or more `photo` angles to ADD), streams `PhotoProgress` lines,
   * then `EditLineLast`: the analyzer re-reads every photo with the new text as the caption, the
   * meal and the line's text change IN PLACE, and no thread line is written. Photo lines only; a
   * text line is `bad-request`.
   */
  message: (id: string) => `/v1/messages/${encodeURIComponent(id)}`,
  /**
   * POST — register this device's Expo push token. DELETE — drop it. See `PushTokenRequest`.
   *
   * The token is how the 20:30 line reaches a phone at all, and it is the only thing about a
   * device this server keeps. Erased with the account, like everything else that names one.
   */
  pushToken: "/v1/push/token",
  /**
   * POST — this device opened a push. See `PushOpenRequest`. Recorded once per (account, send);
   * an id that is not this account's is a no-op that answers the same.
   */
  pushOpen: "/v1/push/open",
  /** POST — the notification extension reports a push arrived. See `PushDeliveredRequest`. */
  pushDelivered: "/v1/push/delivered",
  /**
   * GET — the tips-and-offers consent (`PushConsentResponse`); POST — set it (`PushConsentRequest`).
   * Offers default OFF; `notifications` (default ON) silences every push for the account.
   */
  pushConsent: "/v1/push/consent",
  /**
   * PATCH — the manual edit path. See `EditMealRequest`.
   *
   * DELETE — the meal itself (#61): the meal, its photos and every card for it, and the user line
   * that carried it — the photo line, or the typed line whose confirmed proposal became it. The
   * same semantics as `DELETE` on `ROUTES.message` for the caller who holds a meal id and no line
   * id, and the same answer: {@link DeleteLineResponse}. Scoped like everything here — another
   * account's id is `target-gone` (409), never a 404 and never a row.
   */
  meal: (id: string) => `/v1/meals/${encodeURIComponent(id)}`,
  /** One stored photo of one of the caller's meals, by position. Bytes with their mime; 404 otherwise. */
  mealPhoto: (id: string, n: number) => `/v1/meals/${encodeURIComponent(id)}/photos/${n}`,
  /**
   * POST — another angle of a meal already logged (#304). Multipart, `photo` fields, like
   * `ROUTES.photo`. STORED, NOT ANALYZED, and therefore not charged and behind no cap: the meal's
   * numbers do not move. Making them move is `mealReanalyze`, which is charged and is the user's
   * own deliberate tap. Same path as `mealPhoto` one segment shorter — that reads a photo by
   * position, this adds to the collection.
   */
  mealPhotos: (id: string) => `/v1/meals/${encodeURIComponent(id)}/photos`,
  /** Run the analyzer again over the stored photos. Charged like a photo. */
  mealReanalyze: (id: string) => `/v1/meals/${encodeURIComponent(id)}/reanalyze`,
  /**
   * POST — move the meal back `dayOffset` days ({@link RedateMealRequest}), the menu's "Move to
   * yesterday" as `1`. The same re-date the chat path runs — one engine function, unbilled,
   * bounded by the chat re-date's own `MAX_DAY_OFFSET` — and the same answer: `MealRedated | TargetGone`.
   */
  mealRedate: (id: string) => `/v1/meals/${encodeURIComponent(id)}/redate`,
  pendingConfirm: (id: string) => `/v1/meals/pending/${encodeURIComponent(id)}/confirm`,
  pendingCancel: (id: string) => `/v1/meals/pending/${encodeURIComponent(id)}/cancel`,
  /** GET — the caller's live proposals, oldest first (#530): a page that lost its card reads them back. */
  pending: "/v1/meals/pending",
  day: "/v1/diary/day",
  /**
   * DEPRECATED (#103), still served. The App Store binary in the field calls it for the picker's
   * marks and the health screen's intake series, and that binary outlives this deploy. New work
   * asks {@link ROUTES.days}, which answers a `from`/`to` range with a streak attached.
   */
  week: "/v1/diary/week",
  /**
   * GET `?from=YYYY-MM-DD&to=YYYY-MM-DD` — every calendar day of the range, at most
   * {@link DIARY_RANGE_MAX_DAYS} of them, plus the logged-day streak. Future days inside the
   * span come back as empty rows, because the week strip draws the days after today too.
   * Answers {@link DaysResponse}.
   */
  days: "/v1/diary/days",
  /**
   * GET `?range=` — one of `WEIGHT_RANGES`; absent or `90D` defaults to it. The range's start
   * date is computed server-side, in the account's timezone: no client does that arithmetic.
   * Answers {@link WeightsResponse}.
   */
  weights: "/v1/weights",
  account: "/v1/account",

  // Note the distinction from `health` above, which is the LIVENESS probe the deploy watches.
  // These two are the user's health metrics, and they are authenticated and versioned.
  /** GET `?days=N` — the health trend this account has stored. Daily aggregates, never samples. */
  healthTrend: "/v1/health",
  /** POST — a batch of daily health aggregates read off the phone's health store. Upserted. */
  healthDays: "/v1/health/days",

  /**
   * GET `?q=` — the generic-food catalog (`food_ref`), matched by name in any language the source
   * carries. `limit` is bounded server-side at {@link FOOD_SEARCH_MAX_LIMIT}; the answer carries
   * the citations the sources of the returned rows owe.
   * Answers {@link FoodSearchResponse}.
   */
  foods: "/v1/foods",
  /**
   * GET — the barcoded product the catalog knows (`off_product`), or `product: null` on a miss.
   * A miss is an ordinary answer, not an error: the scan flow's next step is reading the label.
   * Answers {@link ProductResponse}.
   */
  product: (barcode: string) => `/v1/products/${encodeURIComponent(barcode)}`,

  /**
   * The browser onboarding, and the ONE route here that is not part of the JSON API.
   *
   * It is a page, not an endpoint: server-rendered HTML with no JavaScript, and the app never
   * fetches it. It is in this table because it is the string the phone PRINTS — "open
   * <host>/start and type a pairing code" — and because `POST /start/pair` above is where
   * `authPair`'s code is redeemed. One spelling of the path, imported by the module that serves
   * it and by the one that composes {@link ProfileResponse.pairAddress}, rather than a literal in
   * each (#408).
   */
  webStart: "/start",
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
 * trades it for a bearer token. Nothing is asked of the user on this path — no address, no
 * password, no card (signing in DOES take an address; this is the path that does not) — which is
 * not laziness: the largest
 * complaint cluster against the incumbent, by a factor of four, is the card-first trial (238
 * reviews). Nothing to cancel is a product property, and it starts here.
 */
export interface AuthDeviceRequest {
  /** Opaque, client-generated, ≥32 chars. The server never derives meaning from it. */
  deviceId: string;
  /** BCP-47-ish; the server narrows it to a supported `Lang` and falls back to `en`. */
  locale?: string;
}
/** The App Clip's answer: what is on the plate, and nothing that needs a profile to judge. */
export interface ClipEstimateResponse {
  items: MealItem[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  confidence: string;
}

export interface AuthDeviceResponse {
  token: string;
  userId: string;
  /** True the first time this device id was seen — the app routes to onboarding on true. */
  created: boolean;
}

/**
 * Where an identity came from. `device` is the anonymous one every install starts with.
 *
 * `telegram` is a numeric Telegram user id, as a string, attached by spending a pairing code in the
 * bot (`linkTelegram`). It is a second transport onto an account made elsewhere, never a sign-in.
 *
 * `email` is the address itself, trimmed and lowercased, proven by a six-digit code sent to it
 * (#569). It is NEVER joined to an `identities.email` elsewhere: an address that also sits on an
 * Apple or Google identity is a separate account — Apple private relay makes the match unreliable,
 * and a merge would hand that account to whoever controls the inbox.
 */
export const PROVIDERS = ["device", "apple", "google", "telegram", "email"] as const;
export type Provider = (typeof PROVIDERS)[number];

/**
 * Does this provider put somebody INTO an account?
 *
 * `device`, `apple`, `google` and `email` each mint a session: the anonymous credential the install
 * was born with, and the three verified ones. `telegram` does not and must never — it is a
 * transport onto an account made elsewhere (#205), and the bot issues no token.
 *
 * ONE PREDICATE, HERE, because two rules older than `telegram` decide things by counting identity
 * rows: an account dies when its last way in is removed (`Store.removeIdentity`), and an account is
 * anonymous until a real one is linked (`isAnonymous`). Counted provider-blind, a telegram row made
 * both wrong at once — it kept alive an account nobody could ever sign into again, and it stopped
 * the first sign-in from merging. Anything that reads `identities` to decide who can reach an
 * account asks this.
 */
export const signsIn = (provider: string): boolean =>
  provider === "device" || provider === "apple" || provider === "google" || provider === "email";

/**
 * A provider's brand name, for the rows that say who somebody signed in with. Brand names are not
 * translated — "Apple" is "Apple" in all eight languages — so this is a record, not a `Localized`
 * table. One copy for every surface: the web You screen and the phone's account board were each
 * carrying their own.
 */
export const PROVIDER_NAME: Record<string, string> = { apple: "Apple", google: "Google", email: "Email" };

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
  /**
   * BCP-47-ish, narrowed server-side to a supported `Lang`, falling back to `en`.
   *
   * Read ONLY when this sign-in creates the account — a client on a fresh install that signs in
   * before it mints a device session. Every other outcome leaves `users.lang` exactly as it is,
   * because by then it is the user's own setting rather than a guess about their phone.
   */
  locale?: string;
  /**
   * The consent the sign-up screen collects (Kirill's decision, S8). `terms` is the required
   * box — the server refuses the call when it is absent or not `true` — and `marketing` is the
   * optional one. They land on the account as `terms_accepted_at` / `marketing_consent_at`
   * (a timestamp; null means never given). EU consent needs the date, which is why a boolean
   * is not what is stored.
   */
  terms: boolean;
  marketing?: boolean;
}

/**
 * Ask for a six-digit sign-in code by email (#569). The answer is 204 either way — an account
 * exists or not, the mail went out or the send was refused by one of the send caps — so the route
 * tells nobody which addresses are accounts. A malformed address is the only 400.
 *
 * `locale` is the language the mail is written in, narrowed server-side like everywhere else.
 */
export interface AuthEmailCodeRequest {
  email: string;
  locale?: string;
}

/**
 * The code half of email sign-in. `terms` is the required consent box, exactly as on
 * {@link AuthProviderRequest} — the server refuses without it. `locale` is read only when this
 * sign-in creates the account, the same rule as the OAuth providers'.
 */
export interface AuthEmailVerifyRequest {
  /** The address the code was sent to — the identity's subject, trimmed and lowercased. */
  email: string;
  /** The six digits the mail carried. */
  code: string;
  locale?: string;
  terms: boolean;
  marketing?: boolean;
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

/**
 * What an unlink did.
 *
 * `deleted` is the whole reason this is not a bare 204. `Store.removeIdentity` erases the account
 * when the identity it removed was the last one — the check and the delete are one statement, so
 * nothing can interleave — and the app has to know whether the session it is holding still names
 * anything. The remaining identities come back too, so settings re-renders from the server's answer
 * rather than from what it assumed happened.
 */
export interface UnlinkResponse {
  identities: { provider: Provider; linkedAt: string }[];
  deleted: boolean;
}

/**
 * A pairing code, and when it stops working.
 *
 * `expiresAt` IS SENT rather than compiled into both sides. The TTL is a limit the server enforces
 * — a redemption after it is refused there — and a client that carried its own copy of the number
 * would eventually disagree with the one doing the refusing, which the user meets as a code that
 * looks live and is not.
 */
/**
 * What `POST /v1/meals/:id/photos` answers: the meal, and how many photos it now holds.
 *
 * `photos` is the COUNT the server ended up with, not the number sent — the app renders the strip
 * from it (`PhotoStrip`), and a client that added its own upload to its own stale count would draw
 * a frame for a photo that is not there.
 */
export interface AttachPhotosResponse {
  mealId: string;
  photos: number;
}

export interface PairCodeResponse {
  /** Eight Crockford base32 symbols. Shown to a person, typed by a person; case is not significant. */
  code: string;
  /** ISO 8601. */
  expiresAt: string;
}

// ── Profile ──────────────────────────────────────────────────────────────────────────────────

/**
 * The donation links a host may offer (#200) — the You surface's "Support eait" row.
 *
 * SENT, NEVER COMPILED, for the reason `limits` is: the same bundle serves self-hosted
 * instances that take no donations, so the operator's `EAIT__BACKEND__DONATE_*_URL` variables
 * are the only source. Each is null while its variable is unset; ALL THREE null is the off
 * state and a client draws no row.
 */
export interface DonateLinks {
  github: string | null;
  kofi: string | null;
  buyMeACoffee: string | null;
}

/** Profile plus everything derived from it, so the app never recomputes targets locally. */
export interface ProfileResponse {
  profile: Profile;
  targets: FoodTargets;
  /** Why the targets are what they are. `basis.floorApplied` MUST be surfaced to the user. */
  basis: TargetBasis;
  /**
   * The account's age in whole years, computed HERE from `birth_year` in this server's
   * timezone — `ageFrom`, the same arithmetic the target model consumes.
   *
   * SENT, NEVER COMPUTED BY THE CLIENT: `birth_year` is a year, not a birthday, so "current
   * year minus it" is already an approximation — having the server answer it keeps every
   * surface on the same approximation instead of each client subtracting in its own zone
   * and disagreeing by one around the new year (#97 review). `null` when the profile holds
   * no usable birth year; a client prints nothing then, not a guess.
   */
  age: number | null;
  /** Null until onboarding completes. */
  onboarded: boolean;
  /**
   * Whether this account holds the admin role (#391b).
   *
   * A BOOLEAN, and deliberately not the role itself: what a client needs is "may I offer the admin
   * section", and a role string invites a client to reason about roles it was never told the rules
   * for. It is also why `role` is not on `Profile` — a field there would be writable by `PATCH` in
   * one store implementation and refused in the other.
   *
   * ADVISORY, NEVER AN AUTHORITY. This decides whether a link is drawn. Every path under `/admin`
   * checks the role again, server-side, on every request; a client that set this to true itself
   * would gain a menu entry and nothing behind it.
   */
  isAdmin: boolean;
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
  /**
   * Where to send a browser to pair with this account — host and path, no scheme (#408).
   *
   * SENT, NEVER COMPOSED BY THE CLIENT, for the reason {@link API_VERSION} states: shipped apps
   * outlive the server they were built against. Every build before this field derived the address
   * from its own compiled-in `API_URL` and printed `api.eait.fit/start`; that name becomes a 301
   * to the browser's own host and eventually stops serving the page, and a binary already on a
   * phone cannot be told. Reading it off the profile means the next move of this surface needs no
   * new build — which is the whole point, and is why the path is here too and not just the host.
   *
   * NO SCHEME, because it is read off a phone screen and typed into an address bar by hand.
   *
   * EMPTY when the server has been told neither origin, which is development. The client then
   * keeps its own answer: the host it is already talking to is the right one there, and a guess
   * invented server-side would be wrong on every worktree at once.
   */
  pairAddress: string;
  /**
   * The username of this server's Telegram bot, for a Connect Telegram link, or null.
   *
   * NULL WHILE THE CONNECTOR IS OFF — no token, `--demo`, a dead token, or Telegram not reached yet —
   * and a client draws no link then. The link is `https://t.me/<this>?start=<code>`, with a code from
   * {@link ROUTES.authPair} minted at the moment of the tap: a code shown in advance would die on the
   * screen in five minutes.
   */
  telegramBot: string | null;
  /**
   * Whether health sync is actually arriving: any `HealthDay` row stored in the last seven days,
   * computed here so the You surface's "connected" is a fact and not a flag a client can set
   * (#97). The phone backfills weight history on connect, so a fresh sync counts from day one.
   */
  healthConnected: boolean;
  /**
   * The web paywall, computed from this server's `EAIT__BACKEND__WEB_*` block (#77).
   *
   * SENT, NEVER COMPILED, for the same reason `limits` is: the web app can be self-hosted, so the
   * plans, prices and exit offer are the operator's variables, and this is how the bundle learns
   * them — already formatted in the account's language and with `{userId}` already filled into
   * every checkout link from this account's own id, because the RevenueCat webhook grants the
   * purchase to `app_user_id` and nothing else.
   *
   * Plans and `exitOffer` are null where the operator configured no checkout. ALL NULL means the
   * host sells nothing: no paywall surface at all, whatever `entitlement` and `limits` say about
   * this account. A server that predates this field sends no `paywall` — a client reads that as
   * absent too, exactly as it does `entitlement`.
   */
  paywall: WebPaywall;
  /**
   * The coach's name in the account's language — `THREAD_COPY`'s `coach.name` — sent here because
   * the browser bundle cannot import the Lingui table that copy lives in (#92 review): Lingui words
   * reach a client only server-sent. Surfaces fill their `{coach}` placeholders with it. A server
   * that predates the field sends none, and a client falls back to the copy's own name.
   */
  coachName: string;
  /**
   * Whether this account has ever logged a meal — any date, not just inside the diary window
   * (#92 review). The first-meal surfaces (Home's free-meal flow, the log's first verdict) read
   * it as the ONE "nothing logged yet" answer, so two clients can never disagree about which
   * meal was first, and neither repeats the `/v1/diary/week` probe it replaced. The other
   * conditions of that gate — `onboarded`, `entitlement`, `limits.sampleUsed` — are already on
   * this response.
   */
  hasLoggedMeal: boolean;
  /** {@link DonateLinks} — the operator's donation URLs, every one null when none are set. */
  donate: DonateLinks;
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
  /** The cm|ft,in / kg|lb toggle. Stored metric regardless; this is the display preference. */
  units?: Units | null;
  /**
   * The "what's been hard" picks — stored, so `null` = not asked and `[]` = asked, nothing
   * picked. Resume reads that difference; a client sending `null` clears it back to unasked.
   */
  struggles?: Struggle[] | null;
  /** The streak length aimed for; `null` clears it back to unasked. */
  streak_goal_days?: StreakGoal | null;
  country?: string | null;
  restrictions?: string[];
  /**
   * WRITE-ONLY views of `restrictions` (onboarding v2). `diet` names the diet the user follows —
   * `balanced` stores no tag — and `medical` names the declared caps, `[]` meaning none. The
   * server merges each over the matching subset of `restrictions` and leaves every other entry
   * alone, so a client never composes the array. Sending `restrictions` TOGETHER with either of
   * these is refused as ambiguous: two spellings of the same column.
   */
  diet?: Diet | null;
  medical?: MedicalTag[] | null;
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
  /**
   * Which language this revision is in (#358).
   *
   * SENT rather than assumed, and it is the same rule `Limits` follows: the client asked with
   * `?lang=` or let the account answer, and only the server knows which it used. A client that
   * assumed its own guess came back would cache German copy under `it` the first time a code it
   * sent was one this server does not carry.
   */
  lang: Lang;
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
  /** `speaker`: who said it. Null is Spud — onboarding's asks and scripted beats; `gabie` is an engine line, and the app draws her face on it (S9). */
  | { id: string; seq: number; ts: string; role: "assistant"; kind: "text"; text: string; speaker: ChatSpeaker | null }
  /** `mealId` outlives the meal: `meal` is null once it is deleted, and "was this proposal logged" reads the id. `speaker`: the engines' card is the coach's; a row from before the column reads null. */
  | { id: string; seq: number; ts: string; role: "assistant"; kind: "meal"; event: ChatEvent; mealId: string | null; meal: MealRecord | null; speaker: ChatSpeaker | null };

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

/**
 * The header a billed turn's `clientId` ALSO travels in (#708), and the spelling the server reads
 * first. A header is there before the body is: the per-address limit runs before a multipart photo
 * is parsed, and a re-sent turn — which calls no model — must not spend or meet that limit. A
 * replay refused there is one its client would ask again under a new id, which is the second meal.
 */
export const IDEMPOTENCY_KEY = "idempotency-key";

/** `POST /v1/messages`. `focusMealId` names the meal — or the live proposal — a correction applies to. */
export interface MessageRequest {
  text: string;
  /**
   * The client's id for this turn, and THE TURN'S IDEMPOTENCY KEY (#708). A request carrying an id
   * this account has already sent is answered with what that turn answered — or waits for it while
   * it runs — and is never run again: no model call, no charge, no second meal. That is what lets a
   * client re-send a turn whose answer was lost. It follows that asking again ON PURPOSE (after a
   * refusal, after a failed analysis) takes a NEW id. Stored on the user line and returned in
   * `ChatEntry`. Also sent, as a form field, with a photo, and in {@link IDEMPOTENCY_KEY}, which wins.
   */
  clientId?: string;
  /**
   * When the turn happened, ISO 8601 — the photo taken, the words typed. A turn queued offline and
   * sent later is dated by it: the meal lands on the day it was eaten, and "yesterday" is read
   * against the day it was said. The caps and the charge are still the day it ARRIVES. Unreadable,
   * in the future or older than the diary reaches: now. Also sent, as a form field, with a photo.
   */
  capturedAt?: string;
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
// `ref` and `food` are in the list because clients echo the items back: a meal card sends the
// server-emitted provenance untouched. The server discards a request's `food` on every write and
// re-derives both from the stored meal (#562), so a sent one only has to be small and shaped.
const ITEM_KEYS: ReadonlySet<string> = new Set(["name", "grams", "name_en", "role", "ref", "food", ...ITEM_NUMBERS]);
const PER100_KEYS = ["kcal", "protein_g", "carbs_g", "fat_g"] as const;
// Exported because the server writes `food` too: `foodSnapshot` (engine/ground.ts) clamps to these
// same bounds, so a row the catalog ever ships can never make a meal uneditable (#562).
export const MAX_SNAPSHOT_NAME = 200;
export const MAX_SNAPSHOT_ATTRIBUTIONS = 8;
export const MAX_SNAPSHOT_ATTRIBUTION = 500;
/** The shape a client echoes, not the truth: `editMeal` replaces this with the stored row's. */
const isFoodSnapshot = (v: unknown): boolean => {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  const p = f.per100;
  return typeof f.name === "string" && f.name.length <= MAX_SNAPSHOT_NAME
    && typeof f.source === "string" && f.source.length <= MAX_SNAPSHOT_NAME
    && typeof p === "object" && p !== null
    && PER100_KEYS.every((k) => amount((p as Record<string, unknown>)[k]))
    && SNAPSHOT_MICROS.every((k) => (p as Record<string, unknown>)[k] === undefined || amount((p as Record<string, unknown>)[k]))
    && Array.isArray(f.attribution) && f.attribution.length <= MAX_SNAPSHOT_ATTRIBUTIONS
    && f.attribution.every((a) => typeof a === "string" && a.length <= MAX_SNAPSHOT_ATTRIBUTION);
};
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
    // Every item at 0g is no meal: it saved a 0kcal meal that still counted (ieat-app#1224).
    if (b.items.length > 0 && b.items.every((i) => (i as { grams?: unknown })?.grams === 0)) return false;
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
      // Echoed provenance, bounded like every other client string; the server re-derives both.
      if (item.ref !== undefined && (typeof item.ref !== "string" || item.ref.length > MAX_ITEM_NAME)) return false;
      if (item.food !== undefined && !isFoodSnapshot(item.food)) return false;
      for (const k of ITEM_NUMBERS) if (item[k] !== undefined && !amount(item[k])) return false;
    }
  }
  return true;
}

export type EditMealResponse = MealUpdated | TargetGone;

/**
 * `POST /v1/meals/:id/redate` — "Move to yesterday", as an offset: `1` is yesterday, `0` a no-op,
 * and the bound is the chat re-date's own (`MAX_DAY_OFFSET`), clamped in the engine rather
 * than refused — a hand-edited client that sends 40 gets the same answer the model's misparse gets.
 *
 * A date changes ONLY this way: `EditMealRequest` has no date field, so the manual editor cannot
 * reach it — the offset is resolved against the account's today on the server, never sent as a
 * `YYYY-MM-DD` a client could aim anywhere on the calendar.
 */
export interface RedateMealRequest {
  dayOffset: number;
}

export function isRedateMealRequest(body: unknown): body is RedateMealRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
  const b = body as Record<string, unknown>;
  return typeof b.dayOffset === "number" && Number.isFinite(b.dayOffset);
}

export type RedateMealResponse = MealRedated | TargetGone;

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
 * be a different route. `web` carries a Web Push subscription (`webPushSubscription`) as the token.
 */
export interface PushTokenRequest {
  token: string;
  platform: "ios" | "web";
  /**
   * The IANA zone the phone dates its days in (`Intl.DateTimeFormat().resolvedOptions().timeZone`),
   * sent on every launch. Optional on the wire and ignored when it is not a zone this server knows,
   * so an older build, or a runtime that reports nothing, still registers. The 20:30 line and the
   * one-a-day slot use it; absent, they use the instance zone.
   */
  timezone?: string;
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

/** A bound on a stored Web Push subscription (endpoint plus both keys, canonical JSON). */
export const MAX_WEB_PUSH_TOKEN = 1000;

/**
 * The push services a browser subscription may name. The server POSTs to the endpoint, so this
 * list is the SSRF guard: anything else is refused before it is stored, never fetched.
 */
const WEB_PUSH_HOSTS = ["fcm.googleapis.com", "web.push.apple.com", "push.services.mozilla.com"];
const WEB_PUSH_HOST_SUFFIXES = [".push.services.mozilla.com", ".notify.windows.com"];

const BASE64URL = /^[A-Za-z0-9_-]+={0,2}$/;

/**
 * The ONE parser for a Web Push subscription: a JSON string or object `{ endpoint, keys: { p256dh, auth } }`.
 * Returns the CANONICAL string (fixed key order, extras such as `expirationTime` dropped) or null.
 * The canonical string is what is stored and what a push is addressed to, so the same
 * subscription always maps to the same row.
 */
export function webPushSubscription(v: unknown): string | null {
  let o: unknown = v;
  if (typeof v === "string") {
    if (v.length > MAX_WEB_PUSH_TOKEN * 2) return null;
    try { o = JSON.parse(v); } catch { return null; }
  }
  if (typeof o !== "object" || o === null) return null;
  const { endpoint, keys } = o as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } | null };
  if (typeof endpoint !== "string" || typeof keys !== "object" || keys === null) return null;
  const { p256dh, auth } = keys;
  if (typeof p256dh !== "string" || typeof auth !== "string") return null;
  if (!BASE64URL.test(p256dh) || p256dh.length < 80 || p256dh.length > 100) return null;
  if (!BASE64URL.test(auth) || auth.length < 16 || auth.length > 32) return null;
  let u: URL;
  try { u = new URL(endpoint); } catch { return null; }
  if (u.protocol !== "https:" || u.username !== "" || u.password !== "" || u.port !== "") return null;
  const host = u.hostname;
  if (!WEB_PUSH_HOSTS.includes(host) && !WEB_PUSH_HOST_SUFFIXES.some((s) => host.endsWith(s))) return null;
  const canonical = JSON.stringify({ endpoint: u.href, keys: { p256dh, auth } });
  return canonical.length <= MAX_WEB_PUSH_TOKEN ? canonical : null;
}

/** The token to store or drop for a push token field: the Expo token as sent, or the canonical web subscription. */
export function pushTokenFrom(platform: unknown, token: unknown): string | null {
  if (platform === "ios") return isPushToken(token) ? token : null;
  return platform === "web" ? webPushSubscription(token) : null;
}

export function isPushTokenRequest(body: unknown): body is PushTokenRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return pushTokenFrom(b.platform, b.token) !== null;
}

/**
 * The phone reporting that a push it received was opened (#1759). `sendId` is the `send_log` id the
 * push `data` carried; `action` is how: the tap that opens the app, or the reply typed under the
 * 20:30 line. Absent means a tap.
 *
 * A SHAPE check only. Whether the id is this account's is decided against `send_log` on the server,
 * and the answer is the same either way, so a caller cannot probe for other accounts' ids.
 */
export const PUSH_OPEN_ACTIONS = ["tap", "reply"] as const;
export type PushOpenAction = (typeof PUSH_OPEN_ACTIONS)[number];

export interface PushOpenRequest {
  sendId: string;
  action?: PushOpenAction;
}

/** A bound on a value the phone echoes back. The ids are uuids; this is slack, not a format. */
export const MAX_PUSH_SEND_ID = 100;

export function isPushOpenRequest(body: unknown): body is PushOpenRequest {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return typeof b.sendId === "string" && b.sendId.length > 0 && b.sendId.length <= MAX_PUSH_SEND_ID
    && (b.action === undefined || (PUSH_OPEN_ACTIONS as readonly unknown[]).includes(b.action));
}

/**
 * The screens a push tap may open (eait#531), carried as `data.route`. A closed list, never a path or
 * a URL: the sender can only name one of these and the app's open listener navigates only to a known
 * one, so a push cannot steer the app anywhere else.
 */
export const PUSH_ROUTES = ["home", "chat", "progress", "camera", "settings", "profile", "subscription"] as const;
export type PushRoute = (typeof PUSH_ROUTES)[number];
export const isPushRoute = (v: unknown): v is PushRoute => (PUSH_ROUTES as readonly unknown[]).includes(v);

/** Most accounts one admin send may name. */
export const ADMIN_PUSH_MAX_RECIPIENTS = 50;

/** The open to report for a notification response, or null when the push carried no `sendId`. */
export function pushOpenFrom(data: unknown, reply: boolean): PushOpenRequest | null {
  const sendId = (data as { sendId?: unknown } | null | undefined)?.sendId;
  const body = { sendId, action: reply ? "reply" : "tap" };
  return isPushOpenRequest(body) ? body : null;
}

/**
 * The notification service extension reporting that a push reached the device (ieat-app#1763).
 * It carries no `action` and claims nothing: a beacon is not a message. `sendId` is the same
 * `send_log` id an open carries.
 */
export interface PushDeliveredRequest {
  sendId: string;
}

export function isPushDeliveredRequest(body: unknown): body is PushDeliveredRequest {
  if (typeof body !== "object" || body === null) return false;
  const id = (body as Record<string, unknown>).sendId;
  return typeof id === "string" && id.length > 0 && id.length <= MAX_PUSH_SEND_ID;
}

/** Always `{ ok: true }`: recorded, deduplicated and not-yours are indistinguishable on purpose. */
export interface PushOpenResponse {
  ok: true;
}

/** Same answer as an open, for the same reason. */
export type PushDeliveredResponse = PushOpenResponse;

export interface PushConsentRequest {
  offers?: boolean;
  /** The account-wide switch: false = no push of any kind. Default true. */
  notifications?: boolean;
}

/** `at` is when offers were turned on, or null while they are off. `notifications` is the account-wide switch. */
export interface PushConsentResponse {
  offers: boolean;
  at: string | null;
  notifications: boolean;
  /** The VAPID public key a browser subscribes with, or null when this server does not send Web Push. */
  webPushKey: string | null;
}

export function isPushConsentRequest(body: unknown): body is PushConsentRequest {
  if (typeof body !== "object" || body === null) return false;
  const { offers, notifications } = body as Record<string, unknown>;
  if (offers !== undefined && typeof offers !== "boolean") return false;
  if (notifications !== undefined && typeof notifications !== "boolean") return false;
  return offers !== undefined || notifications !== undefined;
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
 * Bounded so one request cannot carry a decade. A rolling sync sends days; the first FULL sync of
 * a process sends `HEALTH_RETENTION_DAYS` of them and goes through `healthDayBatches` to fit.
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
 * Whether a sync that read from `oldest` had every day of that window stored. EVERY day, not any:
 * the midnight race drops one. A day before `oldest` is not counted — a sample overlapping the
 * window's first midnight dates there.
 *
 * AT LEAST the window, not exactly it (#558). A server whose clock has not yet passed the phone's
 * midnight keeps a day from before the phone's window if one is sent, and `accepted` then comes back
 * one higher. That server is BEHIND the phone, so it refused no day of the window for its age, and
 * reading the extra day as "not landed" would cost the user one more five-year read for nothing.
 */
export function healthSyncLanded(days: readonly HealthDay[], oldest: string, accepted: number): boolean {
  return accepted >= days.filter((d) => d.date >= oldest).length;
}

/**
 * The days a sync that read from `oldest` sends: none dated before it. A sample overlapping the
 * window's first midnight dates there by its start, carrying that sample alone, and the store
 * replaces a whole row, so sending it would wipe the day already stored.
 */
export function healthDaysFrom(days: readonly HealthDay[], oldest: string): HealthDay[] {
  return days.filter((d) => d.date >= oldest);
}

/**
 * The window the app re-reads on every sync. See `HealthDaysRequest` for why it looks backwards.
 *
 * The first FULL sync of a process (the Health screen's, never the launch sync's `rollingOnly`)
 * reads `HEALTH_RETENTION_DAYS` instead — the rolling window is the steady state and is
 * deliberately short, it exists to catch data that arrived late, not to move history. But a user
 * who connects Health today has years of it already, and a year view that fills in one day per
 * launch is a year view nobody will ever see filled.
 */
export const HEALTH_SYNC_LOOKBACK_DAYS = 7;

// ── Diary ────────────────────────────────────────────────────────────────────────────────────

export interface DayResponse {
  date: string;
  meals: MealRecord[];
  totals: DailyTotals;
  targets: FoodTargets;
  /**
   * The day's health score — the kcal-weighted mean of the day's scored meals (`dayHealthScore`,
   * #118), computed here so Home's page 2 and the diary agree. `null` when no meal is scored.
   */
  healthScore: number | null;
}

/** DEPRECATED with {@link ROUTES.week} (#103) — superseded by {@link DaysResponse}. */
export interface WeekResponse {
  days: DayTotals[];
}

/**
 * One calendar day of the range read — `ChartDay` (`ui/charts.ts`), so a row a client receives
 * goes straight into `dayTone`/`dayRing` with nothing re-derived.
 *
 * `when` is computed by the server in the account's timezone at request time: "past" day, the
 * "today" the strip raises, or a "future" day — which is why no client ever compares a row's
 * date with today. Future rows are EMPTY: `logged` false and every figure null, because a day
 * that has not happened is not a zero — nothing has been eaten yet, not nothing measured.
 * A past day with nothing logged is `logged` false with the figures at zero: it happened, and
 * that is a fact about it rather than an unknown.
 */
export interface DiaryDay extends ChartDay {
  /** YYYY-MM-DD in the account's timezone. */
  date: string;
}

/** `GET /v1/diary/days` — the strip, the Progress week, and the streak, in one answer. */
export interface DaysResponse {
  /** Every calendar day in `[from, to]`, oldest first — the order the strips and bars draw. */
  days: DiaryDay[];
  /**
   * The account's calorie target, sent once rather than repeated on every row — a day's macros
   * come from `/v1/diary/day`, this read is the strip's own shape.
   */
  targetKcal: number;
  /**
   * Consecutive calendar days with at least one logged meal, counted backwards from today in the
   * account's timezone. Today stays open: with nothing logged yet it does not break the run, and
   * the streak counts from yesterday instead. A blank day ends it. Server-computed — the rule is
   * a streak a client counted itself is a streak that disagrees with the server's.
   */
  streak: number;
}

/** One logged bodyweight: `health` came off the phone's health store, `manual` the user typed it. */
export interface WeightEntry {
  /** YYYY-MM-DD in the account's timezone. */
  date: string;
  kg: number;
  /**
   * Where the reading came from. On a day both sources hold a value the manual entry wins — the
   * typed correction is the user's own word — so each date appears exactly once.
   */
  source: "health" | "manual";
}

/** `GET /v1/weights` — the merged weigh-in log the Progress chart draws, and its goal arc. */
export interface WeightsResponse {
  /** Oldest first — chart order, `weightChart` reads the endpoints off the ends. */
  weights: WeightEntry[];
  /**
   * The newest weigh-in in the WHOLE log, whatever `range` left of it — Progress's current
   * figure and its none-in-range state ("weights exist, just not in this window") need a dated
   * entry the filtered `weights` can no longer name. `null` when nothing was ever logged.
   */
  latest: WeightEntry | null;
  /**
   * The goal arc the Progress goal bar draws — start, current and target weights, the weeks and
   * rate `projectGoal` computed, and the localized month it lands in. Null when no honest
   * projection exists (no target, nothing weighed, a fallback band) — see {@link PlanProjection}.
   */
  projection: PlanProjection | null;
  /**
   * The latest weigh-in against the profile's height (`bmi`/`bmiRange`, #118) — the range is a
   * NEUTRAL id and its label is the numbers themselves, never a category word. `null` without a
   * height on the profile or a weigh-in to read.
   */
  bmi: { value: number; range: BmiRange } | null;
}

/**
 * The goal's arc for `WeightsResponse.projection` — where the plan started, where the last
 * weigh-in stands, and where it is heading, all computed server-side (`projectGoal`). `null`
 * carries the same honesty as the projection's own nulls: no plan, no current weight, a fallback
 * band, or a delta pointed away from the target each mean there is nothing to draw, and `null`
 * is what those answer rather than an invented figure.
 *
 * `startKg` is the weight the arc begins at — the earliest weigh-in logged on or after
 * onboarding (the row the onboarding `PATCH` writes), never a health backfill from before it;
 * with none that young it is the earliest logged weight at all, and with none at all it is
 * `currentKg`. When the newest weigh-in has drifted back past that start — further from the
 * target than the plan began — `startKg` is `currentKg` instead, so the headline, the "down"
 * figure and "to go" describe the one distance that is left (`ieat-app#1486`).
 * `month` is localized in the account's language; past `beyondHorizon` it is still
 * computed, and the client draws "over two years" instead.
 */
export interface PlanProjection {
  startKg: number;
  currentKg: number;
  targetKg: number;
  weeks: number;
  kgPerWeek: number;
  month: string;
  beyondHorizon: boolean;
}

/** The range vocabulary `GET /v1/weights` takes — re-exported so a validator imports one name. */
export const isWeightRange = (v: string): v is WeightRange =>
  (WEIGHT_RANGES as readonly string[]).includes(v);

/** Every error body the API can produce, other than the refusals above. */
export interface ErrorResponse {
  error: string;
  [k: string]: unknown;
}

// Response aliases, so a handler and a client method can be declared against the same name.
export type PhotoResponse = LogPhotoResult;

/**
 * The streamed shape of `POST /v1/meals/photo` and `POST /v1/messages` when `accept` includes it.
 *
 * BOTH BILLED TURNS STREAM (#508): a model can be silent for tens of seconds, iOS gives up on a
 * request idle for 60 s, and Bun's own idle cut is one version's behaviour rather than a promise
 * (`STREAM_KEEPALIVE_MS` in `api/routes.ts`). The answer is the LAST line; a blank line is a
 * keepalive. Without the header each route is the JSON route it always was, because an app already
 * on a phone never sends it.
 */
export const NDJSON = "application/x-ndjson";
/**
 * The server's budget for ONE model call — `EAIT__BACKEND__LLM_TIMEOUT_MS`'s DEFAULT, which
 * `config.ts` reads and `deploy/docker-compose.prod.yml` falls back to.
 *
 * It is the default and NOT the authority: production sets that variable explicitly, so the budget
 * the running server is actually using can only be known by asking it. That is what
 * `Limits.modelCallTimeoutMs` is for, and why a number compiled into a binary cannot be one.
 */
export const SERVER_LLM_TIMEOUT_MS = 90_000;

/**
 * The least a per-model-call budget can be and still describe a real call.
 *
 * ZERO IS THE ONE THAT GETS THROUGH. `int()` in `config.ts` accepts any non-negative integer, so
 * `EAIT__BACKEND__LLM_TIMEOUT_MS=0` started a server whose every model call aborts instantly — and
 * once that number is SENT to the phone it also makes every client wait the transfer margin alone.
 * Zero is "no limit" for every cap and rate limit in that file and cannot mean it here: it is a
 * budget of nothing. This codebase has paid for the same lesson one variable over —
 * `llmMaxTokensFromEnv` exists because `int()` accepted a bound of zero and `eval-photos.ts`
 * shipped `max_tokens: 0` on every billed call.
 *
 * Ten seconds is below anything real rather than merely above nothing: a photo analysis measured
 * a median 37 s to its first visible token (`docs/ACCURACY.md`, 2026-09-05).
 */
export const MIN_MODEL_CALL_TIMEOUT_MS = 10_000;

/**
 * The round trip the server's own timer does not cover: the upload of a photo on a mobile uplink,
 * the queue, and the stream framing either side of the model calls.
 */
const TRANSFER_MARGIN_MS = 20_000;

/**
 * How many per-call budgets one turn can spend, PER ROUTE.
 *
 * SINCE #153 A MODEL-CALLING FUNCTION BOUNDS ITSELF WITH ONE DEADLINE, not one per call. So these
 * count FUNCTIONS, not HTTP calls: `complete()` shares one deadline with its own schema retry, and
 * `routeText` shares one across the routing call and the focused analysis behind it.
 *
 * `POST /v1/meals/photo` and `POST /v1/meals/:id/reanalyze` are one `analyzePhoto`, so ONE.
 *
 * `POST /v1/messages` is `routeText`, and behind an `answer` intent also `coach` — which has
 * bounded its whole turn with one deadline since it was written. Two functions, two deadlines, so
 * TWO. A `meal`, `correction` or `redate` turn is one of them and could wait less; it is not worth
 * a third constant to say so, because the phone cannot know which intent it is about to get.
 *
 * ONE FACTOR FOR BOTH IS THE WRONG DEPTH IN BOTH DIRECTIONS, which is why there are two. Sized for
 * the photo route it abandons corrections the server is still paying for; sized for the text route
 * it leaves somebody watching "Analyzing…" on a stalled upload, on a screen whose only way out is
 * closing it.
 */
export const PHOTO_MODEL_CALLS = 1;
export const TEXT_MODEL_CALLS = 2;

/**
 * How long a client should wait on one model-bound request.
 *
 * The budgets THAT ROUTE can spend, plus the round trip the server's own timer does not cover.
 *
 * ONE FUNCTION, EVERY CALLER, AND THAT IS THE POINT. `limitsOf` sends the running server's per-call
 * budget and each caller applies its own route's count. The literal this replaced was 140_000 —
 * right for the 60 s server it was written against, short of the real worst case once the server
 * became 90 s, and nothing anywhere went red.
 */
export const clientModelTimeoutMs = (serverLlmTimeoutMs: number, calls: number): number =>
  calls * serverLlmTimeoutMs + TRANSFER_MARGIN_MS;

/**
 * The wait for a client that has no profile yet, and the number anything DRIVING the app reasons
 * from.
 *
 * IT IS HERE RATHER THAN IN THE CLIENT BECAUSE A HARNESS HAS TO KNOW IT TOO, and that is the whole
 * of why it moved. `device-walk.ts` gave up on a photo verdict after 90 s of its own while the app
 * was still streaming, so three times a slow analysis produced "the analysis never came back at
 * all" from a walk standing in front of an app that had refused nothing (#120). A harness may be
 * more patient than the app; it may never be less, and it cannot be either against a number it
 * cannot read.
 *
 * A FALLBACK, NOT THE RULE. The authority is `Limits.modelCallTimeoutMs`, which is the budget the
 * running server actually has; this is what the app uses before its first profile lands and
 * whenever the number on the wire is unusable, exactly as `maxPhotosPerMeal` works. In practice no
 * model-bound route is reachable before a profile has landed — onboarding comes first — so what
 * this number really sizes is the harness, which reads it for the photo route. Hence that count.
 */
export const DEFAULT_MODEL_TIMEOUT_MS = clientModelTimeoutMs(SERVER_LLM_TIMEOUT_MS, PHOTO_MODEL_CALLS);
/**
 * The stream's progress lines, each carrying its own words: `reading` fires first — "Reading the
 * plate…" in the account's language, so the client prints rather than composes it — then zero or
 * more `item` events, each with the weighing line alongside the row. Shared by the photo turn and
 * an edit (#608).
 */
export type PhotoProgress =
  | { kind: "reading"; line: string }
  | { kind: "item"; index: number; item: MealItem; line: string };
/**
 * One line of the photo stream. Progress, then `PhotoLast` as the LAST line — refusals included,
 * because the 200 went out with the first byte. An `item` with `index: 0` after others means the
 * analyzer started over (a schema retry).
 */
export type PhotoEvent = PhotoProgress | PhotoLast;
/** The stream's last line: the result, or the server's own failure mid-turn (`OUTCOME_UNKNOWN`). */
export type PhotoLast = LogPhotoResult | { kind: typeof OUTCOME_UNKNOWN };
/**
 * One line of the `POST /v1/messages` stream: the same progress shapes as the photo stream
 * (`reading` is never sent — a text turn has no plate to read), then the turn's result last.
 * The items arrive as the analysis behind the router closes them, which is the whole of why the
 * route streams them at all (#70).
 */
export type MessageEvent = PhotoProgress | MessageLast;
/** The messages stream's last line: the result, or the server's own failure mid-turn. */
export type MessageLast = HandleTextResult | { kind: typeof OUTCOME_UNKNOWN };

/** `POST /v1/meals/photo/queue`: the upload is in and the job runs on without the client. */
export interface PhotoQueuedResponse { kind: "queued"; jobId: string }
/** The queued row's step, the server's half: 1 is the client's own upload, so a job starts at 2. */
export type PhotoJobStep = 1 | 2 | 3 | 4;
/** What a queued meal update changes: an ingredient edit, a chat correction, or a re-read of the photo. */
export type MealUpdateKind = "ingredients" | "note" | "reread";
/** Steps the server counts per kind; a job's `step` runs 1 to its kind's count and never past it. */
export const MEAL_UPDATE_STEPS: Record<MealUpdateKind, number> = { ingredients: 2, note: 3, reread: 3 };
/** `POST /v1/meals/update/queue` (ieat-app#1347). `edit` is the same body `PATCH /v1/meals/:id` takes. */
export type MealUpdateBody =
  | { kind: "ingredients"; edit: EditMealRequest }
  | { kind: "note"; text: string }
  | { kind: "reread" };
export type MealUpdateRequest = { mealId: string; clientId: string; capturedAt?: string } & MealUpdateBody;
/** A queued update's last line: what the same change answers when it is not queued. */
export type MealUpdateLast = HandleTextResult | { kind: typeof OUTCOME_UNKNOWN };

/** The body is a cast, not a validation: it ends in a stored sentence and a verdict. */
export function isMealUpdateRequest(body: unknown): body is MealUpdateRequest {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
  const b = body as Record<string, unknown>;
  if (typeof b.mealId !== "string" || b.mealId === "" || b.mealId.length > MAX_CLIENT_ID) return false;
  if (b.kind === "reread") return true;
  if (b.kind === "note") return typeof b.text === "string" && b.text.trim() !== "" && b.text.length <= MAX_USER_LINE;
  return b.kind === "ingredients" && isEditMealRequest(b.edit);
}

/**
 * A queued photo or meal update (ieat-app#1318, #1347): one job shape for both. `running` carries
 * the step, its words in the account's language, and the foods found so far (name and grams only,
 * like the pending card); an update adds `update` — its kind, its meal and how many steps it has.
 * `settled` the turn's own last line; `removed` a job the caller removed.
 */
export type PhotoJob =
  | { kind: "running"; jobId: string; step: PhotoJobStep; line: string; items: MealItem[]; update?: { kind: MealUpdateKind; mealId: string; steps: number } }
  | { kind: "settled"; jobId: string; result: PhotoLast | MealUpdateLast }
  | { kind: "removed"; jobId: string };

/** A job's snapshot with its own result type: {@link PhotoJob} narrowed to one kind of request. */
export type JobState<R> = Extract<PhotoJob, { kind: "running" | "removed" }> | { kind: "settled"; jobId: string; result: R };
interface JobEnvelope { jobId: string; createdAt: string; updatedAt: string }
/**
 * One job in {@link JobsResponse}. The envelope is the same for every kind; `jobKind` types
 * `state.result`. A client that meets a `jobKind` it does not know shows a generic row from the
 * envelope alone, so a new kind of request never breaks a shipped build.
 */
export type JobEntry =
  | (JobEnvelope & { jobKind: "photo"; state: JobState<PhotoLast> })
  | (JobEnvelope & { jobKind: "meal-update"; state: JobState<MealUpdateLast> });
export type JobKind = JobEntry["jobKind"];
export type JobsFilter = "active" | "settled" | "all";
/** `cursor` is opaque; null when there is no further page. */
export interface JobsResponse { jobs: JobEntry[]; cursor: string | null }
/**
 * `PATCH /v1/messages/:id` (#608): the same progress, then one of these last. `bad-request` is a
 * line that cannot be edited (text, or not the caller's kind); `too-many` is the photo bound the
 * server counts against what is already stored.
 */
export type EditLineLast =
  | MealUpdated | TargetGone | Refusal
  | { kind: "bad-request" } | { kind: "too-many"; limit: number }
  | { kind: typeof OUTCOME_UNKNOWN };
/**
 * `DELETE /v1/messages/:id` and `DELETE /v1/meals/:id` (#61). `mealId`/`date` name the meal that
 * went with the line — or the meal that went — so the client can refresh that day; null when only
 * a line went, which a meal delete never answers.
 */
export interface DeleteLineResponse { kind: "deleted"; mealId: string | null; date: string | null }
export type MessageResponse = HandleTextResult;
export type PendingResponse = ConfirmMealResult | { kind: "cancelled" } | { kind: "expired" };
/** `GET /v1/meals/pending`: the caller's live proposals, oldest first, each as its turn sent it (#530). */
export interface PendingMealsResponse {
  proposals: MealProposed[];
}

// ── The food catalog ───────────────────────────────────────────────────────────────────────────

/**
 * `GET /v1/foods`: the generic foods whose names contain `q`, ranked closest-first, capped server-
 * side. `attributions` carries the citation each source in the result owes — the client renders
 * them rather than knowing which databases it searched.
 */
export interface FoodSearchResponse {
  foods: FoodRef[];
  attributions: FoodAttribution[];
}
/**
 * `GET /v1/products/:barcode`. `product` is null on a miss — an ordinary answer, since a miss is
 * where the label-read path begins — and `attribution` is null with it, so the two can never be
 * drawn apart.
 */
export interface ProductResponse {
  product: OffProduct | null;
  attribution: FoodAttribution | null;
}
/** Longest `q` the search accepts — a UUID-length term cannot match a name anyway. */
export const MAX_FOOD_QUERY = 200;
/** Page size when `limit` is absent. */
export const FOOD_SEARCH_LIMIT = 25;
/** The server never answers with more than this many rows, whatever the client asks for. */
export const FOOD_SEARCH_MAX_LIMIT = 50;
