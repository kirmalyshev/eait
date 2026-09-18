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
  },
  fr: {
    labels: labels({
      body: "Corps", energy: "Énergie", activity: "Activité", sleep: "Sommeil", cardio: "Cœur",
      weight_kg: "Poids", height_cm: "Taille", body_fat_pct: "Masse grasse", lean_mass_kg: "Masse maigre",
      active_kcal: "Énergie active", resting_kcal: "Énergie au repos",
      steps: "Pas", exercise_minutes: "Exercice", workouts: "Séances", distance_km: "Distance",
      asleep_minutes: "Endormi", in_bed_minutes: "Au lit",
      resting_hr_bpm: "Fréquence cardiaque au repos", hrv_ms: "VFC", vo2max: "VO2 max",
    }),
    correlation: {
      none: "aucun lien net",
      sentence: "un lien {strength} — {direction}",
      weak: "faible", moderate: "modéré", strong: "fort",
      together: "ils montent plutôt ensemble",
      opposed: "l'un monte quand l'autre descend",
    },
  },
  de: {
    labels: labels({
      body: "Körper", energy: "Energie", activity: "Aktivität", sleep: "Schlaf", cardio: "Herz",
      weight_kg: "Gewicht", height_cm: "Größe", body_fat_pct: "Körperfett", lean_mass_kg: "Magermasse",
      active_kcal: "Aktive Energie", resting_kcal: "Ruheenergie",
      steps: "Schritte", exercise_minutes: "Bewegung", workouts: "Einheiten", distance_km: "Strecke",
      asleep_minutes: "Geschlafen", in_bed_minutes: "Im Bett",
      resting_hr_bpm: "Ruhepuls", hrv_ms: "HRV", vo2max: "VO2max",
    }),
    correlation: {
      none: "kein klarer Zusammenhang",
      sentence: "ein {strength} Zusammenhang — {direction}",
      weak: "schwacher", moderate: "mittlerer", strong: "starker",
      together: "sie steigen meist gemeinsam",
      opposed: "das eine steigt, während das andere fällt",
    },
  },
  it: {
    labels: labels({
      body: "Corpo", energy: "Energia", activity: "Attività", sleep: "Sonno", cardio: "Cuore",
      weight_kg: "Peso", height_cm: "Altezza", body_fat_pct: "Massa grassa", lean_mass_kg: "Massa magra",
      active_kcal: "Energia attiva", resting_kcal: "Energia a riposo",
      steps: "Passi", exercise_minutes: "Esercizio", workouts: "Allenamenti", distance_km: "Distanza",
      asleep_minutes: "Dormito", in_bed_minutes: "A letto",
      resting_hr_bpm: "Frequenza a riposo", hrv_ms: "HRV", vo2max: "VO2 max",
    }),
    correlation: {
      none: "nessun legame chiaro",
      sentence: "un legame {strength} — {direction}",
      weak: "debole", moderate: "moderato", strong: "forte",
      together: "tendono a salire insieme",
      opposed: "uno sale mentre l'altro scende",
    },
  },
  es: {
    labels: labels({
      body: "Cuerpo", energy: "Energía", activity: "Actividad", sleep: "Sueño", cardio: "Corazón",
      weight_kg: "Peso", height_cm: "Altura", body_fat_pct: "Grasa corporal", lean_mass_kg: "Masa magra",
      active_kcal: "Energía activa", resting_kcal: "Energía en reposo",
      steps: "Pasos", exercise_minutes: "Ejercicio", workouts: "Entrenamientos", distance_km: "Distancia",
      asleep_minutes: "Dormido", in_bed_minutes: "En la cama",
      resting_hr_bpm: "Frecuencia en reposo", hrv_ms: "VFC", vo2max: "VO2 máx",
    }),
    correlation: {
      none: "sin relación clara",
      sentence: "una relación {strength} — {direction}",
      weak: "débil", moderate: "moderada", strong: "fuerte",
      together: "suelen subir juntos",
      opposed: "uno sube mientras el otro baja",
    },
  },
  vi: {
    labels: labels({
      body: "Cơ thể", energy: "Năng lượng", activity: "Vận động", sleep: "Giấc ngủ", cardio: "Tim mạch",
      weight_kg: "Cân nặng", height_cm: "Chiều cao", body_fat_pct: "Mỡ cơ thể", lean_mass_kg: "Khối nạc",
      active_kcal: "Năng lượng vận động", resting_kcal: "Năng lượng lúc nghỉ",
      steps: "Số bước", exercise_minutes: "Tập luyện", workouts: "Buổi tập", distance_km: "Quãng đường",
      asleep_minutes: "Ngủ", in_bed_minutes: "Trên giường",
      resting_hr_bpm: "Nhịp tim lúc nghỉ", hrv_ms: "HRV", vo2max: "VO2 max",
    }),
    correlation: {
      none: "chưa thấy liên hệ rõ",
      sentence: "liên hệ {strength} — {direction}",
      weak: "yếu", moderate: "vừa", strong: "mạnh",
      together: "hai bên thường cùng tăng",
      opposed: "bên này tăng thì bên kia giảm",
    },
  },
  id: {
    labels: labels({
      body: "Tubuh", energy: "Energi", activity: "Aktivitas", sleep: "Tidur", cardio: "Jantung",
      weight_kg: "Berat", height_cm: "Tinggi", body_fat_pct: "Lemak tubuh", lean_mass_kg: "Massa tanpa lemak",
      active_kcal: "Energi aktif", resting_kcal: "Energi istirahat",
      steps: "Langkah", exercise_minutes: "Olahraga", workouts: "Latihan", distance_km: "Jarak",
      asleep_minutes: "Tertidur", in_bed_minutes: "Di tempat tidur",
      resting_hr_bpm: "Detak jantung istirahat", hrv_ms: "HRV", vo2max: "VO2 maks",
    }),
    correlation: {
      none: "tidak ada kaitan yang jelas",
      sentence: "kaitan {strength} — {direction}",
      weak: "lemah", moderate: "sedang", strong: "kuat",
      together: "keduanya cenderung naik bersama",
      opposed: "yang satu naik saat yang lain turun",
    },
  },
  ru: {
    labels: labels({
      body: "Тело", energy: "Энергия", activity: "Активность", sleep: "Сон", cardio: "Сердце",
      weight_kg: "Вес", height_cm: "Рост", body_fat_pct: "Жировая масса", lean_mass_kg: "Сухая масса",
      active_kcal: "Активная энергия", resting_kcal: "Энергия покоя",
      steps: "Шаги", exercise_minutes: "Нагрузка", workouts: "Тренировки", distance_km: "Дистанция",
      asleep_minutes: "Сон", in_bed_minutes: "В постели",
      resting_hr_bpm: "Пульс покоя", hrv_ms: "ВСР", vo2max: "МПК",
    }),
    correlation: {
      none: "явной связи нет",
      sentence: "{strength} связь — {direction}",
      weak: "слабая", moderate: "умеренная", strong: "сильная",
      together: "обычно растут вместе",
      opposed: "одно растёт, пока другое падает",
    },
  },
};

/** What the screen calls one metric or one group. The key itself if a binary is a version behind. */
export const healthLabel = (key: string, lang: Lang = "en"): string =>
  t(lang)(HEALTH_COPY).labels[key] ?? key;
