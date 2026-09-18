// The product's two palettes, and the CSS custom properties every web surface draws from.
//
// ONE COPY, HERE. The app reads these values through `src/mobile/lib/palette.ts`, the landing page
// and the backend's `/start` pages read them from this file, and a test in the mobile workspace's
// owner fails if the two drift in either theme. Plain strings, no renderer: this workspace is the
// contract both sides implement and a colour is part of the contract — the page a visitor reads
// immediately before the App Store screenshots must be the same object as the app in them.
//
// THE ACCENT IS NOT THE SAME IN BOTH, and that is not a transcription error. #C8F751 is a 15:1
// fill on the dark page and 1.08:1 on the light one; the light theme uses the same hue an octave
// down.

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
} as const;

export const dark = {
  bg: "#0B0B0C",
  surface: "#141517",
  surfaceRaised: "#1C1E21",
  border: "#26292E",
  borderStrong: "#343941",

  text: "#F4F4F5",
  textMuted: "#9BA1AA",
  textFaint: "#828993",

  accent: "#C8F751",
  accentText: "#10130A",

  good: "#4ADE80",
  warn: "#FBBF24",
  bad: "#F87171",

  care: "#7DD3FC",
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
  color-scheme: ${scheme};
`;

export const lightVars = vars(light, "#666C75", "light");
export const darkVars = vars(dark, "#7C838B", "dark");
