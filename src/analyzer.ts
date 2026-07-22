// The analyzer owns the prompt AND the zod-validated parse (spec §18). The provider is thin
// transport. A generic, profile-personalized prompt goes in; a validated MealAnalysis comes out.
// Invalid output throws — the caller shows `errors.analyzeFailed` and writes NO row (never poisons
// daily totals with partial/garbage macros).

import { z } from "zod";
import type { ChatRequest, LLMProvider } from "./llm/provider.ts";
import { LOCALES } from "./i18n/registry.ts";
import { RESTRICTION_TAGS, isRestrictionTag } from "./targets.ts";
import type { MealAnalysis, MealContext, Profile } from "./types.ts";

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
function buildUserText(profile: Profile, context?: MealContext): string {
  const lines: string[] = [];
  lines.push(`User ${goalLine(profile.goal)}.`);
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
  // The only user-visible text the model produces. Without this the output language is
  // unspecified, and food names would land in a reply whose chrome is in another language.
  lines.push(
    `Write items[].name and notes in ${LOCALES[profile.lang].llmName}. ` +
      "All numeric fields stay numeric — never spell a number out as words.",
  );
  lines.push("Return JSON only.");
  return lines.join("\n");
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
  bytes: Uint8Array,
  profile: Profile,
  provider: LLMProvider,
  context?: MealContext,
): Promise<MealAnalysis> {
  const req: ChatRequest = {
    system: SYSTEM,
    userText: buildUserText(profile, context),
    imageB64: toBase64(bytes),
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

/**
 * Correction path: a text reply corrects a prior estimate. The image is already gone (ephemeral),
 * so we re-estimate from the prior analysis + the user's correction. Same schema/validation.
 */
export async function analyzeCorrection(
  prior: MealAnalysis,
  correctionText: string,
  profile: Profile,
  provider: LLMProvider,
): Promise<MealAnalysis> {
  const priorSummary = JSON.stringify({
    items: prior.items,
    kcal: prior.kcal,
    protein_g: prior.protein_g,
    carbs_g: prior.carbs_g,
    fat_g: prior.fat_g,
  });
  const userText = [
    buildUserText(profile),
    "",
    "You previously produced this estimate for the meal:",
    priorSummary,
    "",
    `The user corrects it: "${correctionText}"`,
    "Apply the correction and return the full updated JSON object (same schema).",
  ].join("\n");

  const raw = await provider.chat({
    system: SYSTEM,
    userText,
    jsonSchema: MEAL_JSON_SCHEMA,
    temperature: TEMPERATURE,
  });
  return parseAnalysis(raw);
}
