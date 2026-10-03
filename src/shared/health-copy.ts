// What the health screen calls each metric, and how it words a correlation.
//
// THE LABELS ARE LOCALIZED AND THE UNITS ARE NOT, and that is a decision rather than an oversight.
// A label is a word ("Resting heart rate"); a unit here is an SI symbol on a chart axis, and kg, cm,
// km, ms and ml/kg/min are spelled the same in all eight. Russian prose does write ккал and г — and
// the sentences that need them carry them in the template (`chat-copy.ts`, `onboarding-content.ts`)
// rather than concatenating a symbol. An axis is not prose. If a chart ever needs a translated
// symbol, `HealthFieldSpec.unit` is where it goes and this comment is what should be argued with.
//
// ENGLISH IS NOT REPEATED HERE. It is derived from `HEALTH_FIELDS` and `HEALTH_GROUPS`, which
// already carry it, so there is exactly one English spelling of "Lean mass" in this repo.

import { LANG_TAG, spellUnit, t, type CountForms, type Localized } from "./lang.ts";
import { HEALTH_FIELDS, HEALTH_GROUPS, type HealthFieldSpec } from "./health.ts";
import type { Lang, Pace } from "./types.ts";
import type { TrendPeriod } from "./trend.ts";

export interface HealthCopy {
  /** Keyed by group id AND by metric key — one flat lookup, because a screen renders both. */
  labels: Record<string, string>;
  correlation: {
    /** Under the threshold where a coefficient means anything. */
    none: string;
    /** `{strength}` and `{direction}`. */
    sentence: string;
    weak: string;
    moderate: string;
    strong: string;
    together: string;
    opposed: string;
  };
  /**
   * The four x-axes. `label` is the control; `per` is the form the summary needs after its
   * preposition.
   *
   * There is no third field. A bare `noun` was written here first, for symmetry with the English
   * that had one, and nothing in the repo or on the phone ever read it — `trendSummary` takes
   * `per`. Thirty-two strings in eight tables, each one a thing a translator could get wrong.
   *
   * `per` exists because Russian inflects: `по` governs the dative plural, so "by week" is
   * `по неделям` while the bucket is still `неделя`. One field cannot be both, and interpolating
   * the nominative produced `Вес по неделя` — the kind of error that reads as machine output.
   * For the other seven the two happen to coincide, and they are spelled out anyway rather than
   * defaulted, so the next language to need a case has somewhere to put it.
   */
  periods: Record<"days" | "weeks" | "months" | "years", { label: string; per: string }>;
  /**
   * The chart as ONE SENTENCE, for VoiceOver — a template, not fragments joined by code.
   *
   * `AGENTS.md` forbids the join: word order is not a constant across eight languages, and this
   * sentence is the only thing a reader with low vision gets from the chart at all. `{name}`,
   * `{noun}`, `{first}`/`{firstAt}`, `{last}`/`{lastAt}`, `{low}`, `{high}`.
   */
  summary: { line: string; empty: string };
  /** The five things the compare card can put against each other. Not `HEALTH_FIELDS` keys. */
  compare: Record<"intake" | "burned" | "sleep" | "steps" | "exercise", string>;
  /** `formatHealthValue`'s hours and minutes — the only two units it writes as words. */
  hm: { h: string; m: string };
}

/** The English, derived rather than retyped. */
const EN_LABELS: Record<string, string> = Object.fromEntries([
  ...HEALTH_GROUPS.map((g) => [g.id, g.enLabel]),
  ...HEALTH_FIELDS.map((f) => [f.key, f.enLabel]),
]);

const labels = (over: Record<string, string>): Record<string, string> => ({ ...EN_LABELS, ...over });

export const HEALTH_COPY: Localized<HealthCopy> = {
  en: {
    labels: EN_LABELS,
    correlation: {
      none: "no clear link",
      sentence: "a {strength} link — {direction}",
      weak: "weak", moderate: "moderate", strong: "strong",
      together: "they tend to rise together",
      opposed: "one tends to rise as the other falls",
    },
    periods: { days: { label: "Days", per: "day" }, weeks: { label: "Weeks", per: "week" },
      months: { label: "Months", per: "month" }, years: { label: "Years", per: "year" } },
    summary: { line: "{name} by {noun}: from {first} ({firstAt}) to {last} ({lastAt}). Lowest {low}, highest {high}.",
      empty: "{name} by {noun}: nothing recorded." },
    compare: { intake: "Intake", burned: "Burned", sleep: "Sleep", steps: "Steps", exercise: "Exercise" },
    hm: { h: "h", m: "m" },
  },
  fr: {
    labels: labels({
      body: "Corps", energy: "Énergie", activity: "Activité", sleep: "Sommeil", cardio: "Cœur",
      weight_kg: "Poids", height_cm: "Taille", body_fat_pct: "Masse grasse", lean_mass_kg: "Masse maigre",
      active_kcal: "Énergie active", resting_kcal: "Énergie au repos",
      steps: "Pas", exercise_minutes: "Exercice", workouts: "Séances", distance_km: "Distance",
      asleep_minutes: "Temps de sommeil", in_bed_minutes: "Au lit",
      resting_hr_bpm: "Fréquence cardiaque au repos", hrv_ms: "VFC", vo2max: "VO2 max",
    }),
    correlation: {
      none: "aucun lien net",
      sentence: "un lien {strength} — {direction}",
      weak: "faible", moderate: "modéré", strong: "fort",
      together: "ils ont tendance à monter ensemble",
      opposed: "l'un monte quand l'autre descend",
    },
    periods: { days: { label: "Jours", per: "jour" }, weeks: { label: "Semaines", per: "semaine" },
      months: { label: "Mois", per: "mois" }, years: { label: "Années", per: "an" } },
    summary: { line: "{name} par {noun} : de {first} ({firstAt}) à {last} ({lastAt}). Minimum {low}, maximum {high}.",
      empty: "{name} par {noun} : rien d'enregistré." },
    compare: { intake: "Apports", burned: "Dépense", sleep: "Sommeil", steps: "Pas", exercise: "Exercice" },
    hm: { h: "h", m: "min" },
  },
  de: {
    labels: labels({
      body: "Körper", energy: "Energie", activity: "Aktivität", sleep: "Schlaf", cardio: "Herz",
      weight_kg: "Gewicht", height_cm: "Körpergröße", body_fat_pct: "Körperfett", lean_mass_kg: "Magere Körpermasse",
      active_kcal: "Aktive Energie", resting_kcal: "Ruheenergie",
      steps: "Schritte", exercise_minutes: "Trainingszeit", workouts: "Trainings", distance_km: "Strecke",
      asleep_minutes: "Schlafdauer", in_bed_minutes: "Zeit im Bett",
      resting_hr_bpm: "Ruhepuls", hrv_ms: "HRV", vo2max: "VO2max",
    }),
    correlation: {
      none: "kein klarer Zusammenhang",
      sentence: "ein {strength} Zusammenhang — {direction}",
      weak: "schwacher", moderate: "mittlerer", strong: "starker",
      together: "sie steigen meist gemeinsam",
      opposed: "das eine steigt, während das andere fällt",
    },
    periods: { days: { label: "Tage", per: "Tagen" }, weeks: { label: "Wochen", per: "Wochen" },
      months: { label: "Monate", per: "Monaten" }, years: { label: "Jahre", per: "Jahren" } },
    summary: { line: "{name} nach {noun}: von {first} ({firstAt}) bis {last} ({lastAt}). Tiefstwert {low}, Höchstwert {high}.",
      empty: "{name} nach {noun}: nichts erfasst." },
    compare: { intake: "Zufuhr", burned: "Verbrauch", sleep: "Schlaf", steps: "Schritte", exercise: "Training" },
    hm: { h: "Std.", m: "Min." },
  },
  it: {
    labels: labels({
      body: "Corpo", energy: "Energia", activity: "Attività", sleep: "Sonno", cardio: "Cuore",
      weight_kg: "Peso", height_cm: "Altezza", body_fat_pct: "Massa grassa", lean_mass_kg: "Massa magra",
      active_kcal: "Energia attiva", resting_kcal: "Energia a riposo",
      steps: "Passi", exercise_minutes: "Esercizio", workouts: "Allenamenti", distance_km: "Distanza",
      asleep_minutes: "Sonno effettivo", in_bed_minutes: "A letto",
      resting_hr_bpm: "Frequenza a riposo", hrv_ms: "HRV", vo2max: "VO2 max",
    }),
    correlation: {
      none: "nessun legame chiaro",
      sentence: "un legame {strength} — {direction}",
      weak: "debole", moderate: "moderato", strong: "forte",
      together: "tendono a salire insieme",
      opposed: "uno sale mentre l'altro scende",
    },
    periods: { days: { label: "Giorni", per: "giorno" }, weeks: { label: "Settimane", per: "settimana" },
      months: { label: "Mesi", per: "mese" }, years: { label: "Anni", per: "anno" } },
    summary: { line: "{name} per {noun}: da {first} ({firstAt}) a {last} ({lastAt}). Minimo {low}, massimo {high}.",
      empty: "{name} per {noun}: nulla registrato." },
    compare: { intake: "Assunte", burned: "Bruciate", sleep: "Sonno", steps: "Passi", exercise: "Attività" },
    hm: { h: "h", m: "min" },
  },
  es: {
    labels: labels({
      body: "Cuerpo", energy: "Energía", activity: "Actividad", sleep: "Sueño", cardio: "Corazón",
      weight_kg: "Peso", height_cm: "Altura", body_fat_pct: "Grasa corporal", lean_mass_kg: "Masa magra",
      active_kcal: "Energía activa", resting_kcal: "Energía en reposo",
      steps: "Pasos", exercise_minutes: "Ejercicio", workouts: "Entrenamientos", distance_km: "Distancia",
      asleep_minutes: "Tiempo dormido", in_bed_minutes: "En la cama",
      resting_hr_bpm: "Frecuencia en reposo", hrv_ms: "VFC", vo2max: "VO2 máx",
    }),
    correlation: {
      none: "sin relación clara",
      sentence: "una relación {strength} — {direction}",
      weak: "débil", moderate: "moderada", strong: "fuerte",
      together: "suelen subir juntos",
      opposed: "uno sube mientras el otro baja",
    },
    periods: { days: { label: "Días", per: "día" }, weeks: { label: "Semanas", per: "semana" },
      months: { label: "Meses", per: "mes" }, years: { label: "Años", per: "año" } },
    summary: { line: "{name} por {noun}: de {first} ({firstAt}) a {last} ({lastAt}). Mínimo {low}, máximo {high}.",
      empty: "{name} por {noun}: nada registrado." },
    compare: { intake: "Ingesta", burned: "Gasto", sleep: "Sueño", steps: "Pasos", exercise: "Actividad" },
    hm: { h: "h", m: "min" },
  },
  vi: {
    labels: labels({
      body: "Cơ thể", energy: "Năng lượng", activity: "Vận động", sleep: "Giấc ngủ", cardio: "Tim mạch",
      weight_kg: "Cân nặng", height_cm: "Chiều cao", body_fat_pct: "Mỡ cơ thể", lean_mass_kg: "Khối lượng nạc",
      active_kcal: "Năng lượng vận động", resting_kcal: "Năng lượng lúc nghỉ",
      steps: "Số bước", exercise_minutes: "Tập luyện", workouts: "Buổi tập", distance_km: "Quãng đường",
      asleep_minutes: "Thời gian ngủ", in_bed_minutes: "Thời gian trên giường",
      resting_hr_bpm: "Nhịp tim lúc nghỉ", hrv_ms: "HRV", vo2max: "VO2 max",
    }),
    correlation: {
      none: "chưa thấy mối liên hệ rõ ràng",
      sentence: "mối liên hệ {strength} — {direction}",
      weak: "yếu", moderate: "vừa", strong: "mạnh",
      together: "hai bên thường cùng tăng",
      opposed: "bên này tăng thì bên kia giảm",
    },
    periods: { days: { label: "Ngày", per: "ngày" }, weeks: { label: "Tuần", per: "tuần" },
      months: { label: "Tháng", per: "tháng" }, years: { label: "Năm", per: "năm" } },
    summary: { line: "{name} theo {noun}: từ {first} ({firstAt}) đến {last} ({lastAt}). Thấp nhất {low}, cao nhất {high}.",
      empty: "{name} theo {noun}: chưa có dữ liệu." },
    compare: { intake: "Nạp vào", burned: "Đốt cháy", sleep: "Giấc ngủ", steps: "Số bước", exercise: "Vận động" },
    hm: { h: "giờ", m: "phút" },
  },
  id: {
    labels: labels({
      body: "Tubuh", energy: "Energi", activity: "Aktivitas", sleep: "Tidur", cardio: "Jantung",
      weight_kg: "Berat", height_cm: "Tinggi", body_fat_pct: "Lemak tubuh", lean_mass_kg: "Massa tanpa lemak",
      active_kcal: "Energi aktif", resting_kcal: "Energi istirahat",
      steps: "Langkah", exercise_minutes: "Olahraga", workouts: "Latihan", distance_km: "Jarak",
      asleep_minutes: "Waktu tidur", in_bed_minutes: "Waktu di tempat tidur",
      resting_hr_bpm: "Detak jantung istirahat", hrv_ms: "HRV", vo2max: "VO2 maks",
    }),
    correlation: {
      none: "tidak ada kaitan yang jelas",
      sentence: "kaitan {strength} — {direction}",
      weak: "lemah", moderate: "sedang", strong: "kuat",
      together: "keduanya cenderung naik bersama",
      opposed: "yang satu naik saat yang lain turun",
    },
    periods: { days: { label: "Hari", per: "hari" }, weeks: { label: "Minggu", per: "minggu" },
      months: { label: "Bulan", per: "bulan" }, years: { label: "Tahun", per: "tahun" } },
    summary: { line: "{name} per {noun}: dari {first} ({firstAt}) menjadi {last} ({lastAt}). Terendah {low}, tertinggi {high}.",
      empty: "{name} per {noun}: belum ada catatan." },
    compare: { intake: "Asupan", burned: "Terbakar", sleep: "Tidur", steps: "Langkah", exercise: "Olahraga" },
    hm: { h: "jam", m: "mnt" },
  },
  ru: {
    labels: labels({
      body: "Тело", energy: "Энергия", activity: "Активность", sleep: "Сон", cardio: "Сердце",
      weight_kg: "Вес", height_cm: "Рост", body_fat_pct: "Процент жира", lean_mass_kg: "Сухая масса",
      active_kcal: "Активная энергия", resting_kcal: "Энергия покоя",
      steps: "Шаги", exercise_minutes: "Время тренировок", workouts: "Тренировки", distance_km: "Дистанция",
      asleep_minutes: "Продолжительность сна", in_bed_minutes: "Время в постели",
      resting_hr_bpm: "Пульс покоя", hrv_ms: "Вариабельность пульса", vo2max: "VO₂ max",
    }),
    correlation: {
      none: "явной связи нет",
      sentence: "{strength} связь — {direction}",
      weak: "слабая", moderate: "умеренная", strong: "сильная",
      together: "обычно растут вместе",
      opposed: "одно растёт, пока другое падает",
    },
    periods: { days: { label: "Дни", per: "дням" }, weeks: { label: "Недели", per: "неделям" },
      months: { label: "Месяцы", per: "месяцам" }, years: { label: "Годы", per: "годам" } },
    summary: { line: "{name} по {noun}: с {first} ({firstAt}) до {last} ({lastAt}). Минимум {low}, максимум {high}.",
      empty: "{name} по {noun}: записей нет." },
    compare: { intake: "Съедено", burned: "Потрачено", sleep: "Сон", steps: "Шаги", exercise: "Тренировки" },
    hm: { h: "ч", m: "мин" },
  },
};

/**
 * What the screen calls one metric or one group.
 *
 * THE KEY ITSELF on a miss, and that is deliberate rather than an oversight — but it is a worse
 * wart than the one `Localized<T>` accepts, and worth naming as such: an untranslated string is
 * English, whereas this renders `in_bed_minutes` on a chart. It is reachable only by a binary a
 * version behind `HEALTH_FIELDS`, and `health-copy.test.ts` fails if a shipped field lacks a label.
 */
export const healthLabel = (key: string, lang: Lang): string =>
  t(lang)(HEALTH_COPY).labels[key] ?? key;

// MOVED HERE FROM `health.ts` when it started taking a language. `health-copy.ts` already
// imports `health.ts` to derive `EN_LABELS` from `HEALTH_FIELDS` at module scope, so the
// import it would have needed in the other direction is a cycle whose wrong half runs first.
/**
 * One reading, as a person reads it.
 *
 * Minutes are the unit HealthKit stores sleep in and they are not a unit anybody thinks in: the
 * screen printed "Asleep 387min" and "In bed 427min", which is a subtraction and a division away
 * from the two numbers the user came for. Everything else keeps its own unit — 11 minutes of
 * exercise is 11 minutes, and a step count is a count.
 */
export function formatHealthValue(
  spec: Pick<HealthFieldSpec, "unit" | "decimals">,
  value: number,
  lang: Lang,
): string {
  // `toFixed` and a raw `spec.unit` are what this used to be, which put `93.8kg` in front of the
  // six languages that group with a decimal comma and `h`/`m` in front of all seven. It is also
  // what a caller would naturally hand `trendSummary` as its `format`, so the obligation stated in
  // that function's doc was unmeetable until this took a language.
  const hm = t(lang)(HEALTH_COPY).hm;
  if (spec.unit === "min" && value >= 60) {
    const whole = Math.round(value);
    return `${Math.floor(whole / 60)}${hm.h} ${whole % 60}${hm.m}`;
  }
  const n = new Intl.NumberFormat(LANG_TAG[lang], {
    minimumFractionDigits: spec.decimals, maximumFractionDigits: spec.decimals,
  }).format(value);
  return `${n}${spec.unit ? `${spellUnit(lang, spec.unit)}` : ""}`;
}

// ── The phone's Apple Health screens ──────────────────────────────────────────────────────────
//
// health.html, health-connect, health-compare, health-body, health-notice and
// health-unavailable (ieat-app#927, the M8 boards). Phone-only surface — the web has no Apple
// Health — but the words belong here beside the metric labels they build on, not in a vendored
// copy on the phone: the sweeps over this file are the check that all eight languages exist.
//
// WHAT IS NOT HERE: the metric words ("Body fat") are `HEALTH_COPY.labels`, the compare series'
// names are `HEALTH_COPY.compare`, the period control is `HEALTH_COPY.periods`, the correlation
// sentence is `correlationWords`, and "r = 0.42" formats itself. The intake card's label is the
// `intake` series' own name, joined to the counted period by a " · " — punctuation, not grammar.

export interface HealthScreenCopy {
  /**
   * The pushed screens' titles. The body screen's title is NOT here — it is `labels.body`, the
   * `body` group's own name, which the row out of the main card reuses too.
   */
  titles: { health: string; compare: string };
  /** The chevron's accessible name. */
  back: string;
  /** Today's bar, on both charts. */
  today: string;
  /**
   * health-connect: the pitch. `reads`/`writes`/`weightOnly` are the three rows' heads; `cta` is
   * the button AND the screen's title — the board writes one sentence in both places.
   */
  connect: {
    cta: string;
    reads: string;
    readsList: string;
    writes: string;
    writesList: string;
    weightOnly: string;
    weightOnlyDesc: string;
    /** Under the button when Health's sheet closed with nothing chosen. */
    closed: string;
  };
  /** health-unavailable: no HealthKit on this phone at all. */
  unavailable: { title: string; body: string };
  /** The care card, in all four of its reasons, plus the sync error's own sentence. */
  notice: {
    /** Meals written to eait are not reaching Health — the write grant is off. */
    notReachingTitle: string;
    notReachingBody: string;
    /** The account's Health switch reads off — `offBody` says the diary is untouched. */
    offTitle: string;
    offBody: string;
    /** Connected and read, but Health holds nothing to chart. */
    nothingTitle: string;
    nothingBody: string;
    /** The push failed: `{where}` is the layer that answered. */
    syncTitle: string;
    syncReached: string;
    syncRefused: string;
    tryAgain: string;
    openHealth: string;
    askAgain: string;
    /** Connected, but another app shows in Health's own charts things eait was not given. */
    readsMoreTitle: string;
    readsMoreBody: string;
    /** Where eait's switches live — the visible path and the one VoiceOver reads. */
    path: string;
    pathSpoken: string;
    /** iOS alert titles when Health cannot be reached — `pathSpoken` is the body of both. */
    alertOpenTitle: string;
    alertSheetTitle: string;
  };
  intake: {
    /**
     * The card's label after the series name — "Intake · this week" is `compare.intake` joined
     * to the period's own word. `one` is the wording for a single period ("last week", "за
     * прошлую неделю"), chosen by `n === 1` in the CALLER — Russian counts 21, 31, … in the `one`
     * category, so the singular period cannot be a CountForms key. `counted` carries the real
     * plural forms, including ru's counted one ("за последние 21 неделю").
     */
    periods: Record<TrendPeriod, { one: string; counted: CountForms }>;
    /** The figure for the days period — "{kcal}kcal today". */
    kcalToday: string;
    /** The figure for the longer periods — the bucket mean, "{kcal}kcal a day". */
    kcalADay: string;
  };
  compare: {
    /** The two series pickers' kind labels: the accent one and the ink one. */
    bars: string;
    line: string;
    /** The spoken legend under the chart — "{a} as bars, left axis · {b} as the line, right axis." */
    axes: string;
    /** correlate() found too few overlapping buckets: "Not enough {period}…" — plural nouns. */
    noData: string;
    periodNouns: Record<TrendPeriod, string>;
    /** VoiceOver on a series row — "Bars: Intake" — a template, never a join in the call site. */
    pickLabel: string;
  };
  body: {
    /** "▼ {d} since {date} · {to} to {target}" — and the up, flat and no-target forms of it. */
    trendDown: string;
    trendDownSolo: string;
    trendUp: string;
    trendUpSolo: string;
    trendFlat: string;
    /** The plan row's label and its two value shapes — moved ("{old} → {new}kcal") or not. */
    plan: string;
    planValue: string;
    planMoved: string;
    /** `fromHealth`'s `{when}` for a read taken today — "today 18:30", lowercase in the table. */
    todayAt: string;
    /** "From Apple Health, {when}" — `{when}` is `todayAt` filled, or a formatted date. */
    fromHealth: string;
    /** A metric's move against the rest of the window — "▼ 0.6%" — the arrow inside, always. */
    deltaUp: string;
    deltaDown: string;
    /** The notice when the weigh-in read fails — the screen keeps what it had, says why. */
    loadFailed: string;
    /**
     * Spud's line, eight whole sentences: a weigh-in trend read against the pace the plan was
     * built on. `Down`/`Up` by the direction the goal needs, ×3 for the observed rate COMPARED
     * with the pace chosen (slower than it, on it, faster) — never "slow: the pace you chose",
     * which blames the user for both halves of the sentence at once. `lineFlat` for a maintain
     * goal holding, `lineDrift` for the trend running the wrong way. Never a promise: the pace
     * named is the plan's setting, a fact, not a forecast.
     */
    lineDownSlow: string;
    lineDownOnPace: string;
    lineDownFast: string;
    lineUpSlow: string;
    lineUpOnPace: string;
    lineUpFast: string;
    lineFlat: string;
    lineDrift: string;
    /** The pace as an adjective inside the line — "{pace}" in every one above. */
    paces: Record<Pace, string>;
  };
  /**
   * Spud's line under the intake card — the same three cases `weekLine` computed in English:
   * every day inside the plan, some days over but the mean inside it, or the mean itself over.
   * `{days}` is `countText(days, n)` — "2 days over" reads "Two days over" nowhere, and that is
   * deliberate: the numeral is what every other card on this surface shows.
   */
  weekLine: {
    allInside: string;
    overButOk: string;
    avgOver: string;
    days: CountForms;
  };
}

export const HEALTH_SCREEN_COPY: Localized<HealthScreenCopy> = {
  en: {
    titles: { health: "Apple Health", compare: "Compare" },
    back: "Back",
    today: "Today",
    connect: {
      cta: "Connect Apple Health",
      reads: "Reads",
      readsList: "weight, body, energy, activity, sleep",
      writes: "Writes",
      writesList: "the meals you log",
      weightOnly: "Only your weight",
      weightOnlyDesc: "moves your plan",
      closed: "Health's sheet closed with nothing chosen. You can come back to this any time.",
    },
    unavailable: {
      title: "Not available on this iPhone",
      body: "Your diary and your plan work the same without it.",
    },
    notice: {
      notReachingTitle: "Meals aren't reaching Health",
      notReachingBody: "Your charts are fine. Turn on eait's Nutrition categories in Health.",
      offTitle: "eait is switched off in Health",
      offBody: "Your diary is unaffected; charts here read from what Health shares with eait.",
      nothingTitle: "Nothing recorded yet",
      nothingBody: "Charts appear when Health has data on this iPhone — a weigh-in, a workout, a night's sleep.",
      syncTitle: "The Health sync hit an error",
      syncReached: "Your server reached",
      syncRefused: "HealthKit refused",
      tryAgain: "Try again",
      openHealth: "Open Health",
      askAgain: "Ask Health again",
      readsMoreTitle: "Health shows more than eait reads",
      readsMoreBody: "eait only sees the categories you switch on for it.",
      path: "In Health: your picture at the top right › Apps › eait. Or Settings › Privacy & Security › Health › eait.",
      pathSpoken: "In Health, tap your picture at the top right, then Apps, then eait. Or open Settings, Privacy and Security, Health, eait.",
      alertOpenTitle: "Couldn't open Health",
      alertSheetTitle: "Couldn't open the Health sheet",
    },
    intake: {
      periods: {
        days: { one: "the last 7 days", counted: { other: "the last 7 days" } },
        weeks: { one: "last week", counted: { other: "the last {n} weeks" } },
        months: { one: "last month", counted: { other: "the last {n} months" } },
        years: { one: "this year", counted: { other: "the last {n} years" } },
      },
      kcalToday: "{kcal}kcal today",
      kcalADay: "{kcal}kcal a day",
    },
    compare: {
      bars: "Bars",
      line: "Line",
      axes: "{a} as bars, left axis · {b} as the line, right axis.",
      noData: "Not enough {period} with both {a} and {b} recorded to say how they relate.",
      periodNouns: { days: "days", weeks: "weeks", months: "months", years: "years" },
      pickLabel: "{kind}: {series}",
    },
    body: {
      trendDown: "▼ {d} since {date} · {to} to {target}",
      trendDownSolo: "▼ {d} since {date}",
      trendUp: "▲ {d} since {date} · {to} to {target}",
      trendUpSolo: "▲ {d} since {date}",
      trendFlat: "Level since {date}",
      plan: "Plan",
      planValue: "{kcal}kcal",
      planMoved: "{old} → {new}kcal",
      todayAt: "today {time}",
      fromHealth: "From Apple Health, {when}",
      deltaUp: "▲ {n}",
      deltaDown: "▼ {n}",
      loadFailed: "Couldn't load your weigh-ins.",
      lineDownSlow: "Down {kg} — slower than the {pace} pace you chose.",
      lineDownOnPace: "Down {kg} — on the {pace} pace you chose.",
      lineDownFast: "Down {kg} — faster than the {pace} pace you chose.",
      lineUpSlow: "Up {kg} — slower than the {pace} pace you chose.",
      lineUpOnPace: "Up {kg} — on the {pace} pace you chose.",
      lineUpFast: "Up {kg} — faster than the {pace} pace you chose.",
      lineFlat: "Holding steady — the {pace} pace you chose.",
      lineDrift: "Moving away from {target}; your plan is set for a {pace} pace.",
      paces: { easy: "easy", steady: "steady", push: "fast" },
    },
    weekLine: {
      allInside: "Every day inside your {target}.",
      overButOk: "{days} over; the period still lands at {avg} a day.",
      avgOver: "The period averages {avg} a day, over your {target}.",
      days: { one: "{n} day", other: "{n} days" },
    },
  },
  fr: {
    titles: { health: "Apple Health", compare: "Comparer" },
    back: "Retour",
    today: "Aujourd'hui",
    connect: {
      cta: "Connecter Apple Health",
      reads: "Lecture",
      readsList: "poids, corps, énergie, activité, sommeil",
      writes: "Écriture",
      writesList: "les repas que tu enregistres",
      weightOnly: "Seul ton poids",
      weightOnlyDesc: "fait bouger ton plan",
      closed: "La fenêtre Santé s'est fermée sans choix. Tu peux y revenir quand tu veux.",
    },
    unavailable: {
      title: "Non disponible sur cet iPhone",
      body: "Ton journal et ton plan marchent pareil sans lui.",
    },
    notice: {
      notReachingTitle: "Les repas n'arrivent pas dans Santé",
      notReachingBody: "Tes graphiques vont bien. Active les catégories Nutrition d'eait dans Santé.",
      offTitle: "eait est désactivé dans Santé",
      offBody: "Ton journal n'est pas touché ; les graphiques ici lisent ce que Santé partage avec eait.",
      nothingTitle: "Encore rien enregistré",
      nothingBody: "Les graphiques apparaissent quand Santé a des données sur cet iPhone — une pesée, une séance, une nuit de sommeil.",
      syncTitle: "La synchro Santé a eu une erreur",
      syncReached: "Ton serveur a répondu",
      syncRefused: "HealthKit a refusé",
      tryAgain: "Réessayer",
      openHealth: "Ouvrir Santé",
      askAgain: "Redemander à Santé",
      readsMoreTitle: "Santé en montre plus qu'eait ne lit",
      readsMoreBody: "eait ne voit que les catégories que tu actives pour lui.",
      path: "Dans Santé : ta photo en haut à droite › Apps › eait. Ou Réglages › Confidentialité et sécurité › Santé › eait.",
      pathSpoken: "Dans Santé, touche ta photo en haut à droite, puis Apps, puis eait. Ou ouvre Réglages, Confidentialité et sécurité, Santé, eait.",
      alertOpenTitle: "Impossible d'ouvrir Santé",
      alertSheetTitle: "Impossible d'ouvrir la fenêtre de Santé",
    },
    intake: {
      periods: {
        days: { one: "les 7 derniers jours", counted: { other: "les 7 derniers jours" } },
        weeks: { one: "la semaine dernière", counted: { other: "les {n} dernières semaines" } },
        months: { one: "le mois dernier", counted: { other: "les {n} derniers mois" } },
        years: { one: "cette année", counted: { other: "les {n} dernières années" } },
      },
      kcalToday: "{kcal}kcal aujourd'hui",
      kcalADay: "{kcal}kcal par jour",
    },
    compare: {
      bars: "Barres",
      line: "Courbe",
      axes: "{a} en barres, axe de gauche · {b} en courbe, axe de droite.",
      noData: "Pas assez de {period} avec {a} et {b} enregistrés pour dire comment ils sont liés.",
      periodNouns: { days: "jours", weeks: "semaines", months: "mois", years: "années" },
      pickLabel: "{kind} : {series}",
    },
    body: {
      trendDown: "▼ {d} depuis le {date} · reste {to} avant {target}",
      trendDownSolo: "▼ {d} depuis le {date}",
      trendUp: "▲ {d} depuis le {date} · reste {to} avant {target}",
      trendUpSolo: "▲ {d} depuis le {date}",
      trendFlat: "Stable depuis le {date}",
      plan: "Plan",
      planValue: "{kcal}kcal",
      planMoved: "{old} → {new}kcal",
      todayAt: "aujourd'hui à {time}",
      fromHealth: "Depuis Apple Health, {when}",
      deltaUp: "▲ {n}",
      deltaDown: "▼ {n}",
      loadFailed: "Impossible de charger tes pesées.",
      lineDownSlow: "{kg} en moins — plus lentement que le rythme {pace} que tu as choisi.",
      lineDownOnPace: "{kg} en moins — au rythme {pace} que tu as choisi.",
      lineDownFast: "{kg} en moins — plus vite que le rythme {pace} que tu as choisi.",
      lineUpSlow: "{kg} en plus — plus lentement que le rythme {pace} que tu as choisi.",
      lineUpOnPace: "{kg} en plus — au rythme {pace} que tu as choisi.",
      lineUpFast: "{kg} en plus — plus vite que le rythme {pace} que tu as choisi.",
      lineFlat: "Stable — le rythme {pace} que tu as choisi.",
      lineDrift: "Ça s'éloigne de {target} ; ton plan est réglé sur un rythme {pace}.",
      paces: { easy: "doux", steady: "régulier", push: "soutenu" },
    },
    weekLine: {
      allInside: "Tous les jours dans tes {target}.",
      overButOk: "{days} au-dessus ; la période retombe à {avg} par jour.",
      avgOver: "La période tourne à {avg} par jour, au-dessus de tes {target}.",
      days: { one: "{n} jour", other: "{n} jours" },
    },
  },
  de: {
    titles: { health: "Apple Health", compare: "Vergleich" },
    back: "Zurück",
    today: "Heute",
    connect: {
      cta: "Apple Health verbinden",
      reads: "Liest",
      readsList: "Gewicht, Körper, Energie, Aktivität, Schlaf",
      writes: "Schreibt",
      writesList: "die Mahlzeiten, die du einträgst",
      weightOnly: "Nur dein Gewicht",
      weightOnlyDesc: "verändert deinen Plan",
      closed: "Das Health-Fenster wurde ohne Auswahl geschlossen. Du kannst jederzeit zurückkommen.",
    },
    unavailable: {
      title: "Auf diesem iPhone nicht verfügbar",
      body: "Dein Tagebuch und dein Plan funktionieren genauso ohne.",
    },
    notice: {
      notReachingTitle: "Mahlzeiten kommen nicht in Health an",
      notReachingBody: "Deine Diagramme sind in Ordnung. Schalte eaits Ernährungs-Kategorien in Health ein.",
      offTitle: "eait ist in Health ausgeschaltet",
      offBody: "Dein Tagebuch bleibt unberührt; die Diagramme hier lesen, was Health mit eait teilt.",
      nothingTitle: "Noch nichts aufgezeichnet",
      nothingBody: "Diagramme erscheinen, sobald Health Daten auf diesem iPhone hat — eine Gewichtsmessung, ein Training, eine Nacht Schlaf.",
      syncTitle: "Beim Health-Sync gab es einen Fehler",
      syncReached: "Dein Server hat geantwortet",
      syncRefused: "HealthKit hat abgelehnt",
      tryAgain: "Erneut versuchen",
      openHealth: "Health öffnen",
      askAgain: "Health erneut fragen",
      readsMoreTitle: "Health zeigt mehr, als eait liest",
      readsMoreBody: "eait sieht nur die Kategorien, die du dafür einschaltest.",
      path: "In Health: dein Bild oben rechts › Apps › eait. Oder Einstellungen › Datenschutz & Sicherheit › Health › eait.",
      pathSpoken: "Öffne in Health dein Bild oben rechts, dann Apps, dann eait. Oder öffne Einstellungen, Datenschutz und Sicherheit, Health, eait.",
      alertOpenTitle: "Health lässt sich nicht öffnen",
      alertSheetTitle: "Das Health-Blatt lässt sich nicht öffnen",
    },
    intake: {
      periods: {
        days: { one: "die letzten 7 Tage", counted: { other: "die letzten 7 Tage" } },
        weeks: { one: "letzte Woche", counted: { other: "die letzten {n} Wochen" } },
        months: { one: "letzten Monat", counted: { other: "die letzten {n} Monate" } },
        years: { one: "dieses Jahr", counted: { other: "die letzten {n} Jahre" } },
      },
      kcalToday: "{kcal}kcal heute",
      kcalADay: "{kcal}kcal am Tag",
    },
    compare: {
      bars: "Balken",
      line: "Linie",
      axes: "{a} als Balken, linke Achse · {b} als Linie, rechte Achse.",
      noData: "Zu wenige {period} mit {a} und {b} aufgezeichnet, um zu sagen, wie sie zusammenhängen.",
      periodNouns: { days: "Tage", weeks: "Wochen", months: "Monate", years: "Jahre" },
      pickLabel: "{kind}: {series}",
    },
    body: {
      trendDown: "▼ {d} seit dem {date} · noch {to} bis {target}",
      trendDownSolo: "▼ {d} seit dem {date}",
      trendUp: "▲ {d} seit dem {date} · noch {to} bis {target}",
      trendUpSolo: "▲ {d} seit dem {date}",
      trendFlat: "Stabil seit dem {date}",
      plan: "Plan",
      planValue: "{kcal}kcal",
      planMoved: "{old} → {new}kcal",
      todayAt: "heute um {time}",
      fromHealth: "Von Apple Health, {when}",
      deltaUp: "▲ {n}",
      deltaDown: "▼ {n}",
      loadFailed: "Deine Wiegungen ließen sich nicht laden.",
      lineDownSlow: "{kg} weniger — langsamer als das {pace} Tempo, das du gewählt hast.",
      lineDownOnPace: "{kg} weniger — genau das {pace} Tempo, das du gewählt hast.",
      lineDownFast: "{kg} weniger — schneller als das {pace} Tempo, das du gewählt hast.",
      lineUpSlow: "{kg} mehr — langsamer als das {pace} Tempo, das du gewählt hast.",
      lineUpOnPace: "{kg} mehr — genau das {pace} Tempo, das du gewählt hast.",
      lineUpFast: "{kg} mehr — schneller als das {pace} Tempo, das du gewählt hast.",
      lineFlat: "Stabil gehalten — das {pace} Tempo, das du gewählt hast.",
      lineDrift: "Weg von {target}; dein Plan ist auf das {pace} Tempo eingestellt.",
      paces: { easy: "sanfte", steady: "stetige", push: "zügige" },
    },
    weekLine: {
      allInside: "Jeden Tag innerhalb deiner {target}.",
      overButOk: "{days} drüber; die Periode landet bei {avg} am Tag.",
      avgOver: "Die Periode liegt bei {avg} am Tag, über deinen {target}.",
      days: { one: "{n} Tag", other: "{n} Tage" },
    },
  },
  it: {
    titles: { health: "Apple Health", compare: "Confronto" },
    back: "Indietro",
    today: "Oggi",
    connect: {
      cta: "Collega Apple Health",
      reads: "Legge",
      readsList: "peso, corpo, energia, attività, sonno",
      writes: "Scrive",
      writesList: "i pasti che registri",
      weightOnly: "Solo il tuo peso",
      weightOnlyDesc: "muove il tuo piano",
      closed: "Il pannello di Salute si è chiuso senza scelte. Puoi tornarci quando vuoi.",
    },
    unavailable: {
      title: "Non disponibile su questo iPhone",
      body: "Il tuo diario e il tuo piano funzionano allo stesso modo senza.",
    },
    notice: {
      notReachingTitle: "I pasti non arrivano in Salute",
      notReachingBody: "I tuoi grafici sono a posto. Attiva le categorie Nutrizione di eait in Salute.",
      offTitle: "eait è disattivata in Salute",
      offBody: "Il tuo diario non cambia; i grafici qui leggono ciò che Salute condivide con eait.",
      nothingTitle: "Ancora niente registrato",
      nothingBody: "I grafici appaiono quando Salute ha dati su questo iPhone — una pesata, un allenamento, una notte di sonno.",
      syncTitle: "La sincronizzazione con Salute ha avuto un errore",
      syncReached: "Il tuo server ha risposto",
      syncRefused: "HealthKit ha rifiutato",
      tryAgain: "Riprova",
      openHealth: "Apri Salute",
      askAgain: "Richiedi a Salute",
      readsMoreTitle: "Salute mostra più di quanto eait legga",
      readsMoreBody: "eait vede solo le categorie che attivi per lei.",
      path: "In Salute: la tua foto in alto a destra › App › eait. Oppure Impostazioni › Privacy e sicurezza › Salute › eait.",
      pathSpoken: "In Salute, tocca la tua foto in alto a destra, poi App, poi eait. Oppure apri Impostazioni, Privacy e sicurezza, Salute, eait.",
      alertOpenTitle: "Impossibile aprire Salute",
      alertSheetTitle: "Impossibile aprire il pannello di Salute",
    },
    intake: {
      periods: {
        days: { one: "gli ultimi 7 giorni", counted: { other: "gli ultimi 7 giorni" } },
        weeks: { one: "la settimana scorsa", counted: { other: "le ultime {n} settimane" } },
        months: { one: "il mese scorso", counted: { other: "gli ultimi {n} mesi" } },
        years: { one: "quest'anno", counted: { other: "gli ultimi {n} anni" } },
      },
      kcalToday: "{kcal}kcal oggi",
      kcalADay: "{kcal}kcal al giorno",
    },
    compare: {
      bars: "Barre",
      line: "Linea",
      axes: "{a} in barre, asse sinistra · {b} in linea, asse destra.",
      noData: "Non abbastanza {period} con {a} e {b} registrati per dire come sono legati.",
      periodNouns: { days: "giorni", weeks: "settimane", months: "mesi", years: "anni" },
      pickLabel: "{kind}: {series}",
    },
    body: {
      trendDown: "▼ {d} dal {date} · {to} fino a {target}",
      trendDownSolo: "▼ {d} dal {date}",
      trendUp: "▲ {d} dal {date} · {to} fino a {target}",
      trendUpSolo: "▲ {d} dal {date}",
      trendFlat: "Stabile dal {date}",
      plan: "Piano",
      planValue: "{kcal}kcal",
      planMoved: "{old} → {new}kcal",
      todayAt: "oggi alle {time}",
      fromHealth: "Da Apple Health, {when}",
      deltaUp: "▲ {n}",
      deltaDown: "▼ {n}",
      loadFailed: "Impossibile caricare le tue pesate.",
      lineDownSlow: "{kg} in meno — più piano del ritmo {pace} che hai scelto.",
      lineDownOnPace: "{kg} in meno — al ritmo {pace} che hai scelto.",
      lineDownFast: "{kg} in meno — più veloce del ritmo {pace} che hai scelto.",
      lineUpSlow: "{kg} in più — più piano del ritmo {pace} che hai scelto.",
      lineUpOnPace: "{kg} in più — al ritmo {pace} che hai scelto.",
      lineUpFast: "{kg} in più — più veloce del ritmo {pace} che hai scelto.",
      lineFlat: "Stabile — il ritmo {pace} che hai scelto.",
      lineDrift: "In allontanamento da {target}; il tuo piano è impostato su un ritmo {pace}.",
      paces: { easy: "dolce", steady: "costante", push: "sostenuto" },
    },
    weekLine: {
      allInside: "Ogni giorno dentro i tuoi {target}.",
      overButOk: "{days} sopra; il periodo resta a {avg} al giorno.",
      avgOver: "Il periodo viaggia a {avg} al giorno, sopra i tuoi {target}.",
      days: { one: "{n} giorno", other: "{n} giorni" },
    },
  },
  es: {
    titles: { health: "Apple Health", compare: "Comparar" },
    back: "Atrás",
    today: "Hoy",
    connect: {
      cta: "Conectar Apple Health",
      reads: "Lee",
      readsList: "peso, cuerpo, energía, actividad, sueño",
      writes: "Escribe",
      writesList: "las comidas que registras",
      weightOnly: "Solo tu peso",
      weightOnlyDesc: "mueve tu plan",
      closed: "El panel de Salud se cerró sin elegir nada. Puedes volver cuando quieras.",
    },
    unavailable: {
      title: "No disponible en este iPhone",
      body: "Tu diario y tu plan funcionan igual sin él.",
    },
    notice: {
      notReachingTitle: "Las comidas no llegan a Salud",
      notReachingBody: "Tus gráficos están bien. Activa las categorías de Nutrición de eait en Salud.",
      offTitle: "eait está desactivado en Salud",
      offBody: "Tu diario no cambia; los gráficos leen lo que Salud comparte con eait.",
      nothingTitle: "Nada registrado todavía",
      nothingBody: "Los gráficos aparecen cuando Salud tiene datos en este iPhone — una pesada, un entrenamiento, una noche de sueño.",
      syncTitle: "La sincronización con Salud dio un error",
      syncReached: "Tu servidor respondió",
      syncRefused: "HealthKit lo rechazó",
      tryAgain: "Reintentar",
      openHealth: "Abrir Salud",
      askAgain: "Volver a pedir a Salud",
      readsMoreTitle: "Salud muestra más de lo que eait lee",
      readsMoreBody: "eait solo ve las categorías que activas para él.",
      path: "En Salud: tu foto arriba a la derecha › Apps › eait. O Ajustes › Privacidad y seguridad › Salud › eait.",
      pathSpoken: "En Salud, toca tu foto arriba a la derecha, luego Apps, luego eait. O abre Ajustes, Privacidad y seguridad, Salud, eait.",
      alertOpenTitle: "No se pudo abrir Salud",
      alertSheetTitle: "No se pudo abrir la hoja de Salud",
    },
    intake: {
      periods: {
        days: { one: "los últimos 7 días", counted: { other: "los últimos 7 días" } },
        weeks: { one: "la semana pasada", counted: { other: "las últimas {n} semanas" } },
        months: { one: "el mes pasado", counted: { other: "los últimos {n} meses" } },
        years: { one: "este año", counted: { other: "los últimos {n} años" } },
      },
      kcalToday: "{kcal}kcal hoy",
      kcalADay: "{kcal}kcal al día",
    },
    compare: {
      bars: "Barras",
      line: "Línea",
      axes: "{a} en barras, eje izquierdo · {b} en línea, eje derecho.",
      noData: "No hay suficientes {period} con {a} y {b} registrados para decir cómo se relacionan.",
      periodNouns: { days: "días", weeks: "semanas", months: "meses", years: "años" },
      pickLabel: "{kind}: {series}",
    },
    body: {
      trendDown: "▼ {d} desde el {date} · {to} hasta {target}",
      trendDownSolo: "▼ {d} desde el {date}",
      trendUp: "▲ {d} desde el {date} · {to} hasta {target}",
      trendUpSolo: "▲ {d} desde el {date}",
      trendFlat: "Estable desde el {date}",
      plan: "Plan",
      planValue: "{kcal}kcal",
      planMoved: "{old} → {new}kcal",
      todayAt: "hoy a las {time}",
      fromHealth: "Desde Apple Health, {when}",
      deltaUp: "▲ {n}",
      deltaDown: "▼ {n}",
      loadFailed: "No se pudieron cargar tus pesajes.",
      lineDownSlow: "{kg} menos — más despacio que el ritmo {pace} que elegiste.",
      lineDownOnPace: "{kg} menos — al ritmo {pace} que elegiste.",
      lineDownFast: "{kg} menos — más rápido que el ritmo {pace} que elegiste.",
      lineUpSlow: "{kg} más — más despacio que el ritmo {pace} que elegiste.",
      lineUpOnPace: "{kg} más — al ritmo {pace} que elegiste.",
      lineUpFast: "{kg} más — más rápido que el ritmo {pace} que elegiste.",
      lineFlat: "Estable — el ritmo {pace} que elegiste.",
      lineDrift: "Alejándote de {target}; tu plan está fijado a un ritmo {pace}.",
      paces: { easy: "suave", steady: "constante", push: "rápido" },
    },
    weekLine: {
      allInside: "Cada día dentro de tus {target}.",
      overButOk: "{days} por encima; el periodo queda en {avg} al día.",
      avgOver: "El periodo va a {avg} al día, por encima de tus {target}.",
      days: { one: "{n} día", other: "{n} días" },
    },
  },
  vi: {
    titles: { health: "Apple Health", compare: "So sánh" },
    back: "Quay lại",
    today: "Hôm nay",
    connect: {
      cta: "Kết nối Apple Health",
      reads: "Đọc",
      readsList: "cân nặng, cơ thể, năng lượng, vận động, giấc ngủ",
      writes: "Ghi",
      writesList: "các bữa bạn ghi lại",
      weightOnly: "Chỉ cân nặng của bạn",
      weightOnlyDesc: "mới đổi kế hoạch của bạn",
      closed: "Bảng Health đã đóng mà không chọn gì. Bạn quay lại bất cứ lúc nào cũng được.",
    },
    unavailable: {
      title: "Không có trên iPhone này",
      body: "Nhật ký và kế hoạch của bạn vẫn hoạt động như thường mà không cần nó.",
    },
    notice: {
      notReachingTitle: "Bữa ăn chưa tới được Health",
      notReachingBody: "Biểu đồ của bạn vẫn ổn. Bật các nhóm Dinh dưỡng của eait trong Health.",
      offTitle: "eait đang tắt trong Health",
      offBody: "Nhật ký của bạn không bị ảnh hưởng; biểu đồ ở đây đọc từ những gì Health chia sẻ cho eait.",
      nothingTitle: "Chưa có gì được ghi",
      nothingBody: "Biểu đồ sẽ xuất hiện khi Health có dữ liệu trên iPhone này — một lần cân, một buổi tập, một đêm ngủ.",
      syncTitle: "Đồng bộ Health gặp lỗi",
      syncReached: "Máy chủ của bạn đã trả lời",
      syncRefused: "HealthKit từ chối",
      tryAgain: "Thử lại",
      openHealth: "Mở Health",
      askAgain: "Hỏi lại Health",
      readsMoreTitle: "Health hiển thị nhiều hơn những gì eait đọc",
      readsMoreBody: "eait chỉ thấy các nhóm bạn bật cho nó.",
      path: "Trong Health: ảnh của bạn ở góc trên bên phải › Apps › eait. Hoặc Cài đặt › Quyền riêng tư và bảo mật › Health › eait.",
      pathSpoken: "Trong Health, chạm vào ảnh của bạn ở góc trên bên phải, rồi Apps, rồi eait. Hoặc mở Cài đặt, Quyền riêng tư và bảo mật, Health, eait.",
      alertOpenTitle: "Không mở được Health",
      alertSheetTitle: "Không mở được bảng của Health",
    },
    intake: {
      periods: {
        days: { one: "7 ngày qua", counted: { other: "7 ngày qua" } },
        weeks: { one: "tuần trước", counted: { other: "{n} tuần gần đây" } },
        months: { one: "tháng trước", counted: { other: "{n} tháng gần đây" } },
        years: { one: "năm nay", counted: { other: "{n} năm gần đây" } },
      },
      kcalToday: "{kcal}kcal hôm nay",
      kcalADay: "{kcal}kcal mỗi ngày",
    },
    compare: {
      bars: "Cột",
      line: "Đường",
      axes: "{a} dạng cột, trục trái · {b} dạng đường, trục phải.",
      noData: "Chưa đủ {period} có cả {a} lẫn {b} để nói chúng liên hệ thế nào.",
      periodNouns: { days: "ngày", weeks: "tuần", months: "tháng", years: "năm" },
      pickLabel: "{kind}: {series}",
    },
    body: {
      trendDown: "▼ {d} từ {date} · còn {to} tới {target}",
      trendDownSolo: "▼ {d} từ {date}",
      trendUp: "▲ {d} từ {date} · còn {to} tới {target}",
      trendUpSolo: "▲ {d} từ {date}",
      trendFlat: "Giữ nguyên từ {date}",
      plan: "Kế hoạch",
      planValue: "{kcal}kcal",
      planMoved: "{old} → {new}kcal",
      todayAt: "hôm nay lúc {time}",
      fromHealth: "Từ Apple Health, {when}",
      deltaUp: "▲ {n}",
      deltaDown: "▼ {n}",
      loadFailed: "Không tải được các lần cân của bạn.",
      lineDownSlow: "Giảm {kg} — chậm hơn nhịp {pace} bạn đã chọn.",
      lineDownOnPace: "Giảm {kg} — đúng nhịp {pace} bạn đã chọn.",
      lineDownFast: "Giảm {kg} — nhanh hơn nhịp {pace} bạn đã chọn.",
      lineUpSlow: "Tăng {kg} — chậm hơn nhịp {pace} bạn đã chọn.",
      lineUpOnPace: "Tăng {kg} — đúng nhịp {pace} bạn đã chọn.",
      lineUpFast: "Tăng {kg} — nhanh hơn nhịp {pace} bạn đã chọn.",
      lineFlat: "Giữ đều — nhịp {pace} bạn đã chọn.",
      lineDrift: "Đang xa {target}; kế hoạch của bạn đặt ở nhịp {pace}.",
      paces: { easy: "nhẹ nhàng", steady: "đều", push: "nhanh" },
    },
    weekLine: {
      allInside: "Mọi ngày đều trong {target} của bạn.",
      overButOk: "{days} vượt; cả kỳ vẫn về {avg} mỗi ngày.",
      avgOver: "Cả kỳ trung bình {avg} mỗi ngày, trên {target} của bạn.",
      days: { other: "{n} ngày" },
    },
  },
  id: {
    titles: { health: "Apple Health", compare: "Bandingkan" },
    back: "Kembali",
    today: "Hari ini",
    connect: {
      cta: "Hubungkan Apple Health",
      reads: "Membaca",
      readsList: "berat, tubuh, energi, aktivitas, tidur",
      writes: "Menulis",
      writesList: "makanan yang kamu catat",
      weightOnly: "Hanya beratmu",
      weightOnlyDesc: "yang menggerakkan rencanamu",
      closed: "Lembar Health tertutup tanpa pilihan. Kamu bisa kembali kapan saja.",
    },
    unavailable: {
      title: "Tidak tersedia di iPhone ini",
      body: "Diari dan rencanamu tetap berjalan sama tanpanya.",
    },
    notice: {
      notReachingTitle: "Makanan belum sampai ke Health",
      notReachingBody: "Grafikmu baik-baik saja. Nyalakan kategori Nutrisi eait di Health.",
      offTitle: "eait dimatikan di Health",
      offBody: "Diarimu tidak terpengaruh; grafik di sini membaca yang Health bagikan ke eait.",
      nothingTitle: "Belum ada yang tercatat",
      nothingBody: "Grafik muncul saat Health punya data di iPhone ini — satu penimbangan, satu latihan, satu malam tidur.",
      syncTitle: "Sinkronisasi Health kena error",
      syncReached: "Servermu menjawab",
      syncRefused: "HealthKit menolak",
      tryAgain: "Coba lagi",
      openHealth: "Buka Health",
      askAgain: "Tanya Health lagi",
      readsMoreTitle: "Health menampilkan lebih dari yang eait baca",
      readsMoreBody: "eait hanya melihat kategori yang kamu nyalakan untuknya.",
      path: "Di Health: fotomu di kanan atas › Apps › eait. Atau Pengaturan › Privasi & Keamanan › Health › eait.",
      pathSpoken: "Di Health, ketuk fotomu di kanan atas, lalu Apps, lalu eait. Atau buka Pengaturan, Privasi dan Keamanan, Health, eait.",
      alertOpenTitle: "Health tidak bisa dibuka",
      alertSheetTitle: "Lembar Health tidak bisa dibuka",
    },
    intake: {
      periods: {
        days: { one: "7 hari terakhir", counted: { other: "7 hari terakhir" } },
        weeks: { one: "minggu lalu", counted: { other: "{n} minggu terakhir" } },
        months: { one: "bulan lalu", counted: { other: "{n} bulan terakhir" } },
        years: { one: "tahun ini", counted: { other: "{n} tahun terakhir" } },
      },
      kcalToday: "{kcal}kcal hari ini",
      kcalADay: "{kcal}kcal sehari",
    },
    compare: {
      bars: "Batang",
      line: "Garis",
      axes: "{a} sebagai batang, sumbu kiri · {b} sebagai garis, sumbu kanan.",
      noData: "Belum cukup {period} dengan {a} dan {b} tercatat untuk bilang bagaimana keduanya berkaitan.",
      periodNouns: { days: "hari", weeks: "minggu", months: "bulan", years: "tahun" },
      pickLabel: "{kind}: {series}",
    },
    body: {
      trendDown: "▼ {d} sejak {date} · sisa {to} ke {target}",
      trendDownSolo: "▼ {d} sejak {date}",
      trendUp: "▲ {d} sejak {date} · sisa {to} ke {target}",
      trendUpSolo: "▲ {d} sejak {date}",
      trendFlat: "Stabil sejak {date}",
      plan: "Rencana",
      planValue: "{kcal}kcal",
      planMoved: "{old} → {new}kcal",
      todayAt: "hari ini {time}",
      fromHealth: "Dari Apple Health, {when}",
      deltaUp: "▲ {n}",
      deltaDown: "▼ {n}",
      loadFailed: "Timbanganmu tidak bisa dimuat.",
      lineDownSlow: "Turun {kg} — lebih pelan dari ritme {pace} yang kamu pilih.",
      lineDownOnPace: "Turun {kg} — pas ritme {pace} yang kamu pilih.",
      lineDownFast: "Turun {kg} — lebih cepat dari ritme {pace} yang kamu pilih.",
      lineUpSlow: "Naik {kg} — lebih pelan dari ritme {pace} yang kamu pilih.",
      lineUpOnPace: "Naik {kg} — pas ritme {pace} yang kamu pilih.",
      lineUpFast: "Naik {kg} — lebih cepat dari ritme {pace} yang kamu pilih.",
      lineFlat: "Bertahan — ritme {pace} yang kamu pilih.",
      lineDrift: "Menjauh dari {target}; rencanamu dipasang di ritme {pace}.",
      paces: { easy: "santai", steady: "stabil", push: "cepat" },
    },
    weekLine: {
      allInside: "Setiap hari dalam {target}-mu.",
      overButOk: "{days} lebih; periodenya tetap mendarat di {avg} sehari.",
      avgOver: "Periodenya rata-rata {avg} sehari, di atas {target}-mu.",
      days: { other: "{n} hari" },
    },
  },
  ru: {
    titles: { health: "Apple Health", compare: "Сравнение" },
    back: "Назад",
    today: "Сегодня",
    connect: {
      cta: "Подключить Apple Health",
      reads: "Читает",
      readsList: "вес, тело, энергию, активность, сон",
      writes: "Пишет",
      writesList: "блюда, которые ты записываешь",
      weightOnly: "Только твой вес",
      weightOnlyDesc: "меняет твой план",
      closed: "Окно «Здоровья» закрылось без выбора. Можно вернуться в любой момент.",
    },
    unavailable: {
      title: "Недоступно на этом iPhone",
      body: "Дневник и план работают так же и без него.",
    },
    notice: {
      notReachingTitle: "Блюда не доходят до «Здоровья»",
      notReachingBody: "С графиками всё в порядке. Включи категории «Питание» для eait в «Здоровье».",
      offTitle: "eait выключен в «Здоровье»",
      offBody: "Дневник не пострадает; графики здесь читают то, чем «Здоровье» делится с eait.",
      nothingTitle: "Пока ничего не записано",
      nothingBody: "Графики появятся, когда в «Здоровье» будут данные с этого iPhone — взвешивание, тренировка, ночь сна.",
      syncTitle: "Синхронизация со «Здоровьем» дала ошибку",
      syncReached: "Сервер ответил",
      syncRefused: "HealthKit отказал",
      tryAgain: "Ещё раз",
      openHealth: "Открыть «Здоровье»",
      askAgain: "Спросить «Здоровье» снова",
      readsMoreTitle: "«Здоровье» показывает больше, чем читает eait",
      readsMoreBody: "eait видит только категории, которые ты для него включаешь.",
      path: "В «Здоровье»: твоё фото вверху справа › «Приложения» › eait. Или «Настройки» › «Конфиденциальность и безопасность» › «Здоровье» › eait.",
      pathSpoken: "В «Здоровье» нажми на фото вверху справа, затем «Приложения», затем eait. Или открой «Настройки», «Конфиденциальность и безопасность», «Здоровье», eait.",
      alertOpenTitle: "Не удалось открыть «Здоровье»",
      alertSheetTitle: "Не удалось открыть окно «Здоровья»",
    },
    intake: {
      periods: {
        days: { one: "за последние 7 дней", counted: { other: "за последние 7 дней" } },
        weeks: { one: "за прошлую неделю", counted: { one: "за последние {n} неделю", few: "за последние {n} недели", many: "за последние {n} недель", other: "за последние {n} недели" } },
        months: { one: "за прошлый месяц", counted: { one: "за последние {n} месяц", few: "за последние {n} месяца", many: "за последние {n} месяцев", other: "за последние {n} месяца" } },
        years: { one: "за этот год", counted: { one: "за последние {n} год", few: "за последние {n} года", many: "за последние {n} лет", other: "за последние {n} года" } },
      },
      kcalToday: "{kcal}ккал сегодня",
      kcalADay: "{kcal}ккал в день",
    },
    compare: {
      bars: "Столбики",
      line: "Линия",
      axes: "{a} столбиками, левая ось · {b} линией, правая ось.",
      noData: "Слишком мало {period}, где записаны и {a}, и {b}, чтобы сказать, как они связаны.",
      periodNouns: { days: "дней", weeks: "недель", months: "месяцев", years: "лет" },
      pickLabel: "{kind}: {series}",
    },
    body: {
      trendDown: "▼ {d} с {date} · осталось {to} до {target}",
      trendDownSolo: "▼ {d} с {date}",
      trendUp: "▲ {d} с {date} · осталось {to} до {target}",
      trendUpSolo: "▲ {d} с {date}",
      trendFlat: "Без изменений с {date}",
      plan: "План",
      planValue: "{kcal}ккал",
      planMoved: "{old} → {new}ккал",
      todayAt: "сегодня в {time}",
      fromHealth: "Из Apple Health, {when}",
      deltaUp: "▲ {n}",
      deltaDown: "▼ {n}",
      loadFailed: "Не удалось загрузить твои взвешивания.",
      lineDownSlow: "Минус {kg} — медленнее, чем твой {pace} темп.",
      lineDownOnPace: "Минус {kg} — как раз твой {pace} темп.",
      lineDownFast: "Минус {kg} — быстрее, чем твой {pace} темп.",
      lineUpSlow: "Плюс {kg} — медленнее, чем твой {pace} темп.",
      lineUpOnPace: "Плюс {kg} — как раз твой {pace} темп.",
      lineUpFast: "Плюс {kg} — быстрее, чем твой {pace} темп.",
      lineFlat: "Держится — твой {pace} темп.",
      lineDrift: "Уходит от {target}; план настроен на {pace} темп.",
      paces: { easy: "мягкий", steady: "ровный", push: "быстрый" },
    },
    weekLine: {
      allInside: "Каждый день в пределах твоих {target}.",
      overButOk: "{days} сверх плана; за период всё равно выходит {avg} в день.",
      avgOver: "За период выходит {avg} в день — выше твоих {target}.",
      days: { one: "{n} день", few: "{n} дня", many: "{n} дней", other: "{n} дней" },
    },
  },
};

export const healthScreenCopyFor = (lang: Lang): HealthScreenCopy => t(lang)(HEALTH_SCREEN_COPY);
