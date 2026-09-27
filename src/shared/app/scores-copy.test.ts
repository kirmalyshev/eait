import { describe, expect, test } from "bun:test";
import { LANGS } from "../types.ts";
import { scoreFactorLabel, scoresAppCopy } from "./scores-copy.ts";
import { logCopyFor } from "./log-copy.ts";

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

  test("saturated fat is LOG_COPY's noun — one wording for the log, the pill and the breakdown", () => {
    for (const lang of LANGS) {
      expect(scoreFactorLabel("satfat", lang), lang).toBe(logCopyFor(lang).satfatNoun);
    }
  });
});
