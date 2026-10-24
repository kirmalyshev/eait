// The two beat cards inside the W2 walk — `baseline` (the BMI the typed height and weight
// compute) after the weight, and `prelim` (the mid-journey plan: burn vs. the number the
// answers produce) after the pace. They collect nothing, so they are GET pages the redirect
// names (`?show=`), not POST handlers of their own: Continue is a link back into the walk.

import {
  bmi, BMI_AXIS, chatCopyFor, explainTargets, fill, kcalNumbers, numbers,
} from "@eait/shared";
import type { Lang, Profile } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { ctaLink, dash, say, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/**
 * `baseline` — the BMI the typed height and weight compute on the WHO band bar, the band's own
 * range label under it, and the one-line "what this is" the copy carries. Computed here from the
 * profile and never stored; a profile missing either number draws the title only.
 */
function baselineCards(profile: Profile, lang: Lang): string {
  const b = chatCopyFor(lang).baseline;
  const value = bmi(profile.weight_kg, profile.height_cm);
  const band = value === null ? null
    : value < 18.5 ? "under" : value < 25 ? "healthy" : value < 30 ? "over" : "obese";
  const at = value === null ? 0 : BMI_AXIS.at(value);
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
    `<div class="bm-w">${escape(b.bands[band!])}</div></div>`;
  return `<div class="bstack">${meter}` +
    `<p class="muted-sub cen">${escape(b.what)}</p></div>`;
}

/**
 * `prelim` — the mid-journey plan as two rows: "You burn" (the maintenance number the answers
 * produce — `basis.tdee`, rest plus the days' own activity) against "You eat" (the plan's kcal),
 * with the signed gap named as the pace. `explainTargets` is the one path a kcal target may come
 * from, so the card reads it like every other plan surface. A flat-band profile has no burn to
 * split, and draws the plan's row only.
 */
function prelimCards(profile: Profile, lang: Lang): string {
  const p = chatCopyFor(lang).prelim;
  const { targets, basis } = explainTargets(profile, new Date());
  const kn = kcalNumbers(lang);
  const signed = (x: number): string =>
    (Math.round(x) < 0 ? "−" : Math.round(x) > 0 ? "+" : "") + kn(Math.abs(Math.round(x)));
  const row = (label: string, figure: string) =>
    `<div class="card brow"><div><span>${escape(label)}</span>` +
    `<b class="num">${escape(figure)} <small>${escape(p.perDay)}</small></b></div></div>`;
  const burn = basis.tdee === null ? "" : row(p.burn, `≈${kn(basis.tdee)}`);
  const eat = row(p.eat, kn(targets.kcal));
  const gap = basis.tdee === null ? ""
    : `<p class="muted-sub cen">${escape(fill(p.gap, { delta: signed(targets.kcal - basis.tdee) }))}</p>`;
  return `<div class="bstack">${burn}${eat}${gap}</div>`;
}

/** An interstitial — the two beats between the questions. GET, not POST: they collect nothing,
 *  so the Continue is a link back into the walk. */
export function interstitial(
  place: "baseline" | "prelim",
  profile: Profile,
  lang: Lang,
  continueHref: string,
  back: string,
): string {
  const copy = chatCopyFor(lang);
  const inner = place === "baseline" ? baselineCards(profile, lang) : prelimCards(profile, lang);
  const title = place === "baseline" ? copy.baseline.title
    : profile.goal === "maintain"
      ? fill(copy.prelim.keepTitle, { burn: kcalNumbers(lang)(explainTargets(profile, new Date()).basis.tdee ?? 0) })
      : copy.prelim.title;
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
