// Today — the diary, and the gate that hands a fresh account the first-meal flow instead. Home in
// the boards' navigation (`web/today.html`); the register's own layout of it is W4's — this is the
// screen as it already was, moved whole out of `main.ts` (#87).

import { dateMinus } from "../../shared/dates.ts";
import { dayBudget, macroTone } from "../../shared/budget.ts";
import { renderableVerdicts } from "../../shared/types.ts";
import { verdictNoun, verdictPillLabel } from "../../shared/verdicts.ts";
import { LANG_TAG, UNIT_KCAL, numbers, spellUnit, wholeNumbers } from "../../shared/lang.ts";
import type {
  DayResponse, PendingMealsResponse, ProfileResponse, WeekResponse,
} from "@eait/shared/contract";
import { api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { firstMealScreen } from "./first-meal.ts";
import { shellCopyFor } from "../../shared/app/shell-copy.ts";
import {
  COPY, PENDING, WEEK, composerRow, el, clear, heldProposal, kcal, lang, profile,
  proposalCard, sendOrKeep, setHeldProposal, takeTurn,
} from "../shell.ts";


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
  const uid = me.profile.user_id;

  // THE DAY THE SWITCHER IS LOOKING AT — today until a chevron moves it (#71). `/v1/diary/day`
  // answers for any date, so the only bound is the future, which has no diary yet.
  let viewing = today;
  // A stored `YYYY-MM-DD` carries no time: formatting it at midday UTC keeps it from slipping a
  // day either way — the same trick `dayLabel` uses for its own date.
  const dayFmt = new Intl.DateTimeFormat(LANG_TAG[lang], {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
  });
  const dateText = (d: string): string => dayFmt.format(new Date(`${d}T12:00:00Z`));

  const notice = el("p", "notice");
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  const tell = (words: string | null): void => {
    notice.textContent = words ?? "";
    notice.hidden = words === null;
  };

  // The day's own content — the switcher, the head card, the rows, a proposal the composer is
  // holding — is what a turn redraws; the composer and the notice below stay put.
  const board = el("div", "");
  // A chevron tapped twice queues two draws; the newer one wins, as `drawing` does for `render()`.
  let dayDrawing = 0;

  /** The day as the server now has it, redrawn after every write. */
  async function draw(): Promise<void> {
    const mine = ++dayDrawing;
    const day = await api<DayResponse>(`/diary/day?date=${viewing}`);
    if (mine !== dayDrawing) return;

    // THE DATE SWITCHER, on a white bar at the top of the view: the chevrons at the two ends, the
    // day centred between them. Its label is the ONE place the date is written — a relative day
    // carries its name with the date as a quiet sub-line, and any other day's name IS the date,
    // so nothing is ever printed twice.
    const daybar = el("div", "daybar");
    const prev = el("button", "daybtn", "‹") as HTMLButtonElement;
    prev.type = "button";
    prev.setAttribute("aria-label", COPY.dayPrev);
    prev.addEventListener("click", () => { viewing = dateMinus(viewing, 1); void draw(); });
    const next = el("button", "daybtn", "›") as HTMLButtonElement;
    next.type = "button";
    next.setAttribute("aria-label", COPY.dayNext);
    next.disabled = viewing >= today;
    next.addEventListener("click", () => {
      if (viewing >= today) return;
      viewing = dateMinus(viewing, -1);
      void draw();
    });
    const rel = viewing === today ? COPY.today
      : viewing === dateMinus(today, 1) ? COPY.yesterday
      : null;
    const label = el("div", "daylabel");
    // A HEADING, not a decorated div: it is the only thing naming the day on this screen, and
    // `app-offline.pw.ts` finds the day by its role.
    label.append(el("h2", "dayname", rel ?? dateText(viewing)));
    if (rel !== null) label.append(el("p", "daysub muted", dateText(viewing)));
    daybar.append(prev, label, next);

    const head = el("div", "card");
    const body = el("div", "");
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
      // OUTSIDE its span: the figure keeps the face's own spacing, so a leading "about" does not
      // render with a hole in it. The unit is a third span for the same reason.
      // The spaces are IN the text, not between the spans: adjacent elements have no whitespace
      // between them, and `app-diary.pw.ts` reads this line as one string.
      if (budget.guessed) big.append(el("span", "about", `${COPY.about} `));
      big.append(
        el("span", "hero num", n(budget.kcal)),
        el("span", "muted", ` ${UNIT_KCAL[lang]} ${budget.state === "left" ? COPY.budgetLeft : budget.state === "over" ? COPY.budgetOver : COPY.budgetUnder}`),
      );
      // Native, so there is nothing to draw by hand; hidden, because the line under it says it in words.
      const bar = document.createElement("progress");
      bar.max = 1;
      bar.value = budget.fill;
      bar.setAttribute("aria-hidden", "true");
      const eaten = el("p", "muted", fill(COPY.eatenLine, {
        eaten: n(budget.eaten), target: kcal(budget.target),
      }));
      // THE MACRO COUNTERS (#71): the label stays neutral and the eaten/target figures take the
      // tone `macroTone` computes — one rule for both clients, on the palette's tokens, never
      // plain black. Saturated fat exists only for a declared restriction, like its target.
      const g = spellUnit(lang, "g");
      const counter = (name: string, macroEaten: number, macroTarget: number, kind: "protein" | "satfat"): HTMLElement => {
        const cell = el("div", "stat-cell macro");
        cell.append(
          el("div", "lab", name),
          el("div", `stat-num num tone-${macroTone(kind, macroEaten, macroTarget)}`, `${n(macroEaten)} / ${n(macroTarget)} ${g}`),
        );
        return cell;
      };
      const counters = el("div", "stats macros");
      counters.append(counter(COPY.statProtein, budget.protein.eaten, budget.protein.target, "protein"));
      if (day.targets.satfat_g !== undefined) {
        counters.append(counter(verdictNoun("ldl", lang),
          Math.round(day.totals.satfat_g), Math.round(day.targets.satfat_g), "satfat"));
      }
      body.append(big, bar, eaten, counters);
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

    const parts: HTMLElement[] = [daybar, head];
    if (day.meals.length === 0) {
      parts.push(el("p", "muted", COPY.nothingToday));
    } else {
      // A TABLE, WHICH IS THE SECOND THING THIS WINDOW DOES THAT A PHONE CANNOT. A phone shows four
      // rows and a total; this shows the one guess sitting in a list of measured things, which is
      // the strongest statement of the mechanism anywhere in the product.
      //
      // ONE WORDED FLAG IS NOT NEEDED HERE. Every guessed row already says so in its own figure,
      // and a table makes the amber row visible as a row rather than as a sentence.
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
        time.className = "num muted";
        time.textContent = new Intl.DateTimeFormat(LANG_TAG[lang], {
          timeZone: me.timezone, hour: "2-digit", minute: "2-digit", hour12: false,
        }).format(new Date(meal.ts));
        // `MealRecord` extends `MealAnalysis`, so the items and the numbers are ON the row rather
        // than under an `analysis` key. Naming the first two items is what makes a list of numbers
        // read as a list of meals.
        const named = meal.items.slice(0, 2).map((i) => i.name).join(", ");
        const name = document.createElement("td");
        name.textContent = named === "" ? COPY.meal : named;
        // The row's pills are the meal's OWN verdicts — computed by the server on the write and
        // sent on the row (#52). A client that derived its own would be the second copy
        // `verdictsFromTargets` exists to prevent.
        const dims = renderableVerdicts(meal.verdicts);
        if (dims.length > 0) {
          const pills = el("span", "pills");
          for (const d of dims) pills.append(el("span", `pill ${meal.verdicts[d]!}`, verdictPillLabel(d, meal.verdicts[d]!, lang)));
          name.append(pills);
        }
        const num = document.createElement("td");
        num.className = "num";
        if (guessed) num.append(el("span", "about", `${COPY.about} `));
        num.append(el("span", "num", wholeNumbers(lang)(meal.kcal)));
        tr.append(time, name, num);
        tbody.append(tr);
      }
      table.append(thead, tbody);
      parts.push(table);
    }
    // A proposal the composer's text turn is holding stands on the diary too — the diary is where
    // the meal lands. Same rules as the thread's: answered by the row it made, or by its clock.
    const held = heldProposal();
    if (held !== null && day.meals.some((m) => m.id === held.pendingId)) setHeldProposal(null);
    if (heldProposal() !== null && Date.parse(heldProposal()!.expiresAt) <= Date.now()) setHeldProposal(null);
    if (heldProposal() !== null) parts.push(proposalCard(heldProposal()!, turn));
    clear(board).append(...parts);
  }

  // One write, then the day AS THE SERVER NOW HAS IT — the diary's composer posts like the chat's
  // (#52), so the machinery is `takeTurn` with this screen's notice and redraw handed in.
  const turn = (write: () => Promise<string | void>): void => takeTurn(wrap, tell, draw, uid, write);

  const comp = composerRow(COPY.diaryPlaceholder);
  const { picker, words, send, count } = comp;
  const arm = (): void => {
    const picked = picker.files?.length ?? 0;
    count.textContent = picked > 0 ? `${picked} photo${picked === 1 ? "" : "s"}` : "";
    count.hidden = count.textContent === "";
    send.setAttribute("aria-label", picked > 0 ? COPY.sendPhoto : COPY.send);
  };
  picker.addEventListener("change", arm);
  comp.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const files = [...(picker.files ?? [])];
    const text = words.value.trim();
    if (files.length === 0 && text === "") return;
    // THE SERVER'S NUMBERS, off the profile — the same bounds the chat's composer checks.
    if (files.length > 0) {
      const { maxPhotosPerMeal, maxUploadBytes } = me.limits;
      if (files.length > maxPhotosPerMeal) { tell(fill(COPY.photosMax, { n: `${maxPhotosPerMeal}` })); return; }
      if (files.reduce((n, f) => n + f.size, 0) > maxUploadBytes) { tell(COPY.photoTooLarge); return; }
    }
    turn(async () => {
      // A write always lands on TODAY — `capturedAt` is now — so the redraw shows where it landed,
      // not a past day the switcher was looking at.
      viewing = today;
      if (files.length > 0) {
        const saved = await sendOrKeep({
          id: crypto.randomUUID(), userId: uid, kind: "photo", text: text === "" ? null : text,
          photos: files, capturedAt: new Date().toISOString(),
        });
        picker.value = "";
        words.value = "";
        arm();
        return saved;
      }
      const saved = await sendOrKeep({ id: crypto.randomUUID(), userId: uid, kind: "text", text, photos: [], capturedAt: new Date().toISOString() });
      words.value = "";
      return saved;
    });
  });
  arm();

  // A proposal made on Chat stands here too — read back once, like the thread's, when the page
  // holds nothing of it.
  if (heldProposal() === null) setHeldProposal((await api<PendingMealsResponse>(PENDING).catch(() => null))?.proposals.at(-1) ?? null);
  await draw();
  // One h1 per page, and the boards draw no centred title on web — it stays for the landmark and
  // is clipped rather than shown. The day card's "Today" stays the h2 inside it.
  wrap.append(el("h1", "visually-hidden", shellCopyFor(lang).navHome), board, notice, comp.form);
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
export async function homeScreen(me: ProfileResponse | null): Promise<HTMLElement> {
  if (me?.onboarded === true && !me.entitlement.active && !me.limits.sampleUsed) {
    const marked = await api<WeekResponse>(`${WEEK}?days=${me.limits.diaryWindowDays}`);
    if (marked.days.length === 0) return firstMealScreen(me);
  }
  return diaryScreen();
}
