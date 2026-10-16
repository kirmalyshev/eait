// The per-meal reminders as WEB push (ieat-app#2149, Kirill 14 Oct; decisions 16 Oct: free for
// everyone, 30 minutes of catch-up, Notifications off deletes the browser's address).
//
// On the iPhone the three slots are LOCAL notifications scheduled from the account's setting
// (`mealReminderPlan`); a browser has no local scheduler, so the server sends them. The setting is
// the same `users.meal_reminders` the phone reads, and "a logged meal covers a slot" is the same
// function (`slotStates` in shared/meal-reminders.ts), so the two clients cannot disagree about
// whether to remind.
//
// THE CLAIM. Each slot is its own sender (`pushSenderOf("meal", slot)` = `meal:breakfast`…): one
// claim per (account, local day, slot), taken BEFORE the send, so a minute-by-minute tick, a second
// replica and a restart mid-window all stay silent after the first. There is no cross-sender daily
// cap (#1965): a slot neither takes the evening line's day nor is taken by it. The account's own
// `push_daily_max`, when set, still bounds them in `claimSend`.
//
// WEB TOKENS ONLY. The phone already has its local notification for the same slot, and sending the
// push as well would remind it twice. An account with no browser registered is skipped before any
// meal is read.
//
// The words are the phone's (`mealReminderCopyFor`): a title naming the meal and one body that says
// what to do, never what was missed. No number, no meal, nothing about what was eaten.

import {
  DEFAULT_MEAL_REMINDERS, MEAL_SLOTS, MEAL_SLOT_CATCH_UP_MINUTES, localDate, localTime, mealReminderCopyFor,
  mealSlotsDue,
} from "@eait/shared";
import type { EngineDeps } from "./deps.ts";
import { pushDevices } from "./push-consent.ts";
import { claimSend, sendLogged, zoneOf } from "./notify.ts";

const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return (h % 24) * 60 + m;
};

export interface MealSlotTickResult {
  sent: number;
  failed: number;
  dropped: number;
}

/**
 * One pass, every minute, after `pushTick`. Counts only: a log line names neither an account nor a
 * device.
 *
 * ponytail: like `pushTick`, visits every account with a device each minute and reads its setting
 * first. Past a few thousand, select the accounts whose slot time falls in this minute in the store.
 */
export async function mealSlotTick(deps: EngineDeps, opts: { now?: number } = {}): Promise<MealSlotTickResult> {
  const now = opts.now ?? Date.now();
  const out: MealSlotTickResult = { sent: 0, failed: 0, dropped: 0 };
  for (const { userId, timezone } of await deps.store.pushAudience()) {
    // ONE ACCOUNT AT A TIME: one account's failing read is one account's failure.
    try {
      const zone = zoneOf(deps, timezone);
      const at = new Date(now);
      const nowMin = minutesOf(localTime(zone, at));
      const settings = (await deps.store.mealRemindersOf(userId)) ?? DEFAULT_MEAL_REMINDERS;
      // From the clock and the setting alone: most accounts, most minutes, end here with no further read.
      const inWindow = MEAL_SLOTS.some((s) => {
        const t = minutesOf(settings[s].time);
        return settings[s].on && nowMin >= t && nowMin < t + MEAL_SLOT_CATCH_UP_MINUTES;
      });
      if (!inWindow) continue;
      const devices = (await pushDevices(deps, userId)).filter((d) => d.platform === "web");
      if (devices.length === 0) continue;
      const profile = await deps.store.getProfile(userId);
      if (!profile?.onboarded_at) continue;
      const date = localDate(zone, at);
      const meals = await deps.store.mealsForDate(userId, date);
      const copy = mealReminderCopyFor(profile.lang);
      for (const slot of mealSlotsDue(settings, meals.map((m) => m.ts), zone, at)) {
        const claim = await claimSend(deps, userId, date, "meal", slot);
        if (!claim.claimed) continue; // sender-taken (already sent today) or account-cap
        const sent = await sendLogged(
          deps, userId, devices,
          { kind: "meal", ref: slot, templateKey: `meal-${slot}`, lang: profile.lang },
          { title: copy[slot], body: copy.body },
        );
        out.sent += sent.sent; out.failed += sent.failed; out.dropped += sent.dropped;
      }
    } catch (e) {
      console.error(`[eait] meal slot tick: one account failed: ${(e as Error)?.message ?? e}`);
      out.failed++;
    }
  }
  if (out.sent + out.failed + out.dropped > 0) {
    console.log(`[eait] meal slot tick: ${out.sent} sent, ${out.failed} failed, ${out.dropped} token(s) dropped`);
  }
  return out;
}
