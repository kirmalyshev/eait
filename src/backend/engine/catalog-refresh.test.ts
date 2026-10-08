import { describe, expect, test } from "bun:test";
import { memoryStore } from "../store.memory.ts";
import type { EngineDeps } from "./deps.ts";
import { refreshCatalog } from "./catalog-refresh.ts";

const KEY = "fdb_secret_value";
const NDJSON = JSON.stringify({
  name: { value: "Apples, raw", source: "fdc", record: "fdc:1" }, lang: { value: "en" }, gtin14: [],
  per_100: { ENERC_KCAL: { value: 52, unit: "kcal", basis: "100g" }, PROCNT: { value: 0.3, unit: "g", basis: "100g" },
    CHOCDF: { value: 14, unit: "g", basis: "100g" }, FAT: { value: 0.2, unit: "g", basis: "100g" } },
}) + "\n";

const api = (days: { day: string; final: boolean }[], calls: string[] = []) => async (url: string) => {
  const path = new URL(url).pathname;
  calls.push(path);
  if (path === "/v1/snapshots") return Response.json({ items: days });
  if (path.endsWith("/export")) return new Response(NDJSON);
  return new Response("{}", { status: 404 });
};
const deps = () => ({ store: memoryStore() }) as unknown as EngineDeps;

describe("refreshing the catalog from fooddb", () => {
  test("without a key it does nothing and touches no network", async () => {
    const calls: string[] = [];
    const r = await refreshCatalog(deps(), { key: "", fetchFn: api([], calls) });
    expect(r).toEqual({ kind: "no-key" });
    expect(calls).toEqual([]);
  });

  test("loads the newest final day into food_ref", async () => {
    const d = deps();
    const r = await refreshCatalog(d, { key: KEY, fetchFn: api([{ day: "2026-10-08", final: false }, { day: "2026-10-07", final: true }]) });
    expect(r).toEqual({ kind: "loaded", day: "2026-10-07", read: 1, written: 1 });
    expect((await d.store.foodCandidates(["apple"], 5)).length).toBe(1);
  });

  test("a day it already loaded is not exported again; a newer one is", async () => {
    const calls: string[] = [];
    const days = [{ day: "2026-10-07", final: true }];
    const f = api(days, calls);
    const d = deps();
    const first = await refreshCatalog(d, { key: KEY, fetchFn: f });
    const again = await refreshCatalog(d, { key: KEY, fetchFn: f, lastDay: first.kind === "loaded" ? first.day : undefined });
    expect(again).toEqual({ kind: "unchanged", day: "2026-10-07" });
    expect(calls.filter((p) => p.endsWith("/export")).length).toBe(1);
    const next = await refreshCatalog(d, { key: KEY, fetchFn: api([{ day: "2026-10-08", final: true }, ...days]), lastDay: "2026-10-07" });
    expect(next).toMatchObject({ kind: "loaded", day: "2026-10-08" });
  });

  test("a failing fooddb is a result, not a throw, and the message never holds the key", async () => {
    const r = await refreshCatalog(deps(), { key: KEY, fetchFn: async () => new Response(`bad ${KEY}`, { status: 401 }) });
    expect(r.kind).toBe("failed");
    expect(JSON.stringify(r)).not.toContain(KEY);
  });
});
