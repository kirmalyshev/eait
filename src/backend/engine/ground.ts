// Nutrition per 100 g from the reference catalog, for the items a model recognised.
//
// The model's job is the picture: what is on the plate and how many grams. The catalog's job is
// what a gram of it contains. An item the catalog can match with confidence takes the catalog's
// density and its macros are `grams × density`; an item it cannot match keeps the model's own
// estimate, so a miss is never a blank and never a refusal. Totals are not touched here —
// `prepareAnalysis` re-sums them from the items, the same seam every analyzer output passes.
//
// Local catalog only (`food_ref`, loaded from the nightly fooddb snapshot): fooddb's README says
// eait never calls the service live, and a lookup here must not be able to fail a meal.
//
// #615: THE ROW IS CHOSEN BY NAME ONLY. The model's `kcal_per_100g` is an answer, not evidence —
// it is used only when the catalog has no match (the item keeps it, as above), never to filter or
// rank catalog rows. The catalog's own wording decides: generic reference entries over branded or
// restaurant ones, the served form of a staple over its dry form, a preparation the name asks for,
// and a row made FROM the food is not the food.

import {
  MAX_MEAL_AMOUNT, MAX_SNAPSHOT_ATTRIBUTION, MAX_SNAPSHOT_ATTRIBUTIONS, MAX_SNAPSHOT_NAME, SNAPSHOT_MICROS,
  type FoodRef, type FoodSnapshot, type MealItem,
} from "@eait/shared";
import type { AnalyzedMeal } from "../llm/port.ts";
import type { SwitchKey } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { switchOn } from "./switches.ts";

const POOL = 300;
/** A best candidate scoring below this is a miss: the model's own estimate beats a poor match. */
const FLOOR = -6;

const words = (s: string): string[] => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
/** For COMPARING words only ("apple" = "apples", "tomatoes" = "tomato"): the lookup keeps words whole. */
const stem = (w: string) => w.replace(/ies$/, "y").replace(/es$/, "").replace(/s$/, "").replace(/e$/, "");
const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);

/** Words in a recognised name that carry no food: dropped from the lookup, not required of the row. */
const STOP = new Set(["with", "and", "in", "of", "the", "plain", "pieces", "piece", "slice", "slices", "whole"]);
/** What the model says about preparation -> the catalog's word for it. */
const COOKED_AS: Record<string, string[]> = {
  roast: ["roasted"], roasted: ["roasted"], fried: ["fried"], fry: ["fried"],
  grilled: ["grilled", "broiled"], boiled: ["boiled"], baked: ["baked"], toasted: ["toasted"],
  steamed: ["steamed"], cooked: ["cooked"], smoked: ["smoked"], braised: ["braised"], mashed: ["mashed"],
};
const STATES = new Set([
  "raw", "cooked", "roasted", "fried", "grilled", "broiled", "boiled", "baked", "toasted", "steamed",
  "stewed", "smoked", "braised", "mashed", "uncooked", "dry",
]);
/** The dry or agricultural form, as opposed to what is on the plate. */
const RAW_STATE = new Set(["raw", "uncooked", "dry"]);
/** A plain way of serving a cooked food — every USDA prepared row also says "cooked", so it is these that tell a boiled chicken from a fried one. */
const LIGHT_PREP = new Set(["boiled", "steamed", "baked", "roasted", "braised", "stewed", "mashed"]);
/** A specific preparation nobody asked for is a worse answer than the plain food. */
const HARD_PREP = new Set(["fried", "grilled", "broiled", "toasted", "smoked"]);
/**
 * Foods only ever eaten cooked: when the name names no preparation, the served row is the honest
 * default — "rice" on a plate is cooked rice, and its dry row (3x the density) is the wrong answer.
 * Everything else defaults to the fresh form ("apple" is raw).
 */
const SERVES_COOKED = new Set([
  // grains and cereals
  "rice", "pasta", "noodle", "noodles", "spaghetti", "macaroni", "couscous", "quinoa", "millet",
  "bulgur", "barley", "farro", "polenta", "grits", "oatmeal", "oats", "buckwheat", "amaranth",
  "teff", "sorghum", "semolina", "tapioca", "orzo", "wheat",
  // legumes
  "beans", "chickpea", "chickpeas", "lentil", "lentils", "peas", "edamame",
  // tubers and usually-cooked vegetables
  "potato", "potatoes", "yam", "cassava", "taro", "plantain", "eggplant", "aubergine", "artichoke",
  "asparagus", "corn", "okra", "sprouts",
  // proteins
  "chicken", "beef", "pork", "lamb", "veal", "turkey", "duck", "goose", "fish", "salmon", "tuna",
  "cod", "haddock", "tilapia", "trout", "sardines", "shrimp", "prawns", "mussels", "squid",
  "octopus", "bacon", "ham", "sausage", "meat", "meatball", "meatballs", "steak", "liver",
  "egg", "eggs",
]);
/** USDA's descriptive filler ("Chicken, broilers or fryers, ... meat only"): length without meaning. */
const FILLER = new Set([
  "broilers", "or", "fryers", "meat", "only", "skin", "boneless", "skinless", "with", "without", "separable", "lean",
  "fat", "trimmed", "all", "grades", "choice", "select", "retail", "cuts", "fresh", "unprepared", "cooked", "oven",
  "pan", "whole", "commercial", "bone", "small", "large", "medium", "regular", "generic", "type", "from", "not",
  "enriched", "unenriched", "includes", "eaten",
]);
/** A row describing a PORTION of the food — the fat or the skin — not the food, unless asked. */
const PORTION = new Set(["fat", "skin"]);
/**
 * A word that makes the row a product made FROM the food, or another dish entirely — the row is
 * not a match at all unless the name said the word. "Olive oil" is not olives, "Rice pudding" is
 * not rice, "Chicken soup" is not chicken.
 */
const PRODUCT = new Set([
  "tart", "jelly", "pudding", "sandwich", "sandwiches", "pie", "soup", "nectar", "juice", "babyfood",
  "formula", "cake", "cookie", "cookies", "cereal", "drink", "beverage", "candy", "candies",
  "dessert", "pastry", "pastries", "bar", "salad", "yogurt", "oil", "oils", "relish", "chips",
  "crisps", "fries", "greens", "sauce", "gravy", "broth", "stock", "stew", "jam", "marmalade",
  "syrup", "spread", "dip", "dressing", "mayonnaise", "margarine", "flour", "starch", "powder",
  "extract", "supplement", "wine", "beer", "alcohol", "liqueur", "cider", "sausage", "loaf",
  "pizza", "wrap", "burrito", "taco", "quesadilla", "pancake", "waffle", "muffin", "bread",
  "fritter", "nuggets", "milk", "cream", "cheese", "butter", "smoothie", "shake", "pasta",
  "noodles", "rice", "cracker", "crackers", "stick", "sticks",
]);
/** A word that marks the row a composite or a sales form: a penalty, not a refusal. */
const COMPOSITE = new Set([
  "dried", "canned", "restaurant", "frozen", "snack", "flavor", "mix", "kit",
  "spray", "prepacked", "french", "school", "lunch", "burger",
]);
/** Never a match for a food that did not name it. */
const SUBSTITUTE = /\b(meatless|vegetarian|vegan|imitation|analog|substitute)\b/i;
/** Acronyms the catalog writes in caps that are not a brand. */
const NOT_BRAND = new Set(["usda", "nlea", "dha", "ara", "uht", "usa", "bbq"]);

type Complete = FoodRef & {
  kcal_per_100g: number; protein_g_per_100g: number; carbs_g_per_100g: number; fat_g_per_100g: number;
};
const complete = (f: FoodRef): f is Complete =>
  f.kcal_per_100g !== null && f.protein_g_per_100g !== null && f.carbs_g_per_100g !== null && f.fat_g_per_100g !== null;

/** Spellings the catalog does not share with the model (A3b): rewritten before lookup AND scoring. */
const REWRITES: [RegExp, string][] = [
  [/\bmeatloaf\b/gi, "meat loaf"], [/\bomelets?\b/gi, "omelette"],
  [/\bbreadsticks?\b/gi, "bread stick"], [/\bpork knuckle\b/gi, "ham knuckle"],
  // #615: the generic rows are spelled "hamburger" and "toasted bread"; the words a model says
  // ("burger", "toast") otherwise reach only the branded rows. "burger" survives in "burger king"
  // — there the brand IS the query.
  [/\bcheese\s+burgers?\b/gi, "cheeseburger"], [/\bburgers?\b(?!\s+king)/gi, "hamburger"],
  [/\btoasts?\b/gi, "toasted bread"],
];
const rewrite = (name: string) => REWRITES.reduce((s, [re, to]) => s.replace(re, to), name);

/** "X roll" is sushi unless X says it is bread, pastry or a spring/egg roll. */
const NON_SUSHI_ROLL = /\b(cinnamon|dinner|egg|spring|sausage|kaiser|crescent|lobster|jelly|swiss|cabbage|bread|summer|sweet)\s+rolls?\b/i;
const isSushi = (name: string) =>
  /\bsushi\b/i.test(name) || (/\brolls?\b/i.test(name) && !NON_SUSHI_ROLL.test(name));
/** Sushi is looked up as `sushi` and scored as `sushi maki <filling>`. */
const sushiName = (name: string) => {
  const filling = words(name).filter((w) => !["sushi", "roll", "rolls", "maki"].includes(w) && !STOP.has(w) && !COOKED_AS[w]);
  return ["sushi", "maki", ...filling].join(" ");
};

/** Size and quality words that may lead a name; they must never change the row, so they are not required. */
const MODIFIERS = new Set([
  "small", "large", "big", "medium", "mini", "half", "fresh", "homemade", "sliced", "diced", "chopped",
]);

/** The name without its leading modifiers, or null when there are none. Never drops a noun. */
const dropModifiers = (name: string): string | null => {
  const w = name.trim().split(/\s+/);
  const all = new Set([...MODIFIERS, ...STATES, ...Object.keys(COOKED_AS)]);
  let i = 0;
  while (i < w.length - 1 && all.has(w[i]!.toLowerCase())) i++;
  return i > 0 ? w.slice(i).join(" ") : null;
};

/** The preparation the name asks for, in the catalog's spelling, or [] when it asks none. */
const wantedStates = (q: string[]): string[] => q.flatMap((t) => COOKED_AS[t] ?? (STATES.has(t) ? [t] : []));

/** The words a row must carry: the query without stop words, preparation words and leading modifiers. */
export const lookupWords = (nameEn: string): string[] => {
  const n = rewrite(nameEn);
  if (isSushi(n)) return ["sushi"];
  const q = words(n);
  const stripped = q.filter((w) => !STOP.has(w) && !COOKED_AS[w] && !STATES.has(w));
  let i = 0;
  while (i < stripped.length - 1 && MODIFIERS.has(stripped[i]!)) i++;
  return stripped.slice(i).map(singular);
};

/**
 * How well a row answers a recognised name; higher is better. Name only (#615): the head noun
 * first (USDA writes "Chicken, breast, ..." — the food is the first word, the rest qualify it),
 * the preparation the name asked for, the served form of a staple or the fresh form of anything
 * else, generic reference entries over branded and composite ones — and a row made FROM the food,
 * or a portion OF it, is not the food.
 */
export function scoreFood(nameEn: string, f: Complete): number {
  const q = words(nameEn), qStems = q.map(stem);
  const rowWords = words(f.name_en ?? f.name);
  const rowStems = rowWords.map(stem);
  const wantState = wantedStates(q);
  const rowStates = rowWords.filter((t) => STATES.has(t));
  const extras = rowWords.filter((t) => !qStems.includes(stem(t)) && !STATES.has(t));
  let s = -Math.min(4, extras.filter((t) => !FILLER.has(t)).length + extras.filter((t) => FILLER.has(t)).length * 0.15);

  // The head is the first WORD, hyphens kept: "Sugar-apples" is a sweetsop, not sugar — a
  // hyphenated head whose far half the name never said is a head the name never said.
  const headToken = (f.name_en ?? f.name).trim().split(/[\s,;:()]+/)[0] ?? "";
  if (headToken.includes("-")) {
    const parts = headToken.toLowerCase().split("-").filter((p) => p.length > 1);
    if (parts.some((p) => !qStems.includes(stem(p)))) s -= 3;
  } else if (!qStems.includes(stem(headToken.toLowerCase()))) s -= 3;

  // A product made from the food, or another dish, is simply out.
  if (rowStems.some((t, i) => PRODUCT.has(rowWords[i]!) && !qStems.includes(t))) return -Infinity;
  s -= rowStems.filter((t, i) => COMPOSITE.has(rowWords[i]!) && !qStems.includes(t)).length * 4;
  s -= extras.filter((t) => PORTION.has(t)).length * 4;
  // A row whose name carries a brand (the catalog spells brands in caps) is a worse generic
  // answer, unless the name said the brand.
  const caps = (f.name_en ?? f.name).split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length >= 3 && /[A-Z]{2,}/.test(t) && !NOT_BRAND.has(t.toLowerCase()) && !qStems.includes(stem(t.toLowerCase())));
  s -= caps.length * 4;

  if (wantState.length > 0) {
    s += rowStates.some((t) => wantState.includes(t)) ? 3 : rowStates.some((t) => RAW_STATE.has(t)) ? -2 : 0;
  } else if (q.map(singular).some((t) => SERVES_COOKED.has(t))) {
    // A staple on a plate is served: the plainly cooked form first, a named preparation next, the
    // dry form last. "cooked" itself is ignored here — every prepared row carries it.
    const prep = rowStates.filter((t) => t !== "cooked");
    s += prep.some((t) => LIGHT_PREP.has(t)) ? 1.5 : prep.some((t) => HARD_PREP.has(t)) ? 1
      : rowStates.includes("cooked") ? 1 : prep.some((t) => RAW_STATE.has(t)) ? -0.5 : 0;
  } else {
    // Anything else is the fresh form by default, a plain row over a prepared one.
    const prep = rowStates.filter((t) => t !== "cooked");
    s += prep.some((t) => RAW_STATE.has(t)) ? 1 : prep.some((t) => HARD_PREP.has(t)) ? -2.5
      : rowStates.length > 0 ? -0.5 : 0;
  }
  if (f.source === "usda-sr") s += 1;
  return s;
}

/** The catalog row to believe for this item among `candidates`, or null. */
export function pickFood(nameEn: string, candidates: FoodRef[]): Complete | null {
  const raw = rewrite(nameEn.trim());
  if (!raw) return null;
  const name = isSushi(raw) ? sushiName(raw) : raw;
  const usable = candidates.filter(complete).filter((f) =>
    !SUBSTITUTE.test(f.name_en ?? f.name) || SUBSTITUTE.test(name));
  let best: Complete | null = null, bestScore = -Infinity;
  for (const f of usable) {
    const sc = scoreFood(name, f);
    if (sc > bestScore) { best = f; bestScore = sc; }
  }
  return best && bestScore >= FLOOR ? best : null;
}

/** Full name first; on a miss, once more without its leading modifiers (A3b). */
async function findFood(deps: EngineDeps, item: MealItem): Promise<Complete | null> {
  const attempt = async (name: string) => {
    const w = lookupWords(name);
    return w.length === 0 ? null : pickFood(name, await deps.store.foodCandidates(w, POOL));
  };
  const hit = await attempt(item.name_en!);
  if (hit) return hit;
  const bare = dropModifiers(rewrite(item.name_en!));
  return bare ? attempt(bare) : null;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * The read-only row copy a grounded item carries (#562): name, source, per-100 g macros and the
 * row's own attribution texts, verbatim. Stored WITH the meal — a catalog refresh changes
 * `food_ref` and never a stored meal, which is why edits recompute from this and not the row.
 */
const foodSnapshot = (f: Complete): FoodSnapshot => ({
  // Clamped to the bounds `isEditMealRequest` accepts, so a catalog row that ever exceeded one
  // could not make the meal it grounded uneditable by echo (#562).
  name: f.name.slice(0, MAX_SNAPSHOT_NAME),
  source: f.source,
  per100: {
    kcal: f.kcal_per_100g, protein_g: f.protein_g_per_100g, carbs_g: f.carbs_g_per_100g, fat_g: f.fat_g_per_100g,
    // Only a value `isEditMealRequest` would accept back: an out-of-bound one is left out, not clamped.
    ...Object.fromEntries(SNAPSHOT_MICROS.flatMap((k) => {
      const v = f[`${k}_per_100g` as const];
      return v !== null && v !== undefined && Number.isFinite(v) && v >= 0 && v <= MAX_MEAL_AMOUNT ? [[k, v]] : [];
    })),
  },
  attribution: (f.attribution ?? []).slice(0, MAX_SNAPSHOT_ATTRIBUTIONS).map((t) => t.slice(0, MAX_SNAPSHOT_ATTRIBUTION)),
});

/**
 * The item at its own grams with a snapshot's nutrition: `grams × per100`, catalog-exact.
 * Shared by grounding (the row it just picked) and by `editMeal` (the STORED item's snapshot,
 * so an edit to grams stays catalog-exact while a client-sent `food` never lands).
 */
export function recomputeFromSnapshot(item: MealItem, food: FoodSnapshot): MealItem {
  const k = item.grams / 100;
  return {
    ...item,
    kcal: Math.round(food.per100.kcal * k),
    protein_g: round1(food.per100.protein_g * k),
    carbs_g: round1(food.per100.carbs_g * k),
    fat_g: round1(food.per100.fat_g * k),
    kcal_per_100g: food.per100.kcal,
    food,
  };
}

/**
 * The meal's satfat, fibre, sugar and sodium from the catalog, PER NUTRIENT (#566): a nutrient is
 * `Σ grams × per100 / 100` only when every item is grounded and its snapshot carries that nutrient.
 * Any other nutrient is absent, and the caller keeps the model's (or the scaled stored) figure.
 */
export function catalogMicros(items: readonly MealItem[]): Partial<Record<typeof SNAPSHOT_MICROS[number], number>> {
  const out: Partial<Record<typeof SNAPSHOT_MICROS[number], number>> = {};
  if (items.length === 0) return out;
  for (const k of SNAPSHOT_MICROS) {
    if (items.every((i) => i.food?.per100[k] !== undefined)) {
      out[k] = round1(items.reduce((s, i) => s + (i.grams * (i.food?.per100[k] ?? 0)) / 100, 0));
    }
  }
  return out;
}

/** The item with the catalog's nutrition and provenance for its grams. */
function groundItem(item: MealItem, f: Complete): MealItem {
  // `ref` last: a stale one on the incoming item could never survive the row we just chose.
  return { ...recomputeFromSnapshot(item, foodSnapshot(f)), ref: f.id };
}

/**
 * Ground every item the catalog can. A lookup that throws is a miss: the catalog is a refinement of
 * an answer the model already gave, so its failure costs accuracy and never the meal.
 */
export async function groundAnalysis(
  deps: EngineDeps, analysis: AnalyzedMeal,
): Promise<{ analysis: AnalyzedMeal; grounded: number }> {
  if (!analysis.isFood || analysis.items.length === 0) return { analysis, grounded: 0 };
  let grounded = 0;
  const items = await Promise.all(analysis.items.map(async (item) => {
    if (!item.name_en?.trim() || !(item.grams > 0)) return item;
    try {
      const hit = await findFood(deps, item);
      if (!hit) return item;
      grounded++;
      return groundItem(item, hit);
    } catch (e) {
      console.error(`[eait] food lookup failed: ${(e as Error).message}`);
      return item;
    }
  }));
  console.error(`[eait] grounding: ${grounded}/${items.length} items from the catalog`);
  return { analysis: { ...analysis, ...catalogMicros(items), items }, grounded };
}

/**
 * `groundAnalysis` behind the admin's switch, read per request (#563). Off hands the analysis
 * back exactly as the model returned it.
 */
export async function groundWhenOn(
  deps: EngineDeps, key: SwitchKey, analysis: AnalyzedMeal,
): Promise<{ analysis: AnalyzedMeal; grounded: number }> {
  return (await switchOn(deps, key)) ? groundAnalysis(deps, analysis) : { analysis, grounded: 0 };
}
