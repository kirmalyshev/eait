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
  /** Photos one user may analyze per day. The cap is what makes a free tier affordable. */
  userDailyPhotoCap: number;
  /** Photos the whole instance may analyze per day. Bounds spend when the app is public. */
  globalDailyAnalysisCap: number;
  /** IANA zone used for every date boundary. Dates are NOT computed in UTC. */
  timezone: string;

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

export function loadConfig(): Config {
  return {
    port: int("PORT", 8787),
    host: process.env.HOST ?? "127.0.0.1",
    databaseUrl: required("DATABASE_URL"),
    llmProvider: process.env.LLM_PROVIDER ?? "openrouter",
    llmModel: process.env.LLM_MODEL ?? "x-ai/grok-4.5",
    llmApiKey: required("LLM_API_KEY"),
    userDailyPhotoCap: int("USER_DAILY_PHOTO_CAP", 20),
    globalDailyAnalysisCap: int("GLOBAL_DAILY_ANALYSIS_CAP", 500),
    timezone: process.env.TZ_NAME ?? "Europe/Berlin",
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
