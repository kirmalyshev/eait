// The ONE read boundary between a raw `UserRow` and the rest of the app. It both validates stored
// vocabulary and emits the operator warning, so it is intentionally not pure.
//
// It lives in the engine rather than in `tg_bot/` because every surface needs it: a mobile client
// reading a profile must get the same validated shape, and a second copy of these rules is a second
// place for "unknown locale" to be handled differently.

// From the REGISTRY, not `i18n/index.ts`. The registry is pure vocabulary — the locale list and a
// validator — while `index.ts` also constructs an i18next instance, and importing it would give the
// engine a transitive dependency on a translation runtime it must never touch. A user's language is
// profile DATA; rendering in it is the surface's job.
import { DEFAULT_LANG, isLang } from "../i18n/registry.ts";
import { isReplyFormat } from "../types.ts";
import type { UserRow } from "../db.ts";
import type { MealAnalysis, MealRecord, Profile } from "../types.ts";

/** Named `profileFromRow` here; `tg_bot/bot.ts` re-exports it as `profileOf` for its call sites. */
export function profileFromRow(u: UserRow): Profile {
  // Off-vocabulary stored values (a renamed locale/format, a hand-edited row) degrade to the
  // default, but LOUDLY — a silent reset after a rename would strand affected users with no
  // operator trace. No truthiness guard on lang: '' is exactly the hand-edited NOT-NULL row the
  // warn exists for. reply_format's null is the normal "never chose" state and stays quiet.
  if (!isLang(u.lang)) {
    console.warn(`[eait] unknown lang ${JSON.stringify(u.lang)} user=${u.telegram_id} — using default`);
  }
  if (u.reply_format !== null && !isReplyFormat(u.reply_format)) {
    console.warn(`[eait] unknown reply_format ${JSON.stringify(u.reply_format)} user=${u.telegram_id} — using instance default`);
  }
  return {
    telegram_id: u.telegram_id,
    // Validate against the registry rather than coercing: a stored value can predate a locale
    // being renamed or removed, and an unvalidated one would render raw keys at the user.
    lang: isLang(u.lang) ? u.lang : DEFAULT_LANG,
    goal: u.goal,
    // 0 is the db's "explicitly skipped" sentinel — outside the db/bot boundary it means unknown.
    weight_kg: u.weight_kg ? u.weight_kg : null,
    target_weight_kg: u.target_weight_kg ? u.target_weight_kg : null,
    // '' is the db's "explicitly skipped" sentinel — outside the boundary it means unknown.
    country: u.country ? u.country : null,
    restrictions: u.restrictions,
    // '' is the skip sentinel on each. No vocabulary to validate against, so no warn: any stored
    // string is a legitimate value.
    medical_limitations: u.medical_limitations ? u.medical_limitations : null,
    food_allergies: u.food_allergies ? u.food_allergies : null,
    product_limitations: u.product_limitations ? u.product_limitations : null,
    // Same validation rule as lang: junk means "never chose", so the instance default applies.
    reply_format: isReplyFormat(u.reply_format) ? u.reply_format : null,
  };
}

/**
 * A stored meal back into the analysis shape the router and the renderers speak.
 *
 * `isFood: true` unconditionally: a stored row IS a meal — nothing that failed the food check ever
 * reaches `meals`. Moved out of `tg_bot/` with `profileFromRow` for the same reason: every surface
 * that shows a logged meal needs it.
 */
export function mealRecordToAnalysis(m: MealRecord): MealAnalysis {
  return {
    isFood: true,
    items: m.items,
    kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g,
    satfat_g: m.satfat_g, fiber_g: m.fiber_g, sugar_g: m.sugar_g, sodium_mg: m.sodium_mg,
    plant_protein_pct: m.plant_protein_pct, verdicts: m.verdicts,
    confidence: m.confidence ?? "", notes: m.notes ?? "",
  };
}
