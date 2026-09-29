// The two moment cards inside the W2 walk — `02-how` after the goal and `12-cards` (on-track)
// after the struggles. They collect nothing, so they are GET pages the redirect names (`?show=`),
// not POST handlers of their own: Continue is a link back into the walk.
//
// The `how` card teaches the loop with the boards' own demo numbers (`HOW_DEMO` — fixed, because
// the screen precedes every answer that could feed it); the on-track card draws the two-ways
// chart and a caption that knows the struggles just ticked.

import {
  chatCopyFor, ESTIMATE_CHART_MINI, fill, HOW_DEMO, ontrackCaption, TWO_WAYS_CHART,
  UNIT_KCAL, verdictPillLabel, weightDisplay, wholeNumbers,
} from "@eait/shared";
import type { Lang, Profile, UnitSystem } from "@eait/shared";
import { spudSvg } from "@eait/shared/mascot";
import { gramMacs, verdictList } from "@eait/shared/ui/kit";
import { ctaLink, dash, IMG_URL_DIR, PLACE_MOOD, say, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/** A step's head — the number badge beside the step's name, as the board's cards draw it. */
const stepHead = (n: number, label: string): string =>
  `<div class="row chead"><span class="n">${n}</span><b class="d d17">${escape(label)}</b></div>`;

function howCards(lang: Lang, units: UnitSystem): string {
  const copy = chatCopyFor(lang);
  const w = wholeNumbers(lang);
  const [s1, s2, s3] = copy.how.steps;
  const mini = ESTIMATE_CHART_MINI;
  // Step 1 — the plate in the viewfinder (the same grain bowl the welcome demo reads).
  const card1 = `<div class="card">${stepHead(1, s1!)}<div class="pict">` +
    `<img class="hero" src="${IMG_URL_DIR}/hero.webp" alt="${escape(copy.how.photoAlt)}">` +
    `<div class="vf"><i></i><i></i><i></i><i></i></div></div></div>`;
  // Step 2 — a verdict card, with the persona's drawn lunch and its two warn verdicts.
  const card2 = `<div class="card">${stepHead(2, s2!)}<div class="mbox">` +
    `<div class="row">` +
    `<img class="mimg" src="${IMG_URL_DIR}/salmon-sq.webp" alt="">` +
    `<div class="grow"><div class="row between"><b class="mname">${escape(copy.how.meal)}</b>` +
    `<span class="num"><b class="d mkcal">${w(HOW_DEMO.meal.kcal)}</b> ` +
    `<span class="m t12">${escape(UNIT_KCAL[lang])}</span></span></div>` +
    gramMacs(
      { protein: HOW_DEMO.meal.proteinG, carbs: HOW_DEMO.meal.carbsG, fat: HOW_DEMO.meal.fatG },
      lang,
    ) +
    `</div></div>` +
    verdictList(HOW_DEMO.verdicts.map((vv) => ({
      tone: vv.verdict,
      words: verdictPillLabel(vv.dimension, vv.verdict, lang),
    }))) +
    `</div></div>`;
  // Step 3 — the mini estimate curve, fixed to the boards' persona figure (74 → 68).
  const card3 = `<div class="card">${stepHead(3, s3!)}<div class="mbox chart">` +
    `<div class="row between"><span class="t13 semi">${escape(copy.chart.estimatedProgress)}</span>` +
    `<span class="est">${escape(copy.chart.estimate)}</span></div>` +
    `<svg class="pgraph" viewBox="${mini.viewBox}" width="100%" role="img" aria-hidden="true">` +
    `<defs><linearGradient id="hgrad" x1="0" y1="0" x2="0" y2="1">` +
    mini.areaGradient.stops.map((s) =>
      `<stop offset="${s.offset}" stop-color="var(--accent)" stop-opacity="${s.opacity}"/>`,
    ).join("") + `</linearGradient></defs>` +
    `<path d="${mini.areaPath}" fill="url(#hgrad)"/>` +
    `<path d="${mini.linePath}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linecap="round" class="draw"/>` +
    `<circle cx="${mini.startDot.cx}" cy="${mini.startDot.cy}" r="${mini.startDot.r}" fill="var(--ink)"/>` +
    `<circle cx="${mini.endDot.cx}" cy="${mini.endDot.cy}" r="${mini.endDot.r}" fill="var(--accent)" stroke="var(--surface)" stroke-width="${mini.endDot.strokeWidth}"/>` +
    `<rect x="${mini.targetChip.x}" y="${mini.targetChip.y}" width="${mini.targetChip.width}" height="${mini.targetChip.height}" rx="${mini.targetChip.rx}" fill="var(--ink)"/>` +
    `<text x="${mini.targetChip.textX}" y="${mini.targetChip.textY}" text-anchor="middle" fill="#fff" font-size="12" font-weight="700">` +
    `${escape(fill(copy.chart.target, { weight: weightDisplay(HOW_DEMO.targetKg, units, lang) }))}</text>` +
    `<text class="ink" x="${mini.startLabel.x}" y="${mini.startLabel.y}">${escape(weightDisplay(HOW_DEMO.startKg, units, lang))}</text>` +
    `</svg></div></div>`;
  return `<div class="cards c3">${card1}${card2}${card3}</div>`;
}

/** The on-track two-ways chart — the shared geometry, the drawn animation as the boards spec it. */
function ontrackChart(lang: Lang): string {
  const copy = chatCopyFor(lang);
  const c = TWO_WAYS_CHART;
  return `<svg class="pgraph" viewBox="${c.viewBox}" width="100%" role="img" aria-label="${escape(copy.chart.twoWays)}">` +
    `<line x1="${c.baseline.x1}" y1="${c.baseline.y}" x2="${c.baseline.x2}" y2="${c.baseline.y}" stroke="var(--hair)"/>` +
    `<path d="${c.withoutPath}" fill="none" stroke="var(--faint)" stroke-width="2.5" stroke-linecap="round" class="draw" style="--d:.2s"/>` +
    `<path d="${c.withPath}" class="ln draw" style="--d:.5s"/>` +
    `<circle cx="${c.startDot.cx}" cy="${c.startDot.cy}" r="${c.startDot.r}" fill="var(--ink)"/>` +
    `<text x="${c.withoutLabel.x}" y="${c.withoutLabel.y}" text-anchor="end" style="font-size:13px;font-weight:600">${escape(copy.chart.without)}</text>` +
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
      `<div class="chartw">${ontrackChart(lang)}` +
      `<div class="tagx pos"><span class="wm" aria-hidden="true">${spudSvg("happy", "spud-tag")}</span>${escape(copy.chart.byEait)}</div></div>` +
      `</div>` +
      (ontrackCaption(profile.struggles, lang)
        ? `<p class="muted-sub cen">${escape(ontrackCaption(profile.struggles, lang)!)}</p>`
        : "");
  const title = place === "how" ? copy.how.title : copy.ontrack.title;
  const body = `${wtop()}
<div class="wmain one q mom${place === "how" ? " wide" : ""}"><div class="wcol">
${dash(place, lang)}
<div class="igroup">
${say(PLACE_MOOD[place] ?? "happy", [title], lang)}
${inner}
${ctaLink(continueHref, copy.continueLabel)}
</div>
</div></div>`;
  return shell("eait", body, lang, "ob");
}
