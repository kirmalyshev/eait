// Shared domain types. Defined once here, consumed unchanged by the backend and the app.
//
// Ported from `eait/src/types.ts` — the Telegram bot this app is the second product surface of.
// Where a type is identical it is identical on purpose: the two products analyze the same photos
// with the same prompt, and a divergence in these shapes is a divergence in the product. Where it
// differs (`Profile` gains the anthropometrics a computed calorie target needs) the difference is
// commented. See `docs/PORTED_FROM_EAIT.md`.

export type Goal = "lose" | "maintain" | "gain";
export type Verdict = "good" | "warn" | "bad";

/** Biological sex. Required by every published BMR equation; asked for that reason and no other. */
export type Sex = "female" | "male";

/**
 * Activity multipliers applied to BMR. Standard Harris-Benedict/Mifflin bands.
 *
 * Deliberately five coarse buckets rather than a step-count integration: a wrong multiplier moves
 * the target by hundreds of kcal, and a user who self-reports "moderate" is giving a better
 * estimate than a phone that counted the steps of one pocket.
 */
export const ACTIVITY_LEVELS = ["sedentary", "light", "moderate", "active", "athlete"] as const;
export type ActivityLevel = (typeof ACTIVITY_LEVELS)[number];

/** How fast the user wants to move. Bounded — see `targets.ts`; this is where safety is decided. */
export const PACES = ["easy", "steady", "push"] as const;
export type Pace = (typeof PACES)[number];

export const LANGS = ["en", "ru", "de"] as const;
export type Lang = (typeof LANGS)[number];

/**
 * A user's profile — the analysis inputs every meal is judged against.
 *
 * DIFFERS FROM eait: `sex`, `birth_year`, `height_cm`, `activity` and `pace` are new. eait bands
 * calories by goal alone (1800/2100/2400 flat) and says in a comment that a bodyweight-delta
 * formula is out of scope for a photo logger. For an App Store product that is too blunt — the
 * category's users expect a personal number — so ieat computes one. That is the whole reason
 * `targets.ts` carries a floor: computing a target is what creates the risk of computing an
 * unsafe one.
 */
export interface Profile {
  user_id: string;
  lang: Lang;
  goal: Goal | null;
  sex: Sex | null;
  /** Year of birth, not age: an age stored as a number is wrong within twelve months. */
  birth_year: number | null;
  height_cm: number | null;
  /** Kilograms; null = unknown (never asked, or declined). */
  weight_kg: number | null;
  target_weight_kg: number | null;
  activity: ActivityLevel | null;
  pace: Pace | null;
  /** Purchase/food country: a curated code (`de`/`us`/…) or a raw string; null = unknown. */
  country: string | null;
  /** CLOSED four-tag vocabulary — see `RESTRICTION_TAGS`. Each drives a cap AND a verdict key. */
  restrictions: string[];
  /**
   * Free-text "food specifics", prompt-only — everything the closed vocabulary cannot express.
   * Three labelled fields: medical conditions, allergies (safety-critical), avoided products.
   * None drives a numeric cap or a verdict dimension. Required-with-null, so a boundary that
   * forgets to map one fails the build rather than silently dropping it from the prompt.
   */
  medical_limitations: string | null;
  food_allergies: string | null;
  product_limitations: string | null;
  /** Set once the user has cleared onboarding and consented. Nothing is analyzed before this. */
  onboarded_at: string | null;
}

export type FoodTextField = "medical_limitations" | "food_allergies" | "product_limitations";

export interface MealItem {
  /** Display name, in the user's language. This is what renders on the meal card. */
  name: string;
  grams: number;
  /** Canonical English lookup key for a composition table — never displayed. */
  name_en?: string;
  kcal?: number;
  protein_g?: number;
  carbs_g?: number;
  fat_g?: number;
  /** The item's density — what a substitution rescales by when the user edits grams. */
  kcal_per_100g?: number;
}

/** Per-dimension verdicts. Only dimensions relevant to the user's profile are ever set. */
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

/** Optional context accompanying a photo. Both fields measurably reduce estimation error. */
export interface MealContext {
  caption?: string;
  /** HH:MM in the user's timezone — lets the model infer the meal type. */
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
  verdicts: MealVerdicts;
  /** `low` | `medium` | `high` — drives the correction nudge, so it is read, not just shown. */
  confidence: string;
  notes: string;
}

/** A persisted meal row. */
export interface MealRecord extends MealAnalysis {
  id: string; // UUID — never a timestamp
  user_id: string;
  ts: string; // ISO
  date: string; // YYYY-MM-DD in the user's timezone
  /** True once the user has corrected it — the signal the correction loop is measured by. */
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

/** Per-date sums — the week view's row shape. */
export interface DayTotals {
  date: string;
  kcal: number;
  protein_g: number;
}

/** The user's daily targets. Caps are present ONLY for restrictions the user declared. */
export interface FoodTargets {
  kcal: number;
  protein_g: number;
  satfat_g?: number; // present when the user declared an ldl restriction
  sodium_mg?: number; // present when the user declared a kidneys restriction
}
