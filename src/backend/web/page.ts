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
import { spudSvg } from "@eait/shared/mascot";

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
import { LANGS_READY, LANG_LABEL, wholeNumbers, type Lang } from "@eait/shared";

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
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  /* The same warm haze the landing lays over its first screen, so arriving here reads as the next
     page of one site rather than as another site. */
  background: linear-gradient(180deg, rgb(var(--warm) / var(--haze)), transparent 46rem) var(--ink);
  color: var(--text);
  font-family: var(--sans); font-size: 17px; line-height: 1.6;
  -webkit-font-smoothing: antialiased;
}
main { max-width: 34rem; margin: 0 auto; padding: 2.5rem 1.25rem 4rem; }
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
input:focus { border-color: var(--care); outline: none; box-shadow: 0 0 0 4px color-mix(in srgb, var(--care) 18%, transparent); }
input[type=file] {
  display: block; width: 100%; margin: 0 0 .625rem; font: inherit; font-size: .9375rem;
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

export function shell(title: string, body: string, lang: Lang = "en"): string {
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

const spud = `<div class="spud" role="img" aria-label="Spud, the eait mascot">${spudSvg("wave", "spud-start")}</div>`;

const bubbles = (lines: readonly string[]): string =>
  lines.map((line) => `<p class="bubble typed">${escape(line)}</p>`).join("");

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
  lang: Lang = "en",
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
  step: number;
  total: number;
  /** Which language to render in. On the VIEW, because every string on the page reads it. */
  lang?: Lang;
}

export function question(v: QuestionView): string {
  const PAGE_COPY = pageCopyFor(v.lang ?? "en");
  const hidden = `<input type="hidden" name="prompt" value="${escape(v.promptId)}">`;
  let controls: string;
  if (v.kind === "choice") {
    // One button per option: with no JavaScript, a radio group needs a second tap on a submit
    // button, and the app's version is one tap.
    controls = v.options.map((o) =>
      `<button type="submit" name="answer" value="${escape(o.value)}">${escape(o.label)}` +
      `${o.hint ? `<span class="hint">${escape(o.hint)}</span>` : ""}</button>`).join("");
  } else if (v.kind === "number") {
    controls =
      `<input type="number" name="answer" inputmode="decimal" step="any" required autofocus` +
      `${v.placeholder ? ` placeholder="${escape(v.placeholder)}"` : ""}>` +
      `<button class="primary" type="submit">${escape(PAGE_COPY.continueLabel)}</button>`;
  } else {
    controls = v.options.map((o) =>
      `<label class="check"><input type="checkbox" name="answer" value="${escape(o.value)}"> ` +
      `${escape(o.label)}</label>`).join("") +
      `<button class="primary" type="submit">${escape(PAGE_COPY.continueLabel)}</button>`;
  }
  const actions = v.actions.map((a) =>
    `<button type="submit" name="${escape(a.name)}" value="${escape(a.value)}">${escape(a.label)}</button>`,
  ).join("");
  // The BRAND, untranslated — the same reason `LANG_LABEL` is not. A question page in the
  // middle of a flow is titled by the product, not by a sentence about it.
  return shell("eait", `
<p class="progress">QUESTION ${v.step} OF ${v.total}</p>
${v.error ? `<p class="notice">${escape(v.error)}</p>` : ""}
${bubbles(v.lines)}
<form method="post" action="/start/q">${hidden}${actions}${controls}</form>
`, v.lang ?? "en");
}

/**
 * The end of the road, and the only page here with nothing to press.
 *
 * Its one caller is the under-sixteen stop, whose words promise that nothing was kept — so the
 * account is deleted before this renders. A page that said it while a row survived would be the
 * worst sentence on this surface.
 */
export function stopped(
  title: string, body: string, lines: readonly string[], lang: Lang = "en",
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
  lang?: Lang;
}

/**
 * The thread, oldest first — the app's conversation, in a browser.
 *
 * Rendered from what the SERVER stored and nothing else: a card is the meal as it is now, so a
 * verdict here never outlives the numbers it describes, and no sentence on this page is written by
 * the client. Same rule as the app's own thread.
 */
export function chat(v: ChatView): string {
  const PAGE_COPY = pageCopyFor(v.lang ?? "en");
  return shell(PAGE_COPY.titleChat, `
<h1>${escape(PAGE_COPY.chatHeading)}</h1>
${v.notice ? `<p class="notice">${escape(v.notice)}</p>` : ""}
${v.lines.length === 0
  ? `<p class="muted">${escape(PAGE_COPY.chatEmpty)}</p>`
  : v.lines.map((line) => chatLine(line, PAGE_COPY)).join("\n")}
${v.proposal ? proposalCard(v.proposal, PAGE_COPY) : ""}
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
`, v.lang ?? "en");
}

/**
 * A proposal is CONFIRM-FIRST, here as in the app: a meal nobody photographed is one we inferred,
 * and it is not written until the person says so. Two forms rather than one with two buttons, so
 * each posts to the route that names what it does.
 */
function proposalCard(p: ChatProposal, PAGE_COPY: PageCopy): string {
  const id = `<input type="hidden" name="pendingId" value="${escape(p.pendingId)}">`;
  return `<div class="card">
  <p class="muted">${escape(PAGE_COPY.chatProposalLead)}</p>
  <p><strong>${escape(p.title)}</strong></p>
  <p class="muted">${p.kcal} kcal &middot; ${p.proteinG} g protein</p>
  <form method="post" action="/start/chat/confirm">${id}<button class="primary" type="submit">${escape(PAGE_COPY.chatConfirm)}</button></form>
  <form method="post" action="/start/chat/cancel">${id}<button type="submit">${escape(PAGE_COPY.chatCancel)}</button></form>
</div>`;
}

function chatLine(line: ChatLine, PAGE_COPY: PageCopy): string {
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
  <p class="muted">${c.kcal} kcal &middot; ${c.proteinG} g protein</p>
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
  lang?: Lang;
}

export function plan(v: PlanView): string {
  const lang = v.lang ?? "en";
  const PAGE_COPY = pageCopyFor(lang);
  // The FIGURES are grouped the reader's way — "1.800", not "1,800", for half of Europe — and the
  // sentences around them are the table's. Both were English literals in the markup until #358, on
  // the one page the language picker sits on.
  const n = wholeNumbers(lang);
  return shell(PAGE_COPY.titlePlan, `
<h1>${escape(PAGE_COPY.planHeading)}</h1>
<p class="muted">${escape(PAGE_COPY.planLead)}</p>
<div class="card">
  <p class="figure">${escape(n(v.kcal))} kcal</p>
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
${languagePicker(v.lang ?? "en")}
`, v.lang ?? "en");
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
