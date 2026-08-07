import { beforeEach, describe, expect, it } from "bun:test";
import { dateMinus, emptyHealthDay, localDate, type HealthDay } from "@ieat/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { fakeMailer } from "../mail/fake.ts";
import { healthTrend, recordHealthDays } from "./health.ts";
import { patchProfile, type EngineDeps } from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  appleAudiences: ["app.ieat"], googleAudiences: ["test.apps.googleusercontent.com"],
};

let store: Store;
let deps: EngineDeps;

beforeEach(() => {
  store = memoryStore();
  deps = { store, config: CONFIG, llm: demoPorts(), mailer: fakeMailer() };
});

async function onboard(over: Record<string, unknown> = {}): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "moderate", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true, ...over,
  });
  if (!out || !out.ok) throw new Error(`onboarding failed: ${JSON.stringify(out)}`);
  return userId;
}

function day(date: string, over: Partial<HealthDay> = {}): HealthDay {
  return { ...emptyHealthDay(date), ...over };
}

// Dates are RELATIVE TO TODAY, not pinned to a month in 2026.
//
// Both matter. `healthTrend` computes its window from the current date, so a fixed date falls out
// of it the moment enough time passes. And the weight guard compares against a stamp written when
// the test onboarded its user — which is now — so a fixed measurement instant is permanently older
// than the profile it is meant to update. Two tests were written that way and failed for exactly
// those reasons; a test that only passes in March is not a test.
const ZONE = CONFIG.timezone;
const TODAY = localDate(ZONE);
const ago = (n: number) => dateMinus(TODAY, n);
/** An instant `n` seconds from now, for ordering against a stamp the server just wrote. */
const nowPlus = (seconds: number) => new Date(Date.now() + seconds * 1_000).toISOString();

describe("recordHealthDays", () => {
  it("stores what it is given and reports the count", async () => {
    const userId = await onboard();
    const out = await recordHealthDays(deps, userId, [
      day(ago(1), { steps: 8000, asleep_minutes: 430 }),
      day(ago(0), { steps: 6000 }),
    ]);
    expect(out!.accepted).toBe(2);

    const stored = await store.healthDaysSince(userId, ago(30));
    expect(stored.map((d) => d.date)).toEqual([ago(0), ago(1)]);
    expect(stored[1]!.asleep_minutes).toBe(430);
  });

  it("re-sending a day corrects it rather than duplicating it", async () => {
    // The app re-reads a rolling window on every sync, so the same date arrives repeatedly. A
    // second row for one date would double every number the trend renders.
    const userId = await onboard();
    await recordHealthDays(deps, userId, [day(ago(1), { steps: 5000 })]);
    await recordHealthDays(deps, userId, [day(ago(1), { steps: 9000 })]);

    const stored = await store.healthDaysSince(userId, ago(30));
    expect(stored).toHaveLength(1);
    expect(stored[0]!.steps).toBe(9000);
  });

  it("drops a day that carries nothing usable, and does not count it", async () => {
    const userId = await onboard();
    const out = await recordHealthDays(deps, userId, [day(ago(1)), day("not-a-date", { steps: 1 })]);
    expect(out!.accepted).toBe(0);
    expect(await store.healthDaysSince(userId, ago(90))).toEqual([]);
  });

  it("nulls an implausible metric but keeps the rest of the day", async () => {
    const userId = await onboard();
    await recordHealthDays(deps, userId, [day(ago(1), { weight_kg: 4000, steps: 7000 })]);
    const [stored] = await store.healthDaysSince(userId, ago(30));
    expect(stored!.weight_kg).toBeNull();
    expect(stored!.steps).toBe(7000);
  });

  it("never reaches another user's rows", async () => {
    const mine = await onboard();
    const theirs = await onboard();
    await recordHealthDays(deps, mine, [day(ago(1), { steps: 1000 })]);
    expect(await store.healthDaysSince(theirs, ago(90))).toEqual([]);
  });

  it("refuses a day outside the window this product keeps", async () => {
    // Rows per user must be BOUNDED. Accounts are free and this route is not billed, so without a
    // window a client can write four hundred distinct dates per request, spanning centuries, for as
    // long as it likes. The upsert key stops a date being stored twice; it does nothing about a
    // client that never repeats one.
    const userId = await onboard();
    const out = await recordHealthDays(deps, userId, [
      day(ago(5_000), { steps: 1 }),   // long before this product existed
      day(ago(-30), { steps: 2 }),     // a month into the future
      day(ago(1), { steps: 3 }),       // fine
    ]);
    expect(out!.accepted).toBe(1);
    const stored = await store.healthDaysSince(userId, ago(9_000));
    expect(stored.map((d) => d.date)).toEqual([ago(1)]);
  });

  it("accepts today, and yesterday, and the far edge of the window", async () => {
    const userId = await onboard();
    const out = await recordHealthDays(deps, userId, [
      day(ago(0), { steps: 1 }), day(ago(1), { steps: 2 }), day(ago(729), { steps: 3 }),
    ]);
    expect(out!.accepted).toBe(3);
  });

  it("refuses an account that has not onboarded", async () => {
    const { userId } = await store.upsertDeviceUser("d".repeat(40), "en");
    expect(await recordHealthDays(deps, userId, [day(ago(1), { steps: 1 })])).toBeNull();
  });
});

describe("weight sync", () => {
  it("moves the profile weight, and therefore the calorie target", async () => {
    const userId = await onboard();
    const before = (await store.getProfile(userId))!.weight_kg;
    expect(before).toBe(70);

    const out = await recordHealthDays(deps, userId, [
      day(ago(0), { weight_kg: 67 }),
    ], nowPlus(60));

    expect((await store.getProfile(userId))!.weight_kg).toBe(67);
    // Returned rather than left for the client to re-fetch: a new weight is a new target, and the
    // plan on screen would otherwise show the old one until something else refreshed it.
    expect(out!.profile).toBeDefined();
    expect(out!.profile!.profile.weight_kg).toBe(67);
  });

  it("takes the weight from the MOST RECENT day in the batch", async () => {
    const userId = await onboard();
    await recordHealthDays(deps, userId, [
      day(ago(2), { weight_kg: 72 }),
      day(ago(0), { weight_kg: 69 }),
      day(ago(1), { weight_kg: 71 }),
    ], nowPlus(60));
    expect((await store.getProfile(userId))!.weight_kg).toBe(69);
  });

  it("does NOT overwrite a weight the user typed more recently", async () => {
    // The clobber this guard exists for: a user corrects their weight by hand, a sync fires
    // seconds later carrying this morning's scale reading, and the correction silently disappears.
    const userId = await onboard();
    await patchProfile(deps, userId, { weight_kg: 66 });
    const typedAt = (await store.getProfile(userId))!.weight_measured_at!;
    expect(typedAt).not.toBeNull();

    const earlier = new Date(Date.parse(typedAt) - 60_000).toISOString();
    await recordHealthDays(deps, userId, [day(ago(0), { weight_kg: 71 })], earlier);

    expect((await store.getProfile(userId))!.weight_kg).toBe(66);
  });

  it("does overwrite when the measurement is newer than the typed one", async () => {
    const userId = await onboard();
    await patchProfile(deps, userId, { weight_kg: 66 });
    const typedAt = (await store.getProfile(userId))!.weight_measured_at!;

    const later = new Date(Date.parse(typedAt) + 60_000).toISOString();
    await recordHealthDays(deps, userId, [day(ago(0), { weight_kg: 71 })], later);

    expect((await store.getProfile(userId))!.weight_kg).toBe(71);
  });

  it("leaves the profile alone when no day carries a weight", async () => {
    const userId = await onboard();
    const out = await recordHealthDays(deps, userId, [day(ago(1), { steps: 9000 })]);
    expect(out!.profile).toBeUndefined();
    expect((await store.getProfile(userId))!.weight_kg).toBe(70);
  });

  it("does not move the calorie target for activity, energy or sleep", async () => {
    // The activity multiplier already prices activity into TDEE. Adding active energy on top
    // double-counts it, inflates the target, and quietly erases the deficit the user asked for.
    const userId = await onboard();
    const before = (await store.getProfile(userId))!;
    await recordHealthDays(deps, userId, [
      day(ago(1), { active_kcal: 1200, steps: 30_000, asleep_minutes: 300 }),
    ]);
    const after = (await store.getProfile(userId))!;
    expect(after.weight_kg).toBe(before.weight_kg);
    expect(after.activity).toBe(before.activity);
  });

  it("ignores a weight the profile validator would have refused", async () => {
    // Range enforcement lives server-side on BOTH paths. A client that skipped it on the manual
    // form would simply be told no; a client that skipped it here must be told no too.
    const userId = await onboard();
    await recordHealthDays(deps, userId, [day(ago(0), { weight_kg: 25 })], nowPlus(60));
    expect((await store.getProfile(userId))!.weight_kg).toBe(70);
  });
});

describe("healthTrend", () => {
  it("returns the window, most recent first", async () => {
    const userId = await onboard();
    await recordHealthDays(deps, userId, [
      day(ago(2), { steps: 1 }), day(ago(1), { steps: 2 }), day(ago(0), { steps: 3 }),
    ]);
    const out = await healthTrend(deps, userId, 30);
    expect(out!.days.map((d) => d.date)).toEqual([ago(0), ago(1), ago(2)]);
  });

  it("is scoped to the caller", async () => {
    const mine = await onboard();
    const theirs = await onboard();
    await recordHealthDays(deps, mine, [day(ago(1), { steps: 3 })]);
    expect((await healthTrend(deps, theirs, 30))!.days).toEqual([]);
  });
});
