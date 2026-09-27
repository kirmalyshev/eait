// The meal detail — `#/meal/:id`, Register P's W6 (#93).
//
// THE BOARD IS MASTER-DETAIL (web/meal.html): the day's meals stay in a column on the left while
// the card on the right carries the photo edge to edge beside the sheet — name and kcal, the
// three macro tiles, the computed health-score row, the ingredients with their own kcal, the
// verdict dots, and the one fix. From web/meal-delete.html (design-pro, on the issue) the card
// takes its header row: X on the left, the meal's day and time in the middle, the "…" menu on the
// right; X or Esc returns to the diary (`#/`), and the menu is the phone's (meal-menu.html): Edit,
// Re-read the photo, Move to yesterday, Delete — which asks first, over the master-detail.
//
// "Correct" is NOT a state of this screen: it navigates to `#/chat?focus=<id>` (the contract's
// focusMealId), per design-pro — the board draws it in the Chat frame and she stays there. The
// score row opens the `web/meal-score.html` overlay in place, and a deleted, moved-away or
// foreign id resolves to the gone state — the server scopes the read, so "another user's meal"
// and "no meal" are the same answer and the same panel.

import { dateMinus, isCalendarDate, localTime } from "../../shared/dates.ts";
import { LANG_TAG, numbers, spellUnit, wholeNumbers } from "../../shared/lang.ts";
import { mealCopyFor } from "../../shared/app/meal-copy.ts";
import { scoreFactorLabel, scoresCopy } from "../../shared/scores-copy.ts";
import { HEALTH_SCORE, type ScorePart } from "../../shared/scores.ts";
import type { MealRecord } from "@eait/shared";
import type { DayResponse } from "@eait/shared/contract";
import type { MealUpdated } from "../../shared/results.ts";
import { api, apiBlob } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { esc, ico } from "../../shared/ui/kit.ts";
import type { IconName } from "../../shared/ui/icons.ts";
import {
  ingredientEl, kitEl, mcardEl, mealRowEl, scorePartEl, scoreRowEl, verdictListEl, verdictWords,
} from "../kit.ts";
import {
  COPY, MEAL, clear, el, findMeal, lang, names, profile, sendOrKeep, setRedraw, takeTurn,
  type Frame,
} from "../shell.ts";

export async function mealScreen(frame: Frame): Promise<HTMLElement> {
  const mc = mealCopyFor(lang);
  const sc = scoresCopy(lang);
  const me = frame.me ?? await profile().catch(() => null);
  const uid = me?.profile.user_id ?? null;
  const zone = me?.timezone ?? "UTC";
  const n = wholeNumbers(lang);
  const num = numbers(lang);

  // THE ROUTE: `#/meal/<id>` on its own, or `#/meal/<id>?d=<YYYY-MM-DD>` — the day its row was on,
  // so the left column opens on the right diary and a bare id is looked up (`findMeal` walks the
  // logged days back through the window).
  const [path, query] = location.hash.split("?");
  const id = decodeURIComponent((path ?? "").replace(/^#\/meal\//, ""));
  const asked = new URLSearchParams(query ?? "").get("d");
  let viewing: string | undefined = asked !== null && isCalendarDate(asked) ? asked : undefined;

  // Relative day names for the meta line and header ("Today · 13:05"), the date in full for the
  // diary's own label — the boards write "Thursday 24 September" over the list.
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const dayFmt = new Intl.DateTimeFormat(LANG_TAG[lang], {
    timeZone: "UTC", weekday: "long", day: "numeric", month: "long",
  });
  const dateText = (d: string): string => dayFmt.format(new Date(`${d}T12:00:00Z`));
  const dayName = (d: string): string =>
    d === today ? COPY.today : d === dateMinus(today, 1) ? COPY.yesterday : dateText(d);
  const mealTime = (m: MealRecord): string => localTime(zone, new Date(m.ts));
  const meta = (m: MealRecord): string =>
    fill((m.photos ?? 0) > 0 ? mc.metaPhoto : mc.sheetWhen, { day: dayName(m.date), time: mealTime(m) });

  const wrap = el("section", "mdetail");
  const left = el("div", "wcol");
  const right = el("div", "wcol");
  wrap.append(left, right);
  const notice = el("p", "notice");
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  const tell = (words: string | null): void => {
    notice.textContent = words ?? "";
    notice.hidden = words === null;
  };

  // One overlay at a time — the delete dialog or the score breakdown. `overlay` is what Esc and
  // a scrim tap close.
  let overlay: HTMLElement | null = null;
  const closeOverlay = (): void => { overlay?.remove(); overlay = null; };
  const openOverlay = (node: HTMLElement): void => { closeOverlay(); wrap.append(node); overlay = node; };

  // The photo bytes arrive under the bearer, so they are blob URLs — revoked when the next draw
  // replaces them, or every open of this screen would pin another copy of every thumbnail.
  let blobs: string[] = [];
  const photoUrl = async (mealId: string, index: number): Promise<string | null> => {
    try {
      const url = URL.createObjectURL(await apiBlob(`${MEAL(mealId)}/photos/${index}`));
      blobs.push(url);
      return url;
    } catch {
      return null;
    }
  };

  const closeToDiary = (): void => { location.hash = "#/"; };
  document.addEventListener("keydown", function onKey(e) {
    if (!wrap.isConnected) { document.removeEventListener("keydown", onKey); return; }
    if (e.key !== "Escape") return;
    if (overlay !== null) closeOverlay(); else closeToDiary();
  });

  const iconButton = (icon: IconName, label: string): HTMLButtonElement => {
    const b = el("button", "ib") as HTMLButtonElement;
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.append(kitEl(ico(icon)));
    return b;
  };

  const goneCard = (): HTMLElement => {
    const card = el("div", "card mgone");
    card.append(el("b", "d d22", mc.webGoneTitle), el("p", "t13 m", mc.webGoneBody));
    const back = el("a", "cta s", mc.webGoneBack) as HTMLAnchorElement;
    back.href = "#/";
    card.append(back);
    return card;
  };

  /** The score's breakdown overlay (`web/meal-score.html`): the base row, then each part. */
  const scoreOverlay = (meal: MealRecord, day: DayResponse): HTMLElement => {
    const hs = meal.healthScore!;
    const scrim = el("div", "mscrim");
    scrim.addEventListener("click", (e) => { if (e.target === scrim) closeOverlay(); });
    const dlg = el("div", "card mscore rise");
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-label", sc.title);
    const head = kitEl(`<div class="row between"><b class="d d22">${esc(sc.title)}</b>` +
      `<b class="d d28 num">${esc(fill(sc.outOf, { n: n(hs.score) }))}</b></div>`);
    dlg.append(head, el("p", "t13 m mnote", sc.method));
    dlg.append(scorePartEl({ name: sc.startRow, points: `${HEALTH_SCORE.base}` }));
    const pts = (p: number): string => (p > 0 ? `+${n(p)}` : p < 0 ? `−${n(-p)}` : "0");
    const measure = (p: ScorePart): string => {
      if (p.density === null) return sc.notRead;
      switch (p.factor) {
        case "protein": case "sugar":
          return fill(sc.partPctOfKcal, { n: n(p.density) });
        case "fibre":
          return fill(sc.partGPer100Kcal, { n: num(p.density) });
        case "salt":
          return p.limit === "kidneys" && day.targets.sodium_mg !== undefined
            ? fill(sc.partOfTargetMg, { n: n(meal.sodium_mg), target: n(day.targets.sodium_mg) })
            : fill(sc.partMgSodiumPer100Kcal, { n: n(p.density) });
        case "satfat":
          return p.limit === "ldl" && day.targets.satfat_g !== undefined
            ? fill(sc.partOfTargetG, { n: n(meal.satfat_g), target: n(day.targets.satfat_g) })
            : fill(sc.partPctOfKcal, { n: n(p.density) });
      }
    };
    for (const p of hs.parts) {
      dlg.append(scorePartEl({
        name: scoreFactorLabel(p.factor, lang),
        measure: measure(p),
        ...(p.limit !== undefined ? { limit: sc.limits[p.limit] } : {}),
        points: pts(p.points),
      }));
    }
    const done = kitEl(`<button type="button" class="cta p">${esc(mc.phoneDone)}</button>`);
    done.addEventListener("click", closeOverlay);
    dlg.append(done);
    scrim.append(dlg);
    return scrim;
  };

  const deleteDialog = (meal: MealRecord): HTMLElement => {
    const scrim = el("div", "mscrim hard");
    scrim.addEventListener("click", (e) => { if (e.target === scrim) closeOverlay(); });
    const dlg = el("div", "card rise mdel");
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-label", mc.deleteTitle);
    dlg.append(el("div", "d d22", mc.deleteTitle), el("p", "t13 m", mc.deleteBody));
    const buttons = kitEl(`<div class="row mrow">` +
      `<button type="button" class="cta s">${esc(mc.cancelCta)}</button>` +
      `<button type="button" class="cta danger">${esc(mc.deleteCta)}</button></div>`);
    const [cancel, del] = [...buttons.querySelectorAll("button")] as HTMLButtonElement[];
    cancel!.addEventListener("click", closeOverlay);
    del!.addEventListener("click", () => {
      closeOverlay();
      turn(() => api(`${MEAL(meal.id)}`, { method: "DELETE" }));
    });
    dlg.append(buttons);
    scrim.append(dlg);
    return scrim;
  };

  const menuButton = (meal: MealRecord): HTMLElement => {
    const box = el("div", "mwrap");
    const btn = iconButton("dots", mc.menuButton);
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    const popup = el("div", "mpopup");
    popup.hidden = true;
    const item = (icon: IconName, label: string, onPick: () => void): HTMLButtonElement => {
      const b = el("button", "mi") as HTMLButtonElement;
      b.type = "button";
      b.append(kitEl(ico(icon)), document.createTextNode(label));
      b.addEventListener("click", () => { popup.hidden = true; onPick(); });
      return b;
    };
    const reread = item("retry", mc.phoneMenuReread, () =>
      turn(async () => {
        const r = await api<MealUpdated>(`${MEAL(meal.id)}/reanalyze`, { method: "POST" });
        void r;
      }));
    // Nothing to re-read without a photo — the row is present but inert, never a dead tap.
    if ((meal.photos ?? 0) === 0) reread.disabled = true;
    const del = item("trash", mc.deleteCta, () => openOverlay(deleteDialog(meal)));
    del.classList.add("bad");
    popup.append(
      item("pencil", mc.phoneEdit, () => {
        location.hash = `#/chat?focus=${encodeURIComponent(meal.id)}`;
      }),
      reread,
      item("calendar-back", mc.phoneMenuMoveYesterday, () =>
        turn(() => sendOrKeep({
          id: crypto.randomUUID(), userId: uid ?? "", kind: "text",
          // The menu item's own words are the turn — the edit is just a chat (the boards' flow),
          // and the router reads a re-date out of them with the meal in focus.
          text: mc.phoneMenuMoveYesterday, photos: [], capturedAt: new Date().toISOString(),
          focusMealId: meal.id,
        }, {
          // The meal left this day: follow it there rather than draw the day without it.
          onResult: (r) => {
            if (r.kind === "redated") location.hash = `#/meal/${encodeURIComponent(meal.id)}?d=${r.date}`;
          },
        }))),
      del,
    );
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      popup.hidden = !popup.hidden;
      btn.setAttribute("aria-expanded", `${!popup.hidden}`);
    });
    // A tap anywhere else puts it away; the listener cleans itself up when the screen is gone.
    document.addEventListener("click", function away(e) {
      if (!wrap.isConnected) { document.removeEventListener("click", away); return; }
      if (!popup.hidden && !(e.target as Node | null)?.isSameNode(btn) && !popup.contains(e.target as Node)) {
        popup.hidden = true;
        btn.setAttribute("aria-expanded", "false");
      }
    });
    box.append(btn, popup);
    return box;
  };

  /** The hero's photo — fetched through the bearer as a blob, or the tinted chat tile. */
  const hero = (meal: MealRecord): HTMLElement => {
    const box = el("div", "hero");
    if ((meal.photos ?? 0) === 0) {
      box.classList.add("mnoimg");
      box.append(kitEl(ico("chat")));
      return box;
    }
    const img = el("img", "") as HTMLImageElement;
    img.alt = names(meal.items);
    box.append(img);
    void photoUrl(meal.id, 0).then((src) => {
      if (!box.isConnected) return;
      if (src === null) {
        img.remove();
        box.classList.add("mnoimg");
        box.append(kitEl(ico("chat")));
      } else {
        img.src = src;
      }
    });
    return box;
  };

  const detailCard = (meal: MealRecord, day: DayResponse): HTMLElement => {
    const card = el("div", "card mdet");

    // The header row the delete board gives the card: X left, day · time (and provenance) in the
    // middle, the "…" menu on the right.
    const head = el("div", "mhead");
    const close = iconButton("x", mc.webGoneBack);
    close.addEventListener("click", closeToDiary);
    const mid = el("div", "mh");
    mid.append(
      el("b", "", fill(mc.sheetWhen, { day: dayName(meal.date), time: mealTime(meal) })),
      el("small", "", (meal.photos ?? 0) > 0 ? mc.webLoggedPhoto : mc.roughEstimate),
    );
    head.append(close, mid, menuButton(meal));
    card.append(head);

    const split = el("div", "msplit");
    split.append(hero(meal));
    const sheet = el("div", "msheet");
    sheet.append(kitEl(`<div class="row between"><div><b class="d d22">${esc(names(meal.items))}</b>` +
      `<div class="t13 m mmeta">${esc(meta(meal))}</div></div>` +
      `<span class="row kfig"><i class="ico i-kcal"></i><b class="d d28 num">${esc(n(meal.kcal))}</b></span></div>`));
    const tiles = el("div", "mcards");
    for (const [macro, value, label] of [
      ["protein", `${n(meal.protein_g)} ${spellUnit(lang, "g")}`, mc.macroProtein],
      ["carbs", `${n(meal.carbs_g)} ${spellUnit(lang, "g")}`, mc.macroCarbs],
      ["fat", `${n(meal.fat_g)} ${spellUnit(lang, "g")}`, mc.macroFat],
    ] as const) {
      tiles.append(mcardEl({ macro, value, label, centred: true }));
    }
    sheet.append(tiles);
    // The health score is the SERVER'S (`MealRecord.healthScore`, S10): drawn, never computed here.
    if (meal.healthScore !== null) {
      const row = scoreRowEl({
        label: sc.title,
        score: fill(sc.outOf, { n: n(meal.healthScore.score) }),
        pct: meal.healthScore.score * 10,
      });
      row.addEventListener("click", () => openOverlay(scoreOverlay(meal, day)));
      sheet.append(row);
    }
    for (const item of meal.items) {
      sheet.append(ingredientEl({
        name: item.name,
        amount: `${n(item.grams)} ${spellUnit(lang, "g")}`,
        ...(item.kcal !== undefined ? { kcal: n(item.kcal) } : {}),
      }));
    }
    const verdicts = verdictListEl(verdictWords(meal.verdicts));
    if (verdicts !== null) sheet.append(verdicts);
    const correct = kitEl(`<a class="cta s">${esc(mc.webCorrect)}</a>`) as HTMLAnchorElement;
    correct.href = `#/chat?focus=${encodeURIComponent(meal.id)}`;
    sheet.append(correct);
    split.append(sheet);
    card.append(split);
    return card;
  };

  const turn = (write: () => Promise<string | void>): void => takeTurn(wrap, tell, draw, uid, write);

  const draw = async (): Promise<void> => {
    for (const u of blobs) URL.revokeObjectURL(u);
    blobs = [];
    const { day, meal } = await findMeal(id, zone, viewing);
    viewing = day.date;
    // The top bar's right side is this screen's own — the day it looks at, stepped by the
    // chevrons, as the boards draw the date row on every meal frame.
    clear(frame.bar);
    const prev = iconButton("chevron-left", COPY.dayPrev);
    prev.addEventListener("click", () => { location.hash = `#/meal/${encodeURIComponent(id)}?d=${dateMinus(viewing!, 1)}`; });
    const next = iconButton("chevron-right", COPY.dayNext);
    if (viewing >= today) next.disabled = true;
    next.addEventListener("click", () => { location.hash = `#/meal/${encodeURIComponent(id)}?d=${dateMinus(viewing!, -1)}`; });
    frame.bar.append(prev, el("span", "", dateText(viewing)), next);

    clear(left);
    left.append(el("span", "lab", dateText(day.date)));
    const rows = el("div", "card mlist");
    for (const m of day.meals) {
      const src = (m.photos ?? 0) > 0 ? await photoUrl(m.id, 0) : null;
      const row = mealRowEl(m, {
        time: mealTime(m),
        photo: src !== null ? { src } : null,
        ...(m.confidence === "low" && !m.corrected ? { note: mc.roughEstimate } : {}),
        href: `#/meal/${encodeURIComponent(m.id)}?d=${day.date}`,
      });
      if (m.id === meal?.id) row.classList.add("sel");
      rows.append(row);
    }
    left.append(rows);
    clear(right).append(notice, meal === null ? goneCard() : detailCard(meal, day));
  };

  // A queued turn that lands while this screen is up — a correction sent from the chat, or a kept
  // move — changes the numbers under it, so the detail redraws like the diary does.
  setRedraw(async () => {
    if (!wrap.isConnected) return;
    await draw();
  });

  await draw();
  return wrap;
}
