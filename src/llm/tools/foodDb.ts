import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import type { FoodIndex } from "../../food_db.ts";

/**
 * `search_food_db` — the retrieve half of retrieve-then-select
 * (design: `docs/design/2026-07-27-analysis-quality.md`, D').
 *
 * The agent names a food, this returns the composition-table rows it could be, and the agent then
 * chooses one with the photo still in hand. That split exists because each side is good at what the
 * other cannot do: the matcher narrows 10,780 rows to a handful by string overlap, and only looking
 * at the picture separates bulgur from couscous — 83 kcal/100 g against 112, and 4.5 g of fibre
 * against 1.4.
 *
 * WHY IT TAKES SEVERAL QUERIES. Retrieval is driven by the name the agent produced, so asking for
 * one name can only ever return rows for that name: query "couscous" and the bulgur row is never in
 * the running, no matter how clearly the photo shows bulgur. Passing the alternatives alongside is
 * what puts the correct row on the shortlist at all — without it, grounding sharpens a
 * misidentification instead of correcting it.
 *
 * NO USER IDENTIFIER IN THE INPUT SCHEMA, and here that is free rather than fought for: the food
 * table is read-only reference data identical for everyone, with no user rows to reach. The rule
 * holds for every tool regardless (`src/llm/context.ts`), and a tool that never touches user data
 * is the wrong place to make an exception to it.
 *
 * An empty `candidates` array is a real answer, not a failure. It means the table does not contain
 * this food, and the honest response is to keep the agent's own estimate rather than force a choice
 * among rows that are all wrong — a chosen row carries a `food_id` and reads as verified from then
 * on, so a confident wrong row is worse than an admitted guess.
 */
export function makeSearchFoodDbTool(index: FoodIndex) {
  return createTool({
    id: "search_food_db",
    description:
      "Look up candidate composition-table rows for a food, to ground its per-100g nutrition in " +
      "published data instead of estimating it. Pass the food's canonical English name AND any " +
      "other names it could plausibly be — a similar-looking food is only reachable if you name " +
      "it here. Returns rows to choose from; an empty list means the table does not have this " +
      "food, and you should keep your own estimate rather than pick something close.",
    inputSchema: z.object({
      queries: z
        .array(z.string().min(1))
        .min(1)
        .max(4)
        .describe(
          "Canonical English food names, best guess first, then plausible alternatives. " +
            "e.g. [\"couscous\", \"bulgur\"] when the grain could be either.",
        ),
      // Bounded so one call cannot return a fraction of the table. A long list does not help the
      // choice — past a handful of rows the agent is picking from noise, and the response is being
      // paid for in tokens on every meal.
      limit: z.number().int().min(1).max(10).default(5)
        .describe("Maximum rows to return PER query."),
    }),
    execute: async (inputData) => {
      const { queries, limit } = inputData as { queries: string[]; limit: number };
      const seen = new Set<string>();
      const candidates = [];
      for (const q of queries) {
        for (const row of index.candidates(q, limit)) {
          // Deduplicated across queries: "couscous" and "bulgur" can legitimately surface the same
          // row, and offering it twice would read as two options that happen to be identical.
          if (seen.has(row.id)) continue;
          seen.add(row.id);
          candidates.push({
            food_id: row.id,
            name: row.name,
            per_100g: {
              kcal: row.kcal,
              protein_g: row.protein_g,
              carbs_g: row.carbs_g,
              fat_g: row.fat_g,
              ...(row.satfat_g === undefined ? {} : { satfat_g: row.satfat_g }),
              ...(row.fiber_g === undefined ? {} : { fiber_g: row.fiber_g }),
              ...(row.sugar_g === undefined ? {} : { sugar_g: row.sugar_g }),
              ...(row.sodium_mg === undefined ? {} : { sodium_mg: row.sodium_mg }),
            },
          });
        }
      }
      return { candidates };
    },
  });
}
