// The stylesheet, as a string, emitted to `styles.css` beside the page.
//
// EXTERNAL RATHER THAN INLINE, for one reason: it lets the Content-Security-Policy served with the
// page be `default-src 'none'; style-src 'self'; script-src 'self'` with no `unsafe-inline`
// anywhere. Almost nothing on this page is JavaScript — the one animated moment is CSS and the FAQ
// is `<details>` — and the single exception is `/theme.js`, which remembers whether the visitor
// chose the light page or the dark one. That file is same-origin, sends nothing anywhere and
// stores one word in this browser, which is the most a page whose pitch is "we do not keep
// anything of yours" should be doing with a script.
//
// The tokens are `src/mobile/lib/theme.ts`, transcribed. A test asserts they still match, because
// two files holding one palette is the shape of a drift, and the accent going stale here would be
// the first thing a visitor coming from the App Store screenshots notices.
//
// THE 2026-09-06 PASS, in one paragraph. The page had the palette and the typeface of a premium
// product and dressed them as a spec sheet: a tracked-out monospace capital label above every
// block, a 1px grid around every group, numbers in a code font, and a hero carrying six paragraphs
// before the form. What changed is hierarchy and air, not identity — the same tokens, the same one
// accent on the one action, the same typeface, now carrying every heading and every number so the
// drawn phone and the headline read as one object; labels in sentence case at reading weight; the
// grids replaced by rules and surface where the content is a list and by nothing where it is not;
// one band in the OTHER theme's palette so the four numbers land like a plate on a dark table; and
// one arrival on load, words first, then the phone answering. Warmth is still Spud's skin tone at
// low alpha, and still never the accent.

import { dark, light, type ColorName } from "./tokens.ts";
import { sample } from "./content.ts";

/**
 * The kcal range the hero's scale is drawn across. Wide enough for any target the app produces, so
 * the floor mark sits in a fixed place rather than moving with the sample.
 */
const SCALE_MAX_KCAL = 2400;

const scalePercent = (kcal: number) =>
  `${Math.min(100, Math.max(0, (kcal / SCALE_MAX_KCAL) * 100)).toFixed(1)}%`;

/**
 * Rules whose VALUES come from the content, appended to the sheet below.
 *
 * These were `style="left:…"` and `style="--i:…"` attributes until the page was served with its own
 * Content-Security-Policy for the first time. `style-src` governs the `style` ATTRIBUTE as well as
 * the `<style>` element, so `style-src 'self'` — with no `unsafe-inline` — silently dropped every
 * one of them: the floor and target marks stacked at the left edge of the card and the arrival
 * sequence fired all at once. The page had been correct on `python -m http.server`, which sends no
 * policy at all, and was wrong the moment it reached nginx.
 *
 * The fix is not `unsafe-inline`. Every one of these values is STATIC — derived from `sample`, which
 * is a constant — so it belongs in the stylesheet, and putting it there keeps the strictest policy
 * intact. A test asserts the rendered HTML contains no `style` attribute at all, so this cannot come
 * back by someone reaching for the obvious tool.
 */
function derivedRules(): string {
  const { target, meal } = sample;

  const stagger = (selector: string, count: number, delay: (i: number) => number) =>
    Array.from({ length: count }, (_, i) => `${selector}-${i + 1} { animation-delay: ${delay(i)}ms; }`)
      .join("\n");

  return [
    "/* ── Generated from content.ts — see derivedRules() ─────────────────────────────────── */",
    `.scale-tick-floor, .scale-label-floor { left: ${scalePercent(target.floorKcal)}; }`,
    `.scale-tick-target, .scale-label-target { left: ${scalePercent(target.kcal)}; }`,
    // The words land first (the hero copy rises at 0 and 90ms, below), then the two cards, then the
    // verdict pills, in the order the app itself resolves them.
    stagger(".deal", 3, (i) => 200 + i * 120),
    stagger(".pill", meal.verdicts.length, (i) => 560 + i * 90),
    // The answer, last — one pill-slot after the last pill STARTS, so it is the final thing to
    // move. Its delay is derived from theirs rather than typed, so adding a fourth verdict cannot
    // make the sentence land in the middle of them.
    `.mcard-verdict { animation-delay: ${560 + meal.verdicts.length * 90 + 120}ms; }`,
    // And his note arrives last of all, under the card, the way the app resolves a turn.
    `.device-inner .spud-says { animation-delay: ${560 + meal.verdicts.length * 90 + 320}ms; }`,
  ].join("\n");
}

/**
 * One theme's variables, as a string. Written out per token rather than derived from the object
 * keys, so a value with no counterpart in the other theme is a COMPILE error here and not a light
 * colour surviving onto a dark page.
 *
 * `dim` is the one value that is not a straight copy of a token. --faint is the app's third text
 * colour, spent there on a caption glanced at for a second inside a screen the user chose to open;
 * this page spends its faintest colour on the small print under the button, the receipt line on
 * every refusal, and the whole footer — read once, by a stranger, deciding whether to trust a
 * health app. That deserves margin over the AA minimum, and it is what keeps three levels of
 * hierarchy from collapsing into two. A test asserts --faint is never USED on this page, so the
 * app's value cannot creep back in by being the obvious token to reach for; it stays declared so
 * the block still mirrors the app.
 */
/**
 * The custom properties both public surfaces are drawn from.
 *
 * EXPORTED so `web/page.ts` can build its pages out of the same names: the landing and `/start`
 * are one product to whoever is looking at them, and two copies of a palette is how they stopped
 * being one. The web pages import `lightVars`/`darkVars` and nothing else from this file.
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

const sheet = `
/* ── Tokens ─────────────────────────────────────────────────────────────────────────────────
   TWO THEMES, TWO SELECTORS.

   :root                       the light values, and what every visitor gets until they say otherwise
   :root[data-theme="dark"]    dark, and ONLY on an explicit choice

   THE OS PREFERENCE IS DELIBERATELY NOT CONSULTED. It used to be a prefers-color-scheme: dark
   block handed a dark page to every visitor whose machine is set that way, which is most phones
   after sunset. This is a marketing page rather than an app: it is the first thing anyone sees of
   the product, the photography and the mascot were drawn against the light ground, and half the
   audience arriving to a different page than the other half is not a feature. Dark stays one click
   away and is remembered; it is just not assumed.

   One accent, spent on exactly one thing per screen: the primary action. Same rule as the app.
   --care is reserved for the floor and nothing else, so a blue mark anywhere means "we stopped
   you". The warmth on this page is Spud's own skin tone as a low-alpha literal, never the accent. */
:root {
  ${lightVars}
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, Helvetica, Arial, sans-serif;
  --display: "Space Grotesk", var(--sans);
  --warm: 232 190 131;
  /* How much of that warmth lies over the first screen. Lighter on the dark page, where the same
     alpha over near-black reads as mud rather than as morning. */
  --haze: .16;

  --wrap: 70rem;
  --gutter: clamp(1.25rem, 5vw, 3rem);
}

:root[data-theme="dark"] { ${darkVars} --haze: .10; }

/* ── The one typeface this page owns ────────────────────────────────────────────────────── */
/* Space Grotesk, variable, latin subset, 22KB, SELF-HOSTED — the design review's verdict was that
   the identity was entirely rented from Apple, and type is the one thing a competitor cannot copy
   out of this CSS. Same-origin under font-src self, so the page still loads nothing from anyone
   else; the OFL licence text travels beside the file, as that licence requires. It carries every
   heading, every number and every label — one file, whatever it is used for — and body copy stays
   on the system stack, which is where 17px prose reads best on the phone it is mostly read on. */
@font-face {
  font-family: "Space Grotesk";
  src: url("/assets/fonts/space-grotesk-latin.woff2") format("woff2");
  font-weight: 300 700;
  font-display: swap;
}
h1, h2, h3, .wordmark, .num, .eyebrow, .step-ordinal, .ask-line, .founder-line, .faq-q,
.cta, .subscribe-button, .band-line, .tcard-label, .measured-label, .subscribe-label {
  font-family: var(--display);
}

/* ── Reset ──────────────────────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  /* The warm haze over the first screen belongs to the BODY rather than the hero, so the masthead
     sits inside it instead of on a hard edge above it. Bounded in rem, so it ends where the hero
     does on every width and never reaches the sections below. */
  background: linear-gradient(180deg, rgb(var(--warm) / var(--haze)), transparent 46rem) var(--ink);
  color: var(--text);
  font-family: var(--sans);
  font-size: 17px;
  line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
h1, h2, h3, p, ul, ol, figure, dl, dd { margin: 0; }
ul { padding: 0; list-style: none; }
img, svg { display: block; max-width: 100%; }
a { color: inherit; }
:focus-visible { outline: 2px solid var(--care); outline-offset: 3px; border-radius: 4px; }
/* Text selection in Spud's own skin tone — the one warm colour this page owns that is not the
   accent. Small, and met by anybody who drags a cursor through the copy. */
::selection { background: rgb(var(--warm) / .38); }

/* Every number on this page is tabular and set in the display face, the way the app sets its
   metrics: the product's claim is that it hands you a figure you can act on, and a figure that
   reflows as it changes does not read like one. */
.num { font-variant-numeric: tabular-nums; letter-spacing: -0.03em; }

.wrap { width: 100%; max-width: var(--wrap); margin: 0 auto; padding: 0 var(--gutter); }

/* ── Section marker ─────────────────────────────────────────────────────────────────────── */
/* A running label, in sentence case at reading weight. It was tracked-out monospace capitals
   behind a dash — the costume of a spec sheet, on a page for somebody deciding what to have for
   dinner. It names the section; it does not have to shout that it is a label. */
.eyebrow { font-size: .9375rem; font-weight: 500; color: var(--dim); margin-bottom: 1.5rem; }

.section { padding: clamp(5rem, 11vw, 9rem) 0; }
.section + .section { border-top: 1px solid var(--line); }
/* THE RUNNING MARGIN. On a wide screen the label lives in a margin column and rides with the
   section as it scrolls, the way a printed spread carries a marginal note; everything else takes
   the wide column. Below 62rem nothing changes. */
@media (min-width: 62rem) {
  .section > .wrap { display: grid; grid-template-columns: 11rem minmax(0, 1fr); column-gap: 4.5rem; }
  .section .eyebrow { grid-column: 1; margin: .5rem 0 0; position: sticky; top: 1.75rem; align-self: start; }
  .section > .wrap > :not(.eyebrow) { grid-column: 2; }
}
.section-head { max-width: 52ch; margin-bottom: clamp(2.75rem, 5vw, 4rem); }
.section-title {
  font-size: clamp(2.125rem, 4.6vw, 3.25rem); font-weight: 700;
  letter-spacing: -0.04em; line-height: 1.02; text-wrap: balance; max-width: 18ch;
}
.section-intro { margin-top: 1.5rem; color: var(--muted); font-size: 1.125rem; line-height: 1.55; max-width: 52ch; }

/* ── Masthead ───────────────────────────────────────────────────────────────────────────── */
.masthead { padding: 1.75rem 0; }
.masthead-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.wordmark {
  display: inline-flex; align-items: baseline; gap: .5rem;
  font-size: 1.375rem; font-weight: 700; letter-spacing: -0.045em; text-decoration: none;
}
.wordmark-dot { width: .5rem; height: .5rem; border-radius: 50%; background: var(--accent); }
/* The theme toggle. A 36px target with a mark that is a filled disc on light and a crescent on
   dark — one element and a box-shadow, because an icon swap needs either two SVGs or a script that
   writes markup, and this needs neither. currentColor throughout, so it follows --muted. */
.theme-toggle {
  display: inline-grid; place-items: center;
  width: 2.25rem; height: 2.25rem; margin-left: .75rem; padding: 0;
  border: 1px solid var(--line-strong); border-radius: 999px;
  background: transparent; color: var(--muted); cursor: pointer;
}
.theme-toggle:hover { color: var(--text); border-color: var(--text); }
/* --text and not --accent: the accent is spent on the primary action and nothing else, and a
   focus ring wants the highest contrast available rather than the brand colour anyway. */
.theme-toggle:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
.theme-toggle-mark { width: .875rem; height: .875rem; border-radius: 999px; background: currentColor; }
/* Pressed means the page is dark, so the mark becomes a crescent: a ring with an offset shadow
   biting a piece out of it. */
.theme-toggle[aria-pressed="true"] .theme-toggle-mark {
  background: transparent;
  box-shadow: inset -.3125rem -.125rem 0 0 currentColor;
}

.masthead-links { display: flex; gap: 1.75rem; font-size: .9375rem; font-weight: 500; color: var(--muted); }
.masthead-links a { text-decoration: none; }
.masthead-links a:hover { color: var(--text); }
/* The door into the product, in the top bar (#426). Outlined rather than filled: the accent marks
   exactly one thing per screen and that is the hero's own button, so this reads as available
   without competing with it. It sits in the nav because it IS navigation, and the nav's label says
   so. */
.masthead-app {
  color: var(--text); border: 1px solid var(--line-strong); border-radius: 999px;
  padding: .3rem .8rem;
}
/* NOT the accent on hover, which the primary action owns alone. A styles test in landing.test.ts
   enforces that and was right to: a top-bar link lighting up in the hero's colour is a second
   primary. (No backticks in this file - it is one template literal.) */
.masthead-app:hover { color: var(--text); border-color: var(--line-strong); }

/* ── Hero ───────────────────────────────────────────────────────────────────────────────── */
/* The first screen is the question, the answer and one thing to do. The audience line moved down
   to open WHO IT'S FOR, and the eyebrow went (content.ts says why), so what is left above the fold
   is a headline, two sentences, the form, and the phone answering. */
.hero {
  position: relative;
  padding: clamp(2rem, 5vw, 3.5rem) 0 clamp(4.5rem, 9vw, 7.5rem);
  /* Warmth behind the device, on both themes, in Spud's skin tone. Centres sit far enough in that
     both ellipses fade before the section's edges — parked at the boundary they read as a painted
     rectangle. Never the accent: this is a literal, like the pill tints. */
  background:
    radial-gradient(56rem 30rem at 76% 34%, rgb(var(--warm) / .30), transparent 62%),
    radial-gradient(40rem 22rem at 66% 82%, rgb(151 178 201 / .12), transparent 70%);
}
.hero-grid { display: grid; gap: clamp(3.5rem, 7vw, 5rem); align-items: center; }
@media (min-width: 62rem) {
  /* CENTRED, and it was top-aligned for a good reason that stopped being true. The photo column
     used to be 1,518px tall against 490px of copy, because the plate was rendering at its own
     intrinsic height, and centring a 490 against a 1,518 put the headline half a screen down with
     the form below the fold — so the columns were pinned to the top and the copy grew a hole under
     it instead. With the plate sized by its aspect ratio the column is 788, the imbalance is 298,
     and half of that above the headline is a margin rather than a drop: the form still lands at
     787px, inside a 900px fold. */
  .hero-grid { grid-template-columns: minmax(0, 1.05fr) minmax(0, .95fr); align-items: center; }
}

.hero-title {
  font-size: clamp(3rem, 7.4vw, 5.25rem); font-weight: 700;
  letter-spacing: -0.05em; line-height: .94; text-wrap: balance; max-width: 12ch;
}
.hero-sub {
  margin-top: 1.75rem; font-size: clamp(1.125rem, 1.7vw, 1.3125rem); line-height: 1.5;
  color: var(--muted); max-width: 40ch;
}
/* The three refusals in one line, one step down from the sub — the promise, after the problem. */
.hero-line { margin-top: 1rem; font-size: 1rem; line-height: 1.5; color: var(--dim); max-width: 40ch; }

/* The line that says which surface the button actually opens. Care-blue rule, because this is the
   same class of statement as the floor — we stopped you to tell you something true. */
.hero-surface {
  margin-top: 1.5rem; padding-left: .875rem; border-left: 2px solid var(--care);
  color: var(--muted); font-size: .9375rem; line-height: 1.5; max-width: 42ch;
}

.cta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 1.25rem; margin-top: 2.5rem; }
.cta {
  display: inline-flex; align-items: center; justify-content: center; gap: .625rem;
  background: var(--accent); color: var(--accent-ink);
  font-size: 1.0625rem; font-weight: 600; letter-spacing: -0.01em; text-decoration: none;
  padding: 1rem 1.75rem; border-radius: 999px;
  box-shadow: 0 12px 32px -16px rgb(19 20 23 / .45);
  transition: transform .18s ease, box-shadow .18s ease;
}
.cta:hover { transform: translateY(-2px); box-shadow: 0 16px 36px -14px var(--accent); }
.cta:active { transform: translateY(0); }
.cta-alt-inline { color: var(--accent); text-underline-offset: .2em; }
.cta-alt { color: var(--muted); font-size: .9375rem; font-weight: 500; text-decoration: none; border-bottom: 1px solid var(--line-strong); padding-bottom: 2px; }
.cta-alt:hover { color: var(--text); border-bottom-color: var(--care); }
.cta-note { margin-top: 1.125rem; font-size: .875rem; line-height: 1.5; color: var(--dim); max-width: 40ch; }

/* ── The instrument ─────────────────────────────────────────────────────────────────────── */
/* A photograph of a plate somebody else cooked, with the app's own cards over it: the target it
   computed for you at the top, your question beside it, and the meal judged on three dimensions
   overlapping the bottom edge. The cards are drawn rather than screenshotted so they cannot drift
   from the palette the app ships; the plate is a real photo, content.ts photos. */
.device { position: relative; margin: 0 auto; width: 100%; max-width: 26rem; }
/* HEIGHT: AUTO IS LOAD-BEARING, and its absence is why this photograph was 1,250px tall in a
   416px-wide frame — a narrow vertical slice of a platter, and a hero 1,694px deep that pushed the
   next section a screen and a half down while the column beside it ended after the form. The
   width and height attributes on the img are presentational hints that set the CSS width AND
   height, so the height attribute won: with both dimensions definite, aspect-ratio is ignored and
   object-fit cropped to whatever box was left. The screenshots got this right (.shot-img) because
   they say height: auto; this said it nowhere. */
.plate {
  display: block; width: 100%; height: auto; aspect-ratio: 4 / 5; object-fit: cover; border-radius: 2rem;
  box-shadow:
    0 2px 4px -2px rgb(19 20 23 / .06),
    0 32px 64px -32px rgb(19 20 23 / .32),
    0 96px 160px -80px rgb(19 20 23 / .40);
}
.device-inner { display: grid; gap: .875rem; padding: 0 1rem; }
.device .deal-1 {
  position: absolute; top: 1rem; left: 1rem; width: min(62%, 15rem); padding: .875rem 1rem;
  background: color-mix(in srgb, var(--raised) 92%, transparent); backdrop-filter: blur(12px);
}
.device .deal-1 .tcard-unit { white-space: nowrap; }
.device .deal-2 { position: absolute; top: 1rem; right: 1rem; }
.device .deal-3 { position: relative; margin-top: -5.5rem; }

.card {
  background: var(--raised); border: 1px solid var(--line); border-radius: 1.375rem; padding: 1.25rem;
  box-shadow: 0 1px 2px rgb(19 20 23 / .04);
}

.tcard-label { font-size: .8125rem; font-weight: 500; color: var(--dim); }
.tcard-figure { display: flex; align-items: baseline; gap: .5rem; margin-top: .25rem; }
.tcard-kcal { font-size: 2.875rem; font-weight: 700; line-height: 1; }
.tcard-unit { font-size: .875rem; color: var(--muted); }
.tcard-basis { margin-top: .875rem; font-size: .8125rem; line-height: 1.5; color: var(--dim); }

/* The floor, as a mark on a scale rather than a sentence. Blue is only ever this. */
.scale { position: relative; height: 4rem; margin-top: 1.125rem; }
.scale-line { position: absolute; left: 0; right: 0; top: 2rem; height: 2px; border-radius: 1px; background: var(--line-strong); }
.scale-tick { position: absolute; top: 1.375rem; width: 2px; height: 1.25rem; border-radius: 1px; transform: translateX(-1px); }
.scale-tick-floor { background: var(--care); }
.scale-tick-target { background: var(--text); top: 1.125rem; height: 1.5rem; }
.scale-label {
  position: absolute; white-space: nowrap; font-size: .75rem; font-weight: 500;
  transform: translateX(-50%);
}
.scale-label-floor { top: 2.875rem; color: var(--care); }
.scale-label-target { top: 0; color: var(--muted); }

.mcard-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.mcard-title { font-size: 1rem; font-weight: 600; letter-spacing: -0.015em; }
.mcard-kcal { font-size: 1.625rem; font-weight: 700; flex: none; }
.mcard-kcal-unit { font-size: .8125rem; color: var(--dim); margin-left: .25rem; font-family: var(--sans); font-weight: 500; letter-spacing: 0; }

.macros { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin-top: 1rem; padding-top: .875rem; border-top: 1px solid var(--line); }
.macro-value { font-size: 1rem; font-weight: 600; }
.macro-label { display: block; font-size: .75rem; color: var(--dim); margin-top: .125rem; }

.pills { display: flex; flex-wrap: wrap; gap: .375rem; margin-top: 1rem; }
.pill {
  display: inline-flex; align-items: center; gap: .375rem;
  font-size: .75rem; font-weight: 500; padding: .3125rem .625rem; border-radius: 999px;
  border: 1px solid transparent;
}
.pill-dot { width: .375rem; height: .375rem; border-radius: 50%; background: currentColor; flex: none; }
.pill-good { color: var(--good); background: rgb(74 222 128 / .10); border-color: rgb(74 222 128 / .30); }
.pill-warn { color: var(--warn); background: rgb(251 191 36 / .10); border-color: rgb(251 191 36 / .30); }
.pill-bad  { color: var(--bad);  background: rgb(248 113 113 / .10); border-color: rgb(248 113 113 / .30); }

/* THE READER'S OWN LINE, above the meal card: right-aligned, the way the app draws what you sent,
   so the phone plays the problem (a plate, a question) and then the answer. Text colour on page
   ground, INVERTED — the app fills this bubble with the accent, and the page spends the accent on
   the one action only, so the inversion is what says "the other party" here. */
.you-says { display: flex; justify-content: flex-end; }
.you-line {
  max-width: 72%; font-size: .8125rem; line-height: 1.45; font-weight: 500;
  color: var(--ink); background: var(--text);
  padding: .5625rem .875rem; border-radius: 1.125rem 1.125rem .25rem 1.125rem;
}

/* THE ANSWER. The page promises a verdict and the card used to end on a legend of coloured chips,
   which is the taxonomy of one. Set at body weight in full text colour, above the small print,
   because it is the single sentence the whole page is arguing it can produce. */
.mcard-verdict {
  margin-top: .875rem; padding-top: .875rem; border-top: 1px solid var(--line);
  font-size: .9375rem; font-weight: 600; line-height: 1.45; letter-spacing: -0.01em;
}
/* Spud INSIDE the drawn phone, at the app's own 28-point avatar size, saying the correction note
   that used to be a grey paragraph on the card. The one place the page shows who does the talking
   in the product itself; everywhere else he sits beside sections. */
.device-inner .spud-says {
  margin-top: 0; gap: .5rem; max-width: none;
  animation: deal .42s cubic-bezier(.2, .7, .3, 1) backwards;
}
.device-inner .spud { width: 2.5rem; height: 2.5rem; }
.device-inner .spud-line {
  font-size: .8125rem; line-height: 1.5; color: var(--muted);
  padding: .5625rem .8125rem; background: var(--raised);
}

/* ── The one arrival ────────────────────────────────────────────────────────────────────── */
/* One orchestrated moment on load and nothing else on the page moves: the question and its answer
   rise, then the phone resolves in the order the app itself does — the target you were given, the
   meal, the judgement on it, and his note. Sections do not fade in as you scroll; cards do not
   lift on hover. Motion here answers the page loading, once. */
.hero-title, .hero-sub, .hero-line { animation: rise .7s cubic-bezier(.2, .7, .2, 1) backwards; }
.hero-sub { animation-delay: 90ms; }
.hero-line { animation-delay: 160ms; }
@keyframes rise { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
.deal { animation: deal .5s cubic-bezier(.2, .7, .3, 1) backwards; }
@keyframes deal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.pill { animation: resolve .34s cubic-bezier(.2, .7, .3, 1) backwards; }
@keyframes resolve { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: none; } }
.mcard-verdict { animation: deal .42s cubic-bezier(.2, .7, .3, 1) backwards; }

/* ── The problem, and privacy ───────────────────────────────────────────────────────────── */
/* Three short arguments, three columns on a wide screen — two left an orphan under the first. */
.facts { display: grid; gap: 2.25rem; }
@media (min-width: 48rem) { .facts { grid-template-columns: repeat(2, 1fr); gap: 2.75rem 3rem; } }
@media (min-width: 64rem) { .facts { grid-template-columns: repeat(3, 1fr); gap: 2.75rem 2.5rem; } }
/* The three drawings above THE PROBLEM — see illustrations.ts. Every colour is a token, so they
   recolour with the theme; the "over" bar is the bad tint the hero pills use, and nothing in them
   is the accent. */
.ill { width: 100%; max-width: 15rem; height: auto; margin-bottom: 1.25rem; }
.ill-line { fill: none; stroke: var(--line-strong); stroke-width: 2; }
.ill-thin { stroke-width: 1.5; }
.ill-dash { stroke-dasharray: 4 4; }
.ill-fill { fill: var(--raised); }
.ill-food { fill: rgb(var(--warm) / .55); stroke: rgb(var(--warm)); stroke-width: 1.5; }
.ill-text { fill: var(--text); font-family: var(--display); }
.ill-muted { fill: var(--dim); font-family: var(--display); }
.ill-label { font-size: 13px; font-weight: 500; }
.ill-num { font-size: 30px; font-weight: 700; letter-spacing: -1px; }
.ill-bar { fill: var(--line-strong); }
.ill-over { fill: rgb(248 113 113 / .35); stroke: var(--bad); stroke-width: 1.5; }
.ill-target { stroke: var(--text); stroke-width: 1.5; }
.fact-title { font-size: 1.25rem; font-weight: 600; letter-spacing: -0.025em; line-height: 1.25; }
.fact-body { margin-top: .625rem; color: var(--muted); font-size: 1rem; max-width: 46ch; }

/* ── Refusals ───────────────────────────────────────────────────────────────────────────── */
/* Three rows under a rule, title left and the promise right, the way a contract sets its clauses.
   They were three cards in a bordered grid; a promise reads better as a line item than as a tile. */
.refusals { display: grid; border-top: 1px solid var(--line-strong); }
.refusal { display: grid; gap: .75rem 3.5rem; padding: clamp(1.75rem, 3.5vw, 2.5rem) 0; border-bottom: 1px solid var(--line); }
@media (min-width: 56rem) {
  .refusal { grid-template-columns: minmax(0, 20rem) minmax(0, 1fr); align-items: start; }
  .refusal-title { grid-column: 1; grid-row: 1 / span 2; }
}
.refusal-title { font-size: clamp(1.375rem, 2.2vw, 1.625rem); font-weight: 600; letter-spacing: -0.03em; line-height: 1.2; max-width: 16ch; }
.refusal-body { color: var(--muted); font-size: 1rem; max-width: 58ch; }
.refusal-proof {
  margin-top: .375rem; padding-left: 1rem; border-left: 2px solid var(--line-strong);
  font-size: .875rem; line-height: 1.5; color: var(--dim); max-width: 52ch;
}

/* ── Steps ──────────────────────────────────────────────────────────────────────────────── */
/* Numbered because this genuinely is a sequence — you cannot get the verdict before the photo. */
.steps { display: grid; border-top: 1px solid var(--line-strong); }
.step { display: grid; gap: .625rem; padding: clamp(1.75rem, 3.5vw, 2.5rem) 0; border-bottom: 1px solid var(--line); }
@media (min-width: 56rem) { .step { grid-template-columns: 4rem 16rem 1fr; gap: 2rem; align-items: baseline; } }
.step-ordinal { font-size: 1rem; font-weight: 500; color: var(--dim); font-variant-numeric: tabular-nums; }
.step-title { font-size: 1.375rem; font-weight: 600; letter-spacing: -0.03em; line-height: 1.2; }
.step-body { color: var(--muted); font-size: 1rem; max-width: 58ch; }

/* ── The one emphasised span per block ──────────────────────────────────────────────────── */
/* Body copy is --muted; the load-bearing sentence steps up to --text as well as to 600. Weight
   alone is nearly invisible at 16px in a colour already two steps down, which is how a page ends up
   with emphasis nobody can see. Read the header of content.ts before adding a second one to a
   block: two is none. */
strong { font-weight: 600; color: var(--text); }

/* ── How it works, drawn ────────────────────────────────────────── */
/* Three panels, one per step, in the app's own card language: the plate with the reader's question
   on it, the meal read back, the verdict. One column on a phone, three abreast from 52rem, and
   they stretch to a common height so the row reads as one object rather than three cards that
   happen to be next to each other.
   The plate panel is the only one carrying an image, so it gets the radius and the crop; the other
   two are .card, which the hero already defines, and inherit everything. */
.step-shots {
  display: grid; gap: 1rem; margin: 0 0 clamp(2rem, 4vw, 3rem); align-items: stretch;
}
@media (min-width: 52rem) { .step-shots { grid-template-columns: repeat(3, 1fr); gap: 1.25rem; } }
.step-shot { display: flex; flex-direction: column; justify-content: center; }
.step-shot-plate {
  position: relative; justify-content: flex-end; padding: 1rem;
  border-radius: 1.375rem; overflow: hidden;
}
.step-shot-plate img {
  position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover;
}
/* The question sits on the photograph, so it needs its own ground rather than the page's. */
.step-shot-plate .you-says { position: relative; }
.step-shot .macros { margin-top: .875rem; }
.step-shot .pills { margin-top: 0; }
.step-shot .mcard-verdict { margin-top: .75rem; }
/* A phone shows the plate at a readable height; three abreast, the panel takes the row's. */
@media (max-width: 51.999rem) { .step-shot-plate { min-height: 14rem; } }

/* ── The section photographs ───────────────────────────────────── */
/* One plate under three of the headlines, in the hero's treatment one notch quieter: the same
   radius family, a shallower shadow because these sit in the middle of the page rather than at the
   top of it, and no card over them — the hero's photograph is the instrument, these are the room it
   happens in.
   HEIGHT: AUTO, for the reason the .plate rule carries at length: the img states its own width and
   height so the box is reserved before the bytes land, and those attributes set the CSS height
   unless this says otherwise. The file is already 1400x788, so nothing is cropped here. */
.section-photo { margin: 0 0 clamp(2rem, 4vw, 3rem); }
.section-photo img {
  display: block; width: 100%; height: auto; border-radius: 1.75rem;
  box-shadow:
    0 2px 4px -2px rgb(19 20 23 / .05),
    0 24px 48px -32px rgb(19 20 23 / .28);
}

/* ── The screenshots ────────────────────────────────────────────────────────────────────── */
/* A CAROUSEL, AND CSS IS THE WHOLE OF IT. The frames used to be a grid — two by two above 52rem,
   one column below — which on a phone was four full-height screenshots stacked into a mile of
   page. It is now one horizontal strip with scroll snapping: native on a touchscreen, a scrollbar
   and the arrow keys everywhere else, and no script, which matters because this page loads exactly
   one (the theme toggle) and a test fails if a second ever appears.
   NOT PINNED TO A COUNT, like the grid before it: the track is as long as the array, so a fifth
   frame extends the scroll instead of landing alone on a second row. The slide width is also the
   affordance — 19rem where there is room, 78vw on a phone — so the next frame is always half
   visible at the edge and nobody has to be told the strip moves.
   The CONTAINER scrolls, never the page: overflow-x here is what keeps scrollWidth === clientWidth
   true on the document at 390px, which a test measures. */
.shots {
  display: flex; gap: clamp(1.25rem, 3vw, 2rem);
  overflow-x: auto; overscroll-behavior-x: contain;
  scroll-snap-type: x mandatory;
  /* Room under the frames for the scrollbar, so it never sits on a caption. */
  padding-bottom: 1rem;
  scrollbar-width: thin;
}
/* Keyboard: the strip carries tabindex so the arrow keys can move it, and a focus ring is the only
   thing that tells somebody they have landed on it. */
.shots:focus-visible { outline: 2px solid var(--text); outline-offset: 6px; border-radius: 1rem; }
.shot { margin: 0; flex: 0 0 min(19rem, 78vw); scroll-snap-align: start; }
/* The frame is the same construction as the hero device, one size down, so the screenshots and the
   drawn card read as the same object rather than as a photo pasted next to an illustration. */
.shot-frame {
  border: 1px solid var(--line-strong); border-radius: 2.25rem; padding: .5rem;
  background: linear-gradient(160deg, var(--raised), var(--panel) 60%);
  box-shadow: 0 24px 48px -32px rgb(19 20 23 / .30);
}
/* The shot is a light-theme capture, so on the dark page it needs its own rounded mask rather than
   bleeding into the frame. display:block is the reset's; the radius is one notch inside the
   frame's so the two curves are concentric. */
.shot-img { width: 100%; height: auto; border-radius: 1.75rem; }
.shot-caption { margin-top: 1.5rem; }
.shot-title { font-size: 1.1875rem; font-weight: 600; letter-spacing: -0.025em; line-height: 1.25; }
.shot-body { margin-top: .5rem; color: var(--muted); font-size: .9375rem; }

/* ── What you get ───────────────────────────────────────────────────────────────────────── */
.what { list-style: none; padding: 0; display: grid; gap: 1rem; }
@media (min-width: 40rem) { .what { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 64rem) { .what { grid-template-columns: repeat(3, 1fr); } }
.what-item { padding: 1.5rem; border: 1px solid var(--line); border-radius: 1.375rem; background: var(--raised); }
.what-title { font-size: 1.125rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.25; }
.what-body { margin-top: .5rem; color: var(--muted); font-size: .9375rem; line-height: 1.5; }

/* ── The one raised line ─────────────────────────────────────────────────────────────────── */
/* The other theme's palette, re-declared rather than restyled, so the band is the page's own
   other half and never a third colour. One sentence and no label: the one place the page raises
   its voice. */
.band { ${darkVars} background: var(--ink); color: var(--text); padding: clamp(4rem, 8vw, 6.5rem) 0; }
:root[data-theme="dark"] .band { ${lightVars} }
.section + .band, .band + .section { border-top: 0; }
.band-line {
  font-size: clamp(2.25rem, 5vw, 3.75rem); font-weight: 700; letter-spacing: -0.04em;
  line-height: 1.02; text-wrap: balance; max-width: 16ch;
}

/* ── The repeated ask ───────────────────────────────────────────────────────────────────── */
/* Not a section: an interruption between two of them, on the raised surface so its three
   appearances read as ONE object recurring rather than as different offers. */
.ask { background: var(--panel); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); padding: clamp(2.5rem, 5vw, 3.5rem) 0; }
.ask + .section, .floor-section + .ask, .ask + .closing { border-top: 0; }
.closing + .section { border-top: 1px solid var(--line); }
.ask-row { display: grid; gap: 1.5rem; align-items: center; }
@media (min-width: 58rem) { .ask-row { grid-template-columns: minmax(0, 22rem) minmax(0, 1fr); gap: 3rem; } }
.ask-line { color: var(--text); font-size: 1.1875rem; font-weight: 500; letter-spacing: -0.02em; line-height: 1.35; max-width: 26ch; }
.ask .subscribe { max-width: none; }
.ask .cta-row { margin-top: 0; }
.ask .cta-note { margin-top: .75rem; max-width: 52ch; }

/* ── The floor ──────────────────────────────────────────────────────────────────────────── */
/* The one section that sits on a different surface. Not for variety — this is the only section
   about a guard rather than a feature, and it is the one a reader who is deciding whether to trust
   an app with a daily calorie target has come to find. Everything else is flat by comparison. */
.floor-section { background: var(--panel); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.floor-section .eyebrow { color: var(--care); }
.guards { display: grid; border-top: 1px solid var(--line-strong); }
.guard { display: grid; gap: .5rem; padding: 1.75rem 0; border-bottom: 1px solid var(--line); }
@media (min-width: 56rem) { .guard { grid-template-columns: minmax(0, 20rem) 1fr; gap: 3rem; align-items: baseline; } }
.guard-title { font-size: 1.1875rem; font-weight: 600; letter-spacing: -0.025em; line-height: 1.25; }
.guard-body { color: var(--muted); font-size: 1rem; max-width: 58ch; }
.floor-outro {
  margin-top: 2.5rem; padding-left: 1.25rem; border-left: 2px solid var(--care);
  color: var(--text); font-size: 1.125rem; line-height: 1.5; max-width: 50ch;
}

/* ── Prose blocks ───────────────────────────────────────────────────────────────────────── */
.prose { display: grid; gap: 1.25rem; max-width: 60ch; color: var(--muted); }
.prose p:first-child { color: var(--text); font-size: 1.0625rem; }

/* The measured numbers. Bordered rather than styled up: it is a receipt, not a badge, and the
   category's habit of putting an accuracy claim in a rosette is the thing it is answering. */
.measured {
  margin-top: 2.5rem; padding: 1.375rem 1.625rem; max-width: 60ch;
  border: 1px solid var(--line); border-radius: 1.25rem; background: var(--panel);
}
.measured-label { font-size: .875rem; font-weight: 500; color: var(--dim); }
.measured-body { margin-top: .5rem; color: var(--muted); font-size: .9375rem; }

/* Beside the measured numbers now, not at the foot of the page: self-measured error plus one
   human voice makes a single credible proof block, where apart they were two weak halves. Set as a
   pull quote in the display face, with a rule in Spud's skin tone — the page's warm colour, and
   the closest thing it has to a handwritten margin. */
.founder { max-width: 36rem; margin: 3rem 0 0; }
.founder-line {
  margin: 0; font-size: clamp(1.25rem, 2vw, 1.5rem); font-weight: 500; letter-spacing: -0.025em;
  line-height: 1.35; color: var(--text); text-wrap: balance;
  border-left: 3px solid rgb(var(--warm)); padding-left: 1.25rem; text-align: left;
}
.founder-by { margin-top: .875rem; padding-left: calc(1.25rem + 3px); text-align: left; font-size: .9375rem; color: var(--dim); }

/* ── FAQ ────────────────────────────────────────────────────────────────────────────────── */
.faq { border-top: 1px solid var(--line-strong); }
.faq-item { border-bottom: 1px solid var(--line); }
.faq-q {
  cursor: pointer; list-style: none; padding: 1.5rem 3rem 1.5rem 0; position: relative;
  font-size: 1.1875rem; font-weight: 500; letter-spacing: -0.025em; line-height: 1.3;
}
.faq-q::-webkit-details-marker { display: none; }
.faq-q:hover { color: var(--text); }
.faq-q::after {
  content: "+"; position: absolute; right: .25rem; top: 1.25rem;
  font-size: 1.5rem; font-weight: 300; line-height: 1; color: var(--dim);
}
.faq-item[open] .faq-q::after { content: "\\2212"; color: var(--care); }
.faq-a { padding: 0 3rem 1.75rem 0; color: var(--muted); font-size: 1rem; max-width: 60ch; }

/* ── The subscribe form ─────────────────────────────────────────────────────────────────── */
.subscribe { max-width: 34rem; }
/* In the hero the form REPLACES the CTA row, and it did not inherit the space that row had: the
   label sat hard against the bottom of the care-blue callout above it and read as part of the
   quote. Matches .cta-row's own margin, because it is standing in the same place. */
.hero .subscribe { margin-top: 2.5rem; }
/* The label stays in the markup for assistive technology and comes off the page everywhere: the
   field's placeholder already says what it is. */
.subscribe-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.subscribe-row { display: flex; flex-wrap: wrap; gap: .625rem; }
.subscribe-input {
  flex: 1 1 15rem; min-width: 0;
  background: var(--raised); border: 1px solid var(--line-strong); border-radius: 999px;
  color: var(--text); font: inherit; font-size: 1.0625rem; padding: .9375rem 1.375rem;
  box-shadow: 0 1px 2px rgb(19 20 23 / .04);
  transition: border-color .15s ease, box-shadow .15s ease;
}
.subscribe-input::placeholder { color: var(--dim); }
.subscribe-input:focus { border-color: var(--care); outline: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--care) 18%, transparent); }
.subscribe-button {
  flex: none; cursor: pointer;
  /* Quiet by default: in store mode the accent belongs to the CTA, and a second lime button would
     make the page ask for two things at once and get neither. */
  background: transparent; color: var(--text);
  border: 1px solid var(--line-strong); border-radius: 999px;
  font: inherit; font-family: var(--display); font-size: 1.0625rem; font-weight: 600;
  letter-spacing: -0.01em; padding: .9375rem 1.625rem;
  transition: border-color .15s ease, color .15s ease, transform .18s ease, box-shadow .18s ease;
}
.subscribe-button:hover { border-color: var(--text); }

/* When the form IS the primary action — no store listing, nothing else to tap — its button wears
   the accent, exactly the way the CTA did. Same rule, new owner. */
.subscribe-primary .subscribe-button {
  background: var(--accent); color: var(--accent-ink); border-color: var(--accent);
  box-shadow: 0 12px 32px -16px rgb(19 20 23 / .45);
}
.subscribe-primary .subscribe-button:hover {
  border-color: var(--accent); transform: translateY(-2px);
  box-shadow: 0 16px 36px -14px var(--accent);
}

/* Inline validation, CSS only. :user-invalid holds fire until the field has been interacted with,
   so nobody is scolded for an empty form they have not touched — and the first feedback a typo
   gets is our sentence under the field, not the browser's bubble. The bubble still guards the
   actual submit; it cannot be styled without script, and this page does not carry one. */
.subscribe-error {
  flex: 1 1 100%; display: none;
  font-size: .8125rem; line-height: 1.5; color: var(--bad);
}
.subscribe-input:user-invalid { border-color: var(--bad); }
.subscribe-input:user-invalid ~ .subscribe-error { display: block; }
.subscribe-note { margin-top: 1.25rem; font-size: .8125rem; line-height: 1.55; color: var(--dim); max-width: 52ch; }

/* The honeypot. NOT display:none — some bots skip what a browser would not render. Moved off
   screen, taken out of the tab order in the markup, and hidden from assistive technology by
   aria-hidden on the wrapper. (No backticks anywhere in this file: it is one template literal,
   and one would end it. That has now cost two build failures.) */
.honeypot {
  position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;
}

/* ── Spud ───────────────────────────────────────────────────────────────────────────────── */
/* Every appearance is a job he already does in the app — see the header of mascot.ts. Sized
   down deliberately: he is a voice beside a paragraph, not an illustration the section is built
   around. 4.5rem against the app's 50-point badge: the drawing occupies about 82 of its 120 viewBox
   units vertically, so the potato lands near 49px, the same optical weight beside body copy that
   the badge has beside caption text on a phone. */
.spud { width: 4.5rem; height: 4.5rem; flex: none; }
/* HE SPEAKS FROM A BUBBLE, the way he does on every screen of the app.
   Beside a bare paragraph he read as a sticker somebody had left on the page — a potato, alone, in
   the middle of a section about calorie floors, with no indication that he is the character who
   does the talking in the product. lib/components/bubble.tsx is the shape being copied: avatar
   left, panel right, one corner squared off towards him so the line is visibly his. */
.spud-says {
  display: flex; align-items: flex-end; gap: .75rem;
  margin-top: 2.5rem; max-width: 46ch;
}
.spud-line {
  color: var(--text); font-size: .9375rem; line-height: 1.5;
  background: var(--raised); border: 1px solid var(--line);
  border-radius: 1.25rem 1.25rem 1.25rem .25rem;
  padding: .875rem 1.125rem;
  box-shadow: 0 1px 2px rgb(19 20 23 / .04);
}
/* THE ONE LARGE APPEARANCE. Everywhere else he is a 4.5rem aside; at the floor — the section whose
   subject is him saying no — he is the page's single drawn moment, bled past the left gutter into
   the margin column so the emptiness there finally pays rent. One size override, no new rule:
   an appearance still names its job, and this is the job that was always his. */
.floor-section .spud { width: clamp(7rem, 12vw, 13rem); height: clamp(7rem, 12vw, 13rem); }
.floor-section .spud-says { align-items: center; margin-top: 3rem; max-width: 56ch; gap: 1.25rem; }
@media (min-width: 62rem) { .floor-section .spud-says { margin-left: -4rem; } }
/* On the raised surface of the floor section the bubble takes the page ground — but on light those
   two surfaces are 1.5% apart, so without a stronger border the bubble read as a smudge. */
.floor-section .spud-line { background: var(--ink); border-color: var(--line-strong); }
/* The blink. The app closes his eyes for 130ms every 4.2s on a timer; this is the same cadence as
   one keyframe cycle, and a scaleY squash instead of a path swap because a stylesheet cannot swap
   paths. transform-box makes the squash happen about the eye group's own centre. */
.spud-eyes { transform-box: fill-box; transform-origin: 50% 50%; animation: spud-blink 4.2s infinite; }
@keyframes spud-blink { 0%, 96.4% { transform: none; } 98.2% { transform: scaleY(.06); } 100% { transform: none; } }

.outcome .spud { width: 6rem; height: 6rem; margin-bottom: 1rem; margin-left: -.5rem; }

/* ── Outcome pages ──────────────────────────────────────────────────────────────────────── */
.outcome { padding: clamp(5rem, 14vw, 10rem) 0; }
.outcome-title {
  font-size: clamp(2.125rem, 4.6vw, 3rem); font-weight: 700;
  letter-spacing: -0.04em; line-height: 1.04; max-width: 20ch;
}
.outcome-body { margin-top: 1.25rem; color: var(--muted); font-size: 1.0625rem; max-width: 46ch; }
.outcome-back { margin-top: 2rem; font-size: .9375rem; }
.outcome-back a { color: var(--muted); border-bottom: 1px solid var(--line-strong); text-decoration: none; padding-bottom: 2px; }
.outcome-back a:hover { color: var(--text); border-bottom-color: var(--care); }

/* ── Closing ────────────────────────────────────────────────────────────────────────────── */
/* The warm wash again, as a bookend to the hero's — the page opens and closes on the same light. */
.closing {
  position: relative; overflow: hidden; text-align: center; padding: clamp(6rem, 14vw, 11rem) 0;
  ${darkVars} color: var(--text);
}
.closing-plate { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.closing::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(180deg, rgb(12 12 12 / .46), rgb(12 12 12 / .72));
}
.closing .wrap { position: relative; z-index: 1; }
.closing-title { margin: 0 auto; font-size: clamp(2.375rem, 5.6vw, 3.875rem); font-weight: 700; letter-spacing: -0.045em; line-height: 1; text-wrap: balance; max-width: 16ch; }
.closing-sub { margin: 1.5rem auto 0; color: var(--text); opacity: .86; font-size: 1.125rem; line-height: 1.55; max-width: 42ch; }
.closing .cta-row { justify-content: center; margin-top: 2.5rem; }
.closing .cta-note { margin-left: auto; margin-right: auto; text-align: center; }

/* ── Footer ─────────────────────────────────────────────────────────────────────────────── */
.footer { border-top: 1px solid var(--line); padding: 2.5rem 0 4rem; color: var(--dim); font-size: .8125rem; line-height: 1.55; }
.footer-row { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem 2rem; }
.footer-links { display: flex; flex-wrap: wrap; gap: 1.5rem; }
.footer-links a { text-decoration: none; }
.footer-links a:hover { color: var(--muted); }
.footer-note { max-width: 52ch; }

/* Last in the sheet on purpose: every selector here ties on specificity with the rule it switches
   off, so source order is what makes it win. Placed above .spud-eyes it did not, and he blinked. */
@media (prefers-reduced-motion: reduce) {
  .hero-title, .hero-sub, .hero-line, .deal, .pill, .mcard-verdict, .device-inner .spud-says, .spud-eyes { animation: none; }
  .cta, .subscribe-button { transition: none; }
  .cta:hover, .subscribe-primary .subscribe-button:hover { transform: none; }
}
`;

export const styles = `${sheet}\n${derivedRules()}\n`;
