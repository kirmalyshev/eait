// bun:sqlite datastore: PRAGMAs + user_version migrations + typed, per-user-scoped queries.
// Invariants: meal id = UUID; every meal read/update is `WHERE id = ? AND user_id = ?`;
// dates are computed in Europe/Berlin. No raw image or photo path is ever stored.

import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
// The SQL column default is 'ru' for historical reasons and is left alone (changing it means
// a migration to alter a default that callers always override). DEFAULT_LANG is the real
// policy, applied here so storage and i18n cannot drift apart.
import { DEFAULT_LANG } from "./i18n/registry.ts";
import type {
  DailyTotals,
  Goal,
  MealAnalysis,
  MealItem,
  MealRecord,
  MealVerdicts,
  UserState,
} from "./types.ts";

export interface UserRow {
  telegram_id: number;
  username: string | null;
  lang: string;
  state: UserState;
  consent_at: string | null;
  goal: Goal | null;
  restrictions: string[];
  created_at: string;
  acquisition_source: string | null;
}

export interface EventRow {
  ts: string;
  user_id: number;
  event: string;
  source_code: string | null;
}

export interface NewMeal {
  id: string;
  user_id: number;
  ts: string;
  date: string; // YYYY-MM-DD (Europe/Berlin)
  analysis: MealAnalysis;
  model?: string | null;
  chat_id?: number | null;
  bot_message_id?: number | null;
}

/** YYYY-MM-DD for an instant in the given IANA zone (default Europe/Berlin), not UTC. */
export function berlinDate(d: Date, tz = "Europe/Berlin"): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

export function openDb(path: string): Database {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path, { create: true });
  db.run("PRAGMA journal_mode = WAL");
  db.run("PRAGMA busy_timeout = 5000");
  db.run("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db: Database): void {
  const cur = (db.query("PRAGMA user_version").get() as { user_version: number }).user_version;
  if (cur < 1) {
    db.transaction(() => {
      db.run(`
        CREATE TABLE users (
          telegram_id   INTEGER PRIMARY KEY,
          username      TEXT,
          lang          TEXT NOT NULL DEFAULT 'ru',
          state         TEXT NOT NULL DEFAULT 'consent',
          consent_at    TEXT,
          goal          TEXT,
          restrictions  TEXT NOT NULL DEFAULT '[]',
          created_at    TEXT NOT NULL
        )`);
      db.run(`
        CREATE TABLE meals (
          id                TEXT PRIMARY KEY,
          user_id           INTEGER NOT NULL REFERENCES users(telegram_id),
          ts                TEXT NOT NULL,
          date              TEXT NOT NULL,
          chat_id           INTEGER,
          bot_message_id    INTEGER,
          items             TEXT,
          kcal              REAL, protein_g REAL, carbs_g REAL, fat_g REAL,
          satfat_g          REAL, fiber_g REAL, sugar_g REAL, sodium_mg REAL,
          plant_protein_pct REAL,
          verdicts          TEXT,
          confidence        TEXT,
          notes             TEXT,
          corrected         INTEGER NOT NULL DEFAULT 0,
          model             TEXT
        )`);
      db.run(`CREATE INDEX idx_meals_user_date ON meals(user_id, date)`);
      db.run(`CREATE INDEX idx_meals_reply ON meals(user_id, bot_message_id)`);
      db.run(`
        CREATE TABLE processed_updates (
          update_id INTEGER PRIMARY KEY,
          at        TEXT
        )`);
      db.run("PRAGMA user_version = 1");
    })();
  }
  if (cur < 2) {
    // Runtime overrides that must outlive a restart — currently only the global spend cap,
    // set via the admin /cap command so it can be changed without editing .env and rebooting.
    db.transaction(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`);
      db.run("PRAGMA user_version = 2");
    })();
  }
  if (cur < 3) {
    // Acquisition attribution: which content asset brought a user in (t.me deep-link start
    // payload) and an append-only funnel log. Campaign codes only — never personal data,
    // never anything photo-related.
    db.transaction(() => {
      db.run(`ALTER TABLE users ADD COLUMN acquisition_source TEXT`);
      db.run(`
        CREATE TABLE events (
          ts          TEXT NOT NULL,
          user_id     INTEGER NOT NULL,
          event       TEXT NOT NULL,
          source_code TEXT
        )`);
      db.run(`CREATE INDEX idx_events_user ON events(user_id)`);
      db.run(`CREATE INDEX idx_events_event ON events(event)`);
      db.run("PRAGMA user_version = 3");
    })();
  }
}

// ---------- settings (runtime overrides) ----------

export function getSetting(db: Database, key: string): string | null {
  const row = db.query(`SELECT value FROM settings WHERE key = ?`).get(key) as
    | { value: string }
    | null;
  return row ? row.value : null;
}

export function setSetting(db: Database, key: string, value: string): void {
  db.query(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  ).run(key, value);
}

export function clearSetting(db: Database, key: string): void {
  db.query(`DELETE FROM settings WHERE key = ?`).run(key);
}

// ---------- users ----------

export function upsertUser(
  db: Database,
  u: { telegram_id: number; username?: string | null; lang?: string },
): void {
  // Resume-safe: on conflict only the username is refreshed; consent_at/goal/state/restrictions
  // are left untouched so a mid-onboarding /start does not reset progress.
  db.query(
    `INSERT INTO users (telegram_id, username, lang, state, created_at)
     VALUES (?, ?, ?, 'consent', ?)
     ON CONFLICT(telegram_id) DO UPDATE SET username = excluded.username`,
  ).run(u.telegram_id, u.username ?? null, u.lang ?? DEFAULT_LANG, new Date().toISOString());
}

export function getUser(db: Database, telegram_id: number): UserRow | undefined {
  const row = db
    .query(`SELECT * FROM users WHERE telegram_id = ?`)
    .get(telegram_id) as Record<string, any> | null;
  if (!row) return undefined;
  return {
    telegram_id: row.telegram_id,
    username: row.username,
    lang: row.lang,
    state: row.state,
    consent_at: row.consent_at,
    goal: row.goal,
    restrictions: parseJsonArray(row.restrictions),
    created_at: row.created_at,
    acquisition_source: row.acquisition_source ?? null,
  };
}

/** First-touch only: a user's source is whatever code their FIRST /start carried, forever. */
export function setAcquisitionSource(db: Database, telegram_id: number, source: string): void {
  db.query(
    `UPDATE users SET acquisition_source = ? WHERE telegram_id = ? AND acquisition_source IS NULL`,
  ).run(source, telegram_id);
}

// ---------- events (append-only funnel log) ----------

export function logEvent(
  db: Database,
  user_id: number,
  event: string,
  source_code?: string | null,
): void {
  db.query(`INSERT INTO events (ts, user_id, event, source_code) VALUES (?, ?, ?, ?)`).run(
    new Date().toISOString(),
    user_id,
    event,
    source_code ?? null,
  );
}

export function eventsFor(db: Database, user_id: number): EventRow[] {
  return db
    .query(`SELECT ts, user_id, event, source_code FROM events WHERE user_id = ? ORDER BY rowid`)
    .all(user_id) as EventRow[];
}

export function setUserState(db: Database, telegram_id: number, state: UserState): void {
  db.query(`UPDATE users SET state = ? WHERE telegram_id = ?`).run(state, telegram_id);
}

/** /lang — the only place a user's language changes after it is seeded at first contact. */
export function setLang(db: Database, telegram_id: number, lang: string): void {
  db.query(`UPDATE users SET lang = ? WHERE telegram_id = ?`).run(lang, telegram_id);
}

/** Consent accepted: record consent time and advance to the profile step. */
export function setConsent(db: Database, telegram_id: number, consentAt: string): void {
  db.query(`UPDATE users SET consent_at = ?, state = 'profile' WHERE telegram_id = ?`).run(
    consentAt,
    telegram_id,
  );
}

/** Partial profile update (goal step, then restrictions step). Only provided fields change. */
export function setProfile(
  db: Database,
  telegram_id: number,
  patch: { goal?: Goal; restrictions?: string[]; state?: UserState },
): void {
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.goal !== undefined) {
    sets.push("goal = ?");
    vals.push(patch.goal);
  }
  if (patch.restrictions !== undefined) {
    sets.push("restrictions = ?");
    vals.push(JSON.stringify(patch.restrictions));
  }
  if (patch.state !== undefined) {
    sets.push("state = ?");
    vals.push(patch.state);
  }
  if (sets.length === 0) return;
  vals.push(telegram_id);
  db.query(`UPDATE users SET ${sets.join(", ")} WHERE telegram_id = ?`).run(...(vals as any[]));
}

export function deleteUser(db: Database, user_id: number): void {
  // No ON DELETE CASCADE in the schema (spec §6) + foreign_keys=ON, so meals go first.
  db.transaction(() => {
    db.query(`DELETE FROM meals WHERE user_id = ?`).run(user_id);
    db.query(`DELETE FROM users WHERE telegram_id = ?`).run(user_id);
  })();
}

export function userCount(db: Database): number {
  return (db.query(`SELECT COUNT(*) AS n FROM users`).get() as { n: number }).n;
}

// ---------- meals ----------

export function insertMeal(db: Database, m: NewMeal): void {
  const a = m.analysis;
  db.query(
    `INSERT INTO meals (
       id, user_id, ts, date, chat_id, bot_message_id, items,
       kcal, protein_g, carbs_g, fat_g, satfat_g, fiber_g, sugar_g, sodium_mg,
       plant_protein_pct, verdicts, confidence, notes, corrected, model
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
  ).run(
    m.id,
    m.user_id,
    m.ts,
    m.date,
    m.chat_id ?? null,
    m.bot_message_id ?? null,
    JSON.stringify(a.items ?? []),
    a.kcal,
    a.protein_g,
    a.carbs_g,
    a.fat_g,
    a.satfat_g,
    a.fiber_g,
    a.sugar_g,
    a.sodium_mg,
    a.plant_protein_pct,
    JSON.stringify(a.verdicts ?? {}),
    a.confidence ?? null,
    a.notes ?? null,
    m.model ?? null,
  );
}

export function getMeal(db: Database, id: string, user_id: number): MealRecord | undefined {
  const row = db
    .query(`SELECT * FROM meals WHERE id = ? AND user_id = ?`)
    .get(id, user_id) as Record<string, any> | null;
  return row ? rowToMeal(row) : undefined;
}

export function setMealReply(
  db: Database,
  id: string,
  user_id: number,
  chat_id: number,
  bot_message_id: number,
): void {
  db.query(
    `UPDATE meals SET chat_id = ?, bot_message_id = ? WHERE id = ? AND user_id = ?`,
  ).run(chat_id, bot_message_id, id, user_id);
}

/** Correction: patch macro/verdict fields for THIS meal only, marking it corrected. */
export function applyCorrection(
  db: Database,
  id: string,
  user_id: number,
  patch: Partial<MealAnalysis>,
): void {
  const columns: Array<keyof MealAnalysis> = [
    "kcal",
    "protein_g",
    "carbs_g",
    "fat_g",
    "satfat_g",
    "fiber_g",
    "sugar_g",
    "sodium_mg",
    "plant_protein_pct",
    "confidence",
    "notes",
  ];
  const sets: string[] = [];
  const vals: unknown[] = [];
  for (const c of columns) {
    if (patch[c] !== undefined) {
      sets.push(`${c} = ?`);
      vals.push(patch[c]);
    }
  }
  if (patch.items !== undefined) {
    sets.push("items = ?");
    vals.push(JSON.stringify(patch.items));
  }
  if (patch.verdicts !== undefined) {
    sets.push("verdicts = ?");
    vals.push(JSON.stringify(patch.verdicts));
  }
  sets.push("corrected = 1");
  vals.push(id, user_id);
  db.query(`UPDATE meals SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`).run(
    ...(vals as any[]),
  );
}

export function mealByReply(
  db: Database,
  user_id: number,
  bot_message_id: number,
): MealRecord | undefined {
  const row = db
    .query(`SELECT * FROM meals WHERE user_id = ? AND bot_message_id = ?`)
    .get(user_id, bot_message_id) as Record<string, any> | null;
  return row ? rowToMeal(row) : undefined;
}

export function dailyTotals(db: Database, user_id: number, date: string): DailyTotals {
  const row = db
    .query(
      `SELECT
         COALESCE(SUM(kcal),0)              AS kcal,
         COALESCE(SUM(protein_g),0)         AS protein_g,
         COALESCE(SUM(carbs_g),0)           AS carbs_g,
         COALESCE(SUM(fat_g),0)             AS fat_g,
         COALESCE(SUM(satfat_g),0)          AS satfat_g,
         COALESCE(SUM(fiber_g),0)           AS fiber_g,
         COALESCE(SUM(sugar_g),0)           AS sugar_g,
         COALESCE(SUM(sodium_mg),0)         AS sodium_mg
       FROM meals WHERE user_id = ? AND date = ?`,
    )
    .get(user_id, date) as DailyTotals;
  return row;
}

/**
 * Meals analyzed across ALL users on a date — the denominator for the global spend cap.
 * Per-user caps bound one account; this bounds the bill when the bot is publicly linked.
 */
export function mealCountToday(db: Database, date: string): number {
  const row = db.query(`SELECT COUNT(*) AS n FROM meals WHERE date = ?`).get(date) as { n: number };
  return row.n;
}

export function countMealsToday(db: Database, user_id: number, date: string): number {
  return (
    db.query(`SELECT COUNT(*) AS n FROM meals WHERE user_id = ? AND date = ?`).get(user_id, date) as {
      n: number;
    }
  ).n;
}

export function mealCount(db: Database): number {
  return (db.query(`SELECT COUNT(*) AS n FROM meals`).get() as { n: number }).n;
}

export function hasMeals(db: Database, user_id: number): boolean {
  return db.query(`SELECT 1 FROM meals WHERE user_id = ? LIMIT 1`).get(user_id) !== null;
}

// ---------- update dedupe ----------

export function seenUpdate(db: Database, update_id: number): boolean {
  return db.query(`SELECT 1 FROM processed_updates WHERE update_id = ?`).get(update_id) !== null;
}

export function markUpdate(db: Database, update_id: number): void {
  db.query(`INSERT OR IGNORE INTO processed_updates (update_id, at) VALUES (?, ?)`).run(
    update_id,
    new Date().toISOString(),
  );
}

// ---------- helpers ----------

function parseJsonArray(s: unknown): string[] {
  if (typeof s !== "string" || s.trim() === "") return [];
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function parseVerdicts(s: unknown): MealVerdicts {
  if (typeof s !== "string" || s.trim() === "") return {};
  try {
    const v = JSON.parse(s);
    return v && typeof v === "object" ? v : {};
  } catch {
    return {};
  }
}

function parseItems(s: unknown): MealItem[] {
  const arr = parseJsonArray(s) as unknown[];
  return arr.filter((x): x is MealItem => !!x && typeof x === "object");
}

function rowToMeal(row: Record<string, any>): MealRecord {
  return {
    id: row.id,
    user_id: row.user_id,
    ts: row.ts,
    date: row.date,
    chat_id: row.chat_id,
    bot_message_id: row.bot_message_id,
    items: parseItems(row.items),
    kcal: row.kcal,
    protein_g: row.protein_g,
    carbs_g: row.carbs_g,
    fat_g: row.fat_g,
    satfat_g: row.satfat_g,
    fiber_g: row.fiber_g,
    sugar_g: row.sugar_g,
    sodium_mg: row.sodium_mg,
    plant_protein_pct: row.plant_protein_pct,
    verdicts: parseVerdicts(row.verdicts),
    confidence: row.confidence,
    notes: row.notes,
    corrected: row.corrected === 1,
    model: row.model,
  };
}
