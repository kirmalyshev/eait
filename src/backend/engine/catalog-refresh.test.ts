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

const api = (snapshots: { day: string; built_at: string }[], calls: string[] = [], exportStatus = 200) => async (url: string) => {
  const path = new URL(url).pathname;
  calls.push(path);
  if (path === "/v1/snapshots") return Response.json({ items: snapshots });
  if (path.endsWith("/export")) return new Response(exportStatus === 200 ? NDJSON : "{}", { status: exportStatus });
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

  test("loads the current snapshot into food_ref", async () => {
    const d = deps();
    const r = await refreshCatalog(d, { key: KEY, fetchFn: api([{ day: "2026-10-08", built_at: "2026-10-08T03:12:00Z" }]) });
    expect(r).toEqual({ kind: "loaded", day: "2026-10-08", built_at: "2026-10-08T03:12:00Z", read: 1, written: 1 });
    expect((await d.store.foodCandidates(["apple"])).length).toBe(1);
  });

  test("a built_at it already loaded is not exported again; a rebuilt one is", async () => {
    const calls: string[] = [];
    const snap = { day: "2026-10-08", built_at: "2026-10-08T03:12:00Z" };
    const f = api([snap], calls);
    const d = deps();
    const first = await refreshCatalog(d, { key: KEY, fetchFn: f });
    const again = await refreshCatalog(d, { key: KEY, fetchFn: f, lastBuiltAt: first.kind === "loaded" ? first.built_at : undefined });
    expect(again).toEqual({ kind: "unchanged", day: "2026-10-08", built_at: "2026-10-08T03:12:00Z" });
    expect(calls.filter((p) => p.endsWith("/export")).length).toBe(1);
    // The same day REBUILT is new data: built_at, not day, is the discriminator.
    const next = await refreshCatalog(d, { key: KEY, fetchFn: api([{ day: "2026-10-08", built_at: "2026-10-08T19:40:00Z" }]), lastBuiltAt: "2026-10-08T03:12:00Z" });
    expect(next).toMatchObject({ kind: "loaded", day: "2026-10-08", built_at: "2026-10-08T19:40:00Z" });
  });

  test("a snapshot whose export is already gone is a clean failure", async () => {
    const r = await refreshCatalog(deps(), { key: KEY, fetchFn: api([{ day: "2026-10-07", built_at: "2026-10-07T03:00:00Z" }], [], 404) });
    expect(r.kind).toBe("failed");
    expect(r.kind === "failed" && r.message).toMatch(/no such snapshot day/);
  });

  test("a failing fooddb is a result, not a throw, and the message never holds the key", async () => {
    const r = await refreshCatalog(deps(), { key: KEY, fetchFn: async () => new Response(`bad ${KEY}`, { status: 401 }) });
    expect(r.kind).toBe("failed");
    expect(JSON.stringify(r)).not.toContain(KEY);
  });
});
