// The pages `/start` renders. One script, inline and constant, and no build step to produce it.
//
// Everything a browser needs is in the bytes of the response: the stylesheet is inline, the two
// themes are one `prefers-color-scheme` block over the palette the app and the landing page already
// share, and every interaction is a form. That is the same decision the landing page makes, plus
// one more reason — this surface handles POSTs, and a page that loads no script is a page with no
// third-party origin to allow in its own CSP. The one script it carries types Spud's onboarding
// lines out (`TYPING_SCRIPT`); it never changes, so the policy names it by hash rather than by a
// nonce, and every page works without it — the full text is in the markup.

import { MAX_USER_LINE, TYPE_MS_PER_CHAR } from "@eait/shared";
import { createHash } from "node:crypto";
import { darkVars, lightVars } from "@eait/shared/palette";
import { spudSvg, type MascotMood } from "@eait/shared/mascot";

export function escape(text: string): string {
  return text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/**
 * Every sentence this surface writes for itself, gated by a test against `lintCopy`.
 *
 * IT IS THIS AND NOT THE RENDERED PAGE, and the difference is worth stating. The questions are the
 * admin's onboarding copy, which says things like "Lose weight" — a goal a user picks, not a
 * promise anybody made — and the claims linter cannot tell those apart: `weight-promise` matches
 * `lose\s*weight` wherever it appears. Gating the whole page would make the surface unbuildable
 * against copy that has always shipped, ungated, inside the app. So what is gated is what is NEW:
 * the words below, which are this page's own and are public marketing copy in a way an in-app
 * question is not.
 */
import { PAGE_COPY, pageCopyFor, type PageCopy } from "./copy.ts";
import {
  LANGS_READY, LANG_LABEL, UNIT_KCAL, chatCopyFor, numbers, spellUnit, verdictNoun, wholeNumbers,
  type Lang, type MomentId, type MomentPose,
} from "@eait/shared";

export { PAGE_COPY, PAGE_COPY_BY_LANG, pageCopyFor, type PageCopy } from "./copy.ts";

/** Where the typeface is served from, on this origin, so the CSP needs `font-src 'self'` and no more. */
export const FONT_PATH = "/start/assets/space-grotesk-latin.woff2";

const STYLES = `
/* ── Tokens, the landing's own ───────────────────────────────────────────────────────────────
   IMPORTED RATHER THAN RETYPED. This surface and the landing page are one product to whoever is
   looking at them, and they had drifted into two: the landing is light with Space Grotesk on its
   headings, and these pages were a system-font sheet following the OS, so a visitor on a dark
   machine met a light marketing page and a black sign-up.

   THE OS PREFERENCE IS NOT CONSULTED HERE EITHER, for the landing's reason: light is what every
   visitor gets until they choose otherwise. These pages carry no JavaScript and therefore no
   toggle, so data-theme="dark" is set by nothing today — it is here so that the day one exists
   the values are already right. */
:root {
  ${lightVars}
  --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, Roboto, Helvetica, Arial, sans-serif;
  --display: "Space Grotesk", var(--sans);
  --warm: 232 190 131;
  --haze: .16;
}
:root[data-theme="dark"] { ${darkVars} --haze: .10; }

/* The one typeface, self-hosted on this origin — the landing's file, served by the route beside
   this module so nothing is loaded from anyone else. Its OFL licence travels with the source. */
@font-face {
  font-family: "Space Grotesk";
  src: url("${FONT_PATH}") format("woff2");
  font-weight: 300 700;
  font-display: swap;
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; background: var(--ink); }
body {
  margin: 0; min-height: 100dvh;
  /* The same warm haze the landing lays over its first screen, so arriving here reads as the next
     page of one site rather than as another site. */
  background: linear-gradient(180deg, rgb(var(--warm) / var(--haze)), transparent 46rem) var(--ink);
  color: var(--text);
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
  background: var(--panel); border: 1px solid var(--line);
  border-radius: 20px; padding: 1.25rem; margin: 0 0 .75rem;
  box-shadow: 0 1px 2px rgb(19 20 23 / .04);
}
.bubble {
  background: var(--panel); border: 1px solid var(--line);
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
  color: var(--dim); margin: 0 0 .25rem .25rem;
}
.pill {
  display: inline-block; border: 1px solid var(--line-strong); border-radius: 999px;
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
  color: var(--text); background: var(--raised);
  border: 1px solid var(--line-strong); border-radius: 999px;
  padding: .9375rem 1.375rem; margin: 0 0 .625rem; text-decoration: none;
  transition: border-color .15s ease, transform .18s ease, box-shadow .18s ease;
}
button:hover, .button:hover { border-color: var(--text); }
button.primary, .button.primary {
  background: var(--accent); color: var(--accent-ink); border-color: var(--accent);
  text-align: center;
  box-shadow: 0 12px 32px -16px rgb(19 20 23 / .45);
}
button.primary:hover, .button.primary:hover { transform: translateY(-2px); box-shadow: 0 16px 36px -14px var(--accent); }
button .hint { display: block; font-family: var(--sans); font-weight: 400; color: var(--muted); font-size: .875rem; }
button.primary .hint { color: inherit; opacity: .85; }
input[type=number], input[type=text] {
  width: 100%; font: inherit; color: var(--text); background: var(--raised);
  border: 1px solid var(--line-strong); border-radius: 999px;
  padding: .9375rem 1.375rem; margin: 0 0 .625rem;
  box-shadow: 0 1px 2px rgb(19 20 23 / .04);
  transition: border-color .15s ease, box-shadow .15s ease;
}
input::placeholder { color: var(--dim); }
input:focus { border-color: var(--care); }
/* ONE focus ring (#53), solid ink on every control — the old 18%-alpha glow did not reach 3:1. */
:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
label.check:has(input:focus-visible) { outline: 2px solid var(--text); outline-offset: 2px; }
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
  display: block; background: var(--raised); border: 1px solid var(--line-strong);
  border-radius: 20px; padding: .8rem 1.25rem; margin: 0 0 .625rem; cursor: pointer;
}
.notice { border-left: 3px solid var(--warn); padding-left: 1rem; margin: 0 0 1.25rem; color: var(--muted); }
.care { border-left-color: var(--care); }
.progress {
  font-family: var(--display); color: var(--dim); font-size: .75rem;
  margin: 0 0 1rem; letter-spacing: .08em; text-transform: uppercase;
}
.figure { font-family: var(--display); font-size: 2.6rem; font-weight: 600; letter-spacing: -0.03em; line-height: 1; }

/* Spud's one line back on the answer just given — the small avatar beside the beat, and the
   mood's own face inside it (the reaction decides which mouth is drawn, not the page). */
.spk { display: flex; gap: .7rem; align-items: flex-start; margin: 0 0 .6rem; }
.spk .av {
  flex: 0 0 40px; width: 40px; height: 40px; border-radius: 50%; overflow: hidden;
  background: var(--raised); border: 1px solid var(--line);
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
.stepper-btns button:disabled:hover { border-color: var(--line-strong); transform: none; box-shadow: none; }

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
.prop-lift { color: var(--text); }
.echo {
  display: inline-block; background: var(--raised); border: 1px solid var(--line);
  border-radius: 999px; padding: .3rem .95rem; margin: 0 0 1rem;
  font-family: var(--display); font-weight: 600;
}

/* The soft offer (#42): the plan's one ask — perks, an honest timeline, the close that is the
   free meal. A LINK for the ×, because it changes nothing. */
.offer { position: relative; padding-top: .5rem; }
.offer .x {
  position: absolute; top: 0; right: 0; width: 44px; height: 44px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center; text-decoration: none;
  color: var(--muted); background: var(--raised); border: 1px solid var(--line); font-size: 1.15rem;
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
.rowline { display: flex; justify-content: space-between; gap: 1rem; padding: .65rem 0; border-top: 1px solid var(--line); }
.rowline:first-child { border-top: 0; }

/* The plan page (#51). A small label over a figure, the declared marker caps in a row beside it,
   and the arithmetic as labelled rows — the phone's calc card, drawn the web's way. */
.lab {
  font-size: .75rem; font-weight: 700; letter-spacing: .08em; text-transform: uppercase;
  color: var(--dim); margin: 0 0 .4rem;
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

export function shell(title: string, body: string, lang: Lang): string {
  return `<!doctype html>
<!-- \`lang\` is not decoration: it is what a screen reader picks a voice from and what a browser
     offers to translate. A German page declaring itself English is read aloud in an English
     accent, which is worse than an untranslated page and is invisible to everyone who can see. -->
<html lang="${escape(lang)}"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${escape(title)}</title>
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
  opts: { cookies?: readonly string[] } = {},
): Response {
  const res = new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy":
        `default-src 'none'; style-src 'unsafe-inline'; script-src 'sha256-${TYPING_SCRIPT_HASH}'; ` +
        // `https://t.me` because Connect Telegram's POST answers with a redirect there, and a form's
        // redirect is held to this directive as well.
        "img-src 'self' data:; font-src 'self'; form-action 'self' https://t.me",
      "referrer-policy": "no-referrer",
      "x-frame-options": "DENY",
      // A sign-up in progress is per-person and per-session. Nothing here may sit in a shared cache.
      "cache-control": "no-store",
    },
  });
  for (const cookie of opts.cookies ?? []) res.headers.append("set-cookie", cookie);
  return res;
}

const spud = (lang: Lang): string => `<div class="spud" role="img" aria-label="${escape(pageCopyFor(lang).spudAlt)}">${spudSvg("wave", "spud-start")}</div>`;

const bubbles = (lines: readonly string[]): string =>
  lines.map((line) => `<p class="bubble typed">${escape(line)}</p>`).join("");

/** A question's lines, the last — the question itself — as the page's one h1 (#53). */
const askBubbles = (lines: readonly string[]): string =>
  lines.map((line, i) => i === lines.length - 1
    ? `<h1 class="bubble typed">${escape(line)}</h1>`
    : `<p class="bubble typed">${escape(line)}</p>`).join("");

/** The design's slim top bar: the wordmark, and the reassurance that the phone can take over. */
const topBar = (PAGE_COPY: PageCopy): string =>
  `<div class="wbar"><strong>eait</strong><small>${escape(PAGE_COPY.topBarNote)}</small></div>`;

export interface SignInButton { href: string; label: string }

/**
 * The front door. ONE BUTTON PER CONFIGURED PROVIDER, in the order the caller gives them.
 *
 * The FIRST is the primary one, which is how the app's sign-in screen reads too: Apple, then
 * Google. That ordering is not house style — the one that asks for the least should not be the
 * button that looks like the afterthought.
 */
export function frontDoor(
  welcome: readonly string[], buttons: readonly SignInButton[], error: string | null,
  lang: Lang,
): string {
  const PAGE_COPY = pageCopyFor(lang);
  return shell(PAGE_COPY.titleStart, `
${spud(lang)}
<h1>eait</h1>
${error ? `<p class="notice">${escape(error)}</p>` : ""}
${bubbles(welcome)}
<p class="muted">${escape(PAGE_COPY.frontDoorLead)}</p>
${buttons.map((b, i) =>
  `<a class="button${i === 0 ? " primary" : ""}" href="${escape(b.href)}">${escape(b.label)}</a>`,
).join("\n")}
<h2>${escape(PAGE_COPY.pairHeading)}</h2>
<p class="muted">${escape(PAGE_COPY.pairLead)}</p>
<form method="post" action="/start/pair">
  <input type="text" name="code" autocomplete="off" autocapitalize="characters" spellcheck="false"
    maxlength="16" placeholder="${escape(PAGE_COPY.pairLabel)}"
    aria-label="${escape(PAGE_COPY.pairLabel)}">
  <button type="submit">${escape(PAGE_COPY.pairButton)}</button>
</form>
`, lang);
}

export interface QuestionOption { value: string; label: string; hint?: string }

export interface QuestionView {
  promptId: string;
  kind: "choice" | "number" | "chips";
  lines: readonly string[];
  options: readonly QuestionOption[];
  placeholder: string | null;
  /** The server's own refusal, rendered rather than re-implemented. */
  error: string | null;
  /**
   * Extra submit buttons above the normal control — the app's quick replies, which is what they
   * are: "Switch to losing" when the target runs the wrong way, "That's my real age" when the year
   * says under sixteen. A refusal whose words offer a way out has to carry the way out.
   */
  actions: readonly { name: string; value: string; label: string }[];
  /**
   * Spud's line back on the PREVIOUS answer (#42) — `reactionTo`, said above this ask with the
   * mood's own face. Null on the first question, where there is nothing to react to.
   */
  reaction?: { line: string; mood: MascotMood } | null;
  /**
   * The target stepper: the value the card shows and the healthy range it stays inside. Set, it
   * REPLACES the number box — the −/+ submits carry the shown `answer` back with a direction, and
   * only the primary button commits it. Absent at the floor, where there is nothing to suggest.
   */
  stepper?: { value: number; min: number; max: number } | null;
  /** Where the form posts — `/start/q` for a profile question; the struggles screen is a route. */
  action?: string;
  /** The primary button's word — `continueLabel` unless a prompt carries its own ("Done"). */
  submitLabel?: string;
  step?: number;
  total?: number;
  /** Where Back goes (#53): the question before this one, or the welcome from the first. */
  back?: string;
  /** The answer already on the profile, when an answered question is shown again to change. */
  current?: readonly string[];
  /** Which language to render in. On the VIEW, because every string on the page reads it. */
  lang: Lang;
}

export function question(v: QuestionView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const hidden = `<input type="hidden" name="prompt" value="${escape(v.promptId)}">`;
  const chosen = new Set(v.current ?? []);
  const submit = v.submitLabel ?? PAGE_COPY.continueLabel;
  let controls: string;
  if (v.stepper) {
    // The − and + ARE the answer field here: each posts the shown number back with a direction and
    // the server replies with the page, stepped. `disabled` at the bounds — and the server clamps
    // anyway, because a button is a suggestion and a POST is a fact.
    const st = chatCopyFor(v.lang).stepper;
    const { value, min, max } = v.stepper;
    controls =
      `<div class="card stepper"><div>` +
      `<div class="lab">${escape(PAGE_COPY.stepperSuggested)}</div>` +
      `<p class="figure"><input class="stepper-num" type="number" name="answer" inputmode="decimal"` +
      ` step="any" required value="${value}"` +
      ` aria-label="${escape(PAGE_COPY.stepperSuggested)}"> ` +
      `${escape(spellUnit(v.lang, "kg"))}</p></div>` +
      `<div class="stepper-btns">` +
      `<button type="submit" name="step" value="-1" aria-label="${escape(st.less)}"${value <= min ? " disabled" : ""}>−</button>` +
      `<button type="submit" name="step" value="1" aria-label="${escape(st.more)}"${value >= max ? " disabled" : ""}>+</button>` +
      `</div></div>` +
      `<button class="primary" type="submit">${escape(st.continue)}</button>`;
  } else if (v.kind === "choice") {
    // One button per option: with no JavaScript, a radio group needs a second tap on a submit
    // button, and the app's version is one tap.
    controls = v.options.map((o) =>
      `<button type="submit" name="answer" value="${escape(o.value)}"` +
      `${chosen.has(o.value) ? ` class="sel" aria-pressed="true"` : ""}>${escape(o.label)}` +
      `${o.hint ? `<span class="hint">${escape(o.hint)}</span>` : ""}</button>`).join("");
  } else if (v.kind === "number") {
    // A visible label (#53), and the refusal UNDER the field it is about, tied to it — never above
    // Spud's reaction, where it read as his.
    controls =
      `${v.placeholder ? `<label class="lab" for="answer">${escape(v.placeholder)}</label>` : ""}` +
      `<input id="answer" type="number" name="answer" inputmode="decimal" step="any" required autofocus` +
      `${v.current?.[0] !== undefined ? ` value="${escape(v.current[0])}"` : ""}` +
      `${v.error ? ` aria-invalid="true" aria-describedby="answer-error"` : ""}` +
      `${v.placeholder ? ` placeholder="${escape(v.placeholder)}"` : ""}>` +
      `${v.error ? `<p class="notice field-error" id="answer-error">${escape(v.error)}</p>` : ""}` +
      `<button class="primary" type="submit">${escape(submit)}</button>`;
  } else {
    controls = v.options.map((o) =>
      `<label class="check"><input type="checkbox" name="answer" value="${escape(o.value)}"` +
      `${chosen.has(o.value) ? " checked" : ""}> ` +
      `${escape(o.label)}</label>`).join("") +
      `<button class="primary" type="submit">${escape(submit)}</button>`;
  }
  const actions = v.actions.map((a) =>
    `<button type="submit" name="${escape(a.name)}" value="${escape(a.value)}">${escape(a.label)}</button>`,
  ).join("");
  const reaction = v.reaction
    ? `<div class="spk"><span class="av">${spudSvg(v.reaction.mood, "spud-react")}</span>` +
      `<p class="bubble typed">${escape(v.reaction.line)}</p></div>`
    : "";
  // The BRAND, untranslated — the same reason `LANG_LABEL` is not. A question page in the
  // middle of a flow is titled by the product, not by a sentence about it.
  return shell("eait", `
${topBar(PAGE_COPY)}
${v.back ? `<a class="back" href="${escape(v.back)}">${escape(PAGE_COPY.back)}</a>` : ""}
${v.step !== undefined && v.total !== undefined
  ? `<p class="progress">${escape(PAGE_COPY.progress
    .replace("{step}", String(v.step)).replace("{total}", String(v.total)))}</p>`
  : ""}
${v.error && (v.kind !== "number" || v.stepper) ? `<p class="notice">${escape(v.error)}</p>` : ""}
${reaction}
${askBubbles(v.lines)}
<form method="post" action="${escape(v.action ?? "/start/q")}">${hidden}${actions}${controls}</form>
`, v.lang);
}

/**
 * A support moment (#42): the full-screen beat after one of the four answers that earns one.
 * Words and pose are `supportMoment`'s — this is only the drawing: the halo, the prop that names
 * the pose, the answer echoed back, the title, the body and the one button.
 */
export interface MomentView {
  id: MomentId;
  pose: MomentPose;
  echo: string;
  title: string;
  body: string;
  cta: string;
  /** Where the one button goes — the next question, the struggles ask, or the plan. */
  next: string;
  /** Back (#53): the answer this moment reacts to, shown again to change. */
  back?: string;
  lang: Lang;
}

/** Which face goes with each pose — the pose's PROP is drawn beside him by `poseProp`. */
const POSE_MOOD: Record<MomentPose, MascotMood> = {
  cheer: "joy", lift: "happy", think: "think", heart: "care",
};

/**
 * The pose's prop, one small inline SVG at his side. `MascotMood` has no cheer/lift/heart — the
 * faces it knows do not stretch that far — so the moment carries a thing instead: sparkles for
 * the celebration, a dumbbell for the encouragement, a thought bubble, a heart.
 */
const poseProp = (pose: MomentPose): string => {
  switch (pose) {
    case "cheer":
      return `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3l2.2 6.4 6.4 2.2-6.4 2.2L16 20.2l-2.2-6.4-6.4-2.2 6.4-2.2z"/><path fill="currentColor" d="M25.5 18l1.2 3.4 3.4 1.2-3.4 1.2-1.2 3.4-1.2-3.4-3.4-1.2 3.4-1.2z"/></svg>`;
    case "lift":
      return `<svg viewBox="0 0 32 20" aria-hidden="true"><rect fill="currentColor" x="9" y="8" width="14" height="4" rx="2"/><rect fill="currentColor" x="3" y="4" width="4" height="12" rx="1.5"/><rect fill="currentColor" x="25" y="4" width="4" height="12" rx="1.5"/><rect fill="currentColor" x="7" y="6" width="2.6" height="8" rx="1"/><rect fill="currentColor" x="22.4" y="6" width="2.6" height="8" rx="1"/></svg>`;
    case "think":
      return `<svg viewBox="0 0 32 26" aria-hidden="true"><path fill="var(--panel)" stroke="currentColor" stroke-width="1.8" d="M10.5 4a6.5 6.5 0 0 1 10.8 2.3A5.5 5.5 0 0 1 27 10.5a5 5 0 0 1-4.5 5H9a4.5 4.5 0 0 1 1.5-11.5z"/><circle fill="currentColor" cx="8" cy="20.5" r="2"/><circle fill="currentColor" cx="4" cy="24" r="1.2"/></svg>`;
    case "heart":
      return `<svg viewBox="0 0 24 22" aria-hidden="true"><path fill="currentColor" d="M12 20C12 20 2 13.8 2 7.6 2 4.6 4.4 2.5 7.3 2.5c1.8 0 3.6 1 4.7 2.4 1.1-1.4 2.9-2.4 4.7-2.4 2.9 0 5.3 2.1 5.3 5.1C22 13.8 12 20 12 20z"/></svg>`;
  }
};

export function moment(v: MomentView): string {
  // A GET form, not a link: the button is what a browser-onboarding walk presses to move on, and
  // `method=get` on an empty form IS plain navigation. The hidden prompt names the beat in the
  // same shape the question pages carry, so a driver can tell this screen from a question.
  return shell(v.title, `
${topBar(pageCopyFor(v.lang))}
${v.back ? `<a class="back" href="${escape(v.back)}">${escape(pageCopyFor(v.lang).back)}</a>` : ""}
<div class="moment">
  <div class="halo">${spudSvg(POSE_MOOD[v.pose], "spud-moment")}<span class="prop prop-${escape(v.pose)}">${poseProp(v.pose)}</span></div>
  <p class="echo">${escape(v.echo)}</p>
  <h1>${escape(v.title)}</h1>
  <p class="muted">${escape(v.body)}</p>
</div>
<input type="hidden" name="prompt" value="moment_${escape(v.id)}">
<form method="get" action="${escape(v.next)}"><button class="primary" type="submit">${escape(v.cta)}</button></form>
`, v.lang);
}

/**
 * The soft offer (#42): the plan's one ask, with the honest timeline and a close that keeps the
 * welcome's promise — nothing to pay until the plan and the first verdict, and the × is the meal.
 * `headline` is the shared `offerHeadline`'s (the computed target by the computed month) or the
 * page's own fallback when a goal carries no target to name.
 */
export interface OfferView {
  headline: string;
  /** `/start/checkout`, which fills `{userId}` from the session — never a client. */
  checkoutUrl: string;
  /** The published privacy policy, or null where no landing is configured to publish one. */
  privacyHref: string | null;
  /** Where × goes — the web app's first meal, or this surface's own chat when there is none. */
  closeHref: string;
  lang: Lang;
}

const TICK = `<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.6l3.4 3.4L13 5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

export function offer(v: OfferView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const row = (what: string, detail: string): string =>
    `<div class="rowline"><strong>${escape(what)}</strong><span class="muted">${escape(detail)}</span></div>`;
  const perk = (p: string): string =>
    `<p class="perk"><span class="tick">${TICK}</span>${escape(p)}</p>`;
  return shell(PAGE_COPY.titleOffer, `
${topBar(PAGE_COPY)}
<div class="offer">
<a class="x" href="${escape(v.closeHref)}" aria-label="${escape(PAGE_COPY.offerClose)}">×</a>
<div class="offer-hero">${spudSvg("joy", "spud-offer")}</div>
<p class="beat">${escape(PAGE_COPY.offerBeat)}</p>
<h1>${escape(v.headline)}</h1>
${[PAGE_COPY.offerPerkVerdict, PAGE_COPY.offerPerkPlan, PAGE_COPY.offerPerkSpud].map(perk).join("\n")}
<div class="card">
${row(PAGE_COPY.offerWhenToday, PAGE_COPY.offerFreeWeek)}
${row(PAGE_COPY.offerWhenEnding, PAGE_COPY.offerReminder)}
${row(PAGE_COPY.offerWhenDay8, PAGE_COPY.offerMonthly)}
</div>
<div class="card">
${row(PAGE_COPY.offerPlanMonthly, PAGE_COPY.offerPlanMonthlyUnit)}
${row(PAGE_COPY.offerPlanLifetime, PAGE_COPY.offerPlanLifetimeUnit)}
</div>
<a class="button primary" href="${escape(v.checkoutUrl)}">${escape(PAGE_COPY.offerCta)}</a>
${v.privacyHref === null ? "" : `<p class="muted fine"><a href="${escape(v.privacyHref)}">${escape(PAGE_COPY.offerPrivacy)}</a></p>`}
</div>
`, v.lang);
}

/**
 * The end of the road, and the only page here with nothing to press.
 *
 * Its one caller is the under-sixteen stop, whose words promise that nothing was kept — so the
 * account is deleted before this renders. A page that said it while a row survived would be the
 * worst sentence on this surface.
 */
export function stopped(
  title: string, body: string, lines: readonly string[], lang: Lang,
): string {
  return shell(title, `
${spud(lang)}
<h1>${escape(title)}</h1>
<p class="muted">${escape(body)}</p>
${bubbles(lines)}
`, lang);
}

/** A meal card in the thread: the meal as it is NOW, or null once it is gone. */
export interface ChatCard {
  title: string;
  kcal: number;
  proteinG: number;
  verdicts: readonly string[];
}

export type ChatLine =
  | { kind: "user"; text: string | null; photo?: boolean }
  /** `who` names the speaker when there is more than one; null is the app's own voice. */
  | { kind: "said"; who: string | null; text: string }
  | { kind: "card"; card: ChatCard | null };

/** A proposal, held server-side and offered until it is confirmed, cancelled or expires. */
export interface ChatProposal {
  pendingId: string;
  title: string;
  kcal: number;
  proteinG: number;
}

export interface ChatView {
  lines: readonly ChatLine[];
  /** The page's own words about a refusal or a stale proposal. Never the model's. */
  notice: string | null;
  proposal: ChatProposal | null;
  lang: Lang;
}

/**
 * The thread, oldest first — the app's conversation, in a browser.
 *
 * Rendered from what the SERVER stored and nothing else: a card is the meal as it is now, so a
 * verdict here never outlives the numbers it describes, and no sentence on this page is written by
 * the client. Same rule as the app's own thread.
 */
export function chat(v: ChatView): string {
  const lang = v.lang;
  const PAGE_COPY = pageCopyFor(lang);
  return shell(PAGE_COPY.titleChat, `
<h1>${escape(PAGE_COPY.chatHeading)}</h1>
${v.notice ? `<p class="notice">${escape(v.notice)}</p>` : ""}
${v.lines.length === 0
  ? `<p class="muted">${escape(PAGE_COPY.chatEmpty)}</p>`
  : v.lines.map((line) => chatLine(line, PAGE_COPY, lang)).join("\n")}
${v.proposal ? proposalCard(v.proposal, PAGE_COPY, lang) : ""}
<form method="post" action="/start/chat/say">
  <input type="text" name="text" autocomplete="off" maxlength="${MAX_USER_LINE}"
    placeholder="${escape(PAGE_COPY.chatPlaceholder)}" aria-label="${escape(PAGE_COPY.chatPlaceholder)}">
  <button class="primary" type="submit">${escape(PAGE_COPY.chatSend)}</button>
</form>
<h2>${escape(PAGE_COPY.chatPhotoLead)}</h2>
<form method="post" action="/start/chat/photo" enctype="multipart/form-data">
  <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" multiple
    aria-label="${escape(PAGE_COPY.chatPhotoLead)}">
  <input type="text" name="caption" autocomplete="off" maxlength="${MAX_USER_LINE}"
    placeholder="${escape(PAGE_COPY.chatCaption)}" aria-label="${escape(PAGE_COPY.chatCaption)}">
  <button type="submit">${escape(PAGE_COPY.chatPhotoSend)}</button>
</form>
`, v.lang);
}

/**
 * A proposal is CONFIRM-FIRST, here as in the app: a meal nobody photographed is one we inferred,
 * and it is not written until the person says so. Two forms rather than one with two buttons, so
 * each posts to the route that names what it does.
 */
/**
 * A card's figures, in the reader's language — the same treatment `plan()` gives the plan's own.
 *
 * Raw interpolation is what this replaces: `${p.kcal} kcal` put an English unit and an ungrouped
 * four-digit number under a plan page that had already said `Порог — 1 500 ккал.`
 */
function macros(kcal: number, proteinG: number, PAGE_COPY: PageCopy, lang: Lang): string {
  const n = wholeNumbers(lang);
  return PAGE_COPY.cardMacros
    .replace("{kcal}", n(kcal)).replace("{unit}", UNIT_KCAL[lang]).replace("{protein}", n(proteinG));
}

function proposalCard(p: ChatProposal, PAGE_COPY: PageCopy, lang: Lang): string {
  const id = `<input type="hidden" name="pendingId" value="${escape(p.pendingId)}">`;
  return `<div class="card">
  <p class="muted">${escape(PAGE_COPY.chatProposalLead)}</p>
  <p><strong>${escape(p.title)}</strong></p>
  <p class="muted">${escape(macros(p.kcal, p.proteinG, PAGE_COPY, lang))}</p>
  <form method="post" action="/start/chat/confirm">${id}<button class="primary" type="submit">${escape(PAGE_COPY.chatConfirm)}</button></form>
  <form method="post" action="/start/chat/cancel">${id}<button type="submit">${escape(PAGE_COPY.chatCancel)}</button></form>
</div>`;
}

function chatLine(line: ChatLine, PAGE_COPY: PageCopy, lang: Lang): string {
  if (line.kind === "user") {
    const text = line.text ?? "";
    return `<p class="bubble you">${line.photo ? "\u{1F4F7} " : ""}${escape(text)}</p>`;
  }
  if (line.kind === "said") {
    return `${line.who ? `<p class="who">${escape(line.who)}</p>` : ""}<p class="bubble">${escape(line.text)}</p>`;
  }
  if (line.card === null) return `<p class="bubble muted">${escape(PAGE_COPY.chatMealGone)}</p>`;
  const c = line.card;
  return `<div class="card">
  <p><strong>${escape(c.title)}</strong></p>
  <p class="muted">${escape(macros(c.kcal, c.proteinG, PAGE_COPY, lang))}</p>
  ${c.verdicts.map((w) => `<span class="pill">${escape(w)}</span>`).join("")}
</div>`;
}

export interface PlanView {
  /** Which provider signed this account in, so the app instruction can name that button. */
  signedInWith: "apple" | "google" | null;
  /**
   * Spud's beat at the top — the restrictions reply the chat computes for this profile
   * (`reactionTo`), with its mood. The page invents no sentence of its own here.
   */
  beat: { line: string; mood: MascotMood } | null;
  /** The goal card's figure. A goal that carries no target — maintain — draws no card. */
  targetKg: number | null;
  /**
   * The by-when line, already filled — `projectionLine` over the content's
   * `summary.projection`/`projectionFar`, or null wherever `projectGoal` declined a number. Null
   * is "no date", never a hole.
   */
  byWhen: string | null;
  /** `projectGoal`'s week count, under the by-when. */
  weeks: number | null;
  kcal: number;
  proteinG: number;
  /**
   * The marker caps, present ONLY for the restrictions the profile declared — the same fields on
   * `targets` that `verdictsFromTargets` reads, so the figure on this page is the figure a meal is
   * judged against.
   */
  satfatG?: number | undefined;
  sodiumMg?: number | undefined;
  /** The row labels — `content.building`'s and `summary.proteinLabel`, the phone's own words. */
  labels: { rest: string; activity: string; pace: string; floor: string; protein: string };
  bmr: number | null;
  tdee: number | null;
  /** `appliedDeltaKcal` — the pace as it was actually applied, after both guards. */
  paceKcal: number;
  floorApplied: boolean;
  floorKcal: number;
  /**
   * Whether a checkout is configured — the ask is rendered, not the URL: it leads to the soft
   * offer (`/start/offer`), which is where the configured checkout link now lives (#42).
   */
  checkout: boolean;
  /**
   * Whether there is a web application to hand over to.
   *
   * It decides two things. The primary button: "/" opens the first-meal flow there, and `/start`'s
   * own chat is the nearest thing when there is none. And the language picker: with an app, the
   * language lives in ITS settings and the picker is not drawn; without one this page is the only
   * place to change it, so it stays.
   */
  hasWebApp: boolean;
  /** Whether the Telegram connector is on, so Connect Telegram has a bot to send anybody to. */
  telegram: boolean;
  lang: Lang;
}

export function plan(v: PlanView): string {
  const lang = v.lang;
  const PAGE_COPY = pageCopyFor(lang);
  // The FIGURES are grouped the reader's way — "1.800", not "1,800", for half of Europe — and the
  // sentences around them are the table's. A weight keeps its tenth; kcal, grams and weeks do not.
  const n = wholeNumbers(lang);
  const kg = spellUnit(lang, "kg");
  const g = spellUnit(lang, "g");

  // The marker row: protein always, then ONLY what the profile declared — a cap nobody asked for
  // is a verdict nobody asked for. The noun is the verdict's own (`verdictNoun`), so the cap and
  // the pill that judges it cannot spell the nutrient two ways.
  const markers: { label: string; text: string }[] = [
    { label: v.labels.protein, text: `${n(v.proteinG)} ${g}` },
  ];
  if (v.satfatG !== undefined)
    markers.push({ label: verdictNoun("ldl", lang), text: `${n(v.satfatG)} ${g}` });
  if (v.sodiumMg !== undefined)
    markers.push({ label: verdictNoun("kidneys", lang), text: `${n(v.sodiumMg)} ${spellUnit(lang, "mg")}` });

  // The arithmetic — every figure is `explainTargets`' own, handed in by the route: the body at
  // rest, what the days add on top of it, the pace as it was actually APPLIED (capped, floored —
  // never the one that was asked for), and the floor itself, drawn even when it did not bite
  // because it holds either way.
  const arithmetic: { label: string; text: string }[] = [];
  if (v.bmr !== null) arithmetic.push({ label: v.labels.rest, text: n(v.bmr) });
  if (v.bmr !== null && v.tdee !== null)
    arithmetic.push({ label: v.labels.activity, text: `+${n(v.tdee - v.bmr)}` });
  arithmetic.push({
    label: v.labels.pace,
    // A minus sign, not a hyphen, and a dash for no change — the phone's calc card reads the same.
    text: v.paceKcal === 0 ? "—" : `${v.paceKcal < 0 ? "−" : "+"}${n(Math.abs(v.paceKcal))}`,
  });
  arithmetic.push({ label: v.labels.floor, text: n(v.floorKcal) });

  return shell(PAGE_COPY.titlePlan, `
${topBar(PAGE_COPY)}
${v.beat === null ? "" : `<div class="spk"><span class="av">${spudSvg(v.beat.mood, "spud-plan")}</span><p class="bubble typed">${escape(v.beat.line)}</p></div>`}
<h1>${escape(PAGE_COPY.planHeading)}</h1>
${v.targetKg === null ? "" : `<div class="card">
  <p class="figure">${escape(numbers(lang)(v.targetKg))} ${escape(kg)}</p>
  ${v.byWhen === null ? "" : `<p class="muted">${escape(v.byWhen)}</p>`}
  ${v.weeks === null ? "" : `<p class="lab">${escape(PAGE_COPY.planWeeks.replace("{weeks}", n(v.weeks)))}</p>`}
</div>`}
<div class="card">
  <p class="lab">${escape(PAGE_COPY.planEachDay)}</p>
  <p class="figure">${escape(n(v.kcal))} ${escape(UNIT_KCAL[lang])}</p>
  <div class="specs">${markers.map((m) =>
    `<div><p class="lab">${escape(m.label)}</p><p class="val">${escape(m.text)}</p></div>`,
  ).join("")}</div>
  <div class="arith">${arithmetic.map((r) =>
    `<div class="rowline"><span>${escape(r.label)}</span><strong>${escape(r.text)}</strong></div>`,
  ).join("")}</div>
</div>
${v.floorApplied
  ? `<p class="notice care">${escape(PAGE_COPY.planFloor)} ${escape(PAGE_COPY.planFloorNumber.replace("{floor}", n(v.floorKcal)))}</p>`
  : ""}
<a class="button primary" href="${v.hasWebApp ? "/" : "/start/chat"}">${escape(PAGE_COPY.planFirstMeal)}</a>
${v.checkout
  ? `<a class="button primary" href="/start/offer">${escape(PAGE_COPY.planCheckout)}</a>`
  : ""}
<a class="button" href="${v.hasWebApp ? "/#/chat" : "/start/chat"}">${escape(PAGE_COPY.planChat)}</a>
${v.telegram
  ? `<p class="muted">${escape(PAGE_COPY.planTelegramBody)}</p>
<form method="post" action="/start/telegram"><button class="button">${escape(PAGE_COPY.planTelegram)}</button></form>`
  : ""}
<h2>${escape(PAGE_COPY.planAppHeading)}</h2>
<p class="muted">${escape(v.signedInWith === null
  ? PAGE_COPY.planAppBodyGeneric
  : PAGE_COPY.planAppBody.replace("{provider}", v.signedInWith === "apple" ? "Apple" : "Google"))}</p>
${v.hasWebApp ? "" : languagePicker(v.lang)}
`, v.lang);
}

/**
 * THE PICKER, and this page is where it lives on this surface.
 *
 * The plan page is `/start`'s settings: it is the one page somebody comes back to, and the only one
 * with anything else to change on it. It writes through `PATCH /v1/profile` like every other
 * surface — `POST /start/language` is a form handler that calls `patchProfile`, not a second
 * endpoint and not a second source of truth. There is no JavaScript on these pages, so a submit
 * button is the control; a `<select>` that saved on change would need one.
 *
 * ONLY `LANGS_READY` IS OFFERED. A language the app cannot render end to end is one whose every
 * screen would be English, and choosing it looks like a bug rather than like a missing translation.
 *
 * The OPTION LABELS are `LANG_LABEL` — each language's name in itself, never translated, because a
 * list of languages written in the one you are trying to leave is the one list you cannot read.
 */
function languagePicker(lang: Lang): string {
  const PAGE_COPY = pageCopyFor(lang);
  const options = LANGS_READY.map((code) =>
    `<option value="${escape(code)}"${code === lang ? " selected" : ""}>${escape(LANG_LABEL[code])}</option>`,
  ).join("");
  return `<h2>${escape(PAGE_COPY.languageLabel)}</h2>
<form method="post" action="/start/language">
  <select name="lang" aria-label="${escape(PAGE_COPY.languageLabel)}">${options}</select>
  <button type="submit">${escape(PAGE_COPY.languageSave)}</button>
</form>`;
}
