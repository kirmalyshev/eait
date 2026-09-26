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
import { renderableVerdicts, verdictMood } from "../shared/types.ts";
import { verdictPillLabel } from "../shared/verdicts.ts";
import { spudSvg, type MascotMood } from "../shared/mascot.ts";
// The one-meal flow's Spud lines — ONE table both clients read (#42): the phone through
// `chatCopyFor(lang).firstMeal`, the browser through this module. It is small on purpose: a
// module the browser imports ships whole, so this imports types and nothing else.
import { FIRST_MEAL_COPY } from "../shared/first-meal-copy.ts";
import type { Answered, MealAnalysis, MealLogged, MealProposed, MealRecord, PendingPhoto } from "@eait/shared";
import type {
  ChatEntry, ChatHistoryResponse, DayResponse, DeleteLineResponse, EditLineLast, EditMealResponse,
  MessageResponse, OUTCOME_UNKNOWN,
  PairCodeResponse, PatchProfileRequest, PendingMealsResponse, PendingResponse, PhotoLast, PhotoProgress,
  ProfileResponse, ROUTES, WeekResponse,
} from "@eait/shared/contract";
import { ApiError, Unauthenticated, api, apiStream, forget, signIn, signOut, signedIn } from "./api.ts";
import { fillCopy as fill, webCopyFor, type WebCopy } from "./copy.ts";
import { firstMealEdit, type Portion } from "./portion.ts";
import { LANGS_READY, LANG_LABEL, LANG_TAG, UNIT_KCAL, narrowLang, numbers, wholeNumbers } from "../shared/lang.ts";
import type { Lang } from "../shared/types.ts";

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
let lang: Lang = narrowLang(typeof navigator === "undefined" ? null : navigator.language);
let COPY: WebCopy = webCopyFor(lang);
if (typeof document !== "undefined") document.documentElement.lang = lang;
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
const WEEK: Under<typeof ROUTES.week> = "/diary/week";
// The parameterised routes' `ReturnType` widens to `string`, so these name the shape directly —
// still the path `ROUTES` spells, under `/api/v1`.
const MEAL: (id: string) => `/meals/${string}` = (id) => `/meals/${encodeURIComponent(id)}`;
const CONFIRM: (id: string) => `/meals/pending/${string}/confirm` = (id) => `${PENDING}/${encodeURIComponent(id)}/confirm`;

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
const profile = async (): Promise<ProfileResponse> => {
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

function chrome(active: string): HTMLElement {
  const nav = el("nav", "nav");
  for (const [href, label] of [["#/", COPY.navDiary], ["#/chat", COPY.navChat]] as const) {
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
    const a = el("a", "tab", COPY.navAdmin) as HTMLAnchorElement;
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
  // THE PICKER, in the chrome beside Sign out — this client has no Settings screen, and the nav is
  // the only thing on every page. It writes through `PATCH /v1/profile`, the one path any surface
  // uses, and then RELOADS rather than re-rendering: `lang` is read by forty render functions and
  // by `profileCache`, and a reload is the one way to be sure none of them kept the old one.
  //
  // Only `LANGS_READY` is offered. A language whose every screen would fall back to English is one
  // where choosing it looks like a bug rather than like a missing translation.
  const picker = document.createElement("select");
  picker.className = "lang";
  picker.setAttribute("aria-label", COPY.language);
  for (const code of LANGS_READY) {
    const option = document.createElement("option");
    option.value = code;
    // The endonym, never translated: a list of languages written in the one you are leaving is the
    // one list you cannot read.
    option.textContent = LANG_LABEL[code];
    option.selected = code === lang;
    picker.append(option);
  }
  picker.addEventListener("change", () => {
    const chosen = picker.value as Lang;
    picker.disabled = true;
    void api<ProfileResponse>("/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lang: chosen } satisfies PatchProfileRequest),
    })
      .then(() => { location.reload(); })
      .catch((err: unknown) => {
        console.error(err);
        // Put the control back where the server still has it, so it never claims a language the
        // account does not hold.
        picker.value = lang;
        picker.disabled = false;
      });
  });
  nav.append(picker);

  const out = el("button", "link", COPY.signOut) as HTMLButtonElement;
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
const kcal = (n: number): string => `${wholeNumbers(lang)(n)} ${UNIT_KCAL[lang]}`;

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

  const head = el("div", "card day-card");
  // A 52px STRIP rather than a hero region. At 1360 wide a full-height wash is a wall of green, and
  // every word on it has to be near-black, so it can hold a date and nothing else.
  // A HEADING, not a decorated div: it is the only thing naming this card, and `app-offline.pw.ts`
  // finds the day by its role.
  head.append(el("h2", "day-wash", COPY.today));
  const body = el("div", "day-body");
  head.append(body);
  // WHAT IS LEFT IS THE HEADLINE, eaten/target the context under it — the same arithmetic as the
  // phone's (`dayBudget`), so the two can never round the one number apart.
  const budget = dayBudget(day, today, me.profile.goal);
  const n = wholeNumbers(lang);
  if (budget.state === "unlogged") {
    body.append(el("p", "muted", fill(COPY.targetLine, {
      target: kcal(budget.target), protein: n(budget.protein.target),
    })));
  } else {
    const big = el("p", budget.warn ? "big warn" : "big");
    // PRECISION CARRIES THE CONFIDENCE. "about" sits immediately before the figure it governs and
    // OUTSIDE its span: the figure is mono, the word is not, and a mono word-space is a full mono
    // advance. The unit is a third span for the same reason.
    // The spaces are IN the text, not between the spans: adjacent elements have no whitespace
    // between them, and `app-diary.pw.ts` reads this line as one string.
    if (budget.guessed) big.append(el("span", "about", `${COPY.about} `));
    big.append(
      el("span", "hero mono", n(budget.kcal)),
      el("span", "muted", ` ${UNIT_KCAL[lang]} ${budget.state === "left" ? COPY.budgetLeft : budget.state === "over" ? COPY.budgetOver : COPY.budgetUnder}`),
    );
    // Native, so there is nothing to draw by hand; hidden, because the line under it says it in words.
    const bar = document.createElement("progress");
    bar.max = 1;
    bar.value = budget.fill;
    bar.setAttribute("aria-hidden", "true");
    const eaten = el("p", "muted", fill(COPY.eatenLine, {
      eaten: n(budget.eaten), target: kcal(budget.target),
      protein: n(budget.protein.eaten), proteinTarget: n(budget.protein.target),
    }));
    body.append(big, bar, eaten);
  }
  // THE FLOOR IS A STATUS LINE, and the one place blue is spent on this screen. Never a tick on a
  // scale and never a region on a chart: both were range machinery.
  const stat = el("div", "stat");
  stat.append(el("span", "floor", fill(
    me.basis.floorApplied ? COPY.floorHeld : COPY.floorClear,
    { floor: n(me.basis.floorKcal) },
  )));
  body.append(stat);
  // THE WEIGHT BEHIND THE TARGET, AND WHEN IT WAS WEIGHED (#609). The phone syncs a newer one on
  // every launch and the target moves with it. Never "from Apple Health": the profile does not say
  // which source wrote it. Days are counted on the server's calendar, like `today`.
  const { weight_kg: kg, weight_measured_at: at } = me.profile;
  // NaN when never weighed or unreadable, which drops the "weighed" clause rather than throwing in
  // `format` and taking the whole diary down with it.
  const weighed = Date.parse(at ?? "");
  const days = Number.isNaN(weighed) ? null
    : Math.max(0, (Date.parse(today) - Date.parse(calendar.format(weighed))) / 86_400_000);
  // `Intl.RelativeTimeFormat` in the READER's language, not in "en" — it was the one formatter on
  // this page with a locale hard-coded into it, and "2 days ago" under a German diary reads as a
  // half-finished translation rather than as one missing string.
  body.append(el("p", "muted", kg === null
    ? COPY.connectHealth
    : days === null
      ? fill(COPY.weightLine, { kg: numbers(lang)(kg) })
      : fill(COPY.weightLineWhen, {
          kg: numbers(lang)(kg),
          when: new Intl.RelativeTimeFormat(LANG_TAG[lang], { numeric: "auto" }).format(-days, "day"),
        })));
  wrap.append(head);

  if (day.meals.length === 0) {
    wrap.append(el("p", "muted", COPY.nothingToday));
    return wrap;
  }
  // A TABLE, WHICH IS THE SECOND THING THIS WINDOW DOES THAT A PHONE CANNOT. A phone shows four
  // rows and a total; this shows the one guess sitting in a list of measured things, which is the
  // strongest statement of the mechanism anywhere in the product.
  //
  // ONE WORDED FLAG IS NOT NEEDED HERE. Every guessed row already says so in its own figure, and a
  // table makes the amber row visible as a row rather than as a sentence.
  const table = document.createElement("table");
  table.className = "meals";
  const thead = document.createElement("thead");
  const hrow = document.createElement("tr");
  for (const [label, cls] of [[COPY.colTime, ""], [COPY.colMeal, ""], [COPY.colKcal, "num"]] as const) {
    const th = document.createElement("th");
    th.className = cls;
    th.textContent = label;
    hrow.append(th);
  }
  thead.append(hrow);
  const tbody = document.createElement("tbody");
  for (const meal of day.meals) {
    const guessed = meal.confidence === "low" && !meal.corrected;
    const tr = document.createElement("tr");
    if (guessed) tr.className = "guessed";
    const time = document.createElement("td");
    time.className = "mono muted";
    time.textContent = new Intl.DateTimeFormat(LANG_TAG[lang], {
      timeZone: me.timezone, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(meal.ts));
    // `MealRecord` extends `MealAnalysis`, so the items and the numbers are ON the row rather than
    // under an `analysis` key. Naming the first two items is what makes a list of numbers read as
    // a list of meals.
    const named = meal.items.slice(0, 2).map((i) => i.name).join(", ");
    const name = document.createElement("td");
    name.textContent = named === "" ? COPY.meal : named;
    const num = document.createElement("td");
    num.className = "num";
    if (guessed) num.append(el("span", "about", `${COPY.about} `));
    num.append(el("span", "mono", wholeNumbers(lang)(meal.kcal)));
    tr.append(time, name, num);
    tbody.append(tr);
  }
  table.append(thead, tbody);
  wrap.append(table);
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
        : entry.text ?? COPY.photo;
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
          const edit = el("button", "", COPY.edit) as HTMLButtonElement;
          edit.setAttribute("aria-label", `${COPY.edit}: ${named}`);
          edit.addEventListener("click", () => {
            const card = entries.find((e) => e.kind === "meal" && e.mealId === entry.mealId);
            editing = { id: entry.id, photos: (card && card.kind === "meal" ? card.meal?.photos : null) ?? 0 };
            caption.value = entry.text ?? "";
            arm();
            caption.focus();
          });
          li.append(edit);
        }
        const del = el("button", "", COPY.delete) as HTMLButtonElement;
        del.setAttribute("aria-label", `${COPY.delete}: ${named}`);
        del.addEventListener("click", () => {
          const ok = isMeal ? confirm(COPY.confirmDeleteMeal) : confirm(COPY.confirmDeleteLine);
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
      li.append(el("p", "", e.kind === "photo" ? (e.text ? fill(COPY.photoWithCaption, { text: e.text }) : COPY.photo) : e.text ?? ""));
      if (e.held === undefined) {
        li.append(el("p", "muted", COPY.waitingToSend));
      } else {
        // A turn the server may have run is worded as the doubt it is, never as "try again" beside a
        // button that sends it again under a new id.
        li.append(el("p", "muted", outcomeUnknown(e.held.kind)
          ? unclear()
          : refusalWords(new ApiError(0, { error: e.held.kind, ...(e.held.scope ? { scope: e.held.scope } : {}) }, "held"))));
        const again = el("button", "", COPY.sendAgain) as HTMLButtonElement;
        again.addEventListener("click", () => turn(() => outbox.resend(e.id, uid!)));
        const drop = el("button", "", COPY.discard) as HTMLButtonElement;
        // Discarding a held head lets whatever waited behind it go.
        drop.addEventListener("click", () => turn(async () => { await outbox.discard(e.id); void flush(); }));
        li.append(again, drop);
      }
      list.append(li);
    }
    clear(thread).append(entries.length === 0 && kept.length === 0 ? el("p", "muted", COPY.noMessages) : list);
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
        if (wrap.isConnected) await draw();
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
  };

  function proposalCard(p: MealProposed): HTMLElement {
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
            if (verb === "cancel") { held = null; card.remove(); return; }
            throw new Said(COPY.logRetry);
          }
          if (!(err instanceof ApiError && err.status === 410)) throw err;
          // 410: no longer held, and never will be again, so the card goes rather than offering a
          // dead button. For COPY.notThis that is the outcome that was asked for, and it says nothing.
          held = null;
          if (verb === "confirm") { card.remove(); throw err; }
          return;
        }
        // The card goes with its offer, not only when the redraw after it succeeds (#529): a failed
        // thread fetch left COPY.sent under a card still offering Log it.
        held = null;
        card.remove();
        // A confirm got there first and its answer never came back: the meal stays logged.
        if (verb === "cancel" && r.kind === "logged") return COPY.alreadyLogged;
      }));
      card.append(b);
    }
    return card;
  }

  const words = textField(COPY.composerPlaceholder);
  const say = el("form", "composer") as HTMLFormElement;
  say.append(words, el("button", "primary", COPY.send));
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
  picker.setAttribute("aria-label", COPY.photosOfOneMeal);
  const caption = textField(COPY.caption);
  const shoot = el("form", "composer") as HTMLFormElement;
  const count = el("span", "muted", "");
  const send = el("button", "", COPY.sendPhoto) as HTMLButtonElement;
  const cancel = el("button", "", COPY.cancel) as HTMLButtonElement;
  cancel.hidden = true;
  cancel.type = "button";
  cancel.addEventListener("click", () => { editing = null; caption.value = ""; picker.value = ""; arm(); });
  /** The composer as the mode says: an edit shows what it has, asks for angles to ADD, and sends. */
  const arm = (): void => {
    count.textContent = editing ? fill(COPY.photosOnMeal, { n: `${editing.photos}` }) : "";
    // Hidden rather than merely empty: an empty inline `<span>` still takes up its own gap in the
    // flex-wrapped row (`.composer { gap: .5rem }`), which showed as a stray space before Send.
    count.hidden = editing === null;
    send.textContent = editing ? COPY.send : COPY.sendPhoto;
    cancel.hidden = editing === null;
  };
  shoot.append(count, picker, caption, send, cancel);
  shoot.addEventListener("submit", (e) => {
    e.preventDefault();
    const files = [...(picker.files ?? [])];
    if (editing === null && files.length === 0) { tell(COPY.choosePhotoFirst); return; }
    // THE SERVER'S NUMBERS, off the profile, never compiled in: they differ between environments,
    // and a person should hear "too many" before the upload rather than after it.
    if (me !== null) {
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
        form.append("text", caption.value.trim());
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
    if (notice.textContent === kept() || notice.textContent === behind()) tell(keptNotice(uid));
  };
  wrap.append(thread, notice, say, el("h2", "photo-lead", COPY.orPhotograph), shoot, progress);
  // What the turn that was out said, if it answered after its own screen was gone.
  // A kept turn's notice carried from a screen that is gone is decided again now: minutes may have
  // passed, and the turn may have gone meanwhile.
  if (carried !== null) { tell(carried === kept() || carried === behind() ? keptNotice(uid) : carried); carried = null; }
  return wrap;
}

// ── The first meal (#42): "one meal on us", in the diary's place ────────────────────────────────
//
// While the account has logged nothing, `#/` is this flow rather than the diary — the v5 boards
// (20-first-meal, 21/21t, 22/22c, 23-paywall-after): the ask, the photo drop or the typed meal,
// the first verdict, the correction, and the offer that holds. Two rules the boards do not carry
// and this client keeps:
//
//   - THE VERDICTS ARE THE SERVER'S. `verdicts` is recomputed after every write and the card
//     renders what `renderableVerdicts` finds in what it was sent — a client that derived its own
//     would be the second copy `verdictsFromTargets` exists to prevent.
//   - "Correct meal" is the MANUAL edit, `PATCH /v1/meals/:id`, which is uncharged. The sample is
//     ONE analysis, so a text correction through `/v1/messages` would be a second billed turn and
//     a 402 on the screen where it matters most. `firstMealEdit` (`portion.ts`) builds the request.

/** Which gradient id the next Spud gets — two inline SVGs on one page may not share one. */
let spudSeq = 0;

/**
 * Spud plus the beat and the big line — the `spk` block every v5 board opens with.
 *
 * The mascot arrives as a STRING (`spudSvg` is the one drawing every web surface shares), parsed
 * rather than built node by node. It is a compile-time constant we wrote, not server or user
 * content — which is the whole of what "text, never innerHTML" exists to keep off the page.
 */
function spudBlock(mood: MascotMood, beat: string | null, lines: readonly string[]): HTMLElement {
  const row = el("div", "spk");
  const av = el("span", "av");
  av.append(new DOMParser().parseFromString(spudSvg(mood, `spud-${++spudSeq}`), "image/svg+xml").documentElement);
  const col = el("div", "spk-col");
  if (beat !== null) col.append(el("div", "beat", beat));
  for (const [i, line] of lines.entries()) col.append(el("div", i === lines.length - 1 ? "ask" : "them", line));
  row.append(av, col);
  return row;
}

/**
 * The one-meal flow itself: a container that re-renders one step at a time, keeping the whole walk
 * off the hash — a "first verdict" is a state, not an address anybody should land on later.
 */
function firstMealScreen(me: ProfileResponse): HTMLElement {
  // The words that ARE the flow, from the one table both clients read (#42) — `photo` is the
  // phone's camera line and stays unused here: the web's button is its own "Upload a photo".
  const fm = FIRST_MEAL_COPY[lang];
  const wrap = el("section", "flow");
  const stage = el("div", "");
  const notice = el("p", "notice");
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  const progress = el("p", "muted");
  progress.hidden = true;
  wrap.append(stage, notice, progress);

  const say = (words: string | null): void => {
    notice.textContent = words ?? "";
    notice.hidden = words === null;
  };
  const sayProgress = (words: string | null): void => {
    progress.textContent = words ?? "";
    progress.hidden = words === null;
  };
  const show = (node: HTMLElement): void => { clear(stage).append(node); };

  /**
   * One turn at a time, every control disabled while it is out — the same rule `turn()` keeps on
   * the composer, for the same reason: a second send of a meal is a second meal. A
   * `subscription-required` refusal here is not an error to word but the flow's own last screen:
   * the free analysis is spent, and the offer is the answer to that.
   */
  const run = (work: () => Promise<void>): void => {
    const controls = [...wrap.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>("input, button, select, textarea")];
    for (const c of controls) c.disabled = true;
    say(null);
    void (async () => {
      try {
        await work();
      } catch (err) {
        if (err instanceof Unauthenticated) { await render(); return; }
        if (err instanceof ApiError && err.body?.error === "subscription-required") { show(offerStep()); return; }
        say(refusalWords(err));
        console.error(err);
      } finally {
        for (const c of controls) c.disabled = false;
      }
    })();
  };

  /**
   * Spud's greeting, read back off the thread the write just produced: `firstVerdictLines` on the
   * first meal, the correction line on an edit. Rendered rather than re-derived — the words are
   * the server's, in the account's language, and a second computation here would be the second
   * copy the contract forbids.
   */
  const greeting = async (mealId: string): Promise<string[]> => {
    const thread = await api<ChatHistoryResponse>(`${MESSAGES}?limit=30`).catch(() => null);
    if (thread === null) return [];
    const at = thread.entries.findIndex((e) => e.kind === "meal" && e.mealId === mealId);
    if (at === -1) return [];
    return thread.entries.slice(at + 1)
      .flatMap((e) => (e.role === "assistant" && e.kind === "text" ? [e.text] : []));
  };

  const askStep = (): HTMLElement => {
    const box = el("div", "step");
    box.append(spudBlock("wave", fm.react, [fm.ask]));
    const foot = el("div", "step-foot");
    const up = el("button", "cta p", COPY.firstMealUpload) as HTMLButtonElement;
    up.addEventListener("click", () => show(photoStep()));
    const typed = el("button", "cta s", fm.tell) as HTMLButtonElement;
    typed.addEventListener("click", () => show(typeStep()));
    foot.append(up, typed);
    box.append(foot);
    return box;
  };

  const photoStep = (): HTMLElement => {
    const box = el("div", "step");
    box.append(spudBlock("idle", null, [COPY.firstPhotoAsk]));
    // A LABEL around the input, so the whole zone opens the chooser natively — a click needs no
    // script, and drag-and-drop is the affordance on top of it.
    const zone = el("label", "drop");
    const input = el("input", "visually-hidden") as HTMLInputElement;
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.multiple = true;
    input.setAttribute("aria-label", COPY.photosOfOneMeal);
    const lead = el("span", "drop-lead", COPY.dropPhotoHere);
    zone.append(lead, el("small", "", COPY.dropPhotoKinds), input);
    let picked: File[] = [];
    const reflect = (): void => {
      lead.textContent = picked.length === 0 ? COPY.dropPhotoHere : picked.map((f) => f.name).join(", ");
    };
    input.addEventListener("change", () => { picked = [...(input.files ?? [])]; reflect(); });
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("over");
      picked = [...(e.dataTransfer?.files ?? [])];
      reflect();
    });
    box.append(zone);
    const foot = el("div", "step-foot");
    const go = el("button", "cta p", COPY.analyseMeal) as HTMLButtonElement;
    go.addEventListener("click", () => {
      if (picked.length === 0) { say(COPY.choosePhotoFirst); return; }
      // The server's numbers off the profile, exactly as the composer reads them — never a
      // constant of ours.
      const { maxPhotosPerMeal, maxUploadBytes } = me.limits;
      if (picked.length > maxPhotosPerMeal) { say(fill(COPY.photosMax, { n: `${maxPhotosPerMeal}` })); return; }
      if (picked.reduce((n, f) => n + f.size, 0) > maxUploadBytes) { say(COPY.photoTooLarge); return; }
      const files = picked;
      run(async () => {
        // The stream's own progress line — the same `pendingLine` the composer shows while the
        // analyzer is out.
        let p: PendingPhoto = { glance: null, items: [] };
        sayProgress(pendingLine(p, lang));
        try {
          // A PROPERTY, not a local: writes from the callback must survive `await` without a
          // compiler that has already decided `null`.
          const got: { logged: MealLogged | null } = { logged: null };
          const keptNote = await sendOrKeep(
            { id: crypto.randomUUID(), userId: me.profile.user_id, kind: "photo", text: null, photos: files, capturedAt: new Date().toISOString() },
            {
              onLine: (line) => {
                const ev = line as PhotoProgress;
                if (ev.kind === "glance" || ev.kind === "item") {
                  p = advancePending(p, ev);
                  sayProgress(pendingLine(p, lang));
                }
              },
              onResult: (r) => { if (r.kind === "logged") got.logged = r; },
            },
          );
          if (got.logged !== null) { show(await verdictStep(got.logged.analysis, got.logged.mealId)); return; }
          if (keptNote !== undefined) say(keptNote);
        } finally {
          sayProgress(null);
        }
      });
    });
    foot.append(go);
    box.append(foot);
    return box;
  };

  const typeStep = (): HTMLElement => {
    const box = el("div", "step");
    box.append(spudBlock("idle", null, [COPY.firstTypeAsk]));
    const panel = el("div", "card");
    const lab = el("label", "lab", COPY.yourMeal);
    lab.setAttribute("for", "fm-meal");
    const field = textField(COPY.composerPlaceholder);
    field.id = "fm-meal";
    panel.append(lab, field);
    box.append(panel);
    const foot = el("div", "step-foot");
    const send = el("button", "cta p", COPY.send) as HTMLButtonElement;
    send.addEventListener("click", () => {
      const text = field.value.trim();
      if (text === "") return;
      run(async () => {
        const got: { result: MealProposed | Answered | null } = { result: null };
        const keptNote = await sendOrKeep(
          { id: crypto.randomUUID(), userId: me.profile.user_id, kind: "text", text, photos: [], capturedAt: new Date().toISOString() },
          { onResult: (r) => { if (r.kind === "proposed" || r.kind === "answered") got.result = r; } },
        );
        if (got.result === null) { if (keptNote !== undefined) say(keptNote); return; }
        // An answered question is Spud's reply, shown where it was asked — it logs nothing.
        if (got.result.kind === "answered") { say(got.result.text); return; }
        // A typed meal is PROPOSED first, and this screen is the confirmation — the ask already
        // said what it was, so a second tap would ask the same thing again. The proposal was the
        // billed call; confirming it costs nothing.
        const c = await api<PendingResponse>(CONFIRM(got.result.pendingId), { method: "POST" });
        // Refusals and "expired" come back as HTTP statuses; a JSON body here is the meal.
        if (c.kind !== "logged") throw new ApiError(200, { error: c.kind }, `confirm: ${c.kind}`);
        held = null;
        show(await verdictStep(c.analysis, c.mealId));
      });
    });
    foot.append(send);
    box.append(foot);
    return box;
  };

  const verdictStep = async (analysis: MealAnalysis, mealId: string): Promise<HTMLElement> => {
    const box = el("div", "step");
    // The face follows the computed pills, never praise the card does not back.
    box.append(spudBlock(verdictMood(analysis.verdicts), COPY.firstVerdictBeat, await greeting(mealId)));
    const card = el("div", "card");
    card.append(el("div", "lab", names(analysis.items)));
    const big = el("p", "big");
    if (analysis.confidence === "low") big.append(el("span", "about", `${COPY.about} `));
    big.append(el("span", "hero mono", wholeNumbers(lang)(analysis.kcal)), el("span", "muted", ` ${UNIT_KCAL[lang]}`));
    card.append(big);
    const stats = el("div", "stats");
    for (const [label, v] of [[COPY.statProtein, analysis.protein_g], [COPY.statCarbs, analysis.carbs_g], [COPY.statFat, analysis.fat_g]] as const) {
      const cell = el("div", "stat-cell");
      cell.append(el("div", "lab", label), el("div", "stat-num mono", `${numbers(lang)(v)} g`));
      stats.append(cell);
    }
    card.append(stats);
    // The verdicts, EXACTLY as the server computed them — rederived here they would be a second
    // implementation, and a wrong one the moment the caps moved.
    const dims = renderableVerdicts(analysis.verdicts);
    if (dims.length > 0) {
      const pills = el("div", "pills");
      for (const d of dims) pills.append(el("span", `pill ${analysis.verdicts[d]}`, verdictPillLabel(d, analysis.verdicts[d]!, lang)));
      card.append(pills);
    }
    box.append(card);
    const foot = el("div", "step-foot");
    const keep = el("button", "cta p", fm.keepGoing) as HTMLButtonElement;
    keep.addEventListener("click", () => show(offerStep()));
    const fix = el("button", "cta g", fm.correct) as HTMLButtonElement;
    fix.addEventListener("click", () => show(correctStep(analysis, mealId)));
    foot.append(keep, fix);
    box.append(foot);
    return box;
  };

  const correctStep = (analysis: MealAnalysis, mealId: string): HTMLElement => {
    const box = el("div", "step");
    box.append(spudBlock("think", COPY.correctBeat, [COPY.correctAsk]));
    const fields = el("div", "card");
    const whatLab = el("label", "lab", COPY.correctWhat);
    whatLab.setAttribute("for", "fm-what");
    const what = textField(COPY.correctWhat);
    what.id = "fm-what";
    // "What it was" names the plate — the first item, which is what the card leads with; the rest
    // of the plate is kept, per the brief.
    what.value = analysis.items[0]?.name ?? "";
    const portionLab = el("label", "lab", COPY.correctPortion);
    portionLab.setAttribute("for", "fm-portion");
    const portion = el("select", "portion") as HTMLSelectElement;
    portion.id = "fm-portion";
    for (const [value, label] of [["small", COPY.portionSmall], ["regular", COPY.portionRegular], ["large", COPY.portionLarge]] as const) {
      const option = el("option", "", label) as HTMLOptionElement;
      option.value = value;
      option.selected = value === "regular";
      portion.append(option);
    }
    fields.append(whatLab, what, portionLab, portion);
    box.append(fields);
    const foot = el("div", "step-foot");
    const save = el("button", "cta p", COPY.saveRecheck) as HTMLButtonElement;
    save.addEventListener("click", () => {
      run(async () => {
        const r = await api<EditMealResponse>(MEAL(mealId), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(firstMealEdit(analysis, what.value, portion.value as Portion)),
        });
        // "target-gone" and the refusals are statuses; a JSON body here is the updated meal.
        if (r.kind !== "updated") throw new ApiError(200, { error: r.kind }, `edit: ${r.kind}`);
        show(await verdictStep(r.analysis, r.mealId));
      });
    });
    foot.append(save);
    box.append(foot);
    return box;
  };

  const offerStep = (): HTMLElement => {
    const box = el("div", "step");
    // The spec's screen title as the beat, the canonical ask over the offer that holds.
    box.append(spudBlock("idle", COPY.offerAsk, [fm.afterAsk]));
    const perks = el("div", "perks");
    for (const perk of [COPY.offerPerkVerdict, COPY.offerPerkPlan, COPY.offerPerkSpud]) {
      const row = el("div", "perk");
      row.append(el("span", "tick", "✓"), el("span", "", perk));
      perks.append(row);
    }
    box.append(perks);
    const tl = el("div", "card");
    for (const [when, words] of [[COPY.offerToday, COPY.offerTodayText], [COPY.offerBeforeEnd, COPY.offerBeforeText], [COPY.offerDay8, COPY.offerDay8Text]] as const) {
      const row = el("div", "rowline");
      row.append(el("span", "when", when), el("span", "muted", words));
      tl.append(row);
    }
    box.append(tl);
    // The plans are NAMED, never priced: this client has never been sent a price, and the checkout
    // page the link lands on is what owns the numbers.
    const plans = el("div", "plans");
    for (const p of [COPY.offerPlanMonthly, COPY.offerPlanLifetime]) plans.append(el("div", "plan", p));
    box.append(plans);
    const foot = el("div", "step-foot");
    // `/start/checkout`, not the checkout URL itself: the backend fills this account's id into the
    // configured checkout from the `/start` session, same origin, so no client ever carries it —
    // the one paid link both offers share.
    const go = el("a", "cta p", COPY.startFreeWeek) as HTMLAnchorElement;
    go.href = "/start/checkout";
    const later = el("button", "cta g", COPY.offerLater) as HTMLButtonElement;
    // "Not now" re-renders: a meal exists by now, so the gate opens the diary it belongs on.
    later.addEventListener("click", () => { void render(); });
    foot.append(go, later);
    box.append(foot);
    return box;
  };

  // A queued turn landing mid-flow changes the gate's answer: redraw → render → the diary it is
  // on now.
  redraw = async () => { if (wrap.isConnected) await render(); };

  show(askStep());
  return wrap;
}

/**
 * The diary, or — while the account has never logged — the one-meal flow (#42).
 *
 * THE GATE IS A READ, not a flag: `/v1/diary/week` answers only days that have meals on them
 * ("empty means absent, not zero"), so an empty window over the whole diary horizon the server
 * will reach back to IS "nothing logged yet" — asked at the server's own `diaryWindowDays`, never
 * a compiled-in copy.
 */
/**
 * The free meal is offered to exactly the account that still has it: onboarded, not entitled, the
 * sample unspent (the SERVER's count — a failed attempt leaves it unspent, #44), and nothing logged.
 * "No meals this week" alone would offer a paying user back from a holiday one meal on us.
 */
async function homeScreen(me: ProfileResponse | null): Promise<HTMLElement> {
  if (me?.onboarded === true && !me.entitlement.active && !me.limits.sampleUsed) {
    const marked = await api<WeekResponse>(`${WEEK}?days=${me.limits.diaryWindowDays}`);
    if (marked.days.length === 0) return firstMealScreen(me);
  }
  return diaryScreen();
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
/** The table, per language. Keyed exactly as it was; the words moved to `copy.ts`. */
const refusalWordsFor = (): Record<string, string> => COPY.refusals;

/**
 * A turn whose answer never arrived. The connection went, or the edge gave up waiting, and the
 * server may have run the turn to the end regardless — so never "try again", which would pay for a
 * meal twice and log it twice.
 */
const maybeLanded = (): string => COPY.refusals["maybe-landed"]!;

/**
 * An answer that came back unable to say whether the meal was logged: the stream's last line when
 * the server failed mid-turn, which can be after the insert (#514). Not "no answer came back".
 */
const unclear = (): string => COPY.refusals["unclear"]!;
/** That line's kind, spelled as the contract spells it: a type import, so nothing is bundled. */
const UNKNOWN: typeof OUTCOME_UNKNOWN = "outcome-unknown";

/** Words a handler has already chosen for its own failure. `refusalWords` passes them through. */
class Said extends Error {}

function refusalWords(err: unknown): string {
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
const names = (items: readonly { name: string }[]): string =>
  items.slice(0, 2).map((i) => i.name).join(", ") || COPY.meal;

/** What an assistant meal card says in the thread, from the meal it still points at. */
function mealLine(meal: MealRecord | null): string {
  // Null once the meal is deleted, and the id outlives it deliberately — so the thread says
  // something rather than rendering an empty bubble.
  if (meal === null) return COPY.mealGone;
  return `${names(meal.items)} — ${kcal(meal.kcal)}`;
}

/** What a turn kept for later says, once, under the composer (#708). No cause: offline and an edge are both this. */
const kept = (): string => COPY.kept;
/** The same, when what is ahead of it waits on a decision rather than on a connection. */
const behind = (): string => COPY.keptBehind;
/** A turn that joined the queue without being tried, and could not be saved: nothing went anywhere. */
const notSaved = (): string => COPY.notSaved;

/** Whether anything of `uid`'s is still waiting to go on its own. */
const waitingFor = (uid: string | null): boolean => uid !== null && joinsQueue(outbox.entries, uid);

/**
 * A kept turn's notice, from the queue AS IT IS NOW — never the moment the turn was kept: a turn ahead
 * held since makes it BEHIND, and nothing left waiting means it went. One decision for the notice a
 * turn reports and the one a redraw corrects, so the two cannot disagree.
 */
const keptNotice = (uid: string | null): string | null =>
  !waitingFor(uid) ? null : heldAhead(outbox.entries, uid!) ? behind() : kept();

/** The chat screen's redraw while it is up, so a queued turn answered in the background shows. */
let redraw: (() => Promise<void>) | null = null;

/**
 * What a turn's answer changes on this page: a proposal is held until it is logged or dropped. A
 * kept turn cannot answer after a newer one — a turn said while kept ones wait joins their end
 * (`sendOrKeep`) — so the newest to arrive is the newest asked for, a COPY.sendAgain included.
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
async function sendOrKeep(
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
  const body = el("div", "body", COPY.loading);
  app.append(body);
  try {
    // `homeScreen` is the diary, or the one-meal flow while the account has never logged (#42).
    const screen = route === "#/chat" ? await chatScreen() : await homeScreen(await profile());
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

addEventListener("hashchange", () => { void render(); });

// The session cookie is HttpOnly, so "am I signed in" is a question only the server can answer.
// Asking once at boot is what turns a page load into a session.
signIn().catch(() => {}).finally(() => { void render(); });
