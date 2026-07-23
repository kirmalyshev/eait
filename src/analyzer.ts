// The analyzer owns the prompt AND the zod-validated parse (spec §18). The provider is thin
// transport. A generic, profile-personalized prompt goes in; a validated MealAnalysis comes out.
// Invalid output throws — the caller shows `errors.analyzeFailed` and writes NO row (never poisons
// daily totals with partial/garbage macros).

import { z } from "zod";
import type { ChatRequest, LLMProvider } from "./llm/provider.ts";
import { LOCALES } from "./i18n/registry.ts";
import { RESTRICTION_TAGS, isRestrictionTag } from "./targets.ts";
import { countryForPrompt } from "./country.ts";
import { parseLimitations } from "./limitations.ts";
import type { DayTotals, FoodTargets, MealAnalysis, MealContext, MealSummary, Profile } from "./types.ts";

const VerdictSchema = z.enum(["good", "warn", "bad"]);

export const MealAnalysisSchema = z.object({
  isFood: z.boolean(),
  items: z
    .array(
      z.object({
        name: z.string().default("item"),
        grams: z.coerce.number().default(0),
      }),
    )
    .default([]),
  kcal: z.coerce.number().default(0),
  protein_g: z.coerce.number().default(0),
  carbs_g: z.coerce.number().default(0),
  fat_g: z.coerce.number().default(0),
  satfat_g: z.coerce.number().default(0),
  fiber_g: z.coerce.number().default(0),
  sugar_g: z.coerce.number().default(0),
  sodium_mg: z.coerce.number().default(0),
  plant_protein_pct: z.coerce.number().default(0),
  verdicts: z
    .object({
      weight: VerdictSchema.optional(),
      ldl: VerdictSchema.optional(),
      kidneys: VerdictSchema.optional(),
    })
    .default({}),
  // Normalized at parse (the wire enum is advisory under strict:false, so " Low "/"Medium" do
  // arrive) — the bot and the stored row always see canonical casing. "unknown" is the
  // absent-field sentinel, deliberately outside the high/medium/low prompt vocabulary; it
  // routes to the generic correction hint downstream.
  confidence: z
    .string()
    .default("unknown")
    .transform((s) => s.trim().toLowerCase()),
  notes: z.string().default(""),
});

// JSON-schema hint for the provider's structured-output request. Hand-written (not derived) so
// coerce/default quirks never leak into the wire schema; it is only a hint, the zod parse is truth.
const MEAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["isFood"],
  properties: {
    // First on purpose: the model fills fields in schema order, so the volumetric reasoning
    // happens BEFORE any number is committed. Scratch space only — zod strips it on parse.
    reasoning: { type: "string" },
    isFood: { type: "boolean" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" }, grams: { type: "number" } },
      },
    },
    kcal: { type: "number" },
    protein_g: { type: "number" },
    carbs_g: { type: "number" },
    fat_g: { type: "number" },
    satfat_g: { type: "number" },
    fiber_g: { type: "number" },
    sugar_g: { type: "number" },
    sodium_mg: { type: "number" },
    plant_protein_pct: { type: "number" },
    verdicts: {
      type: "object",
      properties: {
        weight: { type: "string", enum: ["good", "warn", "bad"] },
        ldl: { type: "string", enum: ["good", "warn", "bad"] },
        kidneys: { type: "string", enum: ["good", "warn", "bad"] },
      },
    },
    // Enum, not a bare string: the bot's low-confidence nudge matches "low" exactly, and a
    // free-string schema invites "low (mixed dish)". Zod still accepts any string (tolerance).
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    notes: { type: "string" },
  },
} as const;

const SYSTEM =
  "You are an expert nutritionist experienced in estimating meal composition and portion " +
  "weight from photos for a personal food diary. Estimate the meal's items and macros from " +
  "the photo, following the estimation protocol exactly and working through it in the " +
  "`reasoning` field BEFORE filling any numeric field. Respond with ONLY a single JSON " +
  "object matching the schema — no prose, no markdown fences. If the photo is not food, " +
  "set isFood=false.";

/** A caption is user text going into a prompt — cap it like the restriction input. */
const CAPTION_INPUT_CAP = 300;

// Low temperature = the cheap form of self-consistency: the same photo yields (nearly) the
// same estimate run to run, without paying for a 3-call median. Applies to every analyzer
// call — estimation and classification both want determinism, never creativity.
const TEMPERATURE = 0.2;

function goalLine(goal: Profile["goal"]): string {
  switch (goal) {
    case "lose":
      return "weight goal: lose weight (calorie deficit)";
    case "gain":
      return "weight goal: gain weight (calorie surplus)";
    case "maintain":
      return "weight goal: maintain weight";
    default:
      return "weight goal: maintain weight";
  }
}

/** Generic instruction, personalized per profile. Only declared restrictions get a verdict. */
function buildUserText(profile: Profile, context?: MealContext, multiPhoto?: boolean): string {
  const lines: string[] = [];
  lines.push(`User ${goalLine(profile.goal)}.`);
  // Target-weight framing: gives the model the magnitude behind the goal so the weight verdict is
  // judged against real progress, not just the lose/gain direction. Kcal targets are unchanged.
  if (profile.weight_kg && profile.target_weight_kg) {
    lines.push(
      `Current weight ${profile.weight_kg} kg, target ${profile.target_weight_kg} kg — judge verdicts.weight against progress toward that target.`,
    );
  }
  if (multiPhoto) {
    lines.push(
      "The user sent several photos of the SAME meal (e.g. the portion plus product packaging " +
        "or a nutrition label). Combine ALL photos into ONE analysis of one meal — never treat " +
        "them as separate meals. Use any packaging/label photo as ground truth for ingredients " +
        "and per-100g nutrition.",
    );
  }
  // Staged decomposition + volumetric reasoning: the measured levers against portion error,
  // which dominates calorie MAE (identification is the easy part).
  lines.push("Estimation protocol — work through it in `reasoning` before any number:");
  lines.push("1. Identify every food item and its cooking method (fried/boiled/baked); look for hidden calories — oil, butter, dressings, sauces, sugar in drinks.");
  lines.push("2. Estimate each portion's volume using visible scale references (plate ~26cm, cutlery, glass, hands), then convert volume to grams per item.");
  lines.push("3. Compute kcal and macros per item from grams + cooking method; totals are the sums across items.");
  lines.push("Mixed and layered dishes are systematically underestimated — when torn between two portion sizes, take the larger.");
  // A regional prior steers identification away from generic international staples. Hedged on
  // purpose: the interface language suggests a cuisine, the photo always wins.
  // "Actual evidence", not "the photo": the correction path reuses this text with no image
  // attached (ephemeral), where the evidence is the prior estimate + the user's description.
  const cuisine = LOCALES[profile.lang].cuisineHint;
  if (cuisine) {
    lines.push(
      `The user's interface language suggests ${cuisine} is likely — weigh regional dishes when identifying items, but always trust the actual evidence (the photo or the user's description) over this prior.`,
    );
  }
  // Purchase country steers identification toward local product names, packaging sizes, and
  // portion norms — complementary to the language-derived cuisine prior, and hedged the same way.
  const country = countryForPrompt(profile.country);
  if (country) {
    // Quoted + single-line (parseCountry collapses whitespace) so a free-text "Other" country
    // can't break out of the sentence and steer the analysis — same containment as the caption.
    lines.push(
      `The user buys most of their food in "${country}" — prefer local product names, packaging sizes, and typical portion norms there, but always trust the actual evidence over this prior.`,
    );
  }
  lines.push("Estimate items[{name,grams}], kcal, protein_g, carbs_g, fat_g, satfat_g, fiber_g, sugar_g, sodium_mg, plant_protein_pct.");
  lines.push('Set confidence to exactly one of "high", "medium", "low" — "low" when the dish is mixed, ingredients may be hidden, or no scale reference is visible; state why in notes.');
  if (context?.caption) {
    lines.push(`The user captioned the photo: "${context.caption.slice(0, CAPTION_INPUT_CAP)}" — treat it as ground truth about the contents.`);
  }
  if (context?.localTime) {
    lines.push(`Local time of the meal: ${context.localTime} — consider which meal of the day this typically is.`);
  }
  lines.push("Always set verdicts.weight (good/warn/bad) relative to the weight goal above.");
  if (profile.restrictions.includes("kidneys")) {
    lines.push("This user has a KIDNEYS restriction: judge sodium and animal protein; set verdicts.kidneys.");
  }
  if (profile.restrictions.includes("ldl")) {
    lines.push("This user has an LDL/cholesterol restriction: judge saturated fat; set verdicts.ldl.");
  }
  const declared = profile.restrictions.length ? profile.restrictions.join(", ") : "none";
  lines.push(`Declared restrictions: ${declared}.`);
  lines.push("Do NOT set verdicts for dimensions the user did not declare (weight always applies).");
  // Free-text "food specifics": everything the four-tag vocabulary cannot express, on three
  // labelled lines. Placed AFTER the verdict contract so it stays contiguous, and worded to land
  // in `notes` plus the EXISTING verdicts — `verdicts` is a fixed weight/ldl/kidneys object, and
  // inviting a fourth key would only produce output zod strips.
  //
  // `parseLimitations` already made each stored value single-line, quote-free and bounded, but a
  // hand-edited row never passed through it — so `containLimitations` re-runs the SAME parser here
  // as a floor. (The caption and free-text-message priors below do NOT contain their inputs — a
  // persisted field that reaches every future call warrants the stricter treatment.)
  const medical = containLimitations(profile.medical_limitations);
  if (medical) {
    lines.push(
      `The user's declared medical conditions / dietary needs: "${medical}" — weigh these in your verdicts and notes.`,
    );
  }
  const allergies = containLimitations(profile.food_allergies);
  if (allergies) {
    lines.push(
      `The user has FOOD ALLERGIES: "${allergies}" — if the meal may contain any of these, flag it prominently in notes; never downplay an allergen.`,
    );
  }
  const products = containLimitations(profile.product_limitations);
  if (products) {
    lines.push(
      `Products the user avoids: "${products}" — call it out in notes if the meal includes one.`,
    );
  }
  // The only user-visible text the model produces. Without this the output language is
  // unspecified, and food names would land in a reply whose chrome is in another language.
  lines.push(
    `Write items[].name and notes in ${LOCALES[profile.lang].llmName}. ` +
      "All numeric fields stay numeric — never spell a number out as words.",
  );
  lines.push("Return JSON only.");
  return lines.join("\n");
}

/**
 * Re-applies `parseLimitations`' containment at the injection site, for values that never went
 * through it (a hand-edited row, a future writer that forgets). Returns null for anything empty,
 * which is also how the '' skip sentinel produces no line at all.
 */
function containLimitations(raw: string | null): string | null {
  return raw ? parseLimitations(raw) : null;
}

function toBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

/** Try strict JSON, then fence-stripping, then the outermost {...}. Throws if none parse. */
function tolerantJson(raw: string): unknown {
  const attempts: string[] = [];
  attempts.push(raw);
  const noFence = raw
    .trim()
    .replace(/^```(?:json)?/i, "")
    .replace(/```$/i, "")
    .trim();
  attempts.push(noFence);
  const first = noFence.indexOf("{");
  const last = noFence.lastIndexOf("}");
  if (first !== -1 && last > first) attempts.push(noFence.slice(first, last + 1));

  for (const candidate of attempts) {
    try {
      return JSON.parse(candidate);
    } catch {
      // try the next strategy
    }
  }
  throw new Error("analyzer: model output was not parseable JSON");
}

function parseAnalysis(raw: string): MealAnalysis {
  const obj = tolerantJson(raw);
  const result = MealAnalysisSchema.safeParse(obj);
  if (!result.success) {
    throw new Error(`analyzer: MealAnalysis validation failed: ${result.error.message}`);
  }
  return result.data;
}

export async function analyzeMeal(
  images: Uint8Array[],
  profile: Profile,
  provider: LLMProvider,
  context?: MealContext,
): Promise<MealAnalysis> {
  const req: ChatRequest = {
    system: SYSTEM,
    userText: buildUserText(profile, context, images.length > 1),
    imagesB64: images.map(toBase64),
    imageMime: "image/jpeg",
    jsonSchema: MEAL_JSON_SCHEMA,
    temperature: TEMPERATURE,
  };
  const raw = await provider.chat(req);
  return parseAnalysis(raw);
}

// ---------- restriction classification (the keyword pass's fallback) ----------

/** Free-text restrictions are short; anything past this is noise or an injection attempt. */
const RESTRICTION_INPUT_CAP = 200;

const RestrictionsSchema = z.object({
  tags: z.array(z.string()).default([]),
});

/**
 * Free text -> restriction tags, for input the keyword pass in `targets.ts` could not match
 * (typically because it is in a language nobody wrote keywords for).
 *
 * NEVER throws: a failure here must not block onboarding, so every error path yields `[]` and
 * the user simply keeps the keyword result. Called at most once per user.
 */
export async function classifyRestrictions(
  text: string,
  provider: LLMProvider,
  lang: Profile["lang"],
): Promise<string[]> {
  const vocabulary = RESTRICTION_TAGS.join(", ");
  const userText = [
    "Classify a user's free-text dietary/health restrictions into tags.",
    `Allowed tags (use NOTHING else): ${vocabulary}.`,
    // A hint, not an assertion — a user may well write in a language other than their interface.
    `The text may be in ${LOCALES[lang].llmName}, but could be in any language.`,
    'Respond with ONLY {"tags": [...]}. Use an empty array if nothing matches.',
    "",
    `Text: ${text.slice(0, RESTRICTION_INPUT_CAP)}`,
  ].join("\n");

  try {
    const raw = await provider.chat({ system: SYSTEM_CLASSIFY, userText, temperature: TEMPERATURE });
    const parsed = RestrictionsSchema.safeParse(tolerantJson(raw));
    // Never-throwing is deliberate (see the docstring), but staying silent is not: this path
    // only runs when the keyword pass already matched nothing, so the user ends up with no
    // restrictions at all — no kidney verdict, no sodium cap — and nothing says why.
    if (!parsed.success) {
      console.error("[eait] restriction classification returned an unusable shape");
      return [];
    }
    // Validate against the vocabulary the rest of the app can actually act on.
    return parsed.data.tags.filter(isRestrictionTag);
  } catch (e) {
    console.error(`[eait] restriction classification failed: ${(e as any)?.message}`);
    return [];
  }
}

const SYSTEM_CLASSIFY =
  "You map free-text dietary and health restrictions onto a fixed tag vocabulary. " +
  "Respond with ONLY a single JSON object — no prose, no markdown fences.";

// ---------- free-text router (one call: question / meal / correction) ----------
// A single router — rather than a dedicated correction call — also lets a question about a
// meal be answered rather than misapplied as a correction.

/** Free text is longer than a caption but still bounded — past this is noise or injection. */
const TEXT_INPUT_CAP = 1000;

export interface RouteContext {
  /** Set when the text replies to a known meal — unlocks the correction intent. */
  focusMeal?: MealAnalysis;
  todayMeals: MealSummary[];
  weekTotals: DayTotals[];
  targets: FoodTargets;
  localTime?: string;
}

export type RouteResult =
  | { intent: "question"; answer: string }
  | { intent: "meal"; analysis: MealAnalysis; dayOffset: number }
  | { intent: "correction"; analysis: MealAnalysis }
  // Move an existing (focus) meal to a different day; carries no analysis — macros are unchanged.
  | { intent: "redate"; dayOffset: number };

/** Oldest day back a text meal can be dated to (offset 0 = today … 7 = a week ago) — mirrors the
 * 7-day week context (weekStart = today − 7d), so offset 7 lands on the oldest day the router sees. */
export const MAX_DAY_OFFSET = 7;

/**
 * Normalize the model's `dayOffset` (whole days before today the meal was eaten) into `[0, 7]`.
 * Total and pure: a future date, junk, or a non-number all mean "today" (0); older than the
 * window clamps to the edge (7); fractions truncate to whole days. Never trusts the raw value.
 */
export function clampDayOffset(n: unknown): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return 0;
  const whole = Math.trunc(n);
  if (whole < 0) return 0;
  if (whole > MAX_DAY_OFFSET) return MAX_DAY_OFFSET;
  return whole;
}

const ROUTE_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["intent"],
  properties: {
    // Same trick as the meal schema: reasoning first, so intent and numbers come after thought.
    reasoning: { type: "string" },
    intent: { type: "string", enum: ["question", "meal", "correction", "redate"] },
    answer: { type: "string" },
    analysis: MEAL_JSON_SCHEMA,
    // Whole days before today to file under (0 today, 1 yesterday). Meal AND redate intents.
    dayOffset: { type: "integer", minimum: 0, maximum: MAX_DAY_OFFSET },
  },
} as const;

const SYSTEM_ROUTE =
  "You are the assistant behind a personal food-diary bot. The user sent a free-text message. " +
  "Decide the intent and respond with ONLY one JSON object, no prose, no markdown fences: " +
  '{"intent":"question","answer":"..."} for questions or chat — answer helpfully and concisely ' +
  "from the provided diary context; " +
  '{"intent":"meal","analysis":{...},"dayOffset":N} ONLY when the text describes food the user ' +
  "actually ate (estimate the full analysis object from the description, following the estimation " +
  "protocol). Set dayOffset to the whole number of days before today the food was eaten — 0 for " +
  `today (the default), 1 for yesterday, up to ${MAX_DAY_OFFSET}; a relative phrase like "yesterday" ` +
  'or "2 days ago" sets it, otherwise use 0; ' +
  '{"intent":"correction","analysis":{...}} ONLY when a focus meal is provided and the text ' +
  "corrects that meal's estimate (return the full updated analysis object); " +
  '{"intent":"redate","dayOffset":N} ONLY when a focus meal is provided and the text asks to MOVE ' +
  "that meal to a different day (e.g. \"move this to yesterday\", \"this was 2 days ago\") without " +
  "changing what was eaten — dayOffset is the whole number of days before today to file it under " +
  `(0 today, 1 yesterday, up to ${MAX_DAY_OFFSET}).`;

const RouteSchema = z.object({
  intent: z.enum(["question", "meal", "correction", "redate"]),
  answer: z.string().optional(),
  analysis: MealAnalysisSchema.optional(),
  // `unknown`, not `z.number()`: clampDayOffset is the normalizer and tolerates any junk (null,
  // "1", 99, 2.5) — a strict number type here would REJECT the whole object on a stringy/null
  // offset (models commonly emit null for same-day), discarding a valid meal analysis OR a valid
  // redate move. Clamp + warn instead. Shared by the meal and redate intents.
  dayOffset: z.unknown().optional(),
});

export async function routeText(
  text: string,
  profile: Profile,
  ctx: RouteContext,
  provider: LLMProvider,
): Promise<RouteResult> {
  const lines: string[] = [];
  lines.push(buildUserText(profile)); // goal, estimation protocol, cuisine prior, output language
  lines.push("");
  lines.push("Diary context (JSON):");
  lines.push(
    JSON.stringify({
      todayMeals: ctx.todayMeals,
      weekTotals: ctx.weekTotals,
      targets: ctx.targets,
      localTime: ctx.localTime,
    }),
  );
  if (ctx.focusMeal) {
    lines.push("The message replies to this specific meal (the focus meal):");
    lines.push(
      JSON.stringify({
        items: ctx.focusMeal.items,
        kcal: ctx.focusMeal.kcal,
        protein_g: ctx.focusMeal.protein_g,
        carbs_g: ctx.focusMeal.carbs_g,
        fat_g: ctx.focusMeal.fat_g,
        notes: ctx.focusMeal.notes,
      }),
    );
  } else {
    lines.push("There is no focus meal — the correction and redate intents are NOT available.");
  }
  lines.push(`Write the answer in ${LOCALES[profile.lang].llmName}.`);
  lines.push("");
  lines.push(`User message: "${text.slice(0, TEXT_INPUT_CAP)}"`);

  const raw = await provider.chat({
    system: SYSTEM_ROUTE,
    userText: lines.join("\n"),
    jsonSchema: ROUTE_JSON_SCHEMA,
    temperature: TEMPERATURE,
  });
  const parsed = RouteSchema.safeParse(tolerantJson(raw));
  if (!parsed.success) {
    throw new Error(`analyzer: route validation failed: ${parsed.error.message}`);
  }
  const r = parsed.data;
  if (r.intent === "question") {
    if (!r.answer?.trim()) throw new Error("analyzer: question intent without answer");
    return { intent: "question", answer: r.answer.trim() };
  }
  // Correction and redate both require a focus meal (the model was told they're unavailable
  // otherwise). Salvage an answer if the model provided one; else make the drift loud.
  if ((r.intent === "correction" || r.intent === "redate") && !ctx.focusMeal) {
    if (r.answer?.trim()) {
      console.warn(`[eait] router: ${r.intent} intent without focus meal, salvaged as question`);
      return { intent: "question", answer: r.answer.trim() };
    }
    throw new Error(`analyzer: ${r.intent} intent without focus meal`);
  }
  // Redate moves the focus meal to another day — no analysis, macros unchanged; only the offset.
  if (r.intent === "redate") {
    const dayOffset = clampDayOffset(r.dayOffset);
    // A redate with NO target ("move this back") would silently file the meal under today — a
    // no-op if it's already today, an unintended move otherwise. Warn so the operator sees the
    // model under-specifying moves; the confirm-first card still names the resolved day to the user.
    if (r.dayOffset === undefined) {
      console.warn(`[eait] router: redate without a dayOffset user-focus present → defaulting to today (0)`);
    } else if (r.dayOffset !== dayOffset) {
      console.warn(`[eait] router: redate dayOffset ${JSON.stringify(r.dayOffset)} out of contract → ${dayOffset}`);
    }
    return { intent: "redate", dayOffset };
  }
  if (!r.analysis) throw new Error(`analyzer: ${r.intent} intent without analysis`);
  // Both meal-producing intents must describe food — a "correction" to not-food would still
  // render a meal card and land in daily totals.
  if (!r.analysis.isFood) {
    throw new Error(`analyzer: ${r.intent} intent with isFood=false`);
  }
  // Only a NEW meal carries a relative date; a correction keeps its focus meal's date.
  if (r.intent === "meal") {
    const dayOffset = clampDayOffset(r.dayOffset);
    // Surface model drift the way confidence/restriction-salvage do: a value the schema should
    // have bounded arriving out of contract (future, >7, fractional, wrong type) means the model
    // is off-spec — the clamp keeps us safe, the warn keeps the operator informed.
    if (r.dayOffset !== undefined && r.dayOffset !== dayOffset) {
      console.warn(`[eait] router: dayOffset ${JSON.stringify(r.dayOffset)} out of contract → ${dayOffset}`);
    }
    return { intent: "meal", analysis: r.analysis, dayOffset };
  }
  if (r.intent === "correction") {
    return { intent: "correction", analysis: r.analysis };
  }
  // Exhaustiveness: with `intent` narrowed to a 5-value enum minus the four handled above, this
  // is `never`. A future intent added to the enum without a branch here becomes a compile error
  // rather than being silently mislabeled by a fallthrough.
  return assertNever(r.intent);
}

/** Compile-time exhaustiveness guard: reaching this at runtime means an enum grew without a branch. */
function assertNever(x: never): never {
  throw new Error(`analyzer: unhandled route intent ${JSON.stringify(x)}`);
}

