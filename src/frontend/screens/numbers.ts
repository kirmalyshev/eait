// The web "+ Log" chooser's Numbers (#2088) and the search sheet's "Enter numbers" row: a sheet over
// the chat with the name, the four required numbers and four optional. Nothing is computed here —
// `POST /v1/meals/numbers` writes the numbers as typed and computes the verdicts, model-free and
// free of the sample, behind the paywall like a photo (a browser has no sheet, so a 402 says where
// subscribing happens). No macro-vs-kcal hint, by decision. Saving for re-use is the meal's own
// ⋯ → Save meal, not this form.

import { NUMBERS_MAX_GRAMS, NUMBERS_MAX_KCAL, NUMBERS_MAX_SODIUM_MG, NUMBERS_NAME_MAX } from "@eait/shared/contract";
import { foodSearchCopyFor } from "../../shared/app/food-search-copy.ts";
import { numbersCopyFor } from "../../shared/app/numbers-copy.ts";
import { UNIT_KCAL, spellUnit, wholeNumbers } from "../../shared/lang.ts";
import type { Lang } from "../../shared/types.ts";
import { ApiError, api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { COPY, el } from "../shell.ts";

export interface NumbersOpts {
  lang: Lang;
  /** kcal left today, or null when the day could not be read — the line is then left out. */
  left: number | null;
  /** The search query this was opened from, prefilled as the name. */
  name?: string;
  onClose: () => void;
  /** A meal landed: the chat's own thread and today's totals are stale. */
  onLogged: () => void;
}

type Key = "kcal" | "protein_g" | "carbs_g" | "fat_g" | "satfat_g" | "fiber_g" | "sugar_g" | "sodium_mg";
const MAX: Record<Key, number> = {
  kcal: NUMBERS_MAX_KCAL, protein_g: NUMBERS_MAX_GRAMS, carbs_g: NUMBERS_MAX_GRAMS, fat_g: NUMBERS_MAX_GRAMS,
  satfat_g: NUMBERS_MAX_GRAMS, fiber_g: NUMBERS_MAX_GRAMS, sugar_g: NUMBERS_MAX_GRAMS, sodium_mg: NUMBERS_MAX_SODIUM_MG,
};

/** Typed text → a number; null when empty (not zero), NaN when it is not a non-negative number. A comma is a point. */
const parse = (v: string): number | null => {
  const t = v.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : Number.NaN;
};

export function numbersSheet(o: NumbersOpts): HTMLElement {
  const c = numbersCopyFor(o.lang);
  const fs = foodSearchCopyFor(o.lang);
  const num = wholeNumbers(o.lang);
  const g = spellUnit(o.lang, "g");

  const sheet = el("div", "fs nf");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", c.enter);
  const head = el("div", "fs-head");
  const title = el("b", "nf-title", c.enter);
  const close = el("button", "fs-close", fs.cancel) as HTMLButtonElement;
  close.type = "button";
  close.addEventListener("click", o.onClose);
  head.append(title, close);

  const name = el("input", "nf-name") as HTMLInputElement;
  name.type = "text";
  name.placeholder = c.name;
  name.setAttribute("aria-label", c.name);
  name.maxLength = NUMBERS_NAME_MAX;
  name.autocomplete = "off";
  name.value = o.name ?? "";

  const inputs = {} as Record<Key, HTMLInputElement>;
  const card = (rows: [Key, string, string][]): HTMLElement => {
    const box = el("div", "nf-card");
    for (const [k, label, unit] of rows) {
      const row = el("label", "nf-row");
      const input = el("input", "nf-num") as HTMLInputElement;
      input.type = "text";
      input.inputMode = "decimal";
      input.placeholder = "—";
      input.setAttribute("aria-label", label);
      inputs[k] = input;
      row.append(el("span", "nf-label", label), input, el("span", "nf-unit", unit));
      box.append(row);
    }
    return box;
  };
  const main = card([["kcal", c.calories, UNIT_KCAL[o.lang]], ["protein_g", c.protein, g], ["carbs_g", c.carbs, g], ["fat_g", c.fat, g]]);
  const opt = card([["satfat_g", c.satfat, g], ["fiber_g", c.fibre, g], ["sugar_g", c.sugar, g], ["sodium_mg", c.sodium, spellUnit(o.lang, "mg")]]);

  const note = el("p", "nf-note");
  note.hidden = true;
  const line = el("p", "fs-line", o.left === null ? "" : fill(fs.logging, { day: fs.today, left: num(Math.max(0, o.left)) }));
  const log = el("button", "nf-cta", c.cta) as HTMLButtonElement;
  log.type = "button";
  const scroll = el("div", "fs-body");
  scroll.append(name, main, el("p", "nf-opt", c.optional), opt, note);
  sheet.append(head, scroll, line, log);

  // One id per form: a second click replays the first save instead of logging twice.
  const clientId = crypto.randomUUID();
  let busy = false;
  const say = (text: string): void => { note.textContent = text; note.hidden = text === ""; };
  log.addEventListener("click", async () => {
    if (busy) return;
    const v = (k: Key): number | null => parse(inputs[k].value);
    const kcal = v("kcal"), protein_g = v("protein_g"), carbs_g = v("carbs_g"), fat_g = v("fat_g");
    const bad = (Object.keys(MAX) as Key[]).some((k) => { const x = v(k); return x !== null && (Number.isNaN(x) || x > MAX[k]); });
    const nm = name.value.trim();
    if (nm === "" || kcal === null || protein_g === null || carbs_g === null || fat_g === null || bad) { say(c.needed); return; }
    const body: Record<string, unknown> = { name: nm, kcal, protein_g, carbs_g, fat_g, dayOffset: 0, clientId };
    for (const k of ["satfat_g", "fiber_g", "sugar_g", "sodium_mg"] as const) {
      const x = v(k);
      if (x !== null) body[k] = x;
    }
    busy = true; say("");
    try {
      await api("/meals/numbers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      o.onLogged();
      o.onClose();
    } catch (e) {
      const code = e instanceof ApiError ? e.body?.error : undefined;
      say(code !== undefined && Object.hasOwn(COPY.refusals, code) ? COPY.refusals[code]! : c.failed);
    } finally { busy = false; }
  });
  sheet.addEventListener("keydown", (e) => { if (e.key === "Escape") o.onClose(); });
  queueMicrotask(() => (name.value === "" ? name : inputs.kcal).focus());
  return sheet;
}
