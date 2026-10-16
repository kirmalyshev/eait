// `#/progress/weigh-ins` — every weigh-in, newest first (ieat-app#891, `phone/pw3-history`).
//
// Apple Health's rows say where they came from and are read-only; the user's own can be corrected
// (tap the weight, Enter saves, Esc cancels) or deleted. The server decides which is which —
// `WeightEntry.source` — and refuses an edit of an imported day with 404, so this screen never
// guesses. The chart, the changes and the BMI recount on the next Progress draw.

import { decimalNumbers } from "../../shared/lang.ts";
import { chatScreenCopyFor } from "../../shared/app/chat-copy.ts";
import { dayMonthOn } from "../../shared/lang.ts";
import { localDate } from "../../shared/dates.ts";
import { weightDisplayValue, weightToKg, type UnitSystem } from "../../shared/ui/units.ts";
import { weighHistoryCopyFor } from "../../shared/app/weigh-history-copy.ts";
import { youCopyFor } from "../../shared/app/you-copy.ts";
import type { WeightEditRequest, WeightEntry, WeightsResponse } from "@eait/shared";
import { api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { kitEl } from "../kit.ts";
import { el, lang, refusalWords, type Frame } from "../shell.ts";
import { ico } from "../../shared/ui/kit.ts";
import { openWeighIn } from "../weigh.ts";

export async function weighInsScreen(frame: Frame): Promise<HTMLElement> {
  const c = weighHistoryCopyFor(lang);
  const you = youCopyFor(lang);
  const units: UnitSystem = frame.me?.profile.units ?? "metric";
  const zone = frame.me?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const n = decimalNumbers(lang);
  const today = localDate(zone);
  const wrap = el("section", "wih");

  const top = el("div", "mtop");
  const back = el("a", "ib") as HTMLAnchorElement;
  back.href = "#/progress";
  back.setAttribute("aria-label", c.historyTitle);
  back.append(kitEl(ico("chevron-left")));
  top.append(back, el("h1", "d d22", c.historyTitle));
  const list = el("div", "card flat wihl");
  wrap.append(top, list);

  const weight = (kg: number): string => fill(c.rowWeight[units], { n: n(weightDisplayValue(kg, units)) });
  const redraw = (log: WeightEntry[]): void => {
    list.replaceChildren();
    if (log.length === 0) {
      const empty = el("div", "wihe");
      const cta = el("a", "cta p", you.logWeight) as HTMLAnchorElement;
      cta.href = "#/progress";
      cta.addEventListener("click", (ev) => {
        ev.preventDefault();
        if (frame.me) openWeighIn(frame.me, () => void api<WeightsResponse>("/weights?range=all").then((w) => redraw(w.weights)));
      });
      empty.append(el("b", "d d22", c.historyEmptyTitle), el("p", "t13 m", c.historyEmptyNote), cta);
      list.append(empty);
      return;
    }
    for (const e of [...log].reverse()) list.append(row(e));
  };
  const send = async (e: WeightEntry, method: "PATCH" | "DELETE", kg?: number): Promise<void> => {
    try {
      const init: RequestInit = method === "PATCH"
        ? { method, body: JSON.stringify({ kg: kg! } satisfies WeightEditRequest), headers: { "content-type": "application/json" } }
        : { method };
      redraw((await api<WeightsResponse>(`/weights/${e.date}`, init)).weights);
    } catch (err) {
      list.before(el("p", "notice", refusalWords(err)));
    }
  };
  const row = (e: WeightEntry): HTMLElement => {
    const own = e.source === "manual";
    const r = el("div", "row wihr");
    const what = el("div", "wihw");
    what.append(el("div", "", dayMonthOn(lang, e.date, today)), el("div", "t12 m", own ? c.sourceYou : c.sourceHealth));
    const figure = el(own ? "button" : "b", "num wihk", weight(e.kg)) as HTMLElement;
    r.append(what, figure);
    if (!own) return r;
    figure.setAttribute("type", "button");
    figure.addEventListener("click", () => {
      const input = el("input", "wihi") as HTMLInputElement;
      input.type = "number"; input.step = "0.1"; input.inputMode = "decimal";
      input.value = String(Math.round(weightDisplayValue(e.kg, units) * 10) / 10);
      input.setAttribute("aria-label", c.historyTitle);
      figure.replaceWith(input);
      input.focus();
      input.addEventListener("keydown", (k) => {
        if (k.key === "Escape") input.replaceWith(figure);
        if (k.key === "Enter" && !Number.isNaN(input.valueAsNumber)) void send(e, "PATCH", weightToKg(units, input.valueAsNumber));
      });
    });
    const del = el("button", "wihd", chatScreenCopyFor(lang).phone.delete) as HTMLButtonElement;
    del.type = "button";
    del.addEventListener("click", () => void send(e, "DELETE"));
    r.append(del);
    return r;
  };

  try {
    redraw((await api<WeightsResponse>("/weights?range=all")).weights);
  } catch (err) {
    wrap.append(el("p", "notice", refusalWords(err)));
  }
  return wrap;
}
