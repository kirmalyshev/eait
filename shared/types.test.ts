import { describe, expect, it, test } from "bun:test";
import { VERDICT_DIMENSIONS, renderableVerdicts, verdictPillLabel } from "./types.ts";

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
      const labels = (["good", "warn", "bad"] as const).map((v) => verdictPillLabel(d, v));
      // Three distinct sentences: the pill must not rely on its colour to say which one it is.
      expect(new Set(labels).size).toBe(3);
      for (const l of labels) expect(l.split(" ").length).toBeGreaterThan(1);
    }
  });

  test("the noun stays the dimension's own", () => {
    expect(verdictPillLabel("weight", "good")).toBe("Calories on plan");
    expect(verdictPillLabel("ldl", "warn")).toBe("Saturated fat high");
    expect(verdictPillLabel("kidneys", "bad")).toBe("Sodium very high");
  });
});
