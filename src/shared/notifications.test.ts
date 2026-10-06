import { describe, expect, it } from "bun:test";
import { lintCopy } from "./claims.ts";
import { trialReminder, trialReminderDate } from "./entitlement.ts";
import {
  DEFAULT_NOTIFICATION_COPY, NOTIFICATION_IDS, REMINDER_TIME, dailyMessage, eveningPrescription,
  fillNotification, reminderPlan, validateNotificationCopy,
} from "./notifications.ts";

const at = (iso: string) => Date.parse(iso);

describe("trialReminderDate", () => {
  it("puts the one reminder the day before the expiry date", () => {
    // A trial bought on the 25th at noon Berlin expires seven days later.
    expect(trialReminderDate("2026-09-01T12:00:00Z", "Europe/Berlin", at("2026-08-25T12:00:00Z")))
      .toBe("2026-08-31");
  });

  it("computes the expiry date in the given zone, not in UTC", () => {
    // 23:30 UTC on the 31st is already the 1st in Berlin (+02:00) and still the 31st in New York.
    expect(trialReminderDate("2026-08-31T23:30:00Z", "Europe/Berlin", at("2026-08-25T00:00:00Z")))
      .toBe("2026-08-31");
    expect(trialReminderDate("2026-08-31T23:30:00Z", "America/New_York", at("2026-08-25T00:00:00Z")))
      .toBe("2026-08-30");
  });

  it("subtracts the calendar day across a DST transition", () => {
    // Europe/Berlin leaves summer time on 2026-10-25. A fixed 24-hour span lands on the wrong day.
    expect(trialReminderDate("2026-10-26T09:00:00Z", "Europe/Berlin", at("2026-10-19T09:00:00Z")))
      .toBe("2026-10-25");
  });

  it("is null for an absent, unparseable or already-past expiry", () => {
    expect(trialReminderDate(null, "Europe/Berlin", at("2026-08-25T12:00:00Z"))).toBeNull();
    expect(trialReminderDate("not a date", "Europe/Berlin", at("2026-08-25T12:00:00Z"))).toBeNull();
    expect(trialReminderDate("2026-08-01T12:00:00Z", "Europe/Berlin", at("2026-08-25T12:00:00Z"))).toBeNull();
  });

  it("never returns a date on or after the expiry date", () => {
    // "Never the day after it ends", whatever the trial's length: one day before, every time.
    expect(trialReminderDate("2026-09-01T00:30:00+02:00", "Europe/Berlin", at("2026-08-25T00:00:00Z"))!)
      .toBe("2026-08-31");
    expect(trialReminderDate("2026-08-28T12:00:00Z", "Europe/Berlin", at("2026-08-25T00:00:00Z"))!)
      .toBe("2026-08-27");
  });
});

describe("dailyMessage — R1's one message a day", () => {
  const reminder = "2026-08-31";

  it("sends the reminder on the reminder day, not the evening line", () => {
    expect(dailyMessage("2026-08-31", reminder)).toBe("trial-end");
  });

  it("sends the evening line on every other day", () => {
    expect(dailyMessage("2026-08-29", reminder)).toBe("evening");
    expect(dailyMessage("2026-08-30", reminder)).toBe("evening");
    expect(dailyMessage("2026-09-02", reminder)).toBe("evening");
    expect(dailyMessage("2026-08-31", null)).toBe("evening");
  });

  it("only ever names one message", () => {
    for (const date of ["2026-08-29", "2026-08-30", "2026-08-31", "2026-09-01"]) {
      expect(NOTIFICATION_IDS).toContain(dailyMessage(date, reminder));
    }
  });
});

describe("the copy", () => {
  it("fires at 20:30", () => {
    expect(REMINDER_TIME).toEqual({ hour: 20, minute: 30 });
  });

  it("ships a message for every id", () => {
    for (const id of NOTIFICATION_IDS) {
      expect(DEFAULT_NOTIFICATION_COPY[id].title.trim()).not.toBe("");
      expect(DEFAULT_NOTIFICATION_COPY[id].body.trim()).not.toBe("");
    }
  });

  it("carries a nothing-logged variant of the evening line", () => {
    expect(DEFAULT_NOTIFICATION_COPY.evening.emptyBody).toBeTruthy();
  });

  it("makes no health claim", () => {
    const fields: Record<string, string> = {};
    for (const id of NOTIFICATION_IDS) {
      fields[`${id}.title`] = DEFAULT_NOTIFICATION_COPY[id].title;
      fields[`${id}.body`] = DEFAULT_NOTIFICATION_COPY[id].body;
    }
    fields["evening.emptyBody"] = DEFAULT_NOTIFICATION_COPY.evening.emptyBody!;
    expect(lintCopy(fields)).toEqual([]);
  });

  it("validates the shipped default", () => {
    const out = validateNotificationCopy(DEFAULT_NOTIFICATION_COPY);
    expect(out.ok).toBe(true);
  });
});

describe("validateNotificationCopy", () => {
  const clone = () => JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_COPY)) as Record<string, { title: string; body: string; emptyBody?: string }>;

  it("refuses anything that is not an object", () => {
    expect(validateNotificationCopy(null).ok).toBe(false);
    expect(validateNotificationCopy("copy").ok).toBe(false);
  });

  it("refuses a missing message", () => {
    const c = clone();
    delete c["trial-end"];
    const out = validateNotificationCopy(c);
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.errors.join(" ")).toContain("trial-end");
  });

  it("refuses an unknown message", () => {
    const c = clone() as Record<string, unknown>;
    c["trial-day8"] = { title: "Hi", body: "There" };
    expect(validateNotificationCopy(c).ok).toBe(false);
  });

  it("refuses an evening body that drops a placeholder", () => {
    const c = clone();
    c.evening!.body = "{eaten} of your {plan}kcal today.";
    const out = validateNotificationCopy(c);
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.errors.join(" ")).toContain("tomorrow");
  });

  it("refuses a placeholder the composer cannot fill", () => {
    const c = clone();
    c.evening!.body = "{eaten} of your {plan}kcal today. {tomorrow} {weight}";
    expect(validateNotificationCopy(c).ok).toBe(false);
  });

  it("refuses an eaten placeholder in the nothing-logged variant", () => {
    const c = clone();
    c.evening!.emptyBody = "{eaten} of your {plan}kcal today. {tomorrow}";
    expect(validateNotificationCopy(c).ok).toBe(false);
  });

  it("refuses a placeholder in a title", () => {
    const c = clone();
    c.evening!.title = "Today against the {plan}";
    expect(validateNotificationCopy(c).ok).toBe(false);
  });

  it("refuses a health claim", () => {
    const c = clone();
    c["trial-end"]!.body = "It ends tomorrow — a week of this reverses your cholesterol.";
    const out = validateNotificationCopy(c);
    expect(out.ok).toBe(false);
    expect(out.ok === false && out.errors.join(" ")).toContain("claim");
  });

  it("refuses an over-long line", () => {
    const c = clone();
    c["trial-end"]!.title = "x".repeat(500);
    expect(validateNotificationCopy(c).ok).toBe(false);
  });

  it("refuses an empty line", () => {
    const c = clone();
    c["trial-end"]!.body = "   ";
    expect(validateNotificationCopy(c).ok).toBe(false);
  });
});

describe("fillNotification", () => {
  it("fills the declared placeholders", () => {
    const out = fillNotification(DEFAULT_NOTIFICATION_COPY, "evening", {
      eaten: "1,800", plan: "2,100", tomorrow: "Protein ran 40g short.",
    });
    expect(out.body).toContain("1,800");
    expect(out.body).toContain("2,100");
    expect(out.body).toContain("Protein ran 40g short.");
    expect(out.body).not.toContain("{");
  });

  it("uses the nothing-logged variant when told to", () => {
    const out = fillNotification(DEFAULT_NOTIFICATION_COPY, "evening", {
      plan: "2,100", tomorrow: "One photo tomorrow starts it.",
    }, { empty: true });
    expect(out.body).toBe(
      DEFAULT_NOTIFICATION_COPY.evening.emptyBody!
        .replace("{plan}", "2,100").replace("{tomorrow}", "One photo tomorrow starts it."),
    );
  });

  it("leaves a reminder alone", () => {
    const out = fillNotification(DEFAULT_NOTIFICATION_COPY, "trial-end", {});
    expect(out).toEqual(DEFAULT_NOTIFICATION_COPY["trial-end"]);
  });
});

describe("eveningPrescription", () => {
  const targets = { kcal: 2100, protein_g: 130, fat_g: 70, carbs_g: 262 };

  it("names the protein gap when it is the biggest one", () => {
    const line = eveningPrescription({
      targets, totals: { kcal: 1900, protein_g: 80 }, goal: "lose", meals: 3,
    }, "en");
    expect(line).toContain("50");
    expect(line.toLowerCase()).toContain("protein");
  });

  it("says so when the day went over", () => {
    const line = eveningPrescription({
      targets, totals: { kcal: 2600, protein_g: 140 }, goal: "lose", meals: 4,
    }, "en");
    expect(line).toContain("500");
  });

  it("has something to say on a day that landed on plan", () => {
    const line = eveningPrescription({
      targets, totals: { kcal: 2050, protein_g: 132 }, goal: "lose", meals: 3,
    }, "en");
    expect(line.trim()).not.toBe("");
  });

  it("asks for one photo when nothing was logged", () => {
    const line = eveningPrescription({
      targets, totals: { kcal: 0, protein_g: 0 }, goal: "lose", meals: 0,
    }, "en");
    // Named, not merely non-empty: delete the `meals === 0` branch and the protein branch answers
    // instead — a different sentence, still non-empty, and the test would have stayed green.
    expect(line).toContain("photo");
  });

  it("never makes a health claim, whatever the day was", () => {
    const fields: Record<string, string> = {};
    for (const kcal of [0, 500, 1900, 2100, 2600, 4000]) {
      for (const protein of [0, 40, 130, 200]) {
        for (const goal of ["lose", "maintain", "gain"] as const) {
          for (const meals of [0, 1, 5]) {
            fields[`${kcal}-${protein}-${goal}-${meals}`] =
              eveningPrescription({ targets, totals: { kcal, protein_g: protein }, goal, meals }, "en");
          }
        }
      }
    }
    expect(lintCopy(fields)).toEqual([]);
  });
});

// The app schedules the one reminder locally; the SERVER reads the same answer to decide which
// day the 20:30 line stays silent on.
describe("reminderPlan", () => {
  const TZ = "Europe/Berlin";
  const on = (iso: string) => new Date(iso);

  it("gives nothing to an account that has never bought anything", () => {
    expect(reminderPlan({ active: false, expiresAt: null, trial: false }, TZ, on("2026-08-25T10:00:00Z"))).toEqual([]);
  });

  it("schedules exactly one reminder — the day before the end", () => {
    expect(reminderPlan({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: true }, TZ, on("2026-08-25T10:00:00Z")))
      .toEqual([{ id: "trial-end", date: "2026-08-31" }]);
    // And a three-day trial gets the same ONE reminder, on the same "day before" boundary.
    expect(reminderPlan({ active: true, expiresAt: "2026-08-28T10:00:00Z", trial: true }, TZ, on("2026-08-25T10:00:00Z")))
      .toEqual([{ id: "trial-end", date: "2026-08-27" }]);
  });

  it("never puts a reminder on or after the day the trial ends", () => {
    const plan = reminderPlan({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: true }, TZ, on("2026-08-25T10:00:00Z"));
    for (const { date } of plan) expect(date < "2026-09-01").toBe(true);
  });

  it("schedules nothing for an expiry already past, or one that does not parse", () => {
    expect(reminderPlan({ active: false, expiresAt: "2026-08-20T10:00:00Z", trial: true }, TZ, on("2026-08-25T10:00:00Z"))).toEqual([]);
    expect(reminderPlan({ active: true, expiresAt: "not a date", trial: true }, TZ, on("2026-08-25T10:00:00Z"))).toEqual([]);
  });

  it("treats a subscription's renewal date as what it is, not as a trial end", () => {
    // The failure the flag exists for. A duration heuristic cannot catch the second case: the day
    // before a renewal and the day before a trial ending are the same day.
    expect(reminderPlan({ active: true, expiresAt: "2027-09-01T10:00:00Z", trial: false }, TZ, on("2026-09-01T09:00:00Z"))).toEqual([]);
    expect(reminderPlan({ active: true, expiresAt: "2026-09-24T10:00:00Z", trial: false }, TZ, on("2026-08-25T10:00:00Z"))).toEqual([]);
    expect(trialReminder({ active: true, expiresAt: "2027-09-01T10:00:00Z", trial: false }, TZ, Date.parse("2026-09-01T09:00:00Z"))).toBeNull();
    // One day out and paid: still not a trial, and still no reminder.
    expect(trialReminder({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: false }, TZ, Date.parse("2026-08-30T09:00:00Z"))).toBeNull();
    expect(reminderPlan({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: false }, TZ, on("2026-08-30T09:00:00Z"))).toEqual([]);
  });

  it("drops a reminder day that is already behind, rather than scheduling one that cannot fire", () => {
    // Opened on the reminder date itself: it still stands.
    expect(reminderPlan({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: true }, TZ, on("2026-08-31T09:00:00Z")))
      .toEqual([{ id: "trial-end", date: "2026-08-31" }]);
    // Opened on the expiry day or after: nothing.
    expect(reminderPlan({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: true }, TZ, on("2026-09-01T09:00:00Z"))).toEqual([]);
    expect(reminderPlan({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: true }, TZ, on("2026-09-02T09:00:00Z"))).toEqual([]);
  });

  it("drops today's reminder once today's slot has passed", () => {
    // 21:00 Berlin on the reminder date. iOS accepts a calendar trigger whose components are behind
    // it and then never fires it, so scheduling one leaves `getAllScheduledNotificationsAsync`
    // claiming a reminder that cannot arrive — and the server is silent on that date too, so the
    // day the budget says one message would deliver none.
    expect(reminderPlan({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: true }, TZ, on("2026-08-31T19:00:00Z")))
      .toEqual([]);
    // 19:00 Berlin the same day: 20:30 is still ahead, so it stands.
    expect(reminderPlan({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: true }, TZ, on("2026-08-31T17:00:00Z")))
      .toEqual([{ id: "trial-end", date: "2026-08-31" }]);
    // Exactly 20:30 counts as gone: the slot is the instant, and scheduling a trigger for the
    // moment that is passing is the side of the race that produces a notification nobody gets.
    expect(reminderPlan({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: true }, TZ, on("2026-08-31T18:30:00Z")))
      .toEqual([]);
    // And one minute before it, it stands.
    expect(reminderPlan({ active: true, expiresAt: "2026-09-01T10:00:00Z", trial: true }, TZ, on("2026-08-31T18:29:00Z")))
      .toHaveLength(1);
  });

  it("lets the zone decide the day, not UTC", () => {
    // 22:30 UTC on the 31st is 00:30 on the 1st in Berlin: the trial ends on 2026-09-01 there.
    const plan = reminderPlan({ active: true, expiresAt: "2026-08-31T22:30:00Z", trial: true }, TZ, on("2026-08-25T10:00:00Z"));
    expect(plan.at(-1)).toEqual({ id: "trial-end", date: "2026-08-31" });
  });

  it("does not move a date across a DST transition inside the window", () => {
    expect(reminderPlan({ active: true, expiresAt: "2026-10-29T10:00:00Z", trial: true }, TZ, on("2026-10-22T10:00:00Z")))
      .toEqual([{ id: "trial-end", date: "2026-10-28" }]);
  });
});
