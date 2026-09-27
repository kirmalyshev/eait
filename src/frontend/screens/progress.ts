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
import { BMI_SEGMENTS, bmiTick, goalBar, WEIGHT_RANGES, type WeightRange } from "../../shared/ui/charts.ts";
import { heightText, kgToLb, type UnitSystem } from "../../shared/ui/units.ts";
import { dateMinus, localDate, weekStart } from "../../shared/dates.ts";
import { dayMonth } from "../../shared/trend.ts";
import { countText, numbers, weekdayLetters, wholeNumbers } from "../../shared/lang.ts";
import { progressCopyFor } from "../../shared/app/progress-copy.ts";
import { bmiRangeLabel, scoresCopy } from "../../shared/scores-copy.ts";
import type {
  DaysResponse, PlanProjection, ProfileResponse, WeightsResponse,
} from "@eait/shared";
import { api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { kitEl, weekBarsEl, weightChartEl } from "../kit.ts";
import { clear, el, lang, type Frame } from "../shell.ts";

const LOG_WEIGHT = "#/you"; // the weigh-in lives on You (W10), the same door its "Log weight" takes.

export async function progressScreen(frame: Frame): Promise<HTMLElement> {
  const me = frame.me;
  const copy = progressCopyFor(lang);
  const scores = scoresCopy(lang);
  const units: UnitSystem = me?.profile.units ?? "metric";
  const n = numbers(lang);
  const nWhole = wholeNumbers(lang);
  const dm = dayMonth(lang);
  const letters = weekdayLetters(lang);

  /** A kg figure the way this account reads it — converted at display, never written back. */
  const wnum = (kg: number): string => n(units === "imperial" ? kgToLb(kg) : kg);
  const fmtDate = (d: string): string => dm.format(new Date(`${d}T12:00:00Z`));

  const zone = me?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
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
  for (const r of WEIGHT_RANGES) {
    const b = el("button", "", copy.ranges[r]) as HTMLButtonElement;
    b.type = "button";
    b.setAttribute("aria-pressed", String(r === range));
    b.addEventListener("click", () => {
      if (r === range) return;
      range = r;
      void drawWeights();
    });
    seg.append(b);
    segBtns.set(r, b);
  }
  wHead.append(seg);
  const wBody = el("div", "");
  wCard.append(wHead, wBody);

  const logLink = (text: string): HTMLElement => {
    const a = el("a", "plink", text);
    a.setAttribute("href", LOG_WEIGHT);
    return a;
  };

  /** "{n} kg · {date}"-shaped templates: `{n}` is the figure, the rest the quieter tail. */
  const weightFigure = (tpl: string, kg: number, params: Record<string, string>): HTMLElement => {
    const i = tpl.indexOf("{n}");
    const row = el("div", "wnum");
    if (i < 0) { row.append(el("b", "d d28 num", wnum(kg))); return row; }
    row.append(
      el("b", "d d28 num", wnum(kg)),
      el("span", "uw", ` ${fill(tpl.slice(i + 3), params).trim()}`),
    );
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
        weightFigure(copy.weightLatest[units], state.latest.kg, { date: fmtDate(state.latest.date) }),
        emptyFrame(),
        el("p", "wempty", copy.weightNone[range]),
        logLink(copy.weightEmpty),
      );
      return;
    }
    // `one` and `trend` both show the newest weigh-in — the range ends today, so its last point is
    // the log's latest, and a single point draws alone with its value and date, no invented second.
    wBody.append(weightFigure(copy.weightNow[units], w.latest!.kg, {}));
    const first = w.weights[0]!, last = w.weights.at(-1)!;
    wBody.append(weightChartEl(points, {
      aria: copy.weightChartName,
      first: wnum(first.kg),
      last: state.kind === "trend" ? wnum(last.kg) : "",
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
      el("span", "", fill(doneTpl[units], { n: n(bar.doneKg) })),
      el("span", "", fill(copy.goalToGo[units], { n: n(bar.toGoKg) })),
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
    head.append(el("span", "lab", scores.bmi), help);
    card.append(head);

    if (w.bmi === null) {
      card.append(dashFigure(), logLink(copy.bmiEmpty));
      return card;
    }

    const value = el("div", "wnum");
    value.append(el("b", "d d28 num", n(w.bmi.value)));
    card.append(value);

    const on = BMI_SEGMENTS.findIndex((s) => s.id === w.bmi!.range);
    const W = 320, H = 18, GAP = 3, Y = 5, BH = 8, R = 4;
    const sw = (W - GAP * 3) / 4;
    const segs = BMI_SEGMENTS.map((s, i) => {
      const x = Math.round((i * (sw + GAP)) * 100) / 100;
      const w2 = Math.round(sw * 100) / 100;
      const paint = i === on ? "var(--line)" : "var(--hair)";
      // The end segments round only the outer corners — the board's `.bmi i` radii — so the
      // 3px gaps between segments stay square.
      if (i === 0) {
        return `<path d="M${x + R} ${Y}H${x + w2}V${Y + BH}H${x + R}Q${x} ${Y + BH} ${x} ${Y + BH - R}V${Y + R}Q${x} ${Y} ${x + R} ${Y}Z" fill="${paint}"/>`;
      }
      if (i === BMI_SEGMENTS.length - 1) {
        return `<path d="M${x} ${Y}H${x + w2 - R}Q${x + w2} ${Y} ${x + w2} ${Y + R}V${Y + BH - R}Q${x + w2} ${Y + BH} ${x + w2 - R} ${Y + BH}H${x}Z" fill="${paint}"/>`;
      }
      return `<rect x="${x}" y="${Y}" width="${w2}" height="${BH}" fill="${paint}"/>`;
    }).join("");
    const tickX = Math.round(bmiTick(w.bmi.value, w.bmi.range) * W * 10) / 10;
    card.append(kitEl(
      `<svg class="bmibar" viewBox="0 0 ${W} ${H}" width="100%" aria-hidden="true">` + segs +
      `<rect x="${tickX - 1.5}" y="0" width="3" height="${H}" rx="1.5" fill="var(--ink)"/>` +
      `</svg>`,
    ));

    const labels = el("div", "bmil");
    BMI_SEGMENTS.forEach((s, i) => {
      labels.append(el("span", i === on ? "on" : "", bmiRangeLabel(s.id, lang)));
    });
    card.append(labels);

    const explainer = el("div", "t12 m bmix", scores.bmiExplainer);
    explainer.id = "bmi-explainer";
    explainer.hidden = true;
    help.addEventListener("click", () => {
      explainer.hidden = !explainer.hidden;
      help.setAttribute("aria-expanded", String(!explainer.hidden));
    });
    card.append(explainer);

    // "From 73.4 kg and 172 cm" — the weigh-in the figure was computed on, and the profile's height.
    const heightCm = me?.profile.height_cm ?? null;
    const kg = w.latest?.kg ?? me?.profile.weight_kg ?? null;
    if (heightCm !== null && kg !== null) {
      card.append(el("div", "t12 m bmis", fill(copy.bmiFrom, {
        w: fill(copy.weightNow[units], { n: wnum(kg) }),
        h: heightText(heightCm, units),
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
