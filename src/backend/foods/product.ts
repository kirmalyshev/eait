// A resolved fooddb product as an `off_product` row.
//
// `include=off` can resolve a barcode to a product a CORE record names — an fdc branded row
// carries a GTIN like an OFF one — so `source` is never a blanket "off": it is the naming
// record's source, mapped the way the snapshot loader maps it. Except that ANY served field or
// nutrient coming back off-sourced makes the row "off" — ODbL wants its credit wherever OFF data
// is shown, and a merged product's full provenance stays in `data` (the whole resolved product,
// exactly as fooddb answered it).
//
// A product whose name nobody served is no product a scanner can use, and a source the table
// cannot name (mext, tfda — fooddb's, not this schema's) is a miss rather than a stored lie.

import type { OffProduct, ProductSource } from "@eait/shared";
import { per100 } from "./snapshot.ts";
import type { ResolvedProduct } from "./product-api.ts";

/** fooddb's record source -> the `off_product.source` it is stored under. `fdc` is Branded Products. */
const SOURCES: Record<string, ProductSource> = {
  fdc: "usda-branded",
  bls: "bls", ciqual: "ciqual", cofid: "cofid", fineli: "fineli",
  frida: "frida", matvaretabellen: "matvaretabellen",
};

export function offProductFromResolved(barcode: string, item: ResolvedProduct): OffProduct | null {
  const name = item.name?.value?.trim();
  if (!name) return null;
  const served = new Set(
    [item.name, item.brand, item.lang, item.serving_text, item.serving_g, item.category, item.flags,
     ...(item.gtin14 ?? []), ...Object.values(item.per_100 ?? {})]
      .map((t) => t?.source)
      .filter((s): s is string => s !== undefined && s !== ""),
  );
  const namedBy = item.name?.record?.split(":")[0] ?? item.name?.source;
  const source = served.has("off") ? "off" : namedBy !== undefined ? SOURCES[namedBy] : undefined;
  if (source === undefined) return null;
  return {
    barcode,
    source,
    name,
    brand: item.brand?.value ?? null,
    serving_g: typeof item.serving_g?.value === "number" && Number.isFinite(item.serving_g.value)
      ? item.serving_g.value : null,
    package_g: null,
    kcal_per_100g: per100(item.per_100, "ENERC_KCAL"),
    protein_g_per_100g: per100(item.per_100, "PROCNT"),
    carbs_g_per_100g: per100(item.per_100, "CHOCDF", "CHOAVL"),
    fat_g_per_100g: per100(item.per_100, "FAT"),
    satfat_g_per_100g: per100(item.per_100, "FASAT"),
    fiber_g_per_100g: per100(item.per_100, "FIBTG"),
    sugar_g_per_100g: per100(item.per_100, "SUGAR"),
    sodium_mg_per_100g: per100(item.per_100, "NA"),
    // The resolver does not serve nutriscore, NOVA, ingredients, an image or a package size:
    // fooddb keeps what it needs to resolve, and the row stays honestly empty where it is silent.
    nutriscore: null,
    nova_group: null,
    ingredients: null,
    image_url: null,
    data: item as Record<string, unknown>,
  };
}
