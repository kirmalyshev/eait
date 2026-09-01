import { beforeEach, describe, expect, it } from "bun:test";
import { HEALTH_RETENTION_DAYS, dateMinus, emptyHealthDay, localDate, type HealthDay } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { healthTrend, recordHealthDays } from "./health.ts";
import { patchProfile, type EngineDeps } from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  appleAudiences: ["com.eait.fit.ios"], googleAudiences: ["test.apps.googleusercontent.com"],
};

let store: Store;
let deps: EngineDeps;

beforeEach(() => {
  store = memoryStore();
  deps = { store, config: CONFIG, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
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

/**
 * A measurement taken NOW, ordered strictly after whatever the server stamped a moment ago.
 *
 * These tests used to pass an instant a minute in the FUTURE to win that comparison, which the
 * server now refuses — a client cannot have measured something later than now, and honouring such a
 * stamp locked every honest reading after it out of the profile. So the ordering has to come from
 * real elapsed time instead, and two milliseconds is enough: `weight_measured_at` is stamped to the
 * millisecond and the comparison is strictly-greater.
 */
async function measuredNow(): Promise<string> {
  await Bun.sleep(2);
  return new Date().toISOString();
}

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
      day(ago(0), { steps: 1 }), day(ago(1), { steps: 2 }),
      day(ago(HEALTH_RETENTION_DAYS), { steps: 3 }),
    ]);
    expect(out!.accepted).toBe(3);
  });

  it("keeps five years, because the year view draws one point per stored year", async () => {
    const userId = await onboard();
    const out = await recordHealthDays(deps, userId, [
      day(ago(4 * 365), { weight_kg: 80 }),
      day(ago(HEALTH_RETENTION_DAYS + 1), { weight_kg: 81 }), // one day past the edge
    ]);
    expect(out!.accepted).toBe(1);
    expect(HEALTH_RETENTION_DAYS).toBeGreaterThanOrEqual(5 * 365);
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
    ], await measuredNow());

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
    ], await measuredNow());
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

    await recordHealthDays(deps, userId, [day(ago(0), { weight_kg: 71 })], await measuredNow());

    expect((await store.getProfile(userId))!.weight_kg).toBe(71);
  });

  it("refuses to stamp a measurement in the future, so a bad clock cannot lock the sync out", async () => {
    // `weightMeasuredAt` arrives from the CLIENT — it is read off the sample by the phone, and the
    // phone's clock is the phone's business. Stored verbatim, a stamp a year ahead beats every real
    // measurement that follows it, so Apple Health weight sync stops working from that moment on,
    // silently, with nothing on any screen to say why. A measurement cannot have been taken later
    // than now; the server holds it to that.
    const userId = await onboard();
    const wayAhead = new Date(Date.now() + 365 * 86_400_000).toISOString();
    await Bun.sleep(2);
    await recordHealthDays(deps, userId, [day(ago(0), { weight_kg: 71 })], wayAhead);

    const stamped = (await store.getProfile(userId))!.weight_measured_at!;
    expect(Date.parse(stamped)).toBeLessThanOrEqual(Date.now());

    // And the point of all that: the next honest reading still lands.
    await recordHealthDays(deps, userId, [day(ago(0), { weight_kg: 69 })], await measuredNow());
    expect((await store.getProfile(userId))!.weight_kg).toBe(69);
  });

  it("ignores a measurement stamp that is not a time at all", async () => {
    // Falls back to the day's own end rather than to `now()`: a batch replayed later must not be
    // able to beat a correction the user typed in the meantime.
    const userId = await onboard();
    await Bun.sleep(2); // so the fallback instant is strictly after the stamp onboarding wrote
    await recordHealthDays(deps, userId, [day(ago(0), { weight_kg: 68 })], "whenever");
    expect((await store.getProfile(userId))!.weight_kg).toBe(68);
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
    await recordHealthDays(deps, userId, [day(ago(0), { weight_kg: 25 })], await measuredNow());
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
