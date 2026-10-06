// ── The first meal (#42): "one meal on us", in the diary's place ────────────────────────────────
//
// While the account has logged nothing, `#/` is the diary SHELL with this flow in its diary
// column (web/today-first-meal): the ask card beside the day card — the photo drop or the typed
// meal — then the first verdict as a SHEET over Home (web/first-verdict), the correction panel
// (web/first-correct) and the offer that holds (web/first-offer), each an overlay on the diary
// the meal just landed in. Two rules the boards do not carry and this client keeps:
//
//   - THE VERDICTS ARE THE SERVER'S. `verdicts` is recomputed after every write and the card
//     renders what `renderableVerdicts` finds in what it was sent — a client that derived its own
//     would be the second copy `verdictsFromTargets` exists to prevent.
//   - "Correct meal" is the MANUAL edit, `PATCH /v1/meals/:id`, which is uncharged. The sample is
//     ONE analysis, so a text correction through `/v1/messages` would be a second billed turn and
//     a 402 on the screen where it matters most. `firstMealEdit` (`portion.ts`) builds the request.
//
// Moved whole out of `main.ts` (#87); the register's own boards for it are W5's.

import { verdictMood } from "../../shared/types.ts";


import type { MascotMood } from "../../shared/mascot.ts";
// The one-meal flow's Spud lines — ONE table both clients read (#42): the phone through
// `chatCopyFor(lang).firstMeal`, the browser through this module. It is small on purpose: a
// module the browser imports ships whole, so this imports types and nothing else.
import { FIRST_MEAL_COPY } from "../../shared/first-meal-copy.ts";
import { mealCopyFor } from "../../shared/app/meal-copy.ts";
import { payCopyFor } from "../../shared/app/pay-copy.ts";
import { UNIT_KCAL, kcalNumbers, spellUnit, wholeNumbers } from "../../shared/lang.ts";
import { localTime } from "../../shared/dates.ts";
import type { Answered, MealAnalysis, MealLogged, MealProposed, VerdictLabel } from "@eait/shared";
import type {
  EditMealResponse, PendingResponse, PhotoProgress, ProfileResponse,
} from "@eait/shared/contract";
import { ApiError, Unauthenticated, api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { shrinkPhotos } from "../photo.ts";
import { firstMealEdit, mealTitle, type Portion } from "../portion.ts";
import { kitEl, payPlansEl } from "../kit.ts";
import { ico, photoHero, spudAvatar } from "../../shared/ui/kit.ts";
import { payPlans as payPlansMarkup } from "../../shared/ui/kit.ts";
import {
  COPY, CONFIRM, MEAL, el, clear, kcal, lang, names, refusalWords, render, sendOrKeep,
  setHeldProposal, textField,
} from "../shell.ts";
import { routeBase } from "../route.ts";

/** The boards' `.say` — Spud's disc beside one quiet line, inside the diary card. */
function sayRow(mood: MascotMood, line: string): HTMLElement {
  const row = el("div", "say fline");
  row.append(kitEl(spudAvatar(mood)), el("p", "", line));
  return row;
}

/**
 * The one-meal flow itself: a card in the diary's column while it asks or takes the meal; the
 * steps after it logs are sheets over the diary — a "first verdict" is a state, not an address
 * anybody should land on later.
 */
export function firstMealScreen(me: ProfileResponse): HTMLElement {
  // The words that ARE the flow, from the one table both clients read (#42) — `photo` is the
  // phone's camera line and stays unused here: the web's button is its own "Upload a photo".
  const fm = FIRST_MEAL_COPY[lang];
  const mc = mealCopyFor(lang);
  const zone = me.timezone;
  const wrap = el("div", "fflow");
  const stage = el("div", "");
  const notice = el("p", "notice");
  notice.setAttribute("role", "alert");
  notice.hidden = true;
  const progress = el("p", "muted");
  progress.hidden = true;
  wrap.append(stage, notice, progress);

  const say = (words: string | null): void => {
    notice.textContent = words ?? "";
    notice.hidden = words === null;
  };
  const sayProgress = (words: string | null): void => {
    progress.textContent = words ?? "";
    progress.hidden = words === null;
  };
  const show = (node: HTMLElement): void => { clear(stage).append(node); };

  // The verdict, the correction and the offer draw OVER the diary (web/first-verdict et al.) —
  // sheets on the document, not steps in the column. One at a time; a sheet belongs to `#/` and
  // leaves with it, and the card gone from the page means the flow is over.
  let sheet: HTMLElement | null = null;
  const closeSheet = (): void => { sheet?.remove(); sheet = null; };
  const openSheet = (node: HTMLElement): void => {
    closeSheet();
    document.querySelector(".fscrim")?.remove();
    document.body.append(node);
    sheet = node;
  };
  addEventListener("hashchange", function guard() {
    if (!wrap.isConnected || routeBase(location.hash) !== "#/") {
      closeSheet();
      removeEventListener("hashchange", guard);
    }
  });

  // The photo the send carried, kept for the verdict sheet's hero — the same bytes, no refetch.
  let lastPhotoUrl: string | null = null;

  /**
   * One turn at a time, every control disabled while it is out — the same rule `turn()` keeps on
   * the composer, for the same reason: a second send of a meal is a second meal. A
   * `subscription-required` refusal here is not an error to word but the flow's own last screen:
   * the free analysis is spent, and the offer is the answer to that.
   */
  const run = (work: () => Promise<void>): void => {
    const controls = [...wrap.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>("input, button, select, textarea"),
      ...(sheet?.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>("input, button, select, textarea") ?? [])];
    for (const c of controls) c.disabled = true;
    say(null);
    void (async () => {
      try {
        await work();
      } catch (err) {
        if (err instanceof Unauthenticated) { await render(); return; }
        if (err instanceof ApiError && err.body?.error === "subscription-required") { openSheet(offerStep()); return; }
        say(refusalWords(err));
        console.error(err);
      } finally {
        for (const c of controls) c.disabled = false;
      }
    })();
  };

  const askStep = (): HTMLElement => {
    const box = el("div", "step");
    // No offer preceded this screen on the web, so there is no `react` beat to answer it (#50).
    box.append(sayRow("happy", fm.ask));
    const foot = el("div", "step-foot");
    const up = el("button", "cta p") as HTMLButtonElement;
    up.append(kitEl(ico("upload")), document.createTextNode(COPY.firstMealUpload));
    up.addEventListener("click", () => show(photoStep()));
    const typed = el("button", "cta s", fm.tell) as HTMLButtonElement;
    typed.addEventListener("click", () => show(typeStep()));
    foot.append(up, typed);
    box.append(foot);
    return box;
  };

  const photoStep = (): HTMLElement => {
    const box = el("div", "step");
    box.append(sayRow("happy", COPY.firstPhotoAsk));
    // A LABEL around the input, so the whole zone opens the chooser natively — a click needs no
    // script, and drag-and-drop is the affordance on top of it.
    const zone = el("label", "drop");
    const input = el("input", "visually-hidden") as HTMLInputElement;
    input.type = "file";
    input.accept = "image/jpeg,image/png,image/webp";
    input.multiple = true;
    input.setAttribute("aria-label", COPY.photosOfOneMeal);
    const lead = el("span", "drop-lead", COPY.dropPhotoHere);
    zone.append(lead, el("small", "", COPY.dropPhotoKinds), input);
    let picked: File[] = [];
    const reflect = (): void => {
      lead.textContent = picked.length === 0 ? COPY.dropPhotoHere : picked.map((f) => f.name).join(", ");
    };
    input.addEventListener("change", () => { picked = [...(input.files ?? [])]; reflect(); });
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("over"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("over");
      picked = [...(e.dataTransfer?.files ?? [])];
      reflect();
    });
    box.append(zone);
    const foot = el("div", "step-foot");
    const go = el("button", "cta p", COPY.analyseMeal) as HTMLButtonElement;
    go.addEventListener("click", () => {
      if (picked.length === 0) { say(COPY.choosePhotoFirst); return; }
      // The server's numbers off the profile, exactly as the composer reads them — never a
      // constant of ours.
      const { maxPhotosPerMeal, maxUploadBytes } = me.limits;
      if (picked.length > maxPhotosPerMeal) { say(fill(COPY.photosMax, { n: wholeNumbers(lang)(maxPhotosPerMeal) })); return; }
      const files = picked;
      run(async () => {
        // What goes up is the resized frame — the byte cap weighs it, not what was picked.
        const shrunk = await shrinkPhotos(files);
        if (shrunk.reduce((n, f) => n + f.size, 0) > maxUploadBytes) { say(COPY.photoTooLarge); return; }
        lastPhotoUrl = await new Promise<string | null>((resolve) => {
          const r = new FileReader();
          r.onload = () => resolve(String(r.result));
          r.onerror = () => resolve(null);
          r.readAsDataURL(shrunk[0]!);
        });
        // The stream carries its own progress words — `reading`/`item` carry `line` already
        // worded. Printed, never composed: this bundle holds no catalog.
        try {
          // A PROPERTY, not a local: writes from the callback must survive `await` without a
          // compiler that has already decided `null`.
          const got: { logged: MealLogged | null } = { logged: null };
          const keptNote = await sendOrKeep(
            { id: crypto.randomUUID(), userId: me.profile.user_id, kind: "photo", text: null, photos: shrunk, capturedAt: new Date().toISOString() },
            {
              onLine: (line) => {
                const ev = line as PhotoProgress;
                // Progress kinds only — the stream's last line is a result, not a line to print.
                if (ev.kind === "reading" || ev.kind === "item") sayProgress(ev.line);
              },
              onResult: (r) => { if (r.kind === "logged") got.logged = r; },
            },
          );
          if (got.logged !== null) { openSheet(await verdictSheet(got.logged.analysis, got.logged.mealId, got.logged)); void render(); return; }
          if (keptNote !== undefined) say(keptNote);
        } finally {
          sayProgress(null);
        }
      });
    });
    foot.append(go);
    box.append(foot);
    return box;
  };

  const typeStep = (): HTMLElement => {
    const box = el("div", "step");
    box.append(sayRow("happy", COPY.firstTypeAsk));
    const panel = el("div", "card");
    const lab = el("label", "lab", COPY.yourMeal);
    lab.setAttribute("for", "fm-meal");
    const field = textField(COPY.composerPlaceholder);
    field.id = "fm-meal";
    panel.append(lab, field);
    box.append(panel);
    const foot = el("div", "step-foot");
    const send = el("button", "cta p", COPY.send) as HTMLButtonElement;
    send.addEventListener("click", () => {
      const text = field.value.trim();
      if (text === "") return;
      lastPhotoUrl = null;
      run(async () => {
        const got: { result: MealProposed | Answered | null } = { result: null };
        const keptNote = await sendOrKeep(
          { id: crypto.randomUUID(), userId: me.profile.user_id, kind: "text", text, photos: [], capturedAt: new Date().toISOString() },
          { onResult: (r) => { if (r.kind === "proposed" || r.kind === "answered") got.result = r; } },
        );
        if (got.result === null) { if (keptNote !== undefined) say(keptNote); return; }
        // An answered question is Spud's reply, shown where it was asked — it logs nothing.
        if (got.result.kind === "answered") { say(got.result.text); return; }
        // A typed meal is PROPOSED first, and this screen is the confirmation — the ask already
        // said what it was, so a second tap would ask the same thing again. The proposal was the
        // billed call; confirming it costs nothing.
        const c = await api<PendingResponse>(CONFIRM(got.result.pendingId), { method: "POST" });
        // Refusals and "expired" come back as HTTP statuses; a JSON body here is the meal.
        if (c.kind !== "logged") throw new ApiError(200, { error: c.kind }, `confirm: ${c.kind}`);
        setHeldProposal(null);
        openSheet(await verdictSheet(c.analysis, c.mealId, c));
        void render();
      });
    });
    foot.append(send);
    box.append(foot);
    return box;
  };

  // The card's verdict words arrive ON the result — composed where the verdict was computed, in
  // the account's language. A screen in this bundle holds no i18n catalog to compose them itself.
  type VerdictWords = { verdictLabels: VerdictLabel[]; verdictHeadline: string | null };
  const verdictSheet = (analysis: MealAnalysis, mealId: string, words: VerdictWords): HTMLElement => {
    // web/first-verdict.html: the sheet centred over Home — Spud's "Your first macros", the photo
    // with its item callouts, the card's name and kcal, macros, the pills, then the two actions.
    const scrim = el("div", "fscrim");
    const dlg = el("div", "card fsheet rise");
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-label", COPY.firstVerdictBeat);
    dlg.append(sayRow(verdictMood(analysis.verdicts), COPY.firstVerdictBeat));
    if (lastPhotoUrl !== null) {
      const corners = ["tl", "bl", "br"] as const;
      const hero = kitEl(photoHero({
        src: lastPhotoUrl,
        alt: names(analysis.items),
        // The meal just landed — its stamp is now.
        stamp: localTime(zone, new Date()),
        callouts: analysis.items.slice(0, 3).map((it, i) => ({
          corner: corners[i]!,
          lift: corners[i] === "br",
          text: `${it.name} ${wholeNumbers(lang)(it.grams)}${spellUnit(lang, "g")}`,
          ...(it.kcal !== undefined ? { value: kcalNumbers(lang)(it.kcal) } : {}),
        })),
      })) as HTMLElement;
      // `.fhero`, never `.hero`: on this card the kit's `.hero` name is the kcal figure's, and a
      // second one would split what a reader (or the suite) resolves.
      hero.classList.replace("hero", "fhero");
      dlg.append(hero);
    }
    const card = el("div", "card");
    card.append(el("div", "lab", names(analysis.items)));
    const big = el("p", "big");
    if (analysis.confidence === "low") big.append(el("span", "about", `${COPY.about} `));
    big.append(el("span", "hero num", kcalNumbers(lang)(analysis.kcal)), el("span", "muted", `${UNIT_KCAL[lang]}`));
    card.append(big);
    const stats = el("div", "stats");
    for (const [label, v] of [[COPY.statProtein, analysis.protein_g], [COPY.statCarbs, analysis.carbs_g], [COPY.statFat, analysis.fat_g]] as const) {
      const cell = el("div", "stat-cell");
      // Whole grams, as the thread says them (#49: "37.4g" on the card beside "37g" in the text).
      cell.append(el("div", "lab", label), el("div", "stat-num num", `${wholeNumbers(lang)(v)}g`));
      stats.append(cell);
    }
    card.append(stats);
    // The pills' WORDS are the result's own `verdictLabels` — rederived here they would be a
    // second implementation, and a wrong one the moment the caps moved.
    if (words.verdictLabels.length > 0) {
      const pills = el("div", "pills");
      for (const v of words.verdictLabels) pills.append(el("span", `pill ${v.tone}`, v.label));
      card.append(pills);
    }
    dlg.append(card);
    const foot = el("div", "step-foot fhrow");
    const fix = el("button", "cta s", fm.correct) as HTMLButtonElement;
    fix.addEventListener("click", () => openSheet(correctStep(analysis, mealId, words)));
    const keep = el("button", "cta p", fm.keepGoing) as HTMLButtonElement;
    keep.addEventListener("click", () => openSheet(offerStep()));
    foot.append(fix, keep);
    dlg.append(foot);
    scrim.append(dlg);
    return scrim;
  };

  const correctStep = (analysis: MealAnalysis, mealId: string, words: VerdictWords): HTMLElement => {
    // web/first-correct.html: the fix panel over Home — its title and the meal's line, then the
    // two pinned fields (what it was, portion) and Save and recheck.
    const scrim = el("div", "fscrim");
    const dlg = el("div", "card fsheet fnarrow rise");
    dlg.setAttribute("role", "dialog");
    dlg.setAttribute("aria-modal", "true");
    dlg.setAttribute("aria-label", mc.webCorrect);
    const title = el("div", "row fixtitle");
    title.append(kitEl(ico("sparkle")), el("b", "d d28", mc.webCorrect));
    dlg.append(title);
    dlg.append(el("span", "t13 m", fill(mc.phoneFixMeal, {
      name: names(analysis.items), kcal: kcal(analysis.kcal), time: localTime(zone, new Date()),
    })));
    const fields = el("div", "card");
    const whatLab = el("label", "lab", COPY.correctWhat);
    whatLab.setAttribute("for", "fm-what");
    const what = textField(COPY.correctWhat);
    what.id = "fm-what";
    // #49: the WHOLE meal, as the card names it — and the field edits the whole meal.
    what.value = mealTitle(analysis.items);
    const portionLab = el("label", "lab", COPY.correctPortion);
    portionLab.setAttribute("for", "fm-portion");
    const portion = el("select", "portion") as HTMLSelectElement;
    portion.id = "fm-portion";
    for (const [value, label] of [["small", COPY.portionSmall], ["regular", COPY.portionRegular], ["large", COPY.portionLarge]] as const) {
      const option = el("option", "", label) as HTMLOptionElement;
      option.value = value;
      option.selected = value === "regular";
      portion.append(option);
    }
    fields.append(whatLab, what, portionLab, portion);
    dlg.append(fields);
    const foot = el("div", "step-foot");
    const save = el("button", "cta p", COPY.saveRecheck) as HTMLButtonElement;
    save.addEventListener("click", () => {
      run(async () => {
        const edit = firstMealEdit(analysis, what.value, portion.value as Portion);
        // Nothing changed: the card as it was, and no write — so no "Updated" anywhere (#49).
        if (edit === null) { openSheet(verdictSheet(analysis, mealId, words)); return; }
        const r = await api<EditMealResponse>(MEAL(mealId), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(edit),
        });
        // "target-gone" and the refusals are statuses; a JSON body here is the updated meal.
        if (r.kind !== "updated") throw new ApiError(200, { error: r.kind }, `edit: ${r.kind}`);
        // The WHOLE card is rebuilt from the server's answer; nothing of the old one survives.
        openSheet(verdictSheet(r.analysis, r.mealId, r));
      });
    });
    foot.append(save);
    dlg.append(foot);
    scrim.append(dlg);
    return scrim;
  };

  const offerStep = (): HTMLElement => {
    // web/first-offer.html: an opaque page over Home — Spud's "That was one…", the card that names
    // the offer, the priced plan rows, the trial CTA and its renewal line, then "Not now".
    const scrim = el("div", "fscrim solid");
    const dlg = el("div", "foffer");
    const box = el("div", "step");
    box.append(sayRow("happy", fm.afterAsk));
    const card = el("div", "card");
    card.append(el("b", "d d22", COPY.offerAsk));
    const pay = payCopyFor(lang);
    // The honest timeline rides the configured trial — `trialDays` is the host's one length
    // (ieat-app#1591). A host that grants no trial draws no "free for {days} days" claim at all.
    const trialDays = me.paywall?.trialDays ?? 0;
    if (trialDays > 0) {
      const tl = el("div", "card");
      for (const [when, words] of [
        [COPY.offerToday, fill(pay.trialBadge, { days: String(trialDays) })],
        [COPY.offerBeforeEnd, COPY.offerBeforeText],
        [fill(COPY.offerDayAfter, { n: String(trialDays + 1) }), COPY.offerDay8Text],
      ] as const) {
        const row = el("div", "rowline");
        row.append(el("span", "when", when), el("span", "muted", words));
        tl.append(row);
      }
      card.append(tl);
    }
    // THE PLANS, PRICED (#263): the kit's one builder — the same rows `/start`'s offer and `#/pay`
    // draw, priced off `paywall` in the profile, so the radio picked is the plan the link buys.
    const plans = me.paywall === undefined ? null : payPlansEl(me.paywall, COPY.offerPlans);
    const go = el("a", "cta p") as HTMLAnchorElement;
    const hint = el("p", "hint");
    if (plans === null) {
      // The host sells nothing — no checkout URL is configured, so `paywall` carries no plan to
      // show. The offer still renders as it always did here: one named, checked radio and the
      // `/start/checkout` route, which is a 404 on exactly such a host — the shape the flow had
      // before the plans learned prices and selection. No trial is promised either: nothing
      // configured means nothing known.
      card.append(kitEl(payPlansMarkup(
        [{ value: "monthly", name: pay.planMonthly, checked: true }], COPY.offerPlans)));
      go.href = "/start/checkout";
      go.textContent = pay.continueCta;
    } else {
      card.append(plans.group);
      const update = (): void => {
        const sel = plans.picked();
        if (sel === null) return;
        // The plan's own `checkoutUrl` — the server already filled this account's id into it, so
        // the page shown is the page bought and no client ever carries an id it was not issued.
        go.href = sel.plan.checkoutUrl;
        if (trialDays > 0) {
          go.textContent = fill(pay.startTrial, { days: String(trialDays) });
          hint.textContent = fill(COPY.offerCheckoutHint, { days: String(trialDays) });
        } else {
          go.textContent = pay.continueCta;
          hint.textContent = fill(
            sel.value === "yearly" ? pay.renewNoteYearly : pay.renewNoteMonthly,
            { price: sel.plan.price });
        }
      };
      plans.group.addEventListener("change", update);
      update();
    }
    card.append(go, hint);
    box.append(card);
    const later = el("button", "cta g", COPY.offerLater) as HTMLButtonElement;
    // "Not now" re-renders: a meal exists by now, so the gate opens the diary it belongs on.
    later.addEventListener("click", () => { closeSheet(); void render(); });
    box.append(later);
    dlg.append(box);
    scrim.append(dlg);
    return scrim;
  };

  show(askStep());
  return wrap;
}
