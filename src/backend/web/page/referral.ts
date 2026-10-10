// Refer a friend's two pages (#899): the invite page a friend's link opens, and the optional
// friend's-link step after the country. Boards: `web/ob-referral-invite.html` and
// `web/ob-referral{,-applied,-invalid,-own,-used}.html`.

import type { Lang } from "@eait/shared";
import { fill } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { ctaLink, ctaSubmit, say, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

export interface InviteView {
  /** The link as it is read off a screen — no scheme — or null for a path that holds no code. */
  shown: string | null;
  /** The full link, which "Get the iPhone app" copies for the app's paste. */
  link: string | null;
  /** The App Store listing with `ct=referral`, or null when this host names none. */
  appStore: string | null;
  /** `/start?ref=<code>`, or null when this host has no web sign-up. */
  start: string | null;
  lang: Lang;
}

/**
 * The invite page: one page on a phone and a desktop. "Get the iPhone app" copies the link before
 * it leaves (`data-copy`, read by the page's one script) so the app's step can paste it; with the
 * script blocked it is still a plain link to the listing.
 */
export function invite(v: InviteView): string {
  const c = pageCopyFor(v.lang);
  const app = v.appStore === null ? ""
    : ctaLink(v.appStore, c.inviteApp, "p", v.link ? ` data-copy="${escape(v.link)}"` : "");
  const web = v.start === null ? "" : ctaLink(v.start, c.inviteWeb, v.appStore === null ? "p" : "s");
  const note = v.appStore !== null && v.shown
    ? `<p class="note">${escape(fill(c.inviteCopied, { link: v.shown }))}</p>` : "";
  return shell(c.inviteTitle, `${wtop()}
<div class="wmain one"><div class="wcol mid"><div class="ref">
${say("happy", [c.inviteHeading], v.lang)}
<p class="muted-sub">${escape(c.inviteLead)}</p>
<div class="wctas">${app}${web}</div>
${note}
</div></div></div>
`, v.lang, "ob");
}

export interface ReferralStepView {
  /** What the field holds: the pasted or `?ref=` link, kept on a refusal so a typo is one fix. */
  value: string;
  /** The refusal's sentence, or the applied line, or nothing. */
  notice: { ok: boolean; text: string } | null;
  /** Applied (or already joined): Continue, nothing left to type. */
  done: boolean;
  action: string;
  next: string;
  lang: Lang;
}

/** The friend's-link step: Spud's ask, the field, and Continue or Skip. Nothing is stored on Skip. */
export function referralStep(v: ReferralStepView): string {
  const c = pageCopyFor(v.lang);
  const notice = v.notice === null ? ""
    : `<p class="${v.notice.ok ? "note" : "notice"}" role="${v.notice.ok ? "status" : "alert"}">${escape(v.notice.text)}</p>`;
  const form = v.done ? `<div class="wctas">${ctaLink(v.next, c.continueLabel)}</div>` : `
<form method="post" action="${escape(v.action)}">
  <input type="text" name="code" value="${escape(v.value)}" placeholder="eait.fit/r/…" aria-label="${escape(c.referralField)}" autocomplete="off" autocapitalize="characters" spellcheck="false">
  ${notice}
  <div class="wctas">${ctaSubmit(v.notice ? c.referralTryAgain : c.continueLabel)}${ctaLink(v.next, c.referralSkip, "s")}</div>
</form>`;
  return shell(c.titleStart, `${wtop()}
<div class="wmain one"><div class="wcol mid"><div class="ref">
${say("happy", [c.referralAsk], v.lang)}
<p class="muted-sub">${escape(c.referralLead)}</p>
${v.done ? notice : ""}
${form}
</div></div></div>
`, v.lang, "ob");
}
