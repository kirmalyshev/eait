import { beforeEach, describe, expect, it } from "bun:test";
import { DEFAULT_NOTIFICATION_COPY, NOTIFICATION_COPY, NOTIFICATION_IDS, lintCopy } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush, type FakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { patchProfile, type EngineDeps } from "./index.ts";
import {
  collectPushReceipts, dailyNotification, eveningSweep, msUntilNextEveningLine, notificationCopy,
  resetNotificationCopy, saveNotificationCopy,
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
  deps = { store, config: CONFIG, llm: demoPorts(), mailer: fakeMailer(), push };
});

/** A fully onboarded user. Returns the id. */
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

let eventSeq = 0;
/**
 * A live entitlement, as the RevenueCat webhook would have written it.
 *
 * `trial` is the whole difference between the two reminder days and an ordinary evening: an expiry
 * two days out says nothing about which, so every test here has to state what it is testing.
 */
async function entitle(userId: string, expiresAt: string, trial = false): Promise<void> {
  await store.putEntitlement(userId, {
    expiresAt, productId: "com.eait.fit.ios.yearly", trial,
    eventAt: new Date(Date.now() + ++eventSeq * 1000).toISOString(),
  });
}

async function logMeal(
  userId: string,
  date: string,
  kcal: number,
  protein: number,
  // #28: a plate the analyzer could not read. The day it lands in is a guessed day, and the
  // evening line's precision is what says so.
  over: { confidence?: string; corrected?: boolean } = {},
): Promise<void> {
  await store.insertMeal({
    id: crypto.randomUUID(), user_id: userId, ts: `${date}T12:00:00.000Z`, date,
    isFood: true, items: [{ name: "Rice", grams: 200 }], kcal, protein_g: protein,
    carbs_g: 50, fat_g: 10, satfat_g: 2, fiber_g: 3, sugar_g: 4, sodium_mg: 300,
    verdicts: {}, confidence: "high", notes: "", corrected: false, model: "test", ...over,
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
    expect(out.body).toContain("1,600");
    // The plan, as the same function that computes the diary's target computes it.
    expect(out.body).toMatch(/of your [\d,]+ kcal today/);
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
    expect(out.body).not.toContain("2,000");
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
        guessedBody: "Ate about {eaten}, planned {plan}. {tomorrow}",
      },
    }, "en");
    const out = (await dailyNotification(deps, userId, DAY, NOW))!;
    expect(out.title).toBe("Your evening line");
    expect(out.body.startsWith("Ate 900, planned ")).toBe(true);
  });

  it("hedges the day and loses the digits it did not earn when a meal was a guess (#28)", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await logMeal(userId, DAY, 900, 30);
    await logMeal(userId, DAY, 712, 25, { confidence: "low" });
    const out = (await dailyNotification(deps, userId, DAY, NOW))!;
    // 1,612 on the nose would claim a precision one of those meals does not have.
    expect(out.body.startsWith("About 1,610 of your ")).toBe(true);
    expect(out.body).toContain("one meal was a guess");
    expect(out.body).not.toContain("{");
  });

  it("stops hedging once the guess has been answered", async () => {
    // `corrected` is what an edit sets, and it is the half of `mealIsGuessed` that settles a
    // meal. Without it the line goes on saying "about" about grams the person typed.
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await logMeal(userId, DAY, 900, 30);
    await logMeal(userId, DAY, 712, 25, { confidence: "low", corrected: true });
    const out = (await dailyNotification(deps, userId, DAY, NOW))!;
    expect(out.body.startsWith("1,612 of your ")).toBe(true);
    expect(out.body).not.toContain("About");
  });

  it("says nothing to an account that never onboarded", async () => {
    const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
    await entitle(userId, PAID_UNTIL);
    expect(await dailyNotification(deps, userId, DAY, NOW)).toBeNull();
  });

  it("says nothing to an account with no live entitlement — the line is what a subscription buys", async () => {
    const userId = await onboard();
    expect(await dailyNotification(deps, userId, DAY, NOW)).toBeNull();
    await entitle(userId, "2026-08-01T00:00:00.000Z");
    expect(await dailyNotification(deps, userId, DAY, NOW)).toBeNull();
  });
});

describe("R1's budget — one message a day", () => {
  it("stays silent on a trial reminder day: the device sends that one", async () => {
    const userId = await onboard();
    // A trial expiring on the 22nd puts day 6 on the 21st and day 5 on the 20th.
    await entitle(userId, "2026-08-22T10:00:00Z", true);
    await logMeal(userId, DAY, 900, 30);
    expect(await dailyNotification(deps, userId, "2026-08-20", NOW)).toBeNull();
    expect(await dailyNotification(deps, userId, "2026-08-21", NOW)).toBeNull();
  });

  it("sends the evening line on every other day of the trial", async () => {
    const userId = await onboard();
    await entitle(userId, "2026-08-22T10:00:00Z", true);
    const out = await dailyNotification(deps, userId, "2026-08-19", NOW);
    expect(out?.id).toBe("evening");
  });

  it("moves the reminders out of the way when the trial converts", async () => {
    const userId = await onboard();
    await entitle(userId, "2026-08-22T10:00:00Z", true);
    expect(await dailyNotification(deps, userId, "2026-08-20", NOW)).toBeNull();
    // The webhook writes a year's expiry. Nothing is cancelled anywhere: the reminder days are
    // recomputed from the new expiry and today stops being one of them.
    await entitle(userId, "2027-08-22T10:00:00Z");
    expect((await dailyNotification(deps, userId, "2026-08-20", NOW))?.id).toBe("evening");
  });

  it("says nothing once a cancelled trial has actually lapsed", async () => {
    const userId = await onboard();
    await entitle(userId, "2026-08-19T10:00:00Z", true);
    expect(await dailyNotification(deps, userId, "2026-08-20", NOW)).toBeNull();
  });
});

describe("the evening sweep", () => {
  async function subscriberWithDevice(token: string): Promise<string> {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await store.putPushToken(userId, token, "ios");
    return userId;
  }

  it("sends one message per device, to the accounts that have one", async () => {
    const a = await subscriberWithDevice("ExponentPushToken[aaa]");
    await store.putPushToken(a, "ExponentPushToken[aaa2]", "ios");
    await subscriberWithDevice("ExponentPushToken[bbb]");
    // An account with no device is not visited at all.
    const c = await onboard();
    await entitle(c, PAID_UNTIL);

    const out = await eveningSweep(deps, { date: DAY, now: NOW });
    expect(out.sent).toBe(3);
    expect(push.sent.map((m) => m.to).sort()).toEqual(
      ["ExponentPushToken[aaa]", "ExponentPushToken[aaa2]", "ExponentPushToken[bbb]"].sort(),
    );
  });

  it("skips an account that has nothing to be told today", async () => {
    const trial = await onboard();
    await entitle(trial, "2026-08-22T10:00:00Z", true);
    await store.putPushToken(trial, "ExponentPushToken[trial]", "ios");
    await subscriberWithDevice("ExponentPushToken[paid]");

    const out = await eveningSweep(deps, { date: DAY, now: NOW });
    expect(out.sent).toBe(1);
    expect(out.skipped).toBe(1);
    expect(push.sent.map((m) => m.to)).toEqual(["ExponentPushToken[paid]"]);
  });

  it("drops a token the push service says is gone, and keeps the others", async () => {
    const userId = await subscriberWithDevice("ExponentPushToken[dead]");
    await store.putPushToken(userId, "ExponentPushToken[alive]", "ios");
    push.unregister("ExponentPushToken[dead]");

    const out = await eveningSweep(deps, { date: DAY, now: NOW });
    expect(out.dropped).toBe(1);
    expect((await store.pushTokensFor(userId)).map((t) => t.token)).toEqual(["ExponentPushToken[alive]"]);
  });

  it("drops a token a RECEIPT says is gone, minutes after the send was accepted", async () => {
    const userId = await subscriberWithDevice("ExponentPushToken[gone-later]");
    const out = await eveningSweep(deps, { date: DAY, now: NOW });
    expect(out.dropped).toBe(0);
    expect(await store.pushTokensFor(userId)).toHaveLength(1);

    push.unregisterReceipt(out.tickets[0]!.id!);
    expect(await collectPushReceipts(deps, out.tickets)).toBe(1);
    expect(await store.pushTokensFor(userId)).toEqual([]);
  });

  it("keeps a token a receipt merely failed to deliver to", async () => {
    const userId = await subscriberWithDevice("ExponentPushToken[flaky]");
    const out = await eveningSweep(deps, { date: DAY, now: NOW });
    push.failReceipt(out.tickets[0]!.id!);
    expect(await collectPushReceipts(deps, out.tickets)).toBe(0);
    expect(await store.pushTokensFor(userId)).toHaveLength(1);
  });

  it("counts every message as failed when the push service is down", async () => {
    await subscriberWithDevice("ExponentPushToken[first]");
    await subscriberWithDevice("ExponentPushToken[second]");
    push.failNext();
    const out = await eveningSweep(deps, { date: DAY, now: NOW });
    expect(out.failed).toBeGreaterThan(0);
    expect(out.sent + out.failed).toBe(2);
  });

  it("never puts a user's own words on a lock screen", async () => {
    const userId = await subscriberWithDevice("ExponentPushToken[private]");
    await store.patchProfile(userId, { medical_limitations: "stage 3 kidney disease" });
    await logMeal(userId, DAY, 900, 30);
    await eveningSweep(deps, { date: DAY, now: NOW });
    for (const m of push.sent) {
      expect(m.body).not.toContain("kidney");
      expect(m.title + m.body).not.toContain("stage 3");
    }
  });
});

describe("the admin's copy", () => {
  it("serves the compiled-in default until an admin saves something", async () => {
    expect(await notificationCopy(deps, "en")).toEqual(DEFAULT_NOTIFICATION_COPY);
  });

  it("saves valid copy and serves it", async () => {
    const edited = {
      ...DEFAULT_NOTIFICATION_COPY,
      "trial-day5": { title: "Two days to go", body: "Two days before the free week ends." },
    };
    const out = await saveNotificationCopy(deps, edited, "en");
    expect(out.ok).toBe(true);
    expect((await notificationCopy(deps, "en"))["trial-day5"].title).toBe("Two days to go");
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
      "trial-day6": { title: "Last day", body: "One more week and this reverses your cholesterol." },
    }, "en");
    expect(out.ok).toBe(false);
  });

  it("restores the shipped copy", async () => {
    await saveNotificationCopy(deps, {
      ...DEFAULT_NOTIFICATION_COPY,
      "trial-day5": { title: "Edited", body: "Edited body." },
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

describe("msUntilNextEveningLine", () => {
  const TIME = { hour: 20, minute: 30 };
  const at = (iso: string) => Date.parse(iso);
  const fire = (nowIso: string, zone = "Europe/Berlin") =>
    new Date(at(nowIso) + msUntilNextEveningLine(zone, TIME, at(nowIso))).toISOString();

  it("fires this evening when the time is still ahead", () => {
    // 18:30 Berlin (CEST, +02:00) — 20:30 local is 18:30Z.
    expect(fire("2026-08-20T10:00:00Z")).toBe("2026-08-20T18:30:00.000Z");
  });

  it("fires tomorrow once the time has passed", () => {
    expect(fire("2026-08-20T18:30:00.000Z")).toBe("2026-08-21T18:30:00.000Z");
    expect(fire("2026-08-20T22:00:00Z")).toBe("2026-08-21T18:30:00.000Z");
  });

  it("stays at 20:30 LOCAL across a DST transition, which a 24-hour interval does not", () => {
    // Europe/Berlin leaves summer time at 03:00 on 2026-10-25: +02:00 becomes +01:00.
    // 21:00 local on the evening before the change (+02:00), so the next one is the day the
    // change happens — at 19:30Z, because by then the zone is +01:00.
    expect(fire("2026-10-24T19:00:00Z")).toBe("2026-10-25T19:30:00.000Z");
    // 21:00 local on the day of the change (+01:00): the next one is the day after, also 19:30Z.
    expect(fire("2026-10-25T20:00:00Z")).toBe("2026-10-26T19:30:00.000Z");
    // The evening BEFORE the change is 18:30Z; the one after is 19:30Z. A fixed 24-hour timer
    // would have fired the second at 18:30Z, which is 19:30 local — an hour early, for months.
    expect(fire("2026-10-24T10:00:00Z")).toBe("2026-10-24T18:30:00.000Z");
  });

  it("works in a zone that is behind UTC", () => {
    expect(fire("2026-08-20T10:00:00Z", "America/New_York")).toBe("2026-08-21T00:30:00.000Z");
  });

  it("never returns a wait in the past", () => {
    for (const iso of ["2026-01-01T00:00:00Z", "2026-03-29T01:30:00Z", "2026-10-25T00:30:00Z"]) {
      expect(msUntilNextEveningLine("Europe/Berlin", TIME, at(iso))).toBeGreaterThan(0);
    }
  });
});

describe("a subscription is not a trial", () => {
  it("sends the evening line on the two days before a yearly renewal", async () => {
    const userId = await onboard();
    await entitle(userId, "2026-08-22T10:00:00Z", true);
    // The trial: silent on the 20th, because the phone speaks.
    expect(await dailyNotification(deps, userId, "2026-08-20", NOW)).toBeNull();

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

describe("the sweep reports every night", () => {
  it("logs its counts even when nothing qualified", async () => {
    // A run that says nothing is indistinguishable from a run that did not happen, and a timer
    // firing once a day is the part of this with nothing else watching it.
    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => { lines.push(args.join(" ")); };
    try {
      const userId = await onboard();
      await store.putPushToken(userId, "ExponentPushToken[unpaid]", "ios");
      const out = await eveningSweep(deps, { date: DAY, now: NOW });
      expect(out.sent).toBe(0);
      expect(out.skipped).toBe(1);
    } finally {
      console.log = log;
    }
    expect(lines.filter((l) => l.includes("evening sweep")).length).toBe(1);
  });
});

describe("one bad account is not the whole night", () => {
  it("keeps sweeping when composing a message throws for one user", async () => {
    const good = await onboard();
    const bad = await onboard();
    await entitle(good, PAID_UNTIL);
    await entitle(bad, PAID_UNTIL);
    await store.putPushToken(good, "ExponentPushToken[good]", "ios");
    await store.putPushToken(bad, "ExponentPushToken[bad]", "ios");

    // A transient database error, or a legacy profile row `explainTargets` was not written for.
    // Whatever it is, it is ONE account's problem: without the guard the exception leaves
    // `eveningSweep` before anything is sent, and every other subscriber's evening line — already
    // composed, in memory — goes in the bin with it.
    const failing = {
      ...store,
      getProfile: async (userId: string) => {
        if (userId === bad) throw new Error("relation \"profiles\" does not exist");
        return store.getProfile(userId);
      },
    };

    const out = await eveningSweep({ ...deps, store: failing }, { date: DAY, now: NOW });
    expect(out.sent).toBe(1);
    expect(out.failed).toBe(1);
    expect(push.sent.map((m) => m.to)).toEqual(["ExponentPushToken[good]"]);
  });

  it("still reports the night when EVERY account throws", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await store.putPushToken(userId, "ExponentPushToken[doomed]", "ios");
    const failing = { ...store, getEntitlement: async () => { throw new Error("connection reset"); } };

    const lines: string[] = [];
    const log = console.log;
    console.log = (...args: unknown[]) => { lines.push(args.join(" ")); };
    try {
      const out = await eveningSweep({ ...deps, store: failing }, { date: DAY, now: NOW });
      expect(out.failed).toBe(1);
      expect(out.sent).toBe(0);
    } finally {
      console.log = log;
    }
    expect(lines.filter((l) => l.includes("evening sweep")).length).toBe(1);
  });

  it("names no account and no device when it logs the failure", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await store.putPushToken(userId, "ExponentPushToken[private-device]", "ios");
    const failing = { ...store, getProfile: async () => { throw new Error("boom"); } };

    const lines: string[] = [];
    const err = console.error;
    console.error = (...args: unknown[]) => { lines.push(args.join(" ")); };
    try {
      await eveningSweep({ ...deps, store: failing }, { date: DAY, now: NOW });
    } finally {
      console.error = err;
    }
    // The rule the rest of this file follows: counts, never a token and never an id.
    for (const line of lines) {
      expect(line).not.toContain(userId);
      expect(line).not.toContain("private-device");
    }
  });
});

describe("dropping a dead token costs one write, not a scan", () => {
  it("deletes through the scoped write using the owner the sweep already knew", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await store.putPushToken(userId, "ExponentPushToken[dead-one]", "ios");
    await store.putPushToken(userId, "ExponentPushToken[alive-one]", "ios");
    push.unregister("ExponentPushToken[dead-one]");

    // The old implementation asked `usersWithPushTokens` + `pushTokensFor` per dead token, which is
    // one query per account with a device, per dead token, inside the nightly sweep.
    let scans = 0;
    const counted = { ...store, usersWithPushTokens: async () => { scans++; return store.usersWithPushTokens(); } };

    const out = await eveningSweep({ ...deps, store: counted }, { date: DAY, now: NOW });
    expect(out.dropped).toBe(1);
    expect(scans).toBe(1);
    expect((await store.pushTokensFor(userId)).map((t) => t.token)).toEqual(["ExponentPushToken[alive-one]"]);
  });

  it("does the same on the receipt pass, fifteen minutes later", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await store.putPushToken(userId, "ExponentPushToken[gone-by-receipt]", "ios");
    const out = await eveningSweep(deps, { date: DAY, now: NOW });
    expect(out.tickets[0]!.userId).toBe(userId);

    push.unregisterReceipt(out.tickets[0]!.id!);
    let scans = 0;
    const counted = { ...store, usersWithPushTokens: async () => { scans++; return store.usersWithPushTokens(); } };
    expect(await collectPushReceipts({ ...deps, store: counted }, out.tickets)).toBe(1);
    expect(scans).toBe(0);
    expect(await store.pushTokensFor(userId)).toEqual([]);
  });

  it("acts on no ticket for a token this sweep did not send", async () => {
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await store.putPushToken(userId, "ExponentPushToken[mine]", "ios");
    // A push service inventing a ticket must not be able to delete a row. It cannot happen against
    // a correct one; acting on it would be deleting somebody's device on a stranger's say-so.
    const liar = {
      ...push,
      send: async () => [{ token: "ExponentPushToken[not-ours]", id: null, error: "device-not-registered" as const }],
    };
    const out = await eveningSweep({ ...deps, push: liar }, { date: DAY, now: NOW });
    expect(out.dropped).toBe(0);
    expect(await store.pushTokensFor(userId)).toHaveLength(1);
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
    expect(copy["trial-day5"]).toEqual(DEFAULT_NOTIFICATION_COPY["trial-day5"]);

    const out = await dailyNotification(deps, userId, DAY, NOW);
    expect(out?.body).toContain("Nothing logged");
  });
});

describe("a batch the push service refused", () => {
  it("counts every refused message and keeps its token", async () => {
    // The shape `expoPush` ACTUALLY produces for a failed chunk, which `failNext` does not model:
    // it cannot throw any more, because every path inside its chunk loop is caught. A fake may be
    // poorer than the real thing, never different in a way a test can see — so the sweep is driven
    // with the real shape here, and `failNext` keeps covering the port's permission to throw.
    const userId = await onboard();
    await entitle(userId, PAID_UNTIL);
    await store.putPushToken(userId, "ExponentPushToken[refused-a]", "ios");
    await store.putPushToken(userId, "ExponentPushToken[refused-b]", "ios");

    const refusing = {
      ...push,
      send: async (messages: { to: string }[]) =>
        messages.map((m) => ({ token: m.to, id: null, error: "other" as const })),
    };

    const out = await eveningSweep({ ...deps, push: refusing }, { date: DAY, now: NOW });
    expect(out.sent).toBe(0);
    expect(out.failed).toBe(2);
    expect(out.dropped).toBe(0);
    expect(out.tickets).toEqual([]);
    // A provider having a bad night is not a phone that has gone away.
    expect(await store.pushTokensFor(userId)).toHaveLength(2);
  });
});
