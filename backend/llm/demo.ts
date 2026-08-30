// A canned analyzer. Powers `--demo` and gives the engine tests something to bind to.
//
// It is deliberately NOT random: the same input produces the same numbers, so a screenshot taken
// today matches one taken next week and a failing test fails the same way twice. It also never
// pretends to be accurate — the notes say what it is, because a demo that looks like a real
// estimate is a demo someone eventually screenshots as evidence the product works.

import type { AnalyzedMeal, AnalyzePhoto, ClassifyRestrictions, LlmPorts, RouteText } from "./port.ts";
import { clampDayOffset } from "./port.ts";

/** Stable small integer from a string — the seed for every canned number below. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const PLATES = [
  { name: "Grilled chicken breast", name_en: "chicken breast", grams: 180, per100: 165, p: 31, c: 0, f: 3.6 },
  { name: "Basmati rice", name_en: "white rice, cooked", grams: 200, per100: 130, p: 2.7, c: 28, f: 0.3 },
  { name: "Mixed salad with olive oil", name_en: "green salad with dressing", grams: 120, per100: 90, p: 1.5, c: 4, f: 8 },
  { name: "Scrambled eggs", name_en: "scrambled eggs", grams: 150, per100: 149, p: 10, c: 1.6, f: 11 },
  { name: "Sourdough toast", name_en: "sourdough bread", grams: 70, per100: 260, p: 9, c: 48, f: 2 },
  { name: "Greek yoghurt", name_en: "greek yoghurt, plain", grams: 170, per100: 59, p: 10, c: 3.6, f: 0.4 },
];

function plateFor(seed: number): AnalyzedMeal {
  const count = 2 + (seed % 2);
  // The stride must not wrap onto itself within `count` steps: `i * 3` over six plates put i=0 and
  // i=2 on the same entry, so every three-item meal was [X, Y, X] — the duplicated row in every
  // screenshot this repo has ever taken. A test pins the distinctness rather than the stride.
  const items = Array.from({ length: count }, (_, i) => PLATES[(seed + i * 2) % PLATES.length]!);
  const scaled = items.map((it) => ({
    name: it.name,
    name_en: it.name_en,
    grams: it.grams,
    kcal: Math.round((it.per100 * it.grams) / 100),
    protein_g: Math.round((it.p * it.grams) / 100 * 10) / 10,
    carbs_g: Math.round((it.c * it.grams) / 100 * 10) / 10,
    fat_g: Math.round((it.f * it.grams) / 100 * 10) / 10,
    kcal_per_100g: it.per100,
  }));
  const sum = (k: "kcal" | "protein_g" | "carbs_g" | "fat_g") =>
    Math.round(scaled.reduce((n, it) => n + it[k], 0) * 10) / 10;

  const kcal = sum("kcal");
  return {
    isFood: true,
    items: scaled,
    kcal,
    protein_g: sum("protein_g"),
    carbs_g: sum("carbs_g"),
    fat_g: sum("fat_g"),
    satfat_g: Math.round(sum("fat_g") * 0.3 * 10) / 10,
    fiber_g: Math.round(kcal / 200),
    sugar_g: Math.round(sum("carbs_g") * 0.15 * 10) / 10,
    sodium_mg: 300 + (seed % 700),
    confidence: seed % 5 === 0 ? "low" : seed % 3 === 0 ? "medium" : "high",
    notes: "Demo analyzer — these numbers are canned, not an estimate of a real photograph.",
  };
}

/**
 * The caption that makes this analyzer say there is no food in the picture.
 *
 * `not-food` is a real branch on both sides and nothing could reach either of them. `logPhotoMeal`
 * returns `{ kind: "not-food" }` before it charges anything, and the camera draws a panel from it
 * ("No food in that one") — while this analyzer answered `isFood: true` to every image ever handed
 * to it, so the whole path was dead code to every test and every demo.
 *
 * KEYED ON THE CAPTION BECAUSE THE CAPTION IS ALL THERE IS. This analyzer cannot see the picture —
 * it seeds from the caption and two byte counts — so the caption is the only channel a test has for
 * saying "there is no food in this one", and `routeText` below already branches on what the user
 * wrote for the same reason. The real analyzer reaches the same verdict by looking, which is the
 * difference between a fake that is POORER than the real thing and one that behaves differently:
 * the refusal, the uncharged cap and the panel are all the production ones.
 */
export const DEMO_NOT_FOOD = "no food in this one";

/** Zero everything. What the real analyzer is told to return for an image with no food in it. */
function nothingOnThePlate(): AnalyzedMeal {
  return {
    isFood: false,
    items: [],
    kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0,
    satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0,
    confidence: "high",
    notes: "Demo analyzer — no food in this image.",
  };
}

export function demoPorts(): LlmPorts {
  const analyzePhoto: AnalyzePhoto = async (input) => {
    if ((input.caption ?? "").toLowerCase().includes(DEMO_NOT_FOOD)) return nothingOnThePlate();
    const seed = hash((input.caption ?? "") + input.images.length + (input.images[0]?.byteLength ?? 0));
    return plateFor(seed);
  };

  const routeText: RouteText = async (input) => {
    const text = input.text.toLowerCase();
    const asks = /\?|how much|how many|what|why|should i|сколько|что|wie viel|was /.test(text);

    if (input.focusMeal && /half|less|no |without|actually|instead|only|половин|без |wirklich/.test(text)) {
      const scale = /half|половин/.test(text) ? 0.5 : 0.8;
      // `verdicts` is dropped deliberately: a real analyzer has none, and a fake that supplies
      // one cannot fail the way the real one does. That difference hid a crash for a whole day.
      const { verdicts: _drop, ...f } = input.focusMeal;
      return {
        intent: "correction",
        analysis: {
          ...f,
          items: f.items.map((i) => ({ ...i, grams: Math.round(i.grams * scale) })),
          kcal: Math.round(f.kcal * scale),
          protein_g: Math.round(f.protein_g * scale * 10) / 10,
          carbs_g: Math.round(f.carbs_g * scale * 10) / 10,
          fat_g: Math.round(f.fat_g * scale * 10) / 10,
          satfat_g: Math.round(f.satfat_g * scale * 10) / 10,
          fiber_g: Math.round(f.fiber_g * scale * 10) / 10,
          sugar_g: Math.round(f.sugar_g * scale * 10) / 10,
          sodium_mg: Math.round(f.sodium_mg * scale),
          notes: "Adjusted from your correction (demo analyzer).",
        },
      };
    }

    if (input.focusMeal && /yesterday|вчера|gestern|move to/.test(text)) {
      return { intent: "redate", dayOffset: clampDayOffset(/yesterday|вчера|gestern/.test(text) ? 1 : 0) };
    }

    if (asks) {
      const eaten = input.todayMeals.reduce((n, m) => n + m.kcal, 0);
      const left = Math.max(0, input.targets.kcal - eaten);
      return {
        intent: "answer",
        text: input.todayMeals.length === 0
          ? `Nothing logged today yet. Your target is ${input.targets.kcal} kcal and ${input.targets.protein_g} g protein. (Demo answer.)`
          : `You are at ${Math.round(eaten)} kcal today across ${input.todayMeals.length} meal(s) — ${Math.round(left)} kcal left of your ${input.targets.kcal} target. (Demo answer.)`,
      };
    }

    return {
      intent: "meal",
      analysis: plateFor(hash(input.text)),
      dayOffset: clampDayOffset(/yesterday|вчера|gestern/.test(text) ? 1 : 0),
    };
  };

  const classifyRestrictions: ClassifyRestrictions = async () => [];

  return { analyzePhoto, routeText, classifyRestrictions };
}
