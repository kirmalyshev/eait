// The seeder, against the memory store. No database, no docker, runs on every `bun test`.

import { describe, expect, test } from "bun:test";
import { memoryStore } from "../store.memory.ts";
import { DEFAULT_SEED_PERSONA, SEED_PERSONAS, seedDeviceId, seedDevData } from "./seed.ts";

const TZ = "Europe/Berlin";
const TODAY = "2026-08-06";
/** The seven calendar days `TODAY` seeds, newest first. Written out rather than computed, so a bug
 *  in the date arithmetic under test cannot also be the thing asserting it. */
const SEEDED_WEEK = [
  "2026-08-06", "2026-08-05", "2026-08-04", "2026-08-03", "2026-08-02", "2026-08-01", "2026-07-31",
];

describe("seedDevData", () => {
  test("every persona is reachable by its pinned device id", async () => {
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });

    expect(seeded.map((s) => s.key)).toEqual(SEED_PERSONAS.map((p) => p.key));
    for (const s of seeded) {
      const resolved = await store.upsertDeviceUser(s.deviceId, "en");
      expect(resolved.created).toBe(false);
      expect(resolved.userId).toBe(s.userId);
    }
  });

  test("the pinned device id is deterministic and long enough to be an account key", () => {
    // 32 characters is the server's floor — see `POST /v1/auth/device`. Stability matters because
    // the value is compiled into a build: a device id that moved between two builds would silently
    // hand the second one a different account.
    for (const p of SEED_PERSONAS) {
      expect(seedDeviceId(p.key)).toBe(seedDeviceId(p.key));
      expect(seedDeviceId(p.key).length).toBeGreaterThanOrEqual(32);
      expect(seedDeviceId(p.key)).toMatch(/^5eed[0-9a-f]+$/);
    }
    // Distinct personas are distinct accounts.
    const ids = new Set(SEED_PERSONAS.map((p) => seedDeviceId(p.key)));
    expect(ids.size).toBe(SEED_PERSONAS.length);
  });

  test("the default persona is onboarded and carries a full week of meals", async () => {
    const store = memoryStore();
    const [seeded] = await seedDevData(store, {
      timezone: TZ, today: TODAY, only: [DEFAULT_SEED_PERSONA],
    });
    expect(seeded).toBeDefined();

    const profile = await store.getProfile(seeded!.userId);
    expect(profile?.onboarded_at).not.toBeNull();

    // Seven distinct dates, today back to six days ago, each with the same three meals.
    for (const date of SEEDED_WEEK) {
      expect((await store.mealsForDate(seeded!.userId, date)).length).toBe(3);
    }
    expect((await store.mealsForDate(seeded!.userId, "2026-07-30")).length).toBe(0);
    expect(seeded!.meals).toBe(SEEDED_WEEK.length * 3);
  });

  test("the fresh persona exists, has never onboarded, and has no meals", async () => {
    const store = memoryStore();
    const [seeded] = await seedDevData(store, { timezone: TZ, today: TODAY, only: ["fresh"] });

    const profile = await store.getProfile(seeded!.userId);
    expect(profile?.onboarded_at ?? null).toBeNull();
    expect(seeded!.meals).toBe(0);
    expect((await store.mealsForDate(seeded!.userId, TODAY)).length).toBe(0);
  });

  test("verdicts are computed, and only for dimensions the profile declares", async () => {
    const store = memoryStore();
    const [seeded] = await seedDevData(store, {
      timezone: TZ, today: TODAY, only: [DEFAULT_SEED_PERSONA],
    });

    const meals = await store.mealsForDate(seeded!.userId, TODAY);
    expect(meals.length).toBe(3);
    for (const meal of meals) {
      // `weight` applies to everybody; `ldl` is unlocked by the declared restriction; `kidneys` is
      // NOT declared, so producing one would be a medical claim the user never asked for.
      expect(meal.verdicts.weight).toBeDefined();
      expect(meal.verdicts.ldl).toBeDefined();
      expect(meal.verdicts.kidneys).toBeUndefined();
    }
  });

  test("a seeded week is not all one colour", async () => {
    // A fixture where every meal is `bad` says nothing about whether the verdict row renders
    // correctly, and it makes the seeded app look like an emergency. The first version of the
    // macro mix did exactly that on the LDL dimension.
    const store = memoryStore();
    const [seeded] = await seedDevData(store, {
      timezone: TZ, today: TODAY, only: [DEFAULT_SEED_PERSONA],
    });

    const verdicts = { weight: new Set<string>(), ldl: new Set<string>() };
    let counted = 0;
    for (const date of SEEDED_WEEK) {
      for (const meal of await store.mealsForDate(seeded!.userId, date)) {
        counted++;
        if (meal.verdicts.weight) verdicts.weight.add(meal.verdicts.weight);
        if (meal.verdicts.ldl) verdicts.ldl.add(meal.verdicts.ldl);
      }
    }
    // Asserted, because a loop that quietly walked the wrong dates would find no meals and every
    // set below would be trivially satisfiable.
    expect(counted).toBe(21);
    expect(verdicts.weight.size).toBeGreaterThan(1);
    expect(verdicts.ldl.has("good")).toBe(true);
  });

  test("the onboarded persona carries a health trend over the same week", async () => {
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });
    const onboarded = seeded.find((s) => s.key === DEFAULT_SEED_PERSONA)!;

    const days = await store.healthDaysSince(onboarded.userId, SEEDED_WEEK[SEEDED_WEEK.length - 1]!);
    expect(days.map((d) => d.date)).toEqual(SEEDED_WEEK);
    expect(onboarded.healthDays).toBe(SEEDED_WEEK.length);
  });

  test("the seeded trend has gaps, because a real one does", async () => {
    // A fixture where every metric is present every day never exercises the "unknown, not zero"
    // rendering — and that is the branch a real trend spends most of its time in. A scale is not
    // stepped on daily and a watch is not worn every night.
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });
    const onboarded = seeded.find((s) => s.key === DEFAULT_SEED_PERSONA)!;
    const days = await store.healthDaysSince(onboarded.userId, SEEDED_WEEK[SEEDED_WEEK.length - 1]!);

    expect(days.some((d) => d.weight_kg === null)).toBe(true);
    expect(days.some((d) => d.weight_kg !== null)).toBe(true);
    expect(days.some((d) => d.asleep_minutes === null)).toBe(true);
    expect(days.every((d) => d.steps !== null)).toBe(true);
  });

  test("the fresh persona has no health rows at all", async () => {
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });
    const fresh = seeded.find((s) => s.healthDays === 0);
    expect(fresh).toBeDefined();
    expect(await store.healthDaysSince(fresh!.userId, "2020-01-01")).toEqual([]);
  });

  test("seeding twice leaves one week of meals, not two", async () => {
    const store = memoryStore();
    await seedDevData(store, { timezone: TZ, today: TODAY });
    const second = await seedDevData(store, { timezone: TZ, today: TODAY });

    const onboarded = second.find((s) => s.key === DEFAULT_SEED_PERSONA)!;
    expect((await store.mealsForDate(onboarded.userId, TODAY)).length).toBe(3);
    expect(onboarded.meals).toBe(21);
  });

  test("an account created by hand survives a re-seed", async () => {
    const store = memoryStore();
    await seedDevData(store, { timezone: TZ, today: TODAY });

    const mine = await store.upsertDeviceUser("a".repeat(64), "en");
    await store.patchProfile(mine.userId, { weight_kg: 71 });
    await seedDevData(store, { timezone: TZ, today: TODAY });

    const after = await store.upsertDeviceUser("a".repeat(64), "en");
    expect(after.created).toBe(false);
    expect((await store.getProfile(mine.userId))?.weight_kg).toBe(71);
  });
});
