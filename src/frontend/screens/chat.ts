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
import { STARTER_ICONS, chatScreenCopyFor, coachRowIcon, starterRows } from "../../shared/app/chat-copy.ts";
import { countText, spellUnit, wholeNumbers, UNIT_KCAL, LANG_TAG } from "../../shared/lang.ts";
import { outcomeUnknown } from "../../shared/results.ts";
import type { IconName } from "../../shared/ui/icons.ts";
import type { CoachFocus, MealRecord } from "@eait/shared";
import type {
  ChatEntry, ChatHistoryResponse, DayResponse,
  AttachPhotosResponse, MessageResponse, PendingMealsResponse, PhotoLast, ProfileResponse,
} from "@eait/shared/contract";
import { ApiError, Unauthenticated, api, apiBlob } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { blobSrc, gabieNameEl, gramMacsEl, optionRowEl, ctaEl, spudAvatarEl, verdictListEl } from "../kit.ts";
import { outbox } from "../outbox.ts";
import { shrinkPhotos } from "../photo.ts";
import {
  COPY, MESSAGES, PENDING, Said, UNKNOWN, behind, clear, composerRow, el, flush,
  heldProposal, kept, keptNotice, lang, lastThreadEntries, findMeal, mealLine, outstandingTurn,
  MEAL_PHOTOS, proposalCard, profile, refusalWords, sendOrKeep, setHeldProposal, setLastThread,
  setRedraw, takeCarried, takeTurn, timeFmt, unclear, names,
} from "../shell.ts";

const copy = () => chatScreenCopyFor(lang);

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



  // The LIVE answer's extras — the suggestion rows and the macro bar — drawn under the line it
  // wrote: the stored entry keeps only the words, so the answer's own result carries them until a
  // newer turn retires them. Matched onto the newest assistant line of the same words.
  let liveAnswer: { text: string; suggestions: string[]; focus: CoachFocus | null } | null = null;

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
    // The coach's presence, the boards' rule: his name line above his FIRST line, his disc beside his
    // NEWEST — a run of his lines keeps one face, and a kept turn's error line is a line of his too.
    const gabieLine = (e: ChatEntry): boolean => e.role === "assistant" && e.kind === "text" && e.speaker === "gabie";
    const firstGabie = entries.findIndex(gabieLine);
    const lastGabie = entries.findLastIndex(gabieLine);
    // A kept turn's error block — and the focus sheet's opener say — are lines of hers too: when
    // either stands, the LAST drawn one is where her disc lands.
    const avatarAt = focusMeal !== null || keptLines.length > 0 ? -2 : lastGabie;

    let idx = 0;
    for (const [i, entry] of entries.entries()) {
      if (entry.role === "user") {
        const li = el("li", `me${entry.kind === "photo" ? " pic" : ""}${rise(entry.id, idx++)}`);
        if (entry.kind === "photo") {
          const hero = el("div", "hero");
          hero.append(el("div", "stamp", timeFmt(new Date(entry.ts))));
          list.append(li);
          li.prepend(hero);
          if (entry.mealId !== null) photoInto(hero, entry.mealId);
          if (entry.text !== null) li.append(el("p", "cap", entry.text));
        } else {
          li.append(entry.text, el("div", "ts", timeFmt(new Date(entry.ts))));
        }
        // No action row on a thread line (#173): an edit is the meal detail's Correct, a delete its
        // ⋯ menu's — the boards draw neither button here.
        list.append(li);
      } else if (entry.kind === "meal") {
        // The card a turn produced — name, kcal, the chips, and the day's verdict dots.
        const li = el("li", `them${rise(entry.id, idx++)}`);
        if (entry.meal !== null) li.append(mealCard(entry.meal));
        else li.append(el("p", "t13 m", mealLine(null)));
        li.append(el("div", "ts", timeFmt(new Date(entry.ts))));
        list.append(li);
      } else {
        // An assistant line: the coach's `.say` when the speaker is his, the app's plain line else
        // (`states-offline`'s stored line draws neither his disc nor his name).
        const li = el("li", `them${rise(entry.id, idx++)}`);
        if (entry.speaker === "gabie") {
          const live = liveAnswer !== null && i === lastGabie && entry.text === liveAnswer.text ? liveAnswer : null;
          li.append(sayBlock(i === firstGabie, i === avatarAt, (col) => {
            // The live answer's bar wraps the words in the boards' padded card; a line without a
            // `focus` is the words alone.
            if (live !== null && live.focus !== null) {
              const card = el("div", "card");
              card.append(focusBar(live.focus), el("p", "say-p", entry.text));
              col.append(card);
            } else {
              col.append(el("p", "say-p", entry.text));
            }
          }));
          li.append(el("div", "ts", timeFmt(new Date(entry.ts))));
        } else {
          li.append(el("p", "say-p", entry.text), el("div", "ts", timeFmt(new Date(entry.ts))));
        }
        list.append(li);
      }
    }

    // The proposal a live turn is holding — the card, under the newest line.
    if (held !== null) {
      const li = el("li", `them prop-li${rise(`prop:${held.pendingId}`, idx++)}`);
      li.append(proposalCard(held, turn, {
        lead: copy().proposalCheck, accept: copy().proposalAccept, decline: copy().proposalDecline,
        ...(heldTimedOut ? { expired: copy().expired } : {}),
      }));
      list.append(li);
    }

    // The live answer's suggestion rows — the boards' option card, under the line they follow.
    const lastEntry = entries.at(-1);
    if (liveAnswer !== null && liveAnswer.suggestions.length > 0 &&
        lastEntry !== undefined && lastEntry.kind === "text" && lastEntry.role === "assistant" &&
        lastEntry.speaker === "gabie" && lastEntry.text === liveAnswer.text) {
      const li = el("li", `them sug${rise("sug", idx++)}`);
      li.append(optCard(liveAnswer.suggestions.map((s) => ({ icon: coachRowIcon(s, lang), text: s })), sendText));
      list.append(li);
    }

    // KEPT FOR LATER, in the order they go, under everything the server has (#708): the photo or
    // words dimmed, then the coach's line — the reachability wording for a turn still out, the server's
    // own refusal words for a held one, with Send again beside it.
    for (const e of keptLines) {
      // Held is the same dimmed bubble but marked — a waiting turn is pending, a held one has its
      // refusal beside it, and a spec (or a reader) can tell the queue apart by the class.
      const li = el("li", `me dim${e.held !== undefined ? " held" : ""}${e.kind === "photo" ? " pic" : ""}${rise(e.id, idx++)}`);
      if (e.kind === "photo" && e.photos.length > 0) {
        const hero = el("div", "hero");
        const img = el("img", "") as HTMLImageElement;
        img.alt = "";
        void blobSrc(e.photos[0]!).then((src) => { img.src = src; });
        hero.append(img, el("div", "stamp", timeFmt(new Date(e.capturedAt))));
        li.append(hero);
        if (e.text !== null) li.append(el("p", "cap", e.text));
      } else {
        li.append(e.text ?? "", el("div", "ts", timeFmt(new Date(e.capturedAt))));
      }
      list.append(li);
      // A kept turn's error is the coach's line: his name when no line of his is above, his disc on
      // the last one, per the same first/newest rule the stored lines follow.
      const isLastKept = e === keptLines[keptLines.length - 1];
      const say = el("li", `them${rise(`${e.id}:err`, idx++)}`);
      say.append(sayBlock(firstGabie === -1 && e === keptLines[0], isLastKept, (col) => {
        // A turn the server may still have run is worded as the doubt it is, never as "try again"
        // beside a button that re-sends it.
        col.append(el("p", "saytitle", e.held === undefined
          ? copy().offlineTitle
          : (outcomeUnknown(e.held.kind) ? unclear()
            : refusalWords(new ApiError(0, { error: e.held.kind, ...(e.held.scope ? { scope: e.held.scope } : {}) }, "held")))));
        if (e.held === undefined) col.append(el("p", "t13 m", copy().offlineBody));
        const actsRow = el("div", "row");
        actsRow.append(smallCta(copy().sendAgain, () =>
          turn(async () => { if (e.held === undefined) { await flush(); } else { await outbox.resend(e.id, uid!); } })));
        if (e.held !== undefined) {
          const drop = el("button", "act", COPY.discard) as HTMLButtonElement;
          drop.type = "button";
          // Discarding a held head lets whatever waited behind it go.
          drop.addEventListener("click", () => turn(async () => { await outbox.discard(e.id); void flush(); }));
          actsRow.append(drop);
        }
        col.append(actsRow);
      }, "care"));
      list.append(say);
    }

    // The FIRST OPEN (`chat-empty`): the coach's greeting and the three starters, only while the stored
    // thread holds nothing — the greeting's say is a line of his too, first AND newest then.
    if (entries.length === 0 && keptLines.length === 0) {
      const hi = el("li", `them${rise("greeting", idx++)}`);
      hi.append(sayBlock(true, true, (col) => col.append(el("p", "d say-hi", copy().greeting))),
        el("div", "ts", timeFmt(new Date())));
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
      const li = el("li", `them focus-meal${rise(`focus:${focusMeal.id}`, idx++)}`);
      li.append(mealCard(focusMeal, true), el("div", "ts", timeFmt(new Date(focusMeal.ts))));
      const say = el("li", `them${rise(`focus-say:${focusMeal.id}`, idx++)}`);
      say.append(sayBlock(firstGabie === -1, true, (col) => {
        // Her weakest guess, named as the board names it: the two biggest reads. The join word
        // is CLDR's own conjunction for the language, not a literal.
        const items = new Intl.ListFormat(LANG_TAG[lang], { type: "conjunction" }).format(
          [...focusMeal.items].sort((a, b) => b.grams - a.grams).slice(0, 2)
            .map((i) => fill(mealCopyFor(lang).itemAmount, {
              amount: `${wholeNumbers(lang)(i.grams)} ${spellUnit(lang, "g")}`, item: i.name,
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
      const n = coachName();
      if (n !== null) col.append(gabieNameEl(fill(mealCopyFor(lang).coachLine, { coach: n })));
      col.append(el("p", "saytitle", copy().loadFailed));
      const again = smallCta(copy().tryAgain, () => turn(async () => {}));
      col.append(again);
      say.append(spudAvatarEl("care"), col);
      fail.append(say);
      clear(thread).append(fail);
      throw unread;
    }
    clear(thread).append(list);
    // The newest line is the bottom anchor — land on it on every draw, and again when a
    // photo finishes arriving (a blob's decode can change scrollHeight after the draw).
    const bottom = () => { list.scrollTop = list.scrollHeight; };
    bottom();
    requestAnimationFrame(bottom);
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

  /** The coach's say block: his name on the first of his lines, his disc beside the newest, a spacer
      where neither is asked for so the words keep one column. `fill` appends the line's content.
      The disc follows the answer (DIRECTION §6): a failure face is `care`, everything else `happy`. */
  const sayBlock = (named: boolean, faced: boolean, body: (col: HTMLElement) => void,
    mood: Parameters<typeof spudAvatarEl>[0] = "happy"): HTMLElement => {
    const say = el("div", "say");
    const gap = el("span", "saygap"); gap.setAttribute("aria-hidden", "true");
    say.append(faced ? spudAvatarEl(mood) : gap);
    const col = el("div", "");
    const n = coachName();
    if (named && n !== null) col.append(gabieNameEl(fill(mealCopyFor(lang).coachLine, { coach: n })));
    body(col);
    say.append(col);
    return say;
  };

  /** A meal's thread card (`chat.html`): name, kcal at d22, the gram chips, the verdict dots.
      `thumb` is the meal-edit sheet's form — its photo at 52px beside the name (`meal-edit.html`). */
  const mealCard = (meal: MealRecord, thumb = false): HTMLElement => {
    const card = el("div", "card");
    const head = el("div", "row between");
    head.append(el("b", "", names(meal.items)));
    const num = el("span", "num");
    num.append(el("b", "d d22", wholeNumbers(lang)(meal.kcal)), el("span", "m t12", ` ${UNIT_KCAL[lang]}`));
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
    // The chips' figures come from the kit's `gramChips` — "34 g" spelled by the kit's own unit
    // table, not a retyped template here.
    const grams = gramMacsEl({ protein: meal.protein_g, carbs: meal.carbs_g, fat: meal.fat_g });
    const macs = el("div", "pl-macs");
    const estimate = meal.confidence === "low" && !meal.corrected;
    if (estimate) {
      const est = el("div", "row between");
      est.append(grams, el("b", "t12 est", mealCopyFor(lang).roughEstimate));
      macs.append(est);
    } else {
      macs.append(grams);
    }
    if (col !== null) col.append(head, macs); else card.append(macs);
    // The dots' words are the payload's own `verdictLabels` — this bundle holds no catalog (#145).
    const vs = verdictListEl((meal.verdictLabels ?? []).map((v) => ({ tone: v.tone, words: v.label })));
    if (vs !== null) card.append(el("div", "hr"), vs);
    return card;
  };

  /** The coach bar (`chat-coach`): the macro's chip and label, "54 of 109 g", the fill capped. */
  const focusBar = (focus: CoachFocus): HTMLElement => {
    const noun = copy().macroLabels[focus.nutrient];
    const mb = el("div", "mb");
    const head = el("div", "row between");
    const name = el("span", "row mb-name");
    name.append(el("i", `ico i-${focus.nutrient}`), noun);
    // "{value} of {target} g" as the table's two halves, the eaten figure bold like the board's:
    // `macroEaten` then `macroTarget`, and no split on the template itself.
    const figure = el("span", "num mb-num");
    figure.append(el("b", "", fill(copy().macroEaten, { value: wholeNumbers(lang)(focus.eaten) })),
      " ", fill(copy().macroTarget, { target: wholeNumbers(lang)(focus.target) }));
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
      const saved = await sendOrKeep({
        id: crypto.randomUUID(), userId: uid ?? "", kind: "text", text, photos: [],
        capturedAt: new Date().toISOString(),
        ...(focusMeal !== null ? { focusMealId: focusMeal.id } : {}),
      }, { onResult: rememberLive });
      return saved;
    });
  };

  /** The live answer, remembered until the next turn — the chips and the bar need its extras. */
  const rememberLive = (r: MessageResponse | PhotoLast): void => {
    liveAnswer = r.kind === "answered"
      ? { text: r.text, suggestions: r.suggestions ?? [], focus: r.focus ?? null }
      : null;
  };

  // THE ONE COMPOSER (the boards' row): the camera round, the pill field, the send round.
  const comp = composerRow(coachName() !== null
    ? fill(copy().composerThread, { coach: coachName()! }) : copy().composerAsk);
  const { picker, words, send, count } = comp;
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
        const saved = await sendOrKeep({
          id: crypto.randomUUID(), userId: uid ?? "", kind: "photo", text: text === "" ? null : text, photos: shrunk,
          capturedAt: new Date().toISOString(),
        }, { onResult: rememberLive });
        picker.value = "";
        words.value = "";
        arm();
        return saved;
      }
      const saved = await sendOrKeep({
        id: crypto.randomUUID(), userId: uid ?? "", kind: "text", text, photos: [],
        capturedAt: new Date().toISOString(),
        ...(focusMeal !== null ? { focusMealId: focusMeal.id } : {}),
      }, { onResult: rememberLive });
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
