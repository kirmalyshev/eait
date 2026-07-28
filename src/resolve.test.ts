import { describe, expect, test } from "bun:test";
import { applySelections, buildCandidateSets } from "./resolve.ts";
import { buildFoodIndex, type FoodRow } from "./food_db.ts";
import { MealAnalysisSchema } from "./analyzer.ts";
import type { MealAnalysis, MealItem } from "./types.ts";

const ROWS: FoodRow[] = [
  { id: "usda:170287", name: "Bulgur, cooked", kcal: 83, protein_g: 3.1, carbs_g: 18.6, fat_g: 0.2,
    satfat_g: 0, fiber_g: 4.5, sugar_g: 0.1, sodium_mg: 5 },
  { id: "usda:169700", name: "Couscous, cooked", kcal: 112, protein_g: 3.8, carbs_g: 23.2, fat_g: 0.2,
    satfat_g: 0, fiber_g: 1.4, sugar_g: 0.1, sodium_mg: 5 },
  { id: "usda:170688", name: "Bulgur, dry", kcal: 342, protein_g: 12.3, carbs_g: 75.9, fat_g: 1.3 },
  { id: "usda:2", name: "Chicken, broilers or fryers, breast, meat only, cooked, roasted",
    kcal: 165, protein_g: 31, carbs_g: 0, fat_g: 3.6, satfat_g: 1, fiber_g: 0, sugar_g: 0, sodium_mg: 74 },
];
const index = buildFoodIndex(ROWS);

const meal = (items: MealItem[], over: Partial<MealAnalysis> = {}): MealAnalysis =>
  MealAnalysisSchema.parse({
    isFood: true, items,
    kcal: 500, protein_g: 20, carbs_g: 60, fat_g: 10,
    satfat_g: 3, fiber_g: 5, sugar_g: 4, sodium_mg: 900,
    ...over,
  });

describe("buildCandidateSets", () => {
  test("shortlists each item the table knows", () => {
    const sets = buildCandidateSets(meal([{ name: "Булгур", grams: 200, name_en: "bulgur" }]), index);
    expect(sets.length).toBe(1);
    expect(sets[0]!.itemIndex).toBe(0);
    expect(sets[0]!.candidates.map((r) => r.id)).toContain("usda:170287");
  });

  test("an item with no name_en is skipped — the display name is not an English key", () => {
    // `name` is in the user's language. Falling back to it would query an English table with
    // Russian, match nothing, and cost a lookup to learn that.
    expect(buildCandidateSets(meal([{ name: "Булгур", grams: 200 }]), index)).toEqual([]);
  });

  test("an unknown food is OMITTED, not sent with an empty shortlist", () => {
    // Nothing to choose from is not a question worth asking. Sending it would invite the model to
    // pick from nothing, or to invent.
    expect(buildCandidateSets(meal([{ name: "Тирамису", grams: 100, name_en: "tiramisu" }]), index)).toEqual([]);
  });

  test("itemIndex points back into the ORIGINAL array, skipped items included", () => {
    // The index is the only link back through the round trip. If it were the position in the
    // filtered list, every selection after a skipped item would apply to the wrong food.
    const sets = buildCandidateSets(
      meal([
        { name: "Тирамису", grams: 100, name_en: "tiramisu" }, // no candidates → skipped
        { name: "Булгур", grams: 200, name_en: "bulgur" },
      ]),
      index,
    );
    expect(sets.map((s) => s.itemIndex)).toEqual([1]);
  });
});

describe("applySelections", () => {
  const bulgurMeal = () => meal([{ name: "Булгур", grams: 200, name_en: "bulgur", kcal: 240, kcal_per_100g: 120 }]);

  test("substitutes the chosen row's macros and records which row did it", () => {
    const m = bulgurMeal();
    const sets = buildCandidateSets(m, index);
    const { analysis, grounded } = applySelections(m, sets, [{ itemIndex: 0, foodId: "usda:170287" }]);
    const item = analysis.items[0]!;
    expect(grounded).toBe(1);
    expect(item.food_id).toBe("usda:170287");
    expect(item.kcal).toBe(166); // 83 kcal/100 g x 200 g — the model had said 240
    expect(item.kcal_per_100g).toBe(83);
    expect(analysis.kcal).toBe(166); // totals re-summed from the parts
  });

  test("'none of these' keeps the model's numbers and records NO food_id", () => {
    // The escape hatch. Absent food_id is what marks a number as the model's own a year later.
    const m = bulgurMeal();
    const sets = buildCandidateSets(m, index);
    const { analysis, grounded } = applySelections(m, sets, [{ itemIndex: 0, foodId: null }]);
    expect(grounded).toBe(0);
    expect(analysis.items[0]!.food_id).toBeUndefined();
    expect(analysis.items[0]!.kcal).toBe(240);
  });

  test("a food_id that was never OFFERED is ignored, not trusted", () => {
    // A hallucinated id must degrade to "none of these". Accepting it would let the model reach any
    // row in the table, including one the matcher deliberately excluded on cooking state.
    const m = bulgurMeal();
    const sets = buildCandidateSets(m, index);
    const { analysis, grounded } = applySelections(m, sets, [{ itemIndex: 0, foodId: "usda:99999" }]);
    expect(grounded).toBe(0);
    expect(analysis.items[0]!.kcal).toBe(240);
  });

  test("WITHOUT alt_en, a misidentification is unrecoverable — the right row is never offered", () => {
    // The finding that reshaped this design. Retrieval is driven by the name the model produced, so
    // a model that says "couscous" gets couscous rows and nothing else. Selecting among them cannot
    // reach bulgur, and grounding then makes the wrong answer SHARPER rather than fixing it.
    const wrong = meal([{ name: "Булгур", grams: 200, name_en: "couscous", kcal: 240 }]);
    const ids = buildCandidateSets(wrong, index)[0]!.candidates.map((r) => r.id);
    expect(ids).toContain("usda:169700"); // couscous
    expect(ids).not.toContain("usda:170287"); // bulgur — the correct answer, absent
  });

  test("WITH alt_en, both foods reach the shortlist and the choice moves real numbers", () => {
    // This is why alt_en is a PREREQUISITE for grounding rather than a later refinement: it is the
    // only thing that puts the correct row in front of the model at all.
    const torn = meal([
      { name: "Булгур", grams: 200, name_en: "couscous", alt_en: ["bulgur"], kcal: 240 },
    ]);
    const sets = buildCandidateSets(torn, index);
    const ids = sets[0]!.candidates.map((r) => r.id);
    expect(ids).toContain("usda:169700");
    expect(ids).toContain("usda:170287");

    const asBulgur = applySelections(torn, sets, [{ itemIndex: 0, foodId: "usda:170287" }]).analysis;
    const asCouscous = applySelections(torn, sets, [{ itemIndex: 0, foodId: "usda:169700" }]).analysis;
    expect(asBulgur.kcal).toBe(166);
    expect(asCouscous.kcal).toBe(224); // +35%, the error the whole design targets
    expect(asBulgur.fiber_g).toBe(9); // 4.5 x2
    expect(asCouscous.fiber_g).toBe(2.8); // 1.4 x2 — 3.2x apart, wider than the calorie gap
  });

  test("alt_en does not let a food masquerade as an unrelated one", () => {
    // Widening retrieval must not become a licence to pick anything. Each alternative still goes
    // through the same matcher, so an alternative the table cannot match adds no candidates.
    const withAlt = meal([{ name: "Булгур", grams: 200, name_en: "bulgur", alt_en: ["tiramisu"], kcal: 240 }]);
    const without = meal([{ name: "Булгур", grams: 200, name_en: "bulgur", kcal: 240 }]);
    expect(buildCandidateSets(withAlt, index)[0]!.candidates.map((r) => r.id)).toEqual(
      buildCandidateSets(without, index)[0]!.candidates.map((r) => r.id),
    );
  });

  test("micros are re-summed ONLY when every item is grounded", () => {
    const m = meal([
      { name: "Булгур", grams: 200, name_en: "bulgur", kcal: 240 },
      { name: "Курица", grams: 150, name_en: "chicken breast, cooked", kcal: 250 },
    ]);
    const sets = buildCandidateSets(m, index);
    const both = applySelections(m, sets, [
      { itemIndex: 0, foodId: "usda:170287" },
      { itemIndex: 1, foodId: "usda:2" },
    ]).analysis;
    expect(both.sodium_mg).toBe(121); // 5x2 + 74x1.5 — replaces the model's 900
  });

  test("one ungrounded item leaves EVERY micro at the model's figure", () => {
    // Sodium and saturated fat drive the medical verdicts. A partial sum would omit whatever the
    // unresolved item contributes and report a LOWER number with full confidence — understating
    // exactly the two nutrients a user with a declared restriction might act on.
    const m = meal([
      { name: "Булгур", grams: 200, name_en: "bulgur", kcal: 240 },
      { name: "Соус", grams: 50, name_en: "tiramisu", kcal: 100 }, // unknown to the table
    ]);
    const sets = buildCandidateSets(m, index);
    const out = applySelections(m, sets, [{ itemIndex: 0, foodId: "usda:170287" }]).analysis;
    expect(out.sodium_mg).toBe(900); // untouched
    expect(out.satfat_g).toBe(3);
  });

  test("totals stay the model's when an item carries no per-item macros at all", () => {
    // A pre-A2 meal has bare items. Summing them would report a total missing that item entirely;
    // a complete guess beats a partial sum presented as fact.
    const m = meal([
      { name: "Булгур", grams: 200, name_en: "bulgur" },
      { name: "Хлеб", grams: 50 },
    ]);
    const sets = buildCandidateSets(m, index);
    const out = applySelections(m, sets, [{ itemIndex: 0, foodId: "usda:170287" }]).analysis;
    expect(out.kcal).toBe(500); // the model's total, untouched
  });

  test("no selections at all is a clean no-op, totals included", () => {
    // Grounding nothing must change nothing. Re-summing the totals here would enforce
    // items-against-totals agreement as a side effect — and that check ships OBSERVE-ONLY until
    // its fire rate is known, so doing it silently would smuggle the decision in unmeasured.
    const m = bulgurMeal();
    const out = applySelections(m, buildCandidateSets(m, index), []);
    expect(out.grounded).toBe(0);
    expect(out.analysis.kcal).toBe(500);
    expect(out.analysis).toEqual(m);
  });
});
