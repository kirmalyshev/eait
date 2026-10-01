// The plan reveal's geometry and clock (#402): journey curve and date axis, waterfall, maintain balance.

import { LANG_TAG } from "./lang.ts";
import type { TargetBasis } from "./targets.ts";
import type { Lang } from "./types.ts";

/** Every delay of the reveal in seconds; it is all done by `lose.continue + .3`, 3.5 s. */
export const PLAN_TIMELINE = {
  curve: { delay: 0.2, duration: 1.2 },
  fill: { delay: 0.5, duration: 0.9 },
  targetDot: 1.3,
  targetPill: 1.4,
  /** An axis label fades in as the stroke reaches it: `delay + duration × position`, 0.4 s each. */
  axis: { delay: 0.2, span: 1.2 },
  kcal: { delay: 0.6, duration: 1.2 },
  protein: { delay: 0.8, duration: 1.2 },
  macros: 1.4,
  /** Bar delays 1.5 / 1.8 / 2.1 / 2.4; a delta's figure follows its bar by `figure`. */
  bars: [1.5, 1.8, 2.1, 2.4],
  figure: 0.2,
  /** The count in the button's place, then the button. */
  lose: { count: 2.9, continue: 3.2 },
  maintain: { burn: [0.2, 0.8], plan: 0.4, tick: 1.4, count: 2.0, continue: 2.3 },
} as const;

// ── The journey ──────────────────────────────────────────────────────────────────────────────

const X0 = 14;
const X1 = 304;
const BASE = 146;
/** A tick whose label would crowd "Today" (44 px) or the end label (70 px) is skipped. */
const GAP_START = 44;
const GAP_END = 70;
/** Past this many months, four evenly spaced ticks replace the months. */
const MAX_MONTHS = 8;

export interface PlanJourneyTick {
  /** `end` is the bold label under the target; `today` sits under the start. */
  kind: "today" | "month" | "end";
  label: string;
  x: number;
  delay: number;
}

export interface PlanJourney {
  viewBox: string;
  baseline: number;
  linePath: string;
  areaPath: string;
  start: { x: number; y: number; labelY: number };
  end: { x: number; y: number };
  /** The pill under (gain) or over (lose) the target dot, its right edge on the curve's end. */
  pill: { x: number; y: number; width: number; height: number; textX: number; textY: number };
  axisY: number;
  tickY: [number, number];
  ticks: readonly PlanJourneyTick[];
}

/** The date this many weeks on, rolled by the calendar like `projectionMonth`. */
function landing(from: Date, weeks: number): Date {
  const d = new Date(from.getTime());
  d.setDate(d.getDate() + weeks * 7);
  return d;
}

/** A month name from CLDR; the 15th is the anchor that no zone can move into a neighbour. */
const monthName = (lang: Lang, year: number, month: number, withYear: boolean): string =>
  new Intl.DateTimeFormat(LANG_TAG[lang], {
    month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month, 15)));

/** The date axis on a real time scale, its month names from `Intl`. */
export function planJourneyTicks(from: Date, weeks: number, lang: Lang): PlanJourneyTick[] {
  const end = landing(from, weeks);
  const span = end.getTime() - from.getTime();
  const at = (x: number) => (x - X0) / (X1 - X0);
  const delay = (pos: number) => +(PLAN_TIMELINE.axis.delay + PLAN_TIMELINE.axis.span * pos).toFixed(2);
  const tick = (kind: PlanJourneyTick["kind"], label: string, pos: number): PlanJourneyTick => ({
    kind, label, x: +(X0 + (X1 - X0) * pos).toFixed(1), delay: delay(pos),
  });

  const ticks: PlanJourneyTick[] = [tick("today", "", 0)];
  const months = (end.getFullYear() - from.getFullYear()) * 12 + end.getMonth() - from.getMonth();
  const lo = at(X0 + GAP_START);
  const hi = at(X1 - GAP_END);
  if (months > MAX_MONTHS) {
    // Four ticks evenly spaced between the two gaps.
    for (let k = 0; k < 4; k++) {
      const pos = lo + ((hi - lo) * k) / 3;
      const d = new Date(from.getTime() + span * pos);
      ticks.push(tick("month", monthName(lang, d.getFullYear(), d.getMonth(), false), pos));
    }
  } else {
    for (let m = 1; m < months; m++) {
      const first = new Date(from.getFullYear(), from.getMonth() + m, 1);
      const pos = (first.getTime() - from.getTime()) / span;
      if (pos < lo || pos > hi) continue;
      ticks.push(tick("month", monthName(lang, first.getFullYear(), first.getMonth(), false), pos));
    }
  }
  ticks.push(tick("end", monthName(lang, end.getFullYear(), end.getMonth(), true), 1));
  return ticks;
}

/** The curve from her weight to the target: it falls for lose and rises for gain. */
export function planJourney(
  direction: "lose" | "gain", from: Date, weeks: number, lang: Lang, targetLabelLength: number,
): PlanJourney {
  const lose = direction === "lose";
  const y0 = lose ? 36 : 118;
  const y1 = lose ? 118 : 36;
  const line = `M${X0} ${y0} C120 ${y0} 196 ${y1} ${X1} ${y1}`;
  const width = Math.max(64, 16 + 9 * targetLabelLength);
  const y = lose ? 76 : 50;
  return {
    viewBox: "0 0 320 172",
    baseline: BASE,
    linePath: line,
    areaPath: `${line} L${X1} ${BASE} L${X0} ${BASE} Z`,
    start: { x: X0, y: y0, labelY: lose ? 18 : 100 },
    end: { x: X1, y: y1 },
    pill: { x: 310 - width, y, width, height: 28, textX: 310 - width / 2, textY: y + 19 },
    axisY: 168,
    tickY: [BASE, BASE + 5],
    ticks: planJourneyTicks(from, weeks, lang),
  };
}

// ── How we got there ─────────────────────────────────────────────────────────────────────────

export interface PlanWaterfallBar {
  id: "rest" | "days" | "pace" | "plan";
  x: number;
  y: number;
  height: number;
  /** The signed figure the bar stands for (kcal). */
  value: number;
  /** A pace bar that cuts hangs from the stack's top and grows down. */
  down: boolean;
  /** Where the figure sits, above the bar's top (the pace cut: above the stack). */
  labelY: number;
  /** Where the dashed step to the next bar sits. */
  level: number;
  delay: number;
}

const W_BASE = 112;
const W_HEIGHT = 88;
const W_X = [8, 86, 164, 242] as const;
export const PLAN_WATERFALL = { viewBox: "0 0 320 136", baseline: W_BASE, width: 70, labelBaseline: 132 } as const;

/** The waterfall to scale from 0; null on the flat band, which has no arithmetic. */
export function planWaterfall(basis: TargetBasis, planKcal: number): PlanWaterfallBar[] | null {
  if (basis.bmr === null || basis.activityDeltaKcal === null) return null;
  const rest = basis.bmr;
  const days = basis.activityDeltaKcal;
  const pace = basis.appliedDeltaKcal;
  const peak = rest + days + Math.max(pace, 0);
  const s = W_HEIGHT / peak;
  const topRest = W_BASE - rest * s;
  const topDays = topRest - days * s;
  const [dRest, dDays, dPace, dPlan] = PLAN_TIMELINE.bars;
  const cut = pace < 0;
  const paceTop = cut ? topDays : topDays - pace * s;
  const planTop = cut ? topDays - pace * s : paceTop;
  return [
    { id: "rest", x: W_X[0], y: topRest, height: rest * s, value: rest, down: false, labelY: topRest - 8, level: topRest, delay: dRest },
    { id: "days", x: W_X[1], y: topDays, height: days * s, value: days, down: false, labelY: topDays - 8, level: topDays, delay: dDays },
    { id: "pace", x: W_X[2], y: paceTop, height: Math.abs(pace) * s, value: pace, down: cut, labelY: (cut ? topDays : paceTop) - 8, level: cut ? planTop : paceTop, delay: dPace },
    { id: "plan", x: W_X[3], y: planTop, height: planKcal * s, value: planKcal, down: false, labelY: planTop - 8, level: planTop, delay: dPlan },
  ];
}

/** The maintain balance: two bars grown to one length, as shares of the longer. */
export function planBalance(basis: TargetBasis, planKcal: number): {
  burn: { rest: number; days: number; value: number };
  share: { burn: number; plan: number };
} | null {
  if (basis.bmr === null || basis.tdee === null || basis.activityDeltaKcal === null) return null;
  const longer = Math.max(basis.tdee, planKcal);
  return {
    burn: { rest: basis.bmr, days: basis.activityDeltaKcal, value: basis.tdee },
    share: { burn: basis.tdee / longer, plan: planKcal / longer },
  };
}
