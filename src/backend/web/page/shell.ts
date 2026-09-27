// The document `/start` renders. One script, inline and constant, and no build step to produce it.
//
// Everything a browser needs is in the bytes of the response: the stylesheet is inline, the two
// themes are one `prefers-color-scheme` block over the palette the app and the landing page already
// share, and every interaction is a form. That is the same decision the landing page makes, plus
// one more reason — this surface handles POSTs, and a page that loads no script is a page with no
// third-party origin to allow in its own CSP. The one script it carries types Spud's onboarding
// lines out (`TYPING_SCRIPT`); it never changes, so the policy names it by hash rather than by a
// nonce, and every page works without it — the full text is in the markup.

import { PLAN_REVEAL, TYPE_MS_PER_CHAR } from "@eait/shared";
import { createHash } from "node:crypto";
import { darkVars, lightVars } from "@eait/shared/palette";
import { FONTS, fontFaces, fontFile, motionCss, RADIUS, SHADOW } from "@eait/shared/design";
import { iconCss } from "@eait/shared/ui/icons";
import type { Lang } from "@eait/shared";

export function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Where the typeface's files are served from, on this origin — `font-src 'self'` and no more. */
export const FONT_URL_DIR = "/start/assets/fonts";

/** The files the font route will serve — the family's woff2 subsets, and nothing else. */
export const FONT_FILES = FONTS.subsets.map(fontFile);
const STYLES = `
/* ── Tokens, the landing's own ───────────────────────────────────────────────────────────────
   IMPORTED RATHER THAN RETYPED. This surface and the landing page are one product to whoever is
   looking at them, and they had drifted into two: the landing is light with Montserrat on its
   headings, and these pages were a system-font sheet following the OS, so a visitor on a dark
   machine met a light marketing page and a black sign-up.

   THE OS PREFERENCE IS NOT CONSULTED HERE EITHER, for the landing's reason: light is what every
   visitor gets until they choose otherwise. These pages carry no JavaScript and therefore no
   toggle, so data-theme="dark" is set by nothing today — it is here so that the day one exists
   the values are already right. */
:root {
  ${lightVars}
  /* The register's shape and elevation, composed from shared's RADIUS/SHADOW under the boards'
     own names (--r-card, --r-ctl, --r-cta, --shadow) so a rule below reads like pro.css. */
  --r-card: ${RADIUS.card}px; --r-ctl: ${RADIUS.control}px; --r-cta: ${RADIUS.cta}px;
  --shadow: ${SHADOW};
  --sans: "Montserrat", -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, Helvetica, Arial, sans-serif;
  --display: "Montserrat", var(--sans);
  --warm: 232 190 131;
  --haze: .16;
}
:root[data-theme="dark"] { ${darkVars} --haze: .10; }

/* The one typeface, self-hosted on this origin — the register's family (DIRECTION §3), its files
   kept once in shared/assets/fonts and served by the route beside this module so nothing is
   loaded from anyone else. Its OFL licence travels with the source. */
${fontFaces(FONT_URL_DIR)}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; background: var(--bg); }
body {
  margin: 0; min-height: 100dvh;
  /* The same warm haze the landing lays over its first screen, so arriving here reads as the next
     page of one site rather than as another site. */
  background: linear-gradient(180deg, rgb(var(--warm) / var(--haze)), transparent 46rem) var(--bg);
  color: var(--ink);
  font-family: var(--sans); font-size: 17px; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
/* The design's one centred column: 620 px — a chat reads at a phone's width; a browser adds
   margin, not a second pane. The slim top bar sits above it on the walk's own screens. */
main { max-width: 38.75rem; margin: 0 auto; padding: 1.25rem 1.25rem 4rem; }
.wbar {
  display: flex; align-items: baseline; gap: .75rem; margin: 0 0 2.25rem;
  font-family: var(--display);
}
.wbar strong { font-weight: 700; letter-spacing: -0.02em; }
.wbar small {
  margin-left: auto; text-align: right; font-family: var(--sans);
  color: var(--muted); font-size: .8125rem;
}
h1, h2 { font-family: var(--display); letter-spacing: -0.02em; }
h1 { font-size: 2rem; line-height: 1.1; margin: 0 0 .75rem; }
h2 { font-size: 1.125rem; margin: 2.5rem 0 .75rem; }
p { margin: 0 0 1rem; }
.muted { color: var(--muted); }
.small { font-size: .875rem; }
img, svg { display: block; max-width: 100%; }

.card {
  background: var(--surface); border: 1px solid var(--hair);
  border-radius: 20px; padding: 1.25rem; margin: 0 0 .75rem;
  box-shadow: 0 1px 2px rgb(19 20 23 / .04);
}
.bubble {
  background: var(--surface); border: 1px solid var(--hair);
  border-radius: 20px; border-bottom-left-radius: 6px;
  padding: .8rem 1.1rem; margin: 0 0 .5rem;
  box-shadow: 0 1px 2px rgb(19 20 23 / .04);
}
.bubble.you {
  background: var(--accent); color: var(--accent-ink); border-color: var(--accent);
  border-bottom-left-radius: 20px; border-bottom-right-radius: 6px;
  margin-left: auto; max-width: 85%;
  box-shadow: 0 12px 32px -20px rgb(19 20 23 / .45);
}
.who {
  font-family: var(--display); font-size: .8125rem; font-weight: 600; letter-spacing: -0.01em;
  color: var(--faint); margin: 0 0 .25rem .25rem;
}
.pill {
  display: inline-block; border: 1px solid var(--line); border-radius: 999px;
  padding: .15rem .7rem; margin: .4rem .4rem 0 0;
  font-size: .8125rem; color: var(--muted);
}
.spud { width: 64px; height: 64px; display: block; margin: 0 0 1rem; }
/* The part of a line not yet typed. Laid out, read by a screen reader, not yet seen. */
.untyped { color: transparent; }

form { margin: 0; }
/* Pill buttons and pill fields, which is the shape the landing's calls to action are. */
button, .button {
  display: block; width: 100%; text-align: left; cursor: pointer;
  font: inherit; font-family: var(--display); font-weight: 600; letter-spacing: -0.01em;
  color: var(--ink); background: var(--surface);
  border: 1px solid var(--line); border-radius: 999px;
  padding: .9375rem 1.375rem; margin: 0 0 .625rem; text-decoration: none;
  transition: border-color .15s ease, transform .18s ease, box-shadow .18s ease;
}
button:hover, .button:hover { border-color: var(--ink); }
button.primary, .button.primary {
  background: var(--accent); color: var(--accent-ink); border-color: var(--accent);
  text-align: center;
  box-shadow: 0 12px 32px -16px rgb(19 20 23 / .45);
}
button.primary:hover, .button.primary:hover { transform: translateY(-2px); box-shadow: 0 16px 36px -14px var(--accent); }
button .hint { display: block; font-family: var(--sans); font-weight: 400; color: var(--muted); font-size: .875rem; }
button.primary .hint { color: inherit; opacity: .85; }
input[type=number], input[type=text] {
  width: 100%; font: inherit; color: var(--ink); background: var(--surface);
  border: 1px solid var(--line); border-radius: 999px;
  padding: .9375rem 1.375rem; margin: 0 0 .625rem;
  box-shadow: 0 1px 2px rgb(19 20 23 / .04);
  transition: border-color .15s ease, box-shadow .15s ease;
}
input::placeholder { color: var(--faint); }
input:focus { border-color: var(--care); }
/* ONE focus ring (#53), solid ink on every control — the old 18%-alpha glow did not reach 3:1. */
:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
label.check:has(input:focus-visible) { outline: 2px solid var(--ink); outline-offset: 2px; }
label.check input { accent-color: var(--accent); width: 1.1rem; height: 1.1rem; vertical-align: -.15rem; margin: 0 .5rem 0 0; }
.field-error { margin-top: -.25rem; }
h1.bubble { font-family: var(--sans); font-size: 1em; font-weight: 400; letter-spacing: normal; line-height: 1.6; margin: 0 0 .5rem; }
.back {
  display: inline-flex; align-items: center; min-height: 44px; min-width: 44px; margin: -.5rem 0 .5rem;
  color: var(--muted); text-decoration: none; font-family: var(--display); font-weight: 600;
}
.back::before { content: "‹"; margin-right: .35rem; }
input[type=file] {
  display: block; width: 100%; margin: 0 0 .625rem; font: inherit; font-size: 1rem;
  color: var(--muted);
}
label.check {
  display: block; background: var(--surface); border: 1px solid var(--line);
  border-radius: 20px; padding: .8rem 1.25rem; margin: 0 0 .625rem; cursor: pointer;
}
.notice { border-left: 3px solid var(--warn); padding-left: 1rem; margin: 0 0 1.25rem; color: var(--muted); }
.care { border-left-color: var(--care); }
.progress {
  font-family: var(--display); color: var(--faint); font-size: .75rem;
  margin: 0 0 1rem; letter-spacing: .08em; text-transform: uppercase;
}
.figure { font-family: var(--display); font-size: 2.6rem; font-weight: 600; letter-spacing: -0.03em; line-height: 1; }

/* Spud's one line back on the answer just given — the small avatar beside the beat, and the
   mood's own face inside it (the reaction decides which mouth is drawn, not the page). */
.spk { display: flex; gap: .7rem; align-items: flex-start; margin: 0 0 .6rem; }
.spk .av {
  flex: 0 0 40px; width: 40px; height: 40px; border-radius: 50%; overflow: hidden;
  background: var(--surface); border: 1px solid var(--hair);
  display: flex; align-items: center; justify-content: center;
}
.spk .av svg { width: 32px; height: 32px; }
.spk .bubble { flex: 1; margin-bottom: 0; }

/* The target stepper (#42): a card holding the number, with − and + as round submits — the only
   control a page with no JavaScript can honestly offer, and all the flow needs. */
.stepper { display: flex; align-items: center; gap: 1rem; }
.stepper > div:first-child { flex: 1; min-width: 0; }
.stepper .lab { font-size: .8125rem; color: var(--muted); margin: 0 0 .2rem; }
.stepper .figure { margin: 0; }
/* The number is a real input, not a picture of one — keyboard entry is the honest fallback a
   stepper on a no-JavaScript page owes anybody who knows the number they want. */
.stepper-num {
  width: 5.5ch; padding: 0; margin: 0; border: 0; border-radius: 6px;
  background: transparent; font: inherit; letter-spacing: inherit; color: inherit;
}
.stepper .figure .stepper-num { box-shadow: none; }
.stepper .figure { white-space: nowrap; }
.stepper-btns { display: flex; gap: .6rem; }
.stepper-btns button {
  width: 46px; height: 46px; padding: 0; margin: 0; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; text-align: center;
  font-size: 1.5rem; line-height: 1;
}
.stepper-btns button:disabled { opacity: .38; cursor: default; }
.stepper-btns button:disabled:hover { border-color: var(--line); transform: none; box-shadow: none; }

/* A support moment (#42): a whole screen that is one beat — the halo, the prop that names the
   pose, the answer echoed back, a title, a line and one button. */
.moment { text-align: center; padding: 2rem 0 1.5rem; }
.halo {
  width: 230px; height: 200px; margin: 0 auto .5rem; position: relative;
  display: flex; align-items: center; justify-content: center; border-radius: 50%;
  background: radial-gradient(circle at 50% 45%, rgb(var(--warm) / .5), rgb(var(--warm) / 0) 70%);
}
.halo > svg { width: 150px; height: 150px; }
.prop { position: absolute; right: 20px; bottom: 26px; width: 46px; height: 46px; color: var(--accent); }
.prop svg { width: 100%; height: 100%; }
.prop-think { color: var(--care); }
.prop-heart { color: var(--bad); }
.prop-lift { color: var(--ink); }
.echo {
  display: inline-block; background: var(--surface); border: 1px solid var(--hair);
  border-radius: 999px; padding: .3rem .95rem; margin: 0 0 1rem;
  font-family: var(--display); font-weight: 600;
}

/* The soft offer (#42): the plan's one ask — perks, an honest timeline, the close that is the
   free meal. A LINK for the ×, because it changes nothing. */
.offer { position: relative; padding-top: .5rem; }
.offer .x {
  position: absolute; top: 0; right: 0; width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; text-decoration: none;
  color: var(--muted); background: var(--surface); border: 1px solid var(--hair); font-size: 1.15rem;
}
.offer-hero { width: 96px; margin: 1rem auto .5rem; }
.offer-hero svg { width: 96px; height: 96px; }
.offer .beat { text-align: center; color: var(--muted); margin: 0 0 .35rem; }
.offer h1 { text-align: center; }
.perk { display: flex; gap: .6rem; align-items: center; font-weight: 600; margin: 0 0 .55rem; }
.tick {
  flex: 0 0 22px; width: 22px; height: 22px; border-radius: 50%;
  background: var(--accent); color: var(--accent-ink);
  display: inline-flex; align-items: center; justify-content: center;
}
.tick svg { width: 12px; height: 12px; }
.rowline { display: flex; justify-content: space-between; gap: 1rem; padding: .65rem 0; border-top: 1px solid var(--hair); }
.rowline:first-child { border-top: 0; }

/* The plan page (#51). A small label over a figure, the declared marker caps in a row beside it,
   and the arithmetic as labelled rows — the phone's calc card, drawn the web's way. */
.lab {
  font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: var(--faint); margin: 0 0 .4rem;
}
.specs { display: flex; gap: 1.25rem; margin: .75rem 0 0; }
.specs > div { flex: 1; min-width: 0; }
.specs .lab {
  font-size: .8125rem; font-weight: 600; letter-spacing: 0; text-transform: none;
  color: var(--muted); margin-bottom: .15rem;
}
.specs .val { font-weight: 700; margin: 0; font-variant-numeric: tabular-nums; }
.arith { margin-top: .75rem; }
.arith .rowline { font-size: .875rem; padding: .5rem 0; }
.arith strong { font-variant-numeric: tabular-nums; }

/* ── The Register P screens (W3): reveal, plan, sign-up, country ────────────────────────────
   Board classes, one rule each, the values the boards' own (pro.css): tokens from :root, the
   icon classes generated from shared's ICONS, and durations from MOTION / PLAN_REVEAL. */
${iconCss()}
.num { font-variant-numeric: tabular-nums; }

/* The primary control the boards draw (.cta): not a pill — r-cta, 16 px, full width. */
.cta {
  display: flex; align-items: center; justify-content: center; gap: .5rem;
  width: 100%; min-height: 52px; padding: 0 1.25rem; margin: 0 0 .625rem;
  border: 0; border-radius: var(--r-cta); cursor: pointer; text-decoration: none;
  font-family: var(--sans); font-size: 16px; font-weight: 600; text-align: center;
}
.cta.p { background: var(--accent); color: var(--accent-ink); }
.cta.s { background: var(--surface); color: var(--ink); box-shadow: 0 0 0 1px var(--line); }
.cta.apple { background: #000; color: #fff; }
.cta svg { width: 20px; height: 20px; }
button.cta { font: inherit; font-size: 16px; font-weight: 600; }

/* The say-line: Spud at 28 px beside his one line (DIRECTION §6 — the avatar, never the body). */
.say { display: flex; gap: 10px; align-items: center; }
.say .av {
  flex: 0 0 28px; width: 28px; height: 28px; border-radius: 50%;
  background: var(--accent-tint); display: flex; align-items: center; justify-content: center;
}
.say .av svg { width: 22px; height: 22px; }
.say .q { font-size: 22px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; margin: 0; }

/* The walk's dash: one segment per screen behind the reader, the current one in accent —
   the now segment's grow is motionCss's own .dash i.now rule. */
.dash { display: flex; gap: 4px; margin: 0 0 2rem; }
.dash i { height: 3px; flex: 1; background: var(--hair); }
.dash i.on { background: var(--ink); }
.dash i.now { background: var(--accent); }

/* The reveal (ob-building). The count, the bar and the row ticks are PLAN_REVEAL's data drawn,
   not retyped: the count and the bar run durationMs, the rows tick at rowTicksMs and the
   button pops when the count lands. */
.bld { padding-top: 4rem; text-align: center; }
.bld .pct { font-size: 72px; font-weight: 700; letter-spacing: -.04em; line-height: 1; }
.bld .pct::after { content: "%"; font-size: 28px; font-weight: 600; margin-left: 4px; letter-spacing: 0; }
.bld .count { animation-duration: ${PLAN_REVEAL.durationMs / 1000}s; animation-timing-function: linear; }
.bld .bld-line { font-size: 22px; font-weight: 700; letter-spacing: -.02em; line-height: 1.15; margin: 12px 0 0; }
.bld .lbar { height: 6px; border-radius: 3px; background: var(--hair); overflow: hidden; margin: 18px 0 26px; }
.bld .lbar i {
  display: block; height: 100%; background: var(--accent); transform-origin: left;
  animation: k-grow ${PLAN_REVEAL.durationMs / 1000}s linear both;
}
.bld .card { border: 0; border-radius: var(--r-card); box-shadow: var(--shadow); text-align: left; }
.bld .card > .lab {
  display: block; font-size: .75rem; font-weight: 600; letter-spacing: .06em;
  text-transform: uppercase; color: var(--muted); margin-bottom: .25rem;
}
/* A row waits dimmed for its tick and fades up — the board's own effect, a soft rise timed by
   data rather than a duration from the vocabulary. */
@keyframes k-tick { from { opacity: .3; } to { opacity: 1; } }
.bld .chk {
  display: flex; align-items: center; gap: 12px; padding: 12px 0;
  border-top: 1px solid var(--hair); font-weight: 500;
  animation: k-tick .4s var(--ease) both; animation-delay: var(--d, 0s);
}
.bld .chk:first-of-type { border-top: 0; }
.bld .chk > i { width: 22px; height: 22px; border-radius: 50%; flex: 0 0 22px; background: var(--accent); position: relative; }
.bld .chk > i::after {
  content: ""; position: absolute; left: 7px; top: 3px; width: 6px; height: 11px;
  border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.bld .chk b { margin-left: auto; font-weight: 600; }
.bld .go { max-width: 22.5rem; margin: 1.5rem auto 0; }

/* The plan (15-plan): the headline, the estimate graph card, the kcal card and the macro grid. */
.pln .goal { font-size: 20px; font-weight: 700; line-height: 1.25; margin: 0; }
.pln .card { border: 0; border-radius: var(--r-card); box-shadow: var(--shadow); padding: 18px 24px; }
.pln .row-between { display: flex; align-items: center; justify-content: space-between; }
.pln .row-between b { font-weight: 600; }
.tagx {
  display: inline-flex; align-items: center; gap: 5px; background: var(--surface);
  border-radius: 999px; padding: 3px 9px 3px 4px; font-size: 12px; font-weight: 600;
  color: var(--ink); box-shadow: 0 1px 3px rgba(23,25,28,.16); white-space: nowrap;
}
.tagx .wm { width: 18px; height: 18px; display: inline-flex; }
.tagx .wm svg { width: 18px; height: 18px; border-radius: 50%; }
.pgraph text { font-size: 12px; fill: var(--muted); font-family: inherit; }
.pgraph .ln { fill: none; stroke: var(--accent); stroke-width: 2.5; stroke-linecap: round; }
.pgraph { display: block; overflow: visible; }
.pln .kgrid { display: grid; grid-template-columns: 1.6fr repeat(4, 1fr); gap: 10px; }
.pln .kcal { display: flex; flex-direction: column; justify-content: center; gap: 6px; }
.pln .kcal .big { display: flex; align-items: center; gap: 8px; }
.pln .kcal .big b { font-size: 28px; font-weight: 700; letter-spacing: -.02em; }
.pln .est { font-size: 12px; font-weight: 600; color: var(--muted); }
.mcard {
  background: var(--surface); border-radius: var(--r-card); box-shadow: var(--shadow);
  padding: 12px 12px 14px; display: flex; flex-direction: column; gap: 4px; min-width: 0;
}
.mcard .ico { width: 34px; height: 34px; margin-bottom: 4px; }
.mcard b { font-size: 20px; font-weight: 700; letter-spacing: -.02em; font-variant-numeric: tabular-nums; }
.mcard small { font-size: 12px; font-weight: 600; color: var(--muted); }
@media (max-width: 560px) {
  .pln .kgrid { grid-template-columns: 1fr 1fr; }
  .pln .kcal { grid-column: 1 / -1; }
}

/* The sign-up (pay-signin): the plate photograph on top, the two provider buttons, the pairing
   card, then the two consent boxes — tickable but never pre-ticked. */
.sup .hero { border-radius: var(--r-card); overflow: hidden; margin: 0 0 1.25rem; }
.sup .hero img { width: 100%; height: 240px; object-fit: cover; display: block; }
.sup h1 { font-size: 28px; font-weight: 700; letter-spacing: -.02em; line-height: 1.1; margin: 0 0 1rem; }
.sup .paircard { border-radius: var(--r-card); box-shadow: 0 0 0 1px var(--hair); background: var(--surface); padding: 14px 16px; margin: 6px 0 10px; }
.sup .paircard .row-between { display: flex; align-items: baseline; justify-content: space-between; gap: 10px; }
.sup .paircard .row-between small { font-size: 12px; color: var(--muted); font-weight: 500; }
.sup .paircard form { display: flex; gap: 10px; margin-top: 12px; }
.sup .paircard input[type="text"] {
  flex: 1; margin: 0; border-radius: var(--r-ctl); border: 0; box-shadow: 0 0 0 1px var(--line);
  letter-spacing: .3em; font-weight: 600; padding: 0 14px; height: 48px;
}
.sup .paircard .cta { width: auto; min-height: 48px; padding: 0 18px; font-size: 15px; margin: 0; }
.consent { display: flex; flex-direction: column; gap: 10px; margin-top: 6px; }
.consent label {
  display: flex; gap: 10px; align-items: flex-start; cursor: pointer;
  font-size: 13px; line-height: 1.35; color: var(--muted); font-weight: 500;
}
.consent input {
  appearance: none; flex: 0 0 20px; width: 20px; height: 20px; margin: 1px 0 0;
  border-radius: 5px; box-shadow: inset 0 0 0 1.5px var(--line); background: var(--surface);
}
/* The tick is drawn on the box itself, the same stroke the reveal's checks wear. */
.consent input:checked {
  background: var(--accent); box-shadow: none;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Cpath d='M5 10.5l3.4 3.4L15 6.6' fill='none' stroke='%23fff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
  background-position: center; background-repeat: no-repeat; background-size: 13px;
}

/* The country (16-country): the ask, the search, the flagged grid — other last. */
.cty .srch {
  display: flex; align-items: center; gap: 8px; height: 44px; border-radius: var(--r-card);
  background: var(--surface); box-shadow: 0 0 0 1px var(--hair); padding: 0 14px;
  color: var(--faint); margin: 18px 0 12px;
}
.cty .srch svg { width: 18px; height: 18px; }
.cty .srch input { border: 0; background: none; padding: 0; margin: 0; flex: 1; font: inherit; color: var(--ink); height: 100%; }
.cty .srch input:focus { outline: none; }
.cty .srch:focus-within { box-shadow: 0 0 0 2px var(--ink); }
.cty .opts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 0 0 1rem; }
.cty .opt {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px; margin: 0; cursor: pointer;
  background: var(--surface); border-radius: var(--r-card); box-shadow: 0 0 0 1px var(--hair);
  font-size: 15px; font-weight: 500;
}
.cty .opt input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.cty .opt:has(input:checked) { box-shadow: 0 0 0 2px var(--ink); font-weight: 600; }
.cty .opt:has(input:focus-visible) { outline: 2px solid var(--ink); outline-offset: 2px; }
.cty .flag { font-size: 22px; line-height: 1; }
.cty .flag.any { width: 22px; display: inline-flex; justify-content: center; color: var(--muted); font-size: 18px; }
.cty .ck { margin-left: auto; flex: 0 0 22px; width: 22px; height: 22px; border-radius: 50%; box-shadow: inset 0 0 0 1.5px var(--line); position: relative; }
.cty .opt:has(input:checked) .ck { background: var(--accent); box-shadow: none; }
.cty .opt:has(input:checked) .ck::after {
  content: ""; position: absolute; left: 7px; top: 3px; width: 6px; height: 11px;
  border: solid #fff; border-width: 0 2px 2px 0; transform: rotate(45deg);
}
.cty .opt.hide { display: none; }
@media (max-width: 560px) { .cty .opts { grid-template-columns: 1fr; } }

/* The register's motion vocabulary, generated — the six verbs, their keyframes, the stagger
   property and the reduced-motion block, so this file never retypes a duration (#78). */
${motionCss()}
`;

/**
 * The document.
 *
 * `noindex`, because this is somebody's sign-up in progress and not a page anybody should arrive at
 * from a search result. The CSP says what the page actually is — no script, no frame, no third
 * party — so an edit that reaches for a CDN fails here rather than shipping one quietly.
 */
/**
 * Spud types his onboarding lines out, one after another, one character per beat — the pace the
 * app's onboarding keeps (`shared/typing.ts`), so the two surfaces read the same. THE WHOLE LINE
 * IS IN THE MARKUP from the first byte: a line not yet typed is drawn transparent at its final size,
 * so nothing moves, a screen reader has every word, and a browser with no script sees the page whole.
 * `prefers-reduced-motion` shows the lines at once. Only `.bubble.typed` is touched — the chat
 * thread's lines are history, drawn whole.
 */
export const TYPING_SCRIPT = `(function () {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var MS = ${TYPE_MS_PER_CHAR}, GAP = 350;
  var lines = Array.prototype.slice.call(document.querySelectorAll(".bubble.typed")).map(function (p) {
    var chars = Array.from(p.textContent);
    var seen = document.createElement("span"), rest = document.createElement("span");
    rest.className = "untyped";
    rest.textContent = p.textContent;
    p.textContent = "";
    p.appendChild(seen);
    p.appendChild(rest);
    return { chars: chars, seen: seen, rest: rest };
  });
  var i = 0;
  function next() {
    if (i >= lines.length) return;
    var line = lines[i++], t0 = performance.now();
    (function tick() {
      var n = Math.min(line.chars.length, Math.floor((performance.now() - t0) / MS));
      line.seen.textContent = line.chars.slice(0, n).join("");
      line.rest.textContent = line.chars.slice(n).join("");
      if (n < line.chars.length) requestAnimationFrame(tick); else setTimeout(next, GAP);
    })();
  }
  next();
})();`;

/** What the policy allows to run: that script and nothing else. */
const TYPING_SCRIPT_HASH = createHash("sha256").update(TYPING_SCRIPT).digest("base64");

export function shell(title: string, body: string, lang: Lang, opts: { head?: string } = {}): string {
  return `<!doctype html>
<!-- \`lang\` is not decoration: it is what a screen reader picks a voice from and what a browser
     offers to translate. A German page declaring itself English is read aloud in an English
     accent, which is worse than an untranslated page and is invisible to everyone who can see. -->
<html lang="${escape(lang)}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)}</title>${opts.head ?? ""}
<!-- Empty data: icon. An anonymous request for an unknown path on this origin is answered 401
     by resolveUserId before anything can 404 it, so /favicon.ico logged a console error on every
     page load. A console that always has an error in it is a console nobody reads. -->
<link rel="icon" href="data:,">
<style>${STYLES}</style>
</head><body><main>${body}</main><script>${TYPING_SCRIPT}</script></body></html>`;
}

export function html(
  body: string,
  status = 200,
  opts: { cookies?: readonly string[]; formAction?: readonly string[] } = {},
): Response {
  const res = new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${TYPING_SCRIPT_HASH}'; ` +
        // `https://t.me` because Connect Telegram's POST answers with a redirect there, and a form's
        // redirect is held to this directive as well. `formAction` is the same thing for the
        // sign-up screen: the consent POST's 303 sends the browser to the provider's own origin,
        // which 'self' would have Chrome refuse with ERR_ABORTED and no navigation at all.
        "img-src 'self' data:; font-src 'self'; form-action 'self' https://t.me"
        + (opts.formAction?.length ? ` ${opts.formAction.join(" ")}` : ""),
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      // A sign-up in progress is per-person and per-session. Nothing here may sit in a shared cache.
      "cache-control": "no-store",
    },
  });
  for (const cookie of opts.cookies ?? []) res.headers.append("set-cookie", cookie);
  return res;
}
