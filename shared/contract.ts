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
import type { ChatSpeaker, ConfirmMealResult, HandleTextResult, LogPhotoResult, MealProposed, MealUpdated, TargetGone } from "./results.ts";
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
 */
export const DIARY_WINDOW_DAYS = HEALTH_RETENTION_DAYS;

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
  photo: "/v1/meals/photo",
  /**
   * POST — one turn; with `accept: NDJSON` it STREAMS (#508): a blank keepalive line while the model
   * is silent, then the {@link MessageResponse} as the last line, refusals and `target-gone` included.
   * GET `?before=<seq>&limit=N` — the thread, newest page first.
   */
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
  pendingConfirm: (id: string) => `/v1/meals/pending/${encodeURIComponent(id)}/confirm`,
  pendingCancel: (id: string) => `/v1/meals/pending/${encodeURIComponent(id)}/cancel`,
  /** GET — the caller's live proposals, oldest first (#530): a page that lost its card reads them back. */
  pending: "/v1/meals/pending",
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
  // A subscriber is deliberately NOT a user. There is no row linking the two, and there cannot be.
  // Since issue #95 an account carries an address as well, and the difference is the whole design:
  // that one belongs to an account, is held to run it, and is erased with it, while a subscriber
  // has no account and consented to one specific thing — being told when the app ships. Neither
  // basis covers the other. It also means leaving the list is its own action with its own token,
  // not something buried in account deletion.
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

/** Profile plus everything derived from it, so the app never recomputes targets locally. */
export interface ProfileResponse {
  profile: Profile;
  targets: FoodTargets;
  /** Why the targets are what they are. `basis.floorApplied` MUST be surfaced to the user. */
  basis: TargetBasis;
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
  /** `speaker`: who said it. Null is Spud; `gabie` is a coach answer, and the app draws her face on it. */
  | { id: string; seq: number; ts: string; role: "assistant"; kind: "text"; text: string; speaker: ChatSpeaker | null }
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
 * Ten seconds is below anything real rather than merely above nothing: the glance alone is allowed
 * fifteen, and a photo analysis measured a median 37 s to its first visible token
 * (`docs/ACCURACY.md`, 2026-09-05).
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
 * `POST /v1/meals/photo` and `POST /v1/meals/:id/reanalyze` are one `analyzePhoto`, so ONE. The
 * glance runs on its own fifteen-second budget beside it and is never the long pole.
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
 * One line of the stream. Zero or one `glance`, zero or more `item`, then `PhotoLast` as the
 * LAST line — refusals included, because the 200 went out with the first byte. An `item` with
 * `index: 0` after others means the analyzer started over (a schema retry).
 */
export type PhotoEvent =
  | { kind: "glance"; text: string }
  | { kind: "item"; index: number; item: MealItem }
  | PhotoLast;
/** The stream's last line: the result, or the server's own failure mid-turn (`OUTCOME_UNKNOWN`). */
export type PhotoLast = LogPhotoResult | { kind: typeof OUTCOME_UNKNOWN };
export type MessageResponse = HandleTextResult;
export type PendingResponse = ConfirmMealResult | { kind: "cancelled" } | { kind: "expired" };
/** `GET /v1/meals/pending`: the caller's live proposals, oldest first, each as its turn sent it (#530). */
export interface PendingMealsResponse {
  proposals: MealProposed[];
}
