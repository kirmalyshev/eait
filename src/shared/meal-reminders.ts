// Per-meal reminders (ieat-app#902): up to three LOCAL notifications — breakfast, lunch, dinner —
// each with its own switch and time. They are independent of the 20:30 evening line in
// `notifications.ts`; both may be on.
//
// It lives in shared for the reason `reminderPlan` does: the phone schedules, and "which slots
// should exist right now" must be testable without a phone. The words are compiled in, not
// admin-editable — a local notification carries its text from the moment it is scheduled, so a
// stored copy could not reach a scheduled one anyway.
//
// THE READER. A slot fires only if its meal is not logged yet, and a notification cannot ask. So
// the plan is recomputed from today's logged meals on every launch and on every log: a slot whose
// meal is already in is simply not in the plan, and the phone cancels it.

import { dateMinus, localDate, localTime } from "./dates.ts";
import { t, type Localized } from "./lang.ts";
import type { Lang } from "./types.ts";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

export interface MealReminder {
  on: boolean;
  /** `HH:MM`, 24-hour, in the account's zone. */
  time: string;
}
export type MealReminders = Record<MealSlot, MealReminder> & {
  /** The 20:30 evening line (a push). Absent = on, which is every account that never chose; `false` = off. */
  evening?: boolean;
};

/** What an account that never chose has: breakfast and lunch on, dinner off. */
export const DEFAULT_MEAL_REMINDERS: MealReminders = {
  breakfast: { on: true, time: "08:30" },
  lunch: { on: true, time: "12:30" },
  dinner: { on: false, time: "19:00" },
};

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isMealReminders(v: unknown): v is MealReminders {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (o.evening !== undefined && typeof o.evening !== "boolean") return false;
  return MEAL_SLOTS.every((s) => {
    const r = o[s] as Record<string, unknown> | undefined;
    return typeof r === "object" && r !== null && typeof r.on === "boolean"
      && typeof r.time === "string" && HHMM.test(r.time);
  });
}

/** Days scheduled ahead, today included. Opening the app is what refills them. */
export const MEAL_REMINDER_DAYS = 2;

/** A meal logged this long BEFORE a slot's time already counts as that slot's meal. */
const EARLY_MINUTES = 90;

export interface PlannedMealReminder {
  slot: MealSlot;
  /** Stable per slot and day OFFSET (`meal-lunch-0` = today), so a re-sync replaces, never stacks. */
  id: string;
  /** `YYYY-MM-DD` in the server's zone. */
  date: string;
  hour: number;
  minute: number;
}

const minutesOf = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return (h % 24) * 60 + m; // `hour12: false` may format midnight as 24
};

/** Every id this module can schedule — what a sync cancels before it schedules. */
export const MEAL_REMINDER_IDS: string[] = MEAL_SLOTS.flatMap((s) =>
  Array.from({ length: MEAL_REMINDER_DAYS }, (_, i) => `meal-${s}-${i}`));

/**
 * The slots that should be on the device now.
 *
 * `mealTimestamps` are the ISO times of the meals logged (any day; other days are ignored). A slot
 * is covered when a meal was logged today from 90 minutes before its time until 90 minutes before
 * the next slot's time (or the end of the day) — breakfast at 07:40 covers 08:30. Future days have
 * nothing logged, and a time already gone today is dropped: iOS accepts such a trigger and never
 * fires it.
 */
export function mealReminderPlan(
  settings: MealReminders,
  mealTimestamps: readonly string[],
  timezone: string,
  now: Date = new Date(),
): PlannedMealReminder[] {
  const today = localDate(timezone, now);
  const nowMin = minutesOf(localTime(timezone, now));
  const loggedMin = mealTimestamps
    .filter((ts) => localDate(timezone, new Date(ts)) === today)
    .map((ts) => minutesOf(localTime(timezone, new Date(ts))));
  // Slot boundaries over ALL three slots, on or off: an off dinner still splits the afternoon.
  const starts = MEAL_SLOTS.map((s) => minutesOf(settings[s].time) - EARLY_MINUTES);
  const out: PlannedMealReminder[] = [];
  for (const [i, slot] of MEAL_SLOTS.entries()) {
    const r = settings[slot];
    if (!r.on) continue;
    const at = minutesOf(r.time);
    const start = starts[i]!;
    const end = Math.min(24 * 60, ...starts.filter((s) => s > start));
    const covered = loggedMin.some((m) => m >= start && m < end);
    for (let d = 0; d < MEAL_REMINDER_DAYS; d++) {
      if (d === 0 && (covered || nowMin >= at)) continue;
      out.push({
        slot, id: `meal-${slot}-${d}`, date: dateMinus(today, -d),
        hour: Math.floor(at / 60), minute: at % 60,
      });
    }
  }
  return out;
}

export interface MealReminderCopy {
  breakfast: string;
  lunch: string;
  dinner: string;
  /** One body for all three: the reminder says what to do, never what was missed. */
  body: string;
}

export const MEAL_REMINDER_COPY: Localized<MealReminderCopy> = {
  en: { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", body: "A photo is enough to log it." },
  de: { breakfast: "Frühstück", lunch: "Mittagessen", dinner: "Abendessen", body: "Ein Foto genügt zum Eintragen." },
  fr: { breakfast: "Petit-déjeuner", lunch: "Déjeuner", dinner: "Dîner", body: "Une photo suffit pour l'enregistrer." },
  it: { breakfast: "Colazione", lunch: "Pranzo", dinner: "Cena", body: "Basta una foto per registrarlo." },
  es: { breakfast: "Desayuno", lunch: "Almuerzo", dinner: "Cena", body: "Una foto basta para registrarlo." },
  ru: { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин", body: "Чтобы записать, хватит одного фото." },
  id: { breakfast: "Sarapan", lunch: "Makan siang", dinner: "Makan malam", body: "Cukup satu foto untuk mencatatnya." },
  vi: { breakfast: "Bữa sáng", lunch: "Bữa trưa", dinner: "Bữa tối", body: "Chỉ cần chụp một tấm ảnh là xong." },
};

export const mealReminderCopyFor = (lang: Lang): MealReminderCopy => t(lang)(MEAL_REMINDER_COPY);
