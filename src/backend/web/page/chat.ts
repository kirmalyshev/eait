import { MAX_USER_LINE, UNIT_KCAL, wholeNumbers } from "@eait/shared";
import type { Lang } from "@eait/shared";
import { pageCopyFor, type PageCopy } from "../copy.ts";
import { escape, shell } from "./shell.ts";

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
 * Raw interpolation is what this replaces: `${p.kcal}kcal` put an English unit and an ungrouped
 * four-digit number under a plan page that had already said `Порог — 1 500ккал.`
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
