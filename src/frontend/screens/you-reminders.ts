// The per-meal reminder rows on the web You card (#902): a switch and a time per slot. The reminders
// themselves are LOCAL notifications on the iPhone — the browser only edits the account's setting,
// and says so in one line. Mirrors `you-push.ts`: a tap shows the new position, a failure puts it back.

import { getPushConsent, setPushConsent } from "../api.ts";
import { el } from "../shell.ts";
import { MEAL_SLOTS, mealReminderCopyFor, type MealReminders } from "../../shared/meal-reminders.ts";
import type { YouCopy } from "../../shared/app/you-copy.ts";
import type { Lang } from "../../shared/types.ts";

export async function mealReminderRows(after: HTMLElement, words: YouCopy["reminders"], lang: Lang): Promise<void> {
  const consent = await getPushConsent().catch(() => null);
  if (!consent || !after.isConnected) return;
  let settings: MealReminders = consent.mealReminders;
  const names = mealReminderCopyFor(lang);
  const rows: HTMLElement[] = [];

  const head = el("div", "opt");
  const headText = el("div", "ot", words.beforeMeals);
  head.append(headText);
  const note = el("div", "sub", words.webNote);
  rows.push(head, note);

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
    rows.splice(1, 0, row);
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
