import { describe, expect, test } from "bun:test";
import { makeSearchFoodDbTool } from "./foodDb.ts";
import { buildFoodIndex, type FoodRow } from "../../food_db.ts";

const ROWS: FoodRow[] = [
  { id: "usda:170287", name: "Bulgur, cooked", kcal: 83, protein_g: 3.1, carbs_g: 18.6, fat_g: 0.2,
    fiber_g: 4.5, sodium_mg: 5 },
  { id: "usda:169700", name: "Couscous, cooked", kcal: 112, protein_g: 3.8, carbs_g: 23.2, fat_g: 0.2,
    fiber_g: 1.4, sodium_mg: 5 },
  { id: "usda:170688", name: "Bulgur, dry", kcal: 342, protein_g: 12.3, carbs_g: 75.9, fat_g: 1.3 },
];
const tool = makeSearchFoodDbTool(buildFoodIndex(ROWS));

/**
 * Mastra validates against inputSchema before execute, so the tests go through the same gate.
 * Cast because Mastra wraps the zod schema in its own StandardSchema type, which does not surface
 * `.parse` — the underlying schema is still zod's.
 */
const schema = tool.inputSchema as unknown as { parse(v: unknown): unknown; shape: object };
const run = async (input: unknown) => {
  const parsed = schema.parse(input);
  return (await (tool as any).execute(parsed)) as {
    candidates: { food_id: string; name: string; per_100g: Record<string, number> }[];
  };
};

describe("search_food_db", () => {
  test("returns rows to choose from, with per-100g figures", () => {
    return run({ queries: ["bulgur, cooked"] }).then((out) => {
      const row = out.candidates.find((c) => c.food_id === "usda:170287")!;
      expect(row.per_100g.kcal).toBe(83);
      expect(row.per_100g.fiber_g).toBe(4.5);
    });
  });

  test("SEVERAL queries is the point — one name cannot reach a confusable food", async () => {
    // Query "couscous" alone returns couscous rows and nothing else, so an agent that misread the
    // grain could never be shown the right row. Naming the alternative is what puts it in play.
    const alone = await run({ queries: ["couscous"] });
    expect(alone.candidates.map((c) => c.food_id)).not.toContain("usda:170287");

    const both = await run({ queries: ["couscous", "bulgur"] });
    const ids = both.candidates.map((c) => c.food_id);
    expect(ids).toContain("usda:169700");
    expect(ids).toContain("usda:170287");
  });

  test("deduplicates across queries", async () => {
    const out = await run({ queries: ["bulgur", "bulgur, cooked"] });
    const ids = out.candidates.map((c) => c.food_id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test("an unknown food returns an EMPTY list, never a near miss", async () => {
    // The escape hatch. A chosen row carries a food_id and reads as verified from then on, so a
    // confidently wrong row is worse than an admitted guess.
    const out = await run({ queries: ["tiramisu"] });
    expect(out.candidates).toEqual([]);
  });

  test("respects the cooking-state guard — dry bulgur is not offered for cooked", async () => {
    // 342 kcal against 83 is a 4.2x error, larger than anything grounding exists to fix.
    const out = await run({ queries: ["bulgur, cooked"] });
    expect(out.candidates.map((c) => c.food_id)).not.toContain("usda:170688");
  });

  test("the input schema carries NO user identifier", () => {
    // Constitutional: a tool must never let a model name whose data it wants. Trivially satisfied
    // here since the table is not user data, and asserted anyway so it stays that way.
    const shape = Object.keys(schema.shape);
    expect(shape.sort()).toEqual(["limit", "queries"]);
  });

  test("bounds the response — one call cannot return a slice of the whole table", () => {
    expect(() => schema.parse({ queries: ["x"], limit: 999 })).toThrow();
    expect(() => schema.parse({ queries: [] })).toThrow();
    expect(() => schema.parse({ queries: ["a", "b", "c", "d", "e"] })).toThrow();
  });
});
