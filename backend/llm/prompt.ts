// The prompts and the schemas the model's output must satisfy. Authored ONCE, here.
//
// No prompt string is written anywhere else. If a second engine is ever added (eait keeps a
// dev-only one purely so its eval harness has something to measure against), it imports these
// verbatim — otherwise no evaluation can tell a transport regression from an accuracy one, because
// both move the same numbers.
//
// NOTE WHAT THE MODEL IS NOT ASKED FOR: verdicts. eait asked the model to judge, then had to build
// a runtime gate because the model returned cholesterol judgements for users who had never
// mentioned cholesterol. Here verdicts are computed from the user's caps (`verdictsFromTargets`),
// so the model cannot author a medical claim at all. This app makes editing the answer a headline
// feature, and a model-authored verdict describes numbers that stop existing the moment the user
// edits them.

import { z } from "zod";
import type { FoodTargets, Profile } from "@ieat/shared";
import { RESTRICTION_TAGS } from "@ieat/shared";

// ── Containment ──────────────────────────────────────────────────────────────────────────────

/**
 * A containment boundary, not just a tidier.
 *
 * Every free-text profile field is interpolated INSIDE a quoted span in the prompt and rendered
 * into meal cards. It must therefore stay single-line, quote-free, and free of control, invisible,
 * bidi and lone-surrogate characters. ZWJ/ZWNJ are deliberately preserved — they are load-bearing
 * in real words and in emoji sequences.
 *
 * Re-applied at the prompt sink as well as at write time, because a row edited by hand, or written
 * before this function existed, never passed through it.
 */
export function normalizePromptText(raw: string, maxLen = 300): string {
  return raw
    .replace(/[\r\n\t]+/g, " ")
    // C0 and C1 controls.
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, "")
    // Invisible formatting and bidi overrides - U+200B..U+200F, U+202A..U+202E, U+2066..U+2069,
    // U+FEFF - EXCEPT ZWNJ (U+200C) and ZWJ (U+200D), which are load-bearing in real words and in
    // emoji sequences. Written as escapes on purpose: a literal invisible character in source is
    // unreviewable, and this is a security boundary.
    .replace(/[\u200B\u200E\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, "")
    // Lone surrogates. Half a pair reaches JSON.stringify as an invalid escape.
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, "")
    .replaceAll('"', "'")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLen);
}

// ── Schemas ──────────────────────────────────────────────────────────────────────────────────

export const MealItemSchema = z.object({
  name: z.string().min(1),
  grams: z.number().nonnegative(),
  name_en: z.string().optional(),
  kcal: z.number().nonnegative().optional(),
  protein_g: z.number().nonnegative().optional(),
  carbs_g: z.number().nonnegative().optional(),
  fat_g: z.number().nonnegative().optional(),
  kcal_per_100g: z.number().nonnegative().optional(),
});

export const MealAnalysisSchema = z.object({
  isFood: z.boolean(),
  items: z.array(MealItemSchema),
  kcal: z.number().nonnegative(),
  protein_g: z.number().nonnegative(),
  carbs_g: z.number().nonnegative(),
  fat_g: z.number().nonnegative(),
  satfat_g: z.number().nonnegative(),
  fiber_g: z.number().nonnegative(),
  sugar_g: z.number().nonnegative(),
  sodium_mg: z.number().nonnegative(),
  confidence: z.enum(["low", "medium", "high"]),
  notes: z.string(),
});

export const RouteSchema = z.object({
  intent: z.enum(["answer", "meal", "correction", "redate"]),
  text: z.string().optional(),
  analysis: MealAnalysisSchema.optional(),
  // Unknown, not a bounded number: models commonly emit `null` for "today", and a strict type
  // rejects the whole response over its date field. Bounded in `clampDayOffset` instead.
  dayOffset: z.unknown().optional(),
});

export const ClassifySchema = z.object({ tags: z.array(z.string()) });

// ── Photo analysis ───────────────────────────────────────────────────────────────────────────

export const SYSTEM = `You estimate the nutritional content of a meal from photographs.

You are looking at ONE meal. Several images are different angles of that same meal, never separate meals.

Work in this order:
1. Identify every distinct food and drink you can see. Name each one in the user's language.
2. Estimate the cooked, edible weight of each in grams. Use the plate, cutlery, hands and containers in the frame for scale. State weights for what is actually visible — do not assume a standard portion when the photo shows otherwise.
3. Compute nutrition per item, then the totals as the sum across items. Include fats used in cooking that you can see evidence of (sheen, frying, dressing) even when no oil is visible as an item.
4. Give an honest confidence: "low" when the food is ambiguous, partly hidden, or the scale is unclear; "high" only when identification and portion are both plain.

Rules:
- If the image contains no food or drink, set isFood to false, return zero totals and an empty items array, and say what you saw in notes.
- Estimate. Do not refuse and do not ask questions — you will never get an answer, and a refusal reads to the user as a broken app.
- Weights are grams of the food as served. Liquids in grams too.
- name is what the user reads, and it MUST be written in the requested reply language — whatever country the user eats in, and whatever language the food's name comes from. A user reading English gets "Roast chicken", never "Gebratenes Hähnchen". name_en is a separate canonical English name used only for lookups and is never displayed.
- notes is at most two short sentences: what drove the estimate, or what you were unsure about. No preamble, no advice, no disclaimers.
- Never comment on the user's body, their weight, or whether they should be eating this.`;

/** The user-side text for a photo turn. The image parts are attached by the provider. */
export function buildUserText(profile: Profile, targets: FoodTargets, opts: {
  caption?: string;
  localTime?: string;
  repertoire?: readonly string[];
} = {}): string {
  const lines = [
    `Reply in this language: ${profile.lang}.`,
    `The user's daily targets: ${targets.kcal} kcal, ${targets.protein_g} g protein.`,
  ];
  if (opts.localTime) lines.push(`Local time when the photo was taken: ${opts.localTime}.`);
  if (opts.caption) lines.push(`The user says about this meal: "${normalizePromptText(opts.caption)}"`);

  // Each free-text field on its OWN labelled line. They are independent axes — a medical condition
  // is not an allergy is not a dislike — and merging them loses the distinction the user drew.
  if (profile.medical_limitations) {
    lines.push(`Medical conditions or needs: "${normalizePromptText(profile.medical_limitations)}"`);
  }
  if (profile.food_allergies) {
    lines.push(`Food allergies (safety-critical): "${normalizePromptText(profile.food_allergies)}"`);
  }
  if (profile.product_limitations) {
    lines.push(`Products the user avoids: "${normalizePromptText(profile.product_limitations)}"`);
  }
  if (profile.restrictions.length > 0) {
    lines.push(`Declared dietary restrictions: ${profile.restrictions.join(", ")}.`);
  }
  // Country is an identification aid with a measured payoff: the incumbent's recognition
  // complaints skew GB/AU ("wasn't even recognised" — Oatly, Marmite, M&S items), which is the
  // gap a non-US-first push attacks. See the App Store review brief §3.3.
  if (profile.country) {
    // The "not a language instruction" clause is not defensive padding — it is a measured fix.
    // Without it, `country: de` made the model return `Gebratenes Hähnchenfleisch` and
    // `Maiskolben` to a user whose profile said `lang: en`, on 2 of 8 photos in the first eval
    // run. A country is a hint about which foods are on the plate, and models read it as a hint
    // about which language to answer in.
    lines.push(
      `The user shops and eats in: ${profile.country}. Use this ONLY to judge which products, ` +
      `brands and portion conventions are likely on the plate. It is NOT a language instruction — ` +
      `write every name in ${profile.lang} regardless.`,
    );
  }
  if (opts.repertoire && opts.repertoire.length > 0) {
    // Identification prior only. Stated as such in the prompt because a model given a list of
    // frequent foods will otherwise start copying their numbers.
    lines.push(
      `Foods this user logs often, most frequent first: ${opts.repertoire.slice(0, 20).join(", ")}. ` +
      `Use this ONLY to help identify what you are looking at. Never let it change a number.`,
    );
  }
  return lines.join("\n");
}

// ── Free text routing ────────────────────────────────────────────────────────────────────────

export const SYSTEM_ROUTE = `You are the text side of a nutrition tracker. Decide what the user's message means, then answer in the matching shape.

intent = "meal"      the user is describing food they ate. Produce a full analysis, same rules as a photo. Set dayOffset to whole days back from today (0 = today, 1 = yesterday); use 0 unless they clearly said otherwise.
intent = "correction" the user is fixing the meal currently in focus ("half that", "no oil", "it was 200g not 400"). Produce the CORRECTED full analysis — every field, not just the changed one. Only available when a focus meal is given.
intent = "redate"     the user is only moving the focus meal to a different day, with no change to the food. Set dayOffset.
intent = "answer"     anything else — a question about their intake, their targets, or nutrition in general. Put the reply in text, in the user's language.

Rules:
- Prefer "answer" when the message is a question, even if it names food. "is pizza ok for me" is a question, not a meal.
- Prefer "meal" when it is a statement of what was eaten. "two eggs and toast" is a meal.
- For "answer": use the intake data given below. Be specific and short — a few sentences. Never invent numbers you were not given.
- Never comment on the user's body or whether they should be eating something, unless they asked.
- No medical advice. If asked something clinical, say plainly that this is an estimate tool and they should ask a doctor.`;

export function buildRouteText(input: {
  text: string;
  profile: Profile;
  targets: FoodTargets;
  todayMeals: { items: string[]; kcal: number; protein_g: number }[];
  week: { date: string; kcal: number; protein_g: number }[];
  focusMeal?: unknown;
}): string {
  const { profile, targets } = input;
  const lines = [
    `Reply in this language: ${profile.lang}.`,
    `Daily targets: ${targets.kcal} kcal, ${targets.protein_g} g protein.`,
  ];
  if (targets.satfat_g !== undefined) lines.push(`Saturated fat cap: ${targets.satfat_g} g.`);
  if (targets.sodium_mg !== undefined) lines.push(`Sodium cap: ${targets.sodium_mg} mg.`);

  lines.push(
    input.todayMeals.length > 0
      ? `Today so far:\n${input.todayMeals
          .map((m) => `- ${m.items.join(", ")} — ${Math.round(m.kcal)} kcal, ${Math.round(m.protein_g)} g protein`)
          .join("\n")}`
      : "Today so far: nothing logged.",
  );
  if (input.week.length > 0) {
    lines.push(
      `Last days:\n${input.week
        .map((d) => `- ${d.date}: ${Math.round(d.kcal)} kcal, ${Math.round(d.protein_g)} g protein`)
        .join("\n")}`,
    );
  }
  if (input.focusMeal) {
    lines.push(`The meal currently in focus (corrections apply to this):\n${JSON.stringify(input.focusMeal)}`);
  } else {
    lines.push(`No meal is in focus. "correction" and "redate" are not available this turn.`);
  }
  if (profile.medical_limitations) lines.push(`Medical conditions: "${normalizePromptText(profile.medical_limitations)}"`);
  if (profile.food_allergies) lines.push(`Allergies: "${normalizePromptText(profile.food_allergies)}"`);
  if (profile.product_limitations) lines.push(`Avoids: "${normalizePromptText(profile.product_limitations)}"`);

  lines.push(`The user's message: "${normalizePromptText(input.text, 1000)}"`);
  return lines.join("\n");
}

// ── Restriction classification ───────────────────────────────────────────────────────────────

export const SYSTEM_CLASSIFY = `The user described their dietary situation in their own words. Return the tags from this closed list that apply, and nothing else.

${RESTRICTION_TAGS.map((t) => `- ${t}`).join("\n")}

Return an empty array when none apply. Never invent a tag outside the list.`;

export function buildClassifyText(text: string): string {
  return `The user said: "${normalizePromptText(text, 500)}"`;
}
