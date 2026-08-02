// The app's palette, transcribed.
//
// It is a copy rather than an import because `src/mobile/lib/theme.ts` imports a type from
// `react-native`, and the backend workspace has no business resolving that — the repo's own rule
// keeps the three workspaces from reaching into each other. It is not a copy anybody has to
// remember to update, though: `landing.test.ts` reads the mobile file as text and fails if any
// value here has drifted from it.
//
// Why bother at all: the page a visitor reads immediately before the App Store screenshots should
// be the same object as the app in those screenshots. A stale accent is the cheapest possible way
// to look like a different product.

export const color = {
  bg: "#0B0B0C",
  surface: "#141517",
  surfaceRaised: "#1C1E21",
  border: "#26292E",
  borderStrong: "#343941",

  text: "#F4F4F5",
  textMuted: "#9BA1AA",
  textFaint: "#6B7178",

  accent: "#C8F751",
  accentText: "#10130A",

  good: "#4ADE80",
  warn: "#FBBF24",
  bad: "#F87171",

  care: "#7DD3FC",
} as const;

/** The file the values above are copied from, relative to the repository root. */
export const TOKEN_SOURCE = "src/mobile/lib/theme.ts";
