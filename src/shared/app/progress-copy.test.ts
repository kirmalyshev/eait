// The Progress surface's words (#95): the weight card with its range chips, the goal bar, the
// "This week" bars and the streak. Both clients draw it — `web/progress.html` and
// `phone/progress.html` on ieat-app main — so the words live here once. Completeness in all eight
// languages is `localizedGaps`' job in `copy.i18n.test.ts`; this file holds the table's own
// contract: the keys exist, the placeholders survive translation, the English is the board's
// words verbatim, and the claims gate reads every string it ships.

import { describe, expect, it } from "bun:test";
import { LANGS, type Lang } from "../types.ts";
import { lintCopy } from "../claims.ts";
import { countText } from "../lang.ts";
import { HEALTH_COPY } from "../health-copy.ts";
import { SHELL_COPY } from "./shell-copy.ts";
import { CHAT_COPY } from "../onboarding-chat-copy.ts";
import { WEIGHT_RANGES } from "../ui/charts.ts";
import { PROGRESS_COPY, progressCopyFor, type ProgressCopy } from "./progress-copy.ts";

const walk = (node: unknown, at: string, into: Record<string, string>): Record<string, string> => {
  if (typeof node === "string") { into[at] = node; return into; }
  if (typeof node !== "object" || node === null) return into;
  for (const [k, v] of Object.entries(node)) walk(v, at === "" ? k : `${at}.${k}`, into);
  return into;
};
const fields = (copy: ProgressCopy) => walk(copy, "", {});

describe("PROGRESS_COPY", () => {
  it("has every key in every language, placeholders included", () => {
    for (const lang of LANGS) {
      const copy = PROGRESS_COPY[lang];
      expect(copy, lang).toBeDefined();
      const f = fields(copy!);
      expect(Object.keys(f).length, lang).toBeGreaterThan(0);
      for (const [k, v] of Object.entries(f)) expect(v.length, `${lang}.${k}`).toBeGreaterThan(0);
      for (const key of ["weightNow", "goalDown", "goalUp", "goalToGo"] as const) {
        expect(copy![key].metric, `${lang}.${key}`).toContain("{n}");
        expect(copy![key].imperial, `${lang}.${key}.imperial`).toContain("{n}");
      }
      expect(copy!.goalLine.imperial, `${lang}.goalLine.imperial`).toContain("{from}");
      expect(copy!.goalLine.metric, `${lang}.goalLine`).toContain("{from}");
      expect(copy!.goalLine.metric, `${lang}.goalLine`).toContain("{to}");
      expect(copy!.goalEstimate, `${lang}.goalEstimate`).toContain("{month}");
      expect(copy!.weekPlan, `${lang}.weekPlan`).toContain("{plan}");
      expect(copy!.streakDays.other, `${lang}.streakDays`).toContain("{n}");
      expect(copy!.weightLatestTail.metric, `${lang}.weightLatestTail`).toContain("{date}");
      expect(copy!.weightLatestTail.imperial, `${lang}.weightLatestTail.imperial`).toContain("{date}");
      expect(copy!.bmiFrom, `${lang}.bmiFrom`).toContain("{w}");
      expect(copy!.bmiFrom, `${lang}.bmiFrom`).toContain("{h}");
      for (const r of WEIGHT_RANGES) expect(copy!.ranges[r], `${lang}.ranges.${r}`).toBeTruthy();
      for (const r of WEIGHT_RANGES) expect(copy!.weightNone[r], `${lang}.weightNone.${r}`).toBeTruthy();
    }
  });

  it("draws the boards' words in English — web/progress.html and phone/progress.html verbatim", () => {
    const en = progressCopyFor("en" as Lang);
    expect(en.title).toBe("Progress");
    expect(en.weightLabel).toBe("Weight");
    expect(en.ranges).toEqual({ "90D": "90D", "6M": "6M", "1Y": "1Y", all: "All" });
    expect(en.weightNow.metric).toBe("{n}kg");
    expect(en.goalLine.metric).toBe("{from} → {to}kg");
    expect(en.goalEstimate).toBe("around {month} · estimate");
    expect(en.goalDown.metric).toBe("{n}kg down");
    expect(en.goalToGo.metric).toBe("{n} to go");
    expect(en.weekLabel).toBe("This week");
    expect(en.weekPlan).toBe("kcal a day · plan {plan}");
    expect(en.streakLabel).toBe("Streak");
    expect(countText("en")(en.streakDays, 4)).toBe("4 days");
    expect(en.phone.back).toBe("Back");
    // design-pro's empty states (#95 comments): no log, one point, none in the selected range.
    expect(en.weightEmpty).toBe("Log a weight to see your trend");
    expect(en.weightOneMore).toBe("Log another weight to see your trend");
    expect(en.weightNone["90D"]).toBe("No weights in the last 90 days");
    expect(en.weightNowTail.metric).toBe("kg");
    expect(en.weightLatestTail.metric).toBe("kg · {date}");
    expect(en.bmiEmpty).toBe("Log a weight to see your BMI");
    expect(en.bmiFrom).toBe("From {w} and {h}");
    expect(en.goalEstimateFar).toBe("over two years · estimate");
  });

  it("reuses the words shared already — the shell's tab, health's label, the chart's name", () => {
    // A second copy of the same sentence is a second thing to translate and to drift.
    for (const lang of LANGS) {
      expect(PROGRESS_COPY[lang]!.title, lang).toBe(SHELL_COPY[lang]!.navProgress);
      expect(PROGRESS_COPY[lang]!.weightLabel, lang).toBe(HEALTH_COPY[lang]!.labels.weight_kg!);
      expect(PROGRESS_COPY[lang]!.weightChartName, lang).toBe(CHAT_COPY[lang]!.chart.weightTrend);
    }
  });

  it("counts the streak in the reader's own plural forms — Russian's three included", () => {
    expect(countText("ru")(progressCopyFor("ru").streakDays, 1)).toBe("1 день");
    expect(countText("ru")(progressCopyFor("ru").streakDays, 4)).toBe("4 дня");
    expect(countText("ru")(progressCopyFor("ru").streakDays, 5)).toBe("5 дней");
    expect(countText("de")(progressCopyFor("de").streakDays, 1)).toBe("1 Tag");
  });

  it("carries no claim the gate would refuse, in any of the eight", () => {
    // The templates themselves, unfilled — the corpus rule the other sweeps run. A filled
    // "минус 5кг" reads as description of what already happened, exactly the `planGoal` case.
    for (const lang of LANGS) {
      const named: Record<string, string> = {};
      for (const [k, v] of Object.entries(fields(PROGRESS_COPY[lang]!))) named[`PROGRESS_COPY.${k}`] = v;
      expect(lintCopy(named).map((v) => `${v.field}: ${v.pattern} "${v.span}"`), lang).toEqual([]);
    }
  });
});
