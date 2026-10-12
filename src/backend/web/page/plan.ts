import {
  answerLabel, fill, kcalNumbers, promptById, LANG_LABEL, maintainRange, LANGS_READY, PLAN_TIMELINE, PLAN_WATERFALL, planBalance, planCopyFor,
  planJourney, planWaterfall, projectionMonth, spellUnit, weightDisplay,
  wholeNumbers, youCopyFor,
  type FoodTargets, type GoalProjection, type Lang, type OnboardingContent, type Profile,
  type TargetBasis,
} from "@eait/shared";
import { dash, IMG_URL_DIR, wtop } from "./board.ts";
import { pageCopyFor } from "../copy.ts";
import { escape, shell } from "./shell.ts";

/** The plan reveal (#402, restyled for ieat-app#2050): the loader, the goal, the cards, Continue — every figure the engine's. */
export interface PlanView {
  profile: Profile;
  targets: FoodTargets;
  basis: TargetBasis;
  /** `projectGoal`'s answer — null draws no journey (maintain, the flat band, no arrival). */
  projection: GoalProjection | null;
  /** `onboardingContent` — the kcal label and the macro names. */
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

const T = PLAN_TIMELINE;
/** A signed kcal delta with no thousands separator, like every kcal figure. */
const signedKcal = (lang: Lang) => (x: number): string => (Math.round(x) < 0 ? "−" : "+") + kcalNumbers(lang)(Math.abs(x));
const sec = (n: number): string => `${+n.toFixed(2)}s`;

export function plan(v: PlanView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const COPY = planCopyFor(v.lang);
  const maintain = v.profile.goal === "maintain";
  const arrives = !maintain && v.projection !== null && !v.projection.beyondHorizon;
  const bars = maintain ? null : planWaterfall(v.basis, v.targets.kcal);
  const balance = maintain ? planBalance(v.basis, v.targets.kcal) : null;
  const left = arrives ? journeyCard(v, COPY) : balance ? balanceCard(v, COPY, balance) : "";
  const goal = goalWords(v, COPY);
  const headline = maintain
    ? fill(COPY.goalStay, { kg: weightDisplay(v.profile.weight_kg!, v.profile.units, v.lang) })
    : goal ? fill(v.profile.goal === "gain" ? COPY.goalGain : COPY.goalLose, goal)
    : v.content.summary.lines[0] ?? "";

  // Everything on the page plays AFTER the loader (17): one offset, added to every delay.
  return shell(PAGE_COPY.titlePlan, `${wtop()}
${loader(v, COPY, goal)}
<div class="wmain one pw"><div class="wcol">
<div class="pln rv ldg" style="--ld:${sec(LOADER_S)}">
${dash("summary", v.lang)}
<div class="ok rise" style="--d:.05s"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
<h1 class="hd rise" style="--d:.15s">${escape(headline)}</h1>
<div class="pgrid${left ? "" : " solo"}">
${left}
<div class="pcol">
${everyDayCard(v, COPY)}
${infoCard(v, COPY, goal)}
${reachCard(v, COPY)}
<details class="howc"><summary class="t13 m">ⓘ ${escape(COPY.howCalc)}</summary>
${bars ? waterfallCard(v, bars) : ""}
<p class="t12 m pmeth">${escape(COPY.method)}<br>${escape(COPY.methodSource)}</p>
</details>
</div>
</div>
<div class="pfoot"><a class="cta p rise" href="${escape(v.next)}" style="--d:.9s">${escape(PAGE_COPY.continueLabel)}</a></div>
${v.hasWebApp ? "" : languagePicker(v.lang)}
</div>
</div></div>
`, v.lang, "ob");
}

/** How long the loader (17) holds the page: the ring's fill, the captions rolling under it. */
const LOADER_S = 5.5;

/** The goal's distance and month — null when the plan does not arrive (maintain, past the horizon). */
function goalWords(v: PlanView, COPY: ReturnType<typeof planCopyFor>): { kg: string; month: string } | null {
  const p = v.profile;
  if (p.goal === "maintain" || v.projection === null || v.projection.beyondHorizon) return null;
  if (p.weight_kg == null || p.target_weight_kg == null) return null;
  return {
    kg: weightDisplay(Math.abs(p.weight_kg - p.target_weight_kg), p.units, v.lang),
    month: projectionMonth(new Date(), v.projection.weeks, v.lang),
  };
}

/**
 * The loader (17): the ring fills 0 → 100 % over `LOADER_S` while the computed numbers roll under
 * it, then it lifts off the plan. Its reader is the plan itself — every figure is the engine's,
 * the same ones the cards below draw. No people counter (Kirill, ieat-app#2050). Under Reduce
 * Motion it is not drawn at all: the plan is the resting state.
 */
function loader(v: PlanView, COPY: ReturnType<typeof planCopyFor>, goal: { kg: string; month: string } | null): string {
  const s = v.content.summary;
  const n = wholeNumbers(v.lang);
  const gram = spellUnit(v.lang, "g");
  const rows = [
    [v.content.building.rows.calories, `${kcalNumbers(v.lang)(v.targets.kcal)}${spellUnit(v.lang, "kcal")}`],
    [s.macros.protein, `${n(v.targets.protein_g)}${gram}`],
    [s.macros.carbs, `${n(v.targets.carbs_g)}${gram}`],
    [s.macros.fat, `${n(v.targets.fat_g)}${gram}`],
    ...(goal ? [[COPY.target, fill(v.profile.goal === "gain" ? COPY.targetGain : COPY.targetLose, goal)]] : []),
  ];
  const caps = rows.map(([k, val]) => `<p>${escape(k!)} · <b>${escape(val!)}</b></p>`).join("");
  return `<div class="ld" aria-hidden="true" style="--t:${sec(LOADER_S)};--rows:${rows.length}">
<div class="ring"><svg viewBox="0 0 150 150"><circle class="t" cx="75" cy="75" r="65"/><circle class="f" cx="75" cy="75" r="65"/></svg>
<div class="pct"><span class="count" style="--to:100"></span><small>%</small></div></div>
<h2>${escape(v.content.building.lines[0] ?? COPY.building)}</h2>
<div class="cap"><div style="animation-timing-function:steps(${rows.length - 1},end)">${caps}</div></div>
</div>`;
}

/** Every day (18): the kcal box and the three macros, every figure the engine's. */
function everyDayCard(v: PlanView, COPY: ReturnType<typeof planCopyFor>): string {
  const summary = v.content.summary;
  const n = wholeNumbers(v.lang);
  const gram = spellUnit(v.lang, "g");
  const tile = (icon: string, figure: string, label: string) =>
    `<div><i class="ico i-${icon}"></i><b class="num">${escape(figure)}</b><span>${escape(label)}</span></div>`;
  return `<div class="card ed rise" style="--d:.5s"><p class="ct">${escape(COPY.everyDay)}</p><p class="cs">${escape(COPY.changeAnytime)}</p>
<div class="kcb"><span class="tile"><i class="ico i-kcal"></i></span><div><b class="count num" style="--to:${Math.round(v.targets.kcal)};--d:.6s;animation-duration:1.2s"></b><span>${escape(summary.kcalLabel)}</span></div></div>
<div class="mt">${tile("protein", `${n(v.targets.protein_g)}${gram}`, summary.macros.protein)}${tile("carbs", `${n(v.targets.carbs_g)}${gram}`, summary.macros.carbs)}${tile("fat", `${n(v.targets.fat_g)}${gram}`, summary.macros.fat)}</div>
</div>`;
}

/** Your info (18b): the answers the plan was computed from, said back. */
function infoCard(v: PlanView, COPY: ReturnType<typeof planCopyFor>, goal: { kg: string; month: string } | null): string {
  const p = v.profile;
  const n = wholeNumbers(v.lang);
  const activityPrompt = promptById("activity");
  const activity = activityPrompt ? answerLabel(activityPrompt, p, { content: v.content, lang: v.lang }) : null;
  const row = (glyph: string, label: string, value: string | null) => value === null ? "" :
    `<div class="pir"><span class="pg" aria-hidden="true">${glyph}</span><div><span>${escape(label)}:</span> ${escape(value)}</div></div>`;
  const satfat = v.targets.satfat_g;
  return `<div class="card rise" style="--d:.7s"><p class="ct">${escape(COPY.infoTitle)}</p><div class="pib">
${row("👤", COPY.startWeight, p.weight_kg != null ? weightDisplay(p.weight_kg, p.units, v.lang) : null)}
${row("🚩", COPY.goalWeight, p.goal !== "maintain" && p.target_weight_kg != null ? weightDisplay(p.target_weight_kg, p.units, v.lang) : null)}
${row("🚶", COPY.activity, activity)}
${row("🎯", COPY.target, goal ? fill(p.goal === "gain" ? COPY.targetGain : COPY.targetLose, goal) : null)}
${row("🧈", COPY.satFat, satfat !== undefined && satfat !== null ? `≤ ${n(satfat)}${spellUnit(v.lang, "g")}` : null)}
</div></div>`;
}

/** How to reach your goal (18b): four habits, the kcal one carrying the day's real target. */
function reachCard(v: PlanView, COPY: ReturnType<typeof planCopyFor>): string {
  const step = (tile: string, text: string) => `<div class="sr"><span class="ti">${tile}</span>${escape(text)}</div>`;
  return `<div class="card rise" style="--d:.8s"><p class="ct">${escape(COPY.reachTitle)}</p><div class="st">
${step(`<img src="${IMG_URL_DIR}/salmon-sq.webp" alt="">`, COPY.stepPhoto)}
${step(`<i class="ico i-kcal"></i>`, fill(COPY.stepKcal, { kcal: kcalNumbers(v.lang)(v.targets.kcal) }))}
${step(`<span class="tri"><i class="ico i-protein"></i><i class="ico i-carbs"></i><i class="ico i-fat"></i></span>`, COPY.stepBalance)}
${step(`<svg viewBox="0 0 44 44" width="30" height="30" aria-hidden="true"><path d="M6 14 C18 14 24 30 38 31" fill="none" stroke="var(--accent)" stroke-width="3" stroke-linecap="round"/></svg>`, COPY.stepWeigh)}
</div></div>`;
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


/** The title and the curve with its date axis (`planJourney`); lose falls, gain rises. */
function journeyCard(v: PlanView, COPY: ReturnType<typeof planCopyFor>): string {
  const p = v.profile;
  const projection = v.projection!;
  const from = weightDisplay(p.weight_kg!, p.units, v.lang);
  const to = weightDisplay(p.target_weight_kg!, p.units, v.lang);
  const j = planJourney(p.goal === "gain" ? "gain" : "lose", new Date(), projection.weeks, v.lang, to.length);
  const aria = `${from} → ${to}`;
  const ticks = j.ticks.map((t) => {
    const label = t.kind === "today" ? COPY.today : t.label;
    const anchor = t.kind === "today" ? "" : t.kind === "end" ? ` text-anchor="end"` : ` text-anchor="middle"`;
    const x = t.kind === "end" ? j.end.x : t.x;
    const line = t.kind === "month"
      ? `<line class="fade" style="--d:${sec(t.delay)}" x1="${t.x}" x2="${t.x}" y1="${j.tickY[0]}" y2="${j.tickY[1]}" stroke="var(--line)"/>`
      : "";
    return `${line}<text class="fade ax${t.kind === "end" ? " end" : ""}" style="--d:${sec(t.delay)}" x="${x}" y="${j.axisY}"${anchor}>${escape(label)}</text>`;
  }).join("");
  return `<div class="card jc rise" style="--d:.3s">
<p class="ct">${escape(COPY.weightTitle)}</p>
<div class="jg"><svg class="pgraph" viewBox="${j.viewBox}" width="100%" role="img" aria-label="${escape(aria)}">
<defs><linearGradient id="pj" x1="0" y1="0" x2="0" y2="1"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.18"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></linearGradient></defs>
<path d="${j.areaPath}" fill="url(#pj)" class="fade" style="--d:${sec(T.fill.delay)};animation-duration:${sec(T.fill.duration)}"/>
<path d="${j.linePath}" pathLength="1" class="ln draw1" style="--d:${sec(T.curve.delay)}"/>
<circle cx="${j.start.x}" cy="${j.start.y}" r="6" fill="var(--ink)" stroke="var(--surface)" stroke-width="2.5"/>
<text x="${j.start.x}" y="${j.start.labelY}" class="ink15">${escape(from)}</text>
<circle cx="${j.end.x}" cy="${j.end.y}" r="7" fill="var(--accent)" stroke="var(--surface)" stroke-width="3" class="pop" style="--d:${sec(T.targetDot)}"/>
<g class="rise" style="--d:${sec(T.targetPill)}"><rect x="${j.pill.x}" y="${j.pill.y}" width="${j.pill.width}" height="${j.pill.height}" rx="14" fill="var(--accent)"/><text x="${j.pill.textX}" y="${j.pill.textY}" text-anchor="middle" class="pill">${escape(to)}</text></g>
${ticks}
</svg></div>
</div>`;
}

/** Maintain: "You burn" (at rest | your days) and "Your plan" grown to the same length, an ink tick where they meet. */
function balanceCard(v: PlanView, COPY: ReturnType<typeof planCopyFor>, b: NonNullable<ReturnType<typeof planBalance>>): string {
  const YOU = youCopyFor(v.lang).phone;
  const kn = kcalNumbers(v.lang);
  const sn = signedKcal(v.lang);
  const [dRest, dDays] = T.maintain.burn;
  const pct = (x: number) => `${+(x * 100).toFixed(2)}%`;
  const seg = (flex: number, delay: number, dur: number, cls: string, text: string) =>
    `<i class="gx ${cls}" style="--d:${sec(delay)};animation-duration:${sec(dur)};flex:${flex}">${escape(text)}</i>`;
  return `<div class="card jc">
<b class="d d22 goal">${escape(fill(COPY.goalStay, { kg: weightDisplay(v.profile.weight_kg!, v.profile.units, v.lang) }))}</b>
<div class="t13 m">${escape(fill(COPY.goalRange, { range: maintainRange(v.profile.weight_kg!, v.profile.units, v.lang) }))}</div>
<div class="bal">
<span class="t13 semi">${escape(COPY.youBurn)}</span>
<div class="brow" style="width:${pct(b.share.burn)}">${seg(b.burn.rest, dRest, 0.6, "rest", kn(b.burn.rest))}${seg(b.burn.days, dDays, 0.3, "days", sn(b.burn.days))}</div>
<span class="t13 semi">${escape(COPY.yourPlan)}</span>
<div class="brow" style="width:${pct(b.share.plan)}">${seg(1, T.maintain.plan, 1, "plan", kn(v.targets.kcal))}</div>
<i class="pop tick" style="--d:${sec(T.maintain.tick)};left:${pct(b.share.burn)}"></i>
</div>
<span class="sr">${escape(YOU.atRest)} ${escape(kn(b.burn.rest))} ${escape(YOU.yourDays)} ${escape(sn(b.burn.days))}</span>
</div>`;
}

/** How we got there: at rest, your days, your pace, your plan — to scale from 0, summing to the plan. */
function waterfallCard(v: PlanView, bars: NonNullable<ReturnType<typeof planWaterfall>>): string {
  const YOU = youCopyFor(v.lang).phone;
  const COPY = planCopyFor(v.lang);
  const kn = kcalNumbers(v.lang);
  const sn = signedKcal(v.lang);
  const W = PLAN_WATERFALL;
  const names = { rest: YOU.atRest, days: YOU.yourDays, pace: YOU.yourPace, plan: COPY.yourPlan };
  const aria = bars.map((b) => `${names[b.id]} ${b.id === "plan" || b.id === "rest" ? kn(b.value) : sn(b.value)}`).join(", ");
  const parts = bars.map((b, i) => {
    const plan = b.id === "plan";
    const fill_ = plan ? "var(--accent)" : b.id === "rest" ? "var(--line)"
      : b.id === "days" ? `var(--accent)" fill-opacity=".32` : b.down ? `var(--care)" fill-opacity=".22` : `var(--accent)" fill-opacity=".18`;
    const tone = plan ? "var(--ink)" : b.id === "rest" ? "var(--ink)" : b.id === "days" || !b.down ? "var(--accent)" : "var(--care)";
    const text = b.id === "rest" || plan ? kn(b.value) : sn(b.value);
    const dur = plan ? ` animation-duration:.5s` : "";
    const next = bars[i + 1];
    const step = next && i < 2
      ? `<line class="fade" style="--d:${sec(b.delay)}" x1="${b.x + W.width}" x2="${next.x}" y1="${b.level}" y2="${b.level}" stroke="var(--line)" stroke-dasharray="2 2"/>`
      : "";
    return `<rect class="gy${b.down ? " dn" : ""}" style="--d:${sec(b.delay)};${dur}" x="${b.x}" y="${+b.y.toFixed(1)}" width="${W.width}" height="${+b.height.toFixed(1)}" rx="6" fill="${fill_}"/>
<text class="fade fig${plan ? " big" : ""}" style="--d:${sec(b.delay + T.figure)};fill:${tone}" x="${b.x + W.width / 2}" y="${+b.labelY.toFixed(1)}" text-anchor="middle">${escape(text)}</text>${step}
<text x="${b.x + W.width / 2}" y="${W.labelBaseline}" text-anchor="middle"${plan ? ` class="ink"` : ""}>${escape(names[b.id])}</text>`;
  }).join("\n");
  return `<div class="card wc"><span class="lab">${escape(YOU.basisTitle)}</span>
<div class="wg"><svg class="pgraph" viewBox="${W.viewBox}" width="100%" role="img" aria-label="${escape(aria)}"><line x1="2" x2="318" y1="${W.baseline}" y2="${W.baseline}" stroke="var(--hair)"/>
${parts}
</svg></div>
</div>`;
}
