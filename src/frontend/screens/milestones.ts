// Milestones (ieat-app#1395, part 3): the badge wall, the streak card on Progress, the Badge
// Unlocked dialog Home opens, and Profile › Milestones with its two switches. The boards are
// `web/milestones*.html`; the streak, the badges and the floor are all the server's — nothing
// here counts a day or decides a badge.

import { BADGES } from "../../shared/milestones.ts";
import { countText, numbers, weekdayLetters } from "../../shared/lang.ts";
import { milestonesCopyFor, streakCardLine, type MilestonesCopy } from "../../shared/app/milestones-copy.ts";
import { ico } from "../../shared/ui/kit.ts";
import type { DaysResponse, DiaryDay, MilestonesResponse, ProfileResponse } from "@eait/shared";
import { api, getMilestones, postMilestonesSeen } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { kitEl } from "../kit.ts";
import { openDialog } from "../panel.ts";
import { el, forgetProfile, kcal, lang, refusalWords, type Frame } from "../shell.ts";

const BADGE_BY_ID = new Map(BADGES.map((b) => [b.id, b]));
export const medalSrc = (id: string): string => `/medals/${id}.webp`;
const FLAME = "37-hdr-flame";
const GEM = "38-hdr-gem";
const TOTAL = BADGES.length;

const img = (id: string, className = ""): HTMLImageElement => {
  const i = el("img", className) as HTMLImageElement;
  i.src = medalSrc(id);
  i.alt = "";
  return i;
};

/** The streak card's door: "Milestones · 10/36 badges ›" — `earned` null (read failed) hides the count. */
const milestonesRow = (c: MilestonesCopy, earned: number | null): HTMLAnchorElement => {
  const a = el("a", "mrow") as HTMLAnchorElement;
  a.href = "#/milestones";
  const side = el("span", "");
  if (earned !== null) side.append(fill(c.badgesOf, { n: String(earned), total: String(TOTAL) }));
  side.append(kitEl(ico("chevron-right")));
  a.append(el("b", "", c.title), side);
  return a;
};

/**
 * The Progress streak card, in its four states (web/milestones-streak.html): holding, bent by a
 * missed day, bent by the floor, ended. `d.days` is the week the card draws; the figures and the
 * floor come off the same read.
 */
export function streakCard(d: DaysResponse, earned: number | null): HTMLElement {
  const c = milestonesCopyFor(lang);
  const s = c.streak;
  const n = numbers(lang);
  const letters = weekdayLetters(lang);
  const count = countText(lang);

  const ended = d.streakState === "ended";
  const bentState = d.streakState === "bent";

  const card = el("div", "card rise rc-3");
  const head = el("div", "row between");
  const msk = el("div", ended ? "msk off" : "msk");
  msk.append(img(FLAME));
  const fig = el("div", "");
  fig.append(
    el("div", "big num", n(d.streak)),
    el("div", "t13 m", count(ended ? s.days : bentState ? s.dayStreakHeld : s.dayStreak, d.streak)),
  );
  msk.append(fig);
  const longest = el("div", "");
  longest.style.textAlign = "right";
  longest.append(el("div", "lab", s.longest), el("b", "num", n(d.streakLongest)));
  head.append(msk, longest);
  card.append(head);

  const marks = el("div", "marks");
  d.days.forEach((day: DiaryDay, i) => {
    const cell = el("div", "");
    const dot = el("i", day.streak === "counted" ? "ok" : day.streak === "bent" ? "bent" : day.when === "today" ? "today" : "");
    if (day.streak === "counted") dot.append(kitEl(ico("check")));
    cell.append(dot, letters[i] ?? "");
    if (day.streak === "bent" && day.underFloor) cell.append(el("small", "", s.floor));
    marks.append(cell);
  });
  card.append(marks);

  const line = streakCardLine(d, s, lang, kcal(d.floorKcal));
  if (line !== null) {
    const p = el("div", "sline");
    if (line.lead !== undefined) p.append(el("b", "", line.lead), line.rest !== undefined ? ` ${line.rest}` : "");
    else p.append(line.rest ?? "");
    card.append(p);
  }
  card.append(milestonesRow(c, earned));
  return card;
}

/** How many of the 36 this account holds, or null when the read failed or milestones are off. */
export const earnedCount = (m: MilestonesResponse | null): number | null =>
  m === null ? null : m.badges.filter((b) => b.earnedAt !== null).length;

/** `#/milestones` — Day Streak and Badges earned on the left, the 36 badges in six columns. */
export async function milestonesScreen(_frame: Frame): Promise<HTMLElement> {
  const c = milestonesCopyFor(lang);
  const n = numbers(lang);
  const count = countText(lang);
  let m: MilestonesResponse;
  try {
    m = await getMilestones();
  } catch (err) {
    const wrap = el("section", "");
    wrap.append(el("p", "notice", refusalWords(err)));
    return wrap;
  }
  const earnedAt = new Map(m.badges.map((b) => [b.id, b.earnedAt]));
  const earned = [...earnedAt.values()].filter((x) => x !== null).length;

  const wrap = el("section", "mls");
  const left = el("div", "mcol");
  const top = el("div", "mtop");
  const back = el("a", "ib") as HTMLAnchorElement;
  back.href = "#/progress";
  back.setAttribute("aria-label", c.back);
  back.append(kitEl(ico("chevron-left")));
  top.append(back, el("h1", "d d22", c.title));

  const hd = el("div", "mhd");
  for (const [id, label, figure] of [[FLAME, c.dayStreak, m.streak], [GEM, c.badgesEarned, earned]] as const) {
    const cell = el("div", "");
    const mic = el("span", "mic");
    mic.append(img(id), el("i", "", n(figure)));
    cell.append(mic, el("b", "", label));
    hd.append(cell);
  }

  const st = el("div", "mst");
  const streakCell = el("div", "");
  streakCell.append(img(FLAME));
  const sp = el("p", "");
  sp.append(el("b", "num", count(c.longestDays, m.streakLongest)), el("br", ""), c.longestLabel);
  streakCell.append(sp);
  const gemCell = el("div", "");
  gemCell.append(img(GEM));
  const gp = el("p", "");
  const bar = el("span", "mprog");
  const fillBar = el("i", "");
  fillBar.style.width = `${Math.round((earned / TOTAL) * 100)}%`;
  bar.append(fillBar);
  gp.append(el("b", "num", fill(c.badgesOf, { n: n(earned), total: n(TOTAL) })), bar);
  gemCell.append(gp);
  st.append(streakCell, gemCell);
  left.append(top, hd, st);

  const card = el("div", "card mwall");
  const wall = el("div", "bwall");
  for (const b of BADGES) {
    const got = earnedAt.get(b.id) != null;
    const cell = el("div", got ? "bdg got" : "bdg lk");
    cell.setAttribute("role", "img");
    cell.setAttribute("aria-label", `${b.name}, ${b.rule}, ${got ? c.earned : c.locked}`);
    cell.append(img(b.id, "medal"), el("b", "", b.name), el("small", "", b.rule));
    wall.append(cell);
  }
  card.append(wall);
  wrap.append(left, card);
  return wrap;
}

/** Share on a browser that can: the medal as a file through the system sheet. Unsupported → no button. */
async function shareMedal(id: string, name: string): Promise<void> {
  const blob = await (await fetch(medalSrc(id))).blob();
  const file = new File([blob], `${id}.webp`, { type: blob.type || "image/webp" });
  await navigator.share({ files: [file], title: name });
}

const canShareFiles = (): boolean =>
  typeof navigator.canShare === "function" && typeof File === "function" &&
  navigator.canShare({ files: [new File([], "x.webp", { type: "image/webp" })] });

/**
 * Badge Unlocked. `unseen` is oldest-first, so the last is the newest: ONE dialog for it, and every
 * unseen id is marked seen in one POST — a first read after deploy can hold ten and never queues a
 * run of screens. Callers gate on `milestone_celebrations`.
 */
export function badgeUnlocked(unseen: readonly string[]): void {
  const id = unseen[unseen.length - 1];
  const badge = id === undefined ? undefined : BADGE_BY_ID.get(id);
  if (id === undefined || badge === undefined) return;
  void postMilestonesSeen([...unseen]).catch((err: unknown) => console.error(err));

  const c = milestonesCopyFor(lang).unlock;
  const { card, close } = openDialog(c.heading);
  card.classList.add("mu");
  const x = el("button", "ib mux") as HTMLButtonElement;
  x.type = "button";
  x.setAttribute("aria-label", c.close);
  x.append(kitEl(ico("x")));
  x.addEventListener("click", close);

  const body = el("div", "ul");
  body.append(img(id), el("div", "cap", c.heading), el("h2", "nm", badge.name), el("div", "cr", badge.rule));

  const actions = el("div", "ulb");
  if (canShareFiles()) {
    const share = el("button", "b1", c.share) as HTMLButtonElement;
    share.type = "button";
    share.addEventListener("click", () => { void shareMedal(id, badge.name).catch(() => {}); });
    actions.append(share);
  }
  const all = el("button", "b2") as HTMLButtonElement;
  all.type = "button";
  all.append(img(GEM), c.viewAll);
  all.addEventListener("click", () => { close(); location.hash = "#/milestones"; });
  const off = el("button", "off", c.notEnjoying) as HTMLButtonElement;
  off.type = "button";
  off.addEventListener("click", () => { close(); location.hash = "#/you/milestones"; });
  actions.append(all, off);

  card.append(x, body, actions);
}

/** `#/you/milestones` — Badge celebrations and Streak on Home, both on by default. */
export function milestoneSettingsScreen(frame: Frame): HTMLElement {
  const c = milestonesCopyFor(lang);
  const s = c.settings;
  let me: ProfileResponse | null = frame.me;
  const wrap = el("section", "mset");
  const top = el("div", "mtop");
  const back = el("a", "ib") as HTMLAnchorElement;
  back.href = "#/you";
  back.setAttribute("aria-label", c.back);
  back.append(kitEl(ico("chevron-left")));
  top.append(back, el("h1", "d d22", c.title));

  const notice = el("p", "notice");
  notice.setAttribute("role", "alert");
  notice.hidden = true;

  const card = el("div", "card flat urows");
  const make = (key: "milestone_celebrations" | "streak_on_home", label: string, sub: string): HTMLElement => {
    const row = el("div", "opt sw");
    const text = el("div", "ot");
    const lab = el("span", "ot", label);
    lab.id = `mset-${key}`;
    text.append(lab, el("div", "sub", sub));
    const sw = el("button", "swt") as HTMLButtonElement;
    sw.type = "button";
    sw.setAttribute("role", "switch");
    sw.setAttribute("aria-labelledby", lab.id);
    sw.append(el("i", ""));
    const paint = (on: boolean): void => sw.setAttribute("aria-checked", String(on));
    paint(me?.profile[key] ?? true);
    let saving = false;
    sw.addEventListener("click", () => {
      if (saving) return;
      const was = sw.getAttribute("aria-checked") === "true";
      saving = true; notice.hidden = true; paint(!was);
      api<ProfileResponse>("/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ [key]: !was }),
      }).then((res) => { me = res; forgetProfile(); })
        .catch((err: unknown) => {
          console.error(err);
          paint(was);
          notice.textContent = s.saveFailed;
          notice.hidden = false;
        })
        .finally(() => { saving = false; });
    });
    row.append(text, sw);
    return row;
  };
  card.append(
    make("milestone_celebrations", s.celebrations, s.celebrationsSub),
    make("streak_on_home", s.streakOnHome, s.streakOnHomeSub),
  );
  wrap.append(top, card, notice, el("p", "mnote", s.note));
  return wrap;
}
