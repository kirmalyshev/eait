// The product's two palettes, and the CSS custom properties every web surface draws from.
//
// ONE COPY, HERE. The app reads these values through `src/mobile/lib/palette.ts`, the landing page
// and the backend's `/start` pages read them from this file, and a test in the mobile workspace's
// owner fails if the two drift in either theme. Plain strings, no renderer: this workspace is the
// contract both sides implement and a colour is part of the contract — the page a visitor reads
// immediately before the App Store screenshots must be the same object as the app in them.
//
// THE ACCENT IS NOT THE SAME IN BOTH, and that is not a transcription error. #5AF05A is a 12.3:1
// fill on the dark page and 1.36:1 on the light one; the light theme uses the same hue an octave
// down.
//
// ONLY THE DARK HALF IS A DRAWN REGISTER. Every hex in it is sampled or marked as ours in the app
// repo's `product/design/soft-body/boards/lifesum/eait-lifesum-design.html`. The light palette has
// no such table behind it and was left exactly as it was.

export const light = {
  bg: "#F4F4F2",
  surface: "#FAFAF9",
  surfaceRaised: "#FFFFFF",
  border: "#E3E3DE",
  borderStrong: "#CBCBC4",

  text: "#131417",
  textMuted: "#5C626B",
  textFaint: "#676D76",

  accent: "#3F6212",
  accentText: "#FFFFFF",

  good: "#146B33",
  warn: "#8F4E00",
  bad: "#B91C1C",

  care: "#0369A1",

  /** The wash's two middle stops. It runs `accent` → these → the surface it sits on. */
  washMid: "#5C8322",
  washDeep: "#A9C97E",
} as const;

export const dark = {
  bg: "#121516",
  surface: "#1B1E1F",
  surfaceRaised: "#282828",
  border: "#2F3334",
  borderStrong: "#3D3C42",

  text: "#FFFFFF",
  textMuted: "#C6C4C5",
  /** 5.84:1 on `surfaceRaised`, the card ground every placeholder draws on. */
  textFaint: "#A3A3A3",

  accent: "#5AF05A",
  accentText: "#08170A",

  /** A guess that has been answered is exact, and exact is the affordance colour. */
  good: "#5AF05A",
  /** The guess, and nothing else. */
  warn: "#FFC53D",
  /** Ours, and outside the register: no board draws an error, so the table has no fourth hue. */
  bad: "#F87171",
  /** The calorie floor, and nothing else. */
  care: "#5AA9FF",

  /** The wash's two middle stops (design § Fills). */
  washMid: "#3FC551",
  washDeep: "#1E8C3E",
} as const;

export type ColorName = keyof typeof light;

/**
 * One theme's variables, as a string. Written out per token rather than derived from the object
 * keys, so a value with no counterpart in the other theme is a COMPILE error here and not a light
 * colour surviving onto a dark page.
 *
 * `dim` is the one value that is not a straight copy of a token. --faint is the app's third text
 * colour, spent there on a caption glanced at for a second inside a screen the user chose to open;
 * the web surfaces spend their faintest colour on small print read once, by a stranger, deciding
 * whether to trust a health app. That deserves margin over the AA minimum, and it is what keeps
 * three levels of hierarchy from collapsing into two. --faint stays declared so the block still
 * mirrors the app.
 */
export const vars = (t: Record<ColorName, string>, dim: string, scheme: "light" | "dark") => `
  --ink: ${t.bg};
  --panel: ${t.surface};
  --raised: ${t.surfaceRaised};
  --line: ${t.border};
  --line-strong: ${t.borderStrong};
  --text: ${t.text};
  --muted: ${t.textMuted};
  --faint: ${t.textFaint};
  --dim: ${dim};
  --accent: ${t.accent};
  --accent-ink: ${t.accentText};
  --good: ${t.good};
  --warn: ${t.warn};
  --bad: ${t.bad};
  --care: ${t.care};
  --wash-mid: ${t.washMid};
  --wash-deep: ${t.washDeep};
  color-scheme: ${scheme};
`;

export const lightVars = vars(light, "#666C75", "light");
export const darkVars = vars(dark, "#9A9A9A", "dark");
