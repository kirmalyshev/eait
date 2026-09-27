// You — the account's own surface, Register P (`web/you.html`, W10 #97). Two columns at desktop
// width: the left is the board's order — the identity card's fact line, the weight card whose
// "Log weight" writes a weigh-in, the plan card with its inline edit, then the flat account rows
// (Health · Subscription · Account · Units · Language · Telegram · Sign out); the right is the
// today column the web boards give every surface — week strip, kcal-left hero, the macro cards.
//
// EVERY NUMBER IS THE SERVER'S. The plan figures come off `targets`, the floor off `basis`, the
// free week's day off `entitlement.trialDay` (the server counts it — a client that counts dates
// disagrees with the reminders, #97), the "connected" claim off `healthConnected`. The day column
// reads `/v1/diary/days` and `/v1/diary/day`; the weigh-in and the edits are PATCHes answered by
// the recomputed view. Nothing here derives a target or counts a day.

import { dayBudget } from "../../shared/budget.ts";
import { dateMinus, localDate, weekStart } from "../../shared/dates.ts";
import { signsIn } from "../../shared/contract.ts";
import { LANG_LABEL, LANG_TAG, LANGS_READY, UNIT_KCAL, numbers, wholeNumbers } from "../../shared/lang.ts";
import {
  heightText, weightDisplayValue, weightToKg, type UnitSystem,
} from "../../shared/ui/units.ts";
import { shellCopyFor } from "../../shared/app/shell-copy.ts";
import { youCopyFor } from "../../shared/app/you-copy.ts";
import type { OnboardingContent } from "@eait/shared";
import type {
  DayResponse, DaysResponse, IdentitiesResponse, OnboardingContentResponse,
  PairCodeResponse, ProfileResponse, WeightsResponse,
} from "@eait/shared/contract";
import { api, signOut } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { kitEl, macEl, mcardEl, ringEl, weekStripEl, weightChartEl } from "../kit.ts";
import { outbox } from "../outbox.ts";
import {
  clear, COPY, el, forgetProfile, lang, profile, refusalWords, render, setHeldProposal,
  setLastThread, type Frame,
} from "../shell.ts";

// The provider's own names — proper nouns, never translated (like LANG_LABEL).
const PROVIDER_NAME: Record<string, string> = { apple: "Apple", google: "Google" };

export async function youScreen(frame: Frame): Promise<HTMLElement> {
  const wrap = el("section", "you");
  // One h1 per page, clipped for the landmark — the boards draw no centred title on web.
  wrap.append(el("h1", "visually-hidden", shellCopyFor(lang).navProfile));
  let me = frame.me;
  if (me === null) {
    wrap.append(el("p", "notice", COPY.somethingWrong));
    return wrap;
  }

  const you = youCopyFor(lang);
  const n = numbers(lang);
  const nWhole = wholeNumbers(lang);
  const dayName = new Intl.DateTimeFormat(LANG_TAG[lang], { dateStyle: "full" });
  // The account's timezone and its today — the server's calendar, never UTC's.
  const zone = me.timezone;

  const cols = el("div", "ygrid");
  const leftCol = el("div", "wcol");
  const rightCol = el("div", "wcol");
  cols.append(leftCol, rightCol);
  wrap.append(cols);

  // The board's date row lives in the top bar (wtop's right side) — the day the column shows.
  let viewing = localDate(zone);
  const prev = el("button", "barbtn", "‹") as HTMLButtonElement;
  prev.type = "button";
  prev.setAttribute("aria-label", COPY.dayPrev);
  const dateCell = el("span", "bardate");
  const next = el("button", "barbtn", "›") as HTMLButtonElement;
  next.type = "button";
  next.setAttribute("aria-label", COPY.dayNext);
  // Bound once — draw() only ever rewrites the label and the enabled state.
  prev.addEventListener("click", () => { viewing = dateMinus(viewing, 1); void draw(); });
  next.addEventListener("click", () => { if (viewing < localDate(zone)) { viewing = dateMinus(viewing, -1); void draw(); } });
  frame.bar.append(prev, dateCell, next);

  let mode: "none" | "weigh" | "plan" = "none";
  let saving = false;
  let drawing = 0;

  /** One shared alert line for a refused write — under the card that asked for it. */
  const noticeFor = (): { notice: HTMLElement; tell: (w: string | null) => void } => {
    const notice = el("p", "notice");
    notice.setAttribute("role", "alert");
    notice.hidden = true;
    return { notice, tell: (w) => { notice.textContent = w ?? ""; notice.hidden = w === null; } };
  };

  // ── LEFT: identity, weight, plan, the account rows ──────────────────────────────────────────

  const facts = (): string => {
    const p = me!.profile;
    const med = content?.content.screens.find((s) => s.id === "medical")?.options ?? {};
    const flags = p.restrictions
      .filter((r) => r in med && r !== "none")
      .map((r) => {
        const label = med[r]!.label;
        // "{condition} declared" wants the noun mid-sentence; other languages' templates carry
        // the label's own case (German keeps its noun capitalized).
        const c = lang === "en" ? label.charAt(0).toLowerCase() + label.slice(1) : label;
        return fill(you.flagDeclared, { condition: c });
      });
    const parts: string[] = [];
    if (p.birth_year !== null) parts.push(`${Number(localDate(zone).slice(0, 4)) - p.birth_year}`);
    if (p.height_cm !== null) parts.push(heightText(p.height_cm, units(), lang));
    parts.push(...flags);
    if (parts.length >= 3) {
      // The whole template — never fragments joined by code.
      return fill(you.headerFacts, { age: parts[0]!, height: parts[1]!, flags: parts.slice(2).join(" · ") });
    }
    if (parts.length === 2 && flags.length === 0) {
      return fill(you.headerFactsNoFlags, { age: parts[0]!, height: parts[1]! });
    }
    // A partial profile: the pieces that exist, spaced the same way.
    return parts.join(" · ");
  };

  const units = (): UnitSystem => me!.profile.units ?? "metric";
  const wnum = (kg: number): string => n(weightDisplayValue(kg, units()));

  const identityCard = (): HTMLElement => {
    const card = el("div", "card idcard");
    const av = el("span", "av");
    av.append(kitEl(`<i class="ico i-person" aria-hidden="true"></i>`));
    card.append(av, el("span", "facts", facts()));
    return card;
  };

  // ── The weight card — "Log weight" writes the same weigh-in the phone's scale board does. ──

  const weightCard = (w: WeightsResponse, noticeBox: { notice: HTMLElement; tell: (w: string | null) => void }): HTMLElement => {
    const card = el("div", "card rise");
    const head = el("div", "row between");
    head.append(el("span", "lab", you.weightLabel));
    const card_ = card;
    const body = el("div", "wbody");
    card_.append(head, body, noticeBox.notice);

    const dm = new Intl.DateTimeFormat(LANG_TAG[lang], { day: "numeric", month: "short" });
    const fmt = (d: string): string => dm.format(new Date(`${d}T12:00:00Z`));

    const target = me!.profile.target_weight_kg;
    const targetLane = target === null ? undefined : {
      label: fill(units() === "imperial" ? you.targetLb : you.targetKg, { w: wnum(target) }),
    };

    const drawChart = (): void => {
      clear(body);
      const points = w.weights.map((e) => ({
        t: Date.parse(`${e.date}T00:00:00Z`), kg: weightDisplayValue(e.kg, units()),
      }));
      const first = w.weights[0], last = w.weights.at(-1);
      const chart = el("div", "wchart");
      chart.append(weightChartEl(points, {
        aria: you.weightLabel,
        first: first ? wnum(first.kg) : "",
        last: last && w.weights.length > 1 ? wnum(last.kg) : "",
        from: first ? fmt(first.date) : "",
        to: last && w.weights.length > 1 ? fmt(last.date) : "",
      }, targetLane));
      body.append(chart);
    };

    const logBtn = el("button", "plink", you.logWeight) as HTMLButtonElement;
    logBtn.type = "button";

    if (mode === "weigh") {
      // The inline weigh-in: the last reading prefilled in the display unit, save writes the row.
      drawChart();
      const form = el("div", "wedit");
      const field = document.createElement("input");
      field.type = "number";
      field.step = "0.1";
      field.min = "0";
      field.setAttribute("aria-label", you.weightLabel);
      field.inputMode = "decimal";
      const latest = w.latest?.kg ?? me!.profile.weight_kg;
      if (latest !== null) field.value = `${weightDisplayValue(latest, units())}`;
      const unit = el("span", "m", units() === "imperial" ? "lb" : "kg");
      const row = el("div", "wrow");
      row.append(field, unit);
      const save = el("button", "cta p", you.web.save) as HTMLButtonElement;
      save.type = "button";
      const cancel = el("button", "cta g", COPY.cancel) as HTMLButtonElement;
      cancel.type = "button";
      cancel.addEventListener("click", () => { mode = "none"; void draw(); });
      save.addEventListener("click", async () => {
        const value = Number(field.value);
        if (!Number.isFinite(value) || value <= 0 || saving) return;
        saving = true;
        save.disabled = true;
        try {
          await api("/profile", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ weight_kg: weightToKg(units(), value) }),
          });
          forgetProfile();
          me = await profile();
          mode = "none";
          void draw();
        } catch (err) {
          noticeBox.tell(refusalWords(err));
        } finally {
          saving = false;
        }
      });
      form.append(row, el("div", "weditbtns"));
      form.querySelector(".weditbtns")!.append(save, cancel);
      body.append(form);
      field.focus();
    } else {
      drawChart();
      head.append(logBtn);
      logBtn.addEventListener("click", () => { mode = "weigh"; void draw(); });
    }
    return card;
  };

  // ── The plan card — the figures off `targets`, the floor off `basis`, edit recomputes. ────────

  const planCard = (ob: OnboardingContent | null, noticeBox: { notice: HTMLElement; tell: (w: string | null) => void }): HTMLElement => {
    const card = el("div", "card rise rc-1");
    const head = el("div", "row between");
    head.append(el("span", "lab", you.planLabel));
    const body = el("div", "");
    card.append(head, body, noticeBox.notice);

    if (mode === "plan") {
      // The inline editor: the three inputs the plan reads — goal, the weight it aims at, and
      // how active the days are — PATCHed; the card redraws off the server's recomputed targets.
      const optionSelect = (screenId: "goal" | "activity", current: string | null, label: string): HTMLSelectElement => {
        const sel = document.createElement("select");
        sel.className = "pick";
        sel.setAttribute("aria-label", label);
        const opts = ob?.screens.find((s) => s.id === screenId)?.options ?? {};
        for (const v of Object.keys(opts)) {
          const opt = document.createElement("option");
          opt.value = v;
          opt.textContent = opts[v]!.label;
          if (v === current) opt.selected = true;
          sel.append(opt);
        }
        return sel;
      };
      const row = (label: string, ctl: HTMLElement, extra?: HTMLElement): HTMLElement => {
        const r = el("div", "editrow");
        r.append(el("span", "lab", label), ctl);
        if (extra) r.append(extra);
        return r;
      };
      const p = me!.profile;
      const goalSel = optionSelect("goal", p.goal, you.phone.goalLabel);
      const targetField = document.createElement("input");
      targetField.type = "number";
      targetField.step = "0.1";
      targetField.min = "0";
      targetField.inputMode = "decimal";
      targetField.setAttribute("aria-label", you.phone.targetLabel);
      if (p.target_weight_kg !== null) targetField.value = `${weightDisplayValue(p.target_weight_kg, units())}`;
      const activitySel = optionSelect("activity", p.activity, you.phone.activitySection);
      const save = el("button", "cta p", you.web.save) as HTMLButtonElement;
      save.type = "button";
      const cancel = el("button", "cta g", COPY.cancel) as HTMLButtonElement;
      cancel.type = "button";
      cancel.addEventListener("click", () => { mode = "none"; void draw(); });
      save.addEventListener("click", async () => {
        const targetW = Number(targetField.value);
        if (saving || (targetField.value !== "" && (!Number.isFinite(targetW) || targetW <= 0))) return;
        saving = true;
        save.disabled = true;
        try {
          await api("/profile", {
            method: "PATCH",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              goal: goalSel.value,
              activity: activitySel.value,
              ...(targetField.value === "" ? {} : { target_weight_kg: weightToKg(units(), targetW) }),
            }),
          });
          forgetProfile();
          me = await profile();
          mode = "none";
          void draw();
        } catch (err) {
          noticeBox.tell(refusalWords(err));
        } finally {
          saving = false;
        }
      });
      const btns = el("div", "weditbtns");
      btns.append(save, cancel);
      body.append(
        row(you.phone.goalLabel, goalSel),
        row(you.phone.targetLabel, targetField, el("span", "m", units() === "imperial" ? "lb" : "kg")),
        row(you.phone.activitySection, activitySel),
        btns,
      );
      return card;
    }

    const edit = el("button", "elink", you.planEdit) as HTMLButtonElement;
    edit.type = "button";
    edit.addEventListener("click", () => { mode = "plan"; void draw(); });
    head.append(edit);

    const t = me!.targets;
    const fig = el("div", "planfig");
    fig.append(
      kitEl(`<i class="ico i-kcal" aria-hidden="true"></i>`),
      el("b", "d d22 num", `${nWhole(t.kcal)} ${UNIT_KCAL[lang]}`),
      el("span", "m", you.perDay),
    );
    const chips = [
      { name: "protein" as const, text: fill(you.proteinGrams, { g: nWhole(t.protein_g) }) },
      // The sat-fat figure exists only when a restriction was declared, like the target itself.
      ...(t.satfat_g !== undefined
        ? [{ name: "fat" as const, text: fill(you.satFatGrams, { g: nWhole(t.satfat_g) }) }]
        : [{ name: "fat" as const, text: fill(you.grams, { g: nWhole(t.fat_g) }) }]),
    ];
    const macrow = el("div", "macs");
    for (const c of chips) macrow.append(macEl(c.name, c.text));
    const foot = el("div", "row between");
    foot.append(macrow, el("span", "est", fill(you.floorMarker, { floor: nWhole(me!.basis.floorKcal) })));
    body.append(fig, foot);
    return card;
  };

  // ── The flat card: the account rows the board draws in one quiet list. ──────────────────────

  const optRow = (label: string, value: string, ctl?: HTMLElement): HTMLElement => {
    const row = el("div", "opt");
    row.append(el("span", "ot", label));
    if (ctl) row.append(ctl);
    else row.append(el("span", "ov", value));
    return row;
  };

  const rowsCard = (ids: IdentitiesResponse | null): HTMLElement => {
    const card = el("div", "card flat urows");
    // Read-only, and only while a sync is actually arriving — the server's own flag.
    if (me!.healthConnected === true) card.append(optRow(you.appleHealth, you.connected));
    card.append(optRow(
      you.subscription,
      me!.entitlement.trialDay != null ? fill(you.freeWeekDay, { n: `${me!.entitlement.trialDay}` }) : "",
    ));
    // The sign-in providers, minus the device credential — "Apple" the way the board writes it.
    const providers = (ids?.identities ?? [])
      .map((i) => i.provider)
      .filter((p) => signsIn(p) && p !== "device")
      .map((p) => PROVIDER_NAME[p] ?? p);
    card.append(optRow(you.account, providers.join(" · ")));

    // Units — the display system only; the profile stores metric and PATCH writes the preference.
    const unitsSel = document.createElement("select");
    unitsSel.className = "pick";
    unitsSel.setAttribute("aria-label", you.web.units);
    for (const [v, label] of [["metric", you.web.unitsMetric], ["imperial", you.web.unitsImperial]] as const) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      if (v === units()) o.selected = true;
      unitsSel.append(o);
    }
    unitsSel.addEventListener("change", async () => {
      await api("/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ units: unitsSel.value }),
      });
      forgetProfile();
      me = await profile();
      void draw();
    });
    card.append(optRow(you.web.units, "", unitsSel));
    // The picker's option labels are the languages' own names — never translated (LANG_LABEL).

    // Language — the existing behaviour: PATCH, then reload (the whole surface's copy changes).
    const langSel = document.createElement("select");
    langSel.className = "pick";
    langSel.setAttribute("aria-label", COPY.language);
    for (const code of LANGS_READY) {
      const o = document.createElement("option");
      o.value = code;
      // The endonym, never translated — the picker is the one list a person reads in the
      // language they are leaving.
      o.textContent = LANG_LABEL[code];
      if (code === lang) o.selected = true;
      langSel.append(o);
    }
    langSel.addEventListener("change", async () => {
      await api("/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ lang: langSel.value }),
      });
      location.reload();
    });
    card.append(optRow(COPY.language, "", langSel));

    // The action rows — a label and the chevron, like every forward row in the register.
    const actRow = (label: string): HTMLButtonElement => {
      const b = el("button", "opt", "") as HTMLButtonElement;
      b.type = "button";
      b.append(el("span", "ot", label), kitEl(`<i class="ico i-chevron-right ov" aria-hidden="true"></i>`));
      return b;
    };

    if (me!.telegramBot !== null) {
      // The code is minted at the TAP, not when the page is drawn: it lives five minutes, and the
      // bot has to receive it inside them. A navigation, so no CSP directive is involved.
      const bot = me!.telegramBot;
      const tg = actRow(COPY.connectTelegram);
      tg.addEventListener("click", () => {
        tg.disabled = true;
        void api<PairCodeResponse>("/auth/pair", { method: "POST" })
          .then(({ code }) => { location.assign(`https://t.me/${bot}?start=${code}`); })
          .catch(() => { tg.querySelector(".ot")!.textContent = COPY.telegramFailed; })
          .finally(() => { tg.disabled = false; });
      });
      card.append(tg);
    }

    const out = actRow(COPY.signOut);
    out.addEventListener("click", () => {
      void (async () => {
        // The turns this browser was keeping are the account's, photos included: they do not stay
        // behind for whoever uses it next. First, so a sign-out the network refuses still takes
        // them. A storage that refuses must not keep the person signed in.
        await outbox.clear().catch(() => {});
        await signOut();
        forgetProfile();
        setHeldProposal(null);
        setLastThread([]);
        location.hash = "#/";
        await render();
      })();
    });
    card.append(out);
    return card;
  };

  // ── RIGHT: the today column — the week strip, the hero, the macro cards. ────────────────────

  const dayColumn = (d: DaysResponse, day: DayResponse, today: string): HTMLElement[] => {
    const strip = el("div", "weekbleed");
    strip.append(weekStripEl(
      d.days.map((x) => ({ date: x.date, kcal: x.logged ? x.kcal : null, logged: x.logged, when: x.when, targetKcal: d.targetKcal })),
      (date) => { if (date !== viewing && date <= today) { viewing = date; void draw(); } },
    ));

    const budget = dayBudget(day, today, me!.profile.goal);
    const hero = el("div", "card dayhero rise rc-2");
    const left = el("div", "");
    const share = budget.fill;
    left.append(el("b", "d num hnum", nWhole(budget.state === "unlogged" ? budget.target : budget.kcal)));
    const caption = budget.state === "unlogged"
      ? `${UNIT_KCAL[lang]} ${you.perDay}`
      : `${UNIT_KCAL[lang]} ${budget.state === "over" ? COPY.budgetOver : COPY.budgetLeft} ⌄`;
    left.append(el("span", "m t13", ` ${caption}`));
    hero.append(left, ringEl({ share, size: 104, tone: "ink", icon: "kcal" }));

    const g = (v: number): number => Math.round(v);
    const cards = el("div", "mcards");
    cards.append(
      mcardEl({
        macro: "protein",
        value: `${nWhole(Math.max(0, g(day.targets.protein_g - day.totals.protein_g)))} g`,
        label: you.web.proteinLeft,
        share: day.targets.protein_g > 0 ? day.totals.protein_g / day.targets.protein_g : 0,
      }),
      mcardEl({
        macro: "carbs",
        value: `${nWhole(Math.max(0, g(day.targets.carbs_g - day.totals.carbs_g)))} g`,
        label: you.web.carbsLeft,
        share: day.targets.carbs_g > 0 ? day.totals.carbs_g / day.targets.carbs_g : 0,
      }),
      mcardEl({
        macro: "fat",
        value: `${nWhole(Math.max(0, g(day.targets.fat_g - day.totals.fat_g)))} g`,
        label: you.web.fatLeft,
        share: day.targets.fat_g > 0 ? day.totals.fat_g / day.targets.fat_g : 0,
      }),
    );
    // The board's page dots — the column's position marker, drawn (never a control that lies).
    const dots = el("div", "pdots");
    dots.append(el("i", "pdot on"), el("i", "pdot"));
    return [strip, hero, cards, dots];
  };

  let content: OnboardingContentResponse | null = null;

  async function draw(): Promise<void> {
    const mine = ++drawing;
    const today = localDate(zone);
    const mon = weekStart(today);
    const sun = dateMinus(mon, -6);
    const [w, days, day, ids, ob] = await Promise.all([
      api<WeightsResponse>("/weights?range=all"),
      api<DaysResponse>(`/diary/days?from=${mon}&to=${sun}`),
      api<DayResponse>(`/diary/day?date=${viewing}`),
      api<IdentitiesResponse>("/auth/identities").catch(() => null),
      content ?? api<OnboardingContentResponse>(`/onboarding?lang=${lang}`).catch(() => null),
    ]);
    if (mine !== drawing) return;
    content = ob;

    dateCell.textContent = dayName.format(new Date(`${viewing}T12:00:00Z`));
    next.disabled = viewing >= today;

    const wn = noticeFor();
    const pn = noticeFor();
    clear(leftCol).append(
      identityCard(),
      weightCard(w, wn),
      planCard(ob?.content ?? null, pn),
      rowsCard(ids),
    );
    clear(rightCol).append(...dayColumn(days, day, today));
  }

  await draw();
  return wrap;
}
