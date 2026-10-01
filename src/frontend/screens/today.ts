// Today — Home (`web/today.html`, W4 #91; the F layout, #335). The boards' two-column diary:
// the left column holds the "Recent" list, the day note, a proposal the composer is
// holding, and the empty/failed states; the right column (the frame's `side`) holds the week
// strip on top and ONE day card — the kcal hero and the macro bar rows on page 1, the day-score
// hero and the nutrient rows on page 2, the dots inside the card — panned by dots, by drag, by
// trackpad and by the ←/→ keys, and — on today — the upload CTA plus the in-diary composer.
//
// EVERY WORD THE CARDS DRAW ARRIVES FROM THE SERVER OR FROM `home-copy.ts` — the bundle holds no
// i18n catalog: a meal row's verdict line is `verdictInline`, the proposal's pills are
// `verdictLabels`, and the score is the server's `dayHealthScore`, never recomputed here.

import { dateMinus } from "../../shared/dates.ts";
import { dayBudget, kcalCardState, macroLeft } from "../../shared/budget.ts";
import { LANG_TAG, kcalNumbers, wholeNumbers } from "../../shared/lang.ts";
import { homeCopyFor, macroTip, type MacroTipKind } from "../../shared/app/home-copy.ts";
import { enqueue, inPlace, queueEl, queueLength, queuedMealIds } from "../queue.ts";
import { scoresAppCopy } from "../../shared/app/scores-copy.ts";
import { shellCopyFor } from "../../shared/app/shell-copy.ts";
import { ringDash } from "../../shared/ui/charts.ts";
import { iconSvg, type IconName } from "../../shared/ui/icons.ts";
import { ico, tagx, weekStrip, type WeekDayRow } from "../../shared/ui/kit.ts";
import type { MealRecord } from "@eait/shared";
import type {
  DayResponse, DaysResponse, PendingMealsResponse, ProfileResponse,
} from "@eait/shared/contract";
import { api, apiBlob } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { firstMealScreen } from "./first-meal.ts";
import { blobSrc, ctaEl, kitEl, mealRowEl } from "../kit.ts";
import {
  DAYS, PENDING, behind, clear, composerRow, dayText, el, firstMealDue, heldProposal, kcal, kept,
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
  const kn = kcalNumbers(lang);
  const gram = (v: number): string => fill(L.grams, { n: n(v) });

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
    // The date as a number, never the field's text: `viewing` reaches hrefs and request paths.
    const ms = picker.valueAsNumber;
    if (Number.isNaN(ms)) return;
    const picked = new Date(ms).toISOString().slice(0, 10);
    if (picked > today) return;
    viewing = picked;
    void draw();
  });
  const openPicker = (): void => {
    picker.max = today;
    picker.value = viewing;
    try { picker.showPicker(); } catch { picker.click(); }
  };


  // ←/→ move the day, Shift+←/→ move the week — the strip's own moves, on keys (F, #335).
  // While the day card has focus they pan its pages instead; Escape closes an open macro tip.
  // A drawn-over screen drops the listeners itself: `wrap` is gone from the document, so the
  // first event after unmount removes them.
  const onKey = (e: KeyboardEvent): void => {
    if (!wrap.isConnected) {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown, true);
      return;
    }
    if (e.key === "Escape") { closeTip(); return; }
    const t = e.target as HTMLElement | null;
    if (t !== null && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const d = e.key === "ArrowLeft" ? -1 : 1;
    if (t !== null && t.closest(".dayc") !== null && cardPan(d)) return;
    if (e.shiftKey) shiftWeek(d); else shiftDay(d);
  };
  document.addEventListener("keydown", onKey);

  // ── The bar: the streak chip, then the calendar — the week moves by strip swipe and keys ──

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
    // The boards' `.calb` — the native date picker is the only bar control left (F, #335).
    const cal = el("button", "calb") as HTMLButtonElement;
    cal.type = "button";
    cal.setAttribute("aria-label", L.pickDay);
    cal.append(kitEl(ico("calendar")));
    cal.addEventListener("click", openPicker);
    frame.bar.append(cal);
  };

  // ── The week strip — the F flat-tint row, mounted ONCE, moved never rebuilt ─────────────
  //
  // Three weeks live in `.wtrack` (previous | current | next) so a drag pulls the neighbour in
  // with no wait; a day pick moves `.wtint` to the cell, not the week — the tint glides (the
  // stylesheet's 220 ms left transition) while the day card behind it dashes, fetches and
  // fills. `viewing` is the state; the strip repaints it.

  const stripBox = el("div", "weekwrap");
  stripBox.append(picker);
  let lastDays: DaysResponse | null = null;
  let stripWeek: string | null = null;   // the monday `.wtrack` is centred on
  let stripSliding = false;              // a slide is in flight — paints wait for it to land
  const reducedMotion =
    typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

  /** Seven dates starting on `mon`, carrying the read's shared `targetKcal`. */
  const stripRows = (d: DaysResponse, mon: string): WeekDayRow[] =>
    d.days
      .filter((x) => x.date >= mon && x.date <= dateMinus(mon, -6))
      .map((x) => ({ ...x, targetKcal: d.targetKcal }));

  const stripTrack = (): HTMLElement | null => stripBox.querySelector<HTMLElement>(".wtrack");

  /** The tint to a cell — a class move under the stylesheet's transition; under reduced motion
   *  it dips out and back in (the boards' fade fallback). */
  const tintTo = (week: HTMLElement, at: string): void => {
    const tint = week.querySelector<HTMLElement>(".wtint");
    if (tint === null || tint.classList.contains(at)) return;
    if (reducedMotion) {
      tint.style.filter = "opacity(0)";
      setTimeout(() => { tint.className = `wtint ${at}`; tint.style.filter = ""; }, 150);
    } else {
      tint.className = `wtint ${at}`;
    }
  };

  /** Mark `date` on a mounted week — the tint to its cell, `.now` with it. */
  const markCell = (week: HTMLElement, date: string): void => {
    const cells = [...week.querySelectorAll<HTMLElement>(".dy")];
    const idx = cells.findIndex((c) => c.getAttribute("data-date") === date);
    if (idx < 0) return;
    if (week.querySelector(".wtint") === null) {
      const t = el("i", "wtint");
      t.setAttribute("aria-hidden", "true");
      week.prepend(t);
    }
    tintTo(week, `a${idx}`);
    cells.forEach((c, i) => c.classList.toggle("now", i === idx));
  };

  /** Rebuild the three-week track centred on `mon` — first mount, or after a slide lands. */
  const stripBuild = (d: DaysResponse, mon: string): void => {
    const track = el("div", "wtrack");
    for (const m of [dateMinus(mon, 7), mon, dateMinus(mon, -7)]) {
      const w = kitEl(weekStrip(stripRows(d, m), lang, m === mon ? viewing : undefined)) as HTMLElement;
      // A rebuilt strip does not replay the rings' draw-in — it was already on screen.
      if (stripWeek !== null) w.classList.add("rest");
      track.append(w);
    }
    stripTrack()?.remove();
    stripBox.append(track);
    stripWeek = mon;
  };

  /** A different day always opens on the card's first page — `page` is a surface state, not a
   *  day one. */
  const moveDay = (date: string): void => {
    page = 0;
    viewing = date;
    void draw();
  };

  /** The week slide a drag, a trackpad flick or Shift+arrow commits — the neighbour is mounted
   *  already, so the track translates to it while the day fetch runs; `transitionend` recentres
   *  the track. `date` is the day it lands on. */
  const slideToWeek = (date: string, dir: -1 | 1): void => {
    const track = stripTrack();
    if (track === null || stripSliding || reducedMotion) { moveDay(date); return; }
    stripSliding = true;
    track.style.transform = `translateX(${dir === 1 ? "-200" : "0"}%)`;
    // The tint travels with the strip: mark the cell on the neighbour before it slides in.
    const nbr = track.children[dir === 1 ? 2 : 0];
    if (nbr instanceof HTMLElement) markCell(nbr, date);
    moveDay(date);
  };

  /** A day pick — same-week picks glide the tint at once; a pick into another week slides. */
  const pickDay = (date: string): void => {
    if (date === viewing || date > today) return;
    if (stripWeek !== null && mondayOf(date) !== stripWeek) {
      slideToWeek(date, mondayOf(date) > stripWeek ? 1 : -1);
      return;
    }
    const cur = stripTrack()?.children[1];
    if (cur instanceof HTMLElement) markCell(cur, date);
    moveDay(date);
  };

  /** A day back or forward — never past today, so a future day is never asked for. */
  const shiftDay = (by: -1 | 1): void => pickDay(dateMinus(viewing, -by));
  /** A week back or forward, the selected weekday kept — never past today. */
  const shiftWeek = (by: -1 | 1): void => {
    const to = dateMinus(viewing, -7 * by);
    pickDay(to > today ? today : to);
  };
  /** The day card's page pan — bound when the card mounts; arrows do days until then. */
  let cardPan: (d: -1 | 1) => boolean = () => false;

  /** Paint the strip from a fresh days read — the cells in place when the week is the same
   *  (so the rings don't replay their draw-in), rebuilt centred when it moved. While a slide
   *  is in flight the moving track is left alone; its `transitionend` rebuilds. */
  const stripPaint = (d: DaysResponse): void => {
    const mon = mondayOf(viewing);
    if (stripSliding) { stripWeek = mon; return; }
    if (stripWeek !== mon || stripTrack() === null) {
      stripBuild(d, mon);
      return;
    }
    const week = stripTrack()!.children[1] as HTMLElement;
    const fresh = kitEl(weekStrip(stripRows(d, mon), lang, viewing)) as HTMLElement;
    const ftint = fresh.querySelector<HTMLElement>(".wtint");
    if (ftint !== null) tintTo(week, ftint.className.split(" ")[1]!);
    const cells = week.querySelectorAll<HTMLElement>(".dy");
    fresh.querySelectorAll<HTMLElement>(".dy").forEach((f, i) => {
      const cell = cells[i];
      if (cell === undefined) return;
      cell.className = f.className;
      const oldRing = cell.querySelector("svg");
      const newRing = f.querySelector("svg");
      if (oldRing !== null && newRing !== null && oldRing.outerHTML !== newRing.outerHTML) {
        oldRing.replaceWith(newRing.cloneNode(true));
      }
    });
  };

  // The strip's own gestures: a horizontal drag moves the track under the finger, past 40 px
  // it commits the week; a held press or a right click opens the picker; a horizontal wheel
  // flicks the week. The click that ends a drag is swallowed so it never also picks a cell.
  let stripDrag: { x: number; y: number; t: number; id: number; moved: boolean } | null = null;
  let stripSwallow = false;
  stripBox.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    stripDrag = { x: e.clientX, y: e.clientY, t: e.timeStamp, id: e.pointerId, moved: false };
  });
  stripBox.addEventListener("pointermove", (e) => {
    if (stripDrag === null || e.pointerId !== stripDrag.id) return;
    const dx = e.clientX - stripDrag.x;
    const dy = e.clientY - stripDrag.y;
    const track = stripTrack();
    if (track === null) return;
    if (!stripDrag.moved && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.5) {
      stripDrag.moved = true;
      stripSwallow = true;
      try { stripBox.setPointerCapture(e.pointerId); } catch { /* the pointer is gone */ }
    }
    if (stripDrag.moved) {
      track.style.transition = "none";
      track.style.transform = `translateX(calc(-100% + ${dx}px))`;
    }
  });
  stripBox.addEventListener("pointerup", (e) => {
    if (stripDrag === null || e.pointerId !== stripDrag.id) return;
    const { x, y, t, moved } = stripDrag;
    stripDrag = null;
    const track = stripTrack();
    if (track !== null) track.style.transition = "";
    if (moved) {
      const dx = e.clientX - x;
      if (Math.abs(dx) >= 40) slideToWeek(dateMinus(viewing, -7 * (dx < 0 ? 1 : -1)), dx < 0 ? 1 : -1);
      else if (track !== null) track.style.transform = "";
      return;
    }
    // The held press opens the month picker (the phone's long press), as a right click does.
    if (e.timeStamp - t >= 500 && Math.hypot(e.clientX - x, e.clientY - y) < 10) {
      stripSwallow = true;
      openPicker();
    }
  });
  stripBox.addEventListener("pointercancel", () => {
    stripDrag = null;
    const track = stripTrack();
    if (track !== null) { track.style.transition = ""; track.style.transform = ""; }
  });
  stripBox.addEventListener("contextmenu", (e) => { e.preventDefault(); openPicker(); });
  // A trackpad's horizontal flick turns the week too.
  let stripWheelAt = 0;
  stripBox.addEventListener("wheel", (e) => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    if (e.timeStamp - stripWheelAt > 260) shiftWeek(e.deltaX > 0 ? 1 : -1);
    stripWheelAt = e.timeStamp;
  }, { passive: false });
  // The slide lands → the track rebuilds centred on the new week.
  stripBox.addEventListener("transitionend", (e) => {
    const t = e.target as HTMLElement;
    if (!stripSliding || e.propertyName !== "transform" || !t.classList.contains("wtrack")) return;
    stripSliding = false;
    if (lastDays !== null) { stripWeek = null; stripPaint(lastDays); }
  });
  // A cell's tap picks the day — the tint moves at once, the card follows after the fetch.
  stripBox.addEventListener("click", (e) => {
    if (stripSwallow) { stripSwallow = false; return; }
    const date = (e.target as HTMLElement).closest?.("[data-date]")?.getAttribute("data-date");
    if (date) pickDay(date);
  });

  // ── The macro tip ───────────────────────────────────────────────────────────────────────
  //
  // The boards' `.tipa` — a tapped protein/carbs/sat-fat row's inline panel, inside the row
  // under its bar, never over the hero; the rows below, the dots and the card foot move down.
  // One at a time: the same row again, Escape, a page pan or an outside tap closes it; another
  // row switches. A column scroll does NOT — the panel rides with its row, and closing would
  // keep the grown card's foot unreachable under the pinned composer. Hover never opens it — a
  // layout that jumps under the
  // pointer. `.rows.open` drops the fixed height for an explicit gap so the closed rows keep
  // the spacing `space-between` dealt them.

  let tipEl: HTMLElement | null = null;
  let tipRow: HTMLButtonElement | null = null;
  const closeTip = (): void => {
    const el_ = tipEl;
    const row = tipRow;
    tipEl = null;
    tipRow = null;
    if (el_ === null || row === null) return;
    row.removeAttribute("aria-describedby");
    row.setAttribute("aria-expanded", "false");
    const rows = row.parentElement as HTMLElement | null;
    const finish = (): void => {
      el_.remove();
      row.classList.remove("open");
      if (rows !== null && (tipEl === null || !rows.contains(tipEl))) {
        rows.classList.remove("open");
        rows.style.gap = "";
      }
    };
    if (reducedMotion) { finish(); return; }
    el_.classList.remove("on");
    setTimeout(finish, 220);
  };
  /** A tap anywhere else closes an open tip. */
  const onDown = (e: PointerEvent): void => {
    if (!wrap.isConnected) {
      document.removeEventListener("pointerdown", onDown, true);
      return;
    }
    if (tipEl === null || !(e.target instanceof Node)) return;
    if (tipEl.contains(e.target) || (tipRow?.contains(e.target) ?? false)) return;
    closeTip();
  };
  document.addEventListener("pointerdown", onDown, true);

  /** The inline panel under a tippable row's bar — `share` is eaten÷target RAW so the tip's
   *  branch and the row's `.ov` read the same answer. The copy is shared `macroTip`'s. */
  const wireTip = (row: HTMLButtonElement, kind: MacroTipKind, share: number): void => {
    row.setAttribute("aria-expanded", "false");
    row.addEventListener("click", () => {
      if (tipRow === row) { closeTip(); return; }
      closeTip();
      const tipa = el("span", `tipa${share > 1 ? " ov" : ""}`);
      tipa.style.setProperty("--t", `var(--macro-${share > 1 ? "kcal" : kind === "satfat" ? "fat" : kind}-t)`);
      tipa.setAttribute("aria-hidden", "true");
      const inner = el("span", "tipa-i");
      const c = el("span", "tipa-c", macroTip(kind, share, lang));
      c.id = "mtip-live";
      inner.append(c);
      tipa.append(inner);
      row.append(tipa);
      tipEl = tipa;
      tipRow = row;
      row.setAttribute("aria-describedby", "mtip-live");
      row.setAttribute("aria-expanded", "true");
      row.classList.add("open");
      const rows = row.parentElement as HTMLElement;
      if (!rows.classList.contains("open")) {
        // A row's footprint is offsetHeight + its (possibly negative) margins: the hover pill
        // and the open state pad a row 4 px and take it back in margin.
        const kids = [...rows.children] as HTMLElement[];
        const free = rows.clientHeight - kids.reduce((s, k) => {
          const m = getComputedStyle(k);
          return s + k.offsetHeight + parseFloat(m.marginTop) + parseFloat(m.marginBottom);
        }, 0);
        rows.style.gap = `${Math.max(0, free / Math.max(1, kids.length - 1))}px`;
        rows.classList.add("open");
      }
      if (reducedMotion) tipa.classList.add("on");
      else requestAnimationFrame(() => requestAnimationFrame(() => tipa.classList.add("on")));
    });
  };

  // ── The day card (F) ────────────────────────────────────────────────────────────────────
  //
  // ONE card — `.dayc` inside `.dayw`: the 128 px hero (kcal on
  // page 1, the day score on page 2), the hairline, the bar rows, the dots inside. Both pages
  // stay mounted in `.dtrack`; the card's own overflow is the clip and its height never
  // changes — the switching and failed reads draw the same card dashed.

  /** "{grams} left|over" split at the placeholder — the figure keeps its weight, the word
   *  reads light (the boards' `<b>55g<small> left</small></b>`). */
  const figureBits = (b: HTMLElement, tpl: string, grams: string): void => {
    const [pre = "", post = ""] = tpl.split("{grams}");
    if (pre !== "") b.append(el("small", "", pre));
    b.append(document.createTextNode(grams));
    if (post !== "") b.append(el("small", "", post));
  };

  /** One bar row — the boards' `.mrow`: the 16 px line icon, the name, the "{grams} left"
   *  figure split at the placeholder, the 6 px bar. A row with NO target draws the total
   *  alone — no bar, no suffix. Tippable rows are real buttons. */
  const macroRow = (o: {
    icon: IconName;
    name: string;
    /** The "55g" / "835mg" figure, already formatted — "—g" on the dashed reads. */
    grams: string;
    /** eaten÷target, raw — unset is the targetless row (the total alone); >1 is over. */
    share?: number;
    /** The bar fill's token name — `macro-<name>`; the over row always fills ink. */
    tone?: string;
    tipKind?: MacroTipKind | undefined;
  }): HTMLElement => {
    const over = o.share !== undefined && o.share > 1;
    const row = el(
      o.tipKind !== undefined ? "button" : "div",
      `mrow${over ? " ov" : ""}${o.tipKind !== undefined ? " tip" : ""}`,
    ) as HTMLElement;
    if (o.tipKind !== undefined) (row as HTMLButtonElement).type = "button";
    const h = el("span", "h");
    h.append(kitEl(ico(o.icon)), el("span", "", o.name));
    const fig = el("b", "num");
    if (o.share === undefined) fig.append(document.createTextNode(o.grams));
    else figureBits(fig, over ? L.gramOver : L.gramLeft, o.grams);
    h.append(fig);
    row.append(h);
    if (o.share !== undefined) {
      const bar = el("span", "bar");
      const i = el("i", "");
      i.style.width = `${Math.min(100, Math.max(0, o.share * 100))}%`;
      i.style.background = `var(--${over ? "ink" : (o.tone ?? "ink")})`;
      bar.append(i);
      row.append(bar);
      if (o.tipKind !== undefined) {
        wireTip(row as HTMLButtonElement, o.tipKind, o.share);
      }
    }
    return row;
  };

  /** A target-bearing row — the figure is the remainder under "left", the overage under
   *  "over" (macroCardState's pair), the share raw for the bar and the tip. */
  const leftRow = (
    icon: IconName, name: string, eaten: number, target: number | undefined,
    opts: { mg?: boolean; tip?: MacroTipKind } = {},
  ): HTMLElement => {
    // `eaten` arrives RAW — the figure rounds at the format step, so the row and the day note
    // (which subtracts the unrounded total) never disagree by a gram.
    const fig = opts.mg === true
      ? (v: number) => fill(L.milligrams, { n: n(Math.round(v)) })
      : (v: number) => gram(Math.round(v));
    if (target === undefined) return macroRow({ icon, name, grams: fig(eaten) });
    const share = target > 0 ? eaten / target : 1;
    const over = share > 1;
    return macroRow({
      icon,
      name,
      grams: fig(over ? eaten - target : macroLeft(target, eaten)),
      share,
      tone: opts.mg === true ? "ink" : `macro-${icon === "satfat" ? "fat" : icon}`,
      tipKind: opts.tip,
    });
  };

  /** The hero's ring — the boards' 96 px instrument: the faint track, the day's arc (accent,
   *  or `--over` past the plan), the stroked flame centred; `null` share is the bare track. */
  const heroRing = (share: number | null, over: boolean): HTMLElement => {
    const kr = el("div", "kr");
    const d = share === null ? null : ringDash(share, 40);
    const arc = d === null ? "" :
      `<circle class="fg" cx="48" cy="48" r="40" fill="none" stroke="var(--${over ? "over" : "accent"})" ` +
      `stroke-width="8" stroke-dasharray="${d.dasharray}" stroke-dashoffset="${d.dashoffset}" stroke-linecap="round"/>`;
    kr.append(kitEl(`<svg class="r" viewBox="0 0 96 96"><circle cx="48" cy="48" r="40" fill="none" stroke="var(--hair)" stroke-width="8"/>${arc}</svg>`));
    kr.append(kitEl(iconSvg("flame", { size: 34, class: "fl" })));
    return kr;
  };

  /** The 128 px kcal hero — the whole band is the left↔eaten toggle ONLY on today with meals
   *  (the swap arrows in the label); every other read is static, the unread one dashes. The
   *  toggle's own crossfade is 150 ms on the figure block. */
  const kcalHero = (day: DayResponse | null, rich: boolean): HTMLElement => {
    const hero = el(rich ? "button" : "div", "hk") as HTMLElement;
    const figs = el("div", "");
    const fig = el("b", "fig num");
    const lab = el("span", "lbl");
    if (day === null) {
      hero.classList.add("dash");
      fig.textContent = "—";
      lab.textContent = L.kcalLeft;
      figs.append(fig, lab);
      hero.append(figs, heroRing(null, false));
      return hero;
    }
    const budget = dayBudget(day, today, me.profile.goal);
    const isToday = viewing === today;
    // F's pair, `kcalCardState`'s one choice: today-with-meals toggles left↔eaten, a finished
    // past day reads eaten (it has nothing "left"), an over day reads the overage under
    // "kcal over" — the hero's dark red, in `--over`, never `--bad`.
    const asEaten = (rich && showEaten) || (!isToday && !budget.warn && day.meals.length > 0);
    const s = kcalCardState(budget, asEaten);
    const labelFor = (st: typeof s): string =>
      st.label === "over" ? L.kcalOver : st.label === "eaten" ? L.kcalEaten : L.kcalLeft;
    const ariaFor = (st: typeof s): string =>
      fill(st.label === "over" ? L.kcalOverDetail
        : st.label === "eaten" ? L.kcalEatenDetail : L.kcalLeftDetail,
        { eaten: kn(budget.eaten), plan: kn(budget.target) });
    fig.textContent = kn(s.figure);
    lab.append(document.createTextNode(labelFor(s)));
    if (rich) lab.append(kitEl(iconSvg("swap", { size: 12, strokeWidth: 2.2 })));
    figs.append(fig, lab);
    if (budget.warn) hero.classList.add("over");
    hero.append(figs, heroRing(budget.fill, budget.warn));
    hero.setAttribute("aria-label", ariaFor(s));
    if (rich) {
      (hero as HTMLButtonElement).type = "button";
      hero.addEventListener("click", () => {
        showEaten = !showEaten;
        const ns = kcalCardState(budget, showEaten);
        figs.classList.add("xfd");
        setTimeout(() => {
          fig.textContent = kn(ns.figure);
          lab.firstChild!.textContent = labelFor(ns);
          hero.setAttribute("aria-label", ariaFor(ns));
          figs.classList.remove("xfd");
        }, 150);
      });
    }
    return hero;
  };

  /** Page 2's hero — "Day score · {n}/10 ›" over the ink bar: a real button while the day has
   *  a score (it opens the breakdown sheet — the score row is gone), the dash "—" otherwise. */
  const scoreHero = (day: DayResponse | null): HTMLElement => {
    const score = day?.healthScore ?? null;
    const hero = el(
      score !== null ? "button" : "div",
      `hsc${score === null ? " dash" : ""}`,
    ) as HTMLElement;
    const row = el("span", "hrow");
    const fig = el("b", "fig num");
    // The dash read is "— /10" — the phone's hero draws the same (#1331).
    if (score === null) fig.append(document.createTextNode("—"), el("small", "", "/10"));
    else {
      fig.append(document.createTextNode(n(score)), el("small", "", "/10 ›"));
    }
    row.append(el("span", "hsct", SC.title), fig);
    const bar = el("span", "hsb");
    const i = el("i", "");
    // The dash read is an EMPTY bar — `display:block` with no width fills the track.
    i.style.width = score === null ? "0%" : `${Math.max(0, Math.min(100, score * 10))}%`;
    bar.append(i);
    hero.append(row, bar);
    if (score !== null) {
      (hero as HTMLButtonElement).type = "button";
      hero.addEventListener("click", () => openScore(day!));
    } else {
      hero.setAttribute("role", "group");
      hero.setAttribute("aria-label", `${SC.title}, ${SC.notYet}`);
    }
    return hero;
  };

  /** The line under the diary card — the most-constraining declared target's remainder
   *  (lowest share, the phone's pick), today with meals only. `{grams}` in the copy is a
   *  NUMBER — the template carries its own "g", so sodium (mg) stays out of the candidates. */
  const dayNote = (day: DayResponse): HTMLElement | null => {
    const t = day.targets;
    const rows: { share: number; noun: string; left: number }[] = [];
    if (t.protein_g > 0) rows.push({ share: day.totals.protein_g / t.protein_g, noun: L.macros.protein.name, left: macroLeft(t.protein_g, day.totals.protein_g) });
    if (t.carbs_g > 0) rows.push({ share: day.totals.carbs_g / t.carbs_g, noun: L.macros.carbs.name, left: macroLeft(t.carbs_g, day.totals.carbs_g) });
    // The noun is the table's own — the verdicts' inline noun lives in the Lingui stack,
    // which the browser bundle never reaches (#145).
    if ((t.satfat_g ?? 0) > 0) rows.push({ share: day.totals.satfat_g / t.satfat_g!, noun: L.dayNoteSatFat, left: macroLeft(t.satfat_g!, day.totals.satfat_g) });
    // A target already met or over names nothing — the note only ever asks to eat LESS later,
    // never "0g to go".
    const pick = rows.filter((r) => r.left > 0).sort((a, b) => a.share - b.share)[0];
    if (pick === undefined) return null;
    const note = el("div", "hnote");
    note.textContent = fill(L.phoneDayNote, { nutrient: pick.noun, grams: n(pick.left) });
    return note;
  };

  /** The F day card — the two-page track, the dots inside, the pan and the tip hooks. A drawn
   *  page keeps across draws (`page` is the screen's), and the failed read keeps the card's
   *  shape with every figure a dash and the switcher hidden (`.dots none`). */
  const dayCard = (day: DayResponse | null, rich: boolean): HTMLElement => {
    // A redraw discards the card whole — the tip refs would point at detached nodes.
    tipEl = null;
    tipRow = null;
    const dayw = el("div", "dayw");
    const card = el("div", "dayc");
    const track = el("div", "dtrack");
    const p1 = el("div", "dpage");
    const p2 = el("div", "dpage");
    const rowsOne = el("div", "rows");
    const rowsTwo = el("div", "rows");
    if (day === null) {
      for (const [icon, name] of [
        ["protein", L.macros.protein.name], ["carbs", L.macros.carbs.name], ["fat", L.macros.fat.name],
      ] as const) {
        rowsOne.append(macroRow({ icon, name, grams: fill(L.grams, { n: "—" }), share: 0 }));
      }
      for (const [icon, name] of [
        ["satfat", L.macros.satFat.name], ["fibre", L.macros.fibre.name],
        ["sugar", L.macros.sugar.name], ["salt", L.macros.sodium.name],
      ] as const) {
        rowsTwo.append(macroRow({ icon, name, grams: fill(L.grams, { n: "—" }), share: 0 }));
      }
    } else {
      // Page 1's protein/carbs/fat; page 2's sat fat, fibre, sugar, sodium — the boards' order.
      rowsOne.append(
        leftRow("protein", L.macros.protein.name, day.totals.protein_g, day.targets.protein_g, { tip: "protein" }),
        leftRow("carbs", L.macros.carbs.name, day.totals.carbs_g, day.targets.carbs_g, { tip: "carbs" }),
        leftRow("fat", L.macros.fat.name, day.totals.fat_g, day.targets.fat_g),
      );
      rowsTwo.append(
        leftRow("satfat", L.macros.satFat.name, day.totals.satfat_g, day.targets.satfat_g, { tip: "satfat" }),
        macroRow({ icon: "fibre", name: L.macros.fibre.name, grams: gram(Math.round(day.totals.fiber_g)) }),
        macroRow({ icon: "sugar", name: L.macros.sugar.name, grams: gram(Math.round(day.totals.sugar_g)) }),
        leftRow("salt", L.macros.sodium.name, day.totals.sodium_mg, day.targets.sodium_mg, { mg: true }),
      );
    }
    p1.append(kcalHero(day, rich), el("div", "hl"), rowsOne);
    p2.append(scoreHero(day), el("div", "hl"), rowsTwo);
    track.append(p1, p2);

    const dots = el("div", `dots${day === null ? " none" : ""}`);
    const show = (to: 0 | 1): void => {
      page = to;
      track.style.transition = "";
      track.style.transform = to === 1 ? "translateX(-100%)" : "";
      p1.setAttribute("aria-hidden", String(to !== 0));
      p2.setAttribute("aria-hidden", String(to !== 1));
      p1.toggleAttribute("inert", to !== 0);
      p2.toggleAttribute("inert", to !== 1);
      [...dots.children].forEach((b, i) => b.classList.toggle("on", i === to));
      // The composer is page 1's (#170): hidden on page 2 rather than gone, so a drafted line
      // survives the pan.
      comp.form.hidden = to !== 0;
      closeTip();
    };
    for (const p of [0, 1] as const) {
      const b = el("button", p === page ? "on" : "") as HTMLButtonElement;
      b.type = "button";
      b.setAttribute("aria-label", fill(L.webPage, { n: n(p + 1), total: n(2) }));
      b.append(el("i", ""));
      b.addEventListener("click", () => { if (p !== page) show(p); });
      dots.append(b);
    }
    card.append(track, dots);

    // The card pans like the strip — under the finger, under the trackpad, and on ←/→ while
    // it has focus (cardPan). A drag past 40 px commits the page; a shorter one springs back,
    // and the click it ends is swallowed so a hero tap never also toggles.
    let drag: { x: number; id: number; moved: boolean } | null = null;
    let swallowClick = false;
    card.addEventListener("pointerdown", (e) => {
      if (e.button !== 0 || day === null) return;
      drag = { x: e.clientX, id: e.pointerId, moved: false };
    });
    card.addEventListener("pointermove", (e) => {
      if (drag === null || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && Math.abs(dx) > 8) {
        drag.moved = true;
        swallowClick = true;
        try { card.setPointerCapture(e.pointerId); } catch { /* the pointer is gone */ }
      }
      if (drag.moved) {
        track.style.transition = "none";
        track.style.transform = `translateX(calc(${-page * 100}% + ${dx}px))`;
      }
    });
    card.addEventListener("pointerup", (e) => {
      if (drag === null || e.pointerId !== drag.id) return;
      const { x, moved } = drag;
      drag = null;
      track.style.transition = "";
      if (!moved) return;
      const dx = e.clientX - x;
      if (Math.abs(dx) >= 40) show(dx < 0 ? 1 : 0);
      else track.style.transform = page === 1 ? "translateX(-100%)" : "";
    });
    card.addEventListener("pointercancel", () => {
      drag = null;
      track.style.transition = "";
      track.style.transform = page === 1 ? "translateX(-100%)" : "";
    });
    card.addEventListener("click", (e) => {
      if (swallowClick) { e.preventDefault(); e.stopPropagation(); swallowClick = false; }
    }, true);
    let cardWheelAt = 0;
    card.addEventListener("wheel", (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) || day === null) return;
      e.preventDefault();
      if (e.timeStamp - cardWheelAt > 260) show(e.deltaX > 0 ? 1 : 0);
      cardWheelAt = e.timeStamp;
    }, { passive: false });
    cardPan = (d) => {
      const to = page + d;
      if (to < 0 || to > 1 || day === null) return false;
      show(to as 0 | 1);
      return true;
    };

    show(page);
    dayw.append(card);
    return dayw;
  };

  /** The per-day score board (`web/today-score.html`): title, method line, one row per meal. */
  const openScore = (day: DayResponse): void => {
    const overlay = el("div", "scorewrap");
    const card = el("div", "card scorecard");
    const title = el("div", "stitle");
    title.append(
      el("b", "", day.date === today ? SC.breakdownTitle : SC.title),
      el("b", "snum", fill(SC.outOf, { n: n(day.healthScore ?? 0) })),
    );
    card.append(title, el("p", "sline", day.date === today ? SC.breakdownLine : SC.dayBreakdownLine));
    for (const meal of day.meals) {
      if (meal.healthScore === null) continue;
      const row = el("a", "hsp") as HTMLAnchorElement;
      row.href = `#/meal/${encodeURIComponent(meal.id)}?d=${encodeURIComponent(viewing)}`;
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
  words.addEventListener("paste", (e) => {
    const files = [...(e as ClipboardEvent).clipboardData?.files ?? []].filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) return;
    e.preventDefault();
    viewing = today;
    const r = words.getBoundingClientRect();
    void enqueue(files, { x: r.x, y: r.y, w: r.width, h: r.height });
  });
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

  /** The date the mounted card shows — the card dashes only when the day CHANGES (the boards'
   *  today-switching: same card, every figure a dash, the dots still there); a refetch of the
   *  same day repaints it in place when it lands. */
  let cardDate: string | null = null;

  /** The day as the server now has it, redrawn after every write and every navigation. */
  async function draw(): Promise<void> {
    const mine = ++dayDrawing;
    const monday = mondayOf(viewing);
    if (cardDate !== null && cardDate !== viewing) {
      // The day switched — the card dashes and the diary column spins while the new day fetches.
      frame.side.querySelector(".dayw")?.replaceWith(dayCard(null, false));
      clear(wrap).append(h1, kitEl('<div class="spin" role="status"><i></i></div>'), notice);
    }
    // The strip's three mounted weeks ride the same read — [monday-7, monday+6] covers
    // previous | current | next, so a slide's neighbour is already in memory.
    const [dayR, daysR] = await Promise.all([
      api<DayResponse>(`/diary/day?date=${viewing}`)
        .then((d) => ({ ok: true as const, d }))
        .catch(() => ({ ok: false as const })),
      api<DaysResponse>(`${DAYS}?from=${dateMinus(monday, 7)}&to=${dateMinus(monday, -6)}`)
        .then((d) => ({ ok: true as const, d }))
        .catch(() => ({ ok: false as const })),
    ]);
    if (mine !== dayDrawing) return;

    const day = dayR.ok ? dayR.d : null;
    if (daysR.ok) {
      lastDays = daysR.d;
      barStreak = lastDays.streak;
      stripPaint(lastDays);
    }
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
    const queued = isToday && queueLength() > 0;
    const hidden = queuedMealIds();
    const shown = day?.meals.filter((m) => !hidden.has(m.id)) ?? [];
    const hasMeals = shown.length > 0 || queued;
    const logging = heldProposal() !== null || turning;
    // The hero's toggle, "Recent" and the day note are today-with-meals only; the
    // card's pages are every day's.
    const rich = isToday && hasMeals && !logging;
    cardDate = viewing;

    // ── The left column: the label, the meal list, the day note, the empty/failed state ──
    // "Recent" only while today holds meals; every other state names no date — the
    // strip's marked cell already says which day this is.
    const left: Element[] = rich ? [el("span", "hsec", L.recentlyUploaded)] : [];
    if (day === null) {
      // The failed read — one line and the retry pill, the boards' `.herr`; the card dashes.
      const herr = el("div", "herr");
      herr.append(el("span", "", L.diaryFailed));
      const retry = el("button", "") as HTMLButtonElement;
      retry.type = "button";
      retry.append(kitEl(ico("retry")), el("span", "", L.tryAgain));
      retry.addEventListener("click", () => { void draw(); });
      herr.append(retry);
      left.push(herr);
    } else if (!hasMeals) {
      // The whole panel is the log-a-meal action — the boards' `.hempty`, the upload flow's door.
      const card = el("a", "hempty rise") as HTMLAnchorElement;
      card.href = "#/log";
      card.setAttribute("aria-label", `${L.nothingLogged} ${S.logMeal}`);
      card.append(
        kitEl('<svg class="plate" viewBox="0 0 64 64" aria-hidden="true">' +
          '<circle cx="32" cy="32" r="30" fill="none" stroke="var(--faint)" stroke-width="1.5"/>' +
          '<circle cx="32" cy="32" r="20" fill="none" stroke="var(--faint)" stroke-width="1.5"/></svg>'),
        el("span", "", L.nothingLogged),
      );
      left.push(card);
    } else {
      const card = el("div", "dlist");
      if (isToday) card.append(queueEl());
      for (const meal of shown) {
        card.append(mealRow(meal, !rich));
      }
      left.push(card);
      if (rich) {
        const note = dayNote(day);
        if (note !== null) left.push(note);
      }
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

    // ── The right column: the strip, the day card, the actions ──
    // The strip is the PERSISTENT element painted above; the day card mounts under it.
    const right: Element[] = [stripBox, dayCard(day, rich)];

    // Today carries the actions: the upload CTA — gone while a turn is out or a proposal is held
    // (today-logging draws compose with no CTA) — and the composer. The failed board draws
    // neither: its right column ends at the dash card.
    if (isToday && day !== null) {
      if (!logging) {
        // "Upload a photo" joins the queue (#1318); `#/log` stays the empty card's read-in-place flow.
        const pick = el("input", "visually-hidden") as HTMLInputElement;
        pick.type = "file";
        pick.accept = "image/jpeg,image/png,image/webp";
        pick.multiple = true;
        pick.tabIndex = -1;
        pick.setAttribute("aria-label", L.webUploadPhoto);
        const upload = ctaEl({ text: L.webUploadPhoto, kind: "p", icon: "upload" });
        pick.addEventListener("change", () => {
          viewing = today;
          const r = upload.getBoundingClientRect();
          void enqueue([...pick.files ?? []], { x: r.x, y: r.y, w: r.width, h: r.height });
          pick.value = "";
        });
        upload.addEventListener("click", () => pick.click());
        right.push(upload, pick);
      }
      right.push(comp.form);
    }

    clear(wrap).append(h1, ...left, notice);
    frame.side.setAttribute("aria-label", L.webDayRegion);
    clear(frame.side).append(...right);
  }

  /** A meal row: the photo or the no-photo tile, the time, the verdict line — the gram chips
   *  only on the "Recent" form (`compact` is the past-day and logging boards' row). */
  const mealRow = (meal: MealRecord, compact: boolean): Element =>
    inPlace(meal.id, () => plainRow(meal, compact));
  const plainRow = (meal: MealRecord, compact: boolean): Element => {
    // The row opens the meal's own breakdown — design's ruling (#91's Q7): `#/meal/:id`, W6's
    // prefix. The board draws `.meal` without a glyph; the link is the affordance.
    const row = mealRowEl(meal, {
      time: mealTime(meal.ts),
      compact,
      href: `#/meal/${encodeURIComponent(meal.id)}?d=${encodeURIComponent(viewing)}`,
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
