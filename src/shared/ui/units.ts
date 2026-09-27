// Units — the conversion and the ruler, for display only.
//
// The store is metric and stays metric: `Profile.height_cm` and `weight_kg` are the columns, and
// the plan arithmetic reads them. What the user drags on the ruler and reads beside the big number
// is a PRESENTATION of those numbers — the unit toggle on the height, weight and target screens
// converts for display and the choice carries to every later screen (`Profile.units`, the pace's
// "kg a week", the plan graph, Progress).
//
// THE ONE RULE: switching units RELABELS the value and never writes it. The round trips drift —
// 172 cm → 5′8″ → 173 cm, and 74 kg → 163 lb → 73.9 kg — so a toggle that wrote back what it
// displayed would move the stored number on its own. The stored cm or kg changes only when the
// user moves the control.
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
 * ticks and the printed labels.
 *
 * There is deliberately no `min`/`max` here: the 165–180 cm on the height board is the WINDOW the
 * drawing shows around the persona's 172 (`span`), not what the control accepts. The bounds a
 * consumer clamps to are the profile validator's limits, passed in by the consumer — this module
 * may not reach the validator, and copying its numbers would be a second definition of them.
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
  /** How much of the range the board's window shows, in units — where the board fixes one. */
  span?: number;
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
 * Height (vertical, `06-height`/`06b`): the board's window is 15 cm / 16 in tall, labels every
 * 5 cm / 4 in. Weight (horizontal, `07`/`07b`): labels every 10 kg or 10 lb and a long tick every
 * 5; the window slides with the value and is sized by the viewport, so it carries no `span`.
 */
export const RULER_TICKS = {
  height: {
    metric: { unit: "cm", pxPerUnit: 9.5, majorEvery: 5, labelEvery: 5, span: 15, format: cmLabel },
    imperial: { unit: "in", pxPerUnit: 9.5, majorEvery: 4, labelEvery: 4, span: 16, format: ftInLabel },
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
 * `[from, to]`, inclusive. On the persona's board the cm window is 165–180 → 165, 170, 175, 180;
 * the caller decides which window it is showing.
 */
export function rulerLabels(ticks: RulerTicks, from: number, to: number): number[] {
  const out: number[] = [];
  const first = Math.ceil(from / ticks.labelEvery) * ticks.labelEvery;
  for (let v = first; v <= to; v += ticks.labelEvery) out.push(v);
  return out;
}
