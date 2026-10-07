// The messages this product sends, and the nightly sweep that sends them.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE BUDGET IS THE PRODUCT RULE, AND IT IS ENFORCED HERE
//
// R1 (`marketing/specs/2026-07-22-retention-plan.md` § 5) is one outbound message a day, INCLUDING
// the trial-ends reminder. `dailyMessage` in `@eait/shared` decides which one a day gets; this
// module is what obeys it. On the reminder day the server stays SILENT — the phone scheduled that
// notification locally at trial start, off `entitlement.expiresAt`, and pushing the evening line as
// well would be two messages on the two days somebody is deciding whether to keep the app.
//
// The 20:30 line is server-composed because it is a sentence about a day the phone has not
// necessarily seen: meals logged on another device are in `GET /day` and nowhere else. A local
// notification cannot carry a number it does not know.
//
// THE BUDGET IS ONE ROW PER (USER, LOCAL DAY), `push_slot`, claimed by EVERY sender BEFORE it sends
// (ieat-app#1765). The tick runs every minute on the leader, and a second leader mid-handover — or
// this one restarted mid-evening — finds the day claimed and stays silent. A claim is not a send:
// a crash in the gap costs that day, which is the side R1 wants to fail on. The day is the
// ACCOUNT's local day (`users.timezone`, reported by the app; the instance zone until it has), and
// the trial-reminder day is claimed here as `trial` so nothing else goes out on it. Every message
// is a `send_log` row, written before the send and settled from the ticket and then the receipt.
//
// THE LINE IS WHAT A SUBSCRIPTION BUYS; THE NUDGE IS NOT (#730, ruled by Kirill 6 Oct). Only a live
// entitlement gets the sentence that reads the day against the plan. Every other onboarded account,
// a lapsed one included, gets the plain `nudge` at the same hour under the same one-a-day claim:
// the habit is not gated behind the conversion it exists to produce.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import {
  LOG_REPLY_CATEGORY, NOTIFICATION_IDS, dailyMessage, entitlementActive, isTimezone,
  eveningPrescription,
  explainTargets, fillNotification, localDate, notificationCopyFor, storedNotificationCopy,
  kcalNumbers, trialReminder, validateNotificationCopy,
  type Lang, type NotificationCopy, type PushKind, type SendKind, type NotificationCopyValidation, type NotificationId,
} from "@eait/shared";
import type { PushMessage, PushTicket } from "../push/port.ts";
import { sumTotals } from "./meals.ts";
import type { EngineDeps } from "./deps.ts";

/** One composed message, before it is addressed to any device. */
export interface DailyNotification {
  id: NotificationId;
  title: string;
  body: string;
  lang: Lang;
}

/**
 * The copy this server sends.
 *
 * Falls back to the compiled-in default when no admin has saved anything, exactly as the onboarding
 * copy does. Seeding a row on boot would work and is worse: it makes "has anybody edited this?"
 * unanswerable.
 */
export async function notificationCopy(deps: EngineDeps, lang: Lang): Promise<NotificationCopy> {
  const base = notificationCopyFor(lang);
  const stored = storedNotificationCopy(await deps.store.getNotificationCopy())[lang];
  if (!stored) return base;
  // MERGED over the default, per message and per field, rather than served verbatim.
  //
  // A shipped app outlives its server and a stored row outlives the code that wrote it. The day a
  // fourth message joins `NOTIFICATION_IDS`, or a field is added to one of these three, every host
  // whose admin has ever pressed Save has a row without it — and `fillNotification` reads
  // `copy[id].title` straight through, so the composer throws for EVERY account, one at a time,
  // logging identical lines that name nothing. The onboarding path has exactly this defence
  // (`usableContent`); this is the same idea, one line of it.
  // Merged over THIS language's default, never over English: a German host with a half-written
  // German revision should be missing German words, not gain English ones.
  const merged = { ...base };
  for (const id of NOTIFICATION_IDS) merged[id] = { ...base[id], ...stored[id] };
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
  lang: Lang,
): Promise<NotificationCopyValidation> {
  const result = validateNotificationCopy(input);
  if (!result.ok) return result;
  // ONE LANGUAGE, and the store merges it into the other seven. This used to read the set here and
  // write the whole thing back, which is safe only while nobody else is saving: two admins on two
  // languages, and the later write carries a snapshot from before the earlier one landed.
  await deps.store.putNotificationCopy(lang, result.content);
  return result;
}

/** Restore the shipped words for one language. The undo button for an edit that went wrong. */
export async function resetNotificationCopy(deps: EngineDeps, lang: Lang): Promise<NotificationCopy> {
  const restored = notificationCopyFor(lang);
  await deps.store.putNotificationCopy(lang, restored);
  return restored;
}

/**
 * The ONE message this account gets on `date`, or null when it gets none.
 *
 * A subscriber gets the 20:30 line, which reads the day against the plan; any other onboarded
 * account gets the plain nudge (#730). Null has two ordinary causes and the caller does not need to
 * tell them apart: the account never onboarded, or the day is one of the trial reminders the DEVICE
 * sends.
 */
export async function dailyNotification(
  deps: EngineDeps,
  userId: string,
  date: string,
  now: number = Date.now(),
  zone: string = deps.config.timezone,
): Promise<DailyNotification | null> {
  const stored = await deps.store.getEntitlement(userId);
  if (!entitlementActive(stored?.expiresAt, now)) {
    // No subscription: the plain nudge (#730), which reads nothing about the day. Still one a day,
    // still behind the same claim, and no trial reminder can fall on it — there is no trial.
    const profile = await deps.store.getProfile(userId);
    if (!profile?.onboarded_at) return null;
    return { id: "nudge", lang: profile.lang, ...fillNotification(await notificationCopy(deps, profile.lang), "nudge", {}) };
  }

  // The reminder is a LOCAL notification, scheduled on the phone at trial start. Sending one
  // from here as well would spend the day's whole budget twice over.
  //
  // `trialReminder` and not `trialReminderDate`: the raw arithmetic answers "the day before the
  // expiry" for ANY expiry, so a yearly subscriber's renewal date would silence this server on the
  // evening before it, once a year, for everybody who pays. The phone reads the same function
  // through `reminderPlan`, which is what keeps "the day the server is silent" and "the day the
  // device speaks" the same day.
  const which = dailyMessage(date, trialReminder(
    { active: true, expiresAt: stored?.expiresAt ?? null, trial: stored?.trial === true, lapsed: false },
    zone, now,
  ));
  if (which !== "evening") return null;

  const profile = await deps.store.getProfile(userId);
  if (!profile?.onboarded_at) return null;

  const meals = await deps.store.mealsForDate(userId, date);
  const totals = sumTotals(meals);
  const { targets } = explainTargets(profile);

  // THE ACCOUNT'S LANGUAGE, not the server's. This is the one message composed here rather than on
  // the phone, so it is also the one place where composing in the wrong language would put an
  // English sentence on a lock screen in Jakarta — and the figures in it are grouped the reader's
  // way for the same reason (`numbers`), because "1,900" reads as one point nine to half of Europe.
  const lang = profile.lang;
  const n = kcalNumbers(lang);
  const copy = await notificationCopy(deps, lang);
  const filled = fillNotification(copy, "evening", {
    eaten: n(totals.kcal),
    plan: n(targets.kcal),
    tomorrow: eveningPrescription({
      targets, totals, goal: profile.goal ?? "maintain", meals: meals.length,
    }, lang),
  }, { empty: meals.length === 0 });

  return { id: "evening", lang, ...filled };
}

/** What one send pass did. Counts only: a log line names neither an account nor a device. */
export interface SendOutcome { sent: number; failed: number; dropped: number }

/** What a `send_log` row records about a message besides its device. */
export interface SendMeta {
  kind: SendKind;
  ref: string | null;
  templateKey: string;
  lang: Lang;
  variant?: string | null;
}

/**
 * Send one message to each of an account's devices, and write it down.
 *
 * Every sender goes through here, so every send has a `send_log` row: written `queued` BEFORE the
 * send (its id rides in the push `data` as `sendId`, which phase 3 reads to attribute an open),
 * then settled from the ticket. A dead token is dropped through the scoped write.
 *
 * NEVER THROWS for a push service that is down: the rows are settled `refused` and the caller
 * counts them. Nothing here logs a token or a body.
 */
export async function sendLogged(
  deps: EngineDeps,
  userId: string,
  devices: { token: string }[],
  meta: SendMeta,
  message: Omit<PushMessage, "to" | "data">,
  data: Record<string, string> = {},
): Promise<SendOutcome> {
  const out: SendOutcome = { sent: 0, failed: 0, dropped: 0 };
  if (devices.length === 0) return out;
  const ids = new Map<string, string>(); // token -> send_log id
  const messages: PushMessage[] = [];
  for (const device of devices) {
    const id = crypto.randomUUID();
    await deps.store.createSend(userId, {
      id, kind: meta.kind, ref: meta.ref, templateKey: meta.templateKey, lang: meta.lang,
      variant: meta.variant ?? null, token: device.token, state: "queued",
    });
    ids.set(device.token, id);
    messages.push({ ...message, to: device.token, data: { ...data, sendId: id } });
  }

  let tickets: PushTicket[];
  try {
    tickets = await deps.push.send(messages);
  } catch (e) {
    console.error(`[eait] push send failed for ${messages.length} message(s): ${(e as Error)?.message ?? e}`);
    for (const id of ids.values()) await deps.store.settleSend(userId, id, { state: "refused", receiptError: "send-failed" });
    out.failed = messages.length;
    return out;
  }

  for (const ticket of tickets) {
    const id = ids.get(ticket.token);
    // A ticket for a token this call did not send is not something to act on: acting would mean
    // deleting a row on a stranger's say-so.
    if (id === undefined) { out.failed++; continue; }
    ids.delete(ticket.token);
    if (ticket.error === "device-not-registered") {
      await deps.store.settleSend(userId, id, { state: "dead", receiptError: ticket.error });
      if (await deps.store.dropPushToken(userId, ticket.token)) out.dropped++;
      out.failed++;
    } else if (ticket.error !== null) {
      await deps.store.settleSend(userId, id, { state: "refused", receiptError: ticket.error });
      out.failed++;
    } else {
      await deps.store.settleSend(userId, id, { state: "accepted", ticketId: ticket.id });
      out.sent++;
    }
  }
  // A message the service gave no ticket for was not accepted.
  for (const id of ids.values()) {
    await deps.store.settleSend(userId, id, { state: "refused", receiptError: "no-ticket" });
    out.failed++;
  }
  return out;
}

/** How long the evening line may be late before the night is dropped: a stale 20:30 is worse than none. */
export const CATCH_UP_MS = 2 * 60 * 60 * 1000;

/** The zone an account dates its days in: its own, when the app has reported a usable one. */
function zoneOf(deps: EngineDeps, reported: string | null): string {
  return reported !== null && isTimezone(reported) ? reported : deps.config.timezone;
}

export interface TickResult {
  /** Accounts with a device that were visited. */
  users: number;
  sent: number;
  /** Visited, nothing to send now: not their hour, nothing to say, or the day was already taken. */
  skipped: number;
  failed: number;
  dropped: number;
}

/**
 * The per-minute tick: for every account whose OWN local clock has passed the evening line (and is
 * within the two-hour catch-up), claim the day and send.
 *
 * Replaces the nightly sweep. The slot, not a timer, is what makes it safe to run every minute and
 * on two replicas: `claimPushSlot` is the only gate.
 *
 * Claims go in rank order. The trial-reminder day is claimed here as `trial` (the PHONE sends that
 * notification, locally) from the first tick of the local day, so no lower kind can take it.
 *
 * ponytail: visits every account with a device each minute (two or three reads each). Fine for
 * thousands; past that, select the due set in the store instead of filtering here.
 */
export async function pushTick(deps: EngineDeps, opts: { now?: number } = {}): Promise<TickResult> {
  const now = opts.now ?? Date.now();
  const audience = await deps.store.pushAudience();
  const result: TickResult = { users: audience.length, sent: 0, skipped: 0, failed: 0, dropped: 0 };
  let broken = 0;
  for (const { userId, timezone } of audience) {
    // ONE ACCOUNT AT A TIME: one account's failing read is one account's failure, not everybody's night.
    try {
      const zone = zoneOf(deps, timezone);
      const date = localDate(zone, new Date(now));

      if (await isTrialReminderDay(deps, userId, date, now, zone)) {
        await deps.store.claimPushSlot(userId, date, "trial", null);
        result.skipped++;
        continue;
      }

      const at = instantOf(zone, date, deps.config.eveningLineTime);
      if (now < at || now >= at + CATCH_UP_MS) { result.skipped++; continue; }

      const message = await dailyNotification(deps, userId, date, now, zone);
      if (message === null) { result.skipped++; continue; }
      // The subscriber's line reads the day against the plan (`streak`); everyone else's plain
      // nudge is the lower `evening` kind.
      const kind: PushKind = message.id === "evening" ? "streak" : "evening";
      const claim = await deps.store.claimPushSlot(userId, date, kind, message.id);
      if (!claim.claimed) { result.skipped++; continue; } // slot-taken
      const out = await sendLogged(
        deps, userId, await deps.store.pushTokensFor(userId),
        { kind, ref: message.id, templateKey: message.id, lang: message.lang },
        { title: message.title, body: message.body, categoryId: LOG_REPLY_CATEGORY },
      );
      result.sent += out.sent; result.failed += out.failed; result.dropped += out.dropped;
    } catch (e) {
      console.error(`[eait] push tick: one account failed: ${(e as Error)?.message ?? e}`);
      broken++;
    }
  }
  result.failed += broken;
  // A tick that did something says so; a minute with nothing to do stays silent.
  if (result.sent + result.failed + result.dropped > 0) {
    console.log(
      `[eait] push tick: ${result.users} account(s) with a device, ${result.sent} sent, `
      + `${result.skipped} skipped, ${result.failed} failed, ${result.dropped} token(s) dropped`,
    );
  }
  return result;
}

/** True on the day the DEVICE sends the trial-ends reminder: this server must say nothing then. */
async function isTrialReminderDay(
  deps: EngineDeps, userId: string, date: string, now: number, zone: string,
): Promise<boolean> {
  const stored = await deps.store.getEntitlement(userId);
  if (!entitlementActive(stored?.expiresAt, now)) return false;
  return dailyMessage(date, trialReminder(
    { active: true, expiresAt: stored?.expiresAt ?? null, trial: stored?.trial === true, lapsed: false },
    zone, now,
  )) !== "evening";
}

export type TestPushResult =
  | { ok: true; sent: number }
  | { ok: false; reason: "no-device" }
  | { ok: false; reason: "slot-taken"; heldBy: PushKind };

/**
 * The super-admin's "send test push" for ONE account. It goes through the slot like any sender, so
 * a second test the same local day is refused and says why (`slot-taken`, and which kind holds it).
 * The words are the shipped `nudge` copy in the account's own language, so there is no new string.
 */
export async function sendTestPush(
  deps: EngineDeps, userId: string, now: number = Date.now(),
): Promise<TestPushResult> {
  const devices = await deps.store.pushTokensFor(userId);
  if (devices.length === 0) return { ok: false, reason: "no-device" };
  const profile = await deps.store.getProfile(userId);
  if (!profile) return { ok: false, reason: "no-device" };
  const zone = zoneOf(deps, await deps.store.timezoneOf(userId));
  const claim = await deps.store.claimPushSlot(userId, localDate(zone, new Date(now)), "campaign", "admin-test");
  if (!claim.claimed) return { ok: false, reason: "slot-taken", heldBy: claim.heldBy };
  const copy = fillNotification(await notificationCopy(deps, profile.lang), "nudge", {});
  const out = await sendLogged(
    deps, userId, devices,
    { kind: "campaign", ref: "admin-test", templateKey: "nudge", lang: profile.lang, variant: "admin-test" },
    { title: copy.title, body: copy.body },
  );
  return { ok: true, sent: out.sent };
}

/** Receipts older than this are gone from Expo; the row stops waiting for one. */
const RECEIPT_GIVE_UP_MS = 24 * 60 * 60 * 1000;

/**
 * The second half of a send, minutes later: read the receipts of accepted rows and settle them.
 *
 * `DeviceNotRegistered` usually arrives HERE rather than in the ticket — the app was deleted, Apple
 * told Expo, and Expo tells us on the receipt. A receipt not ready yet is absent from the map and
 * the row stays `accepted`; it is asked for again on the next pass. Returns tokens dropped.
 */
export async function collectPushReceipts(deps: EngineDeps, now: number = Date.now()): Promise<number> {
  const waiting = (await deps.store.sendsAwaitingReceipt(500))
    .filter((r) => now - Date.parse(r.createdAt) >= RECEIPT_DELAY_MS);
  if (waiting.length === 0) return 0;

  let receipts: Map<string, string | null>;
  try {
    receipts = await deps.push.receipts(waiting.map((r) => r.ticketId!));
  } catch (e) {
    console.error(`[eait] push receipts failed for ${waiting.length} ticket(s): ${(e as Error)?.message ?? e}`);
    return 0;
  }

  let dropped = 0;
  for (const row of waiting) {
    if (!receipts.has(row.ticketId!)) {
      // Expo forgets a receipt after a day. The row leaves the queue (terminal `expired`, reason
      // recorded) so a pile of never-arriving ones cannot starve newer rows behind the page limit.
      if (now - Date.parse(row.createdAt) > RECEIPT_GIVE_UP_MS) {
        await deps.store.settleSend(row.userId, row.id, { state: "expired", receiptError: "no-receipt", receipt: true });
      }
      continue;
    }
    const error = receipts.get(row.ticketId!) ?? null;
    if (error === null) {
      await deps.store.settleSend(row.userId, row.id, { state: "delivered-to-apns", receipt: true });
    } else if (error === "device-not-registered") {
      await deps.store.settleSend(row.userId, row.id, { state: "dead", receiptError: error, receipt: true });
      if (await deps.store.dropPushToken(row.userId, row.token)) dropped++;
    } else {
      await deps.store.settleSend(row.userId, row.id, { state: "refused", receiptError: error, receipt: true });
    }
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
