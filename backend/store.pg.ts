// Postgres Store, on the builtin `Bun.sql` client. What runs in production.
//
// Two deliberate choices worth stating, both learned from eait:
//
//  1. `date` is stored as TEXT, not as a `date` column. The value is a calendar date in the user's
//     zone (`YYYY-MM-DD`), and handing it to a driver that round-trips through `Date` reintroduces
//     exactly the UTC-boundary bug the zone-aware computation exists to avoid.
//  2. The app NEVER creates the database. `migrate()` creates tables inside a database that must
//     already exist. eait shipped auto-create once and it was silent data loss: a container rebuilt
//     from another branch opened a brand-new empty database, so every user was unknown and
//     re-onboarded from scratch, with the real rows still sitting in the old database and nothing
//     in any log. An empty database is indistinguishable from every user having been wiped.

import { SQL } from "bun";
import type {
  DayTotals, HealthDay, Lang, MealItem, MealRecord, MealVerdicts, OnboardingContent, Profile,
  Provider,
} from "@ieat/shared";
import { HEALTH_FIELDS, emptyHealthDay } from "@ieat/shared";
import {
  DEFAULT_SESSION_TTL_MS, hashToken, newSessionToken, sessionRefreshAfterMs,
} from "./auth/tokens.ts";
import { type ChatMessage,
  blankProfile, type FunnelAggregate, type MealPatch, type PendingMeal, type ProfilePatch,
  type Store, type StoreOptions,
} from "./store.ts";

/**
 * The health metric columns, and every statement built from them.
 *
 * All derived from `HEALTH_FIELDS`, which is the one place a metric is declared. A hand-maintained
 * list here would be a second source of truth that drifts the first time somebody adds a metric and
 * edits only one of the two — and the failure is a number the app sends and the database silently
 * has no home for. The names come from our own constant and never from a request, which is what
 * makes them safe to interpolate into SQL.
 */
const HEALTH_COLUMNS: readonly string[] = HEALTH_FIELDS.map((f) => f.key);

/** One `add column if not exists` per metric — the migration for a host that predates one. */
const HEALTH_COLUMN_DDL = HEALTH_COLUMNS
  .map((c) => `alter table health_days add column if not exists ${c} double precision;`)
  .join("\n");

const HEALTH_UPSERT = `
  insert into health_days (user_id, date, ${HEALTH_COLUMNS.join(", ")}, updated_at)
  values ($1, $2, ${HEALTH_COLUMNS.map((_, i) => `$${i + 3}`).join(", ")}, now())
  on conflict (user_id, date) do update set
    ${HEALTH_COLUMNS.map((c) => `${c} = excluded.${c}`).join(", ")},
    updated_at = now()`;

/** Shape check for ids that get spliced into an array literal; every id here is one we issued. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SCHEMA = `
create table if not exists users (
  id                  uuid primary key,
  device_id           text unique not null,
  lang                text not null default 'en',
  goal                text,
  sex                 text,
  birth_year          integer,
  height_cm           double precision,
  weight_kg           double precision,
  target_weight_kg    double precision,
  activity            text,
  pace                text,
  country             text,
  restrictions        text[] not null default '{}',
  medical_limitations text,
  food_allergies      text,
  product_limitations text,
  onboarded_at        timestamptz,
  created_at          timestamptz not null default now()
);
-- When weight_kg was MEASURED, not when the row was written. Settles the race between a manual
-- edit and an Apple Health import: whichever measurement is newer wins, so a sync cannot revert a
-- number the user just typed and a stale import cannot overwrite a deliberate correction.
-- Added separately so a host deployed before this exists gains it on the next boot.
alter table users add column if not exists weight_measured_at timestamptz;

-- The paid tier, on the user row rather than in a subscriptions table.
--
-- Three columns because the resolved state is all anything asks for: when it lapses, what was
-- bought, and when the STORE generated the event that said so. That last one is the out-of-order
-- guard — webhook delivery is not ordered, and a cancellation generated before a renewal can
-- arrive after it. Same rule as weight_measured_at above: the newer event wins, not the later
-- write.
--
-- On the users table, so deleting a user takes the subscription state with it. A separate table
-- would leave a row naming an Apple transaction that belongs to somebody who asked to be erased.
-- (No backticks anywhere in here: this is a template literal and one would end it.)
alter table users add column if not exists entitlement_expires_at timestamptz;
alter table users add column if not exists entitlement_product_id text;
-- When Spud spoke the first verdict. Null until then; the claim is one atomic update.
alter table users add column if not exists first_verdict_at timestamptz;
alter table users add column if not exists entitlement_event_at   timestamptz;

-- Bearer tokens, as SHA-256 hashes.
--
-- The column is token_hash and there is no column holding the token itself. A dump of this table
-- names accounts and login times; it does not let the reader become any of them. See
-- auth/tokens.ts for why a fast unsalted hash is the right shape for a 256-bit random value.
-- (No backticks in this string: it is a template literal, and one would end it.)
--
-- Expiry is measured from last_used_at, not from created_at. An idle lifetime signs out the phone
-- that was sold and never the person using the app every day.
create table if not exists tokens (
  token_hash   text primary key,
  user_id      uuid not null references users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
-- Migration off the plaintext column, for a host deployed before this existed.
--
-- Lossless on purpose: the old rows hold the token itself, so its hash is computable and every
-- signed-in phone stays signed in across the deploy. The alternative — dropping the table — would
-- have signed out every user at once, and for an anonymous account that means the app trades its
-- device id for a new token silently, which is fine, while a signed-in one looks like it lost
-- everything until Apple is tapped again.
--
-- Guarded by a lookup rather than by "add column if not exists" alone, because on a FRESH database
-- the create above already made the right table and the update below would fail on a column that
-- has never existed. sha256() is built into Postgres 11+; no pgcrypto extension is involved.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = current_schema() and table_name = 'tokens' and column_name = 'token'
  ) then
    alter table tokens add column if not exists token_hash text;
    alter table tokens add column if not exists last_used_at timestamptz;
    update tokens set token_hash = encode(sha256(token::bytea), 'hex') where token_hash is null;
    -- Existing sessions start their idle clock from when they were issued. Anything already past
    -- the lifetime is refused on its next request and pruned then, which is correct.
    update tokens set last_used_at = created_at where last_used_at is null;
    -- Dropping the column drops the primary key that was on it. The new one goes on afterwards; a
    -- table of credentials without a unique constraint is a table that can hold two rows for one
    -- token pointing at two different users.
    alter table tokens drop column token;
    alter table tokens alter column token_hash set not null;
    alter table tokens alter column last_used_at set not null;
    alter table tokens alter column last_used_at set default now();
    alter table tokens add primary key (token_hash);
  end if;
end $$;

-- AFTER the migration, not before it. On an upgraded host the create above is a no-op, so
-- last_used_at does not exist until the block has run — and an index over a column that is not
-- there yet aborts the whole schema with "column last_used_at does not exist", on the one code path
-- a fresh database never takes. Found exactly that way.
create index if not exists tokens_user_idx on tokens(user_id);
create index if not exists tokens_last_used_idx on tokens(last_used_at);

-- Federated identities: 'device' | 'apple' | 'google'.
--
-- The UNIQUE constraint is the security boundary, not an optimisation: without it two accounts
-- could claim the same Apple subject and which one a sign-in reached would depend on row order.
create table if not exists identities (
  provider   text not null,
  subject    text not null,
  user_id    uuid not null references users(id) on delete cascade,
  linked_at  timestamptz not null default now(),
  primary key (provider, subject)
);
create index if not exists identities_user_idx on identities(user_id);

-- device_id predates the identities table. Kept nullable so a user who signs in with Apple on a
-- fresh install has an account without a fabricated device id.
-- (No backticks anywhere in this string: it is a template literal, and one would end it.)
alter table users alter column device_id drop not null;

create table if not exists meals (
  id            uuid primary key,
  user_id       uuid not null references users(id) on delete cascade,
  ts            timestamptz not null,
  date          text not null,
  is_food       boolean not null default true,
  items         jsonb not null default '[]',
  kcal          double precision not null default 0,
  protein_g     double precision not null default 0,
  carbs_g       double precision not null default 0,
  fat_g         double precision not null default 0,
  satfat_g      double precision not null default 0,
  fiber_g       double precision not null default 0,
  sugar_g       double precision not null default 0,
  sodium_mg     double precision not null default 0,
  verdicts      jsonb not null default '{}',
  confidence    text,
  notes         text,
  corrected     boolean not null default false,
  model         text
);
create index if not exists meals_user_date_idx on meals(user_id, date);

create table if not exists pendings (
  id         uuid primary key,
  user_id    uuid not null references users(id) on delete cascade,
  analysis   jsonb not null,
  date       text not null,
  expires_at timestamptz not null
);

create table if not exists analyses (
  id      bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  date    text not null,
  -- 'photo' | 'text'. The per-user cap counts photos only; the global budget counts both.
  scope   text not null default 'photo'
);
create index if not exists analyses_date_idx on analyses(date);
create index if not exists analyses_user_date_idx on analyses(user_id, date, scope);

-- The admin-edited onboarding copy. ONE row, pinned to id = 1.
--
-- A single row rather than a version history: the app fetches "what is live", and the thing an
-- admin needs to undo a bad edit is the previous JSON, which is what the version number in the
-- payload is for. Keeping every revision here would be a second product.
create table if not exists onboarding_content (
  id         integer primary key check (id = 1),
  version    integer not null,
  content    jsonb not null,
  updated_at timestamptz not null default now()
);

-- The onboarding funnel.
--
-- The id column is the CLIENT's event id and the primary key, which is what makes a retried batch
-- a no-op rather than a doubled count. Nothing in here is an answer to a health question -- see the
-- note on OnboardingEvent; the value column carries enumerated choices only, and the numeric
-- screens send none. (No backticks in this string: it is a template literal, and one would end it.)
create table if not exists onboarding_events (
  id              text primary key,
  user_id         uuid not null references users(id) on delete cascade,
  session_id      text not null,
  place           text not null,
  action          text not null,
  content_version integer not null,
  ms              integer,
  field           text,
  value           text,
  at              timestamptz not null,
  received_at     timestamptz not null default now()
);
create index if not exists onboarding_events_received_idx on onboarding_events(received_at);
create index if not exists onboarding_events_session_idx on onboarding_events(session_id);
create index if not exists onboarding_events_user_idx on onboarding_events(user_id);

-- The thread. One row per line of the conversation, in the order it happened. meal_id is a
-- reference, not a copy: the card is read from meals on request, so it always shows the meal as
-- it is now, and goes null (not missing) if the meal ever goes. Erased with the user — it holds
-- what a person typed at the assistant, including the medical free text.
create table if not exists chat_messages (
  seq     bigserial primary key,
  id      uuid not null unique,
  user_id uuid not null references users(id) on delete cascade,
  ts      timestamptz not null default now(),
  role    text not null,
  kind    text not null,
  text    text,
  -- No foreign key on purpose: the id must outlive the meal (a card whose meal is gone still names
  -- what it was), and the memory store keeps it too. getMeals simply omits an id that is gone.
  meal_id uuid,
  event   text,
  -- The phone's id for a turn, on a user text line: how it tells its own bubble from a repeat.
  client_id text,
  -- On a proposal's user line: the proposal's id, which is the meal's id once confirmed.
  pending_id uuid
);
alter table chat_messages drop constraint if exists chat_messages_meal_id_fkey;
drop index if exists chat_messages_meal_idx;
alter table chat_messages add column if not exists client_id text;
alter table chat_messages add column if not exists pending_id uuid;
create index if not exists chat_messages_user_seq_idx on chat_messages(user_id, seq desc);

-- The mailing list, from the landing page.
--
-- NO FOREIGN KEY TO users, deliberately. A subscriber is not an account: the app never asks for an
-- email and never stores one, and the only way that stays true is if the list it does keep is not
-- attached to the accounts. The consequence to know about is that deleting an account does NOT
-- remove an address from here -- withdrawal is its own action, which is what the token column is.
--
-- The email is the primary key, so a second submission of the same address is an upsert rather than
-- a second row with a second token of which only one would unsubscribe them.
-- A row here is NOT a subscriber until confirmed_at is set. See engine/subscribe.ts: an address
-- typed into a form is not consent, and in Germany specifically the standard for proving consent is
-- the confirmed variety. Unconfirmed rows are swept after a few days rather than kept.
-- Daily health aggregates read off the user's phone. NEVER raw samples: this product uses a handful
-- of numbers per day, and a per-second heart rate series would be a large pile of special-category
-- data whose only property is risk.
--
-- Primary key is (user_id, date), which is what makes a re-sent day a correction rather than a
-- duplicate. The app re-reads a rolling window every sync because health data arrives late -- a
-- scale that syncs hours after the weigh-in, sleep written the next morning, a watch backfilling.
--
-- The metric columns are GENERATED from HEALTH_FIELDS rather than listed here. A hand-written list
-- is a second source of truth that drifts the first time somebody adds a metric and edits only one
-- of the two places -- and the failure is a column the app sends and the database silently has no
-- home for. The generated "add column if not exists" lines are the migration for exactly that case:
-- a host deployed before a metric existed gains it on the next boot.
-- (No backticks in this string: it is a template literal, and one would end it.)
create table if not exists health_days (
  user_id    uuid not null references users(id) on delete cascade,
  date       text not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);
${HEALTH_COLUMN_DDL}
create index if not exists health_days_user_date_idx on health_days(user_id, date);

create table if not exists subscribers (
  email         text primary key,
  token         text not null unique,
  confirm_token text not null unique,
  confirmed_at  timestamptz,
  source        text not null,
  created_at    timestamptz not null default now()
);
`;

/**
 * Migration for a host whose list predates double opt-in.
 *
 * Separate from SCHEMA because it is conditional in a way a plain DDL string cannot express, and
 * because the grandfathering decision in the middle of it deserves to be read rather than skimmed.
 */
const SUBSCRIBER_MIGRATION = `
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'subscribers' and column_name = 'confirm_token'
  ) then
    alter table subscribers add column confirm_token text;
    alter table subscribers add column confirmed_at timestamptz;
    -- A token for every existing row, so the column can be NOT NULL and UNIQUE like a new one.
    update subscribers set confirm_token = encode(gen_random_bytes(32), 'hex')
      where confirm_token is null;
    -- EXISTING ADDRESSES ARE GRANDFATHERED AS CONFIRMED.
    --
    -- They were submitted under a single-opt-in flow that was live at the time and said what it
    -- would do. Nulling them instead would mean sweeping genuine signups within the week without
    -- ever asking, which is a worse answer to the same question. docs/DEPLOY.md names this so it is
    -- a decision on the record rather than a side effect nobody noticed.
    update subscribers set confirmed_at = created_at where confirmed_at is null;
    alter table subscribers alter column confirm_token set not null;
    alter table subscribers add constraint subscribers_confirm_token_key unique (confirm_token);
  end if;
end $$;

create index if not exists subscribers_created_idx on subscribers(created_at);
-- The sweep reads this one: pending rows, oldest first.
create index if not exists subscribers_pending_idx on subscribers(created_at) where confirmed_at is null;
`;

/** Row shapes as Postgres hands them back. Numbers are coerced at the boundary, once. */
type UserRow = Record<string, unknown>;
type MealRow = Record<string, unknown>;

/**
 * The unsubscribe token. 256 bits of randomness, hex, in one column.
 *
 * It is a capability: whoever holds it can remove that address and nothing else. That is the whole
 * design — an unsubscribe link that needs a login is an unsubscribe link people do not use, and one
 * that takes the address as a parameter lets anyone unsubscribe anyone.
 */
function newSubscriberToken(): string {
  return [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nullableNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function toHealthDay(r: Record<string, unknown>): HealthDay {
  const day = emptyHealthDay(String(r.date));
  for (const f of HEALTH_FIELDS) {
    const v = r[f.key];
    day[f.key] = v === null || v === undefined ? null : Number(v);
  }
  return day;
}

function toProfile(r: UserRow): Profile {
  return {
    user_id: String(r.id),
    lang: (r.lang ?? "en") as Lang,
    goal: (r.goal ?? null) as Profile["goal"],
    sex: (r.sex ?? null) as Profile["sex"],
    birth_year: nullableNum(r.birth_year),
    height_cm: nullableNum(r.height_cm),
    weight_kg: nullableNum(r.weight_kg),
    weight_measured_at: r.weight_measured_at
      ? new Date(r.weight_measured_at as string).toISOString()
      : null,
    target_weight_kg: nullableNum(r.target_weight_kg),
    activity: (r.activity ?? null) as Profile["activity"],
    pace: (r.pace ?? null) as Profile["pace"],
    country: (r.country ?? null) as string | null,
    restrictions: (r.restrictions ?? []) as string[],
    medical_limitations: (r.medical_limitations ?? null) as string | null,
    food_allergies: (r.food_allergies ?? null) as string | null,
    product_limitations: (r.product_limitations ?? null) as string | null,
    onboarded_at: r.onboarded_at ? new Date(r.onboarded_at as string).toISOString() : null,
  };
}

function toMeal(r: MealRow): MealRecord {
  return {
    id: String(r.id),
    user_id: String(r.user_id),
    ts: new Date(r.ts as string).toISOString(),
    date: String(r.date),
    isFood: Boolean(r.is_food),
    items: json<MealItem[]>(r.items, []),
    kcal: num(r.kcal),
    protein_g: num(r.protein_g),
    carbs_g: num(r.carbs_g),
    fat_g: num(r.fat_g),
    satfat_g: num(r.satfat_g),
    fiber_g: num(r.fiber_g),
    sugar_g: num(r.sugar_g),
    sodium_mg: num(r.sodium_mg),
    verdicts: json<MealVerdicts>(r.verdicts, {}),
    confidence: (r.confidence ?? "") as string,
    notes: (r.notes ?? "") as string,
    corrected: Boolean(r.corrected),
    model: (r.model ?? null) as string | null,
  };
}

/** The profile columns a patch may write. A key outside this list is ignored, not interpolated. */
const PROFILE_COLUMNS = [
  "lang", "goal", "sex", "birth_year", "height_cm", "weight_kg", "target_weight_kg",
  "activity", "pace", "country", "restrictions", "medical_limitations", "food_allergies",
  "product_limitations", "onboarded_at",
] as const;

/** The meal columns an update may write. Same rule, same reason. */
const MEAL_COLUMNS: Record<string, string> = {
  items: "items", kcal: "kcal", protein_g: "protein_g", carbs_g: "carbs_g", fat_g: "fat_g",
  satfat_g: "satfat_g", fiber_g: "fiber_g", sugar_g: "sugar_g", sodium_mg: "sodium_mg",
  verdicts: "verdicts", notes: "notes", corrected: "corrected", date: "date",
};

/** Columns that are `jsonb` and must be cast as such in a dynamic update. */
const JSON_COLUMNS = new Set(["items", "verdicts"]);

/**
 * A JS array → a Postgres array literal, e.g. `{"ldl","kidneys"}`.
 *
 * `Bun.sql` does not serialize JS arrays for a `text[]` column, in a tagged template OR in an
 * `unsafe` statement: the array is flattened to `ldl,kidneys` and Postgres answers `malformed array
 * literal`. (`sql.array()` exists but stores each element with its quotes embedded, which is worse
 * — it round-trips as `"ldl"` rather than `ldl`.) Verified against a real database; the in-memory
 * store accepted the raw array happily, so onboarding with any restriction would have 500ed in
 * production while the whole suite stayed green.
 *
 * THE RESULT IS BOUND AS A PARAMETER, never interpolated into SQL, so this is array-literal syntax
 * and not an injection surface — a malformed value is a parse error, not an escape. The quoting
 * still follows Postgres' rules exactly (backslash and double-quote are backslash-escaped) because
 * these values arrive from requests, and "our vocabulary happens to be safe today" is not a
 * property worth depending on.
 */
function toPgTextArray(values: readonly string[]): string {
  if (values.length === 0) return "{}";
  const quoted = values.map((v) => `"${v.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
  return `{${quoted.join(",")}}`;
}

/**
 * jsonb → JS, tolerating a value that was stored double-encoded.
 *
 * The write paths now cast correctly, but a row written before that fix holds a jsonb string, and
 * reading it as an array would hand the app a string it renders as nothing. Parsing defensively
 * here repairs those rows on read instead of requiring a migration to find them.
 */
function json<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v !== "string") return v as T;
  try {
    return JSON.parse(v) as T;
  } catch {
    return fallback;
  }
}

export async function postgresStore(
  databaseUrl: string,
  opts: StoreOptions = {},
): Promise<Store> {
  // Ten, explicitly. The image's `max_connections` is 100 and this is a single-process backend, so
  // ten is generous for the workload and leaves room for a `psql` and the nightly `pg_dump` that
  // cron runs — both of which want a connection at a moment nobody chose.
  const sql = new SQL(databaseUrl, { max: opts.maxConnections ?? 10 });
  await sql.unsafe(SCHEMA);
  // `gen_random_bytes` is pgcrypto's. Requested only here, and only on the upgrade path — a fresh
  // database mints its tokens in TypeScript like every other one and needs no extension at all.
  await sql.unsafe(`create extension if not exists pgcrypto`).catch(() => {
    // A managed Postgres may refuse the extension to a non-superuser. The migration below is the
    // only thing that wants it, so this is fatal ONLY on a host that has rows to migrate — and
    // there the next statement says so with the right error rather than this one.
  });
  await sql.unsafe(SUBSCRIBER_MIGRATION);

  const sessionTtlMs = opts.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const refreshAfterMs = sessionRefreshAfterMs(sessionTtlMs);
  const now = opts.now ?? Date.now;

  /**
   * Delete every token idle past its lifetime, and say how many.
   *
   * The cutoff is computed here rather than written as `now() - interval` in SQL, so an injected
   * clock governs the sweep as well as the lookup. A test that can move time forward but cannot
   * move it forward for the prune is a test of half the behaviour.
   */
  const prune = async (): Promise<number> => {
    const rows = await sql`
      delete from tokens where last_used_at <= ${new Date(now() - sessionTtlMs)}
      returning token_hash`;
    return rows.length;
  };

  return {
    async upsertDeviceUser(deviceId, lang: Lang) {
      const found = await sql`select id from users where device_id = ${deviceId}`;
      let userId: string;
      let created = false;
      if (found.length > 0) {
        userId = String(found[0].id);
      } else {
        const id = crypto.randomUUID();
        await sql`insert into users (id, device_id, lang) values (${id}, ${deviceId}, ${lang})
                  on conflict (device_id) do nothing`;
        // The conflict branch is a genuine race (two cold starts of the same app), not paranoia:
        // re-reading is what makes the second one return the FIRST one's user rather than throwing.
        const row = await sql`select id from users where device_id = ${deviceId}`;
        userId = String(row[0].id);
        created = userId === id;
      }
      // EVERY device auth, not only the first. `users.device_id` is what this method resolves
      // through and the identity row is what "is anything else still linked" counts, so a users
      // row whose identity insert never landed is an account device auth can open and
      // `removeIdentity` would delete. `on conflict do nothing` makes this a no-op in the healthy
      // case and a repair in the other one.
      await sql`insert into identities (provider, subject, user_id)
                values ('device', ${deviceId}, ${userId})
                on conflict (provider, subject) do nothing`;
      return { userId, created };
    },

    async createUser(lang: Lang) {
      const id = crypto.randomUUID();
      await sql`insert into users (id, lang) values (${id}, ${lang})`;
      return id;
    },

    async issueToken(userId) {
      const token = newSessionToken();
      const at = new Date(now());
      await sql`insert into tokens (token_hash, user_id, created_at, last_used_at)
                values (${await hashToken(token)}, ${userId}, ${at}, ${at})`;
      // Minting is rare — a first launch, a sign-in, a 401 recovery — so this is the one write path
      // that can afford to sweep, and it means the table stays bounded without a scheduler.
      await prune();
      return token;
    },

    async userIdForToken(token) {
      const hash = await hashToken(token);
      const at = now();
      // The idle cutoff is in the WHERE clause rather than checked after the fact. A row that is
      // past it must be indistinguishable from a row that does not exist — including in how long
      // the answer takes — and one query with one predicate is the only version of that which
      // cannot drift.
      const rows = await sql`
        select user_id, last_used_at from tokens
        where token_hash = ${hash} and last_used_at > ${new Date(at - sessionTtlMs)}`;
      if (rows.length === 0) return null;

      // Slide the deadline, but only once the stored value is genuinely stale. Writing on every
      // authenticated request would put an UPDATE on the read path of every screen in the app for
      // no additional security — see `sessionRefreshAfterMs`.
      const lastUsed = new Date(rows[0].last_used_at as string).getTime();
      if (at - lastUsed >= refreshAfterMs) {
        await sql`update tokens set last_used_at = ${new Date(at)} where token_hash = ${hash}`;
      }
      return String(rows[0].user_id);
    },

    async pruneExpiredTokens() {
      return prune();
    },

    async revokeToken(token) {
      await sql`delete from tokens where token_hash = ${await hashToken(token)}`;
    },

    async userIdForIdentity(provider, subject) {
      const rows = await sql`
        select user_id from identities where provider = ${provider} and subject = ${subject}`;
      return rows.length > 0 ? String(rows[0].user_id) : null;
    },

    async identityFor(provider, subject) {
      const rows = await sql`
        select user_id, linked_at from identities
        where provider = ${provider} and subject = ${subject}`;
      if (rows.length === 0) return null;
      return {
        userId: String(rows[0].user_id),
        linkedAt: new Date(rows[0].linked_at as string).toISOString(),
      };
    },

    async addIdentity(userId, provider, subject) {
      // `do nothing` then re-read, rather than upsert: a conflict here means the identity belongs
      // to a DIFFERENT account, and silently repointing it would hand one person another's diary.
      await sql`insert into identities (provider, subject, user_id)
                values (${provider}, ${subject}, ${userId})
                on conflict (provider, subject) do nothing`;
      const rows = await sql`
        select user_id from identities where provider = ${provider} and subject = ${subject}`;
      if (String(rows[0].user_id) !== userId) {
        throw new Error("identity already linked to another account");
      }
    },

    async removeIdentity(userId, provider, subject) {
      // One transaction, for the reason `mergeUsers` has one: the removal and the "was that the
      // last way in" test are a single decision, and a delivery that interleaves between them
      // deletes an account somebody can still reach.
      return await sql.begin(async (tx) => {
        // The account row, LOCKED, before anything is read or written.
        //
        // `sql.begin` is READ COMMITTED, where every statement takes a fresh snapshot and another
        // transaction's uncommitted delete is still visible. Without this line the `not exists`
        // below sees a row a concurrent removal has already deleted, both removals conclude
        // something is still linked, and the account survives with no identity on it — which no
        // login path can reach and no deletion path can erase. `for update` also conflicts with
        // the `for key share` an `insert into identities` takes, so a sign-in linking a second
        // provider cannot land inside this either.
        await tx`select 1 from users where id = ${userId} for update`;

        // `user_id` is in the WHERE clause, not merely assumed: the primary key is
        // `(provider, subject)`, so without it this is a delete keyed on an argument that arrived
        // in a message rather than in a session.
        const removed = await tx`
          delete from identities
          where provider = ${provider} and subject = ${subject} and user_id = ${userId}
          returning subject`;
        if (removed.length === 0) return "not-found";

        // Only now, and only when something was actually removed. An account may hold no
        // identities for a moment, and deleting on that alone would erase it.
        const deleted = await tx`
          delete from users u
          where u.id = ${userId}
            and not exists (select 1 from identities where user_id = ${userId})
          returning id`;
        return deleted.length > 0 ? "account-deleted" : "removed";
      });
    },

    async revokeTokensFor(userId) {
      await sql`delete from tokens where user_id = ${userId}`;
    },

    async listIdentities(userId) {
      const rows = await sql`
        select provider, linked_at from identities where user_id = ${userId} order by linked_at asc`;
      return rows.map((r: Record<string, unknown>) => ({
        provider: String(r.provider) as Provider,
        linkedAt: new Date(r.linked_at as string).toISOString(),
      }));
    },

    async mergeUsers(fromUserId, intoUserId) {
      // One transaction. A half-applied merge leaves meals owned by a user row that is about to be
      // deleted, and `on delete cascade` would then destroy the data this operation exists to save.
      return await sql.begin(async (tx) => {
        const moved = await tx`
          update meals set user_id = ${intoUserId} where user_id = ${fromUserId} returning id`;
        await tx`update pendings set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        await tx`update analyses set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        await tx`update chat_messages set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        // The greeting travels with the thread that holds it, or Spud says "First one in." twice.
        await tx`
          update users set first_verdict_at = coalesce(
            first_verdict_at, (select first_verdict_at from users where id = ${fromUserId}))
          where id = ${intoUserId}`;
        // Funnel rows move too: signing in halfway through onboarding is normal, and a run split
        // across two user ids reads as two abandoned runs.
        await tx`update onboarding_events set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        // Health days move, but NEVER over a day the real account already has. The direction is
        // anonymous -> real, and the real account's history is the one with deliberate corrections
        // in it. Filling a gap is a gift; overwriting is data loss with no undo. Matches
        // `store.memory.ts`; a test asserts both.
        await tx`
          delete from health_days h
          where h.user_id = ${fromUserId}
            and exists (
              select 1 from health_days t where t.user_id = ${intoUserId} and t.date = h.date
            )`;
        await tx`update health_days set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        // DROPPED, not repointed — the merged-away account is anonymous, so these are device
        // identities only, and repointing one would let plain device auth walk back into the full
        // account after a sign-out. Matches `store.memory.ts`; a test asserts the behaviour.
        await tx`delete from identities where user_id = ${fromUserId}`;
        // Tokens are deleted, not moved: a token that pointed at the now-empty account must stop
        // working rather than silently start addressing someone else's diary.
        await tx`delete from tokens where user_id = ${fromUserId}`;
        await tx`delete from users where id = ${fromUserId}`;
        return moved.length;
      });
    },

    async getProfile(userId) {
      const rows = await sql`select * from users where id = ${userId}`;
      return rows.length > 0 ? toProfile(rows[0]) : null;
    },

    async patchProfile(userId, patch: ProfilePatch) {
      // `restrictions` is written by its OWN tagged-template statement, not through the dynamic
      // one below.
      //
      // A `text[]` parameter in an `unsafe` statement has no type context, so the driver flattens
      // the JS array to the text `ldl,kidneys` and Postgres rejects it — `malformed array literal`.
      // Adding `::text[]` does not help: the cast sees the already-flattened string. Hand-building
      // `{"ldl","kidneys"}` would work but puts quoting and escaping in our hands for a value that
      // reaches us from a request, and getting that wrong is an injection, not a bug.
      //
      // The tagged template infers the array type properly, so it is used instead. Found only by
      // running against real Postgres: the memory store accepted the array happily, so onboarding
      // with ANY restriction would have 500ed in production while every test passed.
      if (patch.restrictions !== undefined) {
        await sql`update users set restrictions = ${toPgTextArray(patch.restrictions)} where id = ${userId}`;
      }

      const entries = PROFILE_COLUMNS
        .filter((c) => c !== "restrictions" && (patch as Record<string, unknown>)[c] !== undefined)
        .map((c) => [c, (patch as Record<string, unknown>)[c]] as const);
      if (entries.length > 0) {
        // Column names come from the frozen list above, never from the patch's own keys, so no
        // caller-supplied string is ever interpolated into SQL. Values stay parameterised.
        const assignments = entries.map(([c], i) => `${c} = $${i + 2}`).join(", ");
        await sql.unsafe(
          `update users set ${assignments} where id = $1`,
          [userId, ...entries.map(([, v]) => v)],
        );
      }
      const rows = await sql`select * from users where id = ${userId}`;
      if (rows.length === 0) throw new Error("no such user");
      return toProfile(rows[0]);
    },

    async getEntitlement(userId) {
      const rows = await sql`
        select entitlement_expires_at, entitlement_product_id, entitlement_event_at
        from users where id = ${userId}`;
      const r = rows[0];
      if (!r || !r.entitlement_expires_at || !r.entitlement_event_at) return null;
      return {
        expiresAt: new Date(r.entitlement_expires_at as string).toISOString(),
        productId: (r.entitlement_product_id as string | null) ?? "",
        eventAt: new Date(r.entitlement_event_at as string).toISOString(),
      };
    },

    async putEntitlement(userId, entitlement) {
      const eventAt = new Date(entitlement.eventAt);
      // ONE statement carries both refusals, so neither can be forgotten by a caller. No row
      // matches when the user does not exist — RevenueCat can name an id this server never issued
      // — and none matches when what is stored came from a later event than this one.
      const rows = await sql`
        update users set
          entitlement_expires_at = ${new Date(entitlement.expiresAt)},
          entitlement_product_id = ${entitlement.productId},
          entitlement_event_at   = ${eventAt}
        where id = ${userId}
          and (entitlement_event_at is null or entitlement_event_at < ${eventAt})
        returning id`;
      return rows.length > 0;
    },

    async getOnboardingContent() {
      const rows = await sql`select content from onboarding_content where id = 1`;
      if (rows.length === 0) return null;
      return json<OnboardingContent | null>(rows[0].content, null);
    },

    async putOnboardingContent(content) {
      // `::jsonb` on the parameter for the same reason the meal update casts: an untyped parameter
      // is text, and a JSON string landing in a jsonb column stores the STRING rather than the
      // object — it round-trips without error and comes back unusable.
      await sql`
        insert into onboarding_content (id, version, content, updated_at)
        values (1, ${content.version}, ${JSON.stringify(content)}::jsonb, now())
        on conflict (id) do update
          set version = excluded.version,
              content = excluded.content,
              updated_at = now()`;
    },

    async recordOnboardingEvents(userId, events) {
      if (events.length === 0) return 0;
      let added = 0;
      // One statement per event rather than a multi-row insert. The batches are small (the app
      // flushes a screen at a time) and `do nothing` per row means one duplicate does not discard
      // the rest of the batch, which a single multi-row insert with a conflict would.
      for (const e of events) {
        const rows = await sql`
          insert into onboarding_events
            (id, user_id, session_id, place, action, content_version, ms, field, value, at)
          values (${e.id}, ${userId}, ${e.sessionId}, ${e.place}, ${e.action}, ${e.contentVersion},
                  ${e.ms ?? null}, ${e.field ?? null}, ${e.value ?? null}, ${e.at})
          on conflict (id) do nothing
          returning id`;
        if (rows.length > 0) added++;
      }
      return added;
    },

    // ── The mailing list ─────────────────────────────────────────────────────────────────────

    async addSubscriber(email, source) {
      const token = newSubscriberToken();
      const confirmToken = newSubscriberToken();
      // `do update` rather than `do nothing`, so the RETURNING clause always yields a row and the
      // existing tokens come back for an address already known. With `do nothing` a repeat
      // submission returns nothing at all, and the caller cannot tell "already here" from "the
      // insert failed" — which is the difference between a thank-you page and an error page.
      //
      // The update itself is a no-op that touches nothing: the source and the tokens of the first
      // submission are what stay, because re-submitting must not mint a second confirmation link
      // and quietly invalidate the one already sitting in somebody's inbox.
      const rows = await sql`
        insert into subscribers (email, token, confirm_token, source)
        values (${email}, ${token}, ${confirmToken}, ${source})
        on conflict (email) do update set email = excluded.email
        returning token, confirm_token, confirmed_at, (xmax = 0) as inserted`;
      const row = rows[0] as Record<string, unknown> | undefined;
      return {
        // Null once the address is confirmed: that is the caller's signal to send NOTHING. A
        // "you are already subscribed" email is unsolicited mail to somebody who did not ask for
        // it this time.
        confirmToken: row?.confirmed_at ? null : String(row?.confirm_token ?? confirmToken),
        unsubscribeToken: String(row?.token ?? token),
        created: Boolean(row?.inserted),
      };
    },

    async confirmSubscriber(confirmToken) {
      // Idempotent: `confirmed_at` is only written when it is null, and the row is returned either
      // way, so a second click on the link says the same thing as the first.
      const rows = await sql`
        update subscribers set confirmed_at = coalesce(confirmed_at, now())
        where confirm_token = ${confirmToken}
        returning email`;
      return rows.length > 0;
    },

    async removeSubscriber(token) {
      const rows = await sql`delete from subscribers where token = ${token} returning email`;
      return rows.length > 0;
    },

    async countSubscribersSince(sinceIso) {
      // Every row, pending or confirmed. Counting only the confirmed ones would be a cap a bot
      // walks straight through — submitting is what costs a row and an outbound email, and
      // confirming is the part an abuser never does.
      const rows = await sql`select count(*)::int as n from subscribers where created_at >= ${sinceIso}`;
      return num((rows[0] as Record<string, unknown> | undefined)?.n);
    },

    async pruneUnconfirmedSubscribers(beforeIso) {
      const rows = await sql`
        delete from subscribers
        where confirmed_at is null and created_at < ${beforeIso}
        returning email`;
      return rows.length;
    },

    async onboardingFunnel(days): Promise<FunnelAggregate> {
      // `days` is an integer chosen by the engine, never a raw request value, and it is bound as a
      // parameter regardless.
      const since = new Date(now() - days * 24 * 60 * 60 * 1000).toISOString();

      const totals = await sql`
        select count(distinct session_id)::int as sessions,
               count(distinct session_id) filter (where action = 'complete')::int as completed
        from onboarding_events where received_at >= ${since}`;

      // `percentile_cont` over the answer rows only — a median that included view events would be
      // measuring nothing, since a view carries no elapsed time.
      const rows = await sql`
        select place,
               count(*) filter (where action = 'view')::int   as views,
               count(*) filter (where action = 'answer')::int as answers,
               count(*) filter (where action = 'back')::int   as backs,
               count(*) filter (where action = 'reject')::int as rejects,
               percentile_cont(0.5) within group (
                 order by ms
               ) filter (where action = 'answer' and ms is not null) as median_ms
        from onboarding_events
        where received_at >= ${since}
        group by place`;

      return {
        sessions: num(totals[0]?.sessions),
        completed: num(totals[0]?.completed),
        rows: rows.map((r: Record<string, unknown>) => ({
          place: String(r.place),
          views: num(r.views),
          answers: num(r.answers),
          backs: num(r.backs),
          rejects: num(r.rejects),
          medianMs: r.median_ms === null || r.median_ms === undefined ? null : Math.round(Number(r.median_ms)),
        })),
      };
    },

    async insertMeal(m) {
      const rows = await sql`
        insert into meals (id, user_id, ts, date, is_food, items, kcal, protein_g, carbs_g, fat_g,
                           satfat_g, fiber_g, sugar_g, sodium_mg, verdicts, confidence, notes,
                           corrected, model)
        values (${m.id}, ${m.user_id}, ${m.ts}, ${m.date}, ${m.isFood},
                ${JSON.stringify(m.items)}, ${m.kcal}, ${m.protein_g}, ${m.carbs_g}, ${m.fat_g},
                ${m.satfat_g}, ${m.fiber_g}, ${m.sugar_g}, ${m.sodium_mg},
                ${JSON.stringify(m.verdicts)}, ${m.confidence}, ${m.notes}, ${m.corrected},
                ${m.model})
        on conflict (id) do nothing returning id`;
      return rows.length > 0;
    },

    async getMeals(userId, mealIds) {
      if (mealIds.length === 0) return [];
      // Scoped exactly like getMeal; the id list only narrows within this user's rows.
      // Bun.sql sends a JS array as a bare comma list, which Postgres rejects as an array literal;
      // the literal is built by hand. Only UUIDs reach it: the ids came out of this store.
      const literal = `{${mealIds.filter((id) => UUID.test(id)).join(",")}}`;
      const rows = await sql`select * from meals where user_id = ${userId} and id = any(${literal}::uuid[])`;
      return rows.map(toMeal);
    },

    async getMeal(userId, mealId) {
      // A client-supplied id: absent, not a type error at the column (the memory store says null).
      if (!UUID.test(mealId)) return null;
      // Never widen this beyond `id = ? and user_id = ?`.
      const rows = await sql`select * from meals where id = ${mealId} and user_id = ${userId}`;
      return rows.length > 0 ? toMeal(rows[0]) : null;
    },

    async updateMeal(userId, mealId, patch: MealPatch) {
      if (!UUID.test(mealId)) return null;
      const entries = Object.keys(MEAL_COLUMNS)
        .filter((k) => (patch as Record<string, unknown>)[k] !== undefined)
        .map((k) => {
          const v = (patch as Record<string, unknown>)[k];
          return [MEAL_COLUMNS[k]!, k === "items" || k === "verdicts" ? JSON.stringify(v) : v] as const;
        });
      if (entries.length > 0) {
        // `::jsonb` for the JSON columns, same reason as `::text[]` above: an untyped parameter in
        // a dynamic statement is text, so a JSON string lands in a jsonb column as a jsonb STRING
        // rather than as the array it encodes. It round-trips without error and comes back as
        // `"[{...}]"` instead of `[{...}]` — a meal whose items render as nothing after an edit,
        // which is the single most-used path in this app.
        const assignments = entries
          .map(([c], i) => (JSON_COLUMNS.has(c) ? `${c} = $${i + 3}::jsonb` : `${c} = $${i + 3}`))
          .join(", ");
        await sql.unsafe(
          `update meals set ${assignments} where id = $1 and user_id = $2`,
          [mealId, userId, ...entries.map(([, v]) => v)],
        );
      }
      const rows = await sql`select * from meals where id = ${mealId} and user_id = ${userId}`;
      return rows.length > 0 ? toMeal(rows[0]) : null;
    },

    async mealsForDate(userId, date) {
      const rows = await sql`
        select * from meals where user_id = ${userId} and date = ${date} order by ts asc`;
      return rows.map(toMeal);
    },

    async totalsSince(userId, since) {
      const rows = await sql`
        select date, sum(kcal) as kcal, sum(protein_g) as protein_g
        from meals where user_id = ${userId} and date >= ${since}
        group by date order by date desc`;
      return rows.map((r: Record<string, unknown>): DayTotals => ({
        date: String(r.date), kcal: num(r.kcal), protein_g: num(r.protein_g),
      }));
    },

    async putPending(p: PendingMeal) {
      await sql`
        insert into pendings (id, user_id, analysis, date, expires_at)
        values (${p.id}, ${p.userId}, ${JSON.stringify(p.analysis)}, ${p.date},
                ${new Date(p.expiresAt).toISOString()})`;
    },

    async getPending(userId, pendingId) {
      if (!UUID.test(pendingId)) return null;
      const rows = await sql`
        select * from pendings where id = ${pendingId} and user_id = ${userId}`;
      if (rows.length === 0) return null;
      const r = rows[0];
      const expiresAt = new Date(r.expires_at as string).getTime();
      if (expiresAt <= now()) {
        await sql`delete from pendings where id = ${pendingId} and user_id = ${userId}`;
        return null;
      }
      return {
        id: String(r.id), userId: String(r.user_id),
        analysis: json<PendingMeal["analysis"]>(r.analysis, {} as PendingMeal["analysis"]), date: String(r.date), expiresAt,
      };
    },

    async pruneExpiredPendings() {
      const rows = await sql`delete from pendings where expires_at <= ${new Date(now())} returning id`;
      return rows.length;
    },

    async dropPending(userId, pendingId) {
      if (!UUID.test(pendingId)) return false;
      const rows = await sql`delete from pendings where id = ${pendingId} and user_id = ${userId} and expires_at > ${new Date(now())} returning id`;
      return rows.length > 0;
    },

    async appendChat(userId, lines) {
      if (lines.length === 0) return;
      // One transaction, and the account's row locked for its length: a bubble and its card land
      // together or not at all, and — because bigserial hands out numbers outside any transaction —
      // the lock is what keeps a concurrent turn of the same account from taking a seq between them.
      await sql.begin(async (tx) => {
        await tx`select id from users where id = ${userId} for update`;
        for (const line of lines) {
          await tx`
            insert into chat_messages (id, user_id, ts, role, kind, text, meal_id, event, client_id, pending_id)
            values (${crypto.randomUUID()}, ${userId}, ${new Date(now())}, ${line.role}, ${line.kind},
                    ${"text" in line ? line.text : null},
                    ${line.kind === "meal" ? line.mealId : null},
                    ${line.kind === "meal" ? line.event : null},
                    ${line.role === "user" && line.kind === "text" ? line.clientId ?? null : null},
                    ${line.role === "user" && line.kind === "text" ? line.pendingId ?? null : null})`;
        }
      });
    },

    async chatBefore(userId, before, limit) {
      const rows = before === null
        ? await sql`
            select seq, id, user_id, ts, role, kind, text, meal_id, event, client_id, pending_id from chat_messages
            where user_id = ${userId} order by seq desc limit ${limit}`
        : await sql`
            select seq, id, user_id, ts, role, kind, text, meal_id, event, client_id, pending_id from chat_messages
            where user_id = ${userId} and seq < ${before} order by seq desc limit ${limit}`;
      return (rows as Record<string, unknown>[]).map((r) => ({
        id: r.id as string,
        userId: r.user_id as string,
        seq: num(r.seq),
        ts: new Date(r.ts as string).toISOString(),
        role: r.role as ChatMessage["role"],
        kind: r.kind as ChatMessage["kind"],
        text: (r.text as string | null) ?? null,
        mealId: (r.meal_id as string | null) ?? null,
        event: (r.event as ChatMessage["event"]) ?? null,
        clientId: (r.client_id as string | null) ?? null,
        pendingId: (r.pending_id as string | null) ?? null,
      }));
    },

    async countUserChat(userId) {
      const rows = await sql`select count(*)::int as n from chat_messages where user_id = ${userId}`;
      return num(rows[0].n);
    },

    async releaseFirstVerdict(userId) {
      await sql`update users set first_verdict_at = null where id = ${userId}`;
    },

    async claimFirstVerdict(userId) {
      const rows = await sql`
        update users set first_verdict_at = ${new Date(now())}
        where id = ${userId} and first_verdict_at is null returning id`;
      return rows.length > 0;
    },

    async countUserPhotos(userId, date) {
      const rows = await sql`
        select count(*)::int as n from analyses
        where user_id = ${userId} and date = ${date} and scope = 'photo'`;
      return num(rows[0].n);
    },

    async countGlobalAnalyses(date) {
      const rows = await sql`select count(*)::int as n from analyses where date = ${date}`;
      return num(rows[0].n);
    },

    async countUserAnalyses(userId) {
      // Served by the prefix of analyses_user_date_idx (user_id, date, scope).
      const rows = await sql`select count(*)::int as n from analyses where user_id = ${userId}`;
      return num(rows[0].n);
    },

    async recordAnalysis(userId, date, scope) {
      await sql`insert into analyses (user_id, date, scope) values (${userId}, ${date}, ${scope})`;
    },

    async putHealthDays(userId, days) {
      if (days.length === 0) return 0;
      // One transaction: a partially applied batch would leave a day updated and the next one not,
      // and the phone would report a successful sync over a window it did not actually store.
      return await sql.begin(async (tx) => {
        for (const day of days) {
          await tx.unsafe(HEALTH_UPSERT, [
            userId,
            day.date,
            ...HEALTH_FIELDS.map((f) => day[f.key] ?? null),
          ]);
        }
        return days.length;
      });
    },

    async healthDaysSince(userId, since) {
      const rows = await sql`
        select * from health_days where user_id = ${userId} and date >= ${since}
        order by date desc`;
      return rows.map((r: Record<string, unknown>) => toHealthDay(r));
    },

    async deleteUser(userId) {
      // `on delete cascade` clears tokens, meals, pendings, analyses, the chat thread AND onboarding events with the
      // row. The last one is deliberate — see the note on `deleteUser` in the port.
      await sql`delete from users where id = ${userId}`;
    },

    async close() {
      await sql.end();
    },
  };
}
