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

/**
 * Every language the server stores, the model answers in, and the picker offers.
 *
 * IN PICKER ORDER, and English first because it is the one `Localized<T>` requires. The rest are
 * the seven `#358` names, and the order is deliberate rather than alphabetical: it is the order
 * `LANG_LABEL` renders, and reordering it reorders a settings list somebody has learned.
 *
 * What the app can actually RENDER in is `LANGS_READY` (`lang.ts`), which is the smaller claim.
 */
export const LANGS = ["en", "fr", "de", "it", "es", "vi", "id", "ru"] as const;
export type Lang = (typeof LANGS)[number];

/**
 * A user's profile — the analysis inputs every meal is judged against.
 *
 * DIFFERS FROM eait: `sex`, `birth_year`, `height_cm`, `activity` and `pace` are new. eait bands
 * calories by goal alone (1800/2100/2400 flat) and says in a comment that a bodyweight-delta
 * formula is out of scope for a photo logger. For an App Store product that is too blunt — the
 * category's users expect a personal number — so eait computes one. That is the whole reason
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
  /**
   * ISO instant `weight_kg` was MEASURED — not when the row was written.
   *
   * Exists to settle a race with Apple Health. A manual edit stamps this `now()`; an imported
   * sample stamps it with the sample's own time; and an incoming value wins only if it is strictly
   * newer. Without it, a user types their weight and a sync firing two seconds later silently
   * reverts it to this morning's scale reading — or, just as wrong, a stale import overwrites a
   * correction the user made deliberately.
   *
   * Never set from `PatchProfileRequest`: the client does not get to assert when something was
   * weighed. The server stamps it on both paths.
   */
  weight_measured_at: string | null;
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

/**
 * One food on the plate.
 *
 * The optional fields are written `?: T | undefined` rather than `?: T` on purpose, despite
 * `exactOptionalPropertyTypes`. An item crosses two JSON boundaries — the analyzer's response and
 * this API's — and "absent" and "present but undefined" are the same value on the far side of both.
 * Claiming the stricter type is what forces a cast at the parser, and a cast at the parser is how a
 * missing field reached a phone once already. Every consumer here already tests `!== undefined`.
 */
export interface MealItem {
  /** Display name, in the user's language. This is what renders on the meal card. */
  name: string;
  grams: number;
  /** Canonical English key the repertoire and the portion priors group by — never displayed. */
  name_en?: string | undefined;
  kcal?: number | undefined;
  protein_g?: number | undefined;
  carbs_g?: number | undefined;
  fat_g?: number | undefined;
  /** The item's density — what a substitution rescales by when the user edits grams. */
  kcal_per_100g?: number | undefined;
  /**
   * Fat the dish was cooked or dressed with, listed as its own row rather than folded into another
   * item's numbers — so the user can see it, and take it off. Absent on plain food, and on every
   * row stored before this existed.
   */
  role?: "cooking-fat" | undefined;
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

const VERDICT_VALUES: readonly string[] = ["good", "warn", "bad"] satisfies readonly Verdict[];

/**
 * Which verdict dimensions a renderer should draw, given a value it does not control.
 *
 * Takes `unknown` on purpose. `verdicts` is the one field on a meal analysis that no analyzer
 * supplies and every store write recomputes, so it passes through more hands than anything else
 * here — and a renderer that indexed into it straight got `TypeError: Cannot convert undefined
 * value to object`, which in a Release build is a process abort rather than a bad row. The type
 * system now makes that specific bug impossible; this makes the whole CLASS of it cost a row
 * instead of the app.
 *
 * Unknown values are dropped rather than rendered. A server a version ahead can name a verdict this
 * binary has no label or colour for, and a blank pill in an unstyled colour is worse than no pill.
 */
export function renderableVerdicts(verdicts: unknown): VerdictDimension[] {
  if (typeof verdicts !== "object" || verdicts === null || Array.isArray(verdicts)) return [];
  const v = verdicts as Record<string, unknown>;
  return VERDICT_DIMENSIONS.filter((d) => typeof v[d] === "string" && VERDICT_VALUES.includes(v[d] as string));
}

/** Optional context accompanying a photo. Both fields measurably reduce estimation error. */
export interface MealContext {
  caption?: string;
  /** HH:MM in the user's timezone — lets the model infer the meal type. */
  localTime?: string;
}

/** The analyzer's validated output for one photo. No photo path — the bytes live in `meal_photos`, reached by meal id. */
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

/**
 * The one closed question the model may ask about an estimate, and the taps that answer it.
 *
 * Two to four options, because the answer is a chip and a chip row is what a phone can put under a
 * card. `text` is in the user's reply language, like every other sentence the model writes.
 */
export interface MealQuestion {
  text: string;
  options: string[];
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
  /**
   * The question still open on this meal, or null once it has been answered.
   *
   * On the ROW rather than on `MealAnalysis`, because it is not part of the meal: it describes what
   * would improve the estimate, and `toAnalysis` leaves it behind. One question per meal, asked
   * once — the correction that answers it clears this with the same write that changes the numbers.
   */
  question?: MealQuestion | null;
  /** How many photos are stored for it. Absent on rows from before photos existed, and in fixtures — read as 0. */
  photos?: number;
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
  /**
   * At least one meal in this day is a guess (#47), so every figure derived from these totals is
   * one — the day, what is left of it, and the 20:30 line. On the totals and not recomputed per
   * surface: only `sumTotals` produces a `DailyTotals`, so there is one place it can be wrong.
   */
  guessed: boolean;
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
