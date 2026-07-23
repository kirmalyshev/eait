// Postgres datastore (Bun.sql): branch database auto-created on open + versioned migrations +
// typed, per-user-scoped queries. Invariants: meal id = UUID; every meal read/update is
// `WHERE id = ? AND user_id = ?`; dates are computed in Europe/Berlin. No raw image or photo
// path is ever stored.
//
// The server is the shared dev/prod instance (docker-compose.infra.yml locally); each branch
// worktree points PGDATABASE at its own database, so parallel instances never share state.

import { SQL } from "bun";
import type { PgConfig } from "./config.ts";
// The SQL column default is 'ru' for historical reasons and is left alone (changing it means
// a migration to alter a default that callers always override). DEFAULT_LANG is the real
// policy, applied here so storage and i18n cannot drift apart.
import { DEFAULT_LANG } from "./i18n/registry.ts";
// Schema validation for pending-meal blobs on read — the analyzer's "invalid output never
// poisons totals" contract must hold for rows that sat in the db, not just fresh parses.
import { MealAnalysisSchema } from "./analyzer.ts";
import type {
  DailyTotals,
  DayTotals,
  Goal,
  MealAnalysis,
  MealItem,
  MealRecord,
  MealVerdicts,
  ReplyFormat,
  UserState,
} from "./types.ts";

/** A connected, migrated database handle. */
export type Db = SQL;

export interface UserRow {
  telegram_id: number;
  username: string | null;
  lang: string;
  state: UserState;
  consent_at: string | null;
  goal: Goal | null;
  /** NULL = never asked, 0 = explicitly skipped during onboarding, >0 = kilograms. */
  weight_kg: number | null;
  /** Same sentinel as weight_kg: NULL = never asked, 0 = skipped, >0 = target kilograms. */
  target_weight_kg: number | null;
  /**
   * Purchase country — where the user buys most of their food, steering the analyzer toward local
   * products and portion norms. NULL = never asked, '' = explicitly skipped, else a curated code
   * (`de`/`ru`/…) or a raw "other" string. Both sentinels map to null at the profileOf boundary.
   */
  country: string | null;
  restrictions: string[];
  /**
   * Free-text "food specifics" — the open-ended companions to the closed `restrictions` tag
   * vocabulary. Where a restriction is one of four tags that drives a numeric cap and a structured
   * verdict, these are prompt-only text. Three labelled fields: medical conditions/needs,
   * allergies (safety-critical), and specific products the user avoids. Same sentinels as
   * `country` on each: NULL = never asked, '' = explicitly skipped or cleared, else normalized
   * text. Each maps to null at the profileOf boundary. (Replaced the single `limitations` column.)
   */
  medical_limitations: string | null;
  food_allergies: string | null;
  product_limitations: string | null;
  created_at: string;
  acquisition_source: string | null;
  /**
   * Per-user card rendering override; NULL = follow the instance's REPLY_FORMAT. An explicit
   * choice PINS the user: picking the value that happens to match the instance default still
   * stores it, so their rendering stops following future REPLY_FORMAT changes. Deliberate —
   * an explicit choice sticks.
   */
  reply_format: string | null;
  /**
   * Transient /settings text-capture state: which profile field the user's NEXT text message
   * fills (`weight`/`target_weight`/`country`), or NULL when not awaiting input. Settings-only —
   * onboarding derives its step from field-nullness, not from this column.
   */
  pending_input: string | null;
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
  user_message_id?: number | null;
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

/**
 * A strict `YYYY-MM-DD` → noon-UTC Date, or null. Rejects both junk (`"not-a-date"`, `""`) AND
 * rollover-valid strings (`"2026-02-30"` → would silently become Mar 2 via JS Date normalization):
 * the components must round-trip, so only a REAL calendar day passes. Noon avoids any tz edge.
 */
export function parseCalendarDate(date: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return null;
  const [, ys, ms, ds] = m;
  const y = Number(ys), mo = Number(ms), d = Number(ds);
  const dt = new Date(Date.UTC(y, mo - 1, d, 12));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt;
}

/**
 * N calendar days before a YYYY-MM-DD, in calendar space. DST-safe: subtracting a fixed
 * `days * 24h` from the *instant* and re-deriving a Berlin date is off by one when a transition
 * falls in the span and the clock is near midnight (spring days are 23h). Operating on the
 * already-Berlin calendar date in UTC space sidesteps that entirely — no tz needed, because
 * `date` is already the local day. Throws on a non-calendar input: only `berlinDate` output
 * (or another real date) is ever meant to reach it, so a bad value is a programming error, loud.
 */
export function berlinDateMinus(date: string, days: number): string {
  const dt = parseCalendarDate(date);
  if (!dt || !Number.isFinite(days)) {
    throw new Error(`berlinDateMinus: non-calendar input date=${JSON.stringify(date)} days=${days}`);
  }
  dt.setUTCDate(dt.getUTCDate() - days);
  return dt.toISOString().slice(0, 10);
}

/** HH:MM for an instant in the given IANA zone (default Europe/Berlin), not UTC. */
export function berlinTime(d: Date, tz = "Europe/Berlin"): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
}

/**
 * Connect, creating the database if it does not exist (the per-branch database is born on the
 * first boot of that branch — there is no separate `createdb` step), then migrate.
 */
export async function openDb(pg: PgConfig): Promise<Db> {
  // config.ts validates PGDATABASE, but openDb is also called directly (tests, scripts) — the
  // name is interpolated into CREATE DATABASE as an identifier, so re-check unconditionally.
  if (!/^[a-z_][a-z0-9_]*$/.test(pg.database)) {
    throw new Error(`invalid database name ${JSON.stringify(pg.database)}`);
  }
  const db = new SQL({
    hostname: pg.host,
    port: pg.port,
    username: pg.user,
    password: pg.password,
    database: pg.database,
    max: pg.max ?? 10,
  });
  try {
    try {
      await db`SELECT 1`;
    } catch (e) {
      if (!isMissingDatabase(e)) {
        throw new Error(
          `postgres connect failed (${pg.host}:${pg.port}/${pg.database}): ${message(e)} — ` +
            `is the shared dev server up? sh scripts/db.sh up`,
        );
      }
      await createDatabase(pg);
      await db`SELECT 1`;
    }
    await migrate(db);
  } catch (e) {
    // Don't strand the pool on a failed open — the bot exits, but tests and scripts call
    // openDb from long-lived processes where leaked connections accumulate.
    await db.close().catch(() => {});
    throw e;
  }
  return db;
}

/**
 * 3D000 invalid_catalog_name — the branch database has not been created yet. Bun's PostgresError
 * puts the SQLSTATE on `.errno` (`.code` is a generic "ERR_POSTGRES_SERVER_ERROR"), so check both;
 * the message match is the last resort and is anchored on `database "…"` so a missing ROLE
 * ("role \"x\" does not exist") takes the friendly connect-failed path, not a doomed CREATE.
 */
function isMissingDatabase(e: unknown): boolean {
  const err = e as { code?: unknown; errno?: unknown };
  // `.code` is "ERR_POSTGRES_SERVER_ERROR" (non-null), so an `??` chain would never reach errno —
  // check both explicitly.
  return err?.code === "3D000" || err?.errno === "3D000" || /database ".*" does not exist/.test(message(e));
}

function message(e: unknown): string {
  return String((e as Error)?.message ?? e);
}

async function createDatabase(pg: PgConfig): Promise<void> {
  // CREATE DATABASE cannot run inside a transaction and cannot bind the name as a parameter;
  // the name was charset-validated in openDb above.
  const admin = new SQL({
    hostname: pg.host,
    port: pg.port,
    username: pg.user,
    password: pg.password,
    database: "postgres",
    max: 1,
  });
  try {
    await admin.unsafe(`CREATE DATABASE "${pg.database}"`);
  } catch (e) {
    // A parallel instance winning the create race is success. It surfaces as 42P04
    // duplicate_database, or — when both CREATEs are truly simultaneous — as a 23505 unique
    // violation on pg_database before the friendly check ever runs.
    const dup = /already exists|duplicate key value/.test(message(e));
    if (!dup) throw e;
  } finally {
    await admin.close();
  }
}

// ---------- migrations ----------

// Columns deliberately mirror the original bun:sqlite schema: TEXT timestamps (ISO strings)
// and TEXT-encoded JSON, so every mapper and caller kept its semantics across the port. Only
// structurally necessary changes were made: BIGINT ids (Telegram ids exceed int32), DOUBLE
// PRECISION macros, and an explicit `seq` on events (Postgres has no implicit rowid to ORDER BY).
type Migration = { version: number; up: (tx: SQL) => Promise<void> };

const MIGRATIONS: Migration[] = [
  {
    version: 1,
    up: async (tx) => {
      await tx`
        CREATE TABLE users (
          telegram_id        BIGINT PRIMARY KEY,
          username           TEXT,
          lang               TEXT NOT NULL DEFAULT 'ru',
          state              TEXT NOT NULL DEFAULT 'consent',
          consent_at         TEXT,
          goal               TEXT,
          restrictions       TEXT NOT NULL DEFAULT '[]',
          created_at         TEXT NOT NULL,
          acquisition_source TEXT
        )`;
      await tx`
        CREATE TABLE meals (
          id                TEXT PRIMARY KEY,
          user_id           BIGINT NOT NULL REFERENCES users(telegram_id),
          ts                TEXT NOT NULL,
          date              TEXT NOT NULL,
          chat_id           BIGINT,
          bot_message_id    BIGINT,
          items             TEXT,
          kcal              DOUBLE PRECISION, protein_g DOUBLE PRECISION,
          carbs_g           DOUBLE PRECISION, fat_g DOUBLE PRECISION,
          satfat_g          DOUBLE PRECISION, fiber_g DOUBLE PRECISION,
          sugar_g           DOUBLE PRECISION, sodium_mg DOUBLE PRECISION,
          plant_protein_pct DOUBLE PRECISION,
          verdicts          TEXT,
          confidence        TEXT,
          notes             TEXT,
          corrected         INTEGER NOT NULL DEFAULT 0,
          model             TEXT
        )`;
      await tx`CREATE INDEX idx_meals_user_date ON meals(user_id, date)`;
      await tx`CREATE INDEX idx_meals_reply ON meals(user_id, bot_message_id)`;
      await tx`
        CREATE TABLE processed_updates (
          update_id BIGINT PRIMARY KEY,
          at        TEXT
        )`;
      await tx`
        CREATE TABLE settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )`;
      await tx`
        CREATE TABLE events (
          seq         BIGSERIAL PRIMARY KEY,
          ts          TEXT NOT NULL,
          user_id     BIGINT NOT NULL,
          event       TEXT NOT NULL,
          source_code TEXT
        )`;
      await tx`CREATE INDEX idx_events_user ON events(user_id)`;
      await tx`CREATE INDEX idx_events_event ON events(event)`;
    },
  },
  {
    // Onboarding weight step: NULL = never asked, 0 = explicitly skipped, >0 = kilograms.
    // The 0-sentinel stays inside the db/bot boundary — profileOf maps it to null.
    version: 2,
    up: async (tx) => {
      await tx`ALTER TABLE users ADD COLUMN weight_kg DOUBLE PRECISION`;
      // Users mid-flow at the OLD restrictions step (profile + goal set) are backfilled to
      // "skipped": without this their next message — composed as a restrictions answer —
      // would be consumed by the new weight question, and any number in it stored as a
      // bodyweight. Active users stay NULL (resume() never re-opens onboarding for them);
      // goal-step users stay NULL and get the weight question in its natural place.
      await tx`UPDATE users SET weight_kg = 0 WHERE state = 'profile' AND goal IS NOT NULL`;
    },
  },
  {
    // Free-text era: replies to the user's OWN photo must find the meal (user_message_id),
    // text-described meals wait for confirmation (pending_meals), and the spend caps count
    // LLM calls rather than stored meals (llm_calls) — a capped correction or Q&A call costs
    // exactly as much as a photo analysis.
    version: 3,
    up: async (tx) => {
      await tx`ALTER TABLE meals ADD COLUMN user_message_id BIGINT`;
      await tx`CREATE INDEX idx_meals_user_msg ON meals(user_id, user_message_id)`;
      await tx`
        CREATE TABLE pending_meals (
          id              TEXT PRIMARY KEY,
          user_id         BIGINT NOT NULL,
          ts              TEXT NOT NULL,
          date            TEXT NOT NULL,
          chat_id         BIGINT,
          bot_message_id  BIGINT,
          user_message_id BIGINT,
          analysis        TEXT NOT NULL,
          model           TEXT
        )`;
      await tx`CREATE INDEX idx_pending_reply ON pending_meals(user_id, bot_message_id)`;
      await tx`
        CREATE TABLE llm_calls (
          user_id BIGINT NOT NULL,
          date    TEXT NOT NULL,
          kind    TEXT NOT NULL CHECK (kind IN ('photo', 'router', 'classify'))
        )`;
      await tx`CREATE INDEX idx_llm_calls_date ON llm_calls(date)`;
      await tx`CREATE INDEX idx_llm_calls_user ON llm_calls(user_id, date)`;
    },
  },
  {
    // Per-user reply-format override from /settings. NULL = follow the instance's REPLY_FORMAT
    // (existing users keep their current rendering until they choose). Free TEXT with no CHECK,
    // matching the users-table style; validated at the read boundary (profileOf) the way lang is.
    version: 4,
    up: async (tx) => {
      await tx`ALTER TABLE users ADD COLUMN reply_format TEXT`;
    },
  },
  {
    // Onboarding gains target-weight and purchase-country steps (both editable in /settings), plus
    // a settings text-capture marker. Sentinels mirror weight_kg: target_weight_kg NULL/0/>0;
    // country NULL=never asked, ''=skipped, else code/raw. pending_input NULL=not awaiting input.
    version: 5,
    up: async (tx) => {
      await tx`ALTER TABLE users ADD COLUMN target_weight_kg DOUBLE PRECISION`;
      await tx`ALTER TABLE users ADD COLUMN country TEXT`;
      await tx`ALTER TABLE users ADD COLUMN pending_input TEXT`;
      // The new steps sit AFTER the weight step. A user mid-flow who has already answered weight
      // (in the old flow they were at the restrictions step) must be backfilled to the skip
      // sentinels — otherwise their next message, composed as a restrictions answer, would be
      // silently eaten by the new target-weight step. Users still AT the weight step (weight_kg
      // NULL) get the new questions in their natural place, so they stay NULL. Active users stay
      // NULL too — resume() never re-opens onboarding for them.
      await tx`UPDATE users SET target_weight_kg = 0, country = '' WHERE state = 'profile' AND goal IS NOT NULL AND weight_kg IS NOT NULL`;
    },
  },
  {
    // Free-text limitations, the open-ended companion to the four-tag `restrictions` vocabulary.
    // Sentinels mirror country: NULL = never asked, '' = skipped/cleared, else the text.
    //
    // NO BACKFILL, deliberately — and the reason is structural, not an oversight. v2 and v5 both
    // needed one because they INSERTED an onboarding step, so a user mid-flow would have had
    // their next message (composed as an answer to the old next question) eaten by the new one.
    // v6 inserts no step: the existing restrictions question, already free text, simply stops
    // discarding what the user typed. The flow order is unchanged, so nobody can be mid-flow in
    // the wrong place. Existing users keep NULL and set the field in /settings.
    version: 6,
    up: async (tx) => {
      await tx`ALTER TABLE users ADD COLUMN limitations TEXT`;
    },
  },
  {
    // "Food specifics": the single free-text `limitations` field splits into three labelled ones —
    // medical conditions/needs, allergies (safety-critical), and products avoided. Same per-field
    // sentinels as country (NULL/''/text). The one shipped `limitations` value is a product
    // avoidance, so it moves to product_limitations; the '' skip sentinel was never a real value,
    // so it does not migrate (all three simply start NULL). Then the old column is dropped.
    //
    // No '' backfill: like `limitations`, none of the three is step-gating (resume()/*Open never
    // read them, and every migrated user is already active), so NULL-for-everyone is correct.
    version: 7,
    up: async (tx) => {
      await tx`ALTER TABLE users ADD COLUMN medical_limitations TEXT`;
      await tx`ALTER TABLE users ADD COLUMN food_allergies TEXT`;
      await tx`ALTER TABLE users ADD COLUMN product_limitations TEXT`;
      await tx`UPDATE users SET product_limitations = limitations WHERE limitations IS NOT NULL AND limitations <> ''`;
      await tx`ALTER TABLE users DROP COLUMN limitations`;
    },
  },
];

async function migrate(db: Db): Promise<void> {
  await db.begin(async (tx) => {
    // Serialize concurrent boots (two instances racing on a fresh branch database): DDL in
    // Postgres is transactional, and the advisory lock makes the version check-and-apply atomic.
    await tx`SELECT pg_advisory_xact_lock(726174001)`;
    await tx`CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)`;
    const rows = await tx`SELECT version FROM schema_version`;
    let cur: number;
    if (rows.length === 0) {
      await tx`INSERT INTO schema_version (version) VALUES (0)`;
      cur = 0;
    } else {
      cur = Number(rows[0].version);
    }
    for (const m of MIGRATIONS) {
      if (m.version <= cur) continue;
      try {
        await m.up(tx);
      } catch (e) {
        // Name the version: "column already exists" without it sends the operator diffing
        // every migration instead of the one that fired. `cause` keeps the pg SQLSTATE and
        // stack for a direct openDb caller (a test/script), which the message alone drops.
        throw new Error(`migration v${m.version} failed: ${message(e)}`, { cause: e });
      }
      await tx`UPDATE schema_version SET version = ${m.version}`;
    }
  });
}

// ---------- settings (runtime overrides) ----------

export async function getSetting(db: Db, key: string): Promise<string | null> {
  const rows = await db`SELECT value FROM settings WHERE key = ${key}`;
  return rows.length ? (rows[0].value as string) : null;
}

export async function setSetting(db: Db, key: string, value: string): Promise<void> {
  await db`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

export async function clearSetting(db: Db, key: string): Promise<void> {
  await db`DELETE FROM settings WHERE key = ${key}`;
}

// ---------- users ----------

export async function upsertUser(
  db: Db,
  u: { telegram_id: number; username?: string | null; lang?: string },
): Promise<void> {
  // Resume-safe: on conflict only the username is refreshed; consent_at/goal/state/restrictions
  // are left untouched so a mid-onboarding /start does not reset progress.
  await db`
    INSERT INTO users (telegram_id, username, lang, state, created_at)
    VALUES (${u.telegram_id}, ${u.username ?? null}, ${u.lang ?? DEFAULT_LANG}, 'consent', ${new Date().toISOString()})
    ON CONFLICT (telegram_id) DO UPDATE SET username = EXCLUDED.username`;
}

export async function getUser(db: Db, telegram_id: number): Promise<UserRow | undefined> {
  const rows = await db`SELECT * FROM users WHERE telegram_id = ${telegram_id}`;
  const row = rows[0] as Record<string, any> | undefined;
  if (!row) return undefined;
  return {
    telegram_id: Number(row.telegram_id),
    username: row.username,
    lang: row.lang,
    state: row.state,
    consent_at: row.consent_at,
    goal: row.goal,
    weight_kg: row.weight_kg === null || row.weight_kg === undefined ? null : Number(row.weight_kg),
    target_weight_kg:
      row.target_weight_kg === null || row.target_weight_kg === undefined
        ? null
        : Number(row.target_weight_kg),
    country: row.country ?? null,
    restrictions: parseJsonArray(row.restrictions),
    // ?? not ||: '' is the explicit-skip sentinel and must survive the mapper distinct from NULL.
    medical_limitations: row.medical_limitations ?? null,
    food_allergies: row.food_allergies ?? null,
    product_limitations: row.product_limitations ?? null,
    created_at: row.created_at,
    acquisition_source: row.acquisition_source ?? null,
    reply_format: row.reply_format ?? null,
    pending_input: row.pending_input ?? null,
  };
}

/** First-touch only: a user's source is whatever code their FIRST /start carried, forever. */
export async function setAcquisitionSource(
  db: Db,
  telegram_id: number,
  source: string,
): Promise<void> {
  await db`
    UPDATE users SET acquisition_source = ${source}
    WHERE telegram_id = ${telegram_id} AND acquisition_source IS NULL`;
}

// ---------- events (append-only funnel log) ----------

export async function logEvent(
  db: Db,
  user_id: number,
  event: string,
  source_code?: string | null,
): Promise<void> {
  await db`
    INSERT INTO events (ts, user_id, event, source_code)
    VALUES (${new Date().toISOString()}, ${user_id}, ${event}, ${source_code ?? null})`;
}

export async function eventsFor(db: Db, user_id: number): Promise<EventRow[]> {
  const rows = await db`
    SELECT ts, user_id, event, source_code FROM events
    WHERE user_id = ${user_id} ORDER BY seq`;
  return rows.map((r: Record<string, any>) => ({
    ts: r.ts,
    user_id: Number(r.user_id),
    event: r.event,
    source_code: r.source_code,
  }));
}

export async function hasEvent(db: Db, user_id: number, event: string): Promise<boolean> {
  const rows = await db`
    SELECT 1 FROM events WHERE user_id = ${user_id} AND event = ${event} LIMIT 1`;
  return rows.length > 0;
}

export interface FunnelRow {
  source: string; // acquisition code, or "organic" for users who arrived without one
  users: number;
  first_photo: number; // users who analyzed at least one photo
  d7_retained: number; // users with a meal dated ≥7 days after their created_at
  cap_hits: number; // cap_hit events across the cohort (events, not users)
  waitlist: number; // users who joined the waitlist
}

/** The Measure-Monday query: the whole acquisition funnel grouped by start code. */
export async function funnelByCode(db: Db): Promise<FunnelRow[]> {
  // ::int on every aggregate: Postgres counts are BIGINT, which the driver may surface as a
  // non-number; int4 always arrives as a plain JS number. The +7-day boundary is computed on
  // the UTC date, matching what sqlite's date(created_at, '+7 day') did on the stored ISO text.
  const rows = await db`
    SELECT
      COALESCE(u.acquisition_source, 'organic') AS source,
      COUNT(*)::int AS users,
      (COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM events e WHERE e.user_id = u.telegram_id AND e.event = 'first_photo'
      )))::int AS first_photo,
      (COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM meals m WHERE m.user_id = u.telegram_id
          AND m.date >= ((u.created_at::timestamptz AT TIME ZONE 'UTC' + interval '7 days')::date)::text
      )))::int AS d7_retained,
      COALESCE(SUM((
        SELECT COUNT(*) FROM events e WHERE e.user_id = u.telegram_id AND e.event = 'cap_hit'
      )), 0)::int AS cap_hits,
      (COUNT(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM events e WHERE e.user_id = u.telegram_id AND e.event = 'waitlist_join'
      )))::int AS waitlist
    FROM users u
    GROUP BY source
    ORDER BY users DESC, source`;
  return rows as FunnelRow[];
}

export async function setUserState(db: Db, telegram_id: number, state: UserState): Promise<void> {
  await db`UPDATE users SET state = ${state} WHERE telegram_id = ${telegram_id}`;
}

/** /lang and /settings → Language — the only places a user's language changes after seeding. */
export async function setLang(db: Db, telegram_id: number, lang: string): Promise<void> {
  await db`UPDATE users SET lang = ${lang} WHERE telegram_id = ${telegram_id}`;
}

/**
 * /settings → Style — per-user meal-card rendering override. Like its siblings (setLang,
 * setProfile), a 0-row UPDATE (user deleted mid-tap) resolves silently: sequentialize(by user)
 * excludes that race in-process, and every meal- and settings-path interaction re-gates on
 * getUser anyway.
 */
export async function setReplyFormat(
  db: Db,
  telegram_id: number,
  format: ReplyFormat,
): Promise<void> {
  await db`UPDATE users SET reply_format = ${format} WHERE telegram_id = ${telegram_id}`;
}

/** Consent accepted: record consent time and advance to the profile step. */
export async function setConsent(db: Db, telegram_id: number, consentAt: string): Promise<void> {
  await db`
    UPDATE users SET consent_at = ${consentAt}, state = 'profile'
    WHERE telegram_id = ${telegram_id}`;
}

/** Partial profile update (goal, weight, target weight, country, restrictions, limitations, state). Only provided fields change. */
export async function setProfile(
  db: Db,
  telegram_id: number,
  patch: {
    goal?: Goal;
    weight_kg?: number;
    target_weight_kg?: number;
    country?: string;
    restrictions?: string[];
    medical_limitations?: string;
    food_allergies?: string;
    product_limitations?: string;
    state?: UserState;
  },
): Promise<void> {
  // Dynamic SET list over a fixed field whitelist — values always travel as $n parameters.
  const sets: string[] = [];
  const vals: unknown[] = [];
  if (patch.goal !== undefined) sets.push(`goal = $${vals.push(patch.goal)}`);
  if (patch.weight_kg !== undefined) sets.push(`weight_kg = $${vals.push(patch.weight_kg)}`);
  if (patch.target_weight_kg !== undefined) {
    sets.push(`target_weight_kg = $${vals.push(patch.target_weight_kg)}`);
  }
  if (patch.country !== undefined) sets.push(`country = $${vals.push(patch.country)}`);
  if (patch.restrictions !== undefined) {
    sets.push(`restrictions = $${vals.push(JSON.stringify(patch.restrictions))}`);
  }
  if (patch.medical_limitations !== undefined) sets.push(`medical_limitations = $${vals.push(patch.medical_limitations)}`);
  if (patch.food_allergies !== undefined) sets.push(`food_allergies = $${vals.push(patch.food_allergies)}`);
  if (patch.product_limitations !== undefined) sets.push(`product_limitations = $${vals.push(patch.product_limitations)}`);
  if (patch.state !== undefined) sets.push(`state = $${vals.push(patch.state)}`);
  if (sets.length === 0) return;
  await db.unsafe(
    `UPDATE users SET ${sets.join(", ")} WHERE telegram_id = $${vals.push(telegram_id)}`,
    vals as any[],
  );
}

/**
 * Arms (or clears) the /settings text-capture marker: the next text message the user sends fills
 * `field`. Null clears it. Like setLang/setReplyFormat, a 0-row UPDATE (user vanished mid-tap)
 * resolves silently — every settings-path interaction re-gates on getUser anyway.
 */
export async function setPendingInput(
  db: Db,
  telegram_id: number,
  field: string | null,
): Promise<void> {
  await db`UPDATE users SET pending_input = ${field} WHERE telegram_id = ${telegram_id}`;
}

export async function deleteUser(db: Db, user_id: number): Promise<void> {
  // No ON DELETE CASCADE in the schema (spec §6), so children go first, atomically.
  // events go too: PRIVACY.md promises /delete erases the user's data, and funnel rows are
  // keyed to the account. processed_updates stays — numeric update ids with no user linkage.
  await db.begin(async (tx) => {
    await tx`DELETE FROM meals WHERE user_id = ${user_id}`;
    // v3 children too: a pending analysis is meal content (PRIVACY.md erasure), and an orphaned
    // pending row would FK-crash a post-delete tm:log tap.
    await tx`DELETE FROM pending_meals WHERE user_id = ${user_id}`;
    await tx`DELETE FROM llm_calls WHERE user_id = ${user_id}`;
    await tx`DELETE FROM events WHERE user_id = ${user_id}`;
    await tx`DELETE FROM users WHERE telegram_id = ${user_id}`;
  });
}

export async function userCount(db: Db): Promise<number> {
  const rows = await db`SELECT COUNT(*)::int AS n FROM users`;
  return rows[0].n as number;
}

// ---------- meals ----------

export async function insertMeal(db: Db, m: NewMeal): Promise<void> {
  const a = m.analysis;
  await db`
    INSERT INTO meals (
      id, user_id, ts, date, chat_id, bot_message_id, user_message_id, items,
      kcal, protein_g, carbs_g, fat_g, satfat_g, fiber_g, sugar_g, sodium_mg,
      plant_protein_pct, verdicts, confidence, notes, corrected, model
    ) VALUES (
      ${m.id}, ${m.user_id}, ${m.ts}, ${m.date}, ${m.chat_id ?? null}, ${m.bot_message_id ?? null},
      ${m.user_message_id ?? null},
      ${JSON.stringify(a.items ?? [])},
      ${a.kcal}, ${a.protein_g}, ${a.carbs_g}, ${a.fat_g}, ${a.satfat_g}, ${a.fiber_g},
      ${a.sugar_g}, ${a.sodium_mg}, ${a.plant_protein_pct},
      ${JSON.stringify(a.verdicts ?? {})}, ${a.confidence ?? null}, ${a.notes ?? null},
      0, ${m.model ?? null}
    )
    ON CONFLICT (id) DO NOTHING`;
  // DO NOTHING, not an error: ids are UUIDs, so a conflict only means a redelivered confirm
  // (crash between insert and pending-delete). First write wins; the retry becomes idempotent.
}

export async function getMeal(db: Db, id: string, user_id: number): Promise<MealRecord | undefined> {
  const rows = await db`SELECT * FROM meals WHERE id = ${id} AND user_id = ${user_id}`;
  return rows.length ? rowToMeal(rows[0]) : undefined;
}

export async function setMealReply(
  db: Db,
  id: string,
  user_id: number,
  chat_id: number,
  bot_message_id: number,
): Promise<void> {
  await db`
    UPDATE meals SET chat_id = ${chat_id}, bot_message_id = ${bot_message_id}
    WHERE id = ${id} AND user_id = ${user_id}`;
}

/**
 * Correction: patch macro/verdict fields for THIS meal only, marking it corrected.
 * Returns whether a row was actually updated — a vanished meal (e.g. deleted account) must
 * not be confirmed to the user as corrected.
 */
export async function applyCorrection(
  db: Db,
  id: string,
  user_id: number,
  patch: Partial<MealAnalysis>,
): Promise<boolean> {
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
    if (patch[c] !== undefined) sets.push(`${c} = $${vals.push(patch[c])}`);
  }
  if (patch.items !== undefined) {
    sets.push(`items = $${vals.push(JSON.stringify(patch.items))}`);
  }
  if (patch.verdicts !== undefined) {
    sets.push(`verdicts = $${vals.push(JSON.stringify(patch.verdicts))}`);
  }
  sets.push("corrected = 1");
  const rows = await db.unsafe(
    `UPDATE meals SET ${sets.join(", ")} WHERE id = $${vals.push(id)} AND user_id = $${vals.push(user_id)} RETURNING id`,
    vals as any[],
  );
  return rows.length > 0;
}

/**
 * Move a meal to a different day (reply-based re-date). Scoped like every meal write; returns
 * false on a 0-row update (the meal vanished mid-flight) so the caller never confirms a no-op.
 * The ONLY sanctioned way a meal's `date` changes after insert — corrections never touch it.
 */
export async function setMealDate(
  db: Db,
  id: string,
  user_id: number,
  date: string,
): Promise<boolean> {
  const rows = await db`
    UPDATE meals SET date = ${date} WHERE id = ${id} AND user_id = ${user_id} RETURNING id`;
  return rows.length > 0;
}

/** The meal a reply targets — matches the bot's analysis message OR the user's own photo. */
export async function mealByReply(
  db: Db,
  user_id: number,
  message_id: number,
): Promise<MealRecord | undefined> {
  const rows = await db`
    SELECT * FROM meals
    WHERE user_id = ${user_id}
      AND (bot_message_id = ${message_id} OR user_message_id = ${message_id})
    LIMIT 1`;
  return rows.length ? rowToMeal(rows[0]) : undefined;
}

// ---------- llm call metering (the cap basis: every provider call costs one) ----------

/** One row per provider call. Mirrors the CHECK constraint on llm_calls.kind. */
export type LlmCallKind = "photo" | "router" | "classify";

export async function logLlmCall(
  db: Db,
  user_id: number,
  date: string,
  kind: LlmCallKind,
): Promise<void> {
  await db`INSERT INTO llm_calls (user_id, date, kind) VALUES (${user_id}, ${date}, ${kind})`;
}

export async function llmCallsToday(db: Db, user_id: number, date: string): Promise<number> {
  const rows = await db`
    SELECT COUNT(*)::int AS n FROM llm_calls WHERE user_id = ${user_id} AND date = ${date}`;
  return rows[0].n as number;
}

export async function llmCallCountToday(db: Db, date: string): Promise<number> {
  const rows = await db`SELECT COUNT(*)::int AS n FROM llm_calls WHERE date = ${date}`;
  return rows[0].n as number;
}

// ---------- pending meals (text-described, confirm-first) ----------

/**
 * The read shape of a pending row. Deliberately `NewMeal` with nullability made concrete —
 * `insertPendingMeal` takes a `NewMeal` so the two paths cannot drift field-by-field: a field
 * added to `NewMeal` either flows through here or fails the types, never silently vanishes.
 */
export interface PendingMeal {
  id: string;
  user_id: number;
  ts: string;
  date: string;
  chat_id: number | null;
  bot_message_id: number | null;
  user_message_id: number | null;
  analysis: MealAnalysis;
  model: string | null;
}

export async function insertPendingMeal(db: Db, m: NewMeal): Promise<void> {
  await db`
    INSERT INTO pending_meals (id, user_id, ts, date, user_message_id, analysis, model)
    VALUES (${m.id}, ${m.user_id}, ${m.ts}, ${m.date}, ${m.user_message_id ?? null},
            ${JSON.stringify(m.analysis)}, ${m.model ?? null})`;
}

export async function setPendingReply(
  db: Db,
  id: string,
  user_id: number,
  chat_id: number,
  bot_message_id: number,
): Promise<void> {
  await db`
    UPDATE pending_meals SET chat_id = ${chat_id}, bot_message_id = ${bot_message_id}
    WHERE id = ${id} AND user_id = ${user_id}`;
}

export async function getPendingMeal(
  db: Db,
  id: string,
  user_id: number,
): Promise<PendingMeal | undefined> {
  const rows = await db`
    SELECT * FROM pending_meals WHERE id = ${id} AND user_id = ${user_id}`;
  if (!rows.length) return undefined;
  const row = rows[0];
  // Full schema validation, not just JSON.parse: the analyzer's contract is that invalid output
  // never poisons daily totals, and a confirmed pending row flows straight into meals. A row
  // that fails is unusable forever — delete it (leaving it would silently re-fail every tap)
  // and tell the operator, or a systematic corruption bug looks like "everything expired".
  let analysis: MealAnalysis | undefined;
  try {
    const parsed = MealAnalysisSchema.safeParse(JSON.parse(row.analysis));
    if (parsed.success) analysis = parsed.data;
  } catch {
    // fall through to the shared corrupt-row handling below
  }
  if (!analysis) {
    console.error(`[eait] corrupt pending_meals row id=${row.id} user=${user_id} — deleting`);
    await deletePendingMeal(db, id, user_id);
    return undefined;
  }
  return {
    id: row.id,
    user_id: Number(row.user_id),
    ts: row.ts,
    date: row.date,
    chat_id: row.chat_id === null ? null : Number(row.chat_id),
    bot_message_id: row.bot_message_id === null ? null : Number(row.bot_message_id),
    user_message_id: row.user_message_id === null ? null : Number(row.user_message_id),
    analysis,
    model: row.model,
  };
}

/** True if a row was actually deleted (user-scoped — a foreign id deletes nothing). */
export async function deletePendingMeal(db: Db, id: string, user_id: number): Promise<boolean> {
  const rows = await db`
    DELETE FROM pending_meals WHERE id = ${id} AND user_id = ${user_id} RETURNING id`;
  return rows.length > 0;
}

export async function prunePendingMeals(db: Db, olderThanIso: string): Promise<void> {
  await db`DELETE FROM pending_meals WHERE ts < ${olderThanIso}`;
}

export async function dailyTotals(db: Db, user_id: number, date: string): Promise<DailyTotals> {
  const rows = await db`
    SELECT
      COALESCE(SUM(kcal),0)::float8      AS kcal,
      COALESCE(SUM(protein_g),0)::float8 AS protein_g,
      COALESCE(SUM(carbs_g),0)::float8   AS carbs_g,
      COALESCE(SUM(fat_g),0)::float8     AS fat_g,
      COALESCE(SUM(satfat_g),0)::float8  AS satfat_g,
      COALESCE(SUM(fiber_g),0)::float8   AS fiber_g,
      COALESCE(SUM(sugar_g),0)::float8   AS sugar_g,
      COALESCE(SUM(sodium_mg),0)::float8 AS sodium_mg
    FROM meals WHERE user_id = ${user_id} AND date = ${date}`;
  return rows[0] as DailyTotals;
}

/** A user's meals on one date, oldest first — the router's today-context. */
export async function mealsOnDate(db: Db, user_id: number, date: string): Promise<MealRecord[]> {
  const rows = await db`
    SELECT * FROM meals WHERE user_id = ${user_id} AND date = ${date} ORDER BY ts`;
  return rows.map(rowToMeal);
}

/** Per-date kcal/protein sums over a date range (inclusive) — the router's week-context. */
export async function totalsByDate(
  db: Db,
  user_id: number,
  fromDate: string,
  toDate: string,
): Promise<DayTotals[]> {
  const rows = await db`
    SELECT date,
      COALESCE(SUM(kcal),0)::float8      AS kcal,
      COALESCE(SUM(protein_g),0)::float8 AS protein_g
    FROM meals
    WHERE user_id = ${user_id} AND date >= ${fromDate} AND date <= ${toDate}
    GROUP BY date ORDER BY date`;
  return rows.map((r: any) => ({ date: r.date, kcal: r.kcal, protein_g: r.protein_g }));
}

/** Total meals stored across ALL users on a date (used in tests and admin stats). */
export async function mealCountToday(db: Db, date: string): Promise<number> {
  const rows = await db`SELECT COUNT(*)::int AS n FROM meals WHERE date = ${date}`;
  return rows[0].n as number;
}

export async function countMealsToday(db: Db, user_id: number, date: string): Promise<number> {
  const rows = await db`
    SELECT COUNT(*)::int AS n FROM meals WHERE user_id = ${user_id} AND date = ${date}`;
  return rows[0].n as number;
}

export async function mealCount(db: Db): Promise<number> {
  const rows = await db`SELECT COUNT(*)::int AS n FROM meals`;
  return rows[0].n as number;
}

// ---------- update dedupe ----------

export async function seenUpdate(db: Db, update_id: number): Promise<boolean> {
  const rows = await db`SELECT 1 FROM processed_updates WHERE update_id = ${update_id}`;
  return rows.length > 0;
}

export async function markUpdate(db: Db, update_id: number): Promise<void> {
  await db`
    INSERT INTO processed_updates (update_id, at)
    VALUES (${update_id}, ${new Date().toISOString()})
    ON CONFLICT (update_id) DO NOTHING`;
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
    user_id: Number(row.user_id),
    ts: row.ts,
    date: row.date,
    chat_id: row.chat_id === null ? null : Number(row.chat_id),
    bot_message_id: row.bot_message_id === null ? null : Number(row.bot_message_id),
    user_message_id: row.user_message_id === null ? null : Number(row.user_message_id),
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
    corrected: Number(row.corrected) === 1,
    model: row.model,
  };
}
