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
import { spudSvg } from "@eait/shared/mascot";

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
main { max-width: 30rem; margin: 0 auto; padding: 24px 16px 64px; }
.spud { width: 56px; height: 56px; display: block; margin: 0 0 14px; }
h1 { text-wrap: balance; }

/* Spud's line, and the person's. The same two shapes the thread uses; here they are paragraphs
   rather than list items, because this page has no thread to put them in. */
.bubble {
  background: var(--surface); border-radius: 18px; border-bottom-left-radius: 7px;
  padding: 11px 15px; margin: 0 0 8px; max-width: 30rem;
}
.bubble.you {
  background: var(--green); color: var(--ink); font-weight: 600;
  border-bottom-left-radius: 18px; border-bottom-right-radius: 7px;
  margin-left: auto; max-width: 85%;
}
.who { font-size: 12px; font-weight: 700; color: var(--t4); margin: 0 0 4px 4px; }
/* The part of a line not yet typed: laid out, read by a screen reader, not yet seen. */
.untyped { color: transparent; }

/* AN OPTION IS A SUBMIT BUTTON on this surface, so the design's option row is reached by element
   rather than by class. A border and a tint and never a solid fill — three deep in a column a
   filled row makes every option that was not chosen read as disabled. */
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
/* The one call to action, which is green because green is the affordance. */
button.primary, .button.primary {
  justify-content: center; text-align: center; min-height: 56px;
  background: var(--green); color: var(--ink); border-color: var(--green);
  font-weight: 800; font-size: 14px; letter-spacing: .09em; text-transform: uppercase;
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

export function question(v: QuestionView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
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
  // THE BAR ONLY EVER ADVANCES, and never says what is left. "Question 4 of 10" is a count of
  // what remains, which the design forbids on exactly this screen — it turns a conversation into
  // a queue somebody is waiting in. `aria-label` carries the position for a screen reader, which
  // needs the fact rather than the feeling.
  const done = Math.round((v.step / v.total) * 100);
  const bar = `<div class="prog" role="img" aria-label="${escape(PAGE_COPY.progress
    .replace("{step}", String(v.step)).replace("{total}", String(v.total)))}">` +
    `<i style="width:${done}%"></i></div>`;
  return shell("eait", `
${bar}
${v.error ? `<p class="notice">${escape(v.error)}</p>` : ""}
${said(v.history)}
${bubbles(v.lines)}
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
