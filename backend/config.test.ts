// Configuration is only useful if it is actually read.
//
// Every value here exists because it differs between development and production. A setting that
// silently ignores its variable is worse than a hardcoded constant: the constant is at least
// honest about not being configurable, while this looks configured and is not.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { configDefaults, loadConfig, redact } from "./config.ts";

/**
 * EVERY variable `loadConfig` reads, cleared before AND after each test.
 *
 * Before, not only after, and that is the whole point: bun loads the repo's `.env` into the test
 * process, and `make env` now writes one in every worktree. Clearing afterwards left the FIRST test
 * running against whatever the developer happened to have configured — so "refuses to start without
 * DATABASE_URL" passed on a clean machine and failed on any machine set up to actually run the
 * server. A test whose result depends on an untracked file is not a test.
 *
 * The list is a superset on purpose: a variable added to `loadConfig` and forgotten here can only
 * make a test read the ambient environment again.
 */
const VARS = [
  "DATABASE_URL", "LLM_API_KEY", "LLM_BASE_URL", "LLM_TIMEOUT_MS", "LLM_MODEL", "LLM_PROVIDER",
  "PENDING_TTL_MINUTES", "MAX_UPLOAD_MB", "MAX_PHOTOS_PER_MEAL", "PORT", "HOST", "TZ_NAME",
  "USER_DAILY_PHOTO_CAP", "GLOBAL_DAILY_ANALYSIS_CAP", "APPLE_AUDIENCES", "GOOGLE_AUDIENCES",
  "SESSION_TTL_DAYS", "AUTH_RATE_LIMIT_PER_HOUR", "ANALYSIS_RATE_LIMIT_PER_DAY",
  "SUBSCRIBE_RATE_LIMIT_PER_HOUR", "SUBSCRIBE_DAILY_CAP", "SUBSCRIBE_CONFIRM_TTL_DAYS",
  "ADMIN_TOKEN", "MAIL_PROVIDER", "MAIL_FROM", "RESEND_API_KEY", "RESEND_BASE_URL",
  "MAIL_TIMEOUT_MS", "PUBLIC_API_URL", "LANDING_URL",
] as const;

/** The two without defaults. Set for every test so `loadConfig` gets past its required checks. */
function withRequired(extra: Record<string, string> = {}) {
  process.env.DATABASE_URL = "postgres://u:p@localhost:5432/db";
  process.env.LLM_API_KEY = "test-key-not-real";
  for (const [k, v] of Object.entries(extra)) process.env[k] = v;
}

const clear = () => {
  for (const v of VARS) delete process.env[v];
};

beforeEach(clear);
afterEach(clear);

describe("loadConfig", () => {
  it("refuses to start without the two settings that have no safe default", () => {
    expect(() => loadConfig()).toThrow(/DATABASE_URL/);
    process.env.DATABASE_URL = "postgres://u:p@localhost:5432/db";
    expect(() => loadConfig()).toThrow(/LLM_API_KEY/);
  });

  it("falls back to the shared defaults when nothing else is set", () => {
    withRequired();
    const c = loadConfig();
    const d = configDefaults();
    expect(c.pendingTtlMs).toBe(d.pendingTtlMs);
    expect(c.maxUploadBytes).toBe(d.maxUploadBytes);
    expect(c.maxPhotosPerMeal).toBe(d.maxPhotosPerMeal);
    expect(c.llmBaseUrl).toBe(d.llmBaseUrl);
    expect(c.llmTimeoutMs).toBe(d.llmTimeoutMs);
  });

  it("reads every environment-specific knob from the environment", () => {
    withRequired({
      LLM_BASE_URL: "https://gateway.internal/v1/chat/completions",
      LLM_TIMEOUT_MS: "45000",
      PENDING_TTL_MINUTES: "5",
      MAX_UPLOAD_MB: "8",
      MAX_PHOTOS_PER_MEAL: "2",
      USER_DAILY_PHOTO_CAP: "3",
      GLOBAL_DAILY_ANALYSIS_CAP: "7",
      TZ_NAME: "America/New_York",
      PORT: "9999",
      HOST: "0.0.0.0",
    });
    const c = loadConfig();
    expect(c.llmBaseUrl).toBe("https://gateway.internal/v1/chat/completions");
    expect(c.llmTimeoutMs).toBe(45_000);
    expect(c.pendingTtlMs).toBe(5 * 60 * 1000);
    expect(c.maxUploadBytes).toBe(8 * 1024 * 1024);
    expect(c.maxPhotosPerMeal).toBe(2);
    expect(c.userDailyPhotoCap).toBe(3);
    expect(c.globalDailyAnalysisCap).toBe(7);
    expect(c.timezone).toBe("America/New_York");
    expect(c.port).toBe(9999);
    expect(c.host).toBe("0.0.0.0");
  });

  it("rejects a nonsense number rather than coercing it", () => {
    withRequired({ MAX_UPLOAD_MB: "twenty" });
    expect(() => loadConfig()).toThrow(/MAX_UPLOAD_MB/);
  });

  it("refuses a photo limit below one, which would accept no photo at all", () => {
    withRequired({ MAX_PHOTOS_PER_MEAL: "0" });
    expect(() => loadConfig()).toThrow(/MAX_PHOTOS_PER_MEAL/);
  });

  it("splits audience lists and drops the empties", () => {
    withRequired({ APPLE_AUDIENCES: "app.ieat, app.ieat.dev ,", GOOGLE_AUDIENCES: "" });
    const c = loadConfig();
    expect(c.appleAudiences).toEqual(["app.ieat", "app.ieat.dev"]);
    // Empty means the provider is OFF, and its route refuses rather than verifying without an
    // audience check. It must never become `[""]`, which would be an audience nothing matches.
    expect(c.googleAudiences).toEqual([]);
  });
});

describe("redact", () => {
  it("keeps the key and the database password out of a printable config", () => {
    withRequired();
    const printed = JSON.stringify(redact(loadConfig()));
    expect(printed).not.toContain("test-key-not-real");
    expect(printed).not.toContain(":p@");
    expect(printed).toContain("***");
  });
});
