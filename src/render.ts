// Rich-HTML rendering of a meal card for Telegram Bot API 10.1 sendRichMessage. Layout lives
// here in code; every user-visible string still comes from the caller's translator, and every
// interpolated value (LLM item names, notes) is HTML-escaped — the model must never be able to
// inject markup. Plain-mode rendering stays in reply.ts; this module is rich-only.

import type { TFunction } from "i18next";
import type { DailyTotals, FoodTargets } from "./types.ts";
import { verdictEmoji, type FormatMeal } from "./reply.ts";

export function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

const round = (n: number) => Math.round(n);

/** The verdict dimensions, in render order — mirrors reply.ts. */
const VERDICT_ROWS = [
  ["weight", "⚖️"],
  ["ldl", "🫀"],
  ["kidneys", "🫘"],
] as const;

export function renderMealCard(
  meal: FormatMeal,
  totals: DailyTotals,
  targets: FoodTargets,
  t: TFunction,
): string {
  const title = meal.items.length
    ? meal.items.map((i) => t("meal.itemUnit", { name: i.name, grams: round(i.grams) })).join(", ")
    : t("meal.noItems");

  const parts: string[] = [];
  parts.push(`<h3>🍽 ${escapeHtml(title)}</h3>`);

  const rows: Array<[string, string]> = [
    [`🔥 ${t("rich.calories")}`, `${round(meal.kcal)} kcal`],
    [`🥩 ${t("rich.protein")}`, `${round(meal.protein_g)} g`],
    [`🧈 ${t("rich.fat")}`, `${round(meal.fat_g)} g`],
    [`🍞 ${t("rich.carbs")}`, `${round(meal.carbs_g)} g`],
  ];
  for (const [key, emoji] of VERDICT_ROWS) {
    const v = meal.verdicts[key];
    if (v) rows.push([`${emoji} ${t(`meal.verdict.${key}`)}`, verdictEmoji(v)]);
  }
  parts.push(table(t("rich.metric"), t("rich.amount"), rows));

  if (meal.notes && meal.notes.trim()) {
    parts.push(`<blockquote>📝 ${escapeHtml(meal.notes.trim())}</blockquote>`);
  }

  parts.push(`<h4>📊 ${escapeHtml(t("rich.todaysProgress"))}</h4>`);
  const progress: Array<[string, string]> = [
    [`🔥 ${t("rich.calories")}`, `${round(totals.kcal)} / ${targets.kcal} kcal`],
    [`🥩 ${t("rich.protein")}`, `${round(totals.protein_g)} / ${targets.protein_g} g`],
  ];
  if (targets.satfat_g !== undefined) {
    progress.push([`🧈 ${t("rich.satfat")}`, `${round(totals.satfat_g)} / ${targets.satfat_g} g`]);
  }
  if (targets.sodium_mg !== undefined) {
    progress.push([`🧂 ${t("rich.sodium")}`, `${round(totals.sodium_mg)} / ${targets.sodium_mg} mg`]);
  }
  parts.push(table(t("rich.goal"), t("rich.progress"), progress));

  parts.push(`<footer>↩️ ${escapeHtml(t("meal.correctionHint"))}</footer>`);
  return parts.join("\n");
}

function table(head1: string, head2: string, rows: Array<[string, string]>): string {
  const body = rows
    .map(([k, v]) => `<tr><td align="left">${escapeHtml(k)}</td><td align="right"><b>${escapeHtml(v)}</b></td></tr>`)
    .join("");
  return `<table bordered striped><tr><th>${escapeHtml(head1)}</th><th>${escapeHtml(head2)}</th></tr>${body}</table>`;
}
