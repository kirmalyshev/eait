// The in-memory index behind `Store.foodCandidates` (#615).
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

import type { FoodRef } from "@eait/shared";

const words = (s: string): string[] => s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 1);

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
  const postings = new Map<string, Set<string>>();

  const unindex = (id: string) => {
    for (const t of tokensOf.get(id) ?? []) postings.get(t)?.delete(id);
    tokensOf.delete(id);
  };
  const index = (f: FoodRef) => {
    if (!complete(f)) return;
    unindex(f.id);
    const tokens = [...new Set(words(f.name_en!).flatMap(variants))];
    tokensOf.set(f.id, tokens);
    for (const t of tokens) {
      let p = postings.get(t);
      if (!p) postings.set(t, (p = new Set()));
      p.add(f.id);
    }
    byId.set(f.id, f);
  };
  for (const f of rows) index(f);

  return {
    get size() {
      return byId.size;
    },
    upsert(rows) {
      for (const f of rows) {
        if (!complete(f)) { byId.delete(f.id); unindex(f.id); continue; }
        index(f);
      }
    },
    candidates(words, limit) {
      if (words.length === 0) return [];
      const sets = words.map((w) => {
        const hits = new Set<string>();
        for (const v of variants(w.toLowerCase())) for (const id of postings.get(v) ?? []) hits.add(id);
        return hits;
      });
      if (sets.some((s) => s.size === 0)) return [];
      sets.sort((a, b) => a.size - b.size);
      const [first, ...rest] = sets as [Set<string>, ...Set<string>[]];
      const out: FoodRef[] = [];
      for (const id of first) {
        if (rest.every((s) => s.has(id))) out.push(byId.get(id)!);
      }
      out.sort((a, b) => a.name_en!.length - b.name_en!.length || (a.name_en! < b.name_en! ? -1 : 1));
      return out.slice(0, limit);
    },
  };
}
