import { REMINDER_TIME, FREE_ANALYSES } from "@ieat/shared";
import { DEFAULT_SESSION_TTL_MS } from "./auth/tokens.ts";

// Configuration, loaded once at startup and validated loudly.
//
// An unknown or missing setting is a STARTUP ERROR, never a silent fallback. A bot that quietly
// falls back to a different model answers differently and nothing in any log says why.

export interface Config {
  port: number;
  /** Loopback by default. A process that binds 0.0.0.0 because nobody said otherwise is how a
   *  build with no auth ends up reachable from the internet. */
  host: string;
  databaseUrl: string;
  llmProvider: string;
  llmModel: string;
  llmApiKey: string;
  /**
   * Where the chat-completions call goes. Env-configurable so a test instance can point at a proxy, a
   * gateway, or a recorded fixture server without a code change — and so nothing has to guess
   * which environment it is in.
   */
  llmBaseUrl: string;
  /**
   * How long a model call may hang before it is abandoned. There was no timeout at all: a
   * provider that accepts the connection and never answers held the request, the user's photo,
   * and a worker slot indefinitely.
   */
  llmTimeoutMs: number;
  /**
   * The completion bound sent with every model call.
   *
   * A request that names none is not unbounded — the provider substitutes the model's own ceiling
   * (65536 on OpenRouter) and reserves the whole of it against the balance BEFORE it will route the
   * call. So an omitted bound is not a generous default, it is a demand for ~40x the tokens the
   * call will actually generate, refused as a 402 with nothing analyzed.
   *
   * The default is ~10x the 1614 completion tokens a real meal analysis measured on grok-4.5 —
   * 80% of which were REASONING tokens, which count against this and vary far more than the answer
   * does. Generous on purpose: the bound is reserved, not charged — the incident's own numbers put
   * completion at ~$6/M, so 16000 bills ~$0.01 and merely requires ~$0.096 of balance to route,
   * against ~$0.39 for the 65536 it replaces. That is the real cost of raising it: not the bill,
   * but the balance below which every call 402s again. Worth it, because a bound that is too tight
   * truncates the JSON and returns `analysis-failed` with the user's analysis already charged.
   *
   * It is a variable because the right number is a property of the model, and `llmModel` is a
   * variable. It is not a variable that has to be SET: this default is what ships, and deleting the
   * env line falls back to it rather than to no bound at all.
   */
  llmMaxTokens: number;
  /**
   * Analyses an account gets before an entitlement is required. THERE IS NO FREE TIER: this is
   * the onboarding's sample — one verdict, photo or typed — and the default is 1. Lifetime, not
   * per day. A demo instance sets it high rather than growing a second code path.
   */
  freeAnalyses: number;
  /**
   * Photos per day for an account with a live entitlement; 0 means no daily cap. What a
   * subscription buys is this allowance — never an exemption from `globalDailyAnalysisCap`,
   * which bounds the instance above it: a paid user is a bigger share of a budget.
   */
  paidDailyPhotoCap: number;
  /** Photos the whole instance may analyze per day. Bounds spend when the app is public. */
  globalDailyAnalysisCap: number;
  /** IANA zone used for every date boundary. Dates are NOT computed in UTC. */
  timezone: string;

  /**
   * How long a proposed text meal stays confirmable. Shorter in production keeps the table small;
   * longer in development stops a proposal expiring while you are reading the code.
   */
  pendingTtlMs: number;
  /** Total upload size accepted, in bytes. A cap is what stops a large POST being a DoS. */
  maxUploadBytes: number;
  /**
   * Photographs accepted for ONE meal. Several angles of one plate, one analysis, one billed call.
   *
   * The client is TOLD this value rather than compiling its own copy — see `limits` on the profile
   * response. Two independently-set numbers that must agree is two numbers that will not.
   */
  maxPhotosPerMeal: number;

  /**
   * Every audience an Apple ID token may legitimately carry — the iOS bundle id, plus a Service ID
   * if a web flow is ever added. NOT a secret; a client id is public by design.
   *
   * Empty means Sign in with Apple is OFF, and the route says so rather than verifying without an
   * audience check. A verifier with no audience accepts tokens minted for any app in the world.
   */
  appleAudiences: string[];
  /** Every Google OAuth client id that may sign in: iOS, web, Android. Empty = Google is off. */
  googleAudiences: string[];

  /**
   * How many days a bearer token survives WITHOUT BEING USED.
   *
   * Idle time, not absolute age — `auth/tokens.ts` has the argument. Configurable because the right
   * number is a product judgement rather than a constant of nature, and because a test instance
   * that wants to exercise the expiry path should not have to wait half a year to reach it.
   */
  sessionTtlDays: number;

  /**
   * Requests per hour, per address, on the routes that mint a session.
   *
   * `POST /v1/auth/device` creates an account for anybody with a 32-character string, so without
   * this the per-user analysis allowance is worth nothing — resetting it costs one HTTP call — and
   * the users table grows as fast as somebody cares to loop. Zero disables the limit.
   */
  authRateLimitPerHour: number;
  /**
   * Billed analyses per day, per address, across every account reached from it.
   *
   * THIS is the cap that closes the account-minting bypass: `userDailyPhotoCap` bounds one account
   * and this bounds one address regardless of how many accounts it creates. Set well above one
   * person's own allowance on purpose — a mobile carrier can put thousands of subscribers behind
   * one address, and refusing a stranger who has logged one meal is a worse failure than the spend
   * this is guarding. Zero disables it; `globalDailyAnalysisCap` is then the only backstop.
   */
  analysisRateLimitPerDay: number;
  /** Subscribe submissions per hour, per address. The honeypot's backstop. Zero disables. */
  subscribeRateLimitPerHour: number;
  /**
   * Health-sync posts per hour, per address.
   *
   * The heaviest write this API accepts: up to `MAX_HEALTH_DAYS_PER_BATCH` upserts inside one
   * transaction. It costs nothing at the model, so no billed cap covers it, and `POST
   * /v1/auth/device` hands out an account to anybody with a 32-character string — so an
   * account-scoped bound would be reset by one HTTP call. Per address, like the others.
   *
   * Generous on purpose: the app syncs on each visit to one screen, and several people can sit
   * behind one carrier address. This is a bound on a loop, not a quota anybody should meet. Zero
   * disables it.
   */
  healthSyncRateLimitPerHour: number;
  /** `POST /v1/messages/lines` and `PATCH /v1/meals/:id` per address per hour — one allowance, two counters. Unbilled and unmetered otherwise; same argument as the health sync. Zero disables it. */
  linesRateLimitPerHour: number;

  /**
   * The shared secret RevenueCat presents on its webhook, in the `Authorization` header.
   *
   * EMPTY MEANS THERE IS NO WEBHOOK. The route answers 404 exactly like `/admin` does when it is
   * unconfigured — an unauthenticated endpoint that writes entitlements is an endpoint that grants
   * them, and 404 rather than 403 keeps "there is one here" from being information.
   *
   * A secret, and treated as one: constant-time comparison, and `redact()` masks it.
   */
  revenueCatWebhookToken: string;
  /**
   * WHICH RevenueCat entitlement grants the paid tier.
   *
   * The DEFAULT IS THE IDENTIFIER THAT ACTUALLY EXISTS in the RevenueCat project (`ieat_fit_pro`,
   * project ieat․fit), not a generic `pro`. There is exactly one entitlement there and all three
   * products hang off it, so a default that names anything else means every purchase is read as
   * `other-entitlement` and silently grants nothing — charged, and no tier. It was `pro` for a day
   * on the strength of a document rather than the dashboard.
   *
   * A project can carry several — a lifetime unlock, a legacy plan, an internal comp — and an
   * event names the ones it affects. Matching on a configured id rather than "any entitlement at
   * all" is what stops a product nobody meant to sell the paid tier from selling it.
   */
  revenueCatEntitlementId: string;
  /**
   * Accept webhook events from RevenueCat's SANDBOX environment (App Store sandbox, Test Store).
   * OFF by default: a simulated purchase must not grant a real entitlement. The one deployed host
   * opts in while purchases are exercised from development and TestFlight builds, and must switch
   * it OFF the day the listing goes live (`ieat_revenuecat_accept_sandbox`).
   */
  revenueCatAcceptSandbox: boolean;

  /**
   * The credential for `/admin` — onboarding copy and the funnel.
   *
   * EMPTY MEANS THERE IS NO ADMIN. Every path under `/admin` answers 404, so a deployment that
   * never sets this has no admin surface to attack rather than a locked one to guess at. It is its
   * own authority: a user's bearer token gets nothing here, and this token gets nothing on the
   * user API.
   *
   * A secret, and it is treated as one — `redact()` masks it, and nothing prints it.
   */
  adminToken: string;

  /**
   * How many addresses the landing page's form may add in a rolling day, across everyone.
   *
   * The honeypot stops a bot that fills every field it finds; this stops one that does not. It
   * counts rows ADDED, not requests accepted — a cap that only counts the ones it liked is a cap a
   * retry loop walks straight through, which is the same reasoning as `globalDailyAnalysisCap`.
   */
  subscribeDailyCap: number;

  /**
   * How long a submitted-but-unconfirmed address is kept before it is deleted.
   *
   * Not a tidying interval. An address that was typed into a form and never confirmed is personal
   * data held with no basis at all — quite possibly somebody else's address, typed by a stranger —
   * and a week is long enough for a person to find the email and short enough that nothing lingers.
   */
  subscribeConfirmTtlDays: number;

  /**
   * Who sends the one email this product sends.
   *
   * `log` prints the confirmation link and NOT the recipient, which is what makes the whole flow
   * drivable in development with no vendor account. `resend` is the real one. Anything else is a
   * startup error rather than a silent fallback to printing links nobody reads.
   */
  mailProvider: "log" | "resend";
  /** The From header. Must be on a domain verified with the provider, or every send is a 403. */
  mailFrom: string;
  /** Credential for `resend`. Required when that provider is selected, ignored otherwise. */
  resendApiKey: string;
  /** Regional endpoint. The EU one matters here — see `mail/resend.ts`. */
  resendBaseUrl: string;
  /** How long one send may hang before it is abandoned, holding a person's form submission. */
  mailTimeoutMs: number;

  /**
   * This server's own public origin, used to build the confirmation link.
   *
   * Empty is supported and means "work it out from the request" — the Host header Caddy forwards,
   * plus `X-Forwarded-Proto`. Setting it explicitly is better wherever it is known, because a link
   * built from a header is a link an attacker can influence the hostname of.
   */
  publicApiUrl: string;

  // ── Notifications ────────────────────────────────────────────────────────────────────────
  //
  // Off by default, everywhere. A development server that pushed to real phones the first time
  // somebody ran it would be a development server nobody could run twice.

  /**
   * Whether the nightly sweep runs at all.
   *
   * OFF unless a deployment says otherwise. It is the switch to pull when the loop is doing more
   * harm than good — the retention plan pre-commits to turning a loop off when its blocks exceed
   * its reactivations, and that promise needs a switch that is not a code change.
   */
  pushEnabled: boolean;
  /**
   * Expo's push access token.
   *
   * A secret, and treated as one. EMPTY MEANS PUSHES ARE LOGGED, NOT SENT: Expo accepts
   * unauthenticated sends, so a server that fell back to sending without this would be a server
   * anybody who learns a device token can impersonate. `choosePush` refuses to build the real
   * client without it.
   */
  expoPushAccessToken: string;
  /** How long one push request may hang. Same argument as `llmTimeoutMs` and `mailTimeoutMs`. */
  pushTimeoutMs: number;
  /**
   * When the evening line goes out, in this server's `timezone`.
   *
   * Configurable so a staging instance can reach the path without waiting until the evening. The
   * DEFAULT is `REMINDER_TIME` from `@ieat/shared`, which is the 20:30 the onboarding copy promises
   * — move it in production and step 18's promise becomes false.
   */
  eveningLineTime: { hour: number; minute: number };

  /**
   * The landing page's origin, for the ONE thing the API needs it for: where to send a browser
   * after it posts the subscribe form.
   *
   * The form lives on a different origin from this API and the page carries no JavaScript, so the
   * browser NAVIGATES to the response. Without somewhere to send it back to, a person who
   * subscribed would be left looking at a JSON body on an api. hostname.
   *
   * Empty is a supported state, not a broken one: the routes answer with JSON instead of
   * redirecting, which is what a `curl` and a backend deployed without a landing page both want.
   */
  landingUrl: string;

}

/** Comma-separated env list → trimmed array, empties dropped. */
function list(name: string): string[] {
  return (process.env[name] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[eait] ${name} is required and not set`);
  return v;
}

/**
 * A non-negative integer from the environment, or the fallback.
 *
 * Exported because `scripts/` reads the same variables without `loadConfig`, and hand-rolling the
 * read there is how a present-but-empty variable became `Number("")` — zero — and a typo became
 * `NaN`, which `JSON.stringify` writes as `null` and a provider reads as "not sent".
 */
export function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`[eait] ${name} must be a non-negative integer`);
  return n;
}

/**
 * The completion bound, read and floored — the ONE way anything reads this variable.
 *
 * `int` alone is not enough, and sharing only `int` is what let these two diverge: it accepts an
 * explicit `0`, so the server refused to start while `scripts/eval-photos.ts` sent `max_tokens: 0`
 * on every billed call. Zero is "no limit" for every cap and rate limit in this file and cannot
 * mean that here — it is a bound OF zero, so every reply comes back empty.
 *
 * The floor is ABOVE the 1614 completion tokens a real analysis measured, not merely above zero. A
 * bound under the measurement does not fail some calls, it fails every one of them, and since
 * truncation is terminal rather than retried it fails them deterministically: this incident again,
 * from a value the validator had called acceptable.
 */
export function llmMaxTokensFromEnv(fallback: number): number {
  const value = int("EAIT__BACKEND__LLM_MAX_TOKENS", fallback);
  if (value < 2000) {
    throw new Error("[eait] EAIT__BACKEND__LLM_MAX_TOKENS must be at least 2000; one measured analysis is 1614 completion tokens, and 0 is a bound of zero rather than 'unbounded'");
  }
  return value;
}

/**
 * Every default, in ONE place, reading nothing from the environment.
 *
 * `loadConfig` layers env over this, and `--demo` and the tests override the few fields they care
 * about. Before this existed the defaults were written inline in `loadConfig` and each other
 * construction site listed every field by hand, so adding one broke three of them at once — which
 * is how this function came to be written.
 *
 * The values here are the DEVELOPMENT-safe ones: loopback, no credentials, generous caps.
 */
export function configDefaults(): Config {
  return {
    port: 8787,
    host: "127.0.0.1",
    databaseUrl: "",
    llmProvider: "openrouter",
    llmModel: "x-ai/grok-4.5",
    llmApiKey: "",
    llmBaseUrl: "https://openrouter.ai/api/v1/chat/completions",
    llmTimeoutMs: 90_000,
    llmMaxTokens: 16_000,
    freeAnalyses: FREE_ANALYSES,
    paidDailyPhotoCap: 200,
    globalDailyAnalysisCap: 500,
    timezone: "Europe/Berlin",
    pendingTtlMs: 30 * 60 * 1000,
    maxUploadBytes: 20 * 1024 * 1024,
    maxPhotosPerMeal: 4,
    sessionTtlDays: DEFAULT_SESSION_TTL_MS / (24 * 60 * 60 * 1000),
    authRateLimitPerHour: 20,
    analysisRateLimitPerDay: 60,
    subscribeRateLimitPerHour: 5,
    healthSyncRateLimitPerHour: 120,
    linesRateLimitPerHour: 120,
    appleAudiences: [],
    googleAudiences: [],
    adminToken: "",
    revenueCatWebhookToken: "",
    revenueCatEntitlementId: "ieat_fit_pro",
    revenueCatAcceptSandbox: false,
    subscribeDailyCap: 200,
    subscribeConfirmTtlDays: 7,
    mailProvider: "log",
    mailFrom: "eait <lets@eait.fit>",
    resendApiKey: "",
    resendBaseUrl: "https://api.resend.com",
    mailTimeoutMs: 15_000,
    publicApiUrl: "",
    landingUrl: "",
    pushEnabled: false,
    expoPushAccessToken: "",
    pushTimeoutMs: 15_000,
    // The one number the shipped copy states out loud, so it has exactly one source.
    eveningLineTime: { hour: REMINDER_TIME.hour, minute: REMINDER_TIME.minute },
  };
}

export function loadConfig(): Config {
  const d = configDefaults();

  const maxPhotosPerMeal = int("EAIT__BACKEND__MAX_PHOTOS_PER_MEAL", d.maxPhotosPerMeal);
  if (maxPhotosPerMeal < 1) throw new Error("[eait] EAIT__BACKEND__MAX_PHOTOS_PER_MEAL must be at least 1");

  // Zero passes `int` — it is a non-negative integer — and would expire every token the instant it
  // was issued, which presents as an app that cannot stay signed in and as nothing in any log.
  const sessionTtlDays = int("EAIT__BACKEND__SESSION_TTL_DAYS", d.sessionTtlDays);
  if (sessionTtlDays < 1) throw new Error("[eait] EAIT__BACKEND__SESSION_TTL_DAYS must be at least 1");

  // The free DAILY cap described a tier that no longer exists. A host provisioned before the
  // change still spells it; refusing is what gets it removed rather than silently ignored.
  if (process.env.EAIT__BACKEND__USER_DAILY_PHOTO_CAP !== undefined) {
    throw new Error(
      "[eait] EAIT__BACKEND__USER_DAILY_PHOTO_CAP is retired: there is no free tier. " +
      "EAIT__BACKEND__FREE_ANALYSES is the sample size (default 1).",
    );
  }
  const freeAnalyses = int("EAIT__BACKEND__FREE_ANALYSES", d.freeAnalyses);
  const paidDailyPhotoCap = int("EAIT__BACKEND__PAID_DAILY_PHOTO_CAP", d.paidDailyPhotoCap);

  const llmMaxTokens = llmMaxTokensFromEnv(d.llmMaxTokens);

  const subscribeConfirmTtlDays = int("EAIT__BACKEND__SUBSCRIBE_CONFIRM_TTL_DAYS", d.subscribeConfirmTtlDays);
  if (subscribeConfirmTtlDays < 1) {
    throw new Error("[eait] EAIT__BACKEND__SUBSCRIBE_CONFIRM_TTL_DAYS must be at least 1");
  }

  // An unknown provider is a STARTUP ERROR, not a fallback to `log`. Falling back would mean a
  // typo in a deploy variable produced a server that quietly printed confirmation links into a
  // container log instead of sending them, and the only symptom is a list that stops growing.
  const mailProvider = (process.env.EAIT__BACKEND__MAIL_PROVIDER ?? d.mailProvider) as Config["mailProvider"];
  if (mailProvider !== "log" && mailProvider !== "resend") {
    throw new Error(`[eait] EAIT__BACKEND__MAIL_PROVIDER must be "log" or "resend", not "${mailProvider}"`);
  }
  if (mailProvider === "resend" && !process.env.EAIT__BACKEND__RESEND_API_KEY) {
    throw new Error("[eait] EAIT__BACKEND__MAIL_PROVIDER=resend needs EAIT__BACKEND__RESEND_API_KEY");
  }

  const eveningLineTime = eveningLineTimeFromEnv();

  return {
    ...d,
    port: int("EAIT__BACKEND__PORT", d.port),
    host: process.env.EAIT__BACKEND__HOST ?? d.host,
    databaseUrl: required("EAIT__BACKEND__DATABASE_URL"),
    llmProvider: process.env.EAIT__BACKEND__LLM_PROVIDER ?? d.llmProvider,
    llmModel: process.env.EAIT__BACKEND__LLM_MODEL ?? d.llmModel,
    llmApiKey: required("EAIT__BACKEND__LLM_API_KEY"),
    llmBaseUrl: process.env.EAIT__BACKEND__LLM_BASE_URL ?? d.llmBaseUrl,
    llmTimeoutMs: int("EAIT__BACKEND__LLM_TIMEOUT_MS", d.llmTimeoutMs),
    llmMaxTokens,
    freeAnalyses,
    paidDailyPhotoCap,
    globalDailyAnalysisCap: int("EAIT__BACKEND__GLOBAL_DAILY_ANALYSIS_CAP", d.globalDailyAnalysisCap),
    timezone: process.env.EAIT__BACKEND__TZ_NAME ?? d.timezone,
    pendingTtlMs: int("EAIT__BACKEND__PENDING_TTL_MINUTES", d.pendingTtlMs / 60_000) * 60 * 1000,
    // Expressed in megabytes because that is how anyone setting it thinks about it.
    maxUploadBytes: int("EAIT__BACKEND__MAX_UPLOAD_MB", d.maxUploadBytes / (1024 * 1024)) * 1024 * 1024,
    maxPhotosPerMeal,
    sessionTtlDays,
    authRateLimitPerHour: int("EAIT__BACKEND__AUTH_RATE_LIMIT_PER_HOUR", d.authRateLimitPerHour),
    analysisRateLimitPerDay: int("EAIT__BACKEND__ANALYSIS_RATE_LIMIT_PER_DAY", d.analysisRateLimitPerDay),
    subscribeRateLimitPerHour: int("EAIT__BACKEND__SUBSCRIBE_RATE_LIMIT_PER_HOUR", d.subscribeRateLimitPerHour),
    healthSyncRateLimitPerHour: int("EAIT__BACKEND__HEALTH_SYNC_RATE_LIMIT_PER_HOUR", d.healthSyncRateLimitPerHour),
    linesRateLimitPerHour: int("EAIT__BACKEND__LINES_RATE_LIMIT_PER_HOUR", d.linesRateLimitPerHour),
    appleAudiences: list("EAIT__BACKEND__APPLE_AUDIENCES"),
    googleAudiences: list("EAIT__BACKEND__GOOGLE_AUDIENCES"),
    adminToken: adminTokenFromEnv(),
    revenueCatWebhookToken: revenueCatWebhookTokenFromEnv(),
    revenueCatEntitlementId:
      process.env.EAIT__BACKEND__REVENUECAT_ENTITLEMENT_ID ?? d.revenueCatEntitlementId,
    revenueCatAcceptSandbox: ["1", "true"].includes(process.env.EAIT__BACKEND__REVENUECAT_ACCEPT_SANDBOX ?? ""),
    subscribeDailyCap: int("EAIT__BACKEND__SUBSCRIBE_DAILY_CAP", d.subscribeDailyCap),
    subscribeConfirmTtlDays: subscribeConfirmTtlDays,
    mailProvider,
    mailFrom: process.env.EAIT__BACKEND__MAIL_FROM ?? d.mailFrom,
    resendApiKey: process.env.EAIT__BACKEND__RESEND_API_KEY ?? d.resendApiKey,
    resendBaseUrl: (process.env.EAIT__BACKEND__RESEND_BASE_URL ?? d.resendBaseUrl).replace(/\/$/, ""),
    mailTimeoutMs: int("EAIT__BACKEND__MAIL_TIMEOUT_MS", d.mailTimeoutMs),
    publicApiUrl: (process.env.EAIT__BACKEND__PUBLIC_API_URL ?? d.publicApiUrl).replace(/\/$/, ""),
    // No validation beyond "looks like an origin": a wrong value here sends somebody to the wrong
    // page, which is visible, rather than corrupting anything, which is not.
    landingUrl: (process.env.EAIT__BACKEND__LANDING_URL ?? d.landingUrl).replace(/\/$/, ""),
    pushEnabled: ["1", "true"].includes(process.env.EAIT__BACKEND__PUSH_ENABLED ?? ""),
    expoPushAccessToken: process.env.EAIT__BACKEND__EXPO_PUSH_ACCESS_TOKEN ?? d.expoPushAccessToken,
    pushTimeoutMs: int("EAIT__BACKEND__PUSH_TIMEOUT_MS", d.pushTimeoutMs),
    eveningLineTime,
  };
}

/**
 * `HH:MM`, in this server's zone.
 *
 * A startup error rather than a fallback to 20:30. A typo here does not break anything visible —
 * the sweep simply runs at a time nobody chose, once a day, and the only way to find out is to
 * notice when the messages arrive.
 */
export function eveningLineTimeFromEnv(): { hour: number; minute: number } {
  const raw = process.env.EAIT__BACKEND__EVENING_LINE_TIME;
  if (raw === undefined || raw === "") return { ...configDefaults().eveningLineTime };
  const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(raw.trim());
  if (!m) throw new Error(`[eait] EAIT__BACKEND__EVENING_LINE_TIME must be HH:MM, not "${raw}"`);
  return { hour: Number(m[1]), minute: Number(m[2]) };
}

/**
 * The admin credential, refused if it is too short to be one.
 *
 * A short admin token is a guessable admin token, and this one edits what every new user reads
 * while answering questions about their health. Unset is fine and means "no admin"; set-and-weak
 * is a startup error, because it looks protected and is not.
 *
 * Exported so `--demo` reads it the same way. Demo mode is a real server on a real port, and an
 * admin surface that validates its credential differently there is an admin surface whose only
 * tested path is the one nobody ships.
 */
export function adminTokenFromEnv(): string {
  const raw = process.env.EAIT__BACKEND__ADMIN_TOKEN ?? "";
  if (raw !== "" && raw.length < 24) {
    throw new Error("[eait] EAIT__BACKEND__ADMIN_TOKEN must be at least 24 characters (or unset to disable /admin)");
  }
  return raw;
}

/**
 * The RevenueCat webhook credential, refused if it is too short to be one.
 *
 * Same shape and same reasoning as `adminTokenFromEnv`: unset is fine and means the webhook does
 * not exist, while set-and-weak is a startup error because it looks protected and is not. What is
 * behind this one is the ability to write "this account has paid" onto any account whose id you
 * can guess — and account ids are handed to the client, so guessing is not the hard part.
 *
 * RevenueCat sends the value verbatim as the `Authorization` header, so it must be a header value:
 * no whitespace, no newline. A token with a space in it is a header the server splits differently
 * from the one the dashboard shows, and the only symptom is a webhook that always 404s.
 */
export function revenueCatWebhookTokenFromEnv(): string {
  const raw = process.env.EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN ?? "";
  if (raw === "") return raw;
  if (raw.length < 24) {
    throw new Error(
      "[eait] EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN must be at least 24 characters (or unset to disable the webhook)",
    );
  }
  if (/\s/.test(raw)) {
    throw new Error("[eait] EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN must not contain whitespace");
  }
  return raw;
}

/**
 * A config safe to print. Never log the raw object — `llmApiKey` is in it, and a config dump in a
 * crash report is one of the commonest ways a key reaches a log aggregator.
 */
export function redact(c: Config): Record<string, unknown> {
  const {
    llmApiKey: _k, adminToken: _a, resendApiKey: _r, revenueCatWebhookToken: _rc,
    expoPushAccessToken: _e, databaseUrl,
    ...rest
  } = c;
  return {
    ...rest,
    databaseUrl: databaseUrl.replace(/\/\/[^@]*@/, "//***@"),
    llmApiKey: "***",
    // Destructured out above and reinstated as a mask, so a field added to Config can never reach
    // this log by being forgotten — the omission is the default and the disclosure is the edit.
    resendApiKey: c.resendApiKey === "" ? "(unset)" : "***",
    // Whether the admin is ON is worth seeing in a boot log; the token itself never is.
    adminToken: c.adminToken === "" ? "(disabled)" : "***",
    // Same again: whether purchases can be reported at all is the thing worth reading in a log.
    revenueCatWebhookToken: c.revenueCatWebhookToken === "" ? "(disabled)" : "***",
    // Whether this server can send a notification at all is the thing worth reading in a boot log.
    expoPushAccessToken: c.expoPushAccessToken === "" ? "(unset — pushes are logged)" : "***",
  };
}

/**
 * The configuration `--demo` runs on.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * IT STARTS FROM `configDefaults()` AND OVERRIDES ONLY WHAT DEMO MODE CHANGES, so a new setting
 * picks up its default here instead of being silently absent.
 *
 * It lives beside `loadConfig` rather than in the composition root because it is the same kind of
 * decision — which numbers this process runs on — and because a composition root cannot be tested
 * without starting a server, which is how the per-address limits below stayed at their production
 * values long after they had begun failing the E2E suite.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export function demoConfig(): Config {
  return {
    ...configDefaults(),
    port: Number(process.env.EAIT__BACKEND__PORT ?? 8787),
    host: process.env.EAIT__BACKEND__HOST ?? "127.0.0.1",
    databaseUrl: "memory://demo",
    llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
    // No paywall in the demo BY DEFAULT — the E2E flows log several meals per account — and
    // unmetered globally: it is a local demo, not a public instance. The sheet itself is exercised
    // against RevenueCat's Test Store, not here.
    //
    // OVERRIDABLE, for the one runner that needs the production value. `scripts/e2e-paywall.sh`
    // starts a demo with `EAIT__BACKEND__FREE_ANALYSES=1`, because the refusal that opens the
    // paywall is `subscription-required` and nothing produces it while the sample is effectively
    // unlimited. It cannot be the default: the suite's other flows log two or three analyses per
    // account and would all end on a paywall instead of on what they test.
    freeAnalyses: Number(process.env.EAIT__BACKEND__FREE_ANALYSES ?? 100_000),
    globalDailyAnalysisCap: 0,
    // AND UNMETERED PER ADDRESS, for a reason the global cap does not cover. `api/ratelimit.ts`
    // keys on the client address, and a demo has exactly one: every request the simulator makes
    // comes off 127.0.0.1 and lands in the same bucket. `bun run e2e` clears state and mints a
    // fresh account per flow, three flows run 01-onboarding as a subflow, and a failed flow is
    // retried once — comfortably past the production default of 20 sign-ins an hour. The suite then
    // goes red from the sixth flow on, showing the app's own "Too many sign-ins from this network
    // just now", and every failure names a product string rather than the limiter. A gate that
    // fails under its own load, in words that describe the app, is worse than no gate at all.
    authRateLimitPerHour: 1_000_000,
    analysisRateLimitPerDay: 1_000_000,
    subscribeRateLimitPerHour: 1_000_000,
    healthSyncRateLimitPerHour: 1_000_000,
    linesRateLimitPerHour: 1_000_000,
    timezone: process.env.EAIT__BACKEND__TZ_NAME ?? "Europe/Berlin",
    // Read from the environment here too, and validated by the same function: the admin is how
    // onboarding copy is edited, and "works in demo, untested in production" is the shape of
    // every configuration bug that ships.
    adminToken: adminTokenFromEnv(),
    // Same argument. The subscribe form's redirect is the one behaviour that cannot be checked
    // by reading the code — you have to POST the form and watch where the browser goes — and a
    // demo that always answered JSON would make that untestable outside production.
    landingUrl: (process.env.EAIT__BACKEND__LANDING_URL ?? "").replace(/\/$/, ""),
    // And the same argument again for the notification sweep. `choosePush` gives a demo the
    // LOGGING implementation whatever these say, so nothing can leave the machine — but the
    // scheduler, the sweep and the composed sentence are only reachable by hand if these are
    // readable here. Set EAIT__BACKEND__EVENING_LINE_TIME to a minute from now and watch it run.
    pushEnabled: ["1", "true"].includes(process.env.EAIT__BACKEND__PUSH_ENABLED ?? ""),
    eveningLineTime: eveningLineTimeFromEnv(),
    // The same argument once more, for the paid tier. The webhook is the ONLY way an account
    // becomes paid, and RevenueCat cannot reach a laptop — so a paywall flow has to post the
    // delivery itself, through the real route, past the real credential check. Unset here means
    // the route 404s exactly as it does in production, which is the state every other run wants.
    revenueCatWebhookToken: revenueCatWebhookTokenFromEnv(),
    // A Test Store purchase is delivered as `environment: SANDBOX`, and a demo that dropped those
    // would be a demo where no purchase can be exercised at all. Never a default in production:
    // there, sandbox deliveries are how somebody grants themselves a subscription for free.
    revenueCatAcceptSandbox: true,
  };
}
