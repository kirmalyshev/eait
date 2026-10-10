// One line of a fooddb snapshot export, as a `food_ref` row.
//
// fooddb's export is the product shape: every field `{value, source, licence, record}` and nutrients
// under `per_100` keyed by INFOODS tagname. eait keeps only the generic-food sources its schema
// names (`FOOD_SOURCE_IDS`); a line from any other source is skipped here rather than stored under a
// licence nobody has read. Barcoded products (the OFF layer) are not generic foods and are skipped.

import type { FoodRef, FoodSource } from "@eait/shared";

/** fooddb's source name -> the `food_ref.source` it is stored under. `fdc` is SR Legacy and Foundation. */
const SOURCES: Record<string, FoodSource> = { fdc: "usda-sr", ciqual: "ciqual", frida: "frida", matvaretabellen: "matvaretabellen" };

type Tagged<T> = { value: T; record?: string | null } | null | undefined;
interface Nutrient { value: number; unit: string; basis: string }
export interface SnapshotLine {
  name?: (Tagged<string> & { source?: string }) | null;
  lang?: Tagged<string>;
  category?: Tagged<string>;
  gtin14?: unknown[];
  per_100?: Record<string, Nutrient>;
  /** The texts every contributing source asks to be shown — `{source, licence, text}` per source. */
  attribution?: { text?: string }[];
}

/** The per-100 g figure for a tagname, or null: a 100 ml basis is not grams and a missing one is not zero. */
const per100 = (line: SnapshotLine, ...tags: string[]): number | null => {
  for (const t of tags) {
    const n = line.per_100?.[t];
    if (n && n.basis === "100g" && typeof n.value === "number" && Number.isFinite(n.value)) return n.value;
  }
  return null;
};

export function foodRefFromSnapshotLine(line: SnapshotLine): FoodRef | null {
  const source = line.name?.source ? SOURCES[line.name.source] : undefined;
  const name = line.name?.value?.trim();
  const record = line.name?.record;
  if (!source || !name || !record || (line.gtin14?.length ?? 0) > 0) return null;
  const english = line.lang?.value === "en";
  return {
    id: `${source}:${record.slice(record.indexOf(":") + 1)}`,
    source,
    name,
    name_de: null,
    name_en: english ? name : null,
    names: english ? {} : { [line.lang?.value ?? "und"]: name },
    category: line.category?.value ?? null,
    kcal_per_100g: per100(line, "ENERC_KCAL"),
    protein_g_per_100g: per100(line, "PROCNT"),
    carbs_g_per_100g: per100(line, "CHOCDF", "CHOAVL"),
    fat_g_per_100g: per100(line, "FAT"),
    satfat_g_per_100g: per100(line, "FASAT"),
    fiber_g_per_100g: per100(line, "FIBTG"),
    sugar_g_per_100g: per100(line, "SUGAR"),
    sodium_mg_per_100g: per100(line, "NA"),
    nutrients: {},
    portions: [],
    source_url: null,
    // Verbatim — a merged product can carry two sources' texts (frida + matvaretabellen, say),
    // and the client shows them exactly as the publisher worded them.
    attribution: (line.attribution ?? []).flatMap((a) =>
      typeof a?.text === "string" && a.text !== "" ? [a.text] : []),
  };
}
