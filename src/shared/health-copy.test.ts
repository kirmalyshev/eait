import { describe, expect, it } from "bun:test";
import { LANGS } from "./types.ts";
import { HEALTH_FIELDS, HEALTH_GROUPS } from "./health.ts";
import { HEALTH_COPY, healthLabel } from "./health-copy.ts";
import { correlationWords } from "./trend.ts";

describe("what the health screen calls things", () => {
  it("has a word for every group and every metric, in every language", () => {
    for (const lang of LANGS) {
      for (const g of HEALTH_GROUPS) expect(healthLabel(g.id, lang), `${lang}.${g.id}`).not.toBe(g.id);
      for (const f of HEALTH_FIELDS) expect(healthLabel(f.key, lang), `${lang}.${f.key}`).not.toBe(f.key);
    }
  });

  it("answers with the key itself for one a binary is a version behind on", () => {
    // The mirror of `isKnownScreen`: a server a version ahead names a metric this build has no
    // word for, and a blank axis label is worse than an ugly one.
    expect(healthLabel("gravitas_kg", "de")).toBe("gravitas_kg");
  });

  it("does not repeat the English — it derives it from the specs", () => {
    for (const f of HEALTH_FIELDS) expect(healthLabel(f.key, "en")).toBe(f.enLabel);
  });

  it("words a correlation in every language, on every band and both directions", () => {
    for (const lang of LANGS) {
      for (const r of [0, 0.1, -0.35, 0.35, -0.6, 0.6, -0.9, 0.9]) {
        const said = correlationWords(r, lang);
        expect(said, `${lang}@${r}`).toBeTruthy();
        expect(said, `${lang}@${r}`).not.toMatch(/\{\w+\}/);
      }
      // The bands are arithmetic and stay English-independent: same r, same band, every language.
      expect(correlationWords(0.1, lang), lang).toBe(correlationWords(-0.1, lang));
      expect(correlationWords(0.9, lang), lang).not.toBe(correlationWords(0.35, lang));
    }
  });

  /**
   * The labels that are legitimately identical to the English, as exact `lang.key` pairs.
   *
   * PAIRS, not a list of keys: `Distance` is the French word and `Strecke` is the German one, so
   * excusing the key everywhere would stop the check noticing a German that never got translated.
   * A new coincidence has to be added here deliberately, which is the point.
   */
  const SAME_WORD = new Set([
    "fr.vo2max", "it.vo2max", "vi.vo2max",   // an internationalism in all three
    "de.hrv_ms", "it.hrv_ms", "vi.hrv_ms", "id.hrv_ms",
    "fr.distance_km",
  ]);

  it("does not let a new metric ship English in all eight and call it translated", () => {
    // `labels()` spreads `EN_LABELS` underneath every language, so a key nobody translated is
    // PRESENT in all eight and correct in one — and `localizedGaps` stops at the table, so it can
    // only see that the eight language keys exist. A reviewer deleted two German overrides and
    // both guards stayed green while the German health screen read "Sleep" and "Steps".
    for (const lang of LANGS.filter((l) => l !== "en")) {
      const same = [...HEALTH_GROUPS.map((g) => g.id), ...HEALTH_FIELDS.map((f) => f.key)]
        .filter((k) => healthLabel(k, lang) === healthLabel(k, "en"));
      expect(same.filter((k) => !SAME_WORD.has(`${lang}.${k}`)), lang).toEqual([]);
    }
  });
});
