import { describe, expect, it } from "bun:test";
import { renderableVerdicts } from "./types.ts";

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
