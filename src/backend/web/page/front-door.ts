import type { Lang, OnboardingContent } from "@eait/shared";
import { fill, kcalNumbers, LANG_FLAG, LANG_LABEL, LANGS_READY, spellUnit } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

/** The kcal figure the photo's estimate lands on — the alt text's "{kcal}" reads it (#141). */
export const WELCOME_DEMO_KCAL = 281;

/** The photo's three macro figures, beside `WELCOME_DEMO_KCAL`. */
const WELCOME_CHIPS = { protein: 11, carbs: 43, fat: 4 } as const;

/**
 * The front door (01, ieat-app#2050): the full-bleed photo with the viewfinder, a shutter and a
 * scan once, then the four estimate chips one by one — the product's loop, drawn in CSS — and
 * the headline with the two doors under it. Under Reduce Motion it is the last frame: the photo
 * with its four chips. The figures are the photo's own, fixed; the labels are the content's.
 */
export function frontDoor(
  content: OnboardingContent,
  hrefs: { q: string; signup: string },
  lang: Lang,
): string {
  const PAGE_COPY = pageCopyFor(lang);
  const welcome = content.welcome;
  const kcal = kcalNumbers(lang)(WELCOME_DEMO_KCAL);
  const alt = escape(fill(PAGE_COPY.welcomeDemoAlt, { kcal }));
  const g = spellUnit(lang, "g");
  const chip = (pos: string, d: number, tone: string, icon: string, label: string, figure: string, unit: string) =>
    `<div class="wchip" style="${pos};--d:${d}s"><span class="tile ${tone}"><i class="ico i-${icon}"></i></span>` +
    `<div><span>${escape(label)}</span><b class="num">${escape(figure)}<small>${escape(unit)}</small></b></div></div>`;
  const m = content.summary.macros;
  const [title = "", ...subs] = welcome.lines;
  return shell(PAGE_COPY.titleStart, `
${wtop()}
<div class="wcenter"><div class="wdemo">
  <div class="wherobox">
  ${langChip(lang, PAGE_COPY.languageLabel)}
  <div class="whero" role="img" aria-label="${alt}">
    <div class="ph"></div><div class="vf"><i></i><i></i><i></i><i></i></div>
    <div class="sh"></div><div class="fl"></div><div class="sw"></div>
    ${chip("left:7%;top:17%", 2.15, "p", "protein", m.protein, String(WELCOME_CHIPS.protein), g)}
    ${chip("right:6%;top:23%", 2.35, "c", "carbs", m.carbs, String(WELCOME_CHIPS.carbs), g)}
    ${chip("left:5%;top:42%", 2.55, "f", "fat", m.fat, String(WELCOME_CHIPS.fat), g)}
    ${chip("right:6%;top:51%", 2.75, "", "kcal", content.building.rows.calories, kcal, spellUnit(lang, "kcal"))}
  </div>
  </div>
  <div class="whead">
    <div><h1>${escape(title)}</h1>${subs.map((l) => `<p class="wsub">${escape(l)}</p>`).join("")}</div>
    <div class="wctas">
      <a class="cta p" href="${escape(hrefs.q)}">${escape(welcome.cta)} <span aria-hidden="true">→</span></a>
      <a class="wlink" href="${escape(hrefs.signup)}">${escape(welcome.signin)}</a>
    </div>
  </div>
</div></div>
`, lang, "ob");
}

/**
 * The language chip over the photo (ieat-app#2050): "🇺🇸 EN", and a tap opens the list of the
 * languages this surface can render, each in its own name (`LANG_LABEL`, the picker's list). A
 * `<details>`, so it opens with no script; each name is a POST to `/start/language`, which keeps
 * the pick for the account the first answer creates.
 */
function langChip(lang: Lang, label: string): string {
  const options = LANGS_READY.map((code) =>
    `<button type="submit" name="lang" value="${escape(code)}"${code === lang ? ' aria-current="true"' : ""}>` +
    `<span aria-hidden="true">${LANG_FLAG[code]}</span>${escape(LANG_LABEL[code])}</button>`,
  ).join("");
  return `<details class="wlang"><summary aria-label="${escape(`${label}: ${LANG_LABEL[lang]}`)}">` +
    `<span aria-hidden="true">${LANG_FLAG[lang]}</span>${escape(lang.toUpperCase())}</summary>` +
    `<form method="post" action="/start/language" class="wlangs">${options}</form></details>`;
}
