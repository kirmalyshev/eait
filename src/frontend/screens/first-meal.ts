// ── The first meal (#42): "one meal on us", in the diary's place ────────────────────────────────
//
// While the account has logged nothing, `#/` is this flow rather than the diary — the v5 boards
// (20-first-meal, 21/21t, 22/22c, 23-paywall-after): the ask, the photo drop or the typed meal,
// the first verdict, the correction, and the offer that holds. Two rules the boards do not carry
// and this client keeps:
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


import { type MascotMood } from "../../shared/mascot.ts";
// The one-meal flow's Spud lines — ONE table both clients read (#42): the phone through
// `chatCopyFor(lang).firstMeal`, the browser through this module. It is small on purpose: a
// module the browser imports ships whole, so this imports types and nothing else.
import { FIRST_MEAL_COPY } from "../../shared/first-meal-copy.ts";
import { UNIT_KCAL, wholeNumbers } from "../../shared/lang.ts";
import type { Answered, MealAnalysis, MealLogged, MealProposed, VerdictLabel } from "@eait/shared";
import type {
  EditMealResponse, PendingResponse, PhotoProgress, ProfileResponse,
} from "@eait/shared/contract";
import { ApiError, Unauthenticated, api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { firstMealEdit, mealTitle, type Portion } from "../portion.ts";
import {
  COPY, CONFIRM, MEAL, el, clear, kcal, lang, names, refusalWords, render, sendOrKeep,
  setHeldProposal, setRedraw, spudFace, textField,
} from "../shell.ts";

/**
 * Spud plus the beat and the big line — the `spk` block every v5 board opens with.
 *
 * The mascot arrives as a STRING (`spudSvg` is the one drawing every web surface shares), parsed
 * rather than built node by node. It is a compile-time constant we wrote, not server or user
 * content — which is the whole of what "text, never innerHTML" exists to keep off the page.
 */
function spudBlock(mood: MascotMood, beat: string | null, lines: readonly string[]): HTMLElement {
  const row = el("div", "spk");
  const av = el("span", "av");
  av.append(spudFace(mood));
  const col = el("div", "spk-col");
  if (beat !== null) col.append(el("div", "beat", beat));
  // The LAST line is the step's ask — the page's h1, the same way /start/q's question is. The
  // lines before it are Spud's, and stay text.
  for (const [i, line] of lines.entries()) col.append(
    el(i === lines.length - 1 ? "h1" : "div", i === lines.length - 1 ? "ask" : "them", line));

  row.append(av, col);
  return row;
}

/**
 * The one-meal flow itself: a container that re-renders one step at a time, keeping the whole walk
 * off the hash — a "first verdict" is a state, not an address anybody should land on later.
 */
export function firstMealScreen(me: ProfileResponse): HTMLElement {
  // The words that ARE the flow, from the one table both clients read (#42) — `photo` is the
  // phone's camera line and stays unused here: the web's button is its own "Upload a photo".
  const fm = FIRST_MEAL_COPY[lang];
  const wrap = el("section", "flow");
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

  /**
   * One turn at a time, every control disabled while it is out — the same rule `turn()` keeps on
   * the composer, for the same reason: a second send of a meal is a second meal. A
   * `subscription-required` refusal here is not an error to word but the flow's own last screen:
   * the free analysis is spent, and the offer is the answer to that.
   */
  const run = (work: () => Promise<void>): void => {
    const controls = [...wrap.querySelectorAll<HTMLInputElement | HTMLButtonElement | HTMLSelectElement | HTMLTextAreaElement>("input, button, select, textarea")];
    for (const c of controls) c.disabled = true;
    say(null);
    void (async () => {
      try {
        await work();
      } catch (err) {
        if (err instanceof Unauthenticated) { await render(); return; }
        if (err instanceof ApiError && err.body?.error === "subscription-required") { show(offerStep()); return; }
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
    box.append(spudBlock("wave", null, [fm.ask]));
    const foot = el("div", "step-foot");
    const up = el("button", "cta p", COPY.firstMealUpload) as HTMLButtonElement;
    up.addEventListener("click", () => show(photoStep()));
    const typed = el("button", "cta s", fm.tell) as HTMLButtonElement;
    typed.addEventListener("click", () => show(typeStep()));
    foot.append(up, typed);
    box.append(foot);
    return box;
  };

  const photoStep = (): HTMLElement => {
    const box = el("div", "step");
    box.append(spudBlock("idle", null, [COPY.firstPhotoAsk]));
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
      if (picked.length > maxPhotosPerMeal) { say(fill(COPY.photosMax, { n: `${maxPhotosPerMeal}` })); return; }
      if (picked.reduce((n, f) => n + f.size, 0) > maxUploadBytes) { say(COPY.photoTooLarge); return; }
      const files = picked;
      run(async () => {
        // The stream carries its own progress words — a glance is its own line; `reading`/`item`
        // carry `line` already worded. Printed, never composed: this bundle holds no catalog.
        try {
          // A PROPERTY, not a local: writes from the callback must survive `await` without a
          // compiler that has already decided `null`.
          const got: { logged: MealLogged | null } = { logged: null };
          const keptNote = await sendOrKeep(
            { id: crypto.randomUUID(), userId: me.profile.user_id, kind: "photo", text: null, photos: files, capturedAt: new Date().toISOString() },
            {
              onLine: (line) => {
                const ev = line as PhotoProgress;
                // Progress kinds only — the stream's last line is a result, not a line to print.
                if (ev.kind === "reading" || ev.kind === "item") sayProgress(ev.line);
                else if (ev.kind === "glance") sayProgress(ev.text);
              },
              onResult: (r) => { if (r.kind === "logged") got.logged = r; },
            },
          );
          if (got.logged !== null) { show(await verdictStep(got.logged.analysis, got.logged.mealId, got.logged)); return; }
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
    box.append(spudBlock("idle", null, [COPY.firstTypeAsk]));
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
        show(await verdictStep(c.analysis, c.mealId, c));
      });
    });
    foot.append(send);
    box.append(foot);
    return box;
  };

  // The card's verdict words arrive ON the result — composed where the verdict was computed, in
  // the account's language. A screen in this bundle holds no i18n catalog to compose them itself.
  type VerdictWords = { verdictLabels: VerdictLabel[]; verdictHeadline: string | null };
  const verdictStep = (analysis: MealAnalysis, mealId: string, words: VerdictWords): HTMLElement => {
    const box = el("div", "step");
    // #49: SPUD SAYS THE PILLS' VERDICT, and only that, re-derived from the verdicts this card was
    // handed: the server's first line (`verdictHeadline`, the same function) and never the thread
    // read back. The thread held yesterday's figures after a correction and an introduction nobody
    // here makes. The face follows the same pills.
    box.append(spudBlock(verdictMood(analysis.verdicts), COPY.firstVerdictBeat,
      words.verdictHeadline === null ? [] : [words.verdictHeadline]));
    const card = el("div", "card");
    card.append(el("div", "lab", names(analysis.items)));
    const big = el("p", "big");
    if (analysis.confidence === "low") big.append(el("span", "about", `${COPY.about} `));
    big.append(el("span", "hero num", wholeNumbers(lang)(analysis.kcal)), el("span", "muted", ` ${UNIT_KCAL[lang]}`));
    card.append(big);
    const stats = el("div", "stats");
    for (const [label, v] of [[COPY.statProtein, analysis.protein_g], [COPY.statCarbs, analysis.carbs_g], [COPY.statFat, analysis.fat_g]] as const) {
      const cell = el("div", "stat-cell");
      // Whole grams, as the thread says them (#49: "37.4 g" on the card beside "37 g" in the text).
      cell.append(el("div", "lab", label), el("div", "stat-num num", `${wholeNumbers(lang)(v)} g`));
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
    box.append(card);
    const foot = el("div", "step-foot");
    const keep = el("button", "cta p", fm.keepGoing) as HTMLButtonElement;
    keep.addEventListener("click", () => show(offerStep()));
    const fix = el("button", "cta g", fm.correct) as HTMLButtonElement;
    fix.addEventListener("click", () => show(correctStep(analysis, mealId, words)));
    foot.append(keep, fix);
    box.append(foot);
    return box;
  };

  const correctStep = (analysis: MealAnalysis, mealId: string, words: VerdictWords): HTMLElement => {
    const box = el("div", "step");
    box.append(spudBlock("think", COPY.correctBeat, [COPY.correctAsk]));
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
    box.append(fields);
    const foot = el("div", "step-foot");
    const save = el("button", "cta p", COPY.saveRecheck) as HTMLButtonElement;
    save.addEventListener("click", () => {
      run(async () => {
        const edit = firstMealEdit(analysis, what.value, portion.value as Portion);
        // Nothing changed: the card as it was, and no write — so no "Updated" anywhere (#49).
        if (edit === null) { show(await verdictStep(analysis, mealId, words)); return; }
        const r = await api<EditMealResponse>(MEAL(mealId), {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(edit),
        });
        // "target-gone" and the refusals are statuses; a JSON body here is the updated meal.
        if (r.kind !== "updated") throw new ApiError(200, { error: r.kind }, `edit: ${r.kind}`);
        // The WHOLE card is rebuilt from the server's answer; nothing of the old one survives.
        show(await verdictStep(r.analysis, r.mealId, r));
      });
    });
    foot.append(save);
    box.append(foot);
    return box;
  };

  const offerStep = (): HTMLElement => {
    const box = el("div", "step");
    // The spec's screen title as the beat, the canonical ask over the offer that holds.
    box.append(spudBlock("idle", COPY.offerAsk, [fm.afterAsk]));
    const perks = el("div", "perks");
    for (const perk of [COPY.offerPerkVerdict, COPY.offerPerkPlan, COPY.offerPerkSpud]) {
      const row = el("div", "perk");
      row.append(el("span", "tick", "✓"), el("span", "", perk));
      perks.append(row);
    }
    box.append(perks);
    const tl = el("div", "card");
    for (const [when, words] of [[COPY.offerToday, COPY.offerTodayText], [COPY.offerBeforeEnd, COPY.offerBeforeText], [COPY.offerDay8, COPY.offerDay8Text]] as const) {
      const row = el("div", "rowline");
      row.append(el("span", "when", when), el("span", "muted", words));
      tl.append(row);
    }
    box.append(tl);
    // ONE PLAN, AS A REAL RADIO (#52). `/start/checkout` takes no plan — it is the one configured
    // checkout URL with this account's id filled in — so a second radio would be a choice that
    // chose nothing. What is offered is the subscription the free week leads into, checked, in a
    // group that takes more the day the link learns to carry one. And NAMED, never priced: this
    // client has never been sent a price, and the checkout page the link lands on owns the numbers.
    const plans = el("div", "card plans");
    plans.setAttribute("role", "radiogroup");
    plans.setAttribute("aria-label", COPY.offerPlans);
    const plan = el("label", "plan sel");
    const radio = el("input", "") as HTMLInputElement;
    radio.type = "radio";
    radio.name = "plan";
    radio.value = "monthly";
    radio.checked = true;
    plan.append(radio, el("span", "", COPY.offerPlanMonthly));
    plans.append(plan);
    box.append(plans);
    const foot = el("div", "step-foot");
    // `/start/checkout`, not the checkout URL itself: the backend fills this account's id into the
    // configured checkout from the `/start` session, same origin, so no client ever carries it —
    // the one paid link both offers share.
    const go = el("a", "cta p", COPY.startFreeWeek) as HTMLAnchorElement;
    go.href = "/start/checkout";
    const later = el("button", "cta g", COPY.offerLater) as HTMLButtonElement;
    // "Not now" re-renders: a meal exists by now, so the gate opens the diary it belongs on.
    later.addEventListener("click", () => { void render(); });
    foot.append(go, later, el("p", "hint", COPY.offerCheckoutHint));
    box.append(foot);
    return box;
  };

  // A queued turn landing mid-flow changes the gate's answer: redraw → render → the diary it is
  // on now.
  setRedraw(async () => { if (wrap.isConnected) await render(); });

  show(askStep());
  return wrap;
}
