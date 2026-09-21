// The design system is only a design system if what renders comes THROUGH it.
//
// A token file nobody renders from is worse than none: it reads as a decision that was made while
// the screens go on carrying whatever was typed into them. So this checks the two halves that can
// be checked mechanically — the values agree with the drawing, and the browser client names no
// colour of its own.

import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GAUGE, HEIGHT, RADIUS, TYPE, gaugeDash } from "./design.ts";
import { dark, light } from "./palette.ts";

describe("the gauge maths", () => {
  test("the arc is π × 130, which is what every dasharray on it divides by", () => {
    expect(GAUGE.arcLength).toBeCloseTo(408.407, 3);
  });

  test("1 820 of a 2 100 plan draws 354 of it", () => {
    // The one worked example in the drawing, and the reason this function is here rather than in a
    // renderer: two clients dividing it apart would disagree about how full the same day looks.
    expect(Math.round(gaugeDash(1820, 2100))).toBe(354);
  });

  test("an over-plan day fills the arc rather than overrunning it", () => {
    // An arc longer than itself draws NOTHING, and an over-plan day is the one that most needs to
    // be seen.
    expect(gaugeDash(2600, 2100)).toBe(GAUGE.arcLength);
  });

  test("a plan of zero is not a division", () => {
    expect(gaugeDash(0, 0)).toBe(0);
    expect(gaugeDash(400, 0)).toBe(GAUGE.arcLength);
  });
});

describe("the scale", () => {
  test("every uppercase role is a label role, and no reading role is uppercase", () => {
    // Uppercase costs legibility per character, so the register spends it only on labels short
    // enough not to be read as a sentence: the micro-label, the CTA and a chip.
    const upper = Object.entries(TYPE).filter(([, v]) => v.upper).map(([k]) => k).sort();
    expect(upper).toEqual(["chip", "cta", "micro"]);
  });

  test("tracking is em and tightens as the type grows", () => {
    // The drawing's rule: display weights are set tight and label weights are set loose. A value in
    // points here would be the bug this unit choice exists to prevent.
    expect(TYPE.hero.tracking).toBeLessThan(0);
    expect(TYPE.body.tracking).toBe(0);
    expect(TYPE.micro.tracking).toBeGreaterThan(0);
  });
});

describe("the palettes", () => {
  test("both name the same tokens", () => {
    expect(Object.keys(dark)).toEqual(Object.keys(light));
  });

  test("a settled guess is the affordance colour, on the theme that was drawn", () => {
    // Not a coincidence to be tidied away: a number that has stopped being a guess IS exact, and
    // exact is what the accent means.
    expect(dark.good).toBe(dark.accent);
  });
});

describe("the browser client renders from the system", () => {
  /**
   * Comments are stripped before matching, and they have to be: an issue number reads as a hex
   * (`#423` is six characters of nothing but hex digits), so a check that read prose would fail on
   * its own documentation and get deleted rather than obeyed. Strings are NOT stripped, because a
   * colour literal IS a string.
   */
  const code = (path: string[]): string =>
    readFileSync(join(import.meta.dir, "..", ...path), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n").filter((l) => !/^\s*(\/\/|\*)/.test(l)).join("\n");

  const shell = code(["frontend", "server", "index.ts"]);
  const client = code(["frontend", "main.ts"]);

  test("names no colour of its own", () => {
    // The whole point of #28: the shell's one stylesheet draws from `vars()`, and a hex typed into
    // it is a value that will not move when the system does.
    for (const [what, text] of [["server/index.ts", shell], ["main.ts", client]] as const) {
      expect(text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], what).toEqual([]);
      expect(text.match(/\brgba?\(/g) ?? [], what).toEqual([]);
    }
  });

  test("the tab bar's height is the system's, not a number in a stylesheet", () => {
    expect(HEIGHT.tabBar).toBe(62);
    expect(RADIUS.pill).toBe(999);
  });
});
