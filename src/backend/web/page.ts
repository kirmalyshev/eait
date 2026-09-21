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
import { STYLESHEET } from "@eait/shared/design";
import { spudSvg, type MascotMood } from "@eait/shared/mascot";

/**
 * A figure, as the number grammar sets one: mono, tabular, and a thousands gap that is a SPAN.
 *
 * The web application does this in `monoInto`; this is the same rule for the surface that has no
 * JavaScript. A group separator that is a space character renders as a full mono advance, which is
 * the hole the design names — so every kind of space this formatter can emit becomes the 0.24em
 * span instead. A comma or a dot separator is a glyph and is left where the reader expects it.
 */
export function figure(text: string): string {
  return `<span class="mono">${text.split(/[\u202f\u00a0\u2009 ]/).map(escape).join('<i class="ts"></i>')}</span>`;
}

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
import { LANGS_READY, LANG_LABEL, UNIT_KCAL, wholeNumbers, type Lang } from "@eait/shared";

export { PAGE_COPY, PAGE_COPY_BY_LANG, pageCopyFor, type PageCopy } from "./copy.ts";

/** Where the typeface is served from, on this origin, so the CSP needs `font-src 'self'` and no more. */
export const FONT_PATH = "/start/assets/space-grotesk-latin.woff2";

/**
 * `/start` IS THE PRODUCT, so it is painted in the product's design system.
 *
 * It used to carry the LANDING's palette — light, warm, Space Grotesk on the headings — on the
 * argument that this surface and the marketing page are one thing to whoever is looking at them.
 * That was true while the app was the only place the system lived. It is not any more: this flow
 * is where somebody answers eight questions and is handed a plan, and then walks straight into a
 * client drawn from `shared/design.ts`. Meeting a cream questionnaire and then a dark product is
 * the drift the system exists to stop. The landing keeps `palette.ts`; everything from the front
 * door inwards is one register.
 *
 * DARK ONLY, and the `data-theme` hook goes with the second palette. A light theme is not a
 * lighter version of these values.
 *
 * The block below is what this surface has and the client does not — a flow with no JavaScript,
 * so an option is a submit button rather than a node with a listener, and the shapes have to be
 * reached by element selector. Every value in it is a token.
 */
const STYLES = `
${STYLESHEET}

/* ── This flow's own shapes, mapped onto the system ─────────────────────────── */
main { max-width: 30rem; margin: 0 auto; padding: 24px 20px 64px; }
.spud { width: 56px; height: 56px; display: block; margin: 0 0 14px; }
h1 { text-wrap: balance; }

/* ── The progress bar ────────────────────────────────────────────────────────
   A 10px pill with the accent in it, which is the board's. It was a 5px hairline, and a bar that
   thin under a question reads as a loading indicator rather than as how far in you are. */
.prog { height: 10px; border-radius: 999px; background: var(--raised); overflow: hidden;
  margin: 0 0 22px; }
.prog > i { display: block; height: 100%; background: var(--green); border-radius: 999px; }

/* ── Spud, saying it ─────────────────────────────────────────────────────────
   He sits BESIDE the line rather than above the screen: the words are his reply to the answer
   just given, and a face in the corner of the page is decoration while a face at the start of the
   sentence is the speaker. */
.says { display: flex; align-items: flex-start; gap: 11px; margin: 0 0 14px; }
.says .spud { width: 44px; height: 44px; flex: 0 0 44px; margin: 0; }
.says .saysb { flex: 1 1 auto; min-width: 0; }
.says .bubble:last-child { margin-bottom: 0; }

/* THE ANIMATION IS CSS BECAUSE IT HAS TO BE: this page allows exactly one script, by hash, and it
   is the typing. Under prefers-reduced-motion none of this exists — the block is opt-in, not a
   set of rules with an override bolted on after. */
@media (prefers-reduced-motion: no-preference) {
  /* He ARRIVES: a small overshoot as the page paints, then a slow breath so the screen is not
     dead while somebody reads. The bob is on the svg and the arrival on the box, so the two
     transforms never fight over one element. */
  .says .spud { animation: spud-in 460ms cubic-bezier(.2, 1.5, .4, 1) both; }
  .says .spud > svg { animation: spud-bob 3.6s ease-in-out 460ms infinite alternate; }
  /* Blinking, on the app's own 4.2s timer (mascot.tsx) — the eyes are grouped in the drawing
     precisely so a stylesheet can do this. */
  .says .spud .spud-eyes { animation: spud-blink 4.2s steps(1, end) 900ms infinite;
    transform-origin: 59px 57px; }
  /* Refused: he does not bounce in when the words beside him say something went wrong. */
  .says.mood-care .spud { animation: spud-shake 520ms ease-in-out both; }
  .says .saysb { animation: says-in 380ms ease-out 120ms both; }
}
@keyframes spud-in { from { opacity: 0; transform: scale(.78) translateY(6px); }
  to { opacity: 1; transform: none; } }
@keyframes spud-bob { from { transform: translateY(0); } to { transform: translateY(-3px); } }
@keyframes spud-blink { 0%, 94% { transform: scaleY(1); } 96%, 98% { transform: scaleY(.08); }
  100% { transform: scaleY(1); } }
@keyframes spud-shake { 0%, 100% { transform: none; } 20% { transform: translateX(-4px); }
  45% { transform: translateX(3px); } 70% { transform: translateX(-2px); } }
@keyframes says-in { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: none; } }

/* Spud's line, and the person's. The same two shapes the thread uses; here they are paragraphs
   rather than list items, because this page has no thread to put them in. */
.bubble {
  background: var(--surface); border-radius: 18px; border-bottom-left-radius: 7px;
  padding: 11px 15px; margin: 0 0 8px; max-width: 30rem;
}
/* YOUR OWN LINE IS THE DEEP TONE, NOT THE BRIGHT ONE. Ten answered questions is ten bubbles, and
   ten fills of the brightest colour in the register is a column of them down the screen. The deep
   tone says "this one was yours" and leaves the bright accent to the things there is one of: the
   button, an edge, a tick. */
.bubble.you {
  background: var(--green-deep); color: var(--t1); font-weight: 600;
  border-bottom-left-radius: 18px; border-bottom-right-radius: 7px;
  margin-left: auto; max-width: 85%;
}
.who { font-size: 12px; font-weight: 700; color: var(--t4); margin: 0 0 4px 4px; }
/* The part of a line not yet typed: laid out, read by a screen reader, not yet seen. */
.untyped { color: transparent; }

/* AN OPTION IS A SUBMIT BUTTON on this surface, so the design's option row is reached by element
   rather than by class. A border and a tint and never a solid bright fill — three deep in a
   column a filled row makes every option that was not chosen read as disabled. */
form { margin: 0; }
button, .button, label.check {
  display: flex; align-items: center; gap: 12px; width: 100%; text-align: left; cursor: pointer;
  font: inherit; font-weight: 700; font-size: 16px; letter-spacing: -.01em;
  color: var(--t1); background: var(--surface);
  border: 1.5px solid var(--surface); border-radius: 16px;
  padding: 16px; margin: 0 0 10px; text-decoration: none;
}
button:hover, .button:hover, label.check:hover { border-color: var(--raised); }
button .hint { display: block; font-weight: 400; font-size: 13px; color: var(--t3); margin-top: 4px; }

/* ── The option row ──────────────────────────────────────────────────────────
   The board's: a glyph where the option has one, the answer with the line that justifies it, and
   the box you are pressing. 62px, a 2px edge, and the accent as that edge the moment it is the
   one under the finger. */
button.row, label.row {
  align-items: center; gap: 12px; min-height: 62px; padding: 9px 12px;
  border: 2px solid var(--raised); border-radius: 18px;
  font-weight: 700; font-size: 15.5px; letter-spacing: -.005em;
}
button.row:hover, button.row:focus-visible, label.row:hover { border-color: var(--green); }
.row .t { flex: 1 1 auto; min-width: 0; }
.row .hint { display: block; font-weight: 400; font-size: 13px; color: var(--t3); margin-top: 2px; }
.row .ic { display: flex; align-items: center; justify-content: center; flex: 0 0 36px;
  width: 36px; height: 36px; border-radius: 50%; background: var(--sunken); color: var(--green); }
/* The box. Empty on a single-answer row, because nothing is chosen until the form posts. */
.row .sq { flex: 0 0 26px; width: 26px; height: 26px; border-radius: 8px;
  border: 2px solid var(--t4); }
/* A chip CAN say so, and this is the one control on the page that can without a script. */
label.row input[type=checkbox] { position: absolute; opacity: 0; pointer-events: none; }
label.row:has(input:checked) { background: var(--green-deep); border-color: var(--green); }
label.row:has(input:checked) .sq { background: var(--green); border-color: var(--green); }
/* A quick reply — the way out a refusal offers. Quieter than an answer to the question itself. */
button.row.alt { min-height: 52px; border-color: var(--surface); color: var(--t2); }

/* ── The number card ─────────────────────────────────────────────────────────
   The figure is the whole control, and the unit sits OUTSIDE its run: the mono's word space is a
   full advance, so "74 kg" typed into one field renders with a hole in it. */
.numcard { background: var(--surface); border: 2px solid var(--raised); border-radius: 20px;
  padding: 13px 18px 15px; margin: 0 0 10px; }
.numcard .lab { display: block; font-size: 11px; font-weight: 700; letter-spacing: .12em;
  text-transform: uppercase; color: var(--t4); margin: 0 0 4px; }
/* The unit sits against the figure, not at the far edge of the card: "74 kg" is one reading, and
   a unit pushed to the right by an empty field is a second column. */
.numcard .f { display: flex; align-items: baseline; gap: 9px; justify-content: flex-start; }
.numcard input[type=number] { flex: 0 1 auto; width: 5ch; min-width: 3ch; margin: 0; padding: 0;
  background: none; border: 0; border-radius: 0; outline: 0;
  font: 500 34px/1.1 var(--mono); font-variant-numeric: tabular-nums; color: var(--t1); }
/* The stepper is the platform's, and it lands between the figure and its unit. */
.numcard input[type=number] { appearance: textfield; -moz-appearance: textfield; }
.numcard input[type=number]::-webkit-outer-spin-button,
.numcard input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; margin: 0; }
.numcard .u { font: 700 15px/1 var(--ui); color: var(--t3); }
.numcard:focus-within { border-color: var(--green); }

/* The one call to action. A pill, and it sits on a hard edge of its own deep tone — the board's
   button has a body you can press rather than a rectangle that changes colour. */
button.primary, .button.primary {
  justify-content: center; text-align: center; min-height: 56px; border-radius: 999px;
  background: var(--green); color: var(--ink); border-color: var(--green);
  font-weight: 800; font-size: 15px; letter-spacing: .01em;
  box-shadow: 0 5px 0 var(--green-deep); margin-bottom: 15px;
}
button.primary:active, .button.primary:active {
  transform: translateY(3px); box-shadow: 0 2px 0 var(--green-deep);
}
button.primary .hint { color: inherit; opacity: .85; }
input[type=number], input[type=text] {
  width: 100%; font: inherit; color: var(--t1); background: var(--surface);
  border: 1px solid var(--raised); border-radius: 14px; padding: 15px 16px; margin: 0 0 10px;
}
input::placeholder { color: var(--t4); }
input[type=file] { display: block; width: 100%; margin: 0 0 10px; font: inherit; color: var(--t3); }
.pill {
  display: inline-block; border: 1px solid var(--raised); border-radius: 999px;
  padding: 2px 11px; margin: 6px 6px 0 0; font-size: 13px; color: var(--t3);
}
.notice { border-left: 3px solid var(--bad); padding-left: 14px; margin: 0 0 18px; color: var(--t2); }
.care { border-left-color: var(--blue); }
/* THE UNIT IS NOT PART OF THE FIGURE. The mono's word space is a full advance, so "2 446 kcal"
   set in one run has a hole in it and the unit is as loud as the number that matters. The span
   inside carries the mono; the unit sits outside it at reading size. */
.figure { margin: 0 0 .4rem; display: flex; align-items: baseline; gap: 10px; }
.figure .mono { font-size: 42px; font-weight: 800; letter-spacing: -.03em; line-height: 1; }
.figure .u { font-size: 17px; font-weight: 800; letter-spacing: -.01em; color: var(--t3); }
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
  // THE NEWEST TURN, AT THE TOP — before anything else, and before the reduced-motion return.
  // A chat form grows: by the ninth question the transcript is four screens long and the page
  // opens on the FIRST question, with the thing being asked and the buttons that answer it both
  // below the fold. Nothing else on this page can do it — there is one script and this is it.
  var latest = document.querySelector(".says");
  if (latest && latest.scrollIntoView) latest.scrollIntoView({ block: "start" });
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

const spud = `<div class="spud" role="img" aria-label="${escape(PAGE_COPY.spudAlt)}">${spudSvg("wave", "spud-start")}</div>`;

/**
 * SPUD, ON EVERY QUESTION, AND HIS MOOD IS THE ANSWER YOU JUST GAVE.
 *
 * He was on the front door and on the stop page and nowhere in between — so the eight screens
 * where somebody is handing over their body weight had nobody on them. What he is for here is
 * confidence: the line beside him already justifies the question (`answerFor` writes it from what
 * was just said), and a face that reacts to the answer is what makes that line read as a reply
 * rather than as the next field.
 *
 * THREE MOODS, AND EACH IS A FACT ABOUT THE TURN — never decoration:
 *   care  — the server refused the answer, and the words beside him say why.
 *   wave  — nothing has been asked yet. The first screen.
 *   happy — an answer landed. Every screen after the first.
 *
 * The ANIMATION is CSS, and it has to be: this page's CSP allows exactly one script by hash, and
 * it is the typing. A keyframe costs nothing and is switched off wholesale under
 * `prefers-reduced-motion`.
 */
function spudSays(mood: MascotMood, lines: readonly string[], lang: Lang): string {
  const PAGE_COPY = pageCopyFor(lang);
  return `<div class="says mood-${escape(mood)}">
<div class="spud" role="img" aria-label="${escape(PAGE_COPY.spudAlt)}">${spudSvg(mood, `spud-${mood}`)}</div>
<div class="saysb">${bubbles(lines)}</div>
</div>`;
}

const bubbles = (lines: readonly string[]): string =>
  lines.map((line) => `<p class="bubble typed">${escape(line)}</p>`).join("");

/**
 * The turns already taken. NOT `typed`: history is history, and re-typing it on every page load
 * would make answering the fourth question mean watching the first three again. The same rule the
 * chat thread already follows — `TYPING_SCRIPT` touches `.bubble.typed` alone.
 */
const said = (lines: readonly SaidLine[]): string =>
  lines.map((l) => `<p class="bubble${l.who === "you" ? " you" : ""}">${escape(l.text)}</p>`).join("");

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
${spud}
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

/** One turn already taken: what Spud asked, or what this person answered. */
export interface SaidLine { who: "spud" | "you"; text: string }

export interface QuestionView {
  promptId: string;
  kind: "choice" | "number" | "chips";
  /**
   * THE CONVERSATION SO FAR, oldest first — every question already answered and the answer given.
   *
   * Without it this flow is a form with one field on it: the page replaced the last question with
   * the next one, so nothing a person had said was ever on screen beside what they were being
   * asked now. Onboarding is ONE CHAT with Spud (`product/design/onboarding/`), and a chat you
   * cannot scroll back through is a questionnaire wearing a bubble.
   */
  history: readonly SaidLine[];
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
  step: number;
  total: number;
  /** Which language to render in. On the VIEW, because every string on the page reads it. */
  lang: Lang;
}

/**
 * The unit a number question is answered in, by the field it fills.
 *
 * ON THE CARD, OUTSIDE THE FIGURE'S RUN — the same rule the whole product keeps, and the reason
 * the input and the unit are two elements here rather than a placeholder saying "kg". A year has
 * no unit, which is why this is a lookup and not a property every prompt has to carry.
 */
const NUMBER_UNIT: Record<string, string> = {
  height_cm: "cm", weight_kg: "kg", target_weight_kg: "kg",
};

/**
 * The glyph on an option row, by the answer it stands for.
 *
 * ONLY THE TWO PROMPTS THE BOARDS DRAW, and deliberately: an icon is a claim about what an option
 * MEANS, and inventing one for "Austria" or for a dietary tag is a claim nobody made. A row with
 * no glyph is the same row without the tile, which is why this returns "" rather than a fallback
 * drawing.
 */
const OPTION_ICON: Record<string, string> = {
  lose: '<path d="M4 7l5 5 3-3 4 4"/><path d="M16 13h4v-4"/>',
  maintain: '<path d="M4 9h16"/><path d="M4 15h16"/>',
  gain: '<path d="M4 17l5-5 3 3 4-4"/><path d="M16 11h4v4"/>',
  easy: '<path d="M12 4v8l5 3"/><circle cx="12" cy="12" r="9"/>',
  steady: '<path d="M4 18l5-6 4 3 7-9"/>',
  push: '<path d="M13 3L5 14h6l-1 7 8-11h-6z"/>',
};

const optionIcon = (value: string): string => {
  const path = OPTION_ICON[value];
  if (path === undefined) return "";
  return `<span class="ic" aria-hidden="true"><svg viewBox="0 0 24 24" width="19" height="19" ` +
    `fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" ` +
    `stroke-linejoin="round">${path}</svg></span>`;
};

export function question(v: QuestionView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const hidden = `<input type="hidden" name="prompt" value="${escape(v.promptId)}">`;
  let controls: string;
  if (v.kind === "choice") {
    // ONE BUTTON PER OPTION, in the board's row: a glyph where the option has one, the answer and
    // the line that justifies it, and the box you are pressing. With no JavaScript a radio group
    // needs a second tap on a submit button, and the app's version is one tap.
    //
    // THE BOX IS EMPTY ON EVERY ROW, and that is honest rather than unfinished: nothing is chosen
    // until the form posts, so a filled one would be drawing a state this surface cannot be in.
    controls = v.options.map((o) =>
      `<button class="row" type="submit" name="answer" value="${escape(o.value)}">` +
      `${optionIcon(o.value)}<span class="t">${escape(o.label)}` +
      `${o.hint ? `<span class="hint">${escape(o.hint)}</span>` : ""}</span>` +
      `<span class="sq" aria-hidden="true"></span></button>`).join("");
  } else if (v.kind === "number") {
    const unit = NUMBER_UNIT[v.promptId];
    // THE PLACEHOLDER IS A LABEL, NOT A GHOST VALUE. "Weight in kg" set in the figure's own mono
    // at figure size fills the card and reads as something already answered; above it, in the
    // micro label, it says what the box is for and leaves the box empty.
    controls =
      `<div class="numcard">` +
      `${v.placeholder ? `<span class="lab">${escape(v.placeholder)}</span>` : ""}` +
      `<span class="f"><input type="number" name="answer" inputmode="decimal" step="any" required ` +
      `autofocus aria-label="${escape(v.placeholder ?? PAGE_COPY.continueLabel)}">` +
      `${unit ? `<span class="u">${escape(unit)}</span>` : ""}</span></div>` +
      `<button class="primary" type="submit">${escape(PAGE_COPY.continueLabel)}</button>`;
  } else {
    // THE ONE CONTROL THAT CAN SHOW ITS OWN STATE WITHOUT A SCRIPT. A checkbox is checked or it is
    // not, and `:has()` lets the row it lives in say so — so the chips get the board's filled row
    // where the single-answer rows cannot have one.
    controls = v.options.map((o) =>
      `<label class="row check"><input type="checkbox" name="answer" value="${escape(o.value)}">` +
      `<span class="t">${escape(o.label)}</span>` +
      `<span class="sq" aria-hidden="true"></span></label>`).join("") +
      `<button class="primary" type="submit">${escape(PAGE_COPY.continueLabel)}</button>`;
  }
  const actions = v.actions.map((a) =>
    `<button class="row alt" type="submit" name="${escape(a.name)}" value="${escape(a.value)}">` +
    `<span class="t">${escape(a.label)}</span></button>`,
  ).join("");
  // THE BAR ONLY EVER ADVANCES, and never says what is left. "Question 4 of 10" is a count of
  // what remains, which the design forbids on exactly this screen — it turns a conversation into
  // a queue somebody is waiting in. `aria-label` carries the position for a screen reader, which
  // needs the fact rather than the feeling.
  const done = Math.round((v.step / v.total) * 100);
  const bar = `<div class="prog" role="img" aria-label="${escape(PAGE_COPY.progress
    .replace("{step}", String(v.step)).replace("{total}", String(v.total)))}">` +
    `<i style="width:${done}%"></i></div>`;
  // HIS MOOD IS A FACT ABOUT THIS TURN, not a rotation: refused, not yet asked, or answered.
  const mood: MascotMood = v.error !== null ? "care" : v.history.length === 0 ? "wave" : "happy";
  // The BRAND, untranslated — the same reason `LANG_LABEL` is not. A question page in the
  // middle of a flow is titled by the product, not by a sentence about it.
  return shell("eait", `
${bar}
${v.error ? `<p class="notice">${escape(v.error)}</p>` : ""}
${said(v.history)}
${spudSays(mood, v.lines, v.lang)}
<form method="post" action="/start/q">${hidden}${actions}${controls}</form>
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
${spud}
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
  kcal: number;
  proteinG: number;
  floorApplied: boolean;
  floorKcal: number;
  checkoutUrl: string | null;
  /**
   * Whether there is a web application to hand over to.
   *
   * A button to a 404 is worse than no button, so a deployment that never built one says nothing
   * about a diary — the same rule the `/start` front door follows before it redirects.
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
  // sentences around them are the table's. Both were English literals in the markup until #358, on
  // the one page the language picker sits on.
  const n = wholeNumbers(lang);
  return shell(PAGE_COPY.titlePlan, `
<h1>${escape(PAGE_COPY.planHeading)}</h1>
<p class="muted">${escape(PAGE_COPY.planLead)}</p>
<div class="card">
  <p class="figure">${figure(n(v.kcal))}<span class="u">${escape(UNIT_KCAL[lang])}</span></p>
  <p class="muted">${escape(PAGE_COPY.planPerDay.replace("{protein}", n(v.proteinG)))}</p>
</div>
${v.floorApplied
  ? `<p class="notice care">${escape(PAGE_COPY.planFloor)} ${escape(PAGE_COPY.planFloorNumber.replace("{floor}", n(v.floorKcal)))}</p>`
  : ""}
${v.hasWebApp
  ? `<p class="muted">${escape(PAGE_COPY.planDiaryBody)}</p>
<a class="button${v.checkoutUrl ? "" : " primary"}" href="/">${escape(PAGE_COPY.planDiary)}</a>`
  : ""}
${v.checkoutUrl
  ? `<a class="button primary" href="${escape(v.checkoutUrl)}">${escape(PAGE_COPY.planCheckout)}</a>`
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
${languagePicker(v.lang)}
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
