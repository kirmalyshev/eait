// The two moment cards inside the W2 walk — `02-how` after the goal and `12-cards` (on-track)
// after the struggles. They collect nothing, so they are GET pages the redirect names (`?show=`),
// not POST handlers of their own: Continue is a link back into the walk.
//
// The `how` card teaches the loop with the boards' own demo numbers (`HOW_DEMO` — fixed, because
// the screen precedes every answer that could feed it); the on-track card draws the two-ways
// chart and a caption that knows the struggles just ticked.

import {
  chatCopyFor, ESTIMATE_CHART_MINI, fill, HOW_DEMO, numbers, ontrackCaption, TWO_WAYS_CHART,
  verdictPillLabel, weightDisplay, wholeNumbers,
} from "@eait/shared";
import type { Lang, Profile, UnitSystem } from "@eait/shared";
import { spudSvg } from "@eait/shared/mascot";
import { ctaLink, dash, IMG_URL_DIR, PLACE_MOOD, say, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

const KCAL_CHIP = "kcal";
const MACS: readonly { icon: string; cls: string; of: (m: typeof HOW_DEMO.meal) => number }[] = [
  { icon: "protein", cls: "m-protein", of: (m) => m.proteinG },
  { icon: "carbs", cls: "m-carbs", of: (m) => m.carbsG },
  { icon: "fat", cls: "m-fat", of: (m) => m.fatG },
];

function howCards(lang: Lang, units: UnitSystem): string {
  const copy = chatCopyFor(lang);
  const n = numbers(lang);
  const w = wholeNumbers(lang);
  const [s1, s2, s3] = copy.how.steps;
  const mini = ESTIMATE_CHART_MINI;
  // Step 1 — the plate in the viewfinder (the same grain bowl the welcome demo reads).
  const card1 = `<div class="card"><div class="pict">` +
    `<img class="hero" src="${IMG_URL_DIR}/hero.webp" alt="${escape(copy.how.photoAlt)}">` +
    `<div class="vf"><i></i><i></i><i></i><i></i></div><span class="n">1</span></div>` +
    `<div class="pt">${escape(s1!)}</div></div>`;
  // Step 2 — a verdict card, with the persona's drawn lunch and its two warn verdicts.
  const card2 = `<div class="card"><div class="pict solid">` +
    `<div class="mini"><div class="row">` +
    `<img class="mimg" src="${IMG_URL_DIR}/salmon-sq.webp" alt="">` +
    `<div class="grow"><b class="d d17">${escape(copy.how.meal)}</b></div>` +
    `<span class="row mrow"><i class="ico i-${KCAL_CHIP} mico"></i>` +
    `<b class="num mkcal">${w(HOW_DEMO.meal.kcal)}</b></span></div>` +
    `<div class="macs">${MACS.map((m) =>
      `<span class="mac ${m.cls}"><i class="ico i-${m.icon}"></i>${n(m.of(HOW_DEMO.meal))} g</span>`,
    ).join("")}</div>` +
    `<div class="vlist">${HOW_DEMO.verdicts.map((vv) =>
      `<span class="v ${vv.verdict}"><i></i>${escape(verdictPillLabel(vv.dimension, vv.verdict, lang))}</span>`,
    ).join("")}</div></div><span class="n">2</span></div>` +
    `<div class="pt">${escape(s2!)}</div></div>`;
  // Step 3 — the mini estimate curve, fixed to the boards' persona figure (74 → 68).
  const card3 = `<div class="card"><div class="pict chart">` +
    `<div class="row between"><b class="t13 semi">${escape(copy.chart.estimatedProgress)}</b>` +
    `<span class="est">${escape(copy.chart.estimate)}</span></div>` +
    `<svg class="pgraph" viewBox="${mini.viewBox}" width="100%" role="img" aria-hidden="true">` +
    `<defs><linearGradient id="hgrad" x1="0" y1="0" x2="0" y2="1">` +
    mini.areaGradient.stops.map((s) =>
      `<stop offset="${s.offset}" stop-color="var(--accent)" stop-opacity="${s.opacity}"/>`,
    ).join("") + `</linearGradient></defs>` +
    `<path d="${mini.areaPath}" fill="url(#hgrad)"/>` +
    `<path d="${mini.linePath}" class="ln draw"/>` +
    `<circle cx="${mini.startDot.cx}" cy="${mini.startDot.cy}" r="${mini.startDot.r}" fill="var(--ink)"/>` +
    `<circle cx="${mini.endDot.cx}" cy="${mini.endDot.cy}" r="${mini.endDot.r}" fill="var(--accent)" stroke="var(--surface)" stroke-width="${mini.endDot.strokeWidth}"/>` +
    `<text class="ink" x="${mini.startLabel.x}" y="${mini.startLabel.y}">${escape(weightDisplay(HOW_DEMO.startKg, units, lang))}</text>` +
    `</svg>` +
    `<div class="ptick"><span class="tgt">${escape(fill(copy.chart.target, { weight: weightDisplay(HOW_DEMO.targetKg, units, lang) }))}</span></div>` +
    `<span class="n">3</span></div>` +
    `<div class="pt">${escape(s3!)}</div></div>`;
  return `<div class="cards c3">${card1}${card2}${card3}</div>`;
}

/** The on-track two-ways chart — the shared geometry, the drawn animation as the boards spec it. */
function ontrackChart(lang: Lang): string {
  const copy = chatCopyFor(lang);
  const c = TWO_WAYS_CHART;
  return `<svg class="pgraph" viewBox="${c.viewBox}" width="100%" role="img" aria-label="${escape(copy.chart.twoWays)}">` +
    `<line x1="${c.baseline.x1}" y1="${c.baseline.y}" x2="${c.baseline.x2}" y2="${c.baseline.y}" stroke="var(--hair)"/>` +
    `<path d="${c.withoutPath}" fill="none" stroke="var(--line)" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 4" class="draw" style="--d:.2s"/>` +
    `<path d="${c.withPath}" class="ln draw" style="--d:.5s"/>` +
    `<circle cx="${c.startDot.cx}" cy="${c.startDot.cy}" r="${c.startDot.r}" fill="var(--ink)"/>` +
    `<text x="${c.withoutLabel.x}" y="${c.withoutLabel.y}" text-anchor="end">${escape(copy.chart.without)}</text>` +
    `<text x="${c.nowLabel.x}" y="${c.nowLabel.y}">${escape(copy.chart.now)}</text>` +
    `<text x="${c.laterLabel.x}" y="${c.laterLabel.y}" text-anchor="end">${escape(copy.chart.later)}</text>` +
    `</svg>`;
}

/** An interstitial — `how` (after the goal) and `ontrack` (after the struggles). GET, not POST:
 *  they collect nothing, so the Continue is a link back into the walk. */
export function interstitial(
  place: "how" | "ontrack",
  profile: Profile,
  lang: Lang,
  continueHref: string,
): string {
  const copy = chatCopyFor(lang);
  const inner = place === "how"
    ? howCards(lang, profile.units ?? "metric")
    : `<div class="card rel">` +
      `<div class="lab">${escape(copy.chart.weightTrend)}</div>` +
      `${ontrackChart(lang)}` +
      `<div class="tagx pos"><span class="wm" aria-hidden="true">${spudSvg("happy", "spud-tag")}</span>${escape(copy.chart.byEait)}</div>` +
      `</div>` +
      (ontrackCaption(profile.struggles, lang)
        ? `<p class="muted-sub cen">${escape(ontrackCaption(profile.struggles, lang)!)}</p>`
        : "");
  const title = place === "how" ? copy.how.title : copy.ontrack.title;
  const body = `${wtop()}
<div class="wmain one q"><div class="wcol">
${dash(place, lang)}
${say(PLACE_MOOD[place] ?? "happy", [title], lang)}
<div class="qcol">${inner}${ctaLink(continueHref, copy.continueLabel)}</div>
</div></div>`;
  return shell("eait", body, lang, "ob");
}
