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
import type { MealRecord } from "@ieat/shared";
import { memoryStore } from "./store.memory.ts";
import { postgresStore } from "./store.pg.ts";
import type { Store } from "./store.ts";

const PG_URL = process.env.TEST_DATABASE_URL;

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
  });
}

contract("memory", async () => memoryStore());

if (PG_URL) {
  contract("postgres", () => postgresStore(PG_URL));
} else {
  describe("store contract — postgres", () => {
    it.skip("SKIPPED: set TEST_DATABASE_URL to run against real Postgres", () => {});
  });
}
