// The catalog supplies the nutrition; the model supplies the picture. A miss keeps the model's number.

import { describe, expect, test } from "bun:test";
import type { FoodRef } from "@eait/shared";
import type { AnalyzedMeal } from "../llm/port.ts";
import type { EngineDeps } from "./deps.ts";
import { groundAnalysis, lookupWords, pickFood, preferredSources } from "./ground.ts";
import { prepareAnalysis } from "./analysis.ts";

const ref = (name_en: string, kcal: number | null, over: Partial<FoodRef> = {}): FoodRef => ({
  id: `usda-sr:${name_en}`, source: "usda-sr", name: name_en, name_de: null, name_en, names: {}, category: null,
  kcal_per_100g: kcal, protein_g_per_100g: 10, carbs_g_per_100g: 20, fat_g_per_100g: 5,
  satfat_g_per_100g: null, fiber_g_per_100g: null, sugar_g_per_100g: null, sodium_mg_per_100g: null,
  nutrients: {}, portions: [], source_url: null, attribution: [],
  ...over,
} as FoodRef);

const depsWith = (catalog: FoodRef[] | Error): EngineDeps => ({
  store: {
    foodCandidates: async (w: string[]) => {
      if (catalog instanceof Error) throw catalog;
      return catalog.filter((f) => w.every((x) => f.name_en!.toLowerCase().includes(x)));
    },
  },
} as unknown as EngineDeps);

const meal = (items: AnalyzedMeal["items"]): AnalyzedMeal => ({
  isFood: true, items, kcal: 999, protein_g: 1, carbs_g: 1, fat_g: 1,
  satfat_g: 0, fiber_g: 0, sugar_g: 0, sodium_mg: 0, confidence: "high", notes: "",
});
const model = (name_en: string, grams: number, kcal_per_100g = 150) => ({
  name: name_en, name_en, grams, kcal: grams * kcal_per_100g / 100, protein_g: 3, carbs_g: 4, fat_g: 2, kcal_per_100g,
});

describe("grounding items in the catalog", () => {
  test("a hit takes the catalog's density and multiplies by the grams", async () => {
    const { analysis, grounded } = await groundAnalysis(depsWith([ref("chicken breast", 165)]), meal([model("chicken breast", 200, 150)]));
    expect(grounded).toBe(1);
    expect(analysis.items[0]).toMatchObject({ kcal: 330, protein_g: 20, carbs_g: 40, fat_g: 10, kcal_per_100g: 165 });
  });

  test("a miss keeps the model's own numbers, whole", async () => {
    const original = meal([model("dragonfruit sorbet", 120)]);
    const { analysis, grounded } = await groundAnalysis(depsWith([ref("chicken breast", 165)]), original);
    expect(grounded).toBe(0);
    expect(analysis.items).toEqual(original.items);
  });

  test("a catalog that throws is a miss, not a failed meal", async () => {
    const original = meal([model("rice", 100)]);
    const { analysis } = await groundAnalysis(depsWith(new Error("db down")), original);
    expect(analysis.items).toEqual(original.items);
  });

  test("a row missing a macro is not used", async () => {
    const { grounded } = await groundAnalysis(depsWith([ref("rice", 130, { protein_g_per_100g: null })]), meal([model("rice", 100, 130)]));
    expect(grounded).toBe(0);
  });

  test("the model's density never steers the row: far or near, the name decides (#615)", async () => {
    // The catalog's word on "rice" is the served form, however far that sits from the model's guess.
    const { grounded, analysis } = await groundAnalysis(
      depsWith([ref("Rice, white, cooked", 130), ref("Rice, white, raw", 365)]),
      meal([model("rice", 150, 30)]),
    );
    expect(grounded).toBe(1);
    expect(analysis.items[0]?.ref).toBe("usda-sr:Rice, white, cooked");
  });

  test("a row made FROM the food is not the food: rice pudding is no answer to rice", async () => {
    const long = ref("chicken breast meat only cooked roasted", 165);
    expect((await groundAnalysis(depsWith([long]), meal([model("chicken breast", 100, 150)]))).grounded).toBe(1);
    expect((await groundAnalysis(depsWith([ref("rice pudding", 400)]), meal([model("rice", 100, 130)]))).grounded).toBe(0);
  });

  test("a mixed plate is grounded per item and the totals become the sum", async () => {
    const { analysis, grounded } = await groundAnalysis(
      depsWith([ref("egg", 143)]), meal([model("egg", 100, 150), model("mystery stew", 100, 100)]),
    );
    expect(grounded).toBe(1);
    expect(prepareAnalysis(analysis).analysis.kcal).toBe(143 + 100);
  });

  test("not-food and an empty plate pass through untouched", async () => {
    const none = { ...meal([]), isFood: false };
    expect((await groundAnalysis(depsWith([]), none)).analysis).toBe(none);
  });
});

describe("meal micronutrients from the catalog (#566)", () => {
  const micros = { satfat_g_per_100g: 2, fiber_g_per_100g: 3, sugar_g_per_100g: 4, sodium_mg_per_100g: 50 };
  const model2 = (name: string, grams: number) => ({ ...model(name, grams), name_en: name });
  const modelMeal = (items: AnalyzedMeal["items"]): AnalyzedMeal => ({
    ...meal(items), satfat_g: 7, fiber_g: 7, sugar_g: 7, sodium_mg: 777,
  });

  test("every item grounded and carrying a nutrient: the meal's value is the catalog's sum", async () => {
    const catalog = [ref("egg", 143, micros), ref("toasted bread", 250, { ...micros, satfat_g_per_100g: 1 })];
    const { analysis } = await groundAnalysis(depsWith(catalog), modelMeal([model2("egg", 100), model2("toast", 50)]));
    expect(analysis).toMatchObject({ satfat_g: 2.5, fiber_g: 4.5, sugar_g: 6, sodium_mg: 75 });
  });

  test("a miss keeps the model's values for the whole meal", async () => {
    const { analysis } = await groundAnalysis(depsWith([ref("egg", 143, micros)]), modelMeal([model2("egg", 100), model2("mystery stew", 100)]));
    expect(analysis).toMatchObject({ satfat_g: 7, fiber_g: 7, sugar_g: 7, sodium_mg: 777 });
  });

  test("the rule is per nutrient: a row without fibre leaves only fibre to the model", async () => {
    const catalog = [ref("egg", 143, micros), ref("toasted bread", 250, { ...micros, fiber_g_per_100g: null })];
    const { analysis } = await groundAnalysis(depsWith(catalog), modelMeal([model2("egg", 100), model2("toast", 100)]));
    expect(analysis).toMatchObject({ satfat_g: 4, fiber_g: 7, sugar_g: 8, sodium_mg: 100 });
  });
});

describe("ranking the candidates", () => {
  const pick = (name_en: string, rows: FoodRef[]) => pickFood(name_en, rows)?.name_en ?? null;

  test("the food leads the name: the generic entry beats a tart, a pineapple and a branded product", () => {
    const rows = [ref("Apple tart", 227), ref("Pineapple, raw", 50), ref("Lean Pockets, Apple", 250), ref("Apples, raw, all varieties", 52)];
    expect(pick("apple", rows)).toBe("Apples, raw, all varieties");
  });
  test("a named preparation picks the row prepared that way, and a staple defaults to served", () => {
    const rows = [ref("Chicken, breast, raw", 120), ref("Chicken, breast, cooked, fried", 220), ref("Chicken, breast, cooked, roasted", 165)];
    expect(pick("fried chicken breast", rows)).toBe("Chicken, breast, cooked, fried");
    expect(pick("chicken breast", rows)).toBe("Chicken, breast, cooked, roasted");
  });
  test("meatless is never a match for meat, unless the model said so", () => {
    const rows = [ref("Meatballs, meatless", 197)];
    expect(pick("meatballs", rows)).toBeNull();
    expect(pick("meatless meatballs", rows)).toBe("Meatballs, meatless");
  });
  test("a poor best candidate is a miss", () => {
    expect(pick("mini quiche", [ref("Egg tart, quiche style lorraine pie pastry", 233)])).toBeNull();
  });
  test("the lookup drops preparation and filler words and stems plurals", () => {
    expect(lookupWords("Fried chicken drumsticks with the skin")).toEqual(["chicken", "drumstick", "skin"]);
  });

  // ── #615: robust to wording ──

  test("case, plurals and word order do not change the row", () => {
    const rows = [ref("Chicken, breast, cooked, roasted", 165), ref("Chicken, breast, raw", 120)];
    const base = pick("chicken breast", rows);
    expect(pick("Chicken Breast", rows)).toBe(base);
    expect(pick("chicken breasts", rows)).toBe(base);
    expect(pick("breast chicken", rows)).toBe(base);
  });
  test("a leading size or quality modifier does not change the row", () => {
    const rows = [ref("Salmon, atlantic, cooked, grilled", 206)];
    expect(pick("large grilled salmon", rows)).toBe(pick("grilled salmon", rows));
    expect(pick("fresh salmon", rows)).toBe(pick("salmon", rows));
  });
  test("a generic row beats a branded one, unless the name says the brand", () => {
    const rows = [
      ref("BURGER KING, Hamburger", 261),
      ref("McDONALD'S, Hamburger", 264),
      ref("Fast foods, hamburger, single, regular patty, plain", 297),
    ];
    expect(pick("hamburger", rows)).toBe("Fast foods, hamburger, single, regular patty, plain");
    expect(pick("burger king hamburger", rows)).toBe("BURGER KING, Hamburger");
  });
  test("a row made from the food loses to the food: olive oil, chips, greens, relish", () => {
    expect(pick("olives", [ref("Olive oil", 900), ref("Olives, green, stuffed", 130)])).toBe("Olives, green, stuffed");
    expect(pick("tortilla", [ref("Tortilla chips", 475), ref("Tortillas, corn", 218)])).toBe("Tortillas, corn");
    expect(pick("mustard", [ref("Mustard greens, raw", 27), ref("Mustard, prepared, yellow", 66)])).toBe("Mustard, prepared, yellow");
    expect(pick("pickles", [ref("Pickle relish, sweet", 130), ref("Pickles, cucumber, dill", 17)])).toBe("Pickles, cucumber, dill");
  });
  test("the fat and skin portions are not the food", () => {
    const rows = [ref("Beef, retail cuts, separable fat, raw", 674), ref("Beef, chuck, ground, cooked", 250)];
    expect(pick("beef", rows)).toBe("Beef, chuck, ground, cooked");
  });
  test("a hyphenated first word names the compound, not the food", () => {
    const rows = [ref("Sugar-apples, (sweetsop), raw", 94), ref("Sugar, granulated", 387)];
    expect(pick("sugar", rows)).toBe("Sugar, granulated");
  });
  test("a staple is the served form; a fruit is the fresh one; a plain row beats a preparation", () => {
    expect(pick("rice", [ref("Rice, white, raw", 365), ref("Rice, white, cooked", 130)])).toBe("Rice, white, cooked");
    expect(pick("apple", [ref("Apples, raw", 52), ref("Apples, cooked, boiled", 53)])).toBe("Apples, raw");
    expect(pick("tofu", [ref("Tofu, fried", 270), ref("Tofu, raw, regular", 76)])).toBe("Tofu, raw, regular");
    expect(pick("steak", [ref("Horse, steak, raw", 129), ref("Beef, sirloin, cooked, grilled", 200)])).toBe("Beef, sirloin, cooked, grilled");
  });
});

// #637: the bigger table exposed two matcher weaknesses — a correct row left the 300-candidate
// pool on a frequent token, and a short foreign-head name ("Sugar pea", "Salsa verde",
// "Pork steak", "Beef consomme") outscored or out-tied the row that names the food.
describe("matcher #637: pool eviction and foreign-head wins", () => {
  const pick = (name_en: string, rows: FoodRef[]) => pickFood(name_en, rows)?.name_en ?? null;
  const pickId = (name_en: string, rows: FoodRef[]) => pickFood(name_en, rows)?.id ?? null;
  const src = (source: string, name_en: string, kcal: number) =>
    ref(name_en, kcal, { id: `${source}:${name_en}`, source: source as FoodRef["source"] });

  test("the head noun of a comma-less name is its last content word: sugar is not a pea", () => {
    const rows = [src("bls", "Sugar pea raw", 38), ref("Sugars, brown", 380), ref("Sugars, granulated", 385)];
    expect(pickId("sugar", rows)).toBe("usda-sr:Sugars, brown");
  });
  test("salsa is the tomato dip, not salsa verde", () => {
    const rows = [src("bls", "Salsa verde", 480), src("matvaretabellen", "Tomato salsa", 25)];
    expect(pickId("salsa", rows)).toBe("matvaretabellen:Tomato salsa");
  });
  test("an unqualified steak is beef: a named species is a different head food", () => {
    const rows = [
      src("bls", "Pork steak fried", 175), src("bls", "Beef steak grilled", 180),
      src("bls", "Salmon steaks fried", 224), src("ciqual", "Beef, sirloin steak, roasted/baked", 194),
    ];
    expect(pickId("steak", rows)).toBe("bls:Beef steak grilled");
    expect(pickId("pork steak", rows)).toBe("bls:Pork steak fried");
  });
  test("fried chicken is chicken, not chicken liver", () => {
    const rows = [
      src("bls", "Chicken liver fried", 149),
      ref("Chicken, broilers or fryers, meat only, cooked, fried", 219),
    ];
    expect(pickId("fried chicken", rows)).toBe("usda-sr:Chicken, broilers or fryers, meat only, cooked, fried");
  });
  test("a consomme whose strips are crepe is not grilled beef strips", () => {
    const rows = [
      src("bls", "Beef consomme with strips of crepe", 54),
      ref("Beef, grass-fed, strip steaks, lean only, raw", 117),
    ];
    expect(pickId("grilled beef strips", rows)).toBe("usda-sr:Beef, grass-fed, strip steaks, lean only, raw");
  });
  test("a score tie breaks toward the reference table first — never the shorter name alone", () => {
    // Three rows name the same food with the same score; the preferred table's answers the tie.
    const rows = [
      src("bls", "Cucumber raw", 16),
      src("frida", "Cucumber, raw", 12),
      ref("Cucumber, raw", 10),
    ];
    expect(pickId("cucumber", rows)).toBe("usda-sr:Cucumber, raw");
    // …and a source bonus never lifts a row carrying an unsaid qualifier into the group.
    expect(pickId("cucumber", [rows[0]!, rows[1]!, ref("Cucumber, peeled, raw", 10)]))
      .toBe("frida:Cucumber, raw");
  });
  test("a tie inside one table goes to coverage, then the shorter name", () => {
    const rows = [
      src("frida", "Beans, navy, raw", 100),
      src("frida", "Beans, red, raw", 100),
    ];
    expect(pickId("beans", rows)).toBe("frida:Beans, red, raw");
  });
  test("a computed dish loses a same-food tie to a table row (#646)", () => {
    // A recipe row is computed FROM the tables' rows — a real table entry for the same food
    // always answers the tie, even the last one in the order.
    const rows = [src("recipe", "Plov", 150), src("bls", "Plov", 150)];
    expect(pickId("plov", rows)).toBe("bls:Plov");
  });
  test("a source the order does not name sorts last, not first", () => {
    // `curated` is a real schema id the order has not met — it must lose even to `recipe`,
    // the last entry. An unanswered `indexOf` (-1) used to sort it first instead.
    const rows = [src("curated", "Plov", 150), src("recipe", "Plov", 150)];
    expect(pickId("plov", rows)).toBe("recipe:Plov");
  });
});

// #637 step 2: the user's country names the table a same-food tie prefers — and only the tie.
describe("matcher #637: the country table wins same-food ties", () => {
  const rows: FoodRef[] = [
    { ...ref("Cucumber, raw", 10), id: "usda-sr:1" },
    { ...ref("x", 16), id: "bls:2", source: "bls", name_en: "Cucumber raw" },
    { ...ref("x", 12), id: "frida:3", source: "frida", name_en: "Cucumber, raw" },
  ];
  const pick = (country: string | null) =>
    pickFood("cucumber", rows, preferredSources(country))?.id ?? null;
  test("de/at pick bls, us and unknown keep usda-sr", () => {
    expect(pick("de")).toBe("bls:2");
    expect(pick("at")).toBe("bls:2");
    expect(pick("us")).toBe("usda-sr:1");
    expect(pick(null)).toBe("usda-sr:1");
  });
  test("each country picks its own table where it ties, usda-sr otherwise", () => {
    expect(pick("dk")).toBe("frida:3");
    // fr prefers ciqual and no prefers matvaretabellen — absent here, so usda-sr answers.
    expect(pick("fr")).toBe("usda-sr:1");
    expect(pick("no")).toBe("usda-sr:1");
    expect(pick("gb")).toBe("usda-sr:1");
  });
  test("the preference never outweighs a name mismatch", () => {
    const mismatch: FoodRef[] = [
      { ...ref("x", 38), id: "bls:4", source: "bls", name_en: "Sugar pea raw" },
      ref("Sugars, brown", 380),
    ];
    expect(pickFood("sugar", mismatch, preferredSources("de"))?.name_en).toBe("Sugars, brown");
  });
});

describe("matcher A3b: rewrites, sushi, modifier-drop (#567)", () => {
  test("meatloaf is looked up as two words", () => {
    expect(lookupWords("meatloaf")).toEqual(["meat", "loaf"]);
  });
  test("omelet is looked up as omelette", () => {
    expect(lookupWords("cheese omelet")).toEqual(["cheese", "omelette"]);
  });
  test("breadstick is looked up as bread stick", () => {
    expect(lookupWords("breadsticks")).toEqual(["bread", "stick"]);
  });
  test("pork knuckle is looked up as ham knuckle", () => {
    expect(lookupWords("pork knuckle")).toEqual(["ham", "knuckle"]);
  });
  test("a sushi or X-roll name looks up sushi rows and is scored as sushi maki <filling>", async () => {
    expect(lookupWords("California roll")).toEqual(["sushi"]);
    const rows = [ref("sushi maki salmon", 140), ref("sushi maki tuna", 130)];
    const { analysis, grounded } = await groundAnalysis(depsWith(rows), meal([model("tuna roll", 100, 135)]));
    expect(grounded).toBe(1);
    expect(analysis.items[0]?.ref).toBe("usda-sr:sushi maki tuna");
  });
  test("a bread roll is not sushi", () => {
    expect(lookupWords("cinnamon roll")).toEqual(["cinnamon", "roll"]);
  });
  test("toast is looked up as toasted bread; a burger as a hamburger", () => {
    expect(lookupWords("toast")).toEqual(["bread"]);
    expect(lookupWords("french toast")).toEqual(["french", "bread"]);
    expect(lookupWords("burger")).toEqual(["hamburger"]);
  });
  test("a miss retries without leading modifiers, and never falls back to the head noun alone", async () => {
    const hit = await groundAnalysis(depsWith([ref("salmon", 200)]), meal([model("large grilled salmon", 100, 190)]));
    expect(hit.grounded).toBe(1);
    const miss = await groundAnalysis(depsWith([ref("salmon", 200)]), meal([model("smoked salmon pasta", 100, 190)]));
    expect(miss.grounded).toBe(0);
  });
});
