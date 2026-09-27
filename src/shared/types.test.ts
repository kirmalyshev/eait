import { describe, expect, it, test } from "bun:test";
import { ACTIVITY_LEVELS, VERDICT_DIMENSIONS, migrateActivityLevel, renderableVerdicts, verdictMood } from "./types.ts";
import { verdictInlineLabel, verdictInlineText, verdictPillLabel } from "./verdicts.ts";
import { LANGS } from "./types.ts";

// These tests are about a RENDER boundary, not about domain logic. `verdicts` is the one field on a
// meal analysis that no analyzer supplies and every write recomputes, so it crosses more hands than
// any other — and when it arrived undefined the app did not show a bad row, it aborted the process.
describe("renderableVerdicts", () => {
  it("returns the dimensions present, in the shared render order", () => {
    expect(renderableVerdicts({ kidneys: "warn", weight: "good" })).toEqual(["weight", "kidneys"]);
  });

  it("skips dimensions that are absent", () => {
    expect(renderableVerdicts({ weight: "bad" })).toEqual(["weight"]);
    expect(renderableVerdicts({})).toEqual([]);
  });

  // The three shapes that actually reached a client, or could. A missing field costs its row.
  it("survives a missing verdicts object entirely", () => {
    expect(renderableVerdicts(undefined)).toEqual([]);
    expect(renderableVerdicts(null)).toEqual([]);
  });

  it("survives a verdicts field that is not an object", () => {
    expect(renderableVerdicts("good")).toEqual([]);
    expect(renderableVerdicts(42)).toEqual([]);
    expect(renderableVerdicts([])).toEqual([]);
  });

  // A server one version ahead can name a verdict this binary has no label for. Dropping the row is
  // correct; rendering `undefined` as a colour is not, and `VERDICT_LABEL[d]` would be blank.
  it("drops values that are not a verdict this build knows", () => {
    expect(renderableVerdicts({ weight: "excellent", ldl: "bad" })).toEqual(["ldl"]);
    expect(renderableVerdicts({ weight: null, ldl: "good" })).toEqual(["ldl"]);
  });

  it("ignores dimensions this build does not render", () => {
    expect(renderableVerdicts({ weight: "good", cholesterol: "bad" })).toEqual(["weight"]);
  });
});

describe("verdictPillLabel", () => {
  test("every dimension and verdict names the judgement in words", () => {
    for (const d of VERDICT_DIMENSIONS) {
      const labels = (["good", "warn", "bad"] as const).map((v) => verdictPillLabel(d, v, "en"));
      // Three distinct sentences: the pill must not rely on its colour to say which one it is.
      expect(new Set(labels).size).toBe(3);
      for (const l of labels) expect(l.split(" ").length).toBeGreaterThan(1);
    }
  });

  test("the noun stays the dimension's own", () => {
    expect(verdictPillLabel("weight", "good", "en")).toBe("Calories on plan");
    expect(verdictPillLabel("ldl", "warn", "en")).toBe("Saturated fat high");
    expect(verdictPillLabel("kidneys", "bad", "en")).toBe("Sodium very high");
  });
});

describe("a verdict pill in eight languages", () => {
  it("names the dimension AND the verdict, in every one of them", () => {
    // The whole reason the pill carries words rather than a tint: a red/green colour blindness
    // reads two identically-worded pills, and VoiceOver reads the noun and stops. A translation
    // that dropped the verdict half would put that failure back, silently, in one language.
    for (const lang of LANGS) {
      for (const d of VERDICT_DIMENSIONS) {
        const said = (["good", "warn", "bad"] as const).map((v) => verdictPillLabel(d, v, lang));
        expect(new Set(said).size, `${lang}.${d}`).toBe(said.length);
        for (const line of said) expect(line, `${lang}.${d}`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("is English for a language nobody has written", () => {
    expect(verdictPillLabel("kidneys", "warn", "en")).toBe("Sodium high");
    expect(verdictPillLabel("kidneys", "warn", "de")).toBe("Natrium — hoch");
  });
});

// #122, item 2: the diary row reads "13:05 · calories high · saturated fat very high" — the time,
// then only the verdicts that are not on plan, in pill order, joined by " · ". The noun comes from
// the CATALOG mid-sentence ("calories", not "Calories"), because a client lower-casing a pill label
// is wrong in German, where the noun stays capitalised either way.
describe("verdictInlineLabel", () => {
  it("is the mid-sentence form of a warn or bad verdict", () => {
    expect(verdictInlineLabel("weight", "warn", "en")).toBe("calories high");
    expect(verdictInlineLabel("ldl", "bad", "en")).toBe("saturated fat very high");
    expect(verdictInlineLabel("kidneys", "warn", "en")).toBe("sodium high");
  });

  it("keeps the German noun capitalised — the case lives in the catalog, not in code", () => {
    expect(verdictInlineLabel("weight", "warn", "de")).toBe("Kalorien — hoch");
    expect(verdictInlineLabel("ldl", "bad", "de")).toBe("Gesättigte Fette — sehr hoch");
  });

  it("names the dimension AND the verdict in every language, with no placeholder left", () => {
    for (const lang of LANGS) {
      for (const d of VERDICT_DIMENSIONS) {
        const said = (["warn", "bad"] as const).map((v) => verdictInlineLabel(d, v, lang));
        expect(new Set(said).size, `${lang}.${d}`).toBe(said.length);
        for (const line of said) expect(line, `${lang}.${d}`).not.toMatch(/\{\w+\}/);
      }
    }
  });
});

describe("verdictInlineText", () => {
  it("joins only the verdicts that are not on plan, in pill order", () => {
    expect(verdictInlineText({ kidneys: "bad", weight: "warn", ldl: "good" }, "en"))
      .toBe("calories high · sodium very high");
  });

  it("says nothing when every verdict is on plan — the row shows the time alone", () => {
    expect(verdictInlineText({ weight: "good", ldl: "good" }, "en")).toBe("");
  });

  it("says nothing for verdicts this build cannot read", () => {
    expect(verdictInlineText({}, "en")).toBe("");
    expect(verdictInlineText(undefined, "en")).toBe("");
    expect(verdictInlineText({ weight: "excellent" }, "en")).toBe("");
  });
});

// Principal, 2026-09-25: the first verdict follows the COMPUTED pills, never hard-coded praise.
// Spud's face is part of what the verdict says, so it is decided by the worst pill on the card.
describe("verdictMood", () => {
  it("cheers only when every pill on the card is on plan", () => {
    expect(verdictMood({ weight: "good", ldl: "good" })).toBe("joy");
  });
  it("thinks over a high pill, and cares over a very high one — the worst pill decides", () => {
    expect(verdictMood({ weight: "good", ldl: "warn" })).toBe("think");
    expect(verdictMood({ weight: "warn", kidneys: "bad" })).toBe("care");
  });
  it("offers no praise it has nothing to base on: no pill, or only pills this binary cannot read", () => {
    expect(verdictMood({})).toBe("happy");
    expect(verdictMood({ weight: "splendid" })).toBe("happy");
  });
});

// The activity vocabulary went from five levels to three (targets v2, decision 7): the stored
// values of every existing account are the old ids, and this is the ONE mapping that moves them —
// the schema backfill, the row reader and the patch validator all read it.
describe("migrateActivityLevel", () => {
  it("maps each of the five stored ids to the nearest of the three", () => {
    expect(migrateActivityLevel("sedentary")).toBe("few");
    expect(migrateActivityLevel("light")).toBe("few");
    expect(migrateActivityLevel("moderate")).toBe("some");
    expect(migrateActivityLevel("active")).toBe("some");
    expect(migrateActivityLevel("athlete")).toBe("many");
  });

  it("leaves the current ids untouched — the migration is idempotent", () => {
    for (const level of ACTIVITY_LEVELS) expect(migrateActivityLevel(level)).toBe(level);
  });

  it("reads an unknown or absent value as unanswered, never as a guess", () => {
    // A value from no vocabulary cannot be allowed to pick a multiplier silently.
    expect(migrateActivityLevel("olympian")).toBeNull();
    expect(migrateActivityLevel(null)).toBeNull();
    expect(migrateActivityLevel(undefined)).toBeNull();
  });
});
