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
//   sh scripts/db.sh up && sh scripts/db.sh create
//   bun run test:pg
// which points it at THIS worktree's database (`EAIT_DATABASE_URL`, written by `make env`), never at
// slot 0's `eait`: that is the main checkout's dev data (#495). `TEST_DATABASE_URL` still wins.

import { afterAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { DEFAULT_NOTIFICATION_COPY, DEFAULT_ONBOARDING_CONTENT, emptyHealthDay, type MealRecord } from "@eait/shared";
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

    // ── The role ───────────────────────────────────────────────────────────────────────────
    //
    // #391a. The admin stops being a shared secret and becomes something an ACCOUNT carries, so
    // every one of these is a rule about who can become one. Both implementations answer them for
    // the usual reason: the memory store is what every engine test runs against, so a rule it
    // enforces and Postgres does not is a rule that passes everywhere and fails in production only.

    it("makes every new account a plain user", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      // Not `undefined`, and this is the point rather than tidiness: a gate written
      // `role !== "user"` would read an absent field as an admin. There is nothing absent.
      expect(await s.roleOf(userId)).toBe("user");
    });

    it("has no admin until one is made, which is what switches the surface off", async () => {
      const s = await open();
      await s.upsertDeviceUser(device(), "en");
      expect(await s.hasAdmin()).toBe(false);
    });

    it("grants and revokes, idempotently, and says so", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      expect(await s.setRole(userId, "admin")).toBe(true);
      expect(await s.setRole(userId, "admin")).toBe(true);
      expect(await s.roleOf(userId)).toBe("admin");
      expect(await s.hasAdmin()).toBe(true);

      expect(await s.setRole(userId, "user")).toBe(true);
      expect(await s.roleOf(userId)).toBe("user");
      expect(await s.hasAdmin()).toBe(false);
    });

    it("refuses to grant to an account that does not exist", async () => {
      const s = await open();
      // The bootstrap names a UUID from a config file. A typo in it must not create anything, and
      // must not report success — an admin nobody can sign in as reads exactly like a working one.
      expect(await s.setRole("00000000-0000-4000-8000-000000000000", "admin")).toBe(false);
      expect(await s.roleOf("00000000-0000-4000-8000-000000000000")).toBeNull();
    });

    it("does not carry a role through a merge", async () => {
      // `mergeUsers` copies an explicit column list, and the role is deliberately not on it: a
      // merge is anonymous→real, so the account that survives is the real one and its own role is
      // the answer. This is here so that nobody adds the role to the `coalesce` block six lines
      // from the entitlement's — which WOULD let an anonymous session carry an admin grant into
      // somebody else's account.
      const s = await open();
      const { userId: anon } = await s.upsertDeviceUser(device(), "en");
      const { userId: real } = await s.upsertDeviceUser(device(), "en");
      await s.setRole(anon, "admin");

      await s.mergeUsers(anon, real);
      expect(await s.roleOf(real)).toBe("user");
      expect(await s.roleOf(anon)).toBeNull();
    });

    it("cannot be written through the profile", async () => {
      // The structural half of the same rule. Postgres allowlists the columns `patchProfile` may
      // touch; the memory store writes every key it is handed. Keeping the role OUT of `Profile`
      // entirely is what makes those two agree — a role that lived on the profile object would be
      // settable by a PATCH on one implementation and not the other.
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      await s.patchProfile(userId, { role: "admin" } as never);
      expect(await s.roleOf(userId)).toBe("user");
      expect((await s.getProfile(userId)) as unknown as Record<string, unknown>).not.toHaveProperty("role");
    });

    // ── The admin's user list ──────────────────────────────────────────────────────────────
    //
    // #374, and it is the ONE READ IN THIS PORT THAT IS NOT SCOPED TO A USER. That makes it a
    // deliberate widening with a name of its own rather than a relaxed `WHERE` on something the
    // product calls: `AGENTS.md` says every read is scoped by a userId resolved from credentials,
    // and the way to add an exception is to make it visible in the interface, test it here, and
    // put it behind the admin role. Nothing on the product's own paths may call this.

    it("lists the accounts newest first, with what the admin came to see", async () => {
      const s = await open();
      const d = device();
      const { userId } = await s.upsertDeviceUser(d, "en");
      await s.addIdentity(userId, "google", subject("list-one"));
      await s.setIdentityEmail(userId, "google", subject("list-one"), "Listed@Example.test");
      await s.setFreeAnalyses(userId, 7);
      await s.recordAnalysis(userId, RUN_DATE, "photo");
      await s.recordAnalysis(userId, RUN_DATE, "text");
      await s.issueToken(userId);

      const page = await s.adminListUsers({ limit: 50, today: RUN_DATE });
      const row = page.rows.find((r) => r.userId === userId)!;
      expect(row).toBeDefined();
      expect(row.createdAt).toBeTruthy();
      // Every provider on the account, and `device` is one: an anonymous install is a fact about
      // the account, not the absence of one.
      expect([...row.providers].sort()).toEqual(["device", "google"]);
      expect(row.email).toBe("Listed@Example.test");
      expect(row.freeAnalyses).toBe(7);
      // Both scopes, because the sample is spent by a typed meal as much as by a photograph.
      expect(row.analysesToday).toBe(2);
      expect(row.spent).toBe(2);
      expect(row.lastSeen).toBeTruthy();
    });

    it("says nothing an account does not have, rather than guessing", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const row = (await s.adminListUsers({ limit: 50, today: RUN_DATE })).rows
        .find((r) => r.userId === userId)!;
      expect(row.email).toBeNull();
      // Null is "this account takes the instance default", which is a different fact from a number.
      expect(row.freeAnalyses).toBeNull();
      expect(row.analysesToday).toBe(0);
      expect(row.spent).toBe(0);
      // Never signed in on any device, so there is no session to have been seen in.
      expect(row.lastSeen).toBeNull();
      expect(row.entitlement).toBeNull();
      expect(row.onboardedAt).toBeNull();
    });

    it("carries the entitlement as stored, and computes nothing about it", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const expires = new Date(Date.now() + 86_400_000).toISOString();
      await s.putEntitlement(userId, { expiresAt: expires, productId: "monthly", eventAt: new Date().toISOString() });
      const row = (await s.adminListUsers({ limit: 50, today: RUN_DATE })).rows
        .find((r) => r.userId === userId)!;
      // The store hands back the record; whether it is LIVE is `entitlementLive`'s answer and the
      // engine's to ask. Two places deciding what "paid" means is how the panel and the refusal
      // come to disagree.
      expect(row.entitlement?.expiresAt).toBe(expires);
      expect(row.entitlement?.productId).toBe("monthly");
    });

    it("pages with a cursor rather than an offset, and says when there is no more", async () => {
      const s = await open();
      const mine: string[] = [];
      for (let i = 0; i < 3; i++) {
        mine.push((await s.upsertDeviceUser(device(), "en")).userId);
        // A REAL PAUSE, because the order under test is by creation time. Three accounts made in
        // one millisecond are ordered by their ids, which are random — so without this the
        // assertion below is a coin toss rather than a check on the sort.
        await new Promise((r) => setTimeout(r, 2));
      }

      // An OFFSET pages wrong the moment a row is inserted mid-walk — which on this table is
      // somebody signing up. The cursor is the last row's own position.
      const first = await s.adminListUsers({ limit: 1, today: RUN_DATE });
      expect(first.rows).toHaveLength(1);
      expect(first.nextCursor).not.toBeNull();
      const second = await s.adminListUsers({ limit: 1, cursor: first.nextCursor!, today: RUN_DATE });
      expect(second.rows).toHaveLength(1);
      expect(second.rows[0]!.userId).not.toBe(first.rows[0]!.userId);

      // Newest first, so the three just made come back in the reverse of the order they were made.
      const all = await s.adminListUsers({ limit: 100, today: RUN_DATE });
      const seen = all.rows.map((r) => r.userId).filter((id) => mine.includes(id));
      expect(seen).toEqual([...mine].reverse());
    });

    it("finds one account by its exact address, case-folded", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const sub = subject("find-by-email");
      await s.addIdentity(userId, "apple", sub);
      await s.setIdentityEmail(userId, "apple", sub, `Person.${RUN}@Example.test`);

      const found = await s.adminListUsers({ q: `person.${RUN}@example.TEST`, limit: 50, today: RUN_DATE });
      expect(found.rows.map((r) => r.userId)).toEqual([userId]);
    });

    it("finds one account by an id prefix, and NEVER by a substring of one", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");

      expect((await s.adminListUsers({ q: userId.slice(0, 8), limit: 50, today: RUN_DATE }))
        .rows.map((r) => r.userId)).toEqual([userId]);
      // A prefix is an index seek; a substring is a scan of every account in the table, and it is
      // the shape that turns a support question into a table scan on the box that serves the app.
      expect((await s.adminListUsers({ q: userId.slice(9, 17), limit: 50, today: RUN_DATE })).rows)
        .toEqual([]);
    });

    it("answers a query that is neither with no rows, never with everything", async () => {
      const s = await open();
      await s.upsertDeviceUser(device(), "en");
      // The failure this is against: a `q` the implementation does not recognise falling through to
      // an unfiltered list, so a typo in a support ticket dumps the user table.
      expect((await s.adminListUsers({ q: "not an id or an address", limit: 50, today: RUN_DATE })).rows)
        .toEqual([]);
    });

    it("bounds the page whatever it is asked for", async () => {
      const s = await open();
      await s.upsertDeviceUser(device(), "en");
      // The route clamps too, and this is the half that holds when something else calls it.
      expect((await s.adminListUsers({ limit: 10_000, today: RUN_DATE })).rows.length)
        .toBeLessThanOrEqual(200);
    });

    // ── The numbers past the funnel ────────────────────────────────────────────────────────
    //
    // #377, and the SECOND unscoped read in this port. Every assertion here is about a number an
    // operator would act on, so each one is about what the number MEANS as much as what it is.

    it("counts signups, activations and analyses on the instance's own calendar", async () => {
      const s2 = await open();
      const today = new Date().toISOString().slice(0, 10);
      const on = (m: { days: { date: string; analyses: number }[] }) =>
        m.days.find((d) => d.date === RUN_DATE)?.analyses ?? 0;
      // EACH READ ENDS ON THE DAY IT ASSERTS ABOUT (#506). One window ending at the real today used
      // to serve both, so whenever `RUN_DATE` fell after today — about 30% of runs on 2026-09-10 —
      // the analyses were outside it and the delta read 0, in both stores. From 2027 it would have
      // come back the other way, as early-2026 dates fell off the far end. What day a window ends
      // on is the point; its size never was.
      const runDay = () => s2.adminMetrics({ days: 400, today: RUN_DATE, timezone: "UTC" });
      // A DELTA, not an absolute. This suite shares one store and Postgres persists between runs,
      // so the day's total belongs to whatever else has run — measuring the change is the only
      // version of this that is about the method rather than about the database.
      const before = on(await runDay());

      const { userId } = await s2.upsertDeviceUser(device(), "en");
      await s2.patchProfile(userId, { onboarded_at: new Date().toISOString() });
      await s2.recordAnalysis(userId, RUN_DATE, "photo");
      await s2.recordAnalysis(userId, RUN_DATE, "text");

      // BOTH SCOPES. A typed meal costs money and spends the sample exactly as a photograph does,
      // and `globalDailyAnalysisCap` counts both — so a per-day number that dropped the text turns
      // would be a bill missing a line.
      expect(on(await runDay()) - before).toBe(2);
      const m = await s2.adminMetrics({ days: 400, today, timezone: "UTC" });
      const now = m.days.find((d) => d.date === today)!;
      expect(now.signups).toBeGreaterThanOrEqual(1);
      expect(now.activations).toBeGreaterThanOrEqual(1);
    });

    it("gives every day in the window a row, including the empty ones", async () => {
      const s2 = await open();
      const today = "2026-06-15";
      const m = await s2.adminMetrics({ days: 7, today, timezone: "UTC" });
      // `totalsSince` groups by date and a day with nothing produces NO ROW — the trap
      // `AGENTS.md` names. A chart with holes in it is read as a drop rather than as silence, so
      // this one fills them.
      expect(m.days).toHaveLength(7);
      expect(m.days[m.days.length - 1]!.date).toBe(today);
      expect(m.days[0]!.date).toBe("2026-06-09");
      expect(m.days.every((d) => Number.isInteger(d.analyses))).toBe(true);
    });

    it("counts a return as an analysis on the day after signing up", async () => {
      const s2 = await open();
      const { userId } = await s2.upsertDeviceUser(device(), "en");
      const today = new Date().toISOString().slice(0, 10);
      const tomorrow = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      await s2.recordAnalysis(userId, tomorrow, "photo");

      // The account signed up today and logged something "tomorrow", so from a vantage point two
      // days on it is a D1 return.
      const after = new Date(Date.now() + 2 * 86_400_000).toISOString().slice(0, 10);
      const m = await s2.adminMetrics({ days: 30, today: after, timezone: "UTC" });
      expect(m.d1.returned).toBeGreaterThanOrEqual(1);
      expect(m.d1.eligible).toBeGreaterThanOrEqual(1);
      expect(m.d1.returned).toBeLessThanOrEqual(m.d1.eligible);
      // Nothing on day 7, so it counts as eligible-and-did-not rather than as a return.
      expect(m.d7.returned).toBe(0);
    });

    it("does not count an account that has not HAD its second day yet", async () => {
      const s2 = await open();
      await s2.upsertDeviceUser(device(), "en");
      const today = new Date().toISOString().slice(0, 10);
      const m = await s2.adminMetrics({ days: 30, today, timezone: "UTC" });
      // Signed up today. Counting it as "did not return" is what drags a retention number down as
      // a product grows, and it is the most common way one is reported wrong.
      expect(m.d1.eligible).toBe(0);
      expect(m.d7.eligible).toBe(0);
    });

    it("bounds the window whatever it is asked for", async () => {
      const s2 = await open();
      const m = await s2.adminMetrics({ days: 10_000, today: "2026-06-15", timezone: "UTC" });
      expect(m.days.length).toBeLessThanOrEqual(400);
    });

    // ── The paid tier ──────────────────────────────────────────────────────────────────────
    //
    // Both implementations must agree here for the same reason they must agree about merging: the
    // memory store is what every engine test runs against, so a rule it enforces and Postgres does
    // not is a rule that passes everywhere and fails in production only.

    it("has no entitlement until one is written", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      expect(await s.getEntitlement(userId)).toBeNull();
    });

    // THE TWO GRANTS ARE SEPARATE, and every test below is about that. A customer can hold a
    // subscription and the lifetime unlock at once, because both grant the same entitlement. One
    // column carrying both is not a shortcut, it is a bug with a receipt: it revoked a monthly
    // plan that was still paid for the moment the lifetime was refunded.
    it("stores a lifetime unlock, and it is not the same as having no record", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      expect(await s.putEntitlement(userId, {
        lifetimeProductId: "lifetime", productId: "lifetime",
        eventAt: "2026-08-24T10:00:00.000Z",
      })).toBe(true);
      expect(await s.getEntitlement(userId)).toEqual({
        expiresAt: null, lifetimeProductId: "lifetime", productId: "lifetime",
        eventAt: "2026-08-24T10:00:00.000Z", trial: false,
      });

      const { userId: other } = await s.upsertDeviceUser(device(), "en");
      expect(await s.getEntitlement(other)).toBeNull();
    });

    it("keeps a subscription's end date when the lifetime unlock is granted, and vice versa", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");

      await s.putEntitlement(userId, {
        expiresAt: "2026-09-24T10:00:00.000Z", productId: "monthly",
        eventAt: "2026-08-14T10:00:00.000Z",
      });
      // The unlock arrives. It says nothing about the monthly plan, so the plan's end survives.
      await s.putEntitlement(userId, {
        lifetimeProductId: "lifetime", productId: "lifetime",
        eventAt: "2026-08-19T10:00:00.000Z",
      });
      expect(await s.getEntitlement(userId)).toEqual({
        expiresAt: "2026-09-24T10:00:00.000Z", lifetimeProductId: "lifetime",
        productId: "lifetime", eventAt: "2026-08-19T10:00:00.000Z", trial: false,
      });

      // The plan renews. It says nothing about the unlock, so the unlock survives.
      await s.putEntitlement(userId, {
        expiresAt: "2026-10-24T10:00:00.000Z", productId: "monthly",
        eventAt: "2026-08-24T10:00:00.000Z",
      });
      const after = await s.getEntitlement(userId);
      expect(after?.lifetimeProductId).toBe("lifetime");
      expect(after?.expiresAt).toBe("2026-10-24T10:00:00.000Z");
    });

    it("clears the unlock only for the product that granted it", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      await s.putEntitlement(userId, {
        lifetimeProductId: "lifetime", productId: "lifetime",
        eventAt: "2026-08-14T10:00:00.000Z",
      });

      // A monthly plan's cancellation must not revoke something bought outright.
      expect(await s.putEntitlement(userId, {
        lifetimeProductId: null, productId: "monthly", eventAt: "2026-08-19T10:00:00.000Z",
      })).toBe(false);
      expect((await s.getEntitlement(userId))?.lifetimeProductId).toBe("lifetime");

      // Its own refund does.
      expect(await s.putEntitlement(userId, {
        lifetimeProductId: null, productId: "lifetime", eventAt: "2026-08-24T10:00:00.000Z",
      })).toBe(true);
      expect((await s.getEntitlement(userId))?.lifetimeProductId).toBeNull();
    });

    it("refuses to clear an unlock that was never granted", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      expect(await s.putEntitlement(userId, {
        lifetimeProductId: null, productId: "lifetime", eventAt: "2026-08-24T10:00:00.000Z",
      })).toBe(false);
      // And nothing was written, so the account is still one that never bought anything — rather
      // than one whose ordering key now refuses the purchase that is about to arrive.
      expect(await s.getEntitlement(userId)).toBeNull();
    });

    // The merge is where a purchase is most easily lost: the entitlement lives on the users row,
    // the merged-away row is deleted, and the account that BOUGHT is usually the anonymous one —
    // the paywall sells from onboarding and from the camera refusal, both before anybody signs in.
    it("carries a purchase across a merge, and never over the surviving account's own", async () => {
      const s = await open();
      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.putEntitlement(anon, {
        lifetimeProductId: "lifetime", productId: "lifetime",
        eventAt: "2026-08-20T00:00:00.000Z",
      });

      await s.mergeUsers(anon, real);
      expect((await s.getEntitlement(real))?.lifetimeProductId).toBe("lifetime");

      // The other direction: a surviving account that already holds something keeps its own.
      const anon2 = (await s.upsertDeviceUser(device(), "en")).userId;
      const real2 = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.putEntitlement(anon2, {
        expiresAt: "2026-09-01T00:00:00.000Z", productId: "monthly",
        eventAt: "2026-08-20T00:00:00.000Z",
      });
      await s.putEntitlement(real2, {
        expiresAt: "2026-12-01T00:00:00.000Z", productId: "yearly",
        eventAt: "2026-08-21T00:00:00.000Z",
      });
      await s.mergeUsers(anon2, real2);
      expect((await s.getEntitlement(real2))?.expiresAt).toBe("2026-12-01T00:00:00.000Z");
    });

    // The survivor's own is not automatically the true one: a lapsed subscription is still a stored
    // grant, and gap-filling kept it over the purchase made minutes earlier on the anonymous session.
    it("takes the newer grant across a merge, not merely the survivor's", async () => {
      const s = await open();
      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.putEntitlement(real, {
        expiresAt: "2026-09-14T07:12:46.000Z", productId: "yearly",
        eventAt: "2026-09-13T07:13:22.000Z",
      });
      await s.putEntitlement(anon, {
        expiresAt: "2027-09-14T07:12:46.000Z", productId: "monthly", trial: true,
        eventAt: "2026-09-14T07:18:30.000Z",
      });

      await s.mergeUsers(anon, real);
      const merged = await s.getEntitlement(real);
      expect(merged?.expiresAt).toBe("2027-09-14T07:12:46.000Z");
      // The whole grant travels, not the date alone.
      expect(merged?.productId).toBe("monthly");
      expect(merged?.trial).toBe(true);

      // And the clock travelled with it, so the grant it replaced cannot be re-applied.
      expect(await s.putEntitlement(real, {
        expiresAt: "2026-09-14T07:12:46.000Z", productId: "yearly",
        eventAt: "2026-09-13T07:13:22.000Z",
      })).toBe(false);
    });

    // Same rule on the other grant, which has its own clock.
    it("takes the newer unlock across a merge", async () => {
      const s = await open();
      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.putEntitlement(real, {
        lifetimeProductId: "lifetime", productId: "lifetime",
        eventAt: "2026-08-20T00:00:00.000Z",
      });
      await s.putEntitlement(anon, {
        lifetimeProductId: "lifetime", productId: "lifetime",
        eventAt: "2026-08-21T00:00:00.000Z",
      });
      await s.putEntitlement(anon, {
        lifetimeProductId: null, productId: "lifetime",
        eventAt: "2026-08-22T00:00:00.000Z",
      });

      await s.mergeUsers(anon, real);
      expect((await s.getEntitlement(real))?.lifetimeProductId).toBeNull();
    });

    it("has no sample size of its own until the admin sets one, and the merge carries it", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      expect(await s.getFreeAnalyses(userId)).toBeNull();
      expect(await s.setFreeAnalyses(userId, 1)).toBe(true);
      expect(await s.getFreeAnalyses(userId)).toBe(1);
      expect(await s.setFreeAnalyses(userId, null)).toBe(true);
      expect(await s.getFreeAnalyses(userId)).toBeNull();
      expect(await s.setFreeAnalyses(crypto.randomUUID(), 1)).toBe(false);

      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.setFreeAnalyses(anon, 1);
      await s.mergeUsers(anon, real);
      expect(await s.getFreeAnalyses(real)).toBe(1);

      // And never over the survivor's own.
      const anon2 = (await s.upsertDeviceUser(device(), "en")).userId;
      const real2 = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.setFreeAnalyses(anon2, 1);
      await s.setFreeAnalyses(real2, 2);
      await s.mergeUsers(anon2, real2);
      expect(await s.getFreeAnalyses(real2)).toBe(2);
    });

    // THE CLOCKS HAVE TO CROSS TOO, and `getEntitlement` hides them — so the only way to see one is
    // to write against it. Without this, deleting both clock lines from the merge leaves the suite
    // green while a stale post-merge delivery silently becomes applicable again.
    it("carries each grant's clock across a merge, so a stale delivery stays stale", async () => {
      const s = await open();
      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.putEntitlement(anon, {
        expiresAt: "2026-09-24T00:00:00.000Z", productId: "monthly",
        eventAt: "2026-08-20T00:00:00.000Z",
      });
      await s.mergeUsers(anon, real);

      // Older than the clock that came with the grant. It was stale before the merge and the merge
      // is not an excuse to apply it.
      expect(await s.putEntitlement(real, {
        expiresAt: "2026-08-25T00:00:00.000Z", productId: "monthly",
        eventAt: "2026-08-19T00:00:00.000Z",
      })).toBe(false);
      expect((await s.getEntitlement(real))?.expiresAt).toBe("2026-09-24T00:00:00.000Z");

      // And a genuinely newer one still lands.
      expect(await s.putEntitlement(real, {
        expiresAt: "2026-10-24T00:00:00.000Z", productId: "monthly",
        eventAt: "2026-08-21T00:00:00.000Z",
      })).toBe(true);
    });

    // Two grants, two clocks. A late event about one must not be refused by a newer event about
    // the other: they are separate streams and RevenueCat orders neither.
    it("orders each grant against its own stream and not the other's", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");

      await s.putEntitlement(userId, {
        lifetimeProductId: "lifetime", productId: "lifetime",
        eventAt: "2026-08-24T00:00:00.000Z",
      });
      // OLDER than the unlock's event, and about the subscription. It must land.
      expect(await s.putEntitlement(userId, {
        expiresAt: "2026-09-24T00:00:00.000Z", productId: "monthly",
        eventAt: "2026-08-20T00:00:00.000Z",
      })).toBe(true);

      const both = await s.getEntitlement(userId);
      expect(both?.lifetimeProductId).toBe("lifetime");
      expect(both?.expiresAt).toBe("2026-09-24T00:00:00.000Z");

      // But within the subscription's own stream, an older event is still stale.
      expect(await s.putEntitlement(userId, {
        expiresAt: "2026-08-25T00:00:00.000Z", productId: "monthly",
        eventAt: "2026-08-19T00:00:00.000Z",
      })).toBe(false);
      expect((await s.getEntitlement(userId))?.expiresAt).toBe("2026-09-24T00:00:00.000Z");
    });

    it("stores what a purchase said and reads it back", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const e = {
        expiresAt: "2027-01-01T00:00:00.000Z",
        productId: "eait_pro_yearly",
        eventAt: "2026-08-24T10:00:00.000Z",
        trial: false,
      };
      expect(await s.putEntitlement(userId, e)).toBe(true);
      expect(await s.getEntitlement(userId)).toEqual({ ...e, lifetimeProductId: null });

      // The trial flag round-trips, and an event that omits it reads back as false in BOTH
      // implementations — a row written before the column existed must not read as a trial.
      const trial = { ...e, eventAt: "2026-08-24T11:00:00.000Z", trial: true };
      expect(await s.putEntitlement(userId, trial)).toBe(true);
      expect((await s.getEntitlement(userId))?.trial).toBe(true);
      const legacy = { expiresAt: e.expiresAt, productId: e.productId, eventAt: "2026-08-24T12:00:00.000Z" };
      expect(await s.putEntitlement(userId, legacy)).toBe(true);
      expect((await s.getEntitlement(userId))?.trial).toBe(false);
    });

    // Webhook delivery is not ordered. A cancellation generated BEFORE a renewal can arrive after
    // it, and applying it would revoke a subscription somebody is paying for — with nothing in the
    // app to say why. The newer EVENT wins, never the later write.
    it("refuses an event older than the one already applied", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const renewal = {
        expiresAt: "2027-01-01T00:00:00.000Z", productId: "eait_pro_yearly",
        eventAt: "2026-08-24T10:00:00.000Z", trial: false,
      };
      const staleCancellation = {
        expiresAt: "2026-08-24T09:00:00.000Z", productId: "eait_pro_yearly",
        eventAt: "2026-08-24T09:30:00.000Z",
      };
      expect(await s.putEntitlement(userId, renewal)).toBe(true);
      expect(await s.putEntitlement(userId, staleCancellation)).toBe(false);
      expect(await s.getEntitlement(userId)).toEqual({ ...renewal, lifetimeProductId: null });
    });

    // RevenueCat redelivers. The same event twice must not be treated as new information.
    it("treats a redelivery of the same event as already applied", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const e = {
        expiresAt: "2027-01-01T00:00:00.000Z", productId: "eait_pro_yearly",
        eventAt: "2026-08-24T10:00:00.000Z",
      };
      expect(await s.putEntitlement(userId, e)).toBe(true);
      expect(await s.putEntitlement(userId, e)).toBe(false);
    });

    // A later event revoking access IS applied — that is how a cancellation reaches this server.
    it("applies a newer event that expires the entitlement", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      await s.putEntitlement(userId, {
        expiresAt: "2027-01-01T00:00:00.000Z", productId: "eait_pro_yearly",
        eventAt: "2026-08-24T10:00:00.000Z",
      });
      const revoked = {
        expiresAt: "2026-08-24T11:00:00.000Z", productId: "eait_pro_yearly",
        eventAt: "2026-08-24T11:00:00.000Z", trial: false,
      };
      expect(await s.putEntitlement(userId, revoked)).toBe(true);
      expect(await s.getEntitlement(userId)).toEqual({ ...revoked, lifetimeProductId: null });
    });

    // RevenueCat can name an id this server never issued — its own anonymous ids, or an account
    // that has since been deleted. Writing one would create paid state belonging to nobody.
    it("will not write an entitlement for an unknown account", async () => {
      const s = await open();
      expect(await s.putEntitlement(crypto.randomUUID(), {
        expiresAt: "2027-01-01T00:00:00.000Z", productId: "eait_pro_yearly",
        eventAt: "2026-08-24T10:00:00.000Z",
      })).toBe(false);
    });

    it("erases the entitlement with the account", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      await s.putEntitlement(userId, {
        expiresAt: "2027-01-01T00:00:00.000Z", productId: "eait_pro_yearly",
        eventAt: "2026-08-24T10:00:00.000Z",
      });
      await s.deleteUser(userId);
      expect(await s.getEntitlement(userId)).toBeNull();
    });

    // ── Photos ─────────────────────────────────────────────────────────────────────────────
    //
    // The bytes live with the meal and are read by `meal_id AND user_id`, never by a guessable
    // path. Another user's meal id is empty here for the same reason it is null in `getMeal`.
    const jpeg = (fill: number) => { const b = new Uint8Array(16).fill(fill); b[0] = 0xff; b[1] = 0xd8; return b; };

    it("stores a meal's photos in order, counts them on the row, and scopes every read", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      const m = meal(a);
      await s.insertMeal(m);
      await s.putPhotos(a, m.id, [{ mime: "image/jpeg", bytes: jpeg(1) }, { mime: "image/png", bytes: jpeg(2) }]);

      const got = await s.getPhotos(a, m.id);
      expect(got.map((p) => p.position)).toEqual([0, 1]);
      expect(got[0]!.mime).toBe("image/jpeg");
      expect(Array.from(got[1]!.bytes)).toEqual(Array.from(jpeg(2)));
      expect((await s.getPhoto(a, m.id, 1))?.mime).toBe("image/png");
      expect((await s.getMeal(a, m.id))?.photos).toBe(2);

      expect(await s.getPhotos(b, m.id)).toEqual([]);
      expect(await s.getPhoto(b, m.id, 0)).toBeNull();
      expect(await s.getPhoto(a, m.id, 2)).toBeNull();
    });

    it("writes nothing for a meal that is not the caller's", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      const m = meal(a);
      await s.insertMeal(m);
      await s.putPhotos(b, m.id, [{ mime: "image/jpeg", bytes: jpeg(1) }]);
      expect(await s.getPhotos(a, m.id)).toEqual([]);
      expect((await s.getMeal(a, m.id))?.photos ?? 0).toBe(0);
    });

    it("is idempotent per position: a second write changes neither the count nor the bytes", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const m = meal(a);
      await s.insertMeal(m);
      await s.putPhotos(a, m.id, [{ mime: "image/jpeg", bytes: jpeg(1) }]);
      await s.putPhotos(a, m.id, [{ mime: "image/jpeg", bytes: jpeg(9) }]);
      const got = await s.getPhotos(a, m.id);
      expect(got.length).toBe(1);
      expect(Array.from(got[0]!.bytes)).toEqual(Array.from(jpeg(1)));
      expect((await s.getMeal(a, m.id))?.photos).toBe(1);
    });

    it("appends another angle AFTER the ones a meal holds, and is scoped like every other write", async () => {
      // #304: the pending screen's second photo cannot join the request already on the wire, so it
      // arrives after the card. `putPhotos` numbers from 0 and is idempotent per position, so it
      // silently does nothing here — this is the other operation, and it is not idempotent by
      // design: two photos of one plate mean two rows.
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      const m = meal(a);
      await s.insertMeal(m);
      await s.putPhotos(a, m.id, [{ mime: "image/jpeg", bytes: jpeg(1) }]);

      expect(await s.appendPhotos(a, m.id, [{ mime: "image/png", bytes: jpeg(2) }])).toBe(2);
      const got = await s.getPhotos(a, m.id);
      expect(got.map((p) => p.position)).toEqual([0, 1]);
      expect(got[1]!.mime).toBe("image/png");
      expect(Array.from(got[0]!.bytes)).toEqual(Array.from(jpeg(1)));
      expect((await s.getMeal(a, m.id))?.photos).toBe(2);

      // Appending again keeps going rather than overwriting: this is the non-idempotent one.
      expect(await s.appendPhotos(a, m.id, [{ mime: "image/jpeg", bytes: jpeg(3) }])).toBe(3);
      expect((await s.getPhotos(a, m.id)).map((p) => p.position)).toEqual([0, 1, 2]);

      // Another account's meal id writes nothing and says so with 0.
      expect(await s.appendPhotos(b, m.id, [{ mime: "image/jpeg", bytes: jpeg(4) }])).toBe(0);
      expect((await s.getMeal(a, m.id))?.photos).toBe(3);
      expect(await s.appendPhotos(a, "no-such-meal", [{ mime: "image/jpeg", bytes: jpeg(4) }])).toBe(0);
    });

    it("erases photos with the account and moves them with a merge", async () => {
      const s = await open();
      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      const m = meal(anon);
      await s.insertMeal(m);
      await s.putPhotos(anon, m.id, [{ mime: "image/jpeg", bytes: jpeg(3) }]);

      await s.mergeUsers(anon, real);
      expect((await s.getPhotos(real, m.id)).length).toBe(1);
      expect(await s.getPhotos(anon, m.id)).toEqual([]);

      await s.deleteUser(real);
      expect(await s.getPhotos(real, m.id)).toEqual([]);
      expect(await s.getPhoto(real, m.id, 0)).toBeNull();
    });

    // ── Push tokens ────────────────────────────────────────────────────────────────────────
    //
    // One row per DEVICE, keyed on the token itself. A token is an installation, not an account:
    // the same phone signing into a second account must move it, or the evening sweep keeps
    // pushing one person's day to somebody else's lock screen.

    it("registers a push token, reads it back, and is idempotent about it", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const token = `ExponentPushToken[${RUN}-idem]`;
      await s.putPushToken(userId, token, "ios");
      await s.putPushToken(userId, token, "ios");
      expect(await s.pushTokensFor(userId)).toEqual([{ token, platform: "ios" }]);
    });

    it("scopes tokens to their owner", async () => {
      const s = await open();
      const mine = (await s.upsertDeviceUser(device(), "en")).userId;
      const theirs = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.putPushToken(theirs, `ExponentPushToken[${RUN}-theirs]`, "ios");
      expect(await s.pushTokensFor(mine)).toEqual([]);
    });

    it("moves a token to the account that registered it last", async () => {
      const s = await open();
      const first = (await s.upsertDeviceUser(device(), "en")).userId;
      const second = (await s.upsertDeviceUser(device(), "en")).userId;
      const token = `ExponentPushToken[${RUN}-handover]`;
      await s.putPushToken(first, token, "ios");
      await s.putPushToken(second, token, "ios");
      expect(await s.pushTokensFor(first)).toEqual([]);
      expect(await s.pushTokensFor(second)).toEqual([{ token, platform: "ios" }]);
    });

    it("drops a token, and refuses to drop one that is not this account's", async () => {
      const s = await open();
      const mine = (await s.upsertDeviceUser(device(), "en")).userId;
      const theirs = (await s.upsertDeviceUser(device(), "en")).userId;
      const token = `ExponentPushToken[${RUN}-drop]`;
      await s.putPushToken(theirs, token, "ios");
      expect(await s.dropPushToken(mine, token)).toBe(false);
      expect(await s.pushTokensFor(theirs)).toHaveLength(1);
      expect(await s.dropPushToken(theirs, token)).toBe(true);
      expect(await s.dropPushToken(theirs, token)).toBe(false);
      expect(await s.pushTokensFor(theirs)).toEqual([]);
    });

    it("lists the accounts the evening sweep has to visit, once each", async () => {
      const s = await open();
      const withToken = (await s.upsertDeviceUser(device(), "en")).userId;
      const without = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.putPushToken(withToken, `ExponentPushToken[${RUN}-sweep-a]`, "ios");
      await s.putPushToken(withToken, `ExponentPushToken[${RUN}-sweep-b]`, "ios");
      const users = await s.usersWithPushTokens();
      expect(users.filter((u) => u === withToken)).toEqual([withToken]);
      expect(users).not.toContain(without);
    });

    it("MOVES a device to the account an anonymous session merged into", async () => {
      const s = await open();
      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      const token = `ExponentPushToken[${RUN}-merged]`;
      await s.putPushToken(anon, token, "ios");

      await s.mergeUsers(anon, real);

      // The same physical phone, and the person is now signed into the real account. A push token
      // is a device ADDRESS, not a credential — unlike the bearer tokens above it, which are
      // deleted precisely because moving one would let a signed-out session back in. Deleting this
      // instead would cost the user their evening line until their next launch; leaving it on the
      // dead account would send it to a phone whose owner is now somebody else.
      expect(await s.pushTokensFor(real)).toEqual([{ token, platform: "ios" }]);
      expect(await s.pushTokensFor(anon)).toEqual([]);
      expect(await s.usersWithPushTokens()).not.toContain(anon);
    });

    it("erases push tokens when removing the last identity deletes the account", async () => {
      const s = await open();
      const deviceId = device();
      const { userId } = await s.upsertDeviceUser(deviceId, "en");
      await s.putPushToken(userId, `ExponentPushToken[${RUN}-revoked]`, "ios");

      // The path Apple's server-to-server notification drives: removing the LAST identity erases
      // the account. It shares `eraseUser` with `deleteUser`, which is why the push sweep lives in
      // there rather than beside the one caller that came first — an account erased this way must
      // not leave behind a device this server would go on pushing to every night.
      expect(await s.removeIdentity(userId, "device", deviceId)).toBe("account-deleted");
      expect(await s.pushTokensFor(userId)).toEqual([]);
      expect(await s.usersWithPushTokens()).not.toContain(userId);
    });

    it("erases push tokens with the account", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      await s.putPushToken(userId, `ExponentPushToken[${RUN}-erased]`, "ios");
      await s.deleteUser(userId);
      expect(await s.pushTokensFor(userId)).toEqual([]);
      expect(await s.usersWithPushTokens()).not.toContain(userId);
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

    it("inserts a meal once: a second insert with the same id is refused, not duplicated", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const m = meal(u);
      expect(await s.insertMeal(m)).toBe(true);
      expect(await s.insertMeal({ ...m, kcal: 1 })).toBe(false);
      expect((await s.getMeal(u, m.id))!.kcal).toBe(260);
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

    it("keeps the chat in order, scoped, newest page first", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.appendChat(a, [
        { role: "user", kind: "text", text: "hi", clientId: "phone-1", pendingId: "0b0a3f3e-2c3a-4d4e-9f1a-1c2d3e4f5a6b" },
        { role: "assistant", kind: "text", text: "hello" },
        { role: "user", kind: "photo", text: null },
      ]);
      await s.appendChat(b, [{ role: "user", kind: "text", text: "not yours" }]);

      const page = await s.chatBefore(a, null, 2);
      expect(page.map((m) => m.kind)).toEqual(["photo", "text"]); // newest first
      expect(page[0]!.seq).toBeGreaterThan(page[1]!.seq);
      const older = await s.chatBefore(a, page[1]!.seq, 2);
      expect(older.map((m) => m.text)).toEqual(["hi"]);
      expect(older[0]!.clientId).toBe("phone-1");
      // The proposal's id rides on the line too: it is what "was this proposal logged" reads.
      expect(older[0]!.pendingId).toBe("0b0a3f3e-2c3a-4d4e-9f1a-1c2d3e4f5a6b");
      expect(page[1]!.clientId).toBeNull();
      expect(await s.chatBefore(b, null, 10)).toHaveLength(1);
      expect((await s.chatBefore(b, null, 10))[0]!.userId).toBe(b);
      // A page is a copy. Mutating it must not reach the store — Postgres could never do that.
      page[0]!.text = "tampered";
      expect((await s.chatBefore(a, null, 1))[0]!.text).toBeNull();
    });

    it("keeps who spoke an assistant line, and Spud is the default", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.appendChat(u, [
        { role: "assistant", kind: "text", text: "Hi, I'm Gabie.", speaker: "gabie" },
        { role: "assistant", kind: "text", text: "Logged." },
        { role: "user", kind: "text", text: "thanks" },
      ]);
      expect((await s.chatBefore(u, null, 3)).map((m) => m.speaker)).toEqual([null, null, "gabie"]);
    });

    // #486. Nullable and never invented: a line no router read has no intent, and a line code wrote
    // has no model — so "null" means "nothing produced this", never "we forgot".
    it("keeps how a line was produced: the router's intent on the words, the model on the reply", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.appendChat(u, [
        { role: "user", kind: "text", text: "how is my week?", intent: "answer" },
        { role: "assistant", kind: "text", text: "Fine.", speaker: "gabie", model: "x-ai/grok-4.6" },
        { role: "assistant", kind: "text", text: "Logged." },
        { role: "user", kind: "text", text: "thanks" },
      ]);
      const lines = (await s.chatBefore(u, null, 4)).reverse();
      expect(lines.map((m) => [m.intent, m.model])).toEqual([
        ["answer", null], [null, "x-ai/grok-4.6"], [null, null], [null, null],
      ]);
    });

    // #525. The line that opened a charged turn names the analysis that paid for it, and the cost
    // is read back through that id — scoped, so another account's analysis is never a row here, and
    // a refunded one is simply absent rather than a zero.
    it("links the line that opened a charged turn to its analysis, and reads the cost through it", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      const typed = await s.recordAnalysis(a, RUN_DATE, "text");
      const snapped = await s.recordAnalysis(a, RUN_DATE, "photo");
      const refunded = await s.recordAnalysis(a, RUN_DATE, "photo");
      const theirs = await s.recordAnalysis(b, RUN_DATE, "text");
      await s.addCost(a, typed, 0.25);
      await s.addCost(a, snapped, 0.5);
      await s.addCost(a, snapped, null);
      expect(await s.undoAnalysis(a, refunded)).toBe(true);
      await s.appendChat(a, [
        { role: "user", kind: "text", text: "how is my week?", analysisId: typed },
        { role: "assistant", kind: "text", text: "Fine." },
        { role: "user", kind: "photo", text: null, analysisId: snapped },
        { role: "user", kind: "text", text: "typed during onboarding" },
      ]);
      const lines = (await s.chatBefore(a, null, 4)).reverse();
      expect(lines.map((m) => m.analysisId)).toEqual([typed, null, snapped, null]);

      const costs = await s.analysisCosts(a, [typed, snapped, refunded, theirs]);
      expect(costs.sort((x, y) => Number(x.id) - Number(y.id))).toEqual([
        { id: typed, costUsd: 0.25, unpricedCalls: 0 },
        { id: snapped, costUsd: 0.5, unpricedCalls: 1 },
      ]);
      expect(await s.analysisCosts(b, [typed])).toEqual([]);
      expect(await s.analysisCosts(a, [])).toEqual([]);
    });

    it("hands out the first verdict exactly once per account", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      expect(await s.claimFirstVerdict(a)).toBe(true);
      expect(await s.claimFirstVerdict(a)).toBe(false);
      expect(await s.claimFirstVerdict(b)).toBe(true);
      // Released when the greeting could not be written: the next meal may take it again.
      await s.releaseFirstVerdict(a);
      expect(await s.claimFirstVerdict(a)).toBe(true);
    });

    it("carries the first-verdict claim through an anonymous → real merge", async () => {
      const s = await open();
      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      expect(await s.claimFirstVerdict(anon)).toBe(true);
      await s.mergeUsers(anon, real);
      expect(await s.claimFirstVerdict(real)).toBe(false);
    });

    it("sweeps expired proposals, which carry the user's words", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const live = { id: crypto.randomUUID(), userId: u, analysis: meal(u), date: "2026-08-01", expiresAt: Date.now() + 60_000 };
      const dead = { ...live, id: crypto.randomUUID(), expiresAt: Date.now() - 1_000 };
      await s.putPending(live);
      await s.putPending(dead);
      expect(await s.pruneExpiredPendings()).toBeGreaterThanOrEqual(1);
      expect((await s.getPending(u, live.id))?.id).toBe(live.id);
      expect(await s.pruneExpiredPendings()).toBe(0);
    });

    it("counts the thread per account", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.appendChat(a, [{ role: "user", kind: "text", text: "one" }, { role: "assistant", kind: "text", text: "two" }]);
      expect(await s.countUserChat(a)).toBe(2);
      expect(await s.countUserChat((await s.upsertDeviceUser(device(), "en")).userId)).toBe(0);
    });

    it("erases the thread with the account", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.appendChat(u, [{ role: "user", kind: "text", text: "my kidneys" }]);
      await s.deleteUser(u);
      expect(await s.chatBefore(u, null, 10)).toEqual([]);
    });

    it("reads several meals at once, scoped, in one call", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      const m1 = meal(a); const m2 = meal(a); const theirs = meal(b);
      await s.insertMeal(m1); await s.insertMeal(m2); await s.insertMeal(theirs);
      const got = await s.getMeals(a, [m1.id, theirs.id, m2.id, crypto.randomUUID()]);
      expect(got.map((m) => m.id).sort()).toEqual([m1.id, m2.id].sort());
      expect(await s.getMeals(a, [])).toEqual([]);
    });

    it("moves the chat with an anonymous → real merge", async () => {
      const s = await open();
      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.appendChat(anon, [{ role: "user", kind: "text", text: "before signing in" }]);
      await s.mergeUsers(anon, real);
      expect((await s.chatBefore(real, null, 10)).map((m) => m.text)).toEqual(["before signing in"]);
      expect(await s.chatBefore(anon, null, 10)).toEqual([]);
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

    // #608. Lines by id, scoped; a delete takes exactly what the engine asked for and nothing else.
    describe("lines by id", () => {
      const user = async () => (await (await open()).upsertDeviceUser(device(), "en")).userId;
      const lines = async (u: string) => (await (await open()).chatBefore(u, null, 50)).reverse();

      it("reads a line by id for its owner only", async () => {
        const s = await open();
        const u = await user(); const other = await user();
        await s.appendChat(u, [{ role: "user", kind: "text", text: "hi" }]);
        const [l] = await lines(u);
        expect((await s.getLine(u, l!.id))?.text).toBe("hi");
        expect(await s.getLine(other, l!.id)).toBeNull();
        expect(await s.getLine(u, "not-a-uuid")).toBeNull();
      });

      it("finds the photo line of a meal", async () => {
        const s = await open();
        const u = await user(); const other = await user();
        const m = meal(u); await s.insertMeal(m);
        await s.appendChat(u, [
          { role: "user", kind: "photo", text: "rice", mealId: m.id },
          { role: "assistant", kind: "meal", mealId: m.id, event: "logged" },
        ]);
        expect((await s.photoLineFor(u, m.id))?.text).toBe("rice");
        expect(await s.photoLineFor(u, crypto.randomUUID())).toBeNull();
        expect(await s.photoLineFor(other, m.id)).toBeNull();
      });

      it("deletes one line, for its owner only", async () => {
        const s = await open();
        const u = await user(); const other = await user();
        await s.appendChat(u, [{ role: "user", kind: "text", text: "a" }, { role: "user", kind: "text", text: "b" }]);
        const [a] = await lines(u);
        expect(await s.deleteLine(other, a!.id)).toBe(false);
        expect(await s.deleteLine(u, a!.id)).toBe(true);
        expect(await s.deleteLine(u, a!.id)).toBe(false);
        expect((await lines(u)).map((l) => l.text)).toEqual(["b"]);
      });

      it("deletes every card of a meal and no other line", async () => {
        const s = await open();
        const u = await user(); const other = await user();
        const m = meal(u); const n = meal(u); await s.insertMeal(m); await s.insertMeal(n);
        const om = meal(other); await s.insertMeal(om);
        await s.appendChat(u, [
          { role: "user", kind: "photo", text: null, mealId: m.id },
          { role: "assistant", kind: "meal", mealId: m.id, event: "logged" },
          { role: "user", kind: "text", text: "half that" },
          { role: "assistant", kind: "meal", mealId: m.id, event: "updated" },
          { role: "assistant", kind: "meal", mealId: n.id, event: "logged" },
        ]);
        await s.appendChat(other, [
          { role: "user", kind: "photo", text: null, mealId: om.id },
          { role: "assistant", kind: "meal", mealId: om.id, event: "logged" },
        ]);
        expect(await s.deleteMealLines(other, m.id)).toBe(0);
        expect(await s.deleteMealLines(u, m.id)).toBe(2);
        expect((await lines(u)).map((l) => [l.kind, l.mealId])).toEqual([["photo", m.id], ["text", null], ["meal", n.id]]);
        expect((await lines(other)).map((l) => [l.kind, l.mealId])).toEqual([["photo", om.id], ["meal", om.id]]);
      });

      it("replaces a line's text, for its owner only", async () => {
        const s = await open();
        const u = await user(); const other = await user();
        const m = meal(u); await s.insertMeal(m);
        await s.appendChat(u, [{ role: "user", kind: "photo", text: "rice", mealId: m.id }]);
        const [l] = await lines(u);
        expect(await s.updateLineText(other, l!.id, "x")).toBe(false);
        expect(await s.updateLineText(u, l!.id, "rice, and an egg")).toBe(true);
        expect((await s.getLine(u, l!.id))?.text).toBe("rice, and an egg");
        expect(await s.updateLineText(u, l!.id, null)).toBe(true);
        expect((await s.getLine(u, l!.id))?.text).toBeNull();
      });

      it("deletes a meal with its photos, for its owner only", async () => {
        const s = await open();
        const u = await user(); const other = await user();
        const m = meal(u); await s.insertMeal(m);
        await s.putPhotos(u, m.id, [{ mime: "image/jpeg", bytes: new Uint8Array([0xff, 0xd8, 1]) }]);
        expect(await s.deleteMeal(other, m.id)).toBe(false);
        expect(await s.getMeal(u, m.id)).not.toBeNull();
        expect(await s.deleteMeal(u, m.id)).toBe(true);
        expect(await s.getMeal(u, m.id)).toBeNull();
        expect(await s.getPhotos(u, m.id)).toEqual([]);
        expect(await s.deleteMeal(u, m.id)).toBe(false);
      });
    });

    it("holds the question asked about a meal, and lets one write clear it", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const asked = meal(u, { question: { text: "Cooked in oil, or dry?", options: ["In oil", "Dry"] } });
      await s.insertMeal(asked);
      expect((await s.getMeal(u, asked.id))!.question).toEqual(asked.question!);
      // One question per meal, asked once: the correction that answers it carries `question: null`
      // in the same patch that changes the numbers, so a re-render cannot offer the chips again.
      expect((await s.updateMeal(u, asked.id, { question: null }))!.question).toBeNull();
      expect((await s.getMeal(u, asked.id))!.question).toBeNull();
      // Nothing asked reads back as nothing — null on both, never absent on one and null on the
      // other, because that difference is a key the app sees on one deployment and not the other.
      const plain = meal(u);
      await s.insertMeal(plain);
      expect((await s.getMeal(u, plain.id))!.question).toBeNull();
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

    it("lists the meals in a window, newest first, bounded, and only this user's", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const other = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.insertMeal(meal(u, { date: "2026-08-01", ts: "2026-08-01T08:00:00.000Z", kcal: 1 }));
      await s.insertMeal(meal(u, { date: "2026-08-01", ts: "2026-08-01T13:00:00.000Z", kcal: 2 }));
      await s.insertMeal(meal(u, { date: "2026-07-30", ts: "2026-07-30T13:00:00.000Z", kcal: 3 }));
      await s.insertMeal(meal(u, { date: "2026-08-03", ts: "2026-08-03T13:00:00.000Z", kcal: 4 }));
      await s.insertMeal(meal(other, { date: "2026-08-01", kcal: 99 }));
      // Both ends inclusive; the day after the window is out, the day before it is out.
      const rows = await s.mealsSince(u, "2026-07-31", "2026-08-02", 10);
      expect(rows.map((m) => m.kcal)).toEqual([2, 1]);
      // The bound keeps the NEWEST, because "what did I eat lately" is what the window is asked for.
      const all = await s.mealsSince(u, "2026-07-01", "2026-08-31", 2);
      expect(all.map((m) => m.kcal)).toEqual([4, 2]);
      expect(await s.mealsSince(other, "2026-07-01", "2026-08-31", 10)).toHaveLength(1);
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

    it("lists an account's live proposals, oldest first, and nobody else's (#530)", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const other = (await s.upsertDeviceUser(device(), "en")).userId;
      const first = { id: crypto.randomUUID(), userId: u, analysis: meal(u), date: "2026-08-01", expiresAt: Date.now() + 60_000 };
      const second = { ...first, id: crypto.randomUUID(), expiresAt: Date.now() + 120_000 };
      const dead = { ...first, id: crypto.randomUUID(), expiresAt: Date.now() - 1_000 };
      const theirs = { ...first, id: crypto.randomUUID(), userId: other };
      for (const p of [second, dead, theirs, first]) await s.putPending(p);
      const mine = await s.pendingsFor(u);
      expect(mine.map((p) => p.id)).toEqual([first.id, second.id]);
      expect(mine[0]!.analysis).toEqual(first.analysis);
      // A claimed proposal is no longer offered.
      expect(await s.dropPending(u, first.id)).toBe(true);
      expect((await s.pendingsFor(u)).map((p) => p.id)).toEqual([second.id]);
      expect((await s.pendingsFor(other)).map((p) => p.id)).toEqual([theirs.id]);
    });

    it("answers an id that is not a uuid as absent, never as an error, in both implementations", async () => {
      // A client-supplied id reaches these four; Postgres would refuse a non-uuid at the column and
      // turn a 404-shaped question into a 500 — after the analysis was charged, on `/v1/messages`.
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      expect(await s.getMeal(u, "not-a-uuid")).toBeNull();
      expect(await s.updateMeal(u, "not-a-uuid", { kcal: 1 })).toBeNull();
      expect(await s.getPending(u, "not-a-uuid")).toBeNull();
      expect(await s.dropPending(u, "not-a-uuid")).toBe(false);
    });

    it("drops a pending once: the first drop says so, a second one says it was already gone", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const other = (await s.upsertDeviceUser(device(), "en")).userId;
      const live = { id: crypto.randomUUID(), userId: u, analysis: meal(u), date: "2026-08-01", expiresAt: Date.now() + 60_000 };
      await s.putPending(live);
      expect(await s.dropPending(other, live.id)).toBe(false);
      expect(await s.dropPending(u, live.id)).toBe(true);
      expect(await s.dropPending(u, live.id)).toBe(false);
      // An expired row cannot be claimed either: a "no" to a proposal that timed out is not a cancel.
      const dead = { ...live, id: crypto.randomUUID(), expiresAt: Date.now() - 1_000 };
      await s.putPending(dead);
      expect(await s.dropPending(u, dead.id)).toBe(false);
    });

    it("counts photo analyses per user but every analysis globally", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      // A delta, not an absolute: the Postgres suite runs against a database other runs have used.
      const before = await s.countGlobalAnalyses(RUN_DATE);
      await s.recordAnalysis(a, RUN_DATE, "photo");
      await s.recordAnalysis(a, RUN_DATE, "text");
      await s.recordAnalysis(b, RUN_DATE, "photo");
      expect(await s.countUserPhotos(a, RUN_DATE)).toBe(1); // text excluded
      // Lifetime, both scopes, every date: the sample is spent by whichever came first.
      expect(await s.countUserAnalyses(a)).toBe(2);
      await s.recordAnalysis(a, "2020-01-01", "photo");
      expect(await s.countUserAnalyses(a)).toBe(3);
      expect(await s.countUserAnalyses(b)).toBe(1);
      expect(await s.countGlobalAnalyses(RUN_DATE)).toBe(before + 3);
    });

    it("gives back the analysis it is named, once, and never another account's", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      const refused = await s.recordAnalysis(a, RUN_DATE, "photo");
      const concurrent = await s.recordAnalysis(a, RUN_DATE, "photo");
      const theirs = await s.recordAnalysis(b, RUN_DATE, "photo");
      await s.addCost(a, concurrent, 0.5);
      expect(await s.undoAnalysis(b, refused)).toBe(false);
      expect(await s.undoAnalysis(a, theirs)).toBe(false);
      expect(await s.undoAnalysis(a, refused)).toBe(true);
      expect(await s.analysisCosts(a, [refused, concurrent])).toEqual([{ id: concurrent, costUsd: 0.5, unpricedCalls: 0 }]);
      expect(await s.countUserAnalyses(b)).toBe(1);
      expect(await s.undoAnalysis(a, refused)).toBe(false);
      expect(await s.countUserAnalyses(a)).toBe(1);
    });

    // #484. One charge pays for several calls, so what the provider reported for each is ADDED to
    // the analysis — and a call that ended without a price is counted, so a day's sum reads as the
    // floor it is rather than as the bill.
    it("adds what each call cost to the analysis that paid for it, scoped by account", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      const day = async () => (await s.adminMetrics({ days: 1, today: RUN_DATE, timezone: "UTC" })).days[0]!;
      const before = await day();

      const whole = await s.recordAnalysis(a, RUN_DATE, "text");
      const floor = await s.recordAnalysis(a, RUN_DATE, "photo");
      await s.recordAnalysis(b, RUN_DATE, "photo");
      expect(await s.addCost(a, whole, 0.25)).toBe(true);
      expect(await s.addCost(a, whole, 0.5)).toBe(true);
      expect(await s.addCost(a, floor, 0.125)).toBe(true);
      expect(await s.addCost(a, floor, null)).toBe(true);
      // Another account's analysis is not a row this account can write to.
      expect(await s.addCost(b, whole, 100)).toBe(false);
      expect(await s.addCost(b, whole, null)).toBe(false);

      const after = await day();
      expect(after.analyses - before.analyses).toBe(3);
      expect((after.costUsd ?? 0) - (before.costUsd ?? 0)).toBeCloseTo(0.875, 9);
      // `floor` and b's never-reported one. `whole` is known to the last call.
      expect(after.unpriced - before.unpriced).toBe(2);
    });

    it("reports a day with no priced analysis as unknown, never as free", async () => {
      const s = await open();
      const [d] = (await s.adminMetrics({ days: 1, today: "2019-03-03", timezone: "UTC" })).days;
      expect(d!.costUsd).toBeNull();
      expect(d!.unpriced).toBe(0);
    });

    // ── identities ────────────────────────────────────────────────────────────────────────────

    it("links an identity and finds the account behind it", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(u, "apple", subject("apple-sub"));
      expect(await s.userIdForIdentity("apple", subject("apple-sub"))).toBe(u);
      expect(await s.userIdForIdentity("google", subject("apple-sub"))).toBeNull(); // separate namespaces
    });

    // The Telegram connector's identity: the numeric `from.id` as a string, and nothing else.
    it("drops a telegram link with the rest of the merged-away account's identities", async () => {
      // A merge moves the DATA and repoints no credential: a device identity dropped rather than
      // repointed is the rule, and a telegram link is the same kind of thing — whoever holds that
      // Telegram would otherwise be handed the real account the anonymous one merged into.
      const s = await open();
      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = await s.createUser("en");
      await s.addIdentity(real, "apple", subject("merge-target"));
      const tg = String(5_000_000_000 + Math.floor(Math.random() * 1_000_000_000));
      await s.moveIdentity(anon, "telegram", tg);

      await s.mergeUsers(anon, real);
      expect(await s.userIdForIdentity("telegram", tg)).toBeNull();
      expect((await s.listIdentities(real)).map((i) => i.provider)).toEqual(["apple"]);
    });

    it("links a Telegram id like any other identity, in a namespace of its own", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const other = (await s.upsertDeviceUser(device(), "en")).userId;
      const id = String(1_000_000_000 + Math.floor(Math.random() * 1_000_000_000));
      await s.addIdentity(u, "telegram", id);
      expect(await s.userIdForIdentity("telegram", id)).toBe(u);
      expect(await s.userIdForIdentity("apple", id)).toBeNull();
      expect((await s.listIdentities(u)).map((i) => i.provider)).toContain("telegram");
      expect(s.addIdentity(other, "telegram", id)).rejects.toThrow();
    });

    // #205's `telegram` provider is a TRANSPORT, not a way in: nothing about it can put somebody
    // into an account. So it must not count as one when the last sign-in identity is removed.
    it("dies with its last SIGN-IN identity, and takes a telegram row with it", async () => {
      const s = await open();
      const web = await s.createUser("en");               // a /start sign-up: no device identity
      const tg = String(3_000_000_000 + Math.floor(Math.random() * 1_000_000_000));
      await s.addIdentity(web, "google", subject("only-way-in"));
      await s.moveIdentity(web, "telegram", tg);

      expect(await s.removeIdentity(web, "google", subject("only-way-in"))).toBe("account-deleted");
      expect(await s.getProfile(web)).toBeNull();
      // The transport goes with the account it served. Left behind, it is a row naming a user that
      // no longer exists — and, before this rule, an account nobody could sign into, pair to, or erase.
      expect(await s.userIdForIdentity("telegram", tg)).toBeNull();
    });

    it("survives while any sign-in identity is left, telegram or not", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const tg = String(4_000_000_000 + Math.floor(Math.random() * 1_000_000_000));
      await s.addIdentity(u, "google", subject("second-way-in"));
      await s.moveIdentity(u, "telegram", tg);

      expect(await s.removeIdentity(u, "google", subject("second-way-in"))).toBe("removed");
      expect(await s.getProfile(u)).not.toBeNull();
      expect(await s.userIdForIdentity("telegram", tg)).toBe(u);
    });

    it("moves a claimed identity to the account that claimed it, and erases nothing on the way", async () => {
      // The recovery path for a Telegram link made with somebody else's pairing code: the id moves,
      // and the account it moves OFF keeps everything, even when that identity was its last way in.
      const s = await open();
      const from = (await s.upsertDeviceUser(device(), "en")).userId;
      const to = (await s.upsertDeviceUser(device(), "en")).userId;
      const id = String(1_000_000_000 + Math.floor(Math.random() * 1_000_000_000));

      expect(await s.moveIdentity(to, "telegram", id)).toBe("linked");
      expect(await s.moveIdentity(to, "telegram", id)).toBe("linked"); // the same pair again: nothing to move
      await s.addIdentity(from, "apple", subject("mover"));

      // Onto the other account, with the old one still there, still holding its own identity.
      expect(await s.moveIdentity(from, "telegram", id)).toBe("moved");
      expect(await s.userIdForIdentity("telegram", id)).toBe(from);
      expect((await s.listIdentities(to)).map((i) => i.provider)).toEqual(["device"]);
      expect(await s.getProfile(to)).not.toBeNull();

      // And back, as often as the person who holds that Telegram wants. A move never deletes the
      // account it comes off — and there is no longer an account for which a telegram row is the
      // last identity, because `removeIdentity` takes the account with the last SIGN-IN one.
      expect(await s.moveIdentity(to, "telegram", id)).toBe("moved");
      expect(await s.getProfile(from)).not.toBeNull();
    });

    it("gives back the subject it holds at one provider, and only to that account", async () => {
      const s2 = await open();
      const { userId } = await s2.upsertDeviceUser(device(), "en");
      const other = (await s2.upsertDeviceUser(device(), "en")).userId;
      const sub = subject("unlink-me");
      await s2.addIdentity(userId, "google", sub);

      expect(await s2.identitySubject(userId, "google")).toBe(sub);
      // Scoped like every other read: another account's link is not this account's business, and
      // the unlink route hands whatever comes back to `removeIdentity`.
      expect(await s2.identitySubject(other, "google")).toBeNull();
      expect(await s2.identitySubject(userId, "apple")).toBeNull();
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

    it("reports when an identity was linked, alongside the account it belongs to", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const before = Date.now();
      await s.addIdentity(u, "apple", subject("dated"));

      const found = await s.identityFor("apple", subject("dated"));
      expect(found?.userId).toBe(u);
      // The link time is what tells a revocation whether it predates the link it names.
      expect(Date.parse(found?.linkedAt ?? "")).toBeGreaterThanOrEqual(before - 1000);
      expect(await s.identityFor("apple", subject("never-linked"))).toBeNull();
    });

    it("stores the address against the identity that carried it", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(u, "apple", subject("mail"));
      expect((await s.identityFor("apple", subject("mail")))?.email).toBeNull();

      await s.setIdentityEmail(u, "apple", subject("mail"), "a@example.com");
      expect((await s.identityFor("apple", subject("mail")))?.email).toBe("a@example.com");
    });

    it("hands back one address for the account, the oldest that has one", async () => {
      // `/start` reads this to guess a country before it asks for one (#365). Two identities is the
      // ordinary shape of an account that signed in twice, and Apple's relay means the one with an
      // address is often not the first one linked — so "the oldest that HAS one" is the rule, and
      // an account with none answers null rather than throwing.
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      expect(await s.emailForUser(u)).toBeNull();

      await s.addIdentity(u, "apple", subject("relay"));
      expect(await s.emailForUser(u)).toBeNull();

      await s.addIdentity(u, "google", subject("addressed"));
      await s.setIdentityEmail(u, "google", subject("addressed"), "someone@gmx.de");
      expect(await s.emailForUser(u)).toBe("someone@gmx.de");

      // Another account's address is another account's, on the one lookup whose whole purpose is
      // to read a stranger's personal data if it is scoped wrong.
      const other = (await s.upsertDeviceUser(device(), "en")).userId;
      expect(await s.emailForUser(other)).toBeNull();
    });

    it("lets a later address replace the one stored", async () => {
      // Google sends an address in EVERY token, so a changed one catches up on the next sign-in.
      // The other half of that rule — an ABSENT address must never overwrite a stored one — is not
      // testable here and is not the store's to keep: this port takes no null, and the caller that
      // decides is `signInWithProvider`, where `identity.test.ts` pins it.
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(u, "apple", subject("once"));
      await s.setIdentityEmail(u, "apple", subject("once"), "first@example.com");
      await s.setIdentityEmail(u, "apple", subject("once"), "second@example.com");
      expect((await s.identityFor("apple", subject("once")))?.email).toBe("second@example.com");
    });

    it("never CREATES an identity for a subject nobody has linked", async () => {
      // The rule the other three tests here do not reach, and the one a rewrite would break:
      // "record the address" reads like an upsert, and an upsert would fabricate an identity row
      // whose user id came from a request. Postgres satisfies this because the update matches
      // nothing and the memory store because a find returns undefined — neither is a guarantee
      // until something asserts it on both.
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;

      await s.setIdentityEmail(u, "apple", subject("never-linked-at-all"), "ghost@example.com");

      expect(await s.identityFor("apple", subject("never-linked-at-all"))).toBeNull();
      expect((await s.listIdentities(u)).some((i) => i.provider === "apple")).toBe(false);
    });

    it("refuses to write an address onto another account's identity", async () => {
      // The same scoping rule every other write here follows. The subject arrives from a verified
      // token, but the account is the caller's, and the two must agree.
      const s = await open();
      const mine = (await s.upsertDeviceUser(device(), "en")).userId;
      const theirs = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(theirs, "google", subject("not-mine"));

      await s.setIdentityEmail(mine, "google", subject("not-mine"), "attacker@example.com");
      expect((await s.identityFor("google", subject("not-mine")))?.email).toBeNull();
    });

    it("erases the address with the account", async () => {
      const s = await open();
      const u = await s.createUser("en");
      await s.addIdentity(u, "apple", subject("erased"));
      await s.setIdentityEmail(u, "apple", subject("erased"), "gone@example.com");

      await s.deleteUser(u);
      expect(await s.identityFor("apple", subject("erased"))).toBeNull();
    });

    it("deletes the account in the SAME step when the identity was the last way in", async () => {
      // Not two calls. Two deliveries for one subject interleave between a read and a write, and
      // the account that gets erased is one a device could still have reached.
      const s = await open();
      const alone = await s.createUser("en");
      await s.addIdentity(alone, "apple", subject("last-way-in"));

      expect(await s.removeIdentity(alone, "apple", subject("last-way-in"))).toBe("account-deleted");
      expect(await s.getProfile(alone)).toBeNull();
      expect(await s.userIdForIdentity("apple", subject("last-way-in"))).toBeNull();
    });

    it("restores a device identity row that went missing under the account", async () => {
      // `users.device_id` is what device auth resolves through, and the `identities` row is what
      // "is anything else still linked" counts. They are two writes, so they can disagree — and
      // once they do, revoking Apple deletes an account whose device could still open it. Every
      // device auth re-asserts the row rather than only the first one.
      const s = await open();
      const dev = device();
      const u = (await s.upsertDeviceUser(dev, "en")).userId;
      await s.addIdentity(u, "apple", subject("still-here"));
      expect(await s.removeIdentity(u, "device", dev)).toBe("removed");
      expect((await s.listIdentities(u)).map((i) => i.provider)).toEqual(["apple"]);

      const back = await s.upsertDeviceUser(dev, "en");

      expect(back.userId).toBe(u);
      expect(back.created).toBe(false);
      expect((await s.listIdentities(u)).map((i) => i.provider).sort()).toEqual(["apple", "device"]);
    });

    it("deletes the account when two identities are removed at the same moment", async () => {
      // The other direction of the same race, and the one no serial test can see. Each removal
      // must not conclude "something else is still linked" from a row the other has already
      // deleted: an account left with no identity at all cannot be signed into by any path and
      // cannot be deleted by any path either, so it keeps its owner's medical free text forever.
      const s = await open();
      const u = await s.createUser("en");
      await s.addIdentity(u, "apple", subject("both-at-once-1"));
      await s.addIdentity(u, "apple", subject("both-at-once-2"));

      const outcomes = await Promise.all([
        s.removeIdentity(u, "apple", subject("both-at-once-1")),
        s.removeIdentity(u, "apple", subject("both-at-once-2")),
      ]);

      expect(outcomes.filter((o) => o === "account-deleted")).toHaveLength(1);
      expect(await s.getProfile(u)).toBeNull();
    });

    it("does not touch the account when nothing matched", async () => {
      // The account behind a stranger's id must not be deleted because it happens to have no
      // identity of its own yet — the conditional delete runs only when a row was really removed.
      const s = await open();
      const bare = await s.createUser("en");
      expect(await s.removeIdentity(bare, "apple", subject("not-linked-here"))).toBe("not-found");
      expect(await s.getProfile(bare)).not.toBeNull();
    });

    it("removes ONE identity and leaves the account and its other identities alone", async () => {
      // Sign in with Apple revoked on an account that also has a device: the account survives, the
      // Apple subject is released, and everything the person logged is still theirs.
      const s = await open();
      const dev = device();
      const u = (await s.upsertDeviceUser(dev, "en")).userId;
      await s.addIdentity(u, "apple", subject("revoked-apple"));
      await s.insertMeal(meal(u, { kcal: 444 }));

      expect(await s.removeIdentity(u, "apple", subject("revoked-apple"))).toBe("removed");

      expect(await s.userIdForIdentity("apple", subject("revoked-apple"))).toBeNull();
      expect((await s.listIdentities(u)).map((i) => i.provider)).toEqual(["device"]);
      expect(await s.userIdForIdentity("device", dev)).toBe(u);
      expect(await s.mealsForDate(u, "2026-08-01")).toHaveLength(1);
    });

    it("refuses to remove an identity that belongs to another account", async () => {
      // The scoping rule, on the one write a third party's message can reach. Apple names a
      // subject; the account is resolved FROM that subject, so a removal that ignored `userId`
      // would be a delete keyed on an argument nobody checked.
      const s = await open();
      const owner = (await s.upsertDeviceUser(device(), "en")).userId;
      const stranger = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(owner, "apple", subject("not-yours"));

      expect(await s.removeIdentity(stranger, "apple", subject("not-yours"))).toBe("not-found");

      expect(await s.userIdForIdentity("apple", subject("not-yours"))).toBe(owner);
      expect(await s.getProfile(stranger)).not.toBeNull();
    });

    it("is idempotent when the identity is already gone", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.addIdentity(u, "apple", subject("twice-removed"));
      expect(await s.removeIdentity(u, "apple", subject("twice-removed"))).toBe("removed");
      expect(await s.removeIdentity(u, "apple", subject("twice-removed"))).toBe("not-found");
      expect(await s.userIdForIdentity("apple", subject("twice-removed"))).toBeNull();
    });

    it("revokes every session of one account and nobody else's", async () => {
      // Revoking Sign in with Apple is a sign-out everywhere, which means every device — so this
      // is the whole account's tokens, not the one that happens to be in front of us.
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const other = (await s.upsertDeviceUser(device(), "en")).userId;
      const phone = await s.issueToken(u);
      const tablet = await s.issueToken(u);
      const untouched = await s.issueToken(other);

      await s.revokeTokensFor(u);

      expect(await s.userIdForToken(phone)).toBeNull();
      expect(await s.userIdForToken(tablet)).toBeNull();
      expect(await s.userIdForToken(untouched)).toBe(other);
      // The account itself is untouched — this is a sign-out, not an erasure.
      expect(await s.getProfile(u)).not.toBeNull();
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

    // ── Portion corrections ────────────────────────────────────────────────────────────────
    //
    // The prior these produce is fed to the analyzer and is allowed to change its grams, so a
    // divergence between the implementations is a difference in the numbers a user is shown. The
    // median is the part most likely to drift — `percentile_cont` interpolates and a reducer that
    // took the lower of two middles would not — which is why neither store computes it in its own
    // idiom and both hand their rows to `portionPriorsFrom`.

    it("learns a portion prior as the median of a food's corrected ratios", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      await s.recordPortionCorrections(userId, [
        { name_en: "rice", grams_before: 100, grams_after: 125 },
        { name_en: "rice", grams_before: 200, grams_after: 300 },
      ]);
      // A second edit, so the rows do not all arrive in one call.
      await s.recordPortionCorrections(userId, [
        { name_en: "rice", grams_before: 100, grams_after: 175 },
        { name_en: "rice", grams_before: 100, grams_after: 200 },
      ]);
      // 1.25, 1.5, 1.75, 2 — an even sample, so the answer is the mean of the two middles and not
      // either of them. Every ratio here is exact in binary on purpose: this asserts the rule, not
      // the last bit of a float.
      expect(await s.portionPriors(userId)).toEqual([{ name: "rice", ratio: 1.625, n: 4 }]);
    });

    it("keeps a food out of the prior until it has been corrected enough times", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      await s.recordPortionCorrections(userId, [
        { name_en: "bread", grams_before: 100, grams_after: 150 },
        { name_en: "bread", grams_before: 100, grams_after: 150 },
      ]);
      // Two corrections is one afternoon, not a habit.
      expect(await s.portionPriors(userId)).toEqual([]);
      expect(await s.portionPriors(userId, 2)).toEqual([{ name: "bread", ratio: 1.5, n: 2 }]);
    });

    it("orders by how often a food was corrected and honours the limit", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const rows = [
        ...Array.from({ length: 4 }, () => ({ name_en: "pasta", grams_before: 100, grams_after: 150 })),
        ...Array.from({ length: 3 }, () => ({ name_en: "salad", grams_before: 100, grams_after: 50 })),
      ];
      await s.recordPortionCorrections(userId, rows);
      expect((await s.portionPriors(userId)).map((p) => p.name)).toEqual(["pasta", "salad"]);
      expect((await s.portionPriors(userId, 3, 1)).map((p) => p.name)).toEqual(["pasta"]);
    });

    it("never records a correction there is nothing to learn from", async () => {
      // A zero before is not a small portion, it is a division by zero — and one Infinity in the
      // sample takes the median with it.
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      await s.recordPortionCorrections(userId, [
        { name_en: "soup", grams_before: 0, grams_after: 300 },
        { name_en: "soup", grams_before: 100, grams_after: 150 },
        { name_en: "soup", grams_before: 100, grams_after: 150 },
        { name_en: "soup", grams_before: 100, grams_after: 150 },
      ]);
      expect(await s.portionPriors(userId)).toEqual([{ name: "soup", ratio: 1.5, n: 3 }]);
    });

    it("scopes the prior to the account that was corrected", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const { userId: other } = await s.upsertDeviceUser(device(), "en");
      await s.recordPortionCorrections(userId, Array.from({ length: 3 }, () => ({
        name_en: "rice", grams_before: 100, grams_after: 200,
      })));
      expect(await s.portionPriors(other)).toEqual([]);
    });

    it("carries portion corrections through an anonymous → real merge", async () => {
      // They are learned before anybody signs in — the camera is the first screen after onboarding
      // — so a merge that dropped them would throw away every measurement the app has of this
      // person's portions, at the moment they finally have an account to keep it on.
      const s = await open();
      const anon = (await s.upsertDeviceUser(device(), "en")).userId;
      const real = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.recordPortionCorrections(anon, Array.from({ length: 3 }, () => ({
        name_en: "rice", grams_before: 100, grams_after: 150,
      })));
      await s.mergeUsers(anon, real);
      expect(await s.portionPriors(real)).toEqual([{ name: "rice", ratio: 1.5, n: 3 }]);
    });

    it("erases portion corrections with the account", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      await s.recordPortionCorrections(userId, Array.from({ length: 3 }, () => ({
        name_en: "rice", grams_before: 100, grams_after: 150,
      })));
      await s.deleteUser(userId);
      expect(await s.portionPriors(userId)).toEqual([]);
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

    it("stores notification copy in its own row, not the onboarding one", async () => {
      const s = await open();
      const edited = {
        ...DEFAULT_NOTIFICATION_COPY,
        evening: { ...DEFAULT_NOTIFICATION_COPY.evening, title: `Evening ${RUN}` },
      };
      await s.putNotificationCopy(edited);
      expect((await s.getNotificationCopy())?.evening.title).toBe(`Evening ${RUN}`);
      // Saving one must not disturb the other: two admin screens, two rows.
      await s.putOnboardingContent({ ...DEFAULT_ONBOARDING_CONTENT, version: 99 });
      expect((await s.getNotificationCopy())?.evening.title).toBe(`Evening ${RUN}`);
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

    it("prunes health rows dated before a day, for every account, and keeps that day (#562)", async () => {
      const s = await open();
      const a = (await s.upsertDeviceUser(device(), "en")).userId;
      const b = (await s.upsertDeviceUser(device(), "en")).userId;
      const day = (date: string) => ({ ...emptyHealthDay(date), steps: 1 });
      // Dates no other test stores: the prune is global by definition, like the retention it keeps.
      await s.putHealthDays(a, [day("2001-01-02"), day("2001-01-01")]);
      await s.putHealthDays(b, [day("2000-12-31")]);
      expect(await s.pruneHealthDaysBefore("2001-01-02")).toBeGreaterThanOrEqual(2);
      expect((await s.healthDaysSince(a, "0000-01-01")).map((d) => d.date)).toEqual(["2001-01-02"]);
      expect(await s.healthDaysSince(b, "0000-01-01")).toEqual([]);
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

    // ── A LIFETIME OF ITS OWN (#407) ────────────────────────────────────────────────────────
    //
    // The browser's bearer is re-minted from the session cookie on every page load, so it never
    // needs the phone's six idle months — and it lives in a closure on an origin that also serves
    // the admin. `issueToken` therefore takes a lifetime, and these say the store honours it on
    // every path the store-wide one is honoured on: the lookup, the slide, and the sweep.

    it("honours a token's own lifetime rather than the store's", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const ordinary = await s.issueToken(userId);
      const brief = await s.issueToken(userId, Math.floor(TTL / 4));

      clock += Math.floor(TTL / 2);

      // Both were minted at the same moment and neither has been used since. The only thing that
      // separates them is the number handed to `issueToken`.
      expect(await s.userIdForToken(brief)).toBeNull();
      expect(await s.userIdForToken(ordinary)).toBe(userId);
    });

    it("slides a short-lived token on its OWN schedule", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const brief = await s.issueToken(userId, Math.floor(TTL / 4));

      // Three quarters of ITS lifetime, then a request, twice — past where its original deadline
      // was. A refresh interval computed from the store's lifetime instead of the row's would not
      // write the row forward here, and the second lookup would fail.
      clock += Math.floor(TTL / 4 * 0.75);
      expect(await s.userIdForToken(brief)).toBe(userId);
      clock += Math.floor(TTL / 4 * 0.75);
      expect(await s.userIdForToken(brief)).toBe(userId);
    });

    it("sweeps a short-lived token as soon as ITS lifetime is up", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const brief = await s.issueToken(userId, Math.floor(TTL / 4));
      const ordinary = await s.issueToken(userId);

      clock += Math.floor(TTL / 4) + 1_000;

      expect(await s.pruneExpiredTokens()).toBeGreaterThanOrEqual(1);
      expect(await s.userIdForToken(brief)).toBeNull();
      expect(await s.userIdForToken(ordinary)).toBe(userId);
    });
  });
}

/**
 * The proposal's lifetime under an injected clock. Every pending path — the lookup's lazy expiry,
 * the claim's refusal of an expired row, the sweep — must read the store's clock, or a test cannot
 * move time for it and the two implementations can drift apart on the one path a race depends on.
 */
function pendingLifetime(name: string, make: (opts: StoreOptions) => Promise<Store>) {
  describe(`pending meals — ${name}`, () => {
    let clock = Date.parse("2026-08-01T12:00:00Z");
    let store: Store | null = null;
    const open = async () => (store ??= await make({ now: () => clock }));
    afterAll(async () => { await store?.close(); });

    it("expires, refuses the claim, and sweeps on the store's clock, not the wall's", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      const row = { id: crypto.randomUUID(), userId: u, analysis: meal(u), date: "2026-08-01", expiresAt: clock + 60_000 };
      await s.putPending(row);
      expect((await s.getPending(u, row.id))?.id).toBe(row.id);
      clock += 61_000;
      // Still on disk (nothing swept it), and every path now calls it expired.
      expect(await s.dropPending(u, row.id)).toBe(false);
      expect(await s.getPending(u, row.id)).toBeNull();
      const live = { ...row, id: crypto.randomUUID(), expiresAt: clock + 60_000 };
      const dead = { ...row, id: crypto.randomUUID(), expiresAt: clock - 1 };
      await s.putPending(live);
      await s.putPending(dead);
      clock += 30_000;
      expect(await s.pruneExpiredPendings()).toBeGreaterThanOrEqual(1);
      expect(await s.dropPending(u, live.id)).toBe(true);
    });

    it("stamps the lines it writes from the store's clock, which is what the app shows as the time", async () => {
      const s = await open();
      const u = (await s.upsertDeviceUser(device(), "en")).userId;
      await s.appendChat(u, [{ role: "user", kind: "text", text: "hi" }]);
      expect((await s.chatBefore(u, null, 1))[0]!.ts).toBe(new Date(clock).toISOString());
    });
  });
}

/**
 * The pairing code's lifetime, under an injected clock.
 *
 * A pairing code is a credential a person types, so the store owes it exactly what it owes a bearer
 * token: it is written down as a HASH, it is claimable ONCE, and an expired one is
 * indistinguishable from one that never existed. The claim is a single guarded delete for the same
 * reason `dropPending` is — read-then-delete is two deliveries away from handing one account's
 * session to two browsers.
 */
function pairingCodes(name: string, make: (opts: StoreOptions) => Promise<Store>) {
  describe(`pairing codes — ${name}`, () => {
    let clock = Date.parse("2026-09-07T12:00:00Z");
    let store: Store | null = null;
    const open = async () => (store ??= await make({ now: () => clock }));
    afterAll(async () => { await store?.close(); });

    /** A hash-shaped value, since that is all the store is ever handed. */
    const codeHash = () => hashToken(crypto.randomUUID());

    it("round trips once — the code resolves to its account, and never a second time", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const hash = await codeHash();
      await s.putPairingCode(userId, hash, clock + 60_000);
      expect(await s.claimPairingCode(hash)).toBe(userId);
      // The single-use property, and it is the store's rather than the engine's: whoever wins the
      // delete gets the account, and there is no second winner.
      expect(await s.claimPairingCode(hash)).toBeNull();
    });

    it("never claims an expired code, and takes the row with it", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const hash = await codeHash();
      await s.putPairingCode(userId, hash, clock + 60_000);
      clock += 61_000;
      expect(await s.claimPairingCode(hash)).toBeNull();
      // Gone rather than merely refused: a row that survived a refusal is a row a clock moving
      // backwards would make live again.
      expect(await s.claimPairingCode(hash)).toBeNull();
    });

    it("holds ONE live code per account — a new mint kills the old one", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const first = await codeHash();
      const second = await codeHash();
      await s.putPairingCode(userId, first, clock + 60_000);
      await s.putPairingCode(userId, second, clock + 60_000);
      expect(await s.claimPairingCode(first)).toBeNull();
      expect(await s.claimPairingCode(second)).toBe(userId);
    });

    it("sweeps expired codes on mint, so the table stays bounded without a scheduler", async () => {
      const s = await open();
      const mine = (await s.upsertDeviceUser(device(), "en")).userId;
      const other = (await s.upsertDeviceUser(device(), "en")).userId;
      const abandoned = await codeHash();
      await s.putPairingCode(other, abandoned, clock + 60_000);

      clock += 61_000;
      // Somebody else's mint is what sweeps it. Nothing here calls a prune method, because there
      // is not one: minting is rare and is the write path that can afford the sweep.
      await s.putPairingCode(mine, await codeHash(), clock + 60_000);
      expect(await s.claimPairingCode(abandoned)).toBeNull();
    });

    it("goes with the account", async () => {
      const s = await open();
      const { userId } = await s.upsertDeviceUser(device(), "en");
      const hash = await codeHash();
      await s.putPairingCode(userId, hash, clock + 60_000);
      await s.deleteUser(userId);
      // A code outliving its account is a code that would mint a session for a user id nothing
      // resolves — and in Postgres it is a foreign key nobody swept.
      expect(await s.claimPairingCode(hash)).toBeNull();
    });
  });
}

tokenLifetime("memory", async (o) => memoryStore(o));
pendingLifetime("memory", async (o) => memoryStore(o));
pairingCodes("memory", async (o) => memoryStore(o));

if (PG_URL) {
  tokenLifetime("postgres", (o) => postgresStore(PG_URL, { ...o, maxConnections: TEST_POOL }));
  pendingLifetime("postgres", (o) => postgresStore(PG_URL, { ...o, maxConnections: TEST_POOL }));
  pairingCodes("postgres", (o) => postgresStore(PG_URL, { ...o, maxConnections: TEST_POOL }));

  // The same question the tokens table is asked below, for the same reason: a pairing code is a
  // credential, the nightly dump leaves this box, and a column holding the value a person types
  // would make that file a set of live sessions for every account currently pairing.
  describe("pairing codes at rest — postgres", () => {
    it("keeps a hash, and nothing a dump could type into the form", async () => {
      const s = await postgresStore(PG_URL, { maxConnections: TEST_POOL });
      const { userId } = await s.upsertDeviceUser(device(), "en");
      // MINTED PER RUN. `pairing_codes` is keyed on `code_hash` alone, so a fixed code is a global
      // singleton in the database: the row lives its 60 s, and the next run inside that window —
      // or any run after one that died before the sweep — fails on the primary key (#461). Hex is
      // a subset of the pairing alphabet, so this is still a code the server could have minted.
      const code = crypto.randomUUID().slice(0, 8).toUpperCase();
      await s.putPairingCode(userId, await hashToken(code), Date.now() + 60_000);

      const sql = new SQL(PG_URL, { max: TEST_POOL });
      try {
        const columns = (await sql`
          select column_name from information_schema.columns
          where table_schema = current_schema() and table_name = 'pairing_codes'`)
          .map((r: { column_name: string }) => r.column_name);
        expect(columns.sort()).toEqual(["code_hash", "expires_at", "user_id"]);

        const rows = await sql`
          select code_hash from pairing_codes where user_id = ${userId}::uuid`;
        expect(rows.length).toBe(1);
        expect(String(rows[0].code_hash)).toMatch(/^[0-9a-f]{64}$/);
        // And the value a person would type appears nowhere in the table.
        const byRaw = await sql`select count(*)::int as n from pairing_codes where code_hash = ${code}`;
        expect(byRaw[0].n).toBe(0);
      } finally {
        await sql.close();
        await s.close();
      }
    });
  });

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

    it("grandfathers a single-opt-in list rather than sweeping it", async () => {
      // The other migration with a judgement call in it. These addresses were submitted under a
      // flow that was live at the time and said what it would do; leaving them pending would mean
      // deleting genuine signups within the week without ever asking, which is a worse answer to
      // the same question. docs/DEPLOY.md names the decision.
      const sql = new SQL(PG_URL, { max: TEST_POOL });
      try {
        await sql`drop table if exists subscribers`;
        await sql.unsafe(`create table subscribers (
          email      text primary key,
          token      text not null unique,
          source     text not null,
          created_at timestamptz not null default now()
        )`);
        const email = `legacy-${RUN}@example.com`;
        await sql`insert into subscribers (email, token, source)
                  values (${email}, ${`legacy-unsub-${RUN}`}, 'web')`;

        const s = await postgresStore(PG_URL, { maxConnections: TEST_POOL });
        try {
          // Confirmed, so the sweep leaves it alone — and `addSubscriber` reports no confirmation
          // token for it, which is what stops the first deploy mailing the whole existing list.
          expect(await s.pruneUnconfirmedSubscribers(new Date(Date.now() + 1).toISOString())).toBe(0);
          const upsert = await s.addSubscriber(email, "web");
          expect(upsert.confirmToken).toBeNull();
          expect(upsert.created).toBe(false);
          // The withdrawal token they were given is still the one that works.
          expect(await s.removeSubscriber(`legacy-unsub-${RUN}`)).toBe(true);
        } finally {
          await s.close();
        }
      } finally {
        await sql.close();
      }
    });
  });
}

// ── The migration onto the two-grant model ─────────────────────────────────────────────────────
//
// Postgres only, because the thing under test is DDL. An intermediate version of this code stored
// the lifetime unlock as a NULL expiry on an existing record; a database that ran it holds rows the
// current reader would otherwise see as having bought nothing, and a paid customer would lose their
// access silently on deploy.
//
// The second test is the one that matters more. A refunded lifetime with no subscription has
// exactly the shape of an old-model lifetime — null expiry, null unlock, an event_at — so a
// backfill that ran on every start would re-grant every refund it ever processed. The backfill is
// therefore inside the column-does-not-exist branch, and this proves that it is.
if (PG_URL) {
  describe("migrating a database that stored lifetimes the old way", () => {
    // Constructing the store IS the migration — `postgresStore` runs the schema before it returns,
    // so building one again is what a redeploy does.
    const migrate = () => postgresStore(PG_URL, { maxConnections: 2 });
    const fresh = async () => ({ sql: new SQL(PG_URL, { max: 2 }), store: await migrate() });

    it("restores an unlock that was stored as a null expiry", async () => {
      const { sql, store } = await fresh();
      const { userId } = await store.upsertDeviceUser(`mig-${crypto.randomUUID()}`, "en");

      // The old shape, put back by hand: the record exists, the expiry is null because the unlock
      // had no period, and the new column is null because the row predates it.
      await sql`
        update users set entitlement_expires_at = null, entitlement_product_id = 'lifetime',
                         entitlement_event_at = ${new Date("2026-08-20T00:00:00.000Z")},
                         entitlement_lifetime_product_id = null
        where id = ${userId}`;
      expect((await store.getEntitlement(userId))?.lifetimeProductId).toBeNull();

      // Dropping the column is what makes the next migration believe it is running for the first
      // time — the state a real deploy onto an old database is in.
      //
      // IT IS TABLE-WIDE, and this suite shares one `users` table with every test above it. So the
      // backfill also touches rows those tests left behind, including any refunded lifetime, which
      // it will re-grant. That is not a defect in the backfill: on a database genuinely seeing this
      // column for the first time, a null expiry can ONLY be an old-model unlock, because the code
      // that produces a refunded one is the code that adds the column. It is a property of the
      // SIMULATION — production never drops the column, so the collateral cannot occur there — and
      // it is why the assertions below name this test's own user and nothing else.
      await sql`alter table users drop column entitlement_lifetime_product_id`;
      const redeployed = await migrate();

      const restored = await redeployed.getEntitlement(userId);
      expect(restored?.lifetimeProductId).toBe("lifetime");
      await sql.end();
    });

    // The migration has to survive a table that has never held ANY of these columns. It did not:
    // two backfills read `entitlement_event_at` in their WHERE clauses while it was still declared
    // twenty lines below them, so the server failed to start against a fresh database — a new dev
    // machine, CI given a clean Postgres, a restore into an empty schema. Invisible in every
    // environment that had already run the older code, which is every environment anybody had.
    it("runs against a table with none of the entitlement columns", async () => {
      const { sql } = await fresh();
      await sql`
        alter table users
          drop column entitlement_event_at,
          drop column entitlement_expires_at,
          drop column entitlement_expires_event_at,
          drop column entitlement_product_id,
          drop column entitlement_lifetime_product_id,
          drop column entitlement_lifetime_event_at`;

      const store = await migrate();
      const { userId } = await store.upsertDeviceUser(`virgin-${crypto.randomUUID()}`, "en");
      expect(await store.getEntitlement(userId)).toBeNull();
      await sql.end();
    });

    // The clocks are seeded from the single legacy timestamp, and seeding BOTH from it hands an
    // ordinary subscriber a lifetime clock for a lifetime they never bought. Their first real
    // unlock, redelivered even slightly late, is then refused as older than an event that never
    // happened — charged, unlock never delivered, no retry.
    it("does not give a subscription-only account a clock for a lifetime it never had", async () => {
      const { sql, store } = await fresh();
      const { userId } = await store.upsertDeviceUser(`sub-${crypto.randomUUID()}`, "en");

      // A subscriber as the released model stored one: an expiry, and one timestamp for both.
      await sql`
        update users set entitlement_expires_at = ${new Date("2026-09-20T00:00:00.000Z")},
                         entitlement_product_id = 'monthly',
                         entitlement_event_at = ${new Date("2026-08-20T00:00:00.000Z")},
                         entitlement_expires_event_at = null,
                         entitlement_lifetime_event_at = null,
                         entitlement_lifetime_product_id = null
        where id = ${userId}`;
      await sql`
        alter table users
          drop column entitlement_expires_event_at, drop column entitlement_lifetime_event_at`;
      const migrated = await migrate();

      // Their first lifetime purchase, dated BEFORE their last subscription event because the
      // delivery was retried. Nothing about the unlock has ever been recorded, so it must land.
      expect(await migrated.putEntitlement(userId, {
        lifetimeProductId: "lifetime", productId: "lifetime",
        eventAt: "2026-08-15T00:00:00.000Z",
      })).toBe(true);
      expect((await migrated.getEntitlement(userId))?.lifetimeProductId).toBe("lifetime");

      // And the subscription's own clock WAS seeded, so its stale redelivery is still refused.
      expect(await migrated.putEntitlement(userId, {
        expiresAt: "2026-08-25T00:00:00.000Z", productId: "monthly",
        eventAt: "2026-08-19T00:00:00.000Z",
      })).toBe(false);
      await sql.end();
    });

    it("does not re-grant a lifetime that was refunded, however often it runs", async () => {
      const { sql, store } = await fresh();
      const { userId } = await store.upsertDeviceUser(`mig-${crypto.randomUUID()}`, "en");

      await store.putEntitlement(userId, {
        lifetimeProductId: "lifetime", productId: "lifetime",
        eventAt: "2026-08-20T00:00:00.000Z",
      });
      await store.putEntitlement(userId, {
        lifetimeProductId: null, productId: "lifetime",
        eventAt: "2026-08-21T00:00:00.000Z",
      });
      expect((await store.getEntitlement(userId))?.lifetimeProductId).toBeNull();

      // Every restart runs the schema again. The refund must survive all of them.
      await migrate();
      await migrate();
      expect((await store.getEntitlement(userId))?.lifetimeProductId).toBeNull();
      await sql.end();
    });
  });
}
