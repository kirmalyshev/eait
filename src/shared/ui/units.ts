// Units — the conversion and the ruler, for display only.
//
// The store is metric and stays metric: `Profile.height_cm` and `weight_kg` are the columns, and
// the plan arithmetic reads them. What the user drags on the ruler and reads beside the big number
// is a PRESENTATION of those numbers — the unit toggle on the height, weight and target screens
// converts for display and the choice carries to every later screen (`Profile.units`, the pace's
// "kg a week", the plan graph, Progress).
//
// The boards that drew these (`product/design/pro/onboarding/phone/06-height.html`, `06b`, `07`,
// `07b`, `09` on ieat-app main d3fe6ef8): a vertical ruler for height, a horizontal one for weight,
// and a two-way segment "cm | ft, in" / "kg | lb" under the question.

/** `metric` or `imperial` — the two-way toggle under every body question. */
export type UnitSystem = "metric" | "imperial";

const CM_PER_IN = 2.54;
const LB_PER_KG = 2.2046226218;

/** cm → feet and inches, the inch rounded first so 172 cm reads 5 ft 8 in, not 5 ft 7.7 in. */
export function cmToFtIn(cm: number): { ft: number; in: number } {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), in: totalIn % 12 };
}

/** feet + inches → cm, for the answer the toggle lands on. */
export function ftInToCm(ft: number, inch: number): number {
  return Math.round((ft * 12 + inch) * CM_PER_IN);
}

/** kg → whole lb for display: 74 → 163. */
export function kgToLb(kg: number): number {
  return Math.round(kg * LB_PER_KG);
}

/** lb → kg to a tenth — the precision `checkNumber` stores. */
export function lbToKg(lb: number): number {
  return Math.round((lb / LB_PER_KG) * 10) / 10;
}

/** The three countries still on imperial; everywhere else is metric. */
const IMPERIAL_REGIONS = new Set(["US", "LR", "MM"]);

/**
 * Which system the toggle opens on, from the device's region. `region` is an ISO 3166 alpha-2
 * code — the answer the onboarding's country step reads, or the locale's region on first run —
 * and anything unrecognised is metric, because metric is the answer for most of the world.
 */
export function defaultUnits(region: string): UnitSystem {
  return IMPERIAL_REGIONS.has(region.toUpperCase()) ? "imperial" : "metric";
}

/**
 * One ruler's tick set. The ruler is a real control — the value is where the "now" marker lands —
 * so the set describes SPACING, and `rulerLabels` walks a window of it for the printed numbers.
 *
 * `pxPerUnit` is the boards' own pitch: 9.5 px per cm/inch on the vertical height ruler, 9 px per
 * kg/lb on the horizontal weight ruler. `majorEvery`/`labelEvery` count UNITS between the long
 * ticks and the printed labels; both are `var(--ink)`-strong on the boards.
 */
export interface RulerTicks {
  /** What the steps count in. */
  unit: "cm" | "in" | "kg" | "lb";
  /** Pixels per one unit. */
  pxPerUnit: number;
  /** A long tick every N units. */
  majorEvery: number;
  /** A printed label every N units. */
  labelEvery: number;
  /** Bounds where the board fixes them — the height ruler is a fixed window. */
  min?: number;
  max?: number;
  /** The label's text, e.g. `172` or `6′4″`. */
  format(value: number): string;
}

const cmLabel = (cm: number) => `${cm}`;
const kgLabel = (kg: number) => `${kg}`;
const lbLabel = (lb: number) => `${lb}`;
const ftInLabel = (totalIn: number) => `${Math.floor(totalIn / 12)}′${totalIn % 12}″`;

/**
 * The two rulers and their two systems, as `product/design/pro` draws them.
 *
 * Height (vertical, `06-height`/`06b`): cm window 165–180 with a label every 5; ft/in window
 * 5′0″–6′4″ with a label every 4. Weight (horizontal, `07`/`07b`): labels every 10 kg or 10 lb and
 * a long tick every 5; the window slides with the value, so it carries no min/max.
 */
export const RULER_TICKS = {
  height: {
    metric: { unit: "cm", pxPerUnit: 9.5, majorEvery: 5, labelEvery: 5, min: 165, max: 180, format: cmLabel },
    imperial: { unit: "in", pxPerUnit: 9.5, majorEvery: 4, labelEvery: 4, min: 60, max: 76, format: ftInLabel },
  },
  weight: {
    metric: { unit: "kg", pxPerUnit: 9, majorEvery: 5, labelEvery: 10, format: kgLabel },
    imperial: { unit: "lb", pxPerUnit: 9, majorEvery: 5, labelEvery: 10, format: lbLabel },
  },
} as const satisfies {
  height: Record<UnitSystem, RulerTicks>;
  weight: Record<UnitSystem, RulerTicks>;
};

/**
 * The label values a window of the ruler prints — the multiples of `labelEvery` inside
 * `[from, to]`, inclusive. 165–180 on the cm height ruler is 165, 170, 175, 180.
 */
export function rulerLabels(ticks: RulerTicks, from: number, to: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(from / ticks.labelEvery) * ticks.labelEvery;
  for (let v = first; v <= to; v += ticks.labelEvery) out.push(v);
  return out;
}
