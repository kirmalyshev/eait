// The Chat screen's thread, as data. Everything here is pure — no argument is touched, no id is
// minted from a clock — so the screen may call it from anywhere, a React updater included. The
// screen holds the refs and the state; this file decides what the list IS after a page arrives,
// and names the ids that settled for the caller to drain. It lives in `shared` so the test
// command reaches it — the reconciliation below is the most intricate logic the screen has, and a
// rule that only holds in a component nobody's runner executes is a rule nobody has checked.

import { scriptedLine } from "./chat.ts";
import type { ChatEntry, ChatEvent } from "./contract.ts";
import type { MascotMood } from "./onboarding.ts";
import type { ConfirmMealResult, HandleTextResult } from "./results.ts";
import type { MealRecord } from "./types.ts";

/**
 * Everything a live assistant bubble can carry. The union is `HandleTextResult | ConfirmMealResult`
 * rather than just the first: confirming a proposed meal returns a `logged`, and a thread that only
 * typed the message endpoint's results had no shape to render it with.
 */
export type ChatResult = HandleTextResult | ConfirmMealResult;

export type ThreadEntry =
  /**
   * A photo bubble has no bytes and may have no caption: `text` null, glyph only. `failed`: the
   * turn did not come back; the bubble stays, marked, until the user taps it to retry.
   *
   * `refused`: the turn WAS answered — with a 402 — and the words are kept anyway, because the
   * answer is one the user can act on. Distinct from `failed` and never worded as "not sent": that
   * would offer a retry of a turn the server read and decided about. The bubble survives the page
   * the same way, by its id staying in the screen's in-flight set; `reconcilePage` only supersedes
   * a kept bubble when the page carries a stored line for it, and a refused turn leaves none, so
   * this earns no "unanswered" notice either. See `keepsItsWords`.
   */
  | {
      id: string; role: "user"; text: string | null; photo?: boolean; stored?: boolean; failed?: boolean; refused?: boolean;
      /** On a stored photo bubble: the meal it logged, which is how the picture is fetched. */
      mealId?: string | null;
      /** On a stored text line: the bubble it landed for, and the proposal it made — what the screen reads back. */
      clientId?: string | null; pendingId?: string | null;
    }
  | { id: string; role: "assistant"; result: ChatResult; stored?: boolean }
  /** A card from the stored thread: the meal as it is NOW, or gone. */
  | { id: string; role: "card"; event: ChatEvent; mealId: string | null; meal: MealRecord | null; stored: true }
  /**
   * A moment: the notice a turn earned, derived from the bubble it answers, gone with the next page.
   *
   * `for` is the exception and names the bubble it belongs to. An ask the user can ACT on is not a
   * moment — `subscription-required` carries the button that takes their money, and its answer once
   * they have is the only confirmation the screen gives — so it lives exactly as long as the words
   * it sits under (`keepsItsWords`), and goes when they do.
   */
  | { id: string; role: "error"; refusal: string; scope?: string | undefined; for?: string };

/** The server's thread in the screen's shape. Ids are the server's, so a page never duplicates. */
export function fromHistory(entries: ChatEntry[]): ThreadEntry[] {
  return entries.map((e): ThreadEntry => {
    if (e.role === "user") {
      return e.kind === "photo"
        ? { id: e.id, role: "user", text: e.text, photo: true, stored: true, mealId: e.mealId }
        : { id: e.id, role: "user", text: e.text, stored: true, clientId: e.clientId, pendingId: e.pendingId };
    }
    if (e.kind === "meal") return { id: e.id, role: "card", event: e.event, mealId: e.mealId, meal: e.meal, stored: true };
    return { id: e.id, role: "assistant", result: { kind: "answered", text: e.text, speaker: e.speaker }, stored: true };
  });
}

/**
 * What survives a reload of the thread from the server: a live proposal — not a meal until it is
 * confirmed, so the server has no card for it — and a bubble whose reply is still on its way. The
 * bubble that asked for a proposal is NOT kept: its words are on the server from the moment they
 * were said, and come back inside the page. Everything else comes back inside it too; an error
 * bubble was a moment, and does not outlive the page. Deduplicated by id, so a page that overlaps
 * what is on screen (two fetches racing) never shows a line twice.
 */
export function mergeThread(page: ThreadEntry[], prev: ThreadEntry[], inflight: ReadonlySet<string>): ThreadEntry[] {
  // A proposal whose card is on the page was confirmed (the meal takes the proposal's id) while
  // this page was in flight: the card is its answer, and the bubble with its buttons goes.
  const logged = new Set(page.flatMap((e) => (e.role === "card" && e.mealId ? [e.mealId] : [])));
  const proposals = prev.filter((e) => e.role === "assistant" && e.result.kind === "proposed" && !logged.has(e.result.pendingId));
  const seen = new Set(page.map((e) => e.id));
  // Older pages the user scrolled back to stay above the newest one; they are stored lines too —
  // but a card there shows the meal as it was when that page was fetched. The newest page carries
  // the record as it is NOW for any meal it has a card for; re-point the older card at it, so a
  // correction made since does not leave two numbers for one meal on one screen.
  // Keyed on the id, so a meal that is GONE propagates too: one meal must not read as gone on one
  // card and as its old numbers on another.
  const fresh = new Map(page.flatMap((e) => (e.role === "card" && e.mealId ? [[e.mealId, e.meal] as const] : [])));
  const older = prev
    .filter((e) => !seen.has(e.id) && "stored" in e && e.stored)
    .map((e) => {
      // `undefined`: the page has no card for this meal, keep ours. `null`: it has one, and the meal is gone.
      const now = e.role === "card" && e.mealId ? fresh.get(e.mealId) : undefined;
      return now === undefined ? e : { ...e, meal: now };
    });
  // An error entry with `for` is kept exactly while the bubble it answers is: the ask and the words
  // it sits under are one thing to a reader, and a page that took only one of them left either a
  // meal nobody could act on or — the way this was found — a purchase with no confirmation on the
  // screen it was made from.
  const live = prev.filter((e) => !seen.has(e.id) && !("stored" in e && e.stored) && (
    proposals.includes(e)
    || (e.role === "user" && inflight.has(e.id))
    || (e.role === "error" && e.for !== undefined && inflight.has(e.for))
  ));
  return [...older, ...page, ...live];
}

/**
 * The list after a page of the newest lines arrives. `inflight` is the set of bubble ids whose turn
 * has not come back; a bubble marked "not sent" whose turn DID land (a dead socket after the server
 * ran it) is superseded by exactly the line carrying ITS id — the id the phone sent with the turn
 * and the server stored on the user line — and leaves the set here. No text matching: a repeat of
 * the same words is a different turn. A landed turn that proposed a meal is answered exactly when
 * a card with the proposal's id exists (the meal takes that id when confirmed); anything else —
 * adjacency, any assistant line after it — could be another turn's. No card: the meal is not
 * logged, and a sentence rendered as delivered would hide that, so an `unanswered` notice is put
 * under it. The notice is a moment, like every error bubble: it is derived from the bubble it
 * supersedes and goes with the next page, when the line reads as delivered again — the design's
 * "reached me, but the answer didn't" is said once, at the refresh that found out.
 * `linesChanged` is whether the LINES differ from `prev` — what decides a scroll. `changed` is
 * that, or a card's record differing in content: a record can change with no new line (a
 * correction whose thread write was refused), and keeping `prev` would keep the stale numbers;
 * when neither differs the caller keeps `prev` and the list is not touched. `superseded` names the
 * bubble ids the page settled, for the caller to drain from its in-flight set.
 */
export function reconcilePage(
  page: ChatEntry[],
  prev: ThreadEntry[],
  inflight: ReadonlySet<string>,
  pagedBack: boolean,
  /** Whether a landed turn spent the free sample: rides on any notice given, so it can say so. */
  scope?: "sample",
): { next: ThreadEntry[]; linesChanged: boolean; changed: boolean; superseded: string[] } {
  const superseded: ThreadEntry[] = [];
  let shaped = fromHistory(page);
  for (const e of prev) {
    // Failed OR still in flight: the server writes the words before it answers, so a page fetched
    // mid-send already carries the line, and keeping the bubble too would show the words twice.
    if (!(e.role === "user" && (e.failed || inflight.has(e.id)))) continue;
    const at = page.findIndex((f) => f.role === "user" && f.kind === "text" && f.clientId === e.id);
    if (at < 0) continue;
    superseded.push(e);
    // Only a turn that FAILED can be unanswered; one still in flight has its reply on the way.
    if (!e.failed) continue;
    shaped = withUnanswered(shaped, e.id, scope);
  }
  const settled = new Set(inflight);
  for (const e of superseded) settled.delete(e.id);
  const base = prev.filter((e) => !superseded.includes(e));
  const next = mergeThread(shaped, pagedBack ? base : base.filter((e) => !("stored" in e && e.stored)), settled);
  const linesChanged = !(next.length === prev.length && next.every((e, i) => e.id === prev[i]!.id));
  // Same lines, so `prev[i]` exists for every i: compare each card's record by content, not by
  // reference, since a fresh fetch carries new objects for the same record.
  const recordsChanged = !linesChanged && next.some((e, i) => {
    const p = prev[i]!;
    return e.role === "card" && p.role === "card" && JSON.stringify(e.meal) !== JSON.stringify(p.meal);
  });
  return { next, linesChanged, changed: linesChanged || recordsChanged, superseded: superseded.map((e) => e.id) };
}

/**
 * Whether a refusal leaves the user's words worth keeping on screen.
 *
 * ONLY THE ONE THE USER CAN ANSWER. `subscription-required` is refused now and allowed after a
 * purchase, and the purchase is made from the ask rendered directly under those words — so dropping
 * them means somebody who has just paid has to retype the meal they already typed (#261). Every
 * other refusal is final for this turn: a spent daily cap resets at midnight and a network cap is
 * not about this account, so a bubble kept under either is a retry that cannot work.
 *
 * `analysis-failed` is not here because it never reaches this question: it is not a refusal of the
 * turn but an upstream that fell over, and it takes the `failed` path, where "not sent" is true.
 */
export const keepsItsWords = (error: string): boolean => error === "subscription-required";

/** The stored line a bubble landed as: the one carrying the id the phone sent with the turn. */
export function landedLine(entries: ThreadEntry[], clientId: string): (ThreadEntry & { role: "user" }) | undefined {
  return entries.find((e): e is ThreadEntry & { role: "user" } => e.role === "user" && e.stored === true && e.clientId === clientId);
}

/**
 * The notice a landed turn earns: it proposed a meal and no card carries the proposal's id (the
 * meal takes that id when confirmed), so the meal is not logged and a sentence rendered as
 * delivered would hide that. One rule, read by the reconcile and by a send that failed after its
 * line landed. Null when the turn proposed nothing, or its card is there.
 */
export function unansweredFor(entries: ThreadEntry[], clientId: string, scope?: "sample"): ThreadEntry | null {
  const line = landedLine(entries, clientId);
  const proposed = line?.pendingId;
  if (!proposed) return null;
  if (entries.some((e) => e.role === "card" && e.mealId === proposed)) return null;
  // `scope: "sample"`: the turn was charged, and on the sample the retry the notice invites meets a 402.
  return { id: `unanswered:${clientId}`, role: "error", refusal: "unanswered", ...(scope ? { scope } : {}) };
}

/**
 * The list with the notice a landed turn earns placed right UNDER the line it answers — after the
 * live tail it would sit under a later turn's proposal and read as its answer. The same list back
 * when there is nothing to give. One rule for the reconcile and for a send that failed after its
 * line landed, and the one place the placement is decided.
 */
export function withUnanswered(entries: ThreadEntry[], clientId: string, scope?: "sample"): ThreadEntry[] {
  const notice = unansweredFor(entries, clientId, scope);
  if (!notice) return entries;
  const line = landedLine(entries, clientId)!;
  const at = entries.indexOf(line);
  return [...entries.slice(0, at + 1), notice, ...entries.slice(at + 1)];
}

/**
 * The newest card's meal, if it is TODAY's — what "half that" corrects. A stored thread reaches
 * back past today, and a correction aimed at yesterday moves nothing on the screen the user is
 * looking at; null beats that.
 */
export function lastMealId(entries: ChatEntry[], today: string): string | null | undefined {
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i]!;
    // The newest card decides, gone meal included: "half that" must not reach the one above it.
    if (e.kind === "meal") return e.meal && e.meal.date === today ? e.meal.id : null;
  }
  return undefined; // no card on this page at all — says nothing about the focus
}

/**
 * The meal an entry is ABOUT: a stored card's, or a live result that logged, corrected or moved one.
 * Null for every other line — a line that is not about a meal cannot duplicate one.
 */
export function mealIdOf(e: ThreadEntry): string | null {
  if (e.role === "card") return e.mealId;
  if (e.role !== "assistant") return null;
  const k = e.result.kind;
  return k === "logged" || k === "updated" || k === "redated" ? e.result.mealId : null;
}

/**
 * One meal, one place in the thread — its NEWEST mention, and nothing above it (#301).
 *
 * The stored thread keeps a card per EVENT: logging writes one, every correction and re-date writes
 * another. `chatHistory` resolves each of them to the meal as it is NOW, so two cards for one meal
 * are not a history — they are the same numbers, the same verdicts and the same picture printed
 * twice, and one correction made the screen read as though the meal had been logged again. The live
 * result the screen renders before its page arrives is the same meal too, and is deduplicated here
 * against the stored card rather than by the accident of `mergeThread` dropping every live line.
 *
 * At render, not on the way in: the entries are what the server sent and what a page will reconcile
 * against, and a rule about what a reader may see twice belongs where the reader is.
 */
export function oneCardPerMeal(entries: ThreadEntry[]): ThreadEntry[] {
  const newest = new Map<string, number>();
  entries.forEach((e, i) => {
    const id = mealIdOf(e);
    if (id !== null) newest.set(id, i);
  });
  if (newest.size === 0) return entries;
  return entries.filter((e, i) => {
    const id = mealIdOf(e);
    return id === null || newest.get(id) === i;
  });
}

/**
 * The proposal an entry is offering, if it is one — the id its "Log it" would confirm. Null for
 * every other line. The counterpart of `mealIdOf`, and for the same reason: a proposal is the one
 * answer the server keeps no card for, so `mealId` cannot name it and `pendingId` is all there is.
 */
export const pendingIdOf = (e: ThreadEntry): string | null =>
  e.role === "assistant" && e.result.kind === "proposed" ? e.result.pendingId : null;

/**
 * One live estimate, and it is the newest — every older one retired to the words a cancel writes (#360).
 *
 * A proposal is client-only until it is confirmed, so the server has no card for it and
 * `oneCardPerMeal` cannot see it: that filter keys on `mealId` and a proposal has only a
 * `pendingId`. Nothing else superseded one either — `mergeThread` drops a proposal on exactly one
 * condition, a card arriving for its OWN id — so two estimates of one plate both stayed, and
 * confirming one left the other offering a "Log it" for a pending the server no longer held. That
 * tap answers 410 and draws "only held for a while" over a meal that logged perfectly well.
 *
 * RETIRED, NOT REMOVED. The bubble keeps its id and its place and says "Dropped it." — the same
 * words and the same shape the "No" button produces. Filtering it out instead would take a card
 * out from under the reader's eye at the moment the new one lands, which is its own defect.
 *
 * THE WORDS ARE ONLY TRUE IF THE CALLER CANCELS THE PENDING, and it must: nothing on the server
 * expires a proposal early, so a client that merely stops offering it has hidden a row that
 * `POST /confirm` would still honour, and said "Dropped it." about it. `cancelPendingMeal` drops
 * the row and writes this same scripted line into the thread, which is also what makes the line
 * SURVIVE — the one rendered here is live, and every live line goes with the next page.
 * `pendingIdOf` names the id to cancel.
 *
 * Applied where a proposal ENTERS the list, which is the only place one can arrive: `mergeThread`
 * runs on a page, and a proposed turn fetches none. Nothing repairs a two-proposal state that
 * arises some other way — there is no such path today, and a second copy of this rule in the merge
 * would be a second thing to keep in agreement rather than a safety net.
 */
export function oneLiveProposal(entries: ThreadEntry[]): ThreadEntry[] {
  const live = entries.filter((e) => pendingIdOf(e) !== null);
  if (live.length < 2) return entries;
  const newest = live[live.length - 1];
  return entries.map((e) => (pendingIdOf(e) !== null && e !== newest
    ? { id: e.id, role: "assistant", result: { kind: "answered", text: scriptedLine("dropped") } }
    : e));
}

/**
 * The rows a reader may see, from the rows the thread holds.
 *
 * An answered turn that changed nothing has no line, and the server keeps none for it either.
 * Dropped HERE rather than returned as null from the row, because the avatar and the spacing are
 * decided from the PREVIOUS row: with an invisible entry in the data, the reply after it lost
 * Spud's face and was grouped as though he had already been speaking.
 *
 * AND ONE CARD PER MEAL, for the reason `oneCardPerMeal` gives.
 */
export function visibleEntries(entries: ThreadEntry[]): ThreadEntry[] {
  return oneCardPerMeal(entries.filter((e) => !(e.role === "assistant" && e.result.kind === "answered" && e.result.text === "")));
}

/**
 * Whether the newest visible row is a live answer carrying chips — the coach's starters step aside
 * for those. Live only: the thread stores the sentence and never the chips, so a stored line never
 * carries any whatever its shape says.
 */
export function hasLiveSuggestions(visible: ThreadEntry[]): boolean {
  const tail = visible[visible.length - 1];
  return tail !== undefined && tail.role === "assistant" && !tail.stored
    && tail.result.kind === "answered" && (tail.result.suggestions?.length ?? 0) > 0;
}

/** Who a row belongs to: the user, Gabie on her answers, and Spud on everything else he says or shows. */
export function speakerOf(entry: ThreadEntry): "user" | "spud" | "gabie" {
  if (entry.role === "user") return "user";
  if (entry.role === "assistant" && entry.result.kind === "answered" && entry.result.speaker === "gabie") return "gabie";
  return "spud";
}

/**
 * The face beside a bubble, decided from what the bubble IS — the same rule as onboarding's
 * `moodFor`: a reaction to what just happened, not a property of the copy.
 */
export function moodFor(entry: ThreadEntry): MascotMood {
  if (entry.role === "error") return "care";
  if (entry.role === "card") return "cheer";
  if (entry.role === "assistant") {
    // Listed individually, with no default, for the reason `entryBody`'s switch has none: a new
    // result kind should be a compile error here rather than a face somebody picked by accident.
    switch (entry.result.kind) {
      case "logged": case "updated": case "redated": return "cheer";
      case "proposed": return "think";
      case "answered": return "idle";
      case "expired": case "target-gone": case "not-onboarded": case "not-food":
      case "cap-exceeded": case "subscription-required": case "analysis-failed": return "care";
    }
  }
  return "idle";
}

/**
 * Every edit the screen makes to the list, as data.
 *
 * A page landing is NOT here: `reconcilePage` answers more than the list — the ids it settled and
 * whether the LINES moved — and the caller drains its in-flight set from that, which an updater may
 * not do. These are the transitions that are a pure function of the previous list, so a renderer
 * calls them from inside a React updater and a test calls them with no renderer at all.
 */
export type ThreadEvent =
  | { kind: "push"; entry: ThreadEntry }
  /** In place: a confirmed proposal is spent and has to stop looking like an offer. */
  | { kind: "replace"; id: string; entry: ThreadEntry }
  /** The bubble goes; its words are the caller's to put back in the composer. */
  | { kind: "remove"; id: string }
  /** `failed` never reached the server; `refused` was read and answered, and is never worded "not sent". */
  | { kind: "mark"; id: string; as: "failed" | "refused" }
  /** An older page, prepended above what is on screen and deduplicated by id. */
  | { kind: "earlier"; page: ChatEntry[] }
  | { kind: "unanswered"; clientId: string; scope?: "sample" | undefined };

/** The list after one edit. Pure, so it is legal inside a React updater. */
export function threadReducer(entries: ThreadEntry[], event: ThreadEvent): ThreadEntry[] {
  switch (event.kind) {
    case "push": return [...entries, event.entry];
    case "replace": return entries.map((e) => (e.id === event.id ? event.entry : e));
    case "remove": return entries.filter((e) => e.id !== event.id);
    case "mark": return entries.map((e) => (e.id === event.id && e.role === "user" ? { ...e, [event.as]: true } : e));
    case "earlier": {
      const seen = new Set(entries.map((e) => e.id));
      return [...fromHistory(event.page).filter((e) => !seen.has(e.id)), ...entries];
    }
    case "unanswered": return withUnanswered(entries, event.clientId, event.scope);
  }
}
