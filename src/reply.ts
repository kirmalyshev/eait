// Human-facing reply for one analyzed meal (spec §8): items, macros, verdicts (only the user's
// relevant dimensions), and the running daily total vs the user's targets. ru by default.

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

export function formatReply(
  meal: FormatMeal,
  totals: DailyTotals,
  targets: FoodTargets,
  _lang: Lang = "ru",
): string {
  const lines: string[] = [];

  // items
  const items = meal.items.length
    ? meal.items.map((i) => `${i.name} ${round(i.grams)}г`).join(", ")
    : "—";
  lines.push(`🍽 ${items}`);

  // this meal's macros
  lines.push(
    `🔥 ${round(meal.kcal)} ккал · Б ${round(meal.protein_g)} · Ж ${round(meal.fat_g)} · У ${round(meal.carbs_g)}`,
  );

  // verdicts — only dimensions present in the analysis (i.e. relevant to this user's profile)
  const verdictLines: string[] = [];
  if (meal.verdicts.weight) verdictLines.push(`Вес: ${verdictEmoji(meal.verdicts.weight)}`);
  if (meal.verdicts.ldl) verdictLines.push(`Холестерин: ${verdictEmoji(meal.verdicts.ldl)}`);
  if (meal.verdicts.kidneys) verdictLines.push(`Почки: ${verdictEmoji(meal.verdicts.kidneys)}`);
  if (verdictLines.length) lines.push(verdictLines.join("  "));

  if (meal.notes && meal.notes.trim()) lines.push(`📝 ${meal.notes.trim()}`);

  // running daily total vs the user's targets
  lines.push("");
  lines.push(`Итого сегодня: ${round(totals.kcal)} / ${targets.kcal} ккал`);
  lines.push(`Белок: ${round(totals.protein_g)} / ${targets.protein_g} г`);
  if (targets.satfat_g !== undefined) {
    lines.push(`Насыщенные жиры: ${round(totals.satfat_g)} / ${targets.satfat_g} г`);
  }
  if (targets.sodium_mg !== undefined) {
    lines.push(`Натрий: ${round(totals.sodium_mg)} / ${targets.sodium_mg} мг`);
  }

  return lines.join("\n");
}
