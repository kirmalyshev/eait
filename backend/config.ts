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
    appleAudiences: [],
    googleAudiences: [],
  };
}

export function loadConfig(): Config {
  const d = configDefaults();

  const maxPhotosPerMeal = int("MAX_PHOTOS_PER_MEAL", d.maxPhotosPerMeal);
  if (maxPhotosPerMeal < 1) throw new Error("[ieat] MAX_PHOTOS_PER_MEAL must be at least 1");

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
    appleAudiences: list("APPLE_AUDIENCES"),
    googleAudiences: list("GOOGLE_AUDIENCES"),
  };
}

/**
 * A config safe to print. Never log the raw object — `llmApiKey` is in it, and a config dump in a
 * crash report is one of the commonest ways a key reaches a log aggregator.
 */
export function redact(c: Config): Record<string, unknown> {
  const { llmApiKey: _k, databaseUrl, ...rest } = c;
  return { ...rest, databaseUrl: databaseUrl.replace(/\/\/[^@]*@/, "//***@"), llmApiKey: "***" };
}
