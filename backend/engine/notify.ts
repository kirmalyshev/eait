// The messages this product sends, and the nightly sweep that sends them.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE BUDGET IS THE PRODUCT RULE, AND IT IS ENFORCED HERE
//
// R1 (`marketing/specs/2026-07-22-retention-plan.md` § 5) is one outbound message a day, INCLUDING
// the two trial reminders. `dailyMessage` in `@eait/shared` decides which one a day gets; this
// module is what obeys it. On a reminder day the server stays SILENT — the phone scheduled that
// notification locally at trial start, off `entitlement.expiresAt`, and pushing the evening line as
// well would be two messages on the two days somebody is deciding whether to keep the app.
//
// The 20:30 line is server-composed because it is a sentence about a day the phone has not
// necessarily seen: meals logged on another device are in `GET /day` and nowhere else. A local
// notification cannot carry a number it does not know.
//
// ONE PROCESS IS ASSUMED, AND NOTHING ENFORCES IT. Nothing records that an account was messaged
// today: the budget is kept by there being exactly one timer, in one process, firing once. A second
// replica sends the evening line twice — as would a restart that straddles the hour — and R1 is the
// one rule this module exists to enforce. The same caveat the in-memory rate limiter carries, and
// stated for the same reason: a limit that quietly doubles when somebody scales the deployment is
// worse than one that was never claimed. The durable answer is a `last_notified_date` on the user
// row, claimed atomically before the send.
//
// AND IT IS WHAT A SUBSCRIPTION BUYS. copy.md § Step 15 lists "The 20:30 line — one a day" on the
// card, so an account with no live entitlement is not swept. That also disposes of the win-back
// question: this is not a re-engagement channel pointed at people who stopped paying.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import {
  DEFAULT_NOTIFICATION_COPY, NOTIFICATION_IDS, dailyMessage, dateMinus, entitlementActive,
  eveningPrescription,
  explainTargets, fillNotification, localDate, trialReminders, validateNotificationCopy,
  type NotificationCopy, type NotificationCopyValidation, type NotificationId,
} from "@eait/shared";
import type { PushMessage, PushTicket } from "../push/port.ts";
import { sumTotals } from "./meals.ts";
import type { EngineDeps } from "./deps.ts";

/**
 * A ticket, plus the account whose device it was addressed to.
 *
 * The owner is carried rather than looked up again. A dead token has to be deleted through
 * `dropPushToken`, which is user-scoped like every other store write, and the sweep already knew
 * whose device it was when it composed the message — asking the database again, once per dead
 * token, is `1 + accounts-with-a-device` queries for something already in hand.
 */
export type SweptTicket = PushTicket & { userId: string };

/** One composed message, before it is addressed to any device. */
export interface DailyNotification {
  id: NotificationId;
  title: string;
  body: string;
}

/**
 * The copy this server sends.
 *
 * Falls back to the compiled-in default when no admin has saved anything, exactly as the onboarding
 * copy does. Seeding a row on boot would work and is worse: it makes "has anybody edited this?"
 * unanswerable.
 */
export async function notificationCopy(deps: EngineDeps): Promise<NotificationCopy> {
  const stored = await deps.store.getNotificationCopy();
  if (!stored) return DEFAULT_NOTIFICATION_COPY;
  // MERGED over the default, per message and per field, rather than served verbatim.
  //
  // A shipped app outlives its server and a stored row outlives the code that wrote it. The day a
  // fourth message joins `NOTIFICATION_IDS`, or a field is added to one of these three, every host
  // whose admin has ever pressed Save has a row without it — and `fillNotification` reads
  // `copy[id].title` straight through, so the composer throws for EVERY account, one at a time,
  // logging identical lines that name nothing. The onboarding path has exactly this defence
  // (`usableContent`); this is the same idea, one line of it.
  const merged = { ...DEFAULT_NOTIFICATION_COPY };
  for (const id of NOTIFICATION_IDS) merged[id] = { ...DEFAULT_NOTIFICATION_COPY[id], ...stored[id] };
  return merged;
}

/**
 * Save admin-edited copy, after validating it.
 *
 * On the WRITE. A template that reached the send path with a placeholder nothing fills renders a
 * literal `{plan}` on a lock screen, and there is no client-side tolerance that recovers it — the
 * message has already been delivered. The claims gate runs here too: a notification is public copy
 * that arrives unasked, on the phone of somebody who told us about their kidneys.
 */
export async function saveNotificationCopy(
  deps: EngineDeps,
  input: unknown,
): Promise<NotificationCopyValidation> {
  const result = validateNotificationCopy(input);
  if (!result.ok) return result;
  await deps.store.putNotificationCopy(result.content);
  return result;
}

/** Restore the shipped words. The undo button for an edit that went wrong. */
export async function resetNotificationCopy(deps: EngineDeps): Promise<NotificationCopy> {
  await deps.store.putNotificationCopy(DEFAULT_NOTIFICATION_COPY);
  return DEFAULT_NOTIFICATION_COPY;
}

/**
 * The ONE message this account gets on `date`, or null when it gets none.
 *
 * Null has three ordinary causes and the caller does not need to tell them apart: the account never
 * onboarded (there is no plan to report against), it has no live entitlement (the line is what a
 * subscription buys), or the day is one of the two trial reminders the DEVICE sends.
 */
export async function dailyNotification(
  deps: EngineDeps,
  userId: string,
  date: string,
  now: number = Date.now(),
): Promise<DailyNotification | null> {
  const stored = await deps.store.getEntitlement(userId);
  if (!entitlementActive(stored?.expiresAt, now)) return null;

  // The two reminders are LOCAL notifications, scheduled on the phone at trial start. Sending one
  // from here as well would spend the day's whole budget twice over.
  //
  // `trialReminders` and not `trialReminderDates`: the raw arithmetic answers "two days before the
  // expiry" for ANY expiry, so a yearly subscriber's renewal date would silence this server on the
  // two evenings before it, once a year, for everybody who pays. The phone reads the same function
  // through `reminderPlan`, which is what keeps "the day the server is silent" and "the day the
  // device speaks" the same day.
  const which = dailyMessage(date, trialReminders(
    { active: true, expiresAt: stored?.expiresAt ?? null, trial: stored?.trial === true },
    deps.config.timezone, now,
  ));
  if (which !== "evening") return null;

  const profile = await deps.store.getProfile(userId);
  if (!profile?.onboarded_at) return null;

  const meals = await deps.store.mealsForDate(userId, date);
  const totals = sumTotals(meals);
  const { targets } = explainTargets(profile);

  const copy = await notificationCopy(deps);
  const filled = fillNotification(copy, "evening", {
    eaten: n(totals.kcal),
    plan: n(targets.kcal),
    tomorrow: eveningPrescription({
      targets, totals, goal: profile.goal ?? "maintain", meals: meals.length,
    }),
  }, { empty: meals.length === 0 });

  return { id: "evening", ...filled };
}

const n = (x: number) => Math.round(x).toLocaleString("en-US");

export interface SweepResult {
  /** Accounts with a device that were considered. */
  users: number;
  /** Messages the push service accepted. */
  sent: number;
  /** Accounts with nothing to be told today — a reminder day, a lapsed account, no profile. */
  skipped: number;
  /**
   * Everything that did not go out, of two kinds: an account whose message could not be COMPOSED
   * (a store read threw), and a message the push service refused or could not be handed.
   *
   * One number because nothing acts on the difference — tomorrow's sweep retries both, there is no
   * queue, and a 20:30 line delivered the following afternoon would be worse than one that never
   * arrived. The distinction is in the log lines, which name the kind and neither the account nor
   * the device.
   */
  failed: number;
  /** Tokens dropped because the ticket said the device is gone. */
  dropped: number;
  /** Accepted tickets, for `collectPushReceipts` to follow up on minutes later. */
  tickets: SweptTicket[];
}

/**
 * The nightly sweep: compose one message per account with a device, and send them.
 *
 * ONE batch across every account, because Expo's API is batched and a request per user is a
 * request per user. The per-account work is sequential and deliberately dull — this runs once a
 * day against a table of installed apps, and the thing to revisit when that table is large is
 * `usersWithPushTokens`, which returns every id at once.
 *
 * NOTHING HERE LOGS A TOKEN OR A BODY. The body carries what somebody ate and the token addresses
 * their phone; counts are what a log needs.
 */
export async function eveningSweep(
  deps: EngineDeps,
  opts: { date: string; now?: number },
): Promise<SweepResult> {
  const now = opts.now ?? Date.now();
  const userIds = await deps.store.usersWithPushTokens();

  const messages: PushMessage[] = [];
  // token -> the account it belongs to, so a dead token is deleted through the scoped write
  // without a second lookup. One entry per message; a token is a primary key in both stores, so
  // it cannot name two accounts.
  const owner = new Map<string, string>();
  let skipped = 0;
  let broken = 0;
  for (const userId of userIds) {
    // ONE ACCOUNT AT A TIME, and one account's failure is one account's failure.
    //
    // Composing a message is three or four store reads, and any of them can throw — a transient
    // Postgres error, a legacy profile row `explainTargets` was not written for. Unguarded, that
    // exception leaves this function before anything is sent, so every OTHER subscriber's evening
    // line, already composed and sitting in `messages`, goes in the bin with it, the accounts after
    // it are never considered, and the counts are never reported. One bad row would cost everybody
    // the night, and the only trace would be a single line naming no account.
    try {
      const message = await dailyNotification(deps, userId, opts.date, now);
      if (message === null) { skipped++; continue; }
      for (const device of await deps.store.pushTokensFor(userId)) {
        messages.push({ to: device.token, title: message.title, body: message.body });
        owner.set(device.token, userId);
      }
    } catch (e) {
      // The message, never the account and never the device. What is useful here is that a number
      // of accounts failed, and tomorrow's sweep will try them again.
      console.error(`[eait] evening sweep: composing failed for one account: ${(e as Error)?.message ?? e}`);
      broken++;
    }
  }

  const result: SweepResult = {
    users: userIds.length, sent: 0, skipped, failed: broken, dropped: 0, tickets: [],
  };

  // Every sweep logs its counts, INCLUDING a night on which nothing qualified. A run that says
  // nothing is indistinguishable from a run that did not happen, and the timer that arms this is
  // the part with nothing else watching it.
  const report = () => {
    console.log(
      `[eait] evening sweep ${opts.date}: ${result.users} account(s) with a device, `
      + `${result.sent} sent, ${result.skipped} skipped, ${result.failed} failed, `
      + `${result.dropped} token(s) dropped`,
    );
    return result;
  };

  if (messages.length === 0) return report();

  let tickets: PushTicket[];
  try {
    tickets = await deps.push.send(messages);
  } catch (e) {
    // A push service that is down is not a reason for the sweep to be down. Every message in the
    // batch is counted as failed and tomorrow's sweep tries again; there is no queue, on purpose —
    // a stale 20:30 line delivered the following afternoon is worse than one that never arrives.
    console.error(`[eait] evening sweep: push send failed for ${messages.length} message(s): ${(e as Error)?.message ?? e}`);
    result.failed += messages.length;
    return report();
  }

  for (const ticket of tickets) {
    const userId = owner.get(ticket.token);
    // A ticket for a token this sweep did not send is not something to act on. It cannot happen
    // against a correct push service; acting on it would mean deleting a row on a stranger's say-so.
    if (userId === undefined) { result.failed++; continue; }
    if (ticket.error === "device-not-registered") {
      if (await deps.store.dropPushToken(userId, ticket.token)) result.dropped++;
      result.failed++;
      continue;
    }
    if (ticket.error !== null) { result.failed++; continue; }
    result.sent++;
    if (ticket.id !== null) result.tickets.push({ ...ticket, userId });
  }

  return report();
}

/**
 * The second half of a send, minutes later: read the receipts and drop what has gone away.
 *
 * `DeviceNotRegistered` usually arrives HERE rather than in the ticket — the app was deleted, Apple
 * told Expo, and Expo tells us on the receipt. Without this the row survives every sweep and this
 * server pushes to a phone that no longer has the app on it, every night, forever.
 *
 * A receipt that is not ready yet is absent from the map, and absent is not a failure: it is
 * checked again on nobody's schedule and the token is simply kept.
 */
export async function collectPushReceipts(deps: EngineDeps, tickets: SweptTicket[]): Promise<number> {
  const ids = tickets.map((t) => t.id).filter((id): id is string => id !== null);
  if (ids.length === 0) return 0;

  let receipts: Map<string, string | null>;
  try {
    receipts = await deps.push.receipts(ids);
  } catch (e) {
    console.error(`[eait] push receipts failed for ${ids.length} ticket(s): ${(e as Error)?.message ?? e}`);
    return 0;
  }

  let dropped = 0;
  for (const ticket of tickets) {
    if (ticket.id === null) continue;
    if (receipts.get(ticket.id) !== "device-not-registered") continue;
    if (await deps.store.dropPushToken(ticket.userId, ticket.token)) dropped++;
  }
  if (dropped > 0) console.log(`[eait] push receipts: dropped ${dropped} token(s) for devices that are gone`);
  return dropped;
}

// ── The scheduler's arithmetic ───────────────────────────────────────────────────────────────

/**
 * How long Expo is given before its receipts are read.
 *
 * Expo's own guidance. A receipt asked for too early is simply absent, which is harmless, so the
 * cost of this number being wrong is a dead token surviving until tomorrow's sweep.
 */
export const RECEIPT_DELAY_MS = 15 * 60 * 1000;

/**
 * Milliseconds until the next `hour:minute` in `zone`.
 *
 * A timer to the NEXT OCCURRENCE, not a fixed 24-hour interval, and that is the whole reason this
 * function exists: a repeating 24-hour timer set before a DST transition drifts by an hour and
 * stays drifted, so the "20:30 line" arrives at 19:30 for half the year. Nothing in any log says
 * so, and the only people who can see it are the ones receiving it.
 *
 * The day boundary comes from `dates.ts`, like every other date in this product.
 */
export function msUntilNextEveningLine(
  zone: string,
  time: { hour: number; minute: number },
  now: number = Date.now(),
): number {
  const today = localDate(zone, new Date(now));
  const at = instantOf(zone, today, time);
  // `dateMinus(-1)` is tomorrow, by calendar arithmetic — never `now + 86_400_000`.
  return (at > now ? at : instantOf(zone, dateMinus(today, -1), time)) - now;
}

/** The UTC instant at which the wall clock in `zone` reads `date` at `time`. */
function instantOf(zone: string, date: string, time: { hour: number; minute: number }): number {
  const pad = (x: number) => String(x).padStart(2, "0");
  const naive = Date.parse(`${date}T${pad(time.hour)}:${pad(time.minute)}:00Z`);
  // Two passes. The first lands within an hour; the second corrects it when the guess fell on the
  // far side of a DST transition and was therefore offset by the wrong amount.
  const once = naive - zoneOffsetMs(zone, naive);
  return naive - zoneOffsetMs(zone, once);
}

/** How far ahead of UTC `zone` is at `at`, in milliseconds. */
function zoneOffsetMs(zone: string, at: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(new Date(at));
  const p: Record<string, number> = {};
  for (const part of parts) if (part.type !== "literal") p[part.type] = Number(part.value);
  // `hour12: false` formats midnight as 24 in some ICU versions; the modulo is that, not paranoia.
  const asUtc = Date.UTC(p.year!, p.month! - 1, p.day!, p.hour! % 24, p.minute!, p.second!);
  return asUtc - at;
}
