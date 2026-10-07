import { beforeEach, describe, expect, it } from "bun:test";
import { DEFAULT_NOTIFICATION_COPY, NOTIFICATION_COPY, NOTIFICATION_IDS, lintCopy } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush, type FakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { patchProfile, type EngineDeps } from "./index.ts";
import {
  dailyNotification, notificationCopy, resetNotificationCopy, saveNotificationCopy,
} from "./notify.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  timezone: "Europe/Berlin",
};

let store: Store;
let push: FakePush;
let deps: EngineDeps;

beforeEach(() => {
  store = memoryStore();
  push = fakePush();
  deps = { store, config: CONFIG, llm: demoPorts(), push };
});

/** A fully onboarded user. Returns the id. */
async function onboard(over: Record<string, unknown> = {}): Promise<string> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  // A real account, the S8 kind: a device session alone is anonymous, and anonymous
  // is refused analysis. The tests below are about everything AFTER sign-up.
  await store.addIdentity(userId, "google", "g-" + userId.slice(0, 8));
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "some", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true, ...over,
  });
  if (!out || !out.ok) throw new Error(`onboarding failed: ${JSON.stringify(out)}`);
  return userId;
}

let eventSeq = 0;
/**
 * A live entitlement, as the RevenueCat webhook would have written it.
 *
 * `trial` is the whole difference between the one reminder day and an ordinary evening: an expiry
 * a day out says nothing about which, so every test here has to state what it is testing.
 */
async function entitle(userId: string, expiresAt: string, trial = false): Promise<void> {
  await store.putEntitlement(userId, {
    expiresAt, productId: "com.eait.fit.ios.yearly", trial,
    eventAt: new Date(Date.now() + ++eventSeq * 1000).toISOString(),
  });
}

async function logMeal(userId: string, date: string, kcal: number, protein: number): Promise<void> {
  await store.insertMeal({
    id: crypto.randomUUID(), user_id: userId, ts: `${date}T12:00:00.000Z`, date,
    isFood: true, items: [{ name: "Rice", grams: 200 }], kcal, protein_g: protein,
    carbs_g: 50, fat_g: 10, satfat_g: 2, fiber_g: 3, sugar_g: 4, sodium_mg: 300,
    verdicts: {}, healthScore: null, confidence: "high", notes: "", corrected: false, model: "test",
  });
}

const DAY = "2026-08-20";
const NOW = Date.parse("2026-08-20T18:30:00Z");
/** An entitlement that is live but is not a trial ending near `DAY`. */
const PAID_UNTIL = "2027-01-01T00:00:00.000Z";

describe("the 20:30 line", () => {
  it("says what was eaten against the plan, and one thing for tomorrow", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await logMeal(userId, DAY, 900, 30);
    await logMeal(userId, DAY, 700, 25);

    const out = (await dailyNotification(deps, userId, DAY, NOW))!;
    expect(out.id).toBe("evening");
    expect(out.body).toContain("1600");
    // The plan, as the same function that computes the diary's target computes it.
    expect(out.body).toMatch(/of your [\d,]+kcal today/);
    expect(out.body).not.toContain("{");
  });

  it("uses the nothing-logged variant on a day with no meals", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    const out = (await dailyNotification(deps, userId, DAY, NOW))!;
    expect(out.body).toContain("Nothing logged");
    expect(out.body).not.toContain("{");
  });

  it("counts only that day's meals", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await logMeal(userId, "2026-08-19", 2000, 100);
    await logMeal(userId, DAY, 500, 20);
    const out = (await dailyNotification(deps, userId, DAY, NOW))!;
    expect(out.body).toContain("500");
    expect(out.body).not.toContain("2000");
  });

  it("counts only that user's meals", async () => {
    const mine = await onboard();
    const theirs = await onboard();
    await entitle(mine, PAID_UNTIL);
    await logMeal(theirs, DAY, 1234, 60);
    const out = (await dailyNotification(deps, mine, DAY, NOW))!;
    expect(out.body).toContain("Nothing logged");
  });

  it("renders the copy the admin saved, not the compiled-in default", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await logMeal(userId, DAY, 900, 30);
    await saveNotificationCopy(deps, {
      ...DEFAULT_NOTIFICATION_COPY,
      evening: {
        title: "Your evening line",
        body: "Ate {eaten}, planned {plan}. {tomorrow}",
        emptyBody: "Nothing today against {plan}. {tomorrow}",
      },
    }, "en");
    const out = (await dailyNotification(deps, userId, DAY, NOW))!;
    expect(out.title).toBe("Your evening line");
    expect(out.body.startsWith("Ate 900, planned ")).toBe(true);
  });

  it("says nothing to an account that never onboarded", async () => {
    const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
    await entitle(userId, PAID_UNTIL);
    expect(await dailyNotification(deps, userId, DAY, NOW)).toBeNull();
  });

  it("gives an account with no live entitlement the plain nudge — the line is what a subscription buys (#730)", async () => {
    const userId = await onboard();
    expect((await dailyNotification(deps, userId, DAY, NOW))?.id).toBe("nudge");
    await entitle(userId, "2026-08-01T00:00:00.000Z");
    expect((await dailyNotification(deps, userId, DAY, NOW))?.id).toBe("nudge");
  });
});

describe("R1's budget — one message a day", () => {
  it("stays silent on the trial's reminder day: the device sends that one", async () => {
    const userId = await onboard();
    // A trial expiring on the 22nd puts the one reminder on the 21st — the day before, no second
    // one (ieat-app#1591). The 20th is an ordinary evening again.
    await entitle(userId, "2026-08-22T10:00:00Z", true);
    await logMeal(userId, DAY, 900, 30);
    expect(await dailyNotification(deps, userId, "2026-08-21", NOW)).toBeNull();
    expect((await dailyNotification(deps, userId, "2026-08-20", NOW))?.id).toBe("evening");
  });

  it("sends the evening line on every other day of the trial", async () => {
    const userId = await onboard();
    await entitle(userId, "2026-08-22T10:00:00Z", true);
    const out = await dailyNotification(deps, userId, "2026-08-19", NOW);
    expect(out?.id).toBe("evening");
  });

  it("moves the reminder out of the way when the trial converts", async () => {
    const userId = await onboard();
    await entitle(userId, "2026-08-22T10:00:00Z", true);
    expect(await dailyNotification(deps, userId, "2026-08-21", NOW)).toBeNull();
    // The webhook writes a year's expiry. Nothing is cancelled anywhere: the reminder day is
    // recomputed from the new expiry and today stops being it.
    await entitle(userId, "2027-08-22T10:00:00Z");
    expect((await dailyNotification(deps, userId, "2026-08-21", NOW))?.id).toBe("evening");
  });

  it("falls back to the nudge once a cancelled trial has actually lapsed (#730)", async () => {
    const userId = await onboard();
    await entitle(userId, "2026-08-19T10:00:00Z", true);
    expect((await dailyNotification(deps, userId, "2026-08-20", NOW))?.id).toBe("nudge");
  });
});

describe("the admin's copy", () => {
  it("serves the compiled-in default until an admin saves something", async () => {
    expect(await notificationCopy(deps, "en")).toEqual(DEFAULT_NOTIFICATION_COPY);
  });

  it("saves valid copy and serves it", async () => {
    const edited = {
      ...DEFAULT_NOTIFICATION_COPY,
      "trial-end": { title: "Tomorrow it ends", body: "The day before the free trial ends." },
    };
    const out = await saveNotificationCopy(deps, edited, "en");
    expect(out.ok).toBe(true);
    expect((await notificationCopy(deps, "en"))["trial-end"].title).toBe("Tomorrow it ends");
  });

  it("refuses copy the composer cannot fill, and stores nothing", async () => {
    const out = await saveNotificationCopy(deps, {
      ...DEFAULT_NOTIFICATION_COPY,
      evening: { title: "Evening", body: "{eaten} of {plan}.", emptyBody: "Nothing. {plan} {tomorrow}" },
    }, "en");
    expect(out.ok).toBe(false);
    expect(await notificationCopy(deps, "en")).toEqual(DEFAULT_NOTIFICATION_COPY);
  });

  it("refuses a health claim on a lock screen", async () => {
    const out = await saveNotificationCopy(deps, {
      ...DEFAULT_NOTIFICATION_COPY,
      "trial-end": { title: "Last day", body: "One more week and this reverses your cholesterol." },
    }, "en");
    expect(out.ok).toBe(false);
  });

  it("restores the shipped copy", async () => {
    await saveNotificationCopy(deps, {
      ...DEFAULT_NOTIFICATION_COPY,
      "trial-end": { title: "Edited", body: "Edited body." },
    }, "en");
    expect(await resetNotificationCopy(deps, "en")).toEqual(DEFAULT_NOTIFICATION_COPY);
    expect(await notificationCopy(deps, "en")).toEqual(DEFAULT_NOTIFICATION_COPY);
  });

  it("composes a message that would itself pass the claims gate", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await logMeal(userId, DAY, 2600, 40);
    const out = (await dailyNotification(deps, userId, DAY, NOW))!;
    expect(lintCopy({ title: out.title, body: out.body })).toEqual([]);
  });
});

describe("a subscription is not a trial", () => {
  it("sends the evening line on the two days before a yearly renewal", async () => {
    const userId = await onboard();
    await entitle(userId, "2026-08-22T10:00:00Z", true);
    // The trial: silent on the 21st, because the phone speaks.
    expect(await dailyNotification(deps, userId, "2026-08-21", NOW)).toBeNull();

    const renewing = await onboard();
    // A year out, two days before the renewal DATE by the same arithmetic. It is not a trial end,
    // no reminder is scheduled on any phone, and going silent here would leave the two evenings
    // before every renewal empty for everybody who pays.
    await entitle(renewing, "2027-08-22T10:00:00Z");
    const then = Date.parse("2027-08-20T18:30:00Z");
    expect((await dailyNotification(deps, renewing, "2027-08-20", then))?.id).toBe("evening");
    expect((await dailyNotification(deps, renewing, "2027-08-21", then))?.id).toBe("evening");
  });
});

describe("copy stored before the code that reads it", () => {
  it("merges a saved revision over the shipped default, per message and per field", async () => {
    // What a row saved by an older server looks like once a field or a message is added: read
    // straight through, `fillNotification` takes `copy[id].title` off `undefined` and the composer
    // throws for EVERY account, one at a time, logging identical lines that name nothing.
    //
    // SEEDED rather than written, and rebuilt BEFORE `onboard()` so the account lands in this
    // store. `putNotificationCopy` takes one language now, so a bare revision with no language
    // dimension — and one missing fields this build requires — cannot go through the port at all.
    // Only an older server could have left this row, which is the case under test.
    store = memoryStore({
      seed: {
        notificationCopy: {
          evening: { title: "Kept", body: "{eaten}/{plan}. {tomorrow}" },
          // And a message a NEWER server wrote, which this code knows nothing about. It must not
          // survive the merge — which is why `merged` starts from the default, not from the row.
          "trial-day8": { title: "From the future", body: "Nothing here can render this." },
        },
      },
    });
    deps = { ...deps, store };
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);

    // Read as English, because that shape predates the language dimension and English was all
    // there was. A German reading the same host gets the shipped German, not this row.
    const copy = await notificationCopy(deps, "en");
    expect(Object.keys(copy).sort()).toEqual([...NOTIFICATION_IDS].sort());
    expect((await notificationCopy(deps, "de")).evening.title).toBe(NOTIFICATION_COPY.de!.evening.title);
    expect(copy.evening.title).toBe("Kept");
    expect(copy.evening.emptyBody).toBe(DEFAULT_NOTIFICATION_COPY.evening.emptyBody);
    expect(copy["trial-end"]).toEqual(DEFAULT_NOTIFICATION_COPY["trial-end"]);

    const out = await dailyNotification(deps, userId, DAY, NOW);
    expect(out?.body).toContain("Nothing logged");
  });
});

