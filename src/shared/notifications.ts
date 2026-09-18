// The three messages this product is allowed to send, and the arithmetic that decides which.
//
// copy.md § Step 15 promises exactly three: "I'll remind you on day five and the day before it
// ends, never the day after", and "At 20:30 you get one line — today against the plan, and one
// concrete thing for tomorrow." Nothing else may be sent, and R1's budget
// (`marketing/specs/2026-07-22-retention-plan.md` § 5) is one outbound message a day INCLUDING the
// two reminders — which is what `dailyMessage` is: a reminder day emits the reminder INSTEAD OF the
// evening line, never as well as it.
//
// It lives in shared because both sides need the same answers. The phone schedules the two trial
// reminders LOCALLY, off `entitlement.expiresAt`, so it can fire them with no network and cancel
// them the moment the server says the trial converted; the server composes and pushes the 20:30
// line, because a local notification cannot carry a sentence about a day it has not seen. Two
// implementations of "which day is day five" would drift silently, and the symptom would be a
// reminder on the day after — the one thing the copy promises never happens.
//
// The WORDS are admin-editable and the SHAPE is not, the same split onboarding content makes:
// `validateNotificationCopy` runs on the WRITE, so a placeholder the composer cannot fill or a
// health claim never reaches a lock screen.

import { lintCopy } from "./claims.ts";
import { dateMinus, localDate, localTime } from "./dates.ts";
import type { Entitlement } from "./entitlement.ts";
import type { FoodTargets, Goal } from "./types.ts";

/** Every message that may be sent. Adding one is a product decision, not a copy edit. */
export const NOTIFICATION_IDS = ["trial-day5", "trial-day6", "evening"] as const;
export type NotificationId = (typeof NOTIFICATION_IDS)[number];

export interface NotificationMessage {
  title: string;
  body: string;
  /**
   * `evening` only: the body for a day with nothing logged.
   *
   * A separate string rather than a clever substitution, because "0 of your 2,100 kcal today" is
   * an accusation and the recovery framing R1 asks for is a different sentence, not a smaller
   * number. It cannot carry `{eaten}` — there is nothing eaten — and the validator says so.
   */
  emptyBody?: string;
}

export type NotificationCopy = Record<NotificationId, NotificationMessage>;

/**
 * What each field may interpolate, and what it MUST.
 *
 * Same discipline as `SCRIPTED_PARAMS` in `chat.ts`: the composer fills a declared set, so an
 * admin cannot introduce a placeholder that renders as a literal `{weight}` on somebody's lock
 * screen, and cannot delete one the sentence needs to mean anything. Titles take none — a title is
 * read at a glance and a number in it is a number without its sentence.
 */
export const NOTIFICATION_PLACEHOLDERS: Record<string, readonly string[]> = {
  "trial-day5.title": [], "trial-day5.body": [],
  "trial-day6.title": [], "trial-day6.body": [],
  "evening.title": [], "evening.body": ["eaten", "plan", "tomorrow"],
  "evening.emptyBody": ["plan", "tomorrow"],
};

/** iOS truncates well before these; they are a bound on abuse, not a design guide. */
export const MAX_NOTIFICATION_TITLE = 60;
export const MAX_NOTIFICATION_BODY = 240;

/**
 * The shipped words.
 *
 * The two reminders say what happens and how to stop it, and nothing else: no countdown, no
 * "you'll lose your progress", no second pitch. Step 15's rules for the sheet apply to the
 * messages that follow from it — the trial was sold once, and a reminder that sells it again is
 * the reason people turn notifications off.
 */
export const DEFAULT_NOTIFICATION_COPY: NotificationCopy = {
  "trial-day5": {
    title: "Two days left",
    body: "Two days before the free week ends. Nothing to do if you're staying — if not, Settings › Subscriptions, and you pay nothing.",
  },
  "trial-day6": {
    title: "The trial ends tomorrow",
    // "if you're staying" rather than "the subscription starts": a CANCELLATION leaves the expiry
    // where it was, so somebody who has already stopped it still gets this message, and telling
    // them a subscription is about to start would be false rather than merely redundant.
    body: "Tomorrow the free week ends. If you're staying, nothing to do; if not, Settings › Subscriptions.",
  },
  evening: {
    title: "Today against the plan",
    body: "{eaten} of your {plan} kcal today. {tomorrow}",
    emptyBody: "Nothing logged today — your {plan} kcal are still the plan. {tomorrow}",
  },
};

/** 20:30 in the server's zone, as R1 specifies. The reminders ride the same slot. */
export const REMINDER_TIME = { hour: 20, minute: 30 } as const;

/**
 * The two days a trial gets a reminder, as `YYYY-MM-DD` in `tz`.
 *
 * Derived from the EXPIRY rather than from the start, because the expiry is what the app is told
 * (`ProfileResponse.entitlement.expiresAt`) and what the store can move — a billing retry extends
 * it, and a reminder counted forwards from a purchase date would then fire in the middle of a
 * trial that is still running. Day 5 is two days before the expiry date, day 6 the day before it;
 * neither is ever on or after the expiry, which is the "never the day after" promise.
 *
 * Null when there is no expiry, when it does not parse, or when it has already passed — all three
 * mean there is nothing to remind anybody about.
 */
export function trialReminderDates(
  expiresAt: string | null | undefined,
  tz: string,
  now: number = Date.now(),
): { day5: string; day6: string } | null {
  if (!expiresAt) return null;
  const at = Date.parse(expiresAt);
  if (!Number.isFinite(at) || at <= now) return null;
  const expiryDate = localDate(tz, new Date(at));
  return { day5: dateMinus(expiryDate, 2), day6: dateMinus(expiryDate, 1) };
}

/**
 * The two reminder dates of a live TRIAL, or null when this entitlement is not one.
 *
 * The gate `trialReminderDates` does not have, and the reason both sides call this rather than
 * that: the raw arithmetic answers "two days before the expiry" for ANY expiry, and two days
 * before a yearly renewal has exactly that shape. `entitlement.trial` is the only thing that
 * separates them, and it comes from the store by way of the RevenueCat webhook — no duration
 * heuristic can, because it is looking at the same two days either way.
 */
export function trialReminders(
  entitlement: Entitlement,
  timezone: string,
  now: number = Date.now(),
): { day5: string; day6: string } | null {
  if (!entitlement.active || !entitlement.trial) return null;
  return trialReminderDates(entitlement.expiresAt, timezone, now);
}

/** The two ids the APP schedules itself. `evening` is a push and is never local. */
export type TrialReminderId = Extract<NotificationId, "trial-day5" | "trial-day6">;

/** One reminder to put on the device: `date` is `YYYY-MM-DD` in the SERVER's zone. */
export interface ScheduledReminder {
  id: TrialReminderId;
  date: string;
}

/**
 * The reminders that should be on this device right now, in order. Empty means cancel everything.
 *
 * The app's ONE decision about local notifications: its scheduler cancels every id this does not
 * name and schedules every id it does. It lives here rather than in `src/mobile` for the reason
 * `aggregateDays` does — `bun test` does not reach the app, so arithmetic mixed in with
 * `expo-notifications` is untested by construction.
 *
 * Empty covers every ending a trial has: never bought, expired, converted to a real subscription,
 * or opened so late that both days are behind. The caller does not distinguish them, because there
 * is nothing different to do about any of them.
 *
 * A date already past is DROPPED rather than scheduled. iOS accepts a calendar trigger whose
 * components are behind it and then never fires it, which is the same outcome told less honestly —
 * and it leaves `getAllScheduledNotificationsAsync` claiming a reminder that cannot arrive.
 */
export function reminderPlan(
  entitlement: Entitlement,
  timezone: string,
  now: Date = new Date(),
): ScheduledReminder[] {
  const dates = trialReminders(entitlement, timezone, now.getTime());
  if (!dates) return [];
  // Compared as strings, which is chronological for `YYYY-MM-DD`, and against TODAY in the SERVER's
  // zone rather than the device's — the same rule the diary and the health aggregation follow.
  //
  // THE SERVER'S ZONE IS LOAD-BEARING, AND THE OTHER END OF THE CONTRACT IS THE TRIGGER. Deciding
  // "has today's slot gone" from the server's wall clock is correct only because the app schedules
  // these as CALENDAR triggers carrying that same zone (`src/mobile/lib/notifications/expo.ts`), so
  // iOS resolves 20:30 in it too. A date trigger, or a trigger without a timezone, would resolve
  // 20:30 on the device instead, and this comparison would be wrong in both directions for anybody
  // who travels. If that trigger type ever changes, change this with it.
  const today = localDate(timezone, now);
  // TODAY counts only while today's slot is still ahead. `date >= today` alone is date granularity,
  // and an app first opened at 21:00 on the day-6 date would schedule a 20:30 trigger that iOS
  // accepts and never fires — the exact outcome this filter exists to avoid, and on that day the
  // server is silent too, so the user gets nothing at all on a day the budget says one.
  // Compared as MINUTES, not as strings, and modulo 24. `hour12: false` formats midnight as 24 in
  // some ICU versions — `zoneOffsetMs` in the backend's scheduler guards the same construction for
  // the same reason — and this is the first place `localTime`'s output is compared rather than
  // displayed. It also runs on the PHONE, under an Intl no test here exercises, so the failure
  // would be a reminder silently dropped for anyone who opened the app between midnight and 01:00
  // on one of the two days, once per trial, and unreproducible on a Mac.
  const [h, m] = localTime(timezone, now).split(":").map(Number) as [number, number];
  const passed = (h % 24) * 60 + m >= REMINDER_TIME.hour * 60 + REMINDER_TIME.minute;
  return ([
    { id: "trial-day5", date: dates.day5 },
    { id: "trial-day6", date: dates.day6 },
  ] as const).filter((r) => (r.date === today ? !passed : r.date > today));
}

/**
 * The ONE message `date` gets. R1's budget, expressed as a function rather than as a rule in prose.
 *
 * A reminder day emits the reminder and not the evening line. Sending both would be two messages on
 * the two days the user is most likely to be deciding whether to keep the app.
 */
export function dailyMessage(
  date: string,
  reminders: { day5: string; day6: string } | null,
): NotificationId {
  if (reminders?.day5 === date) return "trial-day5";
  if (reminders?.day6 === date) return "trial-day6";
  return "evening";
}

/** Interpolate a message. `empty` picks the evening line's nothing-logged variant. */
export function fillNotification(
  copy: NotificationCopy,
  id: NotificationId,
  params: Record<string, string>,
  opts: { empty?: boolean } = {},
): { title: string; body: string } {
  const message = copy[id];
  const template = opts.empty && message.emptyBody ? message.emptyBody : message.body;
  return { title: fill(message.title, params), body: fill(template, params) };
}

const fill = (template: string, params: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole);

export type NotificationCopyValidation =
  | { ok: true; content: NotificationCopy }
  | { ok: false; errors: string[] };

/**
 * Validate admin-supplied copy against what the composer can actually fill, and against the claims
 * rule set.
 *
 * On the WRITE, never on the read — a phone that has already been handed a broken template shows a
 * literal `{plan}` on a lock screen and no client-side tolerance recovers it. The claims gate is
 * the same one the landing page's build runs (`shared/claims.ts`): a notification is public
 * copy that arrives unasked, on the device of somebody who told us about their kidneys.
 *
 * Every error, not the first: an editor that reports one problem per save takes six saves to fix
 * six typos.
 */
export function validateNotificationCopy(input: unknown): NotificationCopyValidation {
  const errors: string[] = [];
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { ok: false, errors: ["copy must be an object"] };
  }
  const raw = input as Record<string, unknown>;

  for (const key of Object.keys(raw)) {
    if (!(NOTIFICATION_IDS as readonly string[]).includes(key)) {
      errors.push(`"${key}" is not a message this product sends`);
    }
  }

  const claimFields: Record<string, string> = {};

  for (const id of NOTIFICATION_IDS) {
    const entry = raw[id];
    if (typeof entry !== "object" || entry === null) { errors.push(`${id} is required`); continue; }
    const m = entry as Record<string, unknown>;

    const fields: [string, unknown, boolean][] = [
      ["title", m.title, true],
      ["body", m.body, true],
      // The nothing-logged variant exists for the evening line and for nothing else: a reminder
      // does not depend on what was logged, so a second body there would never be reached.
      ["emptyBody", m.emptyBody, id === "evening"],
    ];

    for (const [name, value, required] of fields) {
      const at = `${id}.${name}`;
      if (value === undefined) {
        if (required) errors.push(`${at} is required`);
        continue;
      }
      if (!required) { errors.push(`${at} is not used by "${id}"`); continue; }
      if (typeof value !== "string" || value.trim() === "") { errors.push(`${at} is required`); continue; }
      const max = name === "title" ? MAX_NOTIFICATION_TITLE : MAX_NOTIFICATION_BODY;
      if (value.length > max) errors.push(`${at} is over ${max} characters`);

      const declared = NOTIFICATION_PLACEHOLDERS[at] ?? [];
      const used = new Set(Array.from(value.matchAll(/\{(\w+)\}/g), (mm) => mm[1] as string));
      for (const key of used) {
        if (!declared.includes(key)) errors.push(`${at} uses {${key}}, which nothing fills here`);
      }
      for (const key of declared) {
        if (!used.has(key)) errors.push(`${at} is missing {${key}}`);
      }
      claimFields[at] = value;
    }
  }

  for (const v of lintCopy(claimFields)) {
    errors.push(`${v.field} contains a ${v.pattern} claim: "${v.span}"`);
  }

  if (errors.length > 0) return { ok: false, errors };
  // Every id is present, every field is a string of the right shape: the cast describes what the
  // loop above has just proved.
  return { ok: true, content: raw as unknown as NotificationCopy };
}

export interface EveningInput {
  targets: FoodTargets;
  totals: { kcal: number; protein_g: number };
  goal: Goal;
  /** Meals logged on the day. Zero is its own sentence, not a total of nothing. */
  meals: number;
}

/** A protein gap smaller than this is noise against an estimate, not a thing to act on. */
const PROTEIN_GAP_G = 15;
/** Under the plan by less than this is a normal day, not something to name. */
const UNDER_KCAL = 400;
/** A gain plan that fell short by less than this is on plan. */
const UNDER_KCAL_GAIN = 200;

const n = (x: number) => Math.round(x).toLocaleString("en-US");

/**
 * The retention-bearing half of the 20:30 line: ONE concrete thing for tomorrow.
 *
 * R1 is explicit that totals alone are a diary — the prescription is what makes the message worth
 * receiving. Deterministic, like `firstVerdictLines`: the model is never asked for it, so it cannot
 * invent a number, and it is compiled in rather than admin-editable for the same reason the
 * onboarding QUESTIONS are, since each branch is a claim about the user's own day.
 *
 * One sentence, one lever, in priority order. A message that names three things is a message that
 * names none.
 */
export function eveningPrescription(i: EveningInput): string {
  if (i.meals === 0) return "One photo tomorrow puts the day back on the board.";

  const overBy = i.totals.kcal - i.targets.kcal;
  if (i.goal !== "gain" && overBy > 0) {
    return `${n(overBy)} over today — tomorrow starts at ${n(i.targets.kcal)} again.`;
  }

  const proteinGap = i.targets.protein_g - i.totals.protein_g;
  if (proteinGap >= PROTEIN_GAP_G) {
    return `Protein ran ${n(proteinGap)} g short — eggs or skyr at breakfast closes it.`;
  }

  const underBy = -overBy;
  if (i.goal === "gain" && underBy >= UNDER_KCAL_GAIN) {
    return `${n(underBy)} kcal short of the plan — a handful of nuts tomorrow covers it.`;
  }
  if (i.goal !== "gain" && underBy >= UNDER_KCAL) {
    return `${n(underBy)} under the plan — eating the whole number tomorrow is the plan, not a slip.`;
  }

  return "On plan. Same again tomorrow.";
}
