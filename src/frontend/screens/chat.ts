// Chat — the thread and its composer (`#/chat`), moved whole out of `main.ts` (#87). The register's
// own look of it — Gabie's presence, the board's composer — is W7's; the turn machinery it shares
// with Today stays in `shell.ts`.

import { advancePending, pendingLine } from "../../shared/stream.ts";
import { outcomeUnknown } from "../../shared/results.ts";
import type { PendingPhoto } from "@eait/shared";
import type {
  ChatHistoryResponse, DeleteLineResponse, EditLineLast, PendingMealsResponse, PhotoProgress,
} from "@eait/shared/contract";
import { ApiError, Unauthenticated, api, apiStream } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { outbox } from "../outbox.ts";
import {
  COPY, MESSAGE, MESSAGES, PENDING, Said, UNKNOWN, behind, clear, composerRow, el, flush,
  heldProposal, kept, keptNotice, lang, lastThreadEntries, mealLine, outstandingTurn,
  proposalCard, profile, refusalWords, sendOrKeep, setHeldProposal, setLastThread, setRedraw,
  spudFace, takeCarried, takeTurn, unclear,
} from "../shell.ts";

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
  const wrap = el("section", "");
  const thread = el("div", "");
  const notice = el("p", "notice");
  // Announced, not only shown: a refusal only the sighted can see is silence to everybody else.
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  const tell = (words: string | null): void => {
    notice.textContent = words ?? "";
    notice.hidden = words === null;
  };

  // EDIT MODE (#608): which photo line the composer is editing, if any. LOCAL to this screen — a
  // fresh `null` every time `chatScreen` runs, unlike `held`'s module-level memory that survives a
  // rebuilt screen; an edit left mid-flight when the tab switches away is simply dropped.
  let editing: { id: string; photos: number } | null = null;
  // Spud's line while an edit is out — the phone's words (`pendingLine`), under the composer.
  const progress = el("p", "muted");
  progress.hidden = true;

  // THE CONTRACT TYPE, IMPORTED — never a structural type written here. An inline
  // `{ messages: ... }` typechecked and was wrong in three ways at once: the key is `entries`, so
  // it was `undefined` and the screen threw on every visit; the entries are OLDEST FIRST already
  // (`contract.ts`, and `chat.ts` reverses them to make it so), so reversing them again showed the
  // conversation backwards; and `ChatEntry` is a discriminated union whose `meal` arm carries no
  // `text` at all. The root AGENTS.md rule this broke: the HTTP contract is code, both sides import
  // it, and a second copy of a response shape is exactly what that forbids.
  // THE LAST THREAD THE SERVER SENT, drawn again when it cannot be asked (#708): offline, what the
  // page already showed stays, and the turns kept for later go under it. A session that is over is
  // still the sign-in screen.
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
    // The boards' transcript (#52): a quiet column of bubbles — mine right and green, Spud's left
    // and pale — and his face beside only his NEWEST turn, so a run of his lines keeps one presence.
    let lastSpud = -1;
    for (let i = entries.length - 1; i >= 0; i--) {
      if (entries[i]!.role === "assistant") { lastSpud = i; break; }
    }
    const list = el("ul", "thread");
    for (const [i, entry] of entries.entries()) {
      const li = el("li", entry.role === "user" ? "line mine" : "line theirs");
      // One arm at a time. A meal card is a card, not a sentence, and a photo line may carry no words.
      const text = entry.kind === "meal"
        ? mealLine(entry.meal)
        : entry.text ?? COPY.photo;
      const bubble = el("p", "bub", text);
      if (i === lastSpud) {
        // The avatar aligns with the bubble, not the row: the line's words sit in their own column.
        li.classList.add("buddy");
        const av = el("span", "av");
        av.append(spudFace("idle"));
        const col = el("div", "col");
        col.append(bubble);
        li.append(av, col);
      } else {
        li.append(bubble);
      }
      // OWN LINES ONLY (#608): Edit on a photo line that still names a meal, Delete on any of them.
      if (entry.role === "user") {
        // `lineIsMeal`'s rule: a confirmed proposal is stored under the proposal's id.
        const isMeal = entry.kind === "photo"
          ? entry.mealId !== null
          : entry.pendingId !== null && entries.some((e) => e.kind === "meal" && e.mealId === entry.pendingId);
        // A label VoiceOver can act on without reading the bubble first, truncated so a long line
        // does not turn the button's own name into a paragraph.
        const named = text.length > 40 ? `${text.slice(0, 40)}…` : text;
        // Small TEXT buttons under the bubble, named for the line they act on (`.act`, 44px up).
        const acts = el("div", "acts");
        if (isMeal && entry.kind === "photo") {
          const edit = el("button", "act", COPY.edit) as HTMLButtonElement;
          edit.setAttribute("aria-label", `${COPY.edit}: ${named}`);
          edit.addEventListener("click", () => {
            const card = entries.find((e) => e.kind === "meal" && e.mealId === entry.mealId);
            editing = { id: entry.id, photos: (card && card.kind === "meal" ? card.meal?.photos : null) ?? 0 };
            words.value = entry.text ?? "";
            arm();
            words.focus();
          });
          acts.append(edit);
        }
        const del = el("button", "act", COPY.delete) as HTMLButtonElement;
        del.setAttribute("aria-label", `${COPY.delete}: ${named}`);
        del.addEventListener("click", () => {
          const ok = isMeal ? confirm(COPY.confirmDeleteMeal) : confirm(COPY.confirmDeleteLine);
          if (!ok) return;
          turn(async () => {
            await api<DeleteLineResponse>(MESSAGE(entry.id), { method: "DELETE" });
            if (editing?.id === entry.id) { editing = null; arm(); }
          });
        });
        acts.append(del);
        li.append(acts);
      }
      list.append(li);
    }
    // KEPT FOR LATER, in the order they go, under everything the server has (#708). Waiting says so;
    // held says what the server said, in the words a live refusal gets, and offers the two ways on.
    const keptLines = uid === null ? [] : outbox.entries.filter((e) => e.userId === uid);
    for (const e of keptLines) {
      const li = el("li", "line mine");
      li.append(el("p", "bub", e.kind === "photo" ? (e.text ? fill(COPY.photoWithCaption, { text: e.text }) : COPY.photo) : e.text ?? ""));
      if (e.held === undefined) {
        li.append(el("span", "note", COPY.waitingToSend));
      } else {
        // A turn the server may have run is worded as the doubt it is, never as "try again" beside a
        // button that sends it again under a new id.
        li.append(el("span", "note", outcomeUnknown(e.held.kind)
          ? unclear()
          : refusalWords(new ApiError(0, { error: e.held.kind, ...(e.held.scope ? { scope: e.held.scope } : {}) }, "held"))));
        const acts = el("div", "acts");
        const again = el("button", "act", COPY.sendAgain) as HTMLButtonElement;
        again.addEventListener("click", () => turn(() => outbox.resend(e.id, uid!)));
        const drop = el("button", "act", COPY.discard) as HTMLButtonElement;
        // Discarding a held head lets whatever waited behind it go.
        drop.addEventListener("click", () => turn(async () => { await outbox.discard(e.id); void flush(); }));
        acts.append(again, drop);
        li.append(acts);
      }
      list.append(li);
    }
    clear(thread).append(entries.length === 0 && keptLines.length === 0 ? el("p", "muted", COPY.noMessages) : list);
    // LOGGED ALREADY: a confirm whose answer was lost can still have landed, and the meal then
    // carries the proposal's id (`ChatEntry`, contract.ts), so the card in the thread is its answer.
    const pending = heldProposal()?.pendingId;
    if (pending !== undefined && entries.some((e) => e.kind === "meal" && e.mealId === pending)) setHeldProposal(null);
    // No longer offered once the server has stopped holding it — `expiresAt` is sent for exactly this
    // (#367). An unreadable moment stays live, as `proposalLive` rules: the analysis is already billed.
    if (heldProposal() !== null && Date.parse(heldProposal()!.expiresAt) <= Date.now()) setHeldProposal(null);
    if (heldProposal() !== null) thread.append(proposalCard(heldProposal()!, turn));
    if (unread !== null) throw unread;
  };

  // One write, then the thread AS THE SERVER NOW HAS IT — `takeTurn` is the machinery, and this
  // screen hands it its own notice and redraw.
  const turn = (write: () => Promise<string | void>): void => takeTurn(wrap, tell, draw, uid, write);

  // THE ONE COMPOSER (the boards' row, #52): the native file input hides behind the labelled
  // "Add a photo", and the one field takes a meal, a question, or the words that go WITH a photo —
  // Send sends whichever is attached. A photo's own form is gone, and with it the caption field.
  const comp = composerRow(COPY.composerPlaceholder);
  const { picker, words, send, count, cancel } = comp;
  /** The composer as the mode says: an edit shows what it has, asks for angles to ADD, and sends. */
  const arm = (): void => {
    const stored = editing?.photos ?? 0;
    const picked = picker.files?.length ?? 0;
    count.textContent = editing !== null
      ? fill(COPY.photosOnMeal, { n: `${stored}` })
      : picked > 0 ? `${picked} photo${picked === 1 ? "" : "s"}` : "";
    // Hidden rather than merely empty: an empty inline `<span>` still takes up its own gap in the
    // row, which showed as a stray space before Send.
    count.hidden = count.textContent === "";
    // Send's NAME says what this press does — words, or the photos that are attached — because
    // the arrow does not.
    send.setAttribute("aria-label", editing === null && picked > 0 ? COPY.sendPhoto : COPY.send);
    cancel.hidden = editing === null;
  };
  picker.addEventListener("change", arm);
  cancel.addEventListener("click", () => { editing = null; words.value = ""; picker.value = ""; arm(); });
  comp.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const files = [...(picker.files ?? [])];
    const text = words.value.trim();
    if (editing === null && files.length === 0 && text === "") return;
    // THE SERVER'S NUMBERS, off the profile, never compiled in: they differ between environments,
    // and a person should hear "too many" before the upload rather than after it.
    if (me !== null && (editing !== null || files.length > 0)) {
      const { maxPhotosPerMeal, maxUploadBytes } = me.limits;
      // `stored`, never `held`: the module-level `held` above is the text-turn's pending PROPOSAL,
      // and shadowing its name here for an unrelated photo count is exactly the kind of collision
      // that reads fine today and is a bug the day somebody needs both in the same block.
      const stored = editing?.photos ?? 0;
      if (stored + files.length > maxPhotosPerMeal) { tell(fill(COPY.photosMax, { n: `${maxPhotosPerMeal}` })); return; }
      if (files.reduce((n, f) => n + f.size, 0) > maxUploadBytes) { tell(COPY.photoTooLarge); return; }
    }
    turn(async () => {
      // Several files are ANGLES OF ONE MEAL, `photo` fields like the app's.
      const form = new FormData();
      for (const f of files) form.append("photo", f);
      if (editing !== null) {
        // AN EDIT (#608): the same multipart, `text` rather than `caption`, PATCH on the line. The
        // analyzer re-reads every photo with the new words; the line and the card change in place.
        form.append("text", text);
        let p: PendingPhoto = { glance: null, items: [] };
        progress.textContent = pendingLine(p, lang);
        progress.hidden = false;
        try {
          const r = await apiStream<EditLineLast>(MESSAGE(editing.id), { method: "PATCH", body: form }, (line) => {
            const ev = line as PhotoProgress;
            if (ev.kind === "glance" || ev.kind === "item") { p = advancePending(p, ev); progress.textContent = pendingLine(p, lang); }
          });
          if (r.kind === UNKNOWN) throw new Said(unclear());
          // GONE OR UNEDITABLE: the composer drops out of edit mode before the throw, because
          // `turn`'s catch only reports words — it never redraws — so a composer left armed here
          // would go on offering COPY.send against an id the next PATCH answers `target-gone` again.
          // `target-gone` also redraws NOW: the line it names has vanished from the thread the
          // server would return, and `turn` only redraws on a write that returns rather than throws.
          if (r.kind === "target-gone") {
            editing = null;
            arm();
            await draw();
            throw new Said(COPY.messageGone);
          }
          if (r.kind === "bad-request") {
            editing = null;
            arm();
            throw new Said(COPY.messageNotEditable);
          }
          // TOO-MANY keeps edit mode: the meal is still there, still being edited, and dropping an
          // angle and pressing Send again is the whole recovery — there is nothing to reset.
          if (r.kind === "too-many") throw new Said(fill(COPY.photosMax, { n: `${r.limit}` }));
          if (r.kind !== "updated") throw new ApiError(200, { error: r.kind, ...("scope" in r ? { scope: r.scope } : {}) }, `edit: ${r.kind}`);
        } finally {
          progress.hidden = true;
        }
        editing = null;
        picker.value = "";
        words.value = "";
        arm();
        return;
      }
      if (files.length > 0) {
        // Refused IN the stream, with the 200 already sent, is thrown by `sendTurn` as any other refusal.
        const saved = await sendOrKeep({
          id: crypto.randomUUID(), userId: uid ?? "", kind: "photo", text: text === "" ? null : text, photos: files,
          capturedAt: new Date().toISOString(),
        });
        picker.value = "";
        words.value = "";
        arm();
        return saved;
      }
      const saved = await sendOrKeep({ id: crypto.randomUUID(), userId: uid ?? "", kind: "text", text, photos: [], capturedAt: new Date().toISOString() });
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
    // Nothing of this account's left waiting: the promise the notice made is kept, so it goes.
    // A kept turn's notice follows the queue, not the moment it was kept: a turn ahead that is held
    // later means this one now waits on a decision, and nothing left waiting means it went.
    if (notice.textContent === kept() || notice.textContent === behind()) tell(keptNotice(uid));
  });
  const top = el("div", "top");
  top.append(el("h1", "tt", COPY.navChat));
  wrap.append(top, thread, notice, comp.form, progress);
  // What the turn that was out said, if it answered after its own screen was gone.
  // A kept turn's notice carried from a screen that is gone is decided again now: minutes may have
  // passed, and the turn may have gone meanwhile.
  const carried = takeCarried();
  if (carried !== null) tell(carried === kept() || carried === behind() ? keptNotice(uid) : carried);
  return wrap;
}
