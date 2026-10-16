// The day's goal, explained (#911; boards `web-pw3-goal*`, `web-pw3-prefs`): the quiet line under
// Home's hero when a burn was added, the dialog it opens with the sum, and the switch on Profile.
// Every figure is the server's (`DayResponse.goal`, off `explainTargets`) — nothing is added up here.

import type { DayResponse, ProfileResponse } from "@eait/shared";
import { goalCopyFor } from "../../shared/app/goal-copy.ts";
import { kcalNumbers } from "../../shared/lang.ts";
import { ico } from "../../shared/ui/kit.ts";
import { api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { kitEl } from "../kit.ts";
import { openDialog } from "../panel.ts";
import { el, forgetProfile, lang } from "../shell.ts";

/** "Plan 1,434 + burned 187 ›" — null unless a burn was actually added to this day's goal. */
export function goalLine(day: DayResponse): HTMLElement | null {
  if (day.goal.burned <= 0) return null;
  const c = goalCopyFor(lang);
  const kn = kcalNumbers(lang);
  const line = el("button", "gline") as HTMLButtonElement;
  line.type = "button";
  line.setAttribute("aria-label", c.total);
  line.append(document.createTextNode(fill(c.homeLine, { plan: kn(day.goal.plan), b: kn(day.goal.burned) })), kitEl(ico("chevron-right")));
  line.addEventListener("click", () => openGoalSheet(day, true));
  return line;
}

/** The sum for one day. `burnedOn`: the account has the add-back on, so the burned row is drawn. */
export function openGoalSheet(day: DayResponse, burnedOn: boolean): void {
  const c = goalCopyFor(lang);
  const kn = kcalNumbers(lang);
  const g = day.goal;
  const { card, close } = openDialog(c.total);
  const row = (label: string, sub: string, value: string, muted = false): HTMLElement => {
    const r = el("div", `gl-row${muted ? " m" : ""}`);
    const text = el("div", "gl-t", label);
    if (sub !== "") text.append(el("div", "t13 m", sub));
    r.append(text, el("b", "num", value));
    return r;
  };
  card.append(el("b", "d d20", c.total), row(c.plan, "", kn(g.plan)));
  if (burnedOn) {
    card.append(g.active === null || g.usual === null
      ? row(c.noData, "", "—", true)
      : row(c.burned, fill(c.burnedSub, { a: kn(g.active), c: kn(g.usual) }), `+${kn(g.burned)}`));
  }
  const total = el("div", "gl-total");
  total.append(el("span", "d d17", c.total), el("b", "d d28 num", kn(day.targets.kcal)));
  card.append(total, el("p", "gl-floor", fill(c.floor, { floor: kn(g.floor) })));
  const change = el("a", "elink", c.change) as HTMLAnchorElement;
  change.href = "#/you";
  change.addEventListener("click", close);
  card.append(change);
  card.focus();
}

/** Profile's "Your daily goal" card: one switch, saved on tap and put back when the save fails. */
export function goalPrefsCard(me: ProfileResponse, onSaved: (res: ProfileResponse) => void): HTMLElement {
  const c = goalCopyFor(lang);
  const card = el("div", "card flat urows");
  card.append(el("span", "lab", c.prefsTitle));
  const row = el("div", "opt sw");
  const text = el("div", "ot");
  const lab = el("span", "ot", c.prefsBurned);
  lab.id = "goal-addback_burned";
  text.append(lab, el("div", "sub", c.prefsBurnedSub));
  const sw = el("button", "swt") as HTMLButtonElement;
  sw.type = "button";
  sw.setAttribute("role", "switch");
  sw.setAttribute("aria-labelledby", lab.id);
  sw.append(el("i", ""));
  const paint = (on: boolean): void => sw.setAttribute("aria-checked", String(on));
  paint(me.profile.addback_burned);
  let saving = false;
  sw.addEventListener("click", () => {
    if (saving) return;
    const was = sw.getAttribute("aria-checked") === "true";
    saving = true; paint(!was);
    api<ProfileResponse>("/profile", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ addback_burned: !was }),
    }).then((res) => { forgetProfile(); onSaved(res); })
      .catch((err: unknown) => { console.error(err); paint(was); })
      .finally(() => { saving = false; });
  });
  row.append(text, sw);
  card.append(row);
  return card;
}
