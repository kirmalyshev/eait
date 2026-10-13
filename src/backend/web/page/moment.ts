// The two moment cards inside the W2 walk — `02-how` after the goal and `12-cards` (on-track)
// after the struggles. They collect nothing, so they are GET pages the redirect names (`?show=`),
// not POST handlers of their own: Continue is a link back into the walk.
//
// The `how` rows teach the loop with the boards' own demo meal (`HOW_DEMO` — fixed, no meal exists
// yet) and the user's own weight and target; the on-track card draws the two-ways chart and a
// caption that knows the struggles just ticked.

import {
  activityWords, ageFrom, bmi, BMI_AXIS, chatCopyFor, heightText, HOW_DEMO, howProgress, numbers, ontrackCaption,
  optionLabel, screenOptions, spellUnit, TWO_WAYS_CHART, UNIT_KCAL, kcalNumbers, weightDisplay,
} from "@eait/shared";
import type { Lang, OnboardingContent, Profile, UnitSystem } from "@eait/shared";
import { brandSvg } from "@eait/shared/ui/icons";
import { pageCopyFor } from "../copy.ts";
import { ctaLink, dash, IMG_URL_DIR, say, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/**
 * "How eait works" (16) as the board's three compact rows (ieat-app#2050): the plate, the macros
 * it reads to, and the progress it adds up to. The dish and its figures are the persona's
 * (`HOW_DEMO`) — the screen teaches the loop before any meal exists — but the progress row is the
 * user's own weight and target (`howProgress`), and not drawn at all where there is none.
 */
function howCards(profile: Profile, lang: Lang, units: UnitSystem): string {
  const copy = chatCopyFor(lang);
  const [s1, s2, s3] = copy.how.steps;
  const g = spellUnit(lang, "g");
  const prog = howProgress(profile);
  const step = (d: number, tile: string, label: string, body: string) =>
    `<div class="hstep rise" style="--d:${d}s"><div class="tl">${tile}</div>` +
    `<div><span>${escape(label)}</span>${body}</div></div>`;
  const mac = (icon: string, grams: number) =>
    `<span><i class="ico i-${icon}"></i> ${escape(`${grams}${g}`)}</span>`;
  return `<div class="hsteps">` +
    step(.3, `<img src="${IMG_URL_DIR}/salmon-sq.webp" alt="${escape(copy.how.photoAlt)}">`, s1!,
      `<b>${escape(copy.how.meal)}</b>`) +
    step(.55, `<i class="ico i-kcal"></i>`, s2!,
      `<b class="num">${escape(`${kcalNumbers(lang)(HOW_DEMO.meal.kcal)} ${UNIT_KCAL[lang]}`)}</b>` +
      `<div class="macs num">${mac("protein", HOW_DEMO.meal.proteinG)}${mac("carbs", HOW_DEMO.meal.carbsG)}${mac("fat", HOW_DEMO.meal.fatG)}</div>`) +
    (prog === null ? "" : step(.8, `<svg viewBox="0 0 68 68" width="68" height="68" aria-hidden="true">` +
      `<path d="${prog.targetKg > prog.startKg ? "M10 46 C26 46 36 24 58 22" : "M10 22 C26 22 36 44 58 46"}" fill="none" stroke="var(--accent)" stroke-width="4" stroke-linecap="round" class="draw" style="--d:1s"/>` +
      `<circle cx="10" cy="${prog.targetKg > prog.startKg ? 46 : 22}" r="4" fill="var(--ink)"/>` +
      `<circle cx="58" cy="${prog.targetKg > prog.startKg ? 22 : 46}" r="5" fill="var(--accent)" stroke="#fff" stroke-width="2"/></svg>`, s3!,
      `<b class="num">${escape(`${weightDisplay(prog.startKg, units, lang)} → ${weightDisplay(prog.targetKg, units, lang)}`)}</b>`)) +
    `</div>`;
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
function baselineCards(profile: Profile, content: OnboardingContent, lang: Lang): string {
  const b = chatCopyFor(lang).baseline;
  const units = profile.units ?? "metric";
  const value = bmi(profile.weight_kg, profile.height_cm);
  const band = value === null ? null
    : value < 18.5 ? "under" : value < 25 ? "healthy" : value < 30 ? "over" : "obese";
  const verdict = band === null ? null : band === "under" ? b.verdict.under
    : band === "healthy" ? b.verdict.healthy : b.verdict.above;
  const at = value === null ? 0 : BMI_AXIS.at(value);
  const age = ageFrom(profile.birth_year);
  // The sex as the sex question labelled it, in this language — "Female", "Weiblich" — never the
  // stored value.
  const label = (id: "sex" | "activity", v: string) =>
    screenOptions(content, id)[v]?.label ?? optionLabel(id, v, lang);
  const who = [profile.sex ? label("sex", profile.sex) : null,
    age === null ? null : `${age} ${chatCopyFor(lang).units.years}`].filter(Boolean).join(" · ");
  const body = profile.height_cm && profile.weight_kg
    ? `${heightText(profile.height_cm, units, lang)} · ${weightDisplay(profile.weight_kg, units, lang)}` : "";
  const row = (icon: string, label: string, text: string) => text === "" ? "" :
    `<div class="card brow"><span class="bt" aria-hidden="true">${icon}</span>` +
    `<div><span>${escape(label)}</span><b>${escape(text)}</b></div></div>`;
  // The badge counts up while the marker slides (1.2 s, both): the whole part through `.count`,
  // the tenth after it in this language's separator.
  const shown = value === null ? "" : numbers(lang)(value);
  const whole = value === null ? 0 : Math.trunc(value);
  const tail = shown.replace(/^\d+/, "");
  const axis = BMI_AXIS.ticks.map((t) =>
    `<span style="left:${BMI_AXIS.at(t)}%">${escape(numbers(lang)(t))}</span>`).join("");
  const meter = value === null ? "" :
    `<div class="card bmeter band-${band}"><div class="bm-r">${escape(b.bmi)}` +
    `<span class="bm-v" aria-label="${escape(shown)}"><span class="count" style="--to:${whole};--d:.5s;animation-duration:1.2s"></span>${escape(tail)}</span></div>` +
    `<div class="bm-ax num" aria-hidden="true">${axis}</div>` +
    `<div class="bm-sc"><span class="bm-k" style="left:${at}%"></span></div>` +
    `<div class="bm-w">${escape(b.bands[band!])}</div></div>` +
    `<div class="bverdict"><b>${escape(verdict!)}</b><span>${escape(b.note)}</span></div>`;
  return `<div class="bstack">${meter + row("🙂", b.you, who) + row("📏", b.body, body)
    + row("🚶", b.activity, profile.activity ? activityWords(content, profile.activity, lang) : "")}</div>`;
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
  content: OnboardingContent,
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
    ? howCards(profile, lang, profile.units ?? "metric")
    : place === "twice" ? twiceCards(lang)
    : place === "baseline" ? baselineCards(profile, content, lang)
    : `<div class="card rel">` +
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
<div class="wmain one q mom"><div class="wcol">
${dash(place, lang, { href: back, label: pageCopyFor(lang).back })}
<div class="igroup">
${say([title])}
${inner}
${ctaLink(continueHref, copy.continueLabel)}
</div>
</div></div>`;
  return shell("eait", body, lang, "ob");
}
