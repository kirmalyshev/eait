// Configuration is only useful if it is actually read.
//
// Every value here exists because it differs between development and production. A setting that
// silently ignores its variable is worse than a hardcoded constant: the constant is at least
// honest about not being configurable, while this looks configured and is not.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { configDefaults, demoConfig, loadConfig, redact } from "./config.ts";

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
  "EAIT__BACKEND__LLM_GLANCE_MODEL", "EAIT__BACKEND__LLM_REASONING_EFFORT",
  "EAIT__BACKEND__DATABASE_URL", "EAIT__BACKEND__LLM_API_KEY", "EAIT__BACKEND__LLM_BASE_URL", "EAIT__BACKEND__LLM_TIMEOUT_MS", "EAIT__BACKEND__LLM_MODEL", "EAIT__BACKEND__LLM_PROVIDER",
  "EAIT__BACKEND__LLM_MAX_TOKENS", "EAIT__BACKEND__LLM_CHAT_MODEL",
  "EAIT__BACKEND__PENDING_TTL_MINUTES", "EAIT__BACKEND__MAX_UPLOAD_MB", "EAIT__BACKEND__MAX_PHOTOS_PER_MEAL", "EAIT__BACKEND__PORT", "EAIT__BACKEND__HOST", "EAIT__BACKEND__TZ_NAME",
  "EAIT__BACKEND__FREE_ANALYSES", "EAIT__BACKEND__GLOBAL_DAILY_ANALYSIS_CAP", "EAIT__BACKEND__APPLE_AUDIENCES", "EAIT__BACKEND__GOOGLE_AUDIENCES",
  "EAIT__BACKEND__SESSION_TTL_DAYS", "EAIT__BACKEND__AUTH_RATE_LIMIT_PER_HOUR", "EAIT__BACKEND__ANALYSIS_RATE_LIMIT_PER_DAY",
  "EAIT__BACKEND__SUBSCRIBE_RATE_LIMIT_PER_HOUR", "EAIT__BACKEND__LINES_RATE_LIMIT_PER_HOUR", "EAIT__BACKEND__SUBSCRIBE_DAILY_CAP", "EAIT__BACKEND__SUBSCRIBE_CONFIRM_TTL_DAYS",
  "EAIT__BACKEND__ADMIN_TOKEN", "EAIT__BACKEND__MAIL_PROVIDER", "EAIT__BACKEND__MAIL_FROM", "EAIT__BACKEND__RESEND_API_KEY", "EAIT__BACKEND__RESEND_BASE_URL",
  "EAIT__BACKEND__MAIL_TIMEOUT_MS", "EAIT__BACKEND__PUBLIC_API_URL", "EAIT__BACKEND__LANDING_URL",
  "EAIT__BACKEND__PAID_DAILY_PHOTO_CAP", "EAIT__BACKEND__REVENUECAT_WEBHOOK_TOKEN", "EAIT__BACKEND__REVENUECAT_ACCEPT_SANDBOX",
  "EAIT__BACKEND__REVENUECAT_ENTITLEMENT_ID", "EAIT__BACKEND__USER_DAILY_PHOTO_CAP",
  "EAIT__BACKEND__PUSH_ENABLED", "EAIT__BACKEND__EXPO_PUSH_ACCESS_TOKEN", "EAIT__BACKEND__PUSH_TIMEOUT_MS",
  "EAIT__BACKEND__EVENING_LINE_TIME",
  "EAIT__BACKEND__GOOGLE_WEB_CLIENT_ID", "EAIT__BACKEND__GOOGLE_WEB_CLIENT_SECRET", "EAIT__BACKEND__WEB_CHECKOUT_URL",
  "EAIT__BACKEND__APPLE_SERVICE_ID", "EAIT__BACKEND__APPLE_TEAM_ID", "EAIT__BACKEND__APPLE_KEY_ID",
  "EAIT__BACKEND__APPLE_PRIVATE_KEY",
] as const;

/** A syntactically real PKCS#8 PEM. Nothing here signs with it — `web-oauth.test.ts` does that. */
const P8 = "-----BEGIN " + "PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49\n-----END " + "PRIVATE KEY-----";
const APPLE_WEB = {
  EAIT__BACKEND__APPLE_AUDIENCES: "com.eait.fit.ios, fit.eait.web",
  EAIT__BACKEND__APPLE_SERVICE_ID: "fit.eait.web",
  EAIT__BACKEND__APPLE_TEAM_ID: "TEAM123456",
  EAIT__BACKEND__APPLE_KEY_ID: "KEY1234567",
  EAIT__BACKEND__APPLE_PRIVATE_KEY: P8,
};

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

  it("reads the glance model and the reasoning effort, with a glance model by default and no effort by default", () => {
    const d = configDefaults();
    expect(d.llmGlanceModel).toBe("x-ai/grok-4.3");
    expect(d.llmReasoningEffort).toBe("");
    withRequired({ EAIT__BACKEND__LLM_GLANCE_MODEL: "", EAIT__BACKEND__LLM_REASONING_EFFORT: "low" });
    const c = loadConfig();
    expect(c.llmGlanceModel).toBe("");
    expect(c.llmReasoningEffort).toBe("low");
  });

  it("refuses a reasoning effort the provider would 400 on every charged call", () => {
    withRequired({ EAIT__BACKEND__LLM_REASONING_EFFORT: "lo" });
    expect(() => loadConfig()).toThrow(/LLM_REASONING_EFFORT/);
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
    expect(c.llmMaxTokens).toBe(d.llmMaxTokens);
  });

  it("reads every environment-specific knob from the environment", () => {
    withRequired({
      EAIT__BACKEND__LLM_BASE_URL: "https://gateway.internal/v1/chat/completions",
      EAIT__BACKEND__LLM_TIMEOUT_MS: "45000",
      EAIT__BACKEND__LLM_MAX_TOKENS: "12345",
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
    expect(c.llmMaxTokens).toBe(12345);
    expect(c.pendingTtlMs).toBe(5 * 60 * 1000);
    expect(c.maxUploadBytes).toBe(8 * 1024 * 1024);
    expect(c.maxPhotosPerMeal).toBe(2);
    expect(c.freeAnalyses).toBe(3);
    expect(c.globalDailyAnalysisCap).toBe(7);
    expect(c.timezone).toBe("America/New_York");
    expect(c.port).toBe(9999);
    expect(c.host).toBe("0.0.0.0");
  });

  // Zero is the local idiom for "no limit" — the caps and the rate limits in this same file all
  // document it that way. It cannot mean that here: `max_tokens: 0` is a bound OF zero, so every
  // call returns nothing and the whole app is down with no startup error to explain it.
  it("refuses a completion bound of zero, which the neighbouring settings would read as 'off'", () => {
    withRequired({ EAIT__BACKEND__LLM_MAX_TOKENS: "0" });
    expect(() => loadConfig()).toThrow(/EAIT__BACKEND__LLM_MAX_TOKENS/);
  });

  // 1614 is what one real meal analysis measured, reasoning included. A bound under that does not
  // fail some calls, it fails EVERY call — and now terminally, since truncation stopped being
  // retried. So the floor has to sit above the measurement, not merely above zero.
  it("refuses a completion bound under what a measured analysis needs", () => {
    withRequired({ EAIT__BACKEND__LLM_MAX_TOKENS: "1200" });
    expect(() => loadConfig()).toThrow(/EAIT__BACKEND__LLM_MAX_TOKENS/);
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
    withRequired({ EAIT__BACKEND__APPLE_AUDIENCES: "com.eait.fit.ios, com.eait.fit.ios.dev ,", EAIT__BACKEND__GOOGLE_AUDIENCES: "" });
    const c = loadConfig();
    expect(c.appleAudiences).toEqual(["com.eait.fit.ios", "com.eait.fit.ios.dev"]);
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

  it("keeps the Google web client secret out of it too", () => {
    withRequired({
      EAIT__BACKEND__GOOGLE_AUDIENCES: "web.apps.googleusercontent.com",
      EAIT__BACKEND__GOOGLE_WEB_CLIENT_ID: "web.apps.googleusercontent.com",
      EAIT__BACKEND__GOOGLE_WEB_CLIENT_SECRET: "GOCSPX-not-a-real-secret",
    });
    const printed = JSON.stringify(redact(loadConfig()));
    expect(printed).not.toContain("GOCSPX-not-a-real-secret");
    // The id is not a secret and is worth reading in a boot log — it says which client /start uses.
    expect(printed).toContain("web.apps.googleusercontent.com");
  });
});

// ── Onboarding in a browser ──────────────────────────────────────────────────────────────────
//
// Both refusals below have the same shape and the same reason: a `/start` that renders, consents
// and then fails is worse than one that answers 404, and neither failure is visible from outside.
describe("the web onboarding", () => {
  it("refuses a web client id that is not in the audience list", () => {
    withRequired({
      EAIT__BACKEND__GOOGLE_AUDIENCES: "ios.apps.googleusercontent.com",
      EAIT__BACKEND__GOOGLE_WEB_CLIENT_ID: "web.apps.googleusercontent.com",
      EAIT__BACKEND__GOOGLE_WEB_CLIENT_SECRET: "s",
    });
    expect(() => loadConfig()).toThrow(/GOOGLE_AUDIENCES/);
  });

  it("accepts one that is, and stays off when no id is set at all", () => {
    withRequired({
      EAIT__BACKEND__GOOGLE_AUDIENCES: "ios.apps.googleusercontent.com, web.apps.googleusercontent.com",
      EAIT__BACKEND__GOOGLE_WEB_CLIENT_ID: "web.apps.googleusercontent.com",
    });
    expect(loadConfig().googleWebClientId).toBe("web.apps.googleusercontent.com");
    withRequired({ EAIT__BACKEND__GOOGLE_AUDIENCES: "" });
    delete process.env.EAIT__BACKEND__GOOGLE_WEB_CLIENT_ID;
    expect(loadConfig().googleWebClientId).toBe("");
  });

  // Sign in with Apple in a browser is a SECOND CLIENT — a Service ID, not the bundle id — so it
  // has its own audience, its own key, and its own version of every way to configure it half-way.
  it("accepts the four Apple web settings together", () => {
    withRequired(APPLE_WEB);
    const c = loadConfig();
    expect(c.appleServiceId).toBe("fit.eait.web");
    expect(c.appleTeamId).toBe("TEAM123456");
    expect(c.appleKeyId).toBe("KEY1234567");
    expect(c.applePrivateKey).toContain("BEGIN PRIVATE KEY");
    // The bundle id is still in the list. The app signs in as that and a browser as the Service ID;
    // dropping either silently switches off one of the two surfaces.
    expect(c.appleAudiences).toContain("com.eait.fit.ios");
  });

  it("refuses three of the four, naming the one that is missing", () => {
    const { EAIT__BACKEND__APPLE_KEY_ID: _omitted, ...three } = APPLE_WEB;
    withRequired(three);
    expect(() => loadConfig()).toThrow(/APPLE_KEY_ID/);
  });

  it("refuses a Service ID that is not in the Apple audience list", () => {
    withRequired({ ...APPLE_WEB, EAIT__BACKEND__APPLE_AUDIENCES: "com.eait.fit.ios" });
    expect(() => loadConfig()).toThrow(/APPLE_AUDIENCES/);
  });

  it("refuses a private key that is not a PKCS#8 PEM, at boot rather than mid-callback", () => {
    withRequired({ ...APPLE_WEB, EAIT__BACKEND__APPLE_PRIVATE_KEY: "MIGHAgEAMBMGByqGSM49" });
    expect(() => loadConfig()).toThrow(/PKCS#8/);
  });

  it("puts the newlines back into a key written on one line", () => {
    // Which is how it has to travel: a `.env` file, a compose `environment:` block and an ansible
    // template have three different answers to a literal newline in a value, and one answer to
    // `\n`.
    withRequired({
      ...APPLE_WEB,
      EAIT__BACKEND__APPLE_PRIVATE_KEY: P8.replace(/\n/g, "\\n"),
    });
    expect(loadConfig().applePrivateKey).toBe(P8);
  });

  it("keeps the Apple private key out of a printed config", () => {
    withRequired(APPLE_WEB);
    const printed = JSON.stringify(redact(loadConfig()));
    expect(printed).not.toContain("MIGHAgEAMBMGByqGSM49");
    // The Service ID, the team and the key id are not secrets and say which client /start uses.
    expect(printed).toContain("fit.eait.web");
    expect(printed).toContain("KEY1234567");
  });

  it("stays off when none of the four is set, which is every host that has not created one", () => {
    withRequired();
    const c = loadConfig();
    expect(c.appleServiceId).toBe("");
    expect(c.applePrivateKey).toBe("");
  });

  it("refuses a checkout link with no {userId} in it", () => {
    withRequired({ EAIT__BACKEND__WEB_CHECKOUT_URL: "https://pay.rev.cat/eait" });
    expect(() => loadConfig()).toThrow(/\{userId\}/);
    withRequired({ EAIT__BACKEND__WEB_CHECKOUT_URL: "https://pay.rev.cat/eait/{userId}" });
    expect(loadConfig().webCheckoutUrl).toBe("https://pay.rev.cat/eait/{userId}");
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
    expect(loadConfig().revenueCatEntitlementId).toBe("eait_fit_pro");
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

// ── Notifications ────────────────────────────────────────────────────────────────────────────
//
// Off by default and silent by default. A server that was never told about Expo sends nothing, and
// one that was told to send without a credential still sends nothing — Expo accepts unauthenticated
// pushes, and the fallback must not be to make one.
describe("notifications", () => {
  it("is off, unauthenticated and at 20:30 by default", () => {
    withRequired();
    const c = loadConfig();
    expect(c.pushEnabled).toBe(false);
    expect(c.expoPushAccessToken).toBe("");
    expect(c.eveningLineTime).toEqual({ hour: 20, minute: 30 });
  });

  it("reads the switch, the credential and the time", () => {
    withRequired({
      EAIT__BACKEND__PUSH_ENABLED: "true",
      EAIT__BACKEND__EXPO_PUSH_ACCESS_TOKEN: "expo-token-not-real",
      EAIT__BACKEND__EVENING_LINE_TIME: "21:05",
      EAIT__BACKEND__PUSH_TIMEOUT_MS: "5000",
    });
    const c = loadConfig();
    expect(c.pushEnabled).toBe(true);
    expect(c.expoPushAccessToken).toBe("expo-token-not-real");
    expect(c.eveningLineTime).toEqual({ hour: 21, minute: 5 });
    expect(c.pushTimeoutMs).toBe(5000);
  });

  it("refuses a time that is not HH:MM rather than falling back to 20:30", () => {
    for (const bad of ["2030", "24:00", "8:5", "20:60", "twenty thirty"]) {
      withRequired({ EAIT__BACKEND__EVENING_LINE_TIME: bad });
      expect(() => loadConfig()).toThrow(/EVENING_LINE_TIME/);
    }
  });

  it("keeps the Expo credential out of a printable config", () => {
    withRequired({ EAIT__BACKEND__EXPO_PUSH_ACCESS_TOKEN: "expo-token-not-real" });
    const printed = JSON.stringify(redact(loadConfig()));
    expect(printed).not.toContain("expo-token-not-real");
    expect(printed).toContain("***");
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// A DEMO HAS EXACTLY ONE ADDRESS, SO A PER-ADDRESS LIMIT THERE REFUSES THE TEST SUITE.
//
// `api/ratelimit.ts` bounds the billed routes and the account-minting route per address, because
// `POST /v1/auth/device` mints an account for anybody with a 32-character string. That is the right
// control on a public instance and it is meaningless on a local demo, where every request comes off
// 127.0.0.1 — one bucket for the whole simulator.
//
// `bun run e2e` clears state and mints a fresh account per flow, three flows run 01-onboarding as a
// subflow, and a failed flow is retried once — so a single suite spends well past the production
// default of 20 sign-ins an hour. What the developer then sees is the app's own "Too many sign-ins
// from this network just now", six flows red, and every message naming an app string. A gate that
// fails on its own load, in words that describe the product, is worse than no gate.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("demo mode", () => {
  it("does not rate-limit by address, because a demo is one address", () => {
    const d = demoConfig();
    // A full suite is ~15 mints and a few hundred requests; these have to be out of reach of any
    // number of local runs, not merely larger than one.
    expect(d.authRateLimitPerHour).toBeGreaterThanOrEqual(100_000);
    expect(d.linesRateLimitPerHour).toBeGreaterThanOrEqual(100_000);
    expect(d.healthSyncRateLimitPerHour).toBeGreaterThanOrEqual(100_000);
    expect(d.analysisRateLimitPerDay).toBeGreaterThanOrEqual(100_000);
  });

  it("still starts from the shared defaults, so a new setting is present rather than absent", () => {
    const d = demoConfig();
    expect(d.databaseUrl).toBe("memory://demo");
    expect(d.llmProvider).toBe("demo");
    expect(d.maxPhotosPerMeal).toBe(configDefaults().maxPhotosPerMeal);
  });

  it("leaves the production defaults alone", () => {
    const p = configDefaults();
    expect(p.authRateLimitPerHour).toBe(20);
    expect(p.linesRateLimitPerHour).toBe(120);
  });
});

// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE ENTITLEMENT IDENTIFIER, IN THE THREE PLACES A DEPLOY CAN READ IT FROM
//
// `applyRevenueCatEvent` acts on one identifier and ignores every delivery that does not carry it,
// answering 200 to each — so a host configured with the wrong one takes real money and grants
// nothing, on every purchase, with one warning line per event as the only trace.
//
// All three said `pro`, which has never existed in the RevenueCat project: the ansible default
// (which is what actually renders `.env.prod`), the compose fallback, and the example file people
// copy. Only `config.ts` was right. This is the test that stops them drifting apart again.
// ─────────────────────────────────────────────────────────────────────────────────────────────
describe("the RevenueCat entitlement identifier", () => {
  const expected = configDefaults().revenueCatEntitlementId;

  it("is what the ansible role deploys", async () => {
    const yaml = await Bun.file(
      new URL("./iac/roles/eait_app/defaults/main.yml", import.meta.url),
    ).text();
    expect(yaml).toContain(`eait_revenuecat_entitlement_id: ${expected}`);
  });

  it("is the compose fallback", async () => {
    const compose = await Bun.file(
      new URL("../../deploy/docker-compose.prod.yml", import.meta.url),
    ).text();
    expect(compose).toContain(`\${EAIT__BACKEND__REVENUECAT_ENTITLEMENT_ID:-${expected}}`);
  });

  it("is what the example env file hands somebody starting from it", async () => {
    const example = await Bun.file(
      new URL("../../deploy/.env.prod.example", import.meta.url),
    ).text();
    expect(example).toContain(`EAIT__BACKEND__REVENUECAT_ENTITLEMENT_ID=${expected}`);
  });
});
