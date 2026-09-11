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
  DayTotals, HealthDay, Lang, MealItem, MealQuestion, MealRecord, MealVerdicts, NotificationCopy,
  OnboardingContent, Profile, Provider,
} from "@eait/shared";
import { HEALTH_FIELDS, dateMinus, emptyHealthDay } from "@eait/shared";
import {
  DEFAULT_SESSION_TTL_MS, hashToken, newSessionToken, sessionRefreshAfterMs,
} from "./auth/tokens.ts";
import { type ChatMessage,
  ADMIN_METRICS_MAX_DAYS, ADMIN_USER_PAGE_MAX,
  PORTION_PRIOR_ROWS, blankProfile, portionPriorsFrom, type AdminUserRow, type FunnelAggregate,
  type MealPatch,
  type PendingMeal, type PortionCorrection, type ProfilePatch, type PushPlatform, type Store,
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
    question: json<MealQuestion | null>(r.question, null),
    photos: num(r.photos),
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
  const now = opts.now ?? Date.now;

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
    const rows = await sql`
      delete from tokens
      where last_used_at + make_interval(secs => coalesce(ttl_ms, ${sessionTtlMs}) / 1000.0)
            <= ${new Date(now())}
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
      const rows = await sql`
        select user_id from identities where provider = ${provider} and subject = ${subject}`;
      if (String(rows[0].user_id) !== userId) {
        throw new Error("identity already linked to another account");
      }
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
      return await sql.begin(async (tx) => {
        const moved = await tx`
          update meals set user_id = ${intoUserId} where user_id = ${fromUserId} returning id`;
        await tx`update meal_photos set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        await tx`update pendings set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        await tx`update analyses set user_id = ${intoUserId} where user_id = ${fromUserId}`;
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
        // Per grant, and only into a gap: `coalesce` keeps whatever the surviving account already
        // has, because overwriting a live subscription with an older one is the same data loss the
        // health days above are careful about. The clocks travel with their grants, or the next
        // delivery would be ordered against a timestamp that belongs to a different stream.
        await tx`
          update users into_u set
            entitlement_expires_at = coalesce(into_u.entitlement_expires_at, from_u.entitlement_expires_at),
            entitlement_expires_event_at = coalesce(into_u.entitlement_expires_event_at, from_u.entitlement_expires_event_at),
            entitlement_lifetime_product_id = coalesce(into_u.entitlement_lifetime_product_id, from_u.entitlement_lifetime_product_id),
            entitlement_lifetime_event_at = coalesce(into_u.entitlement_lifetime_event_at, from_u.entitlement_lifetime_event_at),
            entitlement_product_id = coalesce(into_u.entitlement_product_id, from_u.entitlement_product_id),
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
        // DROPPED, not repointed — the merged-away account is anonymous, so these are device
        // identities only, and repointing one would let plain device auth walk back into the full
        // account after a sign-out. Matches `store.memory.ts`; a test asserts the behaviour.
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
      // is not a condition, because deliveries can be concurrent and nothing is transactional.
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
      return json<OnboardingContent | null>(rows[0].content, null);
    },

    async getNotificationCopy() {
      const rows = await sql`select copy from notification_copy where id = 1`;
      if (rows.length === 0) return null;
      return json<NotificationCopy | null>(rows[0].copy, null);
    },

    async putNotificationCopy(copy) {
      await sql`
        insert into notification_copy (id, copy, updated_at)
        values (1, ${JSON.stringify(copy)}::jsonb, now())
        on conflict (id) do update set copy = excluded.copy, updated_at = now()`;
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
      await sql.begin(async (tx) => {
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
      return await sql.begin(async (tx) => {
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
      await sql`delete from pairing_codes
                where user_id = ${userId} or expires_at <= ${new Date(now())}`;
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
      await sql.begin(async (tx) => {
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
            select seq, id, user_id, ts, role, kind, text, meal_id, event, client_id, pending_id, speaker, intent, model, analysis_id from chat_messages
            where user_id = ${userId} order by seq desc limit ${limit}`
        : await sql`
            select seq, id, user_id, ts, role, kind, text, meal_id, event, client_id, pending_id, speaker, intent, model, analysis_id from chat_messages
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
        speaker: (r.speaker as ChatMessage["speaker"]) ?? null,
        intent: (r.intent as ChatMessage["intent"]) ?? null,
        model: (r.model as string | null) ?? null,
        analysisId: r.analysis_id === null || r.analysis_id === undefined ? null : String(r.analysis_id),
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
      // `on delete cascade` clears tokens, push tokens, meals, pendings, analyses, portion
      // corrections, the chat thread AND onboarding events with the row. The last one is deliberate — see the note on `deleteUser` in the port.
      await sql`delete from users where id = ${userId}`;
    },

    async close() {
      await sql.end();
    },
  };
}
