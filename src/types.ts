// Shared domain types. Defined once here, consumed unchanged everywhere (no per-module drift).

export type Goal = "lose" | "maintain" | "gain";
export type UserState = "consent" | "profile" | "active";
export type Verdict = "good" | "warn" | "bad";

/** Meal-card renderings: Telegram Rich Messages vs text with emojis. Vocabulary for both the
 * instance default (REPLY_FORMAT env) and the per-user /settings override. */
export const REPLY_FORMATS = ["rich", "plain"] as const;
export type ReplyFormat = (typeof REPLY_FORMATS)[number];
export function isReplyFormat(v: unknown): v is ReplyFormat {
  return (REPLY_FORMATS as readonly unknown[]).includes(v);
}

// Lang is DERIVED from the locale registry, not written by hand: adding a locale file widens
// it automatically, and nothing here needs editing. Imported for local use below and
// re-exported so existing imports of `Lang` from ./types.ts keep working.
import type { Lang } from "./i18n/registry.ts";
export type { Lang };

/** A user's profile — the analysis inputs every meal is judged against, plus rendering prefs. */
export interface Profile {
  telegram_id: number;
  lang: Lang;
  goal: Goal | null;
  /** Kilograms; null/absent = unknown (never asked, or declined). The db's 0-skip sentinel never reaches here. */
  weight_kg?: number | null;
  /** Target bodyweight in kg; null/absent = unknown. Same boundary rule as weight_kg (0 → null). */
  target_weight_kg?: number | null;
  /** Purchase country: a curated code (`de`/`ru`/…) or a raw "other" string; null/absent = unknown.
   * The db's '' skip sentinel is mapped to null before it reaches here. */
  country?: string | null;
  restrictions: string[]; // tags e.g. ["kidneys","ldl","vegan","lowsugar"]
  /**
   * Free-text "food specifics", prompt-only — everything the closed `restrictions` vocabulary
   * cannot express. Three labelled fields: medical conditions/needs, food allergies
   * (safety-critical), and specific products the user avoids. None drives a numeric cap or a
   * verdict dimension; each is injected into the analyzer prompt verbatim on its own labelled line.
   * null = unknown; the db's '' skip sentinel maps to null before it lands here. Required-with-null
   * (like `goal`/`reply_format`), so a boundary that forgets to map one fails the build rather than
   * silently dropping it from the prompt.
   */
  medical_limitations: string | null;
  food_allergies: string | null;
  product_limitations: string | null;
  /**
   * Card rendering: the user's RAW /settings choice; null = never picked (instance default
   * applies). Resolution to the effective value happens in bot.ts (`replyFormatFor`); the
   * settings machine demands the resolved form via its own `SettingsProfile` type.
   */
  reply_format: ReplyFormat | null;
}

/**
 * The profile columns the three food-specifics free-text fields write to. Single source for the
 * patch/param shapes in `settings.ts` and `db.ts`, so those cannot drift from each other (the SQL
 * column strings still can't be type-checked, but the TS surfaces are now tied).
 */
export type FoodTextField = "medical_limitations" | "food_allergies" | "product_limitations";

export interface MealItem {
  /** Display name, in the user's language. This is what renders on the meal card. */
  name: string;
  grams: number;
  /**
   * Canonical English name used to look this food up in a composition table (#8) — never
   * displayed. Optional because every meal stored before the field existed lacks it, and because
   * a model may omit it; empty or absent means "no lookup key", which the lookup layer reads as
   * "keep the model's own macros".
   */
  name_en?: string;
  /**
   * Per-item nutrition, as computed by the model (the prompt already asks for it; totals are the
   * sums across items). Optional and absent-not-zero for the same reason as `name_en`: meals
   * stored before these fields existed lack them, and a zero would read as a claim that the item
   * has no calories rather than as a missing measurement.
   *
   * `kcal_per_100g` is the item's density — what a substitution rescales by, and what makes
   * "materially different?" answerable without a composition-table lookup.
   */
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  kcal_per_100g?: number;
}

/** Per-dimension verdicts. Only dimensions relevant to the user's profile are set. */
export interface MealVerdicts {
  weight?: Verdict;
  ldl?: Verdict;
  kidneys?: Verdict;
}

/**
 * The verdict dimensions in render order — the single list both renderers iterate. `satisfies`
 * ties it to `MealVerdicts`, so a dimension added there without an entry here (or a stale entry
 * left behind) is a compile error rather than a row silently missing from every meal card.
 */
export const VERDICT_DIMENSIONS = ["weight", "ldl", "kidneys"] as const satisfies readonly (keyof MealVerdicts)[];
export type VerdictDimension = (typeof VERDICT_DIMENSIONS)[number];

/**
 * Optional context accompanying a photo, injected into the analysis prompt. Both fields
 * measurably reduce estimation error (caption = user-supplied ground truth; local time
 * lets the model infer the meal type). Absent for corrections — the image is already gone.
 */
export interface MealContext {
  caption?: string;
  /** HH:MM in the bot's timezone (Europe/Berlin), not UTC. */
  localTime?: string;
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
  /** The user's own photo/album message id — lets a reply to the photo find the meal. */
  user_message_id: number | null;
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
/** Compact per-meal summary fed to the free-text router as today-context. */
export interface MealSummary {
  items: MealItem[];
  kcal: number;
  protein_g: number;
}

/** Per-date kcal/protein sums — the router's week-context row and totalsByDate's return shape. */
export interface DayTotals {
  date: string;
  kcal: number;
  protein_g: number;
}

export interface FoodTargets {
  kcal: number;
  protein_g: number;
  satfat_g?: number; // present when the user declared an ldl restriction
  sodium_mg?: number; // present when the user declared a kidneys restriction
}
