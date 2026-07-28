import { describe, expect, test } from "bun:test";
import { checkConsistency, WITHIN } from "./consistency.ts";
import type { MealAnalysis } from "./types.ts";

/** A self-consistent meal: 20g protein + 40g carbs + 10g fat = 330 kcal, items summing to totals. */
function meal(over: Partial<MealAnalysis> = {}): MealAnalysis {
  return {
    isFood: true,
    items: [{ name: "rice", grams: 200, kcal: 330, protein_g: 20, carbs_g: 40, fat_g: 10 }],
    kcal: 330,
    protein_g: 20,
    carbs_g: 40,
    fat_g: 10,
    satfat_g: 2,
    fiber_g: 1,
    sugar_g: 1,
    sodium_mg: 5,
    plant_protein_pct: 100,
    verdicts: {},
    confidence: "medium",
    notes: "",
    ...over,
  };
}

describe("atwater", () => {
  test("a self-consistent meal reports nothing", () => {
    expect(checkConsistency(meal()).findings).toEqual([]);
  });

  test("catches macros that contradict the stated kcal", () => {
    // 20/40/10 is 330 kcal by Atwater. Claiming 600 is the failure the principal reported as
    // "proteins/fats wrong sometimes" — and today it ships to the card untouched.
    const { findings } = checkConsistency(meal({ kcal: 600 }));
    expect(findings.some((f) => f.kind === "atwater")).toBe(true);
  });

  test("tolerance is max(15 kcal, 25%) — the same rule the ground-truth table is held to", () => {
    // Fibre digests below 4 kcal/g and rounding moves everything, so this is a blunder detector,
    // not a precision check. The absolute floor lets low-calorie high-fibre meals pass; the
    // percentage still catches a transposed digit in a calorie-dense one.
    expect(WITHIN(100, 100)).toBe(true);
    expect(WITHIN(100, 114)).toBe(true); // +14 kcal, inside the 15 kcal floor
    expect(WITHIN(100, 130)).toBe(false); // +30 kcal, outside both floor and 25%
    expect(WITHIN(1000, 1200)).toBe(true); // +200 on 1000 is 20%, inside
    expect(WITHIN(1000, 1300)).toBe(false); // +300 is 30%, outside
  });

  test("a tiny meal is judged by the absolute floor, not the percentage", () => {
    // 10 kcal claimed against 20 kcal of macros is 100% off but only 10 kcal — noise, not a bug.
    const { findings } = checkConsistency(
      meal({ kcal: 10, protein_g: 5, carbs_g: 0, fat_g: 0, items: [] }),
    );
    expect(findings).toEqual([]);
  });
});

describe("item sum", () => {
  test("catches items that do not sum to the stated totals", () => {
    const { findings } = checkConsistency(
      meal({ items: [{ name: "rice", grams: 200, kcal: 100, protein_g: 20, carbs_g: 40, fat_g: 10 }] }),
    );
    expect(findings.some((f) => f.kind === "item_sum")).toBe(true);
  });

  test("items without per-item kcal are SKIPPED, never summed as zero", () => {
    // Every meal stored before A2 has bare items. Treating absent as 0 would report a 330 kcal
    // discrepancy on a perfectly good analysis — a false positive on the entire back catalogue.
    const { findings } = checkConsistency(meal({ items: [{ name: "rice", grams: 200 }] }));
    expect(findings).toEqual([]);
  });

  test("a PARTIALLY annotated item list is skipped too", () => {
    // Summing only the annotated items would under-count and fire on every mixed case. Either the
    // whole list carries kcal or the check has nothing to say.
    const { findings } = checkConsistency(
      meal({
        items: [
          { name: "rice", grams: 100, kcal: 165 },
          { name: "chicken", grams: 100 },
        ],
      }),
    );
    expect(findings.some((f) => f.kind === "item_sum")).toBe(false);
  });

  test("an empty item list says nothing about the totals", () => {
    expect(checkConsistency(meal({ items: [] })).findings).toEqual([]);
  });
});

describe("reporting shape", () => {
  test("a finding carries the numbers, so the log line is auditable without a re-run", () => {
    const { findings } = checkConsistency(meal({ kcal: 600 }));
    const f = findings.find((x) => x.kind === "atwater")!;
    expect(f.stated).toBe(600);
    expect(f.derived).toBe(330);
  });

  test("both checks can fire on the same meal", () => {
    const { findings } = checkConsistency(
      meal({ kcal: 600, items: [{ name: "rice", grams: 200, kcal: 100 }] }),
    );
    expect(findings.map((f) => f.kind).sort()).toEqual(["atwater", "item_sum"]);
  });

  test("checkConsistency NEVER mutates the analysis — phase 1 observes only", () => {
    // The action on a mismatch is deliberately undecided until the fire rate is known. Until then
    // this must not change a single number the user sees.
    const m = meal({ kcal: 600 });
    const before = structuredClone(m);
    checkConsistency(m);
    expect(m).toEqual(before);
  });
});
