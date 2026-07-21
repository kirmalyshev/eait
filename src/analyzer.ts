// The analyzer owns the prompt AND the zod-validated parse (spec §18). The provider is thin
// transport. A generic, profile-personalized prompt goes in; a validated MealAnalysis comes out.
// Invalid output throws — the caller shows "не смог разобрать" and writes NO row (never poisons
// daily totals with partial/garbage macros).

import { z } from "zod";
import type { ChatRequest, LLMProvider } from "./llm/provider.ts";
import type { MealAnalysis, Profile } from "./types.ts";

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
  confidence: z.string().default("unknown"),
  notes: z.string().default(""),
});

// JSON-schema hint for the provider's structured-output request. Hand-written (not derived) so
// coerce/default quirks never leak into the wire schema; it is only a hint, the zod parse is truth.
const MEAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["isFood"],
  properties: {
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
    confidence: { type: "string" },
    notes: { type: "string" },
  },
} as const;

const SYSTEM =
  "You are a careful nutrition estimator for a personal food-photo diary. Estimate the meal's " +
  "items and macros from the photo. Respond with ONLY a single JSON object matching the schema — " +
  "no prose, no markdown fences. If the photo is not food, set isFood=false. Estimates are best-effort.";

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
function buildUserText(profile: Profile): string {
  const lines: string[] = [];
  lines.push(`User ${goalLine(profile.goal)}.`);
  lines.push("Estimate items[{name,grams}], kcal, protein_g, carbs_g, fat_g, satfat_g, fiber_g, sugar_g, sodium_mg, plant_protein_pct.");
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
): Promise<MealAnalysis> {
  const req: ChatRequest = {
    system: SYSTEM,
    userText: buildUserText(profile),
    imageB64: toBase64(bytes),
    imageMime: "image/jpeg",
    jsonSchema: MEAL_JSON_SCHEMA,
  };
  const raw = await provider.chat(req);
  return parseAnalysis(raw);
}

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

  const raw = await provider.chat({ system: SYSTEM, userText, jsonSchema: MEAL_JSON_SCHEMA });
  return parseAnalysis(raw);
}
