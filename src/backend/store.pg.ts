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

import { SQL, type TransactionSQL } from "bun";
import { AsyncLocalStorage } from "node:async_hooks";
import type {
  DayTotals, HealthDay, Lang, MealItem, MealQuestion, MealRecord, MealVerdicts, NotificationCopySet,
  OnboardingContentSet, Profile, Provider,
} from "@eait/shared";
import { HEALTH_FIELDS, PROVIDERS, dateMinus, emptyHealthDay, signsIn } from "@eait/shared";
import {
  DEFAULT_SESSION_TTL_MS, hashToken, newSessionToken, sessionRefreshAfterMs,
} from "./auth/tokens.ts";
import { syncShippedPrompts } from "./llm/prompt.ts";
import { type ChatMessage,
  ADMIN_METRICS_MAX_DAYS, ADMIN_USER_PAGE_MAX,
  PORTION_PRIOR_ROWS, blankProfile, portionPriorsFrom, type AdminUserRow, type FunnelAggregate,
  type MealPatch,
  type PendingMeal, type PortionCorrection, type ProfilePatch, type PromptRevision, type PushPlatform, type Store,
  type StoreOptions, type StoredPhoto,
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

/**
 * EVERY TABLE WHOSE ROWS BELONG TO ONE ACCOUNT, and the column that says which.
 *
 * Row-level security is DEFENCE IN DEPTH and not a replacement for anything: every statement in
 * this file still carries its own `user_id = ?`, and `userId` still arrives as an argument resolved
 * from credentials. This is the second answer to the same question — the one that holds when a
 * predicate is forgotten, widened, or written against the wrong column.
 *
 * `users` is here keyed on `id`, because a user row IS the account; the rest key on `user_id`.
 * Absent on purpose, all four of them: `onboarding_content` and `notification_copy` (one row each,
 * id = 1, the same copy for everybody), `llm_prompts` (one set of system prompts for the whole
 * instance, admin-edited, no account anywhere near it) and `subscribers`, which has no account and
 * must never gain one — see the note on that table and the rule in AGENTS.md.
 *
 * A NEW USER-SCOPED TABLE ADDS ITS LINE HERE. The test that reads the CATALOG rather than this list
 * (`store.contract.test.ts`, "row-level security") is what makes that a rule rather than a hope: it
 * enumerates every table carrying a `user_id` and fails naming the one that has no policy.
 */
export const RLS_TABLES: Readonly<Record<string, string>> = {
  users: "id",
  tokens: "user_id",
  identities: "user_id",
  meals: "user_id",
  meal_photos: "user_id",
  pendings: "user_id",
  pairing_codes: "user_id",
  portion_corrections: "user_id",
  analyses: "user_id",
  onboarding_events: "user_id",
  chat_messages: "user_id",
  push_tokens: "user_id",
  health_days: "user_id",
  turns: "user_id",
};

/**
 * The policies, and the three decisions inside them.
 *
 * FORCE, NOT JUST ENABLE. `enable row level security` alone is decorative here, because the backend
 * creates its own tables and therefore OWNS them, and an owner is exempt from its own policies
 * unless they are forced. A superuser is exempt even then, which is why `src/scripts/db.sh` gives
 * the development database to a plain `eait_app` role rather than to the image's superuser, and why
 * the test suite refuses to claim anything while connected as a role that bypasses.
 *
 * THE KEY IS A TRANSACTION-LOCAL SETTING, never a session one. `Bun.sql` pools, so a connection is
 * handed to the next caller the moment a query finishes; a session-level `app.user_id` would make
 * them whoever set it last. The WRAPPER at the bottom of this file sets it with
 * `set_config(…, true)` inside `pool.begin`, and it dies with the transaction — a leaked GUC is
 * worse than no policy at all.
 *
 * A TRANSACTION THAT DECLARES NOTHING SEES NOTHING. `app_user_id()` is null while `app.user_id` is
 * unset, `column = null` is null, and a policy that is not true refuses — so the DEFAULT IS DENY,
 * and a statement reaches a row only by declaring whose row it is. That is the whole point: a read
 * that forgets its own `user_id = ?` returns nothing rather than returning everybody.
 *
 * The statements that belong to no single account — resolving a user from a credential, the
 * RevenueCat webhook, `mergeUsers` moving rows between two, the admin surface, the nightly sweeps —
 * declare `app.unscoped` instead. That is an EXPLICIT, GREPPABLE escape and not a default: every
 * one is named in `SCOPE`, and a reviewer can ask of each entry why it is there.
 */
/**
 * Bumped whenever the policy body below changes. It is written as a comment on each policy and
 * compared on every boot: equal means the database already carries THIS policy and the DDL is
 * skipped entirely, which is what keeps a routine boot from taking fourteen exclusive locks.
 * Forgetting to bump it after an edit leaves every existing database on the old policy.
 */
const POLICY_VERSION = "v1";

const RLS_DDL = `
-- One reader for the setting, so the policies below say what they mean and there is one place the
-- name 'app.user_id' is written. NULLIF because current_setting answers '' (not null) for a setting
-- that has been set and reset inside a session; both mean "nobody said".
create or replace function app_user_id() returns uuid language sql stable as $fn$
  select nullif(current_setting('app.user_id', true), '')::uuid
$fn$;
-- The escape, and it has to be a setting of its own rather than a magic user id: a sentinel uuid
-- would be a value these tables could actually hold, and "the row owned by the sentinel" is a row
-- somebody could go on to create.
create or replace function app_unscoped() returns boolean language sql stable as $fn$
  select coalesce(current_setting('app.unscoped', true), '') = 'on'
$fn$;
` + Object.entries(RLS_TABLES).map(([table, column]) => `
-- GUARDED, AND THE GUARD IS THE POINT. \`alter table\` takes ACCESS EXCLUSIVE even when the flag it
-- sets is already set, because the lock is taken before the check -- and a queued ACCESS EXCLUSIVE
-- blocks every lock request behind it. Unguarded, this ran on all fourteen tables on every boot, so
-- a deploy overlapping the nightly \`pg_dump\` either stalled the whole database until the dump
-- finished or, with the \`lock_timeout\` the migration sets, failed and kept failing for that whole
-- window. Reading pg_class and pg_policy locks neither table, so a boot with nothing to do now
-- takes nothing and succeeds straight through a running dump.
--
-- THE MARKER IS A COMMENT ON THE POLICY, not the policy's existence: the body below can change, and
-- "a policy is there" would then leave the OLD one in place for good. Change the \`using\`/\`with
-- check\` expression and you must bump POLICY_VERSION, which is what makes every database recreate
-- it. Still dropped and recreated rather than altered, inside the implicit transaction the whole
-- schema string runs in, so there is no instant at which the table is live with no policy on it.
do $do$
begin
  if (select relrowsecurity and relforcerowsecurity from pg_class where oid = '${table}'::regclass)
     and (select obj_description(p.oid, 'pg_policy') from pg_policy p
           where p.polrelid = '${table}'::regclass and p.polname = '${table}_app_user')
         is not distinct from '${POLICY_VERSION}'
  then return;
  end if;
  alter table ${table} enable row level security;
  alter table ${table} force row level security;
  drop policy if exists ${table}_app_user on ${table};
  create policy ${table}_app_user on ${table}
    using (app_unscoped() or ${column} = app_user_id())
    with check (app_unscoped() or ${column} = app_user_id());
  comment on policy ${table}_app_user on ${table} is '${POLICY_VERSION}';
end $do$;`).join("\n");

/**
 * The DDL `migrate()` applies, exported so a test can read what the database will accept without
 * needing a database. `prompt.schema.test.ts` is the one reader.
 */
export const SCHEMA = `
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

-- WHAT THIS ACCOUNT IS ALLOWED TO BE (#391a). 'user' or 'admin', defaulted and NOT NULL, so an
-- account can never present an absent role: a gate written role <> 'user' would otherwise read a
-- null as an admin. Deliberately absent from PROFILE_COLUMNS, so nothing a request carries may
-- write it, and absent from the column list mergeUsers copies, so a merge cannot carry a grant
-- from an anonymous session into somebody else's account. Granted out of band only, at boot, from
-- a UUID in configuration.
--
-- (No backticks anywhere in this file's SQL: it is one template literal, and a backtick ends it.)
alter table users add column if not exists role text not null default 'user';

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
-- BEFORE THE BACKFILLS BELOW, WHICH READ IT. It was declared after them once, and the whole
-- server then failed to start against a database that did not already have it: a new dev
-- machine, CI given a clean Postgres, a restore into a fresh schema. Invisible everywhere the
-- column already existed, which is every environment that had ever run the older code.
alter table users add column if not exists entitlement_event_at timestamptz;
-- The perpetual unlock, kept APART from the subscription's expiry above: an account can hold
-- both, and one column carrying both meant a lifetime refund revoked a monthly still paid for.
--
-- ADDED AND BACKFILLED IN ONE BREATH, and the guard is the point. An intermediate version of this
-- code encoded the unlock as a NULL expiry on an existing record, so a database that ran it holds
-- lifetime customers this reader would otherwise see as having bought nothing.
--
-- The backfill must run EXACTLY ONCE, at the moment the column first appears, which is why it is
-- inside the not-exists branch rather than standing on its own. A refunded lifetime with no
-- subscription is expires_at null and lifetime_product_id null and has an event_at — the
-- same shape as an old-model lifetime, and indistinguishable from it. An unguarded backfill would
-- therefore re-grant every refunded lifetime, on every server start, forever.
--
-- On a database that only ever ran the released code this matches nothing: that version refused
-- every event with no expiry, so a stored record always carried a real date.
--
-- KNOWN AND ACCEPTED: the predicate cannot tell an old-model unlock from a new-model refunded one,
-- because both are a null expiry on an existing record. Its correctness rests entirely on firing
-- once, at the true first sight of this column. The only way to break that is to roll back to a
-- binary that predates the column, take a real lifetime purchase through the old code path while
-- the column sits there unknown to it, and roll forward — that purchase would go unbackfilled.
-- There is one compose deploy per host and no blue-green tooling here, so that sequence is not one
-- this system can perform today.
do $do$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'users' and column_name = 'entitlement_lifetime_product_id'
  ) then
    alter table users add column entitlement_lifetime_product_id text;
    update users set entitlement_lifetime_product_id = entitlement_product_id
     where entitlement_event_at is not null and entitlement_expires_at is null;
  end if;
end
$do$;

-- ONE CLOCK PER GRANT, for the same reason there is one column per grant.
--
-- The subscription and the unlock are separate event streams with independent timestamps, so a
-- single ordering key lets a newer event about one refuse an older, never-applied event about the
-- other — permanently, since the webhook answers 200 and nothing is redelivered. Measured before
-- this existed: a lifetime purchase delivered after a monthly cancellation was dropped outright,
-- and a renewal delivered late left the subscription's real end unrecorded, so refunding the
-- unlock revoked a month somebody had paid for.
--
-- entitlement_event_at stays, as the record's EXISTENCE marker and nothing else: it is the max of
-- the two, and it is what tells "bought something once" apart from "never bought".
do $do$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'users' and column_name = 'entitlement_expires_event_at'
  ) then
    alter table users add column entitlement_expires_event_at timestamptz;
    alter table users add column entitlement_lifetime_event_at timestamptz;
    -- SEED ONLY THE CLOCK WHOSE GRANT ACTUALLY EXISTS, and leave the other null.
    --
    -- Existing records carry one timestamp that governed both grants, but it belongs to whichever
    -- stream produced it. Stamping it onto both would give an ordinary subscriber a lifetime clock
    -- for a lifetime they never bought — and their first real unlock, if RevenueCat redelivers it
    -- late, would then be refused as older than an event that never happened. Charged, unlock never
    -- delivered, no retry: exactly the failure the two clocks were added to prevent, reintroduced
    -- by the migration that added them.
    --
    -- A null clock is not a missing value, it is the true statement that this stream has no history
    -- yet, and the guard accepts any first event against it.
    update users set entitlement_expires_event_at = entitlement_event_at
     where entitlement_event_at is not null and entitlement_expires_at is not null;
    update users set entitlement_lifetime_event_at = entitlement_event_at
     where entitlement_event_at is not null and entitlement_lifetime_product_id is not null;
  end if;
end
$do$;
-- When Spud spoke the first verdict. Null until then; the claim is one atomic update.
alter table users add column if not exists first_verdict_at timestamptz;
alter table users add column if not exists entitlement_event_at   timestamptz;
-- Whether the CURRENT period is a free trial. Defaults false, which is what a row written before
-- this column existed reads as -- and false is the safe direction: a trial reminder that never
-- arrives beats one telling somebody who pays that "the free week ends".
alter table users add column if not exists entitlement_trial boolean not null default false;
-- The admin's per-account sample size. Null means the instance default (EAIT__BACKEND__FREE_ANALYSES).
alter table users add column if not exists free_analyses integer;

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
-- THIS token's idle lifetime, in milliseconds. NULL is the store's own, which is what every phone
-- holds; a number is a token minted to live less long than that (#407) — the browser's bearer,
-- which is re-minted from the session cookie on every page load and never needs six idle months.
--
-- bigint rather than integer: the shipped default is 180 days, which is 15.5 billion milliseconds
-- and eight times what int4 holds. Nothing writes that value here today, since the column is for
-- the SHORTER lifetimes — but a column whose type cannot hold the default is one that fails the
-- first time somebody stores it explicitly.
--
-- Added separately, like every other column here, so a host deployed before this gains it on boot.
alter table tokens add column if not exists ttl_ms bigint;
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

-- The address the provider vouched for, since 2026-09-06 (issue #95). NULLABLE and usually null:
-- Apple sends one only on the first authorization ever, so every account linked before the scope
-- was requested has none and never will. Goes with the account, because the row does.
alter table identities add column if not exists email text;

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
-- The question still open on a meal. Nullable and unread by every query but the row's own read:
-- a host that predates it has meals nobody was asked about, which is exactly what null means.
alter table meals add column if not exists question jsonb;

-- The photo lives with the meal. user_id is on the row as well as reachable through the meal, so
-- a read is meal_id AND user_id with no join, and the cascade from users erases it even if a
-- meal were ever orphaned. Bytes as uploaded (1280 px JPEG from the app); no thumbnail column.
create table if not exists meal_photos (
  id         uuid primary key,
  meal_id    uuid not null references meals(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  position   integer not null,
  mime       text not null,
  bytes      bytea not null,
  created_at timestamptz not null default now(),
  unique (meal_id, position)
);
create index if not exists meal_photos_user_meal_idx on meal_photos(user_id, meal_id);
alter table meals add column if not exists photos integer not null default 0;

create table if not exists pendings (
  id         uuid primary key,
  user_id    uuid not null references users(id) on delete cascade,
  analysis   jsonb not null,
  date       text not null,
  expires_at timestamptz not null
);

-- Browser pairing codes, as SHA-256 hashes. Issue #209.
--
-- Same rule as tokens: the column is code_hash and there is no column holding the code itself, so
-- the nightly dump names accounts that were pairing and does not let its reader pair with them.
--
-- user_id is UNIQUE, which is what makes "one live code per account" a constraint rather than a
-- convention -- the replacement happens in putPairingCode, and this is what says so even if a
-- second write path is ever added. The cascade is what stops a code outliving its account.
-- (No backticks in this string: it is a template literal, and one would end it.)
create table if not exists pairing_codes (
  code_hash  text primary key,
  user_id    uuid not null unique references users(id) on delete cascade,
  expires_at timestamptz not null
);

-- What a user's own edits say about their portions. One row per corrected item per edit, kept raw
-- rather than as a running ratio: the summary is a median, and a median cannot be updated in place
-- without keeping what it was computed from.
--
-- The median is NOT computed here. percentile_cont interpolates and the memory store does not, and
-- the number decides the grams the model answers with -- see portionPriorsFrom in store.ts.
-- (No backticks in this string: it is a template literal, and one would end it.)
create table if not exists portion_corrections (
  id           uuid primary key,
  user_id      uuid not null references users(id) on delete cascade,
  name_en      text not null,
  grams_before double precision not null,
  grams_after  double precision not null,
  created_at   timestamptz not null default now()
);
create index if not exists portion_corrections_user_name_idx on portion_corrections(user_id, name_en);

create table if not exists analyses (
  id      bigserial primary key,
  user_id uuid not null references users(id) on delete cascade,
  date    text not null,
  -- 'photo' | 'text'. The per-user cap counts photos only; the global budget counts both.
  scope   text not null default 'photo'
);
create index if not exists analyses_date_idx on analyses(date);
create index if not exists analyses_user_date_idx on analyses(user_id, date, scope);
-- What the provider said the calls behind an analysis cost, summed (#484): null until one is
-- priced. unpriced_calls counts the calls that ended without a price, which makes the sum a floor.
alter table analyses add column if not exists cost_usd double precision;
alter table analyses add column if not exists unpriced_calls integer not null default 0;

-- A billed turn, claimed by the client's id for it before anything runs (#708). The primary key IS
-- the idempotency: a phone that lost an answer re-sends the id, and the second insert does nothing.
-- outcome is what the turn answered, kept for a replay and nulled after a day by
-- forgetTurnOutcomes; the claim itself stays, so a late replay is an unknown and never a rerun.
create table if not exists turns (
  user_id    uuid not null references users(id) on delete cascade,
  client_id  text not null,
  outcome    jsonb,
  claimed_at timestamptz not null default now(),
  primary key (user_id, client_id)
);
create index if not exists turns_claimed_idx on turns(claimed_at) where outcome is not null;

-- The admin-edited onboarding copy. ONE row, pinned to id = 1.
--
-- A single row rather than a version history: the app fetches "what is live", and the thing an
-- admin needs to undo a bad edit is the previous JSON, which is what the version number in the
-- payload is for. Keeping every revision here would be a second product.
--
-- The JSON is a map from language to revision (#358) and was a bare revision before it. No column
-- and no migration: a row written by the older code is read as ENGLISH, which is what it was, and
-- every other language falls back to the copy the binary ships with. See usableContentFor.
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
alter table chat_messages add column if not exists speaker text;
-- How a turn was produced (#486): the router's intent on the words it read, the model on the words
-- a model wrote. Nullable and never backfilled: a line from before this has no honest answer.
alter table chat_messages add column if not exists intent text;
alter table chat_messages add column if not exists model text;
-- The analysis that paid for the turn this line opened (#525). No foreign key, on purpose, like
-- meal_id: if that row goes the line keeps naming it, and the admin reads "analysis gone" rather
-- than a turn that cost nothing.
alter table chat_messages add column if not exists analysis_id bigint;
create index if not exists chat_messages_user_seq_idx on chat_messages(user_id, seq desc);

-- Push tokens. ONE ROW PER DEVICE, keyed on the token itself rather than on (user, token).
--
-- That is what an Expo push token is: an installation. Keying on the pair would let the same phone
-- hold rows for two accounts, and the evening sweep would then push one person's day to the lock
-- screen of somebody who had signed out of it. The upsert MOVES the row instead.
--
-- Cascades with the user, like everything else that names a device. A token this server keeps is a
-- message it will try to send.
create table if not exists push_tokens (
  token      text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  platform   text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on push_tokens(user_id);

-- The admin-edited notification copy. ONE row, pinned to id = 1, exactly like onboarding_content.
-- Its own table rather than a field on that one: two admin screens, and a save of either must not
-- be able to overwrite the other's work.
create table if not exists notification_copy (
  id         integer primary key check (id = 1),
  copy       jsonb not null,
  updated_at timestamptz not null default now()
);

-- The system prompts, when an admin has overridden one. APPEND-ONLY.
--
-- (key, version) rather than one row per key, and that is the difference from the two tables
-- above. Onboarding copy and notification copy are pinned to id = 1 because an admin undoing a bad
-- edit needs the previous JSON and the payload carries it. A prompt carries nothing: an edit to it
-- changes what the model was asked, on every analysis after it, with no trace in the analysis rows.
-- So nothing is ever overwritten here, getPrompts reads the newest version per key, and the
-- history is what answers "what were we sending in August".
--
-- NO user_id, AND THAT IS THE SCHEMA SAYING SO. A prompt is not a user's data — it is the
-- instruction this server sends on behalf of every account, written by the admin role and read by
-- the LLM transport. The per-user scoping rule protects queries that could be widened past one
-- account; there is no account here to widen past. A per-user prompt would need this column and
-- would be a different feature.
--
-- THE KEY LIST IS WRITTEN OUT BY HAND, and it is meant to be. Generated from PROMPT_KEYS it
-- could never disagree with the code, and so could never catch the thing it is here to catch: a
-- seventh prompt added to the code and never given a home here, whose first admin save fails in
-- production. prompt.schema.test.ts compares the two lists and fails naming the key; the store
-- contract suite proves the same against a real database.
create table if not exists llm_prompts (
  key        text not null,
  version    integer not null,
  text       text not null,
  source     text not null default 'shipped',
  updated_at timestamptz not null default now(),
  primary key (key, version)
);
-- WHO WROTE THE REVISION, and the column the sync turns on. Every store comes up holding the
-- shipped text, so rows win everywhere -- and without this, a prompt edited in llm/prompt.ts could
-- never reach an instance that had already booted, because nothing could tell a row the shipper
-- wrote from a row a person wrote. Defaulted to 'shipped' for a host that predates the column: the
-- only rows it can have are ones postgresStore wrote itself.
alter table llm_prompts add column if not exists source text not null default 'shipped';
alter table llm_prompts drop constraint if exists llm_prompts_source_check;
alter table llm_prompts add constraint llm_prompts_source_check
  check (source in ('shipped', 'admin'));
-- THE KEY LIST IS A NAMED CONSTRAINT, DROPPED AND RE-ADDED ON EVERY MIGRATE, and not an inline
-- check in the statement above. create table if not exists skips the WHOLE statement on a host
-- that already has the table, so an inline list would reach a fresh database and never an existing
-- one -- and the anonymous constraint left over from the first deploy would go on refusing the new
-- key while the code sent it. Re-adding it here is idempotent, and a row that violates a narrowed
-- list fails the migration loudly rather than being discovered by an admin's save.
alter table llm_prompts drop constraint if exists llm_prompts_key_check;
alter table llm_prompts add constraint llm_prompts_key_check
  check (key in ('analysis', 'route', 'text_meal', 'text_correction', 'glance', 'coach'));

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
${RLS_DDL}
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

/** One `llm_prompts` row. `updated_at` is an ISO string on both stores, so the two can be compared. */
const toPromptRevision = (r: Record<string, unknown>): PromptRevision => ({
  key: String(r.key),
  version: Number(r.version),
  text: String(r.text),
  source: (r.source === "admin" ? "admin" : "shipped"),
  updated_at: new Date(r.updated_at as string).toISOString(),
});

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
    question: json<MealQuestion | null>(r.question, null),
    photos: num(r.photos),
  };
}

function toChat(r: Record<string, unknown>): ChatMessage {
  return {
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
    speaker: (r.speaker as ChatMessage["speaker"]) ?? null,
    intent: (r.intent as ChatMessage["intent"]) ?? null,
    model: (r.model as string | null) ?? null,
    analysisId: r.analysis_id === null || r.analysis_id === undefined ? null : String(r.analysis_id),
  };
}

/** bytea comes back from Bun.sql as a Buffer; the `\\x…` hex form is accepted in case a driver answers that way. */
function toBytes(v: unknown): Uint8Array {
  if (v instanceof Uint8Array) return new Uint8Array(v);
  if (typeof v === "string" && v.startsWith("\\x")) return Uint8Array.from(Buffer.from(v.slice(2), "hex"));
  throw new Error("bytea column came back in an unexpected shape");
}

const toPhoto = (r: Record<string, unknown>): StoredPhoto =>
  ({ position: Number(r.position), mime: String(r.mime), bytes: toBytes(r.bytes) });

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
  question: "question", model: "model", confidence: "confidence",
};

/** Columns that are `jsonb` and must be cast as such in a dynamic update. */
const JSON_COLUMNS = new Set(["items", "verdicts", "question"]);

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

/**
 * The sign-in providers as a SQL array literal, derived from `signsIn` rather than typed out again:
 * the predicate is the rule, and a second copy of it inside a query is the one that goes stale.
 *
 * BUILT BY HAND, like `getMeals`'s id list and for the same reason — Bun.sql sends a JS array as a
 * bare comma list, which Postgres rejects as an array literal. Every value here is a compile-time
 * constant from `PROVIDERS`.
 */
const SIGN_IN_PROVIDERS = `{${PROVIDERS.filter(signsIn).join(",")}}`;

/**
 * WHOSE ROWS EACH STORE METHOD IS ALLOWED TO TOUCH — the table that turns the policies above from a
 * rule into an enforced one.
 *
 * Every method is here, and the test "every store method is classified" fails naming any that is
 * not, so a method added later cannot quietly inherit either answer.
 *
 *  - a NUMBER is the argument position holding the user id. The wrapper declares that user for the
 *    length of the call, and the database then refuses every row belonging to anybody else — which
 *    is what makes a forgotten `user_id = ?` return nothing instead of returning the table.
 *  - a FUNCTION is the same thing where the id arrives inside a record rather than as an argument.
 *  - "unscoped" declares `app.unscoped` instead, and every one of them is a deliberate decision
 *    with a reason beside it. This is the escape hatch, and it is spelled out precisely so that
 *    adding one is an edit a reviewer sees.
 *  - "raw" runs no transaction at all. `close` only, because it ends the pool.
 */
export type Scoping = number | "unscoped" | "raw" | ((args: readonly unknown[]) => unknown);

export const SCOPE: Readonly<Record<string, Scoping>> = {
  // ── Resolving WHO somebody is. None of these can name a user first: that is their output, not
  // their input, and a credential is the only thing they are given.
  upsertDeviceUser: "unscoped",
  createUser: "unscoped",
  userIdForToken: "unscoped",
  userIdForIdentity: "unscoped",
  identityFor: "unscoped",
  claimPairingCode: "unscoped",
  // A token is revoked by the token. The holder of a session is signing it out and the row is the
  // only thing naming the account.
  revokeToken: "unscoped",

  // ── Operations that span TWO accounts, and would refuse half their own work under either one.
  mergeUsers: "unscoped",
  moveIdentity: "unscoped",
  // One Expo push token is one INSTALLATION, and the upsert deliberately MOVES it between accounts
  // when a phone signs into a different one — the invariant on `push_tokens`. Scoped to the new
  // owner, the policy would hide the existing row and the move would become a duplicate.
  putPushToken: "unscoped",

  // ── Cross-user by definition: the admin surface, the funnel, the global budget.
  hasAdmin: "unscoped",
  adminListUsers: "unscoped",
  adminMetrics: "unscoped",
  onboardingFunnel: "unscoped",
  countGlobalAnalyses: "unscoped",
  usersWithPushTokens: "unscoped",

  // ── Sweeps. Global by definition — scoped to one user they would sweep one user.
  forgetTurnOutcomes: "unscoped",
  pruneExpiredTokens: "unscoped",
  pruneExpiredPendings: "unscoped",
  pruneHealthDaysBefore: "unscoped",
  pruneUnconfirmedSubscribers: "unscoped",

  // ── Rows belonging to nobody: the single-row admin copy, and the mailing list, which has no
  // account and must never gain one.
  getOnboardingContent: "unscoped",
  putOnboardingContent: "unscoped",
  // The six system prompts. One set for the whole instance, admin-edited, no account anywhere.
  getPrompts: "unscoped",
  putPrompt: "unscoped",
  promptRevisions: "unscoped",
  getNotificationCopy: "unscoped",
  putNotificationCopy: "unscoped",
  addSubscriber: "unscoped",
  confirmSubscriber: "unscoped",
  removeSubscriber: "unscoped",
  countSubscribersSince: "unscoped",

  // ── The pool itself.
  close: "raw",

  // ── Everything else names its user, and almost always first.
  issueToken: 0,
  revokeTokensFor: 0,
  addIdentity: 0,
  setIdentityEmail: 0,
  removeIdentity: 0,
  listIdentities: 0,
  identitySubject: 0,
  emailForUser: 0,
  putPairingCode: 0,
  roleOf: 0,
  setRole: 0,
  getProfile: 0,
  patchProfile: 0,
  getEntitlement: 0,
  // The one user id in this codebase that comes out of a request body. Declaring it is TIGHTER than
  // not: the webhook then cannot write a row belonging to anybody but the account it names.
  putEntitlement: 0,
  dropPushToken: 0,
  pushTokensFor: 0,
  recordOnboardingEvents: 0,
  getMeal: 0,
  getMeals: 0,
  updateMeal: 0,
  deleteMeal: 0,
  mealsForDate: 0,
  mealsSince: 0,
  putPhotos: 0,
  appendPhotos: 0,
  getPhotos: 0,
  getPhoto: 0,
  totalsSince: 0,
  recordPortionCorrections: 0,
  portionPriors: 0,
  appendChat: 0,
  chatBefore: 0,
  countUserChat: 0,
  getLine: 0,
  photoLineFor: 0,
  deleteLine: 0,
  deleteMealLines: 0,
  updateLineText: 0,
  claimFirstVerdict: 0,
  releaseFirstVerdict: 0,
  getPending: 0,
  pendingsFor: 0,
  dropPending: 0,
  countUserPhotos: 0,
  countUserAnalyses: 0,
  getFreeAnalyses: 0,
  setFreeAnalyses: 0,
  recordAnalysis: 0,
  addCost: 0,
  analysisCosts: 0,
  undoAnalysis: 0,
  putHealthDays: 0,
  healthDaysSince: 0,
  claimTurn: 0,
  getTurn: 0,
  settleTurn: 0,
  // The cascade takes tokens, meals, photos, the thread and the rest with the row. Referential
  // actions bypass row security by design, so scoping this to the account being erased is safe.
  deleteUser: 0,

  // ── The id arrives inside the record rather than beside it.
  insertMeal: (args) => (args[0] as { user_id: string }).user_id,
  putPending: (args) => (args[0] as { userId: string }).userId,
};

export async function postgresStore(
  databaseUrl: string,
  opts: StoreOptions = {},
): Promise<Store> {
  // The fallback only: `EAIT__BACKEND__DATABASE_MAX_CONNECTIONS` is where this is set, and
  // `index.ts` passes it in. Twenty-five, and it was ten until the policies arrived. That is not
  // arbitrary tuning: every
  // method below now runs inside a transaction for its whole duration, so this is a ceiling on
  // in-flight store CALLS where it used to be one on in-flight statements. Callers that fan out --
  // `engine/chat.ts` and `engine/entitlement.ts` each await two store calls at once -- turned ten
  // into about five concurrent requests. The image's `max_connections` is 100 and this is a
  // single-process backend, so twenty-five still leaves room for a `psql` and the nightly
  // `pg_dump` that cron runs, both of which want a connection at a moment nobody chose.
  const pool = new SQL(databaseUrl, { max: opts.maxConnections ?? 25 });

  /**
   * THE CONNECTION THE CURRENT CALL IS ON, or the pool when there is no call in progress.
   *
   * Under a deny-by-default policy a statement has to run on the connection that declared the user,
   * and there are ninety-nine of them below written against `sql`. Rather than thread a transaction
   * through every one — a rename that would touch this whole file and be wrong in exactly one place
   * — `sql` IS the current connection: a proxy that forwards each call to whatever transaction the
   * wrapper put in async context, and to the pool outside one.
   *
   * `AsyncLocalStorage` is what makes that safe under concurrency. Two requests interleaving hold
   * different contexts, so neither can reach the other's transaction; a module-level variable
   * would be the same bug as a session-level GUC, one level up.
   */
  const active = new AsyncLocalStorage<TransactionSQL>();
  const sql = new Proxy(function () {} as unknown as SQL, {
    apply: (_t, _this, args: unknown[]) =>
      (active.getStore() ?? pool)(...(args as Parameters<SQL>)),
    get: (_t, prop: string) => {
      const conn = (active.getStore() ?? pool) as unknown as Record<string, unknown>;
      const value = conn[prop];
      return typeof value === "function" ? value.bind(conn) : value;
    },
  }) as SQL;

  /**
   * The transaction a multi-statement operation needs, reusing the one it is already inside.
   *
   * Every method reaches its body through the wrapper below, which has already opened a transaction
   * and declared the user — so this joins it. Bun REFUSES a `begin` on a transaction (it is not a
   * savepoint), which is why these read through here rather than calling `sql.begin` directly.
   */
  const inTx = <T>(body: (tx: TransactionSQL) => Promise<T>): Promise<T> => {
    const current = active.getStore();
    if (current) return body(current);
    return pool.begin((tx) => active.run(tx, () => body(tx))) as Promise<T>;
  };

  // THE MIGRATION RUNS UNSCOPED, ON A CONNECTION THAT IS THEN THROWN AWAY.
  //
  // The DDL itself is indifferent to row security, but the BACKFILLS are not: the blocks below
  // carry `update` statements that repair old rows, and on a database that already has the policies
  // — which is every database from the second boot onwards — an undeclared `update` matches nothing
  // and reports success. A migration that silently touches zero rows is the exact failure this
  // repository has been bitten by before, and it would be invisible until somebody read the data.
  //
  // Its own connection, ended in the `finally`, rather than a pooled one: the setting is
  // session-level, so anything that inherited this connection afterwards would inherit the escape
  // with it. Closing it is what makes that impossible even if the migration throws.
  const migrator = new SQL(databaseUrl, { max: 1 });
  try {
    await migrator`select set_config('app.unscoped', 'on', false)`;
    // FAIL FAST RATHER THAN QUEUE. The policy DDL is `alter table … enable/force row level
    // security` plus a `drop`/`create policy` per table, and each takes ACCESS EXCLUSIVE -- where
    // the rest of this schema is `create … if not exists`, which takes nothing on an object that
    // is already there. A queued ACCESS EXCLUSIVE request also blocks every lock request behind
    // it, so a deploy landing while the nightly `pg_dump` holds ACCESS SHARE would stall reads and
    // writes on all fourteen tables for the length of the dump. With a timeout the migration
    // errors instead, the container exits, and `restart: unless-stopped` brings it back to try
    // again -- a bounded stall and a loud log in place of an unbounded silent one.
    await migrator`select set_config('lock_timeout', '5s', false)`;
    await migrator.unsafe(SCHEMA);
    // `gen_random_bytes` is pgcrypto's. Requested only here, and only on the upgrade path — a fresh
    // database mints its tokens in TypeScript like every other one and needs no extension at all.
    await migrator.unsafe(`create extension if not exists pgcrypto`).catch(() => {
      // A managed Postgres may refuse the extension to a non-superuser. The migration below is the
      // only thing that wants it, so this is fatal ONLY on a host that has rows to migrate — and
      // there the next statement says so with the right error rather than this one.
    });
    await migrator.unsafe(SUBSCRIBER_MIGRATION);
  } finally {
    await migrator.end();
  }

  // IS THE SECOND LOCK ACTUALLY LOCKED? A superuser — and a role with BYPASSRLS — reads and writes
  // every row whatever a policy says, so on such a connection the DDL above is decorative and
  // nothing in the running product would ever say so. This is the one place that can tell: the
  // development stack is handled (`src/scripts/db.sh` gives the database to a plain `eait_app`),
  // and the deployed one is configured outside this repository.
  //
  // SAID, NOT REFUSED. The server ran for months with no policies at all, and an inert second lock
  // is not a reason to refuse to start and take the product down on a deploy — it is a reason for
  // the line to be in the log of every boot until somebody fixes the role.
  // EVERY role this one is a member of, not just its own attributes. `BYPASSRLS` is inherited
  // through `grant <role> to eait_app`, so asking only about `rolname = current_user` would stay
  // silent in exactly the case this check exists for -- a managed host, or one well-meant `grant`
  // on the box, leaving all fourteen policies inert with nothing in the log.
  const [rls] = await pool`
    select bool_or(rolsuper or rolbypassrls) as bypasses, current_user as rolname
    from pg_roles where pg_has_role(current_user, oid, 'usage')`;
  if (rls?.bypasses) {
    console.error(
      `[eait] row-level security is INERT: this connection is ${rls.rolname}, which bypasses it ` +
      `(superuser or BYPASSRLS). The per-user policies are applied but can refuse nothing. ` +
      `Connect as an ordinary role that owns the database.`,
    );
  }

  const sessionTtlMs = opts.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const now = opts.now ?? Date.now;

  /**
   * ONE STATEMENT INSIDE A SCOPED CALL THAT IS GLOBAL BY DEFINITION.
   *
   * Almost nothing needs this: a method that belongs to no account says so in `SCOPE` and is
   * wrapped unscoped from the start. This is for the other shape — a method that IS one user's
   * (`issueToken` is) and carries one statement that is not (its sweep of the whole `tokens`
   * table). Scoped, that sweep would only ever clear the minting user's own rows, and the table
   * would grow forever on everybody who never comes back — which is the exact thing it exists to
   * prevent.
   *
   * Restored in a `finally`, and restored rather than left on, so the escape lasts one statement
   * instead of the rest of the transaction.
   */
  const unscoped = async <T>(body: () => Promise<T>): Promise<T> => {
    const conn = active.getStore();
    // REFUSED, not run anyway. Off a transaction there is nothing to set the escape on, so the
    // body would go to the pool declaring neither a user nor the escape -- every policy refuses,
    // the sweep deletes nothing, and it all reports success. That is the exact silent denial this
    // design exists to make loud, so it is an error rather than a quiet zero. Every caller today
    // reaches here through the wrapper, which always opens one; this is for the next one.
    if (!conn) {
      throw new Error("[eait] unscoped() called outside a store transaction: nothing would be declared");
    }
    // The PREVIOUS value, not `off`. A method that is itself "unscoped" reaches here through a
    // helper -- `pruneExpiredTokens` does, via `prune` -- and restoring `off` would leave the rest
    // of ITS transaction scoped to a user it never declared, which matches nothing and reports
    // success. That is the silent-denial failure these policies exist to make loud, arriving by
    // the back door.
    const before = await conn`select coalesce(current_setting('app.unscoped', true), '') as v`;
    const previous = String(before[0]?.v ?? "");
    await conn`select set_config('app.unscoped', 'on', true)`;
    try {
      return await body();
    } finally {
      // SWALLOWED, DELIBERATELY, and only here. If `body()` failed with a Postgres error the
      // transaction is already aborted, so this restore throws `25P02` on its way out -- and a
      // `finally` that throws REPLACES the pending exception, so the deadlock or lock timeout that
      // actually happened would reach the caller and the log as "current transaction is aborted".
      // On that path the setting dies with the transaction anyway, so there is nothing to restore.
      try {
        await conn`select set_config('app.unscoped', ${previous}, true)`;
      } catch { /* the transaction is going away; the original error is the one worth having */ }
    }
  };


  /**
   * Delete every token idle past its lifetime, and say how many.
   *
   * The cutoff is computed here rather than written as `now() - interval` in SQL, so an injected
   * clock governs the sweep as well as the lookup. A test that can move time forward but cannot
   * move it forward for the prune is a test of half the behaviour.
   */
  const prune = async (): Promise<number> => {
    // `coalesce(ttl_ms, …)` rather than one cutoff for the whole table: a row may carry its own
    // lifetime (#407), and a sweep that used the store's would leave a short-lived token in the
    // table for six months after it stopped working.
    //
    // EXPLICITLY UNSCOPED, because `issueToken` reaches here inside ONE user's scope and this
    // sweep is the whole table's. See `unscoped` above for why that is not the same mistake the
    // policies exist to catch.
    const rows = await unscoped(async () => await sql`
      delete from tokens
      where last_used_at + make_interval(secs => coalesce(ttl_ms, ${sessionTtlMs}) / 1000.0)
            <= ${new Date(now())}
      returning token_hash`);
    return rows.length;
  };

  // Declared before the store object so the prompt sync below can be the LAST thing this
  // function does — and wrapped before that, so the sync goes through a scoped store like
  // every other caller rather than around it.
  const methods: Store = {
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

    async roleOf(userId) {
      const rows = await sql`select role from users where id = ${userId}`;
      const row = rows[0] as { role: string } | undefined;
      return row ? (row.role === "admin" ? "admin" : "user") : null;
    },

    async setRole(userId, role) {
      // `returning` rather than a count: an id that names no account must answer false rather than
      // succeed silently, because the only caller is a bootstrap reading a UUID somebody typed.
      const rows = await sql`update users set role = ${role} where id = ${userId} returning id`;
      return rows.length > 0;
    },

    async hasAdmin() {
      const rows = await sql`select 1 from users where role = 'admin' limit 1`;
      return rows.length > 0;
    },

    async createUser(lang: Lang) {
      const id = crypto.randomUUID();
      await sql`insert into users (id, lang) values (${id}, ${lang})`;
      return id;
    },

    async issueToken(userId, ttlMs) {
      const token = newSessionToken();
      const at = new Date(now());
      await sql`insert into tokens (token_hash, user_id, created_at, last_used_at, ttl_ms)
                values (${await hashToken(token)}, ${userId}, ${at}, ${at}, ${ttlMs ?? null})`;
      // Minting is rare — a first launch, a sign-in, a 401 recovery — so this is the one write path
      // that can afford to sweep, and it means the table stays bounded without a scheduler.
      //
      // LAST, DELIBERATELY. Inside the per-call transaction the wrapper opens, the row locks this
      // takes on other accounts' expired rows are held until COMMIT, where an autocommit statement
      // released them at once. Keeping it last makes that window the commit itself. Giving the
      // sweep its OWN connection would shorten it further and was rejected: a method that holds one
      // pooled connection while waiting for a second deadlocks the whole pool at saturation, which
      // is a worse failure than brief contention over rows that are already expired.
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
        select user_id, last_used_at, ttl_ms from tokens
        where token_hash = ${hash}
          and last_used_at + make_interval(secs => coalesce(ttl_ms, ${sessionTtlMs}) / 1000.0)
              > ${new Date(at)}`;
      if (rows.length === 0) return null;

      // Slide the deadline, but only once the stored value is genuinely stale. Writing on every
      // authenticated request would put an UPDATE on the read path of every screen in the app for
      // no additional security — see `sessionRefreshAfterMs`.
      //
      // The interval is an eighth of THIS ROW's lifetime. An eighth of the store's would never come
      // around inside a short-lived token's life, so such a token would expire mid-use however
      // often it was presented.
      const lastUsed = new Date(rows[0].last_used_at as string).getTime();
      const ttl = rows[0].ttl_ms === null ? sessionTtlMs : Number(rows[0].ttl_ms);
      if (at - lastUsed >= sessionRefreshAfterMs(ttl)) {
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
        select user_id, linked_at, email from identities
        where provider = ${provider} and subject = ${subject}`;
      if (rows.length === 0) return null;
      return {
        userId: String(rows[0].user_id),
        linkedAt: new Date(rows[0].linked_at as string).toISOString(),
        email: (rows[0].email as string | null) ?? null,
      };
    },

    async addIdentity(userId, provider, subject) {
      // `do nothing` then re-read, rather than upsert: a conflict here means the identity belongs
      // to a DIFFERENT account, and silently repointing it would hand one person another's diary.
      await sql`insert into identities (provider, subject, user_id)
                values (${provider}, ${subject}, ${userId})
                on conflict (provider, subject) do nothing`;
      // THE READ-BACK IS UNSCOPED, because the row it has to find belongs to somebody else. That
      // is the entire case this method exists for, and scoped it is the one case that cannot work:
      // the policy hides the conflicting row, the result is empty, and the refusal below became a
      // `TypeError` on `rows[0]` -- an opaque 500 where a domain error was owed, and a divergence
      // from `store.memory.ts`, which refuses properly.
      const rows = await unscoped(async () => await sql`
        select user_id from identities where provider = ${provider} and subject = ${subject}`);
      if (String(rows[0]?.user_id) !== userId) {
        throw new Error("identity already linked to another account");
      }
    },

    async moveIdentity(userId, provider, subject) {
      // `SCOPE: "unscoped"`, and the reason is the whole point of the method: the row it moves
      // belongs to the OTHER account until the update lands, so a transaction that declared this
      // user would be shown no row, insert a second one, and hit the primary key. Like
      // `mergeUsers`, this spans two accounts and therefore names neither.
      return await inTx(async (tx) => {
        // The account taking the identity, locked first — the same lock `removeIdentity` takes, so
        // the two serialise against each other and against a sign-in linking a second provider.
        await tx`select 1 from users where id = ${userId} for update`;
        const [held] = await tx`
          select user_id from identities
          where provider = ${provider} and subject = ${subject} for update`;
        if (held === undefined) {
          await tx`insert into identities (provider, subject, user_id)
                   values (${provider}, ${subject}, ${userId})`;
          return "linked";
        }
        if (String(held.user_id) === userId) return "linked";
        await tx`update identities set user_id = ${userId}, linked_at = now()
                 where provider = ${provider} and subject = ${subject}`;
        return "moved";
      });
    },

    async setIdentityEmail(userId, provider, subject, email) {
      // `user_id` in the WHERE, not checked after a read: the scope is what makes this safe, and a
      // row that belongs to another account simply matches nothing.
      await sql`update identities set email = ${email}
                where provider = ${provider} and subject = ${subject} and user_id = ${userId}`;
    },

    async removeIdentity(userId, provider, subject) {
      // One transaction, for the reason `mergeUsers` has one: the removal and the "was that the
      // last way in" test are a single decision, and a delivery that interleaves between them
      // deletes an account somebody can still reach.
      return await inTx(async (tx) => {
        // The account row, LOCKED, before anything is read or written.
        //
        // The transaction this call runs in is READ COMMITTED, where every statement takes a fresh
        // snapshot and another
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
        //
        // WAYS IN, not rows: `signsIn` says which providers can mint a session, and a `telegram`
        // row cannot. Left counting rows, this kept alive an account whose only remaining identity
        // was a transport — unreachable by every login path and by this deletion path too.
        const deleted = await tx`
          delete from users u
          where u.id = ${userId}
            and not exists (
              select 1 from identities
              where user_id = ${userId} and provider = any(${SIGN_IN_PROVIDERS}::text[])
            )
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

    async adminListUsers({ q, limit, cursor, today }) {
      const bounded = Math.min(Math.max(1, Math.trunc(limit)), ADMIN_USER_PAGE_MAX);

      // ── THE FILTER, AND WHY IT IS TWO EXACT MATCHES ────────────────────────────────────────
      //
      // An address is compared folded and WHOLE; an id is matched by PREFIX. Neither is a
      // `like '%…%'`, which is a sequential scan of every account on the box that also serves the
      // app — and neither question the admin actually asks needs one.
      //
      // A `q` that is neither shape matches NOTHING. Falling through to an unfiltered list would
      // turn a typo in a support ticket into a dump of the user table.
      const needle = (q ?? "").trim();
      const isPrefix = needle !== "" && /^[0-9a-f-]{4,36}$/i.test(needle);
      const filtered = needle !== "";
      if (filtered && !isPrefix && !needle.includes("@")) return { rows: [], nextCursor: null };

      // The cursor is `(created_at, id)` — a KEYSET, never an offset. An offset pages wrong the
      // moment a row is inserted mid-walk, and on this table that is somebody signing up.
      const at = cursor === undefined ? null : cursor.slice(0, cursor.lastIndexOf("~"));
      const afterId = cursor === undefined ? null : cursor.slice(cursor.lastIndexOf("~") + 1);
      if (cursor !== undefined && (at === "" || afterId === "" || !UUID.test(afterId!))) {
        return { rows: [], nextCursor: null };
      }

      // One statement and one round trip. The five sub-selects are each an index seek on a column
      // that already has an index (`identities_user_idx`, `analyses_user_date_idx`, the tokens
      // primary key's table) — the alternative is a query per row, which is what makes an admin
      // list slow enough that somebody eventually adds a cache to it.
      const rows = await sql`
        select u.id, u.created_at, u.onboarded_at, u.free_analyses,
               u.entitlement_expires_at, u.entitlement_lifetime_product_id,
               u.entitlement_product_id, u.entitlement_event_at, u.entitlement_trial,
               (select array_agg(i.provider order by i.linked_at asc)
                  from identities i where i.user_id = u.id) as providers,
               (select i.email from identities i
                 where i.user_id = u.id and i.email is not null
                 order by i.linked_at asc limit 1) as email,
               (select max(t.last_used_at) from tokens t where t.user_id = u.id) as last_seen,
               (select count(*) from analyses a where a.user_id = u.id) as spent,
               (select count(*) from analyses a
                 where a.user_id = u.id and a.date = ${today}) as today
          from users u
         where (${!filtered}
                or (${isPrefix} and u.id::text like ${needle.toLowerCase() + "%"})
                or exists (select 1 from identities i
                            where i.user_id = u.id and lower(i.email) = ${needle.toLowerCase()}))
           and (${cursor === undefined}
                or (u.created_at, u.id::text) < (${at}::timestamptz, ${afterId}))
         order by u.created_at desc, u.id desc
         limit ${bounded + 1}`;

      const page = rows.slice(0, bounded);
      const more = rows.length > bounded;
      const last = page[page.length - 1] as Record<string, unknown> | undefined;
      return {
        rows: page.map((r: Record<string, unknown>): AdminUserRow => ({
          userId: String(r.id),
          createdAt: new Date(r.created_at as string).toISOString(),
          onboardedAt: r.onboarded_at === null ? null : new Date(r.onboarded_at as string).toISOString(),
          providers: ((r.providers as string[] | null) ?? []).map((x) => x as Provider),
          email: r.email === null ? null : String(r.email),
          // Null when nothing has ever been written: `entitlement_event_at` is the record's
          // existence marker, exactly as `getEntitlement` reads it.
          entitlement: r.entitlement_event_at === null ? null : {
            expiresAt: r.entitlement_expires_at === null ? null
              : new Date(r.entitlement_expires_at as string).toISOString(),
            lifetimeProductId: r.entitlement_lifetime_product_id === null ? null
              : String(r.entitlement_lifetime_product_id),
            productId: String(r.entitlement_product_id ?? ""),
            eventAt: new Date(r.entitlement_event_at as string).toISOString(),
            trial: r.entitlement_trial === true,
          },
          freeAnalyses: r.free_analyses === null || r.free_analyses === undefined
            ? null : num(r.free_analyses),
          analysesToday: num(r.today),
          spent: num(r.spent),
          lastSeen: r.last_seen === null ? null : new Date(r.last_seen as string).toISOString(),
        })),
        nextCursor: more && last
          ? `${new Date(last.created_at as string).toISOString()}~${String(last.id)}`
          : null,
      };
    },

    async identitySubject(userId, provider) {
      const rows = await sql`
        select subject from identities where user_id = ${userId} and provider = ${provider}`;
      return rows.length > 0 ? String(rows[0].subject) : null;
    },

    async adminMetrics({ days, today, timezone }) {
      const window = Math.min(Math.max(1, Math.trunc(days)), ADMIN_METRICS_MAX_DAYS);
      const dates: string[] = [];
      for (let i = window - 1; i >= 0; i--) dates.push(dateMinus(today, i));
      const from = dates[0]!;

      // `at time zone` turns the instant into the INSTANCE's calendar day, which is the calendar
      // `analyses.date` is already written on. Counting signups by their UTC date and analyses by
      // their local one puts the two columns of one row on different days, and the gap shows up
      // only as a row that does not add up, in the hours either side of midnight.
      // AWAITED TOGETHER, RUN ONE AFTER ANOTHER. `sql` is the transaction this call opened, and one
      // connection runs one statement at a time, so this is the sum of the queries and not the max
      // of them — it was the max before the policies, when `sql` was the pool. Kept as it is: the
      // alternative is a method that holds its own connection while acquiring five more, which at
      // saturation is the pool deadlock this file already refuses elsewhere, bought for an admin
      // page nobody loads in a loop.
      const [signups, activations, spent] = await Promise.all([
        sql`select (created_at at time zone ${timezone})::date::text as d, count(*)::int as n
              from users
             where (created_at at time zone ${timezone})::date >= ${from}::date
             group by 1`,
        sql`select (onboarded_at at time zone ${timezone})::date::text as d, count(*)::int as n
              from users
             where onboarded_at is not null
               and (onboarded_at at time zone ${timezone})::date >= ${from}::date
             group by 1`,
        // Both scopes: a typed meal costs money and the global cap counts it.
        sql`select date as d, count(*)::int as n, sum(cost_usd) as cost,
                   count(*) filter (where cost_usd is null or unpriced_calls > 0)::int as unpriced
              from analyses where date >= ${from} and date <= ${today}
             group by 1`,
      ]);

      const by = (rows: { d: unknown; n: unknown }[]) =>
        new Map(rows.map((r) => [String(r.d), num(r.n)]));
      const signupsBy = by(signups as never);
      const activationsBy = by(activations as never);
      const spentBy = by(spent as never);
      const pricedBy = new Map((spent as unknown as { d: unknown; cost: unknown; unpriced: unknown }[])
        .map((r) => [String(r.d), { cost: r.cost === null ? null : Number(r.cost), unpriced: num(r.unpriced) }]));

      /**
       * How many accounts could have come back on their nth day, and how many did.
       *
       * `eligible` excludes anybody whose nth day has not arrived — counting yesterday's signups as
       * people who did not return is what drags a retention number down as a product grows, and it
       * is the most common way one is reported wrong.
       */
      const cohort = async (n: number): Promise<{ eligible: number; returned: number }> => {
        const rows = await sql`
          select count(*)::int as eligible,
                 count(*) filter (where exists (
                   select 1 from analyses a
                    where a.user_id = u.id
                      and a.date = (((u.created_at at time zone ${timezone})::date + ${n})::text)
                 ))::int as returned
            from users u
           where (u.created_at at time zone ${timezone})::date >= ${from}::date
             and (u.created_at at time zone ${timezone})::date <= (${today}::date - ${n})`;
        return { eligible: num(rows[0]?.eligible), returned: num(rows[0]?.returned) };
      };

      // Sequential, like the three above and for the same reason.
      const [d1, d7] = await Promise.all([cohort(1), cohort(7)]);
      return {
        // EVERY DAY GETS A ROW, including the empty ones. A `group by` produces no row for a day
        // with nothing on it — the trap `AGENTS.md` names about `totalsSince` — and a chart with
        // holes in it is read as a drop rather than as silence.
        days: dates.map((date) => ({
          date,
          signups: signupsBy.get(date) ?? 0,
          activations: activationsBy.get(date) ?? 0,
          analyses: spentBy.get(date) ?? 0,
          costUsd: pricedBy.get(date)?.cost ?? null,
          unpriced: pricedBy.get(date)?.unpriced ?? 0,
        })),
        d1,
        d7,
      };
    },

    async emailForUser(userId) {
      const rows = await sql`
        select email from identities
        where user_id = ${userId} and email is not null
        order by linked_at asc limit 1`;
      return (rows[0]?.email as string | undefined) ?? null;
    },

    async mergeUsers(fromUserId, intoUserId) {
      // One transaction. A half-applied merge leaves meals owned by a user row that is about to be
      // deleted, and `on delete cascade` would then destroy the data this operation exists to save.
      return await inTx(async (tx) => {
        const moved = await tx`
          update meals set user_id = ${intoUserId} where user_id = ${fromUserId} returning id`;
        await tx`update meal_photos set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        await tx`update pendings set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        await tx`update analyses set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        // A turn the anonymous session sent is replayed by the same phone under the real account. One
        // id claimed on both sides keeps the survivor's; the other goes with the anonymous row.
        await tx`
          update turns set user_id = ${intoUserId} where user_id = ${fromUserId}
            and client_id not in (select client_id from turns where user_id = ${intoUserId})`;
        // What the app has learned about this person's portions is learned before they sign in.
        await tx`update portion_corrections set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        await tx`update chat_messages set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        // The greeting travels with the thread that holds it, or Spud says "First one in." twice.
        await tx`
          update users set first_verdict_at = coalesce(
            first_verdict_at, (select first_verdict_at from users where id = ${fromUserId}))
          where id = ${intoUserId}`;
        // THE PAID TIER MOVES TOO, and it is the one thing here that is somebody's money. The
        // entitlement lives on the users row, and the row being merged away is deleted below — so
        // without this, an account that BOUGHT is the account that loses the purchase. That is the
        // common direction, not an exotic one: the paywall sells from onboarding and from the
        // camera refusal, both of which happen before anybody signs in.
        //
        // PER GRANT, NEWER CLOCK WINS — the same rule `putEntitlement` applies, expressed the same
        // way: one statement per grant, each ordered against its own stream. `coalesce` was the
        // rule here until 2026-09-14 and it is not the same test. A LAPSED subscription is still a
        // stored grant, so gap-filling kept the dead one and silently dropped the purchase made on
        // the anonymous session minutes before sign-in — seen in production, one account, `yearly`
        // expired 07:12 kept over a live purchase at 07:18. A grant travels WHOLE: the date, its
        // clock and its trial flag, or the survivor ends up with one period described by another's.
        await tx`
          update users into_u set
            entitlement_expires_at       = from_u.entitlement_expires_at,
            entitlement_expires_event_at = from_u.entitlement_expires_event_at,
            entitlement_trial            = from_u.entitlement_trial,
            entitlement_product_id       = from_u.entitlement_product_id
          from users from_u
          where into_u.id = ${intoUserId} and from_u.id = ${fromUserId}
            and from_u.entitlement_expires_event_at is not null
            and (into_u.entitlement_expires_event_at is null
                 or into_u.entitlement_expires_event_at < from_u.entitlement_expires_event_at)`;
        await tx`
          update users into_u set
            entitlement_lifetime_product_id = from_u.entitlement_lifetime_product_id,
            entitlement_lifetime_event_at   = from_u.entitlement_lifetime_event_at,
            entitlement_product_id          = from_u.entitlement_product_id
          from users from_u
          where into_u.id = ${intoUserId} and from_u.id = ${fromUserId}
            and from_u.entitlement_lifetime_event_at is not null
            and (into_u.entitlement_lifetime_event_at is null
                 or into_u.entitlement_lifetime_event_at < from_u.entitlement_lifetime_event_at)`;
        // The existence marker and the admin's sample size, which belong to no grant and always move.
        await tx`
          update users into_u set
            free_analyses = coalesce(into_u.free_analyses, from_u.free_analyses),
            entitlement_event_at = greatest(into_u.entitlement_event_at, from_u.entitlement_event_at)
          from users from_u
          where into_u.id = ${intoUserId} and from_u.id = ${fromUserId}`;
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
        // DROPPED, not repointed — the merged-away account is anonymous, so these are the device
        // identity and, since #205, possibly a `telegram` row. Repointing either would let plain
        // device auth walk back into the full account after a sign-out, or hand whoever holds that
        // Telegram the account this one merged into. Matches `store.memory.ts`; a test says so, and
        // a dropped link is re-made in one tap (`linkTelegram` moves it).
        await tx`delete from identities where user_id = ${fromUserId}`;
        // The DEVICE moves with the account. A push token is an address, not a credential: the same
        // phone is now signed into the real account, so its evening line belongs there. It is the
        // opposite decision from the bearer tokens below, and for the opposite reason — moving a
        // credential would let a signed-out session back in, while moving an address is the whole
        // point of a merge. Deleting it instead would cost the user their 20:30 line until their next
        // launch; leaving it on the emptied account would send that account's numbers to a phone
        // whose owner has since signed in as somebody else.
        await tx`update push_tokens set user_id = ${intoUserId} where user_id = ${fromUserId}`;

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
        select entitlement_expires_at, entitlement_product_id, entitlement_event_at,
               entitlement_lifetime_product_id, entitlement_trial
        from users where id = ${userId}`;
      const r = rows[0];
      // `entitlement_event_at` is what proves a record exists, NOT either grant: an account can
      // hold a lifetime with no subscription expiry, and treating that as "no record" would revoke
      // it on every read.
      if (!r || !r.entitlement_event_at) return null;
      return {
        expiresAt: r.entitlement_expires_at
          ? new Date(r.entitlement_expires_at as string).toISOString()
          : null,
        lifetimeProductId: (r.entitlement_lifetime_product_id as string | null) ?? null,
        productId: (r.entitlement_product_id as string | null) ?? "",
        eventAt: new Date(r.entitlement_event_at as string).toISOString(),
        trial: r.entitlement_trial === true,
      };
    },

    async putEntitlement(userId, patch) {
      const eventAt = new Date(patch.eventAt);
      // EACH GRANT IS GUARDED BY ITS OWN CLOCK. A patch speaks for exactly one of them, so this is
      // two statements rather than one with a cross-product of conditions — and each is ordered
      // against the stream it belongs to. A renewal arriving late is stale only with respect to
      // other subscription events; it says nothing about the unlock and must not be refused by it.
      //
      // `entitlement_event_at` is bumped by both and read by neither: it is the record's existence
      // marker, which is what tells "bought something once" apart from "never bought".
      if (patch.expiresAt !== undefined) {
        const rows = await sql`
          update users set
            entitlement_expires_at       = ${new Date(patch.expiresAt)},
            entitlement_expires_event_at = ${eventAt},
            entitlement_product_id       = ${patch.productId},
            entitlement_trial            = ${patch.trial === true},
            entitlement_event_at = greatest(coalesce(entitlement_event_at, ${eventAt}), ${eventAt})
          where id = ${userId}
            and (entitlement_expires_event_at is null or entitlement_expires_event_at < ${eventAt})
          returning id`;
        return rows.length > 0;
      }
      if (patch.lifetimeProductId === undefined) return false;

      // Clearing is conditional on the stored unlock having come from this same product, checked
      // inside the write rather than by the caller: a condition a caller checks with its own read
      // is not a condition, because deliveries can be concurrent. Every call is its own transaction
      // now, but that changes nothing here: two deliveries are two transactions, and READ COMMITTED
      // lets each read before either writes. The condition belongs in the write either way.
      const clearing = patch.lifetimeProductId === null;
      const rows = await sql`
        update users set
          entitlement_lifetime_product_id = ${patch.lifetimeProductId},
          entitlement_lifetime_event_at   = ${eventAt},
          entitlement_product_id          = ${patch.productId},
          entitlement_event_at = greatest(coalesce(entitlement_event_at, ${eventAt}), ${eventAt})
        where id = ${userId}
          and (entitlement_lifetime_event_at is null or entitlement_lifetime_event_at < ${eventAt})
          and (${clearing} = false
               or entitlement_lifetime_product_id is not distinct from ${patch.productId})
        returning id`;
      return rows.length > 0;
    },

    async getOnboardingContent() {
      const rows = await sql`select content from onboarding_content where id = 1`;
      if (rows.length === 0) return null;
      return json<OnboardingContentSet | null>(rows[0].content, null);
    },

    async getNotificationCopy() {
      const rows = await sql`select copy from notification_copy where id = 1`;
      if (rows.length === 0) return null;
      return json<NotificationCopySet | null>(rows[0].copy, null);
    },

    async getPrompts() {
      // The newest revision of each key, in one statement. `distinct on` is Postgres's own way of
      // saying "one row per key", and the order is what picks which one — the memory store does
      // the same with a max.
      const rows = await sql`
        select distinct on (key) key, version, text, source, updated_at
        from llm_prompts
        order by key, version desc`;
      return rows.map(toPromptRevision);
    },

    async promptRevisions(key) {
      const rows = await sql`
        select key, version, text, source, updated_at
        from llm_prompts where key = ${key} order by version desc`;
      return rows.map(toPromptRevision);
    },

    async putPrompt(key, text, source) {
      // THE VERSION IS COMPUTED IN THE STATEMENT, not read first and incremented here: two admins
      // saving at once would both read the same number, and the second insert would fail on the
      // primary key rather than silently overwrite — but the rule this workspace states is that a
      // state condition lives in the store's own guarded statement, and this is one.
      const rows = await sql`
        insert into llm_prompts (key, version, text, source, updated_at)
        values (
          ${key},
          (select coalesce(max(version), 0) + 1 from llm_prompts where key = ${key}),
          ${text},
          ${source},
          now()
        )
        returning version`;
      return Number(rows[0]!.version);
    },

    async putNotificationCopy(copy) {
      await sql`
        insert into notification_copy (id, copy, updated_at)
        values (1, ${JSON.stringify(copy)}::jsonb, now())
        on conflict (id) do update set copy = excluded.copy, updated_at = now()`;
    },

    async putOnboardingContent(content) {
      // The `version` COLUMN is written and never read back — the revision an app is served comes
      // out of the JSON, per language. It is kept because it is what an operator reads with `psql`
      // in front of them, and the honest value for a set of revisions that share a number is that
      // number: the newest one saved.
      const version = Math.max(0, ...Object.values(content)
        .map((c) => c?.version)
        .filter((v): v is number => typeof v === "number"));
      // `::jsonb` on the parameter for the same reason the meal update casts: an untyped parameter
      // is text, and a JSON string landing in a jsonb column stores the STRING rather than the
      // object — it round-trips without error and comes back unusable.
      await sql`
        insert into onboarding_content (id, version, content, updated_at)
        values (1, ${version}, ${JSON.stringify(content)}::jsonb, now())
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
                           corrected, model, question)
        values (${m.id}, ${m.user_id}, ${m.ts}, ${m.date}, ${m.isFood},
                ${JSON.stringify(m.items)}, ${m.kcal}, ${m.protein_g}, ${m.carbs_g}, ${m.fat_g},
                ${m.satfat_g}, ${m.fiber_g}, ${m.sugar_g}, ${m.sodium_mg},
                ${JSON.stringify(m.verdicts)}, ${m.confidence}, ${m.notes}, ${m.corrected},
                ${m.model}, ${JSON.stringify(m.question ?? null)})
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

    async deleteMeal(userId, mealId) {
      if (!UUID.test(mealId)) return false;
      // `meal_photos.meal_id` cascades from `meals`, so the photos go with the row.
      const rows = await sql`delete from meals where id = ${mealId} and user_id = ${userId} returning id`;
      return rows.length > 0;
    },

    async updateMeal(userId, mealId, patch: MealPatch) {
      if (!UUID.test(mealId)) return null;
      const entries = Object.keys(MEAL_COLUMNS)
        .filter((k) => (patch as Record<string, unknown>)[k] !== undefined)
        .map((k) => {
          const v = (patch as Record<string, unknown>)[k];
          // Asked of the COLUMN, not of a second list of key names: `question` is patchable and
          // jsonb, and a hand-kept list of which keys to stringify is one edit away from writing
          // `[object Object]` into a column that round-trips it without complaint.
          const col = MEAL_COLUMNS[k]!;
          return [col, JSON_COLUMNS.has(col) ? JSON.stringify(v) : v] as const;
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

    async mealsSince(userId, from, to, limit) {
      const rows = await sql`
        select * from meals where user_id = ${userId} and date >= ${from} and date <= ${to}
        order by date desc, ts desc limit ${Math.max(0, limit)}`;
      return rows.map(toMeal);
    },

    async putPhotos(userId, mealId, input) {
      if (input.length === 0) return;
      await inTx(async (tx) => {
        const owned = await tx`select 1 from meals where id = ${mealId} and user_id = ${userId}`;
        if (owned.length === 0) return;
        for (const [i, p] of input.entries()) {
          await tx`
            insert into meal_photos (id, meal_id, user_id, position, mime, bytes)
            values (${crypto.randomUUID()}, ${mealId}, ${userId}, ${i}, ${p.mime}, ${Buffer.from(p.bytes)})
            on conflict (meal_id, position) do nothing`;
        }
        await tx`
          update meals set photos = (select count(*) from meal_photos where meal_id = ${mealId})
          where id = ${mealId} and user_id = ${userId}`;
      });
    },
    async appendPhotos(userId, mealId, input) {
      // A CLIENT-SUPPLIED ID, so the same guard `getMeal` and `updateMeal` carry: absent, not a
      // type error at the column. Without it Postgres raises 22P02 on anything that is not a UUID
      // and the route answers 500 to what is really "no such meal".
      if (!UUID.test(mealId)) return 0;
      // One transaction, and the next position is read INSIDE it: two attaches racing would
      // otherwise compute the same offset and one would lose to `on conflict do nothing`, dropping
      // a photo the user watched being taken.
      return await inTx(async (tx) => {
        const owned = await tx`select 1 from meals where id = ${mealId} and user_id = ${userId} for update`;
        if (owned.length === 0) return 0;
        const held = await tx`select coalesce(max(position) + 1, 0) as next from meal_photos where meal_id = ${mealId}`;
        let next = Number(held[0]?.next ?? 0);
        for (const p of input) {
          await tx`
            insert into meal_photos (id, meal_id, user_id, position, mime, bytes)
            values (${crypto.randomUUID()}, ${mealId}, ${userId}, ${next++}, ${p.mime}, ${Buffer.from(p.bytes)})`;
        }
        const counted = await tx`
          update meals set photos = (select count(*) from meal_photos where meal_id = ${mealId})
          where id = ${mealId} and user_id = ${userId} returning photos`;
        return Number(counted[0]?.photos ?? 0);
      });
    },

    async getPhotos(userId, mealId) {
      const rows = await sql`
        select position, mime, bytes from meal_photos
        where meal_id = ${mealId} and user_id = ${userId} order by position asc`;
      return rows.map((r: Record<string, unknown>) => toPhoto(r));
    },

    async getPhoto(userId, mealId, position) {
      const rows = await sql`
        select position, mime, bytes from meal_photos
        where meal_id = ${mealId} and user_id = ${userId} and position = ${position}`;
      return rows.length > 0 ? toPhoto(rows[0]) : null;
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

    async recordPortionCorrections(userId, rows) {
      // One statement per row, as `recordOnboardingEvents` does: an edit corrects a handful of
      // items at most. A zero before is a division by zero rather than a small portion, and is
      // refused here as well as at the call site so no such row can exist to poison a median. The
      // memory store refuses it identically.
      for (const r of rows) {
        if (!(r.grams_before > 0)) continue;
        await sql`
          insert into portion_corrections (id, user_id, name_en, grams_before, grams_after)
          values (${crypto.randomUUID()}, ${userId}, ${r.name_en}, ${r.grams_before}, ${r.grams_after})`;
      }
    },

    async portionPriors(userId, minCount, limit) {
      const rows = await sql`
        select name_en, grams_before, grams_after from portion_corrections
        where user_id = ${userId} order by created_at desc limit ${PORTION_PRIOR_ROWS}`;
      return portionPriorsFrom(rows.map((r: Record<string, unknown>): PortionCorrection => ({
        name_en: String(r.name_en),
        grams_before: num(r.grams_before),
        grams_after: num(r.grams_after),
      })), minCount, limit);
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

    async pendingsFor(userId) {
      const rows = await sql`
        select * from pendings where user_id = ${userId} and expires_at > ${new Date(now())}
        order by expires_at`;
      return rows.map((r: Record<string, unknown>): PendingMeal => ({
        id: String(r.id), userId: String(r.user_id),
        analysis: json<PendingMeal["analysis"]>(r.analysis, {} as PendingMeal["analysis"]), date: String(r.date),
        expiresAt: new Date(r.expires_at as string).getTime(),
      }));
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

    async putPairingCode(userId, codeHash, expiresAt) {
      // The account's previous code AND every expired one, in the statement before the insert.
      // Minting is rare enough to afford the sweep and there is no scheduler in this process --
      // the same bargain `issueToken` makes with the tokens table.
      //
      // AND EXPLICITLY UNSCOPED, for the same reason that one is. This method runs inside the
      // minting user's scope, so under the policies the `expires_at <=` half could only ever match
      // that user's own rows -- every other account's expired code would survive forever, in a
      // table whose only sweep is this line. The `user_id =` half is scoped by its own predicate
      // and does not stop being so here.
      await unscoped(async () => await sql`delete from pairing_codes
                where user_id = ${userId} or expires_at <= ${new Date(now())}`);
      await sql`insert into pairing_codes (code_hash, user_id, expires_at)
                values (${codeHash}, ${userId}, ${new Date(expiresAt)})`;
    },

    async claimPairingCode(codeHash) {
      // The delete is unconditional and the EXPIRY decides what it returns. One statement means
      // exactly one caller can win the row, which is the single-use guarantee; taking the expired
      // row out on the way past is what stops a backwards clock reviving it.
      const rows = await sql`
        delete from pairing_codes where code_hash = ${codeHash} returning user_id, expires_at`;
      if (rows.length === 0) return null;
      return new Date(rows[0].expires_at as string).getTime() > now() ? String(rows[0].user_id) : null;
    },

    async putPushToken(userId, token, platform) {
      // The token is the key, so a device that signs into another account MOVES rather than
      // duplicating. `updated_at` is what a future sweep of dead installations would read.
      await sql`
        insert into push_tokens (token, user_id, platform, created_at, updated_at)
        values (${token}, ${userId}, ${platform}, ${new Date(now())}, ${new Date(now())})
        on conflict (token) do update
          set user_id = excluded.user_id, platform = excluded.platform, updated_at = excluded.updated_at`;
    },

    async dropPushToken(userId, token) {
      const rows = await sql`
        delete from push_tokens where token = ${token} and user_id = ${userId} returning token`;
      return rows.length > 0;
    },

    async pushTokensFor(userId) {
      const rows = await sql`
        select token, platform from push_tokens where user_id = ${userId} order by created_at`;
      return (rows as Record<string, unknown>[]).map((r) => ({
        token: r.token as string,
        platform: r.platform as PushPlatform,
      }));
    },

    async usersWithPushTokens() {
      const rows = await sql`select distinct user_id from push_tokens`;
      return (rows as Record<string, unknown>[]).map((r) => r.user_id as string);
    },

    async appendChat(userId, lines) {
      if (lines.length === 0) return;
      // One transaction, and the account's row locked for its length: a bubble and its card land
      // together or not at all, and — because bigserial hands out numbers outside any transaction —
      // the lock is what keeps a concurrent turn of the same account from taking a seq between them.
      await inTx(async (tx) => {
        await tx`select id from users where id = ${userId} for update`;
        for (const line of lines) {
          await tx`
            insert into chat_messages (id, user_id, ts, role, kind, text, meal_id, event, client_id, pending_id, speaker, intent, model, analysis_id)
            values (${crypto.randomUUID()}, ${userId}, ${new Date(now())}, ${line.role}, ${line.kind},
                    ${"text" in line ? line.text : null},
                    ${line.kind === "meal" ? line.mealId : line.kind === "photo" ? line.mealId ?? null : null},
                    ${line.kind === "meal" ? line.event : null},
                    ${line.role === "user" && line.kind === "text" ? line.clientId ?? null : null},
                    ${line.role === "user" && line.kind === "text" ? line.pendingId ?? null : null},
                    ${line.role === "assistant" && line.kind === "text" ? line.speaker ?? null : null},
                    ${line.role === "user" && line.kind === "text" ? line.intent ?? null : null},
                    ${line.role === "assistant" && line.kind === "text" ? line.model ?? null : null},
                    ${line.role === "user" ? line.analysisId ?? null : null})`;
        }
      });
    },

    async chatBefore(userId, before, limit) {
      const rows = before === null
        ? await sql`
            select * from chat_messages
            where user_id = ${userId} order by seq desc limit ${limit}`
        : await sql`
            select * from chat_messages
            where user_id = ${userId} and seq < ${before} order by seq desc limit ${limit}`;
      return (rows as Record<string, unknown>[]).map(toChat);
    },

    async countUserChat(userId) {
      const rows = await sql`select count(*)::int as n from chat_messages where user_id = ${userId}`;
      return num(rows[0].n);
    },

    async getLine(userId, lineId) {
      if (!UUID.test(lineId)) return null;
      const rows = await sql`select * from chat_messages where id = ${lineId} and user_id = ${userId}`;
      return rows.length > 0 ? toChat(rows[0] as Record<string, unknown>) : null;
    },
    async photoLineFor(userId, mealId) {
      if (!UUID.test(mealId)) return null;
      const rows = await sql`select * from chat_messages where user_id = ${userId} and kind = 'photo' and meal_id = ${mealId} order by seq desc limit 1`;
      return rows.length > 0 ? toChat(rows[0] as Record<string, unknown>) : null;
    },
    async deleteLine(userId, lineId) {
      if (!UUID.test(lineId)) return false;
      const rows = await sql`delete from chat_messages where id = ${lineId} and user_id = ${userId} returning id`;
      return rows.length > 0;
    },
    async deleteMealLines(userId, mealId) {
      if (!UUID.test(mealId)) return 0;
      const rows = await sql`delete from chat_messages where user_id = ${userId} and kind = 'meal' and meal_id = ${mealId} returning id`;
      return rows.length;
    },
    async updateLineText(userId, lineId, text) {
      if (!UUID.test(lineId)) return false;
      const rows = await sql`update chat_messages set text = ${text} where id = ${lineId} and user_id = ${userId} returning id`;
      return rows.length > 0;
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

    async getFreeAnalyses(userId) {
      const rows = await sql`select free_analyses from users where id = ${userId}`;
      const v = rows[0]?.free_analyses;
      return v === null || v === undefined ? null : num(v);
    },

    async setFreeAnalyses(userId, n) {
      const rows = await sql`update users set free_analyses = ${n} where id = ${userId} returning id`;
      return rows.length > 0;
    },

    async recordAnalysis(userId, date, scope) {
      const rows = await sql`
        insert into analyses (user_id, date, scope) values (${userId}, ${date}, ${scope}) returning id`;
      return String(rows[0].id);
    },

    async addCost(userId, analysisId, usd) {
      const rows = usd === null
        ? await sql`update analyses set unpriced_calls = unpriced_calls + 1
                     where id = ${analysisId} and user_id = ${userId} returning id`
        : await sql`update analyses set cost_usd = coalesce(cost_usd, 0) + ${usd}::float8
                     where id = ${analysisId} and user_id = ${userId} returning id`;
      return rows.length > 0;
    },

    async analysisCosts(userId, analysisIds) {
      // Built by hand for the reason `getMeals` gives. Only digits reach it: the ids came out of this
      // store, and anything else is dropped rather than cast.
      const ids = analysisIds.filter((id) => /^\d+$/.test(id));
      if (ids.length === 0) return [];
      const literal = `{${ids.join(",")}}`;
      const rows = await sql`
        select id, cost_usd, unpriced_calls from analyses
        where user_id = ${userId} and id = any(${literal}::bigint[])`;
      return (rows as Record<string, unknown>[]).map((r) => ({
        id: String(r.id),
        costUsd: r.cost_usd === null ? null : Number(r.cost_usd),
        unpricedCalls: num(r.unpriced_calls),
      }));
    },

    async undoAnalysis(userId, analysisId) {
      const rows = await sql`
        delete from analyses where id = ${analysisId} and user_id = ${userId} returning id`;
      return rows.length > 0;
    },

    async claimTurn(userId, clientId) {
      const rows = await sql`
        insert into turns (user_id, client_id, claimed_at) values (${userId}, ${clientId}, ${new Date(now())})
        on conflict (user_id, client_id) do nothing returning client_id`;
      return rows.length > 0;
    },

    async getTurn(userId, clientId) {
      const rows = await sql`
        select outcome, claimed_at from turns where user_id = ${userId} and client_id = ${clientId}`;
      const r = rows[0] as { outcome: unknown; claimed_at: Date } | undefined;
      if (!r) return null;
      return { outcome: json<object | null>(r.outcome, null), claimedAt: new Date(r.claimed_at).getTime() };
    },

    async settleTurn(userId, clientId, outcome) {
      await sql`
        update turns set outcome = ${JSON.stringify(outcome)}::jsonb
        where user_id = ${userId} and client_id = ${clientId}`;
    },

    async forgetTurnOutcomes(before) {
      const rows = await sql`
        update turns set outcome = null where outcome is not null and claimed_at < ${new Date(before)} returning client_id`;
      return rows.length;
    },

    async putHealthDays(userId, days) {
      if (days.length === 0) return 0;
      // One transaction: a partially applied batch would leave a day updated and the next one not,
      // and the phone would report a successful sync over a window it did not actually store.
      return await inTx(async (tx) => {
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

    async pruneHealthDaysBefore(before) {
      // Across every account, deliberately — see the port. `returning date` rather than a count
      // query first: one statement, and nothing between a read and the delete it decided.
      // ponytail: seq scan, the primary key is (user_id, date) and there is no index on date
      // alone. It runs once a day over a table bounded by five years per account, and adding an
      // index to speed up a daily delete would cost every upsert on the sync path.
      const rows = await sql`delete from health_days where date < ${before} returning date`;
      return rows.length;
    },

    async deleteUser(userId) {
      // `on delete cascade` clears tokens, push tokens, meals, pendings, analyses, portion
      // corrections, the chat thread AND onboarding events with the row. The last one is deliberate — see the note on `deleteUser` in the port.
      await sql`delete from users where id = ${userId}`;
    },

    async close() {
      await pool.end();
    },
  };

  /**
   * Every method, wrapped in a transaction that says whose rows it may touch.
   *
   * This is the half that makes the policies bite. Without it they would be applied and inert:
   * nothing would ever set `app.user_id`, every statement would run unscoped, and a forgotten
   * `user_id = ?` would read the whole table exactly as it did before.
   *
   * An UNCLASSIFIED method is a hard error at construction rather than a silent unscoped one,
   * because the failure it would otherwise cause is a method quietly reading everybody's rows.
   */
  const wrapped: Record<string, unknown> = {};
  for (const [name, fn] of Object.entries(methods) as [string, unknown][]) {
    if (typeof fn !== "function") { wrapped[name] = fn; continue; }
    const how = SCOPE[name];
    if (how === undefined) {
      throw new Error(
        `[eait] store method ${name} is not in SCOPE: say whose rows it may touch, in store.pg.ts`,
      );
    }
    if (how === "raw") { wrapped[name] = fn; continue; }
    const call = fn as (...args: unknown[]) => Promise<unknown>;
    wrapped[name] = async (...args: unknown[]) => {
      const userId = how === "unscoped" ? null
        : typeof how === "number" ? args[how]
        : how(args);
      // A user-scoped method with no user to declare. The policy will refuse every row, which is
      // the safe answer and reads as "nothing there" — so say loudly why, or it looks like data
      // that went missing.
      if (how !== "unscoped" && (typeof userId !== "string" || userId === "")) {
        console.error(
          `[eait] store.${name} ran with no user id declared (got ${typeof userId}); ` +
          `row-level security will refuse every row it asks for`,
        );
      }
      // ALREADY INSIDE A STORE CALL — one method reaching another. Joining that transaction is
      // right: a second one would take a second connection and its own snapshot, and a method that
      // holds one connection while waiting for another deadlocks the pool at saturation.
      //
      // But it DECLARES ITS OWN SCOPE inside it, and puts the caller's back afterwards. Simply
      // running on the caller's declaration would ignore this method's `SCOPE` entry entirely —
      // and the dangerous direction is quiet: a scoped caller reaching an "unscoped" method would
      // give it the caller's user, so the global sweep or cross-account read it was classified for
      // would match only that one account's rows and report success. That is the silent denial the
      // line below throws an error to prevent. No method calls another today; this is what keeps
      // the construction-time "every method is classified" check meaning what it says when one does.
      const joined = active.getStore();
      if (joined) {
        const before = await joined`
          select coalesce(current_setting('app.user_id', true), '') as u,
                 coalesce(current_setting('app.unscoped', true), '') as s`;
        const prevUser = String(before[0]?.u ?? "");
        const prevUnscoped = String(before[0]?.s ?? "");
        if (how === "unscoped") await joined`select set_config('app.unscoped', 'on', true)`;
        else {
          await joined`select set_config('app.user_id', ${typeof userId === "string" ? userId : ""}, true)`;
          // Explicitly, because the CALLER may have been unscoped: a scoped method must not inherit
          // the escape. A fresh transaction has neither set, which is why the path below needs one
          // statement and this one needs two.
          await joined`select set_config('app.unscoped', 'off', true)`;
        }
        try {
          return await call(...args);
        } finally {
          // Best effort, for the reason `unscoped()` gives: on the error path the transaction is
          // already aborted, and a throwing `finally` replaces the exception that actually happened.
          try {
            await joined`select set_config('app.user_id', ${prevUser}, true)`;
            await joined`select set_config('app.unscoped', ${prevUnscoped}, true)`;
          } catch { /* the transaction is going away; the original error is the one worth having */ }
        }
      }

      return await pool.begin(async (tx) => {
        if (how === "unscoped") await tx`select set_config('app.unscoped', 'on', true)`;
        else await tx`select set_config('app.user_id', ${typeof userId === "string" ? userId : ""}, true)`;
        return await active.run(tx, () => call(...args));
      });
    };
  }
  const store = wrapped as unknown as Store;

  // THE SHIPPED PROMPTS, BEFORE ANYTHING IS SERVED. This is the self-hosted deployment's copy of
  // what `memoryStore` does in its constructor: a clone of this repo boots holding the six prompts
  // as rows, so /admin has something to edit and an operator can read what the server sends. It
  // also carries a CHANGED constant onto a host that has booted before, without touching a row an
  // admin wrote — which is the only reason the `source` column exists.
  //
  // It cannot throw (see `syncShippedPrompts`), so a read-only database, a lost race with a second
  // instance, or a missing column on an older host all leave a server that still answers, from the
  // constants, exactly as it did before there was a table.
  await syncShippedPrompts(store);

  return store;
}
