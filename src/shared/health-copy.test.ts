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
    for (const f of HEALTH_FIELDS) expect(healthLabel(f.key, "en")).toBe(f.label);
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
});
