// You — the account's own surface, Register P (`web/you.html`, W10 #97). Two columns at desktop
// width: the left is the board's order — the identity card's fact line, the plan card with its
// inline edit, then the flat account rows (Health · Subscription · Account · Units · Language ·
// Telegram · Sign out); the right is the today column the web boards give every surface — week
// strip, kcal-left hero, the macro cards. The weigh-in lives on Progress (ieat-app#1518).
//
// EVERY NUMBER IS THE SERVER'S. The plan figures come off `targets`, the free week's day off
// `entitlement.trialDay` (the server counts it — a client that counts dates
// disagrees with the reminders, #97), the "connected" claim off `healthConnected`. The day column
// reads `/v1/diary/days` and `/v1/diary/day`; the edits are PATCHes answered by the recomputed
// view. Nothing here derives a target or counts a day.

import { dayBudget, kcalCardState, macroCardState } from "../../shared/budget.ts";
import { dateMinus, localDate, weekStart } from "../../shared/dates.ts";
import { subscriptionState } from "../../shared/entitlement.ts";
import { PROVIDER_NAME, signsIn } from "../../shared/contract.ts";
import { dayMonthAt, LANG_LABEL, LANG_TAG, LANGS_READY, UNIT_KCAL, kcalNumbers, numbers, spellUnit, wholeNumbers } from "../../shared/lang.ts";
import {
  weightDisplayValue, weightToKg, type UnitSystem,
} from "../../shared/ui/units.ts";
import { homeCopyFor, type HomeTargetMacroCopy } from "../../shared/app/home-copy.ts";
import { shellCopyFor } from "../../shared/app/shell-copy.ts";
import { youCopyFor, youFacts } from "../../shared/app/you-copy.ts";
import type { OnboardingContent } from "@eait/shared";
import type {
  DayResponse, DaysResponse, IdentitiesResponse, OnboardingContentResponse,
  PairCodeResponse, ProfileResponse,
} from "@eait/shared/contract";
import { api, signOut } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { kitEl, macEl, mcardEl, ringEl, weekStripEl } from "../kit.ts";
import { ico, type ChipName } from "../../shared/ui/kit.ts";
import { outbox } from "../outbox.ts";
import {
  clear, COPY, dayText, el, forgetProfile, keptWords, lang, profile, refusalWords, render, setHeldProposal,
  setLastThread, type Frame,
} from "../shell.ts";

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
  const H = homeCopyFor(lang);
  const n = numbers(lang);
  const nWhole = wholeNumbers(lang);
  // The account's timezone and its today — the server's calendar, never UTC's.
  const zone = me.timezone;

  const cols = el("div", "ygrid");
  const leftCol = el("div", "wcol");
  const rightCol = el("div", "wcol");
  cols.append(leftCol, rightCol);
  wrap.append(cols);

  // The board's date row lives in the top bar (wtop's right side) — the day the column shows,
  // in the shell's one date form with the shared 32px chevrons, same row Home draws (#175).
  let viewing = localDate(zone);
  const dateRow = el("span", "drow");
  const prev = el("button", "darrow") as HTMLButtonElement;
  prev.type = "button";
  prev.setAttribute("aria-label", COPY.dayPrev);
  prev.append(kitEl(ico("chevron-left")));
  const dateCell = el("span", "dlabel");
  const next = el("button", "darrow") as HTMLButtonElement;
  next.type = "button";
  next.setAttribute("aria-label", COPY.dayNext);
  next.append(kitEl(ico("chevron-right")));
  // Bound once — draw() only ever rewrites the label and the enabled state.
  prev.addEventListener("click", () => { viewing = dateMinus(viewing, 1); void draw(); });
  next.addEventListener("click", () => { if (viewing < localDate(zone)) { viewing = dateMinus(viewing, -1); void draw(); } });
  dateRow.append(prev, dateCell, next);
  frame.bar.append(dateRow);

  let mode: "none" | "plan" = "none";
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

  // The fact line comes out of `youFacts` — the age is the server's own `me.age`, the pieces are
  // whole templates, and the declared conditions are `Intl.ListFormat`'s list, never a join.
  const facts = (): string => youFacts(lang, {
    age: me!.age,
    heightCm: me!.profile.height_cm,
    restrictions: me!.profile.restrictions,
    medicalOptions: content?.content.screens.find((s) => s.id === "medical")?.options ?? {},
    units: units(),
  });

  const units = (): UnitSystem => me!.profile.units ?? "metric";

  // The Subscription row's dates — "24 Oct" in the language's own locale, the year joining only
  // when the expiry falls in a different one (`dayMonthAt` in shared/lang.ts).
  const subDate = (iso: string): string => dayMonthAt(lang, zone, new Date(iso));

  const identityCard = (): HTMLElement => {
    const card = el("div", "card idcard");
    const av = el("span", "av");
    // An icon, never a lettered avatar, and NO name line: the board's "Anna" and its "A" were
    // fixture data — nothing stores a name (design-pro, eait#97 / ieat-app#929).
    av.append(kitEl(`<i class="ico i-person" aria-hidden="true"></i>`));
    card.append(av, el("span", "facts", facts()));
    return card;
  };

  // ── The plan card — the figures off `targets`, edit recomputes. ──────────────────────────────

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
        sel.className = "optpick";
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
      const save = el("button", "cta p", you.phone.save) as HTMLButtonElement;
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
          noticeBox.tell(keptWords(err, you.phone.saveKept));
          targetField.focus();
          targetField.setSelectionRange(targetField.value.length, targetField.value.length);
        } finally {
          // A refusal re-arms the button — the fields stay editable and the notice stays up.
          saving = false;
          save.disabled = false;
        }
      });
      const btns = el("div", "weditbtns");
      btns.append(save, cancel);
      body.append(
        row(you.phone.goalLabel, goalSel),
        row(you.phone.targetLabel, targetField, el("span", "m", spellUnit(lang, units() === "imperial" ? "lb" : "kg"))),
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
      el("b", "d d22 num", `${kcalNumbers(lang)(t.kcal)}${UNIT_KCAL[lang]}`),
      // The space lives INSIDE the span — adjacent elements carry no whitespace.
      el("span", "t13 m", ` ${you.perDay}`),
    );
    // The board's single row: "109g · 13g sat fat" — the icon carries the macro's name, the
    // text is grams; sat fat takes the short noun the macro cards use, not the verdict's long one.
    const chips = [
      { name: "protein" as const, text: fill(you.grams, { g: nWhole(t.protein_g) }) },
      // The sat-fat figure exists only when a restriction was declared, like the target itself.
      ...(t.satfat_g !== undefined
        ? [{ name: "fat" as const, text: fill(you.satFatGrams, { g: nWhole(t.satfat_g), noun: H.macros.satFat.name }) }]
        : [{ name: "fat" as const, text: fill(you.grams, { g: nWhole(t.fat_g) }) }]),
    ];
    const macrow = el("div", "macs");
    for (const c of chips) macrow.append(macEl(c.name, c.text));
    const foot = el("div", "row between");
    foot.append(macrow);
    body.append(fig, foot);
    return card;
  };

  // ── The flat card: the account rows the board draws in one quiet list — and the web's own
  // settings rows the recorded ruling keeps there (eait#97: Units, Language, Sign out, Connect
  // Telegram stay; ieat-app#929: "extra rows in the same flat card"; Apple Health is read-only
  // here and only ever drawn while `healthConnected`). ─────────────────────────────────────────

  const optRow = (label: string, value: string, ctl?: HTMLElement): HTMLElement => {
    const row = el("div", "opt");
    row.append(el("span", "ot", label));
    if (ctl) row.append(ctl);
    else row.append(el("span", "ov", value));
    return row;
  };

  const rowsCard = (ids: IdentitiesResponse | null, noticeBox: { tell: (w: string | null) => void }): HTMLElement => {
    const card = el("div", "card flat urows");
    // Read-only, and only while a sync is actually arriving — the server's own flag.
    if (me!.healthConnected === true) card.append(optRow(you.appleHealth, you.connected));
    // The row names its state — the board's trial is one of five; `subscriptionState` is the
    // one rule and the date is "24 Oct" in the language's locale, the year only off this year.
    const sub = subscriptionState(me!.entitlement);
    card.append(optRow(
      you.subscription,
      sub.kind === "trial" ? fill(you.freeWeekDay, { n: nWhole(sub.day) })
        : sub.kind === "until" ? fill(you.subscriptionUntil, { date: subDate(sub.date) })
        : sub.kind === "lifetime" ? you.subscriptionLifetime
        : sub.kind === "ended"
          ? (sub.date === null ? you.subscriptionEndedNoDate : fill(you.subscriptionEnded, { date: subDate(sub.date) }))
        : you.subscriptionFree,
    ));
    // The sign-in providers, minus the device credential — "Apple" the way the board writes it.
    // More than one lists the language's own way — `Intl.ListFormat`, not a hand-joined " · ".
    const providers = (ids?.identities ?? [])
      .map((i) => i.provider)
      .filter((p) => signsIn(p) && p !== "device")
      .map((p) => PROVIDER_NAME[p] ?? p);
    const listOf = new Intl.ListFormat(LANG_TAG[lang], { style: "long", type: "conjunction" });
    card.append(optRow(you.account, listOf.format(providers)));

    // Units — the display system only; the profile stores metric and PATCH writes the preference.
    const unitsSel = document.createElement("select");
    // `optpick`, not `pick` — `select.pick` is the language picker's own hook, and the specs
    // (and the reader) rely on it naming exactly one control.
    unitsSel.className = "optpick";
    unitsSel.setAttribute("aria-label", you.web.units);
    for (const [v, label] of [["metric", you.web.unitsMetric], ["imperial", you.web.unitsImperial]] as const) {
      const o = document.createElement("option");
      o.value = v;
      o.textContent = label;
      if (v === units()) o.selected = true;
      unitsSel.append(o);
    }
    unitsSel.addEventListener("change", async () => {
      // Locked for the flight; a refused write keeps the choice and says so — picking it again resends.
      unitsSel.disabled = true;
      noticeBox.tell(null);
      try {
        await api("/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ units: unitsSel.value }),
        });
        forgetProfile();
        me = await profile();
        void draw();
      } catch (err) {
        console.error(err);
        noticeBox.tell(refusalWords(err));
        unitsSel.disabled = false;
      }
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
      langSel.disabled = true;
      noticeBox.tell(null);
      try {
        await api("/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lang: langSel.value }),
        });
        location.reload();
      } catch (err) {
        console.error(err);
        noticeBox.tell(refusalWords(err));
        langSel.disabled = false;
      }
    });
    card.append(optRow(COPY.language, "", langSel));

    // The Support row (#200) — only while the operator configured a donation URL; every set one
    // is a link on the row, the provider names staying untranslated because they are brands.
    const donate = ([
      [me!.donate.github, "GitHub Sponsors"],
      [me!.donate.kofi, "Ko-fi"],
      [me!.donate.buyMeACoffee, "Buy Me a Coffee"],
    ] as const).flatMap(([url, name]) => url === null ? [] : [{ url, name }]);
    if (donate.length > 0) {
      const box = el("span", "ov");
      donate.forEach(({ url, name }, i) => {
        if (i > 0) box.append(document.createTextNode(" · "));
        const a = el("a", "", name) as HTMLAnchorElement;
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        box.append(a);
      });
      card.append(optRow(you.web.support, "", box));
    }

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
    // ONE card on both surfaces: the figure-and-label pair is `kcalCardState`'s choice, the
    // over day reads "{overage}kcal over" in --bad with a closed --bad ring, as Home's does.
    const state = kcalCardState(budget, false);
    const hero = el("div", "card dayhero rise rc-2");
    if (budget.warn) hero.classList.add("over");
    const left = el("div", "");
    const hnum = el("b", "d num hnum");
    if (state.guessed) hnum.append(el("span", "about", COPY.about));
    hnum.append(document.createTextNode(kcalNumbers(lang)(state.figure)));
    left.append(hnum);
    // The caption is the card's short label; the chevron is a drawn affordance — aria-hidden,
    // an element, never a character inside the sentence.
    const caption = el("span", "m t13");
    caption.textContent = ` ${state.label === "over" ? H.kcalOver
      : state.label === "eaten" ? H.kcalEaten : H.kcalLeft}`;
    if (budget.state !== "unlogged")
      caption.append(kitEl(`<i class="ico i-chevron-down" aria-hidden="true"></i>`));
    left.append(caption);
    hero.append(left, ringEl({ share: budget.fill, size: 104, tone: budget.warn ? "bad" : "ink", icon: "kcal" }));

    // The macro cards are Home's too: `macroCardState` picks overage/"over" over a clamped
    // "0g left", and the words are HOME_COPY's — one component, one table.
    const cards = el("div", "mcards");
    const mac = (macro: ChipName, copy: HomeTargetMacroCopy, eaten: number, target: number | undefined): Element => {
      const s = macroCardState(eaten, target);
      return mcardEl({
        macro,
        value: fill(H.grams, { n: nWhole(s.figure) }),
        label: s.label === "over" ? copy.over : copy.left,
        ...(s.share !== undefined ? { share: s.share } : {}),
      });
    };
    cards.append(
      mac("protein", H.macros.protein, day.totals.protein_g, day.targets.protein_g),
      mac("carbs", H.macros.carbs, day.totals.carbs_g, day.targets.carbs_g),
      mac("fat", H.macros.fat, day.totals.fat_g, day.targets.fat_g),
    );
    // The board's page dots — the column's position marker, drawn (never a control that lies).
    const dots = el("div", "pdots");
    dots.append(el("i", "pdot on"), el("i", "pdot"));
    return [strip, hero, cards, dots];
  };

  let content: OnboardingContentResponse | null = null;

  // THE TWO COLUMNS FETCH AND DRAW ON THEIR OWN CLOCKS. The today column's reads are a second
  // promise — a day read that hangs or refuses must never keep the account column (or its picker)
  // from rendering.
  let daySeq = 0;
  async function drawDay(): Promise<void> {
    const mine = ++daySeq;
    const today = localDate(zone);
    const [days, day] = await Promise.all([
      api<DaysResponse>(`/diary/days?from=${weekStart(today)}&to=${dateMinus(weekStart(today), -6)}`).catch(() => null),
      api<DayResponse>(`/diary/day?date=${viewing}`).catch(() => null),
    ]);
    if (mine !== daySeq) return;
    if (days !== null && day !== null) {
      clear(rightCol).append(...dayColumn(days, day, today));
    } else if (rightCol.childElementCount === 0) {
      // A failed refetch keeps the drawn day — only a cold failure leaves the column a notice.
      rightCol.append(el("p", "notice", COPY.somethingWrong));
    }
  }

  async function draw(): Promise<void> {
    const mine = ++drawing;
    const today = localDate(zone);
    // EVERY READ DEGRADES ALONE: one refused fetch must not blank the surface — a card that can
    // still answer does, and the notice under the columns says what did not.
    const ids = await api<IdentitiesResponse>("/auth/identities").catch(() => null);
    // The option labels are read once — a language change reloads the page rather than refetching.
    if (content === null) {
      content = await api<OnboardingContentResponse>(`/onboarding?lang=${lang}`).catch(() => null);
    }
    if (mine !== drawing) return;
    const ob = content;

    dateCell.textContent = dayText(viewing);
    next.disabled = viewing >= today;

    const pn = noticeFor();
    const rn = noticeFor();
    clear(leftCol).append(identityCard(), planCard(ob?.content ?? null, pn), rowsCard(ids, rn), rn.notice);
    void drawDay();
  }

  await draw();
  return wrap;
}
