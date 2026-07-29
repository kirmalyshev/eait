import { describe, expect, test } from "bun:test";
import { buildRepertoire, REPERTOIRE_MAX } from "./repertoire.ts";

const meal = (names: string[], corrected = false) => ({
  items: names.map((name) => ({ name, grams: 100 })),
  corrected,
});

describe("buildRepertoire", () => {
  test("no history yields nothing — a new user must not get an empty prior line", () => {
    expect(buildRepertoire([])).toEqual([]);
    expect(buildRepertoire([meal([])])).toEqual([]);
  });

  test("ranks by how often a food was actually eaten", () => {
    const r = buildRepertoire([
      meal(["гречка"]), meal(["гречка"]), meal(["гречка"]),
      meal(["паста"]), meal(["паста"]),
      meal(["суп"]),
    ]);
    expect(r).toEqual(["гречка", "паста", "суп"]);
  });

  test("a CORRECTED meal outranks the model's own guesses", () => {
    // The whole point of the prior: a name the principal fixed by hand is verified ground truth,
    // and a name the model invented is not. One correction must beat a couple of unverified logs,
    // or the prior would keep re-teaching the model its own mistake.
    const r = buildRepertoire([
      meal(["кускус"]), meal(["кускус"]),
      meal(["булгур"], true),
    ]);
    expect(r[0]).toBe("булгур");
  });

  test("groups case- and whitespace-insensitively, but reports the commonest spelling", () => {
    const r = buildRepertoire([
      meal(["Гречка"]), meal(["гречка"]), meal(["  гречка  "]),
    ]);
    expect(r).toEqual(["гречка"]);
  });

  test("caps the list — a prior long enough to bury the photo is not a prior", () => {
    const many = Array.from({ length: REPERTOIRE_MAX + 10 }, (_, i) => meal([`food-${i}`]));
    expect(buildRepertoire(many).length).toBe(REPERTOIRE_MAX);
  });

  test("recency breaks a tie — rows arrive newest first", () => {
    // Equal counts, so what the user ate most recently wins. Without this the tie resolves on
    // insertion order by accident, and last year's habits would outrank this month's.
    const r = buildRepertoire([meal(["new"]), meal(["old"])]);
    expect(r).toEqual(["new", "old"]);
  });

  test("ignores blank and whitespace-only names", () => {
    expect(buildRepertoire([meal(["", "   ", "рис"])])).toEqual(["рис"]);
  });

  test("counts a food once per meal, not once per portion", () => {
    // Two helpings of rice in one meal is one data point about what this person eats. Counting
    // per item would let a single lasagne's six components dominate the whole prior.
    const r = buildRepertoire([meal(["рис", "рис", "рис"]), meal(["суп"]), meal(["суп"])]);
    expect(r).toEqual(["суп", "рис"]);
  });
});
