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
import type { DayTotals, Lang, MealItem, MealRecord, MealVerdicts, Profile, Provider } from "@ieat/shared";
import { blankProfile, type MealPatch, type PendingMeal, type ProfilePatch, type Store } from "./store.ts";

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

create table if not exists tokens (
  token      text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists tokens_user_idx on tokens(user_id);

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
`;

/** Row shapes as Postgres hands them back. Numbers are coerced at the boundary, once. */
type UserRow = Record<string, unknown>;
type MealRow = Record<string, unknown>;

const num = (v: unknown): number => (v === null || v === undefined ? 0 : Number(v));
const nullableNum = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));

function toProfile(r: UserRow): Profile {
  return {
    user_id: String(r.id),
    lang: (r.lang ?? "en") as Lang,
    goal: (r.goal ?? null) as Profile["goal"],
    sex: (r.sex ?? null) as Profile["sex"],
    birth_year: nullableNum(r.birth_year),
    height_cm: nullableNum(r.height_cm),
    weight_kg: nullableNum(r.weight_kg),
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

export async function postgresStore(databaseUrl: string): Promise<Store> {
  const sql = new SQL(databaseUrl);
  await sql.unsafe(SCHEMA);

  return {
    async upsertDeviceUser(deviceId, lang: Lang) {
      const found = await sql`select * from users where device_id = ${deviceId}`;
      if (found.length > 0) return { userId: String(found[0].id), created: false };
      const id = crypto.randomUUID();
      await sql`insert into users (id, device_id, lang) values (${id}, ${deviceId}, ${lang})
                on conflict (device_id) do nothing`;
      // The conflict branch is a genuine race (two cold starts of the same app), not paranoia:
      // re-reading is what makes the second one return the FIRST one's user rather than throwing.
      const row = await sql`select id from users where device_id = ${deviceId}`;
      const userId = String(row[0].id);
      const created = userId === id;
      if (created) {
        await sql`insert into identities (provider, subject, user_id)
                  values ('device', ${deviceId}, ${userId})
                  on conflict (provider, subject) do nothing`;
      }
      return { userId, created };
    },

    async createUser(lang: Lang) {
      const id = crypto.randomUUID();
      await sql`insert into users (id, lang) values (${id}, ${lang})`;
      return id;
    },

    async issueToken(userId) {
      const token = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString("base64url");
      await sql`insert into tokens (token, user_id) values (${token}, ${userId})`;
      return token;
    },

    async userIdForToken(token) {
      const rows = await sql`select user_id from tokens where token = ${token}`;
      return rows.length > 0 ? String(rows[0].user_id) : null;
    },

    async revokeToken(token) {
      await sql`delete from tokens where token = ${token}`;
    },

    async userIdForIdentity(provider, subject) {
      const rows = await sql`
        select user_id from identities where provider = ${provider} and subject = ${subject}`;
      return rows.length > 0 ? String(rows[0].user_id) : null;
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

    async insertMeal(m) {
      await sql`
        insert into meals (id, user_id, ts, date, is_food, items, kcal, protein_g, carbs_g, fat_g,
                           satfat_g, fiber_g, sugar_g, sodium_mg, verdicts, confidence, notes,
                           corrected, model)
        values (${m.id}, ${m.user_id}, ${m.ts}, ${m.date}, ${m.isFood},
                ${JSON.stringify(m.items)}, ${m.kcal}, ${m.protein_g}, ${m.carbs_g}, ${m.fat_g},
                ${m.satfat_g}, ${m.fiber_g}, ${m.sugar_g}, ${m.sodium_mg},
                ${JSON.stringify(m.verdicts)}, ${m.confidence}, ${m.notes}, ${m.corrected},
                ${m.model})`;
    },

    async getMeal(userId, mealId) {
      // Never widen this beyond `id = ? and user_id = ?`.
      const rows = await sql`select * from meals where id = ${mealId} and user_id = ${userId}`;
      return rows.length > 0 ? toMeal(rows[0]) : null;
    },

    async updateMeal(userId, mealId, patch: MealPatch) {
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
      const rows = await sql`
        select * from pendings where id = ${pendingId} and user_id = ${userId}`;
      if (rows.length === 0) return null;
      const r = rows[0];
      const expiresAt = new Date(r.expires_at as string).getTime();
      if (expiresAt <= Date.now()) {
        await sql`delete from pendings where id = ${pendingId} and user_id = ${userId}`;
        return null;
      }
      return {
        id: String(r.id), userId: String(r.user_id),
        analysis: json<PendingMeal["analysis"]>(r.analysis, {} as PendingMeal["analysis"]), date: String(r.date), expiresAt,
      };
    },

    async dropPending(userId, pendingId) {
      await sql`delete from pendings where id = ${pendingId} and user_id = ${userId}`;
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

    async recordAnalysis(userId, date, scope) {
      await sql`insert into analyses (user_id, date, scope) values (${userId}, ${date}, ${scope})`;
    },

    async deleteUser(userId) {
      // `on delete cascade` clears tokens, meals, pendings and analyses with the row.
      await sql`delete from users where id = ${userId}`;
    },

    async close() {
      await sql.end();
    },
  };
}
