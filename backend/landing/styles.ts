// The stylesheet, as a string, emitted to `styles.css` beside the page.
//
// EXTERNAL RATHER THAN INLINE, for one reason: it lets the Content-Security-Policy served with the
// page be `default-src 'none'; style-src 'self'` with no `unsafe-inline` anywhere and no
// `script-src` at all. There is no JavaScript on this page — the one animated moment is CSS, the
// FAQ is `<details>` — so the strictest possible policy is also an accurate description of it. A
// page whose entire pitch is "we do not keep anything of yours" should not be loading a script.
//
// The tokens are `src/mobile/lib/theme.ts`, transcribed. A test asserts they still match, because
// two files holding one palette is the shape of a drift, and the accent going stale here would be
// the first thing a visitor coming from the App Store screenshots notices.

import { color } from "./tokens.ts";
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
  ].join("\n");
}

const sheet = `
/* ── Tokens ─────────────────────────────────────────────────────────────────────────────── */
:root {
  --ink: ${color.bg};
  --panel: ${color.surface};
  --raised: ${color.surfaceRaised};
  --line: ${color.border};
  --line-strong: ${color.borderStrong};

  --text: ${color.text};
  --muted: ${color.textMuted};
  --faint: ${color.textFaint};

  /* The app's third text colour, RAISED for this page — and the one place a token deliberately
     differs from theme.ts rather than tracking it.

     ${color.textFaint} on ${color.bg} computes to 4.0:1, which is under WCAG AA's 4.5:1 for text
     below 24px. In the app that is a caption glanced at for a second inside a screen the user
     chose to open. Here it would be the small print under the button, the receipt line on every
     refusal, and the whole footer — read once, by a stranger, deciding whether to trust a health
     app. This value is 5.1:1 on the page background and 4.8:1 on the floor section's panel, and it
     keeps the three-level hierarchy the app has.

     A test asserts that --faint is not used for anything on this page, so the app's value cannot
     creep back in by being the obvious token to reach for. */
  --dim: #7C838B;

  /* One accent, spent on exactly one thing per screen: the primary action. Same rule as the app. */
  --accent: ${color.accent};
  --accent-ink: ${color.accentText};

  --good: ${color.good};
  --warn: ${color.warn};
  --bad: ${color.bad};
  /* Reserved for the floor and nothing else, so a blue tick anywhere means "we stopped you". */
  --care: ${color.care};

  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, Helvetica, Arial, sans-serif;
  --mono: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace;

  --wrap: 68rem;
  --gutter: clamp(1.25rem, 5vw, 3rem);
  color-scheme: dark;
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
.masthead-links { display: flex; gap: 1.5rem; font-size: .875rem; color: var(--muted); }
.masthead-links a { text-decoration: none; }
.masthead-links a:hover { color: var(--text); }

/* ── Hero ───────────────────────────────────────────────────────────────────────────────── */
.hero { padding: clamp(2.5rem, 6vw, 4.5rem) 0 clamp(4rem, 8vw, 6rem); }
.hero-grid { display: grid; gap: clamp(3rem, 6vw, 4.5rem); align-items: center; }
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

.mcard-note { margin-top: .875rem; font-size: .75rem; line-height: 1.5; color: var(--dim); }

/* One orchestrated arrival, in the order the app itself resolves: the target you were given, then
   the meal, then the judgement on it. Nothing else on the page moves. */
.deal { animation: deal .5s cubic-bezier(.2, .7, .3, 1) backwards; }
@keyframes deal { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: none; } }
.pill { animation: resolve .34s cubic-bezier(.2, .7, .3, 1) backwards; }
@keyframes resolve { from { opacity: 0; transform: scale(.9); } to { opacity: 1; transform: none; } }

@media (prefers-reduced-motion: reduce) {
  .deal, .pill { animation: none; }
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
