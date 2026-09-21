// THE DESIGN SYSTEM. One module, and the basis both products build on (#28).
//
// The drawn source is the app repo's `product/design/soft-body/boards/lifesum/eait-lifesum-design.html`
// — twenty boards, a colour table with a provenance per hex, both type families with the full
// scale, the radii and spacing, and five component specifications. This file is that document as
// values, so nothing downstream has to read a number out of a picture.
//
// WHY HERE. `shared` is the contract both implementations import, and a colour is part of the
// contract: the page a visitor reads immediately before the App Store screenshots must be the same
// object as the app in them. The app repo consumes this the way it already consumes the rest of
// `shared`, and the values below are the only copy.
//
// PLAIN DATA, NO RENDERER. React Native wants points and a browser wants pixels and `em`; both are
// derivable from the numbers here, and neither belongs in a module the other one imports.

export { dark, light, lightVars, darkVars, vars, type ColorName } from "./palette.ts";

// ── Type ─────────────────────────────────────────────────────────────────────────────────────

/**
 * Two families, and what each one is for.
 *
 * The mono is not decoration. Lifesum sets nutrition figures in a monospace and it is the most
 * transferable thing in their register — it suits a product whose subject is a number. The trap it
 * brings is that its WORD-SPACE is a full mono advance, so `141 g` set as one string renders with a
 * hole in it: a unit lives outside the figure's own span, and a thousands gap is a 0.24em spacer.
 */
export const FONTS = {
  ui: "Plus Jakarta Sans",
  /** Every number, every unit string, every time and every code. */
  mono: "DM Mono",
  /** The width of a thousands gap inside a mono span, in em. Never a space character. */
  monoThousandsGapEm: 0.24,
} as const;

export type TypeRole =
  | "hero" | "headline" | "screenTitle" | "sectionTitle" | "rowTitle"
  | "body" | "secondary" | "micro" | "cta" | "chip";

/**
 * The scale, in the units the drawing uses: px for size, em for tracking.
 *
 * `size` is the phone's value. `web` is given only where the window uses a different one, and is
 * otherwise the same number. A renderer that needs points multiplies tracking by size itself —
 * React Native's `letterSpacing` is points, not em, and that conversion is the renderer's job.
 */
export const TYPE: Record<TypeRole, { size: number; web?: number; weight: 400 | 500 | 700 | 800; tracking: number; upper?: true }> = {
  /** O8 and W5's plan, Ls-01 and W1's day gauge. The largest figure in the product. */
  hero: { size: 62, web: 44, weight: 800, tracking: -0.035 },
  /** O1, W5, W6 and every question screen. */
  headline: { size: 30, web: 36, weight: 800, tracking: -0.035 },
  /** A meal name, a sheet headline. */
  screenTitle: { size: 22, web: 21, weight: 800, tracking: -0.02 },
  /** Card headings, the desktop header. */
  sectionTitle: { size: 17, weight: 800, tracking: -0.01 },
  /** List rows, option rows, table cells. */
  rowTitle: { size: 15, web: 16, weight: 700, tracking: -0.01 },
  body: { size: 14, web: 13.5, weight: 400, tracking: 0 },
  /** Helper lines, table sub-text. */
  secondary: { size: 12.5, web: 13, weight: 400, tracking: 0 },
  /** Section labels and field labels. Table headers take 10.5 at .11em. */
  micro: { size: 11, weight: 700, tracking: 0.13, upper: true },
  cta: { size: 14, web: 13, weight: 800, tracking: 0.09, upper: true },
  chip: { size: 10, weight: 700, tracking: 0.07, upper: true },
} as const;

// ── Geometry ─────────────────────────────────────────────────────────────────────────────────

/** Radii, by what they are for rather than by size, so a call site says why it chose one. */
export const RADIUS = {
  /** Inline controls, thumbnails, nav items. */
  control: 11,
  /** List rows, CTAs, tiles, fields. */
  row: 14,
  /** Mobile cards. */
  card: 18,
  /** Web cards, option rows, notes. */
  panel: 16,
  /** The onboarding plan panel. */
  plan: 20,
  /** The entry card. */
  entry: 22,
  /** Chips, and the mobile tab bar. */
  pill: 999,
} as const;

export const SPACE = {
  /** Mobile screen edge. */
  gutter: 16,
  /** Web content edge. The rail beside it is `RAIL`. */
  gutterWeb: 26,
  rail: 216,
  /** Between tiles in a row. */
  tileGap: 8,
  /** Between cards in a column. */
  cardGap: 12,
  /** Before a new section label. */
  sectionGap: 20,
} as const;

export const HEIGHT = {
  /** The mobile CTA, full width, pinned 22 from the bottom. */
  cta: 56,
  ctaWeb: 44,
  ctaInHeaderBar: 38,
  /** A mobile meal row: a 44 media square plus 15 of padding. */
  mealRow: 74,
  optionRow: 56,
  /** The mobile tab bar, floating, 16 from the bottom. */
  tabBar: 62,
  /** The wash, as a hero region on the phone and as a card header on the web. */
  wash: 168,
  washWebCard: 52,
} as const;

// ── The gauge ────────────────────────────────────────────────────────────────────────────────

/**
 * A SEMICIRCLE, NEVER A CLOSED RING.
 *
 * A ring reads as a target you are meant to fill, which is the opposite of what a calorie plan
 * means. There is no band segment on it and no floor tick: both were range machinery, and the floor
 * is a status line now.
 */
export const GAUGE = {
  viewBox: "0 0 326 172",
  path: "M33 154 A130 130 0 0 1 293 154",
  radius: 130,
  stroke: 16,
  /** π × 130 — the length of the path above, and the denominator of every dasharray on it. */
  arcLength: Math.PI * 130,
} as const;

/**
 * How much of the arc is drawn: `eaten / plan × 408.41`, clamped.
 *
 * At 1 820 of a 2 100 plan that is 354. Clamped rather than allowed past the end, because an arc
 * longer than itself draws nothing at all and an over-plan day is the one that most needs to show.
 */
export function gaugeDash(eaten: number, plan: number): number {
  const fraction = plan > 0 ? Math.min(1, Math.max(0, eaten / plan)) : eaten > 0 ? 1 : 0;
  return fraction * GAUGE.arcLength;
}

// ── What each colour is allowed to mean ──────────────────────────────────────────────────────

/**
 * The rules a hex cannot carry on its own, spelled out where both products read them.
 *
 * These are the constraints that make the register legible at a glance: the only colour in a list
 * of meals is the one row that needs you.
 */
export const MEANING = {
  /** The word "about", the figure it governs, the one flag, the dashed box, the unresolved step dot. */
  amber: "the guess, and nothing else",
  /** Once per screen at most, as text, and only when the floor is worth mentioning. */
  blue: "the calorie floor, and nothing else",
  /** Buttons, the active nav item, a selected option, the consumed arc, a guess once answered. */
  green: "affordance, and settled-exact. never decoration",
  /** Ls-01, Ls-O1, Ls-O8, LsW-01..04 as a 52px card header, LsW-05 and LsW-06. */
  wash: "the day and arrivals only. never a question screen, never a meal",
} as const;
