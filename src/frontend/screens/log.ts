// The log surface — `#/log` (W5, #92). The boards' web flow for one photo, end to end in a
// single place: pick or drop it, the scan while the analyzer reads it, then the logged card with
// the computed verdicts — or the rough-guess question, or the no-food refusal. The first verdict
// is `phone/first-verdict.html`'s content in the logged frame; there is no web board for it.
//
// What this screen does NOT do: it never derives a verdict (the server computes every one), it
// never invents a question (the engine's `mayAsk` decides; no `question` field means the card
// asks nothing), and it does not draw the failure states itself — they are Chat states
// (design-pro on #92), so a failed or unanswered photo is kept and the person is handed to
// `#/chat`, where W7 draws the coach card with "Send it again".
//
// Edit and Correct open the conversation with the meal in focus — `#/chat?focus=<id>` — the same
// ruling the meal detail got on #93: the edit is just a chat.

import { logCopyFor } from "../../shared/app/log-copy.ts";
import { shellCopyFor } from "../../shared/app/shell-copy.ts";
import { isMeal, outcomeUnknown } from "../../shared/results.ts";
import { LANG_TAG, UNIT_KCAL, spellUnit, wholeNumbers } from "../../shared/lang.ts";
import { ico as icoMarkup, type HeroCallout } from "../../shared/ui/kit.ts";
import type { MealItem, MealLogged, MealRedated, MealUpdated } from "@eait/shared";
import type {
  MessageResponse, PhotoLast, ProfileResponse, WeekResponse,
} from "@eait/shared/contract";
import { ApiError, api } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { COPY, WEEK, clear, el, lang, names, refusalWords, sendOrKeep } from "../shell.ts";
import type { Frame } from "../shell.ts";
import { outbox, type WebQueued } from "../outbox.ts";
import {
  ctaEl, gramMacsEl, kitEl, optionRowEl, photoHeroEl, spudAvatarEl, verdictListEl,
  verdictNounText, verdictWords,
} from "../kit.ts";

/** A meal a result view draws — `logged`, `updated` and `redated` all carry this shape. */
type LoggedMeal = Pick<MealLogged, "mealId" | "analysis" | "totals" | "date">;

/** The picked photo as a data URL — `img-src 'self' data:` covers it; a blob URL would not. */
const dataUrl = (file: File): Promise<string> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(String(r.result));
  r.onerror = () => reject(r.error);
  r.readAsDataURL(file);
});

/** The time a stamp or label names, in the account's own timezone — "13:05". */
const atTime = (me: ProfileResponse | null, when: Date): string =>
  new Intl.DateTimeFormat(LANG_TAG[lang], {
    timeZone: me?.timezone, hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(when);

/** The bar's right side on the upload view — the plain date, "Thursday 24 September". */
const dayText = (me: ProfileResponse | null): string =>
  new Intl.DateTimeFormat(LANG_TAG[lang], {
    timeZone: me?.timezone, weekday: "long", day: "numeric", month: "long",
  }).format(new Date());

/**
 * Whether the meal about to be logged is the account's first — the same condition Home's
 * `firstMealScreen` uses (design-pro on #92), so the two surfaces can never disagree about which
 * meal was first: onboarded, no entitlement, the server's `sampleUsed` still false, and the
 * diary window the server will reach back to reads empty.
 */
async function isFirstMeal(me: ProfileResponse | null): Promise<boolean> {
  if (me === null || me.onboarded !== true || me.entitlement.active || me.limits.sampleUsed) return false;
  const marked = await api<WeekResponse>(`${WEEK}?days=${me.limits.diaryWindowDays}`).catch(() => null);
  return marked !== null && marked.days.length === 0;
}

/**
 * The item a rough card's composed question names — the one with the most grams; a tie goes to
 * the first listed (design-pro on #92). Nothing is asked when no item carries grams.
 */
export const roughPick = (items: readonly MealItem[]): MealItem | null => {
  let pick: MealItem | null = null;
  for (const it of items) {
    if (it.grams > 0 && (pick === null || it.grams > pick.grams)) pick = it;
  }
  return pick;
};

/**
 * The grams the composed answers mean: "Half that" is grams ÷ 2 rounded to 5 g; "More like
 * {n} g" is grams × 1.5 rounded UP to the next 50 g at 100 g or more, the next 10 g below it —
 * 150 → 250, as the board draws (design-pro on #92).
 */
export const roughGrams = (grams: number): { half: number; more: number } => ({
  half: Math.max(5, Math.round(grams / 10) * 5),
  more: Math.ceil((grams * 1.5) / (grams >= 100 ? 50 : 10)) * (grams >= 100 ? 50 : 10),
});

export function logScreen(frame: Frame): HTMLElement {
  const me = frame.me;
  const L = logCopyFor(lang);
  const n = wholeNumbers(lang);
  const g = spellUnit(lang, "g");
  const coach = shellCopyFor(lang).coachName;
  const wrap = el("section", "log centre");
  frame.bar.append(el("span", "", dayText(me)));

  let picked: File[] = [];
  let photoUrl = "";
  let captured = new Date();
  let notice: HTMLElement | null = null;
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
      src: photoUrl, alt, pad: 18, stamp: atTime(me, captured), scan,
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
    takeFiles([...file.files ?? []]);
    file.value = "";
  });

  const dropLead = el("span", "drop-lead", "");
  const drop = el("div", "drop");
  drop.tabIndex = 0;
  drop.setAttribute("role", "button");
  drop.append(kitEl(icoMarkup("upload")), dropLead, el("small", "", L.web.chooseFile), file);

  const takeFiles = (files: File[]): void => {
    notice?.remove();
    const max = me?.limits.maxPhotosPerMeal ?? 4;
    const bytes = me?.limits.maxUploadBytes ?? 0;
    if (files.length > max) { tell(fill(COPY.photosMax, { n: `${max}` })); return; }
    if (bytes > 0 && files.reduce((sum, f) => sum + f.size, 0) > bytes) { tell(COPY.photoTooLarge); return; }
    picked = files;
    dropLead.textContent = picked.map((f) => f.name).join(", ") || L.web.dropHint;
  };
  takeFiles([]);

  drop.addEventListener("click", () => file.click());
  drop.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); file.click(); }
  });
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("over");
    takeFiles([...e.dataTransfer?.files ?? []]);
  });

  const note = el("input", "lognote") as HTMLInputElement;
  note.type = "text";
  note.placeholder = L.notePlaceholder;

  const analyse = ctaEl({ text: L.web.analyzeCta, kind: "p" }) as HTMLButtonElement;
  analyse.addEventListener("click", () => void send());

  const drawUpload = (): void => {
    wrap.className = "log centre";
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
    const checking = ctaEl({ text: L.checking, kind: "s" }) as HTMLButtonElement;
    checking.disabled = true;
    side.append(
      el("span", "lab", `${atTime(me, captured)} · ${L.web.fromPhoto}`),
      say("think", L.reading),
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
    const list = verdictListEl(verdictWords(r.analysis.verdicts));
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
    const target = me?.targets.satfat_g;
    const v = r.analysis.verdicts as Record<string, string | undefined>;
    if (v["ldl"] !== "warn" && v["ldl"] !== "bad") return null;
    if (target === undefined) return null;
    return say("care", fill(L.verdictDetail, {
      noun: verdictNounText("ldl"), amount: n(r.analysis.satfat_g), target: n(target),
    }));
  };

  /** The day counter — the server's day totals against the account's own target. */
  const dayCard = (r: LoggedMeal): HTMLElement => {
    const card = el("div", "card flat");
    card.style.padding = "12px 16px";
    const row = el("div", "dayrow");
    const left = el("span", "num muted");
    const lead = el("span", "num");
    if (me?.targets.kcal !== undefined) {
      lead.append(kitEl(icoMarkup("kcal")), el("b", "", ` ${n(r.totals.kcal)}`),
        el("span", "muted", ` ${fill(L.dayEaten, { eaten: "", plan: n(me.targets.kcal) }).trim()}`));
      left.textContent = fill(L.dayLeft, { left: n(Math.max(0, me.targets.kcal - r.totals.kcal)) });
    } else {
      lead.append(kitEl(icoMarkup("kcal")), el("b", "", ` ${n(r.totals.kcal)}`),
        el("span", "muted", ` ${UNIT_KCAL[lang]}`));
    }
    row.append(lead, left);
    card.append(row);
    if (me?.targets.kcal !== undefined && me.targets.kcal > 0) {
      const bar = el("div", "bar");
      const fill_ = el("i", "");
      fill_.style.width = `${Math.min(100, Math.round((r.totals.kcal / me.targets.kcal) * 100))}%`;
      bar.append(fill_);
      card.append(bar);
    }
    return card;
  };

  const actionsRow = (r: LoggedMeal): HTMLElement => {
    const row = el("div", "logbtns");
    row.append(
      ctaEl({ text: L.edit, kind: "s", href: `#/chat?focus=${r.mealId}` }),
      ctaEl({ text: L.agree, kind: "p", href: "#/" }),
    );
    return row;
  };

  // ── The result views ─────────────────────────────────────────────────────────────────────────

  const drawResult = (r: MealLogged | MealUpdated | MealRedated, first: boolean): void => {
    wrap.className = "log";
    const grid = el("div", "loggrid wide");
    const side = el("div", "logcol");

    if (first) {
      // The phone board's content in the logged frame: the heading, the same photo and card,
      // Correct and Continue — Spud's paragraph is gone (the board's own note).
      side.append(say("happy", L.firstVerdict, true), mealCard(r, ".4s"));
      const btns = el("div", "logbtns");
      btns.append(
        ctaEl({ text: L.correct, kind: "s", icon: "sparkle", href: `#/chat?focus=${r.mealId}` }),
        // W9's plans paywall is `#/pay` — unbound until it lands; the fallthrough lands Home.
        ctaEl({ text: L.continueCta, kind: "p", href: "#/pay" }),
      );
      side.append(btns);
    } else if (r.kind === "logged" && r.hint === "lowConfidence") {
      side.append(el("span", "lab", `${L.logged} · ${atTime(me, new Date())}`), mealCard(r, null));
      const ask = roughBlock(r);
      if (ask !== null) side.append(ask);
      side.append(dayLine(r), actionsRow(r));
    } else {
      side.append(el("span", "lab", `${L.logged} · ${atTime(me, new Date())}`), mealCard(r, "0s"));
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
    const line = el("div", "logday num");
    const target = me?.targets.kcal;
    const eaten = `${n(r.totals.kcal)} ${UNIT_KCAL[lang]}`;
    line.textContent = target === undefined
      ? eaten
      : `${fill(L.dayEaten, { eaten: n(r.totals.kcal), plan: n(target) })} · ${fill(L.dayLeft, { left: n(Math.max(0, target - r.totals.kcal)) })}`;
    return line;
  };

  /**
   * The rough card's question: the server's own `MealQuestion` when it sent one, else the grams
   * question the copy composes about the largest item. Every option is a text correction turn
   * with this meal in focus — the one correction path — except "About that", which just closes
   * the ask. A meal result re-draws the card; anything else hands the thread to Chat, where the
   * answer lives.
   */
  const roughBlock = (r: MealLogged): HTMLElement | null => {
    const item = r.question === undefined ? roughPick(r.analysis.items) : null;
    const question = r.question?.text
      ?? (item === null ? null : fill(L.roughAsk, { item: item.name, grams: n(item.grams) }));
    if (question === null) return null;

    const block = el("div", "");
    const askRow = el("div", "rise");
    askRow.style.setProperty("--d", ".15s");
    askRow.append(say("think", question, true));
    const opts = el("div", "card");
    opts.style.padding = "4px 16px";
    opts.classList.add("rise");
    opts.style.setProperty("--d", ".3s");

    const send = async (text: string): Promise<void> => {
      let answer: MessageResponse | PhotoLast | null = null;
      try {
        const keptNote = await sendOrKeep(
          {
            id: crypto.randomUUID(), userId: me?.profile.user_id ?? "", kind: "text",
            text, photos: [], capturedAt: new Date().toISOString(), focusMealId: r.mealId,
          },
          { onResult: (rr) => { answer = rr; } },
        );
        if (keptNote !== undefined) { location.hash = "#/chat"; return; }
      } catch (err) {
        tell(refusalWords(err));
        return;
      }
      if (answer !== null && isMeal(answer)) { drawResult(answer, false); return; }
      location.hash = "#/chat";
    };

    const opt = (text: string, fn?: () => void): HTMLElement => {
      const row = optionRowEl({ text, tag: "button" }) as HTMLElement;
      row.addEventListener("click", () => fn ? fn() : void send(text));
      return row;
    };
    if (r.question !== undefined && r.question.options.length > 0) {
      for (const o of r.question.options) opts.append(opt(o));
    } else if (item !== null) {
      const grams = roughGrams(item.grams);
      const sent = (gg: number) => fill(L.roughSent, { item: item.name, grams: n(gg) });
      opts.append(
        opt(L.roughAbout, () => block.remove()),
        opt(L.roughHalf, () => void send(sent(grams.half))),
        opt(fill(L.roughMore, { grams: n(grams.more) }), () => void send(sent(grams.more))),
      );
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
    const first = await isFirstMeal(me);
    photoUrl = await dataUrl(picked[0]!);
    const entry: WebQueued = {
      id: crypto.randomUUID(), userId: me?.profile.user_id ?? "", kind: "photo",
      text: note.value.trim() === "" ? null : note.value.trim(),
      photos: [...picked], capturedAt: captured.toISOString(),
    };
    drawReading();
    try {
      let result: MealLogged | null = null;
      const keptNote = await sendOrKeep(entry, {
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
        // send it again and Chat's card offers "Send it again" on it (states-failed is W7's).
        await outbox.add({ ...entry, held: { kind } }).catch(() => {});
        location.hash = "#/chat";
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
