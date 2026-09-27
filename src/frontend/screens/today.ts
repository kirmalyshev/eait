// Today — Home (`web/today.html`, W4 #91). The boards' two-column diary: the left column holds
// the day label, the meal card, a proposal the composer is holding, and the empty/failed cards;
// the right column (the frame's `side`) holds the week strip, the calorie card, the macro cards
// with their dot switcher and page-2 nutrient set, the health-score row, and — on today — the
// upload CTA plus the in-diary composer.
//
// EVERY WORD THE CARDS DRAW ARRIVES FROM THE SERVER OR FROM `home-copy.ts` — the bundle holds no
// i18n catalog: a meal row's verdict line is `verdictInline`, the proposal's pills are
// `verdictLabels`, and the score is the server's `dayHealthScore`, never recomputed here.

import { dateMinus } from "../../shared/dates.ts";
import { dayBudget } from "../../shared/budget.ts";
import { LANG_TAG, UNIT_KCAL, countText, wholeNumbers } from "../../shared/lang.ts";
import { homeCopyFor, type HomeTargetMacroCopy } from "../../shared/app/home-copy.ts";
import { shellCopyFor } from "../../shared/app/shell-copy.ts";
import { ico, tagx, type ChipName, type WeekDayRow } from "../../shared/ui/kit.ts";
import type { MealProposed, MealRecord } from "@eait/shared";
import type {
  DayResponse, DaysResponse, PendingMealsResponse, PendingResponse, ProfileResponse, WeekResponse,
} from "@eait/shared/contract";
import { api, apiBlob, ApiError, Unauthenticated } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { firstMealScreen } from "./first-meal.ts";
import {
  ctaEl, kitEl, mcardEl, mealRowEl, ringEl, spudAvatarEl, verdictDotEl, weekStripEl,
} from "../kit.ts";
import {
  COPY, DAYS, PENDING, WEEK, Said, behind, clear, el, heldProposal, kcal, kept, keptNotice,
  lang, maybeLanded, names, profile, refusalWords, sendOrKeep, setHeldProposal, setRedraw,
  takeCarried, takeTurn, type Frame,
} from "../shell.ts";

async function diaryScreen(frame: Frame): Promise<HTMLElement> {
  const wrap = el("section", "home");
  const me = await profile();
  const uid = me.profile.user_id;
  const L = homeCopyFor(lang);
  const S = shellCopyFor(lang);
  const n = wholeNumbers(lang);
  const gram = (v: number): string => fill(L.grams, { n: n(v) });
  const count = countText(lang);

  // THE SERVER'S CALENDAR DAY, NOT UTC's, and not this device's either.
  //
  // `toISOString().slice(0, 10)` is the UTC date: after 22:00 in Berlin it names yesterday, so
  // between midnight and 02:00 the page asked for the previous day and put "Today" above it — with
  // yesterday's totals against today's target. The server dates every meal in `config.timezone` and
  // sends it in the profile precisely so a client stops guessing.
  const calendar = new Intl.DateTimeFormat("en-CA", {
    timeZone: me.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  });
  const today = calendar.format(new Date());

  // THE DAY THE STRIP IS LOOKING AT — today until a chevron or a week cell moves it (#71).
  // `/v1/diary/day` answers for any date, so the only bound is the future, which has no diary yet.
  let viewing = today;
  /** The macro page the right column is on: 0 the left-form set, 1 the nutrient set (the dots). */
  let page = 0;
  /** The calorie toggle's other side on today-with-meals: left, or eaten after a tap. */
  let showEaten = false;
  /** The proposal's own message time — known only for a proposal this tab just made (#91's rule). */
  let proposedAt: string | null = null;
  /** A turn in flight — the logging state hides the upload CTA while one runs. */
  let turning = false;
  /** Queued draws collapse to the newest, as `drawing` does for `render()`. */
  let dayDrawing = 0;

  // The boards' date formats: "Thursday 24 September" on the bar and the column's label; the
  // row's time is the account's timezone — the server's figures are already zoned.
  const dayFmt = new Intl.DateTimeFormat(LANG_TAG[lang], {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
  });
  const dateText = (d: string): string => dayFmt.format(new Date(`${d}T12:00:00Z`));
  const timeFmt = new Intl.DateTimeFormat(LANG_TAG[lang], {
    timeZone: me.timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const mealTime = (iso: string): string => timeFmt.format(new Date(iso));

  // The week containing `viewing` — Monday first, as the strips draw.
  const mondayOf = (d: string): string =>
    dateMinus(d, (new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7);

  const h1 = el("h1", "visually-hidden", S.navHome);
  const notice = el("p", "notice");
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  const tell = (words: string | null): void => {
    notice.textContent = words ?? "";
    notice.hidden = words === null;
  };

  // ── The bar: the streak chip, then the date and its arrows ──────────────────────────────

  let barStreak = 0;
  const barRow = (): void => {
    clear(frame.bar);
    // The streak chip goes FIRST — Home's own item sits before the date row, not beside the
    // brand (the boards' wtop, design's ruling on #91).
    if (barStreak > 0) {
      frame.bar.append(kitEl(tagx({
        icon: "streak", text: n(barStreak),
        aria: fill(L.phoneStreakAria, { n: n(barStreak) }),
      })));
    }
    const row = el("span", "homebar");
    const prev = el("button", "darrow") as HTMLButtonElement;
    prev.type = "button";
    prev.setAttribute("aria-label", COPY.dayPrev);
    prev.append(kitEl(ico("chevron-left")));
    prev.addEventListener("click", () => { viewing = dateMinus(viewing, 1); void draw(); });
    const next = el("button", "darrow") as HTMLButtonElement;
    next.type = "button";
    next.setAttribute("aria-label", COPY.dayNext);
    next.disabled = viewing >= today;
    next.append(kitEl(ico("chevron-right")));
    next.addEventListener("click", () => {
      if (viewing >= today) return;
      viewing = dateMinus(viewing, -1);
      void draw();
    });
    row.append(prev, el("span", "dlabel", dateText(viewing)), next);
    frame.bar.append(row);
  };

  // ── The right column ──────────────────────────────────────────────────────────────────

  /**
   * The calorie card. The 104 px toggle — "kcal left ⌄" tapping to eaten — exists ONLY on today
   * with a logged meal (design's ruling); the 96 px detail form covers every other loaded state,
   * and the failed read draws dashes. An over day reads "{n} kcal over" in --bad, as the week
   * strip's rule says it in word and colour.
   */
  const kcalCard = (day: DayResponse | null, interactive: boolean): HTMLElement => {
    const card = el("div", "card kcard");
    const left = el("div", "");
    const kfig = el("b", "num kfig");
    if (day === null) {
      kfig.textContent = "—";
      left.append(kfig, el("span", "klab", fill(L.kcalLeftDetail, { eaten: "—", plan: "—" })));
      card.append(left, ringEl({ share: 0, size: 96, icon: "kcal" }));
      return card;
    }
    const budget = dayBudget(day, today, me.profile.goal);
    // "unlogged" is a past day with nothing on it: the figure is the plan that day had — the
    // compact label says "left" of it, matching the boards' "0 of 1,434" form.
    const figure = budget.state === "unlogged" ? budget.target : budget.kcal;
    kfig.textContent = n(interactive && showEaten ? budget.eaten : figure);
    left.append(kfig);
    if (budget.warn) card.classList.add("over");
    if (interactive) {
      const lab = el("button", "klab ktg") as HTMLButtonElement;
      lab.type = "button";
      lab.setAttribute("aria-label", showEaten ? L.kcalEaten : L.kcalLeft);
      lab.append(
        document.createTextNode(budget.state === "over" ? L.kcalOver : showEaten ? L.kcalEaten : L.kcalLeft),
        kitEl(ico("chevron-down")),
      );
      lab.addEventListener("click", () => { showEaten = !showEaten; void draw(); });
      left.append(lab);
    } else {
      left.append(el("span", "klab", fill(
        budget.state === "over" ? L.kcalOverDetail : L.kcalLeftDetail,
        { eaten: n(budget.eaten), plan: n(budget.target) },
      )));
    }
    card.append(left, ringEl({
      share: budget.fill, size: interactive ? 104 : 96,
      tone: budget.warn ? "bad" : "accent", icon: "kcal",
    }));
    return card;
  };

  /**
   * A left-form macro card — "{n} g" over "{Macro} left" (or "{Macro} over", muted, the ring
   * closed in its own colour, per the overseer's §F.6 default — never red). The share is
   * eaten/target; without a target there is no ring to draw.
   */
  const macroCard = (macro: ChipName, copy: HomeTargetMacroCopy,
    eaten: number, target: number | undefined): Element => {
    const over = target !== undefined && eaten > target;
    return mcardEl({
      macro,
      value: gram(over ? eaten - target : target !== undefined ? target - eaten : eaten),
      label: over ? copy.over : copy.left,
      ...(target !== undefined ? { share: target > 0 ? Math.min(1, eaten / target) : 1 } : {}),
    });
  };

  /**
   * The compact centred card the empty and logging boards draw — the eaten figure over
   * "of {target} {macro}", ringed where a target exists, the flat icon where it does not.
   */
  const ofTargetCard = (macro: ChipName, copy: HomeTargetMacroCopy,
    eaten: number, target: number | undefined): Element =>
    mcardEl({
      macro, centred: true, value: gram(eaten),
      label: target !== undefined ? fill(copy.ofTarget, { target: n(target) }) : copy.name,
      ...(target !== undefined ? { share: target > 0 ? Math.min(1, eaten / target) : 0 } : {}),
    });

  /** A flat nutrient card — page 2's fibre/sugar/sodium carry no ring (no declared cap). */
  const flatCard = (icon: "fibre" | "sugar" | "salt", value: string, label: string): Element =>
    mcardEl({ macro: icon, value, label });

  /**
   * The sodium card when kidneys are declared — the cap's ring is drawn in ink (sodium has no
   * macro colour to borrow) over "Sodium left"/"Sodium over". Flat salt icon otherwise.
   */
  const sodiumCard = (eaten: number, target: number | undefined): Element => {
    if (target === undefined) return flatCard("salt", fill(L.milligrams, { n: n(eaten) }), L.macros.sodium.name);
    const over = eaten > target;
    const card = el("div", "mcard");
    card.append(
      el("b", "", fill(L.milligrams, { n: n(over ? eaten - target : target - eaten) })),
      el("small", "", over ? L.macros.sodium.over : L.macros.sodium.left),
      ringEl({ share: over || target <= 0 ? 1 : eaten / target, tone: "ink", icon: "salt" }),
    );
    return card;
  };

  /** The two-dot page switcher — real buttons on 44 px areas, the active one ink. */
  const dots = (): HTMLElement => {
    const row = el("div", "dots");
    for (const p of [0, 1] as const) {
      const b = el("button", p === page ? "on" : "") as HTMLButtonElement;
      b.type = "button";
      b.setAttribute("aria-label", fill(L.webPage, { n: `${p + 1}`, total: "2" }));
      b.append(el("i", ""));
      b.addEventListener("click", () => { page = p; void draw(); });
      row.append(b);
    }
    return row;
  };

  /** The health-score row — a link card opening the per-day score board. */
  const scoreRow = (day: DayResponse): Element | null => {
    if (day.healthScore === null) return null;
    const a = el("button", "hsr") as HTMLButtonElement;
    a.type = "button";
    const line = el("span", "hline");
    const hnum = el("span", "row");
    hnum.style.gap = "4px";
    hnum.append(el("b", "num hnum", fill(L.webScoreOut, { n: n(day.healthScore) })));
    const chev = el("i", "chev");
    chev.append(kitEl(ico("chevron-right")));
    hnum.append(chev);
    line.append(el("span", "hscore", L.webScoreLabel), hnum);
    const track = el("span", "hsb");
    const fillEl = el("i", "");
    fillEl.style.width = `${Math.max(0, Math.min(100, day.healthScore * 10))}%`;
    track.append(fillEl);
    const scored = day.meals.filter((m) => m.healthScore !== null).length;
    a.append(line, track, el("span", "hfrom", count(L.webScoreMeals, scored)));
    a.addEventListener("click", () => openScore(day));
    return a;
  };

  /** The per-day score board (`web/today-score.html`): title, method line, one row per meal. */
  const openScore = (day: DayResponse): void => {
    const overlay = el("div", "scorewrap");
    const card = el("div", "card scorecard");
    const title = el("div", "stitle");
    title.append(
      el("b", "", L.webScoreTitle),
      el("b", "snum", fill(L.webScoreOut, { n: n(day.healthScore ?? 0) })),
    );
    card.append(title, el("p", "sline", L.webScoreLine));
    for (const meal of day.meals) {
      if (meal.healthScore === null) continue;
      const row = el("a", "hsp") as HTMLAnchorElement;
      row.href = `#/meal/${meal.id}`;
      const name = el("span", "");
      name.append(document.createTextNode(names(meal.items)), el("small", "", kcal(meal.kcal)));
      const pts = el("span", "pts", `${n(meal.healthScore.score)}/10`);
      const chev = el("i", "chev");
      chev.append(kitEl(ico("chevron-right")));
      row.append(name, pts, chev);
      row.addEventListener("click", () => { overlay.remove(); });
      card.append(row);
    }
    const done = el("button", "cta p", L.webDone) as HTMLButtonElement;
    done.type = "button";
    done.addEventListener("click", () => overlay.remove());
    card.append(done);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
    overlay.append(card);
    document.body.append(overlay);
  };

  // ── The proposal card (today-logging) ───────────────────────────────────────────────────

  /**
   * The card a held proposal draws in the day's column: the lead naming the day it lands on, the
   * meal's name and kcal, one row per item with its grams, the macro chips with a sat-fat fourth,
   * the verdict pills' words, and Log it / No. The same confirm/cancel semantics the thread's
   * card carries (#529's maybe-landed and 410 handling included).
   */
  const proposalCard = (p: MealProposed): HTMLElement => {
    const card = el("div", "card rise prop");
    card.append(el("span", "lab", fill(L.webProposalLead, {
      day: p.date === today ? L.todayWord : dateText(p.date),
    })));
    const head = el("div", "pname");
    head.append(el("b", "", names(p.analysis.items)));
    const num = el("span", "num");
    num.append(kitEl(ico("kcal")), el("b", "", n(p.analysis.kcal)), el("span", "", UNIT_KCAL[lang]));
    head.append(num);
    card.append(head);
    for (const item of p.analysis.items) {
      const row = el("div", "pitem");
      const left = el("span", "");
      left.append(document.createTextNode(item.name));
      // The boards' "{n} g" — grams are the data; a zero reads as unread and drops.
      if (item.grams > 0) left.append(el("span", "ig", gram(item.grams)));
      row.append(left, el("span", "pk", item.kcal !== undefined ? n(item.kcal) : ""));
      card.append(row);
    }
    const macsRow = el("div", "macs");
    macsRow.style.marginTop = "10px";
    for (const [chip, v] of [
      ["protein", p.analysis.protein_g], ["carbs", p.analysis.carbs_g], ["fat", p.analysis.fat_g],
    ] as const) {
      const m = el("span", "mac");
      m.append(kitEl(ico(chip)), document.createTextNode(gram(v)));
      macsRow.append(m);
    }
    if (p.analysis.satfat_g !== undefined) {
      const m = el("span", "mac");
      m.style.color = "var(--muted)";
      m.style.fontWeight = "500";
      m.append(document.createTextNode(fill(L.macros.satFat.chip, { n: n(p.analysis.satfat_g) })));
      macsRow.append(m);
    }
    card.append(macsRow, el("div", "hr"));
    const vts = el("div", "vts");
    for (const v of p.verdictLabels) vts.append(verdictDotEl(v.tone, v.label));
    if (proposedAt !== null) vts.append(el("span", "t12", mealTime(proposedAt)));
    card.append(vts);
    const act = el("div", "pact");
    for (const [verb, label, cls] of [
      ["confirm", L.webLogIt, "cta p"], ["cancel", L.webProposalNo, "cta s"],
    ] as const) {
      const b = el("button", cls, label) as HTMLButtonElement;
      b.type = "button";
      b.addEventListener("click", () => turn(async () => {
        let r: PendingResponse;
        try {
          r = await api<PendingResponse>(
            `/meals/pending/${encodeURIComponent(p.pendingId)}/${verb}`, { method: "POST" });
        } catch (err) {
          // A session that is over is not a lost answer: it is the sign-in screen, which `turn`
          // draws. NO ANSWER, AND PRESSING AGAIN IS SAFE: a repeated confirm is answered with the
          // meal it already logged, a repeated cancel with a 410. So the card stays and says so.
          if (err instanceof Unauthenticated) throw err;
          if (refusalWords(err) === maybeLanded()) {
            // A lost "No" needs no second press: nothing is logged without a confirm, so what was
            // asked for holds whether or not it landed.
            if (verb === "cancel") { setHeldProposal(null); proposedAt = null; card.remove(); return; }
            throw new Said(COPY.logRetry);
          }
          if (!(err instanceof ApiError && err.status === 410)) throw err;
          // 410: no longer held, and never will be again, so the card goes rather than offering a
          // dead button. For "No" that is the outcome that was asked for, and it says nothing.
          setHeldProposal(null);
          proposedAt = null;
          if (verb === "confirm") { card.remove(); throw err; }
          return;
        }
        setHeldProposal(null);
        proposedAt = null;
        card.remove();
        // A confirm got there first and its answer never came back: the meal stays logged.
        if (verb === "cancel" && r.kind === "logged") return COPY.alreadyLogged;
      }));
      act.append(b);
    }
    card.append(act);
    return card;
  };

  // ── The composer (today only) ──────────────────────────────────────────────────────────

  /** The in-diary composer — text only; a photo enters through "Upload a photo" (`#/log`, W5's). */
  const composeRow = (): HTMLElement => {
    const form = el("form", "tcompose") as HTMLFormElement;
    const words = el("input", "box") as HTMLInputElement;
    words.type = "text";
    words.autocomplete = "off";
    words.placeholder = L.webComposerPlaceholder;
    words.setAttribute("aria-label", L.webComposerPlaceholder);
    const send = el("button", "ib") as HTMLButtonElement;
    send.type = "submit";
    send.setAttribute("aria-label", COPY.send);
    send.append(kitEl(ico("send")));
    form.append(words, send);
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = words.value.trim();
      if (text === "") return;
      turn(async () => {
        // A write always lands on TODAY — `capturedAt` is now — so the redraw shows where it
        // landed, not a past day the strip was looking at.
        viewing = today;
        return await sendOrKeep(
          { id: crypto.randomUUID(), userId: uid, kind: "text", text, photos: [], capturedAt: new Date().toISOString() },
          // The proposal's card shows its message's own time — the one the tab sent.
          { onResult: (r) => { if (r.kind === "proposed") proposedAt = new Date().toISOString(); } },
        );
      });
    });
    return form;
  };

  // ── The draw ──────────────────────────────────────────────────────────────────────────

  /** The day as the server now has it, redrawn after every write and every navigation. */
  async function draw(): Promise<void> {
    const mine = ++dayDrawing;
    const monday = mondayOf(viewing);
    const [dayR, daysR] = await Promise.all([
      api<DayResponse>(`/diary/day?date=${viewing}`)
        .then((d) => ({ ok: true as const, d }))
        .catch(() => ({ ok: false as const })),
      api<DaysResponse>(`${DAYS}?from=${monday}&to=${dateMinus(monday, -6)}`)
        .then((d) => ({ ok: true as const, d }))
        .catch(() => ({ ok: false as const })),
    ]);
    if (mine !== dayDrawing) return;

    const day = dayR.ok ? dayR.d : null;
    if (daysR.ok) barStreak = daysR.d.streak;
    barRow();

    // A proposal the composer is holding stands on the diary too — the diary is where the meal
    // lands. Same rules as the thread's: answered by the row it made, or by its clock.
    if (heldProposal() !== null && day !== null && day.meals.some((m) => m.id === heldProposal()!.pendingId)) {
      setHeldProposal(null);
      proposedAt = null;
    }
    if (heldProposal() !== null && Date.parse(heldProposal()!.expiresAt) <= Date.now()) {
      setHeldProposal(null);
      proposedAt = null;
    }

    const isToday = viewing === today;
    const hasMeals = day !== null && day.meals.length > 0;
    const logging = heldProposal() !== null || turning;
    // Page 2 exists only where its dots do — today with logged meals, nothing in flight.
    const rich = isToday && hasMeals && !logging;
    if (!rich) page = 0;

    // ── The left column: the label, the meals, the proposal, the empty/failed card ──
    // The boards' own twist: the column's label is "Recently uploaded" on today-with-meals and
    // the VIEWED DATE everywhere else (empty, logging, past, failed).
    const left: Element[] = [el("span", isToday && hasMeals ? "mealtitle" : "lab",
      isToday && hasMeals ? L.recentlyUploaded : dateText(viewing))];
    if (day === null) {
      const card = el("div", "card failcard");
      const say = el("div", "say");
      const words = el("div", "");
      words.append(el("p", "", L.diaryFailed));
      const retry = el("button", "cta s") as HTMLButtonElement;
      retry.type = "button";
      retry.append(kitEl(ico("retry")), document.createTextNode(` ${L.tryAgain}`));
      retry.addEventListener("click", () => { void draw(); });
      words.append(retry);
      say.append(spudAvatarEl("care"), words);
      card.append(say);
      left.push(card);
    } else if (day.meals.length === 0) {
      const card = el("div", "emptycard");
      const plate = el("span", "plate");
      plate.setAttribute("aria-hidden", "true");
      const say = el("div", "say rise");
      say.append(spudAvatarEl("happy"), el("p", "", L.nothingLogged));
      card.append(plate, say);
      left.push(card);
    } else {
      const card = el("div", "card meals");
      for (const meal of day.meals) {
        card.append(mealRow(meal));
      }
      left.push(card);
    }
    if (heldProposal() !== null) left.push(proposalCard(heldProposal()!));

    // ── The right column: the strip, the kcal card, the macro pages, the score, the actions ──
    const right: Element[] = [];
    if (daysR.ok) {
      const strip = el("div", "weekwrap");
      const rows: WeekDayRow[] = daysR.d.days.map((d) => ({ ...d, targetKcal: daysR.d.targetKcal }));
      strip.append(weekStripEl(rows, (date) => {
        if (date > today) return; // future cells carry no `data-date` — this is belt and braces
        viewing = date;
        void draw();
      }, viewing));
      right.push(strip);
    }

    right.push(kcalCard(day, rich));

    if (day === null) {
      // The failed day's dashes — flat icons, "— g", bare names.
      const mcards = el("div", "mcards");
      for (const [macro, copy] of [
        ["protein", L.macros.protein], ["carbs", L.macros.carbs], ["satfat", L.macros.satFat],
      ] as const) {
        mcards.append(mcardEl({ macro, centred: true, value: fill(L.grams, { n: "—" }), label: copy.name }));
      }
      right.push(mcards);
    } else if (rich) {
      if (page === 0) {
        const mcards = el("div", "mcards");
        mcards.append(
          macroCard("protein", L.macros.protein, Math.round(day.totals.protein_g), day.targets.protein_g),
          macroCard("carbs", L.macros.carbs, Math.round(day.totals.carbs_g), day.targets.carbs_g),
          macroCard("fat", L.macros.fat, Math.round(day.totals.fat_g), day.targets.fat_g),
        );
        right.push(mcards);
      } else {
        // Page 2 — the nutrient cards: saturated fat ringed when the marker is declared, fibre,
        // sugar and sodium flat (sodium ringed only when kidneys are declared).
        const mcards = el("div", "mcards p2");
        mcards.append(
          macroCard("satfat", L.macros.satFat, Math.round(day.totals.satfat_g), day.targets.satfat_g),
          flatCard("fibre", gram(Math.round(day.totals.fiber_g)), L.macros.fibre.name),
          flatCard("sugar", gram(Math.round(day.totals.sugar_g)), L.macros.sugar.name),
          sodiumCard(Math.round(day.totals.sodium_mg), day.targets.sodium_mg),
        );
        right.push(mcards);
        const hsr = scoreRow(day);
        if (hsr !== null) right.push(hsr);
      }
      right.push(dots());
    } else if (isToday) {
      // The compact of-target set — the empty and the logging boards' form. A past day draws no
      // macro cards at all (today-past.html).
      const mcards = el("div", "mcards");
      mcards.append(
        ofTargetCard("protein", L.macros.protein, Math.round(day.totals.protein_g), day.targets.protein_g),
        ofTargetCard("carbs", L.macros.carbs, Math.round(day.totals.carbs_g), undefined),
        ofTargetCard("satfat", L.macros.satFat, Math.round(day.totals.satfat_g), day.targets.satfat_g),
      );
      right.push(mcards);
    }

    // Today carries the actions: the upload CTA — gone while a turn is out or a proposal is held
    // (today-logging draws compose with no CTA) — and the composer. The failed board draws
    // neither: its right column ends at the dash cards.
    if (isToday && day !== null) {
      if (!logging) right.push(ctaEl({ text: L.webUploadPhoto, kind: "p", icon: "upload", href: "#/log" }));
      right.push(composeRow());
    }

    clear(wrap).append(h1, ...left, notice);
    clear(frame.side).append(...right);
  }

  /** A meal row: the photo or the chat tile, the time, the verdict line, the gram chips. */
  const mealRow = (meal: MealRecord): Element => {
    // The row opens the meal's own breakdown — design's ruling (#91's Q7): `#/meal/:id`, W6's
    // prefix. The board draws `.meal` without a glyph; the link is the affordance.
    const row = mealRowEl(meal, {
      time: mealTime(meal.ts),
      ...(meal.confidence === "low" && !meal.corrected ? { note: L.roughEstimate } : {}),
      href: `#/meal/${meal.id}`,
    });
    // The photo is fetched behind the bearer — the route has no cookie path, so it arrives as a
    // blob and the `<img>` gets a data URL: the CSP's `img-src 'self' data:` refuses `blob:`.
    if ((meal.photos ?? 0) > 0) {
      const id = meal.id;
      void apiBlob(`/meals/${encodeURIComponent(id)}/photos/0`).then(async (blob) => {
        if (!row.isConnected) return;
        const img = document.createElement("img");
        img.className = "ph";
        img.src = await new Promise<string>((ok, no) => {
          const r = new FileReader();
          r.onload = () => ok(r.result as string);
          r.onerror = () => no(r.error);
          r.readAsDataURL(blob);
        });
        img.alt = "";
        row.querySelector(".ph")?.replaceWith(img);
      }).catch(() => {});
    }
    return row;
  };

  // One write, then the day AS THE SERVER NOW HAS IT — the diary's composer posts like the chat's
  // (#52), so the machinery is `takeTurn` with this screen's notice and redraw handed in.
  const turn = (write: () => Promise<string | void>): void => {
    turning = true;
    // The composer and the cards live in the side column — outside `wrap` — so they are locked by
    // hand for the turn's span (takeTurn's own sweep covers `wrap`'s controls only); the redraw at
    // the turn's end rebuilds them enabled. The upload CTA is a link, so nothing disables it —
    // the logging board's rule is it hides while the turn is out; the draw re-adds it.
    for (const c of frame.side.querySelectorAll<HTMLInputElement | HTMLButtonElement>("input, button")) {
      c.disabled = true;
    }
    frame.side.querySelector(".cta")?.remove();
    takeTurn(wrap, tell, draw, uid, async () => {
      try {
        return await write();
      } finally {
        turning = false;
      }
    });
  };

  // A proposal made on Chat stands here too — read back once, like the thread's, when the page
  // holds nothing of it.
  if (heldProposal() === null) {
    setHeldProposal((await api<PendingMealsResponse>(PENDING).catch(() => null))?.proposals.at(-1) ?? null);
  }
  await draw();

  setRedraw(async () => { if (wrap.isConnected) await draw(); });
  // A kept turn's notice carried from a screen that is gone is decided again now: minutes may
  // have passed, and the turn may have gone meanwhile.
  const carried = takeCarried();
  if (carried !== null) tell(carried === kept() || carried === behind() ? keptNotice(uid) : carried);

  return wrap;
}

/**
 * The diary, or — while the account has never logged — the one-meal flow (#42).
 *
 * THE GATE IS A READ, not a flag: `/v1/diary/week` answers only days that have meals on them
 * ("empty means absent, not zero"), so an empty window over the whole diary horizon the server
 * will reach back to IS "nothing logged yet" — asked at the server's own `diaryWindowDays`, never
 * a compiled-in copy.
 *
 * The free meal is offered to exactly the account that still has it: onboarded, not entitled, the
 * sample unspent (the SERVER's count — a failed attempt leaves it unspent, #44), and nothing
 * logged. "No meals this week" alone would offer a paying user back from a holiday one meal on us.
 */
export async function homeScreen(frame: Frame): Promise<HTMLElement> {
  const me = frame.me;
  if (me?.onboarded === true && !me.entitlement.active && !me.limits.sampleUsed) {
    const marked = await api<WeekResponse>(`${WEEK}?days=${me.limits.diaryWindowDays}`);
    if (marked.days.length === 0) return firstMealScreen(me);
  }
  return diaryScreen(frame);
}
