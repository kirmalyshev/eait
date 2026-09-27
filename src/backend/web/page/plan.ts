import {
  LANGS_READY, LANG_LABEL, numbers, spellUnit, UNIT_KCAL, verdictNoun, wholeNumbers,
} from "@eait/shared";
import { spudSvg, type MascotMood } from "@eait/shared/mascot";
import type { Lang } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { topBar } from "./parts.ts";
import { escape, shell } from "./shell.ts";

export interface PlanView {
  /** Which provider signed this account in, so the app instruction can name that button. */
  signedInWith: "apple" | "google" | null;
  /**
   * Spud's beat at the top — the restrictions reply the chat computes for this profile
   * (`reactionTo`), with its mood. The page invents no sentence of its own here.
   */
  beat: { line: string; mood: MascotMood } | null;
  /** The goal card's figure. A goal that carries no target — maintain — draws no card. */
  targetKg: number | null;
  /**
   * The by-when line, already filled — `projectionLine` over the content's
   * `summary.projection`/`projectionFar`, or null wherever `projectGoal` declined a number. Null
   * is "no date", never a hole.
   */
  byWhen: string | null;
  /** `projectGoal`'s week count, under the by-when. */
  weeks: number | null;
  kcal: number;
  proteinG: number;
  /**
   * The marker caps, present ONLY for the restrictions the profile declared — the same fields on
   * `targets` that `verdictsFromTargets` reads, so the figure on this page is the figure a meal is
   * judged against.
   */
  satfatG?: number | undefined;
  sodiumMg?: number | undefined;
  /** The row labels — `content.building`'s and `summary.proteinLabel`, the phone's own words. */
  labels: { rest: string; activity: string; pace: string; floor: string; protein: string };
  bmr: number | null;
  tdee: number | null;
  /** `appliedDeltaKcal` — the pace as it was actually applied, after both guards. */
  paceKcal: number;
  floorApplied: boolean;
  floorKcal: number;
  /**
   * Whether a checkout is configured — the ask is rendered, not the URL: it leads to the soft
   * offer (`/start/offer`), which is where the configured checkout link now lives (#42).
   */
  checkout: boolean;
  /**
   * Whether there is a web application to hand over to.
   *
   * It decides two things. The primary button: "/" opens the first-meal flow there, and `/start`'s
   * own chat is the nearest thing when there is none. And the language picker: with an app, the
   * language lives in ITS settings and the picker is not drawn; without one this page is the only
   * place to change it, so it stays.
   */
  hasWebApp: boolean;
  /** Whether the Telegram connector is on, so Connect Telegram has a bot to send anybody to. */
  telegram: boolean;
  lang: Lang;
}

export function plan(v: PlanView): string {
  const lang = v.lang;
  const PAGE_COPY = pageCopyFor(lang);
  // The FIGURES are grouped the reader's way — "1.800", not "1,800", for half of Europe — and the
  // sentences around them are the table's. A weight keeps its tenth; kcal, grams and weeks do not.
  const n = wholeNumbers(lang);
  const kg = spellUnit(lang, "kg");
  const g = spellUnit(lang, "g");

  // The marker row: protein always, then ONLY what the profile declared — a cap nobody asked for
  // is a verdict nobody asked for. The noun is the verdict's own (`verdictNoun`), so the cap and
  // the pill that judges it cannot spell the nutrient two ways.
  const markers: { label: string; text: string }[] = [
    { label: v.labels.protein, text: `${n(v.proteinG)} ${g}` },
  ];
  if (v.satfatG !== undefined)
    markers.push({ label: verdictNoun("ldl", lang), text: `${n(v.satfatG)} ${g}` });
  if (v.sodiumMg !== undefined)
    markers.push({ label: verdictNoun("kidneys", lang), text: `${n(v.sodiumMg)} ${spellUnit(lang, "mg")}` });

  // The arithmetic — every figure is `explainTargets`' own, handed in by the route: the body at
  // rest, what the days add on top of it, the pace as it was actually APPLIED (capped, floored —
  // never the one that was asked for), and the floor itself, drawn even when it did not bite
  // because it holds either way.
  const arithmetic: { label: string; text: string }[] = [];
  if (v.bmr !== null) arithmetic.push({ label: v.labels.rest, text: n(v.bmr) });
  if (v.bmr !== null && v.tdee !== null)
    arithmetic.push({ label: v.labels.activity, text: `+${n(v.tdee - v.bmr)}` });
  arithmetic.push({
    label: v.labels.pace,
    // A minus sign, not a hyphen, and a dash for no change — the phone's calc card reads the same.
    text: v.paceKcal === 0 ? "—" : `${v.paceKcal < 0 ? "−" : "+"}${n(Math.abs(v.paceKcal))}`,
  });
  arithmetic.push({ label: v.labels.floor, text: n(v.floorKcal) });

  return shell(PAGE_COPY.titlePlan, `
${topBar(PAGE_COPY)}
${v.beat === null ? "" : `<div class="spk"><span class="av">${spudSvg(v.beat.mood, "spud-plan")}</span><p class="bubble typed">${escape(v.beat.line)}</p></div>`}
<h1>${escape(PAGE_COPY.planHeading)}</h1>
${v.targetKg === null ? "" : `<div class="card">
  <p class="figure">${escape(numbers(lang)(v.targetKg))} ${escape(kg)}</p>
  ${v.byWhen === null ? "" : `<p class="muted">${escape(v.byWhen)}</p>`}
  ${v.weeks === null ? "" : `<p class="lab">${escape(PAGE_COPY.planWeeks.replace("{weeks}", n(v.weeks)))}</p>`}
</div>`}
<div class="card">
  <p class="lab">${escape(PAGE_COPY.planEachDay)}</p>
  <p class="figure">${escape(n(v.kcal))} ${escape(UNIT_KCAL[lang])}</p>
  <div class="specs">${markers.map((m) =>
    `<div><p class="lab">${escape(m.label)}</p><p class="val">${escape(m.text)}</p></div>`,
  ).join("")}</div>
  <div class="arith">${arithmetic.map((r) =>
    `<div class="rowline"><span>${escape(r.label)}</span><strong>${escape(r.text)}</strong></div>`,
  ).join("")}</div>
</div>
${v.floorApplied
  ? `<p class="notice care">${escape(PAGE_COPY.planFloor)} ${escape(PAGE_COPY.planFloorNumber.replace("{floor}", n(v.floorKcal)))}</p>`
  : ""}
<a class="button primary" href="/start/signup">${escape(PAGE_COPY.continueLabel)}</a>
${v.checkout
  ? `<a class="button primary" href="/start/offer">${escape(PAGE_COPY.planCheckout)}</a>`
  : ""}
<a class="button" href="${v.hasWebApp ? "/#/chat" : "/start/chat"}">${escape(PAGE_COPY.planChat)}</a>
${v.telegram
  ? `<p class="muted">${escape(PAGE_COPY.planTelegramBody)}</p>
<form method="post" action="/start/telegram"><button class="button">${escape(PAGE_COPY.planTelegram)}</button></form>`
  : ""}
<h2>${escape(PAGE_COPY.planAppHeading)}</h2>
<p class="muted">${escape(v.signedInWith === null
  ? PAGE_COPY.planAppBodyGeneric
  : PAGE_COPY.planAppBody.replace("{provider}", v.signedInWith === "apple" ? "Apple" : "Google"))}</p>
${v.hasWebApp ? "" : languagePicker(v.lang)}
`, v.lang);
}

/**
 * THE PICKER, and this page is where it lives on this surface.
 *
 * The plan page is `/start`'s settings: it is the one page somebody comes back to, and the only one
 * with anything else to change on it. It writes through `PATCH /v1/profile` like every other
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
  <button type="submit">${escape(PAGE_COPY.languageSave)}</button>
</form>`;
}
