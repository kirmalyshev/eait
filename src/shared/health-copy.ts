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

import { t, type Localized } from "./lang.ts";
import { HEALTH_FIELDS, HEALTH_GROUPS } from "./health.ts";
import type { Lang } from "./types.ts";

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
}

/** The English, derived rather than retyped. */
const EN_LABELS: Record<string, string> = Object.fromEntries([
  ...HEALTH_GROUPS.map((g) => [g.id, g.label]),
  ...HEALTH_FIELDS.map((f) => [f.key, f.label]),
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
  },
  ru: {
    labels: labels({
      body: "Тело", energy: "Энергия", activity: "Активность", sleep: "Сон", cardio: "Сердце",
      weight_kg: "Вес", height_cm: "Рост", body_fat_pct: "Процент жира", lean_mass_kg: "Сухая масса",
      active_kcal: "Активная энергия", resting_kcal: "Энергия покоя",
      steps: "Шаги", exercise_minutes: "Время тренировок", workouts: "Тренировки", distance_km: "Дистанция",
      asleep_minutes: "Продолжительность сна", in_bed_minutes: "Время в постели",
      resting_hr_bpm: "Пульс покоя", hrv_ms: "ВСР", vo2max: "МПК",
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
  },
};

/** What the screen calls one metric or one group. The key itself if a binary is a version behind. */
export const healthLabel = (key: string, lang: Lang): string =>
  t(lang)(HEALTH_COPY).labels[key] ?? key;
