// Shared domain types. Defined once here, consumed unchanged everywhere (no per-module drift).

export type Goal = "lose" | "maintain" | "gain";
export type UserState = "consent" | "profile" | "active";
export type Verdict = "good" | "warn" | "bad";
export type Lang = "ru" | "en";

/** A user's analysis profile — what every meal is judged against. */
export interface Profile {
  telegram_id: number;
  lang: Lang;
  goal: Goal | null;
  restrictions: string[]; // tags e.g. ["kidneys","ldl","vegan","lowsugar"]
}

export interface MealItem {
  name: string;
  grams: number;
}

/** Per-dimension verdicts. Only dimensions relevant to the user's profile are set. */
export interface MealVerdicts {
  weight?: Verdict;
  ldl?: Verdict;
  kidneys?: Verdict;
}

/** The analyzer's validated output for one photo. No photo path — images are ephemeral. */
export interface MealAnalysis {
  isFood: boolean;
  items: MealItem[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  satfat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  plant_protein_pct: number;
  verdicts: MealVerdicts;
  confidence: string;
  notes: string;
}

/** A persisted meal row (superset of MealAnalysis + routing/audit fields). */
export interface MealRecord {
  id: string; // UUID — never a timestamp
  user_id: number;
  ts: string; // ISO
  date: string; // YYYY-MM-DD in Europe/Berlin
  chat_id: number | null;
  bot_message_id: number | null;
  items: MealItem[];
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  satfat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  plant_protein_pct: number;
  verdicts: MealVerdicts;
  confidence: string | null;
  notes: string | null;
  corrected: boolean;
  model: string | null;
}

export interface DailyTotals {
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  satfat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
}

/** The user's daily targets. Caps are present only for relevant restrictions. */
export interface FoodTargets {
  kcal: number;
  protein_g: number;
  satfat_g?: number; // present when the user declared an ldl restriction
  sodium_mg?: number; // present when the user declared a kidneys restriction
}
