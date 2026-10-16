// The day's goal, explained (#911; boards `web-pw3-goal*`, `web-pw3-prefs`): the quiet line under
// Home's hero when a burn or a rollover was added, the dialog it opens with the sum, and the two switches on Profile.
// Every figure is the server's (`DayResponse.goal`, off `explainTargets`) — nothing is added up here.

import type { DayResponse, Profile, ProfileResponse } from "@eait/shared";
import { goalCopyFor } from "../../shared/app/goal-copy.ts";
import { kcalNumbers } from "../../shared/lang.ts";
import { ico } from "../../shared/ui/kit.ts";
import { api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { kitEl } from "../kit.ts";
import { openDialog } from "../panel.ts";
import { el, forgetProfile, lang } from "../shell.ts";

/** "Plan 1,434 + burned 187 + yesterday 144 ›" — null unless something was added to this day's goal. */
export function goalLine(day: DayResponse, profile: Profile): HTMLElement | null {
  const { plan, burned, rollover } = day.goal;
  if (burned <= 0 && rollover <= 0) return null;
  const c = goalCopyFor(lang);
  const kn = kcalNumbers(lang);
  const words = burned > 0 && rollover > 0 ? fill(c.homeLineBoth, { plan: kn(plan), b: kn(burned), r: kn(rollover) })
    : burned > 0 ? fill(c.homeLine, { plan: kn(plan), b: kn(burned) })
    : fill(c.homeLineYesterday, { plan: kn(plan), r: kn(rollover) });
  const line = el("button", "gline") as HTMLButtonElement;
  line.type = "button";
  line.setAttribute("aria-label", c.total);
  line.append(document.createTextNode(words), kitEl(ico("chevron-right")));
  line.addEventListener("click", () => openGoalSheet(day, profile));
  return line;
}

/** The sum for one day: a row for each switch the account has on. */
export function openGoalSheet(day: DayResponse, profile: Profile): void {
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
  if (profile.addback_burned) {
    card.append(g.active === null || g.usual === null
      ? row(c.noData, c.noDataSub, "—", true)
      : row(c.burned, fill(c.burnedSub, { a: kn(g.active), c: kn(g.usual) }), `+${kn(g.burned)}`));
  }
  if (profile.addback_rollover) {
    card.append(row(c.rollover, c.rolloverSub, g.rollover > 0 ? `+${kn(g.rollover)}` : "—", g.rollover <= 0));
  }
  const total = el("div", "gl-total");
  total.append(el("span", "d d17", c.total), el("b", "d d28 num", kn(day.targets.kcal)));
  card.append(total, el("p", "gl-floor", fill(c.floor, { floor: kn(g.floor) })));
  const change = el("a", "gl-change", c.change) as HTMLAnchorElement;
  change.href = "#/you";
  change.addEventListener("click", close);
  card.append(change);
  card.focus();
}

/** Profile's "Your daily goal" card: a switch per add-back, saved on tap and put back when the save fails. */
export function goalPrefsCard(me: ProfileResponse, onSaved: (res: ProfileResponse) => void): HTMLElement {
  const c = goalCopyFor(lang);
  const card = el("div", "card rise rc-1");
  const rows = el("div", "urows");
  card.append(el("span", "lab", c.prefsTitle), rows);
  const make = (key: "addback_burned" | "addback_rollover", label: string, sub: string): HTMLElement => {
    const row = el("div", "opt sw");
    const text = el("div", "ot");
    const lab = el("span", "ot", label);
    lab.id = `goal-${key}`;
    text.append(lab, el("div", "sub", sub));
    const sw = el("button", "swt") as HTMLButtonElement;
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-labelledby", lab.id);
    sw.append(el("i", ""));
    const paint = (on: boolean): void => sw.setAttribute("aria-checked", String(on));
    paint(me.profile[key]);
    let saving = false;
    sw.addEventListener("click", () => {
      if (saving) return;
      const was = sw.getAttribute("aria-checked") === "true";
      saving = true; paint(!was);
      api<ProfileResponse>("/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: !was }),
      }).then((res) => { forgetProfile(); onSaved(res); })
        .catch((err: unknown) => { console.error(err); paint(was); })
        .finally(() => { saving = false; });
    });
    row.append(text, sw);
    return row;
  };
  rows.append(
    make("addback_burned", c.prefsBurned, c.prefsBurnedSub),
    make("addback_rollover", c.prefsRollover, c.prefsRolloverSub),
  );
  return card;
}
