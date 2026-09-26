import { describe, expect, it, test } from "bun:test";
import { VERDICT_DIMENSIONS, renderableVerdicts, verdictMood } from "./types.ts";
import { verdictPillLabel } from "./verdicts.ts";
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
