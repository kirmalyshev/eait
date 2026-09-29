// The Register P onboarding frame — the markup every W2 screen shares: the wordmark bar, the
// fourteen-segment dash, the Spud avatar beside the ask, the primary button, and the option row.
// `board-css.ts` carries the matching styles; both stay under `main.ob` so the pages W3 still owns
// (plan, sign-up, the offer) are untouched.
//
// The boards are `product/design/pro/onboarding/web/00-welcome.html … 14b-medical.html`; the
// markup names are theirs (`.wtop`, `.dash`, `.say`, `.opt`…) so the two cannot quietly drift.

import { dashIndex, DASH_PLACES, type Lang, type OnboardingPlace } from "@eait/shared";
import { spudSvg, type MascotMood } from "@eait/shared/mascot";
import { escape } from "./shell.ts";

/** The board's mood per place — `think` weighs, `care` sits beside, `happy` is the default. */
export const PLACE_MOOD: Partial<Record<OnboardingPlace, MascotMood>> = {
  pace: "think",
  struggles: "care",
  ontrack: "care",
};

/** The wordmark bar. No navigation: onboarding is the product here, nothing links out (§9). */
export function wtop(): string {
  return `<div class="wtop"><span class="brand"><span class="wm" aria-hidden="true">` +
    `${spudSvg("happy", "spud-mark")}</span>eait</span><span class="sp"></span></div>`;
}

/**
 * Back (#53) — the boards draw no arrow, but a question you answered wrong is a question you
 * should reach again, so the walk keeps a quiet link over the dash: the previous question for a
 * re-ask, the front door for the first.
 */
export function backLink(href: string, label: string): string {
  return `<a class="wback" href="${escape(href)}"><i class="ico i-back" aria-hidden="true"></i>${escape(label)}</a>`;
}

/** The fourteen segments — one lit per place passed, the current one the wider dash. */
export function dash(place: OnboardingPlace, lang: Lang): string {
  const at = dashIndex(place);
  const segs = DASH_PLACES.map((_, i) =>
    `<i class="${i < at ? "on" : i === at ? "now" : ""}"></i>`,
  ).join("");
  return `<div class="dash" aria-hidden="true">${segs}</div>`;
}

/**
 * The ask — Spud's avatar beside the question. `lines` is the ask's lines: the last is the
 * question; anything before it is a muted lead-in rather than a second bubble (the board is one
 * sentence deep).
 */
export function say(mood: MascotMood, lines: readonly string[], lang: Lang): string {
  const lead = lines.slice(0, -1).map((l) => `<p class="muted-sub">${escape(l)}</p>`).join("");
  const q = escape(lines[lines.length - 1] ?? "");
  return `<div class="say"><span class="spud">${spudSvg(mood, "spud-say")}</span>` +
    `<div>${lead}<h1 class="q">${q}</h1></div></div>`;
}

/** The primary Continue — a submit inside the question form, or a link on the interstitials. */
export const ctaSubmit = (label: string): string =>
  `<button class="cta p" type="submit">${escape(label)}</button>`;
/** The board's link-shaped button. `cls` carries the full modifier list — "p" primary, "s"
 * secondary, plus the caller's own (the reveal passes `go pop` for its entrance). `attrs` is
 * for the rare inline custom property (an animation delay); callers never get a tag of raw HTML
 * to compose, so a patch of the emitted string is never the way. */
export const ctaLink = (href: string, label: string, cls = "p", attrs = ""): string =>
  `<a class="cta ${escape(cls)}" href="${escape(href)}"${attrs}>${escape(label)}</a>`;

/**
 * An option row — a real input wrapped in its label, so the row IS the control and works with no
 * script. `checked` state is CSS (`:has(input:checked)`), not a class the script must keep honest.
 */
export interface OptSpec {
  value: string;
  label: string;
  /** A caption line under the name (activity's "Workouts now and then"). */
  sub?: string;
  /** A shared icon name → the `.tile`; none means no tile. */
  icon?: string | undefined;
  multi?: boolean;
  checked?: boolean;
}
export function optRow(o: OptSpec): string {
  const input = o.multi
    ? `<input type="checkbox" name="answer" value="${escape(o.value)}"${o.checked ? " checked" : ""}>`
    : `<input type="radio" name="answer" value="${escape(o.value)}"${o.checked ? " checked" : ""}>`;
  const tile = o.icon ? `<span class="tile"><i class="ico i-${escape(o.icon)}"></i></span>` : "";
  const sub = o.sub ? `<small>${escape(o.sub)}</small>` : "";
  return `<label class="opt">${input}${tile}<span>${escape(o.label)}${sub}</span>` +
    `<span class="ck"><i class="ico i-check"></i></span></label>`;
}

/**
 * The unit toggle (06–09) — a tiny POST form, because a preference that writes must POST. The
 * buttons carry `setunits`; the server stores it and the page redraws in the new system. With the
 * script the relabel is instant; without, the round-trip is the relabel.
 */
export function segToggle(
  options: readonly { value: string; label: string }[],
  current: string,
  action: string,
  extra: string,
): string {
  const btns = options.map((o) =>
    `<button type="submit" name="setunits" value="${escape(o.value)}"` +
    `${o.value === current ? ' class="on" aria-current="true"' : ""}>${escape(o.label)}</button>`,
  ).join("");
  return `<form class="seg" method="post" action="${escape(action)}" data-seg>${extra}${btns}</form>`;
}

/** The hidden fields every question form shares. */
export const hidden = (name: string, value: string): string =>
  `<input type="hidden" name="${name}" value="${escape(value)}">`;

/**
 * The photographs the boards draw, and the app icon the sign-up centres — `shared/assets/img/`,
 * licensed (LICENSES.md beside them). Served by the route in `start.ts`, whitelisted here by
 * name like the font files are.
 */
export const IMG_URL_DIR = "/start/assets/img";
export const IMG_FILES = ["hero.webp", "salmon-sq.webp", "icon.webp"] as const;
