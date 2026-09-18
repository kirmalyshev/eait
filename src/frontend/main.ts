// The web application — the whole of what a browser runs on app.eait.fit.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// NO FRAMEWORK, AND THAT IS A DECISION RATHER THAN AN OMISSION. This repo already ships a working
// client-side application written exactly this way — `backend/api/admin.page.ts`, twenty-five
// kilobytes of it — so the idiom exists, is understood here, and costs no dependency, no build
// toolchain beyond `bun build`, and no JSX configuration. A framework buys reconciliation; five
// screens that each re-render a container do not need reconciling.
//
// EVERY SERVER CALL GOES THROUGH `api.ts`, which holds the bearer in a closure and speaks only in
// relative paths. Nothing here touches `fetch` directly and nothing here knows the token exists.
// ─────────────────────────────────────────────────────────────────────────────────────────────

// `advancePending`/`pendingLine` come in by RELATIVE PATH (#608), never `@eait/shared`: a package
// import needs `node_modules/@eait/shared`, which exists only after `bun install`, and
// `deploy/Dockerfile.web` builds this bundle with no `bun install` and no `node_modules` at all —
// it copies `shared` in beside `web` for exactly this. `@eait/shared` stays TYPES ONLY, as
// `src/frontend/AGENTS.md` requires; these two functions are the one runtime piece this page needs, and
// a relative import of the file they live in costs nothing the Dockerfile does not already pay for.
import { advancePending, pendingLine } from "../shared/stream.ts";
import { outcomeUnknown } from "../shared/results.ts";
import { dayBudget } from "../shared/budget.ts";
import type { MealProposed, MealRecord, PendingPhoto } from "@eait/shared";
import type {
  ChatEntry, ChatHistoryResponse, DayResponse, DeleteLineResponse, EditLineLast, OUTCOME_UNKNOWN,
  PairCodeResponse, PendingMealsResponse, PendingResponse, PhotoProgress, ProfileResponse, ROUTES,
} from "@eait/shared/contract";
import { ApiError, Unauthenticated, api, apiStream, forget, signIn, signOut, signedIn } from "./api.ts";
import { COPY } from "./copy.ts";
import { noAnswer, outbox, sendTurn, type WebQueued } from "./outbox.ts";
import { heldAhead, joinsQueue } from "../shared/outbox.ts";

/**
 * A contract route as `api()` spells it, under `/api/v1`. A TYPE, so the route is checked against
 * `ROUTES` at typecheck and nothing of the contract reaches the bundle — `ROUTES` is a value, and
 * this workspace imports the shared one for types only.
 */
type Under<P extends string> = P extends `/v1${infer R}` ? R : never;
const MESSAGES: Under<typeof ROUTES.messages> = "/messages";
const MESSAGE: (id: string) => `${Under<typeof ROUTES.messages>}/${string}` = (id) => `${MESSAGES}/${encodeURIComponent(id)}`;
const PENDING: Under<typeof ROUTES.pending> = "/meals/pending";

const root = (): HTMLElement => document.getElementById("app")!;

/** Text, never `innerHTML`, on anything that came from the server or from a person. */
function el(tag: string, className: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const clear = (node: HTMLElement): HTMLElement => { node.replaceChildren(); return node; };

/**
 * The profile, fetched once per signed-in tab.
 *
 * Memoised because two things need it before anything is drawn — the targets on the diary, and
 * whether to offer the admin — and fetching it per screen would ask the server the same question
 * on every tab switch. Cleared on sign-out, because the next person at this browser is not
 * necessarily the same person.
 */
let profileCache: ProfileResponse | null = null;
const profile = async (): Promise<ProfileResponse> =>
  (profileCache ??= await api<ProfileResponse>("/profile"));

function chrome(active: string): HTMLElement {
  const nav = el("nav", "nav");
  for (const [href, label] of [["#/", "Diary"], ["#/chat", "Chat"]] as const) {
    const a = el("a", href === active ? "tab on" : "tab", label) as HTMLAnchorElement;
    a.href = href;
    nav.append(a);
  }
  if (profileCache?.isAdmin === true) {
    // A full navigation, not a route: the admin is a server-rendered page of its own, on this same
    // origin and behind the same sign-in.
    //
    // ADVISORY. The server checks the role again on every request under /admin, so setting the flag
    // by hand in a console buys a menu entry with nothing behind it.
    const a = el("a", "tab", "Admin") as HTMLAnchorElement;
    a.href = "/admin";
    nav.append(a);
  }
  const bot = profileCache?.telegramBot ?? null;
  if (bot !== null) {
    // The code is minted at the TAP, not when the page is drawn: it lives five minutes, and the bot
    // has to receive it inside them. A navigation, so no CSP directive is involved in leaving.
    const tg = el("button", "link", COPY.connectTelegram) as HTMLButtonElement;
    tg.addEventListener("click", () => {
      tg.disabled = true;
      void api<PairCodeResponse>("/auth/pair", { method: "POST" })
        .then(({ code }) => { location.assign(`https://t.me/${bot}?start=${code}`); })
        .catch((err: unknown) => { console.error(err); tg.textContent = COPY.telegramFailed; })
        .finally(() => { tg.disabled = false; });
    });
    nav.append(tg);
  }
  const out = el("button", "link", "Sign out") as HTMLButtonElement;
  out.addEventListener("click", () => {
    void (async () => {
      // The turns this browser was keeping are the account's, photos included: they do not stay
      // behind for whoever uses it next. First, so a sign-out the network refuses still takes them.
      // A storage that refuses (blocked, corrupt) must not keep the person signed in.
      await outbox.clear().catch(() => {});
      await signOut();
      profileCache = null;
      held = null;
      lastThread = [];
      location.hash = "#/";
      await render();
    })();
  });
  nav.append(out);
  return nav;
}

/** The front door for anybody this browser cannot prove is signed in. */
function signInScreen(): HTMLElement {
  const box = el("section", "card");
  box.append(el("h1", "", "eait"));
  box.append(el("p", "muted", "Photograph a meal, get the numbers. Sign in to pick up your diary."));
  // A LINK, NOT A FETCH. `/start` is a server-rendered flow that ends by setting the session
  // cookie, and it is the only thing on this origin that can authenticate anybody.
  const a = el("a", "primary", "Sign in") as HTMLAnchorElement;
  a.href = "/start";
  box.append(a);
  return box;
}

const kcal = (n: number): string => `${Math.round(n)} kcal`;

async function diaryScreen(): Promise<HTMLElement> {
  const wrap = el("section", "");
  // THE SERVER'S CALENDAR DAY, NOT UTC's, and not this device's either.
  //
  // `toISOString().slice(0, 10)` is the UTC date: after 22:00 in Berlin it names yesterday, so
  // between midnight and 02:00 the page asked for the previous day and put "Today" above it — with
  // yesterday's totals against today's target. The server dates every meal in `config.timezone` and
  // sends it in the profile precisely so a client stops guessing.
  const me = await profile();
  const calendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: me.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const today = calendar.format(new Date());
  const day = await api<DayResponse>(`/diary/day?date=${today}`);

  const head = el("div", "card");
  head.append(el("h2", "", "Today"));
  // WHAT IS LEFT IS THE HEADLINE, eaten/target the context under it — the same arithmetic as the
  // phone's (`dayBudget`), so the two can never round the one number apart.
  const budget = dayBudget(day, today, me.profile.goal);
  if (budget.state === "unlogged") {
    head.append(el("p", "muted", `Target ${kcal(budget.target)} · ${budget.protein.target} g protein`));
  } else {
    const big = el("p", budget.warn ? "big warn" : "big");
    big.append(el("span", "hero", String(budget.kcal)), el("span", "muted", ` kcal ${budget.state}`));
    // Native, so there is nothing to draw by hand; hidden, because the line under it says it in words.
    const bar = document.createElement("progress");
    bar.max = 1;
    bar.value = budget.fill;
    bar.setAttribute("aria-hidden", "true");
    head.append(big, bar, el("p", "muted",
      `${budget.eaten} of ${kcal(budget.target)} eaten · ${budget.protein.eaten} of ${budget.protein.target} g protein`));
  }
  // THE FLOOR IS SURFACED, because the contract says it must be. A target that was raised to the
  // floor is a different promise from one the numbers produced, and the app that hides which is
  // the one that ends up quoted in a review.
  if (me.basis.floorApplied) {
    head.append(el("p", "muted", COPY.floor));
  }
  // THE WEIGHT BEHIND THE TARGET, AND WHEN IT WAS WEIGHED (#609). The phone syncs a newer one on
  // every launch and the target moves with it. Never "from Apple Health": the profile does not say
  // which source wrote it. Days are counted on the server's calendar, like `today`.
  const { weight_kg: kg, weight_measured_at: at } = me.profile;
  // NaN when never weighed or unreadable, which drops the "weighed" clause rather than throwing in
  // `format` and taking the whole diary down with it.
  const weighed = Date.parse(at ?? "");
  const days = Number.isNaN(weighed) ? null
    : Math.max(0, (Date.parse(today) - Date.parse(calendar.format(weighed))) / 86_400_000);
  head.append(el("p", "muted", kg === null
    ? COPY.connectHealth
    : `Weight ${Math.round(kg * 10) / 10} kg` +
      (days === null ? "." : `, weighed ${new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(-days, "day")}.`)));
  wrap.append(head);

  if (day.meals.length === 0) {
    wrap.append(el("p", "muted", "Nothing logged yet today."));
    return wrap;
  }
  const list = el("ul", "meals");
  for (const meal of day.meals) {
    const li = el("li", "meal");
    // `MealRecord` extends `MealAnalysis`, so the items and the numbers are ON the row rather than
    // under an `analysis` key. Naming the first two items is what makes a list of numbers read as
    // a list of meals.
    const named = meal.items.slice(0, 2).map((i) => i.name).join(", ");
    li.append(el("span", "meal-name", named === "" ? "Meal" : named));
    li.append(el("span", "meal-kcal", kcal(meal.kcal)));
    list.append(li);
  }
  wrap.append(list);
  return wrap;
}

/**
 * The proposal a text turn is holding, until it is logged or dropped.
 *
 * Not a thread line until it is confirmed — the server writes the card only then — so the page
 * keeps it from the turn's own answer. Module state, so redrawing the thread does not lose it; and
 * cleared on sign-out, because the next person at this browser did not propose it.
 */
let held: MealProposed | null = null;

/** The thread as the server last sent it, drawn again when it cannot be asked. Cleared on sign-out. */
let lastThread: ChatEntry[] = [];

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

async function chatScreen(): Promise<HTMLElement> {
  // ONE TURN AT A TIME ACROSS SCREENS, not only within one: wait for the turn still out, so the
  // thread drawn below already holds what it did.
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
      lastThread = (await api<ChatHistoryResponse>(`${MESSAGES}?limit=30`)).entries;
    } catch (err) {
      if (err instanceof Unauthenticated) throw err;
      unread = err;
    }
    const entries = lastThread;
    const list = el("ul", "thread");
    for (const entry of entries) {
      const li = el("li", entry.role === "user" ? "line mine" : "line theirs");
      // One arm at a time. A meal card is a card, not a sentence, and a photo line may carry no words.
      const text = entry.kind === "meal"
        ? mealLine(entry.meal)
        : entry.text ?? "Photo";
      li.append(el("p", "", text));
      // OWN LINES ONLY (#608): Edit on a photo line that still names a meal, Delete on any of them.
      if (entry.role === "user") {
        // `lineIsMeal`'s rule: a confirmed proposal is stored under the proposal's id.
        const isMeal = entry.kind === "photo"
          ? entry.mealId !== null
          : entry.pendingId !== null && entries.some((e) => e.kind === "meal" && e.mealId === entry.pendingId);
        // A label VoiceOver can act on without reading the bubble first, truncated so a long line
        // does not turn the button's own name into a paragraph.
        const named = text.length > 40 ? `${text.slice(0, 40)}…` : text;
        if (isMeal && entry.kind === "photo") {
          const edit = el("button", "", "Edit") as HTMLButtonElement;
          edit.setAttribute("aria-label", `Edit: ${named}`);
          edit.addEventListener("click", () => {
            const card = entries.find((e) => e.kind === "meal" && e.mealId === entry.mealId);
            editing = { id: entry.id, photos: (card && card.kind === "meal" ? card.meal?.photos : null) ?? 0 };
            caption.value = entry.text ?? "";
            arm();
            caption.focus();
          });
          li.append(edit);
        }
        const del = el("button", "", "Delete") as HTMLButtonElement;
        del.setAttribute("aria-label", `Delete: ${named}`);
        del.addEventListener("click", () => {
          const ok = isMeal ? confirm("Delete this meal? Its photos and numbers go too.") : confirm("Remove this message? Numbers stay.");
          if (!ok) return;
          turn(async () => {
            await api<DeleteLineResponse>(MESSAGE(entry.id), { method: "DELETE" });
            if (editing?.id === entry.id) { editing = null; arm(); }
          });
        });
        li.append(del);
      }
      list.append(li);
    }
    // KEPT FOR LATER, in the order they go, under everything the server has (#708). Waiting says so;
    // held says what the server said, in the words a live refusal gets, and offers the two ways on.
    const kept = uid === null ? [] : outbox.entries.filter((e) => e.userId === uid);
    for (const e of kept) {
      const li = el("li", "line mine");
      li.append(el("p", "", e.kind === "photo" ? (e.text ? `Photo: ${e.text}` : "Photo") : e.text ?? ""));
      if (e.held === undefined) {
        li.append(el("p", "muted", "Waiting to send"));
      } else {
        // A turn the server may have run is worded as the doubt it is, never as "try again" beside a
        // button that sends it again under a new id.
        li.append(el("p", "muted", outcomeUnknown(e.held.kind)
          ? UNCLEAR
          : refusalWords(new ApiError(0, { error: e.held.kind, ...(e.held.scope ? { scope: e.held.scope } : {}) }, "held"))));
        const again = el("button", "", "Send again") as HTMLButtonElement;
        again.addEventListener("click", () => turn(() => outbox.resend(e.id, uid!)));
        const drop = el("button", "", "Discard") as HTMLButtonElement;
        // Discarding a held head lets whatever waited behind it go.
        drop.addEventListener("click", () => turn(async () => { await outbox.discard(e.id); void flush(); }));
        li.append(again, drop);
      }
      list.append(li);
    }
    clear(thread).append(entries.length === 0 && kept.length === 0 ? el("p", "muted", "No messages yet.") : list);
    // LOGGED ALREADY: a confirm whose answer was lost can still have landed, and the meal then
    // carries the proposal's id (`ChatEntry`, contract.ts), so the card in the thread is its answer.
    const pending = held?.pendingId;
    if (pending !== undefined && entries.some((e) => e.kind === "meal" && e.mealId === pending)) held = null;
    // No longer offered once the server has stopped holding it — `expiresAt` is sent for exactly this
    // (#367). An unreadable moment stays live, as `proposalLive` rules: the analysis is already billed.
    if (held !== null && Date.parse(held.expiresAt) <= Date.now()) held = null;
    if (held !== null) thread.append(proposalCard(held));
    if (unread !== null) throw unread;
  };

  /**
   * One write, then the thread AS THE SERVER NOW HAS IT.
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
   */
  const turn = (write: () => Promise<string | void>): void => {
    const controls = [...wrap.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")];
    for (const c of controls) c.disabled = true;
    tell(null);
    // To this screen while it is up; carried to the next one when it has been rebuilt meanwhile.
    const report = (words: string): void => {
      // A kept turn's notice is decided NOW, from what is still waiting: a replay that answered while
      // this turn was redrawing already took the turn away, and the notice would outlive it.
      if (words === KEPT || words === BEHIND) {
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
        if (wrap.isConnected) await draw();
        if (typeof said === "string") report(said);
      } catch (err) {
        // Cleared BEFORE `render()`: a rebuilt chat screen waits on `outstanding`, and this turn is
        // still it, so waiting here would be the turn waiting on itself.
        if (err instanceof Unauthenticated) { outstanding = null; await render(); return; }
        // A write that landed is never "try again": that would log the meal twice. One that has its
        // own words — a turn kept for later — says those rather than "sent".
        report(wrote ? (typeof said === "string" ? said : "Sent. Reload to see the conversation.") : refusalWords(err));
        if (!wrote) console.error(err);
      } finally {
        for (const c of controls) c.disabled = false;
      }
    })();
    outstanding = run;
    void run.finally(() => { if (outstanding === run) outstanding = null; });
  };

  function proposalCard(p: MealProposed): HTMLElement {
    const card = el("div", "card");
    card.append(el("p", "muted", "Logging this — look right?"));
    card.append(el("p", "", `${names(p.analysis.items)} — ${kcal(p.analysis.kcal)}`));
    for (const [verb, label, className] of [["confirm", "Log it", "primary"], ["cancel", "Not this", ""]] as const) {
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
          if (refusalWords(err) === MAYBE_LANDED) {
            // A lost "Not this" needs no second press: nothing is logged without a confirm, so what
            // was asked for holds whether or not it landed — and offering the card again would put
            // it back under the server's own "Dropped it." (#529).
            if (verb === "cancel") { held = null; card.remove(); return; }
            throw new Said("No answer came back. Press Log it again: it cannot log the meal twice.");
          }
          if (!(err instanceof ApiError && err.status === 410)) throw err;
          // 410: no longer held, and never will be again, so the card goes rather than offering a
          // dead button. For "Not this" that is the outcome that was asked for, and it says nothing.
          held = null;
          if (verb === "confirm") { card.remove(); throw err; }
          return;
        }
        // The card goes with its offer, not only when the redraw after it succeeds (#529): a failed
        // thread fetch left "Sent" under a card still offering Log it.
        held = null;
        card.remove();
        // A confirm got there first and its answer never came back: the meal stays logged.
        if (verb === "cancel" && r.kind === "logged") return "That one was already logged.";
      }));
      card.append(b);
    }
    return card;
  }

  const words = textField("What did you eat?");
  const say = el("form", "composer") as HTMLFormElement;
  say.append(words, el("button", "primary", "Send"));
  say.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = words.value.trim();
    if (text === "") return;
    turn(async () => {
      const saved = await sendOrKeep({ id: crypto.randomUUID(), userId: uid ?? "", kind: "text", text, photos: [], capturedAt: new Date().toISOString() });
      words.value = "";
      return saved;
    });
  });

  // `accept=` is a hint to the chooser and transcodes nothing: an iPhone's library hands a browser
  // HEIC as happily as it once handed the app. The server refuses it before charging (415), and
  // that refusal is what a person reads.
  const picker = el("input", "") as HTMLInputElement;
  picker.type = "file";
  picker.accept = "image/jpeg,image/png,image/webp";
  picker.multiple = true;
  picker.setAttribute("aria-label", "Photos of one meal");
  const caption = textField("Anything I should know? (optional)");
  const shoot = el("form", "composer") as HTMLFormElement;
  const count = el("span", "muted", "");
  const send = el("button", "", "Send the photo") as HTMLButtonElement;
  const cancel = el("button", "", "Cancel") as HTMLButtonElement;
  cancel.hidden = true;
  cancel.type = "button";
  cancel.addEventListener("click", () => { editing = null; caption.value = ""; picker.value = ""; arm(); });
  /** The composer as the mode says: an edit shows what it has, asks for angles to ADD, and sends. */
  const arm = (): void => {
    count.textContent = editing ? `${editing.photos} photo${editing.photos === 1 ? "" : "s"} · add angles:` : "";
    // Hidden rather than merely empty: an empty inline `<span>` still takes up its own gap in the
    // flex-wrapped row (`.composer { gap: .5rem }`), which showed as a stray space before Send.
    count.hidden = editing === null;
    send.textContent = editing ? "Send" : "Send the photo";
    cancel.hidden = editing === null;
  };
  shoot.append(count, picker, caption, send, cancel);
  shoot.addEventListener("submit", (e) => {
    e.preventDefault();
    const files = [...(picker.files ?? [])];
    if (editing === null && files.length === 0) { tell("Choose a photo first."); return; }
    // THE SERVER'S NUMBERS, off the profile, never compiled in: they differ between environments,
    // and a person should hear "too many" before the upload rather than after it.
    if (me !== null) {
      const { maxPhotosPerMeal, maxUploadBytes } = me.limits;
      // `stored`, never `held`: the module-level `held` above is the text-turn's pending PROPOSAL,
      // and shadowing its name here for an unrelated photo count is exactly the kind of collision
      // that reads fine today and is a bug the day somebody needs both in the same block.
      const stored = editing?.photos ?? 0;
      if (stored + files.length > maxPhotosPerMeal) { tell(`One meal takes up to ${maxPhotosPerMeal} photos.`); return; }
      if (files.reduce((n, f) => n + f.size, 0) > maxUploadBytes) { tell("That photo is too large to send."); return; }
    }
    turn(async () => {
      // Several files are ANGLES OF ONE MEAL, `photo` fields like the app's.
      const form = new FormData();
      for (const f of files) form.append("photo", f);
      if (editing !== null) {
        // AN EDIT (#608): the same multipart, `text` rather than `caption`, PATCH on the line. The
        // analyzer re-reads every photo with the new words; the line and the card change in place.
        form.append("text", caption.value.trim());
        let p: PendingPhoto = { glance: null, items: [] };
        progress.textContent = pendingLine(p);
        progress.hidden = false;
        try {
          const r = await apiStream<EditLineLast>(MESSAGE(editing.id), { method: "PATCH", body: form }, (line) => {
            const ev = line as PhotoProgress;
            if (ev.kind === "glance" || ev.kind === "item") { p = advancePending(p, ev); progress.textContent = pendingLine(p); }
          });
          if (r.kind === UNKNOWN) throw new Said(UNCLEAR);
          // GONE OR UNEDITABLE: the composer drops out of edit mode before the throw, because
          // `turn`'s catch only reports words — it never redraws — so a composer left armed here
          // would go on offering "Send" against an id the next PATCH answers `target-gone` again.
          // `target-gone` also redraws NOW: the line it names has vanished from the thread the
          // server would return, and `turn` only redraws on a write that returns rather than throws.
          if (r.kind === "target-gone") {
            editing = null;
            arm();
            await draw();
            throw new Said("That message is gone.");
          }
          if (r.kind === "bad-request") {
            editing = null;
            arm();
            throw new Said("That message cannot be edited.");
          }
          // TOO-MANY keeps edit mode: the meal is still there, still being edited, and dropping an
          // angle and pressing Send again is the whole recovery — there is nothing to reset.
          if (r.kind === "too-many") throw new Said(`One meal takes up to ${r.limit} photos.`);
          if (r.kind !== "updated") throw new ApiError(200, { error: r.kind, ...("scope" in r ? { scope: r.scope } : {}) }, `edit: ${r.kind}`);
        } finally {
          progress.hidden = true;
        }
        editing = null;
        picker.value = "";
        caption.value = "";
        arm();
        return;
      }
      // Refused IN the stream, with the 200 already sent, is thrown by `sendTurn` as any other refusal.
      const saved = await sendOrKeep({
        id: crypto.randomUUID(), userId: uid ?? "", kind: "photo", text: caption.value.trim() || null, photos: files,
        capturedAt: new Date().toISOString(),
      });
      picker.value = "";
      caption.value = "";
      return saved;
    });
  });
  arm();

  // A PROPOSAL OUTLIVES THE PAGE (#530). `held` is page memory, so a reload, a sign-in round trip or
  // a closed tab lost the card while the server still held the proposal, and describing the meal
  // again is a second paid analysis. Read back once, when this screen opens holding nothing: the
  // newest the server holds, which `draw` drops like any other once a card in the thread answers it.
  // A failed read is no card, as before.
  if (held === null) held = (await api<PendingMealsResponse>(PENDING).catch(() => null))?.proposals.at(-1) ?? null;
  // Offline, the screen still opens: on the thread it last had, the turns it is keeping, and a
  // composer that keeps what is sent.
  await draw().catch((err: unknown) => { if (err instanceof Unauthenticated) throw err; });
  // A queued turn answered while this screen is up redraws it: the logged meal, the held refusal.
  redraw = async () => {
    if (!wrap.isConnected) return;
    await draw();
    // Nothing of this account's left waiting: the promise the notice made is kept, so it goes.
    // A kept turn's notice follows the queue, not the moment it was kept: a turn ahead that is held
    // later means this one now waits on a decision, and nothing left waiting means it went.
    if (notice.textContent === KEPT || notice.textContent === BEHIND) tell(keptNotice(uid));
  };
  wrap.append(thread, notice, say, el("h2", "photo-lead", "Or photograph it"), shoot, progress);
  // What the turn that was out said, if it answered after its own screen was gone.
  // A kept turn's notice carried from a screen that is gone is decided again now: minutes may have
  // passed, and the turn may have gone meanwhile.
  if (carried !== null) { tell(carried === KEPT || carried === BEHIND ? keptNotice(uid) : carried); carried = null; }
  return wrap;
}

function textField(placeholder: string): HTMLInputElement {
  const input = el("input", "") as HTMLInputElement;
  input.type = "text";
  input.autocomplete = "off";
  input.placeholder = placeholder;
  input.setAttribute("aria-label", placeholder);
  return input;
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
const REFUSAL_WORDS: Record<string, string> = {
  "subscription-required": "The analyses this account came with are used up. Subscribe in the eait app to carry on.",
  "cap-user": "That was your last one today — your daily allowance resets at midnight.",
  "cap-global": "Everyone has used today's allowance. Tomorrow is a fresh number.",
  "cap-address": "Too many from this network — not you, this connection. Try again later.",
  "rate-limited": "Too many from this network — not you, this connection. Try again later.",
  "unsupported-image": "That file is not a photo this can read. JPEG, PNG or WebP.",
  "not-food": "That did not look like food.",
  "analysis-failed": "That did not come back. Try it again.",
  "not-onboarded": "Answer the plan questions first.",
  expired: "That one is no longer being held. Say it again.",
  // No meal is ever open on this page, so the meal did not vanish mid-turn — nothing was in focus.
  "target-gone": "There is no meal open here to change. Open it in the app, or say what you ate and log it again.",
  "too many photos": "That is more angles than one meal can have.",
  "too large": "That photo is too large to send.",
  "text too long": "That message is too long to send.",
  "caption too long": "That message is too long to send.",
};

/**
 * A turn whose answer never arrived. The connection went, or the edge gave up waiting, and the
 * server may have run the turn to the end regardless — so never "try again", which would pay for a
 * meal twice and log it twice.
 */
const MAYBE_LANDED = "No answer came back, and it may still have gone through. Reload to check before sending it again.";

/**
 * An answer that came back unable to say whether the meal was logged: the stream's last line when
 * the server failed mid-turn, which can be after the insert (#514). Not "no answer came back".
 */
const UNCLEAR = "That did not finish cleanly, and it may still have been logged. Reload to check before sending it again.";
/** That line's kind, spelled as the contract spells it: a type import, so nothing is bundled. */
const UNKNOWN: typeof OUTCOME_UNKNOWN = "outcome-unknown";

/** Words a handler has already chosen for its own failure. `refusalWords` passes them through. */
class Said extends Error {}

function refusalWords(err: unknown): string {
  if (err instanceof Said) return err.message;
  if (!(err instanceof ApiError)) return MAYBE_LANDED;
  // The server failed mid-turn, maybe after the meal was logged (#514). An answer did come back, so
  // the doubt is named.
  if (err.body?.error === UNKNOWN) return UNCLEAR;
  const said = (code: string): string | undefined =>
    Object.hasOwn(REFUSAL_WORDS, code) ? REFUSAL_WORDS[code] : undefined;
  const code = String(err.body?.error);
  // WHOSE cap is the scope's to say, and a cap that names none claims nobody's (#158).
  if (code === "cap-exceeded") return said(`cap-${String(err.body?.scope)}`) ?? "That's the limit for now. Try again later.";
  // A 5xx with no code of ours is the edge, not this server, answering: the same unknown as a drop.
  return said(code) ?? (err.status >= 500 ? MAYBE_LANDED : "Something went wrong. Try again.");
}

/** What a meal is called on one line: its first two items. */
const names = (items: readonly { name: string }[]): string =>
  items.slice(0, 2).map((i) => i.name).join(", ") || "Meal";

/** What an assistant meal card says in the thread, from the meal it still points at. */
function mealLine(meal: MealRecord | null): string {
  // Null once the meal is deleted, and the id outlives it deliberately — so the thread says
  // something rather than rendering an empty bubble.
  if (meal === null) return "A meal that is no longer logged";
  return `${names(meal.items)} — ${kcal(meal.kcal)}`;
}

/** What a turn kept for later says, once, under the composer (#708). No cause: offline and an edge are both this. */
const KEPT = "Saved on this device. It goes on its own as soon as it can.";
/** The same, when what is ahead of it waits on a decision rather than on a connection. */
const BEHIND = "Saved on this device. It goes once the message above that is waiting for you has been sent again or discarded.";
/** A turn that joined the queue without being tried, and could not be saved: nothing went anywhere. */
const NOT_SAVED = "That could not be saved on this device, and it was not sent. Try again.";

/** Whether anything of `uid`'s is still waiting to go on its own. */
const waitingFor = (uid: string | null): boolean => uid !== null && joinsQueue(outbox.entries, uid);

/**
 * A kept turn's notice, from the queue AS IT IS NOW — never the moment the turn was kept: a turn ahead
 * held since makes it BEHIND, and nothing left waiting means it went. One decision for the notice a
 * turn reports and the one a redraw corrects, so the two cannot disagree.
 */
const keptNotice = (uid: string | null): string | null =>
  !waitingFor(uid) ? null : heldAhead(outbox.entries, uid!) ? BEHIND : KEPT;

/** The chat screen's redraw while it is up, so a queued turn answered in the background shows. */
let redraw: (() => Promise<void>) | null = null;

/**
 * What a turn's answer changes on this page: a proposal is held until it is logged or dropped. A
 * kept turn cannot answer after a newer one — a turn said while kept ones wait joins their end
 * (`sendOrKeep`) — so the newest to arrive is the newest asked for, a "Send again" included.
 */
function answered(r: { kind: string }): void {
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
async function sendOrKeep(entry: WebQueued): Promise<string | void> {
  // OLDER KEPT TURNS GO FIRST: with anything of this account's still waiting, this one joins the end
  // rather than reaching the server ahead of turns said before it (`joinsQueue`).
  const attempted = entry.userId === "" || !joinsQueue(outbox.entries, entry.userId);
  if (attempted) {
    try {
      answered(await sendTurn(entry));
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
    if (!attempted) throw new Said(NOT_SAVED);
    throw err;
  }
  // At once, and NOT awaited: `turn()` holds every control until its write settles, and a drain can
  // be minutes of other turns.
  void flush();
  return heldAhead(outbox.entries, entry.userId) ? BEHIND : KEPT;
}

/**
 * Send what is kept, in order, for whoever is signed in. A turn kept for ANOTHER account goes: its
 * session ended here without a sign-out, and somebody else is using this browser now.
 */
async function flush(): Promise<void> {
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

outbox.subscribe((event) => {
  if (event?.kind === "sent") answered(event.result);
  if (event !== undefined) void redraw?.().catch(() => {});
});

// BACK ONLINE: the session first if this page lost it on the way (a bearer re-mint fails offline),
// then everything kept. A connection that comes back without the browser noticing — a server that
// was down, an edge that answered 502 — is what the interval is for.
addEventListener("online", () => {
  void (async () => {
    // Signed out on the way (a re-mint failed offline), or a screen that could not load: drawn again.
    if (!signedIn() || root().querySelector("p.error")) { if (!signedIn()) await signIn().catch(() => {}); await render(); }
    await flush();
  })();
});
setInterval(() => { if (outbox.entries.length > 0) void flush(); }, 30_000);

/**
 * Which draw owns the page. Every `render()` takes the next number and gives up at each await it
 * comes back from to find a newer one: a hash change while the first draw was still waiting on the
 * profile otherwise left BOTH to append their nav and their screen — two tab bars, two bodies.
 */
let drawing = 0;

async function render(): Promise<void> {
  const mine = ++drawing;
  const app = clear(root());
  if (!signedIn()) { app.append(signInScreen()); return; }

  const route = location.hash || "#/";
  // The profile BEFORE the navigation, because whether the admin tab exists is on it. Drawing the
  // bar first and adding a tab a moment later is a menu that moves under the cursor.
  try {
    await profile();
  } catch (err) {
    if (mine !== drawing) return;
    if (err instanceof Unauthenticated) { app.append(signInScreen()); return; }
  }
  if (mine !== drawing) return;
  app.append(chrome(route));
  const body = el("div", "body", "Loading…");
  app.append(body);
  try {
    const screen = route === "#/chat" ? await chatScreen() : await diaryScreen();
    if (mine !== drawing) return;
    clear(body).append(screen);
    // Whatever was kept the last time this browser had no connection, now that there is a session.
    void flush();
  } catch (err) {
    if (mine !== drawing) return;
    if (err instanceof Unauthenticated) { await render(); return; }
    // The message, not the object: an error from deep in a stack can carry a prompt, and a prompt
    // can carry what somebody typed about their health.
    clear(body).append(el("p", "error", "Something went wrong. Try again."));
    console.error(err);
  }
}

addEventListener("hashchange", () => { void render(); });

// The session cookie is HttpOnly, so "am I signed in" is a question only the server can answer.
// Asking once at boot is what turns a page load into a session.
signIn().catch(() => {}).finally(() => { void render(); });
