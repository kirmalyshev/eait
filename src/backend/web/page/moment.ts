// The two moment cards inside the W2 walk — `02-how` after the goal and `12-cards` (on-track)
// after the struggles. They collect nothing, so they are GET pages the redirect names (`?show=`),
// not POST handlers of their own: Continue is a link back into the walk.
//
// The `how` card teaches the loop with the boards' own demo numbers (`HOW_DEMO` — fixed, because
// the screen precedes every answer that could feed it); the on-track card draws the two-ways
// chart and a caption that knows the struggles just ticked.

import {
  ageFrom, bmi, chatCopyFor, ESTIMATE_CHART_MINI, fill, heightText, HOW_DEMO, ontrackCaption, optionLabel,
  TWO_WAYS_CHART, UNIT_KCAL, kcalNumbers, verdictPillLabel, weightDisplay,
} from "@eait/shared";
import type { Lang, Profile, UnitSystem } from "@eait/shared";
import { brandSvg } from "@eait/shared/ui/icons";
import { gramMacs, verdictList } from "@eait/shared/ui/kit";
import { pageCopyFor } from "../copy.ts";
import { ctaLink, dash, IMG_URL_DIR, PLACE_MOOD, say, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/** A step's head — the number badge beside the step's name, as the board's cards draw it. */
const stepHead = (n: number, label: string): string =>
  `<div class="row chead"><span class="n">${n}</span><b class="d d17">${escape(label)}</b></div>`;

function howCards(lang: Lang, units: UnitSystem): string {
  const copy = chatCopyFor(lang);
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
    `<span class="num"><b class="d mkcal">${kcalNumbers(lang)(HOW_DEMO.meal.kcal)}</b> ` +
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

/** The WHO band edges `baseline` draws and names; the bar's ends are the design's 15 and 40. */
const BMI_AXIS = { min: 15, max: 40 } as const;

/** `twice` — the cited claim as two columns: 1× and 2×. The source line is the study, verbatim. */
function twiceCards(lang: Lang): string {
  const t = chatCopyFor(lang).twice;
  return `<p class="muted-sub cen">${escape(t.sub)}</p>` +
    `<div class="twice" role="img" aria-label="${escape(t.alt)}">` +
    `<figure class="a"><span class="em" aria-hidden="true">🐢</span><div class="col"><div class="bar"></div></div>` +
    `<figcaption>${escape(t.without)}</figcaption></figure>` +
    `<figure class="b"><span class="em" aria-hidden="true">🚀</span><div class="col"><div class="bar">2×</div></div>` +
    `<figcaption>${escape(t.with)}</figcaption></figure></div>` +
    `<p class="muted-sub cen src">${escape(t.source)}</p>`;
}

/**
 * `baseline` — the BMI the typed height and weight compute, the band it falls in, and the answers
 * restated. Computed here from the profile and never stored; a profile missing either number draws
 * the three rows only.
 */
function baselineCards(profile: Profile, lang: Lang): string {
  const b = chatCopyFor(lang).baseline;
  const units = profile.units ?? "metric";
  const value = bmi(profile.weight_kg, profile.height_cm);
  const band = value === null ? null
    : value < 18.5 ? "under" : value < 25 ? "healthy" : value < 30 ? "over" : "obese";
  const verdict = band === null ? null : band === "under" ? b.verdict.under
    : band === "healthy" ? b.verdict.healthy : b.verdict.above;
  const at = value === null ? 0
    : Math.round((Math.min(Math.max(value, BMI_AXIS.min), BMI_AXIS.max) - BMI_AXIS.min)
      / (BMI_AXIS.max - BMI_AXIS.min) * 1000) / 10;
  const age = ageFrom(profile.birth_year);
  const who = [profile.sex ? optionLabel("sex", profile.sex, lang) : null,
    age === null ? null : `${age} ${chatCopyFor(lang).units.years}`].filter(Boolean).join(" · ");
  const body = profile.height_cm && profile.weight_kg
    ? `${heightText(profile.height_cm, units, lang)} · ${weightDisplay(profile.weight_kg, units, lang)}` : "";
  const row = (icon: string, label: string, text: string) => text === "" ? "" :
    `<div class="card brow"><span class="bt" aria-hidden="true">${icon}</span>` +
    `<div><span>${escape(label)}</span><b>${escape(text)}</b></div></div>`;
  const meter = value === null ? "" :
    `<div class="card bmeter band-${band}"><div class="bm-r">${escape(b.bmi)}` +
    `<span class="bm-v">${escape(String(value))}</span></div>` +
    `<div class="bm-sc"><span class="bm-k" style="left:${at}%"></span></div>` +
    `<div class="bm-w">${escape(b.bands[band!])}</div></div>` +
    `<div class="bverdict"><b>${escape(verdict!)}</b><span>${escape(b.note)}</span></div>`;
  return meter + row("🙂", b.you, who) + row("📏", b.body, body)
    + row("🚶", b.activity, profile.activity ? optionLabel("activity", profile.activity, lang) : "");
}

/**
 * 09b's headline, as markup: the distance back with its number in the accent, and the answer on
 * its own line after the question mark ("Losing <em>6</em>kg?<br>Realistic, and possible!").
 * `promptsFor` only reaches this with both weights typed and half a kilo or more between them.
 */
function possibleTitle(profile: Profile, lang: Lang): string {
  const p = chatCopyFor(lang).possible;
  const gap = Math.abs((profile.weight_kg ?? 0) - (profile.target_weight_kg ?? 0));
  const delta = weightDisplay(gap, profile.units ?? "metric", lang);
  const [before = "", after = ""] = (profile.goal === "gain" ? p.gain : p.lose).split("{delta}");
  const m = delta.match(/^(.*\d)(.*)$/);
  const figure = m ? `<em>${escape(m[1]!)}</em>${escape(m[2]!)}` : escape(delta);
  return (escape(before) + figure + escape(after)).replace(/([?？])\s+/, "$1<br>");
}

/** An interstitial — the three beats between the questions, then `ontrack` and `how` after them. GET, not POST:
 *  they collect nothing, so the Continue is a link back into the walk. */
export function interstitial(
  place: "how" | "ontrack" | "twice" | "baseline" | "possible",
  profile: Profile,
  lang: Lang,
  continueHref: string,
  back: string,
): string {
  const copy = chatCopyFor(lang);
  // 09b is the board's own: the emoji and the headline near the top, Continue at the foot.
  if (place === "possible") return shell("eait", `${wtop()}
<div class="wmain one q mom"><div class="wcol">
${dash(place, lang, { href: back, label: pageCopyFor(lang).back })}
<div class="pss"><div class="ps"><div class="e" aria-hidden="true">💪</div><h1>${possibleTitle(profile, lang)}</h1></div>
${ctaLink(continueHref, copy.continueLabel)}</div>
</div></div>`, lang, "ob");
  const inner = place === "how"
    ? howCards(lang, profile.units ?? "metric")
    : place === "twice" ? twiceCards(lang)
    : place === "baseline" ? baselineCards(profile, lang)
    : `<div class="card rel">` +
      `<div class="lab">${escape(copy.chart.weightTrend)}</div>` +
      `<div class="chartw">${ontrackChart(lang)}` +
      `<div class="tagx pos">${brandSvg("eait", { size: 20, class: "appicon" })}${escape(copy.chart.byEait)}</div></div>` +
      `</div>` +
      (ontrackCaption(profile.struggles, lang)
        ? `<p class="muted-sub cen">${escape(ontrackCaption(profile.struggles, lang)!)}</p>`
        : "");
  const title = place === "how" ? copy.how.title
    : place === "twice" ? copy.twice.title
    : place === "baseline" ? copy.baseline.title
    : copy.ontrack.title;
  const body = `${wtop()}
<div class="wmain one q mom${place === "how" ? " wide" : ""}"><div class="wcol">
${dash(place, lang, { href: back, label: pageCopyFor(lang).back })}
<div class="igroup">
${say(PLACE_MOOD[place] ?? "happy", [title], lang)}
${inner}
${ctaLink(continueHref, copy.continueLabel)}
</div>
</div></div>`;
  return shell("eait", body, lang, "ob");
}
