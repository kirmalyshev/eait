// The W1 component kit (#88): the markup every Register-P web surface draws, written ONCE.
//
// WHY STRINGS AND NOT NODES: `/start` renders server-side and has no DOM, and the issue's rule is
// that nobody builds a second copy of a ring, a week strip or a meal row — so the markup is a
// string the server interpolates and the browser client parses (`kitEl`, frontend/kit.ts). The
// class names and measurements are `product/design/pro/`'s own, and `kitCss()` — generated beside
// them like `iconCss()` and `motionCss()` are — is what both surfaces interpolate, so a rule can
// never drift between the two.
//
// TWO SAFETY RULES, and they are why the signatures take primitives and not records:
//   1. Every interpolated value goes through `esc` — a name the model wrote or a person typed is
//      text here, never markup. The CSP has no 'unsafe-inline' to save a mistake.
//   2. No `style=""` attribute is ever emitted — the app's shell refuses them outright
//      (`style-src 'nonce-…'`). Everything a board writes inline is a class or a plain SVG
//      presentation attribute here, which the same policy lets through.
//
// Verdict words are the caller's — `verdictPillLabel` is a verdicts.ts affair and `ui/` may not
// import it — so the functions take `{tone, words}` pairs the caller computed.

import {
  dayRing, estimateChart, ringDash, TWO_WAYS_CHART, weekBars, weightChart,
  type ChartDay, type EstimateDirection, type WeightPoint,
} from "./charts.ts";
import type { IconName } from "./icons.ts";
import { RADIUS, SHADOW } from "../design.ts";
import { LANG_TAG, spellUnit, UNIT_KCAL, weekdayShort, wholeNumbers, type Lang } from "../lang.ts";
import { MOUTHS, spudSvg, type MascotMood } from "../mascot.ts";

/** Text or an attribute value, made inert. The one escaper both surfaces get. */
export const esc = (text: string): string =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** The icon chip — `<i class="ico i-<name>">`, sized by the rule that holds it. */
export const ico = (name: IconName): string => `<i class="ico i-${name}"></i>`;

/** The macro names that have a chip and a `--macro-*` hue. `satfat` is the fat alias. */
export type ChipName = "kcal" | "protein" | "carbs" | "fat" | "satfat";

// ── The ring ─────────────────────────────────────────────────────────────────────────────────
//
// One instrument in the boards' three frames: the 104 px hero ring (r 44, stroke 8), the 96 px
// web day ring (r 40, stroke 8) and the 52 px macro ring (r 21, stroke 5). The dash figures are
// `ringDash`'s, the track is `--hair`, the arc's hue is a TOKEN NAME — a literal hex here is the
// second copy the kit exists to prevent.

export type RingTone =
  | "ink" | "accent" | "bad" | "warn" | "care" | "faint" | "line" | "over"
  | `macro-${ChipName}`;

const RING_SPEC = {
  104: { box: 104, r: 44, stroke: 8 },
  96: { box: 96, r: 40, stroke: 8 },
  52: { box: 52, r: 21, stroke: 5 },
} as const;

const toneVar = (tone: RingTone): string =>
  `var(--${tone === "macro-satfat" ? "macro-fat" : tone})`;

export interface RingOpts {
  share: number;
  /** The frame — 52 when unsaid. */
  size?: 104 | 96 | 52;
  tone?: RingTone;
  /** The icon centred in the ring. Unsaid is no `.ico` node at all. */
  icon?: IconName;
}

export const ring = (o: RingOpts): string => {
  const spec = RING_SPEC[o.size ?? 52];
  const c = spec.box / 2;
  const d = ringDash(o.share, spec.r);
  const cls = o.size === 104 ? "mring w104" : o.size === 96 ? "mring w96" : "mring";
  return `<div class="${cls}"><svg viewBox="0 0 ${spec.box} ${spec.box}">` +
    `<circle cx="${c}" cy="${c}" r="${spec.r}" fill="none" stroke="var(--hair)" stroke-width="${spec.stroke}"/>` +
    `<circle class="fg" cx="${c}" cy="${c}" r="${spec.r}" fill="none" stroke="${toneVar(o.tone ?? "accent")}" ` +
    `stroke-width="${spec.stroke}" stroke-dasharray="${d.dasharray}" stroke-dashoffset="${d.dashoffset}" stroke-linecap="round"/>` +
    `</svg>${o.icon ? ico(o.icon) : ""}</div>`;
};

// ── The week strip ───────────────────────────────────────────────────────────────────────────
//
// Seven days, the date centred in its ring. `when` arrives from the server (`DiaryDay`) — a client
// never compares a row's date with today. Each past-or-today cell is a real `<button
// type="button">` carrying `data-date`, so a surface can delegate a tap without reaching into the
// markup; `type="button"` because an untyped one inside a `/start` form would submit it. A future
// cell is markup, not a control — a day that has not happened has no diary to open. `now` names
// the raised cell's DATE (`YYYY-MM-DD`); unsaid, it is the server's today.

export interface WeekDayRow extends ChartDay {
  /** YYYY-MM-DD in the account's timezone — the server's, read straight through. */
  date: string;
  /** The day's calorie target, sent on every row (`DiaryDay.targetKcal`). */
  targetKcal: number;
}

export const weekStrip = (
  days: readonly WeekDayRow[],
  lang: Lang,
  now?: string,
): string => {
  const letters = weekdayShort(lang);
  const fullDate = new Intl.DateTimeFormat(LANG_TAG[lang], { dateStyle: "full", timeZone: "UTC" });
  const cells = days.map((day) => {
    const noon = new Date(`${day.date}T12:00:00Z`);
    const ring = dayRing(day, day.targetKcal);
    // `.now` raises the cell the surface is LOOKING AT, not necessarily the server's today: Home's
    // strip follows the viewed week, so the caller names the day. Unsaid, it stays today's.
    const isNow = now !== undefined ? day.date === now : day.when === "today";
    const cls = isNow ? "dy now" : day.when === "future" ? "dy fut" : "dy";
    // An over day's ring is dark red (F) — `--over`, calmer than `--bad` in both themes.
    const tone = ring.tone === "bad" ? "over" : ring.tone;
    const circles = ring.dashoffset === undefined
      ? `<circle cx="15" cy="15" r="12" fill="none" stroke="var(--line)" stroke-width="2.4" stroke-dasharray="${ring.dasharray}"/>`
      : `<circle cx="15" cy="15" r="12" fill="none" stroke="var(--hair)" stroke-width="2.4"/>` +
        `<circle class="fg" cx="15" cy="15" r="12" fill="none" stroke="var(--${tone})" stroke-width="2.4" ` +
        `stroke-dasharray="${ring.dasharray}" stroke-dashoffset="${ring.dashoffset}" stroke-linecap="round"/>`;
    const letter = `<span class="dl">${esc(letters[(noon.getUTCDay() + 6) % 7]!)}</span>`;
    const num = Number(day.date.slice(8, 10));
    // A future day is not a control (it has no diary yet) — the boards draw it as a dimmed cell,
    // so it is a DISABLED button: inactive, never focusable, and exempt from the contrast rule (WCAG 1.4.3).
    if (day.when === "future" && !isNow)
      return `<button type="button" class="${cls}" disabled aria-label="${esc(fullDate.format(noon))}">` +
        `${letter}<svg viewBox="0 0 30 30" aria-hidden="true">${circles}</svg><b>${num}</b></button>`;
    return `<button type="button" class="${cls}" data-date="${esc(day.date)}" ` +
      `aria-label="${esc(fullDate.format(noon))}">${letter}<svg viewBox="0 0 30 30">${circles}</svg><b>${num}</b></button>`;
  });
  // The raised cell's flat tint is ONE element (`a0`…`a6` are the cells' left edges) so a client
  // that keeps the strip mounted can glide it to the tapped day instead of rebuilding.
  const at = days.findIndex((d) => (now !== undefined ? d.date === now : d.when === "today"));
  const tint = at === -1 ? "" : `<i class="wtint a${at}" aria-hidden="true"></i>`;
  return `<div class="week">${tint}${cells.join("")}</div>`;
};

// ── Macro chips and cards ────────────────────────────────────────────────────────────────────
//
// `.mac` is icon + number + unit; `.macs` is the row of them. `gramMacs` writes the boards'
// "{n} g" in the surface's language — the formatter is shared so a chip in German cannot drift.

export const mac = (name: ChipName, text: string): string =>
  `<span class="mac">${ico(name)}${esc(text)}</span>`;

export const macs = (chips: readonly { name: ChipName; text: string }[], cls = ""): string =>
  `<span class="macs${cls ? ` ${cls}` : ""}">${chips.map((c) => mac(c.name, c.text)).join("")}</span>`;

/** A meal's three macro chips, "{n} g" in the surface's language — never a hand-written " g". */
export const gramChips = (
  grams: { protein: number; carbs: number; fat: number },
  lang: Lang,
): { name: ChipName; text: string }[] => {
  const n = wholeNumbers(lang);
  const g = spellUnit(lang, "g");
  return [
    { name: "protein", text: `${n(grams.protein)} ${g}` },
    { name: "carbs", text: `${n(grams.carbs)} ${g}` },
    { name: "fat", text: `${n(grams.fat)} ${g}` },
  ];
};

export const gramMacs = (
  grams: { protein: number; carbs: number; fat: number },
  lang: Lang,
): string => macs(gramChips(grams, lang));

/**
 * The macro card. `share` present is the ring variant — value, label, ring. `share` absent draws
 * the centred icon: a macro the plan does not target gets no ring, because a ring says "of a
 * target" and there is none to show. `centred` is the meal sheet's alignment; the plan card —
// icon, figure, label and no ring div — is `planCard`.
 */
export const mcard = (
  o: { value: string; label: string; centred?: boolean } & (
    | { macro: ChipName; share?: number }
    /** Page 2's nutrient cards (W4) draw `fibre`/`sugar`/`salt` — icons with no ring, because a
     *  ring says "of a target" and these cards carry none. The union keeps it that way — except
     *  salt with a declared cap (kidneys), whose ring is drawn in ink: sodium has no macro colour
     *  to borrow. */
    | { macro: "salt"; share: number }
    | { macro: "fibre" | "sugar" | "salt"; share?: undefined }
  ),
): string => {
  const pic = o.share === undefined
    ? `<div class="mring flat">${ico(o.macro)}</div>`
    : ring({ share: o.share,
      tone: o.macro === "salt" ? "ink" : `macro-${o.macro}` as `macro-${ChipName}`, icon: o.macro });
  return `<div class="mcard${o.centred ? " ctr" : ""}"><b>${esc(o.value)}</b><small>${esc(o.label)}</small>${pic}</div>`;
};

export const planCard = (o: { macro: ChipName; value: string; label: string }): string =>
  `<div class="mcard">${ico(o.macro)}<b>${esc(o.value)}</b><small>${esc(o.label)}</small></div>`;

// ── Verdicts — a dot and a line, never a pill ────────────────────────────────────────────────

export type VerdictTone = "good" | "warn" | "bad";

export const verdictDot = (tone: VerdictTone, words: string): string =>
  `<span class="v ${tone}">${esc(words)}</span>`;

/** The `.vs` stack on a card — one dot-and-line per verdict, its own tone on each. */
export const verdictList = (items: readonly { tone: VerdictTone; words: string }[]): string =>
  items.length ? `<div class="vs">${items.map((v) => verdictDot(v.tone, v.words)).join("")}</div>` : "";

// ── The macro tip (F) ──────────────────────────────────────────────────────────
//
// The bubble a tippable macro row opens over the day card — the boards' `.mtip`: the title
// line's coloured dot, then the sentence, on the raised roundrect with the rotated-square
// arrow underneath. `.t-<macro>` names the dot's colour; `over` is the dark-red pair (a macro
// past its target reads in ink on the card but in the over tone inside the tip). Position —
// bottom over the row, the arrow's `--ax` under the icon — is the surface's: the anchor is the
// element that knows where the icon sits.

export type TipTone = "protein" | "carbs" | "satfat" | "over";

export const tip = (o: { tone: TipTone; title: string; body: string }): string =>
  `<div class="mtip t-${esc(o.tone)}${o.tone === "over" ? " ov" : ""}" role="tooltip">` +
  `<b><i></i>${esc(o.title)}</b><p>${esc(o.body)}</p></div>`;

// ── The health score ─────────────────────────────────────────────────────────────────────────
//
// The compact row on the meal sheet (web + phone `meal.html`): label · the 6 px bar · "{n}/10" ·
// the chevron that opens the breakdown. A BUTTON — it opens a surface overlay, it navigates
// nowhere. The bar is an svg because `style="width:n%"` is what the kit never emits (the shell's
// CSP refuses it), and a `rect`'s width is the same value.
//
// `.hsp` is the breakdown's row (`web/meal-score.html`, `phone/meal-score.html`): the factor, its
// measure underneath — with the declared limit appended — and the points on the right.

export const scoreRow = (o: { label: string; score: string; pct: number }): string =>
  `<button type="button" class="hsr"><span class="hl">${esc(o.label)}</span>` +
  `<svg class="hsb" viewBox="0 0 100 6" preserveAspectRatio="none" aria-hidden="true">` +
  `<rect class="tr" width="100" height="6"/><rect class="fg" width="${Math.min(100, Math.max(0, o.pct))}" height="6"/></svg>` +
  `<b class="num">${esc(o.score)}</b>${ico("chevron-right")}</button>`;

export const scorePart = (o: { name: string; measure?: string; limit?: string; points: string }): string => {
  const small = o.measure !== undefined || o.limit !== undefined
    ? `<small>${esc(o.measure ?? "")}${o.limit !== undefined ? ` · ${esc(o.limit)}` : ""}</small>` : "";
  return `<div class="hsp"><span>${esc(o.name)}${small}</span><span class="pts">${esc(o.points)}</span></div>`;
};

/** One ingredient row on the meal sheet — the name, its amount, its own kcal (`web/meal.html`). */
export const ingredient = (o: { name: string; amount: string; kcal?: string }): string =>
  `<div class="ing">${esc(o.name)}<span>${esc(o.amount)}</span>` +
  `${o.kcal !== undefined ? `<b class="num">${esc(o.kcal)}</b>` : ""}</div>`;

// ── The meal row ─────────────────────────────────────────────────────────────────────────────
//
// 56 px photo or the chat tile, the time, the row's verdict words ONLY when not on plan (a "good"
// verdict is silence on a diary row), the macro chips and the kcal. `href` makes the row the link
// the detail sheet opens from; without it the row is a div.

export interface MealRowSpec {
  name: string;
  /** The meal's own time, formatted by the caller. */
  time: string;
  kcal: number;
  grams?: { protein: number; carbs: number; fat: number };
  /** The meal's renderable verdicts. Good ones are filtered — the row speaks only off-plan. */
  verdicts?: readonly { tone: VerdictTone; words: string }[];
  /** A second clause after the time. */
  note?: string;
  /** The photo's src; anything else draws the no-photo tile. */
  photo?: { src: string; alt?: string } | null;
  /** The no-photo tile: the accent chat mark on today's "Recent" row (a typed meal),
   *  the two-ring plate the compact rows of the past-day and logging boards draw. */
  tile?: "chat" | "plate";
  href?: string;
  /** Carried on `data-meal` so a tap handler can name the row it was tapped on. */
  id?: string;
}

export const mealRow = (o: MealRowSpec, lang: Lang): string => {
  const n = wholeNumbers(lang);
  const photo = o.photo?.src !== undefined
    ? `<img class="ph" src="${esc(o.photo.src)}" alt="${esc(o.photo.alt ?? "")}">`
    : o.tile === "plate"
      ? `<div class="ph plate">${ico("target")}</div>`
      : `<div class="ph chat">${ico("chat")}</div>`;
  // The words only when not on plan, one dot for the row, the worst tone's colour on it.
  const spoken = (o.verdicts ?? []).filter((v) => v.tone !== "good");
  const tag = o.href !== undefined ? "a" : "div";
  const attrs = o.href !== undefined ? ` href="${esc(o.href)}"` : "";
  const idAttr = o.id !== undefined ? ` data-meal="${esc(o.id)}"` : "";
  const tail = [
    spoken.length
      ? `<span class="v ${spoken.some((v) => v.tone === "bad") ? "bad" : "warn"}">${esc(spoken.map((v) => v.words).join(" · "))}</span>`
      : "",
    o.note !== undefined ? esc(o.note) : "",
  ].filter(Boolean).join(" · ");
  return `<${tag} class="meal"${attrs}${idAttr}>${photo}<div class="mm"><b>${esc(o.name)}</b>` +
    `<small>${esc(o.time)}${tail ? ` · ${tail}` : ""}</small>` +
    (o.grams ? macs(gramChips(o.grams, lang), "sm") : "") +
    `</div><div class="kc num">${n(o.kcal)}<small>${esc(UNIT_KCAL[lang])}</small></div></${tag}>`;
};

// ── The photo hero ───────────────────────────────────────────────────────────────────────────
//
// The photo, its item callouts at their corners, the stamp bottom-right, the scan while the
// analyzer is out. Callouts arrive only when the analyzer returns them — nothing here invents
// one. Height is the surface's (`height` is layout, and surfaces differ: 600 on log-logged, 300 on
// meal-delete), so `.hero` carries no height rule and the screen's own css sets it.

export interface HeroCallout {
  text: string;
  /** The small value after the item's words — its kcal on the boards. */
  value?: string;
  corner: "tl" | "tr" | "bl" | "br";
  /** Raised off the corner by the boards' 38 px — the bottom-right callout over the stamp lane. */
  lift?: boolean;
}

export const photoHero = (o: {
  /** The photo's URL — absent while a bearer-fetched photo is still arriving (src lands later). */
  src?: string;
  alt?: string;
  /** The callout inset — 14 on the phone boards, 18 on the web's log pages. */
  pad?: 14 | 18;
  stamp?: string;
  scan?: boolean;
  callouts?: readonly HeroCallout[];
}): string => {
  const callouts = (o.callouts ?? []).map((c) =>
    `<div class="co ${c.corner}${c.lift ? " lift" : ""}">${esc(c.text)}${c.value !== undefined ? ` <span>${esc(c.value)}</span>` : ""}</div>`
  ).join("");
  return `<div class="hero${o.pad === 18 ? " p18" : ""}">` +
    `<img${o.src !== undefined ? ` src="${esc(o.src)}"` : ""} alt="${esc(o.alt ?? "")}">` +
    callouts +
    (o.stamp !== undefined ? `<div class="stamp">${esc(o.stamp)}</div>` : "") +
    (o.scan ? `<div class="scan"></div>` : "") +
    `</div>`;
};

// ── The charts ───────────────────────────────────────────────────────────────────────────────
//
// Thin markup over S3's geometry: the positions are `estimateChart`/`TWO_WAYS_CHART`/`weightChart`/
// `weekBars`' own, the labels are the caller's words. SVG presentation attributes carry the paint
// — a `style=` on an element is what the app's CSP refuses.
//
// The gradient id is per-instance (`spudSeq`'s rule): two charts on one page may not share one.
let chartSeq = 0;

/** The estimate chart is a component, not a bare svg: the header row (its `.lab` plus the
 * `.tagx` "eait analysis" mark) is part of what it renders — a chart cannot ship labelless.
 * Single root so `kitEl` parses it whole. */
export const estimateChartSvg = (
  direction: EstimateDirection,
  labels: {
    aria: string; start: string; target: string; now: string; month: string;
    label: string; byEait: string;
  },
): string => {
  const g = estimateChart(direction);
  const uid = `pgf-${++chartSeq}`;
  const stops = g.areaGradient.stops.map((s) =>
    `<stop offset="${s.offset}" stop-color="var(--accent)" stop-opacity="${s.opacity}"/>`
  ).join("");
  return `<div class="ec"><div class="row between"><span class="lab">${esc(labels.label)}</span>` +
    `${tagx({ text: labels.byEait })}</div>` +
    `<svg class="pgraph" viewBox="${g.viewBox}" width="100%" role="img" aria-label="${esc(labels.aria)}">` +
    `<defs><linearGradient id="${uid}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient></defs>` +
    `<line x1="${g.baseline.x1}" y1="${g.baseline.y}" x2="${g.baseline.x2}" y2="${g.baseline.y}" stroke="var(--hair)"/>` +
    `<path class="area rise" d="${g.areaPath}" fill="url(#${uid})"/>` +
    `<path class="ln draw" d="${g.linePath}"/>` +
    `<circle cx="${g.startDot.cx}" cy="${g.startDot.cy}" r="${g.startDot.r}" fill="var(--ink)"/>` +
    `<circle class="pop end" cx="${g.endDot.cx}" cy="${g.endDot.cy}" r="${g.endDot.r}" fill="var(--accent)" stroke="var(--surface)" stroke-width="${g.endDot.strokeWidth}"/>` +
    `<g class="rise chip"><rect x="${g.targetChip.x}" y="${g.targetChip.y}" width="${g.targetChip.width}" height="${g.targetChip.height}" rx="${g.targetChip.rx}" fill="var(--ink)"/>` +
    `<text x="${g.targetChip.textX}" y="${g.targetChip.textY}" text-anchor="middle" fill="#fff" font-size="14" font-weight="700">${esc(labels.target)}</text></g>` +
    `<text x="${g.startLabel.x}" y="${g.startLabel.y}" fill="var(--ink)" font-weight="600">${esc(labels.start)}</text>` +
    `<text x="${g.nowLabel.x}" y="${g.nowLabel.y}">${esc(labels.now)}</text>` +
    `<text x="${g.monthLabel.x}" y="${g.monthLabel.y}" text-anchor="end" fill="var(--ink)" font-weight="600">${esc(labels.month)}</text>` +
    `</svg></div>`;
};

export const twoWayChartSvg = (
  labels: { aria: string; without: string; now: string; later: string },
): string =>
  `<svg class="pgraph" viewBox="${TWO_WAYS_CHART.viewBox}" width="100%" role="img" aria-label="${esc(labels.aria)}">` +
  `<line x1="${TWO_WAYS_CHART.baseline.x1}" y1="${TWO_WAYS_CHART.baseline.y}" x2="${TWO_WAYS_CHART.baseline.x2}" y2="${TWO_WAYS_CHART.baseline.y}" stroke="var(--hair)"/>` +
  `<path class="draw wo" d="${TWO_WAYS_CHART.withoutPath}" fill="none" stroke="var(--faint)" stroke-width="2.5" stroke-linecap="round"/>` +
  `<path class="draw wi" d="${TWO_WAYS_CHART.withPath}" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/>` +
  `<circle cx="${TWO_WAYS_CHART.startDot.cx}" cy="${TWO_WAYS_CHART.startDot.cy}" r="${TWO_WAYS_CHART.startDot.r}" fill="var(--ink)"/>` +
  `<text x="${TWO_WAYS_CHART.withoutLabel.x}" y="${TWO_WAYS_CHART.withoutLabel.y}" text-anchor="end" fill="var(--muted)" font-size="13" font-weight="600">${esc(labels.without)}</text>` +
  `<text x="${TWO_WAYS_CHART.nowLabel.x}" y="${TWO_WAYS_CHART.nowLabel.y}">${esc(labels.now)}</text>` +
  `<text x="${TWO_WAYS_CHART.laterLabel.x}" y="${TWO_WAYS_CHART.laterLabel.y}" text-anchor="end">${esc(labels.later)}</text>` +
  `</svg>`;

/**
 * The logged-weight line (`weightChart`): hairline rows, the polyline through the weigh-ins —
 * no point markers (#1068); a lone weigh-in keeps its dot, the mark IS the chart when no line
 * can be drawn (#95) — the first and last values and the two dates. `points` are `{t, kg}` —
 * epoch ms or day indexes, one unit throughout.
 */
export const weightChartSvg = (
  points: readonly WeightPoint[],
  labels: { aria?: string; first: string; last: string; from: string; to: string },
  /** you.html's target lane — `label` is the caller's "{w} · target" in the display unit. */
  target?: { label: string },
): string => {
  const g = weightChart(points, target !== undefined);
  // The You board's wchart carries no hairlines — with the target lane the dashed line IS the
  // frame's one guide; without a lane the plain chart keeps its grid.
  const grid = g.targetLine !== undefined ? "" : g.gridlines.map((y) =>
    `<line x1="20" x2="310" y1="${y}" y2="${y}" stroke="var(--hair)"/>`
  ).join("");
  // The line alone, no per-point dots (#1068) — except a lone weigh-in, whose dot is the whole
  // mark; `pd-0` is the kit's pop-delay class, re-timed per board (`you.css.ts`).
  const dots = g.points.length === 1
    ? `<circle cx="${g.points[0]!.x}" cy="${g.points[0]!.y}" r="4" fill="var(--ink)" class="pop pd-0"/>`
    : "";
  return `<svg class="pgraph wl" viewBox="${g.viewBox}" width="100%" role="img"${labels.aria ? ` aria-label="${esc(labels.aria)}"` : ""}>` +
    grid +
    (g.targetLine !== undefined
      ? `<line x1="${g.targetLine.x1}" x2="${g.targetLine.x2}" y1="${g.targetLine.y}" y2="${g.targetLine.y}" stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="${g.targetLine.dash}"/>` +
        `<text x="${g.targetLabel!.x}" y="${g.targetLabel!.y}" text-anchor="end" fill="var(--accent)" font-size="12" font-weight="600">${esc(target!.label)}</text>`
      : "") +
    (g.path ? `<path class="draw wl-line" d="${g.path}" fill="none" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>` : "") +
    dots +
    `<text x="${g.firstLabel.x}" y="${g.firstLabel.y}" fill="var(--ink)" font-weight="600">${esc(labels.first)}</text>` +
    (g.points.length ? `<text x="${g.lastLabel.x}" y="${g.lastLabel.y}" text-anchor="end" fill="var(--ink)" font-weight="600">${esc(labels.last)}</text>` : "") +
    `<text x="${g.dateLabelX.start}" y="${g.dateLabelY}">${esc(labels.from)}</text>` +
    `<text x="${g.dateLabelX.end}" y="${g.dateLabelY}" text-anchor="end">${esc(labels.to)}</text>` +
    `</svg>`;
};

/**
 * The week's intake bars (`weekBars`): one per logged day against the dashed plan line, today the
 * tinted-and-outlined one. `days` are kcal or null (no bar — an empty day is not a zero), `letters`
 * the caller's localized weekday letters, `planLabel` the formatted target.
 */
export const weekBarsSvg = (
  days: readonly (number | null)[],
  planKcal: number,
  o: { todayIndex: number; letters: readonly string[]; planLabel: string },
): string => {
  const g = weekBars(days, planKcal, o.todayIndex);
  const bars = g.bars.map((b, i) =>
    b === null ? "" :
    b.today
      ? `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${b.rx}" fill="var(--accent-tint)" stroke="var(--accent)" stroke-width="1.5" class="rise rd-${i}"/>`
      : `<rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" rx="${b.rx}" fill="var(--accent)" class="rise rd-${i}"/>`
  ).join("");
  const letters = g.labels.map((p, i) =>
    `<text x="${p.x}" y="${p.y}" text-anchor="middle">${esc(o.letters[i] ?? "")}</text>`
  ).join("");
  return `<svg class="pgraph wb" viewBox="${g.viewBox}" width="100%" role="img">` +
    `<line x1="${g.planLine.x1}" x2="${g.planLine.x2}" y1="${g.planLine.y}" y2="${g.planLine.y}" stroke="var(--ink)" stroke-dasharray="${g.planLine.dash}"/>` +
    bars + letters +
    `<text x="${g.planLabel.x}" y="${g.planLabel.y}" text-anchor="end" fill="var(--ink)" font-weight="600">${esc(o.planLabel)}</text>` +
    `</svg>`;
};

// ── The avatars ──────────────────────────────────────────────────────────────────────────────
//
// Spud is the 28 px tinted disc the boards draw beside a `.say` (36 px `.lg`); the face art per
// mood is mascot.ts's own, data-urled into a `--face` variable by kitCss — never a copy
// transcribed into a string here. The lettered accent disc and the name line `.gname` — the
// "{coach} · nutritionist" the correction boards carry.

/** Spud at 28 px, mood-named, decorative beside its `.say` text. `large` is the 36 px variant. */
export const spudAvatar = (mood: MascotMood, o: { large?: boolean } = {}): string =>
  `<span class="spud ${mood}${o.large ? " lg" : ""}" aria-hidden="true"></span>`;

/** The lettered accent disc — the letter itself is `.gabie::before`, so the markup carries none. */
export const gabieAvatar = (): string => `<span class="gabie" aria-hidden="true"></span>`;

/** The coach's name line above a `.say` turn's words — the caller composes the words, escaped here. */
export const gabieName = (name: string): string => `<div class="gname">${esc(name)}</div>`;

/**
 * The attribution chip: the eait mark's face plus the localized label — the "eait analysis" tag
 * on a chart — on a surface pill. The streak chip is the same pill with an icon instead of the
 * face (`icon` + `aria`, and `.ic` padding the board draws), so surfaces share the one chip.
 */
export const tagx = (o: { text: string; mood?: MascotMood; icon?: IconName; aria?: string }): string =>
  `<span class="tagx${o.icon !== undefined ? " ic" : ""}"${o.aria !== undefined ? ` aria-label="${esc(o.aria)}"` : ""}>` +
  (o.icon !== undefined ? ico(o.icon) : `<span class="wm ${o.mood ?? "happy"}" aria-hidden="true"></span>`) +
  `${esc(o.text)}</span>`;

// ── Buttons and option rows ──────────────────────────────────────────────────────────────────
//
// `.cta.p` is the register's one button: 16/600 on accent, radius 14, never uppercase. An `href`
// is a link, everything else is a button — `type` only ever "button" or "submit", because a
// default-typed button inside a `/start` form submits it.

export const cta = (o: {
  text: string;
  kind: "p" | "s" | "g";
  icon?: IconName;
  href?: string;
  type?: "button" | "submit";
  name?: string;
  value?: string;
}): string => {
  const inner = `${o.icon ? ico(o.icon) : ""}${esc(o.text)}`;
  if (o.href !== undefined) return `<a class="cta ${o.kind}" href="${esc(o.href)}">${inner}</a>`;
  const form = (o.name !== undefined ? ` name="${esc(o.name)}"` : "") +
    (o.value !== undefined ? ` value="${esc(o.value)}"` : "");
  return `<button class="cta ${o.kind}" type="${o.type ?? "button"}"${form}>${inner}</button>`;
};

/**
 * The option row: hairline-separated, a hollow check disc that fills accent when selected — never
 * a chip. `tile` wraps the icon in the tinted disc the list boards draw. `tag` is `a` for a
 * navigation row (`href`), `button` for a choice, `div` for display. A button's `type` is only
 * ever explicit — an untyped one inside a `/start` form submits it.
 */
export const optionRow = (o: {
  text: string;
  icon?: IconName;
  tile?: boolean;
  selected?: boolean;
  /** The chat boards' trailing affordance: a faint chevron where the check disc would sit —
      the row navigates forward into an answer, nothing is selected. */
  chevron?: boolean;
  tag?: "div" | "button" | "a";
  href?: string;
  type?: "button" | "submit";
  name?: string;
  value?: string;
}): string => {
  const tag = o.tag ?? (o.href !== undefined ? "a" : "button");
  const lead = o.icon !== undefined
    ? (o.tile ? `<span class="tile">${ico(o.icon)}</span>` : ico(o.icon))
    : "";
  const tail = o.chevron ? `<i class="ico i-chevron-right chv" aria-hidden="true"></i>` : `<span class="ck"></span>`;
  const attrs = (tag === "a" && o.href !== undefined ? ` href="${esc(o.href)}"` : "") +
    (tag === "button" ? ` type="${o.type ?? "button"}"` : "") +
    (o.name !== undefined ? ` name="${esc(o.name)}"` : "") +
    (o.value !== undefined ? ` value="${esc(o.value)}"` : "");
  return `<${tag} class="opt${o.selected ? " sel" : ""}"${attrs}>${lead}<span class="ot">${esc(o.text)}</span>${tail}</${tag}>`;
};

// ── The kit's rules ──────────────────────────────────────────────────────────────────────────
//
// `pro.css`'s rules for these components, token by token, minus the inline styles the CSP forbids
// (they are classes and presentation attributes now). Interpolated into the web shell's one style
// block and into `/start`'s STYLES — the same string both places, like `iconCss()`.

export function kitCss(): string {
  return `
/* W1 — the component kit (#88). pro.css's measurements; the vars are palette.ts/design.ts's. */
:root{--r-card:${RADIUS.card}px;--r-ctl:${RADIUS.control}px;--r-thumb:${RADIUS.thumbnail}px;--r-cta:${RADIUS.cta}px;--r-bar:${RADIUS.bar}px;--shadow:${SHADOW}}

/* The ring instrument — 104/96/52 px, strokes 8/8/5, the arc drawn on entry. */
.mring{position:relative;width:52px;height:52px;margin-top:8px;flex:0 0 auto}
.mring svg{width:52px;height:52px;display:block;transform:rotate(-90deg)}
.mring circle{fill:none}
.mring .fg{animation:k-draw 1.2s var(--ease) both}
.mring .ico{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);font-size:14px}
.mring.w104{width:104px;height:104px;margin-top:0}
.mring.w104 svg{width:104px;height:104px}
.mring.w104 .ico{width:40px;height:40px}
.mring.w96{width:96px;height:96px;margin-top:0}
.mring.w96 svg{width:96px;height:96px}
.mring.w96 .ico{width:38px;height:38px}
.mring.flat{display:flex;align-items:center;justify-content:center}
.mring.flat .ico{position:static;transform:none;width:34px;height:34px}

/* The week strip — seven days, the date centred in a 32 px ring of stroke 2.4. F's raised cell
   is ONE flat tint (the kcal tint, radius 12, no shadow) that a mounted strip glides between
   cells; the a0…a6 classes are the cells' left edges in the padded row, so the markup-only
   surfaces place it right too. */
.week{position:relative;display:flex;justify-content:space-between;padding:0 16px}
.week .wtint{position:absolute;top:0;bottom:0;width:44px;left:16px;border-radius:12px;
  background:var(--macro-kcal-t);transition:left .22s var(--ease);pointer-events:none}
${[0, 1, 2, 3, 4, 5, 6].map((i) => `.week .wtint.a${i}{left:calc(16px + ${i}*(100% - 76px)/6)}`).join("\n")}
.week .dy{display:flex;flex-direction:column;align-items:center;gap:5px;width:44px;padding:6px 0 7px;
  border:0;border-radius:var(--r-card);background:none;font:inherit;font-size:12px;font-weight:600;
  color:var(--muted);position:relative;cursor:pointer}
.week .dy .dl{font-size:12px;letter-spacing:.06em;text-transform:uppercase}
.week .dy.now{color:var(--ink)}
.week .dy.fut{opacity:.45;cursor:default}
.week .dy:focus-visible{outline:2px solid var(--accent);outline-offset:1px}
.week svg{width:32px;height:32px;transform:rotate(-90deg)}
.week .fg{animation:k-draw 1.2s var(--ease) both}
.week .dy b{position:absolute;left:0;right:0;bottom:7px;height:32px;margin:0;display:flex;
  align-items:center;justify-content:center;font-size:13px;font-weight:700;line-height:1;color:var(--ink)}

/* The macro chip — icon, number, unit. */
.mac{display:inline-flex;align-items:center;gap:5px;font-weight:600;font-variant-numeric:tabular-nums;white-space:nowrap}
.macs{display:flex;gap:14px;flex-wrap:wrap;font-size:14px}
.macs.sm{font-size:12px;gap:10px;color:var(--muted)}

/* The macro card — value, label, and a 52 px ring only where a target exists. */
.mcard{position:relative;background:var(--surface);border-radius:var(--r-card);padding:12px 12px 14px;
  display:flex;flex-direction:column;gap:4px;min-width:0;box-shadow:var(--shadow)}
.mcard.ctr{align-items:center;text-align:center}
.mcard b{font-size:20px;font-weight:700;letter-spacing:-.02em;font-variant-numeric:tabular-nums}
.mcard small{font-size:12px;font-weight:600;color:var(--muted)}
.mcard>.mring{align-self:center}
.mcard>.ico{width:34px;height:34px;margin-bottom:4px}
.mcards{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}

/* The meal row — 56 px photo or chat tile, name, time, verdict words only off-plan, chips, kcal. */
.meal{display:flex;gap:12px;align-items:center;padding:12px 0;border-top:1px solid var(--hair);
  color:inherit;text-decoration:none}
.meal:first-child{border-top:0;padding-top:0}
.meal:last-child{padding-bottom:0}
.meal .ph{width:56px;height:56px;flex:0 0 56px;border-radius:var(--r-thumb);object-fit:cover;background:var(--hair)}
.meal .ph.chat{display:flex;align-items:center;justify-content:center;background:var(--accent-tint)}
.meal .ph.chat .ico{width:22px;height:22px;color:var(--accent)}
.meal .ph.plate{display:flex;align-items:center;justify-content:center}
.meal .ph.plate .ico{width:24px;height:24px;color:var(--muted)}
.meal .mm{flex:1;min-width:0}
.meal .mm b{display:block;font-size:15px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.meal .mm small{display:block;font-size:12px;color:var(--muted);margin-top:2px}
.meal .mm .macs{margin-top:4px}
.meal .kc{font-weight:600;font-size:15px;text-align:right}
.meal .kc small{display:block;font-size:12px;color:var(--muted);font-weight:500}
.num{font-variant-numeric:tabular-nums}

/* The verdict — a dot and a line, never a pill. */
.v{display:inline-flex;align-items:center;gap:7px;font-size:13px;font-weight:500;color:var(--muted)}
.v::before{content:"";width:8px;height:8px;border-radius:50%;background:var(--accent);flex:0 0 8px}
.v.good{color:var(--accent)}
.v.warn{color:var(--warn)}.v.warn::before{background:var(--warn)}
.v.bad{color:var(--bad)}.v.bad::before{background:var(--bad)}
.vs{display:flex;gap:14px;flex-wrap:wrap}

/* The macro tip — the boards' .mtip: raised surface, the title's 8 px dot in the macro's
   colour (dark red and titled when .ov), the sentence, and the rotated-square arrow the
   surface slides under the row's icon with --ax. 260 wide; left/bottom are the anchor's call. */
.mtip{position:absolute;width:260px;background:var(--surface);border-radius:12px;z-index:5;
  padding:12px 14px;box-shadow:0 6px 24px rgba(23,25,28,.18),0 1px 3px rgba(23,25,28,.1);
  animation:k-tip .18s var(--ease) both}
@keyframes k-tip{from{filter:opacity(0);transform:translateY(4px) scale(.97)}to{filter:opacity(1);transform:none}}
.mtip b{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600}
.mtip b i{width:8px;height:8px;border-radius:4px;flex:0 0 8px}
.mtip.t-protein b i{background:var(--macro-protein)}
.mtip.t-carbs b i{background:var(--macro-carbs)}
.mtip.t-satfat b i{background:var(--macro-fat)}
.mtip.t-over b i{background:var(--over)}
.mtip.ov b{color:var(--over)}
.mtip p{margin:4px 0 0;font-size:13px;line-height:18px;color:var(--muted)}
.mtip::after{content:"";position:absolute;bottom:-6px;left:var(--ax,18px);width:12px;height:12px;
  background:var(--surface);transform:rotate(45deg);box-shadow:3px 3px 4px rgba(23,25,28,.06)}

/* The photo hero — image, corner callouts, the stamp; height is the surface's own. */
.hero{position:relative;overflow:hidden;background:#DDD8CE}
.hero img{width:100%;height:100%;object-fit:cover;display:block}
.hero .co{--copad:14px;position:absolute;display:flex;align-items:center;gap:6px;
  background:rgba(255,255,255,.94);border-radius:8px;padding:6px 9px;font-size:12px;font-weight:600;
  box-shadow:0 1px 2px rgba(0,0,0,.12);white-space:nowrap;animation:k-rise .5s var(--ease) both}
.hero.p18 .co{--copad:18px}
.hero .co.tl{left:var(--copad);top:var(--copad)}
.hero .co.tr{right:var(--copad);top:var(--copad)}
.hero .co.bl{left:var(--copad);bottom:var(--copad)}
.hero .co.br{right:var(--copad);bottom:var(--copad)}
.hero .co.lift{bottom:calc(var(--copad) + 38px)}
.hero .co::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--ink)}
.hero .co span{color:var(--muted);font-weight:500}
.hero .co:nth-of-type(2){animation-delay:.15s}
.hero .co:nth-of-type(3){animation-delay:.3s}
.hero .stamp{position:absolute;right:12px;bottom:12px;background:rgba(23,25,28,.72);color:#fff;
  font-size:12px;font-weight:600;padding:4px 8px;border-radius:6px}

/* The shared bits the components reach for: a row, space-between, the small caps label, and the
   estimate chart's own wrapper (header over graph, as the boards draw it). */
.row{display:flex;align-items:center;gap:12px}
.between{justify-content:space-between}
.lab{font-size:12px;font-weight:600;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.ec .row{margin-bottom:10px}

/* The avatars. Each mood's --face is mascot.ts's own SVG as a data URL — the same drawing the
   surfaces inline elsewhere, so a board and a bubble never carry two potatoes. .wm is the 20px
   wordmark size; .tagx shrinks it to 18 for the chip. */
.spud{width:28px;height:28px;flex:0 0 28px;border-radius:50%;
  background:var(--accent-tint) var(--face) center/78% no-repeat}
.spud.lg{width:36px;height:36px;flex-basis:36px}
.wm{width:20px;height:20px;border-radius:50%;flex:0 0 auto;
  background:var(--accent-tint) var(--face) center/78% no-repeat}
${(Object.keys(MOUTHS) as MascotMood[]).map((m) =>
  `.spud.${m},.wm.${m}{--face:url("data:image/svg+xml,${encodeURIComponent(spudSvg(m, `face-${m}`))}")}`
).join("\n")}
.gabie{width:28px;height:28px;flex:0 0 28px;border-radius:50%;background:var(--accent);color:#fff;
  display:inline-flex;align-items:center;justify-content:center;font:700 13px/1 var(--sans)}
.gabie::before{content:"G"}
.say{display:flex;gap:10px;align-items:flex-start}
.gname{font-size:12px;font-weight:600;color:var(--muted);margin:0 0 2px}

/* The attribution chip — the eait face plus words; the streak chip is the same pill at .ic. */
.tagx{display:inline-flex;align-items:center;gap:5px;background:var(--surface);border-radius:999px;
  padding:3px 9px 3px 4px;font-size:12px;font-weight:600;color:var(--ink);
  box-shadow:0 1px 3px rgba(23,25,28,.16);white-space:nowrap}
.tagx .wm{width:18px;height:18px;flex-basis:18px}
.tagx .ico{width:16px;height:16px}
.tagx .i-streak{color:var(--macro-carbs)}
.tagx.ic{padding:4px 10px}

/* The chart frame — overflow:visible so an end dot can sit on the edge. */
.pgraph{display:block;overflow:visible;width:100%}
.pgraph text{font-size:12px;fill:var(--muted);font-family:inherit}
.pgraph .ln{fill:none;stroke:var(--accent);stroke-width:2.5;stroke-linecap:round}
.pgraph .area{animation-delay:.6s}
.pgraph .end{animation-delay:1.1s}
.pgraph .chip{animation-delay:1.2s}
.pgraph .wo{animation-delay:.2s}
.pgraph .wi{animation-delay:.5s}
/* The Target chip's label is white on ink — without this rule the .pgraph text line above
   out-ranks the fill attribute and the chip reads muted-on-ink (~3.6:1). */
.pgraph .chip text{fill:#fff}
/* Staggered entries, by data index rather than DOM position — a sparse week keeps its delays.
   Inline styles are not an option (the app's CSP), so the delay arrives as a generated class.
   pd-0 is the lone weigh-in's dot — the only one the weight line keeps (#1068). */
.pgraph.wl circle.pd-0{animation-delay:.8s}
${Array.from({ length: 7 }, (_, i) => `.pgraph.wb rect.rd-${i}{animation-delay:${(i * 0.06).toFixed(2)}s}`).join("\n")}

/* The one button — 16/600 on accent, radius 14, never uppercase. The .card rule's legacy
   button style would otherwise win on radius and padding inside a card, so it is re-stated. */
.cta{display:flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:52px;
  border-radius:var(--r-cta);font:inherit;font-size:16px;font-weight:600;cursor:pointer;border:0;
  text-decoration:none;padding:0}
.cta.p{background:var(--accent);color:var(--accent-ink)}
.cta.s{background:var(--surface);color:var(--ink);box-shadow:0 0 0 1px var(--line)}
/* The boards draw the ghost at 40px; the app's tap floor is 44 (the a11y gate measures the box),
   so the smaller box wins the floor, not the pixel. */
.cta.g{background:none;color:var(--muted);min-height:44px;font-weight:500}
.cta .ico{width:20px;height:20px}
.cta:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
.card button.cta{font:inherit;font-size:16px;font-weight:600;padding:0;border:0;margin:0;
  border-radius:var(--r-cta);min-height:52px}
.card button.cta.p{background:var(--accent);color:var(--accent-ink)}
.card button.cta.s{background:var(--surface);color:var(--ink);box-shadow:0 0 0 1px var(--line)}
.card button.cta.g{background:none;color:var(--muted);min-height:44px;font-weight:500}

/* The option row — a hairline and a check disc, no chips. */
.opt{display:flex;align-items:center;gap:14px;width:100%;padding:16px 0;
  border:0;border-top:1px solid var(--hair);background:none;font:inherit;font-size:17px;
  font-weight:500;color:var(--ink);text-align:left;cursor:pointer;text-decoration:none}
.opt:first-child{border-top:0}
.opt .ot{flex:1;min-width:0}
.opt .ico{width:24px;height:24px}
.opt .tile{width:40px;height:40px;flex:0 0 40px;border-radius:50%;background:var(--bg);
  display:flex;align-items:center;justify-content:center}
.opt .tile .ico{width:22px;height:22px}
.opt .ck{margin-left:auto;width:22px;height:22px;flex:0 0 22px;border-radius:50%;
  box-shadow:inset 0 0 0 1.5px var(--line);position:relative}
.opt.sel{font-weight:600}
.opt.sel .ck{background:var(--accent);box-shadow:none}
.opt.sel .ck::after{content:"";position:absolute;left:7px;top:3px;width:6px;height:11px;
  border:solid var(--accent-ink);border-width:0 2px 2px 0;transform:rotate(45deg)}
.opt:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}
.opts{display:flex;flex-direction:column;gap:10px}
/* A DIRECT child only: the chat's \`.card.flat\` of \`.opt\` rows sits inside an \`li.opts\` and must
   not be carded a second time over. */
.opts>.opt{border-top:0;background:var(--surface);border-radius:var(--r-card);padding:12px 16px;
  box-shadow:0 0 0 1px var(--hair);font-size:16px}
.opts>.opt.sel{box-shadow:0 0 0 2px var(--ink)}
.card.flat{box-shadow:0 0 0 1px var(--hair)}

/* The boards' type utilities and the hairline rule, verbatim from pro.css — display weight and
   its four sizes, the two caption sizes, muted/faint inks. */
.d{font-weight:700;letter-spacing:-.02em;line-height:1.1}
.d34{font-size:34px}.d28{font-size:28px}.d22{font-size:22px}.d17{font-size:17px;letter-spacing:-.01em}
.t13{font-size:13px}.t12{font-size:12px}.m{color:var(--muted)}.f{color:var(--faint)}
.hr{height:1px;background:var(--hair);margin:12px 0}

/* The 36 px icon button (pro.css's .ib) — the meal header's X and "…", the date switcher's arrows.
   The glyph is the masked .ico, so the colour is the button's ink, not a stroke rule. */
.ib{width:36px;height:36px;flex:0 0 36px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--surface);box-shadow:0 0 0 1px var(--hair);border:0;padding:0;cursor:pointer;color:var(--ink)}
.ib .ico{width:18px;height:18px;background:var(--ink)}

/* The health-score row and its breakdown rows (web + phone meal.html / meal-score.html). The bar
   is an svg: a rect width carries the fill where the boards wrote style="width:n%". The .card
   button base would otherwise restyle it, so the same re-statement the .cta rule makes is made
   here. */
.hsr{display:flex;align-items:center;gap:12px;width:100%;padding:10px 14px;border-radius:var(--r-card);
  box-shadow:0 0 0 1px var(--hair);background:var(--surface);color:var(--ink);border:0;cursor:pointer;
  font:inherit;font-size:15px;text-align:left;text-decoration:none}
.hsr .hl{font-weight:600}
.hsr .hsb{flex:1;display:block;height:6px}
.hsb .tr{fill:var(--hair)} .hsb .fg{fill:var(--ink)}
.hsr .num{font-size:16px}
.hsr .ico{width:16px;height:16px;background:var(--muted)}
.card button.hsr{margin:0;padding:10px 14px;border:0;min-height:0;border-radius:var(--r-card)}
.hsp{display:flex;align-items:center;gap:12px;padding:11px 0;border-top:1px solid var(--hair);
  font-size:15px;font-weight:500}
.hsp small{display:block;font-size:12px;font-weight:500;color:var(--muted);margin-top:1px}
.hsp .pts{margin-left:auto;font-weight:700;font-variant-numeric:tabular-nums}

/* The ingredient row — the name, its amount, its own kcal (web + phone meal.html). */
.ing{display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:var(--r-ctl);
  box-shadow:0 0 0 1px var(--hair);font-size:14px;font-weight:600}
.ing span{color:var(--muted);font-weight:500;white-space:nowrap}
.ing b{margin-left:auto;font-variant-numeric:tabular-nums}
`;
}
