// One line of a fooddb snapshot export, as a `food_ref` row.
//
// fooddb's export is the product shape: every field `{value, source, licence, record}` and nutrients
// under `per_100` keyed by INFOODS tagname. eait keeps only the generic-food sources its schema
// names (`FOOD_SOURCE_IDS`); a line from any other source is skipped here rather than stored under a
// licence nobody has read. Barcoded products (the OFF layer) are not generic foods and are skipped.

import type { FoodRef, FoodSource } from "@eait/shared";

/** fooddb's source name -> the `food_ref.source` it is stored under. `fdc` is SR Legacy and Foundation. */
const SOURCES: Record<string, FoodSource> = {
  fdc: "usda-sr",
  bls: "bls", ciqual: "ciqual", cofid: "cofid", fineli: "fineli", frida: "frida", matvaretabellen: "matvaretabellen",
  recipe: "recipe",
  // fooddb also publishes mext (ja names) and tfda (zh-TW names): neither carries an English name
  // the matcher could ever reach, so a stored row would be dead weight — they stay out on purpose.
};

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
export const per100 = (
  per_100: Record<string, { value?: number; unit?: string; basis?: string }> | undefined,
  ...tags: string[]
): number | null => {
  for (const t of tags) {
    const n = per_100?.[t];
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
  // A recipe dish ships one record per language — `recipe:plov` in English, `recipe:plov.ru` in
  // Russian. The twin is not a second row: the matcher only ever reaches `name_en`, and folding
  // its name into the English record's `name` would take a cross-line merge this per-line map
  // cannot express — under a plain upsert, whichever line the export ordered last would win.
  if (source === "recipe" && !english) return null;
  return {
    id: `${source}:${record.slice(record.indexOf(":") + 1)}`,
    source,
    name,
    name_de: null,
    name_en: english ? name : null,
    names: english ? {} : { [line.lang?.value ?? "und"]: name },
    category: line.category?.value ?? null,
    kcal_per_100g: per100(line.per_100, "ENERC_KCAL"),
    protein_g_per_100g: per100(line.per_100, "PROCNT"),
    carbs_g_per_100g: per100(line.per_100, "CHOCDF", "CHOAVL"),
    fat_g_per_100g: per100(line.per_100, "FAT"),
    satfat_g_per_100g: per100(line.per_100, "FASAT"),
    fiber_g_per_100g: per100(line.per_100, "FIBTG"),
    sugar_g_per_100g: per100(line.per_100, "SUGAR"),
    sodium_mg_per_100g: per100(line.per_100, "NA"),
    nutrients: {},
    portions: [],
    source_url: null,
    // Verbatim — a merged product can carry two sources' texts (frida + matvaretabellen, say),
    // and the client shows them exactly as the publisher worded them.
    attribution: (line.attribution ?? []).flatMap((a) =>
      typeof a?.text === "string" && a.text !== "" ? [a.text] : []),
  };
}
