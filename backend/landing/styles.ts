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

import { color, dark, light } from "./tokens.ts";
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
    // The two cards, then the verdict pills, in the order the app itself resolves them.
    stagger(".deal", 2, (i) => i * 110),
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
 * Every variable the dark theme redefines, as one string reused by both dark selectors.
 *
 * Written out rather than derived from the object so a value that has no dark counterpart is a
 * COMPILE error here and not a light colour surviving onto a dark page. `--dim` is raised the same
 * way it is on light, for the same reason and to the same ratio.
 */
const darkVars = `
  --ink: ${dark.bg};
  --panel: ${dark.surface};
  --raised: ${dark.surfaceRaised};
  --line: ${dark.border};
  --line-strong: ${dark.borderStrong};
  --text: ${dark.text};
  --muted: ${dark.textMuted};
  --faint: ${dark.textFaint};
  --dim: #7C838B;
  --accent: ${dark.accent};
  --accent-ink: ${dark.accentText};
  --good: ${dark.good};
  --warn: ${dark.warn};
  --bad: ${dark.bad};
  --care: ${dark.care};
  color-scheme: dark;
`;

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

   --dim is the one value that is not a straight copy of a token; see its comment below. It is
   declared in all three places for the same reason every other variable is. */
:root {
  --ink: ${light.bg};
  --panel: ${light.surface};
  --raised: ${light.surfaceRaised};
  --line: ${light.border};
  --line-strong: ${light.borderStrong};

  --text: ${light.text};
  --muted: ${light.textMuted};
  --faint: ${light.textFaint};

  /* The app's third text colour, RAISED for this page — and the one place a token deliberately
     differs from theme.ts rather than tracking it.

     --faint was 4.2:1 on the page background when this page was written, under WCAG AA's 4.5:1
     for text below 24px, and this variable was the fix. The app has since raised its own value —
     Apple's audit failed it on every input placeholder — so --faint now clears AA on its own and
     this is no longer a correction.

     It stays, as MARGIN rather than as a fix. The app spends its faintest colour on a caption
     glanced at for a second inside a screen the user chose to open; this page spends it on the
     small print under the button, the receipt line on every refusal, and the whole footer — read
     once, by a stranger, deciding whether to trust a health app. That deserves more than the
     minimum. It is also what keeps three levels of hierarchy from collapsing into two, now that
     --faint and --muted are closer together than they were.

     A test asserts that --faint is not used for anything on this page, so the app's value cannot
     creep back in by being the obvious token to reach for. */
  --dim: #666C75;

  /* One accent, spent on exactly one thing per screen: the primary action. Same rule as the app. */
  --accent: ${light.accent};
  --accent-ink: ${light.accentText};

  --good: ${light.good};
  --warn: ${light.warn};
  --bad: ${light.bad};
  /* Reserved for the floor and nothing else, so a blue tick anywhere means "we stopped you". */
  --care: ${light.care};

  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, Helvetica, Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  --wrap: 68rem;
  --gutter: clamp(1.25rem, 5vw, 3rem);
  color-scheme: light;
}

:root[data-theme="dark"] { ${darkVars} }

/* ── The one typeface this page owns ────────────────────────────────────────────────────── */
/* Space Grotesk, variable, latin subset, 22KB, SELF-HOSTED — the design review's verdict was that
   the identity was entirely rented from Apple, and type is the one thing a competitor cannot copy
   out of this CSS. Same-origin under font-src self, so the page still loads nothing from anyone
   else; the OFL licence text travels beside the file, as that licence requires. Headlines and the
   wordmark only — body copy stays on the system stack, which is what keeps this 22KB, not a family. */
@font-face {
  font-family: "Space Grotesk";
  src: url("/assets/fonts/space-grotesk-latin.woff2") format("woff2");
  font-weight: 300 700;
  font-display: swap;
}
.hero-title, .section-title, .closing-title, .outcome-title, .wordmark {
  font-family: "Space Grotesk", var(--sans);
}

/* ── Reset ──────────────────────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--ink);
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
::selection { background: rgb(232 190 131 / .35); }

/* Every number on this page is monospaced and tabular. The product's claim is that it hands you a
   figure you can act on; a figure that reflows as it changes does not read like one. */
.num { font-family: var(--mono); font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }

.wrap { width: 100%; max-width: var(--wrap); margin: 0 auto; padding: 0 var(--gutter); }

/* ── Section marker ─────────────────────────────────────────────────────────────────────── */
.eyebrow {
  display: flex; align-items: center; gap: .75rem;
  font-family: var(--mono); font-size: .6875rem; text-transform: uppercase;
  letter-spacing: .16em; color: var(--dim); margin-bottom: 1.5rem;
}
.eyebrow::before { content: ""; width: 1.75rem; height: 1px; background: var(--line-strong); flex: none; }

.section { padding: clamp(4rem, 9vw, 7rem) 0; border-top: 1px solid var(--line); }
/* THE RUNNING MARGIN. Every section used to be the same left rail on an empty field — eyebrow,
   title, intro, grid, all on one axis, with the right third of the page blank from ACCURACY down.
   On a wide screen the eyebrow now lives in a margin column and rides with the section as it
   scrolls, the way a printed spread carries a marginal label; everything else takes the wide
   column. Below 62rem nothing changes. */
@media (min-width: 62rem) {
  .section > .wrap { display: grid; grid-template-columns: 11rem minmax(0, 1fr); column-gap: 4.5rem; }
  .section .eyebrow { grid-column: 1; margin: 0; position: sticky; top: 1.75rem; align-self: start; }
  .section > .wrap > :not(.eyebrow) { grid-column: 2; }
}
.section-head { max-width: 46ch; margin-bottom: clamp(2.5rem, 5vw, 3.5rem); }
.section-title {
  font-size: clamp(1.75rem, 3.6vw, 2.6rem); font-weight: 700;
  letter-spacing: -0.035em; line-height: 1.08; text-wrap: balance;
}
.section-intro { margin-top: 1.25rem; color: var(--muted); max-width: 56ch; }

/* ── Masthead ───────────────────────────────────────────────────────────────────────────── */
.masthead { padding: 1.5rem 0; }
.masthead-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
.wordmark {
  display: inline-flex; align-items: baseline; gap: .5rem;
  font-size: 1.125rem; font-weight: 700; letter-spacing: -0.04em; text-decoration: none;
}
.wordmark-dot { width: .4375rem; height: .4375rem; border-radius: 50%; background: var(--accent); }
/* The theme toggle. A 32px target with a mark that is a filled disc on light and a crescent on
   dark — one element and a box-shadow, because an icon swap needs either two SVGs or a script that
   writes markup, and this needs neither. currentColor throughout, so it follows --muted. */
.theme-toggle {
  display: inline-grid; place-items: center;
  width: 2.25rem; height: 2.25rem; margin-left: .75rem; padding: 0;
  border: 1px solid var(--line); border-radius: 999px;
  background: transparent; color: var(--muted); cursor: pointer;
}
.theme-toggle:hover { color: var(--text); border-color: var(--line-strong); }
/* --text and not --accent: the accent is spent on the primary action and nothing else, and a
   focus ring wants the highest contrast available rather than the brand colour anyway. */
.theme-toggle:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
.theme-toggle-mark {
  width: .875rem; height: .875rem; border-radius: 999px;
  background: currentColor;
}
/* Pressed means the page is dark, so the mark becomes a crescent: a ring with an offset shadow
   biting a piece out of it. */
.theme-toggle[aria-pressed="true"] .theme-toggle-mark {
  background: transparent;
  box-shadow: inset -.3125rem -.125rem 0 0 currentColor;
}

.masthead-links { display: flex; gap: 1.5rem; font-size: .875rem; color: var(--muted); }
.masthead-links a { text-decoration: none; }
.masthead-links a:hover { color: var(--text); }

/* ── Hero ───────────────────────────────────────────────────────────────────────────────── */
.hero {
  padding: clamp(2.5rem, 6vw, 4.5rem) 0 clamp(4rem, 8vw, 6rem);
  /* A barely-there wash of the mascot's skin tone behind the device, on both themes. Warmth is
     what a grey page with one lime button cannot fake; the accent test is untouched because this
     is a literal, like the pill tints, and never the accent variable. */
  /* Centres sit far enough in that both ellipses fade before the section's edges — parked near
     the top they clipped against the masthead boundary and the wash read as a painted rectangle. */
  background:
    radial-gradient(52rem 22rem at 76% 38%, rgb(232 190 131 / .22), transparent 62%),
    radial-gradient(40rem 20rem at 68% 72%, rgb(151 178 201 / .10), transparent 70%);
}
.hero-grid { display: grid; gap: clamp(3rem, 6vw, 4.5rem); align-items: start; }
@media (min-width: 62rem) { .hero-grid { grid-template-columns: 1.02fr .98fr; } }

.hero-title {
  font-size: clamp(2.75rem, 7.4vw, 4.75rem); font-weight: 700;
  letter-spacing: -0.05em; line-height: .96; text-wrap: balance;
}
.hero-sub { margin-top: 1.75rem; font-size: clamp(1.0625rem, 1.6vw, 1.1875rem); color: var(--muted); max-width: 44ch; }

/* The line that says which surface the button actually opens. Care-blue rule, because this is the
   same class of statement as the floor — we stopped you to tell you something true. */
.hero-surface {
  margin-top: 1.5rem; padding-left: 1rem; border-left: 2px solid var(--care);
  color: var(--muted); font-size: .9375rem; max-width: 46ch;
}

.cta-row { display: flex; flex-wrap: wrap; align-items: center; gap: 1.25rem; margin-top: 2.5rem; }
.cta {
  display: inline-flex; align-items: center; gap: .625rem;
  background: var(--accent); color: var(--accent-ink);
  font-size: 1rem; font-weight: 600; letter-spacing: -0.01em; text-decoration: none;
  padding: .9375rem 1.5rem; border-radius: 999px;
  transition: transform .15s ease, box-shadow .15s ease;
}
.cta:hover { transform: translateY(-1px); box-shadow: 0 8px 28px -12px var(--accent); }
.cta:active { transform: translateY(0); }
.cta-alt-inline {
    color: var(--accent);
    text-underline-offset: .2em;
  }
  .cta-alt { color: var(--muted); font-size: .9375rem; text-decoration: none; border-bottom: 1px solid var(--line-strong); padding-bottom: 2px; }
.cta-alt:hover { color: var(--text); border-bottom-color: var(--care); }
.cta-note { margin-top: 1.25rem; font-size: .875rem; color: var(--dim); max-width: 40ch; }

/* ── The instrument ─────────────────────────────────────────────────────────────────────── */
/* A phone-shaped panel drawing the two things the app actually renders: the target it computed
   for you with the floor marked underneath it, and one meal judged on three dimensions. It is
   drawn rather than screenshotted so it cannot drift from the palette the app ships. */
.device {
  margin: 0 auto; width: 100%; max-width: 22.5rem;
  border: 1px solid var(--line-strong); border-radius: 2.25rem;
  padding: .6875rem; background: linear-gradient(160deg, var(--raised), var(--panel) 55%);
  /* On light the bezel was a white blob on an off-white field — surfaces 1.5% apart with a 1px
     border doing all the work. A real shadow stack makes the object sit IN the page; low-alpha
     literals, like the pill tints, never the accent. Dark never needed it and barely shows it. */
  box-shadow:
    0 2px 4px -2px rgb(19 20 23 / .06),
    0 28px 56px -28px rgb(19 20 23 / .30),
    0 72px 120px -72px rgb(19 20 23 / .38);
}
.device-inner {
  background: var(--ink); border-radius: 1.75rem; padding: 1.375rem 1.125rem 1.5rem;
  display: grid; gap: 1rem;
}
.device-bar { width: 5.25rem; height: .25rem; border-radius: 999px; background: var(--line-strong); margin: 0 auto .5rem; }

.card { background: var(--panel); border: 1px solid var(--line); border-radius: 1.125rem; padding: 1.125rem; }

.tcard-label { font-family: var(--mono); font-size: .625rem; text-transform: uppercase; letter-spacing: .14em; color: var(--dim); }
.tcard-figure { display: flex; align-items: baseline; gap: .5rem; margin-top: .375rem; }
.tcard-kcal { font-size: 2.375rem; font-weight: 700; line-height: 1; }
.tcard-unit { font-size: .8125rem; color: var(--muted); }
.tcard-basis { margin-top: .875rem; font-size: .75rem; line-height: 1.5; color: var(--dim); }

/* The floor, as a mark on a scale rather than a sentence. Blue is only ever this. */
.scale { position: relative; height: 4rem; margin-top: 1.25rem; }
.scale-line { position: absolute; left: 0; right: 0; top: 2rem; height: 1px; background: var(--line-strong); }
.scale-tick { position: absolute; top: 1.375rem; width: 1px; height: 1.25rem; transform: translateX(-0.5px); }
.scale-tick-floor { background: var(--care); }
.scale-tick-target { background: var(--text); top: 1.125rem; height: 1.5rem; }
.scale-label {
  position: absolute; white-space: nowrap; font-family: var(--mono);
  font-size: .625rem; letter-spacing: .06em; transform: translateX(-50%);
}
.scale-label-floor { top: 2.875rem; color: var(--care); }
.scale-label-target { top: 0; color: var(--muted); }

.mcard-head { display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; }
.mcard-title { font-size: .9375rem; font-weight: 600; letter-spacing: -0.01em; }
.mcard-kcal { font-size: 1.5rem; font-weight: 700; flex: none; }
.mcard-kcal-unit { font-size: .75rem; color: var(--dim); margin-left: .25rem; font-family: var(--sans); letter-spacing: 0; }

.macros { display: grid; grid-template-columns: repeat(3, 1fr); gap: .5rem; margin-top: 1rem; padding-top: .875rem; border-top: 1px solid var(--line); }
.macro-value { font-size: .9375rem; font-weight: 600; }
.macro-label { display: block; font-size: .6875rem; color: var(--dim); margin-top: .125rem; }

.pills { display: flex; flex-wrap: wrap; gap: .375rem; margin-top: 1rem; }
.pill {
  display: inline-flex; align-items: center; gap: .375rem;
  font-size: .6875rem; font-weight: 500; padding: .3125rem .5625rem; border-radius: 999px;
  border: 1px solid transparent;
}
.pill-dot { width: .375rem; height: .375rem; border-radius: 50%; background: currentColor; flex: none; }
.pill-good { color: var(--good); background: rgb(74 222 128 / .10); border-color: rgb(74 222 128 / .30); }
.pill-warn { color: var(--warn); background: rgb(251 191 36 / .10); border-color: rgb(251 191 36 / .30); }
.pill-bad  { color: var(--bad);  background: rgb(248 113 113 / .10); border-color: rgb(248 113 113 / .30); }

/* THE ANSWER. The eyebrow promises a verdict and the card used to end on a legend of coloured
   chips, which is the taxonomy of one. Set at body weight in full text colour, above the small
   print, because it is the single sentence the whole page is arguing it can produce. */
.mcard-verdict {
  margin-top: .875rem; padding-top: .875rem; border-top: 1px solid var(--line);
  font-size: .875rem; font-weight: 600; line-height: 1.45; letter-spacing: -0.01em;
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
  font-size: .75rem; line-height: 1.5; color: var(--muted);
  padding: .5rem .75rem; background: var(--panel);
}

/* One orchestrated arrival, in the order the app itself resolves: the target you were given, then
   the meal, then the judgement on it. Nothing else on the page moves. */
.deal { animation: deal .5s cubic-bezier(.2, .7, .3, 1) backwards; }
@keyframes deal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.pill { animation: resolve .34s cubic-bezier(.2, .7, .3, 1) backwards; }
@keyframes resolve { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: none; } }
.mcard-verdict { animation: deal .42s cubic-bezier(.2, .7, .3, 1) backwards; }

@media (prefers-reduced-motion: reduce) {
  .deal, .pill, .mcard-verdict, .device-inner .spud-says, .spud-eyes { animation: none; }
  .cta { transition: none; }
}

/* ── Refusals ───────────────────────────────────────────────────────────────────────────── */
.refusals { display: grid; gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 1.25rem; overflow: hidden; }
@media (min-width: 56rem) { .refusals { grid-template-columns: repeat(3, 1fr); } }
.refusal { background: var(--ink); padding: clamp(1.5rem, 3vw, 2.25rem); display: flex; flex-direction: column; gap: .875rem; }
.refusal-title { font-size: 1.125rem; font-weight: 600; letter-spacing: -0.02em; line-height: 1.25; }
.refusal-body { color: var(--muted); font-size: .9375rem; }
.refusal-proof {
  margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--line);
  font-size: .75rem; line-height: 1.5; color: var(--dim);
}

/* ── Steps ──────────────────────────────────────────────────────────────────────────────── */
/* Numbered because this genuinely is a sequence — you cannot get the verdict before the photo. */
.steps { display: grid; gap: 1px; background: var(--line); }
.step { background: var(--ink); display: grid; gap: .625rem; padding: clamp(1.75rem, 3vw, 2.25rem) 0; }
@media (min-width: 56rem) { .step { grid-template-columns: 4rem 18rem 1fr; gap: 2rem; align-items: baseline; } }
.step-ordinal { font-family: var(--mono); font-size: .8125rem; color: var(--dim); letter-spacing: .06em; }
.step-title { font-size: 1.1875rem; font-weight: 600; letter-spacing: -0.02em; }
.step-body { color: var(--muted); font-size: .9375rem; max-width: 60ch; }

/* ── The one emphasised span per block ──────────────────────────────────────────────────── */
/* Body copy is --muted; the load-bearing sentence steps up to --text as well as to 600. Weight
   alone is nearly invisible at 15px in a colour already two steps down, which is how a page ends up
   with emphasis nobody can see. Read the header of content.ts before adding a second one to a
   block: two is none. */
strong { font-weight: 600; color: var(--text); }

/* ── The screenshots ────────────────────────────────────────────────────────────────────── */
/* The app, photographed. One row on a wide screen, one column on a phone rather than full-height
   images stacked into a mile of page.
   AUTO-FIT, NOT A COUNT. This was a hardcoded three columns when the strip held three frames, and
   a fourth frame then sat alone on a second row in the left third of the page, directly under a
   headline that had just been updated to say "in four screens". The headline is bound to the
   array by a test; the layout was bound to nothing, so it now takes whatever the array holds and
   the minimum width decides when a row breaks. The minimum is chosen against the CONTENT
   COLUMN, and that column has TWO widths: the eyebrow rail appears at 62rem and narrows it to
   about 744px, while this grid goes multi-column at 52rem, so between those breakpoints it is
   wider — about 810px at a 900px viewport. Three tracks have to be impossible at BOTH or the
   fourth frame sits alone in the left third under a headline saying "in four screens". 19rem
   (304px) needs 984px for three tracks and neither width reaches it, so it is two-by-two above
   52rem and one column below, and each frame is half again as large as the three used to be.
   Measured in a browser at 900, 991 and 1440px rather than reasoned about: 11rem gave
   three-plus-one at every width, and 15rem still gave it at 900. */
.shots { display: grid; gap: clamp(2rem, 4vw, 3rem); }
@media (min-width: 52rem) { .shots { grid-template-columns: repeat(auto-fit, minmax(19rem, 1fr)); } }
.shot { margin: 0; }
/* The frame is the same construction as the hero device, one size down, so the screenshots and the
   drawn card read as the same object rather than as a photo pasted next to an illustration. */
.shot-frame {
  border: 1px solid var(--line-strong); border-radius: 1.75rem; padding: .5rem;
  background: linear-gradient(160deg, var(--raised), var(--panel) 55%);
}
/* The shot is a light-theme capture, so on the dark page it needs its own rounded mask rather than
   bleeding into the frame. display:block is the reset's; the radius is one notch inside the
   frame's so the two curves are concentric. */
.shot-img { width: 100%; height: auto; border-radius: 1.375rem; }
.shot-caption { margin-top: 1.25rem; }
.shot-title { font-size: 1.0625rem; font-weight: 600; letter-spacing: -0.02em; }
.shot-body { margin-top: .5rem; color: var(--muted); font-size: .9375rem; }

/* ── The numbers, set large ─────────────────────────────────────────────────────────────── */
/* Every one of these is argued in a sentence further down. This is the version for the reader who
   scrolls, and the values are read from the code that produces them — see content.ts. */
.figures { display: grid; gap: 1px; background: var(--line); border: 1px solid var(--line); border-radius: 1.25rem; overflow: hidden; }
@media (min-width: 40rem) { .figures { grid-template-columns: repeat(2, 1fr); } }
@media (min-width: 64rem) { .figures { grid-template-columns: repeat(4, 1fr); } }
.figure { background: var(--ink); padding: clamp(1.5rem, 3vw, 2rem); }
.figure-value {
  display: block; font-size: clamp(1.75rem, 3.4vw, 2.375rem); font-weight: 700; line-height: 1;
}
.figure-unit {
  display: block; margin-top: .5rem;
  font-family: var(--sans); font-size: .6875rem; font-weight: 500; letter-spacing: .1em;
  text-transform: uppercase; color: var(--dim);
}
.figure-label { margin-top: 1rem; color: var(--muted); font-size: .875rem; line-height: 1.5; }

/* ── The repeated ask ───────────────────────────────────────────────────────────────────── */
/* Not a section: an interruption between two of them, on the raised surface so its three
   appearances read as ONE object recurring rather than as different offers. */
.ask { background: var(--panel); border-top: 1px solid var(--line); padding: clamp(2rem, 4vw, 2.75rem) 0; }
.ask-row { display: grid; gap: 1.25rem; align-items: center; }
@media (min-width: 58rem) { .ask-row { grid-template-columns: minmax(0, 20rem) minmax(0, 1fr); gap: 2.5rem; } }
.ask-line { color: var(--text); font-size: 1rem; font-weight: 500; letter-spacing: -0.015em; max-width: 30ch; }
/* The label above the field is redundant here — the line to its left has just said what this is —
   so it is kept for assistive technology and taken off the page. */
.ask .subscribe-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
.ask .subscribe { max-width: none; }
.ask .cta-row { margin-top: 0; }
.ask .cta-note { margin-top: .75rem; max-width: 52ch; }

/* ── The floor ──────────────────────────────────────────────────────────────────────────── */
/* The one section that sits on a different surface. Not for variety — this is the only section
   about a guard rather than a feature, and it is the one a reader who is deciding whether to trust
   an app with a daily calorie target has come to find. Everything else is flat by comparison. */
.floor-section { background: var(--panel); border-top-color: var(--line-strong); }
.floor-section .guard { border-top-color: var(--line-strong); }
.floor-section .eyebrow { color: var(--care); }
.floor-section .eyebrow::before { background: var(--care); }
.guards { display: grid; gap: 0; margin-top: .5rem; }
.guard { display: grid; gap: .5rem; padding: 1.75rem 0; border-top: 1px solid var(--line); }
@media (min-width: 56rem) { .guard { grid-template-columns: 22rem 1fr; gap: 2.5rem; align-items: baseline; } }
.guard-title { font-size: 1.0625rem; font-weight: 600; letter-spacing: -0.02em; }
.guard-body { color: var(--muted); font-size: .9375rem; max-width: 60ch; }
.floor-outro {
  margin-top: 2.5rem; padding-left: 1.25rem; border-left: 2px solid var(--care);
  color: var(--text); font-size: 1.0625rem; max-width: 54ch;
}

/* ── Prose blocks ───────────────────────────────────────────────────────────────────────── */
.prose { display: grid; gap: 1.25rem; max-width: 62ch; color: var(--muted); }
.prose p:first-child { color: var(--text); font-size: 1.0625rem; }

/* The measured numbers. Bordered rather than styled up: it is a receipt, not a badge, and the
   category's habit of putting an accuracy claim in a rosette is the thing it is answering. */
.measured {
  margin-top: 2.5rem; padding: 1.25rem 1.5rem; max-width: 62ch;
  border: 1px solid var(--line); border-radius: 1rem; background: var(--panel);
}
.measured-label {
  font-family: var(--mono); font-size: .625rem; text-transform: uppercase;
  letter-spacing: .14em; color: var(--dim);
}
.measured-body { margin-top: .625rem; color: var(--muted); font-size: .9375rem; }

/* Beside the measured numbers now, not at the foot of the page: self-measured error plus one
   human voice makes a single credible proof block, where apart they were two weak halves. */
.founder { max-width: 52ch; margin: 2.5rem 0 0; }
.founder-line {
  margin: 0; font-size: 1.0625rem; line-height: 1.55; color: var(--muted);
  border-left: 2px solid var(--line-strong); padding-left: 1.25rem; text-align: left;
}
.founder-by {
  margin-top: .75rem; padding-left: 1.3125rem; text-align: left;
  font-family: var(--mono); font-size: .6875rem; letter-spacing: .12em;
  text-transform: uppercase; color: var(--dim);
}

/* ── Privacy ────────────────────────────────────────────────────────────────────────────── */
.facts { display: grid; gap: 1.75rem; }
@media (min-width: 48rem) { .facts { grid-template-columns: repeat(2, 1fr); gap: 2.25rem 3rem; } }
.fact-title { font-size: 1rem; font-weight: 600; letter-spacing: -0.015em; }
.fact-body { margin-top: .5rem; color: var(--muted); font-size: .9375rem; }

/* ── FAQ ────────────────────────────────────────────────────────────────────────────────── */
.faq { border-top: 1px solid var(--line); }
.faq-item { border-bottom: 1px solid var(--line); }
.faq-q {
  cursor: pointer; list-style: none; padding: 1.375rem 2.5rem 1.375rem 0; position: relative;
  font-size: 1.0625rem; font-weight: 500; letter-spacing: -0.015em;
}
.faq-q::-webkit-details-marker { display: none; }
.faq-q::after {
  content: "+"; position: absolute; right: .25rem; top: 1.25rem;
  font-family: var(--mono); font-size: 1.125rem; color: var(--dim);
}
.faq-item[open] .faq-q::after { content: "\\2212"; color: var(--care); }
.faq-a { padding: 0 3rem 1.5rem 0; color: var(--muted); font-size: .9375rem; max-width: 62ch; }

/* ── The subscribe form ─────────────────────────────────────────────────────────────────── */
.subscribe { max-width: 34rem; }
/* In the hero the form REPLACES the CTA row, and it did not inherit the space that row had: the
   EMAIL ADDRESS label sat hard against the bottom of the care-blue callout above it and read as
   part of the quote. Matches .cta-row's own margin, because it is standing in the same place. */
.hero .subscribe { margin-top: 2.5rem; }
.hero-audience {
  margin-top: .875rem; font-size: .9375rem; line-height: 1.6; color: var(--dim); max-width: 54ch;
}
.subscribe-label {
  display: block; font-family: var(--mono); font-size: .625rem; text-transform: uppercase;
  letter-spacing: .14em; color: var(--dim); margin-bottom: .625rem;
}
.subscribe-row { display: flex; flex-wrap: wrap; gap: .625rem; }
.subscribe-input {
  flex: 1 1 15rem; min-width: 0;
  background: var(--panel); border: 1px solid var(--line-strong); border-radius: 999px;
  color: var(--text); font: inherit; font-size: 1rem; padding: .875rem 1.25rem;
}
.subscribe-input::placeholder { color: var(--dim); }
.subscribe-input:focus { border-color: var(--care); outline: none; }
.subscribe-button {
  flex: none; cursor: pointer;
  /* Quiet by default: in store mode the accent belongs to the CTA, and a second lime button would
     make the page ask for two things at once and get neither. */
  background: transparent; color: var(--text);
  border: 1px solid var(--line-strong); border-radius: 999px;
  font: inherit; font-size: 1rem; font-weight: 600; padding: .875rem 1.5rem;
  transition: border-color .15s ease, color .15s ease, transform .15s ease, box-shadow .15s ease;
}
.subscribe-button:hover { border-color: var(--care); }

/* When the form IS the primary action — no store listing, nothing else to tap — its button wears
   the accent, exactly the way the CTA did. Same rule, new owner. */
.subscribe-primary .subscribe-button {
  background: var(--accent); color: var(--accent-ink); border-color: var(--accent);
}
.subscribe-primary .subscribe-button:hover {
  border-color: var(--accent); transform: translateY(-1px);
  box-shadow: 0 8px 28px -12px var(--accent);
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
.subscribe-note { margin-top: 1rem; font-size: .8125rem; line-height: 1.55; color: var(--dim); max-width: 52ch; }

/* The honeypot. NOT display:none — some bots skip what a browser would not render. Moved off
   screen, taken out of the tab order in the markup, and hidden from assistive technology by
   aria-hidden on the wrapper. (No backticks anywhere in this file: it is one template literal,
   and one would end it. That has now cost two build failures.) */
.honeypot {
  position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden;
}

/* ── Spud ───────────────────────────────────────────────────────────────────────────────── */
/* He appears three times and no more — see the header of mascot.ts. Sized down deliberately: he is
   a voice beside a paragraph, not an illustration the section is built around. */
/* 4.5rem, against the app's 50-point badge. The drawing occupies about 82 of its 120 viewBox units
   vertically, so the potato itself lands near 49px — the same optical weight beside 15px body copy
   that the badge has beside 13px caption text on a phone. */
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
  border-radius: 1.125rem 1.125rem 1.125rem .25rem;
  padding: .875rem 1.125rem;
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
  font-size: clamp(1.875rem, 4.4vw, 2.75rem); font-weight: 700;
  letter-spacing: -0.04em; line-height: 1.06; max-width: 20ch;
}
.outcome-body { margin-top: 1.25rem; color: var(--muted); max-width: 48ch; }
.outcome-back { margin-top: 2rem; font-size: .9375rem; }
.outcome-back a { color: var(--muted); border-bottom: 1px solid var(--line-strong); text-decoration: none; padding-bottom: 2px; }
.outcome-back a:hover { color: var(--text); border-bottom-color: var(--care); }

/* ── Closing ────────────────────────────────────────────────────────────────────────────── */
.closing { text-align: center; padding: clamp(4.5rem, 10vw, 8rem) 0; border-top: 1px solid var(--line); }
.closing-title { font-size: clamp(1.875rem, 4.4vw, 3rem); font-weight: 700; letter-spacing: -0.04em; line-height: 1.05; text-wrap: balance; }
.closing-sub { margin: 1.25rem auto 0; color: var(--muted); max-width: 48ch; }
.closing .cta-row { justify-content: center; margin-top: 2.25rem; }
.closing .cta-note { margin-left: auto; margin-right: auto; text-align: center; }

/* ── Footer ─────────────────────────────────────────────────────────────────────────────── */
.footer { border-top: 1px solid var(--line); padding: 2.5rem 0 4rem; color: var(--dim); font-size: .8125rem; }
.footer-row { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 1rem 2rem; }
.footer-links { display: flex; flex-wrap: wrap; gap: 1.5rem; }
.footer-links a { text-decoration: none; }
.footer-links a:hover { color: var(--muted); }
.footer-note { max-width: 52ch; }
`;

export const styles = `${sheet}\n${derivedRules()}\n`;
