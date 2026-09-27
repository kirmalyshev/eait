// The document `/start` renders. One script, inline and constant, and no build step to produce it.
//
// Everything a browser needs is in the bytes of the response: the stylesheet is inline, the two
// themes are one `prefers-color-scheme` block over the palette the app and the landing page already
// share, and every interaction is a form. That is the same decision the landing page makes, plus
// one more reason — this surface handles POSTs, and a page that loads no script is a page with no
// third-party origin to allow in its own CSP. The one script it carries types Spud's onboarding
// lines out (`TYPING_SCRIPT`); it never changes, so the policy names it by hash rather than by a
// nonce, and every page works without it — the full text is in the markup.

import { createHash } from "node:crypto";
import { darkVars, lightVars } from "@eait/shared/palette";
import { FONTS, fontFaces, fontFile, motionCss } from "@eait/shared/design";
import { BOARD_CSS } from "./board-css.ts";
import { W3_CSS } from "./w3-css.ts";
import { CONTROL_SCRIPT } from "./control.ts";
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

/* The register's motion vocabulary, generated — the six verbs, their keyframes, the stagger
   property and the reduced-motion block, so this file never retypes a duration (#78). */
${motionCss()}

/* The onboarding boards (#89): W2's register-P frames, scoped under main.ob. */
${BOARD_CSS}

/* The screens W3 owns (issue #90): the reveal, the plan, the sign-up, the country —
   same boards' classes, scoped the same way. */
${W3_CSS}
`;

/**
 * The document.
 *
 * `noindex`, because this is somebody's sign-up in progress and not a page anybody should arrive at
 * from a search result. The CSP says what the page actually is — no script, no frame, no third
 * party — so an edit that reaches for a CDN fails here rather than shipping one quietly.
 */
/**
 * The one script the page carries (`control.ts`): it drives the boards' pickers — the rulers,
 * the wheel, the pace slider — and nothing else. Every control it touches degrades to a plain
 * input the same response already rendered, so a browser with the script blocked still answers
 * every question; the hash, not a nonce, is what the policy names because the bytes never change.
 */
export { CONTROL_SCRIPT };

/** What the policy allows to run: that script and nothing else. */
const CONTROL_SCRIPT_HASH = createHash("sha256").update(CONTROL_SCRIPT).digest("base64");

export function shell(
  title: string, body: string, lang: Lang,
  mainClass?: string,
  /** Extra <head> markup — the reveal's meta refresh is the only page that needs one. */
  head = "",
): string {
  return `<!doctype html>
<!-- \`lang\` is not decoration: it is what a screen reader picks a voice from and what a browser
     offers to translate. A German page declaring itself English is read aloud in an English
     accent, which is worse than an untranslated page and is invisible to everyone who can see. -->
<html lang="${escape(lang)}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)}</title>${head}
<!-- Empty data: icon. An anonymous request for an unknown path on this origin is answered 401
     by resolveUserId before anything can 404 it, so /favicon.ico logged a console error on every
     page load. A console that always has an error in it is a console nobody reads. -->
<link rel="icon" href="data:,">
<style>${STYLES}</style>
</head><body><main${mainClass ? ` class="${escape(mainClass)}"` : ""}>${body}</main><script>${CONTROL_SCRIPT}</script></body></html>`;
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
        `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${CONTROL_SCRIPT_HASH}'; ` +
        // `media-src` is the welcome's recorded demo loop — one self-hosted file, same origin.
        `media-src 'self'; ` +
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
