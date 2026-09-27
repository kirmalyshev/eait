// The browser half of the W1 component kit (#88).
//
// The markup itself is `shared/ui/kit.ts`'s — one string builder per component, the same strings
// `/start` interpolates server-side, so neither surface can draw a second ring or a second meal
// row. This module is the bridge: `kitEl` parses a builder's output into an element (spudFace's
// move — generated markup, not `innerHTML` on a value that arrived from anywhere; every dynamic
// part went through `esc` at build), and the `*El` wrappers are what screens call when a component
// takes an event listener — `addEventListener`, never an `on*` attribute the CSP refuses.

import type { MealRecord, Verdict, VerdictDimension } from "@eait/shared";
import { renderableVerdicts } from "../shared/types.ts";
import { verdictPillLabel } from "../shared/verdicts.ts";
import {
  cta as ctaMarkup, estimateChartSvg, gramMacs as gramMacsMarkup,
  mac as macMarkup, macs as macsMarkup, mcard as mcardMarkup, mealRow as mealRowMarkup,
  optionRow as optionRowMarkup, photoHero as photoHeroMarkup, planCard as planCardMarkup,
  gabieAvatar as gabieAvatarMarkup, gabieName as gabieNameMarkup, spudAvatar as spudAvatarMarkup,
  ring as ringMarkup, twoWayChartSvg, verdictDot as verdictDotMarkup,
  verdictList as verdictListMarkup, weekBarsSvg, weekStrip as weekStripMarkup, weightChartSvg,
  type ChipName, type HeroCallout, type MealRowSpec, type RingOpts, type VerdictTone,
  type WeekDayRow,
} from "../shared/ui/kit.ts";
import { lang, names } from "./shell.ts";

/**
 * Kit markup → one element. The builders all return a single root. `DOMParser` over
 * `createElementNS` because the components ARE markup — a parse keeps the string the one copy.
 */
export function kitEl(markup: string): Element {
  const node = new DOMParser().parseFromString(markup, "text/html").body.firstElementChild;
  if (node === null) throw new Error("kit: a builder returned no element");
  return node;
}

// ── The builders, as elements ────────────────────────────────────────────────────────────────

export const ringEl = (o: RingOpts): Element => kitEl(ringMarkup(o));

export const macEl = (name: ChipName, text: string): Element => kitEl(macMarkup(name, text));

export const macsEl = (chips: readonly { name: ChipName; text: string }[], cls = ""): Element =>
  kitEl(macsMarkup(chips, cls));

export const gramMacsEl = (grams: { protein: number; carbs: number; fat: number }): Element =>
  kitEl(gramMacsMarkup(grams, lang));

export const mcardEl = (o: Parameters<typeof mcardMarkup>[0]): Element => kitEl(mcardMarkup(o));

export const planCardEl = (o: Parameters<typeof planCardMarkup>[0]): Element =>
  kitEl(planCardMarkup(o));

export const verdictDotEl = (tone: VerdictTone, words: string): Element =>
  kitEl(verdictDotMarkup(tone, words));

export const verdictListEl = (items: readonly { tone: VerdictTone; words: string }[]): Element | null =>
  items.length ? kitEl(verdictListMarkup(items)) : null;

export const photoHeroEl = (o: {
  src: string; alt?: string; pad?: 14 | 18; stamp?: string; scan?: boolean;
  callouts?: readonly HeroCallout[];
}): Element => kitEl(photoHeroMarkup(o));

export const estimateChartEl = (
  direction: Parameters<typeof estimateChartSvg>[0],
  labels: Parameters<typeof estimateChartSvg>[1],
): Element => kitEl(estimateChartSvg(direction, labels));

export const twoWayChartEl = (labels: Parameters<typeof twoWayChartSvg>[0]): Element =>
  kitEl(twoWayChartSvg(labels));

export const weightChartEl = (
  points: Parameters<typeof weightChartSvg>[0],
  labels: Parameters<typeof weightChartSvg>[1],
): Element => kitEl(weightChartSvg(points, labels));

export const weekBarsEl = (
  days: readonly (number | null)[],
  planKcal: number,
  o: Parameters<typeof weekBarsSvg>[2],
): Element => kitEl(weekBarsSvg(days, planKcal, o));

export const ctaEl = (o: Parameters<typeof ctaMarkup>[0]): Element => kitEl(ctaMarkup(o));

export const optionRowEl = (o: Parameters<typeof optionRowMarkup>[0]): Element =>
  kitEl(optionRowMarkup(o));

export const spudAvatarEl = (
  mood: Parameters<typeof spudAvatarMarkup>[0],
  o?: Parameters<typeof spudAvatarMarkup>[1],
): Element => kitEl(spudAvatarMarkup(mood, o));

export const gabieAvatarEl = (): Element => kitEl(gabieAvatarMarkup());

export const gabieNameEl = (name: string): Element => kitEl(gabieNameMarkup(name));

// ── The ones that carry data ─────────────────────────────────────────────────────────────────

/**
 * The seven-day strip. `when` on each row is the server's; `onPick` gets the tapped date off
 * `data-date` — one delegated listener rather than one per cell.
 */
export function weekStripEl(
  days: readonly WeekDayRow[],
  onPick?: (date: string) => void,
): Element {
  const el_ = kitEl(weekStripMarkup(days, lang));
  if (onPick !== undefined) {
    el_.addEventListener("click", (e) => {
      const cell = (e.target as Element | null)?.closest?.("[data-date]");
      const date = cell?.getAttribute("data-date");
      if (date) onPick(date);
    });
  }
  return el_;
}

/** A meal's verdicts as the kit's `{tone, words}` pairs — the computed words, in this language. */
export function verdictWords(verdicts: MealRecord["verdicts"]): { tone: VerdictTone; words: string }[] {
  const v = verdicts as Partial<Record<VerdictDimension, Verdict>>;
  return renderableVerdicts(verdicts).map((d) => ({
    tone: v[d]!, words: verdictPillLabel(d, v[d]!, lang),
  }));
}

/**
 * A MealRecord as the diary's `.meal` row: first-two-items name (shell.ts's `names`, the same
 * words a chat line uses), formatted time, the row's verdict words only when not on plan (the
 * shared builder's filter), macro chips and kcal.
 * `photo.src` is resolved by the screen — a blob object URL off the bearer fetch.
 */
export function mealRowEl(
  meal: MealRecord,
  o: { time: string; photo?: { src: string; alt?: string } | null; note?: string; href?: string },
): Element {
  const spec: MealRowSpec = {
    id: meal.id,
    name: names(meal.items),
    time: o.time,
    kcal: meal.kcal,
    grams: { protein: meal.protein_g, carbs: meal.carbs_g, fat: meal.fat_g },
    verdicts: verdictWords(meal.verdicts),
    photo: o.photo ?? null,
    ...(o.note !== undefined ? { note: o.note } : {}),
    ...(o.href !== undefined ? { href: o.href } : {}),
  };
  return kitEl(mealRowMarkup(spec, lang));
}
