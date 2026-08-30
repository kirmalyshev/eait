// The app's palettes, transcribed. BOTH of them, because this page has the same two themes.
//
// It is a copy rather than an import because the mobile workspace imports from
// `react-native`, and the backend workspace has no business resolving that — the repo's own rule
// keeps the three workspaces from reaching into each other. It is not a copy anybody has to
// remember to update, though: `landing.test.ts` reads the mobile file as text and fails if any
// value here has drifted from it, in either theme.
//
// Why bother at all: the page a visitor reads immediately before the App Store screenshots should
// be the same object as the app in those screenshots. A stale accent is the cheapest possible way
// to look like a different product.
//
// THE ACCENT IS NOT THE SAME IN BOTH, and that is not a transcription error. #C8F751 is a 15:1
// fill on the dark page and 1.08:1 on the light one; the light theme uses the same hue an octave
// down. The reasoning is in `theme.ts` and is not repeated here, because this file is a copy and
// a copy that argues is a copy that will eventually argue for something else.

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
 * The light palette under its old name, so the many call sites that render one theme's value into
 * markup keep reading. Everything that has to differ per theme is a CSS variable, and the variables
 * are declared from both objects above.
 */
export const color = light;

/** The file the values above are copied from, relative to the repository root. */
export const TOKEN_SOURCE = "src/mobile/lib/palette.ts";
