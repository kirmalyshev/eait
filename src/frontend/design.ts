// The design system: every token this application has, and the one stylesheet built from them.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// ONE MODULE OWNS EVERY VALUE. Before this the shell carried eleven hexes inline, which is the
// same defect the root AGENTS.md names about limits: two numbers that must agree are two numbers
// that eventually will not. `server/index.test.ts` fails if a hex that is not one of these
// reappears in the page, and `test/client.test.ts` fails if one appears in the bundle's source, so
// the rule is enforced rather than remembered.
//
// EACH COMMENT SAYS WHAT THE VALUE MEANS, not where it came from. "Sampled from a screenshot" is
// provenance and it is in the spec; what a builder needs at the call site is whether they are
// allowed to use this colour for the thing in front of them. Three of them are allowed for exactly
// one thing each, and those three are the whole honesty mechanism:
//
//   AMBER is the guess and nothing else.  BLUE is the floor and nothing else.
//   GREEN is affordance and settled-exact — and never decoration.
//
// WHERE IT IS INTERPOLATED. `server/index.ts` puts `STYLESHEET` in its single `<style nonce>`
// block. It is still ONE stylesheet under the policy, which is that file's rule; what moved is
// where the values live, not how many documents the browser has to trust.
//
// THIS FILE IS THE BROWSER HALF OF THE WORKSPACE (`tsconfig.json` here has `types: []`), so it is
// plain data with no `Bun` anything in it — which is what lets `server/` import it for the page
// and `main.ts` import `CLASS_GUESSED_ROW` for the row that carries a guess.
// ─────────────────────────────────────────────────────────────────────────────────────────────

/**
 * The palette.
 *
 * DARK ONLY, and that is the design rather than an omission: this page used to follow
 * `prefers-color-scheme` and the spec draws one surface. A light theme is not a lighter version of
 * these values — the accent that is a 15:1 fill here is 1.08:1 on paper, which is the lesson
 * `shared/palette.ts` already records about the OTHER surfaces this product has. Those pages (the
 * landing, `/start`) keep their own two-theme palette; this is the application, and it is one.
 */
export const COLOR = {
  /** The page, and every screen on it. Nothing sits behind this. */
  ground: "#121516",
  /** Anything raised off the page and read as one object: a card, a list row, a bubble, a tile. */
  surface: "#282828",
  /** A panel that must sit BEHIND a surface — a well a card lives in, an inline note. */
  surfaceSunken: "#1B1E1F",
  /** The unfilled half of anything that fills: a track, an unselected segment, a pill. */
  raised: "#3D3C42",
  /** A rule BETWEEN rows inside one card. One step off the surface, never a full border. */
  line: "#2F3334",
  /** A rule between REGIONS — a header bar's underside, a rail's edge. Darker than `line`. */
  hairline: "#24292A",

  /**
   * Affordance, and settled-exact. A button you can press, the nav item you are on, the option you
   * chose, the consumed part of the day, and the number a guess becomes once it has been answered.
   * NEVER decoration: a green thing on this page is a thing you can act on or a thing that is now
   * known exactly.
   */
  green: "#5AF05A",
  /** Every glyph and every icon that sits ON green. The only text colour allowed there. */
  ink: "#08170A",

  /**
   * THE GUESS, AND NOTHING ELSE, EVER. The word "about", the figure it governs, the one flag
   * sentence, and the row that carries them. If you are reaching for amber for a warning, a
   * highlight or an accent, the answer is no — the colour means one thing and it stops meaning it
   * the moment it means two. (#28 is the grammar this colour draws.)
   */
  amber: "#FFC53D",
  /**
   * THE CALORIE FLOOR, AND NOTHING ELSE. At most once per screen, as text, and only on a screen
   * where the floor is worth mentioning. It is a status line, never a tick on a gauge and never a
   * region on a chart — both of those were range machinery, which is what #28 removed.
   */
  blue: "#5AA9FF",

  /** Headings, and any figure that is the point of the line it is in. */
  t1: "#FFFFFF",
  /** Body text ON a surface, and every uppercase micro-label. */
  t2: "#C6C4C5",
  /** Secondary body: a helper line, a sub-caption, the part of a sentence that is context. 6.4:1. */
  t3: "#A3A3A3",
  /** The quietest text this page allows. 5.6:1 on the ground, and nothing may be quieter. */
  t4: "#9A9A9A",

  /** Something went wrong and the person has to read it. Never amber: amber is the guess. */
  bad: "#FF6B6B",
} as const;

/**
 * The fills that are not a flat colour.
 *
 * THE WASH IS ALLOWED IN TWO PLACES ONLY — the day, and an arrival. Worn on a question screen or a
 * meal screen it is wallpaper, and it forces every word on it to near-black, which is why a washed
 * region can hold a date and a title and nothing more.
 */
export const FILL = {
  /** The day's header strip, and an arrival screen's top. `COLOR.ink` on every word. */
  wash: `linear-gradient(180deg, ${"#5AF05A"} 0%, ${"#3FC551"} 42%, ${"#1E8C3E"} 78%, ${"#121516"} 100%)`,
  /** Stands in for a photograph that is not there. Never a stock image. */
  photo: `repeating-linear-gradient(135deg, ${"#1A1D1E"} 0 9px, ${"#222728"} 9px 18px)`,
  /** The tint under the one row that carries a guess, with the outline that goes with it. */
  guessRow: "rgba(255,197,61,.07)",
  guessRowEdge: "#4A3B17",
} as const;

/**
 * Two families and a strict division of labour: the grotesk says words, the mono says numbers.
 *
 * THE MONO IS FOR FIGURES, UNITS, TIMES AND CODES — never for prose. Its word space is a full mono
 * advance, so a thousands gap must be a `.ts` span of `0.24em` and a unit like `g` must live
 * OUTSIDE the mono span. Get that wrong and `141 g` renders with a hole you can park a bus in.
 *
 * ponytail: the spec names Plus Jakarta Sans and DM Mono, which are Google Fonts. They are first in
 * each stack and NOT fetched: a `<link>` to fonts.googleapis.com would need `style-src` and
 * `font-src` opened to a third party on the one page in this product whose policy is
 * `default-src 'none'`, and would tell Google about every page load. A visitor who has the faces
 * installed gets them; everybody else gets the platform's, which keeps both divisions of labour.
 * Self-hosting the two `.woff2` files from this origin is the upgrade, and needs no policy change.
 */
export const FAMILY = {
  ui: `"Plus Jakarta Sans", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`,
  mono: `"DM Mono", ui-monospace, SFMono-Regular, Menlo, monospace`,
} as const;

/**
 * The type scale, by ROLE. A size is chosen by what the text is, never by how big it should look.
 *
 * The weights are the design's: 800 for anything that is a headline or a figure, 700 for a row
 * title or a label, 400 for prose. Tracking tightens as the size grows and opens on small caps.
 */
export const TYPE = {
  /** The one figure a screen exists to show. */
  hero: "font: 800 44px/1 var(--ui); letter-spacing: -.03em;",
  /** A page's own name. */
  headline: "font: 800 28px/1.16 var(--ui); letter-spacing: -.035em;",
  /** A card's heading, a section's name when it is not a micro-label. */
  section: "font: 800 17px/1.3 var(--ui); letter-spacing: -.01em;",
  /** A list row, an option, a table cell. */
  row: "font: 700 15px/1.35 var(--ui); letter-spacing: -.01em;",
  /** Paragraphs and chat bubbles. */
  body: "font: 400 14px/1.5 var(--ui);",
  /** Helper lines and sub-text. */
  secondary: "font: 400 12.5px/1.45 var(--ui);",
  /** The uppercase label above a group. Always `--t2`, never a heading in disguise. */
  micro: "font: 700 11px/1.3 var(--ui); letter-spacing: .13em; text-transform: uppercase;",
  /** Every primary button's label. */
  cta: "font: 800 14px/1 var(--ui); letter-spacing: .09em; text-transform: uppercase;",
} as const;

/**
 * Radii, spacing and the heights that are fixed.
 *
 * A radius is chosen by what the thing IS: the bigger the object, the rounder it is, so a card is
 * never as sharp as the row inside it.
 */
export const GEOMETRY = {
  /** A card, a note — the largest objects on the page. */
  radiusCard: "18px",
  /** A row, a button, a field, a tile. */
  radiusRow: "14px",
  /** Something inline: a thumbnail, a chip's box, a nav item. */
  radiusInline: "11px",
  /** A pill: a chip, a tab bar. */
  radiusPill: "999px",
  /** The screen edge. Everything on the page starts here. */
  gutter: "16px",
  /** Between two things in the same group. */
  gapTight: "9px",
  /** Between cards in a column. */
  gapCards: "14px",
  /** Before a new section's label. */
  gapSection: "22px",
  /** A primary button, full width. */
  ctaHeight: "56px",
  /** A list row with a 44px media square in it. */
  rowHeight: "74px",
  /** The widest this application's single column ever gets. */
  column: "34rem",
} as const;

/**
 * The gauge — the day, and the one component here the spec draws rather than describes.
 *
 * A SEMICIRCLE, NEVER A CLOSED RING, and with no band segment and no floor tick on it: both of
 * those were range machinery, and #28 is what removed them. What it shows is one quantity — how
 * much of the plan the day has spent — and the figure sits inside the arc.
 */
export const GAUGE = {
  /** The box the path below is drawn in. */
  viewBox: "0 0 326 172",
  path: "M33 154 A130 130 0 0 1 293 154",
  stroke: 16,
  /** π × 130, the arc's own length. `stroke-dasharray` is `fill × this`. */
  length: 408.41,
} as const;

/** The class the ONE row carrying a guess takes. Read by `main.ts`, defined by the stylesheet. */
export const CLASS_GUESSED_ROW = "rowsel";

/**
 * Every hex this module emits, for the test that forbids any other one on the page.
 *
 * Derived rather than listed: a token added above is allowed in the markup the moment it exists,
 * and a hex that is in the markup and not here is the failure the test is for.
 */
export const TOKEN_HEXES: readonly string[] = [
  ...Object.values(COLOR),
  ...Object.values(FILL).flatMap((v) => v.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []),
].map((h) => h.toLowerCase());

/**
 * The one stylesheet, built from the values above and holding no literal of its own.
 *
 * NAMED AS THE SPEC NAMES THEM. `.card`, `.wash`, `.ink`, `.gauge`, `.gnum`, `.big`, `.stat`,
 * `.sl`, `.lab`, `.mono`, `.ts`, `.abt`, `.num`, `.rowsel`, `.btn`, `.btn2`, `.bub`/`.them`/`.me`,
 * `.comp`/`.send`, `.nav` — a component that exists in both places has one name, so a screen drawn
 * against the spec and a screen drawn against this file are the same screen. What is NOT here is
 * what this application has no screen for: the desktop rail and its table, option rows, the
 * onboarding progress bar, the photo placeholder. A style with no element is decoration.
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
body { margin: 0; background: var(--ground); color: var(--t1); ${TYPE.body}
  -webkit-font-smoothing: antialiased; }
#app { max-width: ${GEOMETRY.column}; margin: 0 auto; padding: ${GEOMETRY.gutter} ${GEOMETRY.gutter} 4rem; }

/* The two type utilities the number grammar needs, and the trap they exist to avoid. The mono's
   word space is a full advance, so a thousands gap is .ts and a unit never sits inside .mono. */
.mono { font-family: var(--mono); font-variant-numeric: tabular-nums; }
.ts { display: inline-block; width: .24em; }
/* The hedge. Amber, 700, immediately before the figure and outside its span. Nothing else amber. */
.abt { color: var(--amber); font-weight: 700; }
/* A figure in a column of figures. */
.num { text-align: right; white-space: nowrap; font-variant-numeric: tabular-nums; }
.lab { ${TYPE.micro} color: var(--t2); margin: 0 0 ${GEOMETRY.gapTight}; }
.muted { color: var(--t3); }

h1 { ${TYPE.headline} margin: 0 0 .5rem; }
h2 { ${TYPE.section} margin: 0 0 .5rem; }
p { margin: 0 0 .6rem; }

/* Everything raised off the page and read as one object. */
.card { background: var(--surface); border-radius: ${GEOMETRY.radiusCard};
  padding: 15px ${GEOMETRY.gutter}; margin-bottom: ${GEOMETRY.gapCards}; position: relative;
  overflow: hidden; }
/* The wash, on the day and on nothing else here. Every word on it is ink, which is why it holds
   a label and nothing more. */
.wash { position: absolute; inset: 0 0 auto 0; height: 52px; background: ${FILL.wash}; }
.ink { color: var(--ink); position: relative; }

/* THE GAUGE: a semicircle, no band, no floor tick. The figure sits inside the arc. */
.gauge { position: relative; height: 172px; margin: 4px 0 0; }
.gauge svg { display: block; margin: 0 auto; width: 100%; max-width: 326px; height: auto; }
/* Inside the arc, and inset far enough that a four-digit figure cannot touch it. Three stacked
   lines — the hedge, the figure, the unit and state — which is the spec's own gnum. */
.gnum { position: absolute; left: 0; right: 0; top: 48px; padding: 0 62px; text-align: center; }
.big { ${TYPE.hero} margin: 0; }
/* The hedge is its own line above the figure, small: it qualifies the number, it is not part of
   it, and at 44px it would be the loudest word on the screen. */
.big .abt { display: block; font: 700 13px/1.3 var(--ui); letter-spacing: 0; }
.big .mono { font-size: 40px; }
.big .muted { display: block; margin-top: 6px; ${TYPE.secondary} color: var(--t3); }
/* Over the plan. NOT amber — amber is the guess, and being over the plan is a fact, not an
   estimate. The figure goes white and the arc says the rest. */
.big.warn { color: var(--t1); }

/* The status row under the day: the floor on the left, what is left on the right. */
.stat { display: flex; justify-content: space-between; align-items: center; gap: .75rem;
  margin-top: 6px; }
.sl { font: 700 10.5px/1.3 var(--ui); letter-spacing: .09em; text-transform: uppercase; }
/* The floor, and the ONLY blue on the page. A status line, never a mark on a scale. */
.sl.floor { color: var(--blue); }

/* Meals. A row is a name and a figure; the one row that is a guess says so and the rest stay
   silent — silence is what "read cleanly" looks like. */
/* The list IS a card — the same object the day above it is. Left on the ground the rows read as
   three loose lines with rules between them rather than as one table. */
.meals { list-style: none; margin: 0; padding: 4px 4px; background: var(--surface);
  border-radius: ${GEOMETRY.radiusCard}; }
.meal { display: flex; justify-content: space-between; align-items: center; gap: 1rem;
  padding: 11px 12px; border-bottom: 1px solid var(--line); border-radius: ${GEOMETRY.radiusRow}; }
.meal:last-child { border-bottom: 0; }
.meal-name { ${TYPE.row} }
.meal-kcal { ${TYPE.row} font-weight: 400; color: var(--t1); }
.rowsel { background: ${FILL.guessRow}; outline: 1.5px solid ${FILL.guessRowEdge}; }

/* Chrome: the nav item is the spec's, the rest of the bar is this application's own. */
nav { display: flex; gap: .5rem; align-items: center; margin-bottom: ${GEOMETRY.gapSection}; }
.nav { display: inline-flex; align-items: center; height: 34px; padding: 0 12px;
  border-radius: ${GEOMETRY.radiusInline}; ${TYPE.row} color: var(--t4); text-decoration: none; }
.nav.on { background: var(--surface); color: var(--t1); }
.link { margin-left: auto; background: none; border: 0; color: var(--t3); cursor: pointer;
  font: inherit; }
.link + .link { margin-left: 1rem; }
.lang { margin-left: auto; background: none; border: 0; color: var(--t3); font: inherit;
  cursor: pointer; }
.lang + .link { margin-left: 1rem; }

/* Buttons. Green is the affordance; the secondary is a surface with an edge, never a paler green. */
.btn { display: inline-flex; align-items: center; justify-content: center;
  min-height: ${GEOMETRY.ctaHeight}; padding: 0 20px; border: 0;
  border-radius: ${GEOMETRY.radiusRow}; background: var(--green); color: var(--ink);
  ${TYPE.cta} text-decoration: none; cursor: pointer; }
.btn2 { background: var(--surface); color: var(--t1); border: 1px solid var(--raised); }
.card .btn, .card .btn2 { margin: .6rem .5rem 0 0; }

/* The composer: one field and one send, on a surface with an edge. */
.comp { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem;
  margin-top: ${GEOMETRY.gapCards}; background: var(--surface); border: 1px solid var(--raised);
  border-radius: ${GEOMETRY.radiusRow}; padding: 8px 8px 8px 14px; }
.comp input[type="text"] { flex: 1 1 10rem; min-height: 38px; background: none; border: 0;
  outline: 0; color: var(--t1); font: inherit; }
/* The photo composer's caption takes a row of its own. Beside a file input and a button whose
   label is four words, a 10rem basis cut the placeholder mid-word — and the placeholder is the
   only thing that says what the field is for. Scoped by what the form HOLDS rather than by a
   modifier class: there are two composers and one of them has a file input. */
.comp:has(input[type="file"]) input[type="text"] { flex: 1 1 100%; }
.comp input[type="text"]::placeholder { color: var(--t4); }
/* A row of its own: beside a caption field and a send button it squeezed both to a few
   characters, and the placeholder that says what the field is for was the half that got cut. */
.comp input[type="file"] { flex: 1 1 100%; color: var(--t3); font: inherit; }
.comp button { min-height: 38px; padding: 0 14px; border: 1px solid var(--raised);
  border-radius: 10px; background: var(--surface); color: var(--t1); font: inherit;
  cursor: pointer; }
.send { border: 0; background: var(--green); color: var(--ink);
  font: 800 12.5px/1 var(--ui); letter-spacing: .06em; text-transform: uppercase; }
.comp button.send { border: 0; background: var(--green); color: var(--ink); }

/* The thread. Theirs is a surface, yours is green — the one place green is not an affordance, and
   it is still not decoration: it is who is speaking. */
.thread { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column;
  gap: .5rem; }
/* The bubble takes its own row and the two controls under it share one, which is a WRAPPING ROW
   rather than a column: in a column each button is a row of its own, and Edit sat on top of
   Delete in a stack two taps tall. */
.line { display: flex; flex-wrap: wrap; gap: .35rem; align-items: center; }
.line .bub { flex: 0 1 auto; width: 100%; }
.line.mine { justify-content: flex-end; }
.bub { max-width: 30rem; margin: 0; padding: 11px 15px; border-radius: 18px; ${TYPE.body} }
.them { background: var(--surface); border-top-left-radius: 7px; }
.me { background: var(--green); color: var(--ink); font-weight: 600; border-top-right-radius: 7px; }
.line .muted { ${TYPE.secondary} }
.line button { margin: .35rem .35rem 0 0; padding: 4px 10px; border: 1px solid var(--raised);
  border-radius: ${GEOMETRY.radiusPill}; background: none; color: var(--t3);
  ${TYPE.secondary} cursor: pointer; }

/* Anything that went wrong. Red, never amber. */
.error, .notice { color: var(--bad); }
.notice { margin: 1rem 0 0; }

input:disabled, button:disabled { opacity: .5; cursor: default; }
/* The focus ring is the affordance colour, because that is what focus is. */
:focus-visible { outline: 2px solid var(--green); outline-offset: 2px; }
`;
