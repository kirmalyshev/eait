import { describe, expect, it } from "bun:test";
import { fill } from "./lang.ts";
import { countText } from "./lang.ts";
import { LANGS, PACES } from "./types.ts";
import { HEALTH_FIELDS, HEALTH_GROUPS } from "./health.ts";
import { HEALTH_COPY, healthLabel, healthScreenCopyFor } from "./health-copy.ts";
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

describe("the Apple Health screens' own words (HEALTH_SCREEN_COPY)", () => {
  it("exists complete in all eight, with every template filling", () => {
    const params: Record<string, string> = {
      i: "Intake", n: "26", kcal: "1,066", avg: "1,467", target: "1,434", old: "1,434",
      new: "1,429", d: "1.2 kg", to: "5.4 kg", date: "24 Aug", when: "today 18:30",
      kg: "1.2 kg", pace: "steady", days: "2 days", a: "Intake", b: "Steps", period: "weeks",
      kind: "Bars", series: "Intake", time: "18:30",
    };
    const fields = (o: unknown, at = ""): string[] =>
      typeof o === "string" ? [o]
      : o && typeof o === "object" ? Object.values(o as Record<string, unknown>).flatMap((v) => fields(v)) : [];
    for (const lang of LANGS) {
      const s = healthScreenCopyFor(lang);
      for (const str of fields(s)) {
        const filled = str.replace(/\{(\w+)\}/g, (w, k: string) => params[k] ?? w);
        expect(filled, `${lang}: ${str}`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("titles the intake card by period, counted in the reader's own forms", () => {
    const s = healthScreenCopyFor("en");
    expect(s.intake.periods.days.one).toBe("this week");
    expect(countText("en")(s.intake.periods.weeks.counted, 26)).toBe("the last 26 weeks");
    expect(s.intake.periods.years.one).toBe("this year");
    const ru = healthScreenCopyFor("ru");
    expect(ru.intake.periods.weeks.one).toBe("за прошлую неделю");
    expect(countText("ru")(ru.intake.periods.weeks.counted, 5)).toBe("за последние 5 недель");
    expect(countText("ru")(ru.intake.periods.months.counted, 12)).toBe("за последние 12 месяцев");
    // The bug this shape exists for: 21 selects `one`, and the counted one must count.
    expect(countText("ru")(ru.intake.periods.weeks.counted, 21)).toBe("за последние 21 неделю");
    expect(countText("ru")(ru.intake.periods.months.counted, 21)).toBe("за последние 21 месяц");
  });

  it("words the week line and the body line without a leftover placeholder, in all eight", () => {
    for (const lang of LANGS) {
      const s = healthScreenCopyFor(lang);
      const n = (x: number) => x.toLocaleString("en-US");
      expect(fill(s.weekLine.allInside, { target: n(1434) })).not.toMatch(/\{/);
      expect(fill(s.weekLine.overButOk, { days: countText(lang)(s.weekLine.days, 2), avg: n(1467) })).not.toMatch(/\{/);
      expect(fill(s.body.lineDrift, { target: "68 kg", pace: s.body.paces.steady })).not.toMatch(/\{/);
      for (const p of PACES) expect(s.body.paces[p], `${lang}.${p}`).toBeTruthy();
    }
  });

  it("never names a weight category — the BMI rule holds on this surface too", () => {
    for (const lang of LANGS) {
      const s = healthScreenCopyFor(lang);
      const flat = JSON.stringify(s).toLowerCase();
      for (const bad of ["underweight", "overweight", "obese", "normal weight"]) {
        expect(flat.includes(bad), `${lang} ${bad}`).toBe(false);
      }
    }
  });
});
