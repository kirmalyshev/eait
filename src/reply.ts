// Human-facing reply for one analyzed meal (spec §8): items, macros, verdicts (only the user's
// relevant dimensions), and the running daily total vs the user's targets.
//
// Every string comes from the caller's translator — nothing is hard-coded here. The caller owns
// the language (see src/i18n), so this stays a pure formatter.

import type { TFunction } from "i18next";
import type { DailyTotals, FoodTargets, Lang, MealItem, MealVerdicts, Verdict } from "./types.ts";

/** The meal fields formatReply needs — satisfied by both MealAnalysis and MealRecord. */
export interface FormatMeal {
  items: MealItem[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  satfat_g: number;
  sodium_mg: number;
  verdicts: MealVerdicts;
  confidence?: string | null;
  notes?: string | null;
}

/**
 * A human day label (en → "Tue, Jul 21", de → "Di., 21. Juli", ru → "вт, 21 июл.") for a stored
 * YYYY-MM-DD, rendered in the user's locale and the bot's timezone. Pure. The noon-UTC anchor keeps
 * the calendar day stable for any offset within ±12h (covers every European tz the bot runs in).
 * Names come from Intl, so no month/weekday strings live in the catalog. `lang` is a validated Lang
 * (a bad BCP-47 tag would make Intl throw); a malformed date degrades loudly to the raw string
 * rather than throwing a RangeError into a reply handler.
 */
export function berlinDayLabel(date: string, lang: Lang, tz = "Europe/Berlin"): string {
  const d = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) {
    console.warn(`[eait] berlinDayLabel: unusable date ${JSON.stringify(date)} — returning raw`);
    return date;
  }
  return new Intl.DateTimeFormat(lang, {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(d);
}

/**
 * The date label to show for a meal, or undefined when it is today's — the "not today ⇒ named"
 * rule, in ONE place. Every meal-card site (confirm prompt, logged card, correction card) resolves
 * through this so a future site can't forget the today-vs-not comparison and mislabel a same-day
 * meal, or a past-dated one as "Today".
 */
export function mealDateLabel(
  mealDate: string,
  today: string,
  lang: Lang,
  tz: string,
): string | undefined {
  return mealDate === today ? undefined : berlinDayLabel(mealDate, lang, tz);
}

export function verdictEmoji(v: Verdict): string {
  switch (v) {
    case "good":
      return "✅";
    case "warn":
      return "⚠️";
    case "bad":
      return "❌";
  }
}

const round = (n: number) => Math.round(n);

/** The verdict dimensions, in render order. Only those present in the analysis are shown. */
const VERDICT_KEYS = ["weight", "ldl", "kidneys"] as const;

export function formatReply(
  meal: FormatMeal,
  totals: DailyTotals,
  targets: FoodTargets,
  t: TFunction,
  // dateLabel present ⇒ the meal is NOT for today; name the day and label the totals with it.
  // Absent ⇒ byte-identical to the pre-date-feature output.
  opts?: { dateLabel?: string },
): string {
  const lines: string[] = [];

  if (opts?.dateLabel) lines.push(t("meal.loggedForDate", { date: opts.dateLabel }));

  // items
  const items = meal.items.length
    ? meal.items.map((i) => t("meal.itemUnit", { name: i.name, grams: round(i.grams) })).join(", ")
    : t("meal.noItems");
  lines.push(t("meal.itemsLine", { items }));

  // this meal's macros
  lines.push(
    t("meal.macrosLine", {
      kcal: round(meal.kcal),
      protein: round(meal.protein_g),
      fat: round(meal.fat_g),
      carbs: round(meal.carbs_g),
    }),
  );

  // verdicts — only dimensions present in the analysis (i.e. relevant to this user's profile)
  const verdictLines = VERDICT_KEYS.flatMap((k) => {
    const v = meal.verdicts[k];
    if (!v) return [];
    return [t("meal.verdictItem", { label: t(`meal.verdict.${k}`), emoji: verdictEmoji(v) })];
  });
  if (verdictLines.length) lines.push(verdictLines.join("  "));

  if (meal.notes && meal.notes.trim()) lines.push(t("meal.notesLine", { notes: meal.notes.trim() }));

  // running daily total vs the user's targets (for the meal's day — "Today" when same-day)
  lines.push("");
  lines.push(
    opts?.dateLabel
      ? t("meal.totalKcalDated", { date: opts.dateLabel, now: round(totals.kcal), target: targets.kcal })
      : t("meal.totalKcal", { now: round(totals.kcal), target: targets.kcal }),
  );
  lines.push(t("meal.totalProtein", { now: round(totals.protein_g), target: targets.protein_g }));
  if (targets.satfat_g !== undefined) {
    lines.push(t("meal.totalSatfat", { now: round(totals.satfat_g), target: targets.satfat_g }));
  }
  if (targets.sodium_mg !== undefined) {
    lines.push(t("meal.totalSodium", { now: round(totals.sodium_mg), target: targets.sodium_mg }));
  }

  return lines.join("\n");
}
