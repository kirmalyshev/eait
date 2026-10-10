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
import { PgBoss, fromBunSql } from "pg-boss";
import type { PushKind, SendKind, SendLogState } from "@eait/shared";
import type {
  DayTotals, FoodNutrient, FoodPortion, FoodRef, HealthDay, Lang, MealItem, MealQuestion,
  MealRecord, MealVerdicts, NotificationCopySet, OffProduct,
  OnboardingContentSet, Profile, Provider, PushTemplateRow, Struggle, StreakGoal,
} from "@eait/shared";
import { HEALTH_FIELDS, PROVIDERS, REFERRAL_ALPHABET, REFERRAL_CODE_LENGTH, STREAK_GOALS, STRUGGLES, dateMinus, emptyHealthDay, healthScore, migrateActivityLevel, pushSenderOf, signsIn } from "@eait/shared";
import {
  DEFAULT_SESSION_TTL_MS, hashToken, newSessionToken, sessionRefreshAfterMs,
} from "./auth/tokens.ts";
import { timingSafeEqual } from "./auth/timingsafe.ts";
import { syncShippedPrompts } from "./llm/prompt.ts";
import { type ChatMessage,
  ADMIN_METRICS_MAX_DAYS, ADMIN_USER_PAGE_MAX,
  PORTION_PRIOR_ROWS, blankProfile, portionPriorsFrom, storeDeadline, type AdminUserRow, type FunnelAggregate,
  type MealPatch,
  type CampaignRow, type JobRecord, type PendingMeal, type PortionCorrection, type ProfilePatch, type PromptRevision, type PushPlatform, type PushStatRow, type SendLogRow, type Store, type SwitchFlip, type SwitchKey,
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
/**
 * The class half of every advisory key this server takes — 'eait' in hex — so its locks can
 * never collide with each other or with anybody else's. Key 0 is the migration lock, key 1 the
 * leader election; a new one takes the next number.
 */
const ADVISORY_CLASS = 1701149044;
const MIGRATION_LOCK_KEY = 0;
const LEADER_LOCK_KEY = 1;

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
 * Absent on purpose, all three of them: `onboarding_content` and `notification_copy` (one row each,
 * id = 1, the same copy for everybody) and `llm_prompts` (one set of system prompts for the whole
 * instance, admin-edited, no account anywhere near it).
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
  push_slot: "user_id",
  push_claim: "user_id",
  send_log: "user_id",
  push_open: "user_id",
  campaign_send: "user_id",
  health_days: "user_id",
  weights: "user_id",
  milestones: "user_id",
  turns: "user_id",
  // A grant and a share belong to the REFERRER — the account whose card counts them. Every write to
  // either that names another account (a grant, a merge) is unscoped and says why in `SCOPE`.
  referral_grants: "referrer_id",
  referral_events: "referrer_id",
  // A refund is the friend's own row.
  referral_refunds: "referred_id",
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

-- Staff (eait#531): a test send may reach the account and a staffOnly segment selects it. Set in the
-- admin users list only; absent from PROFILE_COLUMNS and from mergeUsers, like role.
alter table users add column if not exists staff boolean not null default false;

-- Onboarding v2 (S5, #82). units is the cm|ft,in / kg|lb display toggle — storage stays metric,
-- this is presentation only. struggles is the "what's been hard" picks in LIST order and is
-- NULLABLE on purpose: null is "the question was never asked" — what resume checks — while '{}'
-- is "asked, nothing picked". A not-null-with-default would erase that distinction.
alter table users add column if not exists units text;
alter table users add column if not exists struggles text[];

-- The streak length the user aims for (7, 14 or 30 days). NULL = never asked, which is what resume
-- checks; Home's streak chip reads it. The vocabulary is checked on the write (engine/profile.ts)
-- and again on the read, so a value from a newer binary is unrenderable here, not wrong.
alter table users add column if not exists streak_goal_days integer;

-- Milestones' two switches (ieat-app#1395). Booleans that default to ON, so a row from before them
-- reads as the product's default rather than as a user who turned something off.
alter table users add column if not exists milestone_celebrations boolean not null default true;
alter table users add column if not exists streak_on_home boolean not null default true;

-- The evening line's dedupe (#414): the local date this account was last CLAIMED for a send,
-- stamped atomically before the push goes out. Two replicas racing the sweep — or this one
-- restarted across 20:30 — cannot each send it, because the claim is the row, not a timer in one
-- process. A claim, not a send: a crash in the gap costs that night, never a second message.
alter table users add column if not exists last_notified_date text;

-- Push p1 (ieat-app#1765). The one-a-day rule becomes one lock for EVERY sender: a row per
-- (user, LOCAL day), first insert wins. users.timezone is the IANA zone the app reported on open;
-- null falls back to the instance zone. last_notified_date stays as a column (a rollback of the
-- code finds it) but nothing writes it any more; its state moves into push_slot once, below.
alter table users add column if not exists timezone text;
create table if not exists push_slot (
  user_id    uuid not null references users(id) on delete cascade,
  local_date text not null,
  kind       text not null check (kind in ('trial','streak','evening','onboarding','campaign')),
  ref        text,
  created_at timestamptz not null default now(),
  primary key (user_id, local_date)
);
-- ieat-app#1965: no cross-sender cap. One row per (account, LOCAL day, SENDER): a sender sends once a
-- day for its own reason; the only bound is users.push_daily_max (null: none). push_slot above is
-- written only by the tick's scheduled sender while a build that still reads it can run.
create table if not exists push_claim (
  user_id    uuid not null references users(id) on delete cascade,
  local_date text not null,
  sender     text not null,
  kind       text not null check (kind in ('trial','streak','evening','onboarding','campaign')),
  ref        text,
  created_at timestamptz not null default now(),
  primary key (user_id, local_date, sender)
);
alter table users add column if not exists push_daily_max integer check (push_daily_max is null or push_daily_max >= 0);
-- One row per message per device. id rides in the push data as sendId.
create table if not exists send_log (
  id            text primary key,
  user_id       uuid not null references users(id) on delete cascade,
  kind          text not null check (kind in ('trial','streak','evening','onboarding','campaign','transactional')),
  ref           text,
  template_key  text not null,
  lang          text not null,
  variant       text,
  token         text not null,
  state         text not null check (state in ('queued','accepted','refused','delivered-to-apns','dead','dry','expired','would_have_sent')),
  ticket_id     text,
  receipt_error text,
  created_at    timestamptz not null default now(),
  receipt_at    timestamptz,
  delivered_at  timestamptz
);
-- A table made before the notification extension (ieat-app#1763) lacks the column.
alter table send_log add column if not exists delivered_at timestamptz;
-- A table made by the first push build carries the constraint without .expired.; widen it once.
-- Guarded on the definition so a normal boot takes no ACCESS EXCLUSIVE lock.
do $do$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'send_log'::regclass and conname = 'send_log_state_check')
     or exists (select 1 from pg_constraint where conrelid = 'send_log'::regclass and conname = 'send_log_state_check'
                and pg_get_constraintdef(oid) not like '%would_have_sent%') then
    alter table send_log drop constraint if exists send_log_state_check;
    alter table send_log add constraint send_log_state_check
      check (state in ('queued','accepted','refused','delivered-to-apns','dead','dry','expired','would_have_sent'));
  end if;
end
$do$;
create index if not exists send_log_user_idx on send_log(user_id, created_at desc);
-- The admin's opens view reads a window of ALL accounts' sends by time.
create index if not exists send_log_created_idx on send_log(created_at);
create index if not exists send_log_receipt_idx on send_log(created_at) where state = 'accepted' and receipt_at is null;
-- One row per (account, send) the phone reported opened: the primary key is the dedup, and the FK to
-- send_log is the ownership, since the insert selects through it (an id from another account matches
-- nothing). Gone with the send, and with the account.
create table if not exists push_open (
  user_id   uuid not null references users(id) on delete cascade,
  send_id   text not null references send_log(id) on delete cascade,
  opened_at timestamptz not null default now(),
  action    text not null check (action in ('tap','reply')),
  primary key (user_id, send_id)
);
-- Manual campaigns (ieat-app#1761). segment holds allowlisted predicates (shared/campaign.ts),
-- never SQL. campaign_send is the once-per-account guard; push_flags holds the global kill switch.
create table if not exists campaigns (
  id              text primary key,
  name            text not null,
  template_key    text not null,
  segment         jsonb not null default '{}'::jsonb,
  status          text not null check (status in ('draft','scheduled','running','paused','done','killed')),
  local_send_time text not null,
  rollout_pct     integer not null check (rollout_pct between 0 and 100),
  promotional     boolean not null default true,
  created_by      text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
alter table campaigns add column if not exists variants integer not null default 1 check (variants between 1 and 4);
alter table campaigns add column if not exists holdout_pct integer not null default 0 check (holdout_pct between 0 and 10);
create table if not exists campaign_send (
  user_id     uuid not null references users(id) on delete cascade,
  campaign_id text not null references campaigns(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, campaign_id)
);
create table if not exists push_flags (
  name  text primary key,
  value boolean not null
);
-- The switch-over day cannot double-send: whoever the old code claimed for, the new code finds claimed.
insert into push_slot (user_id, local_date, kind, ref)
  select id, last_notified_date, 'evening', 'evening' from users where last_notified_date is not null
  on conflict do nothing;

-- Targets v2 (decision 7): five activity levels became three — few / some / many — and every
-- stored value moves to the nearest of them; #1078 made it four — none / few / some / many — so
-- the bottom pair lands on 'none' now, which carries the same 1.2 the old 'few' did. Idempotent
-- rather than guarded: none of these WHERE clauses matches a live id, so the hundredth boot
-- rewrites nothing, and the one place the mapping is authored is migrateActivityLevel in shared —
-- a row written in the window between this backfill and an old build still serving is coerced by
-- rowToProfile instead of migrated here.
update users set activity = 'none' where activity in ('sedentary', 'light');
update users set activity = 'some' where activity in ('moderate', 'active');
update users set activity = 'many' where activity = 'athlete';
-- #1078's own hop is different: 'few' is a LIVE id (it now means 1–2), so an unguarded rewrite
-- would clobber a genuine 1–2 answer on every boot that follows. ONE-SHOT, then, marked by a
-- comment on the column — the same marker idea POLICY_VERSION uses. A stored 'few' keeps its
-- multiplier only at 'none' (both are 1.2), so no stored profile's target moves; 'some' and
-- 'many' keep their ids and their factors. A 'few' written by an old build in the window after
-- this has run is the one case no rule can reach — see migrateActivityLevel.
do $do$
begin
  if (select col_description('users'::regclass, (
        select attnum from pg_attribute
        where attrelid = 'users'::regclass and attname = 'activity')))
      is distinct from 'activity-bands-4' then
    update users set activity = 'none' where activity = 'few';
    comment on column users.activity is 'activity-bands-4';
  end if;
end
$do$;

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
-- REFERRALS (#899). The code is the account's own, made with the row and never changed: the
-- DEFAULT is what makes it, so every insert path gets one without naming it. The alphabet comes
-- from @eait/shared, the same constant normalizeReferralCode reads.
--
-- The loop is the collision handling: a code somebody holds is drawn again. Two inserts racing to
-- the same unseen code are left to the unique constraint, which fails one of them -- ponytail: at
-- a billion codes that is a sign-in retried once in a lifetime; a retry here if it ever is not.
create or replace function new_referral_code() returns text language plpgsql volatile as $fn$
declare
  code text;
begin
  loop
    select string_agg(substr('${REFERRAL_ALPHABET}', 1 + floor(random() * ${REFERRAL_ALPHABET.length})::int, 1), '')
      into code from generate_series(1, ${REFERRAL_CODE_LENGTH});
    exit when not exists (select 1 from users where referral_code = code);
  end loop;
  return code;
end
$fn$;
-- ADDED AND BACKFILLED IN ONE BREATH, at the column's first sight only, like the lifetime unlock
-- above. One row per statement: each update sees the codes the earlier ones took, where a single
-- update over the table would check every row against the same snapshot and could hand two
-- accounts one code.
do $do$
declare
  r record;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = current_schema()
      and table_name = 'users' and column_name = 'referral_code'
  ) then
    alter table users add column referral_code text;
    for r in select id from users loop
      update users set referral_code = new_referral_code() where id = r.id;
    end loop;
    alter table users alter column referral_code set default new_referral_code();
    alter table users alter column referral_code set not null;
    alter table users add constraint users_referral_code_key unique (referral_code);
  end if;
end
$do$;
-- Who referred this account. Set ONCE, by redeemReferral's guarded update; never by a PATCH,
-- which allowlists its columns. A referrer who deletes their account takes the link with them.
alter table users add column if not exists referred_by uuid references users(id) on delete set null;
create index if not exists users_referred_by_idx on users (referred_by) where referred_by is not null;
-- The referral week: the THIRD grant beside entitlement_expires_at and the lifetime unlock,
-- granted by this server rather than bought. Never touches entitlement_event_at, the
-- "bought something" marker, so a friend whose week ended is not lapsed.
alter table users add column if not exists bonus_until timestamptz;
-- When the code applied, stamped by the same guarded update. A payment from before it never pays
-- the referrer: grantReferralWeek compares the event's time against it inside its own insert.
alter table users add column if not exists referred_at timestamptz;
-- One row per friend whose first paid period earned their referrer a reward: the primary key is
-- what makes it once per friend, ever. days is the reward as granted (a week for monthly, two
-- for yearly), so weeks earned is a sum rather than a guess about which product it was.
create table if not exists referral_grants (
  referred_id uuid primary key references users(id) on delete cascade,
  referrer_id uuid not null references users(id) on delete cascade,
  event_at    timestamptz not null,
  days        integer not null
);
create index if not exists referral_grants_referrer_idx on referral_grants (referrer_id);
-- The store transaction that earned the reward, so only ITS refund takes it back; and when that
-- happened. A revoked row stays: the primary key is what keeps that friend from earning it again.
alter table referral_grants add column if not exists transaction_id text not null default '';
alter table referral_grants add column if not exists revoked_at timestamptz;
-- One store subscription earns one referral, on whichever account it lands: Apple's
-- original_transaction_id is the subscription's own, the same across renewals and accounts.
-- '' is a delivery that named none, which is no subscription at all and so never collides.
alter table referral_grants add column if not exists original_transaction_id text not null default '';
create unique index if not exists referral_grants_subscription_key
  on referral_grants (original_transaction_id) where original_transaction_id <> '';
-- The grant's length before its last re-size to an earlier paid period, set by the same update
-- (the SET reads the row it locked), which is how the referrer's week moves by the difference.
alter table referral_grants add column if not exists resized_from integer;
-- Where a grant's days went (#899 review 3): 'banked' behind a subscription that was live at the
-- grant, or 'bonus' — the dated week. Every later move of the grant is made in the same bucket.
alter table referral_grants add column if not exists bucket text not null default 'bonus';
-- GUARDED: re-adding a check on every boot takes ACCESS EXCLUSIVE and scans the table. Only when
-- the constraint is missing or says something else (pg_constraint holds its canonical text).
do $do$
begin
  if (select pg_get_constraintdef(oid) from pg_constraint
       where conrelid = 'referral_grants'::regclass and conname = 'referral_grants_bucket_check')
     is distinct from 'CHECK ((bucket = ANY (ARRAY[''bonus''::text, ''banked''::text])))'
  then
    alter table referral_grants drop constraint if exists referral_grants_bucket_check;
    alter table referral_grants add constraint referral_grants_bucket_check check (bucket in ('bonus', 'banked'));
  end if;
end
$do$;
-- A paying referrer's reward, in days, waiting behind their subscription rather than dated: a date
-- past this period's end would be overtaken by the next renewal. They run from the subscription's
-- end (referralBonusEnd); a new period written after a lapse keeps only what the lapse left.
alter table users add column if not exists referral_banked_days integer not null default 0;
-- A refund can arrive before the payment it refunds. Every refunded transaction of a referred
-- account is kept here, and grantReferralWeek refuses one, so the late payment earns nothing.
-- The friend's account owns the row and takes it when it is erased: a store transaction id is a
-- purchase somebody made, and outliving them is not this table's job.
create table if not exists referral_refunds (
  transaction_id text primary key,
  referred_id    uuid not null references users(id) on delete cascade,
  at             timestamptz not null
);
-- Counts, never people: a share is the label of the channel and the instant, no address, no
-- device, nothing about whoever it was sent to.
create table if not exists referral_events (
  id          bigserial primary key,
  kind        text not null check (kind in ('share')),
  referrer_id uuid not null references users(id) on delete cascade,
  via         text not null,
  at          timestamptz not null
);
create index if not exists referral_events_referrer_idx on referral_events (referrer_id);
-- When Spud spoke the first verdict. Null until then; the claim is one atomic update.
alter table users add column if not exists first_verdict_at timestamptz;
alter table users add column if not exists entitlement_event_at   timestamptz;
-- Whether the CURRENT period is a free trial. Defaults false, which is what a row written before
-- this column existed reads as -- and false is the safe direction: a trial reminder that never
-- arrives beats one telling somebody who pays that "the free trial ends".
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
-- meal were ever orphaned. Bytes as uploaded (the clients cap the long edge at 768 px, JPEG);
-- no thumbnail column.
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

-- Email sign-in codes, as SHA-256 hashes (#569).
--
-- Same rule as tokens and pairing codes: code_hash is the column and there is no column holding
-- the digits, so the nightly dump names the addresses codes were sent to without letting its
-- reader spend one.
--
-- NO user_id AND NO REFERENCE TO ONE: a row names an address, and the account is what a spend
-- resolves to, so the table belongs to nobody and stays out of RLS_TABLES. Spent rows are kept —
-- used_at marks the verified, the burnt and the superseded — because putEmailCode counts the
-- hour's sends from them; deleting on supersede would let a resend loop mail one mailbox without
-- bound.
-- (No backticks in this string: it is a template literal, and one would end it.)
create table if not exists email_codes (
  id         uuid primary key,
  email      text not null,
  code_hash  text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  attempts   integer not null default 0,
  used_at    timestamptz
);
create index if not exists email_codes_email_idx on email_codes(email, created_at);

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
  -- 'photo' | 'text' | 'clip'. The per-user cap counts photos only; the global budget counts all.
  scope   text not null default 'photo'
);
create index if not exists analyses_date_idx on analyses(date);
create index if not exists analyses_user_date_idx on analyses(user_id, date, scope);
-- What the provider said the calls behind an analysis cost, summed (#484): null until one is
-- priced. unpriced_calls counts the calls that ended without a price, which makes the sum a floor.
alter table analyses add column if not exists cost_usd double precision;
alter table analyses add column if not exists unpriced_calls integer not null default 0;
-- How long the turn took, written once when it settles: receipt-to-call in ms_queue, call to
-- the first streamed item in ms_first_item (null on the JSON path, which never sees one), call to
-- answer in ms_total. Old rows keep nulls — they predate the clock, not report zero.
alter table analyses add column if not exists ms_queue integer;
alter table analyses add column if not exists ms_first_item integer;
alter table analyses add column if not exists ms_total integer;
-- Whether this analysis counts against the account's SAMPLE (#44): the sample counts value
-- delivered, not attempts. Every row already here counted, which is what the default says; a turn
-- that delivers nothing clears it (releaseSample) and keeps the row, its cost and its budget.
alter table analyses add column if not exists sample boolean not null default true;

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

-- A queued request that outlives the process that accepted it (#414). pg-boss owns it: one row in
-- pgboss.job per job, on a queue named "<kind>-v<requestVersion>" so a build claims only what it can
-- run. Everything the job SHOWS (step, items, owner, meal id, removed, pushed) lives in its data,
-- written by the raw statements below because pg-boss's own update() only edits queued jobs.
-- job_rows is the one place that reads that shape back. pgboss has no row-level security: every
-- read and write here names data->>'userId' itself. The outcome stays in turns.
-- The hand-rolled table the queue used before pg-boss. Kept while a rolling deploy could still
-- run a replica that reads it; every live replica is a pg-boss build now, so the contract step
-- drops it. if exists, because a host that already dropped it by hand must still migrate clean.
drop table if exists jobs;
create index if not exists eait_job_key on pgboss.job ((data->>'userId'), (data->>'clientId'));
-- Dropped and rebuilt, not replaced: create or replace cannot change a column's type, and the
-- whole schema runs as one statement batch, so readers never see it missing.
drop view if exists job_rows;
create view job_rows as
select j.id as boss_id,
       (j.data->>'userId')::uuid as user_id,
       j.data->>'clientId' as client_id,
       j.data->>'kind' as kind,
       (j.data->>'requestVersion')::smallint as request_version,
       j.data->'request' as request,
       case when j.state in ('created', 'retry') then 'queued' when j.state = 'active' then 'running' else 'settled' end as state,
       case when j.started_on is null then 0 else j.retry_count + 1 end as attempts,
       (j.data->>'step')::smallint as step,
       coalesce(j.data->'items', '[]') as items,
       case when j.state = 'active' then j.data->>'owner' end as lease_owner,
       case when j.state = 'active' then coalesce(j.heartbeat_on, j.started_on) + make_interval(secs => coalesce(j.heartbeat_seconds, j.expire_seconds)) end as lease_until,
       (j.data->>'mealId')::uuid as meal_id,
       j.data->>'analysisId' as analysis_id,
       (j.data->>'removedAt')::timestamptz as removed_at,
       (j.data->>'followedUntil')::timestamptz as followed_until,
       (j.data->>'pushedAt')::timestamptz as pushed_at,
       j.created_on as created_at,
       coalesce((j.data->>'updatedAt')::timestamptz, j.created_on) as updated_at
  from pgboss.job j
 where j.data ? 'userId' and j.data ? 'clientId';
-- No foreign key reaches pgboss.job, so a deleted user's jobs go with the user here.
create or replace function eait_forget_user_jobs() returns trigger language plpgsql as $$
begin
  delete from pgboss.job where data->>'userId' = old.id::text;
  return old;
end $$;
drop trigger if exists users_forget_jobs on users;
create trigger users_forget_jobs after delete on users for each row execute function eait_forget_user_jobs();

-- A queued photo's bytes are stored at enqueue, before any meal exists: meal_id null, client_id
-- naming the job. The meal adopts them when it is logged. Only ever expands what the old version reads.
alter table meal_photos alter column meal_id drop not null;
alter table meal_photos add column if not exists client_id text;
-- Guarded rather than dropped-and-readded: a constraint recreated NOT VALID on every boot never
-- finishes validating. Added unvalidated so an old replica's writes could not hit a check it
-- shipped before, then validated once — nothing writes a row that misses it, so the scan finds
-- none and a later boot's convalidated check skips it whole.
do $do$
begin
  if not exists (select 1 from pg_constraint where conname = 'meal_photos_owner_check') then
    alter table meal_photos add constraint meal_photos_owner_check
      check (meal_id is not null or client_id is not null) not valid;
  end if;
  if exists (select 1 from pg_constraint where conname = 'meal_photos_owner_check' and not convalidated) then
    alter table meal_photos validate constraint meal_photos_owner_check;
  end if;
end $do$;
create index if not exists meal_photos_user_client_idx on meal_photos(user_id, client_id) where meal_id is null;
create unique index if not exists meal_photos_unadopted_idx on meal_photos(user_id, client_id, position) where meal_id is null;

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

-- Push copy as reviewed, per-language templates (ieat-app#1758). Rows belong to nobody — the
-- instance's words, like notification_copy — so no user_id and no RLS. The primary key is the
-- identity, and the checks are the two enums the code also declares.
create table if not exists push_templates (
  key         text not null,
  lang        text not null check (lang in ('en','fr','de','it','es','vi','id','ru')),
  variant     text not null,
  title       text not null,
  body        text not null,
  status      text not null check (status in ('draft','reviewed')),
  reviewed_by text,
  reviewed_at timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (key, lang, variant)
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
-- The glance's rows go WITH the retirement: leaving them would fail the re-added check.
delete from llm_prompts where key = 'glance';
alter table llm_prompts add constraint llm_prompts_key_check
  check (key in ('analysis', 'route', 'text_meal', 'text_correction', 'coach'));

-- THE ADMIN SWITCHES (#563). Append-only: the current value is the newest row per key and every
-- earlier row is the audit trail of who flipped what and when. GLOBAL, for llm_prompts's reasons
-- (no user_id, not in RLS_TABLES). The key list is written out by hand and compared with
-- SWITCH_KEYS by switches.schema.test.ts. A key with no row is ON.
create table if not exists admin_switches (
  id      bigserial primary key,
  key     text not null,
  enabled boolean not null,
  set_by  uuid not null,
  set_at  timestamptz not null default now()
);
alter table admin_switches drop constraint if exists admin_switches_key_check;
alter table admin_switches add constraint admin_switches_key_check
  check (key in ('grounding.photo', 'grounding.text'));

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

-- The weigh-in log (S7): one typed weight per account per day.
--
-- health_days.weight_kg is the IMPORTED half of the same log — this table is the manual one, a
-- row written by PATCH /v1/profile's weight, and the merged read (engine/weights.ts) draws the
-- Progress chart and resolves the goal bar's start. One row per (user_id, date): a same-day
-- correction is the new value of that day, not a second one, so the upsert replaces in place and
-- updated_at records when the word was last given rather than when the day is.
create table if not exists weights (
  user_id    uuid not null references users(id) on delete cascade,
  date       text not null,
  kg         double precision not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date)
);

-- Milestones (ieat-app#1395). When a meal was LOGGED, apart from ts, when it was eaten: Time
-- Traveler and Gremlin read this. Nullable with a default — a row from before the column has no
-- logged-at, and reads as its own ts rather than as "logged on the day of the migration".
alter table meals add column if not exists created_at timestamptz;
alter table meals alter column created_at set default now();

create table if not exists milestones (
  user_id   uuid not null references users(id) on delete cascade,
  badge_id  text not null,
  earned_at timestamptz not null default now(),
  seen_at   timestamptz,
  primary key (user_id, badge_id)
);

-- ── S8: sign-up consent ──────────────────────────────────────────────────────────────────────
-- The sign-up screen's two boxes, stored as the dates they were ticked — EU consent needs the
-- date, so they are timestamps and null is "never given". On the users row so deleting the
-- account takes them with it. Deliberately absent from PROFILE_COLUMNS: consent is not a plan
-- input, and a PATCH must not be able to write it -- recordConsent is the only writer.
alter table users add column if not exists terms_accepted_at timestamptz;
alter table users add column if not exists marketing_consent_at timestamptz;
-- The "tips and offers" PUSH opt-in (Apple 4.5.4), set from the in-app toggle only. Not the sign-up
-- box above: a different consent. Null = off, the default.
alter table users add column if not exists push_offers_at timestamptz;
-- The account-wide notifications opt-out, set from the in-app switch only. Null = pushes allowed.
alter table users add column if not exists push_off_at timestamptz;

-- ── The food catalog ─────────────────────────────────────────────────────────────────────────
--
-- Reference data, not user data: no user_id, no RLS, and the methods over them are 'unscoped' in
-- SCOPE -- the same standing onboarding_content already has.
--
-- food_ref is the GENERIC table: whole foods and staples, one row per (source, the source's own
-- code). source is written out as a check constraint, drop-and-add like llm_prompts_key_check,
-- for the same reason: the enum is where a reviewer sees which licences are in the database, and
-- 'fcdb' is in it before its first row because Switzerland's table wants written permission for
-- commercial use. 'curated' is the placeholder for a hand-maintained (restaurant) list.
--
-- The eight macro columns are the app's own nutrient list — a catalog row can become a meal item
-- without a unit conversion — and all nullable: sources differ wildly in completeness and a
-- missing figure is missing, never zero. nutrients keeps the source's WHOLE vector keyed by its
-- own code (BLS's 138 components, USDA's numbered list), so nothing a source measured is thrown
-- away; portions is the FNDDS "1 slice"/"1 cup" weight table, empty elsewhere.
create table if not exists food_ref (
  id                   text primary key,
  source               text not null,
  name                 text not null,
  name_de              text,
  name_en              text,
  names                jsonb not null default '{}',
  category             text,
  kcal_per_100g        double precision,
  protein_g_per_100g   double precision,
  carbs_g_per_100g     double precision,
  fat_g_per_100g       double precision,
  satfat_g_per_100g    double precision,
  fiber_g_per_100g     double precision,
  sugar_g_per_100g     double precision,
  sodium_mg_per_100g   double precision,
  nutrients            jsonb not null default '{}',
  portions             jsonb not null default '[]',
  source_url           text,
  attribution          jsonb not null default '[]',
  updated_at           timestamptz not null default now()
);
-- attribution predates the rows on any database booted before #562; the alter, not the create,
-- is what reaches them. The texts are the export line's own attribution[].text, verbatim.
alter table food_ref add column if not exists attribution jsonb not null default '[]';
alter table food_ref drop constraint if exists food_ref_source_check;
alter table food_ref add constraint food_ref_source_check
  check (source in ('bls', 'ciqual', 'frida', 'fcdb', 'matvaretabellen', 'usda-foundation', 'usda-sr', 'usda-fndds', 'curated'));
-- The search is a substring match over the three name columns, no index can serve it, and the
-- table is single-digit thousands of rows: a scan is the right plan here.

-- off_product is the BARCODED table: packaged products, keyed on the barcode itself (GTIN digits)
-- because the scan, the dump ingest and the label-OCR write-back all address the same row that
-- way. source distinguishes 'off' (the Open Food Facts nightly dump, ODbL -- the UI owes it the
-- "Contains data from Open Food Facts" attribution in FOOD_ATTRIBUTION) from 'label-ocr' (a
-- phone's read of the actual label, written back so the next scan of the same barcode is a hit).
-- Everything but the barcode is nullable by design: a real OFF row is often a name and seven
-- label fields.
create table if not exists off_product (
  barcode              text primary key,
  source               text not null,
  name                 text not null default '',
  brand                text,
  serving_g            double precision,
  package_g            double precision,
  kcal_per_100g        double precision,
  protein_g_per_100g   double precision,
  carbs_g_per_100g     double precision,
  fat_g_per_100g       double precision,
  satfat_g_per_100g    double precision,
  fiber_g_per_100g     double precision,
  sugar_g_per_100g     double precision,
  sodium_mg_per_100g   double precision,
  nutriscore           text,
  nova_group           smallint,
  ingredients          text,
  image_url            text,
  data                 jsonb not null default '{}',
  updated_at           timestamptz not null default now()
);
alter table off_product drop constraint if exists off_product_source_check;
alter table off_product add constraint off_product_source_check
  check (source in ('off', 'label-ocr'));
${RLS_DDL}
`;

/**
 * The mailing list is retired (#113): the landing that posted to it is gone and the production
 * table was erased after a verified backup. `if exists`, because a host that already dropped it
 * by hand — or never had it — must still migrate clean. Separate from SCHEMA rather than edited
 * out of it, so the DROP reaches a database that has the table.
 */
const DROP_SUBSCRIBERS = `
drop table if exists subscribers;
`;

/** Row shapes as Postgres hands them back. Numbers are coerced at the boundary, once. */
type UserRow = Record<string, unknown>;
type MealRow = Record<string, unknown>;

/** One `llm_prompts` row. `updated_at` is an ISO string on both stores, so the two can be compared. */
const toPromptRevision = (r: Record<string, unknown>): PromptRevision => ({
  key: String(r.key),
  version: Number(r.version),
  text: String(r.text),
  source: (r.source === "admin" ? "admin" : "shipped"),
  updated_at: new Date(r.updated_at as string).toISOString(),
});

/** A `food_ref` row as the wire shape — column names are already the field names. */
const toFoodRef = (r: Record<string, unknown>): FoodRef => ({
  id: String(r.id),
  source: String(r.source) as FoodRef["source"],
  name: String(r.name),
  name_de: r.name_de === null || r.name_de === undefined ? null : String(r.name_de),
  name_en: r.name_en === null || r.name_en === undefined ? null : String(r.name_en),
  names: json<Record<string, string>>(r.names, {}),
  category: r.category === null || r.category === undefined ? null : String(r.category),
  kcal_per_100g: nullableNum(r.kcal_per_100g),
  protein_g_per_100g: nullableNum(r.protein_g_per_100g),
  carbs_g_per_100g: nullableNum(r.carbs_g_per_100g),
  fat_g_per_100g: nullableNum(r.fat_g_per_100g),
  satfat_g_per_100g: nullableNum(r.satfat_g_per_100g),
  fiber_g_per_100g: nullableNum(r.fiber_g_per_100g),
  sugar_g_per_100g: nullableNum(r.sugar_g_per_100g),
  sodium_mg_per_100g: nullableNum(r.sodium_mg_per_100g),
  nutrients: json<Record<string, FoodNutrient>>(r.nutrients, {}),
  portions: json<FoodPortion[]>(r.portions, []),
  source_url: r.source_url === null || r.source_url === undefined ? null : String(r.source_url),
  attribution: json<string[]>(r.attribution, []),
});

/** An `off_product` row as the wire shape. */
const toOffProduct = (r: Record<string, unknown>): OffProduct => ({
  barcode: String(r.barcode),
  source: String(r.source) as OffProduct["source"],
  name: String(r.name),
  brand: r.brand === null || r.brand === undefined ? null : String(r.brand),
  serving_g: nullableNum(r.serving_g),
  package_g: nullableNum(r.package_g),
  kcal_per_100g: nullableNum(r.kcal_per_100g),
  protein_g_per_100g: nullableNum(r.protein_g_per_100g),
  carbs_g_per_100g: nullableNum(r.carbs_g_per_100g),
  fat_g_per_100g: nullableNum(r.fat_g_per_100g),
  satfat_g_per_100g: nullableNum(r.satfat_g_per_100g),
  fiber_g_per_100g: nullableNum(r.fiber_g_per_100g),
  sugar_g_per_100g: nullableNum(r.sugar_g_per_100g),
  sodium_mg_per_100g: nullableNum(r.sodium_mg_per_100g),
  nutriscore: r.nutriscore === null || r.nutriscore === undefined ? null : String(r.nutriscore),
  nova_group: nullableNum(r.nova_group),
  ingredients: r.ingredients === null || r.ingredients === undefined ? null : String(r.ingredients),
  image_url: r.image_url === null || r.image_url === undefined ? null : String(r.image_url),
  data: json<Record<string, unknown>>(r.data, {}),
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
    activity: migrateActivityLevel(r.activity as string | null),
    pace: (r.pace ?? null) as Profile["pace"],
    units: (r.units ?? null) as Profile["units"],
    // Unknown members drop on the read the way patchProfile drops them on the write: a tag from a
    // newer binary is unrenderable here, not wrong.
    struggles: r.struggles === null || r.struggles === undefined
      ? null
      : ((r.struggles as string[]).filter((s) => (STRUGGLES as readonly string[]).includes(s)) as Struggle[]),
    streak_goal_days: (STREAK_GOALS as readonly number[]).includes(Number(r.streak_goal_days))
      ? (Number(r.streak_goal_days) as StreakGoal)
      : null,
    milestone_celebrations: r.milestone_celebrations !== false,
    streak_on_home: r.streak_on_home !== false,
    country: (r.country ?? null) as string | null,
    restrictions: (r.restrictions ?? []) as string[],
    medical_limitations: (r.medical_limitations ?? null) as string | null,
    food_allergies: (r.food_allergies ?? null) as string | null,
    product_limitations: (r.product_limitations ?? null) as string | null,
    onboarded_at: r.onboarded_at ? new Date(r.onboarded_at as string).toISOString() : null,
  };
}

/**
 * `healthScore` is COMPUTED AT READ (#118) — from the row's own nutrients and stored `verdicts`,
 * plus the caller's declared `restrictions`, which the meal-returning methods fetch once per call.
 * Never a column: every input is already stored, and a stored copy could disagree with them.
 */
function toMeal(r: MealRow, restrictions: readonly string[]): MealRecord {
  const meal = {
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
  return { ...meal, healthScore: healthScore(meal, restrictions) };
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
  "activity", "pace", "units", "struggles", "streak_goal_days", "milestone_celebrations", "streak_on_home", "country", "restrictions", "medical_limitations",
  "food_allergies", "product_limitations", "onboarded_at",
] as const;

/** The meal columns an update may write. Same rule, same reason. */
const MEAL_COLUMNS: Record<string, string> = {
  items: "items", kcal: "kcal", protein_g: "protein_g", carbs_g: "carbs_g", fat_g: "fat_g",
  satfat_g: "satfat_g", fiber_g: "fiber_g", sugar_g: "sugar_g", sodium_mg: "sodium_mg",
  verdicts: "verdicts", notes: "notes", corrected: "corrected", date: "date",
  question: "question", model: "model", confidence: "confidence",
};

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
 * The write paths bind the objects themselves (the driver encodes a value bound to a jsonb
 * parameter), but a row written before #339 holds a jsonb string, and reading it as an array
 * would hand the app a string it renders as nothing. Parsing defensively here repairs those
 * rows on read instead of requiring a migration to find them.
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

interface JobRow {
  user_id: string; client_id: string; kind: string; request_version: number; request: unknown; state: "queued" | "running" | "settled";
  attempts: number; step: number; items: unknown; lease_owner: string | null; lease_until: Date | null; meal_id: string | null;
  analysis_id: string | null; removed_at: Date | null; followed_until: Date | null; pushed_at: Date | null;
  created_at: Date; updated_at: Date; outcome: unknown;
}
const ms = (d: Date | null): number | null => (d === null ? null : new Date(d).getTime());
const toJob = (r: JobRow): JobRecord => ({
  userId: r.user_id, clientId: r.client_id, kind: r.kind, requestVersion: r.request_version,
  request: json<object>(r.request, {}), state: r.state, attempts: r.attempts, step: r.step,
  items: json<object[]>(r.items, []), leaseOwner: r.lease_owner, leaseUntil: ms(r.lease_until), mealId: r.meal_id,
  analysisId: r.analysis_id, removedAt: ms(r.removed_at), followedUntil: ms(r.followed_until), pushedAt: ms(r.pushed_at),
  createdAt: new Date(r.created_at).getTime(), updatedAt: new Date(r.updated_at).getTime(),
  outcome: json<object | null>(r.outcome, null),
});

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
  // Email sign-in codes name an ADDRESS, and the account is what a spend resolves to — there is
  // no user to scope them by. The address itself is the row's only scope, in the predicate.
  putEmailCode: "unscoped",
  spendEmailCode: "unscoped",
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
  countClipAnalyses: "unscoped",
  pushAudience: "unscoped",
  sendsAwaitingReceipt: "unscoped",
  pushOpenStats: "unscoped",
  listCampaigns: "unscoped",
  getCampaign: "unscoped",
  createCampaign: "unscoped",
  updateCampaign: "unscoped",
  markCampaignRunning: "unscoped",
  campaignsKilled: "unscoped",
  setCampaignsKilled: "unscoped",
  campaignReport: "unscoped",

  // ── Sweeps. Global by definition — scoped to one user they would sweep one user.
  forgetTurnOutcomes: "unscoped",
  pruneAbandonedAccounts: "unscoped",
  pruneExpiredTokens: "unscoped",
  pruneExpiredPendings: "unscoped",
  pruneHealthDaysBefore: "unscoped",

  // ── Rows belonging to nobody: the single-row admin copy.
  getOnboardingContent: "unscoped",
  putOnboardingContent: "unscoped",
  // The six system prompts. One set for the whole instance, admin-edited, no account anywhere.
  getPrompts: "unscoped",
  putPrompt: "unscoped",
  promptRevisions: "unscoped",
  switchEnabled: "unscoped",
  setSwitch: "unscoped",
  switchHistory: "unscoped",
  getNotificationCopy: "unscoped",
  putNotificationCopy: "unscoped",
  listPushTemplates: "unscoped",
  seedPushTemplates: "unscoped",
  putPushTemplate: "unscoped",

  // ── The food catalog: global reference data, like the copy tables above.
  searchFoods: "unscoped",
  foodCandidates: "unscoped",
  offProductByBarcode: "unscoped",
  putFoodRefs: "unscoped",
  putOffProducts: "unscoped",

  // ── The pool itself, and the election that lives beside it on its own connection.
  tryLeadership: "raw",
  releaseLeadership: "raw",
  close: "raw",
  // A LISTEN on its own connection: it reads no row, and a transaction around it would hold a
  // pooled connection for nothing. The payload names a user, so the engine routes it only to that
  // user's followers, and they re-read through the scoped `getJob`.
  onJobNotify: "raw",

  // ── Referrals (#899): each of these reads or writes ANOTHER account's row by design.
  // Redeeming looks the referrer up by code; the grant writes the referrer's week from a webhook
  // delivery; the stats count the friends' rows. Each still names the account it acts for.
  redeemReferral: "unscoped",
  grantReferralWeek: "unscoped",
  // Its refund, from the same webhook: the referrer's row again.
  revokeReferralWeek: "unscoped",
  referralOf: "unscoped",

  // ── Everything else names its user, and almost always first.
  issueToken: 0,
  bonusUntil: 0,
  bankedDays: 0,
  recordReferralShare: 0,
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
  isStaff: 0,
  setStaff: 0,
  // S8: the sign-up consent stamps — an account's own rows, like every other write here.
  recordConsent: 0,
  pushOffersOf: 0,
  setPushOffers: 0,
  pushOffOf: 0,
  setPushOff: 0,
  consentOf: 0,
  getProfile: 0,
  patchProfile: 0,
  getEntitlement: 0,
  // The one user id in this codebase that comes out of a request body. Declaring it is TIGHTER than
  // not: the webhook then cannot write a row belonging to anybody but the account it names.
  putEntitlement: 0,
  dropPushToken: 0,
  pushTokensFor: 0,
  setTimezone: 0,
  timezoneOf: 0,
  claimPushSlot: 0,
  pushSlotFree: 0,
  getPushDailyMax: 0,
  setPushDailyMax: 0,
  createSend: 0,
  settleSend: 0,
  sendLogFor: 0,
  recordPushOpen: 0,
  recordPushDelivered: 0,
  hasCampaignSend: 0,
  claimCampaignSend: 0,
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
  carrierLineFor: 0,
  deleteLine: 0,
  deleteMealLines: 0,
  deleteMealComments: 0,
  updateLineText: 0,
  claimFirstVerdict: 0,
  releaseFirstVerdict: 0,
  getPending: 0,
  pendingsFor: 0,
  dropPending: 0,
  updatePending: 0,
  countUserPhotos: 0,
  countUserAnalyses: 0,
  getFreeAnalyses: 0,
  setFreeAnalyses: 0,
  recordAnalysis: 0,
  addCost: 0,
  recordTiming: 0,
  analysisCosts: 0,
  undoAnalysis: 0,
  releaseSample: 0,
  putHealthDays: 0,
  healthDaysSince: 0,
  putWeight: 0,
  milestoneMeals: 0,
  getMilestones: 0,
  earnMilestones: 0,
  seeMilestones: 0,
  weightsSince: 0,
  claimTurn: 0,
  enqueueJob: 0,
  getJob: 0,
  listJobs: 0,
  jobPhotos: 0,
  jobProgress: 0,
  followJob: 0,
  removeJob: 0,
  settleJob: 0,
  claimPush: 0,
  chargeJob: 0,
  landJobMeal: 0,
  bindJobMeal: 0,
  // They choose whose job runs, or sweep every account's, and read no content: the lease is the
  // only thing they decide on.
  claimJob: "unscoped",
  heartbeatJobs: "unscoped",
  releaseJobs: "unscoped",
  expireJobs: "unscoped",
  forgetJobs: "unscoped",
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

  // THE JOB QUEUE (#414) is pg-boss on this pool. Started BEFORE the migration below, which builds
  // `job_rows` over the pgboss schema `start()` creates. pg-boss migrates its own schema under its
  // own lock, so two replicas booting together is its problem, not ours. No `schedule`: nothing here
  // is cron. Its monitor (supervise) is what retries or fails a job whose heartbeat lapsed.
  const boss = new PgBoss({ db: fromBunSql(pool), schedule: false });
  boss.on("error", (e: unknown) => console.error("[eait] pg-boss:", e));
  await boss.start();
  const queues = new Map<string, Promise<string>>();
  // One queue per kind and request version, created on first use: a kind is code, never a migration.
  const jobQueue = (kind: string, version: number): Promise<string> => {
    const name = `${kind}-v${version}`;
    let q = queues.get(name);
    if (!q) {
      q = (async () => {
        const ensure = () => boss.createQueue(name, { retryLimit: 1, deleteAfterSeconds: 0 });
        if (!(await boss.getQueue(name))) await ensure().catch(async (e: unknown) => { if (!(await boss.getQueue(name))) throw e; });
        return name;
      })();
      q.catch(() => queues.delete(name));
      queues.set(name, q);
    }
    return q;
  };
  // pg-boss refuses a heartbeat window under ten seconds.
  const heartbeatSeconds = (leaseMs: number): number => Math.max(10, Math.ceil(leaseMs / 1000));

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

  /** Why a claim would lose, or null when it would win. The `claimPushSlot` rule, read once. */
  const claimVerdict = async (
    userId: string, localDate: string, kind: PushKind, ref: string | null, defaultMax: number | null,
  ): Promise<"sender-taken" | "account-cap" | null> => {
    const sender = pushSenderOf(kind, ref);
    const mine = await sql`select 1 from push_claim
      where user_id = ${userId} and local_date = ${localDate} and sender = ${sender}`;
    if (mine.length > 0) return "sender-taken";
    // ROLLING DEPLOYS: the previous build holds the scheduled message in push_slot. Drop with the write.
    if (kind !== "campaign") {
      const old = await sql`select 1 from push_slot
        where user_id = ${userId} and local_date = ${localDate} and kind <> 'campaign'`;
      if (old.length > 0) return "sender-taken";
    }
    const own = await sql`select push_daily_max from users where id = ${userId}`;
    const max = own[0]?.push_daily_max === null || own[0]?.push_daily_max === undefined
      ? defaultMax : num(own[0].push_daily_max);
    if (max === null) return null;
    const n = await sql`select count(*)::int as n from push_claim where user_id = ${userId} and local_date = ${localDate}`;
    return num(n[0].n) >= max ? "account-cap" : null;
  };

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

  /**
   * The account's declared restrictions, for `toMeal` — `healthScore` personalises its satfat and
   * salt parts off them (#118). One indexed read per store call; the scoped wrapper already
   * declared this user, so the row is visible inside the transaction.
   */
  const restrictionsOf = async (userId: string): Promise<string[]> => {
    const rows = await sql`select restrictions from users where id = ${userId}`;
    return (rows[0]?.restrictions ?? []) as string[];
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
    // TWO REPLICAS CAN BOOT AT ONCE — a rolling deploy starts the new container before the old
    // one is gone — and `create … if not exists` is not race-proof: two sessions building the
    // same type or index can both pass the existence check and one fails inside `pg_type`. The
    // loser waits on this lock instead, which is taken BEFORE lock_timeout so the wait itself
    // cannot be cut short; the holder's DDL below is what is bounded.
    await migrator`select pg_advisory_lock(${ADVISORY_CLASS}, ${MIGRATION_LOCK_KEY})`;
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
    await migrator.unsafe(DROP_SUBSCRIBERS);
  } finally {
    // Unlocked explicitly rather than left for `end()`: the session-level lock would go either
    // way, but a failure here should still not reach the caller as the migration's error.
    await migrator`select pg_advisory_unlock(${ADVISORY_CLASS}, ${MIGRATION_LOCK_KEY})`.catch(() => {});
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

  // THE ELECTION'S CONNECTION. Dedicated rather than pooled — the advisory lock is
  // session-scoped, so it must sit on a connection nothing else borrows — and lazy: a store that
  // is only ever asked for data pays no connection for a lock it never contests. Held outside
  // `methods` so `close` can end it without going through a wrapped method.
  let elector: SQL | null = null;
  let leaderHeld = false;
  const electorSql = (): SQL => (elector ??= new SQL(databaseUrl, { max: 1 }));
  // `pool.listen` opens its own dedicated connection; ended here by `close` before the pool.
  const listening = new Set<SQL.ListenSubscription>();

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
        // `created_at` from the store's clock rather than the column default, for the reason
        // `tokens.last_used_at` takes one: a test that can move time forward cannot move
        // `default now()`, and `pruneAbandonedAccounts` reads this column as its idle floor.
        await sql`insert into users (id, device_id, lang, created_at)
                  values (${id}, ${deviceId}, ${lang}, ${new Date(now())})
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

    async isStaff(userId) {
      const rows = await sql`select staff from users where id = ${userId}`;
      return (rows[0] as { staff: boolean } | undefined)?.staff === true;
    },

    async setStaff(userId, staff) {
      const rows = await sql`update users set staff = ${staff} where id = ${userId} returning id`;
      return rows.length > 0;
    },

    async recordConsent(userId, consent) {
      // One statement: `terms_accepted_at` is stamped on every call that reaches this — the routes
      // refuse one without the box ticked — and `marketing_consent_at` only ever moves forward:
      // an unticked box is the absence of a new consent, not a withdrawal of a stored one.
      await sql`update users set
          terms_accepted_at = now(),
          marketing_consent_at = case when ${consent.marketing} then now() else marketing_consent_at end
        where id = ${userId}`;
    },

    async pushOffersOf(userId) {
      const rows = await sql`select push_offers_at from users where id = ${userId}`;
      const at = (rows[0] as { push_offers_at: string | Date | null } | undefined)?.push_offers_at ?? null;
      return at === null ? null : new Date(at).toISOString();
    },

    async setPushOffers(userId, on) {
      await sql`update users set push_offers_at = case
          when ${on} then coalesce(push_offers_at, now()) else null end
        where id = ${userId}`;
    },

    async pushOffOf(userId) {
      const rows = await sql`select push_off_at from users where id = ${userId}`;
      const at = (rows[0] as { push_off_at: string | Date | null } | undefined)?.push_off_at ?? null;
      return at === null ? null : new Date(at).toISOString();
    },

    async setPushOff(userId, off) {
      await sql`update users set push_off_at = case
          when ${off} then coalesce(push_off_at, now()) else null end
        where id = ${userId}`;
    },

    async consentOf(userId) {
      const rows = await sql`select terms_accepted_at, marketing_consent_at from users where id = ${userId}`;
      const row = rows[0] as { terms_accepted_at: string | null; marketing_consent_at: string | null } | undefined;
      if (!row) return null;
      return {
        termsAcceptedAt: row.terms_accepted_at === null ? null : new Date(row.terms_accepted_at).toISOString(),
        marketingConsentAt: row.marketing_consent_at === null ? null : new Date(row.marketing_consent_at).toISOString(),
      };
    },

    async createUser(lang: Lang) {
      const id = crypto.randomUUID();
      // `created_at` from the store's clock, same as `upsertDeviceUser` above.
      await sql`insert into users (id, lang, created_at) values (${id}, ${lang}, ${new Date(now())})`;
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
        select u.id, u.created_at, u.onboarded_at, u.free_analyses, u.staff, u.push_daily_max, (u.push_offers_at is not null) as push_offers,
               u.entitlement_expires_at, u.entitlement_lifetime_product_id,
               u.entitlement_product_id, u.entitlement_event_at, u.entitlement_trial, u.bonus_until, u.referral_banked_days,
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
          bonusUntil: r.bonus_until === null ? null : new Date(r.bonus_until as string).toISOString(),
          bankedDays: num(r.referral_banked_days),
          freeAnalyses: r.free_analyses === null || r.free_analyses === undefined
            ? null : num(r.free_analyses),
          analysesToday: num(r.today),
          spent: num(r.spent),
          lastSeen: r.last_seen === null ? null : new Date(r.last_seen as string).toISOString(),
          staff: r.staff === true,
          pushDailyMax: r.push_daily_max === null || r.push_daily_max === undefined ? null : num(r.push_daily_max),
          pushOffers: r.push_offers === true,
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

      // How fast the photo turn answered, over the same window the days series covers. Nearest-rank
      // percentiles — percentile_disc — so the memory store's version returns the same number.
      const timing = await sql`
        select count(*) filter (where ms_total is not null)::int as n,
               percentile_disc(0.5) within group (order by ms_queue)::double precision as q50,
               percentile_disc(0.95) within group (order by ms_queue)::double precision as q95,
               percentile_disc(0.5) within group (order by ms_first_item)::double precision as f50,
               percentile_disc(0.95) within group (order by ms_first_item)::double precision as f95,
               percentile_disc(0.5) within group (order by ms_total)::double precision as t50,
               percentile_disc(0.95) within group (order by ms_total)::double precision as t95
          from analyses where date >= ${from} and date <= ${today}`;
      const t = timing[0]!;
      const leg = (p50: unknown, p95: unknown) =>
        ({ p50: p50 === null ? null : num(p50), p95: p95 === null ? null : num(p95) });
      const latency = {
        n: num(t.n),
        queue: leg(t.q50, t.q95),
        firstItem: leg(t.f50, t.f95),
        total: leg(t.t50, t.t95),
      };

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
        latency,
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
        await tx`
          update pgboss.job set data = jsonb_set(data, '{userId}', to_jsonb(${intoUserId}::text))
          where data->>'userId' = ${fromUserId}
            and data->>'clientId' not in (select client_id from job_rows where user_id = ${intoUserId})`;
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
            entitlement_lifetime_event_at   = from_u.entitlement_lifetime_event_at
          from users from_u
          where into_u.id = ${intoUserId} and from_u.id = ${fromUserId}
            and from_u.entitlement_lifetime_event_at is not null
            and (into_u.entitlement_lifetime_event_at is null
                 or into_u.entitlement_lifetime_event_at < from_u.entitlement_lifetime_event_at)`;
        // The existence marker and the admin's sample size, which belong to no grant and always move.
        await tx`
          update users into_u set
            free_analyses = coalesce(into_u.free_analyses, from_u.free_analyses),
            push_daily_max = coalesce(into_u.push_daily_max, from_u.push_daily_max),
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
        // Weigh-ins the anonymous session typed move by the same rule — a gap is a gift, a day
        // the real account already logged stays the real account's.
        await tx`
          delete from weights w
          where w.user_id = ${fromUserId}
            and exists (
              select 1 from weights t where t.user_id = ${intoUserId} and t.date = w.date
            )`;
        await tx`update weights set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        // Badges: the real account's earned_at/seen_at stand; the rest move.
        await tx`delete from milestones m where m.user_id = ${fromUserId}
          and exists (select 1 from milestones t where t.user_id = ${intoUserId} and t.badge_id = m.badge_id)`;
        await tx`update milestones set user_id = ${intoUserId} where user_id = ${fromUserId}`;
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
        // THE DAY'S SLOT MOVES TOO. The anonymous session may already have been sent today's line;
        // a surviving account without it would be sent a second one. Never over a day the
        // surviving account already holds (its claim stands), and the send history follows so a
        // `sendId` in a delivered push still resolves.
        await tx`
          insert into push_slot (user_id, local_date, kind, ref, created_at)
            select ${intoUserId}, local_date, kind, ref, created_at from push_slot where user_id = ${fromUserId}
          on conflict (user_id, local_date) do nothing`;
        await tx`
          insert into push_claim (user_id, local_date, sender, kind, ref, created_at)
            select ${intoUserId}, local_date, sender, kind, ref, created_at from push_claim where user_id = ${fromUserId}
          on conflict (user_id, local_date, sender) do nothing`;
        await tx`update send_log set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        // The opens follow their sends. A send id is unique across accounts, so the survivor can
        // hold no row for the same (user, send) and there is nothing to dedupe against.
        await tx`update push_open set user_id = ${intoUserId} where user_id = ${fromUserId}`;
        await tx`
          insert into campaign_send (user_id, campaign_id, created_at)
            select ${intoUserId}, campaign_id, created_at from campaign_send where user_id = ${fromUserId}
          on conflict do nothing`;
        await tx`
          update users into_u set timezone = coalesce(into_u.timezone, from_u.timezone)
          from users from_u where into_u.id = ${intoUserId} and from_u.id = ${fromUserId}`;

        // THE REFERRAL MOVES TOO (#899). The survivor's own referred_by stands and the anonymous
        // one's fills a gap — never as the survivor's own code, which would be an account referred
        // by itself. The later week wins. A grant follows the PERSON: the friend paid for through
        // the anonymous account is not paid for again through the real one. What the anonymous
        // account earned as a referrer — its friends, its grants, its shares — moves to the survivor.
        // Matches `store.memory.ts`; the contract suite says so.
        await tx`
          update users into_u set
            referred_by = coalesce(into_u.referred_by,
              case when from_u.referred_by <> into_u.id and not (into_u.entitlement_event_at is not null and not (into_u.entitlement_trial and into_u.entitlement_lifetime_product_id is null)) then from_u.referred_by end),
            referred_at = case when into_u.referred_by is null and from_u.referred_by <> into_u.id and not (into_u.entitlement_event_at is not null and not (into_u.entitlement_trial and into_u.entitlement_lifetime_product_id is null))
              then from_u.referred_at else into_u.referred_at end,
            bonus_until = greatest(into_u.bonus_until, from_u.bonus_until),
            referral_banked_days = into_u.referral_banked_days + from_u.referral_banked_days
          from users from_u
          where into_u.id = ${intoUserId} and from_u.id = ${fromUserId}`;
        await tx`
          update referral_grants set referred_id = ${intoUserId} where referred_id = ${fromUserId}
            and not exists (select 1 from referral_grants t where t.referred_id = ${intoUserId})`;
        await tx`
          update referral_grants set referrer_id = ${intoUserId}
          where referrer_id = ${fromUserId} and referred_id <> ${intoUserId}`;
        await tx`update users set referred_by = ${intoUserId} where referred_by = ${fromUserId} and id <> ${intoUserId}`;
        await tx`update referral_events set referrer_id = ${intoUserId} where referrer_id = ${fromUserId}`;
        await tx`update referral_refunds set referred_id = ${intoUserId} where referred_id = ${fromUserId}`;

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
      //
      // `struggles` is the same `text[]` shape and takes the same path — NULL, not '{}', when the
      // patch asks to clear it, because null is the never-asked marker resume reads.
      if (patch.restrictions !== undefined) {
        await sql`update users set restrictions = ${toPgTextArray(patch.restrictions)} where id = ${userId}`;
      }
      if (patch.struggles !== undefined) {
        await sql`update users set struggles = ${patch.struggles === null ? null : toPgTextArray(patch.struggles)} where id = ${userId}`;
      }

      const entries = PROFILE_COLUMNS
        .filter((c) => c !== "restrictions" && c !== "struggles" && (patch as Record<string, unknown>)[c] !== undefined)
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

    async bonusUntil(userId) {
      const rows = await sql`select bonus_until from users where id = ${userId}`;
      const at = (rows[0] as { bonus_until: string | Date | null } | undefined)?.bonus_until ?? null;
      return at === null ? null : new Date(at).toISOString();
    },

    async bankedDays(userId) {
      const rows = await sql`select referral_banked_days from users where id = ${userId}`;
      return num((rows[0] as { referral_banked_days?: unknown } | undefined)?.referral_banked_days ?? 0);
    },

    async redeemReferral(userId, code, days) {
      // THE GUARDED STATEMENT, and the only write: it matches only while this account's
      // referred_by is still null and only a referrer that is not this account, and it starts the
      // week in the same breath. Two redemptions racing apply exactly one.
      const at = new Date(now());
      const applied = await sql`
        update users me set
          referred_by = ref.id,
          referred_at = ${at}::timestamptz,
          bonus_until = greatest(${at}::timestamptz, me.bonus_until) + make_interval(days => ${days}::int)
        from users ref
        where me.id = ${userId} and me.referred_by is null and not (me.entitlement_event_at is not null and not (me.entitlement_trial and me.entitlement_lifetime_product_id is null))
          -- "bought something": any purchase but a free trial that never converted (see RedeemOutcome)
          and ref.referral_code = ${code} and ref.id <> ${userId}
        returning me.id`;
      if (applied.length > 0) return "ok";
      // Nothing written; these reads only name the refusal.
      const owner = await sql`select id from users where referral_code = ${code}`;
      if (owner.length === 0) return "unknown";
      if (String(owner[0].id) === userId) return "own";
      const me = await sql`select referred_by is not null as referred from users where id = ${userId}`;
      return me[0]?.referred === false ? "paid" : "already";
    },

    async grantReferralWeek(referredId, eventAt, days, transactionId, originalTransactionId) {
      // RevenueCat can name an id that is not one of ours; a uuid column would throw on it.
      if (!UUID.test(referredId)) return false;
      const at = new Date(eventAt);
      const t = new Date(now());
      // THE FRIEND'S ROW, LOCKED for the rest of this call, and by `revokeReferralWeek` too: a
      // refund committing between this method's refund check and its insert would otherwise leave
      // the grant standing over a refunded payment. Every statement below runs after it.
      await sql`select 1 from users where id = ${referredId} for update`;
      // PAID BEFORE THE CODE APPLIED, delivered late: not a referral at all, so the friend is voided
      // for good. A grant already made is taken back, from the bucket it went to; with none, a void
      // row takes the key so no renewal earns. Both guarded on `referred_at > eventAt` in the write.
      await sql`
        with g as (
          update referral_grants g set revoked_at = ${t}
          from users f
          where g.referred_id = ${referredId} and g.revoked_at is null
            and f.id = g.referred_id and f.referred_at > ${at}
          returning g.referrer_id, g.bucket, -g.days as delta)
        -- The grant's bucket moves by delta: the dated week never below now (an unset one stays
        -- unset), the bank never below 0.
        update users r set
          bonus_until = case when g.bucket = 'bonus' and r.bonus_until is not null
            then greatest(${t}::timestamptz, r.bonus_until + make_interval(days => g.delta)) else r.bonus_until end,
          referral_banked_days = case when g.bucket = 'banked'
            then greatest(0, r.referral_banked_days + g.delta) else r.referral_banked_days end
        from g where r.id = g.referrer_id`;
      await sql`
        insert into referral_grants (referred_id, referrer_id, event_at, days, transaction_id, revoked_at)
        select id, referred_by, ${at}, 0, ${transactionId}, ${t}
          from users where id = ${referredId} and referred_by is not null and referred_at > ${at}
        on conflict do nothing`;
      // One statement: the insert is the once-per-friend guard (and once per store subscription),
      // and the referrer's reward moves only when it inserted. WHERE IT GOES is decided in the same
      // snapshot: a referrer paying for a live period banks the days behind it, any other gets a
      // dated week from now.
      const rows = await sql`
        with g as (
          insert into referral_grants (referred_id, referrer_id, event_at, days, transaction_id, original_transaction_id, bucket)
          select f.id, f.referred_by, ${at}, ${days}::int, ${transactionId}, ${originalTransactionId},
                 case when r.entitlement_expires_at > ${t} then 'banked' else 'bonus' end
            from users f join users r on r.id = f.referred_by
           where f.id = ${referredId} and f.referred_at <= ${at}
             and not exists (select 1 from referral_refunds x where x.transaction_id = ${transactionId})
          -- Either key: this friend already granted, or this subscription already earned one.
          on conflict do nothing
          returning referrer_id, bucket, days),
        -- A dated reward FOLDS a running bank into the date (below): the referrer's banked grants
        -- move to 'bonus' with it, so a later revoke takes their days off the date they now live in.
        relabel as (
          update referral_grants o set bucket = 'bonus'
          from g join users r on r.id = g.referrer_id
          where g.bucket = 'bonus' and r.referral_banked_days > 0
            and o.referrer_id = g.referrer_id and o.bucket = 'banked' and o.revoked_at is null
          returning o.referred_id)
        update users r set
          -- Not paying: after whatever is already running — the dated week, or the banked days
          -- running from the subscription's end — and the bank folded in.
          bonus_until = case when g.bucket = 'bonus'
            then greatest(${t}::timestamptz, r.bonus_until,
                          -- the bank runs from the later of the dated week and the subscription's end
                          case when r.referral_banked_days > 0
                               then greatest(r.bonus_until, r.entitlement_expires_at) + make_interval(days => r.referral_banked_days) end)
                 + make_interval(days => g.days)
            else r.bonus_until end,
          referral_banked_days = case when g.bucket = 'banked'
            then r.referral_banked_days + g.days else 0 end
        from g where r.id = g.referrer_id
        returning r.id`;
      if (rows.length > 0) return true;
      // Not a new grant. An EARLIER paid period than the one granted from, delivered late, re-sizes
      // it — one guarded update: only an unrevoked grant whose own period is later than this one,
      // and only a payment at or after the code applied — by the difference, in the grant's bucket.
      const resized = await sql`
        with g as (
          update referral_grants g set
            resized_from = g.days, days = ${days}::int, event_at = ${at}, transaction_id = ${transactionId}
          from users f
          where g.referred_id = ${referredId} and g.revoked_at is null and g.event_at > ${at}
            and f.id = g.referred_id and f.referred_at <= ${at}
            and not exists (select 1 from referral_refunds x where x.transaction_id = ${transactionId})
          returning g.referrer_id, g.bucket, g.days - g.resized_from as delta)
        -- The grant's bucket moves by delta: the dated week never below now (an unset one stays
        -- unset), the bank never below 0.
        update users r set
          bonus_until = case when g.bucket = 'bonus' and r.bonus_until is not null
            then greatest(${t}::timestamptz, r.bonus_until + make_interval(days => g.delta)) else r.bonus_until end,
          referral_banked_days = case when g.bucket = 'banked'
            then greatest(0, r.referral_banked_days + g.delta) else r.referral_banked_days end
        from g where r.id = g.referrer_id
        returning r.id`;
      return resized.length > 0;
    },

    async revokeReferralWeek(referredId, transactionId) {
      if (!UUID.test(referredId) || transactionId === "") return false;
      const t = new Date(now());
      // The friend's row, locked — see `grantReferralWeek`.
      await sql`select 1 from users where id = ${referredId} for update`;
      // Kept first, whether or not there is a grant to revoke yet: its payment may still be on the way.
      await sql`
        insert into referral_refunds (transaction_id, referred_id, at)
        select ${transactionId}, id, ${t} from users where id = ${referredId} and referred_by is not null
        on conflict do nothing`;
      // Refunded before any grant: the friend is void, so neither that payment nor a renewal earns.
      await sql`
        insert into referral_grants (referred_id, referrer_id, event_at, days, transaction_id, revoked_at)
        select id, referred_by, ${t}, 0, ${transactionId}, ${t} from users where id = ${referredId} and referred_by is not null
        on conflict do nothing`;
      // One statement: the grant is marked only while it is not already, and only for the
      // transaction it was granted for; its days come out of the bucket they went to.
      const rows = await sql`
        with g as (
          update referral_grants set revoked_at = ${t}
          where referred_id = ${referredId} and transaction_id = ${transactionId} and revoked_at is null
          returning referrer_id, bucket, -days as delta)
        -- The grant's bucket moves by delta: the dated week never below now (an unset one stays
        -- unset), the bank never below 0.
        update users r set
          bonus_until = case when g.bucket = 'bonus' and r.bonus_until is not null
            then greatest(${t}::timestamptz, r.bonus_until + make_interval(days => g.delta)) else r.bonus_until end,
          referral_banked_days = case when g.bucket = 'banked'
            then greatest(0, r.referral_banked_days + g.delta) else r.referral_banked_days end
        from g where r.id = g.referrer_id
        returning r.id`;
      return rows.length > 0;
    },

    async recordReferralShare(userId, via) {
      await sql`insert into referral_events (kind, referrer_id, via, at)
                select 'share', id, ${via}, ${new Date(now())} from users where id = ${userId}`;
    },

    async referralOf(userId) {
      const rows = await sql`
        select u.referral_code, u.referred_by is not null as applied,
               (select count(*) from users f where f.referred_by = u.id) as joined,
               (select count(*) from referral_grants g where g.referrer_id = u.id and g.revoked_at is null) as subscribed,
               (select coalesce(sum(g.days), 0) from referral_grants g where g.referrer_id = u.id and g.revoked_at is null) as days,
               (select count(*) from referral_events e where e.referrer_id = u.id and e.kind = 'share') as shares
          from users u where u.id = ${userId}`;
      const r = rows[0] as Record<string, unknown> | undefined;
      if (!r) return null;
      return {
        code: String(r.referral_code), applied: r.applied === true, joined: num(r.joined),
        subscribed: num(r.subscribed), daysEarned: num(r.days), shares: num(r.shares),
      };
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
            -- BANKED REFERRAL DAYS ran from the lapse (#899): a new period written after one keeps
            -- only what the lapse did not use. Read from the row this statement locked, before the
            -- expiry below replaces it.
            referral_banked_days = case
              -- It started running at the later of the subscription's end and the dated week's end.
              when referral_banked_days > 0 and greatest(entitlement_expires_at, bonus_until) < ${new Date(now())}::timestamptz
                   and ${new Date(patch.expiresAt)}::timestamptz > ${new Date(now())}::timestamptz
              then greatest(0, referral_banked_days
                - floor(extract(epoch from (${new Date(now())}::timestamptz - greatest(entitlement_expires_at, bonus_until))) / 86400)::int)
              else referral_banked_days end,
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

    async switchEnabled(key) {
      const rows = await sql`select enabled from admin_switches where key = ${key} order by id desc limit 1`;
      return rows.length === 0 ? null : Boolean(rows[0]!.enabled);
    },

    async setSwitch(key, enabled, adminId) {
      await sql`insert into admin_switches (key, enabled, set_by) values (${key}, ${enabled}, ${adminId})`;
    },

    async switchHistory(limit) {
      const rows = await sql`
        select key, enabled, set_by, set_at from admin_switches order by id desc limit ${limit}`;
      return rows.map((r: Record<string, unknown>) => ({
        key: String(r.key) as SwitchKey,
        enabled: Boolean(r.enabled),
        set_by: String(r.set_by),
        set_at: new Date(r.set_at as string).toISOString(),
      }));
    },

    async putNotificationCopy(lang, copy) {
      // `jsonb_set` ON THE LOCKED ROW, never on a document the caller composed from a read it took
      // first. Inside `do update` the existing row is readable as `notification_copy.copy`, so the
      // merge happens where the write happens — and a save in another language that landed between
      // this caller's read and its write survives instead of being carried away by it.
      //
      // THE PARAMETER IS THE OBJECT, not `JSON.stringify` of it. Bun's driver already encodes a
      // bound value as jsonb, so a STRING parameter lands as a jsonb string and `::jsonb` on it is
      // a no-op — which is what this column has held all along. Nothing noticed, because `json()`
      // on the read parses a string as happily as it passes an object through. It matters now:
      // `jsonb_set` on a scalar is an error, so the merge cannot happen on a document that is
      // secretly text. `legacyJsonb` upgrades such a row in place on the first write after this.
      await sql`
        insert into notification_copy (id, copy, updated_at)
        values (1, jsonb_build_object(${lang}::text, ${copy}::jsonb), now())
        on conflict (id) do update
          set copy = jsonb_set(
                case when jsonb_typeof(notification_copy.copy) = 'string'
                     then (notification_copy.copy #>> '{}')::jsonb
                     when jsonb_typeof(notification_copy.copy) <> 'object' then '{}'::jsonb
                     -- A bare pre-#358 revision, keyed by message id rather than language.
                     when notification_copy.copy ?| array['evening','trial-day5','trial-day6','trial-end','trial-started']
                     then jsonb_build_object('en', notification_copy.copy)
                     else coalesce(notification_copy.copy, '{}'::jsonb) end,
                array[${lang}], ${copy}::jsonb, true),
              updated_at = now()`;
    },

    async listPushTemplates() {
      const rows = await sql`
        select key, lang, variant, title, body, status, reviewed_by, reviewed_at, updated_at
        from push_templates order by key, lang, variant`;
      const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());
      return rows.map((r: Record<string, unknown>) => ({
        key: r.key, lang: r.lang, variant: r.variant, title: r.title, body: r.body, status: r.status,
        reviewed_by: (r.reviewed_by as string | null) ?? null,
        reviewed_at: iso(r.reviewed_at), updated_at: iso(r.updated_at)!,
      })) as PushTemplateRow[];
    },

    async seedPushTemplates(rows) {
      // `do nothing` on the key: the shipped copy can arrive twice, from two replicas, and can
      // never overwrite what an admin has since saved.
      for (const r of rows) {
        await sql`
          insert into push_templates (key, lang, variant, title, body, status, reviewed_by, reviewed_at, updated_at)
          values (${r.key}, ${r.lang}, ${r.variant}, ${r.title}, ${r.body}, ${r.status},
                  ${r.reviewed_by}, ${r.reviewed_at}, ${r.updated_at})
          on conflict (key, lang, variant) do nothing`;
      }
    },

    async putPushTemplate(r) {
      await sql`
        insert into push_templates (key, lang, variant, title, body, status, reviewed_by, reviewed_at, updated_at)
        values (${r.key}, ${r.lang}, ${r.variant}, ${r.title}, ${r.body}, ${r.status},
                ${r.reviewed_by}, ${r.reviewed_at}, ${r.updated_at})
        on conflict (key, lang, variant) do update
          set title = excluded.title, body = excluded.body, status = excluded.status,
              reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at,
              updated_at = excluded.updated_at`;
    },

    async putOnboardingContent(lang, content, floorVersion) {
      // ONE STATEMENT, because the merge AND the version both have to read the row they are
      // writing, under its lock. Computed from a read the engine did first, two admins saving two
      // languages at once lose one of the languages and land on one version number between them —
      // two revisions, different words, one funnel row.
      //
      // THE `version` COLUMN IS NOW LOAD-BEARING. It used to be an operator's convenience, written
      // and never read back; it is what makes this one statement instead of a scan of the JSON,
      // because it already holds the highest number any language has been given. Keep writing it.
      //
      // The parameter is the OBJECT — see `putNotificationCopy` for why `JSON.stringify` would
      // silently store text, and for what the `jsonb_typeof` guard is repairing.
      const rows = await sql`
        insert into onboarding_content (id, version, content, updated_at)
        values (1, ${floorVersion}, jsonb_build_object(
          ${lang}::text, ${content}::jsonb || jsonb_build_object('version', ${floorVersion})), now())
        on conflict (id) do update
          set content = jsonb_set(
                case when jsonb_typeof(onboarding_content.content) = 'string'
                     then (onboarding_content.content #>> '{}')::jsonb
                     when jsonb_typeof(onboarding_content.content) <> 'object' then '{}'::jsonb
                     -- A BARE pre-#358 revision: one OnboardingContent, no language
                     -- dimension. It is an object, so the guards above pass it through and
                     -- jsonb_set hangs the language off it beside screens; storedContentSet
                     -- reads that hybrid as bare English, so every non-English save
                     -- succeeded, returned a version and was invisible. It was English
                     -- because English was all there was, so it becomes en.
                     -- (No backticks in here: this is inside a template literal.)
                     when onboarding_content.content ? 'screens'
                     then jsonb_build_object('en', onboarding_content.content)
                     else coalesce(onboarding_content.content, '{}'::jsonb) end,
                array[${lang}],
                ${content}::jsonb || jsonb_build_object(
                  'version', greatest(${floorVersion}, coalesce(onboarding_content.version, 0) + 1)),
                true),
              version = greatest(${floorVersion}, coalesce(onboarding_content.version, 0) + 1),
              updated_at = now()
        returning version`;
      return Number(rows[0]!.version);
    },

    // ── The food catalog ────────────────────────────────────────────────────────────────────

    async foodCandidates(words, limit) {
      // Words arrive as letters and digits only (`engine/ground.ts`), so they are safe in a pattern.
      const patterns = words.map((w) => `\\y${w.replace(/[^\p{L}\p{N}]/gu, "")}(s|es)?\\y`);
      if (patterns.length === 0) return [];
      const rows = await sql`
        select * from food_ref
        where name_en is not null
          and kcal_per_100g is not null and protein_g_per_100g is not null
          and carbs_g_per_100g is not null and fat_g_per_100g is not null
          and name_en ~* all(${toPgTextArray(patterns)}::text[])
        order by length(name_en), name_en
        limit ${limit}`;
      return rows.map(toFoodRef);
    },
    async searchFoods(query, limit) {
      // `%` and `_` in the needle are literals, not pattern chars — the query is a name fragment,
      // never a LIKE the caller composes. `position` ranks the name the match lands earliest in.
      const like = `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
      const needle = query.toLowerCase();
      const rows = await sql`
        select * from food_ref
        where name ilike ${like} escape '\'
           or coalesce(name_de, '') ilike ${like} escape '\'
           or coalesce(name_en, '') ilike ${like} escape '\'
        order by least(
            nullif(position(${needle} in lower(name)), 0),
            nullif(position(${needle} in lower(coalesce(name_de, ''))), 0),
            nullif(position(${needle} in lower(coalesce(name_en, ''))), 0)
          ), length(name), name
        limit ${limit}`;
      return rows.map(toFoodRef);
    },

    async offProductByBarcode(barcode) {
      const rows = await sql`select * from off_product where barcode = ${barcode}`;
      return rows[0] ? toOffProduct(rows[0]) : null;
    },

    async putFoodRefs(foodRows) {
      if (foodRows.length === 0) return 0;
      let written = 0;
      // Batches of 500: one statement per food would make the BLS ingest a 7k-round-trip walk.
      for (let i = 0; i < foodRows.length; i += 500) {
        const batch = foodRows.slice(i, i + 500);
        const back = await sql`
          insert into food_ref ${sql(batch as never)}
          on conflict (id) do update set
            source = excluded.source, name = excluded.name,
            name_de = excluded.name_de, name_en = excluded.name_en, names = excluded.names,
            category = excluded.category,
            kcal_per_100g = excluded.kcal_per_100g, protein_g_per_100g = excluded.protein_g_per_100g,
            carbs_g_per_100g = excluded.carbs_g_per_100g, fat_g_per_100g = excluded.fat_g_per_100g,
            satfat_g_per_100g = excluded.satfat_g_per_100g, fiber_g_per_100g = excluded.fiber_g_per_100g,
            sugar_g_per_100g = excluded.sugar_g_per_100g, sodium_mg_per_100g = excluded.sodium_mg_per_100g,
            nutrients = excluded.nutrients, portions = excluded.portions,
            source_url = excluded.source_url, attribution = excluded.attribution,
            updated_at = now()
          returning id`;
        written += back.length;
      }
      return written;
    },

    async putOffProducts(products) {
      if (products.length === 0) return 0;
      let written = 0;
      for (let i = 0; i < products.length; i += 500) {
        const batch = products.slice(i, i + 500);
        // THE PRECEDENCE RULE, IN THE STATEMENT: a `label-ocr` row is a phone's read of the real
        // package, so an `off` row may replace it only when the dump row carries a calorie figure —
        // an empty OFF record never erases a contributed one. `label-ocr` rows always land.
        const back = await sql`
          insert into off_product ${sql(batch as never)}
          on conflict (barcode) do update set
            source = excluded.source, name = excluded.name, brand = excluded.brand,
            serving_g = excluded.serving_g, package_g = excluded.package_g,
            kcal_per_100g = excluded.kcal_per_100g, protein_g_per_100g = excluded.protein_g_per_100g,
            carbs_g_per_100g = excluded.carbs_g_per_100g, fat_g_per_100g = excluded.fat_g_per_100g,
            satfat_g_per_100g = excluded.satfat_g_per_100g, fiber_g_per_100g = excluded.fiber_g_per_100g,
            sugar_g_per_100g = excluded.sugar_g_per_100g, sodium_mg_per_100g = excluded.sodium_mg_per_100g,
            nutriscore = excluded.nutriscore, nova_group = excluded.nova_group,
            ingredients = excluded.ingredients, image_url = excluded.image_url,
            data = excluded.data, updated_at = now()
          where excluded.source <> 'off'
             or off_product.source = 'off'
             or excluded.kcal_per_100g is not null
          returning barcode`;
        written += back.length;
      }
      return written;
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
      // The jsonb columns bind as OBJECTS — `JSON.stringify` stored their text as jsonb strings; see `putNotificationCopy`.
      const rows = await sql`
        insert into meals (id, user_id, ts, date, is_food, items, kcal, protein_g, carbs_g, fat_g,
                           satfat_g, fiber_g, sugar_g, sodium_mg, verdicts, confidence, notes,
                           corrected, model, question)
        values (${m.id}, ${m.user_id}, ${m.ts}, ${m.date}, ${m.isFood},
                ${m.items}, ${m.kcal}, ${m.protein_g}, ${m.carbs_g}, ${m.fat_g},
                ${m.satfat_g}, ${m.fiber_g}, ${m.sugar_g}, ${m.sodium_mg},
                ${m.verdicts}, ${m.confidence}, ${m.notes}, ${m.corrected},
                ${m.model}, ${m.question ?? null})
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
      const restrictions = await restrictionsOf(userId);
      return rows.map((r: MealRow) => toMeal(r, restrictions));
    },

    async getMeal(userId, mealId) {
      // A client-supplied id: absent, not a type error at the column (the memory store says null).
      if (!UUID.test(mealId)) return null;
      // Never widen this beyond `id = ? and user_id = ?`.
      const rows = await sql`select * from meals where id = ${mealId} and user_id = ${userId}`;
      return rows.length > 0 ? toMeal(rows[0], await restrictionsOf(userId)) : null;
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
        .map((k) => [MEAL_COLUMNS[k]!, (patch as Record<string, unknown>)[k]] as const);
      if (entries.length > 0) {
        // Values bound as-is: Postgres types each parameter from its column, so no `::jsonb` and no `JSON.stringify` (which stored text).
        const assignments = entries.map(([c], i) => `${c} = $${i + 3}`).join(", ");
        await sql.unsafe(
          `update meals set ${assignments} where id = $1 and user_id = $2`,
          [mealId, userId, ...entries.map(([, v]) => v)],
        );
      }
      const rows = await sql`select * from meals where id = ${mealId} and user_id = ${userId}`;
      return rows.length > 0 ? toMeal(rows[0], await restrictionsOf(userId)) : null;
    },

    async mealsForDate(userId, date) {
      const rows = await sql`
        select * from meals where user_id = ${userId} and date = ${date} order by ts asc`;
      const restrictions = await restrictionsOf(userId);
      return rows.map((r: MealRow) => toMeal(r, restrictions));
    },

    async mealsSince(userId, from, to, limit) {
      const rows = await sql`
        select * from meals where user_id = ${userId} and date >= ${from} and date <= ${to}
        order by date desc, ts desc limit ${Math.max(0, limit)}`;
      const restrictions = await restrictionsOf(userId);
      return rows.map((r: MealRow) => toMeal(r, restrictions));
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
        select date, sum(kcal) as kcal, sum(protein_g) as protein_g,
               sum(carbs_g) as carbs_g, sum(fat_g) as fat_g, sum(satfat_g) as satfat_g
        from meals where user_id = ${userId} and date >= ${since}
        group by date order by date desc`;
      return rows.map((r: Record<string, unknown>): DayTotals => ({
        date: String(r.date), kcal: num(r.kcal), protein_g: num(r.protein_g),
        carbs_g: num(r.carbs_g), fat_g: num(r.fat_g), satfat_g: num(r.satfat_g),
      }));
    },

    async putWeight(userId, date, kg) {
      await sql`
        insert into weights (user_id, date, kg) values (${userId}, ${date}, ${kg})
        on conflict (user_id, date) do update set kg = excluded.kg, updated_at = now()`;
    },

    async milestoneMeals(userId) {
      const rows = await sql`select * from meals where user_id = ${userId} order by ts asc`;
      const restrictions = await restrictionsOf(userId);
      return rows.map((r: MealRow & { created_at?: unknown }) => ({
        meal: toMeal(r, restrictions),
        createdAt: new Date((r.created_at ?? r.ts) as string).toISOString(),
      }));
    },

    async getMilestones(userId) {
      const rows = await sql`select badge_id, earned_at, seen_at from milestones where user_id = ${userId} order by earned_at, badge_id`;
      return rows.map((r: Record<string, unknown>) => ({
        badge_id: String(r.badge_id),
        earned_at: new Date(r.earned_at as string).toISOString(),
        seen_at: r.seen_at ? new Date(r.seen_at as string).toISOString() : null,
      }));
    },

    async earnMilestones(userId, ids, at) {
      for (const id of ids) {
        await sql`insert into milestones (user_id, badge_id, earned_at) values (${userId}, ${id}, ${at}) on conflict do nothing`;
      }
    },

    async seeMilestones(userId, ids, at) {
      for (const id of ids) {
        await sql`update milestones set seen_at = ${at} where user_id = ${userId} and badge_id = ${id} and seen_at is null`;
      }
    },

    async weightsSince(userId, since) {
      const rows = await sql`
        select date, kg from weights
        where user_id = ${userId} and date >= ${since}
        order by date desc`;
      return rows.map((r: Record<string, unknown>) => ({ date: String(r.date), kg: num(r.kg) }));
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
      // `analysis` bound as the object — see `insertMeal` for why `JSON.stringify` stored text.
      await sql`
        insert into pendings (id, user_id, analysis, date, expires_at)
        values (${p.id}, ${p.userId}, ${p.analysis}, ${p.date},
                ${new Date(p.expiresAt).toISOString()})`;
    },

    async updatePending(userId, p: PendingMeal) {
      const rows = await sql`
        update pendings
        set analysis = ${p.analysis},
            date = ${p.date}, expires_at = ${new Date(p.expiresAt).toISOString()}
        where id = ${p.id} and user_id = ${userId} and expires_at > ${new Date(now())}
        returning id`;
      return rows.length > 0;
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

    async putEmailCode(email, codeHash, expiresAt, limits) {
      // ONE STATEMENT, because the two caps and the supersede share the same read: `prior` counts
      // the trailing hour's sends once, `ins` exists only while both limits admit the send, and
      // `sup` burns the address's earlier live codes only when the new row landed. The CTEs share
      // the statement's snapshot, so `sup` cannot see `ins`'s own row — which is exactly the row
      // it must not mark.
      //
      // The wait the caller gets is computed on the DATABASE's clock, not this process's: the two
      // can differ, and a resend refused by the server's minute would otherwise tell the client a
      // second it cannot keep.
      const rows = await sql`
        with prior as (
          select count(*)::int as n, min(created_at) as first_sent, max(created_at) as last_sent
            from email_codes
           where email = ${email} and created_at > now() - interval '1 hour'
        ), today as (
          select count(*)::int as n, min(created_at) as first_sent
            from email_codes
           where email = ${email} and created_at > now() - interval '1 day'
        ), ins as (
          insert into email_codes (id, email, code_hash, expires_at)
          select ${crypto.randomUUID()}, ${email}, ${codeHash}, ${new Date(expiresAt)}
           where (${limits.perHour} <= 0 or (select n from prior) < ${limits.perHour})
             and (${limits.perDay} <= 0 or (select n from today) < ${limits.perDay})
             and ((select last_sent from prior) is null
                  or (select last_sent from prior) <= now() - make_interval(secs => ${limits.resendSec}))
          returning email
        ), sup as (
          update email_codes set used_at = now()
           where email = ${email} and used_at is null and exists (select 1 from ins)
        ), sweep as (
          delete from email_codes where created_at < now() - interval '1 day'
        )
        select exists(select 1 from ins) as ok,
               greatest(
                 case when ${limits.perHour} > 0 and (select n from prior) >= ${limits.perHour}
                      then ceil(extract(epoch from ((select first_sent from prior) + interval '1 hour' - now())))
                      else 0 end,
                 case when ${limits.perDay} > 0 and (select n from today) >= ${limits.perDay}
                      then ceil(extract(epoch from ((select first_sent from today) + interval '1 day' - now())))
                      else 0 end,
                 ceil(extract(epoch from ((select last_sent from prior) + make_interval(secs => ${limits.resendSec}) - now())))
               )::int as wait_s`;
      if (rows[0].ok) return null;
      return Math.max(1, Number(rows[0].wait_s));
    },

    async spendEmailCode(email, codeHash, maxAttempts) {
      // The row and the compare are two steps BY DESIGN: the hash must be read out and compared
      // constant-time (`auth/timingsafe.ts`), never trusted into a WHERE clause — `code_hash = $x`
      // would be Postgres's early-exit compare, which is the timing side channel timingsafe.ts
      // exists to close.
      //
      // THE ATTEMPT IS CLAIMED BEFORE THE COMPARE, in one guarded update. Reading the row and
      // counting the miss afterwards let N parallel guesses all read it live and all be compared
      // before the fifth increment burnt it — the cap held for a serial attacker only. Here a
      // guess is compared only if it won one of the `maxAttempts` slots: a racing update waits on
      // the row lock and re-checks `attempts < max` against the row the winner left.
      const claimed = await sql`
        update email_codes set attempts = attempts + 1
         where id = (select id from email_codes
                      where email = ${email} and used_at is null and expires_at > now()
                      order by created_at desc limit 1)
           and used_at is null and attempts < ${maxAttempts}
        returning id, code_hash, attempts`;
      if (claimed.length === 0) return "dead";
      const row = claimed[0];
      if (!timingSafeEqual(String(row.code_hash), codeHash)) {
        // The max-th miss burns it; `used_at is null` keeps a concurrent successful spend from
        // being overwritten by a guess that arrived after it.
        if (Number(row.attempts) >= maxAttempts) {
          await sql`update email_codes set used_at = now() where id = ${row.id} and used_at is null`;
        }
        return "wrong";
      }
      // `used_at is null` is the single-use guarantee: a second verify racing the first waits on
      // the row lock, sees the mark, and answers "dead" — the code was already spent.
      const consumed = await sql`update email_codes set used_at = now()
        where id = ${row.id} and used_at is null returning id`;
      return consumed.length > 0 ? "ok" : "dead";
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

    async pushAudience() {
      const rows = await sql`
        select u.id, u.timezone, u.created_at, u.onboarded_at from users u
        where u.push_off_at is null and exists (select 1 from push_tokens t where t.user_id = u.id)`;
      return (rows as Record<string, unknown>[]).map((r) => ({
        userId: r.id as string, timezone: (r.timezone as string | null) ?? null,
        createdAt: new Date(r.created_at as string | Date).toISOString(),
        onboardedAt: r.onboarded_at ? new Date(r.onboarded_at as string | Date).toISOString() : null,
      }));
    },

    async timezoneOf(userId) {
      const rows = await sql`select timezone from users where id = ${userId}`;
      return ((rows[0] as Record<string, unknown> | undefined)?.timezone as string | null | undefined) ?? null;
    },

    async setTimezone(userId, timezone) {
      await sql`update users set timezone = ${timezone} where id = ${userId}`;
    },

    async claimPushSlot(userId, localDate, kind, ref, defaultMax = null) {
      // ONE transaction, so the account-row lock below is held to the insert: this account's claims
      // run one at a time and the count cannot interleave with another sender's insert. A missing
      // account throws, which is louder than a false and right for a sender that must not go on.
      return inTx(async (tx) => {
        const u = await tx`select push_daily_max from users where id = ${userId} for update`;
        if (u.length === 0) throw new Error("push_claim: no such user");
        const verdict = await claimVerdict(userId, localDate, kind, ref, defaultMax);
        if (verdict !== null) return { claimed: false as const, reason: verdict };
        // The primary key is the second guard (two replicas, same sender): a loss is sender-taken, never a throw.
        const won = await tx`insert into push_claim (user_id, local_date, sender, kind, ref)
          values (${userId}, ${localDate}, ${pushSenderOf(kind, ref)}, ${kind}, ${ref})
          on conflict do nothing returning sender`;
        if (won.length === 0) return { claimed: false as const, reason: "sender-taken" as const };
        // ROLLING DEPLOYS: the previous build claims the scheduled message on push_slot. Writing it
        // there keeps an old replica silent on a day this one took. Drop with `claimVerdict`'s read.
        if (kind !== "campaign") {
          await tx`insert into push_slot (user_id, local_date, kind, ref) values (${userId}, ${localDate}, ${kind}, ${ref})
            on conflict (user_id, local_date) do nothing`;
        }
        return { claimed: true as const };
      });
    },

    async pushSlotFree(userId, localDate, kind, ref, defaultMax = null) {
      return (await claimVerdict(userId, localDate, kind, ref, defaultMax)) === null;
    },

    async getPushDailyMax(userId) {
      const rows = await sql`select push_daily_max from users where id = ${userId}`;
      const v = rows[0]?.push_daily_max;
      return v === null || v === undefined ? null : num(v);
    },

    async setPushDailyMax(userId, n) {
      const rows = await sql`update users set push_daily_max = ${n} where id = ${userId} returning id`;
      return rows.length > 0;
    },

    async createSend(userId, r) {
      await sql`insert into send_log (id, user_id, kind, ref, template_key, lang, variant, token, state)
        values (${r.id}, ${userId}, ${r.kind}, ${r.ref}, ${r.templateKey}, ${r.lang}, ${r.variant}, ${r.token}, ${r.state})`;
    },

    async settleSend(userId, id, patch) {
      await sql`update send_log set
          state = ${patch.state},
          ticket_id = case when ${patch.ticketId !== undefined} then ${patch.ticketId ?? null} else ticket_id end,
          receipt_error = case when ${patch.receiptError !== undefined} then ${patch.receiptError ?? null} else receipt_error end,
          receipt_at = case when ${patch.receipt === true} then now() else receipt_at end
        where id = ${id} and user_id = ${userId}`;
    },

    async sendsAwaitingReceipt(limit) {
      const rows = await sql`select * from send_log
        where state = 'accepted' and receipt_at is null and ticket_id is not null
        order by created_at limit ${limit}`;
      return (rows as Record<string, unknown>[]).map(sendRow);
    },

    async recordPushOpen(userId, sendId, action) {
      const rows = await sql`
        insert into push_open (user_id, send_id, action)
        select user_id, id, ${action} from send_log where id = ${sendId} and user_id = ${userId}
        on conflict do nothing returning send_id`;
      return (rows as unknown[]).length > 0;
    },

    async recordPushDelivered(userId, sendId) {
      const rows = await sql`
        update send_log set delivered_at = now()
        where id = ${sendId} and user_id = ${userId} and delivered_at is null returning id`;
      return (rows as unknown[]).length > 0;
    },

    async pushOpenStats(days, timezone) {
      const since = new Date(now() - days * 24 * 60 * 60 * 1000).toISOString();
      // `at` is the send's instant to the millisecond, which is all the JS side can name: a meal
      // stamped at exactly the send's own `createdAt` must land inside [at, at + 24 h) however many
      // microseconds Postgres kept. `reached` leaves out what no phone ever got (dead, refused,
      // dry), so a stray open or the meal that followed is not a conversion.
      const rows = await sql`
        with s as (
          select *, date_trunc('milliseconds', created_at) as at,
                 state not in ('dead', 'refused', 'dry') as reached
          from send_log where created_at >= ${since} and state <> 'would_have_sent' and ref is distinct from 'admin-test'
        )
        select (s.created_at at time zone ${timezone})::date::text as day, s.kind, s.template_key,
               count(*)::int as sent,
               count(*) filter (where s.state in ('accepted', 'delivered-to-apns', 'expired'))::int as accepted,
               count(*) filter (where s.state = 'dead')::int as dead,
               count(*) filter (where s.delivered_at is not null)::int as delivered,
               count(*) filter (where s.reached and o.send_id is not null)::int as opened,
               count(*) filter (where s.reached and exists (
                 select 1 from meals m
                 where m.user_id = s.user_id and m.ts >= s.at and m.ts < s.at + interval '24 hours'
               ))::int as converted
        from s left join push_open o on o.user_id = s.user_id and o.send_id = s.id
        group by 1, 2, 3
        order by 1 desc, 3`;
      return (rows as Record<string, unknown>[]).map((r) => ({
        day: r.day as string, kind: r.kind as PushStatRow["kind"], templateKey: r.template_key as string,
        sent: r.sent as number, accepted: r.accepted as number, dead: r.dead as number,
        delivered: r.delivered as number, opened: r.opened as number, converted: r.converted as number,
      }));
    },

    async listCampaigns() {
      const rows = await sql`select * from campaigns order by created_at desc, id`;
      return (rows as Record<string, unknown>[]).map(campaignRow);
    },

    async getCampaign(id) {
      const rows = await sql`select * from campaigns where id = ${id}`;
      return rows[0] ? campaignRow(rows[0] as Record<string, unknown>) : null;
    },

    async createCampaign(r) {
      await sql`insert into campaigns (id, name, template_key, segment, status, local_send_time, rollout_pct, promotional, variants, holdout_pct, created_by)
        values (${r.id}, ${r.name}, ${r.templateKey}, ${r.segment}::jsonb, ${r.status},
                ${r.localSendTime}, ${r.rolloutPct}, ${r.promotional}, ${r.variants}, ${r.holdoutPct}, ${r.createdBy})`;
    },

    async updateCampaign(id, p) {
      // `case when` keeps one statement for any subset of fields, as `settleSend` does.
      const rows = await sql`update campaigns set
          name = case when ${p.name !== undefined} then ${p.name ?? null} else name end,
          template_key = case when ${p.templateKey !== undefined} then ${p.templateKey ?? null} else template_key end,
          segment = case when ${p.segment !== undefined} then ${p.segment ?? {}}::jsonb else segment end,
          status = case when ${p.status !== undefined} then ${p.status ?? null} else status end,
          local_send_time = case when ${p.localSendTime !== undefined} then ${p.localSendTime ?? null} else local_send_time end,
          rollout_pct = case when ${p.rolloutPct !== undefined} then ${p.rolloutPct ?? null} else rollout_pct end,
          promotional = case when ${p.promotional !== undefined} then ${p.promotional ?? null} else promotional end,
          variants = case when ${p.variants !== undefined} then ${p.variants ?? null} else variants end,
          holdout_pct = case when ${p.holdoutPct !== undefined} then ${p.holdoutPct ?? null} else holdout_pct end,
          updated_at = now()
        where id = ${id} returning *`;
      return rows[0] ? campaignRow(rows[0] as Record<string, unknown>) : null;
    },

    async markCampaignRunning(id) {
      const rows = await sql`update campaigns set status = 'running', updated_at = now()
        where id = ${id} and status = 'scheduled' returning id`;
      return (rows as unknown[]).length > 0;
    },

    async campaignsKilled() {
      const rows = await sql`select value from push_flags where name = 'campaigns_killed'`;
      return (rows[0] as Record<string, unknown> | undefined)?.value === true;
    },

    async setCampaignsKilled(killed) {
      await sql`insert into push_flags (name, value) values ('campaigns_killed', ${killed})
        on conflict (name) do update set value = excluded.value`;
    },

    async hasCampaignSend(userId, campaignId) {
      const rows = await sql`select 1 from campaign_send where user_id = ${userId} and campaign_id = ${campaignId}`;
      return (rows as unknown[]).length > 0;
    },

    async claimCampaignSend(userId, campaignId) {
      const rows = await sql`insert into campaign_send (user_id, campaign_id) values (${userId}, ${campaignId})
        on conflict do nothing returning campaign_id`;
      return (rows as unknown[]).length > 0;
    },

    async campaignReport(campaignId) {
      const totals = await sql`
        select
          count(*) filter (where s.variant is distinct from 'test' and s.state not in ('dry','would_have_sent'))::int as sent,
          count(*) filter (where s.variant is distinct from 'test' and s.state in ('accepted','delivered-to-apns','expired'))::int as accepted,
          count(*) filter (where s.variant is distinct from 'test' and s.state = 'dead')::int as dead,
          count(*) filter (where s.variant is distinct from 'test' and s.state = 'dry')::int as dry,
          count(*) filter (where s.variant is distinct from 'test' and s.state not in ('dead','refused','dry','would_have_sent') and o.send_id is not null)::int as opened,
          count(*) filter (where s.variant = 'test')::int as test,
          count(*) filter (where s.variant is distinct from 'test' and s.state = 'would_have_sent')::int as held
        from send_log s left join push_open o on o.user_id = s.user_id and o.send_id = s.id
        where s.kind = 'campaign' and s.ref = ${campaignId}`;
      // By ACCOUNT, because the comparison is of people, and INTENT TO TREAT for conversion: a meal after
      // the send counts whatever became of the delivery (the holdout has no dead rows, so filtering
      // them out would lower only the treated rate). Opened keeps its delivery filter; a held-out
      // account has nothing to open.
      const groups = await sql`
        with s as (
          select user_id, id, state, created_at,
                 case when state = 'would_have_sent' then 'holdout' else coalesce(variant, 'default') end as grp
          from send_log
          where kind = 'campaign' and ref = ${campaignId} and variant is distinct from 'test' and state <> 'dry'
        )
        select grp,
               count(distinct user_id)::int as users,
               count(distinct user_id) filter (where grp <> 'holdout' and state not in ('dead','refused') and exists (
                 select 1 from push_open o where o.user_id = s.user_id and o.send_id = s.id))::int as opened,
               count(distinct user_id) filter (where exists (
                 select 1 from meals m
                 where m.user_id = s.user_id and m.ts >= date_trunc('milliseconds', s.created_at)
                   and m.ts < date_trunc('milliseconds', s.created_at) + interval '24 hours'))::int as converted
        from s group by grp order by grp`;
      const t = totals[0] as Record<string, number>;
      return {
        sent: t.sent!, accepted: t.accepted!, dead: t.dead!, dry: t.dry!, opened: t.opened!, test: t.test!, held: t.held!,
        groups: (groups as Record<string, unknown>[]).map((g) => ({
          group: g.grp as string, users: g.users as number, opened: g.opened as number, converted: g.converted as number,
        })),
      };
    },

    async sendLogFor(userId, limit) {
      const rows = await sql`select * from send_log where user_id = ${userId}
        order by created_at desc, id limit ${limit}`;
      return (rows as Record<string, unknown>[]).map(sendRow);
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
                    ${line.kind === "meal" ? line.mealId : line.mealId ?? null},
                    ${line.kind === "meal" ? line.event : null},
                    ${line.role === "user" && line.kind === "text" ? line.clientId ?? null : null},
                    ${line.role === "user" && line.kind === "text" ? line.pendingId ?? null : null},
                    ${line.role === "assistant" ? line.speaker ?? null : null},
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
    async carrierLineFor(userId, mealId) {
      if (!UUID.test(mealId)) return null;
      const rows = await sql`select * from chat_messages
        where user_id = ${userId} and role = 'user'
          and ((kind = 'photo' and meal_id = ${mealId}) or (kind = 'text' and pending_id = ${mealId}))
        order by seq desc limit 1`;
      return rows.length > 0 ? toChat(rows[0] as Record<string, unknown>) : null;
    },
    async deleteLine(userId, lineId) {
      if (!UUID.test(lineId)) return false;
      const rows = await sql`delete from chat_messages where id = ${lineId} and user_id = ${userId} returning id`;
      return rows.length > 0;
    },
    async deleteMealLines(userId, mealId) {
      if (!UUID.test(mealId)) return 0;
      const rows = await sql`delete from chat_messages where user_id = ${userId} and kind <> 'photo' and meal_id = ${mealId} returning id`;
      return rows.length;
    },
    async deleteMealComments(userId, mealId) {
      if (!UUID.test(mealId)) return 0;
      // Rows from before #1752 carry no meal id: they belong to the card they directly follow.
      const rows = await sql`
        delete from chat_messages c where c.user_id = ${userId} and c.role = 'assistant' and c.kind = 'text'
          and (c.meal_id = ${mealId} or (c.meal_id is null and exists (
            select 1 from chat_messages card where card.user_id = c.user_id and card.kind = 'meal' and card.meal_id = ${mealId}
              and card.seq < c.seq and not exists (
                select 1 from chat_messages x where x.user_id = c.user_id and x.seq > card.seq and x.seq < c.seq
                  and not (x.role = 'assistant' and x.kind = 'text' and x.meal_id is null)))))
        returning c.id`;
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

    async countClipAnalyses(date) {
      const rows = await sql`select count(*)::int as n from analyses where date = ${date} and scope = 'clip'`;
      return num(rows[0].n);
    },

    async countUserAnalyses(userId) {
      // Served by the prefix of analyses_user_date_idx (user_id, date, scope).
      const rows = await sql`select count(*)::int as n from analyses where user_id = ${userId} and sample`;
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

    async recordTiming(userId, analysisId, timing) {
      const rows = await sql`update analyses
                set ms_queue = ${timing.queue}, ms_first_item = ${timing.firstItem}, ms_total = ${timing.total}
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

    async releaseSample(userId, analysisId) {
      const rows = await sql`
        update analyses set sample = false where id = ${analysisId} and user_id = ${userId} returning id`;
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
        update turns set outcome = ${outcome}
        where user_id = ${userId} and client_id = ${clientId}`;
    },

    async enqueueJob(userId, input) {
      const queue = await jobQueue(input.kind, input.requestVersion);
      return await inTx(async (tx) => {
        const claimed = await tx`
          insert into turns (user_id, client_id, claimed_at) values (${userId}, ${input.clientId}, ${new Date(now())})
          on conflict (user_id, client_id) do nothing returning client_id`;
        if (claimed.length === 0) return false;
        // Through our transaction: a rolled-back turn leaves no job behind, and a job never runs
        // ahead of its photos.
        await boss.send(queue, {
          userId, clientId: input.clientId, kind: input.kind, requestVersion: input.requestVersion,
          request: input.request, step: input.step, items: [], updatedAt: new Date(now()).toISOString(),
        }, {
          db: { executeSql: async (text, values) => ({ rows: (await tx.unsafe(text, values as unknown[])) as unknown[] }) },
          ...(input.group !== undefined ? { group: { id: input.group } } : {}),
        });
        for (const [i, p] of input.photos.entries()) {
          await tx`
            insert into meal_photos (id, meal_id, user_id, client_id, position, mime, bytes)
            values (${crypto.randomUUID()}, ${null}, ${userId}, ${input.clientId}, ${i}, ${p.mime}, ${Buffer.from(p.bytes)})`;
        }
        await tx`select pg_notify('eait_jobs', '')`;
        return true;
      });
    },

    async getJob(userId, clientId) {
      const rows = await sql`
        select j.*, t.outcome from job_rows j left join turns t using (user_id, client_id)
        where j.user_id = ${userId} and j.client_id = ${clientId}`;
      return rows[0] ? toJob(rows[0] as JobRow) : null;
    },

    async listJobs(userId, opts) {
      const bar = opts.cursor ? opts.cursor.indexOf("|") : -1;
      const [cu, cc] = bar > 0 ? [opts.cursor!.slice(0, bar), opts.cursor!.slice(bar + 1)] : [null, null];
      const rows = await sql`
        select j.*, t.outcome from job_rows j left join turns t using (user_id, client_id)
        where j.user_id = ${userId}
          and (${opts.state} = 'all' or (${opts.state} = 'active') = (j.state <> 'settled'))
          and (${opts.since === null ? null : new Date(opts.since)}::timestamptz is null or j.updated_at > ${opts.since === null ? null : new Date(opts.since)}::timestamptz)
          and (${cu}::timestamptz is null or (j.updated_at, j.client_id) < (${cu}::timestamptz, ${cc}))
        order by j.updated_at desc, j.client_id desc limit ${opts.limit + 1}`;
      const page = rows.slice(0, opts.limit).map((r: unknown) => toJob(r as JobRow));
      const last = page[page.length - 1];
      return { jobs: page, cursor: rows.length > opts.limit && last ? `${new Date(last.updatedAt).toISOString()}|${last.clientId}` : null };
    },

    async jobPhotos(userId, clientId) {
      const rows = await sql`
        select mime, bytes from meal_photos
        where user_id = ${userId} and client_id = ${clientId} and meal_id is null order by position`;
      return rows.map((r: { mime: string; bytes: Uint8Array }) => ({ mime: r.mime, bytes: new Uint8Array(r.bytes) }));
    },

    // THE FENCE, in every write a running attempt makes: `state = 'active'` and our `owner` in its
    // data. Once pg-boss has retried the job (heartbeat lapsed) or another replica claimed it, the
    // write matches nothing and the attempt ends without writing more.
    async jobProgress(userId, clientId, owner, step, items) {
      const rows = await sql`
        update pgboss.job set data = data || jsonb_build_object('step', ${step}::int, 'items', ${items}::jsonb, 'updatedAt', now())
        where data->>'userId' = ${userId} and data->>'clientId' = ${clientId} and state = 'active' and data->>'owner' = ${owner}
        returning id`;
      if (rows.length > 0) await sql`select pg_notify('eait_job', ${`${userId}:${clientId}`})`;
      return rows.length > 0;
    },

    async followJob(userId, clientId, until) {
      await sql`
        update pgboss.job set data = data || jsonb_build_object('followedUntil', ${new Date(until)}::timestamptz)
        where data->>'userId' = ${userId} and data->>'clientId' = ${clientId}`;
    },

    async removeJob(userId, clientId) {
      const rows = await sql`
        update pgboss.job set data = data || jsonb_build_object('removedAt', now(), 'updatedAt', now())
        where data->>'userId' = ${userId} and data->>'clientId' = ${clientId} and state in ('created', 'retry', 'active')
        returning id`;
      if (rows.length > 0) await sql`select pg_notify('eait_job', ${`${userId}:${clientId}`})`;
      return rows.length > 0;
    },

    async settleJob(userId, clientId, owner, outcome) {
      return await inTx(async (tx) => {
        const rows = await tx`
          update pgboss.job set state = 'completed', completed_on = now(), output = ${outcome}::jsonb,
                 data = data || jsonb_build_object('updatedAt', now())
          where data->>'userId' = ${userId} and data->>'clientId' = ${clientId} and state = 'active' and data->>'owner' = ${owner}
          returning id`;
        if (rows.length === 0) return false;
        await tx`update turns set outcome = ${outcome} where user_id = ${userId} and client_id = ${clientId}`;
        await tx`delete from meal_photos where user_id = ${userId} and client_id = ${clientId} and meal_id is null`;
        await tx`select pg_notify('eait_job', ${`${userId}:${clientId}`})`;
        return true;
      });
    },

    async claimPush(userId, clientId) {
      const rows = await sql`
        update pgboss.job set data = data || jsonb_build_object('pushedAt', now())
        where data->>'userId' = ${userId} and data->>'clientId' = ${clientId}
          and not data ? 'pushedAt' and not data ? 'removedAt'
          and (not data ? 'followedUntil' or (data->>'followedUntil')::timestamptz < now())
        returning id`;
      return rows.length > 0;
    },

    async chargeJob(userId, clientId, owner, analysisId) {
      const rows = await sql`
        update pgboss.job set data = data || jsonb_build_object('analysisId', ${analysisId}::text)
        where data->>'userId' = ${userId} and data->>'clientId' = ${clientId} and state = 'active' and data->>'owner' = ${owner}
        returning id`;
      return rows.length > 0;
    },

    async landJobMeal(userId, clientId, owner, meal) {
      const held = await sql`
        update pgboss.job set data = data || jsonb_build_object('mealId', ${meal.id}::text, 'updatedAt', now())
        where data->>'userId' = ${userId} and data->>'clientId' = ${clientId} and state = 'active' and data->>'owner' = ${owner}
          and not data ? 'mealId'
        returning id`;
      if (held.length === 0) return false;
      await methods.insertMeal(meal);
      await sql`
        update meal_photos set meal_id = ${meal.id}
        where user_id = ${userId} and client_id = ${clientId} and meal_id is null`;
      await sql`
        update meals set photos = (select count(*) from meal_photos where meal_id = ${meal.id})
        where id = ${meal.id} and user_id = ${userId}`;
      return true;
    },

    // A meal the router resolved, not one this job inserted — `landJobMeal`'s fenced stamp alone
    // (#1347). Overwriting is allowed: a re-route mid-run still means the last meal it wrote to.
    async bindJobMeal(userId, clientId, owner, mealId) {
      const rows = await sql`
        update pgboss.job set data = data || jsonb_build_object('mealId', ${mealId}::text, 'updatedAt', now())
        where data->>'userId' = ${userId} and data->>'clientId' = ${clientId} and state = 'active' and data->>'owner' = ${owner}
        returning id`;
      if (rows.length > 0) await sql`select pg_notify('eait_job', ${`${userId}:${clientId}`})`;
      return rows.length > 0;
    },

    // Back to `retry`, not `created`: pg-boss counts the next claim as a second attempt, as the
    // lease version did, so a non-retryable kind still refuses to run twice.
    async releaseJobs(owner) {
      const rows = await sql`
        update pgboss.job set state = 'retry', start_after = now(), data = (data - 'owner') || jsonb_build_object('updatedAt', now())
        where state = 'active' and data->>'owner' = ${owner} returning id`;
      if (rows.length > 0) await sql`select pg_notify('eait_jobs', '')`;
      return rows.length;
    },

    // pg-boss claims (`fetch`: SKIP LOCKED, active, retry_count) and its monitor fails or retries a
    // job whose heartbeat lapsed, up to the queue's `retryLimit` of 1 — two attempts, as before.
    // The owner and the per-job heartbeat window are ours, stamped right after the claim.
    async claimJob(owner, registry, leaseMs) {
      for (const { kind, version, grouped } of registry) {
        for (let v = 1; v <= version; v++) {
          // `groupConcurrency: 1` is pg-boss's own answer to one-job-per-group (#1347): a created
          // job whose group a running job already holds is filtered out of the fetch, so the next
          // eligible job claims instead and the waiting one runs when the first settles.
          const [job] = await boss.fetch(await jobQueue(kind, v), { batchSize: 1, ...(grouped ? { groupConcurrency: 1 } : {}) });
          if (!job) continue;
          await sql`
            update pgboss.job set heartbeat_on = now(), heartbeat_seconds = ${heartbeatSeconds(leaseMs)},
                   data = data || jsonb_build_object('owner', ${owner}::text, 'updatedAt', now())
            where id = ${job.id}::uuid`;
          const rows = await sql`select j.*, null as outcome from job_rows j where j.boss_id = ${job.id}::uuid`;
          return rows[0] ? toJob(rows[0] as JobRow) : null;
        }
      }
      return null;
    },

    async heartbeatJobs(owner, leaseMs) {
      const rows = await sql`
        update pgboss.job set heartbeat_on = now(), heartbeat_seconds = ${heartbeatSeconds(leaseMs)}
        where state = 'active' and data->>'owner' = ${owner} returning id`;
      return rows.length;
    },

    // Queued too long, or failed by pg-boss after its last attempt: the turn gets `outcome`.
    // ponytail: 500 per call, so a large backlog drains over several ticks instead of one long
    // transaction that stalls the worker; set-based turns/photos updates if that ever lags.
    async expireJobs(createdBefore, outcome) {
      return await inTx(async (tx) => {
        const rows = await tx`
          with picked as (
            select id from pgboss.job
             where data ? 'userId' and not data ? 'expiredAt'
               and ((state in ('created', 'retry') and created_on < ${new Date(createdBefore)}) or state = 'failed')
             limit 500 for update skip locked)
          update pgboss.job j set state = case when j.state = 'failed' then j.state else 'cancelled' end,
                 completed_on = coalesce(j.completed_on, now()),
                 data = j.data || jsonb_build_object('expiredAt', now(), 'updatedAt', now())
            from picked where j.id = picked.id
          returning j.data->>'userId' as user_id, j.data->>'clientId' as client_id`;
        for (const r of rows as { user_id: string; client_id: string }[]) {
          await tx`update turns set outcome = ${outcome} where user_id = ${r.user_id} and client_id = ${r.client_id}`;
          await tx`delete from meal_photos where user_id = ${r.user_id} and client_id = ${r.client_id} and meal_id is null`;
          await tx`select pg_notify('eait_job', ${`${r.user_id}:${r.client_id}`})`;
        }
        return (rows as { user_id: string; client_id: string }[]).map((r) => ({ userId: r.user_id, clientId: r.client_id }));
      });
    },

    async forgetJobs(before) {
      const gone = await sql`
        delete from pgboss.job
        where data ? 'userId' and state in ('completed', 'cancelled', 'failed')
          and coalesce((data->>'updatedAt')::timestamptz, created_on) < ${new Date(before)}
        returning id`;
      await sql`delete from meal_photos where meal_id is null and created_at < ${new Date(before)}`;
      return gone.length;
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

    async pruneAbandonedAccounts(before) {
      // Across every account, like the sweeps it sits beside — see the port for the rule. `device`
      // is the one provider that does NOT disqualify: it is the anonymous credential an install is
      // born with, the very class being swept, rather than a way back. `telegram` does disqualify
      // although `signsIn` answers false for it — somebody is listening on that transport.
      //
      // The `not exists` clauses are IN the delete, the same guarded-statement rule as
      // `pruneHealthDaysBefore`: nothing interleaves between qualifying and going.
      const rows = await sql`
        delete from users u
        where u.created_at < ${new Date(before)}
          and u.entitlement_event_at is null
          and not exists (
            select 1 from identities i
            where i.user_id = u.id and i.provider <> 'device')
          and not exists (select 1 from meals m where m.user_id = u.id)
          and not exists (
            select 1 from tokens t
            where t.user_id = u.id and t.last_used_at >= ${new Date(before)})
        returning u.id`;
      return rows.length;
    },

    async tryLeadership() {
      // A dead session takes its advisory locks with it, so whatever this process held is gone
      // already — not-leader is the honest answer, and the next call re-contests on a fresh
      // connection. Said rather than returned raw, because "no connection" reading as "still
      // leader" is the failure a second Telegram poller is made of.
      const deadSession = async (e: unknown): Promise<boolean> => {
        console.error(`[eait] leadership connection lost: ${(e as Error)?.message ?? e}`);
        leaderHeld = false;
        const dead = elector;
        elector = null;
        await dead?.end().catch(() => {});
        return false;
      };
      if (leaderHeld) {
        // Held: ask pg_locks rather than re-taking it. Session advisory locks STACK on repeat
        // acquisition, so a second `pg_try_advisory_lock` on this connection would be a count
        // nothing ever unlocks; this answers "does this session still hold it" instead.
        try {
          const [r] = await electorSql()`
            select count(*)::int as n from pg_locks
             where locktype = 'advisory' and pid = pg_backend_pid()
               and classid = ${ADVISORY_CLASS} and objid = ${LEADER_LOCK_KEY}`;
          leaderHeld = Number(r?.n ?? 0) > 0;
          return leaderHeld;
        } catch (e) {
          return deadSession(e);
        }
      }
      try {
        const [r] = await electorSql()`
          select pg_try_advisory_lock(${ADVISORY_CLASS}, ${LEADER_LOCK_KEY}) as ok`;
        leaderHeld = r?.ok === true;
        return leaderHeld;
      } catch (e) {
        return deadSession(e);
      }
    },

    async releaseLeadership() {
      leaderHeld = false;
      const e = elector;
      elector = null;
      // `end` closes the session and the lock goes with it — no unlock needed, which is also why
      // a crashed leader's lock does not have to be waited out.
      await e?.end().catch(() => {});
    },

    async onJobNotify(handlers) {
      const subs: SQL.ListenSubscription[] = [];
      const add = async (channel: string, fn: (payload: string) => void) => {
        let acknowledged = false;
        const s = await pool.listen(channel, fn, () => {
          if (acknowledged) console.warn(`[eait] job LISTEN ${channel}: connection dropped and re-subscribed; notifications missed meanwhile are covered by the poll`);
          acknowledged = true;
        });
        subs.push(s);
        listening.add(s);
      };
      try {
        await add("eait_job", (key) => {
          const i = key.indexOf(":");
          if (i > 0) handlers.job(key.slice(0, i), key.slice(i + 1));
        });
        await add("eait_jobs", () => handlers.enqueued());
      } catch (e) {
        for (const s of subs) { listening.delete(s); await s.unlisten().catch(() => {}); }
        throw e;
      }
      return async () => {
        for (const s of subs) { listening.delete(s); await s.unlisten().catch(() => {}); }
      };
    },

    async close() {
      for (const s of listening) await s.unlisten().catch(() => {});
      listening.clear();
      leaderHeld = false;
      const e = elector;
      elector = null;
      await e?.end().catch(() => {});
      await boss.stop({ graceful: false, close: false }).catch(() => {});
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
      // The turn's cutoff, when this call is part of one (#276): a store call a dead turn left
      // running — a method body still unwinding inside a race the request already lost — is
      // refused rather than handed a pooled connection to hold.
      const deadline = storeDeadline.getStore();
      if (deadline?.signal.aborted) throw deadline.signal.reason;
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
        // The caller may have given up while this queued for a connection: the reservation rolls
        // straight back rather than being spent on a result nobody is waiting for.
        if (deadline?.signal.aborted) throw deadline.signal.reason;
        // Postgres's own bound on every statement below, from the turn's remaining clock: a wedged
        // statement dies at the bound and the transaction rolls back — the release a pooled
        // connection held by a wedged query cannot get from a promise race (#276).
        if (deadline !== undefined)
          await tx`select set_config('statement_timeout', ${String(Math.max(1, deadline.at - Date.now()))}, true)`;
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

function campaignRow(r: Record<string, unknown>): CampaignRow {
  const seg = typeof r.segment === "string" ? JSON.parse(r.segment) : r.segment;
  return {
    id: r.id as string, name: r.name as string, templateKey: r.template_key as CampaignRow["templateKey"],
    segment: seg as CampaignRow["segment"], status: r.status as CampaignRow["status"],
    localSendTime: r.local_send_time as string, rolloutPct: r.rollout_pct as number,
    promotional: r.promotional as boolean, variants: r.variants as number, holdoutPct: r.holdout_pct as number, createdBy: (r.created_by as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(), updatedAt: new Date(r.updated_at as string).toISOString(),
  };
}

function sendRow(r: Record<string, unknown>): SendLogRow {
  return {
    id: r.id as string, userId: r.user_id as string, kind: r.kind as SendKind, ref: (r.ref as string | null) ?? null,
    templateKey: r.template_key as string, lang: r.lang as string, variant: (r.variant as string | null) ?? null,
    token: r.token as string, state: r.state as SendLogState, ticketId: (r.ticket_id as string | null) ?? null,
    receiptError: (r.receipt_error as string | null) ?? null,
    createdAt: new Date(r.created_at as string).toISOString(),
    receiptAt: r.receipt_at ? new Date(r.receipt_at as string).toISOString() : null,
    deliveredAt: r.delivered_at ? new Date(r.delivered_at as string).toISOString() : null,
  };
}

