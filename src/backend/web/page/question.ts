// The onboarding question screens — `onboarding/web/01-goal.html … 14b-medical.html`. One file,
// one shape: `say` (Spud beside the ask) + the screen's control + the Continue button, inside the
// shared frame (`board.ts`) and stylesheet (`board-css.ts`).
//
// EVERYTHING HERE POSTS `answer`. The boards' pickers — the wheel, the rulers, the slider — are
// drawn by `data-ctl` markup the one script drives; beneath each sits the plain input that carries
// the same name, so a browser with the script blocked answers the same question through the same
// field (the walk's `?draft=` and the toggle's POST are how a typed value crosses a unit change).

import {
  BANDS, capNote, chatCopyFor, cmToFtIn, fill, heightDisplayValue,
  minHealthyWeightKg, numbers, ONBOARDING_NEUTRAL, paceEcho, pacePreview, PACES, rulerLabels, RULER_TICKS,
  optionLabel, rulerTickPhase, screenOptions, screenOptionValues, spellUnit, suggestedTargetKg,
  targetRange,
  weightDisplay, weightDisplayValue,
} from "@eait/shared";
import type {
  ChatPrompt, Lang, OnboardingContent, OnboardingPlace, OnboardingScreenId, Profile,
  RulerTicks, UnitSystem,
} from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { backLink, ctaLink, ctaSubmit, dash, hidden, optRow, PLACE_MOOD, say, segToggle, wtop } from "./board.ts";
import { escape, shell } from "./shell.ts";

export interface Action { name: string; value: string; label: string }

export interface QuestionView {
  prompt: ChatPrompt;
  profile: Profile;
  content: OnboardingContent;
  /** The ask's lines — the last is the headline, the ones before a muted lead-in. */
  lines: readonly string[];
  lang: Lang;
  /** The resolved display system — `profile.units`, else the browser's region default. */
  units: UnitSystem;
  error: string | null;
  actions: readonly Action[];
  /** The form's POST target — `/start/q` carrying the `?asked=` marks. */
  action: string;
  /** The same target for the unit toggle's own POST beside the form. */
  segAction: string;
  /** The stored answer, when a question re-renders to change it (`?edit=`). */
  current: readonly string[];
  /** A typed-but-uncommitted value carried across a unit toggle — already metric. */
  draft: number | null;
  /** Back's target (#53) — the previous question's `?edit=` link, or the front door for the first. */
  back: string;
  today: Date;
}

/** The page scaffold every question shares: dash → say → (error) → [seg] → form. */
function page(v: QuestionView, opts: { seg?: string; control: string; foot?: string; echo?: string | null }): string {
  const copy = chatCopyFor(v.lang);
  const error = v.error
    ? `<p class="notice" id="answer-error" role="alert">${escape(v.error)}</p>` : "";
  const actions = v.actions.map((a) =>
    `<button class="cta s" type="submit" name="${escape(a.name)}" value="${escape(a.value)}">${escape(a.label)}</button>`,
  ).join("");
  const body = `${wtop()}
<div class="wmain one q"><div class="wcol">
${dash(v.prompt.place, v.lang)}
${backLink(v.back, pageCopyFor(v.lang).back)}
${say(PLACE_MOOD[v.prompt.place] ?? "happy", v.lines, v.lang)}
${opts.echo ? `<p class="t13 m qecho">${escape(opts.echo)}</p>` : ""}
${error}
${opts.seg ?? ""}
<form class="qform" method="post" action="${escape(v.action)}" novalidate>
${hidden("prompt", v.prompt.id)}${hidden("units", v.units)}
${opts.control}
${actions}
${opts.foot ?? ctaSubmit(copy.continueLabel)}
</form></div></div>`;
  // A question page's title is the product — the question itself is the h1 already on screen.
  return shell("eait", body, v.lang, "ob");
}

// ── The option screens (01 goal · 04 sex · 08 activity · 11 struggles · 14 diet · 14b medical) ──

const TILE_ICON: Record<string, Record<string, string>> = {
  sex: { male: "male", female: "female", other: "other" },
  activity: { few: "few", some: "some", many: "many" },
  struggles: { consistency: "consistency", habits: "habits", support: "support", busy: "busy", ideas: "ideas" },
  diet: {
    balanced: "balanced", wholefood: "wholefood", mediterranean: "mediterranean",
    flexitarian: "flexitarian", pescatarian: "pescatarian", vegetarian: "vegetarian", vegan: "vegan",
  },
};
const GOAL_ICON: Record<string, string> = { lose: "lose", maintain: "keep", gain: "gain" };

function optionControl(v: QuestionView): string {
  const place = v.prompt.place;
  const opts = screenOptions(v.content, place as OnboardingScreenId);
  // `screenOptionValues` is the list the prompt does not pin; `optionLabel` names what the
  // content does not label. The content's order is the order.
  const values = [...(v.prompt.options ?? screenOptionValues(place as OnboardingScreenId, v.lang))];
  const chosen = new Set(v.current);
  const multi = v.prompt.kind === "chips";
  if (place === "goal") {
    // Nothing is preselected — the first question's answer is the whole plan's direction, and a
    // quiet default is an answer nobody gave.
    return `<div class="opts c3">` + values.map((o) =>
      `<label class="opt big">` +
      `<input type="radio" name="answer" value="${escape(o)}"${chosen.has(o) ? " checked" : ""}>` +
      `<i class="ico i-${GOAL_ICON[o] ?? "keep"}"></i>` +
      `<span>${escape(opts[o]?.label ?? optionLabel(place as OnboardingScreenId, o, v.lang))}</span>` +
      `<span class="ck"><i class="ico i-check"></i></span></label>`,
    ).join("") + `</div>`;
  }
  // Four workout bands (0 / 1–2 / 3–4 / 5+) lay out as four tiles up — a c3 grid wraps them 3+1.
  const cols = place === "activity" ? 4 : place === "sex" ? 3 : 2;
  return `<div class="opts c${cols}">` + values.map((o) => {
    const c = opts[o];
    if (place === "activity") {
      // The board's three parts: the count reads big, the name is the row's words (`hint`).
      return `<label class="opt"><input type="radio" name="answer" value="${escape(o)}"${chosen.has(o) ? " checked" : ""}>` +
        `<span class="tile"><i class="ico i-${escape(o)}"></i></span>` +
        `<span><b class="d d17 num">${escape(c?.label ?? optionLabel(place as OnboardingScreenId, o, v.lang))}</b>` +
        `${c?.hint ? `<small>${escape(c.hint)}</small>` : ""}</span>` +
        `<span class="ck"><i class="ico i-check"></i></span></label>`;
    }
    return optRow({
      value: o,
      label: c?.label ?? optionLabel(place as OnboardingScreenId, o, v.lang),
      multi,
      icon: TILE_ICON[place]?.[o],
      // A diet answers "no restriction" as `balanced` — the board draws it selected, and storing
      // it and storing nothing mean the same thing to the analyzer.
      checked: chosen.has(o) || (place === "diet" && chosen.size === 0 && o === "balanced"),
    });
  }).join("") + `</div>`;
}

// ── The number screens (05 age · 06 height · 07 weight · 09 target) ────────────────────────────

interface RulerCfg {
  /** The control's own unit — cm | in | kg | lb — and its display-space value/bounds. */
  ticks: RulerTicks;
  val: number; min: number; max: number; step: number;
  /** `ftin` draws the bign as two numerals ("5 ft 8 in") and labels as 5′8″. */
  fmt: "int" | "ftin";
  vertical: boolean;
  /** The word under the big numeral (spelled — `spellUnit` for kg/cm, the copy's for years). */
  smalls: string;
  /** The unit word the live delta and labels speak ("kg" | "lb" | "cm"). */
  unitWord: string;
  /** The target ruler's refused zone and the "now" marker, in the control's own unit. */
  floor?: { at: number; label: string } | undefined;
  now?: { at: number; label: string } | undefined;
  /** The ONE label the floor/now pair merges into when the marks sit within one
      tick (ieat-app#1201) — `target.nowLowest`, drawn at the floor's mark. */
  merged?: string | undefined;
  delta?: { dn: string; up: string } | undefined;
  settle?: boolean | undefined;
  /** `marks` draws the marker labels INSTEAD of the numbered scale — the target board, where the
      "lowest" and "now" words would overprint the numbers. */
  marks?: boolean | undefined;
}

/** A display number on a ruler — integers as integers, halves formatted in the page's language. */
function numfmt(lang: Lang, v: number): string {
  return Math.abs(v % 1) < 1e-9 ? String(Math.round(v)) : numbers(lang)(v);
}

function rulerControl(v: QuestionView, cfg: RulerCfg): string {
  const t = cfg.ticks;
  const tickMinor = `repeating-linear-gradient(${cfg.vertical ? "180deg" : "90deg"},var(--line) 0 1.5px,transparent 1.5px ${t.pxPerUnit}px)`;
  const tickMajor = `repeating-linear-gradient(${cfg.vertical ? "180deg" : "90deg"},var(--ink) 0 1.5px,transparent 1.5px ${t.pxPerUnit * t.majorEvery}px)`;
  // The server draws labels for the window the ruler opens on — the mask hides the edges, so a
  // first drag never pops a label in. The script repaints from the same pitch after that.
  const centre = cfg.vertical ? 190 : 330;
  const halfSpan = (cfg.vertical ? 380 : 660) / 2 / t.pxPerUnit;
  const at = (u: number) => Math.round(centre + (cfg.vertical ? cfg.val - u : u - cfg.val) * t.pxPerUnit);
  const labels = cfg.marks ? "" : rulerLabels(t, Math.ceil(cfg.val - halfSpan), Math.floor(cfg.val + halfSpan))
    .map((lv) => {
      const pos = cfg.vertical ? `top:${at(lv)}px` : `left:${at(lv)}px`;
      return `<span class="lbl" style="${pos}">${escape(cfg.fmt === "ftin" ? t.format(lv) : numfmt(v.lang, lv))}</span>`;
    }).join("");
  const tint = cfg.floor && !cfg.vertical
    ? `<div class="tint" style="width:${Math.max(0, at(cfg.floor.at))}px"></div>`
    : "";
  const markers = !cfg.vertical ? [
    cfg.floor ? `<span class="lbl lo" style="left:${at(cfg.floor.at)}px">${escape(cfg.floor.label)}</span>` : "",
    cfg.now ? `<span class="lbl hi" style="left:${at(cfg.now.at)}px">${escape(cfg.now.label)}</span>` : "",
    // `.mg` waits hidden for the script's `rulerMarkerLayout`: merged shows it
    // alone, stacked drops `.lo` a row, flat leaves it unseen.
    cfg.floor && cfg.merged ? `<span class="lbl mg" style="left:${at(cfg.floor.at)}px;visibility:hidden">${escape(cfg.merged)}</span>` : "",
  ].join("") : "";
  const bign = cfg.fmt === "ftin"
    ? `<div class="bign num"><span class="bv">${cmToFtIn(cfg.val * 2.54).ft}′</span><small>ft</small> ` +
      `<span class="bv bv2">${cmToFtIn(cfg.val * 2.54).in}″</span><small>in</small></div>`
    : `<div class="bign num"><span class="bv">${escape(numfmt(v.lang, cfg.val))}</span><small>${escape(cfg.smalls)}</small></div>`;
  // `hidden` would pin the pill shut for the script, which shows it by style alone — the markup
  // draws the delta the page opened on, empty when the needle sits on `now`.
  const delta = cfg.delta && cfg.now ? cfg.val - cfg.now.at! : 0;
  const live = cfg.delta && cfg.now
    ? `<div class="live${delta < 0 ? " dn" : delta > 0 ? " up" : ""}">${
        delta === 0 ? "" : escape(fill(delta < 0 ? cfg.delta!.dn : cfg.delta!.up, {
          weight: `${numfmt(v.lang, Math.abs(delta))}${cfg.unitWord}`,
        }))}</div>`
    : "";
  // The board's tick scale: a short line per unit, a longer one per `majorEvery` — the vertical
  // ruler runs them 22/40 px deep from its right edge, the horizontal one 22/38 px up from its
  // floor. The script shifts the same two layers by the same phases when the value moves.
  const bg = cfg.vertical
    ? `${tickMinor} 100% ${rulerTickPhase(t, centre, cfg.val)}px/22px 100% no-repeat,` +
      `${tickMajor} 100% ${rulerTickPhase(t, centre, cfg.val, true)}px/40px 100% no-repeat`
    : `${tickMinor} ${rulerTickPhase(t, centre, cfg.val)}px 100%/100% 22px repeat-x,` +
      `${tickMajor} ${rulerTickPhase(t, centre, cfg.val, true)}px 100%/100% 38px repeat-x`;
  const ruler = `<div class="${cfg.vertical ? "vruler" : "ruler"}" role="slider" tabindex="0"` +
    ` aria-label="${escape(v.lines[v.lines.length - 1] ?? "")}"` +
    ` aria-valuemin="${cfg.min}" aria-valuemax="${cfg.max}" aria-valuenow="${cfg.val}"` +
    ` aria-orientation="${cfg.vertical ? "vertical" : "horizontal"}"` +
    ` style="background:${bg}">${tint}${cfg.marks ? "" : `<div class="lbls">${labels}</div>`}${markers}` +
    `<div class="now${cfg.settle ? " settle" : ""}"></div></div>`;
  // The height board pairs the number with its standing ruler (`.vpick`); the weight boards sit
  // the number ABOVE a full-width ruler with the delta pill under it — one row, two layouts.
  return `<div class="ctl" data-ctl="ruler" data-min="${cfg.min}" data-max="${cfg.max}"` +
    ` data-val="${cfg.val}" data-px="${t.pxPerUnit}" data-every="${t.labelEvery}"` +
    ` data-major="${t.majorEvery}" data-step="${cfg.step}" data-fmt="${cfg.fmt}" data-unitword="${escape(cfg.unitWord)}"` +
    (cfg.floor ? ` data-floor="${cfg.floor.at}"` : "") +
    (cfg.now ? ` data-now="${cfg.now.at}"` : "") +
    (cfg.delta ? ` data-dn="${escape(cfg.delta.dn)}" data-up="${escape(cfg.delta.up)}"` : "") +
    `>` +
    (cfg.vertical ? `<div class="vpick">${bign}${ruler}</div>` : `${bign}${ruler}${live}`) +
    `</div>`;
}

/** The plain field every scripted control degrades to — the same `answer` name, always posted. */
function numAlt(v: QuestionView, input: string, unitWord: string, labelled = "answer"): string {
  const q = v.lines[v.lines.length - 1] ?? "";
  return `<div class="numalt"><label class="lab" for="${labelled}">${escape(q)}</label>${input}` +
    `<span class="uname">${escape(unitWord)}</span></div>`;
}

const numInput = (v: QuestionView, val: number, min: number, max: number, step: number): string =>
  `<input type="number" id="answer" name="answer" value="${val}" min="${min}" max="${max}"` +
  ` step="${step}" inputmode="decimal" required` +
  (v.error !== null ? ` aria-invalid="true" aria-describedby="answer-error"` : "") + `>`;

function ageControl(v: QuestionView): { control: string } {
  const copy = chatCopyFor(v.lang);
  const val = v.draft ?? (v.current[0] !== undefined ? Number(v.current[0]) : null)
    ?? (v.profile.birth_year ? v.today.getUTCFullYear() - v.profile.birth_year : ONBOARDING_NEUTRAL.ageYears);
  // The wheel's range runs INTO the refusal ages on purpose: 10–15 selects the under-16 stop,
  // which is the same door the typed fallback takes.
  const min = 10, max = 100;
  const rows: string[] = [];
  for (let a = min; a <= max; a++) rows.push(`<div class="wr">${a}</div>`);
  const wheel = `<div class="ctl" data-ctl="wheel" data-min="${min}" data-val="${val}">` +
    `<div class="vpick"><div class="bign num"><span class="bv">${escape(numfmt(v.lang, val))}</span>` +
    `<small>${escape(copy.units.years)}</small></div>` +
    `<div class="wheelbox"><div class="wheel" tabindex="0" aria-label="${escape(v.lines[v.lines.length - 1] ?? "")}">${rows.join("")}</div></div></div></div>`;
    // The wheel draws ages; the typed fallback also takes a four-digit year — `checkNumber`
  // reads one — so the field's own bounds must not refuse what the server would accept.
  return { control: wheel + numAlt(v, numInput(v, val, 5, 2100, 1), copy.units.years) };
}

function unitsSeg(v: QuestionView, which: "height" | "weight"): string {
  const labels = which === "height"
    ? [{ value: "metric", label: "cm" }, { value: "imperial", label: "ft, in" }]
    : [{ value: "metric", label: "kg" }, { value: "imperial", label: "lb" }];
  return segToggle(labels, v.units, v.segAction,
    hidden("from", v.prompt.id) + hidden("draft", v.draft !== null ? String(v.draft) : ""));
}

function heightControl(v: QuestionView): { seg: string; control: string } {
  const stored = v.current[0] !== undefined ? Number(v.current[0]) : v.profile.height_cm;
  const cm = v.draft ?? stored ?? ONBOARDING_NEUTRAL.heightCm;
  const t = RULER_TICKS.height[v.units];
  const val = heightDisplayValue(cm, v.units);
  // The imperial band rounds INWARD: a value the UI admits is always inside the metric band
  // `checkNumber` enforces, so no bound it shows is one the server refuses.
  const [min, max] = v.units === "imperial"
    ? [Math.ceil(heightDisplayValue(BANDS.height_cm[0], "imperial")),
       Math.floor(heightDisplayValue(BANDS.height_cm[1], "imperial"))]
    : BANDS.height_cm;
  // Imperial's plain fallback is two fields — "5 ft 8 in" is two numbers, and one box would ask a
  // user to invent a decimal nobody writes. `answer` (total inches) stays the scripted wire.
  const alt = v.units === "imperial"
    ? `<div class="numalt"><label class="lab" for="answer_ft">${escape(v.lines[v.lines.length - 1] ?? "")}</label>` +
      `<input type="number" name="answer_ft" id="answer_ft" data-alt value="${cmToFtIn(val ? Math.round(val * 2.54) : 0).ft}" min="3" max="8" step="1" inputmode="numeric" aria-label="ft">` +
      `<input type="number" name="answer_in" id="answer_in" data-alt value="${cmToFtIn(val ? Math.round(val * 2.54) : 0).in}" min="0" max="11" step="1" inputmode="numeric" aria-label="in">` +
      `<span class="uname">ft · in</span></div>` +
      `<input type="hidden" name="answer" value="${val}">`
    : numAlt(v, numInput(v, val, min, max, 1), "cm");
  const ctl = rulerControl(v, {
    ticks: t, val, min, max, step: 1,
    fmt: v.units === "imperial" ? "ftin" : "int",
    vertical: true, smalls: spellUnit(v.lang, "cm"), unitWord: spellUnit(v.lang, "cm"),
  });
  return { seg: unitsSeg(v, "height"), control: ctl + alt };
}

function weightControl(v: QuestionView): { seg: string; control: string } {
  const stored = v.current[0] !== undefined ? Number(v.current[0]) : v.profile.weight_kg;
  const kg = v.draft ?? stored ?? ONBOARDING_NEUTRAL.weightKg;
  const t = RULER_TICKS.weight[v.units];
  const val = weightDisplayValue(kg, v.units);
  const [min, max] = v.units === "imperial"
    ? [Math.ceil(weightDisplayValue(BANDS.weight_kg[0], "imperial")),
       Math.floor(weightDisplayValue(BANDS.weight_kg[1], "imperial"))]
    : BANDS.weight_kg;
  const word = v.units === "imperial" ? "lb" : "kg";
  const ctl = rulerControl(v, {
    ticks: t, val, min, max, step: 0.5,
    fmt: "int", vertical: false, smalls: spellUnit(v.lang, word), unitWord: spellUnit(v.lang, word), settle: true,
  });
  return { seg: unitsSeg(v, "weight"), control: ctl + numAlt(v, numInput(v, val, min, max, 0.5), spellUnit(v.lang, word)) };
}

function targetControl(v: QuestionView): { seg: string; control: string } {
  const copy = chatCopyFor(v.lang);
  const kg = v.draft
    ?? (v.current[0] !== undefined ? Number(v.current[0]) : null)
    ?? suggestedTargetKg(v.profile)
    ?? v.profile.weight_kg ?? ONBOARDING_NEUTRAL.weightKg;
  const t = RULER_TICKS.weight[v.units];
  const word = v.units === "imperial" ? "lb" : "kg";
  const val = weightDisplayValue(kg, v.units);
  const nowKg = v.profile.weight_kg;
  const minHealthy = v.profile.height_cm ? minHealthyWeightKg(v.profile.height_cm) : null;
  const range = targetRange(v.profile);
  const disp = (k: number) => weightDisplayValue(k, v.units);
  // The refused zone has to be VISIBLE to be refused honestly: the ruler's lower margin shows the
  // ~10kg under the healthy floor, tinted — the line the app will not cross is drawn on the
  // ruler itself, not only enforced in the POST.
  const min = Math.round(Math.max(disp(minHealthy ?? 30) - (v.units === "imperial" ? 22 : 10), disp(30)));
  const max = Math.round(disp(Math.max(range?.max ?? 0, (nowKg ?? 0) + 20, val + 10)));
  const now = nowKg !== null ? disp(nowKg) : undefined;
  const floorAt = minHealthy !== null ? disp(minHealthy) : undefined;
  const lowest = floorAt !== undefined
    ? fill(copy.target.lowest, { weight: weightDisplay(minHealthy!, v.units, v.lang) })
    : null;
  const ctl = rulerControl(v, {
    ticks: t, val, min, max, step: 0.5,
    fmt: "int", vertical: false, smalls: spellUnit(v.lang, word), unitWord: spellUnit(v.lang, word), settle: true,
    marks: true,
    floor: floorAt !== undefined && lowest !== null ? { at: floorAt, label: lowest } : undefined,
    now: now !== undefined
      ? { at: now, label: fill(copy.target.now, { weight: weightDisplay(nowKg!, v.units, v.lang) }) }
      : undefined,
    // The floor's weight is the number the merged label owes — the words sit at
    // the floor's mark and the bound is the claim that must never be off.
    merged: floorAt !== undefined && now !== undefined && lowest !== null
      ? fill(copy.target.nowLowest, { weight: weightDisplay(minHealthy!, v.units, v.lang) })
      : undefined,
    delta: { dn: copy.target.deltaDown, up: copy.target.deltaUp },
  });
  const alt = numAlt(v, numInput(v, val, min, max, 0.5), spellUnit(v.lang, word)) +
    // The no-JS field cannot draw the refused zone — the marker's words carry it instead.
    (lowest !== null ? `<p class="altline">${escape(lowest)}</p>` : "");
  return { seg: unitsSeg(v, "weight"), control: ctl + alt };
}

// ── The pace screen (10) — three computed candidates ──────────────────────────────────────────

const PACE_ICON: Record<string, string> = { easy: "slow", steady: "steady", push: "fast" };

function paceControl(v: QuestionView): string {
  const copy = chatCopyFor(v.lang);
  const opts = screenOptions(v.content, "pace");
  const previews = PACES.map((p) => pacePreview(v.profile, p, v.today, v.lang));
  const selIdx = Math.max(0, PACES.indexOf((v.current[0] ?? v.profile.pace ?? "steady") as never));
  // The big number is the COMPUTED rate, not the nominal pace — split for the bign's two sizes.
  const word = v.units === "imperial" ? "lb" : "kg";
  const rateOf = (i: number) => {
    const pr = previews[i];
    const disp = pr?.ratePerWeek == null ? null : weightDisplay(pr.ratePerWeek, v.units, v.lang);
    return {
      num: pr?.ratePerWeek == null ? "–"
        : numbers(v.lang)(Math.round(weightDisplayValue(pr.ratePerWeek, v.units) * 10) / 10),
      rest: `${disp === null ? "" : spellUnit(v.lang, word)} ${copy.pace.rateSuffix}`,
      disp,
    };
  };
  const variants = PACES.map((p, i) => {
    const r = rateOf(i);
    return `<div class="pacevar${i === selIdx ? " on" : ""}" data-i="${i}">` +
      `<div class="bign num rise"><span class="bv">${escape(r.num)}</span><small>${escape(r.rest)}</small></div></div>`;
  }).join("");
  const stops = PACES.map((p, i) =>
    `<div class="${i === selIdx ? "on" : ""}" data-i="${i}"><i class="ico i-${PACE_ICON[p] ?? "steady"}"></i>` +
    `${escape(opts[p]?.label ?? p)}</div>`,
  ).join("");
  const results = PACES.map((p, i) => {
    const pr = previews[i];
    // The marker is one tap deep: the detail sits in a <details>, legible with no script.
    const mark = pr?.marker !== undefined && pr.marker !== null && pr.markerText !== null
      ? `<details class="cap"><summary><span class="est">${escape(pr.markerText)}</span></summary>` +
        `<p>${escape(capNote(v.content.summary.capNote, v.profile.goal, pr.ratePerWeek, v.lang))}</p></details>`
      : "";
    return `<div class="paceres${i === selIdx ? " on" : ""}" data-i="${i}">` +
      `${pr?.line ? `<p class="res d d17 num rise">${escape(pr.line)}</p>` : ""}${mark}</div>`;
  }).join("");
  // Without the script the three rows ARE the computed previews — "three computed pace rows, each
  // previewProjection". The radios in them are the form's truth: the slider only marks one on.
  const rows = PACES.map((p, i) => {
    const pr = previews[i];
    const r = rateOf(i);
    return `<label class="opt"><input type="radio" name="answer" value="${p}"${i === selIdx ? " checked" : ""}>` +
      `<span class="tile"><i class="ico i-${PACE_ICON[p]}"></i></span>` +
      `<span>${escape(opts[p]?.label ?? p)}` +
      `<small>${escape(`${r.disp ?? ""}${pr?.line ? ` · ${pr.line}` : ""}`)}</small>` +
      `${pr?.markerText ? `<small class="est">${escape(pr.markerText)}</small>` : ""}</span>` +
      `<span class="ck"><i class="ico i-check"></i></span></label>`;
  }).join("");
  return `<div class="pacesel ctl" data-ctl="slider" data-val="${selIdx}">` +
    `<div class="pacevarbox">${variants}</div>` +
    `<div class="stops">${stops}</div>` +
    `<div class="slider"><i></i><b class="settle"></b></div>` +
    `<div class="paceresbox">${results}</div></div>` +
    `<div class="pacerows">${rows}</div>`;
}

// ── The dispatcher ────────────────────────────────────────────────────────────────────────────

export function question(v: QuestionView): string {
  const place = v.prompt.place as OnboardingPlace;
  switch (place) {
    case "goal":
    case "sex":
    case "activity":
    case "diet":
    case "struggles":
    case "medical":
      return page(v, { control: optionControl(v) });
    case "age":
      return page(v, ageControl(v));
    case "height": {
      const { seg, control } = heightControl(v);
      return page(v, { seg, control });
    }
    case "weight": {
      const { seg, control } = weightControl(v);
      return page(v, { seg, control });
    }
    case "target": {
      const { seg, control } = targetControl(v);
      return page(v, { seg, control });
    }
    case "pace":
      return page(v, { control: paceControl(v), echo: paceEcho(v.profile, v.units, v.lang) });
    default:
      // A field prompt this file does not draw is a bug, not a page — fail loud in dev.
      return page(v, {
        control: numAlt(v, numInput(v, Number(v.current[0] ?? 0) || 0, 0, 999, 1), ""),
      });
  }
}
