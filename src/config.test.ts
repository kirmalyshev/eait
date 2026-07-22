import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadConfig } from "./config.ts";

const REQUIRED = {
  TELEGRAM_BOT_TOKEN: "test-token",
  OPENROUTER_API_KEY: "test-key",
};

describe("loadConfig", () => {
  test("throws listing every missing required var", () => {
    let err: Error | undefined;
    try {
      loadConfig({});
    } catch (e) {
      err = e as Error;
    }
    expect(err).toBeInstanceOf(Error);
    expect(err!.message).toContain("TELEGRAM_BOT_TOKEN");
    expect(err!.message).toContain("OPENROUTER_API_KEY");
  });

  test("treats blank required var as missing", () => {
    expect(() =>
      loadConfig({ TELEGRAM_BOT_TOKEN: "  ", OPENROUTER_API_KEY: "k" }),
    ).toThrow("TELEGRAM_BOT_TOKEN");
  });

  test("applies defaults when optional vars are absent", () => {
    const cfg = loadConfig(REQUIRED);
    expect(cfg.telegramBotToken).toBe("test-token");
    expect(cfg.openrouterApiKey).toBe("test-key");
    expect(cfg.llmProvider).toBe("openrouter");
    expect(cfg.llmModel).toBe("x-ai/grok-4.5");
    expect(cfg.llmTimeoutMs).toBe(60000);
    expect(cfg.pg).toEqual({
      host: "127.0.0.1",
      port: 5439,
      user: "eait",
      password: "eait",
      database: "eait",
    });
    expect(cfg.tz).toBe("Europe/Berlin");
    expect(cfg.perUserDailyPhotoCap).toBe(50);
    expect(cfg.adminUserId).toBeNull();
  });

  test("parses ADMIN_USER_ID to a number", () => {
    const cfg = loadConfig({ ...REQUIRED, ADMIN_USER_ID: "123456789" });
    expect(cfg.adminUserId).toBe(123456789);
    expect(typeof cfg.adminUserId).toBe("number");
  });

  test("ignores a non-numeric ADMIN_USER_ID (null, not NaN)", () => {
    const cfg = loadConfig({ ...REQUIRED, ADMIN_USER_ID: "nope" });
    expect(cfg.adminUserId).toBeNull();
  });

  test("overrides defaults from env", () => {
    const cfg = loadConfig({
      ...REQUIRED,
      LLM_PROVIDER: "some-other-vendor",
      LLM_MODEL: "anthropic/claude-x",
      LLM_TIMEOUT_MS: "1000",
      PGHOST: "db",
      PGPORT: "5432",
      PGUSER: "other",
      PGPASSWORD: "secret",
      PGDATABASE: "eait_feature_x",
      PER_USER_DAILY_PHOTO_CAP: "10",
      TZ: "UTC",
    });
    // LLM_PROVIDER must actually reach the config — hardcoding it in loadConfig would make the
    // whole provider-dispatch seam a no-op while every other test stayed green.
    expect(cfg.llmProvider).toBe("some-other-vendor");
    expect(cfg.llmModel).toBe("anthropic/claude-x");
    expect(cfg.llmTimeoutMs).toBe(1000);
    expect(cfg.pg).toEqual({
      host: "db",
      port: 5432,
      user: "other",
      password: "secret",
      database: "eait_feature_x",
    });
    expect(cfg.perUserDailyPhotoCap).toBe(10);
    expect(cfg.tz).toBe("UTC");
  });

  test("a junk PGPORT falls back to the default rather than NaN", () => {
    expect(loadConfig({ ...REQUIRED, PGPORT: "abc" }).pg.port).toBe(5439);
  });

  test("a database name outside [a-z0-9_] is rejected at startup, not at CREATE DATABASE", () => {
    // The name is interpolated into CREATE DATABASE as an identifier (identifiers cannot be
    // bind-parameterized), so anything but the safe charset must die here.
    expect(() => loadConfig({ ...REQUIRED, PGDATABASE: 'eait"; DROP DATABASE eait;--' })).toThrow(
      /PGDATABASE/,
    );
    expect(() => loadConfig({ ...REQUIRED, PGDATABASE: "eait-dash" })).toThrow(/PGDATABASE/);
  });

  // PHOTO_DIR sat in .env.example and Config for months after nothing read it. This pins the
  // two ends together: a documented var nobody reads, or a read var nobody documents, fails here.
  test(".env.example and loadConfig describe the same variables", () => {
    const documented = new Set(
      readFileSync(new URL("../.env.example", import.meta.url), "utf8")
        .split("\n")
        .map((l) => l.match(/^([A-Z][A-Z0-9_]*)=/)?.[1])
        .filter((k): k is string => Boolean(k)),
    );
    const read = new Set(
      readFileSync(new URL("./config.ts", import.meta.url), "utf8")
        .matchAll(/env\.([A-Z][A-Z0-9_]*)|required\("([A-Z][A-Z0-9_]*)"\)/g)
        .map((m) => m[1] ?? m[2])
        .filter((k): k is string => Boolean(k)),
    );
    expect([...read].filter((k) => !documented.has(k))).toEqual([]);
    expect([...documented].filter((k) => !read.has(k))).toEqual([]);
  });
});

describe("ALLOWED_USER_IDS", () => {
  const base = { TELEGRAM_BOT_TOKEN: "t", OPENROUTER_API_KEY: "k" };

  test("unset means no allowlist (open bot)", () => {
    expect(loadConfig({ ...base }).allowedUserIds).toBeNull();
    expect(loadConfig({ ...base, ALLOWED_USER_IDS: "" }).allowedUserIds).toBeNull();
    expect(loadConfig({ ...base, ALLOWED_USER_IDS: "   " }).allowedUserIds).toBeNull();
  });

  test("parses a comma-separated list, tolerating spaces", () => {
    expect(loadConfig({ ...base, ALLOWED_USER_IDS: "1,2,3" }).allowedUserIds).toEqual([1, 2, 3]);
    expect(loadConfig({ ...base, ALLOWED_USER_IDS: " 10 , 20 " }).allowedUserIds).toEqual([10, 20]);
    expect(loadConfig({ ...base, ALLOWED_USER_IDS: "7" }).allowedUserIds).toEqual([7]);
  });

  test("drops non-numeric entries rather than admitting them", () => {
    // a typo must never silently widen access
    expect(loadConfig({ ...base, ALLOWED_USER_IDS: "1,abc,2" }).allowedUserIds).toEqual([1, 2]);
    expect(loadConfig({ ...base, ALLOWED_USER_IDS: "1,,2," }).allowedUserIds).toEqual([1, 2]);
  });

  test("a list of only junk is a closed allowlist, not an open bot", () => {
    // failing open here would turn a typo into an unauthenticated bot
    expect(loadConfig({ ...base, ALLOWED_USER_IDS: "abc" }).allowedUserIds).toEqual([]);
  });
});

describe("GLOBAL_DAILY_ANALYSIS_CAP", () => {
  const base = { TELEGRAM_BOT_TOKEN: "t", OPENROUTER_API_KEY: "k" };

  test("unset means no global cap", () => {
    expect(loadConfig({ ...base }).globalDailyAnalysisCap).toBeNull();
    expect(loadConfig({ ...base, GLOBAL_DAILY_ANALYSIS_CAP: "" }).globalDailyAnalysisCap).toBeNull();
  });

  test("parses a positive integer", () => {
    expect(loadConfig({ ...base, GLOBAL_DAILY_ANALYSIS_CAP: "200" }).globalDailyAnalysisCap).toBe(200);
  });

  test("zero is a real cap (bot open but analysing nothing), not 'unset'", () => {
    expect(loadConfig({ ...base, GLOBAL_DAILY_ANALYSIS_CAP: "0" }).globalDailyAnalysisCap).toBe(0);
  });

  test("junk is rejected as unlimited rather than silently becoming a tiny cap", () => {
    expect(loadConfig({ ...base, GLOBAL_DAILY_ANALYSIS_CAP: "abc" }).globalDailyAnalysisCap).toBeNull();
    expect(loadConfig({ ...base, GLOBAL_DAILY_ANALYSIS_CAP: "-5" }).globalDailyAnalysisCap).toBeNull();
  });
});
