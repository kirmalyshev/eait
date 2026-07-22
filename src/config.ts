// env -> typed config. Fails fast (listing ALL missing required vars) so misconfig can't
// reach the network or the db. loadConfig takes an env object so it is testable without process.env.

import { REPLY_FORMATS, isReplyFormat } from "./types.ts";
import type { ReplyFormat } from "./types.ts";

/** Postgres connection settings. Standard libpq env names, so psql sees the same world. */
export interface PgConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  database: string;
  /** Pool size. Defaults to 10 in openDb; tests pass 1 so dozens of per-test databases don't exhaust the server. */
  max?: number;
}

export interface Config {
  telegramBotToken: string;
  openrouterApiKey: string;
  llmProvider: string;
  llmModel: string;
  llmTimeoutMs: number;
  pg: PgConfig;
  tz: string;
  perUserDailyPhotoCap: number;
  adminUserId: number | null;
  /**
   * Telegram user ids permitted to use the bot. `null` means NO allowlist — anyone who finds
   * the bot can onboard and spend your LLM budget. An empty array means nobody is allowed.
   */
  allowedUserIds: number[] | null;
  /**
   * Ceiling on meal analyses per day across EVERY user — the spend bound for a publicly
   * linked instance. `null` means unlimited. Per-user caps bound one account; only this
   * bounds the bill when strangers can reach the bot.
   */
  globalDailyAnalysisCap: number | null;
  /**
   * INSTANCE-DEFAULT meal-card rendering: "rich" = Telegram Rich Messages (Bot API 10.1
   * tables/headings, automatic plain fallback on a failed send), "plain" = text with emojis.
   * A user's /settings → Style choice (users.reply_format) overrides it — resolve via
   * replyFormatFor, never read this field directly at a meal-card site.
   */
  replyFormat: ReplyFormat;
}

type Env = Record<string, string | undefined>;

function intOr(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === "") return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function loadConfig(env: Env): Config {
  const missing: string[] = [];
  const required = (name: string): string => {
    const v = env[name];
    if (v === undefined || v.trim() === "") {
      missing.push(name);
      return "";
    }
    return v;
  };

  const telegramBotToken = required("TELEGRAM_BOT_TOKEN");
  const openrouterApiKey = required("OPENROUTER_API_KEY");

  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }

  const adminRaw = env.ADMIN_USER_ID;
  const adminUserId =
    adminRaw !== undefined && adminRaw.trim() !== "" && Number.isFinite(Number(adminRaw))
      ? Number(adminRaw)
      : null;

  // Absent/blank -> null (open). Present -> only the ids that actually parse. A typo'd entry is
  // dropped rather than admitted, and an all-junk value yields an EMPTY allowlist, never an open
  // bot: failing open here would turn a config typo into an unauthenticated, billable bot.
  const allowedRaw = env.ALLOWED_USER_IDS?.trim();
  const allowedUserIds =
    allowedRaw
      ? allowedRaw
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s !== "" && Number.isFinite(Number(s)))
          .map(Number)
      : null;

  // Only a non-negative integer is a cap. Junk and negatives mean "unset" rather than being
  // coerced — silently turning a typo into a cap of 0 would take the bot offline, and into a
  // tiny cap would be worse (looks alive, serves nobody).
  const capRaw = env.GLOBAL_DAILY_ANALYSIS_CAP?.trim();
  const capNum = capRaw ? Number(capRaw) : NaN;
  const globalDailyAnalysisCap =
    Number.isInteger(capNum) && capNum >= 0 ? capNum : null;

  // The database name is interpolated into CREATE DATABASE as an identifier (identifiers
  // cannot be bind-parameterized), so anything outside the safe charset must die here — at
  // startup with a readable message — not inside a SQL string.
  const pgDatabase = env.PGDATABASE?.trim() || "eait";
  if (!/^[a-z_][a-z0-9_]*$/.test(pgDatabase)) {
    throw new Error(
      `PGDATABASE must match [a-z_][a-z0-9_]* (got ${JSON.stringify(pgDatabase)})`,
    );
  }
  // Same policy as LLM_PROVIDER: an unknown value dies at startup, never a silent fallback.
  const replyFormat = env.REPLY_FORMAT?.trim() || "rich";
  if (!isReplyFormat(replyFormat)) {
    throw new Error(`REPLY_FORMAT must be one of ${REPLY_FORMATS.map((v) => `"${v}"`).join(" | ")} (got ${JSON.stringify(replyFormat)})`);
  }

  const pg: PgConfig = {
    host: env.PGHOST?.trim() || "127.0.0.1",
    port: intOr(env.PGPORT, 5439),
    user: env.PGUSER?.trim() || "eait",
    password: env.PGPASSWORD?.trim() || "eait",
    database: pgDatabase,
  };

  return {
    telegramBotToken,
    openrouterApiKey,
    allowedUserIds,
    globalDailyAnalysisCap,
    llmProvider: env.LLM_PROVIDER?.trim() || "openrouter",
    llmModel: env.LLM_MODEL?.trim() || "x-ai/grok-4.5",
    llmTimeoutMs: intOr(env.LLM_TIMEOUT_MS, 60000),
    pg,
    tz: env.TZ?.trim() || "Europe/Berlin",
    perUserDailyPhotoCap: intOr(env.PER_USER_DAILY_PHOTO_CAP, 50),
    adminUserId,
    replyFormat,
  };
}
