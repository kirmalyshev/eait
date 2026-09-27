// The app shell — the frame every surface draws in, and the machinery all of them share.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// NO FRAMEWORK, AND THAT IS A DECISION RATHER THAN AN OMISSION. This repo already ships a working
// client-side application written exactly this way — `backend/api/admin.page.ts`, twenty-five
// kilobytes of it — so the idiom exists, is understood here, and costs no dependency, no build
// toolchain beyond `bun build`, and no JSX configuration. A framework buys reconciliation; the
// screens each re-render a container and do not need reconciling.
//
// EVERY SERVER CALL GOES THROUGH `api.ts`, which holds the bearer in a closure and speaks only in
// relative paths. Nothing here touches `fetch` directly and nothing here knows the token exists.
//
// THE SCREENS LIVE IN `screens/` (#87): one module per surface, so the redesign's W-packages can
// work in parallel without touching one file. What they share lives HERE — a screen that
// re-imports a helper from a sibling screen is a second copy of it. The stylesheet is split the
// same way: `server/index.ts` composes its one `<style>` block from `shell.css.ts` and each
// surface's `screens/<surface>.css.ts`.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// Shared modules come in by RELATIVE PATH (#608), never `@eait/shared`: a package import needs
// `node_modules/@eait/shared`, which exists only after `bun install`, and `deploy/Dockerfile.web`
// builds this bundle with no `bun install` and no `node_modules` at all — it copies `shared` in
// beside `web` for exactly this. `@eait/shared` stays TYPES ONLY, as `src/frontend/AGENTS.md`
// requires; the ones below are the runtime pieces this page needs, and a relative import of the
// file they live in costs nothing the Dockerfile does not already pay for.
import { shellCopyFor } from "../shared/app/shell-copy.ts";
import { spudSvg, type MascotMood } from "../shared/mascot.ts";
import { heldAhead, joinsQueue } from "../shared/outbox.ts";
import { UNIT_KCAL, narrowLang, wholeNumbers } from "../shared/lang.ts";
import type { Lang } from "../shared/types.ts";
import type { MealProposed, MealRecord } from "@eait/shared";
import type {
  ChatEntry, MessageResponse, OUTCOME_UNKNOWN, PendingResponse, PhotoLast,
  ProfileResponse, ROUTES,
} from "@eait/shared/contract";
import { ApiError, Unauthenticated, api, signIn, signedIn } from "./api.ts";
import { webCopyFor, type WebCopy } from "./copy.ts";
import { noAnswer, outbox, sendTurn, type WebQueued } from "./outbox.ts";

/**
 * THE LANGUAGE THIS TAB IS BEING READ IN, and every string on the page reads it.
 *
 * A MODULE-SCOPE BINDING, deliberately, and set from the profile the moment it arrives. Threading a
 * language through forty render functions in a framework-less client is forty parameters that are
 * always the same value; what makes one variable safe is that it is written in exactly ONE place —
 * `profile()` below, once per signed-in tab — and that changing it RELOADS the page rather than
 * re-rendering around it. The page and the picker cannot disagree, because there is nothing to keep
 * in step.
 *
 * THE BROWSER'S OWN LANGUAGE until the profile lands, not English. A person who has no account
 * yet still has a language, and the sign-in screen is the whole of what they see before the first
 * fetch resolves — `/start` reads `Accept-Language` for exactly this reason (`browserLang`), and a
 * hardcoded `en` here is the same defect that made German web onboarding unreachable: invisible,
 * because every screen after it is correct.
 */
export let lang: Lang = narrowLang(typeof navigator === "undefined" ? null : navigator.language);
export let COPY: WebCopy = webCopyFor(lang);
if (typeof document !== "undefined") document.documentElement.lang = lang;

/**
 * A contract route as `api()` spells it, under `/api/v1`. A TYPE, so the route is checked against
 * `ROUTES` at typecheck and nothing of the contract reaches the bundle — `ROUTES` is a value, and
 * this workspace imports the shared one for types only.
 */
type Under<P extends string> = P extends `/v1${infer R}` ? R : never;
export const MESSAGES: Under<typeof ROUTES.messages> = "/messages";
export const MESSAGE: (id: string) => `${Under<typeof ROUTES.messages>}/${string}` = (id) => `${MESSAGES}/${encodeURIComponent(id)}`;
export const PENDING: Under<typeof ROUTES.pending> = "/meals/pending";
export const WEEK: Under<typeof ROUTES.week> = "/diary/week";
// The parameterised routes' `ReturnType` widens to `string`, so these name the shape directly —
// still the path `ROUTES` spells, under `/api/v1`.
export const MEAL: (id: string) => `/meals/${string}` = (id) => `/meals/${encodeURIComponent(id)}`;
export const CONFIRM: (id: string) => `/meals/pending/${string}/confirm` = (id) => `${PENDING}/${encodeURIComponent(id)}/confirm`;

export const root = (): HTMLElement => document.getElementById("app")!;

/** Text, never `innerHTML`, on anything that came from the server or from a person. */
export function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export const clear = (node: HTMLElement): HTMLElement => { node.replaceChildren(); return node; };

/** Which gradient id the next Spud gets — two inline SVGs on one page may not share one. */
let spudSeq = 0;

/**
 * Spud as a parsed element, one gradient id per instance. He arrives as a STRING (`spudSvg` is the
 * one drawing every web surface shares), parsed rather than built node by node. It is a
 * compile-time constant we wrote, not server or user content — which is the whole of what "text,
 * never innerHTML" exists to keep off the page.
 */
export function spudFace(mood: MascotMood): Element {
  return new DOMParser().parseFromString(spudSvg(mood, `spud-${++spudSeq}`), "image/svg+xml").documentElement;
}

/**
 * The profile, fetched once per signed-in tab.
 *
 * Memoised because two things need it before anything is drawn — the targets on the diary, and
 * whether to offer the admin — and fetching it per screen would ask the server the same question
 * on every tab switch. Cleared on sign-out, because the next person at this browser is not
 * necessarily the same person.
 */
let profileCache: ProfileResponse | null = null;
export const profile = async (): Promise<ProfileResponse> => {
  if (profileCache === null) {
    profileCache = await api<ProfileResponse>("/profile");
    // THE ONE PLACE THE ACCOUNT'S LANGUAGE IS SET. Everything drawn before it — the signed-out
    // screen — is in the browser's language, set at load below.
    lang = profileCache.profile.lang;
    COPY = webCopyFor(lang);
    document.documentElement.lang = lang;
  }
  return profileCache;
};

/** Forget the profile — the sign-out in `youScreen` calls it before re-rendering. */
export const forgetProfile = (): void => { profileCache = null; };

/**
 * The navigation row, in the boards' order (Register P, `web/today.html`): Home · Progress · Chat ·
 * Profile. A tab renders only once a screen ANSWERS for its route — `#/progress` arrives with W8's
 * surface, and no tab points at a screen that does not exist. `#/meal/:id` (W6) is a screen BEHIND
 * Home rather than a tab, which is why it is not in this list.
 */
const TABS: readonly { hash: string; label: "navHome" | "navProgress" | "navChat" | "navProfile" }[] = [
  { hash: "#/", label: "navHome" },
  { hash: "#/progress", label: "navProgress" },
  { hash: "#/chat", label: "navChat" },
  { hash: "#/you", label: "navProfile" },
];

/** Which tab a route is — `#/meal/…` is Home's, as its board draws. */
const activeTab = (route: string): string =>
  route === "#/chat" || route === "#/you" || route === "#/progress" ? route : "#/";

/**
 * The boards' top bar (Register P): the `eait` wordmark — Spud's happy face at 20px — then the ONE
 * row the app navigates by, text links underlined on the active one. A null `active` is the
 * signed-out screen's bar: the mark alone, because the row's destinations are all behind a session.
 */
function chrome(route: string | null): HTMLElement {
  const bar = el("header", "wtop");
  const brand = el("span", "brand");
  const wm = el("span", "wm");
  wm.append(spudFace("happy"));
  brand.append(wm, "eait");
  bar.append(brand);
  if (route === null) return bar;
  const SCOPY = shellCopyFor(lang);
  const nav = el("nav", "wnav");
  for (const tab of TABS) {
    if (!hasScreen(tab.hash)) continue;
    const on = tab.hash === activeTab(route);
    const a = el("a", on ? "on" : "", SCOPY[tab.label]) as HTMLAnchorElement;
    a.href = tab.hash;
    if (on) a.setAttribute("aria-current", "page");
    nav.append(a);
  }
  if (profileCache?.isAdmin === true) {
    // A full navigation, not a route: the admin is a server-rendered page of its own, on this same
    // origin and behind the same sign-in.
    //
    // ADVISORY. The server checks the role again on every request under /admin, so setting the flag
    // by hand in a console buys a menu entry with nothing behind it.
    const a = el("a", "", COPY.navAdmin) as HTMLAnchorElement;
    a.href = "/admin";
    nav.append(a);
  }
  bar.append(nav, el("span", "sp"));
  return bar;
}

/** The front door for anybody this browser cannot prove is signed in. */
function signInScreen(): HTMLElement {
  const box = el("section", "card");
  box.append(el("h1", "", "eait"));
  box.append(el("p", "muted", COPY.signedOutLead));
  // A LINK, NOT A FETCH. `/start` is a server-rendered flow that ends by setting the session
  // cookie, and it is the only thing on this origin that can authenticate anybody.
  const a = el("a", "primary", COPY.signIn) as HTMLAnchorElement;
  a.href = "/start";
  box.append(a);
  return box;
}

// Grouped the reader's way — "1.724 kcal" in German — rounded, because a kcal from a photo is an
// estimate, and with the language's own spelling of the unit beside it.
export const kcal = (n: number): string => `${wholeNumbers(lang)(n)} ${UNIT_KCAL[lang]}`;

/**
 * The proposal a text turn is holding, until it is logged or dropped.
 *
 * Not a thread line until it is confirmed — the server writes the card only then — so the page
 * keeps it from the turn's own answer. Module state, so redrawing the thread does not lose it; and
 * cleared on sign-out, because the next person at this browser did not propose it.
 */
let held: MealProposed | null = null;
export const heldProposal = (): MealProposed | null => held;
export const setHeldProposal = (p: MealProposed | null): void => { held = p; };

/** The thread as the server last sent it, drawn again when it cannot be asked. Cleared on sign-out. */
let lastThread: ChatEntry[] = [];
export const lastThreadEntries = (): ChatEntry[] => lastThread;
export const setLastThread = (entries: ChatEntry[]): void => { lastThread = entries; };

/**
 * The turn still out, and what it said if its screen was gone by the time it answered (#529).
 *
 * The tabs and Back stay live while a turn is out, and `render()` rebuilds this screen from
 * scratch: without these the rebuilt screen offered a working composer while the first photo was
 * still being analysed — a second paid analysis of the same meal — and the first turn's answer
 * landed on a detached node nobody could see.
 */
let outstanding: Promise<void> | null = null;
let carried: string | null = null;
export const outstandingTurn = (): Promise<void> | null => outstanding;
/** Reads AND clears: a carried notice is delivered once, to the screen that is up when it lands. */
export const takeCarried = (): string | null => { const said = carried; carried = null; return said; };

/**
 * One write, then the screen AS THE SERVER NOW HAS IT.
 *
 * RE-READ, NOT RECONCILED, and that is why this is a POST and a reload rather than a copy of
 * `chat.tsx`'s orchestration (#381). The app draws a bubble before the server has the line and
 * lets a second turn go while the first is out, so it has to reconcile pages against in-flight
 * ids, and a stale read there is a defect. Here every control is disabled while one turn is out
 * and nothing is drawn that the server did not send back, so there is nothing to reconcile. A web
 * chat that grows either of those wants #381's shared core, never a second copy of it.
 *
 * The inputs are cleared by the write on SUCCESS only: a refused turn keeps its words, so a
 * person who meets the 402 does not have to type the meal again.
 *
 * MODULE-LEVEL since #52: the composer on Today posts the same way the one on Chat does, so the
 * machinery is shared and each screen hands in its own `tell` and redraw.
 */
export function takeTurn(
  wrap: HTMLElement,
  tell: (words: string | null) => void,
  redrawScreen: () => Promise<void>,
  uid: string | null,
  write: () => Promise<string | void>,
): void {
  const controls = [...wrap.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")];
  for (const c of controls) c.disabled = true;
  tell(null);
  // To this screen while it is up; carried to the next one when it has been rebuilt meanwhile.
  const report = (words: string): void => {
    // A kept turn's notice is decided NOW, from what is still waiting: a replay that answered while
    // this turn was redrawing already took the turn away, and the notice would outlive it.
    if (words === kept() || words === behind()) {
      const now = keptNotice(uid);
      if (now === null) return;
      words = now;
    }
    if (wrap.isConnected) tell(words); else carried = words;
  };
  let wrote = false;
  let said: string | void = undefined;
  const run = (async () => {
    try {
      // A write may answer with words of its own for a turn that WORKED: "already logged".
      said = await write();
      wrote = true;
      if (wrap.isConnected) await redrawScreen();
      if (typeof said === "string") report(said);
    } catch (err) {
      // Cleared BEFORE `render()`: a rebuilt chat screen waits on `outstanding`, and this turn is
      // still it, so waiting here would be the turn waiting on itself.
      if (err instanceof Unauthenticated) { outstanding = null; await render(); return; }
      // A write that landed is never "try again": that would log the meal twice. One that has its
      // own words — a turn kept for later — says those rather than "sent".
      report(wrote ? (typeof said === "string" ? said : COPY.sentReload) : refusalWords(err));
      if (!wrote) console.error(err);
    } finally {
      for (const c of controls) c.disabled = false;
    }
  })();
  outstanding = run;
  void run.finally(() => { if (outstanding === run) outstanding = null; });
}

/**
 * The proposal a text turn is holding, until it is logged or dropped — one card, on whichever
 * screen is up (the thread's, or beside the diary's own composer since #52).
 */
export function proposalCard(p: MealProposed, turn: (write: () => Promise<string | void>) => void): HTMLElement {
  const card = el("div", "card");
  card.append(el("p", "muted", COPY.proposalLead));
  card.append(el("p", "", `${names(p.analysis.items)} — ${kcal(p.analysis.kcal)}`));
  for (const [verb, label, className] of [["confirm", COPY.logIt, "primary"], ["cancel", COPY.notThis, ""]] as const) {
    const b = el("button", className, label) as HTMLButtonElement;
    b.addEventListener("click", () => turn(async () => {
      let r: PendingResponse;
      try {
        r = await api<PendingResponse>(`/meals/pending/${encodeURIComponent(p.pendingId)}/${verb}`, { method: "POST" });
      } catch (err) {
        // A session that is over is not a lost answer: it is the sign-in screen, which `turn` draws.
        if (err instanceof Unauthenticated) throw err;
        // NO ANSWER, AND PRESSING AGAIN IS SAFE: a repeated confirm is answered with the meal it
        // already logged, a repeated cancel with a 410. So the card stays and says so. "Reload to
        // check" would wipe it (it lives only in this page), and describing the meal again is a
        // second paid analysis.
        if (refusalWords(err) === maybeLanded()) {
          // A lost COPY.notThis needs no second press: nothing is logged without a confirm, so what
          // was asked for holds whether or not it landed — and offering the card again would put
          // it back under the server's own COPY.dropped (#529).
          if (verb === "cancel") { setHeldProposal(null); card.remove(); return; }
          throw new Said(COPY.logRetry);
        }
        if (!(err instanceof ApiError && err.status === 410)) throw err;
        // 410: no longer held, and never will be again, so the card goes rather than offering a
        // dead button. For COPY.notThis that is the outcome that was asked for, and it says nothing.
        setHeldProposal(null);
        if (verb === "confirm") { card.remove(); throw err; }
        return;
      }
      // The card goes with its offer, not only when the redraw after it succeeds (#529): a failed
      // thread fetch left COPY.sent under a card still offering Log it.
      setHeldProposal(null);
      card.remove();
      // A confirm got there first and its answer never came back: the meal stays logged.
      if (verb === "cancel" && r.kind === "logged") return COPY.alreadyLogged;
    }));
    card.append(b);
  }
  return card;
}

export function textField(placeholder: string): HTMLInputElement {
  const input = el("input", "") as HTMLInputElement;
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder);
  return input;
}

/**
 * The boards' composer (#52): ONE pill row — "Add a photo" as a labelled button in front of the
 * native file input (which never shows), the field, and the round send. The same row stands at the
 * bottom of Chat and of Today; what Send does with the words and the files is each screen's own.
 *
 * `accept=` is a hint to the chooser and transcodes nothing: an iPhone's library hands a browser
 * HEIC as happily as it once handed the app. The server refuses it before charging (415), and
 * that refusal is what a person reads.
 */
export function composerRow(placeholder: string): {
  form: HTMLFormElement; picker: HTMLInputElement; add: HTMLButtonElement;
  words: HTMLInputElement; send: HTMLButtonElement; count: HTMLElement; cancel: HTMLButtonElement;
} {
  const form = el("form", "comp") as HTMLFormElement;
  const picker = el("input", "visually-hidden") as HTMLInputElement;
  picker.type = "file";
  picker.accept = "image/jpeg,image/png,image/webp";
  picker.multiple = true;
  picker.setAttribute("aria-label", COPY.photosOfOneMeal);
  const add = el("button", "add", COPY.addPhoto) as HTMLButtonElement;
  add.type = "button";
  add.addEventListener("click", () => picker.click());
  const row = el("div", "comp-row");
  const words = textField(placeholder);
  words.className = "fld";
  const send = el("button", "send", "↑") as HTMLButtonElement;
  send.setAttribute("aria-label", COPY.send);
  row.append(add, words, send);
  const count = el("span", "count", "");
  count.hidden = true;
  const cancel = el("button", "act", COPY.cancel) as HTMLButtonElement;
  cancel.type = "button";
  cancel.hidden = true;
  const note = el("div", "comp-note");
  note.append(count, cancel);
  form.append(picker, row, note);
  return { form, picker, add, words, send, count, cancel };
}

/**
 * What a refused or failed turn says, by the CODE in the body — never by the status alone.
 *
 * The same words `/start/chat` uses where the refusal is the same (`PAGE_COPY`,
 * `backend/web/page.ts`), because a person meets both chats on one origin. The 402 is the one
 * that differs: the phone opens RevenueCat's sheet on it and a browser has no sheet, so it says
 * where subscribing happens.
 *
 * READ WITH `Object.hasOwn`: the code is a server string, and a bare lookup of `constructor` on a
 * plain object returns a function.
 */
/** The table, per language. Keyed exactly as it was; the words moved to `copy.ts`. */
const refusalWordsFor = (): Record<string, string> => COPY.refusals;

/**
 * A turn whose answer never arrived. The connection went, or the edge gave up waiting, and the
 * server may have run the turn to the end regardless — so never "try again", which would pay for a
 * meal twice and log it twice.
 */
export const maybeLanded = (): string => COPY.refusals["maybe-landed"]!;

/**
 * An answer that came back unable to say whether the meal was logged: the stream's last line when
 * the server failed mid-turn, which can be after the insert (#514). Not "no answer came back".
 */
export const unclear = (): string => COPY.refusals["unclear"]!;
/** That line's kind, spelled as the contract spells it: a type import, so nothing is bundled. */
export const UNKNOWN: typeof OUTCOME_UNKNOWN = "outcome-unknown";

/** Words a handler has already chosen for its own failure. `refusalWords` passes them through. */
export class Said extends Error {}

export function refusalWords(err: unknown): string {
  if (err instanceof Said) return err.message;
  if (!(err instanceof ApiError)) return maybeLanded();
  // The server failed mid-turn, maybe after the meal was logged (#514). An answer did come back, so
  // the doubt is named.
  if (err.body?.error === UNKNOWN) return unclear();
  const words = refusalWordsFor();
  const said = (code: string): string | undefined =>
    Object.hasOwn(words, code) ? words[code] : undefined;
  const code = String(err.body?.error);
  // WHOSE cap is the scope's to say, and a cap that names none claims nobody's (#158).
  if (code === "cap-exceeded") return said(`cap-${String(err.body?.scope)}`) ?? words["cap-unknown"]!;
  // A 5xx with no code of ours is the edge, not this server, answering: the same unknown as a drop.
  return said(code) ?? (err.status >= 500 ? maybeLanded() : COPY.somethingWrong);
}

/** What a meal is called on one line: its first two items. */
export const names = (items: readonly { name: string }[]): string =>
  items.slice(0, 2).map((i) => i.name).join(", ") || COPY.meal;

/** What an assistant meal card says in the thread, from the meal it still points at. */
export function mealLine(meal: MealRecord | null): string {
  // Null once the meal is deleted, and the id outlives it deliberately — so the thread says
  // something rather than rendering an empty bubble.
  if (meal === null) return COPY.mealGone;
  return `${names(meal.items)} — ${kcal(meal.kcal)}`;
}

/** What a turn kept for later says, once, under the composer (#708). No cause: offline and an edge are both this. */
export const kept = (): string => COPY.kept;
/** The same, when what is ahead of it waits on a DECISION rather than on a connection. */
export const behind = (): string => COPY.keptBehind;
/** A turn that joined the queue without being tried, and could not be saved: nothing went anywhere. */
export const notSaved = (): string => COPY.notSaved;

/** Whether anything of `uid`'s is still waiting to go on its own. */
export const waitingFor = (uid: string | null): boolean => uid !== null && joinsQueue(outbox.entries, uid);

/**
 * A kept turn's notice, from the queue AS IT IS NOW — never the moment the turn was kept: a turn ahead
 * held since makes it BEHIND, and nothing left waiting means it went. One decision for the notice a
 * turn reports and the one a redraw corrects, so the two cannot disagree.
 */
export const keptNotice = (uid: string | null): string | null =>
  !waitingFor(uid) ? null : heldAhead(outbox.entries, uid!) ? behind() : kept();

/** The screen's own redraw while it is up, so a queued turn answered in the background shows. */
let redraw: (() => Promise<void>) | null = null;
export const setRedraw = (fn: (() => Promise<void>) | null): void => { redraw = fn; };

/**
 * What a turn's answer changes on this page: a proposal is held until it is logged or dropped. A
 * kept turn cannot answer after a newer one — a turn said while kept ones wait joins their end
 * (`sendOrKeep`) — so the newest to arrive is the newest asked for, a COPY.sendAgain included.
 */
export function answered(r: { kind: string }): void {
  if (r.kind !== "proposed") return;
  const p = r as MealProposed;
  // One live estimate, as on the phone (`oneLiveProposal`): the previous one is cancelled for real.
  if (held !== null && held.pendingId !== p.pendingId) {
    void api(`/meals/pending/${encodeURIComponent(held.pendingId)}/cancel`, { method: "POST" }).catch(() => {});
  }
  held = p;
}

/**
 * Send a turn, or KEEP it when it got no answer (#708): offline, a reset connection, an edge with
 * nothing in its 5xx. Kept, it goes out under the SAME id, so a first attempt that did reach the
 * server and only lost its answer is answered from it rather than run twice. Anything the server
 * answered is thrown for the caller to word, as before.
 */
export async function sendOrKeep(
  entry: WebQueued,
  hooks?: { onLine?: (line: unknown) => void; onResult?: (r: MessageResponse | PhotoLast) => void },
): Promise<string | void> {
  // OLDER KEPT TURNS GO FIRST: with anything of this account's still waiting, this one joins the end
  // rather than reaching the server ahead of turns said before it (`joinsQueue`).
  const attempted = entry.userId === "" || !joinsQueue(outbox.entries, entry.userId);
  if (attempted) {
    try {
      const r = await sendTurn(entry, hooks?.onLine);
      answered(r);
      // The first-meal flow needs the result itself — a logged meal IS its next screen, and a
      // proposal is confirmed on the spot rather than left as a card nobody is looking at.
      hooks?.onResult?.(r);
      return;
    } catch (err) {
      if (entry.userId === "" || !noAnswer(err)) throw err;
    }
  }
  try {
    await outbox.add(entry);
  } catch (err) {
    // Tried and lost: it may have gone through, and the words for that are the caller's. Never tried:
    // nothing went anywhere, and "check before sending it again" would be the wrong advice.
    if (!attempted) throw new Said(notSaved());
    throw err;
  }
  // At once, and NOT awaited: `turn()` holds every control until its write settles, and a drain can
  // be minutes of other turns.
  void flush();
  return heldAhead(outbox.entries, entry.userId) ? behind() : kept();
}

/**
 * Send what is kept, in order, for whoever is signed in. A turn kept for ANOTHER account goes: its
 * session ended here without a sign-out, and somebody else is using this browser now.
 */
export async function flush(): Promise<void> {
  if (!signedIn() || outbox.entries.length === 0) return;
  // WHOSE BEARER THIS IS NOW, asked rather than remembered: a 401 re-mints from whatever session the
  // browser holds, and a sign-in in another tab changes that — this page's profile would still name
  // the old account, and the drain would send its turns under the new one.
  const me = await api<ProfileResponse>("/profile").catch(() => null);
  if (me === null) return;
  const uid = me.profile.user_id;
  for (const e of outbox.entries) if (e.userId !== uid) await outbox.discard(e.id).catch(() => {});
  await outbox.drain(uid);
}

// ── The route table and the renderer ──────────────────────────────────────────────────────────

/** What a screen gets from the frame: the profile render() already fetched. */
export interface Frame {
  me: ProfileResponse | null;
}
export type ScreenFn = (frame: Frame) => Promise<HTMLElement> | HTMLElement;

const exactScreens = new Map<string, ScreenFn>();
const prefixScreens: [string, ScreenFn][] = [];

/**
 * Register a screen. `#/chat` binds exactly; `#/meal/` binds the PREFIX so `#/meal/:id` is one
 * line (W6). `#/` is the fallthrough: an unclaimed route lands on Home, as it always has.
 */
export function screen(hash: string, fn: ScreenFn): void {
  if (hash.endsWith("/") && hash !== "#/") prefixScreens.push([hash, fn]);
  else exactScreens.set(hash, fn);
}

/** Whether a hash names a screen that exists — a tab never points at a route nobody serves. */
export const hasScreen = (hash: string): boolean => exactScreens.has(hash);

const screenFor = (route: string, frame: Frame): Promise<HTMLElement> | HTMLElement => {
  const fn = exactScreens.get(route)
    ?? prefixScreens.find(([prefix]) => route.startsWith(prefix))?.[1]
    ?? exactScreens.get("#/");
  if (fn === undefined) throw new Error("no #/ screen registered");
  return fn(frame);
};

/**
 * Which draw owns the page. Every `render()` takes the next number and gives up at each await it
 * comes back from to find a newer one: a hash change while the first draw was still waiting on the
 * profile otherwise left BOTH to append their nav and their screen — two tab bars, two bodies.
 */
let drawing = 0;

export async function render(): Promise<void> {
  const mine = ++drawing;
  const app = clear(root());
  // Signed in or not, the page sits in the same frame (Register P's `wtop`/`wmain`): the bar — the
  // row only once there is a session to lose it over — over the one quiet column. `wmain`'s
  // two-column form is W4's; every surface today's code draws is the boards' one-column `one`.
  const wrap = el("div", "wmain one");
  // The column's content is the page's MAIN landmark — a screen reader jumps straight to it.
  const body = el("main", "wcol");
  wrap.append(body);
  if (!signedIn()) { app.append(chrome(null), wrap); body.append(signInScreen()); return; }

  const route = location.hash || "#/";
  // The profile BEFORE the navigation, because whether the admin tab exists is on it. Drawing the
  // bar first and adding a tab a moment later is a menu that moves under the cursor.
  try {
    await profile();
  } catch (err) {
    if (mine !== drawing) return;
    if (err instanceof Unauthenticated) { app.append(chrome(null), wrap); body.append(signInScreen()); return; }
  }
  if (mine !== drawing) return;
  app.append(chrome(route), wrap);
  body.textContent = COPY.loading;
  try {
    const screen = await screenFor(route, { me: profileCache });
    if (mine !== drawing) return;
    clear(body).append(screen);
    // Whatever was kept the last time this browser had no connection, now that there is a session.
    void flush();
  } catch (err) {
    if (mine !== drawing) return;
    if (err instanceof Unauthenticated) { await render(); return; }
    // The message, not the object: an error from deep in a stack can carry a prompt, and a prompt
    // can carry what somebody typed about their health.
    clear(body).append(el("p", "error", COPY.somethingWrong));
    console.error(err);
  }
}

/**
 * The wiring the page lives by: the outbox's events to the screen's redraw, the connection coming
 * back to the flush, the hash to the renderer. Called once, from `main.ts`.
 */
export function start(): void {
  outbox.subscribe((event) => {
    if (event?.kind === "sent") answered(event.result);
    if (event !== undefined) void redraw?.().catch(() => {});
  });

  // BACK ONLINE: the session first if this page lost it on the way (a bearer re-mint fails
  // offline), then everything kept. A connection that comes back without the browser noticing — a
  // server that was down, an edge that answered 502 — is what the interval is for.
  addEventListener("online", () => {
    void (async () => {
      // Signed out on the way (a re-mint failed offline), or a screen that could not load: drawn again.
      if (!signedIn() || root().querySelector("p.error")) { if (!signedIn()) await signIn().catch(() => {}); await render(); }
      await flush();
    })();
  });
  setInterval(() => { if (outbox.entries.length > 0) void flush(); }, 30_000);

  addEventListener("hashchange", () => { void render(); });

  // The session cookie is HttpOnly, so "am I signed in" is a question only the server can answer.
  // Asking once at boot is what turns a page load into a session.
  signIn().catch(() => {}).finally(() => { void render(); });
}
