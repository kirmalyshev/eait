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
 * EAIT__BACKEND__DATABASE_URL" passed on a clean machine and failed on any machine set up to actually run the
 * server. A test whose result depends on an untracked file is not a test.
 *
 * The list is a superset on purpose: a variable added to `loadConfig` and forgotten here can only
 * make a test read the ambient environment again.
 */
const VARS = [
  "EAIT__BACKEND__DATABASE_URL", "EAIT__BACKEND__LLM_API_KEY", "EAIT__BACKEND__LLM_BASE_URL", "EAIT__BACKEND__LLM_TIMEOUT_MS", "EAIT__BACKEND__LLM_MODEL", "EAIT__BACKEND__LLM_PROVIDER",
  "EAIT__BACKEND__PENDING_TTL_MINUTES", "EAIT__BACKEND__MAX_UPLOAD_MB", "EAIT__BACKEND__MAX_PHOTOS_PER_MEAL", "EAIT__BACKEND__PORT", "EAIT__BACKEND__HOST", "EAIT__BACKEND__TZ_NAME",
  "EAIT__BACKEND__FREE_ANALYSES", "EAIT__BACKEND__GLOBAL_DAILY_ANALYSIS_CAP", "EAIT__BACKEND__APPLE_AUDIENCES", "EAIT__BACKEND__GOOGLE_AUDIENCES",
  "EAIT__BACKEND__SESSION_TTL_DAYS", "EAIT__BACKEND__AUTH_RATE_LIMIT_PER_HOUR", "EAIT__BACKEND__ANALYSIS_RATE_LIMIT_PER_DAY",
  "EAIT__BACKEND__SUBSCRIBE_RATE_LIMIT_PER_HOUR", "EAIT__BACKEND__SUBSCRIBE_DAILY_CAP", "EAIT__BACKEND__SUBSCRIBE_CONFIRM_TTL_DAYS",
  "EAIT__BACKEND__ADMIN_TOKEN", "EAIT__BACKEND__MAIL_PROVIDER", "EAIT__BACKEND__MAIL_FROM", "EAIT__BACKEND__RESEND_API_KEY", "EAIT__BACKEND__RESEND_BASE_URL",
  "EAIT__BACKEND__MAIL_TIMEOUT_MS", "EAIT__BACKEND__PUBLIC_API_URL", "EAIT__BACKEND__LANDING_URL",
  "EAIT__BACKEND__PAID_DAILY_PHOTO_CAP", "EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN", "EAIT__BACKEND__REVENUECAT_ACCEPT_SANDBOX",
  "EAIT__BACKEND__REVENUECAT_ENTITLEMENT_ID", "EAIT__BACKEND__USER_DAILY_PHOTO_CAP",
] as const;

/** The two without defaults. Set for every test so `loadConfig` gets past its required checks. */
function withRequired(extra: Record<string, string> = {}) {
  process.env.EAIT__BACKEND__DATABASE_URL = "postgres://u:p@localhost:5432/db";
  process.env.EAIT__BACKEND__LLM_API_KEY = "test-key-not-real";
  for (const [k, v] of Object.entries(extra)) process.env[k] = v;
}

const clear = () => {
  for (const v of VARS) delete process.env[v];
};

beforeEach(clear);
afterEach(clear);

describe("loadConfig", () => {
  it("refuses to start without the two settings that have no safe default", () => {
    expect(() => loadConfig()).toThrow(/EAIT__BACKEND__DATABASE_URL/);
    process.env.EAIT__BACKEND__DATABASE_URL = "postgres://u:p@localhost:5432/db";
    expect(() => loadConfig()).toThrow(/EAIT__BACKEND__LLM_API_KEY/);
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
      EAIT__BACKEND__LLM_BASE_URL: "https://gateway.internal/v1/chat/completions",
      EAIT__BACKEND__LLM_TIMEOUT_MS: "45000",
      EAIT__BACKEND__PENDING_TTL_MINUTES: "5",
      EAIT__BACKEND__MAX_UPLOAD_MB: "8",
      EAIT__BACKEND__MAX_PHOTOS_PER_MEAL: "2",
      EAIT__BACKEND__FREE_ANALYSES: "3",
      EAIT__BACKEND__GLOBAL_DAILY_ANALYSIS_CAP: "7",
      EAIT__BACKEND__TZ_NAME: "America/New_York",
      EAIT__BACKEND__PORT: "9999",
      EAIT__BACKEND__HOST: "0.0.0.0",
    });
    const c = loadConfig();
    expect(c.llmBaseUrl).toBe("https://gateway.internal/v1/chat/completions");
    expect(c.llmTimeoutMs).toBe(45_000);
    expect(c.pendingTtlMs).toBe(5 * 60 * 1000);
    expect(c.maxUploadBytes).toBe(8 * 1024 * 1024);
    expect(c.maxPhotosPerMeal).toBe(2);
    expect(c.freeAnalyses).toBe(3);
    expect(c.globalDailyAnalysisCap).toBe(7);
    expect(c.timezone).toBe("America/New_York");
    expect(c.port).toBe(9999);
    expect(c.host).toBe("0.0.0.0");
  });

  it("rejects a nonsense number rather than coercing it", () => {
    withRequired({ EAIT__BACKEND__MAX_UPLOAD_MB: "twenty" });
    expect(() => loadConfig()).toThrow(/EAIT__BACKEND__MAX_UPLOAD_MB/);
  });

  it("refuses a photo limit below one, which would accept no photo at all", () => {
    withRequired({ EAIT__BACKEND__MAX_PHOTOS_PER_MEAL: "0" });
    expect(() => loadConfig()).toThrow(/EAIT__BACKEND__MAX_PHOTOS_PER_MEAL/);
  });

  it("splits audience lists and drops the empties", () => {
    withRequired({ EAIT__BACKEND__APPLE_AUDIENCES: "app.ieat, app.ieat.dev ,", EAIT__BACKEND__GOOGLE_AUDIENCES: "" });
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

// ── The paid tier ────────────────────────────────────────────────────────────────────────────
//
// Everything here is off or free by default. A server that was never told about RevenueCat has no
// webhook, grants nobody anything, and gives every account the free cap — which is exactly what
// every deployment did before any of this existed.
describe("the paid tier", () => {
  it("is dormant by default: no webhook, one sample analysis, sandbox refused", () => {
    withRequired();
    const c = loadConfig();
    expect(c.revenueCatWebhookToken).toBe("");
    expect(c.freeAnalyses).toBe(1);
    expect(c.revenueCatAcceptSandbox).toBe(false);
  });

  it("reads the sample size, the paid cap and the sandbox switch", () => {
    withRequired({
      EAIT__BACKEND__FREE_ANALYSES: "3",
      EAIT__BACKEND__PAID_DAILY_PHOTO_CAP: "99",
      EAIT__BACKEND__REVENUECAT_ACCEPT_SANDBOX: "1",
    });
    const c = loadConfig();
    expect(c.freeAnalyses).toBe(3);
    expect(c.paidDailyPhotoCap).toBe(99);
    expect(c.revenueCatAcceptSandbox).toBe(true);
  });

  // The old per-day free cap described a tier that no longer exists. Setting it must be a startup
  // error, not a silently ignored variable on a host provisioned before the rename.
  it("refuses the retired free daily cap", () => {
    withRequired({ EAIT__BACKEND__USER_DAILY_PHOTO_CAP: "20" });
    expect(() => loadConfig()).toThrow(/USER_DAILY_PHOTO_CAP/);
  });

  it("names which entitlement grants the tier, defaulting to pro", () => {
    withRequired();
    expect(loadConfig().revenueCatEntitlementId).toBe("pro");
    withRequired({ EAIT__BACKEND__REVENUECAT_ENTITLEMENT_ID: "lifetime" });
    expect(loadConfig().revenueCatEntitlementId).toBe("lifetime");
  });

  // Set-and-weak is the dangerous state: it looks protected and is not, and what is behind it is
  // the ability to mark any account paid.
  it("refuses a webhook token too short to be one", () => {
    withRequired({ EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN: "short" });
    expect(() => loadConfig()).toThrow(/REVENUECAT_WEBHOOK_TOKEN/);
  });

  // RevenueCat sends it verbatim as an Authorization header. A space makes it a header the server
  // parses differently from the one the dashboard shows, and every delivery 404s.
  it("refuses a webhook token with whitespace in it", () => {
    withRequired({ EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN: "a".repeat(12) + " " + "b".repeat(12) });
    expect(() => loadConfig()).toThrow(/whitespace/);
  });

  it("accepts a long one", () => {
    withRequired({ EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN: "z".repeat(40) });
    expect(loadConfig().revenueCatWebhookToken).toBe("z".repeat(40));
  });

  it("never prints the webhook token", () => {
    withRequired({ EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN: "z".repeat(40) });
    const shown = JSON.stringify(redact(loadConfig()));
    expect(shown).not.toContain("z".repeat(40));
    expect(shown).toContain("***");
  });
});
