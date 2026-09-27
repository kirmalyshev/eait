import { describe, expect, test } from "bun:test";
import { macro } from "../palette.ts";
import { BRAND_ICONS, brandSvg, ICONS, iconCss, iconSvg, MACRO_CHIP, type BrandName, type IconName } from "./icons.ts";

// Every icon the boards draw, by surface — the fixed list of names this set answers to (#79,
// extended by the overseer past the issue's minimum to every glyph the boards carry). `satfat` is
// the one name no board writes: saturated fat wears the fat glyph, and the alias is that rule.
const BOARD_ICONS: IconName[] = [
  // The macro set — filled glyphs, each in its tinted circle.
  "kcal", "protein", "carbs", "fat",
  // The streak chip (Today, the health-sync board).
  "streak",
  // Option rows: sex.
  "male", "female", "other",
  // Option rows: activity — armchair · dumbbell · trophy.
  "few", "some", "many",
  // Option rows: pace — walk · bike · car.
  "slow", "steady", "fast",
  // Option rows: struggles.
  "consistency", "habits", "support", "busy", "ideas",
  // Option rows: diets.
  "balanced", "wholefood", "mediterranean", "flexitarian", "pescatarian", "vegetarian", "vegan",
  // Option rows: medical limits.
  "health", "none",
  // The Health score and Home page 2 — the score's parts and its "why" affordance.
  "fibre", "sugar", "help", "salt",
  // Apple Health.
  "sync",
  // Goal rows.
  "lose", "keep", "gain",
  // Tabs.
  "home", "progress", "chat", "you",
  // UI chrome and the camera flow.
  "camera", "upload", "chevron-left", "chevron-right", "x", "dots", "send", "back", "plus", "search",
  "chevron-down", "chevron-up", "check", "retry", "clock", "info", "alert-circle", "pencil", "trash",
  "backspace", "sparkle", "spinner", "camera-off", "camera-switch", "images", "image-off",
  "calendar-back", "target", "no-food",
  // Health and You.
  "download", "export", "scale", "heart", "heart-off", "rest", "pulse", "person", "bars",
  // Landing and pay.
  "moon", "mail", "card", "lock", "code",
];

// The brand group: the companies' own marks, never redrawn as line icons.
const BRAND_MARKS: BrandName[] = ["apple", "apple-badge", "google", "google-signin", "github"];

describe("the icon set", () => {
  test("every icon the boards use is in the set", () => {
    for (const name of BOARD_ICONS) {
      expect(ICONS[name], `missing icon: ${name}`).toBeDefined();
      const svg = iconSvg(name);
      expect(svg.startsWith("<svg")).toBe(true);
      expect(svg.endsWith("</svg>")).toBe(true);
      expect(svg).toContain(`viewBox="${ICONS[name].viewBox}"`);
    }
  });

  test("every brand mark is in the brand group", () => {
    for (const name of BRAND_MARKS) {
      expect(BRAND_ICONS[name], `missing brand: ${name}`).toBeDefined();
      expect(brandSvg(name)).toContain("</svg>");
    }
  });

  test("no emoji and no Unicode glyph stands in for an icon", () => {
    // eslint-disable-next-line no-control-regex
    const ascii = /^[ -~]+$/;
    for (const [name, spec] of Object.entries(ICONS)) {
      expect(spec.body, `${name} carries a non-ASCII glyph`).toMatch(ascii);
    }
    for (const [name, spec] of Object.entries(BRAND_ICONS)) {
      expect(spec.body, `${name} carries a non-ASCII glyph`).toMatch(ascii);
    }
  });

  test("line icons stroke the current colour at 1.75 with round caps and joins", () => {
    const svg = iconSvg("camera");
    expect(svg).toContain('fill="none"');
    expect(svg).toContain('stroke="currentColor"');
    expect(svg).toContain('stroke-width="1.75"');
    expect(svg).toContain('stroke-linecap="round"');
    expect(svg).toContain('stroke-linejoin="round"');
  });

  test("icons are single-colour shapes: opts.color reaches every currentColor", () => {
    const stroked = iconSvg("send", { color: "#1E6B3C" });
    expect(stroked).toContain('stroke="#1E6B3C"');
    expect(stroked).not.toContain("currentColor");
    // A solid glyph repaints too — the stem of the drumstick is stroked inside its filled group.
    const solidGlyph = iconSvg("protein", { color: "#D9483F" });
    expect(solidGlyph).toContain('fill="#D9483F"');
    expect(solidGlyph).toContain('stroke="#D9483F"');
    expect(solidGlyph).not.toContain("currentColor");
  });

  test("nothing bakes a colour: the macro set and the streak take theirs from the caller", () => {
    for (const name of ["kcal", "protein", "carbs", "fat", "satfat", "streak"] as IconName[]) {
      expect(ICONS[name].body, `${name} bakes a hex`).not.toMatch(/#[0-9a-fA-F]{3,8}/);
      expect(iconSvg(name)).toContain('fill="currentColor"');
    }
  });

  test("saturated fat wears the fat glyph", () => {
    expect(ICONS.satfat.body).toBe(ICONS.fat.body);
  });

  test("the macro chip is one size, exported once", () => {
    expect(MACRO_CHIP).toEqual({ sizeEm: 1.6, glyphShare: 0.58 });
  });

  test("brand marks keep their artwork; google keeps its four colours", () => {
    const g = brandSvg("google");
    for (const hex of ["#EA4335", "#4285F4", "#FBBC05", "#34A853"]) expect(g).toContain(hex);
    // A brand mark is never recoloured: `color` is not on brandSvg's options.
    expect(brandSvg("apple")).toContain('fill="currentColor"');
    expect(BRAND_ICONS.google.viewBox).toBe("0 0 48 48");
    expect(BRAND_ICONS.github.viewBox).toBe("0 0 16 16");
  });

  test("opts.size sets width and height", () => {
    expect(iconSvg("home", { size: 22 })).toContain('width="22" height="22"');
    expect(iconSvg("home")).not.toContain(' width="');
  });

  test("opts.strokeWidth lightens a line icon, as the big state glyphs are drawn", () => {
    expect(iconSvg("no-food", { size: 64, strokeWidth: 1.25 })).toContain('stroke-width="1.25"');
    expect(iconSvg("no-food")).toContain('stroke-width="1.75"');
  });

  test("icons are decorative by default and named when they carry the meaning", () => {
    expect(iconSvg("x")).toContain('aria-hidden="true"');
    const named = iconSvg("x", { label: "Close" });
    expect(named).toContain('role="img"');
    expect(named).toContain('aria-label="Close"');
  });

  describe("iconCss — the web classes, generated", () => {
    const css = iconCss();

    test("every icon gets an .i- mask class taking currentColor", () => {
      expect(css).toContain(".ico{display:inline-block");
      expect(css).toContain("background:currentColor");
      for (const name of Object.keys(ICONS)) {
        expect(css, `missing .i-${name}`).toContain(`.i-${name}{--ic:url("data:image/svg+xml,`);
      }
    });

    test("the macro chips are ink-on-tint, sized by MACRO_CHIP — light and dark", () => {
      for (const name of ["kcal", "protein", "carbs", "fat", "satfat"] as const) {
        const m = macro.light[name === "satfat" ? "fat" : name];
        expect(css).toContain(`.ico.i-${name}{-webkit-mask:none;mask:none;background:${m.tint} `);
        expect(css).toContain(`center/${MACRO_CHIP.glyphShare * 100}% no-repeat`);
        expect(css).toContain(`width:${MACRO_CHIP.sizeEm}em;height:${MACRO_CHIP.sizeEm}em`);
        const dm = macro.dark[name === "satfat" ? "fat" : name];
        const encodedDarkInk = encodeURIComponent(`fill="${dm.ink}"`);
        expect(css, `no dark glyph for .i-${name}`).toContain(encodedDarkInk);
      }
      expect(css).toContain(':root[data-theme="dark"]');
    });

    test("every colour in the output comes from palette.macro", () => {
      const fromPalette = new Set(
        Object.values(macro).flatMap((t) => Object.values(t).flatMap((m) => [m.ink, m.tint])),
      );
      const hexes = new Set(css.match(/#[0-9a-fA-F]{3,8}/g) ?? []);
      expect(hexes.size).toBeGreaterThan(0);
      for (const hex of hexes) {
        expect(fromPalette.has(hex.toUpperCase()) || fromPalette.has(hex), `colour outside palette.macro: ${hex}`).toBe(true);
      }
    });
  });
});
