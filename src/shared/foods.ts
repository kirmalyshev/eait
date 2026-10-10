// The reference food catalog: generic foods and barcoded products, and where each row came from.
//
// Two tables, two shapes of food. `food_ref` is the GENERIC catalog — whole foods and staples from
// the national nutrient tables (BLS for Germany first, CIQUAL/Frida/FCDB as fallbacks, USDA for
// what the European tables do not cover). `off_product` is the BARCODED layer — packaged products
// from the Open Food Facts dump, plus rows our own label-read pipeline will write back.
//
// NEITHER TABLE IS A USER'S DATA. They carry no `user_id`, sit outside the row-level policies like
// `llm_prompts`, and the store methods over them are `unscoped` in SCOPE for that reason.
//
// LICENCES ARE PART OF THE SHAPE. Every row names its `source`, and `FOOD_ATTRIBUTION` names the
// citation each source requires — CC BY for the national tables, ODbL for Open Food Facts, whose
// terms want "Contains data from Open Food Facts…" and a link back wherever the data is shown.
// `foodAttributions()` resolves the citation list for a set of results, so the surface that renders
// them never has to know which source is ODbL and which is not.

/** One nutrient value as the source published it — per 100 g of edible portion, `u` its unit. */
export interface FoodNutrient {
  v: number;
  u: string;
}

/** A named serving — "1 slice", "1 cup" — with its weight in grams. What a diary entry needs. */
export interface FoodPortion {
  label: string;
  grams: number;
}

/**
 * The generic-food sources `food_ref` holds, as the `source` column spells them.
 *
 * The list is WRITTEN OUT rather than open text so the licences it carries stay enumerable:
 * `fcdb` is in it before its first row exists because Switzerland's FCDB asks for written
 * permission before commercial use and the schema must be ready before the email lands. `curated`
 * is the same kind of placeholder — the hand-maintained restaurant-chain table the sourcing
 * research leaves room for, one row per published item.
 */
export const FOOD_SOURCE_IDS = [
  "bls", "ciqual", "frida", "fcdb", "matvaretabellen",
  "usda-foundation", "usda-sr", "usda-fndds",
  "curated",
] as const;
export type FoodSource = (typeof FOOD_SOURCE_IDS)[number];

/**
 * The sources a meal item's `ref` can point at today, each named once with its licence (#562).
 *
 * These are the four sources fooddb's snapshot publishes (snapshot.ts's `SOURCES` admits nothing
 * else), a subset of `FOOD_SOURCE_IDS` — the schema's other ids are placeholders and fallbacks no
 * snapshot has ever written. A surface that names a source reads this; a `ref` prefix absent from
 * it is a source nothing here has met, to be shown unnamed rather than invented.
 */
export const FOOD_SOURCES: Partial<Record<FoodSource, { name: string; licence: string }>> = {
  "usda-sr": { name: "USDA FoodData Central", licence: "CC0-1.0" },
  ciqual: { name: "CIQUAL", licence: "etalab-2.0" },
  matvaretabellen: { name: "Matvaretabellen", licence: "NLOD-2.0" },
  frida: { name: "Frida", licence: "CC-BY-4.0" },
};

/**
 * Where an `off_product` row came from.
 *
 * `off` is the Open Food Facts nightly dump. `label-ocr` is the write-back path: a phone reads a
 * label the catalog does not have (or has empty), the parsed result lands here, and the next scan
 * of the same barcode is a hit instead of another OCR — the reason the table is keyed on barcode
 * and the row carries a provenance flag rather than assuming the dump wrote it.
 */
export const PRODUCT_SOURCES = ["off", "label-ocr"] as const;
export type ProductSource = (typeof PRODUCT_SOURCES)[number];

/**
 * One generic food: the catalog row, the wire shape and the store row are the same object.
 *
 * The eight macro columns are what `MealAnalysis` carries — a catalog row can become a meal item
 * without a unit conversation first. They are NULLABLE on purpose: sources differ in completeness
 * (BLS publishes 138 nutrients per food, a label photo may carry four), and a missing figure must
 * read as missing rather than as zero.
 */
export interface FoodRef {
  /** `<source>:<the source's own code>` — `bls:C131000`, `usda-fndds:2345187`. */
  id: string;
  source: FoodSource;
  /** The source's primary-language name — German for BLS, French for CIQUAL, English for USDA. */
  name: string;
  /** The German and English names where the source carries them — the columns search matches. */
  name_de: string | null;
  name_en: string | null;
  /** Names in any OTHER language the source publishes (FCDB's FR/IT, Frida's Danish). */
  names: Record<string, string>;
  category: string | null;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  satfat_g_per_100g: number | null;
  fiber_g_per_100g: number | null;
  sugar_g_per_100g: number | null;
  sodium_mg_per_100g: number | null;
  /**
   * The source's FULL nutrient vector, keyed by the source's own code — `FASAT` for BLS, `606` for
   * USDA — so no source's vocabulary is flattened into ours. `{}` when the row carries only macros.
   */
  nutrients: Record<string, FoodNutrient>;
  /** Named servings with weights — the FNDDS "1 slice"/"1 cup" table. `[]` when the source has none. */
  portions: FoodPortion[];
  /** A link back to the source's own record of this food, when it publishes one. */
  source_url: string | null;
  /**
   * The attribution texts the row's own sources ask for, verbatim, as fooddb's export line
   * publishes them. `[]` for a CC0 row; a merged product can carry more than one.
   */
  attribution: string[];
}

/**
 * The read-only copy of the `food_ref` row a meal item was grounded against (#562), stored WITH
 * the meal at the moment of grounding: a catalog refresh changes `food_ref` and never a stored
 * meal. Written by the server only — a client-sent `food` is discarded on every write.
 */
export interface FoodSnapshot {
  /** The row's name as `food_ref` has it — English for all four sources today. */
  name: string;
  /** The `ref` id's prefix, the row's `source`. */
  source: FoodSource;
  per100: { kcal: number; protein_g: number; carbs_g: number; fat_g: number };
  /** The row's own attribution texts, verbatim; `[]` for CC0. */
  attribution: string[];
}

/**
 * One barcoded product. `barcode` is the identity — GTIN digits with no separators — so the dump
 * ingest, the label-OCR write-back and the scan lookup all address the same row.
 *
 * Everything but the barcode is nullable or empty by design: a real OFF row may be little more
 * than a name and the seven label fields.
 */
export interface OffProduct {
  barcode: string;
  source: ProductSource;
  name: string;
  brand: string | null;
  /** Declared serving in grams, parsed from "15 g" / "1 Stück (30 g)". */
  serving_g: number | null;
  /** Declared package size in grams (OFF `product_quantity`). */
  package_g: number | null;
  kcal_per_100g: number | null;
  protein_g_per_100g: number | null;
  carbs_g_per_100g: number | null;
  fat_g_per_100g: number | null;
  satfat_g_per_100g: number | null;
  fiber_g_per_100g: number | null;
  sugar_g_per_100g: number | null;
  sodium_mg_per_100g: number | null;
  /** Nutri-Score a–e as OFF carries it, or null. */
  nutriscore: string | null;
  /** NOVA processing group 1–4, or null. */
  nova_group: number | null;
  ingredients: string | null;
  image_url: string | null;
  /**
   * What the row keeps of the source beyond the columns above — the OFF record's raw `nutriments`
   * and category tags. `{}` for a label-OCR row, whose parse is the columns themselves.
   */
  data: Record<string, unknown>;
}

/**
 * The citation a surface must show beside a source's data — `source` to name the database,
 * `citation` the words its licence asks for, `url` the link-back.
 */
export interface FoodAttribution {
  source: string;
  citation: string;
  url: string;
}

/**
 * The citation a surface must show beside a source's data.
 *
 * CC BY (BLS, Frida) and Etalab (CIQUAL) ask for the publisher's name; ODbL (Open Food Facts) asks
 * for the sentence and the link; the USDA sets are CC0 and take none, so they are absent — as is
 * `label-ocr`, which is our own read of somebody's label. `undefined` therefore means "no citation
 * owed", not "forgot to write one".
 */
export const FOOD_ATTRIBUTION: Partial<Record<FoodSource | ProductSource, FoodAttribution>> = {
  bls: {
    source: "bls",
    citation: "Max Rubner-Institut (2025): Bundeslebensmittelschlüssel (BLS), Version 4.0 — Deutsche Nährstoffdatenbank, Karlsruhe",
    url: "https://blsdb.de",
  },
  ciqual: {
    source: "ciqual",
    citation: "ANSES — Table de composition nutritionnelle Ciqual 2025",
    url: "https://doi.org/10.57745/RDMHWY",
  },
  frida: {
    source: "frida",
    citation: "© Frida Food Data (frida.fooddata.dk), version 5.5",
    url: "https://frida.fooddata.dk",
  },
  matvaretabellen: {
    source: "matvaretabellen",
    citation: "Matvaretabellen, Mattilsynet (Norwegian Food Safety Authority). Licensed under the Norwegian Licence for Open Government Data (NLOD) 2.0",
    url: "https://www.matvaretabellen.no",
  },
  fcdb: {
    source: "fcdb",
    citation: "Swiss Food Composition Database — FSVO. Written permission required before commercial use.",
    url: "https://naehrwertdaten.ch",
  },
  off: {
    source: "off",
    citation: "Contains data from Open Food Facts, available under the Open Database License",
    url: "https://world.openfoodfacts.org",
  },
};

/** The citations the data in `sources` owes — each once, in list order. */
export const foodAttributions = (sources: Iterable<string>) =>
  [...new Set(sources)].map((s) => FOOD_ATTRIBUTION[s as keyof typeof FOOD_ATTRIBUTION]).filter((a) => a !== undefined);

/**
 * A barcode as the catalog keys it: digits with separators stripped.
 *
 * EAN-8 through GTIN-14 all land in 6–14 digits; anything else — a label, a UUID, a shot with an
 * ISBN — is not a product code and answers null rather than querying on garbage. The client uses
 * the same normalizer before it asks, so "04 00344 00334 5" and "0400344003345" hit the same row.
 */
export function normalizeBarcode(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const digits = value.replace(/[\s-]/g, "");
  return /^[0-9]{6,14}$/.test(digits) ? digits : null;
}
