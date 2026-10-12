// The lean photo answer's item shape (ieat-app#1989, eait#607): per item only a name, the
// canonical English name, grams and the food's energy density — none of the per-item macros
// `MealItemSchema` asks for. `itemScanner` (`partial.ts`) accepts it as a fallback so a streamed
// row the full schema refuses still reaches the pending card: the L1 prompt measures shorter
// precisely because it prices no item.

import { z } from "zod";
import type { MealItem } from "@eait/shared";

export const LeanItemSchema = z.object({
  name: z.string().min(1),
  name_en: z.string().min(1),
  grams: z.number().nonnegative(),
  kcal_per_100g: z.number().nonnegative(),
  role: z.enum(["cooking-fat"]).optional(),
});

/**
 * One streamed lean item as the `MealItem` the wire already carries (#607): kcal priced from the
 * density, and NO macros — the shared type marks them optional exactly so a row can be sent before
 * they exist.
 */
export function leanStreamItem(i: z.infer<typeof LeanItemSchema>): MealItem {
  return { ...i, kcal: Math.round((i.grams * i.kcal_per_100g) / 100) };
}
