// The in-memory index behind `Store.foodCandidates` (#615), plus the name analysis the matcher
// shares with it.
//
// Grounding asks the catalog which row a recognised name should read its density from, and it
// asks that once per item per meal. As a SQL `~* all(...)` over `food_ref` that was a transaction
// per item — 30-50 ms a meal through the pool — so the rows live here instead: an inverted index
// from each name token (and its plural spellings) to the rows carrying it. The store is consulted
// only to build or refresh the index.
//
// THE CONTRACT IS THE OLD QUERY'S, kept word for word: an English name carrying EVERY word, as a
// whole word or a plural, all four macros present, shortest name first then alphabetical. The
// ranking between candidates is the engine's (`engine/ground.ts`); this bounds the pool. Both
// store implementations answer through THIS code, so memory and Postgres cannot drift apart.
//
// `analyzeFoodRow` precomputes the facts about a row name that never change while the name does
// not (tokens, canonical forms, prep states, head, brand caps). It runs EAGERLY for every indexed
// row — a fresh index pays it once at build — so a lookup that touches a row for the first time
// is still a Map read, keeping the per-item cost under a millisecond even on cold rows.

import type { FoodRef } from "@eait/shared";

export const words = (s: string): string[] => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);
/** For COMPARING words only ("apple" = "apples", "tomatoes" = "tomato"): the lookup keeps words whole. */
export const stem = (w: string) => w.replace(/ies$/, "y").replace(/es$/, "").replace(/s$/, "").replace(/e$/, "");
export const singular = (w: string) => (w.length > 3 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w);
/** One canonical form per word, both sides: "cheese" = "cheeses" = "cherries" = "cherry". */
export const norm = (w: string) => stem(w.endsWith("ies") && w.length > 3 ? `${w.slice(0, -3)}y` : singular(w));

/**
 * The spellings a token is indexed under: itself plus its singular guesses, so "noodles" answers
 * "noodle" and "tomatoes" answers "tomato". Both forms on the "es" words ("tomatoes" -> "tomato",
 * "noodles" -> "noodle") because either can be the dictionary spelling.
 */
const variants = (t: string): string[] => {
  if (t.length <= 3) return [t];
  if (t.endsWith("ies")) return [t, `${t.slice(0, -3)}y`];
  if (t.endsWith("es")) return [t, t.slice(0, -2), t.slice(0, -1)];
  if (t.endsWith("s") && !t.endsWith("ss")) return [t, t.slice(0, -1)];
  return [t];
};

/** Preparation-state words the matcher treats specially rather than as name content. */
export const STATES = new Set([
  "raw", "cooked", "roasted", "fried", "grilled", "broiled", "boiled", "baked", "toasted", "steamed",
  "stewed", "smoked", "braised", "mashed", "uncooked", "dry",
]);
/** Acronyms the catalog writes in caps that are not a brand. */
const NOT_BRAND = new Set(["usda", "nlea", "dha", "ara", "uht", "usa", "bbq"]);

// ── The name lexicon ──
//
// The scoring weights live in `engine/ground.ts`; the WORD CLASSES live here so the analysis each
// row carries already says which of its words are descriptor filler, a product made from the food,
// a sales form, a portion, or a substitute — a query only has to test membership, not classify.

/** USDA's descriptive filler ("Chicken, broilers or fryers, ... meat only"): length without meaning. */
export const FILLER = new Set([
  "broilers", "or", "fryers", "meat", "only", "skin", "boneless", "skinless", "with", "without", "separable", "lean",
  "fat", "trimmed", "all", "grades", "choice", "select", "retail", "cuts", "fresh", "unprepared", "cooked", "oven",
  "pan", "whole", "commercial", "bone", "small", "large", "medium", "regular", "generic", "type", "from", "not",
  "enriched", "unenriched", "includes", "eaten", "prepared", "recipe", "using", "home", "sweet",
  "drained", "salt", "added",
]);
/** A word describing a PORTION of the food — the fat or the skin — not the food, unless asked. */
export const PORTION = new Set(["fat", "skin"]);
/**
 * A word that makes the row a product made FROM the food, or another dish entirely — the row is
 * not a match at all unless the name said the word. "Olive oil" is not olives, "Rice pudding" is
 * not rice, "Chicken soup" is not chicken.
 */
export const PRODUCT = new Set([
  "tart", "jelly", "pudding", "sandwich", "sandwiches", "pie", "soup", "nectar", "juice", "babyfood",
  "formula", "cake", "cookie", "cookies", "cereal", "drink", "beverage", "candy", "candies",
  "dessert", "pastry", "pastries", "bar", "yogurt", "oil", "oils", "relish", "chips",
  "crisps", "fries", "greens", "sauce", "gravy", "broth", "stock", "stew", "jam", "marmalade",
  "syrup", "spread", "dip", "dressing", "mayonnaise", "margarine", "flour", "starch", "powder",
  "extract", "supplement", "wine", "beer", "alcohol", "liqueur", "cider", "sausage", "loaf",
  "pizza", "wrap", "burrito", "taco", "quesadilla", "pancake", "waffle", "muffin", "bread",
  "fritter", "nuggets", "smoothie", "shake", "pasta",
  "noodles", "rice", "cracker", "crackers", "stick", "sticks", "mix", "bun",
]);
/** A word that marks the row a composite or a sales form: a penalty, not a refusal. */
export const COMPOSITE = new Set([
  "dried", "canned", "restaurant", "frozen", "snack", "flavor", "kit",
  "spray", "prepacked", "french", "school", "lunch", "burger", "salad", "milk",
  "cream", "cheese", "butter", "cured", "breakfast", "strips",
]);
/** Never a match for a food that did not name it. */
export const SUBSTITUTE = /\b(meatless|vegetarian|vegan|imitation|analog|substitute)\b/i;

export interface RowAnalysis {
  words: string[]; stems: string[]; states: string[];
  headParts: string[] | null; headStem: string | null;
  caps: string[];
  /** Canonical stems of the row's non-state words, pre-classified for the scorer. */
  fillers: string[]; others: string[]; products: string[]; composites: string[]; portions: string[];
  substitute: boolean;
}

/**
 * The facts about a row name, computed once per `id\nname` pair. A pure function of the name, so
 * the cache is shared across every index instance — a rebuilt index, a cloned row and the memory
 * store all hit the same entries.
 */
const analysisByKey = new Map<string, RowAnalysis>();
export function analyzeFoodRow(f: FoodRef): RowAnalysis {
  const name = f.name_en ?? f.name;
  const key = `${f.id}\n${name}`;
  const hit = analysisByKey.get(key);
  if (hit) return hit;
  const rowWords = words(name);
  const headToken = name.trim().split(/[\s,;:()]+/)[0] ?? "";
  const a: RowAnalysis = {
    words: rowWords,
    stems: rowWords.map(norm),
    states: rowWords.filter((t) => STATES.has(t)),
    headParts: headToken.includes("-")
      ? headToken.toLowerCase().split("-").filter((p) => p.length > 1) : null,
    headStem: headToken.includes("-") ? null : norm(headToken.toLowerCase()),
    caps: name.split(/[^\p{L}\p{N}]+/u)
      .filter((t) => t.length >= 3 && /[A-Z]{2,}/.test(t) && !NOT_BRAND.has(t.toLowerCase()))
      .map((t) => norm(t.toLowerCase())),
    fillers: [], others: [], products: [], composites: [], portions: [],
    substitute: SUBSTITUTE.test(name),
  };
  for (let i = 0; i < rowWords.length; i++) {
    const w = rowWords[i]!;
    if (STATES.has(w)) continue;
    const t = a.stems[i]!;
    if (PRODUCT.has(w)) a.products.push(t);
    if (COMPOSITE.has(w)) a.composites.push(t);
    if (PORTION.has(w)) a.portions.push(t);
    if (FILLER.has(w)) a.fillers.push(t); else a.others.push(t);
  }
  analysisByKey.set(key, a);
  return a;
}

const complete = (f: FoodRef): boolean =>
  f.name_en !== null && f.kcal_per_100g !== null && f.protein_g_per_100g !== null
  && f.carbs_g_per_100g !== null && f.fat_g_per_100g !== null;

export interface FoodIndex {
  /** The rows whose English name carries every `words` entry, shortest name first. */
  candidates(words: string[], limit: number): FoodRef[];
  /** Add or replace rows by `id`. What `putFoodRefs` feeds the index. */
  upsert(rows: FoodRef[]): void;
  /** The rows the index holds (only complete, English-named ones count). */
  readonly size: number;
}

export function buildFoodIndex(rows: FoodRef[]): FoodIndex {
  const byId = new Map<string, FoodRef>();
  const tokensOf = new Map<string, string[]>();
  // Postings are positions into `ordered` — the catalog sorted shortest-name-first — so a lookup
  // merges already-sorted rank lists and stops at `limit`, never sorting a hit set per query.
  // `ordered`/`postings` are rebuilt lazily once after an upsert instead of per row.
  let ordered: FoodRef[] = [];
  let postings = new Map<string, number[]>();
  let dirty = true;

  const rebuild = () => {
    ordered = [...byId.values()].sort((a, b) =>
      a.name_en!.length - b.name_en!.length || (a.name_en! < b.name_en! ? -1 : 1));
    postings = new Map();
    // Walk `ordered` itself so every posting list is ascending in result order.
    ordered.forEach((f, i) => {
      for (const t of tokensOf.get(f.id) ?? []) {
        let p = postings.get(t);
        if (!p) postings.set(t, (p = []));
        p.push(i);
      }
    });
    dirty = false;
  };

  const unindex = (id: string) => { tokensOf.delete(id); };
  const index = (f: FoodRef) => {
    if (!complete(f)) return;
    unindex(f.id);
    tokensOf.set(f.id, [...new Set(words(f.name_en!).flatMap(variants))]);
    // Candidates are shared objects now, not per-call clones: freeze so a caller mutating one
    // fails loudly instead of silently corrupting the catalog every other lookup reads.
    byId.set(f.id, Object.freeze(f));
    analyzeFoodRow(f);
    dirty = true;
  };
  for (const f of rows) index(f);
  // Build-time cost, not a lookup's: the first `candidates` after a rebuild is already warm.
  rebuild();

  /** A word's rows, in result order: the merge of its variant postings (each already sorted). */
  const postingUnion = (w: string): number[] | null => {
    const parts = variants(w).map((v) => postings.get(v) ?? []);
    if (parts.every((p) => p.length === 0)) return null;
    if (parts.filter((p) => p.length > 0).length === 1) return parts.find((p) => p.length > 0)!;
    const heads = parts.map(() => 0);
    const out: number[] = [];
    for (;;) {
      let best = -1, val = Infinity;
      for (let i = 0; i < parts.length; i++) {
        const p = parts[i]!, h = heads[i]!;
        if (h < p.length && p[h]! < val) { val = p[h]!; best = i; }
      }
      if (best < 0) break;
      if (out[out.length - 1] !== val) out.push(val);
      heads[best]!++;
    }
    return out;
  };

  return {
    get size() {
      return byId.size;
    },
    upsert(rows) {
      for (const f of rows) {
        if (!complete(f)) { if (byId.delete(f.id)) { unindex(f.id); dirty = true; } continue; }
        index(f);
      }
    },
    candidates(queryWords, limit) {
      if (queryWords.length === 0 || limit <= 0) return [];
      if (dirty) rebuild();
      const merged = queryWords.map((w) => postingUnion(w.toLowerCase()));
      if (merged.some((m) => !m || m.length === 0)) return [];
      merged.sort((a, b) => a!.length - b!.length);
      const [smallest, ...rest] = merged as [number[], ...number[][]];
      const others = rest.map((m) => new Set(m));
      const out: FoodRef[] = [];
      for (const r of smallest) {
        if (others.every((s) => s.has(r))) {
          out.push(ordered[r]!);
          if (out.length >= limit) break;
        }
      }
      return out;
    },
  };
}
