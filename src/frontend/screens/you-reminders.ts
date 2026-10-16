// The per-meal reminder rows on the web You card (#902): a switch and a time per slot. On the iPhone
// the reminders are LOCAL notifications; in a browser they are web push sent by the server (#2149),
// which needs THIS browser subscribed — so while it is not, a button asks the permission and
// subscribes (the same flow as the Notifications row above it). Mirrors `you-push.ts`: a tap shows
// the new position, a failure puts it back.

import { getPushConsent, setPushConsent } from "../api.ts";
import { pushSupported, subscribeWeb } from "../push.ts";
import { el } from "../shell.ts";
import { remindersWebCopyFor } from "../../shared/app/reminders-web-copy.ts";
import { MEAL_SLOTS, mealReminderCopyFor, type MealReminders } from "../../shared/meal-reminders.ts";
import type { YouCopy } from "../../shared/app/you-copy.ts";
import type { Lang } from "../../shared/types.ts";

export async function mealReminderRows(
  after: HTMLElement, words: YouCopy["reminders"], web: YouCopy["web"], lang: Lang, onSubscribed: () => void,
): Promise<void> {
  const consent = await getPushConsent().catch(() => null);
  if (!consent || !after.isConnected) return;
  let settings: MealReminders = consent.mealReminders;
  const names = mealReminderCopyFor(lang);
  const rows: HTMLElement[] = [];

  const head = el("div", "opt");
  const headText = el("div", "ot", words.beforeMeals);
  head.append(headText);
  // The browser half: reminders reach this browser only while it is subscribed AND the account's
  // Notifications are on. A browser the server sends no push to (no key) or that cannot receive it
  // keeps the old line: the reminders are the iPhone's.
  const key = consent.webPushKey;
  const canWeb = pushSupported() && key !== null;
  const subscribed = canWeb && consent.notifications && Notification.permission === "granted";
  const C = remindersWebCopyFor(lang);
  const note = el("div", "sub", subscribed ? C.note : words.webNote);
  rows.push(head, note);
  if (canWeb && !subscribed) {
    const row = el("div", "opt");
    const text = el("div", "ot");
    const blocked = el("div", "sub", web.offInBrowser);
    blocked.hidden = Notification.permission !== "denied";
    const turnOn = el("button", "cta s", C.button) as HTMLButtonElement;
    turnOn.type = "button";
    turnOn.hidden = !blocked.hidden;
    turnOn.addEventListener("click", async () => {
      turnOn.disabled = true;
      try {
        // This click is the gesture the browser's permission prompt needs.
        if (await subscribeWeb(key) === "denied") {
          blocked.hidden = false;
          turnOn.hidden = true;
          return;
        }
        await setPushConsent({ notifications: true });
        onSubscribed();
      } catch {
        turnOn.disabled = false;
      }
    });
    // The button goes UNDER the line, not beside it: it is full width, and beside the text it left the
    // sentence a sliver one word wide at 390px.
    text.append(el("span", "ot", C.prompt), blocked, turnOn);
    row.append(text);
    rows.push(row);
  }

  const save = async (next: MealReminders) => {
    const was = settings;
    settings = next;
    try {
      settings = (await setPushConsent({ mealReminders: next })).mealReminders;
    } catch {
      settings = was;
    }
    paint();
  };

  const paints: Array<() => void> = [];
  // The evening line (a push) has its own switch beside the slots; absent = on.
  {
    const row = el("div", "opt sw");
    const lab = el("span", "ot", words.evening);
    lab.id = "sw-meal-evening";
    const sw = el("button", "swt") as HTMLButtonElement;
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-labelledby", lab.id);
    sw.append(el("i", ""));
    sw.addEventListener("click", () => void save({ ...settings, evening: settings.evening === false }));
    const text = el("div", "ot");
    text.append(lab, el("div", "sub", words.eveningSub));
    row.append(text, sw);
    rows.unshift(row);
    paints.push(() => sw.setAttribute("aria-checked", String(settings.evening !== false)));
  }
  for (const slot of MEAL_SLOTS) {
    const row = el("div", "opt sw");
    const labelId = `sw-meal-${slot}`;
    const lab = el("span", "ot", names[slot]);
    lab.id = labelId;
    const time = el("input", "tm") as HTMLInputElement;
    time.type = "time";
    time.setAttribute("aria-label", names[slot]);
    time.addEventListener("change", () => {
      if (/^\d\d:\d\d$/.test(time.value)) void save({ ...settings, [slot]: { ...settings[slot], time: time.value } });
    });
    const sw = el("button", "swt") as HTMLButtonElement;
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-labelledby", labelId);
    sw.append(el("i", ""));
    sw.addEventListener("click", () => void save({ ...settings, [slot]: { ...settings[slot], on: !settings[slot].on } }));
    const text = el("div", "ot");
    text.append(lab, time);
    row.append(text, sw);
    rows.push(row);
    paints.push(() => {
      sw.setAttribute("aria-checked", String(settings[slot].on));
      time.value = settings[slot].time;
    });
  }
  function paint(): void { for (const p of paints) p(); }
  paint();
  after.after(...rows);
}
