import { describe, expect, test } from "bun:test";
import { memoryStore } from "../store.memory.ts";
import { loadSnapshotText } from "./snapshot-load.ts";

const line = (record: string, name: string, source = "fdc") => JSON.stringify({
  name: { value: name, source, record: `${source}:${record}` }, lang: { value: "en" }, gtin14: [],
  per_100: { ENERC_KCAL: { value: 52, unit: "kcal", basis: "100g" }, PROCNT: { value: 0.3, unit: "g", basis: "100g" },
    CHOCDF: { value: 14, unit: "g", basis: "100g" }, FAT: { value: 0.2, unit: "g", basis: "100g" } },
});

describe("loading a snapshot's text into food_ref", () => {
  test("writes the rows eait keeps, counts the lines it read, and skips the rest", async () => {
    const store = memoryStore();
    const text = [line("1", "Apples, raw"), line("2", "Seaweed", "mext"), "", line("3", "Pears, raw")].join("\n");
    expect(await loadSnapshotText(store, text)).toEqual({ read: 3, written: 2 });
    expect((await store.foodCandidates(["apple"], 5)).map((f) => f.id)).toEqual(["usda-sr:1"]);
  });
  test("is idempotent: the same text twice leaves the same rows", async () => {
    const store = memoryStore();
    const text = line("1", "Apples, raw");
    await loadSnapshotText(store, text);
    await loadSnapshotText(store, text);
    expect((await store.foodCandidates(["apple"], 5)).length).toBe(1);
  });
  test("batches: more rows than one batch all land", async () => {
    const store = memoryStore();
    const text = Array.from({ length: 1203 }, (_, i) => line(String(i), `Zed${i} food`)).join("\n");
    expect((await loadSnapshotText(store, text)).written).toBe(1203);
  });
});
