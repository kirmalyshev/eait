import { describe, expect, test } from "bun:test";
import { LANGS } from "../types.ts";
import { scoresAppCopy } from "./scores-copy.ts";
import { verdictNoun } from "../verdicts.ts";

describe("SCORES_APP_COPY — the Lingui-free half the web bundle may read (#145, W6)", () => {
  test("the breakdown's keys are present in every language", () => {
    for (const lang of LANGS) {
      const copy = scoresAppCopy(lang);
      expect(copy.startRow.length, `${lang}.startRow`).toBeGreaterThan(0);
      for (const [key, phs] of [
        ["partPctOfKcal", ["{n}"]],
        ["partGPer100Kcal", ["{n}"]],
        ["partMgSodiumPer100Kcal", ["{n}"]],
        ["partOfTargetG", ["{n}", "{target}"]],
        ["partOfTargetMg", ["{n}", "{target}"]],
      ] as const) {
        for (const ph of phs) expect(copy[key], `${lang}.${key}`).toContain(ph);
      }
      for (const limit of ["ldl", "kidneys", "lowsugar"] as const) {
        expect(copy.limits[limit].length, `${lang}.limits.${limit}`).toBeGreaterThan(0);
      }
    }
  });

  test("saturated fat is the verdict pill's noun, verbatim — a second wording would split one card", () => {
    for (const lang of LANGS) {
      expect(scoresAppCopy(lang).factors.satfat, lang).toBe(verdictNoun("ldl", lang));
    }
  });
});
