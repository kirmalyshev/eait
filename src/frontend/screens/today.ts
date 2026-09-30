// Today — Home (`web/today.html`, W4 #91). The boards' two-column diary: the left column holds
// the meal card, a proposal the composer is holding, and the empty/failed cards;
// the right column (the frame's `side`) holds the week strip, the two-page card track — the
// calorie card over the macro set on page 1, the nutrient set and the day's score on page 2 —
// panned by its dot switcher (#1025), and — on today — the upload CTA plus the in-diary composer.
//
// EVERY WORD THE CARDS DRAW ARRIVES FROM THE SERVER OR FROM `home-copy.ts` — the bundle holds no
// i18n catalog: a meal row's verdict line is `verdictInline`, the proposal's pills are
// `verdictLabels`, and the score is the server's `dayHealthScore`, never recomputed here.

import { dateMinus } from "../../shared/dates.ts";
import { dayBudget, kcalCardState, macroCardState, macroLeft } from "../../shared/budget.ts";
import { LANG_TAG, countText, wholeNumbers } from "../../shared/lang.ts";
import { homeCopyFor, type HomeTargetMacroCopy } from "../../shared/app/home-copy.ts";
import { scoresAppCopy } from "../../shared/app/scores-copy.ts";
import { shellCopyFor } from "../../shared/app/shell-copy.ts";
import { ico, tagx, type ChipName, type WeekDayRow } from "../../shared/ui/kit.ts";
import type { MealRecord } from "@eait/shared";
import type {
  DayResponse, DaysResponse, PendingMealsResponse, ProfileResponse,
} from "@eait/shared/contract";
import { api, apiBlob } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { firstMealScreen } from "./first-meal.ts";
import {
  blobSrc, ctaEl, kitEl, mcardEl, mealRowEl, ringEl, weekStripEl,
} from "../kit.ts";
import {
  COPY, DAYS, PENDING, behind, clear, composerRow, dayText, el, firstMealDue, heldProposal, kcal, kept,
  keptNotice, lang, names, profile, proposalCard, sendOrKeep, setHeldProposal, setRedraw,
  takeCarried, takeTurn, type Frame,
} from "../shell.ts";

async function diaryScreen(frame: Frame): Promise<HTMLElement> {
  const wrap = el("section", "home");
  const me = await profile();
  const uid = me.profile.user_id;
  const L = homeCopyFor(lang);
  const SC = scoresAppCopy(lang);
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
  let page: 0 | 1 = 0;
  /** The calorie toggle's other side on today-with-meals: left, or eaten after a tap. */
  let showEaten = false;
  /** A turn in flight — the logging state hides the upload CTA while one runs. */
  let turning = false;
  /** Queued draws collapse to the newest, as `drawing` does for `render()`. */
  let dayDrawing = 0;

  // The boards' date format, "Thursday 24 September", for the proposal's day; the row's time is the account's timezone — the server's figures are already zoned.
  const dateText = dayText;
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

  // ── The picker: the browser's own date input, opened by the bar's calendar button and by a
  // long press or right click on the strip (the phone's long press). Never past today.
  const picker = el("input", "visually-hidden") as HTMLInputElement;
  picker.type = "date";
  picker.tabIndex = -1;
  picker.setAttribute("aria-hidden", "true");
  picker.addEventListener("change", () => {
    if (picker.value === "" || picker.value > today) return;
    viewing = picker.value;
    void draw();
  });
  const openPicker = (): void => {
    picker.max = today;
    picker.value = viewing;
    try { picker.showPicker(); } catch { picker.click(); }
  };
  /** A week back or forward, the selected weekday kept — never past today. */
  const shiftWeek = (by: -1 | 1): void => {
    const to = dateMinus(viewing, -7 * by);
    const next = to > today ? today : to;
    if (next === viewing) return;
    viewing = next;
    void draw();
  };

  // ── The bar: the streak chip, then the week's arrows around the calendar ─────────────────

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
    const row = el("span", "drow");
    const arrow = (label: string, icon: "chevron-left" | "chevron-right" | "calendar", onClick: () => void) => {
      const b = el("button", "darrow") as HTMLButtonElement;
      b.type = "button";
      b.setAttribute("aria-label", label);
      b.append(kitEl(ico(icon)));
      b.addEventListener("click", onClick);
      return b;
    };
    const next = arrow(COPY.weekNext, "chevron-right", () => shiftWeek(1));
    next.disabled = mondayOf(viewing) >= mondayOf(today);
    row.append(arrow(COPY.weekPrev, "chevron-left", () => shiftWeek(-1)),
      arrow(L.pickDay, "calendar", openPicker), next);
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
    const kfig = el("b", `num kfig${interactive ? " big" : ""}`);
    if (day === null) {
      kfig.textContent = "—";
      left.append(kfig, el("span", "klab", fill(L.kcalLeftDetail, { eaten: "—", plan: "—" })));
      card.append(left, ringEl({ share: 0, size: 96, icon: "kcal" }));
      return card;
    }
    const budget = dayBudget(day, today, me.profile.goal);
    // The figure-and-label pair is `kcalCardState`'s one choice: the toggle's two faces, the
    // past day's "eaten" — a finished day has nothing "left" — and the overage under "over".
    const state = kcalCardState(budget, interactive && showEaten);
    if (state.guessed) kfig.append(el("span", "about", COPY.about));
    kfig.append(document.createTextNode(n(state.figure)));
    left.append(kfig);
    if (budget.warn) card.classList.add("over");
    if (interactive) {
      const lab = el("button", "klab ktg") as HTMLButtonElement;
      lab.type = "button";
      const label = state.label === "over" ? L.kcalOver : state.label === "eaten" ? L.kcalEaten : L.kcalLeft;
      lab.setAttribute("aria-label", label);
      lab.append(document.createTextNode(label), kitEl(ico("chevron-down")));
      lab.addEventListener("click", () => { showEaten = !showEaten; void draw(); });
      left.append(lab);
    } else {
      left.append(el("span", "klab", fill(
        state.label === "over" ? L.kcalOverDetail
          : state.label === "eaten" ? L.kcalEatenDetail : L.kcalLeftDetail,
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
    // The figure-and-label pair is `macroCardState`'s one choice — the same card You's day
    // column draws (#175): the overage under "over", what's left under "left", a closed ring.
    const s = macroCardState(eaten, target);
    return mcardEl({
      macro,
      value: gram(s.figure),
      label: s.label === "over" ? copy.over : copy.left,
      ...(s.share !== undefined ? { share: s.share } : {}),
    });
  };

  /** A flat nutrient card — page 2's fibre/sugar/sodium carry no ring (no declared cap). */
  const flatCard = (icon: "fibre" | "sugar" | "salt", value: string, label: string): Element =>
    mcardEl({ macro: icon, value, label });

  /**
   * The sodium card when kidneys are declared — the cap's ring is drawn in ink (sodium has no
   * macro colour to borrow — the kit's mcard takes salt-with-share for exactly this) over
   * "Sodium left"/"Sodium over". Flat salt icon otherwise.
   */
  const sodiumCard = (eaten: number, target: number | undefined): Element => {
    if (target === undefined) return flatCard("salt", fill(L.milligrams, { n: n(eaten) }), L.macros.sodium.name);
    const over = eaten > target;
    return mcardEl({
      macro: "salt",
      value: fill(L.milligrams, { n: n(over ? eaten - target : macroLeft(target, eaten)) }),
      label: over ? L.macros.sodium.over : L.macros.sodium.left,
      share: over || target <= 0 ? 1 : eaten / target,
    });
  };

  /** The two-dot page switcher — real buttons on 44 px areas, the active one ink. A tap slides
   *  the track through `onSwitch` rather than redrawing: a rebuild would mount the next page at
   *  its end state and the pan (#1025) would never run. */
  const dots = (onSwitch: (to: 0 | 1) => void): HTMLElement => {
    const row = el("div", "dots");
    for (const p of [0, 1] as const) {
      const b = el("button", p === page ? "on" : "") as HTMLButtonElement;
      b.type = "button";
      b.setAttribute("aria-label", fill(L.webPage, { n: n(p + 1), total: n(2) }));
      b.append(el("i", ""));
      b.addEventListener("click", () => {
        if (p === page) return;
        for (const sib of row.querySelectorAll("button")) sib.classList.remove("on");
        b.classList.add("on");
        onSwitch(p);
      });
      row.append(b);
    }
    return row;
  };

  /** The health-score row — a link card opening the per-day score board. */
  const scoreRow = (day: DayResponse): Element | null => {
    if (day.healthScore === null) return null;
    const a = el("button", "hsr day") as HTMLButtonElement;
    a.type = "button";
    const line = el("span", "hline");
    const hnum = el("span", "row");
    hnum.style.gap = "4px";
    hnum.append(el("b", "num hnum", fill(SC.outOf, { n: n(day.healthScore) })));
    const chev = el("i", "chev");
    chev.append(kitEl(ico("chevron-right")));
    hnum.append(chev);
    line.append(el("span", "hscore", SC.title), hnum);
    const track = el("span", "hsb");
    const fillEl = el("i", "");
    fillEl.style.width = `${Math.max(0, Math.min(100, day.healthScore * 10))}%`;
    track.append(fillEl);
    const scored = day.meals.filter((m) => m.healthScore !== null).length;
    a.append(line, track, el("span", "hfrom", count(SC.todayFromMeals, scored)));
    a.addEventListener("click", () => openScore(day));
    return a;
  };

  /** The per-day score board (`web/today-score.html`): title, method line, one row per meal. */
  const openScore = (day: DayResponse): void => {
    const overlay = el("div", "scorewrap");
    const card = el("div", "card scorecard");
    const title = el("div", "stitle");
    title.append(
      el("b", "", SC.breakdownTitle),
      el("b", "snum", fill(SC.outOf, { n: n(day.healthScore ?? 0) })),
    );
    card.append(title, el("p", "sline", SC.breakdownLine));
    for (const meal of day.meals) {
      if (meal.healthScore === null) continue;
      const row = el("a", "hsp") as HTMLAnchorElement;
      row.href = `#/meal/${encodeURIComponent(meal.id)}?d=${viewing}`;
      const name = el("span", "");
      name.append(document.createTextNode(names(meal.items)), el("small", "", kcal(meal.kcal)));
      const pts = el("span", "pts", fill(SC.outOf, { n: n(meal.healthScore.score) }));
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

  // ── The composer (today only) ──────────────────────────────────────────────────────────

  /** The in-diary composer — the boards' shared one (`composerRow`), words only: a photo goes
   *  through the "Upload a photo" CTA on Home (the board's composer has no camera round), which
   *  also leaves the field the full column so its whole placeholder reads. */
  const comp = composerRow(L.webComposerPlaceholder, { camera: false, multiline: true });
  const { words } = comp;
  comp.form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = words.value.trim();
    if (text === "") return;
    turn(async () => {
      // A write always lands on TODAY — `capturedAt` is now — so the redraw shows where it
      // landed, not a past day the strip was looking at.
      viewing = today;
      const saved = await sendOrKeep({
        id: crypto.randomUUID(), userId: uid, capturedAt: new Date().toISOString(),
        kind: "text", text, photos: [],
      });
      words.value = "";
      return saved;
    });
  });

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
    }
    if (heldProposal() !== null && Date.parse(heldProposal()!.expiresAt) <= Date.now()) {
      setHeldProposal(null);
    }

    const isToday = viewing === today;
    const hasMeals = day !== null && day.meals.length > 0;
    const logging = heldProposal() !== null || turning;
    // The toggle card and "Recently uploaded" are today-with-meals only; the pages are every day's.
    const rich = isToday && hasMeals && !logging;

    // ── The left column: the label, the meals, the proposal, the empty/failed card ──
    // "Recently uploaded" only while today holds meals; every other state names no date — the
    // strip's marked cell already says which day this is.
    const left: Element[] = rich ? [el("span", "mealtitle", L.recentlyUploaded)] : [];
    if (day === null) {
      const card = el("div", "card failcard");
      const say = el("div", "say");
      const words = el("div", "");
      words.append(el("p", "", L.diaryFailed));
      // The boards' small secondary is the chat's `.cta.s.sm` — `.failcard` rules alone lose
      // to `.card button.cta` on specificity and the label ran into the pill's border (#304).
      const retry = ctaEl({ text: L.tryAgain, kind: "s", icon: "retry" }) as HTMLButtonElement;
      retry.classList.add("sm");
      retry.addEventListener("click", () => { void draw(); });
      words.append(retry);
      say.append(words);
      card.append(say);
      left.push(card);
    } else if (day.meals.length === 0) {
      // The whole panel is the log-a-meal action — the upload CTA's own route.
      const card = el("a", "emptycard rise") as HTMLAnchorElement;
      card.href = "#/log";
      card.setAttribute("aria-label", `${L.nothingLogged} ${S.logMeal}`);
      const plate = el("span", "plate");
      plate.setAttribute("aria-hidden", "true");
      card.append(plate, el("p", "", L.nothingLogged));
      left.push(card);
    } else {
      const card = el("div", "card meals");
      for (const meal of day.meals) {
        card.append(mealRow(meal, !rich));
      }
      left.push(card);
    }
    if (heldProposal() !== null) {
      // The shell's own proposal card — confirm/cancel/410 is its one implementation.
      const card = proposalCard(heldProposal()!, turn, {
        lead: fill(L.webProposalLead, {
          day: heldProposal()!.date === today ? L.todayWord : dateText(heldProposal()!.date),
        }),
        accept: L.webLogIt,
        decline: L.webProposalNo,
        // The sat-fat chip follows the declared marker — `day.targets.satfat_g` is set only
        // when the account declared ldl.
      }, { diary: true, satFat: day?.targets.satfat_g !== undefined });
      card.classList.add("rise");
      left.push(card);
    }

    // ── The right column: the strip, the kcal card, the macro pages, the score, the actions ──
    const right: Element[] = [];
    if (daysR.ok) {
      const strip = el("div", "weekwrap");
      const rows: WeekDayRow[] = daysR.d.days.map((d) => ({ ...d, targetKcal: daysR.d.targetKcal }));
      // A horizontal swipe turns the week; a held press (or a right click) opens the picker. The
      // click that ends either one is swallowed, so it never also picks the cell under it.
      let from: { x: number; y: number; t: number } | null = null;
      let swallow = false;
      strip.addEventListener("pointerdown", (e) => { from = { x: e.clientX, y: e.clientY, t: e.timeStamp }; swallow = false; });
      strip.addEventListener("pointerup", (e) => {
        if (from === null) return;
        const dx = e.clientX - from.x, dy = e.clientY - from.y;
        if (Math.abs(dx) >= 40 && Math.abs(dx) > Math.abs(dy)) { swallow = true; shiftWeek(dx < 0 ? 1 : -1); }
        else if (e.button === 0 && e.timeStamp - from.t >= 500 && Math.hypot(dx, dy) < 10) { swallow = true; openPicker(); }
        from = null;
      });
      strip.addEventListener("pointercancel", () => { from = null; });
      strip.addEventListener("contextmenu", (e) => { e.preventDefault(); openPicker(); });
      strip.append(weekStripEl(rows, (date) => {
        if (swallow) { swallow = false; return; }
        if (date > today) return; // future cells carry no `data-date` — this is belt and braces
        viewing = date;
        void draw();
      }, viewing), picker);
      right.push(strip);
    }

    // The card area is a two-page track (#1025): page 1 is the calorie card over the macro set,
    // page 2 the nutrient set and the day's score (today-page2.html). BOTH pages stay mounted in
    // one clipped row — its height is the taller page's, so a turn moves nothing below it — and
    // the dots slide the row rather than redraw; the off-screen page is inert and out of the
    // accessibility tree. Every loaded day is paged — empty, past and logging too; only the
    // failed read draws its dashes unpaged.
    if (day !== null) {
      const clip = el("div", "mclip");
      const track = el("div", "mtrack");
      const pageOne = el("div", "mpage");
      const pageTwo = el("div", "mpage");
      /** The page turn — a dot's tap lands here; a draw on page 2 opens already slid. */
      const show = (to: 0 | 1): void => {
        page = to;
        track.style.transform = to === 1 ? "translateX(-100%)" : "";
        pageOne.setAttribute("aria-hidden", String(to !== 0));
        pageTwo.setAttribute("aria-hidden", String(to !== 1));
        pageOne.toggleAttribute("inert", to !== 0);
        pageTwo.toggleAttribute("inert", to !== 1);
        comp.form.hidden = to !== 0;
      };
      const mcardsOne = el("div", "mcards");
      mcardsOne.append(
        macroCard("protein", L.macros.protein, Math.round(day.totals.protein_g), day.targets.protein_g),
        macroCard("carbs", L.macros.carbs, Math.round(day.totals.carbs_g), day.targets.carbs_g),
        macroCard("fat", L.macros.fat, Math.round(day.totals.fat_g), day.targets.fat_g),
      );
      pageOne.append(kcalCard(day, rich), mcardsOne);
      // Page 2 — the nutrient cards: saturated fat ringed when the marker is declared, fibre,
      // sugar and sodium flat (sodium ringed only when kidneys are declared).
      const mcardsTwo = el("div", "mcards p2");
      mcardsTwo.append(
        macroCard("satfat", L.macros.satFat, Math.round(day.totals.satfat_g), day.targets.satfat_g),
        flatCard("fibre", gram(Math.round(day.totals.fiber_g)), L.macros.fibre.name),
        flatCard("sugar", gram(Math.round(day.totals.sugar_g)), L.macros.sugar.name),
        sodiumCard(Math.round(day.totals.sodium_mg), day.targets.sodium_mg),
      );
      pageTwo.append(mcardsTwo);
      const hsr = scoreRow(day);
      if (hsr !== null) pageTwo.append(hsr);
      track.append(pageOne, pageTwo);
      clip.append(track);
      show(page);
      right.push(clip, dots(show));
    } else {
      // The failed day's dashes — flat icons, "— g", bare names.
      right.push(kcalCard(day, rich));
      const mcards = el("div", "mcards");
      for (const [macro, copy] of [
        ["protein", L.macros.protein], ["carbs", L.macros.carbs], ["satfat", L.macros.satFat],
      ] as const) {
        mcards.append(mcardEl({ macro, centred: true, value: fill(L.grams, { n: "—" }), label: copy.name }));
      }
      right.push(mcards);
    }

    // Today carries the actions: the upload CTA — gone while a turn is out or a proposal is held
    // (today-logging draws compose with no CTA) — and the composer. The failed board draws
    // neither: its right column ends at the dash cards. The composer is page 1's (#170): hidden
    // on page 2 rather than gone, so a drafted line survives the turn.
    if (isToday && day !== null) {
      if (!logging) right.push(ctaEl({ text: L.webUploadPhoto, kind: "p", icon: "upload", href: "#/log" }));
      comp.form.hidden = page !== 0;
      right.push(comp.form);
    }

    clear(wrap).append(h1, ...left, notice);
    frame.side.setAttribute("aria-label", L.webDayRegion);
    clear(frame.side).append(...right);
  }

  /** A meal row: the photo or the no-photo tile, the time, the verdict line — the gram chips
   *  only on the "Recently uploaded" form (`compact` is the past-day and logging boards' row). */
  const mealRow = (meal: MealRecord, compact: boolean): Element => {
    // The row opens the meal's own breakdown — design's ruling (#91's Q7): `#/meal/:id`, W6's
    // prefix. The board draws `.meal` without a glyph; the link is the affordance.
    const row = mealRowEl(meal, {
      time: mealTime(meal.ts),
      compact,
      ...(meal.confidence === "low" && !meal.corrected ? { note: L.roughEstimate } : {}),
      href: `#/meal/${encodeURIComponent(meal.id)}?d=${viewing}`,
    });
    // The photo rides behind the bearer — `apiBlob`'s bytes through `blobSrc`, a data URL: the
    // one `src` form `img-src 'self' data:` permits.
    if ((meal.photos ?? 0) > 0) {
      const id = meal.id;
      void apiBlob(`/meals/${encodeURIComponent(id)}/photos/0`).then(async (blob) => {
        if (!row.isConnected) return;
        const img = document.createElement("img");
        img.className = "ph";
        img.src = await blobSrc(blob);
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
  // The gate is the ONE predicate both surfaces share (`shell.firstMealDue`). The profile in the
  // frame is the session's cached read — a meal logged this session flipped `hasLoggedMeal`
  // without the cache knowing, so a cached "first" is re-verified on a fresh read before the
  // free-meal flow shows; a stale one silently never did (the diary for somebody who HAS logged
  // is the failure the gate exists to prevent).
  if (firstMealDue(frame.me)) {
    const fresh = await api<ProfileResponse>("/profile").catch(() => frame.me);
    if (firstMealDue(fresh)) return firstMealScreen(fresh);
  }
  return diaryScreen(frame);
}
