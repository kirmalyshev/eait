// One suite, run against BOTH store implementations.
//
// The memory store is what the engine tests run against, and Postgres is what production runs. A
// divergence between them is a bug that every test passes and every user hits — which already
// happened once: the two disagreed about whether a merge repoints or drops the anonymous device
// identity, and the Postgres side would have let a signed-out user walk back into their account.
//
// So the assertions live here once and both implementations answer them.
//
// Postgres is SKIPPED, loudly, when `TEST_DATABASE_URL` is unset — a silently skipped test is a
// test that reads as passing. Run it with:
//   sh scripts/db.sh up
//   TEST_DATABASE_URL=postgres://ieat:ieat@127.0.0.1:5433/ieat bun test src/backend/store.contract.test.ts

import { afterAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { DEFAULT_ONBOARDING_CONTENT, type MealRecord } from "@ieat/shared";
import { hashToken } from "./auth/tokens.ts";
import { memoryStore } from "./store.memory.ts";
import { postgresStore } from "./store.pg.ts";
import type { Store, StoreOptions } from "./store.ts";

const PG_URL = process.env.TEST_DATABASE_URL;

/**
 * Connections per pool, in tests only.
 *
 * This file opens several stores — one per suite, plus the two that inspect the table directly —
 * and each holds its own pool for as long as its suite runs. At the shipped size that is more than
 * Postgres allows at once, and the failure is not a slow test: it is FATAL "sorry, too many clients
 * already" on a connection mid-query, reported against whichever assertion happened to be running.
 */
const TEST_POOL = 2;

const meal = (userId: string, over: Partial<MealRecord> = {}): MealRecord => ({
  id: crypto.randomUUID(), user_id: userId, ts: new Date().toISOString(), date: "2026-08-01",
  isFood: true, items: [{ name: "Rice", grams: 200, name_en: "rice" }], kcal: 260, protein_g: 5,
  carbs_g: 56, fat_g: 1, satfat_g: 0.2, fiber_g: 1, sugar_g: 0.1, sodium_mg: 5,
  verdicts: { weight: "good" }, confidence: "high", notes: "", corrected: false, model: "test",
  ...over,
});

const device = () => crypto.randomUUID() + crypto.randomUUID();

/**
 * Postgres persists between runs, so every fixture that is not scoped to a fresh user must be
 * unique per run. Identity subjects collide on a UNIQUE constraint; the GLOBAL analysis count is
 * cross-user by definition and cannot assume an empty table. Both bit on the first real-Postgres
 * run — with the memory store they had passed for free.
 */
const RUN = crypto.randomUUID().slice(0, 8);
const subject = (name: string) => `${name}-${RUN}`;
/** A date this run owns exclusively, for the cross-user counting test. */
const RUN_DATE = `2026-${String((Number(RUN.charCodeAt(0)) % 12) + 1).padStart(2, "0")}-${String((Number(RUN.charCodeAt(1)) % 28) + 1).padStart(2, "0")}`;

/** Every implementation must satisfy this. */
function contract(name: string, make: () => Promise<Store>) {
  describe(`store contract — ${name}`, () => {
    // ONE store for the whole suite, not one per test. A Postgres store owns a connection pool, and
    // opening one per test exhausts `max_connections` — which fails as "too many clients already"
    // and looks exactly like a product bug until you count the pools.
    //
    // Isolation comes from every test minting its own users and device ids instead.
    let store: Store | null = null;
    const open = async () => (store ??= await make());
    afterAll(async () => { await store?.close(); });

    it("creates a device user once and finds it again", async () => {
      const s = await open();
      const id = device();
      const first = await s.upsertDeviceUser(id, "en");
      const second = await s.upsertDeviceUser(id, "en");
      expect(first.created).toBe(true);
      expect(second.created).toBe(false);
      expect(second.userId).toBe(first.userId);
      expect((await s.listIdentities(first.userId)).map((i) => i.provider)).toEqual(["device"]);
    });

    it("resolves a token to its user, and stops after revocation", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const token = await s.issueToken(userId);
      expect(await s.userIdForToken(token)).toBe(userId);
      await s.revokeToken(token);
      expect(await s.userIdForToken(token)).toBeNull();
      expect(await s.userIdForToken("never-issued")).toBeNull();
    });

    it("scopes a meal read to its owner", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      const m = meal(a);
      await s.insertMeal(m);
      expect((await s.getMeal(a, m.id))?.id).toBe(m.id);
      // Indistinguishable from a meal that does not exist.
      expect(await s.getMeal(b, m.id)).toBeNull();
      expect(await s.updateMeal(b, m.id, { kcal: 1 })).toBeNull();
      expect((await s.getMeal(a, m.id))!.kcal).toBe(260);
    });

    it("patches only the fields given", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const m = meal(u);
      await s.insertMeal(m);
      const updated = await s.updateMeal(u, m.id, { kcal: 999, corrected: true });
      expect(updated!.kcal).toBe(999);
      expect(updated!.protein_g).toBe(5); // untouched
      expect(updated!.corrected).toBe(true);
      expect(updated!.items).toEqual(m.items); // jsonb round-trips
    });

    it("sums a day and a window per user", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.insertMeal(meal(u, { kcal: 100, protein_g: 10, date: "2026-08-01" }));
      await s.insertMeal(meal(u, { kcal: 200, protein_g: 20, date: "2026-08-01" }));
      await s.insertMeal(meal(u, { kcal: 50, protein_g: 5, date: "2026-07-30" }));
      expect(await s.mealsForDate(u, "2026-08-01")).toHaveLength(2);
      const totals = await s.totalsSince(u, "2026-07-31");
      expect(totals).toHaveLength(1);
      expect(totals[0]!.kcal).toBe(300);
    });

    it("keeps a profile patch's absent fields untouched", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.patchProfile(u, { goal: "lose", weight_kg: 90 });
      const p = await s.patchProfile(u, { weight_kg: 88 });
      expect(p.goal).toBe("lose");
      expect(p.weight_kg).toBe(88);
      expect(p.restrictions).toEqual([]);
    });

    it("round-trips every profile shape, including nulls and arrays", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const p = await s.patchProfile(u, {
        goal: "gain", sex: "male", birth_year: 1990, height_cm: 183, weight_kg: 93.5,
        target_weight_kg: 92, activity: "moderate", pace: "push", country: "de",
        restrictions: ["ldl", "kidneys"], medical_limitations: "gastritis",
        food_allergies: null, onboarded_at: "2026-01-01T00:00:00.000Z",
      });
      expect(p.weight_kg).toBe(93.5);
      expect(p.restrictions).toEqual(["ldl", "kidneys"]);
      expect(p.medical_limitations).toBe("gastritis");
      expect(p.food_allergies).toBeNull();
      expect(p.onboarded_at).toBe("2026-01-01T00:00:00.000Z");
    });

    it("expires a pending meal rather than returning it", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const live = { id: crypto.randomUUID(), userId: u, analysis: meal(u), date: "2026-08-01", expiresAt: Date.now() + 60_000 };
      const dead = { ...live, id: crypto.randomUUID(), expiresAt: Date.now() - 1_000 };
      await s.putPending(live);
      await s.putPending(dead);
      expect((await s.getPending(u, live.id))?.id).toBe(live.id);
      expect(await s.getPending(u, dead.id)).toBeNull();
    });

    it("counts photo analyses per user but every analysis globally", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.recordAnalysis(a, RUN_DATE, "photo");
      await s.recordAnalysis(a, RUN_DATE, "text");
      await s.recordAnalysis(b, RUN_DATE, "photo");
      expect(await s.countUserPhotos(a, RUN_DATE)).toBe(1); // text excluded
      expect(await s.countGlobalAnalyses(RUN_DATE)).toBe(3);
    });

    // ── identities ────────────────────────────────────────────────────────────────────────────

    it("links an identity and finds the account behind it", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(u, "apple", subject("apple-sub"));
      expect(await s.userIdForIdentity("apple", subject("apple-sub"))).toBe(u);
      expect(await s.userIdForIdentity("google", subject("apple-sub"))).toBeNull(); // separate namespaces
    });

    it("refuses to move an identity to a second account", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(a, "apple", subject("contested"));
      expect(s.addIdentity(b, "apple", subject("contested"))).rejects.toThrow();
      expect(await s.userIdForIdentity("apple", subject("contested"))).toBe(a);
    });

    it("is idempotent when relinking the same identity to the same account", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(u, "google", subject("g1"));
      await s.addIdentity(u, "google", subject("g1"));
      expect((await s.listIdentities(u)).filter((i) => i.provider === "google")).toHaveLength(1);
    });

    it("MERGES meals across and DROPS the anonymous device identity", async () => {
      // The exact divergence that shipped between these two implementations. Dropping is required:
      // repointing would let plain device auth walk back in after a sign-out.
      const s = await open();
      const anonDevice = device();
      const anon = (await s.upsertDeviceUser(anonDevice, "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(real, "apple", subject("real-sub"));

      await s.insertMeal(meal(anon, { kcal: 111 }));
      await s.insertMeal(meal(anon, { kcal: 222 }));
      await s.insertMeal(meal(real, { kcal: 333 }));
      const anonToken = await s.issueToken(anon);

      const moved = await s.mergeUsers(anon, real);
      expect(moved).toBe(2);

      const meals = await s.mealsForDate(real, "2026-08-01");
      expect(meals).toHaveLength(3);
      expect(meals.map((m) => m.kcal).sort((x, y) => x - y)).toEqual([111, 222, 333]);

      // The merged-away account is gone, its token is dead, and its device identity was dropped.
      expect(await s.getProfile(anon)).toBeNull();
      expect(await s.userIdForToken(anonToken)).toBeNull();
      expect(await s.userIdForIdentity("device", anonDevice)).toBeNull();

      // And re-authenticating with that device id lands on a NEW empty account.
      const back = await s.upsertDeviceUser(anonDevice, "en");
      expect(back.created).toBe(true);
      expect(back.userId).not.toBe(real);
      expect(await s.mealsForDate(back.userId, "2026-08-01")).toHaveLength(0);
    });

    it("erases everything on delete, releasing the provider subject", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(u, "apple", subject("to-be-released"));
      await s.insertMeal(meal(u));
      const token = await s.issueToken(u);

      await s.deleteUser(u);

      expect(await s.getProfile(u)).toBeNull();
      expect(await s.mealsForDate(u, "2026-08-01")).toHaveLength(0);
      expect(await s.userIdForToken(token)).toBeNull();
      // Released, so signing in again is a NEW account rather than a resurrection.
      expect(await s.userIdForIdentity("apple", subject("to-be-released"))).toBeNull();
    });

    // ── Onboarding ─────────────────────────────────────────────────────────────────────────
    //
    // The funnel is aggregated in JS by one implementation and in SQL by the other, so "both
    // produce the same numbers" is a claim that has to be tested rather than assumed. The median
    // is the one most likely to diverge: `percentile_cont` interpolates, and a hand-written median
    // that picked the lower of two middles would disagree on every even-sized sample.

    it("stores onboarding content and reads it back whole", async () => {
      const s = await open();
      // No assertion that it STARTS null. This is a single pinned row and Postgres keeps it
      // between runs, so "nothing has been saved yet" is true exactly once per database — the
      // same trap as the identity subjects above. The null case is covered in the engine tests,
      // which get a fresh store every time.
      const content = { ...DEFAULT_ONBOARDING_CONTENT, version: 7 };
      await s.putOnboardingContent(content);
      const back = await s.getOnboardingContent();
      // Deep equality, not "it returned something". A jsonb column that stored the JSON as a
      // STRING round-trips without error and comes back unusable — the same bug the meal items
      // column had.
      expect(back).toEqual(content);

      await s.putOnboardingContent({ ...content, version: 8 });
      expect((await s.getOnboardingContent())?.version).toBe(8);
    });

    it("ignores an onboarding event id it has already stored", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const at = new Date().toISOString();
      const e = { id: `dup-${RUN}`, sessionId: `sess-${RUN}`, place: "about" as const, action: "view" as const, contentVersion: 1, at };

      expect(await s.recordOnboardingEvents(u, [e])).toBe(1);
      expect(await s.recordOnboardingEvents(u, [e])).toBe(0);
    });

    it("aggregates the funnel identically in both implementations", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const at = new Date().toISOString();
      const sid = `funnel-${RUN}`;
      const ev = (n: number, over: Record<string, unknown>) => ({
        id: `${sid}-${n}`, sessionId: sid, place: "goal" as const, action: "view" as const,
        contentVersion: 1, at, ...over,
      });

      // Measured as a DELTA. The funnel is instance-wide by definition — it is the admin's view of
      // every user — so it carries rows from the other tests in this suite, and against real
      // Postgres it carries rows from every earlier run today. Absolute counts here would pass
      // exactly once per database.
      const before = await s.onboardingFunnel(1);
      await s.recordOnboardingEvents(u, [
        ev(1, {}),
        ev(2, { action: "answer", field: "goal", value: "lose", ms: 1000 }),
        ev(3, { action: "answer", field: "goal", value: "gain", ms: 3000 }),
        ev(4, { action: "back" }),
        ev(5, { action: "reject", field: "goal" }),
        ev(6, { place: "summary", action: "complete" }),
      ] as never);
      const after = await s.onboardingFunnel(1);

      const delta = (key: "views" | "answers" | "backs" | "rejects") =>
        (after.rows.find((r) => r.place === "goal")?.[key] ?? 0)
        - (before.rows.find((r) => r.place === "goal")?.[key] ?? 0);

      expect(delta("views")).toBe(1);
      expect(delta("answers")).toBe(2);
      expect(delta("backs")).toBe(1);
      expect(delta("rejects")).toBe(1);
      expect(after.sessions - before.sessions).toBe(1);
      expect(after.completed - before.completed).toBe(1);
      // Two samples, so the median is their mean. Both implementations must say 2000 — and they
      // must agree on it: `percentile_cont` interpolates, and a hand-written median that took the
      // lower of two middles would answer 1000 on every even-sized sample.
      expect(after.rows.find((r) => r.place === "goal")!.medianMs).toBe(2000);
    });

    it("erases a user's funnel rows with the account", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const sid = `erase-${RUN}`;
      // `pace` is used by no other test here, so its count is this test's alone.
      const views = async () =>
        (await s.onboardingFunnel(1)).rows.find((r) => r.place === "pace")?.views ?? 0;

      const before = await views();
      await s.recordOnboardingEvents(u, [{
        id: `${sid}-1`, sessionId: sid, place: "pace", action: "view", contentVersion: 1,
        at: new Date().toISOString(),
      }] as never);
      expect(await views()).toBe(before + 1);

      await s.deleteUser(u);

      // Back to where it started. Onboarding promises erasure while asking about the user's
      // kidneys; the analytics table is not an exception to that sentence.
      expect(await views()).toBe(before);
    });
  });
}

contract("memory", async () => memoryStore());

if (PG_URL) {
  contract("postgres", () => postgresStore(PG_URL, { maxConnections: TEST_POOL }));
} else {
  describe("store contract — postgres", () => {
    it.skip("SKIPPED: set TEST_DATABASE_URL to run against real Postgres", () => {});
  });
}

// ── Session-token lifetime ─────────────────────────────────────────────────────────────────────
//
// A separate suite rather than more cases inside `contract`, because every one of these needs a
// store built with a lifetime short enough to reach and a clock the test moves. The shipped value
// is 180 days; waiting it out is not a test.
//
// REGISTERED LAST ON PURPOSE. `pruneExpiredTokens` is global by definition — it cannot be scoped to
// one user without becoming a different method — so against real Postgres it deletes the rows the
// suites above issued. Those have finished by the time this runs. Moving this block up breaks them
// in a way that reads as a bug in the store.
function tokenLifetime(name: string, make: (opts: StoreOptions) => Promise<Store>) {
  describe(`session tokens — ${name}`, () => {
    const TTL = 60_000;
    // Fixed rather than `Date.now()`, so a failure reproduces with the same numbers.
    let clock = Date.parse("2026-08-01T12:00:00Z");

    let store: Store | null = null;
    const open = async () => (store ??= await make({ sessionTtlMs: TTL, now: () => clock }));
    afterAll(async () => { await store?.close(); });

    it("stops honouring a token that has gone unused for its lifetime", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const token = await s.issueToken(userId);
      expect(await s.userIdForToken(token)).toBe(userId);

      clock += TTL + 1_000;

      // Not "returns a user whose session is stale" — the caller has one question and gets one
      // answer. `routes.ts` turns null into 401, and the app trades its device id for a new token.
      expect(await s.userIdForToken(token)).toBeNull();
    });

    it("keeps a token alive for as long as it is being used", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const token = await s.issueToken(userId);

      // Three quarters of the way to the deadline, then a request. The deadline moves with it.
      clock += Math.floor(TTL * 0.75);
      expect(await s.userIdForToken(token)).toBe(userId);

      // Past where the ORIGINAL deadline was. An absolute expiry would have signed this user out
      // mid-use; the whole point of the sliding one is that only an abandoned token dies.
      clock += Math.floor(TTL * 0.75);
      expect(await s.userIdForToken(token)).toBe(userId);
    });

    it("prunes the idle tokens and leaves the live ones", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");

      // Two tokens for one account — a phone that gets replaced, which is the case this is for.
      const abandoned = await s.issueToken(userId);
      clock += Math.floor(TTL / 2);
      const current = await s.issueToken(userId);

      // Far enough that the first is idle past its lifetime and the second is not. No token is
      // ISSUED after this point, because issuing sweeps on its own and the sweep is what is under
      // test here.
      clock += TTL - Math.floor(TTL / 2) + 1_000;

      // At least one: against real Postgres this table also holds whatever the suites above left,
      // and a global sweep is global. Exactly-one would be asserting the state of the database
      // rather than the behaviour of the method.
      expect(await s.pruneExpiredTokens()).toBeGreaterThanOrEqual(1);
      expect(await s.userIdForToken(abandoned)).toBeNull();
      expect(await s.userIdForToken(current)).toBe(userId);

      // Idempotent, and it does not take the live one on a second pass.
      expect(await s.pruneExpiredTokens()).toBe(0);
      expect(await s.userIdForToken(current)).toBe(userId);
    });

    it("sweeps on issue, so the table stays bounded without a scheduler", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const abandoned = await s.issueToken(userId);

      clock += TTL + 1_000;

      // Nothing calls prune here. Minting is the sweep — a first launch, a sign-in, or the 401
      // recovery in the app's boot path, all of which are rare enough to afford it.
      await s.issueToken(userId);
      expect(await s.pruneExpiredTokens()).toBe(0);
      expect(await s.userIdForToken(abandoned)).toBeNull();
    });
  });
}

tokenLifetime("memory", async (o) => memoryStore(o));

if (PG_URL) {
  tokenLifetime("postgres", (o) => postgresStore(PG_URL, { ...o, maxConnections: TEST_POOL }));

  // The reason the column is a hash, stated as an assertion rather than as a comment.
  //
  // Everything else here is reachable through the port. This is not: "what a stolen dump contains"
  // is a question about the table, so the test asks the table. A backup lands on this host nightly
  // and is rsynced off it — if the answer to this ever changes, that file becomes a set of live
  // credentials for every account.
  describe("session tokens at rest — postgres", () => {
    it("keeps nothing a dump could present back as a bearer token", async () => {
      const s = await postgresStore(PG_URL, { maxConnections: TEST_POOL });
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const token = await s.issueToken(userId);

      const sql = new SQL(PG_URL, { max: TEST_POOL });
      try {
        const columns = (await sql`
          select column_name from information_schema.columns
          where table_schema = current_schema() and table_name = 'tokens'`)
          .map((r: { column_name: string }) => r.column_name);
        // The plaintext column is GONE, not merely unused. A column that still exists is a column
        // the next `select *` puts back into a dump.
        expect(columns).not.toContain("token");
        expect(columns).toContain("token_hash");

        // The row is found by the hash...
        const byHash = await sql`
          select user_id from tokens where token_hash = ${await hashToken(token)}`;
        expect(byHash.length).toBe(1);
        expect(String(byHash[0].user_id)).toBe(userId);

        // ...and the value the client holds appears nowhere in the table.
        const byRaw = await sql`select count(*)::int as n from tokens where token_hash = ${token}`;
        expect(byRaw[0].n).toBe(0);
      } finally {
        await sql.close();
        await s.close();
      }
    });

    // The upgrade itself, against the shape a host deployed before this actually has.
    //
    // REGISTERED LAST, because it drops and rebuilds the tokens table. Everything above has
    // finished by then. Without this test the migration is a block of SQL that has only ever run on
    // a database where its `if` was false — which is to say, never.
    it("carries a plaintext-token host across without signing anybody out", async () => {
      const sql = new SQL(PG_URL, { max: TEST_POOL });
      const seed = await postgresStore(PG_URL, { maxConnections: TEST_POOL });
      const { userId } = await seed.upsertDeviceUser(device(), "en");
      await seed.close();

      try {
        // The pre-migration shape, exactly: token as the primary key, no hash, no last_used_at.
        await sql`drop table if exists tokens`;
        await sql.unsafe(`create table tokens (
          token      text primary key,
          user_id    uuid not null references users(id) on delete cascade,
          created_at timestamptz not null default now()
        )`);
        const legacy = `legacy-token-${RUN}`;
        await sql`insert into tokens (token, user_id) values (${legacy}, ${userId})`;

        // Opening a store is what runs the migration.
        const s = await postgresStore(PG_URL, { maxConnections: TEST_POOL });
        try {
          // The phone in somebody's pocket does not notice the deploy. This is the entire reason
          // the migration hashes the existing values rather than truncating the table.
          expect(await s.userIdForToken(legacy)).toBe(userId);

          const columns = (await sql`
            select column_name from information_schema.columns
            where table_schema = current_schema() and table_name = 'tokens'`)
            .map((r: { column_name: string }) => r.column_name);
          expect(columns).not.toContain("token");
          expect(columns).toContain("last_used_at");

          // And it is idempotent — a second deploy re-runs the same SQL against the new shape.
          const again = await postgresStore(PG_URL, { maxConnections: TEST_POOL });
          expect(await again.userIdForToken(legacy)).toBe(userId);
          await again.close();
        } finally {
          await s.close();
        }
      } finally {
        await sql.close();
      }
    });
  });
}
