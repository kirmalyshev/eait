// Progress — the weight chart, the goal bar, this week's bars, the streak and the BMI card
// (`#/progress`, W8 #95). The board is `product/design/pro/web/progress.html`: two columns at
// desktop width, the weight card leading the left one, stacked under 761 px.
//
// EVERY FIGURE IS THE SERVER'S. `/v1/weights` answers the merged weigh-in log filtered to the
// selected range, the overall latest weigh-in, the goal projection and the BMI (S7/S10, post-#117);
// `/v1/diary/days` answers the week's bars, the plan they are read against and the streak. Nothing
// here computes a target, a BMI or a streak, and the range the user picked is never moved for them
// (design-pro's ruling on the issue).

import { weightCard } from "../../shared/progress.ts";
import { BMI_SEGMENTS, bmiTick, goalBar, WEIGHT_RANGES, weightChart, type WeightRange } from "../../shared/ui/charts.ts";
import { heightText, kgToLb, type UnitSystem } from "../../shared/ui/units.ts";
import { dateMinus, localDate, weekStart } from "../../shared/dates.ts";
import { countText, dayMonthOn, decimalNumbers, numbers, weekdayLetters, wholeNumbers } from "../../shared/lang.ts";
import { bmiCopy, bmiRangeLabel } from "../../shared/app/bmi-copy.ts";
import { progressCopyFor } from "../../shared/app/progress-copy.ts";
import type {
  DaysResponse, PlanProjection, ProfileResponse, WeightsResponse,
} from "@eait/shared";
import { api, Unauthenticated } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { weekBarsEl, weightChartEl } from "../kit.ts";
import { clear, el, lang, refusalWords, render, type Frame } from "../shell.ts";

const LOG_WEIGHT = "#/you"; // the weigh-in lives on You (W10), the same door its "Log weight" takes.

export async function progressScreen(frame: Frame): Promise<HTMLElement> {
  const me = frame.me;
  const copy = progressCopyFor(lang);
  const bmi = bmiCopy(lang);
  const units: UnitSystem = me?.profile.units ?? "metric";
  const n = numbers(lang);
  const nWhole = wholeNumbers(lang);
  const letters = weekdayLetters(lang);

  /** A kg figure the way this account reads it — converted at display, never written back. */
  const wnum = (kg: number): string => n(units === "imperial" ? kgToLb(kg) : kg);
  const zone = me?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const fmtDate = (d: string): string => dayMonthOn(lang, d, localDate(zone));
  const monday = weekStart(localDate(zone));
  const sunday = dateMinus(monday, -6);

  const wrap = el("section", "");
  // One h1 per page, and the boards draw no centred title on web — clipped, for the landmark.
  wrap.append(el("h1", "visually-hidden", copy.title));
  const cols = el("div", "prog");
  const leftCol = el("div", "wcol");
  const rightCol = el("div", "wcol");
  cols.append(leftCol, rightCol);
  wrap.append(cols);

  // ── The weight card ── the segmented range stays where the user left it; only the body redraws.
  let range: WeightRange = "90D";
  const wCard = el("div", "card rise rc-0");
  const wHead = el("div", "row between");
  wHead.append(el("span", "lab", copy.weightLabel));
  const seg = el("div", "seg");
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", copy.weightLabel);
  const segBtns = new Map<WeightRange, HTMLButtonElement>();
  // A failed range refetch keeps the card that is already drawn and names the refusal under it,
  // the way a chat line's notice does — never a silent stale figure. A dead session re-renders
  // into the sign-in screen, as `render()`'s own boundary does.
  const wNotice = el("p", "notice");
  wNotice.setAttribute("role", "alert");
  wNotice.hidden = true;
  for (const r of WEIGHT_RANGES) {
    const b = el("button", r === range ? "on" : "", copy.ranges[r]) as HTMLButtonElement;
    b.type = "button";
    b.setAttribute("aria-pressed", String(r === range));
    b.addEventListener("click", () => {
      if (r === range) return;
      range = r;
      void drawWeights().catch(async (err: unknown) => {
        console.error(err);
        if (err instanceof Unauthenticated) { await render(); return; }
        wNotice.textContent = refusalWords(err);
        wNotice.hidden = false;
      });
    });
    seg.append(b);
    segBtns.set(r, b);
  }
  wHead.append(seg);
  const wBody = el("div", "");
  wCard.append(wHead, wBody, wNotice);

  const logLink = (text: string): HTMLElement => {
    const a = el("a", "plink", text);
    a.setAttribute("href", LOG_WEIGHT);
    return a;
  };

  /**
   * The big figure: `{n}` in the display weight, and the card's own tail keys for the quieter
   * half — `weightNowTail` (just the unit) or `weightLatestTail` (unit · date). Split keys, so
   * no template is ever cut at a placeholder here.
   */
  const weightFigure = (kg: number, tail: string): HTMLElement => {
    const row = el("div", "wnum");
    row.append(el("b", "d d28 num", wnum(kg)), el("span", "uw", ` ${tail}`));
    return row;
  };
  const dashFigure = (): HTMLElement => {
    const row = el("div", "wnum");
    row.append(el("b", "d d28 num", "—"));
    return row;
  };

  const emptyFrame = (): Element =>
    weightChartEl([], { aria: copy.weightChartName, first: "", last: "", from: "", to: "" });

  const fillWeight = (w: WeightsResponse): void => {
    clear(wBody);
    const state = weightCard(w.weights, w.latest);
    const points = w.weights.map((e) => ({ t: Date.parse(`${e.date}T00:00:00Z`), kg: e.kg }));

    if (state.kind === "empty") {
      wBody.append(dashFigure(), emptyFrame(), logLink(copy.weightEmpty));
      return;
    }
    if (state.kind === "none-in-range") {
      wBody.append(
        weightFigure(state.latest.kg, fill(copy.weightLatestTail[units], { date: fmtDate(state.latest.date) })),
        emptyFrame(),
        el("p", "wempty", copy.weightNone[range]),
        logLink(copy.weightEmpty),
      );
      return;
    }
    // `one` and `trend` both show the newest weigh-in — the range ends today, so its last point is
    // the log's latest, and a single point draws alone with its value and date, no invented second.
    wBody.append(weightFigure(w.latest!.kg, copy.weightNowTail[units]));
    const first = w.weights[0]!, last = w.weights.at(-1)!;
    // The end labels name the TREND's endpoints, not the raw readings they once did — a label at
    // the line's end quotes the value the line ends at (#1114). The figure above stays `latest`.
    const trend = weightChart(points);
    wBody.append(weightChartEl(points, {
      aria: copy.weightChartName,
      first: trend.firstValue === null ? "" : wnum(trend.firstValue),
      last: state.kind === "trend" && trend.lastValue !== null ? wnum(trend.lastValue) : "",
      from: fmtDate(first.date),
      to: state.kind === "trend" ? fmtDate(last.date) : "",
    }));
    if (state.kind === "one") wBody.append(logLink(copy.weightOneMore));
  };

  let wSeq = 0;
  const drawWeights = async (): Promise<WeightsResponse> => {
    const mine = ++wSeq;
    const w = await api<WeightsResponse>(`/weights?range=${range}`);
    if (mine !== wSeq) return w;
    wNotice.hidden = true;
    for (const [r, b] of segBtns) {
      b.classList.toggle("on", r === range);
      b.setAttribute("aria-pressed", String(r === range));
    }
    fillWeight(w);
    return w;
  };

  // ── The goal bar — the server's projection, or no card where no honest one exists. ──
  const goalCardEl = (p: PlanProjection): HTMLElement => {
    const bar = goalBar(p.startKg, p.currentKg, p.targetKg);
    const card = el("div", "card rise rc-1");
    const head = el("div", "row between");
    head.append(
      el("b", "num gline", fill(copy.goalLine[units], { from: wnum(p.startKg), to: wnum(p.targetKg) })),
      el("span", "est", p.beyondHorizon ? copy.goalEstimateFar : fill(copy.goalEstimate, { month: p.month })),
    );
    const barEl = el("progress", "gbar") as HTMLProgressElement;
    barEl.max = 1;
    barEl.value = bar.share;
    barEl.setAttribute("aria-label", fill(copy.goalLine[units], {
      from: wnum(p.startKg), to: wnum(p.targetKg),
    }));
    // done runs the direction the plan points — "kg up" for a gain, "kg down" for a lose.
    const doneTpl = p.targetKg >= p.startKg ? copy.goalUp : copy.goalDown;
    const under = el("div", "row between t12 m num");
    under.append(
      el("span", "", fill(doneTpl[units], { n: wnum(bar.doneKg) })),
      el("span", "", fill(copy.goalToGo[units], { n: wnum(bar.toGoKg) })),
    );
    card.append(head, barEl, under);
    return card;
  };

  // ── This week — the server's seven days against its plan line. ──
  const weekCardEl = (d: DaysResponse): HTMLElement => {
    const card = el("div", "card rise rc-2");
    const head = el("div", "row between");
    head.append(
      el("span", "lab", copy.weekLabel),
      el("span", "est", fill(copy.weekPlan, { plan: nWhole(d.targetKcal) })),
    );
    const bars = weekBarsEl(d.days.map((day) => day.logged ? day.kcal : null), d.targetKcal, {
      todayIndex: d.days.findIndex((day) => day.when === "today"),
      letters,
      planLabel: nWhole(d.targetKcal),
    });
    bars.setAttribute("aria-label", fill(copy.weekPlan, { plan: nWhole(d.targetKcal) }));
    const chart = el("div", "wchart");
    chart.append(bars);
    card.append(head, chart);
    return card;
  };

  // ── Streak — the count is the server's; the dots are this week's logged days, M–S. ──
  const streakCardEl = (d: DaysResponse): HTMLElement => {
    const card = el("div", "card rise rc-3");
    const head = el("div", "row between");
    head.append(
      el("span", "lab", copy.streakLabel),
      el("b", "num", countText(lang)(copy.streakDays, d.streak)),
    );
    const dots = el("div", "row between stk");
    d.days.forEach((day, i) => {
      const cell = el("div", "sd");
      const dot = el("i", day.logged ? "sdot on" : "sdot");
      if (day.logged) dot.append(el("i", "ico i-check"));
      cell.append(dot, el("span", "sdl", letters[i] ?? ""));
      dots.append(cell);
    });
    card.append(head, dots);
    return card;
  };

  // ── The BMI card — the server's figure, the neutral band labels, the "?" explains. ──
  const bmiCardEl = (w: WeightsResponse): HTMLElement => {
    const card = el("div", "card rise rc-4");
    const head = el("div", "row between");
    const help = el("button", "bmihelp") as HTMLButtonElement;
    help.type = "button";
    help.setAttribute("aria-label", copy.bmiHelp);
    help.setAttribute("aria-expanded", "false");
    help.setAttribute("aria-controls", "bmi-explainer");
    help.append(el("i", "ico i-help"));
    head.append(el("span", "lab", bmi.bmi), help);
    card.append(head);

    if (w.bmi === null) {
      card.append(dashFigure(), logLink(copy.bmiEmpty));
      return card;
    }

    const value = el("div", "wnum");
    // "25.0" — a BMI is one decimal always (Kirill's direction), so the whole-number shape
    // `numbers` picks is wrong here.
    value.append(el("b", "d d28 num", decimalNumbers(lang)(w.bmi.value)));
    card.append(value);

    const on = BMI_SEGMENTS.findIndex((s) => s.id === w.bmi!.range);
    // The board's .bmi: four 8px segments and an 18px tick, pixel-true at any card width —
    // which is why it is divs and not the earlier scaling svg.
    const scale = el("div", "bmi");
    scale.setAttribute("aria-hidden", "true");
    BMI_SEGMENTS.forEach((_, i) => scale.append(el("i", i === on ? "on" : "")));
    const tick = el("b", "");
    tick.style.left = `${Math.round(bmiTick(w.bmi.value, w.bmi.range) * 1000) / 10}%`;
    scale.append(tick);
    card.append(scale);

    const labels = el("div", "bmil");
    BMI_SEGMENTS.forEach((s, i) => {
      labels.append(el("span", i === on ? "on" : "", bmiRangeLabel(s.id, lang)));
    });
    card.append(labels);

    const explainer = el("div", "t12 m bmix", bmi.bmiExplainer);
    explainer.id = "bmi-explainer";
    explainer.hidden = true;
    help.addEventListener("click", () => {
      explainer.hidden = !explainer.hidden;
      help.setAttribute("aria-expanded", String(!explainer.hidden));
    });
    card.append(explainer);

    // "From 73.4kg and 172cm" — the weigh-in the figure was computed on, and the profile's height.
    const heightCm = me?.profile.height_cm ?? null;
    const kg = w.latest?.kg ?? me?.profile.weight_kg ?? null;
    if (heightCm !== null && kg !== null) {
      card.append(el("div", "t12 m bmis", fill(copy.bmiFrom, {
        w: fill(copy.weightNow[units], { n: wnum(kg) }),
        h: heightText(heightCm, units, lang),
      })));
    }
    return card;
  };

  // ── The draw: weights for the range, and the week the two right-hand cards read. ──
  const [w, d] = await Promise.all([
    api<WeightsResponse>(`/weights?range=${range}`),
    api<DaysResponse>(`/diary/days?from=${monday}&to=${sunday}`),
  ]);

  fillWeight(w);
  leftCol.append(wCard);
  if (w.projection !== null) leftCol.append(goalCardEl(w.projection));
  rightCol.append(weekCardEl(d), streakCardEl(d), bmiCardEl(w));

  return wrap;
}
