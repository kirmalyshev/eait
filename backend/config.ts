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
   * Where the chat-completions call goes. Env-configurable so staging can point at a proxy, a
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
  /** Photos one user may analyze per day. The cap is what makes a free tier affordable. */
  userDailyPhotoCap: number;
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
   * number is a product judgement rather than a constant of nature, and because a staging instance
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
  if (!v) throw new Error(`[ieat] ${name} is required and not set`);
  return v;
}

function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`[ieat] ${name} must be a non-negative integer`);
  return n;
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
    userDailyPhotoCap: 20,
    globalDailyAnalysisCap: 500,
    timezone: "Europe/Berlin",
    pendingTtlMs: 30 * 60 * 1000,
    maxUploadBytes: 20 * 1024 * 1024,
    maxPhotosPerMeal: 4,
    sessionTtlDays: DEFAULT_SESSION_TTL_MS / (24 * 60 * 60 * 1000),
    authRateLimitPerHour: 20,
    analysisRateLimitPerDay: 60,
    subscribeRateLimitPerHour: 5,
    appleAudiences: [],
    googleAudiences: [],
    adminToken: "",
    subscribeDailyCap: 200,
    subscribeConfirmTtlDays: 7,
    mailProvider: "log",
    mailFrom: "ieat <lets@eait.fit>",
    resendApiKey: "",
    resendBaseUrl: "https://api.resend.com",
    mailTimeoutMs: 15_000,
    publicApiUrl: "",
    landingUrl: "",
  };
}

export function loadConfig(): Config {
  const d = configDefaults();

  const maxPhotosPerMeal = int("MAX_PHOTOS_PER_MEAL", d.maxPhotosPerMeal);
  if (maxPhotosPerMeal < 1) throw new Error("[ieat] MAX_PHOTOS_PER_MEAL must be at least 1");

  // Zero passes `int` — it is a non-negative integer — and would expire every token the instant it
  // was issued, which presents as an app that cannot stay signed in and as nothing in any log.
  const sessionTtlDays = int("SESSION_TTL_DAYS", d.sessionTtlDays);
  if (sessionTtlDays < 1) throw new Error("[ieat] SESSION_TTL_DAYS must be at least 1");

  const subscribeConfirmTtlDays = int("SUBSCRIBE_CONFIRM_TTL_DAYS", d.subscribeConfirmTtlDays);
  if (subscribeConfirmTtlDays < 1) {
    throw new Error("[ieat] SUBSCRIBE_CONFIRM_TTL_DAYS must be at least 1");
  }

  // An unknown provider is a STARTUP ERROR, not a fallback to `log`. Falling back would mean a
  // typo in a deploy variable produced a server that quietly printed confirmation links into a
  // container log instead of sending them, and the only symptom is a list that stops growing.
  const mailProvider = (process.env.MAIL_PROVIDER ?? d.mailProvider) as Config["mailProvider"];
  if (mailProvider !== "log" && mailProvider !== "resend") {
    throw new Error(`[ieat] MAIL_PROVIDER must be "log" or "resend", not "${mailProvider}"`);
  }
  if (mailProvider === "resend" && !process.env.RESEND_API_KEY) {
    throw new Error("[ieat] MAIL_PROVIDER=resend needs RESEND_API_KEY");
  }

  return {
    ...d,
    port: int("PORT", d.port),
    host: process.env.HOST ?? d.host,
    databaseUrl: required("DATABASE_URL"),
    llmProvider: process.env.LLM_PROVIDER ?? d.llmProvider,
    llmModel: process.env.LLM_MODEL ?? d.llmModel,
    llmApiKey: required("LLM_API_KEY"),
    llmBaseUrl: process.env.LLM_BASE_URL ?? d.llmBaseUrl,
    llmTimeoutMs: int("LLM_TIMEOUT_MS", d.llmTimeoutMs),
    userDailyPhotoCap: int("USER_DAILY_PHOTO_CAP", d.userDailyPhotoCap),
    globalDailyAnalysisCap: int("GLOBAL_DAILY_ANALYSIS_CAP", d.globalDailyAnalysisCap),
    timezone: process.env.TZ_NAME ?? d.timezone,
    pendingTtlMs: int("PENDING_TTL_MINUTES", d.pendingTtlMs / 60_000) * 60 * 1000,
    // Expressed in megabytes because that is how anyone setting it thinks about it.
    maxUploadBytes: int("MAX_UPLOAD_MB", d.maxUploadBytes / (1024 * 1024)) * 1024 * 1024,
    maxPhotosPerMeal,
    sessionTtlDays,
    authRateLimitPerHour: int("AUTH_RATE_LIMIT_PER_HOUR", d.authRateLimitPerHour),
    analysisRateLimitPerDay: int("ANALYSIS_RATE_LIMIT_PER_DAY", d.analysisRateLimitPerDay),
    subscribeRateLimitPerHour: int("SUBSCRIBE_RATE_LIMIT_PER_HOUR", d.subscribeRateLimitPerHour),
    appleAudiences: list("APPLE_AUDIENCES"),
    googleAudiences: list("GOOGLE_AUDIENCES"),
    adminToken: adminTokenFromEnv(),
    subscribeDailyCap: int("SUBSCRIBE_DAILY_CAP", d.subscribeDailyCap),
    subscribeConfirmTtlDays: subscribeConfirmTtlDays,
    mailProvider,
    mailFrom: process.env.MAIL_FROM ?? d.mailFrom,
    resendApiKey: process.env.RESEND_API_KEY ?? d.resendApiKey,
    resendBaseUrl: (process.env.RESEND_BASE_URL ?? d.resendBaseUrl).replace(/\/$/, ""),
    mailTimeoutMs: int("MAIL_TIMEOUT_MS", d.mailTimeoutMs),
    publicApiUrl: (process.env.PUBLIC_API_URL ?? d.publicApiUrl).replace(/\/$/, ""),
    // No validation beyond "looks like an origin": a wrong value here sends somebody to the wrong
    // page, which is visible, rather than corrupting anything, which is not.
    landingUrl: (process.env.LANDING_URL ?? d.landingUrl).replace(/\/$/, ""),
  };
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
  const raw = process.env.ADMIN_TOKEN ?? "";
  if (raw !== "" && raw.length < 24) {
    throw new Error("[ieat] ADMIN_TOKEN must be at least 24 characters (or unset to disable /admin)");
  }
  return raw;
}

/**
 * A config safe to print. Never log the raw object — `llmApiKey` is in it, and a config dump in a
 * crash report is one of the commonest ways a key reaches a log aggregator.
 */
export function redact(c: Config): Record<string, unknown> {
  const { llmApiKey: _k, adminToken: _a, resendApiKey: _r, databaseUrl, ...rest } = c;
  return {
    ...rest,
    databaseUrl: databaseUrl.replace(/\/\/[^@]*@/, "//***@"),
    llmApiKey: "***",
    // Destructured out above and reinstated as a mask, so a field added to Config can never reach
    // this log by being forgotten — the omission is the default and the disclosure is the edit.
    resendApiKey: c.resendApiKey === "" ? "(unset)" : "***",
    // Whether the admin is ON is worth seeing in a boot log; the token itself never is.
    adminToken: c.adminToken === "" ? "(disabled)" : "***",
  };
}
