// The web "+ Log" chooser's Search (#909): a full-width sheet over the chat — the field, Cancel
// (Done once something was logged), "Logging to today · N kcal left", the catalog's rows with a
// round +, and the "Tell {coach}" row that hands her words to the composer. One tap logs the
// source's named serving, else 100 g (`foodLogChoice`); the sheet stays open. Nothing is
// estimated here: the row's kcal is the same arithmetic the server writes, and the server reads
// the numbers off the catalog row — this sends an id and a weight.

import type { FoodSearchResponse } from "@eait/shared/contract";
import type { FoodRef } from "@eait/shared";
import { foodLogChoice, foodSearchCopyFor, isLoggableFood } from "../../shared/app/food-search-copy.ts";
import { wholeNumbers } from "../../shared/lang.ts";
import type { Lang } from "../../shared/types.ts";
import { ApiError, api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { COPY, el } from "../shell.ts";

export interface FoodSearchOpts {
  lang: Lang;
  coachName: string | null;
  /** kcal left today, or null when the day could not be read — the line is then left out. */
  left: number | null;
  /** Her words go to the composer, as a typed meal does today. */
  onTell: (q: string) => void;
  onClose: () => void;
  /** A meal landed: the chat's own thread and today's totals are stale. */
  onLogged: () => void;
}

const DEBOUNCE_MS = 250;

export function foodSearchSheet(o: FoodSearchOpts): HTMLElement {
  const c = foodSearchCopyFor(o.lang);
  const num = wholeNumbers(o.lang);
  const coach = o.coachName ?? "";
  let left = o.left;
  let seq = 0;

  const sheet = el("div", "fs");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-label", c.plusSearch);
  const head = el("div", "fs-head");
  const field = el("input", "fs-field") as HTMLInputElement;
  field.type = "search";
  field.placeholder = c.placeholder;
  field.setAttribute("aria-label", c.placeholder);
  field.autocomplete = "off";
  const close = el("button", "fs-close", c.cancel) as HTMLButtonElement;
  close.type = "button";
  close.addEventListener("click", o.onClose);
  head.append(field, close);
  const line = el("p", "fs-line");
  const body = el("div", "fs-body");
  const source = el("p", "fs-source");
  sheet.append(head, line, body, source);

  const drawLine = (): void => {
    line.textContent = left === null ? "" : fill(c.logging, { day: c.today, left: num(Math.max(0, left)) });
  };
  drawLine();

  const tellRow = (q: string): HTMLElement => {
    const row = el("button", "fs-row fs-tell") as HTMLButtonElement;
    row.type = "button";
    const txt = el("div", "fs-txt");
    txt.append(el("b", "", fill(c.tell, { coach, q })), el("div", "fs-sub", fill(c.tellSub, { coach })));
    row.append(txt, el("i", "ico i-chevron-right"));
    row.addEventListener("click", () => { o.onClose(); o.onTell(q); });
    return row;
  };

  const foodRow = (f: FoodRef): HTMLElement => {
    const ch = foodLogChoice(f);
    const row = el("div", "fs-row");
    const txt = el("div", "fs-txt");
    const fail = el("div", "fs-fail");
    fail.hidden = true;
    txt.append(
      el("b", "", f.names[o.lang] ?? (o.lang === "de" ? f.name_de : o.lang === "en" ? f.name_en : null) ?? f.name),
      el("div", "fs-sub", fill(c.serving, { label: ch.label ?? c.hundredGrams, kcal: num(ch.kcal) })),
      fail,
    );
    const add = el("button", "fs-add") as HTMLButtonElement;
    add.type = "button";
    const name = f.name;
    const face = (done: boolean): void => {
      add.classList.toggle("fs-done", done);
      add.setAttribute("aria-label", fill(done ? c.logged : c.log, { name }));
      add.replaceChildren(el("i", `ico i-${done ? "check" : "plus"}`));
    };
    face(false);
    let busy = false;
    add.addEventListener("click", async () => {
      if (busy || add.classList.contains("fs-done")) return;
      busy = true; fail.hidden = true;
      try {
        await api("/foods/log", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ref: f.id, grams: ch.grams, clientId: crypto.randomUUID(), capturedAt: new Date().toISOString() }),
        });
        face(true);
        close.textContent = c.done;
        if (left !== null) { left -= ch.kcal; drawLine(); }
        o.onLogged();
      } catch (e) {
        // A 402 is the paywall: a browser has no sheet, so the refusal says where subscribing happens.
        const code = e instanceof ApiError ? e.body?.error : undefined;
        fail.textContent = code !== undefined && Object.hasOwn(COPY.refusals, code) ? COPY.refusals[code]! : c.logFailed;
        fail.hidden = false;
      } finally { busy = false; }
    });
    row.append(txt, add);
    return row;
  };

  const run = async (q: string): Promise<void> => {
    const mine = ++seq;
    if (q === "") { body.replaceChildren(); source.textContent = ""; return; }
    try {
      const r = await api<FoodSearchResponse>(`/foods?q=${encodeURIComponent(q)}&limit=20`);
      if (mine !== seq) return;
      const rows = r.foods.filter(isLoggableFood);
      body.replaceChildren(
        ...(rows.length === 0 ? [el("p", "fs-none", fill(c.noMatch, { q }))] : rows.map(foodRow)),
        tellRow(q),
      );
      source.textContent = rows.length === 0 ? "" : r.attributions.map((a) => a.citation).join(" · ");
    } catch {
      if (mine !== seq) return;
      const retry = el("button", "fs-retry", c.retry) as HTMLButtonElement;
      retry.type = "button";
      retry.addEventListener("click", () => { void run(q); });
      const msg = el("p", "fs-failed", `${c.searchFailed} `);
      msg.append(retry);
      body.replaceChildren(msg);
      source.textContent = "";
    }
  };

  let timer: ReturnType<typeof setTimeout> | undefined;
  field.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => { void run(field.value.trim()); }, DEBOUNCE_MS);
  });
  field.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && field.value.trim() !== "") { e.preventDefault(); o.onClose(); o.onTell(field.value.trim()); }
    if (e.key === "Escape") o.onClose();
  });
  queueMicrotask(() => field.focus());
  return sheet;
}
