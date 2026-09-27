// The log surface — `#/log` (W5, #92). The boards' web flow for one photo, end to end in a
// single place: pick or drop it, the scan while the analyzer reads it (the say line is the
// stream's own words — `PhotoProgress` carries each step already worded, so the bundle prints
// rather than composes), then the logged card with the server's verdict labels — or the
// rough-guess question, or the no-food refusal. The first verdict is `phone/first-verdict.html`'s
// content in the logged frame; there is no web board for it.
//
// What this screen does NOT do: it never derives a verdict (`verdictLabels` arrive worded from
// the server), it never invents a question (the engine's `mayAsk` decides — no `question` field
// means the card asks nothing, and without a server `MealQuestion` the rough card stays quiet),
// and it does not draw the failure states itself — they are Chat states (design-pro on #92), so
// a failed or unanswered photo is kept and the person is handed to `#/chat`, where W7 draws the
// coach card with "Send it again".
//
// Edit and Correct open the meal's fix panel — `#/meal/<id>?fix` (#188): the edit is Cal AI's
// one-field sheet over the meal detail, never the chat.

import { logCopyFor } from "../../shared/app/log-copy.ts";
import { isMeal, outcomeUnknown } from "../../shared/results.ts";
import { dayBudget, type DayBudget } from "../../shared/budget.ts";
import { localDate } from "../../shared/dates.ts";
import { LANG_TAG, UNIT_KCAL, spellUnit, wholeNumbers } from "../../shared/lang.ts";
import { ico as icoMarkup, type HeroCallout } from "../../shared/ui/kit.ts";
import type { MealItem, MealLogged, MealUpdated } from "@eait/shared";
import type {
  MessageResponse, PhotoLast, PhotoProgress, ProfileResponse,
} from "@eait/shared/contract";
import { ApiError, api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import {
  COPY, clear, el, firstMealDue, lang, names, refusalWords, sendOrKeep,
} from "../shell.ts";
import type { Frame } from "../shell.ts";
import { outbox, type WebQueued } from "../outbox.ts";
import { shrinkPhotos } from "../photo.ts";
import {
  ctaEl, gramMacsEl, kitEl, optionRowEl, photoHeroEl, spudAvatarEl, verdictListEl,
} from "../kit.ts";

/**
 * A meal a result view draws — `logged` and `updated` carry the verdict's words (`verdictLabels`);
 * a `redated` result does not (nothing was recomputed), so it lands on Chat rather than on a card
 * drawn without them.
 */
type LoggedMeal = Pick<MealLogged, "mealId" | "analysis" | "totals" | "date" | "verdictLabels">;

/** The picked photo as a data URL — `img-src 'self' data:` covers it; a blob URL would not. */
const dataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

export function logScreen(frame: Frame): HTMLElement {
  const wrap = el("section", "log centre");
  const me = frame.me;
  // A signed-out visitor never reaches this screen — the shell draws the sign-in first — so a
  // missing profile gets the empty surface rather than an upload that cannot send.
  if (me === null) return wrap;
  const L = logCopyFor(lang);
  const n = wholeNumbers(lang);
  const g = spellUnit(lang, "g");
  const coach = me.coachName;

  /** The bar's right side on the upload view — the plain date, "Thursday 24 September". */
  const dayText = (): string =>
    new Intl.DateTimeFormat(LANG_TAG[lang], {
      timeZone: me.timezone, weekday: "long", day: "numeric", month: "long",
    }).format(new Date());
  frame.bar.append(el("span", "", dayText()));

  /** The time a stamp or label names, in the account's own timezone — "13:05". */
  const atTime = (when: Date): string =>
    new Intl.DateTimeFormat(LANG_TAG[lang], {
      timeZone: me.timezone, hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(when);

  /** The day's budget the counter reads — the shared arithmetic, never a client subtraction. */
  const budgetOf = (r: LoggedMeal): DayBudget =>
    dayBudget({ date: r.date, meals: [r], totals: r.totals, targets: me.targets },
      localDate(me.timezone), me.profile.goal);

  /** The counter's right figure — "582 left", "120 over"; the day's own state words it. */
  const budgetTail = (b: DayBudget): string | null =>
    b.state === "left" ? fill(L.dayLeft, { left: n(b.kcal) })
      : b.state === "over" ? fill(L.dayOver, { over: n(b.kcal) })
        : null;

  let picked: File[] = [];
  // Picks race each other — a slow first shrink must not overwrite a newer, faster one.
  let pickSeq = 0;
  let photoUrl = "";
  let captured = new Date();
  let notice: HTMLElement | null = null;
  let readingWords: HTMLElement | null = null;
  let busy = false;

  const tell = (words: string): void => {
    notice?.remove();
    notice = el("p", "notice", words);
    wrap.append(notice);
  };

  /** A say row — the kit's avatar and the words. */
  const say = (mood: "think" | "care" | "happy", text: string, q = false): HTMLElement => {
    const row = el("div", `say logsay${q ? " q" : ""}`);
    row.append(spudAvatarEl(mood), el("p", "", text));
    return row;
  };

  /** The photo's callouts — an item a corner in the boards' order, grams and kcal the server's. */
  const callouts = (items: readonly MealItem[]): HeroCallout[] => {
    const corners = ["tl", "bl", "br", "tr"] as const;
    return items.filter((it) => it.grams > 0).slice(0, corners.length).map((it, i) => ({
      text: `${it.name} ${n(it.grams)} ${g}`,
      ...(it.kcal === undefined ? {} : { value: n(it.kcal) }),
      corner: corners[i]!,
      // The bottom-right callout lifts off the stamp lane, as the boards draw it.
      lift: corners[i] === "br",
    }));
  };

  const hero = (alt: string, scan: boolean, items: readonly MealItem[] = []): Element => {
    const h = photoHeroEl({
      src: photoUrl, alt, pad: 18, stamp: atTime(captured), scan,
      callouts: callouts(items),
    });
    h.classList.toggle("reading", scan);
    return h;
  };

  // ── The upload view ─────────────────────────────────────────────────────────────────────────

  const file = el("input", "visually-hidden") as HTMLInputElement;
  file.type = "file";
  file.accept = "image/jpeg,image/png,image/webp";
  file.addEventListener("change", () => {
    void takeFiles([...file.files ?? []]);
    file.value = "";
  });

  const dropLead = el("span", "drop-lead", "");
  const drop = el("div", "drop");
  drop.tabIndex = 0;
  drop.setAttribute("role", "button");
  drop.append(kitEl(icoMarkup("upload")), dropLead, el("small", "", L.web.chooseFile), file);

  const takeFiles = async (files: File[]): Promise<void> => {
    notice?.remove();
    // The server's own limits, sent on the profile — a client-side default would guess.
    if (files.length > me.limits.maxPhotosPerMeal) {
      tell(fill(COPY.photosMax, { n: n(me.limits.maxPhotosPerMeal) }));
      return;
    }
    const mine = ++pickSeq;
    // Resized BEFORE the byte check: the cap weighs what goes up, not what was picked.
    const shrunk = await shrinkPhotos(files);
    if (mine !== pickSeq) return;
    if (shrunk.reduce((sum, f) => sum + f.size, 0) > me.limits.maxUploadBytes) {
      tell(COPY.photoTooLarge);
      return;
    }
    picked = shrunk;
    dropLead.textContent = picked.map((f) => f.name).join(", ") || L.web.dropHint;
  };
  void takeFiles([]);

  drop.addEventListener("click", () => file.click());
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); }
  });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    void takeFiles([...e.dataTransfer?.files ?? []]);
  });

  const note = el("input", "lognote") as HTMLInputElement;
  note.type = "text";
  note.placeholder = L.notePlaceholder;

  const analyse = ctaEl({ text: L.web.analyzeCta, kind: "p" }) as HTMLButtonElement;
  analyse.addEventListener("click", () => void send());

  const drawUpload = (): void => {
    wrap.className = "log centre";
    readingWords = null;
    clear(wrap).append(
      el("h1", "", L.web.title), drop, note, analyse,
      ctaEl({ text: fill(L.web.chatInstead, { coach }), kind: "g", href: "#/chat" }),
    );
  };

  // ── The reading view — the photo and the scan; no callouts, no numbers yet ──────────────────

  const drawReading = (): void => {
    wrap.className = "log";
    const grid = el("div", "loggrid");
    const side = el("div", "logcol tall");
    // The stream's progress words land on this line as they arrive — `glance` carries its own
    // text, `reading`/`item` carry `line`, each already worded on the server.
    const sayRow = el("div", "say logsay");
    readingWords = el("p", "", L.reading);
    sayRow.append(spudAvatarEl("think"), readingWords);
    const checking = ctaEl({ text: L.checking, kind: "s" }) as HTMLButtonElement;
    checking.disabled = true;
    side.append(
      el("span", "lab", `${atTime(captured)} · ${L.web.fromPhoto}`),
      sayRow,
      el("div", "logpush"),
      checking,
      ctaEl({ text: L.close, kind: "g", href: "#/" }),
    );
    grid.append(hero("", true), side);
    clear(wrap).append(grid);
  };

  // ── The meal card — the analysis's own numbers, the server's verdicts ────────────────────────

  const mealCard = (r: LoggedMeal, delay: string | null): HTMLElement => {
    const card = el("div", "card");
    if (delay !== null) { card.classList.add("rise"); card.style.setProperty("--d", delay); }
    const top = el("div", "row between");
    const figure = el("span", "num kcalrow");
    figure.append(kitEl(icoMarkup("kcal")), el("b", "", n(r.analysis.kcal)),
      el("span", "", UNIT_KCAL[lang]));
    top.append(el("b", "mealname", names(r.analysis.items)), figure);
    card.append(top, gramMacsEl({
      protein: r.analysis.protein_g, carbs: r.analysis.carbs_g, fat: r.analysis.fat_g,
    }));
    card.append(el("div", "hr"));
    // The pills arrive already worded (`verdictLabels`) — the bundle composes no verdict text.
    const list = verdictListEl(r.verdictLabels.map((v) => ({ tone: v.tone, words: v.label })));
    if (list !== null) card.append(list);
    if (r.analysis.confidence === "low") {
      const mark = el("div", "rough");
      mark.append(kitEl(icoMarkup("info")), el("span", "", L.roughGuess));
      card.append(mark);
    }
    return card;
  };

  /** The say line under the card — the detail a declared cap that ran high gets (`ldl`). */
  const detailLine = (r: LoggedMeal): HTMLElement | null => {
    const ldl = r.verdictLabels.find((v) => v.dimension === "ldl");
    if (ldl === undefined || ldl.tone === "good") return null;
    if (me.targets.satfat_g === undefined) return null;
    return say("care", fill(L.verdictDetail, {
      noun: L.satfatNoun, amount: n(r.analysis.satfat_g), target: n(me.targets.satfat_g),
    }));
  };

  /** The day counter — the server's day totals read through the shared day budget. */
  const dayCard = (r: LoggedMeal): HTMLElement => {
    const budget = budgetOf(r);
    const card = el("div", "card flat");
    card.style.padding = "12px 16px";
    const row = el("div", "dayrow");
    const lead = el("span", "num");
    lead.append(kitEl(icoMarkup("kcal")), el("b", "", ` ${n(budget.eaten)}`),
      el("span", "muted", ` ${fill(L.dayOfPlan, { plan: n(budget.target) })}`));
    row.append(lead);
    const tail = budgetTail(budget);
    if (tail !== null) row.append(el("span", "num muted", tail));
    card.append(row);
    if (budget.target > 0) {
      const bar = el("div", "bar");
      const fill_ = el("i", "");
      fill_.style.width = `${Math.round(budget.fill * 100)}%`;
      bar.append(fill_);
      card.append(bar);
    }
    return card;
  };

  const actionsRow = (r: LoggedMeal): HTMLElement => {
    const row = el("div", "logbtns");
    row.append(
      ctaEl({ text: L.edit, kind: "s", href: `#/meal/${encodeURIComponent(r.mealId)}?fix` }),
      ctaEl({ text: L.agree, kind: "p", href: "#/" }),
    );
    return row;
  };

  // ── The result views ─────────────────────────────────────────────────────────────────────────

  const drawResult = (r: MealLogged | MealUpdated, first: boolean): void => {
    wrap.className = "log";
    const grid = el("div", "loggrid wide");
    const side = el("div", "logcol");

    if (first) {
      // The phone board's content in the logged frame: the heading, the same photo and card,
      // Correct and Continue — Spud's paragraph is gone (the board's own note).
      side.append(say("happy", L.firstVerdict, true), mealCard(r, ".4s"));
      const btns = el("div", "logbtns");
      btns.append(
        ctaEl({ text: L.correct, kind: "s", icon: "sparkle", href: `#/meal/${encodeURIComponent(r.mealId)}?fix` }),
        // W9's plans paywall is `#/pay` — unbound until it lands; the fallthrough lands Home.
        ctaEl({ text: L.continueCta, kind: "p", href: "#/pay" }),
      );
      side.append(btns);
    } else if (r.kind === "logged" && r.hint === "lowConfidence") {
      side.append(el("span", "lab", `${L.logged} · ${atTime(new Date())}`), mealCard(r, null));
      const ask = roughBlock(r);
      if (ask !== null) side.append(ask);
      side.append(dayLine(r), actionsRow(r));
    } else {
      side.append(el("span", "lab", `${L.logged} · ${atTime(new Date())}`), mealCard(r, "0s"));
      const detail = detailLine(r);
      if (detail !== null) {
        const d = el("div", "rise");
        d.style.setProperty("--d", ".15s");
        d.append(detail);
        side.append(d);
      }
      const day = el("div", "rise");
      day.style.setProperty("--d", ".3s");
      day.append(dayCard(r));
      side.append(day, actionsRow(r));
    }
    grid.append(hero(names(r.analysis.items), false, r.analysis.items), side);
    clear(wrap).append(grid);
  };

  /** The day counter as the rough board's one centred line. */
  const dayLine = (r: LoggedMeal): HTMLElement => {
    const budget = budgetOf(r);
    const line = el("div", "logday num");
    const tail = budgetTail(budget);
    line.textContent = tail === null
      ? fill(L.dayEaten, { eaten: n(budget.eaten), plan: n(budget.target) })
      : `${fill(L.dayEaten, { eaten: n(budget.eaten), plan: n(budget.target) })} · ${tail}`;
    return line;
  };

  /**
   * The rough card's question — the server's own `MealQuestion`, and ONLY it: without one the
   * card asks nothing (the engine's `mayAsk` already decided; the client composes no question of
   * its own — #92 review). Every option is a text correction turn with this meal in focus — the
   * one correction path. A meal result re-draws the card; anything else hands the thread to Chat.
   */
  const roughBlock = (r: MealLogged): HTMLElement | null => {
    const q = r.question;
    if (q === undefined || q.options.length === 0) return null;

    const block = el("div", "");
    const askRow = el("div", "rise");
    askRow.style.setProperty("--d", ".15s");
    askRow.append(say("think", q.text, true));
    const opts = el("div", "card");
    opts.style.padding = "4px 16px";
    opts.classList.add("rise");
    opts.style.setProperty("--d", ".3s");

    const send = async (text: string): Promise<void> => {
      // A property, not a variable: an assignment inside a callback is invisible to narrowing, so
      // `answer !== null` would read as never. (first-meal.ts's `got` does the same.)
      const got: { r: MessageResponse | PhotoLast | null } = { r: null };
      try {
        const keptNote = await sendOrKeep(
          {
            id: crypto.randomUUID(), userId: me.profile.user_id, kind: "text",
            text, photos: [], capturedAt: new Date().toISOString(), focusMealId: r.mealId,
          },
          { onResult: (rr) => { got.r = rr; } },
        );
        if (keptNote !== undefined) { location.hash = "#/chat"; return; }
      } catch (err) {
        tell(refusalWords(err));
        return;
      }
      const answer = got.r;
      // A `redated` answer carries no verdict words — it is Chat's to draw, not this card's.
      if (answer !== null && isMeal(answer) && answer.kind !== "redated") {
        drawResult(answer, false);
        return;
      }
      location.hash = "#/chat";
    };

    for (const o of q.options) {
      const row = optionRowEl({ text: o, tag: "button" }) as HTMLElement;
      row.addEventListener("click", () => void send(o));
      opts.append(row);
    }
    block.append(askRow, opts);
    return block;
  };

  // ── The refusal view — no food is an answer, not an error ────────────────────────────────────

  const drawRefused = (): void => {
    wrap.className = "log centre refused";
    const plate = el("div", "plate");
    plate.append(kitEl(icoMarkup("no-food")));
    const again = ctaEl({ text: L.tryAnotherPhoto, kind: "p", icon: "upload" }) as HTMLButtonElement;
    again.addEventListener("click", () => {
      picked = [];
      photoUrl = "";
      dropLead.textContent = L.web.dropHint;
      note.value = "";
      drawUpload();
    });
    clear(wrap).append(plate, el("h1", "", L.noFood), again,
      ctaEl({ text: L.close, kind: "g", href: "#/" }));
  };

  // ── The send ─────────────────────────────────────────────────────────────────────────────────

  const send = async (): Promise<void> => {
    if (busy || picked.length === 0) return;
    busy = true;
    captured = new Date();
    // The ONE first-meal answer, read FRESH — the profile on screen was fetched at mount and a
    // meal since logged flips `hasLoggedMeal`/`sampleUsed` without the cache knowing. The cached
    // profile is the fallback when the refresh itself fails.
    const now = await api<ProfileResponse>("/profile").catch(() => me);
    const first = firstMealDue(now);
    photoUrl = await dataUrl(picked[0]!);
    const entry: WebQueued = {
      id: crypto.randomUUID(), userId: me.profile.user_id, kind: "photo",
      text: note.value.trim() === "" ? null : note.value.trim(),
      photos: [...picked], capturedAt: captured.toISOString(),
    };
    drawReading();
    try {
      let result: MealLogged | null = null;
      const keptNote = await sendOrKeep(entry, {
        onLine: (line) => {
          const ev = line as PhotoProgress;
          // Printed, never composed — the line each event carries is already worded (#608).
          if (readingWords !== null) readingWords.textContent = ev.kind === "glance" ? ev.text : ev.line;
        },
        onResult: (r: MessageResponse | PhotoLast) => { if (r.kind === "logged") result = r; },
      });
      // No answer — kept. The kept turn's own state lives on Chat (states-unknown is W7's).
      if (keptNote !== undefined) { location.hash = "#/chat"; return; }
      if (result !== null) drawResult(result, first);
    } catch (err) {
      const kind = err instanceof ApiError ? String(err.body?.error ?? "") : "";
      if (kind === "not-food") { drawRefused(); return; }
      if (kind === "analysis-failed" || outcomeUnknown(kind)) {
        // "Nothing was logged. Your photo is kept." — kept HELD, so the drain does not quietly
        // send it again and Chat's card offers "Send it again" on it (states-failed is W7's). A
        // resend mints a new client id (`outbox.resend`) — replaying the id would answer the
        // stored failure (#708) without calling the model.
        try {
          await outbox.add({ ...entry, held: { kind } });
          location.hash = "#/chat";
        } catch {
          // The keep itself failed — say so, rather than promise a photo that went nowhere.
          drawUpload();
          tell(COPY.notSaved);
        }
        return;
      }
      drawUpload();
      tell(refusalWords(err));
    } finally {
      busy = false;
    }
  };

  drawUpload();
  return wrap;
}
