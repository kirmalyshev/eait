// The weigh-in panel (web/you-weight.html + phone/you/weight.tsx, which it mirrors): over
// whichever screen opened it — Progress's "Log weight" doors, or the profile editor's Weight
// row. The check line, the big editable figure, the provenance under it, the plan recomputing
// live off `explainTargetsAtAge`, Save.
//
// EVERY FIGURE'S ROAD BACK IS THE SERVER'S: Save PATCHes `weight_kg`, which writes the day's
// weigh-in row on the server (S7 — `putWeight` in engine/profile.ts), and the live plan line is
// `explainTargets` — the one computation both sides run — over the DRAFT: a preview, not a
// promise. The response writes the real one.

import { healthScreenCopyFor } from "../shared/health-copy.ts";
import { localDate } from "../shared/dates.ts";
import { dayMonth, fill, kcalNumbers, numbers, spellUnit, timeAt, wholeNumbers } from "../shared/lang.ts";
import { homeCopyFor } from "../shared/app/home-copy.ts";
import { explainTargetsAtAge, MAX_WEIGHT_KG, MIN_WEIGHT_KG } from "../shared/targets.ts";
import { weightDisplayValue, weightToKg, type UnitSystem } from "../shared/ui/units.ts";
import { youCopyFor } from "../shared/app/you-copy.ts";
import type { ProfileRejected, ProfileResponse, WeightsResponse } from "@eait/shared/contract";
import { api, ApiError, Unauthenticated } from "./api.ts";
import { clear, el, keptWords, lang, render } from "./shell.ts";
import { openPanel, toast } from "./panel.ts";

/**
 * Cut a filled figure phrase at the figure's own prefix — the phone's `leadTail`, for the
 * provenance line's struck previous weight: "{prev}kg · {source}, today {time}" splits into the
 * struck figure and the rest, and a translation's order is never retyped beside it.
 */
export const leadTail = (whole: string, lead: string): [string, string] =>
  whole.startsWith(lead) ? [lead, whole.slice(lead.length)] : ["", whole];

/**
 * Open the weigh-in over the current screen. `me` is the profile the screen already holds;
 * `onSaved` gets the post-save profile so the caller can redraw (Progress re-renders, the editor
 * updates its Weight row) — the saved toast is this panel's own.
 */
export function openWeighIn(me: ProfileResponse, onSaved: (res: ProfileResponse) => void): void {
  const you = youCopyFor(lang);
  const H = homeCopyFor(lang);
  const n = numbers(lang);
  const nWhole = wholeNumbers(lang);
  const kn = kcalNumbers(lang);
  const p = me.profile;
  const units: UnitSystem = p.units ?? "metric";
  const imperial = units === "imperial";

  const { body, close } = openPanel(you.phone.weightTitle);

  // ── The check line — "Health says 73.4kg. Is that right?", the typed wording when the last
  // figure was typed, and nothing when there is no figure to check. ──
  const check = el("p", "m");
  // ── The figure — an input in the board's 48px display type, the unit beside it. ──
  const field = document.createElement("input");
  field.type = "number";
  field.step = "0.1";
  field.min = "0";
  field.inputMode = "decimal";
  field.className = "wbig num";
  field.setAttribute("aria-label", you.phone.weightTitle);
  const figRow = el("div", "row wfigrow");
  figRow.append(field, el("span", "m wunit", spellUnit(lang, imperial ? "lb" : "kg")));
  // The provenance line under the figure — "{prev}kg · {source}, today {time}", the figure struck.
  const prov = el("span", "t12 m");
  // ── The plan preview — the flat card appears once the draft is a figure the server could take
  // and not the one it already holds. ──
  const planCard = el("div", "card flat wplan");
  planCard.hidden = true;
  // The save's refusal and the provenance read's failure share the boxed notice; the save's is
  // the newer word when both stand.
  const notice = el("div", "pnote");
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  const save = el("button", "cta p", you.phone.save) as HTMLButtonElement;
  save.type = "button";
  body.append(check, figRow, prov, planCard, notice, save);

  // The weigh-in log — for the provenance line's source and date. Not a gate: the field seeds
  // off the profile's own weight, and the line lands when the read does.
  let weights: WeightsResponse | null = null;
  let wFailed = false;
  let saving = false;
  /** The field holds what the user touched once they touch it — a late weights read does not
      overwrite a figure in progress. */
  let touched = false;

  const latest = () => weights?.latest ?? null;
  const prevKg = () => latest()?.kg ?? p.weight_kg;
  const prevDisplay = () => { const kg = prevKg(); return kg === null ? null : weightDisplayValue(kg, units); };
  const sourceWord = () => latest()?.source === "health" ? you.appleHealth : you.phone.sourceYou;

  const parsedKg = (): number | null => {
    const text = field.value.trim();
    if (text === "") return null;
    const kg = weightToKg(units, Number(text));
    // The band is the server's own (`MIN_/MAX_WEIGHT_KG`): a figure outside it can only be a 422,
    // so the field that holds it simply arms no Save — the same gate the phone's `checkNumber` runs.
    return Number.isFinite(kg) && kg >= MIN_WEIGHT_KG && kg <= MAX_WEIGHT_KG ? kg : null;
  };

  /** What the plan becomes if this figure saves — the one computation, over the draft. */
  const revised = () => {
    const kg = parsedKg();
    return kg !== null && kg !== p.weight_kg ? explainTargetsAtAge({ ...p, weight_kg: kg }, me.age).targets : null;
  };

  const drawPlan = (): void => {
    const r = revised();
    clear(planCard);
    if (r === null) { planCard.hidden = true; return; }
    planCard.hidden = false;
    const row = el("div", "row between");
    row.append(el("span", "wplanlab", you.planLabel));
    // "{from} → {to}kcal a day" filled whole; the pieces are cut from the FILLED string so the
    // arrow and the unit word stay the template's own.
    const whole = fill(you.phone.planRevised, { from: `${kn(me.targets.kcal)}`, to: `${kn(r.kcal)}` });
    const toStr = kn(r.kcal);
    const [from, rest] = leadTail(whole, kn(me.targets.kcal));
    const atTo = rest.indexOf(toStr);
    const num = el("span", "num");
    num.append(el("s", "m", from), document.createTextNode(atTo >= 0 ? rest.slice(0, atTo) : rest));
    if (atTo >= 0) {
      num.append(el("b", "d d22", toStr));
      if (rest.slice(atTo + toStr.length) !== "") num.append(el("span", "m t12", rest.slice(atTo + toStr.length)));
    }
    row.append(num);
    const macs = el("div", "t13 m wmacs");
    macs.textContent = r.satfat_g !== undefined
      ? `${fill(you.proteinGrams, { g: nWhole(r.protein_g) })} · ${fill(you.satFatGrams, { g: nWhole(r.satfat_g), noun: H.macros.satFat.name })}`
      : `${fill(you.proteinGrams, { g: nWhole(r.protein_g) })} · ${fill(you.grams, { g: nWhole(r.fat_g) })}`;
    planCard.append(row, macs);
  };

  const drawMeta = (): void => {
    const l = latest();
    const prev = prevDisplay();
    check.textContent = prev === null ? "" : fill(
      l?.source === "health"
        ? (imperial ? you.phone.weightCheckLb : you.phone.weightCheckKg)
        : (imperial ? you.phone.weightCheckTypedLb : you.phone.weightCheckTypedKg),
      { w: n(prev), source: sourceWord() },
    );
    if (l !== null && prev !== null) {
      const sameDay = l.date === localDate(me.timezone);
      const whole = fill(sameDay
        ? (imperial ? you.phone.weightSourceLb : you.phone.weightSourceKg)
        : (imperial ? you.phone.weightSourceOnLb : you.phone.weightSourceOnKg), {
        prev: n(prev),
        source: sourceWord(),
        time: p.weight_measured_at !== null ? timeAt(lang, me.timezone, new Date(p.weight_measured_at)) : "",
        date: dayMonth(lang).format(new Date(`${l.date}T12:00:00Z`)),
      });
      const [lead, tail] = leadTail(whole, fill(imperial ? you.phone.weightLb : you.phone.weightKg, { w: n(prev) }));
      clear(prov).append(el("s", "m", lead), document.createTextNode(tail));
    } else {
      prov.textContent = wFailed ? healthScreenCopyFor(lang).body.loadFailed : "";
    }
    save.disabled = saving || parsedKg() === null;
  };

  void api<WeightsResponse>("/weights?range=all")
    .then((w) => {
      weights = w;
      wFailed = false;
      // The field seeded off the profile before the read landed — re-seed to the newest weigh-in
      // only while the user has not typed over it.
      if (!touched) {
        const prev = prevDisplay();
        field.value = prev === null ? "" : String(prev);
      }
      drawMeta();
      drawPlan();
    })
    .catch(() => { wFailed = true; drawMeta(); });

  const seeded = prevDisplay();
  if (seeded !== null) field.value = String(seeded);

  field.addEventListener("input", () => { touched = true; notice.hidden = true; drawMeta(); drawPlan(); });

  save.addEventListener("click", async () => {
    const kg = parsedKg();
    if (kg === null || saving) return;
    const l = latest();
    const prev = prevDisplay();
    // A figure that CAME from Health is already the server's word — PATCHing it back stamps a
    // "typed" weigh-in over the Health row and fabricates history nobody typed. An unchanged
    // answer to "Health says 73.4 — is that right?" is a yes: close, don't save.
    if (l?.source === "health" && prev !== null && weightDisplayValue(kg, units) === prev) {
      close();
      return;
    }
    saving = true;
    save.disabled = true;
    try {
      const res = await api<ProfileResponse>("/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ weight_kg: kg }),
      });
      close();
      // The toast is the board's saved line — "{w}kg, saved" (a web save is always a typed
      // weigh-in) — plus the plan's move when the figure moved it.
      const note = fill(imperial ? you.phone.savedNoteTypedLb : you.phone.savedNoteTypedKg,
        { w: n(weightDisplayValue(kg, units)) });
      toast(res.targets.kcal !== me.targets.kcal
        ? `${note} · ${fill(you.phone.planRevised, { from: `${kn(me.targets.kcal)}`, to: `${kn(res.targets.kcal)}` })}`
        : note);
      onSaved(res);
    } catch (err) {
      if (err instanceof Unauthenticated) { close(); await render(); return; }
      const r = err instanceof ApiError && err.status === 422 ? err.body as ProfileRejected | null : null;
      const words = r?.reason === "target-weight-below-healthy-bmi" && r.minHealthyKg !== undefined
        ? fill(you.web.belowHealthy, { kg: n(r.minHealthyKg) })
        : keptWords(err, you.web.saveFailedBody);
      notice.replaceChildren(el("b", "", you.web.saveFailedTitle), el("span", "t13 m", words));
      notice.hidden = false;
      field.focus();
      try { field.select(); } catch {}
    } finally {
      saving = false;
      save.disabled = false;
    }
  });

  drawMeta();
  field.focus();
  // The figure arrives selected, the way the phone's autofocus does — one key replaces it whole.
  // select() is a no-op on a number input in some engines; the field keeps its value either way.
  try { field.select(); } catch {}
}
