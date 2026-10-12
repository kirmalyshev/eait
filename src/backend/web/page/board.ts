// The Register P onboarding frame — the markup every W2 screen shares: the wordmark bar, the
// back arrow and the one continuous bar, the ask as the page's heading, the primary button, and the option row.
// `board-css.ts` carries the matching styles; both stay under `main.ob` so the pages W3 still owns
// (plan, sign-up, the offer) are untouched.
//
// The boards are `product/design/pro/onboarding/web/00-welcome.html … 14b-medical.html`; the
// markup names are theirs (`.wtop`, `.dash`, `.say`, `.opt`…) so the two cannot quietly drift.

import { dashIndex, DASH_PLACES, type Lang, type OnboardingPlace } from "@eait/shared";
import { brandSvg } from "@eait/shared/ui/icons";
import { escape } from "./shell.ts";

/** The wordmark bar — the app icon, not Spud (DIRECTION §6). No navigation: onboarding is the
 * product here, nothing links out (§9). */
export function wtop(): string {
  return `<div class="wtop"><span class="brand">${brandSvg("eait", { size: 20, class: "appicon" })}` +
    `eait</span><span class="sp"></span></div>`;
}

/**
 * The top row: the back arrow (#53) and one continuous bar. A question you answered wrong is a
 * question you should reach again, so a re-askable page passes `back` — the previous question, the
 * front door for the first; the interstitials draw the bar alone. The bar fills from the place
 * before to this one, so the last place (`summary`) stops short of full: sign-up is the 100 %.
 */
export function dash(place: OnboardingPlace, lang: Lang, back?: { href: string; label: string }): string {
  // A place past the count (the sign-up) is the bar full.
  const at = dashIndex(place) === -1 ? DASH_PLACES.length : dashIndex(place);
  const pct = (n: number) => `${+(n / (DASH_PLACES.length + 1) * 100).toFixed(2)}%`;
  const arrow = back
    ? `<a class="wback" href="${escape(back.href)}" aria-label="${escape(back.label)}"><i class="ico i-back" aria-hidden="true"></i></a>`
    : "";
  return `<div class="wbar">${arrow}<div class="dash" aria-hidden="true">` +
    `<i style="--from:${pct(at)};--to:${pct(at + 1)}"></i></div></div>`;
}

/**
 * The ask — the question as the page's 34px heading, left, under the bar (ieat-app#2050's CZ
 * frame). No Spud beside it on the web (Kirill, 12 Oct). `lines` is the ask's lines: the last is
 * the question, anything before it is a line under the heading — the board is one sentence deep.
 */
export function say(lines: readonly string[], sub?: string): string {
  const q = escape(lines[lines.length - 1] ?? "");
  const subs = [...lines.slice(0, -1), ...(sub ? [sub] : [])]
    .map((l) => `<p class="qsub">${escape(l)}</p>`).join("");
  return `<div class="say"><h1 class="q">${q}</h1>${subs}</div>`;
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
  /** A caption line under the name. */
  sub?: string;
  /** A shared icon name, drawn before the name; none draws none. */
  icon?: string | undefined;
  /** A badge before the name — activity's "1–2". */
  badge?: string | undefined;
  /** A figure at the row's end — the streak's "−0.9kg". */
  end?: string | null | undefined;
  multi?: boolean;
  checked?: boolean;
}
export function optRow(o: OptSpec): string {
  const input = o.multi
    ? `<input type="checkbox" name="answer" value="${escape(o.value)}"${o.checked ? " checked" : ""}>`
    : `<input type="radio" name="answer" value="${escape(o.value)}"${o.checked ? " checked" : ""}>`;
  // The board's rows: a single choice is the row itself, picked in the accent; a multi-select
  // carries a checkbox at the end.
  const lead = o.badge ? `<span class="n num">${escape(o.badge)}</span>`
    : o.icon ? `<i class="ico i-${escape(o.icon)}"></i>` : "";
  const sub = o.sub ? `<small>${escape(o.sub)}</small>` : "";
  const end = o.end ? `<span class="end num">${escape(o.end)}</span>` : "";
  return `<label class="opt">${input}${lead}<span class="ol">${escape(o.label)}${sub}</span>${end}` +
    `${o.multi ? `<span class="box" aria-hidden="true"></span>` : ""}</label>`;
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
 * name like the font files are. `push-test.png` is the app icon as a PNG: the staff test push
 * (`sendTestPush`) needs an image on the API host in a format iOS accepts as an attachment.
 */
export const IMG_URL_DIR = "/start/assets/img";
export const IMG_FILES = ["hero.webp", "salmon-sq.webp", "salmon.webp", "icon.webp", "push-test.png"] as const;
