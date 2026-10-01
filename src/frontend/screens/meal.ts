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
// THE EDIT IS CAL AI'S LAYOUT, not a chat (#188, Kirill 21:58). "Correct this meal" and the
// menu's Edit open `web/meal-fix.html` — a PANEL over this detail: one field, an example, Update,
// which sends the sentence as the correction turn (the contract's `focusMealId`, unchanged) and
// returns here recomputed (ieat-app#1374 — no change line).
// An ingredient row opens `web/meal-ingredient.html` — grams, the item's and the meal's kcal live, a bin that
// removes it, Done — a `PATCH /v1/meals/:id`, the same write the first-meal editor sends. Other
// surfaces deep-link in: `#/meal/<id>?fix` opens the fix panel, `#/meal/<id>?item=<n>` the
// ingredient's. The score row opens `web/meal-score.html`, and a deleted, moved-away or foreign
// id resolves to the gone state — the server scopes the read, so "another user's meal" and "no
// meal" are the same answer and the same panel.

import { dateMinus, isCalendarDate, localDate, localTime } from "../../shared/dates.ts";
import { LANG_TAG, UNIT_KCAL, kcalNumbers, numbers, spellUnit, wholeNumbers } from "../../shared/lang.ts";
import { mealEditParams, mealEditRequest, previewKcal, scaledItem } from "../../shared/meal-edit.ts";
import { mealCopyFor } from "../../shared/app/meal-copy.ts";
import { chatScreenCopyFor } from "../../shared/app/chat-copy.ts";
import { scoreFactorLabel, scoresAppCopy } from "../../shared/app/scores-copy.ts";
import type { ScorePart } from "../../shared/scores.ts";
import type { MealItem, MealRecord } from "@eait/shared";
import type { DayResponse } from "@eait/shared/contract";
import type { MealRedated, MealUpdated, TargetGone } from "../../shared/results.ts";
import { api, apiBlob } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { esc, ico } from "../../shared/ui/kit.ts";
import type { IconName } from "../../shared/ui/icons.ts";
import {
  blobSrc, ingredientEl, kitEl, mcardEl, mealRowEl, photoHeroEl, scorePartEl, scoreRowEl,
  verdictListEl,
} from "../kit.ts";
import {
  COPY, MEAL, clear, dayText, el, findMeal, lang, names, profile, sendOrKeep, setRedraw, takeTurn,
  type Frame,
} from "../shell.ts";

export async function mealScreen(frame: Frame): Promise<HTMLElement> {
  const mc = mealCopyFor(lang);
  const cc = chatScreenCopyFor(lang);
  const sc = scoresAppCopy(lang);
  const me = frame.me ?? await profile().catch(() => null);
  const uid = me?.profile.user_id ?? null;
  const zone = me?.timezone ?? "UTC";
  const n = wholeNumbers(lang);
  const kn = kcalNumbers(lang);
  const num = numbers(lang);

  // THE ROUTE: `#/meal/<id>` on its own, or `#/meal/<id>?d=<YYYY-MM-DD>` — the day its row was on,
  // so the left column opens on the right diary and a bare id is looked up (`findMeal` walks the
  // logged days back through the window). `?fix` and `?item=<n>` are the deep links the OTHER
  // surfaces take into the panels (#188) — consumed once, then stripped so a redraw does not
  // reopen them.
  const [path, query] = location.hash.split("?");
  const id = decodeURIComponent((path ?? "").replace(/^#\/meal\//, ""));
  const asked = new URLSearchParams(query ?? "").get("d");
  let viewing: string | undefined = asked !== null && isCalendarDate(asked) ? asked : undefined;
  const { fix: askedFix, item: askedItem } = mealEditParams(query ?? "");
  let pending: "fix" | number | null = askedFix ? "fix" : askedItem;

  // Relative day names for the meta line and header ("Today · 13:05"), the date in full for the
  // diary's own label — the boards write "Thursday 24 September" over the list.
  const today = localDate(zone);
  const dateText = dayText;
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

  // One overlay at a time — the delete dialog, the score breakdown, a fix panel. `overlay` is
  // what Esc and a scrim tap close. Focus moves INTO a panel on open and back to whatever opened
  // it on close — a keyboard path has to end where it started.
  let overlay: HTMLElement | null = null;
  let restoreFocus: Element | null = null;
  // The open ⋯ menu's closer (#172): Esc takes it before it takes the screen — a menu up is a
  // popup, not a page, and the order here is overlay → menu → diary.
  let closeMenu: (() => void) | null = null;
  const closeOverlay = (): void => {
    overlay?.remove(); overlay = null;
    if (restoreFocus instanceof HTMLElement && restoreFocus.isConnected &&
        restoreFocus.closest("[hidden]") === null) restoreFocus.focus();
    restoreFocus = null;
  };
  const openOverlay = (node: HTMLElement, focus?: HTMLElement): void => {
    closeOverlay();
    restoreFocus = document.activeElement;
    wrap.append(node); overlay = node;
    focus?.focus();
  };
  const openPanel = (p: { node: HTMLElement; focus: HTMLElement }): void => openOverlay(p.node, p.focus);

  // The photo bytes arrive under the bearer, so they cannot be an <img>'s URL — and the CSP
  // refuses both a blob: src and a fetch OF a blob: URL, so `blobSrc`'s data URL is the one form
  // `img-src` already allows, and it needs no revocation.
  const photoUrl = async (mealId: string, index: number): Promise<string | null> =>
    await apiBlob(`${MEAL(mealId)}/photos/${index}`).then(blobSrc).catch(() => null);

  const closeToDiary = (): void => { location.hash = "#/"; };
  document.addEventListener("keydown", function onKey(e) {
    if (!wrap.isConnected) { document.removeEventListener("keydown", onKey); return; }
    if (e.key !== "Escape") return;
    if (overlay !== null) closeOverlay();
    else if (closeMenu !== null) closeMenu();
    else closeToDiary();
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
    dlg.setAttribute("aria-label", sc.mealTitle);
    const head = kitEl(`<div class="row between"><b class="d d22">${esc(sc.mealTitle)}</b>` +
      `<b class="d d28 num">${esc(fill(sc.outOf, { n: n(hs.score) }))}</b></div>`);
    dlg.append(head, el("p", "t13 m mnote", sc.method));
    dlg.append(scorePartEl({ name: sc.startRow, points: n(hs.base) }));
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
      turn(async () => {
        await api(`${MEAL(meal.id)}`, { method: "DELETE" });
        closeToDiary();
      });
    });
    dlg.append(buttons);
    scrim.append(dlg);
    return scrim;
  };

  /**
   * `web/meal-fix.html` (#188): X, the sparkle and "Correct this meal", the meal named beside its
   * thumb, the one field ("Say what was wrong" — `composeHint`), the example card, Update. Update
   * sends the sentence as the correction turn — `focusMealId`, the contract unchanged — and the
   * recomputed answer is what the detail re-reads behind the closing panel.
   */
  const fixPanel = (meal: MealRecord): { node: HTMLElement; focus: HTMLElement } => {
    const scrim = el("div", "mscrim");
    scrim.addEventListener("click", (e) => { if (e.target === scrim) closeOverlay(); });
    const dlg = el("div", "card mfix rise");
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-label", mc.webCorrect);
    const close = iconButton("x", mc.cancelCta);
    close.addEventListener("click", closeOverlay);
    const xrow = el("div", "row");
    xrow.append(close);
    dlg.append(xrow);
    const title = el("div", "row fixtitle");
    title.append(kitEl(ico("sparkle")), el("b", "d d28", mc.webCorrect));
    const named = el("div", "row fixmeal");
    const thumb = el("span", "fixthumb");
    if ((meal.photos ?? 0) > 0) {
      const img = el("img", "") as HTMLImageElement;
      img.alt = "";
      void photoUrl(meal.id, 0).then((src) => { if (src !== null && img.isConnected) img.src = src; });
      thumb.append(img);
    } else {
      thumb.classList.add("chat");
      thumb.append(kitEl(ico("chat")));
    }
    named.append(thumb, el("span", "t13 m",
      // `phoneFixMeal` — "{name} · {kcal} · {time}", the {kcal} spelled with its unit.
      fill(mc.phoneFixMeal, {
        name: names(meal.items), kcal: `${kn(meal.kcal)}${UNIT_KCAL[lang]}`, time: mealTime(meal),
      })));
    const field = el("textarea", "fixfield") as HTMLTextAreaElement;
    field.placeholder = mc.composeHint;
    // The board's "<b>For example:</b> …" — the lead is its own key, never a slice of the sentence.
    const example = el("div", "card flat fixex");
    example.append(el("b", "", mc.phoneFixExampleLead), ` ${mc.phoneFixExample}`);
    const update = el("button", "cta p", mc.phoneUpdate) as HTMLButtonElement;
    update.type = "button";
    update.disabled = true;
    field.addEventListener("input", () => { update.disabled = field.value.trim() === ""; });
    update.addEventListener("click", () => {
      const text = field.value.trim();
      if (text === "") return;
      turn(async () => {
        // A kept (offline) turn answers nothing here — the redraw picks the meal up when the
        // outbox drains.
        const saved = await sendOrKeep({
          id: crypto.randomUUID(), userId: uid ?? "", kind: "text", text, photos: [],
          capturedAt: new Date().toISOString(), focusMealId: meal.id,
        });
        closeOverlay();
        return saved;
      });
    });
    dlg.append(title, named, field, example, update);
    scrim.append(dlg);
    return { node: scrim, focus: field };
  };

  /**
   * `web/meal-ingredient.html` (#188): the name, the meal it belongs to, the amount in grams with
   * "was" under it, the item's kcal live off its own density, this meal's stored total and
   * verdicts. The bin PATCHes the item off the meal at once; Done PATCHes the grams —
   * `mealEditRequest` sends `{ items }` alone and a Done that moved nothing writes nothing.
   */
  const ingredientPanel = (meal: MealRecord, index: number): { node: HTMLElement; focus: HTMLElement } => {
    const item = meal.items[index]!;
    const scrim = el("div", "mscrim");
    scrim.addEventListener("click", (e) => { if (e.target === scrim) closeOverlay(); });
    const dlg = el("div", "card ming rise");
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-label", mc.phoneIngredientTitle);

    const head = el("div", "row between");
    const close = iconButton("x", mc.cancelCta);
    close.addEventListener("click", closeOverlay);
    const bin = iconButton("trash", mc.phoneRemoveIngredient);
    head.append(close, el("span", "d d17", mc.phoneIngredientTitle), bin);
    dlg.append(head, el("b", "d d28", item.name),
      el("span", "t13 m", fill(mc.phoneSheetMeal, { meal: names(meal.items), time: mealTime(meal) })));

    // The amount is the pill itself: the figure editable in place, the pen the affordance. The
    // input holds RAW digits — a grouped display string ("1,500") would not parse back.
    const grams = el("input", "amtin num") as HTMLInputElement;
    grams.type = "text";
    grams.inputMode = "decimal";
    grams.value = `${item.grams}`;
    grams.setAttribute("aria-label", mc.phoneAmount);
    const size = (): void => { grams.style.width = `${Math.max(2, grams.value.length)}ch`; };
    size();
    const pill = el("label", "amtpill");
    pill.append(grams, document.createTextNode(`${spellUnit(lang, "g")}`), kitEl(ico("pencil")));
    const amountRow = el("div", "row between");
    amountRow.append(el("span", "amlab", mc.phoneAmount), pill);
    // The "was" figures the board draws once the field moves off the stored value — under the
    // amount row and beside the live kcal. Hidden until then: "was 150g" under an untouched
    // "150g" is the duplication ieat-app#1019 removed.
    const wasG = el("span", "t12 m ingwas",
      fill(mc.phoneWasAmount, { amount: fill(mc.phoneGrams, { n: n(item.grams) }) }));
    wasG.hidden = true;
    dlg.append(amountRow, wasG);

    // Calories, live off the item's own density; "was" keeps the figure the edit started from. An
    // item that reports no kcal draws no card — the preview has nothing to scale.
    const kcalNow = el("b", "d d28 num", item.kcal !== undefined ? kn(item.kcal) : "");
    let wasK: HTMLElement | null = null;
    if (item.kcal !== undefined) {
      const kcalLeft = el("div", "");
      const kcalRow = el("div", "row ingkrow");
      kcalRow.append(kitEl(ico("kcal")), kcalNow);
      kcalLeft.append(el("span", "t12 m", cc.macroLabels.kcal), kcalRow);
      wasK = el("span", "t13 m num", fill(mc.phoneWasAmount, { amount: `${kn(item.kcal)}` }));
      wasK.hidden = true;
      const kcalCard = el("div", "card row between ingkcal");
      kcalCard.append(kcalLeft, wasK);
      dlg.append(kcalCard);
    }

    // This meal's figure MOVES with the item (`previewKcal`) — the board's "540 → 605" — while
    // the verdicts stay the stored ones: the write recomputes them and a preview never guesses.
    const mealCard = el("div", "card ingmeal");
    const mealRow = el("div", "row between");
    const mealMove = el("span", "num");
    const drawMove = (): void => {
      const preview = previewKcal(meal, index, gramsNow() ?? 0);
      mealMove.textContent = fill(mc.phoneMealMove, {
        from: kn(meal.kcal), to: kn(preview?.meal ?? meal.kcal),
      });
    };
    mealRow.append(el("span", "amlab", mc.phoneThisMeal), mealMove);
    mealCard.append(mealRow, el("div", "hr"));
    const vlist = verdictListEl((meal.verdictLabels ?? []).map((v) => ({ tone: v.tone, words: v.label })));
    if (vlist !== null) mealCard.append(vlist);
    dlg.append(mealCard);

    const gramsNow = (): number | null => {
      const g = Number.parseFloat(grams.value.replace(",", "."));
      return Number.isFinite(g) && g >= 0 ? g : null;
    };
    grams.addEventListener("input", () => {
      size();
      const g = gramsNow();
      // Every item at 0g is no meal (ieat-app#1224); the bin is the way to take the last one off.
      done.disabled = g === 0 && meal.items.every((it, i) => i === index || it.grams === 0);
      const edited = g !== null && g !== item.grams;
      wasG.hidden = !edited;
      if (wasK !== null) wasK.hidden = !edited;
      const scaled = g === null ? null : scaledItem(item, g);
      kcalNow.textContent = scaled?.kcal !== undefined ? kn(scaled.kcal)
        : item.kcal !== undefined ? kn(item.kcal) : "";
      drawMove();
    });
    drawMove();

    // Both writes end in the same PATCH: items only — the server derives the totals, and the
    // detail re-reads them on the redraw.
    const applyItems = (items: MealItem[]): void => {
      const req = mealEditRequest(meal, items);
      if (req === null) { closeOverlay(); return; }
      turn(async () => {
        await api<MealUpdated | TargetGone>(MEAL(meal.id), {
          method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(req),
        });
        closeOverlay();
      });
    };
    const done = el("button", "cta p", mc.phoneDone) as HTMLButtonElement;
    done.type = "button";
    done.addEventListener("click", () => {
      const g = gramsNow();
      applyItems(g === null ? [...meal.items]
        : meal.items.map((it, i) => (i === index ? scaledItem(it, g) : it)));
    });
    bin.addEventListener("click", () => applyItems(meal.items.filter((_, i) => i !== index)));
    dlg.append(done);
    scrim.append(dlg);
    return { node: scrim, focus: grams };
  };

  const menuButton = (meal: MealRecord): HTMLElement => {
    const box = el("div", "mwrap");
    const btn = iconButton("dots", mc.menuButton);
    btn.setAttribute("aria-haspopup", "menu");
    btn.setAttribute("aria-expanded", "false");
    const popup = el("div", "mpopup");
    popup.hidden = true;
    const setOpen = (open: boolean): void => {
      popup.hidden = !open;
      btn.setAttribute("aria-expanded", `${open}`);
      closeMenu = open ? () => setOpen(false) : null;
    };
    const item = (icon: IconName, label: string, onPick: () => void): HTMLButtonElement => {
      const b = el("button", "mi") as HTMLButtonElement;
      b.type = "button";
      b.append(kitEl(ico(icon)), document.createTextNode(label));
      b.addEventListener("click", () => { setOpen(false); onPick(); });
      return b;
    };
    const reread = item("retry", mc.phoneMenuReread, () =>
      turn(async () => {
        const r = await api<MealUpdated>(`${MEAL(meal.id)}/reanalyze`, { method: "POST" });
        void r;
      }));
    const del = item("trash", mc.deleteCta, () => openOverlay(deleteDialog(meal)));
    del.classList.add("bad");
    popup.append(
      // "Edit" is the Cal-AI fix sheet (#188) — a panel over this detail, not the chat.
      item("pencil", mc.phoneEdit, () => openPanel(fixPanel(meal))),
      // Nothing to re-read without a photo, so a typed meal is not offered it (ieat-app#1225).
      ...((meal.photos ?? 0) > 0 ? [reread] : []),
      item("calendar-back", mc.phoneMenuMoveYesterday, () =>
        turn(async () => {
          // A move is the re-date route (#150), not a billed turn of words — the same scoping an
          // edit goes through, and the offset resolves on the server's today, not a client's date.
          const out = await api<MealRedated>(`${MEAL(meal.id)}/redate`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ dayOffset: 1 }),
          });
          // The meal left this day: follow it there rather than draw the day without it.
          location.hash = `#/meal/${encodeURIComponent(meal.id)}?d=${out.date}`;
        })),
      del,
    );
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      setOpen(popup.hidden !== false);
    });
    // A tap anywhere else puts it away; the listener cleans itself up when the screen is gone.
    document.addEventListener("click", function away(e) {
      if (!wrap.isConnected) { document.removeEventListener("click", away); return; }
      if (!popup.hidden && !(e.target as Node | null)?.isSameNode(btn) && !popup.contains(e.target as Node)) {
        setOpen(false);
      }
    });
    box.append(btn, popup);
    return box;
  };

  /** The hero's photo — the kit's `photoHero`, its src landing late through the bearer. */
  const hero = (meal: MealRecord): HTMLElement => {
    if ((meal.photos ?? 0) === 0) {
      const box = el("div", "hero mnoimg");
      box.append(kitEl(ico("chat")));
      return box;
    }
    const box = photoHeroEl({ alt: names(meal.items) }) as HTMLElement;
    const img = box.querySelector("img")!;
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
      ...((meal.photos ?? 0) > 0 ? [el("small", "", mc.webLoggedPhoto)] : []),
    );
    head.append(close, mid, menuButton(meal));
    card.append(head);

    const split = el("div", "msplit");
    split.append(hero(meal));
    const sheet = el("div", "msheet");
    sheet.append(kitEl(`<div class="row between"><div><b class="d d22">${esc(names(meal.items))}</b>` +
      `<div class="t13 m mmeta">${esc(meta(meal))}</div></div>` +
      `<span class="row kfig"><i class="ico i-kcal"></i><b class="d d28 num">${esc(kn(meal.kcal))}</b></span></div>`));
    const tiles = el("div", "mcards");
    for (const [macro, value, label] of [
      ["protein", `${n(meal.protein_g)}${spellUnit(lang, "g")}`, mc.macroProtein],
      ["carbs", `${n(meal.carbs_g)}${spellUnit(lang, "g")}`, mc.macroCarbs],
      ["fat", `${n(meal.fat_g)}${spellUnit(lang, "g")}`, mc.macroFat],
    ] as const) {
      tiles.append(mcardEl({ macro, value, label, centred: true }));
    }
    sheet.append(tiles);
    // The health score is the SERVER'S (`MealRecord.healthScore`, S10): drawn, never computed here.
    if (meal.healthScore !== null) {
      const row = scoreRowEl({
        label: sc.mealTitle,
        score: fill(sc.outOf, { n: n(meal.healthScore.score) }),
        pct: meal.healthScore.score * 10,
      });
      row.addEventListener("click", () => openOverlay(scoreOverlay(meal, day)));
      sheet.append(row);
    }
    meal.items.forEach((item, i) => {
      // Each row opens its own editor (#188): the kit's `ing` markup wrapped in a button —
      // the board's row verbatim, the control around it rather than inside it.
      const row = el("button", "ingbtn") as HTMLButtonElement;
      row.type = "button";
      row.append(ingredientEl({
        name: item.name, amount: fill(mc.phoneGrams, { n: n(item.grams) }),
        ...(item.kcal !== undefined ? { kcal: kn(item.kcal) } : {}),
      }));
      row.addEventListener("click", () => openPanel(ingredientPanel(meal, i)));
      sheet.append(row);
    });
    const verdicts = verdictListEl((meal.verdictLabels ?? []).map((v) => ({ tone: v.tone, words: v.label })));
    if (verdicts !== null) sheet.append(verdicts);
    const correct = kitEl(`<a class="cta s">${esc(mc.webCorrect)}</a>`) as HTMLAnchorElement;
    correct.href = `#/meal/${encodeURIComponent(meal.id)}?fix`;
    sheet.append(correct);
    split.append(sheet);
    card.append(split);
    return card;
  };

  const turn = (write: () => Promise<string | void>): void => takeTurn(wrap, tell, draw, uid, write);

  const draw = async (): Promise<void> => {
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
        href: `#/meal/${encodeURIComponent(m.id)}?d=${day.date}`,
      });
      if (m.id === meal?.id) row.classList.add("sel");
      rows.append(row);
    }
    left.append(rows);
    clear(right).append(notice, meal === null ? goneCard() : detailCard(meal, day));

    // The deep links `#/meal/<id>?fix` / `?item=<n>` open their panel once, over the drawn detail,
    // then the hash loses the param — a redraw must not reopen a panel the person already closed.
    if (meal !== null && pending !== null) {
      const p = pending;
      pending = null;
      history.replaceState(null, "", `#/meal/${encodeURIComponent(id)}?d=${viewing}`);
      if (p === "fix") openPanel(fixPanel(meal));
      else if (p < meal.items.length) openPanel(ingredientPanel(meal, p));
    }
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
