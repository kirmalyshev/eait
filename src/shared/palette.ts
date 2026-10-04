// The product's two palettes, and the CSS custom properties every web surface draws from.
//
// REGISTER P (#78). The drawn source is `product/design/pro/` on ieat-app main: `pro.css` is the
// one stylesheet every board renders with and DIRECTION.md §4 is the palette table. ONE COPY, HERE:
// the app reads these values through `src/mobile/lib/palette.ts`, the landing re-exports them from
// `src/landing/tokens.ts`, and the backend's `/start` pages and the web shell interpolate
// `lightVars`/`darkVars`. A colour is part of the contract — the page a visitor reads immediately
// before the App Store screenshots must be the same object as the app in them.
//
// Neutral paper, one green: colour now MEANS something — green is the action and "on plan", amber
// is "high", red is "over"; photography supplies the rest. The light `faint` is #6F747B and not
// DIRECTION's original #9AA0A6: the challenger's contrast pass moved it (4.5:1), and the boards
// carry the fix. The dark half is TOKENS ONLY — no dark board is drawn — and its un-drawn values
// are design-pro's decisions, recorded on the direction (ieat-app#932): `bad` is #FF5A52 and not
// the old #F87171, which reads as the same salmon as dark protein, and `accentTint` is a dark
// green because the neutral kcal tint would turn every "on plan" chip grey.
//
// THE ACCENT IS NOT THE SAME IN BOTH, and that is not a transcription error: the same hue sits an
// octave apart because a fill must read as ink on its own ground. `accentInk` is whichever end of
// each theme's ink range clears the accent — white on #1E6B3C, dark ink on #5BB37E (7.3:1).

export const light = {
  bg: "#F7F6F2",
  surface: "#FFFFFF",
  ink: "#17191C",
  muted: "#6A6F76",
  faint: "#6F747B",
  hairline: "#E7E5E0",
  line: "#D3D0C9",
  accent: "#1E6B3C",
  accentInk: "#FFFFFF",
  accentTint: "#E6F1EA",
  /** "On plan" is the affordance colour — the register's own equation, kept a token. */
  good: "#1E6B3C",
  warn: "#A35A00",
  warnTint: "#FBEEDB",
  bad: "#B3261E",
  badTint: "#FBE4E1",
  /** The day's "over plan" — darker and calmer than `bad` (F, ieat-app#1291). 10.6:1 on white. */
  over: "#7A1A14",
  /** The calorie floor, and nothing else. */
  care: "#2F6FB0",
  /** Chat (ieat-app#1520): the thread's ground one step below bg, Spud's bubble, muted on her tint (5:1). */
  chatGround: "#EEECE6",
  chatBubble: "#FFFFFF",
  meMuted: "#5C6167",
} as const;

export const dark = {
  bg: "#101214",
  surface: "#191C1F",
  ink: "#F2F2EF",
  muted: "#A4A8AD",
  /** One step below muted, as in light — 4.9:1 on the dark surface. */
  faint: "#85898F",
  hairline: "#2A2E33",
  line: "#3A3E44",
  accent: "#5BB37E",
  accentInk: "#101214",
  accentTint: "#1C2E23",
  good: "#5BB37E",
  warn: "#FFC53D",
  warnTint: "#3A2E1A",
  bad: "#FF5A52",
  badTint: "#3A2221",
  /** Deliberately calmer than dark `bad`: 4.99:1 on the dark surface (design, ieat-app#1291). */
  over: "#D46C64",
  care: "#5AA9FF",
  chatGround: "#0B0D0E",
  chatBubble: "#22262A",
  meMuted: "#A4A8AD",
} as const;

export type ColorName = keyof typeof light;
export type ThemeName = "light" | "dark";

/**
 * The macro set — one hue per macro on its own tinted circle, shared with the landing
 * (DIRECTION §5, Kirill 2026-09-27). Deliberately NOT warn or bad: a macro is a count, not a
 * verdict, and protein must never read as "over". Each pair is ink-on-tint; the icon and the ring
 * wear `ink`, the circle wears `tint`.
 */
export type MacroName = "kcal" | "protein" | "carbs" | "fat";
export const macro: Record<ThemeName, Record<MacroName, { ink: string; tint: string }>> = {
  light: {
    kcal: { ink: "#17191C", tint: "#EEEDE9" },
    protein: { ink: "#D9483F", tint: "#FBE6E4" },
    carbs: { ink: "#D48A1C", tint: "#FBEFD9" },
    fat: { ink: "#3A74D0", tint: "#E3ECFA" },
  },
  dark: {
    kcal: { ink: "#F2F2EF", tint: "#26292D" },
    protein: { ink: "#F07A72", tint: "#3A2221" },
    carbs: { ink: "#E9A94A", tint: "#3A2E1A" },
    fat: { ink: "#7FA6EC", tint: "#1E2A3D" },
  },
};

/**
 * One theme's variables, as a string — the boards' own names, so a surface written against the
 * register reads the same in both. Written out per token rather than derived from the object keys,
 * so a value with no counterpart in the other theme is a COMPILE error here and not a light colour
 * surviving onto a dark page.
 */
export const vars = (t: Record<ColorName, string>, scheme: ThemeName) => {
  const m = macro[scheme];
  return `
  --bg: ${t.bg};
  --surface: ${t.surface};
  --ink: ${t.ink};
  --muted: ${t.muted};
  --faint: ${t.faint};
  --hair: ${t.hairline};
  --line: ${t.line};
  --accent: ${t.accent};
  --accent-ink: ${t.accentInk};
  --accent-tint: ${t.accentTint};
  --good: ${t.good};
  --warn: ${t.warn};
  --warn-tint: ${t.warnTint};
  --bad: ${t.bad};
  --bad-tint: ${t.badTint};
  --over: ${t.over};
  --care: ${t.care};
  --chat-ground: ${t.chatGround};
  --chat-bubble: ${t.chatBubble};
  --me-muted: ${t.meMuted};
  --macro-kcal: ${m.kcal.ink};
  --macro-kcal-t: ${m.kcal.tint};
  --macro-protein: ${m.protein.ink};
  --macro-protein-t: ${m.protein.tint};
  --macro-carbs: ${m.carbs.ink};
  --macro-carbs-t: ${m.carbs.tint};
  --macro-fat: ${m.fat.ink};
  --macro-fat-t: ${m.fat.tint};
  color-scheme: ${scheme};
`;
};

export const lightVars = vars(light, "light");
export const darkVars = vars(dark, "dark");
