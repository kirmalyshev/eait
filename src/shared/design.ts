// The design system. Every token this product has, and the stylesheet the web client renders from.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// IT IS HERE, IN `shared`, BECAUSE TWO PRODUCTS BUILD ON IT (#28). This repository holds the
// design system; the app repository consumes it the way it already consumes the rest of this
// workspace, rather than inventing a second one that drifts. That is the whole reason this file is
// not in `src/frontend`: styling that lives in one client is not a system, it is that client's CSS.
//
// SO THE VALUES ARE DATA, NOT CSS. A size is a number and a weight is a number, because the other
// consumer is React Native and cannot read `font: 800 44px/1 ...`. `STYLESHEET` at the bottom is
// the WEB rendering of the same values and is the only part of this file a phone ignores. Adding a
// token as a CSS string would quietly make it web-only, which is the failure this shape prevents.
//
// EACH COMMENT SAYS WHAT THE VALUE MEANS, not where it was sampled from. Provenance is in the
// drawn source; what a builder needs at the call site is whether they are allowed to use this for
// the thing in front of them. Three colours are allowed for exactly one thing each, and those
// three are the whole honesty mechanism the number grammar is drawn in:
//
//   AMBER is the guess and nothing else.  BLUE is the floor and nothing else.
//   GREEN is affordance and settled-exact — and never decoration.
//
// NOT `palette.ts`, AND THEY ARE NOT RIVALS. That file is the two-theme palette the LANDING page
// and `/start` are painted in — pages a stranger meets before there is an account. This is the
// register the PRODUCT is in, on both clients, and it is one theme because the design draws one
// surface. A page that belongs to neither is the thing to argue about; nothing today is.
//
// HOW THE WEB CLIENT TAKES IT: by relative path (`../shared/design.ts`), like `budget.ts` and
// `lang.ts` before it (#608). `@eait/shared` by package name needs a `node_modules` that
// `deploy/Dockerfile.web` never builds. Nothing here may import anything that is not plain data.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The palette.
 *
 * DARK ONLY, and that is the design rather than an omission: the spec draws one surface. A light
 * theme is not a lighter version of these values — the accent that is a 15:1 fill here is 1.08:1
 * on paper, which is the lesson `palette.ts` already records for the pages that need two.
 */
export const COLOR = {
  /** The page, and every screen on it. Nothing sits behind this. */
  ground: "#121516",
  /** Anything raised off the page and read as one object: a card, a list row, a bubble, a tile. */
  surface: "#282828",
  /** A panel that must sit BEHIND a surface — a well a card lives in, an inline note. */
  surfaceSunken: "#1B1E1F",
  /** The unfilled half of anything that fills: a track, an unselected segment, an option's edge. */
  raised: "#3D3C42",
  /** A rule BETWEEN rows inside one card. One step off the surface, never a full border. */
  line: "#2F3334",
  /** A rule between REGIONS — a header bar's underside, a rail's edge. Darker than `line`. */
  hairline: "#24292A",

  /**
   * Affordance, and settled-exact. A button you can press, the nav item you are on, the option you
   * chose, the consumed part of the day, and the number a guess becomes once it has been answered.
   * NEVER decoration: a green thing here is a thing you can act on or a thing that is now known
   * exactly. That second meaning is why the settle flow ends in green and not in white.
   */
  green: "#5AF05A",
  /** Held in reserve — the promo weight of the green, unused at this density. */
  greenDeep: "#22BA39",
  /** Every glyph and every icon that sits ON green. The only text colour allowed there. */
  ink: "#08170A",

  /**
   * THE GUESS, AND NOTHING ELSE, EVER. The word "about", the figure it governs, the one flag
   * sentence, the dashed box over a thing that was not identified, and the row that carries them.
   * If you are reaching for amber for a warning, a highlight or an accent, the answer is no — the
   * colour stops meaning one thing the moment it means two.
   */
  amber: "#FFC53D",
  /**
   * THE CALORIE FLOOR, AND NOTHING ELSE. At most once per screen, as text, and only where the
   * floor is worth mentioning. A status line — never a tick on a gauge and never a region on a
   * chart, because both of those were the range machinery this grammar removed.
   */
  blue: "#5AA9FF",

  /** Headings, and any figure that is the point of the line it is in. */
  t1: "#FFFFFF",
  /** Body text ON a surface, and every uppercase micro-label. */
  t2: "#C6C4C5",
  /** Secondary body: a helper line, a sub-caption, the part of a sentence that is context. 6.4:1. */
  t3: "#A3A3A3",
  /** The quietest text this design allows. 5.6:1 on the ground, and nothing may be quieter. */
  t4: "#9A9A9A",

  /** Something went wrong and the person has to read it. Never amber: amber is the guess. */
  bad: "#FF6B6B",
} as const;

/**
 * The fills that are not a flat colour.
 *
 * THE WASH IS ALLOWED IN TWO PLACES ONLY — the day, and an arrival. Worn on a question screen or a
 * meal screen it is wallpaper, and it forces every word on it to near-black, which is why a washed
 * region can hold a date and a title and nothing else.
 */
export const FILL = {
  /** The day's header strip, and an arrival screen's top. `COLOR.ink` on every word. */
  wash: "linear-gradient(180deg, #5AF05A 0%, #3FC551 42%, #1E8C3E 78%, #121516 100%)",
  /** Stands in for a photograph that is not there. Never a stock image. */
  photo: "repeating-linear-gradient(135deg, #1A1D1E 0 9px, #222728 9px 18px)",
  /** The tint under the one row, or the one box, that carries a guess. */
  guess: "rgba(255,197,61,.07)",
  /** Its edge. Dark enough to be an outline rather than a second amber thing on the screen. */
  guessEdge: "#4A3B17",
  /** A selected option's fill. Never a solid green: three deep, the unselected ones read disabled. */
  selected: "rgba(90,240,90,.10)",
} as const;

/**
 * Two families and a strict division of labour: the grotesk says words, the mono says numbers.
 *
 * THE MONO IS FOR FIGURES, UNITS, TIMES AND CODES — never for prose. Its word space is a full mono
 * advance, so a thousands gap must be a `thousandsGap` span and a unit like `g` must live OUTSIDE
 * the mono run. Get that wrong and `141 g` renders with a hole you can park a bus in.
 *
 * ponytail: the spec names Plus Jakarta Sans and DM Mono, which are Google Fonts. They are first
 * in each stack and NOT fetched: a `<link>` to fonts.googleapis.com would need `style-src` and
 * `font-src` opened to a third party on the one page whose policy is `default-src 'none'`, and
 * would tell Google about every page load. Self-hosting the two `.woff2` from this origin is the
 * upgrade and needs no policy change.
 */
export const FAMILY = {
  ui: `"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
  mono: `"DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace`,
} as const;

/** The gap that stands in for a thousands separator inside a mono run. See `FAMILY`. */
export const THOUSANDS_GAP = "0.24em";

/** One role in the type scale. Sizes are px, tracking is em, and both are numbers on purpose. */
export interface TypeRole {
  /** px. The phone's size; the spec's larger variants are the same role on a wider screen. */
  size: number;
  weight: 400 | 500 | 700 | 800;
  /** em. Negative tightens, which is what a display size needs and a micro-label must not have. */
  tracking: number;
  /** Unitless line height. */
  leading: number;
  uppercase?: true;
}

/**
 * The scale, BY ROLE. A size is chosen by what the text IS, never by how big it should look — that
 * is the difference between a scale and a list of numbers.
 */
export const TYPE = {
  /** The one figure a screen exists to show: the day, the plan. */
  hero: { size: 44, weight: 800, tracking: -0.03, leading: 1 },
  /** A page's own name. */
  headline: { size: 28, weight: 800, tracking: -0.035, leading: 1.16 },
  /** A screen's subject — a meal's name, a sheet's opening line. */
  title: { size: 21, weight: 800, tracking: -0.02, leading: 1.2 },
  /** A card's heading. */
  section: { size: 17, weight: 800, tracking: -0.01, leading: 1.3 },
  /** A list row, an option, a table cell. */
  row: { size: 15, weight: 700, tracking: -0.01, leading: 1.35 },
  /** Paragraphs and chat bubbles. */
  body: { size: 14, weight: 400, tracking: 0, leading: 1.5 },
  /** Helper lines and sub-text. */
  secondary: { size: 12.5, weight: 400, tracking: 0, leading: 1.45 },
  /** The uppercase label above a group. Always `t2`, never a heading in disguise. */
  micro: { size: 11, weight: 700, tracking: 0.13, leading: 1.3, uppercase: true },
  /** Every primary button's label. */
  cta: { size: 14, weight: 800, tracking: 0.09, leading: 1, uppercase: true },
  /** A state chip, a tab, a table header. */
  chip: { size: 10.5, weight: 700, tracking: 0.09, leading: 1.3, uppercase: true },
} as const satisfies Record<string, TypeRole>;

/**
 * Radii, spacing and the heights that are fixed. Every value is px.
 *
 * A RADIUS IS CHOSEN BY WHAT THE THING IS: the bigger the object, the rounder it is, so a card is
 * never as sharp as the row inside it.
 */
export const GEOMETRY = {
  /** The entry card — the largest single object in the product. */
  radiusEntry: 22,
  /** A card, a note. */
  radiusCard: 18,
  /** An option row, a panel inside a card. */
  radiusPanel: 16,
  /** A list row, a button, a field, a tile. */
  radiusRow: 14,
  /** Something inline: a thumbnail, a nav item, a chip's box. */
  radiusInline: 11,
  /** A pill: a chip, a tab bar. */
  radiusPill: 999,
  /** The screen edge. Everything on the page starts here. */
  gutter: 16,
  /** Between two things in the same group. */
  gapTight: 9,
  /** Between cards in a column. */
  gapCards: 14,
  /** Before a new section's label. */
  gapSection: 22,
  /** A primary button on a phone, full width. */
  ctaHeight: 56,
  /** A list row with a 44px media square in it. */
  rowHeight: 74,
  /** An option row. */
  optionHeight: 56,
  /** The media square on a list row. */
  thumb: 44,
} as const;

/**
 * The gauge — the day, and the one component the spec draws rather than describes.
 *
 * A SEMICIRCLE, NEVER A CLOSED RING, with no band segment and no floor tick on it: both of those
 * were range machinery. It shows ONE quantity — how much of the plan the day has spent — and the
 * figure sits inside the arc.
 */
export const GAUGE = {
  /** The box the path is drawn in. */
  viewBox: "0 0 326 172",
  path: "M33 154 A130 130 0 0 1 293 154",
  stroke: 16,
  /** π × 130, the arc's own length. A fill is `fraction × this`, which is arithmetic, not taste. */
  length: 408.41,
} as const;

/**
 * The class names, so a consumer names a component the way the design names it.
 *
 * EXPORTED RATHER THAN TYPED AT EACH CALL SITE for the two that carry meaning: a row that is a
 * guess and an option that is selected are claims about the data, and a typo in either is a claim
 * that silently stops being made. The rest are ordinary strings in the markup.
 */
export const CLASS = {
  /** The one row, or box, whose figure is a guess. */
  guessed: "rowsel",
  /** The option the person chose. */
  selected: "sel",
  /** The amber hedge word, immediately before a figure and outside its mono run. */
  about: "abt",
  /** A figure: mono, tabular. */
  figure: "mono",
  /** The thousands gap inside a figure. */
  thousands: "ts",
} as const;

/**
 * Every hex this module emits, for the test that forbids any other one in the client's markup.
 *
 * Derived rather than listed: a token added above is allowed the moment it exists, and a hex in
 * the markup that is not here is exactly the failure the test is for.
 */
export const TOKEN_HEXES: readonly string[] = [
  ...Object.values(COLOR),
  ...Object.values(FILL).flatMap((v) => v.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []),
].map((h) => h.toLowerCase());

// ── The web rendering ─────────────────────────────────────────────────────────────────────────
//
// Everything below turns the values above into CSS. A phone consumer stops reading here.

const px = (n: number): string => `${n}px`;
/** One type role as a CSS declaration block. The one place a role becomes `font:`. */
const type = (r: TypeRole): string =>
  `font: ${r.weight} ${r.size}px/${r.leading} var(--ui); letter-spacing: ${r.tracking}em;` +
  (r.uppercase ? " text-transform: uppercase;" : "");

/**
 * The one stylesheet, built from the values above and holding no literal of its own.
 *
 * NAMED AS THE SPEC NAMES THEM, so a screen drawn against the design and a screen drawn against
 * this file are the same screen: `.card`, `.wash`, `.ink`, `.gauge`, `.gnum`, `.big`, `.stat`,
 * `.sl`, `.lab`, `.tiles`/`.tile`/`.bar`, `.mono`, `.ts`, `.abt`, `.num`, `.rowsel`, `.opt`/`.sel`/
 * `.tk`, `.btn`/`.btn2`, `.bub`/`.them`/`.me`, `.comp`/`.send`, `.nav`, `.ph`/`.phl`, `.kbd`,
 * `.prog`, and the table.
 *
 * WHAT IS NOT HERE is the desktop rail and its two columns: this client is one column at every
 * width, and a rail with nothing to put in it is decoration.
 */
export const STYLESHEET = `
:root {
  color-scheme: dark;
  --ui: ${FAMILY.ui};
  --mono: ${FAMILY.mono};
  --ground: ${COLOR.ground};
  --surface: ${COLOR.surface};
  --sunken: ${COLOR.surfaceSunken};
  --raised: ${COLOR.raised};
  --line: ${COLOR.line};
  --hairline: ${COLOR.hairline};
  --green: ${COLOR.green};
  --green-deep: ${COLOR.greenDeep};
  --ink: ${COLOR.ink};
  --amber: ${COLOR.amber};
  --blue: ${COLOR.blue};
  --t1: ${COLOR.t1};
  --t2: ${COLOR.t2};
  --t3: ${COLOR.t3};
  --t4: ${COLOR.t4};
  --bad: ${COLOR.bad};
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--ground); color: var(--t1); ${type(TYPE.body)}
  -webkit-font-smoothing: antialiased; }
#app { max-width: 30rem; margin: 0 auto; padding: ${px(GEOMETRY.gutter)} ${px(GEOMETRY.gutter)} 4rem; }

/* ── The number grammar's own three utilities ─────────────────────────────────────────────── */
/* The mono is for figures and units, never for prose. */
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
/* A thousands gap. NOT a space: the mono's word space is a full advance and leaves a hole. */
.ts { display: inline-block; width: ${THOUSANDS_GAP}; }
/* The hedge. Amber, 700, immediately before the figure and outside its span. Nothing else amber. */
.abt { color: var(--amber); font-weight: 700; }
/* A figure in a column of figures. */
.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }

.lab { ${type(TYPE.micro)} color: var(--t2); margin: 0 0 ${px(GEOMETRY.gapTight)}; }
.muted { color: var(--t3); }
h1 { ${type(TYPE.headline)} margin: 0 0 .5rem; }
h2 { ${type(TYPE.section)} margin: 0 0 .5rem; }
h3 { ${type(TYPE.title)} margin: 0 0 .35rem; }
p { margin: 0 0 .6rem; }

/* ── Surfaces ─────────────────────────────────────────────────────────────────────────────── */
.card { background: var(--surface); border-radius: ${px(GEOMETRY.radiusCard)};
  padding: 15px ${px(GEOMETRY.gutter)}; margin-bottom: ${px(GEOMETRY.gapCards)};
  position: relative; overflow: hidden; }
/* A panel that sits BEHIND a card: the note under a meal, the well a question lives in. */
.note { background: var(--sunken); border-radius: ${px(GEOMETRY.radiusPanel)};
  padding: 14px ${px(GEOMETRY.gutter)}; margin-bottom: ${px(GEOMETRY.gapCards)}; }
/* The wash, on the day and on an arrival. Every word on it is ink, which is why it holds a label
   and nothing more — worn anywhere else it is wallpaper. */
.wash { position: absolute; inset: 0 0 auto 0; height: 52px; background: ${FILL.wash}; }
.ink { color: var(--ink); position: relative; }

/* ── The gauge ────────────────────────────────────────────────────────────────────────────── */
.gauge { position: relative; height: 172px; margin: 4px 0 0; }
.gauge svg { display: block; margin: 0 auto; width: 100%; max-width: 326px; height: auto; }
/* Inside the arc, inset far enough that a four-digit figure cannot touch it. */
.gnum { position: absolute; left: 0; right: 0; top: 48px; padding: 0 62px; text-align: center; }
.big { ${type(TYPE.hero)} margin: 0; }
/* The hedge is its own line above the figure: it qualifies the number, it is not part of it, and
   at hero size it would be the loudest word on the screen. */
.big .abt { display: block; font: ${TYPE.chip.weight} 13px/1.3 var(--ui); letter-spacing: 0;
  text-transform: none; }
.big .mono { font-size: 40px; }
.big .muted { display: block; margin-top: 6px; ${type(TYPE.secondary)} color: var(--t3); }
/* Over the plan the figure stays white: the two colours that would say otherwise are spoken for. */
.big.warn { color: var(--t1); }

/* The status row under the day. */
.stat { display: flex; justify-content: space-between; align-items: center; gap: .75rem;
  margin-top: 6px; }
.sl { ${type(TYPE.chip)} }
/* The floor, and the ONLY blue in the product. A status line, never a mark on a scale. */
.sl.floor { color: var(--blue); }

/* ── Macro tiles ──────────────────────────────────────────────────────────────────────────── */
.tiles { display: flex; gap: ${px(GEOMETRY.gapTight)}; margin-bottom: ${px(GEOMETRY.gapCards)}; }
.tile { flex: 1; background: var(--surface); border-radius: 13px; padding: 11px 12px 13px; }
.tile .lab { font-size: 10px; margin: 0; }
.tile-v { ${type(TYPE.row)} font-weight: 500; margin-top: 5px; }
.tile-v .muted { font-size: 11px; }
/* Progress: a plain bar, and it only ever advances. No count of what remains, no dot row. */
.bar { height: 4px; border-radius: 2px; background: var(--raised); overflow: hidden; margin-top: 9px; }
.bar > i { display: block; height: 100%; background: var(--t1); border-radius: 2px; }
.prog { height: 5px; border-radius: 3px; background: var(--raised); overflow: hidden; }
.prog > i { display: block; height: 100%; background: var(--green); border-radius: 3px; }

/* ── Rows and the table ───────────────────────────────────────────────────────────────────── */
.meals { list-style: none; margin: 0 0 ${px(GEOMETRY.gapCards)}; padding: 4px;
  background: var(--surface); border-radius: ${px(GEOMETRY.radiusCard)}; }
.meal { display: flex; align-items: center; gap: 12px; min-height: ${px(GEOMETRY.rowHeight)};
  padding: 11px 12px; border-bottom: 1px solid var(--line);
  border-radius: ${px(GEOMETRY.radiusRow)}; color: inherit; text-decoration: none; }
.meal:last-child { border-bottom: 0; }
.meal-name { ${type(TYPE.row)} flex-grow: 1; }
.meal-time { ${type(TYPE.secondary)} font-family: var(--mono); color: var(--t3); }
.meal-kcal { ${type(TYPE.row)} font-weight: 400; }
/* The ONE row worth fixing. Every other row stays silent: silence is what "read cleanly" is. */
.rowsel { background: ${FILL.guess}; outline: 1.5px solid ${FILL.guessEdge}; }

table { border-collapse: collapse; width: 100%; }
th { text-align: left; ${type(TYPE.chip)} color: var(--t4); padding: 0 12px 10px;
  border-bottom: 1px solid var(--raised); }
td { padding: 11px 12px; border-bottom: 1px solid var(--line); ${type(TYPE.body)}
  vertical-align: middle; }
tr:last-child td { border-bottom: 0; }
td.num, th.num { text-align: right; }

/* ── The option row ───────────────────────────────────────────────────────────────────────── */
/* NEVER A SOLID GREEN FILL: three deep in a column it makes the unanswered options read disabled. */
.opt { display: flex; align-items: center; gap: 12px; width: 100%; text-align: left;
  min-height: ${px(GEOMETRY.optionHeight)}; padding: ${px(GEOMETRY.gutter)};
  margin-bottom: 10px; background: var(--surface); border: 1.5px solid var(--surface);
  border-radius: ${px(GEOMETRY.radiusPanel)}; color: var(--t1); font: inherit; cursor: pointer; }
.opt-t { ${type(TYPE.row)} font-size: 16px; flex-grow: 1; }
.opt .tk { width: 23px; height: 23px; border-radius: 12px; border: 1.5px solid var(--raised);
  flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: transparent; }
.opt.sel { border-color: var(--green); background: ${FILL.selected}; }
.opt.sel .tk { background: var(--green); border-color: var(--green); color: var(--ink); }

/* ── Chrome and buttons ───────────────────────────────────────────────────────────────────── */
nav { display: flex; gap: .5rem; align-items: center; margin-bottom: ${px(GEOMETRY.gapSection)}; }
.nav { display: inline-flex; align-items: center; height: 34px; padding: 0 12px;
  border-radius: ${px(GEOMETRY.radiusInline)}; ${type(TYPE.row)} color: var(--t4);
  text-decoration: none; }
.nav.on { background: var(--surface); color: var(--t1); }
.link { background: none; border: 0; color: var(--t3); cursor: pointer; font: inherit; }
.link.right { margin-left: auto; }
.link + .link { margin-left: 1rem; }
.lang { margin-left: auto; background: none; border: 0; color: var(--t3); font: inherit;
  cursor: pointer; }
.lang + .link { margin-left: 1rem; }
/* A keyboard hint, inside a button or beside a field. */
.kbd { display: inline-flex; align-items: center; height: 21px; padding: 0 6px; border-radius: 5px;
  background: var(--surface); border: 1px solid var(--raised); font-family: var(--mono);
  font-size: 11px; color: var(--t2); }

.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: ${px(GEOMETRY.ctaHeight)}; padding: 0 20px; border: 0;
  border-radius: ${px(GEOMETRY.radiusRow)}; background: var(--green); color: var(--ink);
  ${type(TYPE.cta)} text-decoration: none; cursor: pointer; }
.btn.wide { width: 100%; }
/* The secondary is a surface with an edge, never a paler green. */
.btn2 { background: var(--surface); color: var(--t1); border: 1px solid var(--raised); }
.card .btn, .card .btn2, .note .btn, .note .btn2 { margin: .6rem .5rem 0 0; }

/* ── The photograph that is not there ─────────────────────────────────────────────────────── */
.ph { background: ${FILL.photo}; display: flex; align-items: center; justify-content: center;
  border-radius: ${px(GEOMETRY.radiusRow)}; height: 150px; margin-bottom: ${px(GEOMETRY.gapCards)}; }
.phl { ${type(TYPE.chip)} letter-spacing: .16em; color: var(--t4);
  background: rgba(10,12,13,.72); padding: 7px 12px; border-radius: 8px; }

/* ── The composer ─────────────────────────────────────────────────────────────────────────── */
.comp { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem;
  margin-top: ${px(GEOMETRY.gapCards)}; background: var(--surface); border: 1px solid var(--raised);
  border-radius: ${px(GEOMETRY.radiusRow)}; padding: 8px 8px 8px 14px; }
.comp input[type="text"] { flex: 1 1 10rem; min-height: 38px; background: none; border: 0;
  outline: 0; color: var(--t1); font: inherit; }
.comp input[type="text"]::placeholder { color: var(--t4); }
/* The photo composer's caption takes a row of its own: beside a file input and a four-word button
   a 10rem basis cut the placeholder mid-word, and the placeholder says what the field is for.
   Scoped by what the form HOLDS rather than by a modifier class. */
.comp:has(input[type="file"]) input[type="text"] { flex: 1 1 100%; }
.comp input[type="file"] { flex: 1 1 100%; color: var(--t3); font: inherit; }
.comp button { min-height: 38px; padding: 0 14px; border: 1px solid var(--raised);
  border-radius: 10px; background: var(--surface); color: var(--t1); font: inherit; cursor: pointer; }
.send { border: 0; background: var(--green); color: var(--ink);
  font: ${TYPE.cta.weight} 12.5px/1 var(--ui); letter-spacing: .06em; text-transform: uppercase; }
.comp button.send { border: 0; background: var(--green); color: var(--ink); }

/* ── The thread ───────────────────────────────────────────────────────────────────────────── */
/* Theirs is a surface, yours is green — the one place green is not an affordance, and it is still
   not decoration: it is who is speaking. */
.thread { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column;
  gap: .5rem; }
.line { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; }
.line .bub { flex: 0 1 auto; width: 100%; }
.line.mine { justify-content: flex-end; }
.bub { max-width: 30rem; margin: 0; padding: 11px 15px; border-radius: 18px; ${type(TYPE.body)} }
.them { background: var(--surface); border-top-left-radius: 7px; }
.me { background: var(--green); color: var(--ink); font-weight: 600; border-top-right-radius: 7px; }
.line .muted { ${type(TYPE.secondary)} }
.line button { margin: .35rem .35rem 0 0; padding: 4px 10px; border: 1px solid var(--raised);
  border-radius: ${px(GEOMETRY.radiusPill)}; background: none; color: var(--t3);
  ${type(TYPE.secondary)} cursor: pointer; }

/* ── Entry ────────────────────────────────────────────────────────────────────────────────── */
/* The largest single object in the product, and the only screen with no chrome above it. */
.entry { background: var(--surface); border-radius: ${px(GEOMETRY.radiusEntry)}; padding: 26px 22px;
  margin-top: 8vh; position: relative; overflow: hidden; }
.entry .wash { height: 120px; }
.entry-brand { ${type(TYPE.headline)} position: relative; margin: 0 0 6px; }
.entry-lede { ${type(TYPE.body)} position: relative; margin: 0 0 20px; }
.srow { display: flex; align-items: flex-start; gap: 12px; padding: 11px 0;
  border-top: 1px solid var(--line); ${type(TYPE.body)} color: var(--t2); }
.srow:first-child { border-top: 0; }
.sn { width: 22px; height: 22px; border-radius: 11px; background: var(--raised); color: var(--t2);
  font-family: var(--mono); font-size: 11px; font-weight: 700; display: flex;
  align-items: center; justify-content: center; flex-shrink: 0; }

/* The amber label is the ONE worded flag a screen may carry, and this is the only place in the
   product a label is amber. The settled line is what replaces it: a guess that has been answered
   is known now, which is the second half of what green means. */
.lab.amber { color: var(--amber); }
.settled { color: var(--green); ${type(TYPE.body)} font-weight: 700; }

/* ── States ───────────────────────────────────────────────────────────────────────────────── */
.error, .notice { color: var(--bad); }
.notice { margin: 1rem 0 0; }
input:disabled, button:disabled { opacity: .5; cursor: default; }
/* The focus ring is the affordance colour, because that is what focus is. */
:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
`;
