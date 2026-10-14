// The Progress surface's words (W8, #95) — the weight card with its 90D · 6M · 1Y · All ranges,
// the goal bar ("74 → 68kg", "around {month} · estimate", "{n}kg down", "{n} to go"), the
// "This week" kcal bars against the plan, the "Streak" card with its M–S dots, the BMI card's
// source line and "?" name, and design-pro's empty states for the chart and the BMI figure.
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
  /** The big current figure under it — "{n}kg"; `{n}` from `numbers` keeps a typed tenth. */
  weightNow: ByUnits;
  /**
   * The range segment chips over the chart, keyed by `WEIGHT_RANGES` (`ui/charts.ts`). Compact
   * on the board — one letter per period — and the same chips on both clients.
   */
  ranges: Record<WeightRange, string>;
  /** The goal bar's headline — "{from} → {to}kg", start and target in the reader's units. */
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
   * The week chart's aria-label — "kcal a day · plan {plan}"; `{plan}` is `wholeNumbers`'s. Each
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

  // ── design-pro's empty states (#95, the ruling in the issue's comments) ──
  // A trend needs two points: onboarding writes the first weigh-in, so `weightEmpty` is the
  // legacy/import account that truly logged nothing, `weightOneMore` the brand-new one, and
  // `weightNone` the account whose log predates the selected range — which the UI never changes
  // for the user.
  /** No weigh-in anywhere: "—" for the figure and this LINK to the log-weight flow. */
  weightEmpty: string;
  /** Exactly one weigh-in in the range — its dot shows; this line invites the second. */
  weightOneMore: string;
  /**
   * Weigh-ins exist but the selected range holds none, keyed by `WEIGHT_RANGES` so the line
   * names the window the user picked. `all` never shows — every weigh-in is inside it.
   */
  weightNone: Record<WeightRange, string>;
  /**
   * The figure's quiet halves, SPLIT from `{n}` so a renderer never cuts a template at the
   * placeholder: `weightNowTail` is just the unit beside a current weigh-in ("kg"), and
   * `weightLatestTail` is the unit and its date beside the latest one ("kg · {date}") when the
   * picked range holds none. `{date}` is `lang.ts`'s dayMonth formatter. The unit word is the
   * language's own — "кг" in Russian, like every template here.
   */
  weightNowTail: ByUnits;
  weightLatestTail: ByUnits;
  /** The BMI card with no weigh-in: "—" and this link — never a BMI computed from nothing. */
  bmiEmpty: string;
  /** The BMI card's provenance line — "From {w} and {h}", both figures preformatted. */
  bmiFrom: string;
  /** The "?" on the BMI card — the accessible name of the button that explains the arithmetic. */
  bmiHelp: string;
  /**
   * The `.est` when `projection.beyondHorizon` holds — past the two-year horizon no month is an
   * honest one, so the card names the distance, not a date.
   */
  goalEstimateFar: string;
  /**
   * The notice when the weights read fails — the web twin's `refusalWords` under the card. The
   * drawn data stays; a reload never blanks it.
   */
  loadFailed: string;
  /** Phone only: the `.top` chevron's accessible name — the board draws the arrow, not a word. */
  phone: { back: string };
}

const EN: ProgressCopy = {
  title: SHELL_COPY.en!.navProgress,
  weightLabel: HEALTH_COPY.en!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  ranges: { "90D": "90D", "6M": "6M", "1Y": "1Y", all: "All" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "around {month} · estimate",
  goalDown: { metric: "{n}kg down", imperial: "{n}lb down" },
  goalUp: { metric: "{n}kg up", imperial: "{n}lb up" },
  goalToGo: { metric: "{n} to go", imperial: "{n} to go" },
  weekLabel: "This week",
  weekPlan: "kcal a day · plan {plan}",
  streakLabel: "Streak",
  streakDays: { one: "{n} day", other: "{n} days" },
  weightChartName: CHAT_COPY.en!.chart.weightTrend,
  weightEmpty: "Log a weight to see your trend",
  weightOneMore: "Log another weight to see your trend",
  weightNone: {
    "90D": "No weights in the last 90 days",
    "6M": "No weights in the last 6 months",
    "1Y": "No weights in the last year",
    all: "No weights yet",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Log a weight to see your BMI",
  bmiFrom: "From {w} and {h}",
  bmiHelp: "How BMI is computed",
  goalEstimateFar: "over two years · estimate",
  loadFailed: "Couldn't load your progress.",
  phone: { back: "Back" },
};

const FR: ProgressCopy = {
  title: SHELL_COPY.fr!.navProgress,
  weightLabel: HEALTH_COPY.fr!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  ranges: { "90D": "90 j", "6M": "6 m", "1Y": "1 an", all: "Tout" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "vers {month} · estimation",
  goalDown: { metric: "{n}kg en moins", imperial: "{n}lb en moins" },
  goalUp: { metric: "{n}kg en plus", imperial: "{n}lb en plus" },
  goalToGo: { metric: "reste {n}kg", imperial: "reste {n}lb" },
  weekLabel: "Cette semaine",
  weekPlan: "kcal par jour · plan {plan}",
  streakLabel: "Série",
  streakDays: { one: "{n} jour", other: "{n} jours" },
  weightChartName: CHAT_COPY.fr!.chart.weightTrend,
  weightEmpty: "Enregistre un poids pour voir ta tendance",
  weightOneMore: "Enregistre un autre poids pour voir ta tendance",
  weightNone: {
    "90D": "Aucun poids sur les 90 derniers jours",
    "6M": "Aucun poids sur les 6 derniers mois",
    "1Y": "Aucun poids sur la dernière année",
    all: "Aucun poids enregistré",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Enregistre un poids pour voir ton IMC",
  bmiFrom: "À partir de {w} et {h}",
  bmiHelp: "Comment l'IMC est calculé",
  goalEstimateFar: "plus de deux ans · estimation",
  loadFailed: "Impossible de charger ta progression.",
  phone: { back: "Retour" },
};

const DE: ProgressCopy = {
  title: SHELL_COPY.de!.navProgress,
  weightLabel: HEALTH_COPY.de!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  ranges: { "90D": "90 T", "6M": "6 M", "1Y": "1 J", all: "Alle" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "ca. {month} · Schätzung",
  goalDown: { metric: "{n}kg weniger", imperial: "{n}lb weniger" },
  goalUp: { metric: "{n}kg mehr", imperial: "{n}lb mehr" },
  goalToGo: { metric: "noch {n}kg", imperial: "noch {n}lb" },
  weekLabel: "Diese Woche",
  weekPlan: "kcal pro Tag · Plan {plan}",
  streakLabel: "Serie",
  streakDays: { one: "{n} Tag", other: "{n} Tage" },
  weightChartName: CHAT_COPY.de!.chart.weightTrend,
  weightEmpty: "Gewicht eintragen, um deinen Verlauf zu sehen",
  weightOneMore: "Noch ein Gewicht eintragen, um deinen Verlauf zu sehen",
  weightNone: {
    "90D": "Keine Gewichte in den letzten 90 Tagen",
    "6M": "Keine Gewichte in den letzten 6 Monaten",
    "1Y": "Keine Gewichte im letzten Jahr",
    all: "Noch keine Gewichte",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Gewicht eintragen, um deinen BMI zu sehen",
  bmiFrom: "Aus {w} und {h}",
  bmiHelp: "Wie der BMI berechnet wird",
  goalEstimateFar: "über zwei Jahre · Schätzung",
  loadFailed: "Dein Fortschritt ließ sich nicht laden.",
  phone: { back: "Zurück" },
};

const IT: ProgressCopy = {
  title: SHELL_COPY.it!.navProgress,
  weightLabel: HEALTH_COPY.it!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  ranges: { "90D": "90 g", "6M": "6 m", "1Y": "1 a", all: "Tutto" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "intorno a {month} · stima",
  goalDown: { metric: "{n}kg in meno", imperial: "{n}lb in meno" },
  goalUp: { metric: "{n}kg in più", imperial: "{n}lb in più" },
  goalToGo: { metric: "mancano {n}kg", imperial: "mancano {n}lb" },
  weekLabel: "Questa settimana",
  weekPlan: "kcal al giorno · piano {plan}",
  streakLabel: "Serie",
  streakDays: { one: "{n} giorno", other: "{n} giorni" },
  weightChartName: CHAT_COPY.it!.chart.weightTrend,
  weightEmpty: "Registra un peso per vedere il tuo andamento",
  weightOneMore: "Registra un altro peso per vedere il tuo andamento",
  weightNone: {
    "90D": "Nessun peso negli ultimi 90 giorni",
    "6M": "Nessun peso negli ultimi 6 mesi",
    "1Y": "Nessun peso nell'ultimo anno",
    all: "Ancora nessun peso",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Registra un peso per vedere il tuo IMC",
  bmiFrom: "Da {w} e {h}",
  bmiHelp: "Come viene calcolato l'IMC",
  goalEstimateFar: "oltre due anni · stima",
  loadFailed: "Impossibile caricare i tuoi progressi.",
  phone: { back: "Indietro" },
};

const ES: ProgressCopy = {
  title: SHELL_COPY.es!.navProgress,
  weightLabel: HEALTH_COPY.es!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  ranges: { "90D": "90 d", "6M": "6 m", "1Y": "1 a", all: "Todo" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "hacia {month} · estimación",
  goalDown: { metric: "{n}kg menos", imperial: "{n}lb menos" },
  goalUp: { metric: "{n}kg más", imperial: "{n}lb más" },
  goalToGo: { metric: "faltan {n}kg", imperial: "faltan {n}lb" },
  weekLabel: "Esta semana",
  weekPlan: "kcal al día · plan {plan}",
  streakLabel: "Racha",
  streakDays: { one: "{n} día", other: "{n} días" },
  weightChartName: CHAT_COPY.es!.chart.weightTrend,
  weightEmpty: "Registrar un peso para ver tu tendencia",
  weightOneMore: "Registrar otro peso para ver tu tendencia",
  weightNone: {
    "90D": "Sin pesos en los últimos 90 días",
    "6M": "Sin pesos en los últimos 6 meses",
    "1Y": "Sin pesos en el último año",
    all: "Aún no hay pesos",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Registrar un peso para ver tu IMC",
  bmiFrom: "A partir de {w} y {h}",
  bmiHelp: "Cómo se calcula el IMC",
  goalEstimateFar: "más de dos años · estimación",
  loadFailed: "No se pudo cargar tu progreso.",
  phone: { back: "Atrás" },
};

const VI: ProgressCopy = {
  title: SHELL_COPY.vi!.navProgress,
  weightLabel: HEALTH_COPY.vi!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  // Compact chips: N = ngày, T = tháng — "năm" is written out so 1N never reads as one day.
  ranges: { "90D": "90 ngày", "6M": "6 tháng", "1Y": "1 năm", all: "Tất cả" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "khoảng {month} · ước tính",
  goalDown: { metric: "giảm {n}kg", imperial: "giảm {n}lb" },
  goalUp: { metric: "tăng {n}kg", imperial: "tăng {n}lb" },
  goalToGo: { metric: "còn {n}kg", imperial: "còn {n}lb" },
  weekLabel: "Tuần này",
  weekPlan: "kcal mỗi ngày · kế hoạch {plan}",
  streakLabel: "Chuỗi",
  streakDays: { other: "{n} ngày" },
  weightChartName: CHAT_COPY.vi!.chart.weightTrend,
  weightEmpty: "Ghi cân nặng để xem xu hướng",
  weightOneMore: "Ghi thêm một lần cân để xem xu hướng",
  weightNone: {
    "90D": "Chưa có lần cân nào trong 90 ngày qua",
    "6M": "Chưa có lần cân nào trong 6 tháng qua",
    "1Y": "Chưa có lần cân nào trong năm qua",
    all: "Chưa có lần cân nào",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Ghi cân nặng để xem BMI",
  bmiFrom: "Từ {w} và {h}",
  bmiHelp: "Cách tính BMI",
  goalEstimateFar: "hơn hai năm · ước tính",
  loadFailed: "Không tải được tiến độ của bạn.",
  phone: { back: "Quay lại" },
};

const ID: ProgressCopy = {
  title: SHELL_COPY.id!.navProgress,
  weightLabel: HEALTH_COPY.id!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  // Compact chips: H = hari, B = bulan, Th = tahun.
  ranges: { "90D": "90H", "6M": "6B", "1Y": "1Th", all: "Semua" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "sekitar {month} · perkiraan",
  goalDown: { metric: "turun {n}kg", imperial: "turun {n}lb" },
  goalUp: { metric: "naik {n}kg", imperial: "naik {n}lb" },
  goalToGo: { metric: "tinggal {n}kg", imperial: "tinggal {n}lb" },
  weekLabel: "Minggu ini",
  weekPlan: "kcal per hari · rencana {plan}",
  streakLabel: "Runtunan",
  streakDays: { other: "{n} hari" },
  weightChartName: CHAT_COPY.id!.chart.weightTrend,
  weightEmpty: "Catat berat untuk melihat trenmu",
  weightOneMore: "Catat satu berat lagi untuk melihat trenmu",
  weightNone: {
    "90D": "Belum ada catatan berat dalam 90 hari terakhir",
    "6M": "Tidak ada berat dalam 6 bulan terakhir",
    "1Y": "Tidak ada berat dalam setahun terakhir",
    all: "Belum ada berat",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Catat berat untuk melihat IMT-mu",
  bmiFrom: "Dari {w} dan {h}",
  bmiHelp: "Cara menghitung IMT",
  goalEstimateFar: "lebih dari dua tahun · perkiraan",
  loadFailed: "Progresmu tidak bisa dimuat.",
  phone: { back: "Kembali" },
};

const RU: ProgressCopy = {
  title: SHELL_COPY.ru!.navProgress,
  weightLabel: HEALTH_COPY.ru!.labels.weight_kg!,
  weightNow: { metric: "{n}кг", imperial: "{n}lb" },
  ranges: { "90D": "90Д", "6M": "6М", "1Y": "1Г", all: "Все" },
  goalLine: { metric: "{from} → {to}кг", imperial: "{from} → {to}lb" },
  goalEstimate: "ориентир — {month} · оценка",
  // The SYMBOL, as `planGoal` writes it: "кг" never declines, which is the whole point of
  // putting it beside a number. "lb" stays Latin for the same reason — "фунтов" is the
  // genitive plural and reads wrong beside 1 or 2–4.
  goalDown: { metric: "минус {n}кг", imperial: "минус {n}lb" },
  goalUp: { metric: "плюс {n}кг", imperial: "плюс {n}lb" },
  goalToGo: { metric: "осталось {n}кг", imperial: "осталось {n}lb" },
  weekLabel: "На этой неделе",
  weekPlan: "ккал в день · план {plan}",
  streakLabel: "Серия",
  streakDays: { one: "{n} день", few: "{n} дня", many: "{n} дней", other: "{n} дня" },
  weightChartName: CHAT_COPY.ru!.chart.weightTrend,
  weightEmpty: "Запиши вес, чтобы увидеть динамику",
  weightOneMore: "Запиши ещё один вес, чтобы увидеть динамику",
  weightNone: {
    "90D": "Нет записей веса за последние 90 дней",
    "6M": "Нет записей веса за последние 6 месяцев",
    "1Y": "Нет записей веса за последний год",
    all: "Веса пока нет",
  },
  weightNowTail: { metric: "кг", imperial: "lb" },
  weightLatestTail: { metric: "кг · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Запиши вес, чтобы увидеть свой ИМТ",
  bmiFrom: "Из {w} и {h}",
  bmiHelp: "Как считается ИМТ",
  goalEstimateFar: "больше двух лет · оценка",
  loadFailed: "Не удалось загрузить твой прогресс.",
  phone: { back: "Назад" },
};

const NL: ProgressCopy = {
  title: SHELL_COPY.nl!.navProgress,
  weightLabel: HEALTH_COPY.nl!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  ranges: { "90D": "90D", "6M": "6M", "1Y": "1J", all: "Alles" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "rond {month} · schatting",
  goalDown: { metric: "{n}kg eraf", imperial: "{n}lb eraf" },
  goalUp: { metric: "{n}kg erbij", imperial: "{n}lb erbij" },
  goalToGo: { metric: "nog {n}", imperial: "nog {n}" },
  weekLabel: "Deze week",
  weekPlan: "kcal per dag · plan {plan}",
  streakLabel: "Reeks",
  streakDays: { one: "{n} dag", other: "{n} dagen" },
  weightChartName: CHAT_COPY.nl!.chart.weightTrend,
  weightEmpty: "Log een gewicht om je trend te zien",
  weightOneMore: "Log nog een gewicht om je trend te zien",
  weightNone: {
    "90D": "Geen gewichten in de afgelopen 90 dagen",
    "6M": "Geen gewichten in de afgelopen 6 maanden",
    "1Y": "Geen gewichten in het afgelopen jaar",
    all: "Nog geen gewichten",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Log een gewicht om je BMI te zien",
  bmiFrom: "Op basis van {w} en {h}",
  bmiHelp: "Hoe de BMI wordt berekend",
  goalEstimateFar: "meer dan twee jaar · schatting",
  loadFailed: "Je voortgang kon niet worden geladen.",
  phone: { back: "Terug" },
};

const PL: ProgressCopy = {
  title: SHELL_COPY.pl!.navProgress,
  weightLabel: HEALTH_COPY.pl!.labels.weight_kg!,
  weightNow: { metric: "{n} kg", imperial: "{n}lb" },
  ranges: { "90D": "90 dni", "6M": "6 mies.", "1Y": "1 rok", all: "Wszystko" },
  goalLine: { metric: "{from} → {to} kg", imperial: "{from} → {to}lb" },
  goalEstimate: "ok. {month} · szacunkowo",
  goalDown: { metric: "{n} kg mniej", imperial: "{n} lb mniej" },
  goalUp: { metric: "{n} kg więcej", imperial: "{n} lb więcej" },
  goalToGo: { metric: "zostało {n} kg", imperial: "zostało {n} lb" },
  weekLabel: "Ten tydzień",
  weekPlan: "kcal dziennie · plan {plan}",
  streakLabel: "Seria",
  streakDays: { one: "{n} dzień", other: "{n} dni" },
  weightChartName: CHAT_COPY.pl!.chart.weightTrend,
  weightEmpty: "Zapisz wagę, by zobaczyć trend",
  weightOneMore: "Zapisz kolejną wagę, by zobaczyć trend",
  weightNone: {
    "90D": "Brak wpisów wagi z ostatnich 90 dni",
    "6M": "Brak wpisów wagi z ostatnich 6 miesięcy",
    "1Y": "Brak wpisów wagi z ostatniego roku",
    all: "Nie ma jeszcze wpisów wagi",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Zapisz wagę, by zobaczyć BMI",
  bmiFrom: "Na podstawie: {w} i {h}",
  bmiHelp: "Jak liczymy BMI",
  goalEstimateFar: "ponad dwa lata · szacunkowo",
  loadFailed: "Nie udało się wczytać postępów.",
  phone: { back: "Wstecz" },
};

const TR: ProgressCopy = {
  title: SHELL_COPY.tr!.navProgress,
  weightLabel: HEALTH_COPY.tr!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  ranges: { "90D": "90G", "6M": "6A", "1Y": "1Y", all: "Tümü" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "{month} civarı · tahmini",
  goalDown: { metric: "{n}kg düşüş", imperial: "{n}lb düşüş" },
  goalUp: { metric: "{n}kg artış", imperial: "{n}lb artış" },
  goalToGo: { metric: "{n} kaldı", imperial: "{n} kaldı" },
  weekLabel: "Bu hafta",
  weekPlan: "kcal/gün · plan {plan}",
  streakLabel: "Seri",
  streakDays: { one: "{n} gün", other: "{n} gün" },
  weightChartName: CHAT_COPY.tr!.chart.weightTrend,
  weightEmpty: "Eğilimini görmek için kilonu kaydet",
  weightOneMore: "Eğilimini görmek için bir kilo daha kaydet",
  weightNone: {
    "90D": "Son 90 günde kilo kaydı yok",
    "6M": "Son 6 ayda kilo kaydı yok",
    "1Y": "Son bir yılda kilo kaydı yok",
    all: "Henüz kilo kaydı yok",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "VKİ'ni görmek için kilonu kaydet",
  bmiFrom: "{w} ve {h} üzerinden",
  bmiHelp: "VKİ nasıl hesaplanır",
  goalEstimateFar: "iki yıldan fazla · tahmini",
  loadFailed: "İlerlemen yüklenemedi.",
  phone: { back: "Geri" },
};

const ZH_HANT: ProgressCopy = {
  title: SHELL_COPY["zh-Hant"]!.navProgress,
  weightLabel: HEALTH_COPY["zh-Hant"]!.labels.weight_kg!,
  weightNow: { metric: "{n} 公斤", imperial: "{n}lb" },
  ranges: { "90D": "90 天", "6M": "6 個月", "1Y": "1 年", all: "全部" },
  goalLine: { metric: "{from} → {to} 公斤", imperial: "{from} → {to}lb" },
  goalEstimate: "約 {month} · 估計",
  goalDown: { metric: "減了 {n} 公斤", imperial: "減了 {n} lb" },
  goalUp: { metric: "增了 {n} 公斤", imperial: "增了 {n} lb" },
  goalToGo: { metric: "還差 {n} 公斤", imperial: "還差 {n} lb" },
  weekLabel: "本週",
  weekPlan: "大卡 /天 · 計畫 {plan}",
  streakLabel: "連續紀錄",
  streakDays: { one: "{n} 天", other: "{n} 天" },
  weightChartName: CHAT_COPY["zh-Hant"]!.chart.weightTrend,
  weightEmpty: "記錄體重，看看你的趨勢",
  weightOneMore: "再記錄一次體重，就能看到趨勢",
  weightNone: {
    "90D": "過去 90 天沒有體重紀錄",
    "6M": "過去 6 個月沒有體重紀錄",
    "1Y": "過去一年沒有體重紀錄",
    all: "還沒有體重紀錄",
  },
  weightNowTail: { metric: "公斤", imperial: "lb" },
  weightLatestTail: { metric: "公斤 · {date}", imperial: "lb · {date}" },
  bmiEmpty: "記錄體重，看看你的 BMI",
  bmiFrom: "根據 {w} 和 {h}",
  bmiHelp: "BMI 如何計算",
  goalEstimateFar: "超過兩年 · 估計",
  loadFailed: "無法載入你的進度。",
  phone: { back: "返回" },
};

const ZH_HANS: ProgressCopy = {
  title: SHELL_COPY["zh-Hans"]!.navProgress,
  weightLabel: HEALTH_COPY["zh-Hans"]!.labels.weight_kg!,
  weightNow: { metric: "{n}公斤", imperial: "{n}lb" },
  ranges: { "90D": "90天", "6M": "6个月", "1Y": "1年", all: "全部" },
  goalLine: { metric: "{from} → {to}公斤", imperial: "{from} → {to}lb" },
  goalEstimate: "约{month} · 估算",
  goalDown: { metric: "已减{n}公斤", imperial: "已减{n}lb" },
  goalUp: { metric: "已增{n}公斤", imperial: "已增{n}lb" },
  goalToGo: { metric: "还差{n}公斤", imperial: "还差{n}lb" },
  weekLabel: "本周",
  weekPlan: "千卡/天 · 计划{plan}",
  streakLabel: "连续记录",
  streakDays: { one: "{n}天", other: "{n}天" },
  weightChartName: CHAT_COPY["zh-Hans"]!.chart.weightTrend,
  weightEmpty: "记录体重，查看变化趋势",
  weightOneMore: "再记录一次体重，查看变化趋势",
  weightNone: {
    "90D": "最近90天没有体重记录",
    "6M": "最近6个月没有体重记录",
    "1Y": "最近一年没有体重记录",
    all: "还没有体重记录",
  },
  weightNowTail: { metric: "公斤", imperial: "lb" },
  weightLatestTail: { metric: "公斤 · {date}", imperial: "lb · {date}" },
  bmiEmpty: "记录体重，查看你的BMI",
  bmiFrom: "根据{w}和{h}计算",
  bmiHelp: "BMI的计算方式",
  goalEstimateFar: "两年以上 · 估算",
  loadFailed: "无法加载你的进度。",
  phone: { back: "返回" },
};

const KO: ProgressCopy = {
  title: SHELL_COPY.ko!.navProgress,
  weightLabel: HEALTH_COPY.ko!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  ranges: { "90D": "90일", "6M": "6개월", "1Y": "1년", all: "전체" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "{month}쯤 · 추정",
  goalDown: { metric: "{n}kg 감소", imperial: "{n}lb 감소" },
  goalUp: { metric: "{n}kg 증가", imperial: "{n}lb 증가" },
  goalToGo: { metric: "{n} 남음", imperial: "{n} 남음" },
  weekLabel: "이번 주",
  weekPlan: "하루 kcal · 계획 {plan}",
  streakLabel: "연속 기록",
  streakDays: { one: "{n}일", other: "{n}일" },
  weightChartName: CHAT_COPY.ko!.chart.weightTrend,
  weightEmpty: "체중을 기록하면 추이를 볼 수 있어요",
  weightOneMore: "체중을 한 번 더 기록하면 추이를 볼 수 있어요",
  weightNone: {
    "90D": "최근 90일 동안 체중 기록이 없어요",
    "6M": "최근 6개월 동안 체중 기록이 없어요",
    "1Y": "최근 1년 동안 체중 기록이 없어요",
    all: "아직 체중 기록이 없어요",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "체중을 기록하면 BMI를 볼 수 있어요",
  bmiFrom: "{w}와 {h} 기준",
  bmiHelp: "BMI 계산 방법",
  goalEstimateFar: "2년 이상 · 추정",
  loadFailed: "진행 상황을 불러오지 못했어요.",
  phone: { back: "뒤로" },
};

const JA: ProgressCopy = {
  title: SHELL_COPY.ja!.navProgress,
  weightLabel: HEALTH_COPY.ja!.labels.weight_kg!,
  weightNow: { metric: "{n}kg", imperial: "{n}lb" },
  ranges: { "90D": "90日", "6M": "6か月", "1Y": "1年", all: "すべて" },
  goalLine: { metric: "{from} → {to}kg", imperial: "{from} → {to}lb" },
  goalEstimate: "{month}ごろ · 見込み",
  goalDown: { metric: "{n}kg減", imperial: "{n}lb減" },
  goalUp: { metric: "{n}kg増", imperial: "{n}lb増" },
  goalToGo: { metric: "あと{n}", imperial: "あと{n}" },
  weekLabel: "今週",
  weekPlan: "kcal/日 · プラン {plan}",
  streakLabel: "連続記録",
  streakDays: { one: "{n}日", other: "{n}日" },
  weightChartName: CHAT_COPY.ja!.chart.weightTrend,
  weightEmpty: "体重を記録すると推移が見られます",
  weightOneMore: "もう一度体重を記録すると推移が見られます",
  weightNone: {
    "90D": "直近90日の体重記録はありません",
    "6M": "直近6か月の体重記録はありません",
    "1Y": "直近1年の体重記録はありません",
    all: "体重の記録はまだありません",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "体重を記録するとBMIが見られます",
  bmiFrom: "{w}と{h}から算出",
  bmiHelp: "BMIの計算方法",
  goalEstimateFar: "2年以上先 · 見込み",
  loadFailed: "進捗を読み込めませんでした。",
  phone: { back: "戻る" },
};

const PT_BR: ProgressCopy = {
  title: SHELL_COPY["pt-BR"]!.navProgress,
  weightLabel: HEALTH_COPY["pt-BR"]!.labels.weight_kg!,
  weightNow: { metric: "{n} kg", imperial: "{n}lb" },
  ranges: { "90D": "90 d", "6M": "6 m", "1Y": "1 a", all: "Tudo" },
  goalLine: { metric: "{from} → {to} kg", imperial: "{from} → {to}lb" },
  goalEstimate: "por volta de {month} · estimativa",
  goalDown: { metric: "{n} kg a menos", imperial: "{n} lb a menos" },
  goalUp: { metric: "{n} kg a mais", imperial: "{n} lb a mais" },
  goalToGo: { metric: "faltam {n}", imperial: "faltam {n}" },
  weekLabel: "Esta semana",
  weekPlan: "kcal por dia · plano {plan}",
  streakLabel: "Sequência",
  streakDays: { one: "{n} dia", other: "{n} dias" },
  weightChartName: CHAT_COPY["pt-BR"]!.chart.weightTrend,
  weightEmpty: "Registre um peso para ver sua tendência",
  weightOneMore: "Registre outro peso para ver sua tendência",
  weightNone: {
    "90D": "Nenhum peso nos últimos 90 dias",
    "6M": "Nenhum peso nos últimos 6 meses",
    "1Y": "Nenhum peso no último ano",
    all: "Nenhum peso ainda",
  },
  weightNowTail: { metric: "kg", imperial: "lb" },
  weightLatestTail: { metric: "kg · {date}", imperial: "lb · {date}" },
  bmiEmpty: "Registre um peso para ver seu IMC",
  bmiFrom: "Com base em {w} e {h}",
  bmiHelp: "Como o IMC é calculado",
  goalEstimateFar: "mais de dois anos · estimativa",
  loadFailed: "Não foi possível carregar seu progresso.",
  phone: { back: "Voltar" },
};

export const PROGRESS_COPY: Localized<ProgressCopy> = {
  en: EN, fr: FR, de: DE, it: IT, es: ES, vi: VI, id: ID, ru: RU, nl: NL, pl: PL, tr: TR, "zh-Hant": ZH_HANT, "zh-Hans": ZH_HANS, ko: KO, ja: JA, "pt-BR": PT_BR,
};

export const progressCopyFor = (lang: Lang): ProgressCopy => t(lang)(PROGRESS_COPY);
