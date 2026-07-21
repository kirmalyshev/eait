import { describe, expect, test } from "bun:test";
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
    expect(cfg.llmModel).toBe("qwen/qwen3-vl-235b-a22b-instruct");
    expect(cfg.llmTimeoutMs).toBe(60000);
    expect(cfg.dbPath).toBe("./data/eait.sqlite");
    expect(cfg.photoDir).toBe("./photos");
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
      LLM_MODEL: "anthropic/claude-x",
      LLM_TIMEOUT_MS: "1000",
      PER_USER_DAILY_PHOTO_CAP: "10",
      TZ: "UTC",
    });
    expect(cfg.llmModel).toBe("anthropic/claude-x");
    expect(cfg.llmTimeoutMs).toBe(1000);
    expect(cfg.perUserDailyPhotoCap).toBe(10);
    expect(cfg.tz).toBe("UTC");
  });
});
