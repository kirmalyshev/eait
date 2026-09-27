// The Progress surface's words (W8, #95) — the weight card with its 90D · 6M · 1Y · All ranges,
// the goal bar ("74 → 68 kg", "around {month} · estimate", "{n} kg down", "{n} to go"), the
// "This week" kcal bars against the plan, and the "Streak" card with its M–S dots.
//
// THE BOARDS: `product/design/pro/web/progress.html` and `phone/progress.html` on ieat-app main
// (3d2b4357). Both clients draw the same four cards; the phone adds a `.tt` title and a back
// chevron, the web header is the shell's (the `eait` wordmark, the four tabs, the day pager —
// `SHELL_COPY`, not this surface's words).
//
// WHAT IS NOT HERE, and where it lives instead:
// - The tab labels and the "+" — `SHELL_COPY` (`app/shell-copy.ts`).
// - Every number — `numbers`/`wholeNumbers` fill `{n}`/`{from}`/`{to}`/`{plan}`;
//   `projectionMonth`/`monthYear` fill `{month}`; the axis dates ("24 Aug") are `trend.ts`'s
//   day-month formatter. A computed figure is never typed into a string.
// - The seven day letters under the bars and the dots — `weekdayLetters(lang)` in `lang.ts`.
// - The streak count's "days" — `CountForms` + `countText(lang)`, because Russian needs three
//   forms and one template cannot hold them.
// - The unit WORD travels inside each template — `weightNow`, `goalLine`, `goalDown`, `goalUp`
//   and `goalToGo` are `metric`/`imperial` pairs, because a weight's unit is part of its
//   sentence and `de` is metric while `en` is not automatically imperial.

import { t, type CountForms, type Localized } from "../lang.ts";
import type { Lang } from "../types.ts";
import type { UnitSystem } from "../ui/units.ts";
import type { WeightRange } from "../ui/charts.ts";
import { HEALTH_COPY } from "../health-copy.ts";
import { SHELL_COPY } from "./shell-copy.ts";
import { CHAT_COPY } from "../onboarding-chat-copy.ts";

/** A weight sentence in the reader's unit system — the unit word is the template's own. */
type ByUnits = Record<UnitSystem, string>;

export interface ProgressCopy {
  /** The phone `.tt` title and the screen's name — the tab's own word, `SHELL_COPY.navProgress`. */
  title: string;
  /** The "Weight" card's label — `HEALTH_COPY.labels.weight_kg`, one word for one quantity. */
  weightLabel: string;
  /** The big current figure under it — "{n} kg"; `{n}` from `numbers` keeps a typed tenth. */
  weightNow: ByUnits;
  /**
   * The range segment chips over the chart, keyed by `WEIGHT_RANGES` (`ui/charts.ts`). Compact
   * on the board — one letter per period — and the same chips on both clients.
   */
  ranges: Record<WeightRange, string>;
  /** The goal bar's headline — "{from} → {to} kg", start and target in the reader's units. */
  goalLine: ByUnits;
  /**
   * The `.est` tag beside it — "around {month} · estimate"; `{month}` is `projectionMonth`'s
   * month-and-year (the goal card's chart words, not `chart.monthEstimate`, which has no
   * "around").
   */
  goalEstimate: string;
  /**
   * Under the fill, left — how far the weigh-ins already carry the goal. `goalBar` runs both
   * directions, so `goalDown` is "…kg down" for a lose and `goalUp` "…kg up" for a gain; a
   * maintain goal draws no bar at all.
   */
  goalDown: ByUnits;
  goalUp: ByUnits;
  /** Under the fill, right — "{n} to go"; the English board writes no unit beside it. */
  goalToGo: ByUnits;
  /** The "This week" card's label — the week's kcal bars against the plan. */
  weekLabel: string;
  /**
   * The `.est` beside it — "kcal a day · plan {plan}"; `{plan}` is `wholeNumbers`'s. Each
   * language spells its own kcal word inside the sentence (Russian writes ккал), the
   * `UNIT_KCAL` rule.
   */
  weekPlan: string;
  /** The "Streak" card's label. */
  streakLabel: string;
  /** The streak's figure — "4 days". `countText(lang)` picks the form CLDR names for the count. */
  streakDays: CountForms;
  /**
   * The weight chart's accessible NAME — `CHAT_COPY.chart.weightTrend` ("Weight trend"), the
   * shared chart word. The board draws no "eait analysis" tag on this chart: it is logged data,
   * and the mark is for the estimate charts.
   */
  weightChartName: string;
  /** Phone only: the `.top` chevron's accessible name — the board draws the arrow, not a word. */
  phone: { back: string };
}

const EN: ProgressCopy = {
  title: SHELL_COPY.en!.navProgress,
  weightLabel: HEALTH_COPY.en!.labels.weight_kg!,
  weightNow: { metric: "{n} kg", imperial: "{n} lb" },
  ranges: { "90D": "90D", "6M": "6M", "1Y": "1Y", all: "All" },
  goalLine: { metric: "{from} → {to} kg", imperial: "{from} → {to} lb" },
  goalEstimate: "around {month} · estimate",
  goalDown: { metric: "{n} kg down", imperial: "{n} lb down" },
  goalUp: { metric: "{n} kg up", imperial: "{n} lb up" },
  goalToGo: { metric: "{n} to go", imperial: "{n} to go" },
  weekLabel: "This week",
  weekPlan: "kcal a day · plan {plan}",
  streakLabel: "Streak",
  streakDays: { one: "{n} day", other: "{n} days" },
  weightChartName: CHAT_COPY.en!.chart.weightTrend,
  phone: { back: "Back" },
};

const FR: ProgressCopy = {
  title: SHELL_COPY.fr!.navProgress,
  weightLabel: HEALTH_COPY.fr!.labels.weight_kg!,
  weightNow: { metric: "{n} kg", imperial: "{n} lb" },
  ranges: { "90D": "90 j", "6M": "6 m", "1Y": "1 an", all: "Tout" },
  goalLine: { metric: "{from} → {to} kg", imperial: "{from} → {to} lb" },
  goalEstimate: "vers {month} · estimation",
  goalDown: { metric: "{n} kg en moins", imperial: "{n} lb en moins" },
  goalUp: { metric: "{n} kg en plus", imperial: "{n} lb en plus" },
  goalToGo: { metric: "reste {n} kg", imperial: "reste {n} lb" },
  weekLabel: "Cette semaine",
  weekPlan: "kcal par jour · plan {plan}",
  streakLabel: "Série",
  streakDays: { one: "{n} jour", other: "{n} jours" },
  weightChartName: CHAT_COPY.fr!.chart.weightTrend,
  phone: { back: "Retour" },
};

const DE: ProgressCopy = {
  title: SHELL_COPY.de!.navProgress,
  weightLabel: HEALTH_COPY.de!.labels.weight_kg!,
  weightNow: { metric: "{n} kg", imperial: "{n} lb" },
  ranges: { "90D": "90 T", "6M": "6 M", "1Y": "1 J", all: "Alle" },
  goalLine: { metric: "{from} → {to} kg", imperial: "{from} → {to} lb" },
  goalEstimate: "ca. {month} · Schätzung",
  goalDown: { metric: "{n} kg weniger", imperial: "{n} lb weniger" },
  goalUp: { metric: "{n} kg mehr", imperial: "{n} lb mehr" },
  goalToGo: { metric: "noch {n} kg", imperial: "noch {n} lb" },
  weekLabel: "Diese Woche",
  weekPlan: "kcal pro Tag · Plan {plan}",
  streakLabel: "Serie",
  streakDays: { one: "{n} Tag", other: "{n} Tage" },
  weightChartName: CHAT_COPY.de!.chart.weightTrend,
  phone: { back: "Zurück" },
};

const IT: ProgressCopy = {
  title: SHELL_COPY.it!.navProgress,
  weightLabel: HEALTH_COPY.it!.labels.weight_kg!,
  weightNow: { metric: "{n} kg", imperial: "{n} lb" },
  ranges: { "90D": "90 g", "6M": "6 m", "1Y": "1 a", all: "Tutto" },
  goalLine: { metric: "{from} → {to} kg", imperial: "{from} → {to} lb" },
  goalEstimate: "intorno a {month} · stima",
  goalDown: { metric: "{n} kg in meno", imperial: "{n} lb in meno" },
  goalUp: { metric: "{n} kg in più", imperial: "{n} lb in più" },
  goalToGo: { metric: "mancano {n} kg", imperial: "mancano {n} lb" },
  weekLabel: "Questa settimana",
  weekPlan: "kcal al giorno · piano {plan}",
  streakLabel: "Serie",
  streakDays: { one: "{n} giorno", other: "{n} giorni" },
  weightChartName: CHAT_COPY.it!.chart.weightTrend,
  phone: { back: "Indietro" },
};

const ES: ProgressCopy = {
  title: SHELL_COPY.es!.navProgress,
  weightLabel: HEALTH_COPY.es!.labels.weight_kg!,
  weightNow: { metric: "{n} kg", imperial: "{n} lb" },
  ranges: { "90D": "90 d", "6M": "6 m", "1Y": "1 a", all: "Todo" },
  goalLine: { metric: "{from} → {to} kg", imperial: "{from} → {to} lb" },
  goalEstimate: "hacia {month} · estimación",
  goalDown: { metric: "{n} kg menos", imperial: "{n} lb menos" },
  goalUp: { metric: "{n} kg más", imperial: "{n} lb más" },
  goalToGo: { metric: "faltan {n} kg", imperial: "faltan {n} lb" },
  weekLabel: "Esta semana",
  weekPlan: "kcal al día · plan {plan}",
  streakLabel: "Racha",
  streakDays: { one: "{n} día", other: "{n} días" },
  weightChartName: CHAT_COPY.es!.chart.weightTrend,
  phone: { back: "Atrás" },
};

const VI: ProgressCopy = {
  title: SHELL_COPY.vi!.navProgress,
  weightLabel: HEALTH_COPY.vi!.labels.weight_kg!,
  weightNow: { metric: "{n} kg", imperial: "{n} lb" },
  // Compact chips: N = ngày, T = tháng — "năm" is written out so 1N never reads as one day.
  ranges: { "90D": "90N", "6M": "6T", "1Y": "1 năm", all: "Tất cả" },
  goalLine: { metric: "{from} → {to} kg", imperial: "{from} → {to} lb" },
  goalEstimate: "khoảng {month} · ước tính",
  goalDown: { metric: "giảm {n} kg", imperial: "giảm {n} lb" },
  goalUp: { metric: "tăng {n} kg", imperial: "tăng {n} lb" },
  goalToGo: { metric: "còn {n} kg", imperial: "còn {n} lb" },
  weekLabel: "Tuần này",
  weekPlan: "kcal mỗi ngày · kế hoạch {plan}",
  streakLabel: "Chuỗi",
  streakDays: { other: "{n} ngày" },
  weightChartName: CHAT_COPY.vi!.chart.weightTrend,
  phone: { back: "Quay lại" },
};

const ID: ProgressCopy = {
  title: SHELL_COPY.id!.navProgress,
  weightLabel: HEALTH_COPY.id!.labels.weight_kg!,
  weightNow: { metric: "{n} kg", imperial: "{n} lb" },
  // Compact chips: H = hari, B = bulan, Th = tahun.
  ranges: { "90D": "90H", "6M": "6B", "1Y": "1Th", all: "Semua" },
  goalLine: { metric: "{from} → {to} kg", imperial: "{from} → {to} lb" },
  goalEstimate: "sekitar {month} · perkiraan",
  goalDown: { metric: "turun {n} kg", imperial: "turun {n} lb" },
  goalUp: { metric: "naik {n} kg", imperial: "naik {n} lb" },
  goalToGo: { metric: "kurang {n} kg", imperial: "kurang {n} lb" },
  weekLabel: "Minggu ini",
  weekPlan: "kcal per hari · rencana {plan}",
  streakLabel: "Rentetan",
  streakDays: { other: "{n} hari" },
  weightChartName: CHAT_COPY.id!.chart.weightTrend,
  phone: { back: "Kembali" },
};

const RU: ProgressCopy = {
  title: SHELL_COPY.ru!.navProgress,
  weightLabel: HEALTH_COPY.ru!.labels.weight_kg!,
  weightNow: { metric: "{n} кг", imperial: "{n} lb" },
  ranges: { "90D": "90Д", "6M": "6М", "1Y": "1Г", all: "Все" },
  goalLine: { metric: "{from} → {to} кг", imperial: "{from} → {to} lb" },
  goalEstimate: "примерно {month} · оценка",
  // The SYMBOL, as `planGoal` writes it: "кг" never declines, which is the whole point of
  // putting it beside a number. "lb" stays Latin for the same reason — "фунтов" is the
  // genitive plural and reads wrong beside 1 or 2–4.
  goalDown: { metric: "минус {n} кг", imperial: "минус {n} lb" },
  goalUp: { metric: "плюс {n} кг", imperial: "плюс {n} lb" },
  goalToGo: { metric: "осталось {n} кг", imperial: "осталось {n} lb" },
  weekLabel: "На этой неделе",
  weekPlan: "ккал в день · план {plan}",
  streakLabel: "Серия",
  streakDays: { one: "{n} день", few: "{n} дня", many: "{n} дней", other: "{n} дня" },
  weightChartName: CHAT_COPY.ru!.chart.weightTrend,
  phone: { back: "Назад" },
};

export const PROGRESS_COPY: Localized<ProgressCopy> = {
  en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU,
};

export const progressCopyFor = (lang: Lang): ProgressCopy => t(lang)(PROGRESS_COPY);
