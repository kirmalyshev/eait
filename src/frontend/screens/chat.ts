// Chat — Spud's thread and the shared composer (`#/chat`, W7 #94).
//
// The boards are `product/design/pro/web/chat*.html` + `states-*.html`: a quiet column of lines —
// mine right and tinted, the app's left — with the coach's `.say` block carrying his name on
// his FIRST line and his disc beside his NEWEST one; a meal as a card of name, kcal and verdict dots;
// a proposal as `Logging to today — look right?` with `Log it`/`No`; a coach answer's macro bar
// when the server sends `focus`; and the kept turns' photos dimmed under an "couldn't reach"
// line that offers `Send again`. The turn machinery is `shell.ts`'s — this file is the drawing.

import { shellCopyFor } from "../../shared/app/shell-copy.ts";
import { mealCopyFor } from "../../shared/app/meal-copy.ts";
import { logCopyFor } from "../../shared/app/log-copy.ts";
import { STARTER_ICONS, chatScreenCopyFor, coachRowIcon, starterRows } from "../../shared/app/chat-copy.ts";
import { countText, spellUnit, wholeNumbers, kcalNumbers, UNIT_KCAL, LANG_TAG } from "../../shared/lang.ts";
import { keptState } from "../../shared/results.ts";
import type { IconName } from "../../shared/ui/icons.ts";
import type { CoachFocus, MealRecord } from "@eait/shared";
import type {
  ChatEntry, ChatHistoryResponse, DayResponse,
  AttachPhotosResponse, MessageResponse, PendingMealsResponse, PhotoLast, ProfileResponse,
} from "@eait/shared/contract";
import { ApiError, Unauthenticated, api, apiBlob } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { blobSrc, gramMacsEl, optionRowEl, ctaEl, spudAvatarEl, verdictListEl } from "../kit.ts";
import { failureOf, outbox } from "../outbox.ts";
import { shrinkPhotos } from "../photo.ts";
import {
  COPY, MESSAGES, PENDING, Said, UNKNOWN, behind, clear, composerRow, el, flush,
  heldProposal, kept, keptNotice, lang, lastThreadEntries, findMeal, mealLine, outstandingTurn,
  MEAL_PHOTOS, proposalCard, profile, refusalWords, sendOrKeep, setHeldProposal, setLastThread,
  setRedraw, takeCarried, takeTurn, timeFmt, names,
} from "../shell.ts";

const copy = () => chatScreenCopyFor(lang);

/**
 * "No" on her proposal, as the stored page carries it: her line made a proposal (`pendingId`) and
 * the next line is his text, not the meal's card — the engine's "Dropped it.". Read off the shape,
 * not the words, so the browser bundle stays clear of the i18n stack.
 */
const declined = (line: ChatEntry | undefined, next: ChatEntry | undefined): boolean =>
  line !== undefined && line.role === "user" && line.kind === "text" && line.pendingId !== null &&
  next !== undefined && next.role === "assistant" && next.kind === "text";

// The LIVE answer's extras — the suggestion rows and the macro bar — drawn under the line it
// wrote: the stored entry keeps only the words, so the answer's own result carries them until a
// newer turn retires them. Matched onto the newest assistant line of the same words.
// Module-scoped so it outlives the screen: coming back from another tab keeps them (#1229).
let liveAnswer: { text: string; suggestions: string[]; focus: CoachFocus | null } | null = null;
/** A reader up in older lines (`chat-latest`): where each scroller stood, and how many rows she had seen. */
let readerUp: { tops: number[]; seen: number } | null = null;

export async function chatScreen(): Promise<HTMLElement> {
  // ONE TURN AT A TIME ACROSS SCREENS, not only within one: wait for the turn still out, so the
  // thread drawn below already holds what it did.
  const outstanding = outstandingTurn();
  if (outstanding !== null) await outstanding;
  // Only the photo checks read it, and the server is their authority either way — so an account the
  // server holds no profile for (403) still gets its thread and its composer.
  const me = await profile().catch(() => null);
  // Whose turns this browser is keeping (#708). Without a profile nothing is kept: a turn that
  // cannot be sent is worded as a lost answer, as it was.
  const uid = me?.profile.user_id ?? null;
  // The coach's name is the profile's own `coachName` (#149), never a Localized copy — the
  // bundle holds no catalog to build one from. A profile that failed to load draws NO name.
  const coachName = (): string | null => me?.coachName ?? null;
  const wrap = el("section", "chat");
  // `#/chat?focus=<mealId>` — the meal-edit entry W5's logged card and W6's "…" both take
  // (`meal-edit.html`): the meal's own card leads, the coach names what he read, and the composer
  // corrects it — every send carries `focusMealId` so the turn is a correction, not a new meal.
  const focusId = new URLSearchParams(location.hash.split("?")[1] ?? "").get("focus");
  const focusMeal = focusId === null || me === null ? null
    : (await findMeal(focusId, me.timezone).catch(() => null))?.meal ?? null;
  const thread = el("div", "thread-holder");
  const notice = el("p", "notice");
  // Announced, not only shown: a refusal only the sighted can see is silence to everybody else.
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  const tell = (words: string | null): void => {
    notice.textContent = words ?? "";
    notice.hidden = words === null;
  };




  // Which stored lines the rise has already played for — a redraw animates what is NEW, not the
  // whole thread again (the boards play the column once, on arrival).
  const seen = new Set<string>();
  const rise = (key: string, i: number): string =>
    seen.has(key) ? "" : (seen.add(key), ` rise dly-${Math.min(i, 13)}`);

  // THE CONTRACT TYPE, IMPORTED — never a structural type written here.
  const draw = async (): Promise<void> => {
    // A failed read is still THROWN, after the drawing: a turn that wrote and could not re-read says
    // so (#529). Only what is drawn in the meantime changed.
    let unread: unknown = null;
    try {
      setLastThread((await api<ChatHistoryResponse>(`${MESSAGES}?limit=30`)).entries);
    } catch (err) {
      if (err instanceof Unauthenticated) throw err;
      unread = err;
    }
    const entries = lastThreadEntries();
    const keptLines = uid === null ? [] : outbox.entries.filter((e) => e.userId === uid);

    // The proposal's clock is the server's own (#367): a confirm off the thread's meal list is
    // done; past `expiresAt` the card stands without its offers, the timed-out line where they
    // sat (`chat-expired`'s draw). An unreadable moment stays live — the analysis is billed.
    const pending = heldProposal()?.pendingId;
    if (pending !== undefined && entries.some((e) => e.kind === "meal" && e.mealId === pending)) setHeldProposal(null);
    const held = heldProposal();
    const heldTimedOut = held !== null && Date.parse(held.expiresAt) <= Date.now();

    const list = el("ul", "thread");
    // #1520, Telegram's thread: HER bubble carries what happened to her send — the meal it logged,
    // the proposal it made, the refusal or failure it met — and Spud's lines are his bubbles. The
    // grouping (2/8 px, inner corners, his face and the tail on a run's last line) is the CSS's,
    // off the siblings; this loop only decides what each bubble holds.
    let lastMe: HTMLElement | null = null;
    let idx = 0;
    // The newest line that proposed a meal: the only one whose proposal can have timed out
    // unanswered rather than been retired by a newer one (the phone's `lastTyped`, #282).
    const lastProposing = entries.findLastIndex((e) => e.role === "user" && e.kind === "text" && e.pendingId !== null);
    for (const [i, entry] of entries.entries()) {
      if (entry.role === "user") {
        const li = el("li", `me${entry.kind === "photo" ? " pic" : ""}${rise(entry.id, idx++)}`);
        if (entry.kind === "photo") {
          const hero = el("div", "hero");
          li.append(hero);
          if (entry.mealId !== null) photoInto(hero, entry.mealId);
          if (entry.text !== null) li.append(el("p", "cap", entry.text));
        } else {
          li.append(el("p", "said", entry.text));
        }
        // The meal her send logged rides IN her bubble, its time the bubble's time.
        const next = entries[i + 1];
        const meal = next !== undefined && next.role === "assistant" && next.kind === "meal" ? next : null;
        if (meal !== null) {
          li.classList.add("mealb");
          if (meal.meal !== null) li.append(mealCard(meal.meal, false, entry.kind === "photo"));
          else li.append(el("p", "dl m", mealLine(null)));
        }
        // "No" on her proposal (`chat-proposal-no`): his scripted "Dropped it." is HER bubble's
        // refused "Not logged" — her words stay, the results went, nothing reached the diary.
        if (declined(entry, next)) {
          li.classList.add("refused");
          const dl = el("div", "dl");
          dl.append(el("i", "ico i-alert-circle"), copy().phone.notLogged);
          li.append(dl);
        }
        const ts = el("div", "ts", timeFmt(new Date((meal ?? entry).ts)));
        // Its proposal is gone with nothing answering it (no card, no reply, not held): it timed
        // out, and after a reload that is all the page can know. Her failed send, as on the phone:
        // the red ! and Resend; the line is stored, so the ! offers Resend alone.
        if (i === lastProposing && entry.kind === "text" && entry.pendingId !== held?.pendingId
          && (next === undefined || next.role === "user")
          && !entries.some((e) => e.role === "assistant" && e.kind === "meal" && e.mealId === entry.pendingId)) {
          const words = entry.text;
          const resend = (): void => sendText(words);
          const act = el("div", "act");
          act.append(smallCta(copy().resend, resend), ts);
          li.classList.add("failed");
          li.append(act, failBadge(entry.id, resend));
        } else {
          li.append(ts);
        }
        // No action row on a thread line (#173): an edit is the meal detail's Correct, a delete its
        // ⋯ menu's.
        list.append(li);
        lastMe = li;
      } else if (entry.kind === "meal") {
        // Absorbed by the line above it; a card with no line of hers above is still hers.
        const prev = entries[i - 1];
        if (prev !== undefined && prev.role === "user") continue;
        const li = el("li", `me mealb${rise(entry.id, idx++)}`);
        if (entry.meal !== null) li.append(mealCard(entry.meal, false, true));
        else li.append(el("p", "dl m", mealLine(null)));
        li.append(el("div", "ts", timeFmt(new Date(entry.ts))));
        list.append(li);
        lastMe = li;
      } else if (declined(entries[i - 1], entry)) {
        continue; // absorbed by her bubble above as "Not logged"
      } else {
        // An assistant line — the coach's, or the app's own (`states-offline`'s stored line) — is a
        // bubble on his side either way, the time inside it.
        const li = el("li", `them${rise(entry.id, idx++)}`);
        const live = liveAnswer !== null && entry.speaker === "gabie" && entry.text === liveAnswer.text
          && i === entries.findLastIndex((e) => e.role === "assistant" && e.kind === "text") ? liveAnswer : null;
        li.append(sayBlock((col) => {
          // The live answer's bar leads the words when the server sent `focus`.
          if (live !== null && live.focus !== null) col.append(focusBar(live.focus));
          col.append(el("p", "say-p", entry.text), el("div", "ts", timeFmt(new Date(entry.ts))));
        }));
        list.append(li);
      }
    }

    // The proposal a live turn is holding is HER bubble too: under the words that made it, or on
    // its own when those words are not on this page.
    const lastLine = entries.at(-1);
    if (held !== null && heldTimedOut && lastMe !== null && lastLine?.role === "user" && lastLine.kind === "text") {
      // Past its clock the offer is a failed send, never a card under a dead question: her words,
      // the red ! and Resend (`states-not-sent`), the same turn as the phone's.
      const words = lastLine.text;
      const resend = (): void => { setHeldProposal(null); sendText(words); };
      const drop = (): void => { setHeldProposal(null); void draw(); };
      const act = el("div", "act");
      act.append(smallCta(copy().resend, resend));
      const ts = lastMe.querySelector(":scope > .ts");
      if (ts !== null) act.append(ts);
      lastMe.classList.add("failed");
      lastMe.append(act, failBadge(held.pendingId, resend, drop));
    } else if (held !== null) {
      const card = proposalCard(held, turn, {
        lead: copy().proposalCheck, accept: copy().proposalAccept, decline: copy().proposalDecline,
        ...(heldTimedOut ? { expired: copy().expired } : {}),
      });
      const last = entries.at(-1);
      if (lastMe !== null && last !== undefined && last.role === "user") {
        lastMe.classList.add("mealb");
        lastMe.querySelector(":scope > .ts")?.before(card);
      } else {
        const li = el("li", `me mealb${rise(`prop:${held.pendingId}`, idx++)}`);
        li.append(card, el("div", "ts", timeFmt(new Date())));
        list.append(li);
      }
    }

    // The live answer's suggestion rows — the option card, under the line they follow.
    const lastEntry = entries.at(-1);
    if (liveAnswer !== null && liveAnswer.suggestions.length > 0 &&
        lastEntry !== undefined && lastEntry.kind === "text" && lastEntry.role === "assistant" &&
        lastEntry.speaker === "gabie" && lastEntry.text === liveAnswer.text) {
      const li = el("li", `them sug${rise("sug", idx++)}`);
      li.append(optCard(liveAnswer.suggestions.map((s) => ({ icon: coachRowIcon(s, lang), text: s })), sendText));
      list.append(li);
    }

    // KEPT FOR LATER, in the order they go (#708): her bubble, and what is happening to it ON it —
    // pending (a clock: the outbox sends it on its own), failed (the red !, Resend; nothing will
    // send it again by itself) or refused (the server's reason inside, and Delete so the queue
    // behind it can go). Spud never speaks for her send, and her words never go back to the field.
    for (const e of keptLines) {
      const state = keptState(e.held);
      const li = el("li", `me ${state}${e.kind === "photo" ? " pic" : ""}${rise(e.id, idx++)}`);
      if (e.kind === "photo" && e.photos.length > 0) {
        const hero = el("div", "hero");
        const img = el("img", "") as HTMLImageElement;
        img.alt = "";
        void blobSrc(e.photos[0]!).then((src) => { img.src = src; });
        hero.append(img);
        li.append(hero);
        if (e.text !== null) li.append(el("p", "cap", e.text));
      } else {
        li.append(el("p", "said", e.text ?? ""));
      }
      const resend = (): void => turn(async () => { if (e.held === undefined) { await flush(); } else { await outbox.resend(e.id, uid!); } });
      // Deleting a held head lets whatever waited behind it go.
      const drop = (): void => turn(async () => { await outbox.discard(e.id); void flush(); });
      const ts = el("div", "ts", timeFmt(new Date(e.capturedAt)));
      if (state === "pending") {
        const dl = el("div", "dl");
        dl.append(el("i", "ico i-clock"), copy().waitingToSend);
        li.append(dl, ts);
      } else if (state === "failed") {
        const act = el("div", "act");
        act.append(smallCta(copy().resend, resend), ts);
        li.append(act, failBadge(e.id, resend, drop));
      } else {
        const dl = el("div", "dl");
        dl.append(el("i", "ico i-alert-circle"),
          refusalWords(new ApiError(0, { error: e.held!.kind, ...(e.held!.scope ? { scope: e.held!.scope } : {}) }, "held")));
        const act = el("div", "act");
        // A held 402 goes again once she has subscribed (on the phone: web has no payments), so it
        // keeps Resend; every other refusal is final, and Delete lets the queue behind it go.
        if (e.held!.kind === "subscription-required") act.append(smallCta(copy().resend, resend));
        act.append(plainCta(copy().phone.delete, drop), ts);
        li.append(dl, act);
      }
      list.append(li);
    }

    // The FIRST OPEN (`chat-empty`): the coach's greeting and the three starters, only while the stored
    // thread holds nothing — the greeting's say is a line of his too, first AND newest then.
    if (entries.length === 0 && keptLines.length === 0) {
      const hi = el("li", `them${rise("greeting", idx++)}`);
      hi.append(sayBlock((col) => col.append(el("p", "d say-hi", copy().greeting), el("div", "ts", timeFmt(new Date())))));
      const card = el("li", `them opts${rise("starters", idx++)}`);
      card.append(optCard(
        starterRows(me?.profile.struggles ?? null, lang).map((s) => ({ icon: STARTER_ICONS[s.struggle], text: s.text })),
        sendText,
      ));
      list.append(hi, card);
    }

    // The meal-edit head (`web/meal-edit.html`): the meal's card with its photo thumb, then her
    // opener — the items and grams she read, and the ask. Live lines, like the greeting: the
    // stored thread is untouched.
    if (focusMeal !== null) {
      // Her meal, as hers, with the × that leaves the correction for the plain thread.
      const li = el("li", `me mealb focus-meal${rise(`focus:${focusMeal.id}`, idx++)}`);
      const leave = el("a", "ib fx") as HTMLAnchorElement;
      leave.href = "#/chat";
      leave.setAttribute("aria-label", logCopyFor(lang).close);
      leave.append(el("i", "ico i-x"));
      li.append(leave, mealCard(focusMeal, true), el("div", "ts", timeFmt(new Date(focusMeal.ts))));
      const say = el("li", `them${rise(`focus-say:${focusMeal.id}`, idx++)}`);
      say.append(sayBlock((col) => {
        // Her weakest guess, named as the board names it: the two biggest reads. The join word
        // is CLDR's own conjunction for the language, not a literal.
        const items = new Intl.ListFormat(LANG_TAG[lang], { type: "conjunction" }).format(
          [...focusMeal.items].sort((a, b) => b.grams - a.grams).slice(0, 2)
            .map((i) => fill(mealCopyFor(lang).itemAmount, {
              amount: `${wholeNumbers(lang)(i.grams)}${spellUnit(lang, "g")}`, item: i.name,
            })));
        col.append(el("p", "say-p", fill(mealCopyFor(lang).correctOpener, { items })));
      }));
      list.append(li, say);
    }

    // The whole column could not be read and nothing is held: the boards' centred failed state.
    if (unread !== null && entries.length === 0 && keptLines.length === 0) {
      const fail = el("div", "chatfail");
      const say = el("div", "say");
      const col = el("div", "");
      col.append(el("p", "saytitle", copy().loadFailed));
      const again = smallCta(copy().tryAgain, () => turn(async () => {}));
      col.append(again);
      say.append(spudAvatarEl("care"), col);
      fail.append(say);
      clear(thread).append(fail);
      throw unread;
    }
    // His face on the LAST of each run of his bubbles only; the older ones keep the disc's room.
    for (const li of list.querySelectorAll<HTMLElement>(":scope > li.them")) {
      const next = li.nextElementSibling;
      const spud = li.querySelector(":scope > .say > .spud");
      if (spud !== null && next !== null && next.matches("li.them:not(.opts, .sug)")) {
        const gap = el("span", "saygap"); gap.setAttribute("aria-hidden", "true");
        spud.replaceWith(gap);
      }
    }
    // The scroller is the list on a wide page and the page column (`.wmain`) on a narrow one, so
    // both are read and both are set — once the list is in the document, when `.wmain` is findable.
    const scrollers = (): HTMLElement[] =>
      [list, list.closest<HTMLElement>(".wmain")].filter((e): e is HTMLElement => e !== null);
    const away = (sc: HTMLElement): boolean => sc.scrollHeight - sc.scrollTop - sc.clientHeight > 48;
    clear(thread).append(list);
    // The newest line is the bottom anchor — land on it on every draw, and again when a
    // photo finishes arriving (a blob's decode can change scrollHeight after the draw).
    const bottom = () => { for (const sc of scrollers()) sc.scrollTop = sc.scrollHeight; };
    const attached = (fn: () => void, tries = 30): void => {
      if (list.isConnected) fn(); else if (tries > 0) requestAnimationFrame(() => attached(fn, tries - 1));
    };
    const up = readerUp;
    attached(() => {
      // Telegram's rule (`chat-latest`): a reader up in older lines keeps her place when a row
      // lands, and a round ↓ with the count of unseen rows brings her to the newest.
      if (up === null) { bottom(); requestAnimationFrame(bottom); } else scrollers().forEach((sc, k) => { sc.scrollTop = up.tops[k] ?? sc.scrollTop; });
      const unseen = up === null ? 0 : list.children.length - up.seen;
      const jump = unseen > 0 ? el("button", "jump") as HTMLButtonElement : null;
      if (jump !== null) {
        jump.type = "button";
        jump.setAttribute("aria-label", copy().newest);
        jump.append(el("i", "ico i-chevron-down"), el("b", "n", String(unseen)));
        jump.addEventListener("click", () => { readerUp = null; bottom(); jump.remove(); });
        thread.append(jump);
      }
      for (const sc of scrollers()) sc.addEventListener("scroll", () => {
        if (!list.isConnected) return;
        if (scrollers().some(away)) readerUp = { tops: scrollers().map((x) => x.scrollTop), seen: readerUp?.seen ?? list.children.length };
        else { readerUp = null; jump?.remove(); }
      });
    });
    list.addEventListener("load", (ev) => {
      if ((ev.target as HTMLElement).tagName === "IMG") bottom();
    }, true);
    // The composer's prompt is the empty thread's ask until a line is in it.
    words.placeholder = focusMeal !== null ? mealCopyFor(lang).composeHint
      : entries.length === 0 || coachName() === null ? copy().composerAsk
      : fill(copy().composerThread, { coach: coachName()! });
    words.setAttribute("aria-label", words.placeholder);
    if (unread !== null) throw unread;
  };

  // One write, then the thread AS THE SERVER NOW HAS IT — `takeTurn` is the machinery, and this
  // screen hands it its own notice and redraw.
  const turn = (write: () => Promise<string | void>): void => takeTurn(wrap, tell, draw, uid, write);

  // ── The pieces ────────────────────────────────────────────────────────────────────────────

  /** The coach's bubble (#1520): his face beside it — the CSS shows it on a run's last line only —
      and no name line. `body` fills the bubble. The disc follows the answer (DIRECTION §6): a
      failure face is `care`, everything else `happy`. */
  const sayBlock = (body: (col: HTMLElement) => void,
    mood: Parameters<typeof spudAvatarEl>[0] = "happy"): HTMLElement => {
    const say = el("div", "say");
    const col = el("div", "bub");
    body(col);
    say.append(spudAvatarEl(mood), col);
    return say;
  };

  /** A meal's thread card (`chat.html`): name, kcal at d22, the gram chips, the verdict dots.
      `thumb` is the meal-edit sheet's form — its photo at 52px beside the name (`meal-edit.html`). */
  const mealCard = (meal: MealRecord, thumb = false, named = true): HTMLElement => {
    const card = el("div", "card");
    const head = el("div", "row between");
    // A typed meal's bubble already says it in her words; the name is drawn under a photo only.
    head.append(el("b", "", named ? names(meal.items) : ""));
    const num = el("span", "num");
    num.append(el("b", "d d22", kcalNumbers(lang)(meal.kcal)), el("span", "m t12", `${UNIT_KCAL[lang]}`));
    head.append(num);
    // The focus sheet draws the meal's photo at 52px in a row beside the name-and-macs block;
    // the dots run full-width under it (meal-edit.html).
    const headWrap = thumb && (meal.photos ?? 0) > 0 ? el("div", "row frow") : null;
    const col = headWrap !== null ? el("div", "fcol") : null;
    if (headWrap !== null) {
      const img = el("img", "f-thumb") as HTMLImageElement;
      img.alt = "";
      headWrap.append(img, col!);
      card.append(headWrap);
      void apiBlob(`/meals/${encodeURIComponent(meal.id)}/photos/0`).then(async (blob) => {
        if (!img.isConnected) return;
        img.src = await blobSrc(blob);
      }).catch(() => {});
    } else {
      card.append(head);
    }
    // The chips' figures come from the kit's `gramChips` — "34g" spelled by the kit's own unit
    // table, not a retyped template here.
    const grams = gramMacsEl({ protein: meal.protein_g, carbs: meal.carbs_g, fat: meal.fat_g });
    const macs = el("div", "pl-macs");
    macs.append(grams);
    if (col !== null) col.append(head, macs); else card.append(macs);
    // The dots' words are the payload's own `verdictLabels` — this bundle holds no catalog (#145).
    const vs = verdictListEl((meal.verdictLabels ?? []).map((v) => ({ tone: v.tone, words: v.label })));
    if (vs !== null) card.append(el("div", "hr"), vs);
    return card;
  };

  /** The coach bar (`chat-coach`): the macro's chip and label, "54 of 109g", the fill capped. */
  const focusBar = (focus: CoachFocus): HTMLElement => {
    const noun = copy().macroLabels[focus.nutrient];
    const mb = el("div", "mb");
    const head = el("div", "row between");
    const name = el("span", "row mb-name");
    name.append(el("i", `ico i-${focus.nutrient}`), noun);
    // "{value} of {target}g" as the table's two halves, the eaten figure bold like the board's:
    // `macroEaten` then `macroTarget`, and no split on the template itself.
    const figure = el("span", "num mb-num");
    const fig = focus.nutrient === "kcal" ? kcalNumbers(lang) : wholeNumbers(lang);
    figure.append(el("b", "", fill(copy().macroEaten, { value: fig(focus.eaten) })),
      " ", fill(copy().macroTarget, {
        target: fig(focus.target),
        unit: focus.nutrient === "kcal" ? UNIT_KCAL[lang] : spellUnit(lang, "g"),
      }));
    head.append(name, figure);
    const bar = el("div", "bar");
    const fillEl = el("i", "grow");
    fillEl.style.width = `${Math.min(100, focus.target > 0 ? (focus.eaten / focus.target) * 100 : 0)}%`;
    bar.append(fillEl);
    mb.append(head, bar);
    return mb;
  };

  /** The option card — a `.card.flat` of `.opt` rows; a starter or a suggestion, tapped, is sent. */
  const optCard = (rows: { icon: IconName; text: string }[], onPick: (text: string) => void): HTMLElement => {
    const card = el("div", "card flat");
    for (const r of rows) {
      const opt = optionRowEl({ text: r.text, icon: r.icon, tag: "button", chevron: true }) as HTMLButtonElement;
      opt.addEventListener("click", () => onPick(r.text));
      card.append(opt);
    }
    return card;
  };

  const smallCta = (label: string, onTap: () => void): HTMLButtonElement => {
    const b = ctaEl({ text: label, kind: "s", icon: "retry" }) as HTMLButtonElement;
    b.classList.add("sm");
    b.addEventListener("click", onTap);
    return b;
  };

  /** A plain text action in a bubble (Delete) — the 44 px floor, no icon. */
  const plainCta = (label: string, onTap: () => void): HTMLButtonElement => {
    const b = ctaEl({ text: label, kind: "s" }) as HTMLButtonElement;
    b.classList.add("sm");
    b.addEventListener("click", onTap);
    return b;
  };

  /** The red ! beside a failed bubble: a native popover with Resend and Delete (Telegram's sheet). */
  const failBadge = (id: string, resend: () => void, drop?: () => void): HTMLElement => {
    const pid = `fail-${id}`;
    const bang = el("button", "bang", "!") as HTMLButtonElement;
    bang.type = "button";
    bang.setAttribute("popovertarget", pid);
    bang.setAttribute("aria-label", drop === undefined ? copy().resend : `${copy().resend} · ${copy().phone.delete}`);
    const menu = el("div", "failmenu");
    menu.id = pid;
    menu.setAttribute("popover", "");
    const items: [string, () => void, string][] = [[copy().resend, resend, "s"]];
    if (drop !== undefined) items.push([copy().phone.delete, drop, "s bad"]);
    for (const [label, go, kind] of items) {
      const b = ctaEl({ text: label, kind: "s" }) as HTMLButtonElement;
      if (kind.includes("bad")) b.classList.add("bad");
      b.addEventListener("click", () => { menu.hidePopover(); go(); });
      menu.append(b);
    }
    const wrap = el("span", "bangw");
    wrap.append(bang, menu);
    return wrap;
  };

  /** A stored photo into its hero — bearer bytes as a DATA URL, never a token in a src. */
  const photoInto = (hero: HTMLElement, mealId: string): void => {
    void apiBlob(`/meals/${encodeURIComponent(mealId)}/photos/0`).then(async (blob) => {
      if (!hero.isConnected) return;
      const img = el("img", "") as HTMLImageElement;
      img.alt = "";
      img.src = await blobSrc(blob);
      hero.prepend(img);
    }).catch(() => { /* a photo that won't read draws the hero's own paper */ });
  };

  /** A starter or a suggestion is just the words — the same send the composer performs. */
  const sendText = (text: string): void => {
    turn(async () => {
      const saved = await sendHers({
        id: crypto.randomUUID(), userId: uid ?? "", kind: "text", text, photos: [],
        capturedAt: new Date().toISOString(),
        ...(focusMeal !== null ? { focusMealId: focusMeal.id } : {}),
      });
      return saved;
    });
  };

  /** Send her turn. A refusal stays HER bubble (#1520): kept held, the reason drawn on it with
      Delete, and her words never go back to the field. */
  const sendHers = async (entry: Parameters<typeof sendOrKeep>[0]): Promise<string | void> => {
    readerUp = null; // her own send lands her on the newest line (Telegram's rule)
    try {
      return await sendOrKeep(entry, { onResult: rememberLive });
    } catch (err) {
      if (!(err instanceof ApiError) || uid === null) throw err;
      await outbox.add({ ...entry, held: failureOf(err) });
      // Kept on her bubble AND said out loud: the notice is the page's alert.
      return refusalWords(err);
    }
  };

  /** The live answer, remembered until the next turn — the chips and the bar need its extras. */
  const rememberLive = (r: MessageResponse | PhotoLast): void => {
    liveAnswer = r.kind === "answered"
      ? { text: r.text, suggestions: r.suggestions ?? [], focus: r.focus ?? null }
      : null;
  };

  // THE ONE COMPOSER (the boards' row): the camera round, the pill field, the send round.
  // `multiline` — the same opt-in Home takes (#170): the field wraps and grows to the
  // `.compose textarea.box` cap, then scrolls (ieat-app#1289).
  const comp = composerRow(coachName() !== null
    ? fill(copy().composerThread, { coach: coachName()! }) : copy().composerAsk, { multiline: true });
  const { picker, words, send, count } = comp;
  // Telegram's attach (#1520): a paperclip, not the upload round.
  comp.add.replaceChildren(el("i", "ico i-paperclip"));
  /** The composer as the mode says: count the picked photos, and name Send for what it sends. */
  const arm = (): void => {
    const picked = picker.files?.length ?? 0;
    count.textContent = picked > 0 ? countText(lang)(COPY.photosCount, picked) : "";
    // Hidden rather than merely empty: an empty inline `<span>` still takes up its own gap in the
    // row, which showed as a stray space before Send.
    count.hidden = count.textContent === "";
    // Send's NAME says what this press does — words, or the photos that are attached — because
    // the arrow does not.
    send.setAttribute("aria-label", picked > 0 ? COPY.sendPhoto : shellCopyFor(lang).composerSend);
  };
  picker.addEventListener("change", arm);
  comp.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const files = [...(picker.files ?? [])];
    const text = words.value.trim();
    if (files.length === 0 && text === "") return;
    // THE SERVER'S NUMBERS, off the profile, never compiled in: they differ between environments,
    // and a person should hear "too many" before the upload rather than after it.
    if (me !== null && files.length > 0) {
      const { maxPhotosPerMeal } = me.limits;
      const stored = focusMeal?.photos ?? 0;
      if (stored + files.length > maxPhotosPerMeal) { tell(fill(COPY.photosMax, { n: wholeNumbers(lang)(maxPhotosPerMeal) })); return; }
    }
    turn(async () => {
      liveAnswer = null;
      // What goes up is the resized frame — the byte cap weighs it, not what was picked.
      const shrunk = await shrinkPhotos(files);
      if (me !== null && shrunk.reduce((n, f) => n + f.size, 0) > me.limits.maxUploadBytes) throw new Said(COPY.photoTooLarge);
      // Several files are ANGLES OF ONE MEAL, `photo` fields like the app's.
      const form = new FormData();
      for (const f of shrunk) form.append("photo", f);
      if (files.length > 0 && focusMeal !== null) {
        // ANGLES ON THE FOCUSED MEAL, not a new turn: the sheet's upload posts to the meal's own
        // collection — the words in the box stay for the correction turn that reads them.
        await api<AttachPhotosResponse>(MEAL_PHOTOS(focusMeal.id), { method: "POST", body: form });
        picker.value = "";
        arm();
        return;
      }
      if (files.length > 0) {
        const saved = await sendHers({
          id: crypto.randomUUID(), userId: uid ?? "", kind: "photo", text: text === "" ? null : text, photos: shrunk,
          capturedAt: new Date().toISOString(),
        });
        picker.value = "";
        words.value = "";
        arm();
        return saved;
      }
      const saved = await sendHers({
        id: crypto.randomUUID(), userId: uid ?? "", kind: "text", text, photos: [],
        capturedAt: new Date().toISOString(),
        ...(focusMeal !== null ? { focusMealId: focusMeal.id } : {}),
      });
      words.value = "";
      return saved;
    });
  });
  arm();

  // A PROPOSAL OUTLIVES THE PAGE (#530). `held` is page memory, so a reload, a sign-in round trip or
  // a closed tab lost the card while the server still held the proposal, and describing the meal
  // again is a second paid analysis. Read back once, when this screen opens holding nothing: the
  // newest the server holds, which `draw` drops like any other once a card in the thread answers it.
  // A failed read is no card, as before.
  if (heldProposal() === null) setHeldProposal((await api<PendingMealsResponse>(PENDING).catch(() => null))?.proposals.at(-1) ?? null);
  // Offline, the screen still opens: on the thread it last had, the turns it is keeping, and a
  // composer that keeps what is sent.
  await draw().catch((err: unknown) => { if (err instanceof Unauthenticated) throw err; });
  // A queued turn answered while this screen is up redraws it: the logged meal, the held refusal.
  setRedraw(async () => {
    if (!wrap.isConnected) return;
    await draw();
    if (notice.textContent === kept() || notice.textContent === behind()) tell(keptNotice(uid));
  });
  // One h1 per page, and the boards draw no centred title on web — clipped, for the landmark.
  wrap.append(el("h1", "visually-hidden", shellCopyFor(lang).navChat), thread, notice, comp.form);
  // What the turn that was out said, if it answered after its own screen was gone.
  const carried = takeCarried();
  if (carried !== null) tell(carried === kept() || carried === behind() ? keptNotice(uid) : carried);
  return wrap;
}
