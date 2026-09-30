// THE DESIGN SYSTEM. One module, and the basis both products build on (#28, redrawn as Register P
// in #78).
//
// The drawn source is the app repo's `product/design/pro/` — every board renders one stylesheet,
// `pro.css`, and DIRECTION.md is the register it implements. This file is that document as values,
// so nothing downstream has to read a number out of a picture: the palette, the one typeface with
// its files, the type ramp, the radii, the spacing, and the motion vocabulary with the CSS the two
// web surfaces interpolate.
//
// WHY HERE. `shared` is the contract both implementations import, and a colour is part of the
// contract: the page a visitor reads immediately before the App Store screenshots must be the same
// object as the app in them. The app repo consumes this the way it already consumes the rest of
// `shared`, and the values below are the only copy.
//
// PLAIN DATA, NO RENDERER. React Native wants points and a browser wants pixels and `em`; both are
// derivable from the numbers here, and neither belongs in a module the other one imports.

export {
  dark, light, lightVars, darkVars, vars, macro,
  type ColorName, type ThemeName, type MacroName,
} from "./palette.ts";

// ── Type ─────────────────────────────────────────────────────────────────────────────────────

/**
 * ONE family for display and text: Montserrat. It replaced the Bricolage/Figtree pair for the one
 * reason that outranks taste — the product ships Russian and Vietnamese and neither of those faces
 * has Cyrillic (DIRECTION §3). Display is 600/700 with −0.02 em tracking; text is 400/500; numerals
 * are `tabular-nums` so a column of figures holds still.
 *
 * The FILES live in `assets/fonts/` — kept once, read by the web surfaces (`fontFaces`), by
 * `/start`, and by the landing; the TTFs exist because `expo-font` on iOS does not read woff2.
 */
export const FONTS = {
  family: "Montserrat",
  /** The weights the register uses: text 400/500, display 600/700. */
  weights: [400, 500, 600, 700],
  numerals: "tabular-nums",
  /** The woff2 subsets, Google's own subsetting — `fontFaces` emits one face per entry. */
  subsets: ["latin", "latin-ext", "cyrillic", "cyrillic-ext", "vietnamese"],
} as const;

/**
 * The unicode-range of each subset, exactly as Google's css2 API declares it for Montserrat.
 * The range is what lets a browser fetch only the subsets a page's glyphs need; retyping it per
 * surface is how a Cyrillic reader ends up downloading the Latin file twice.
 */
const SUBSET_RANGE: Record<(typeof FONTS.subsets)[number], string> = {
  "cyrillic-ext": "U+0460-052F, U+1C80-1C8A, U+20B4, U+2DE0-2DFF, U+A640-A69F, U+FE2E-FE2F",
  "cyrillic": "U+0301, U+0400-045F, U+0490-0491, U+04B0-04B1, U+2116",
  "vietnamese": "U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1, U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329, U+1EA0-1EF9, U+20AB",
  "latin-ext": "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
  "latin": "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
};

/** The filename a subset is served and stored under — `montserrat-<subset>.woff2`. */
export const fontFile = (subset: (typeof FONTS.subsets)[number]): string =>
  `montserrat-${subset}.woff2`;

/** The iOS file for a weight — `montserrat-<weight>.ttf`, the full font and never a subset. */
export const fontTtf = (weight: (typeof FONTS.weights)[number]): string =>
  `montserrat-${weight}.ttf`;

/**
 * The @font-face declarations for the family, one per subset, as CSS. `baseUrl` is the same-origin
 * path the files are served from, so `font-src 'self'` is all the CSP either surface needs. The
 * woff2 files are variable across 100–900; the four weights the register uses are FONTS.weights.
 */
export function fontFaces(baseUrl: string): string {
  const base = baseUrl.replace(/\/$/, "");
  return FONTS.subsets.map((subset) => `@font-face {
  font-family: "${FONTS.family}";
  src: url("${base}/${fontFile(subset)}") format("woff2");
  font-weight: 100 900;
  font-display: swap;
  unicode-range: ${SUBSET_RANGE[subset]};
}`).join("\n");
}

export type TypeRole = keyof typeof TYPE;

/**
 * The ramp, in the units the drawing uses: px for size, em for tracking. Display steps are tight
 * with a 1.1 line height; reading text is 1.45. `size` is the phone's value; `web` is given only
 * where the window uses a different one (the landing's hero), and is otherwise the same number. A
 * renderer that needs points multiplies tracking by size itself — React Native's `letterSpacing`
 * is points, not em, and that conversion is the renderer's job.
 */
export const TYPE = {
  /** The landing's headline: 34 on a phone, 52 on a desktop — the reviewer's own deviation from
      the app scale. */
  hero: { size: 34, web: 52, weight: 700, tracking: -0.03, lineHeight: 1.1 },
  /** The largest display step — section-level headlines and the pace screen's question. */
  display34: { size: 34, weight: 700, tracking: -0.02, lineHeight: 1.1 },
  display28: { size: 28, weight: 700, tracking: -0.02, lineHeight: 1.1 },
  display22: { size: 22, weight: 700, tracking: -0.02, lineHeight: 1.1 },
  /** The smallest display step keeps a little more air: −0.01 em, the boards' own value. */
  display17: { size: 17, weight: 700, tracking: -0.01, lineHeight: 1.1 },
  /** The default reading size. */
  body: { size: 15, weight: 400, tracking: 0, lineHeight: 1.45 },
  /** Helper lines, captions, timestamps, chart labels. */
  secondary: { size: 13, weight: 400, tracking: 0, lineHeight: 1.45 },
  micro: { size: 12, weight: 400, tracking: 0, lineHeight: 1.45 },
  /** Section and field labels — the only uppercase step. */
  label: { size: 12, weight: 600, tracking: 0.06, lineHeight: 1.45, upper: true },
  /** The primary button's label (`.cta`). */
  cta: { size: 16, weight: 600, tracking: 0, lineHeight: 1.45 },
  /** An option row (`.opt`); set at 600 when selected. */
  option: { size: 17, weight: 500, tracking: 0, lineHeight: 1.45 },
  /** A list row's title — the meal name, an ingredient line (`.meal .mm b`). */
  rowTitle: { size: 15, weight: 600, tracking: 0, lineHeight: 1.45 },
  /** A verdict line: a dot and a sentence, never a pill (`.v`). */
  verdict: { size: 13, weight: 500, tracking: 0, lineHeight: 1.45 },
  /** A tab label (`.tabs a`). */
  tab: { size: 12, weight: 600, tracking: 0, lineHeight: 1.45 },
  /** The ruler's big number — height, weight and target on the onboarding pickers. */
  bigNumber: { size: 56, weight: 700, tracking: -0.03, lineHeight: 1 },
  /** Home's "kcal left" figure. */
  dayKcal: { size: 48, weight: 700, tracking: -0.02, lineHeight: 1.1 },
} as const;

// ── Geometry ─────────────────────────────────────────────────────────────────────────────────

/**
 * Fewer pills, tighter radii (DIRECTION §5), named by what they are for so a call site says why it
 * chose one. The primary button is 14 — not a pill; the pill survived only where the register draws
 * one (the attribution tag).
 */
export const RADIUS = {
  card: 12,
  control: 10,
  thumbnail: 8,
  /** The primary button. */
  cta: 14,
  /** Progress bars are 6 px with square ends — the boards draw 1 px, which reads square. */
  bar: 1,
  /** The meal sheet's top corners, and the dots, avatars and FAB: full round. */
  sheet: 20,
  /** The `.rise` overlay card's top corners — the date picker and the delete confirm. */
  overlay: 16,
  pill: 999,
} as const;

/** The card's lift — pro.css's `--shadow`, verbatim. One soft pair, shared by every surface. */
export const SHADOW = "0 1px 2px rgba(23,25,28,.06), 0 8px 24px -16px rgba(23,25,28,.18)" as const;

/** px. The gutters are the boards' own: 20 on the phone, 40 on the web. */
export const SPACE = {
  /** Phone screen edge — every board's side padding. */
  gutter: 20,
  /** Web content edge; the landing's sections take 72, kept on the landing. */
  gutterWeb: 40,
  /** A card's inner padding. */
  cardPad: 16,
  /** Between cards in a column. */
  cardGap: 12,
  /** The grid gap between macro cards and pictogram tiles. */
  tileGap: 10,
} as const;

// ── Motion ─────────────────────────────────────────────────────────────────────────────────

/**
 * Six verbs, one easing, played once on load — never looping except the scan on a photo being
 * read and the welcome's demo (DIRECTION §7). `pop` is the sixth verb: DIRECTION names five and the
 * boards use it on fourteen of them, and the boards win. On the device these numbers are
 * Reanimated's; the browser gets them through `motionCss`, so neither web surface retypes a
 * duration.
 *
 * Under `prefers-reduced-motion` every element sits at its end state, the counter shows its value,
 * and the scan does not run — the generated CSS carries that block, so a surface cannot forget it.
 */
export const MOTION = {
  /** The one easing, as its four control points — `Easing.bezier(...MOTION.ease)` on the device. */
  ease: [0.2, 0.7, 0.2, 1],
  /** A bar or segment scales in from the left. */
  grow: 900,
  /** A card or line fades in while rising `riseDy` px. */
  rise: 500,
  riseDy: 8,
  /** An SVG stroke draws in. */
  draw: 1200,
  /** An integer counts up to its value. */
  count: 1600,
  /** A marker slides into place. */
  settle: 600,
  /** An element scales `popFrom` → 1 with a fade. */
  pop: 300,
  popFrom: 0.6,
  /** The onboarding dash's current segment grows in this — the same verb, a shorter dash. */
  dash: 600,
  /** The photo scan's loop — the only looping animation besides the welcome demo. */
  scan: 1600,
  /** The thread's line-by-line delay step — the boards stagger a line's rise by this (#158). */
  stagger: 100,
  /** The welcome demo's full pass. */
  welcomeDemo: 7000,
  /** The plan reveal's 0 → 100 % (see S5). */
  planReveal: 3500,
} as const;

/**
 * The motion vocabulary as CSS: the seven keyframes (the six verbs plus the looping scan), the
 * classes that carry them, and the reduced-motion block — generated so no surface retypes a
 * duration. Mirrors `pro.css`'s motion section; class and keyframe names are the boards' own.
 *
 * `.count` renders an integer into an EMPTY element via the `--n` property counting to `--to`; a
 * unit goes outside it, and decimals and months do not count. Stagger is the `--d` custom property.
 * Fades use `filter:opacity()` so axe reads settled colours mid-animation (#362).
 */
export function motionCss(): string {
  const ease = `cubic-bezier(${MOTION.ease.map((n) => String(n).replace(/^0\./, ".")).join(",")})`;
  const s = (ms: number) => `${ms / 1000}s`;
  return `:root{--ease:${ease}}
@keyframes k-grow{from{transform:scaleX(0)}}
@keyframes k-rise{from{filter:opacity(0);transform:translateY(${MOTION.riseDy}px)}}
@keyframes k-draw{from{stroke-dashoffset:1200}}
@keyframes k-settle{from{transform:translate(-160%,-50%)}}
@keyframes k-pop{from{filter:opacity(0);transform:scale(${MOTION.popFrom})}}
@property --n{syntax:'<integer>';initial-value:0;inherits:false}
@keyframes k-count{to{--n:var(--to)}}
.grow{transform-origin:left center;animation:k-grow ${s(MOTION.grow)} var(--ease) both;animation-delay:var(--d,0s)}
.rise{animation:k-rise ${s(MOTION.rise)} var(--ease) both;animation-delay:var(--d,0s)}
.draw{stroke-dasharray:1200;stroke-dashoffset:0;animation:k-draw ${s(MOTION.draw)} var(--ease) both;animation-delay:var(--d,0s)}
.pop{animation:k-pop ${s(MOTION.pop)} var(--ease) both;animation-delay:var(--d,0s)}
.settle{animation:k-settle ${s(MOTION.settle)} var(--ease) both}
.count{counter-reset:n var(--n);animation:k-count ${s(MOTION.count)} var(--ease) both;animation-delay:var(--d,0s)}
.count::before{content:counter(n)}
.dash i.now{transform-origin:left center;animation:k-grow ${s(MOTION.dash)} var(--ease) both}
@keyframes k-scan{from{top:-38%}to{top:100%}}
.scan{position:absolute;left:0;right:0;height:38%;background:linear-gradient(rgba(255,255,255,0),rgba(255,255,255,.55) 50%,rgba(255,255,255,0));animation:k-scan ${s(MOTION.scan)} var(--ease) infinite}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}.count{--n:var(--to)}.scan{display:none}}`;
}

// ── What each colour is allowed to mean ──────────────────────────────────────────────────────

/**
 * The rules a hex cannot carry on its own, spelled out where both products read them.
 *
 * In Register P colour means exactly one thing: green is the action and "on plan", amber is
 * "high", red is "over" (DIRECTION §4). The macro hues are deliberately outside this — a count is
 * not a verdict.
 */
export const MEANING = {
  /** The action on a screen, and a settled, exact state — "on plan" wears the same green. */
  green: "the action, and on-plan. never decoration",
  /** "High" — a verdict past the comfortable half of a target, never "over". */
  amber: "high, and nothing else",
  /** Past the plan or past a cap — a red only ever says "over". */
  red: "over, and nothing else",
  /** The calorie floor, and nothing else. */
  blue: "the calorie floor, and nothing else",
} as const;
