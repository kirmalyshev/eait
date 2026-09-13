// The Chat screen's async half: loads, turns, confirms, cancels, and the in-flight bookkeeping they
// read (#381). #350 moved the pure half into `thread.ts` and left this one behind on purpose; with it
// here, a second renderer drives the same orchestration instead of writing a second copy of it.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// SHAPED LIKE `src/backend/store.ts`'S PORT: what it talks to is an ARGUMENT. The API client, the
// thread cache and the session come in as `ChatCoreDeps`; the renderer subscribes to `state` and
// draws it. No React here — `scripts/shared-no-react.test.ts` holds the line.
//
// THE REFS STAY REFS. `inflightIds`, `focusMealId` and `pagedBack` are read SYNCHRONOUSLY inside
// async closures, after a change has been made and before anything has rendered, and `send`'s catch
// depends on exactly that. As plain fields of this closure the reads stay that synchronous. Made
// reducer state, any of them would be a stale closure value, and the three defects those reads were
// written for (#261, #301, and the "not sent" bubble that had already landed) live in that seam.
//
// THE LIST IS OWNED HERE TOO, and read at its latest rather than as last rendered. The screen
// reconciled a page against the list it had last RENDERED and then set the result outright, so a
// bubble pushed while that page was in flight was dropped until the next focus (a `ponytail:` note
// recorded it). Reconciling against the latest list keeps the bubble; `chat-core.test.ts` pins it.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { scriptedLine } from "./chat.ts";
import type { ChatEntry, ChatHistoryResponse, DeleteLineResponse, ProfileResponse } from "./contract.ts";
import { mayHaveSpentSample, sampleSpent } from "./entitlement.ts";
import type { ConfirmMealResult, HandleTextResult, MealLogged, TargetGone } from "./results.ts";
import {
  fromHistory, keepsItsWords, landedLine, lastMealId, oneLiveProposal, reconcilePage, supersededPendings,
  threadReducer, type ThreadEntry,
} from "./thread.ts";

/** The four calls the orchestration makes. The app's `Client` is one; a test's fake is another. */
export interface ChatClient {
  chatHistory(before?: number): Promise<ChatHistoryResponse>;
  sendMessage(text: string, focusMealId?: string, clientId?: string): Promise<HandleTextResult>;
  confirmPending(pendingId: string): Promise<ConfirmMealResult>;
  cancelPending(pendingId: string): Promise<{ kind: "cancelled" | "expired" } | MealLogged>;
  /** `DELETE /v1/messages/:id` (#608). A 409 `target-gone` comes back as the typed result, like `sendMessage`'s. */
  deleteLine(id: string): Promise<DeleteLineResponse | TargetGone>;
}

/**
 * What a thrown value WAS, as the orchestration needs to know it. The client's error type stays the
 * client's: the app derives this from its `ApiError` and `refusalOf`, and a test hands it over as is.
 */
export interface Failure {
  /** The refusal's kind as the server named it, or the client's word for a request that never landed. */
  kind: string;
  scope?: string | undefined;
  /** The server read the turn and answered it on purpose (`ApiError.isRefusal`). */
  refusal: boolean;
}

export interface ChatCoreDeps {
  /** Read at each call rather than captured: a sign-in can replace the session under a mounted screen. */
  client: () => ChatClient;
  profile: () => ProfileResponse | null;
  refreshProfile: () => Promise<ProfileResponse | null>;
  /** The SERVER's calendar day, not the phone's — the rule the diary and the health mirror follow. */
  today: () => string;
  failureOf: (e: unknown) => Failure;
  /**
   * The newest page, kept for the next cold open; an older page's meals, indexed so a card there
   * opens instantly. Only history goes in: a LIVE result carries a `MealAnalysis` — a record minus
   * `id`, `user_id`, `ts` and `model` — and a cast across exactly that gap is what shipped
   * `verdicts: undefined` to a Release build and aborted the process on render.
   */
  cache: { putChat(entries: ChatEntry[]): void; putMeals(entries: ChatEntry[]): void };
  /** The last page the cache holds, or null: what the screen paints before it has asked anything. */
  seed: ChatEntry[] | null;
  /** How the next change of LINES should scroll. The scrolling is the renderer's; the reason is here. */
  onScroll?: (how: "instant" | "keep") => void;
  /** A live answer has arrived. */
  onAnswer?: () => void;
  /** Ids for live entries. A test passes a counter. */
  uid?: () => string;
}

export interface ChatState {
  entries: ThreadEntry[];
  /** Cursor for the page before the oldest one on screen; null once the start is in hand. */
  before: number | null;
  /** "Is the content up": yes when the cache seeded it, otherwise once the first page lands. */
  loaded: boolean;
  /** The one fetch that failed with nothing on screen: say so, and let a tap retry. */
  failed: boolean;
  /** A send, a confirm or a cancel is out. */
  busy: boolean;
  loadingEarlier: boolean;
  /**
   * Proposals whose confirm or cancel is in flight. Keyed by ENTRY id, not pendingId: the entry is
   * what gets replaced when the round trip lands, and it is the only id available at the button.
   */
  settling: ReadonlySet<string>;
}

export interface ChatCore {
  readonly state: ChatState;
  subscribe(listener: () => void): () => void;
  /** Fetch the newest page and merge it in. Returns the stop, for a screen that blurs first. */
  refresh(): () => void;
  loadEarlier(): Promise<void>;
  /** One turn. `undefined` when there is nothing to send or a turn is already out. */
  send(text: string): Promise<void> | undefined;
  confirm(entryId: string, pendingId: string): Promise<void>;
  cancel(entryId: string, pendingId: string): Promise<void>;
  /** A bubble that was not sent goes; its words are the renderer's to put back in the composer. */
  retry(entryId: string): void;
  /** A live line in the app's own voice: the notification primer's. */
  say(text: string): void;
  /**
   * Delete one of the user's own stored lines (#608). Resolves to the date whose meal went with
   * it — the caller refreshes that day — or null when only a line went, or nothing did.
   */
  deleteLine(entryId: string): Promise<string | null>;
}

const randomId = () => `${Date.now()}-${Math.round(Math.random() * 1e6)}`;

export function createChatCore(deps: ChatCoreDeps): ChatCore {
  const uid = deps.uid ?? randomId;
  let state: ChatState = {
    entries: fromHistory(deps.seed ?? []),
    before: null,
    loaded: deps.seed !== null,
    failed: false,
    busy: false,
    loadingEarlier: false,
    settling: new Set(),
  };
  const listeners = new Set<() => void>();
  const set = (patch: Partial<ChatState>): void => {
    // Nothing differs, nothing to tell. The renderer's `useSyncExternalStore` compares snapshots by
    // identity, so a fresh object holding the same values would be a whole-screen render for nothing
    // on every page that changed nothing, and on every `begin()` while already busy.
    if ((Object.keys(patch) as (keyof ChatState)[]).every((k) => Object.is(patch[k], state[k]))) return;
    state = { ...state, ...patch };
    for (const listener of listeners) listener();
  };
  const edit = (fn: (entries: ThreadEntry[]) => ThreadEntry[]): void => set({ entries: fn(state.entries) });

  // The local bubbles whose turn has not come back yet — kept across a refresh, not on the server yet.
  const inflightIds = new Set<string>();
  // What makes "half that" work: the most recent meal in the thread, so a correction has something
  // to correct without the user having to say which meal they mean.
  let focusMealId: string | null = lastMealId(deps.seed ?? [], deps.today()) ?? null;
  // True once the user has paged back: a refresh then keeps their cursor instead of resetting it —
  // unless the newest page no longer touches what is on screen (a page or more arrived elsewhere),
  // in which case the thread starts over from the newest page rather than splice across a gap.
  let pagedBack = false;
  // Two async owners (a send, a confirm) share the composer's busy state, so it is a count.
  let inflight = 0;
  const begin = () => { inflight++; set({ busy: true }); };
  const end = () => { if (--inflight <= 0) { inflight = 0; set({ busy: false }); } };
  const settling = (id: string, on: boolean) => {
    const next = new Set(state.settling);
    if (on) next.add(id); else next.delete(id);
    set({ settling: next });
  };

  /** Fetch the newest page and merge it in. Awaited by a turn, so the composer stays busy until it lands. */
  const fetchPage = async (isLive: () => boolean): Promise<void> => {
    // A load whose screen already blurred costs nothing: checked BEFORE the request, so a queue of
    // dead focus loads cannot hold up the live one behind it.
    if (!isLive()) return;
    try {
      const page = await deps.client().chatHistory();
      if (!isLive()) return;
      deps.cache.putChat(page.entries);
      const onScreen = new Set(state.entries.map((e) => e.id));
      const contiguous = page.entries.some((e) => onScreen.has(e.id));
      if (pagedBack && !contiguous) pagedBack = false;
      // The rules are in `reconcilePage` (shared, tested), computed against the list as it is NOW.
      // Only a change in the LINES arms a scroll; a record that changed with no new line repaints
      // where it is; nothing changed leaves the list alone.
      const { next, linesChanged, changed, superseded } = reconcilePage(
        page.entries, state.entries, inflightIds, pagedBack, sampleSpent(deps.profile()) ? "sample" : undefined,
      );
      for (const id of superseded) inflightIds.delete(id);
      if (changed && linesChanged) deps.onScroll?.("instant");
      set({
        ...(changed ? { entries: next } : {}),
        ...(pagedBack ? {} : { before: page.before }),
        loaded: true,
        failed: false,
      });
      // The page is the server's truth: the newest card is the meal in focus, every time — a meal
      // photographed on the way here must be the one "half that" corrects, not yesterday's. Three
      // states, so no `??`: an id (today's card), null (a card that is not today's — clear the
      // focus), undefined (no card on this page — say nothing).
      const focus = lastMealId(page.entries, deps.today());
      if (focus !== undefined) focusMealId = focus;
    } catch {
      if (isLive()) set({ failed: true }); // the seeded list stands; a tap or the next focus retries
    }
  };

  // Loads run one after another, never dropped: a turn that awaits its page must get a page fetched
  // AFTER its write landed, even if a focus refresh was already in flight when it asked.
  let chain: Promise<void> = Promise.resolve();
  const load = (isLive: () => boolean): Promise<void> => {
    // A rejected link must not wedge the chain: every link starts from a settled promise.
    const next = chain.catch(() => {}).then(() => fetchPage(isLive));
    chain = next;
    return next;
  };

  const refresh = (): (() => void) => {
    let live = true;
    void load(() => live);
    return () => { live = false; };
  };

  const loadEarlier = async (): Promise<void> => {
    const cursor = state.before;
    if (cursor === null || state.loadingEarlier) return;
    set({ loadingEarlier: true });
    try {
      const older = await deps.client().chatHistory(cursor);
      // Indexed so a card here opens instantly; not made the seed page, which stays the newest.
      deps.cache.putMeals(older.entries);
      pagedBack = true;
      deps.onScroll?.("keep");
      set({ entries: threadReducer(state.entries, { kind: "earlier", page: older.entries }), before: older.before });
    } catch {
      // The button stays; the next tap retries.
    } finally {
      set({ loadingEarlier: false });
    }
  };

  const push = (e: ThreadEntry) => edit((prev) => threadReducer(prev, { kind: "push", entry: e }));

  /**
   * Swap one entry for another, in place.
   *
   * A CONFIRMED PROPOSAL IS SPENT, AND HAS TO STOP LOOKING LIKE AN OFFER. Confirming used to append
   * the `logged` result and leave the proposal above it untouched, so the thread ended with two
   * identical cards and a live "Log it" on a `pendingId` the server had already consumed. Tapping it
   * again — which is what a person does when a slow reply makes the first tap look ignored —
   * answered 410 and drew "a proposed meal is only held for a while" over a meal that had logged
   * perfectly well. Replacing rather than disabling because the result carries the same card.
   */
  const replace = (id: string, e: ThreadEntry) => edit((prev) => threadReducer(prev, { kind: "replace", id, entry: e }));

  /**
   * Turn anything thrown into a bubble the user can read.
   *
   * Shared by all three call sites deliberately. `send` had this and the confirm/cancel handlers did
   * not, so a failed confirmation was an unhandled promise rejection: the proposal stayed on screen,
   * unchanged, with its buttons still live, and NOTHING said the meal had not been logged. Silence is
   * the one response a screen like this must never give.
   *
   * `answers` is the bubble this notice belongs to, given only for a refusal whose words are kept:
   * the notice then lives as long as they do rather than going with the next page. An ask carrying a
   * buy button is not a moment — after the purchase it IS the confirmation.
   */
  const pushFailure = (e: unknown, answers?: string) => {
    const { kind, scope } = deps.failureOf(e);
    push({
      id: uid(), role: "error", kind,
      ...(scope !== undefined ? { scope } : {}),
      ...(answers !== undefined ? { for: answers } : {}),
    });
  };

  const send = (text: string): Promise<void> | undefined => {
    const body = text.trim();
    if (!body || inflight > 0) return undefined;
    const asked = uid();
    inflightIds.add(asked);
    push({ id: asked, role: "user", text: body });
    begin();
    return (async () => {
      try {
        const result = await deps.client().sendMessage(body, focusMealId ?? undefined, asked);
        // A page fetched while this was in flight may already have superseded the bubble — and the
        // server writes the reply in the same batch as the words, so that page carries the reply
        // too. Pushing it again would show the answer twice. A PROPOSAL is the exception: the server
        // has no card for it until it is confirmed, so its bubble with the buttons exists only here.
        const stillLive = inflightIds.has(asked);
        // The turn is on the server now; the page fetched below carries this bubble under its own id.
        inflightIds.delete(asked);
        // Today's meal, or nothing: a re-date to yesterday must not leave yesterday in focus.
        if ("mealId" in result) focusMealId = result.date === deps.today() ? result.mealId : null;
        if (stillLive || result.kind === "proposed") {
          // AND AT MOST ONE LIVE ESTIMATE (#360). The rule and its reasoning are `oneLiveProposal`;
          // here because this is the only place a proposal enters the list, and a proposed turn
          // fetches no page.
          //
          // ONLY WHAT IS ABOUT TO BE PUSHED PAST THE BOUND (#385). The estimate this one supersedes
          // keeps its pending: its analysis was already billed and counted against the cap, and
          // nothing here can tell a second plate from a second description of the first. What gets
          // cancelled is the one a PREVIOUS estimate already retired — `supersededPendings`. The
          // cancel is what makes "Dropped it." true rather than a bubble the app stopped offering.
          // Fire and forget, and failure is survivable — the same call the "No" button makes.
          for (const stale of supersededPendings(state.entries)) {
            void deps.client().cancelPending(stale).catch(() => {});
          }
          const entry: ThreadEntry = { id: uid(), role: "assistant", result };
          edit((prev) => oneLiveProposal([...prev, entry]));
          deps.onAnswer?.();
          // The server wrote Spud's line after the card ("Updated — …"); only a page shows it.
          // Awaited, so the composer stays busy until it lands and nothing typed meanwhile is dropped.
          if (result.kind === "updated") await load(() => true);
        }
        // THE TURN THAT SPENT THE LAST ANALYSIS turns the composer into the ask (`blockedAsk`), and
        // nothing else re-reads the profile when a turn succeeds. Not awaited: the answer is on
        // screen, and the composer's turn is over either way.
        if (mayHaveSpentSample(deps.profile())) void deps.refreshProfile();
      } catch (e) {
        // A racing page may have superseded the bubble before the request failed in transport: the
        // words are on screen from the page, and so is the reply if the turn had one (written in the
        // same batch). Nothing to mark and no network to blame; the one thing worth saying is a
        // proposal whose card never came.
        // Decided on the synchronous signal: a page drains `inflightIds` the moment it reconciles,
        // and the success path's own delete is unreachable from here — so a missing id means exactly
        // "a page superseded this bubble".
        if (!inflightIds.has(asked)) {
          // Only a landed PROPOSAL earns a notice; a question or an answered turn has nothing to
          // say, and no profile round trip to pay while the composer waits on `end()`.
          if (landedLine(state.entries, asked)?.pendingId) {
            // The turn was charged: on the sample, the retry the notice invites meets a 402, so it says.
            const p = (await deps.refreshProfile()) ?? deps.profile();
            edit((prev) => threadReducer(prev, { kind: "unanswered", clientId: asked, scope: sampleSpent(p) ? "sample" : undefined }));
          }
        } else {
          const failure = deps.failureOf(e);
          if (failure.kind === "analysis-failed") {
            // The analysis was charged before the model was asked (a cap that only counts successes
            // is one a retry loop walks through), so on the sample this failure spent it. The fact
            // rides on the notice itself, read from a profile fetched NOW — not re-derived later
            // from one that may never arrive, which would leave "try again" in front of a 402.
            const p = (await deps.refreshProfile()) ?? deps.profile();
            push({ id: uid(), role: "error", kind: "analysis-failed", ...(sampleSpent(p) ? { scope: "sample" } : {}) });
          } else {
            pushFailure(e, keepsItsWords(failure.kind) ? asked : undefined);
            // The server has just said the sample is spent; the profile the composer reads has not.
            if (failure.kind === "subscription-required") void deps.refreshProfile();
          }
          if (failure.refusal && failure.kind !== "analysis-failed") {
            // A refusal IS the answer: the turn was sent, read, and refused on purpose, and the
            // server kept no line for it. The bubble stays plain beside the notice and goes with the
            // next page — never "not sent", which would offer a retry of a turn that was answered.
            // `analysis-failed` is the exception: an upstream that fell over, nothing kept, and the
            // notice promises a retry — so it takes the "not sent" path below.
            //
            // EXCEPT THE ONE REFUSAL THE USER CAN ANSWER (#261). The ask under these words carries a
            // button that takes their money, and the page that lands seconds later drops every live
            // bubble — so the meal somebody typed disappeared at the moment they paid to log it.
            // `keepsItsWords` names that one; the id stays in the set, which is what carries the
            // bubble through `mergeThread`, and `refused` makes it tappable without claiming it was
            // never sent.
            if (keepsItsWords(failure.kind)) {
              edit((prev) => threadReducer(prev, { kind: "mark", id: asked, as: "refused" }));
            } else {
              inflightIds.delete(asked);
            }
          } else {
            // The bubble stays, marked not sent, and stays across refreshes (its id remains in
            // `inflightIds`): the words live in exactly one place until the user taps it to retry.
            // Nothing is assumed about what the server did — a dead socket may have run the whole
            // turn, and `POST /v1/messages` has no idempotency key — so the retry is deliberate.
            edit((prev) => threadReducer(prev, { kind: "mark", id: asked, as: "failed" }));
          }
        }
      } finally {
        end();
      }
    })();
  };

  const confirm = async (entryId: string, pendingId: string): Promise<void> => {
    // Marked in flight the moment it is tapped, before the await, so a second tap during a slow round
    // trip finds the buttons already inert rather than sending a second confirm.
    settling(entryId, true);
    // The composer waits too: a confirm fetches the page that carries Spud's verdict, and a message
    // typed during that fetch would be dropped by the merge.
    begin();
    try {
      const res = await deps.client().confirmPending(pendingId);
      if ("mealId" in res) focusMealId = res.date === deps.today() ? res.mealId : null;
      replace(entryId, { id: entryId, role: "assistant", result: res });
      // A first typed meal comes with Spud's verdict, written server-side; fetch it.
      if (res.kind === "logged") await load(() => true);
    } catch (e) {
      // Left as a live proposal on purpose. The meal was NOT logged, and the one thing this screen
      // must never do is fail quietly — the error bubble says what happened and the buttons stay
      // usable, so the answer is a retry rather than retyping it.
      pushFailure(e);
    } finally {
      end();
      settling(entryId, false);
    }
  };

  const cancel = async (entryId: string, pendingId: string): Promise<void> => {
    settling(entryId, true);
    // The composer waits, as on a confirm: "Dropped it." is a line, and a message sent meanwhile would
    // race it for the thread and could land its answer under the wrong turn.
    begin();
    try {
      const res = await deps.client().cancelPending(pendingId);
      if (res.kind === "logged") {
        // Already confirmed, and that response was lost: the meal is logged and stays so.
        focusMealId = res.date === deps.today() ? res.mealId : null;
        replace(entryId, { id: entryId, role: "assistant", result: res });
        await load(() => true);
      } else {
        // An expired proposal was never cancelled and the server wrote nothing for it; the bubble
        // says so, rather than a "Dropped it." the thread will not carry.
        replace(entryId, res.kind === "expired"
          ? { id: entryId, role: "assistant", result: { kind: "expired" } }
          : { id: entryId, role: "assistant", result: { kind: "answered", text: scriptedLine("dropped") } });
      }
    } catch (e) {
      pushFailure(e);
    } finally {
      end();
      settling(entryId, false);
    }
  };

  const deleteLine = async (entryId: string): Promise<string | null> => {
    // Marked in flight before the await, like a confirm: a second long-press meets inert actions.
    settling(entryId, true);
    // The composer waits: a message sent while the delete is out could land under a line that is
    // about to go.
    begin();
    try {
      const res = await deps.client().deleteLine(entryId);
      // Gone on the server either way — deleted now, or already deleted elsewhere — so gone here.
      const mealId = res.kind === "deleted" ? res.mealId : null;
      edit((prev) => threadReducer(prev, { kind: "line-removed", id: entryId, mealId }));
      if (focusMealId !== null && focusMealId === mealId) focusMealId = null;
      return res.kind === "deleted" ? res.date : null;
    } catch (e) {
      pushFailure(e);
      return null;
    } finally {
      end();
      settling(entryId, false);
    }
  };

  const retry = (entryId: string): void => {
    inflightIds.delete(entryId);
    edit((prev) => threadReducer(prev, { kind: "remove", id: entryId }));
  };

  const say = (text: string): void => push({ id: uid(), role: "assistant", result: { kind: "answered", text } });

  return {
    get state() { return state; },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    refresh, loadEarlier, send, confirm, cancel, retry, say, deleteLine,
  };
}
