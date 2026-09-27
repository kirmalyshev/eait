// The design system is only a design system if what renders comes THROUGH it.
//
// A token file nobody renders from is worse than none: it reads as a decision that was made while
// the screens go on carrying whatever was typed into them. So this checks the two halves that can
// be checked mechanically — the values agree with the drawing, and the browser client names no
// colour of its own.
//
// THE DRAWING IS `product/design/pro/` on ieat-app main (Register P, eait#78): `pro.css` is the
// stylesheet every board renders with, and DIRECTION.md §3–§7 is the register. Where a value below
// has no board, DIRECTION's token table is the source; the dark values no board draws were decided
// by design-pro and recorded in ieat-app#932.

import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FONTS, MOTION, RADIUS, SPACE, TYPE, fontFaces, motionCss } from "./design.ts";
import { dark, light, lightVars, darkVars, macro, vars } from "./palette.ts";

/** WCAG 2.x relative luminance and contrast, on 6-digit hexes — the only form the tokens take. */
const luminance = (hex: string): number => {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe("the palettes are the register's", () => {
  test("light", () => {
    expect(light).toEqual({
      bg: "#F7F6F2",
      surface: "#FFFFFF",
      ink: "#17191C",
      muted: "#6A6F76",
      // #6F747B, the challenger's 4.5:1 fix — DIRECTION's #9AA0A6 lost, the boards use this.
      faint: "#6F747B",
      hairline: "#E7E5E0",
      line: "#D3D0C9",
      accent: "#1E6B3C",
      accentInk: "#FFFFFF",
      accentTint: "#E6F1EA",
      good: "#1E6B3C",
      warn: "#A35A00",
      warnTint: "#FBEEDB",
      bad: "#B3261E",
      badTint: "#FBE4E1",
      care: "#2F6FB0",
    });
  });

  test("dark — tokens only, no dark boards exist; the un-drawn ones are ieat-app#932's", () => {
    expect(dark).toEqual({
      bg: "#101214",
      surface: "#191C1F",
      ink: "#F2F2EF",
      muted: "#A4A8AD",
      faint: "#85898F",
      hairline: "#2A2E33",
      line: "#3A3E44",
      accent: "#5BB37E",
      // Dark ink on the light-green accent: 7.3:1, where white would be 2.6:1.
      accentInk: "#101214",
      // A dark green: the neutral kcal tint would turn every "on plan" chip grey.
      accentTint: "#1C2E23",
      good: "#5BB37E",
      warn: "#FFC53D",
      warnTint: "#3A2E1A",
      // #FF5A52, not #F87171 — the latter is the same salmon as dark protein and the register
      // keeps macro colours apart from warn/bad.
      bad: "#FF5A52",
      badTint: "#3A2221",
      care: "#5AA9FF",
    });
  });

  test("both name the same tokens, so either theme renders the whole surface", () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
  });

  test("good is the accent — the register's own equation", () => {
    // "On plan" IS the affordance colour; a settled, exact state. Both themes keep it an alias of
    // accent so the day it diverges is one token's edit, not a sweep.
    expect(light.good).toBe(light.accent);
    expect(dark.good).toBe(dark.accent);
  });
});

describe("text tokens clear 4.5:1 on their grounds", () => {
  const pairs: [string, string, string][] = [
    // [name, ink, ground]
    ["light ink on bg", light.ink, light.bg],
    ["light ink on surface", light.ink, light.surface],
    ["light muted on bg", light.muted, light.bg],
    ["light muted on surface", light.muted, light.surface],
    ["light faint on surface", light.faint, light.surface],
    ["light accent on surface", light.accent, light.surface],
    ["light accentInk on accent", light.accentInk, light.accent],
    ["light warn on warnTint", light.warn, light.warnTint],
    ["light bad on badTint", light.bad, light.badTint],
    ["light care on surface", light.care, light.surface],
    ["dark ink on bg", dark.ink, dark.bg],
    ["dark ink on surface", dark.ink, dark.surface],
    ["dark muted on bg", dark.muted, dark.bg],
    ["dark muted on surface", dark.muted, dark.surface],
    ["dark faint on surface", dark.faint, dark.surface],
    ["dark accent on bg", dark.accent, dark.bg],
    ["dark accentInk on accent", dark.accentInk, dark.accent],
    ["dark warn on warnTint", dark.warn, dark.warnTint],
    ["dark bad on badTint", dark.bad, dark.badTint],
    ["dark care on surface", dark.care, dark.surface],
  ];
  for (const [name, ink, ground] of pairs) {
    test(name, () => {
      expect(contrast(ink, ground), `${ink} on ${ground} is ${contrast(ink, ground).toFixed(2)}:1`)
        .toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe("the macro tones", () => {
  test("light — one hue per macro on its own tint, shared with the landing", () => {
    expect(macro.light).toEqual({
      kcal: { ink: "#17191C", tint: "#EEEDE9" },
      protein: { ink: "#D9483F", tint: "#FBE6E4" },
      carbs: { ink: "#D48A1C", tint: "#FBEFD9" },
      fat: { ink: "#3A74D0", tint: "#E3ECFA" },
    });
  });

  test("dark", () => {
    expect(macro.dark).toEqual({
      kcal: { ink: "#F2F2EF", tint: "#26292D" },
      protein: { ink: "#F07A72", tint: "#3A2221" },
      carbs: { ink: "#E9A94A", tint: "#3A2E1A" },
      fat: { ink: "#7FA6EC", tint: "#1E2A3D" },
    });
  });

  test("deliberately not warn or bad — protein never reads as over", () => {
    for (const [theme, tones] of [[light, macro.light], [dark, macro.dark]] as const) {
      const inks = Object.values(tones).map((m) => m.ink);
      expect(inks).not.toContain(theme.warn);
      expect(inks).not.toContain(theme.bad);
    }
  });
});

describe("the CSS variables", () => {
  test("vars emits every token, the macro pairs, and the scheme", () => {
    const css = vars(light, "light");
    for (const name of [
      "--bg", "--surface", "--ink", "--muted", "--faint", "--hair", "--line",
      "--accent", "--accent-ink", "--accent-tint", "--good", "--warn", "--warn-tint",
      "--bad", "--bad-tint", "--care",
      "--macro-kcal", "--macro-kcal-t", "--macro-protein", "--macro-protein-t",
      "--macro-carbs", "--macro-carbs-t", "--macro-fat", "--macro-fat-t",
    ]) {
      expect(css, name).toContain(`${name}:`);
    }
    expect(css).toContain("color-scheme: light");
    expect(darkVars).toContain("color-scheme: dark");
    expect(lightVars).toContain("--macro-protein-t: #FBE6E4");
  });
});

describe("the type ramp", () => {
  test("the scale is 34 / 28 / 22 / 17 / 15 / 13 / 12 plus the two display figures", () => {
    const sizes = [
      TYPE.display34.size, TYPE.display28.size, TYPE.display22.size, TYPE.display17.size,
      TYPE.body.size, TYPE.secondary.size, TYPE.micro.size,
    ];
    expect(sizes).toEqual([34, 28, 22, 17, 15, 13, 12]);
    // The ruler's big number and Home's "kcal left".
    expect(TYPE.bigNumber.size).toBe(56);
    expect(TYPE.dayKcal.size).toBe(48);
    // The landing's hero: 34 on a phone, 52 on the window — the one role with a web size.
    expect(TYPE.hero).toMatchObject({ size: 34, web: 52, weight: 700, tracking: -0.03 });
  });

  test("display is tight and 1.1, text is 1.45", () => {
    for (const role of ["hero", "display34", "display28", "display22", "display17", "dayKcal"] as const) {
      expect(TYPE[role].lineHeight).toBe(1.1);
      expect(TYPE[role].tracking).toBeLessThan(0);
    }
    for (const role of ["body", "secondary", "micro"] as const) {
      expect(TYPE[role].lineHeight).toBe(1.45);
    }
  });

  test("the pro.css text roles — the button, the option row, the meal title, the verdict, the tab", () => {
    expect(TYPE.cta).toMatchObject({ size: 16, weight: 600 });
    // 500 at rest, 600 when selected — the boards' `.opt` / `.opt.sel`.
    expect(TYPE.option).toMatchObject({ size: 17, weight: 500 });
    expect(TYPE.rowTitle).toMatchObject({ size: 15, weight: 600 });
    expect(TYPE.verdict).toMatchObject({ size: 13, weight: 500 });
    expect(TYPE.tab).toMatchObject({ size: 12, weight: 600 });
  });

  test("the label is the only uppercase step: 12 px, 600, +0.06 em", () => {
    expect(TYPE.label).toMatchObject({ size: 12, weight: 600, tracking: 0.06, upper: true });
    const upper = Object.entries(TYPE).filter(([, v]) => "upper" in v && v.upper).map(([k]) => k);
    expect(upper).toEqual(["label"]);
  });
});

describe("shape", () => {
  test("fewer pills, tighter radii — card 12, control 10, thumbnail 8, the button 14", () => {
    expect(RADIUS).toMatchObject({ card: 12, control: 10, thumbnail: 8, cta: 14 });
    // The primary button is 14, NOT a pill: that is the shape change the register is.
    expect(RADIUS.cta).not.toBe(999);
  });
});

describe("motion — six verbs, one easing, once", () => {
  test("the durations are the boards'", () => {
    expect(MOTION).toMatchObject({
      grow: 900, rise: 500, draw: 1200, count: 1600, settle: 600, pop: 300,
      dash: 600, scan: 1600, welcomeDemo: 7000, planReveal: 3500,
    });
    expect(MOTION.ease).toEqual([0.2, 0.7, 0.2, 1]);
  });

  test("the generated CSS carries every keyframe and class, so no surface retypes a duration", () => {
    const css = motionCss();
    for (const k of ["k-grow", "k-rise", "k-draw", "k-count", "k-settle", "k-pop", "k-scan"]) {
      expect(css).toContain(`@keyframes ${k}`);
    }
    for (const c of [".grow", ".rise", ".draw", ".count", ".settle", ".pop"]) {
      expect(css).toContain(c);
    }
    expect(css).toContain("cubic-bezier(.2,.7,.2,1)");
    // Stagger is a per-element delay; the register's is the --d custom property.
    expect(css).toContain("var(--d,0s)");
    // Reduced motion: everything at its end state, the counter shows its value, no scan.
    expect(css).toContain("prefers-reduced-motion:reduce");
    expect(css).toContain(".count{--n:var(--to)}");
    expect(css).toContain(".scan{display:none}");
  });
});

describe("the fonts", () => {
  test("Montserrat is the one family, 400–700, numerals tabular", () => {
    expect(FONTS.family).toBe("Montserrat");
    expect(FONTS.weights).toEqual([400, 500, 600, 700]);
    expect(FONTS.numerals).toBe("tabular-nums");
  });

  test("every subset the product needs is self-hosted, woff2 for web and TTF for iOS", () => {
    // expo-font on iOS does not read woff2; the TTFs are the full font, not a subset.
    const dir = join(import.meta.dir, "assets", "fonts");
    for (const subset of ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "vietnamese"]) {
      expect(existsSync(join(dir, `montserrat-${subset}.woff2`)), subset).toBe(true);
    }
    for (const weight of FONTS.weights) {
      expect(existsSync(join(dir, `montserrat-${weight}.ttf`)), String(weight)).toBe(true);
    }
    // The OFL requires the licence to travel with the files.
    expect(existsSync(join(dir, "OFL-montserrat.txt"))).toBe(true);
  });

  test("fontFaces() emits one @font-face per subset with its unicode-range", () => {
    const css = fontFaces("/start/assets/fonts");
    const blocks = css.split("@font-face").slice(1);
    expect(blocks).toHaveLength(FONTS.subsets.length);
    for (const subset of FONTS.subsets) {
      const block = blocks.find((b) => b.includes(`montserrat-${subset}.woff2`));
      expect(block, subset).toBeDefined();
      expect(block).toContain(`url("/start/assets/fonts/montserrat-${subset}.woff2")`);
      expect(block).toContain("unicode-range:");
    }
    expect(css).toContain('font-family: "Montserrat"');
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
    for (const [what, text] of [["server/index.ts", shell], ["main.ts", client]] as const) {
      expect(text.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [], what).toEqual([]);
      expect(text.match(/\brgba?\(/g) ?? [], what).toEqual([]);
    }
  });
});
