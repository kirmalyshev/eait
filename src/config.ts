// env -> typed config. Fails fast (listing ALL missing required vars) so misconfig can't
// reach the network or the db. loadConfig takes an env object so it is testable without process.env.

export interface Config {
  telegramBotToken: string;
  openrouterApiKey: string;
  llmProvider: string;
  llmModel: string;
  llmTimeoutMs: number;
  dbPath: string;
  photoDir: string;
  tz: string;
  perUserDailyPhotoCap: number;
  adminUserId: number | null;
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

  return {
    telegramBotToken,
    openrouterApiKey,
    llmProvider: env.LLM_PROVIDER?.trim() || "openrouter",
    llmModel: env.LLM_MODEL?.trim() || "openai/gpt-5.2",
    llmTimeoutMs: intOr(env.LLM_TIMEOUT_MS, 60000),
    dbPath: env.DB_PATH?.trim() || "./data/eait.sqlite",
    photoDir: env.PHOTO_DIR?.trim() || "./photos",
    tz: env.TZ?.trim() || "Europe/Berlin",
    perUserDailyPhotoCap: intOr(env.PER_USER_DAILY_PHOTO_CAP, 50),
    adminUserId,
  };
}
