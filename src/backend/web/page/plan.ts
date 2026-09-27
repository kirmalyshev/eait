import {
  capNote, chatCopyFor, estimateChart, LANG_LABEL, LANGS_READY, planHeadline, projectionMonth,
  spellUnit, weightDisplay, wholeNumbers,
  type FoodTargets, type GoalProjection, type Lang, type OnboardingContent,
  type Profile, type TargetBasis,
} from "@eait/shared";
import { ctaLink, dash, say, wtop } from "./board.ts";
import { spudSvg } from "@eait/shared/mascot";
import { pageCopyFor } from "../copy.ts";
import { escape, shell } from "./shell.ts";

/**
 * The plan (board `onboarding/web/15-plan.html`), drawn for W3 (issue #90):
 *
 *   the walk's dash, all of it behind now      — `dash("summary")`: the plan IS the last segment
 *   the say-line                               — the summary block's own words, Spud at 28 px
 *   "Goal: lose 6 kg by January 2027"          — `planHeadline`, THE S6-exempt sentence, and the
 *                                                reason this file is on claims.test.ts's caller
 *                                                list: the only claim-shaped line, computed
 *   the estimated-progress graph               — `estimateChart`'s geometry verbatim (the #112
 *                                                chip position), its labels localized
 *   "1,434 kcal a day"                         — the computed target, never a typed number
 *   the macro row                              — protein/carbs/fat always, and saturated fat
 *                                                ONLY when it was asked for: the card is drawn
 *                                                because the cap was declared, so an undeclared
 *                                                profile shows nothing
 *   Continue                                   — the sign-up is next (S8)
 *
 * Gone with the old card: the arithmetic breakdown (that disclosure belongs to the pace
 * question's Why), the get-the-app paragraph (the web application IS the app), the chat link and
 * the Telegram controls — none of them are on the board, and the board is the design.
 */

export interface PlanView {
  profile: Profile;
  targets: FoodTargets;
  basis: TargetBasis;
  /** `projectGoal`'s answer — null means no projection, and no graph card (horizon or no goal). */
  projection: GoalProjection | null;
  /** `onboardingContent` — the say-line, the macro labels, the marker and its note. */
  content: OnboardingContent;
  /** Where Continue goes — `/start/signup`. */
  next: string;
  /**
   * The language picker is drawn ONLY where there is no web application to hold the account's
   * language (#423): without one this page is the only place to change it, and dropping the
   * control would strand it.
   */
  hasWebApp: boolean;
  lang: Lang;
}

const fill = (template: string, params: Record<string, string>): string =>
  template.replace(/\{(\w+)\}/g, (whole, key: string) => params[key] ?? whole);

export function plan(v: PlanView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const CHAT = chatCopyFor(v.lang);
  const summary = v.content.summary;
  const n = wholeNumbers(v.lang);
  const today = new Date();
  const units = v.profile.units ?? "metric";

  // THE HEADLINE IS THE EXEMPTION (S6): the only sentence on this page the claims gate would
  // otherwise refuse — "lose 6 kg by January 2027" is claim-shaped. `planHeadline` is the shared
  // computation, and this file's call to it is what claims.test.ts's caller list guards.
  const headline = planHeadline(v.profile, today, units, v.lang);

  // The estimate graph rides on a projection that lands inside the horizon — a maintain goal
  // draws no card (there is nowhere to arrive), and "80 weeks away" names no month.
  const chart = v.projection === null || v.projection.beyondHorizon ? "" : chartCard(
    v.profile, v.projection, CHAT, summary, v.lang,
  );

  // The marker is drawn when the share cap or the floor decided the number — the line is the
  // flag, and its note sits one tap behind, unspoken until asked for (DIRECTION §5's "why").
  let marker = "";
  if (v.basis.shareCapApplied || v.basis.floorApplied) {
    const note = v.basis.floorApplied
      ? `<b>${escape(v.content.building.floorTitle)}</b> ${escape(fill(v.content.building.floorBody, { floor: n(v.basis.floorKcal) }))}`
      : escape(capNote(summary.capNote, v.profile.goal, v.projection?.kgPerWeek ?? null, v.lang));
    marker = `<details class="est-more"><summary class="est">${escape(fill(summary.floorMarker, { floor: n(v.basis.floorKcal) }))}</summary><p class="est-note">${note}</p></details>`;
  }

  const gram = spellUnit(v.lang, "g");
  const macros = [
    { icon: "protein", value: `${n(v.targets.protein_g)} ${gram}`, label: summary.macros.protein },
    { icon: "carbs", value: `${n(v.targets.carbs_g)} ${gram}`, label: summary.macros.carbs },
    { icon: "fat", value: `${n(v.targets.fat_g)} ${gram}`, label: summary.macros.fat },
    // "Saturated fat · you asked" — the label is literal about it: the card exists because the
    // cap was DECLARED (`targets.satfat_g` is set exactly then), never for a profile that did
    // not ask. `planRows` holds the same rule for the reveal's rows.
    ...(v.targets.satfat_g !== undefined && v.targets.satfat_g !== null
      ? [{ icon: "satfat", value: `${n(v.targets.satfat_g)} ${gram}`, label: summary.macros.satfat }]
      : []),
  ];

  return shell(PAGE_COPY.titlePlan, `${wtop()}
<div class="wmain one"><div class="wcol">
<div class="pln">
${dash("summary", v.lang)}
${say("happy", summary.lines, v.lang)}
${headline ? `<p class="goal num">${escape(headline)}</p>` : ""}
${chart}
<div class="kgrid">
  <div class="card kcal">
    <div class="big"><i class="ico i-kcal"></i><b class="num">${n(v.targets.kcal)}</b> <small>${escape(summary.kcalLabel)}</small></div>
    ${marker}
  </div>
${macros.map((m) => `  <div class="mcard"><i class="ico i-${m.icon}"></i><b class="num">${escape(m.value)}</b><small>${escape(m.label)}</small></div>`).join("\n")}
</div>
${ctaLink(v.next, PAGE_COPY.continueLabel)}
${v.hasWebApp ? "" : languagePicker(v.lang)}
</div>
</div></div>
`, v.lang, "ob");
}

/**
 * The plan page is `/start`'s settings: it is the one page somebody comes back to, and the only
 * one with anything else to change on it. It writes through `PATCH /v1/profile` like every other
 * surface — `POST /start/language` is a form handler that calls `patchProfile`, not a second
 * endpoint and not a second source of truth. There is no JavaScript on these pages, so a submit
 * button is the control; a `<select>` that saved on change would need one.
 *
 * ONLY `LANGS_READY` IS OFFERED. A language the app cannot render end to end is one whose every
 * screen would be English, and choosing it looks like a bug rather than like a missing translation.
 *
 * The OPTION LABELS are `LANG_LABEL` — each language's name in itself, never translated, because a
 * list of languages written in the one you are trying to leave is the one list you cannot read.
 */
function languagePicker(lang: Lang): string {
  const PAGE_COPY = pageCopyFor(lang);
  const options = LANGS_READY.map((code) =>
    `<option value="${escape(code)}"${code === lang ? " selected" : ""}>${escape(LANG_LABEL[code])}</option>`,
  ).join("");
  return `<h2>${escape(PAGE_COPY.languageLabel)}</h2>
<form method="post" action="/start/language">
  <select name="lang" aria-label="${escape(PAGE_COPY.languageLabel)}">${options}</select>
  <button type="submit" class="cta s">${escape(PAGE_COPY.languageSave)}</button>
</form>`;
}

/**
 * The estimate graph card (15-plan): the area, the curve drawing itself, the end dot's pop, the
 * target chip's rise — the delays are the board's own (.6 s area, 1.1 s dot, 1.2 s chip) over the
 * shared verbs. EVERY number is the profile's: start weight, target weight, the month the
 * projection lands on. The geometry is `estimateChart`'s — #112's chip fix included — verbatim.
 */
function chartCard(
  p: Profile,
  projection: GoalProjection,
  CHAT: ReturnType<typeof chatCopyFor>,
  summary: OnboardingContent["summary"],
  lang: Lang,
): string {
  const direction = p.goal === "gain" ? "gain" : "lose";
  const g = estimateChart(direction);
  const month = projectionMonth(new Date(), projection.weeks, lang);
  const from = weightDisplay(p.weight_kg!, p.units, lang);
  const to = weightDisplay(p.target_weight_kg!, p.units, lang);
  const aria = fill(CHAT.chart.estimateAria, { from, to, month });
  return `<div class="card est-card">
  <div class="row between"><span class="lab">${escape(CHAT.chart.estimatedProgress)}</span><span class="tagx"><span class="wm">${spudSvg("happy", "spud-tag")}</span>${escape(CHAT.chart.byEait)}</span></div>
  <svg class="pgraph" viewBox="${g.viewBox}" role="img" aria-label="${escape(aria)}">
    <defs><linearGradient id="pgf" x1="0" y1="0" x2="0" y2="1">${g.areaGradient.stops.map((s) => `<stop offset="${s.offset}" style="stop-color:var(--accent);stop-opacity:${s.opacity}"/>`).join("")}</linearGradient></defs>
    <line x1="${g.baseline.x1}" y1="${g.baseline.y}" x2="${g.baseline.x2}" y2="${g.baseline.y}" stroke="var(--hair)"/>
    <path d="${g.areaPath}" fill="url(#pgf)" class="rise" style="--d:.6s"/>
    <path d="${g.linePath}" class="ln draw"/>
    <circle cx="${g.startDot.cx}" cy="${g.startDot.cy}" r="${g.startDot.r}" fill="var(--ink)"/>
    <circle cx="${g.endDot.cx}" cy="${g.endDot.cy}" r="${g.endDot.r}" fill="var(--accent)" stroke="var(--surface)" stroke-width="${g.endDot.strokeWidth}" class="pop" style="--d:1.1s"/>
    <g class="rise" style="--d:1.2s"><rect x="${g.targetChip.x}" y="${g.targetChip.y}" width="${g.targetChip.width}" height="${g.targetChip.height}" rx="${g.targetChip.rx}" fill="var(--ink)"/><text x="${g.targetChip.textX}" y="${g.targetChip.textY}" text-anchor="middle" fill="#fff" style="font-size:14px;font-weight:700">${escape(fill(CHAT.chart.target, { weight: to }))}</text></g>
    <text x="${g.startLabel.x}" y="${g.startLabel.y}" style="fill:var(--ink);font-weight:600">${escape(from)}</text>
    <text x="${g.nowLabel.x}" y="${g.nowLabel.y}">${escape(CHAT.chart.now)}</text>
    <text x="${g.monthLabel.x}" y="${g.monthLabel.y}" text-anchor="end" style="fill:var(--ink);font-weight:600">${escape(fill(CHAT.chart.monthEstimate, { month }))}</text>
  </svg>
  <div class="row between est-foot"><span>${escape(CHAT.chart.estimate)}</span><span class="num">${escape(from)} → ${escape(to)}</span></div>
</div>`;
}
