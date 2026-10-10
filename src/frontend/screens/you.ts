// You — the account's own surface (web/you.html, phone/web-you-narrow.html; the redesign pass is
// eait#474, the remaining panels #477). Two columns at desktop width: the left is the board's
// order — the identity card's fact line, then the plan card whose "edit" opens the profile
// editor PANEL and whose figures open "How we got there"; the right is the flat rows (Apple
// Health · Subscription · Account · Units · Language · Telegram · Support) and the sign-out
// card. The day column is gone — the day is Home's — and the bar carries the shared
// pair (streak chip · calendar button) with no ‹ › anywhere.
//
// EVERY NUMBER IS THE SERVER'S. The plan figures come off `targets`, the trial's day off
// `entitlement.trialDaysLeft` (the server counts it — a client that counts dates disagrees with
// the reminders, #97), the provenance off `/v1/weights`. The panels PATCH and redraw off the
// recomputed view. Nothing here derives a target or counts a day.

import { dateMinus, localDate, weekStart } from "../../shared/dates.ts";
import { subscriptionState, TRIAL_DAYS } from "../../shared/entitlement.ts";
import { PROVIDER_NAME, signsIn } from "../../shared/contract.ts";
import { dayMonthAt, LANG_LABEL, LANGS_READY, UNIT_KCAL, kcalNumbers, listConjunction, numbers, spellUnit, weekdayDayMonthAt, wholeNumbers } from "../../shared/lang.ts";
import {
  countryLabel, countryOptions, screenOptions, screenOptionValues,
} from "../../shared/onboarding.ts";
import { MEDICAL_TAGS } from "../../shared/targets.ts";
import { onboardingContentFor } from "../../shared/onboarding-content.ts";
import {
  weightDisplayValue, weightToKg, type UnitSystem,
} from "../../shared/ui/units.ts";
import { homeCopyFor } from "../../shared/app/home-copy.ts";
import { payCopyFor } from "../../shared/app/pay-copy.ts";
import { shellCopyFor } from "../../shared/app/shell-copy.ts";
import { youCopyFor, youFacts } from "../../shared/app/you-copy.ts";
import type {
  ActivityLevel, CountryCode, Goal, MedicalTag, OnboardingContent,
} from "@eait/shared";
import type {
  DaysResponse, IdentitiesResponse, OnboardingContentResponse, PairCodeResponse,
  ProfileRejected, ProfileResponse, WeightsResponse,
} from "@eait/shared/contract";
import { pushRows } from "./you-push.ts";
import { milestonesCopyFor } from "../../shared/app/milestones-copy.ts";
import { api, apiSend, ApiError, signOut, Unauthenticated } from "../api.ts";
import { fillCopy as fill } from "../copy.ts";
import { kitEl, macEl } from "../kit.ts";
import { ico, tagx } from "../../shared/ui/kit.ts";
import { outbox } from "../outbox.ts";
import { closeAllPanels, openDialog, openPanel, toast } from "../panel.ts";
import { openWeighIn } from "../weigh.ts";
import {
  clear, COPY, el, forgetProfile, keptWords, lang, refusalWords, render, setHeldProposal,
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
  const pay = payCopyFor(lang);
  const H = homeCopyFor(lang);
  const n = numbers(lang);
  const nWhole = wholeNumbers(lang);
  // The account's timezone and its today — the server's calendar, never UTC's.
  const zone = me.timezone;
  const today = localDate(zone);

  // ── The bar: the streak chip, then the calendar button — the shared right side every screen's
  // wtop draws (DIRECTION § Web). Profile has no day of its own, and the boards' month popover
  // is not built on web, so the button is a plain route to Home — today — per the coordinator
  // ruling on #474. The narrow board (phone/web-you-narrow) puts the pair in the BODY as its
  // first row instead, so at ≤760 the bar's own set hides and the strip under the bar draws it.
  frame.bar.classList.add("youwr");
  const calb = (): HTMLButtonElement => {
    const c = el("button", "calb") as HTMLButtonElement;
    c.type = "button";
    c.setAttribute("aria-label", H.pickDay);
    c.append(kitEl(ico("calendar")));
    c.addEventListener("click", () => { location.hash = "#/"; });
    return c;
  };
  const cal = calb();
  frame.bar.append(cal);
  // The body strip's own instance — visible only where the narrow board puts it (you.css).
  const strip = el("div", "youbar");
  strip.append(calb());
  // The streak lands when the week's read does — the button is up first, in both spots.
  void api<DaysResponse>(`/diary/days?from=${weekStart(today)}&to=${dateMinus(weekStart(today), -6)}`)
    .then((d) => {
      if (!cal.isConnected || d.streak <= 0) return;
      const chip = () => kitEl(tagx({
        icon: "streak", text: n(d.streak),
        aria: fill(H.phoneStreakAria, { n: n(d.streak) }),
      }));
      cal.before(chip());
      strip.prepend(chip());
    })
    .catch(() => {});

  let saving = false;
  let drawing = 0;

  /** One shared alert line for a refused write — under the card that asked for it. */
  const noticeFor = (): { notice: HTMLElement; tell: (w: string | null) => void } => {
    const notice = el("p", "notice");
    notice.setAttribute("role", "alert");
    notice.hidden = true;
    return { notice, tell: (w) => { notice.textContent = w ?? ""; notice.hidden = w === null; } };
  };

  // ── LEFT: the identity card and the plan card. ──────────────────────────────────────────────

  // The fact line comes out of `youFacts` — the age is the server's own `me.age`, the pieces are
  // whole templates, and the declared conditions are `listConjunction`'s list, never a join.
  let content: OnboardingContent | null = null;
  const facts = (): string => youFacts(lang, {
    age: me!.age,
    heightCm: me!.profile.height_cm,
    restrictions: me!.profile.restrictions,
    medicalOptions: screenOptions(content ?? onboardingContentFor(lang), "medical"),
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

  // ── The plan card — the figures off `targets`; "edit" opens the editor panel. ───────────────

  const planCard = (): HTMLElement => {
    const card = el("div", "card rise rc-1");
    const head = el("div", "row between");
    head.append(el("span", "lab", you.planLabel));
    const edit = el("button", "elink", you.planEdit) as HTMLButtonElement;
    edit.type = "button";
    edit.addEventListener("click", () => openEditor());
    head.append(edit);
    card.append(head);

    const t = me!.targets;
    // Spans, not divs — the figure sits inside the `planhit` BUTTON, whose content model is
    // phrasing content; the classes' own display rules keep the board's arrangement.
    const fig = el("span", "planfig");
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
    const macrow = el("span", "macs");
    for (const c of chips) macrow.append(macEl(c.name, c.text));
    const foot = el("span", "row between");
    foot.append(macrow);
    // The figures are the door to "How we got there" — the plan's arithmetic as a panel, the
    // same tap the phone's plan card takes to /you/basis. One button over the figure and the
    // macros, so the target is discoverable rather than a corner of it.
    const door = el("button", "planhit") as HTMLButtonElement;
    door.type = "button";
    door.setAttribute("aria-label", fill(you.phone.labeledValue, {
      label: you.planLabel,
      value: fill(you.kcalADay, { kcal: kcalNumbers(lang)(t.kcal) }),
    }));
    door.addEventListener("click", () => openBasis());
    door.append(fig, foot);
    card.append(door);
    return card;
  };

  // ── The flat card: the account rows the board draws in one quiet list — value + chevron where
  // the row opens something, a plain row where the boards draw none (Apple Health opens nothing —
  // "on your iPhone"; ieat-app STATES). ─────────────────────────────────────────────────────────

  /** A label + value row: a plain div when it opens nothing, a button with the chevron when it does. */
  function optRow(label: string, value: string): HTMLElement;
  function optRow(label: string, value: string, onOpen: () => void): HTMLButtonElement;
  function optRow(label: string, value: string, onOpen?: () => void): HTMLElement {
    if (onOpen === undefined) {
      const row = el("div", "opt");
      row.append(el("span", "ot", label), el("span", "ov", value));
      return row;
    }
    const b = el("button", "opt") as HTMLButtonElement;
    b.type = "button";
    b.append(
      el("span", "ot", label),
      el("span", "ov", value),
      kitEl(`<i class="ico i-chevron-right" aria-hidden="true"></i>`),
    );
    b.setAttribute("aria-label", value === "" ? label : fill(you.phone.labeledValue, { label, value }));
    b.addEventListener("click", onOpen);
    return b;
  }

  /** The units/language pickers — the phone's sheet as a panel: the options, the one held ticked. */
  const pickPanel = (
    title: string,
    options: readonly { value: string; label: string }[],
    current: string,
    onPick: (value: string) => void,
  ): void => {
    const { body, close } = openPanel(title);
    for (const o of options) {
      const b = el("button", "opt pickrow") as HTMLButtonElement;
      b.type = "button";
      b.append(el("span", "ot", o.label));
      if (o.value === current) b.append(el("span", "pck", "✓"));
      b.addEventListener("click", () => { close(); onPick(o.value); });
      body.append(b);
    }
  };

  /** A PATCH whose failure lands as a line under the rows it was made on, the control re-armed. */
  const patch = async (body_: Record<string, unknown>, onError: (err: unknown) => void): Promise<void> => {
    try {
      const res = await api<ProfileResponse>("/profile", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body_),
      });
      me = res;
      forgetProfile();
      void draw();
    } catch (err) {
      onError(err);
    }
  };

  const rowsCard = (ids: IdentitiesResponse | null, noticeBox: { tell: (w: string | null) => void }): HTMLElement => {
    const card = el("div", "card flat urows");
    // Read-only — the boards' "on your iPhone": there is no web page for Health (ieat-app STATES).
    card.append(optRow(you.appleHealth, you.web.healthOnPhone));
    // The Subscription row names its state — the board's trial is one of five; `subscriptionState`
    // is the one rule and the date is "24 Oct" in the language's locale, the year only off this
    // year. A live one opens its status panel; an account with nothing to show goes to #/pay,
    // the web's one surface that can change it (ended included — resubscribing IS its panel).
    const sub = subscriptionState(me!.entitlement);
    const subValue =
      sub.kind === "trial" ? fill(you.freeTrialDay, { n: nWhole(Math.max(1, (me!.paywall?.trialDays || TRIAL_DAYS) - sub.daysLeft)) })
      : sub.kind === "until" ? fill(you.subscriptionUntil, { date: subDate(sub.date) })
      : sub.kind === "lifetime" ? you.subscriptionLifetime
      : sub.kind === "ended"
        ? (sub.date === null ? you.subscriptionEndedNoDate : fill(you.subscriptionEnded, { date: subDate(sub.date) }))
      : you.subscriptionFree;
    card.append(me!.entitlement.active
      ? optRow(you.subscription, subValue, () => openSubscription())
      : optRow(you.subscription, subValue, () => { location.hash = "#/pay"; }));

    // The sign-in providers, minus the device credential — "Apple" the way the board writes it.
    // More than one lists the language's own way — `listConjunction`, not a hand-joined " · ".
    const providers = (ids?.identities ?? [])
      .map((i) => i.provider)
      .filter((p) => signsIn(p) && p !== "device")
      .map((p) => PROVIDER_NAME[p] ?? p);
    const accountRow = optRow(you.account, listConjunction(lang, providers), () => openAccount(ids, providers));
    card.append(accountRow);
    void pushRows(accountRow, you.web);
    card.append(optRow(milestonesCopyFor(lang).title, "", () => { location.hash = "#/you/milestones"; }));

    // Units — the display system only; the profile stores metric and PATCH writes the preference.
    card.append(optRow(
      you.web.units,
      units() === "imperial" ? you.web.unitsImperial : you.web.unitsMetric,
      () => pickPanel(you.web.units, [
        { value: "metric", label: you.web.unitsMetric },
        { value: "imperial", label: you.web.unitsImperial },
      ], units(), (v) => {
        noticeBox.tell(null);
        void patch({ units: v }, (err) => {
          console.error(err);
          noticeBox.tell(refusalWords(err));
        });
      }),
    ));

    // Language — the same picker; the option labels are the languages' own names, never
    // translated (LANG_LABEL), and a landed write reloads: the whole surface's copy changes.
    card.append(optRow(you.phone.language, LANG_LABEL[lang], () => {
      pickPanel(you.phone.language, LANGS_READY.map((c) => ({ value: c, label: LANG_LABEL[c] })), lang, (v) => {
        noticeBox.tell(null);
        void api("/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ lang: v }),
        }).then(() => location.reload())
          .catch((err: unknown) => { console.error(err); noticeBox.tell(refusalWords(err)); });
      });
    }));

    // The Support row (#200) — only while the operator configured a donation URL; the provider
    // names beside it are brands and stay untranslated.
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
      const row = el("div", "opt");
      row.append(el("span", "ot", you.web.support), box);
      card.append(row);
    }

    if (me!.telegramBot !== null) {
      // The code is minted at the TAP, not when the page is drawn: it lives five minutes, and the
      // bot has to receive it inside them. A navigation, so no CSP directive is involved.
      const bot = me!.telegramBot;
      const tg = optRow(COPY.connectTelegram, "", () => {
        tg.disabled = true;
        void api<PairCodeResponse>("/auth/pair", { method: "POST" })
          .then(({ code }) => { location.assign(`https://t.me/${bot}?start=${code}`); })
          .catch(() => { tg.querySelector(".ot")!.textContent = COPY.telegramFailed; })
          .finally(() => { tg.disabled = false; });
      });
      card.append(tg);
    }
    return card;
  };

  /** Sign this browser out — the turns it was keeping go first (they are the account's, photos
      included): a sign-out the network refuses must still take them, and a storage that refuses
      must not keep the person signed in. Deletion lands here too — the account is already gone
      on the server, and what is left is the local teardown. */
  const leave = async (): Promise<void> => {
    await outbox.clear().catch(() => {});
    await signOut();
    closeAllPanels();
    forgetProfile();
    setHeldProposal(null);
    setLastThread([]);
    location.hash = "#/";
    await render();
  };

  // ── Refer a friend (#899): one Share link button, the counts under it — never who. ───────────

  const referralCard = (): HTMLElement | null => {
    const r = me!.referral;
    // A server older than the field sends none, and there is no link to share then.
    if (!r?.link) return null;
    const R = you.referral;
    const card = el("div", "card refcard");
    card.setAttribute("aria-label", R.label);
    card.append(el("span", "lab", R.label), el("p", "t13 m", R.body));
    const btn = el("button", "cta p") as HTMLButtonElement;
    btn.type = "button";
    btn.append(kitEl(`<i class="ico i-share" aria-hidden="true"></i>`), document.createTextNode(R.share));
    // The share sheet where the browser has one, else the clipboard. Counted when it FINISHED —
    // a cancelled sheet counts nothing — by a channel label only: a browser does not say which app.
    const counted = (via: string) => apiSend("/referral/shared", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ via }),
    }).catch(() => {});
    btn.addEventListener("click", () => {
      const text = fill(R.shareText, { link: r.link });
      if (typeof navigator.share === "function") {
        void navigator.share({ text }).then(() => counted("web-share"), () => {});
        return;
      }
      void navigator.clipboard?.writeText(text).then(() => { toast(R.copied); void counted("copy"); }, () => {});
    });
    card.append(btn);
    const counts = r.weeksEarned > 0
      ? [fill(R.earned, { n: String(r.weeksEarned) }), fill(R.joined, { n: String(r.joined), m: String(r.subscribed) })]
      : r.joined > 0 ? [fill(R.joined, { n: String(r.joined), m: String(r.subscribed) }), R.pending] : [];
    // What the weeks mean for THIS account, both the server's numbers: the bank behind a running
    // subscription (whole weeks when it is whole weeks, else days — a lapse spends whole days), or
    // the date while the bonus is the grant keeping the account in. Never both: the server sends
    // `bonusUntil` only with no live subscription, and `bankedDays` only with one.
    const banked = r.bankedDays ?? 0;
    const bonus = me!.entitlement.bonusUntil ?? null;
    const own = banked > 0
      ? [banked % 7 === 0 ? fill(R.bankedWeeks, { n: String(banked / 7) }) : fill(R.bankedDays, { n: String(banked) })]
      : bonus !== null ? [fill(R.until, { date: subDate(bonus) })] : [];
    const lines = [...own, ...counts];
    if (lines.length > 0) {
      const st = el("div", "refst");
      for (const l of lines) st.append(el("div", "t13", l));
      card.append(st);
    }
    return card;
  };

  const signOutCard = (): HTMLElement => {
    const card = el("div", "card flat urows");
    // The board's bare action row — it signs out, it does not navigate, so no chevron.
    const out = el("button", "opt") as HTMLButtonElement;
    out.type = "button";
    out.append(el("span", "ot", COPY.signOut));
    out.addEventListener("click", () => { void leave(); });
    card.append(out);
    return card;
  };

  // ── The profile editor panel (web/you-profile.html) — the phone's you/profile.tsx mirrored:
  // the rows in one list, a tap expands the one it names, the Weight row is a DOOR to the
  // weigh-in, and a staged Save commits every change in one PATCH. ──────────────────────────────

  type RowId = "goal" | "weight" | "target" | "activity" | "country" | "medical";
  interface Draft {
    goal: Goal | null;
    /** The display-units string, typed — converted on save, never stored. */
    target: string;
    activity: ActivityLevel | null;
    country: string | null;
    medical: readonly MedicalTag[];
  }

  function openEditor(): void {
    const ob = content ?? onboardingContentFor(lang);
    const goalOpts = screenOptions(ob, "goal");
    const activityOpts = screenOptions(ob, "activity");
    const medOpts = screenOptions(ob, "medical");
    const p = me!.profile;
    const imperial = units() === "imperial";

    const { body, close } = openPanel(you.phone.profileTitle);
    const draft: Draft = {
      goal: p.goal,
      target: p.target_weight_kg !== null ? String(weightDisplayValue(p.target_weight_kg, units())) : "",
      activity: p.activity,
      country: p.country,
      medical: p.restrictions.filter((t): t is MedicalTag => (MEDICAL_TAGS as readonly string[]).includes(t)),
    };
    let open: RowId | null = null;

    // The weigh-in log — for the Weight row's provenance word. The row reads the profile's own
    // weight first; the landed read adds the source, and a weigh-in SAVED over this panel
    // overwrites it — the row must say the new figure, not the fetch's stale one.
    let weights: WeightsResponse | null = null;
    let savedKg: number | null = null;
    void api<WeightsResponse>("/weights?range=all")
      .then((w) => { weights = w; drawRows(); })
      .catch(() => {});

    const latestKg = () => savedKg ?? weights?.latest?.kg ?? p.weight_kg;
    const latest = () => weights?.latest ?? null;
    // A figure saved from this panel is a typed weigh-in — its provenance is "you" now.
    const sourceWord = () => savedKg !== null ? you.phone.sourceYou
      : latest()?.source === "health" ? you.appleHealth : you.phone.sourceYou;

    const rowValue = (id: RowId): string => {
      switch (id) {
        case "goal": return draft.goal !== null ? (goalOpts[draft.goal]?.label ?? draft.goal) : "";
        case "weight": {
          const kg = latestKg();
          if (kg === null) return "";
          return fill(imperial ? you.phone.weightFromLb : you.phone.weightFromKg,
            { w: n(weightDisplayValue(kg, units())), source: sourceWord() });
        }
        case "target": return draft.target === "" ? ""
          : fill(imperial ? you.phone.weightLb : you.phone.weightKg, { w: draft.target });
        case "activity": return draft.activity !== null
          ? fill(you.phone.activityOption, { n: activityOpts[draft.activity]?.label ?? draft.activity })
          : "";
        case "country": return draft.country !== null ? countryLabel(draft.country as CountryCode, lang) : "";
        case "medical": return listConjunction(lang,
          draft.medical.map((t) => medOpts[t]?.label ?? t));
      }
    };

    const dirty = (): boolean =>
      draft.goal !== p.goal ||
      draft.activity !== p.activity ||
      draft.country !== p.country ||
      draft.target !== (p.target_weight_kg !== null ? String(weightDisplayValue(p.target_weight_kg, units())) : "") ||
      draft.medical.join(",") !== p.restrictions.filter((t) => (MEDICAL_TAGS as readonly string[]).includes(t)).join(",");

    const notice = el("div", "pnote");
    notice.setAttribute("role", "alert");
    notice.hidden = true;

    const save = el("button", "cta p", you.phone.save) as HTMLButtonElement;
    save.type = "button";

    /** One option line — the boards' accent ✓ where the disc would sit, `sel` when held. */
    const optLine = (label: string, selected: boolean, onPick: () => void): HTMLElement => {
      const b = el("button", `pickrow${selected ? " sel" : ""}`) as HTMLButtonElement;
      b.type = "button";
      b.append(el("span", "ot", label));
      if (selected) b.append(el("span", "pck", "✓"));
      b.addEventListener("click", onPick);
      return b;
    };

    /** An expandable block: the label row, then the option lines while it is the open one. */
    const editBlock = (id: RowId, options: { value: string; label: string; selected: boolean; onPick: () => void }[]): HTMLElement => {
      const box = el("div", "pedit");
      const head = el("button", `prow${open === id ? " open" : ""}`) as HTMLButtonElement;
      head.type = "button";
      head.setAttribute("aria-expanded", String(open === id));
      head.append(el("span", "", youRowLabel(id)), el("b", "num pv", rowValue(id)));
      head.addEventListener("click", () => { open = open === id ? null : id; drawRows(); });
      box.append(head);
      if (open === id) {
        const list = el("div", "peditopts");
        for (const o of options) list.append(optLine(o.label, o.selected, o.onPick));
        box.append(list);
      }
      return box;
    };

    const youRowLabel = (id: RowId): string => ({
      goal: you.phone.goalLabel,
      weight: you.weightLabel,
      target: you.phone.targetLabel,
      activity: open === "activity" ? you.phone.activitySection : you.phone.activityLabel,
      country: you.phone.countryRow,
      medical: you.phone.judgedAgainst,
    })[id];

    function drawRows(): void {
      clear(body);
      // Goal — the onboarding's three, single pick.
      body.append(editBlock("goal", screenOptionValues("goal", lang).map((g) => ({
        value: g,
        label: goalOpts[g]?.label ?? g,
        selected: draft.goal === g,
        onPick: () => { draft.goal = g as Goal; drawRows(); },
      }))));

      // Weight — a DOOR, not a field: a weigh-in is a dated history entry, so the row opens the
      // weigh-in panel over this one rather than editing inline (the phone pushes /you/weight).
      const wrow = el("button", "prow") as HTMLButtonElement;
      wrow.type = "button";
      wrow.append(
        el("span", "", you.weightLabel),
        el("b", "num pv", rowValue("weight")),
        kitEl(`<i class="ico i-chevron-right" aria-hidden="true"></i>`),
      );
      wrow.addEventListener("click", () => {
        openWeighIn(me!, (res) => {
          me = res;
          forgetProfile();
          savedKg = res.profile.weight_kg;
          drawRows();
        });
      });
      body.append(wrow);

      // Target — the one typed field, display units in, kg out at the PATCH.
      const tbox = el("div", "pedit");
      const thead = el("button", `prow${open === "target" ? " open" : ""}`) as HTMLButtonElement;
      thead.type = "button";
      thead.setAttribute("aria-expanded", String(open === "target"));
      thead.append(el("span", "", you.phone.targetLabel), el("b", "num pv", rowValue("target")));
      thead.addEventListener("click", () => { open = open === "target" ? null : "target"; drawRows(); });
      tbox.append(thead);
      if (open === "target") {
        const field = document.createElement("input");
        field.type = "number";
        field.step = "0.1";
        field.min = "0";
        field.inputMode = "decimal";
        field.className = "pfield";
        field.setAttribute("aria-label", you.phone.targetLabel);
        field.value = draft.target;
        field.addEventListener("input", () => { draft.target = field.value; save.disabled = !dirty() || saving; });
        const frow = el("div", "pfieldrow");
        frow.append(field, el("span", "m", spellUnit(lang, imperial ? "lb" : "kg")));
        tbox.append(frow);
      }
      body.append(tbox);

      // Exercise frequency — the onboarding's levels, single pick.
      body.append(editBlock("activity", screenOptionValues("activity", lang).map((a) => ({
        value: a,
        label: fill(you.phone.activityOption, { n: activityOpts[a]?.label ?? a }),
        selected: draft.activity === a,
        onPick: () => { draft.activity = a as ActivityLevel; drawRows(); },
      }))));

      // Country — CLDR's names in the language's own order.
      body.append(editBlock("country", countryOptions(lang).map((c) => ({
        value: c,
        label: countryLabel(c, lang),
        selected: draft.country === c,
        onPick: () => { draft.country = c; drawRows(); },
      }))));

      // Judged against — the declared caps, multi-pick; "none" is a drawn row that stores [].
      body.append(editBlock("medical", screenOptionValues("medical", lang).map((t) => {
        const on = t === "none" ? draft.medical.length === 0 : draft.medical.includes(t as MedicalTag);
        return {
          value: t,
          label: medOpts[t]?.label ?? t,
          selected: on,
          onPick: () => {
            draft.medical = t === "none" ? [] : (on
              ? draft.medical.filter((x) => x !== t)
              : [...draft.medical, t as MedicalTag]);
            drawRows();
          },
        };
      })));

      save.disabled = !dirty() || saving;
      body.append(notice, save);
    }

    save.addEventListener("click", async () => {
      if (!dirty() || saving) return;
      saving = true;
      save.disabled = true;
      const patchBody: Record<string, unknown> = {};
      if (draft.goal !== p.goal) patchBody.goal = draft.goal;
      if (draft.activity !== p.activity) patchBody.activity = draft.activity;
      if (draft.country !== p.country) patchBody.country = draft.country;
      if (draft.target !== (p.target_weight_kg !== null ? String(weightDisplayValue(p.target_weight_kg, units())) : "")) {
        patchBody.target_weight_kg = draft.target === "" ? null : weightToKg(units(), Number(draft.target));
      }
      const medNow = p.restrictions.filter((t) => (MEDICAL_TAGS as readonly string[]).includes(t));
      if (draft.medical.join(",") !== medNow.join(",")) patchBody.medical = [...draft.medical];
      try {
        const res = await api<ProfileResponse>("/profile", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(patchBody),
        });
        const prevKcal = me!.targets.kcal;
        me = res;
        forgetProfile();
        close();
        void draw();
        // The board's saved toast — "{w}kg from {source}, saved" naming the weight's provenance,
        // then the plan's move when the save changed it ("{from} → {to}kcal a day").
        const wkg = latestKg();
        const parts: string[] = [];
        if (wkg !== null) {
          parts.push(fill(
            sourceWord() === you.appleHealth
              ? (imperial ? you.phone.savedNoteLb : you.phone.savedNoteKg)
              : (imperial ? you.phone.savedNoteTypedLb : you.phone.savedNoteTypedKg),
            { w: n(weightDisplayValue(wkg, units())), source: sourceWord() },
          ));
        }
        if (res.targets.kcal !== prevKcal) {
          parts.push(fill(you.phone.planRevised, { from: `${kcalNumbers(lang)(prevKcal)}`, to: `${kcalNumbers(lang)(res.targets.kcal)}` }));
        }
        if (parts.length > 0) toast(parts.join(" · "));
      } catch (err) {
        if (err instanceof Unauthenticated) { close(); await render(); return; }
        const r = err instanceof ApiError && err.status === 422 ? err.body as ProfileRejected | null : null;
        const words = r?.reason === "target-weight-below-healthy-bmi" && r.minHealthyKg !== undefined
          ? fill(you.web.belowHealthy, { kg: n(r.minHealthyKg) })
          : keptWords(err, you.web.saveFailedBody);
        notice.replaceChildren(el("b", "", you.web.saveFailedTitle), el("span", "t13 m", words));
        notice.hidden = false;
      } finally {
        saving = false;
        save.disabled = !dirty();
      }
    });

    drawRows();
  }

  // ── The remaining row panels (web/you-basis|account|subscription|delete, #477) — the same
  // panel pattern as the editor and the weigh-in, and the phone's own screens mirrored. ────────

  /** The boards' read-only panel line — the hairline-topped "label · figure" row. */
  const statRow = (label: string, figure: string, plan = false): HTMLElement => {
    const row = el("div", `srow${plan ? " planrow" : ""}`);
    row.append(el("span", "", label), el("b", "num pv", figure));
    return row;
  };

  /** The account board's action line — the .opt row carrying no value; the tap IS the act. */
  const actRow = (label: string, onTap: () => void): HTMLButtonElement => {
    const b = el("button", "opt") as HTMLButtonElement;
    b.type = "button";
    b.append(el("span", "ot", label));
    b.addEventListener("click", onTap);
    return b;
  };

  /** A refused call inside a panel gets the boards' boxed notice — ink title over a muted body. */
  const panelNote = (title: string, words: string): HTMLElement => {
    const n = el("div", "pnote");
    n.setAttribute("role", "alert");
    n.replaceChildren(el("b", "", title), el("span", "t13 m", words));
    return n;
  };

  /**
   * "How we got there" (web/you-basis.html) — the plan's arithmetic as the board's four lines:
   * at rest, your days, your pace, then the plan set a notch heavier, the floor marker under
   * them. EVERY FIGURE IS `basis`'s — `explainTargets`' account of the server computation;
   * `appliedDeltaKcal` is the pace AFTER the share cap and the floor, the delta the person can
   * ask "why" about. "Change an answer" opens the same editor the plan card's edit does,
   * stacked over this panel the way the phone pushes /you/profile over /you/basis.
   */
  function openBasis(): void {
    const b = me!.basis;
    const { body } = openPanel(you.phone.basisTitle);
    // The board writes a signed figure as the sign, a space, the digits — "+ 299", "− 359" —
    // and a null basis (no sex/age ever answered) still gets its row, its figure an en dash:
    // inventing the number is the one thing this screen is for NOT doing.
    const signedWhole = (v: number): string => `${v < 0 ? "−" : "+"} ${nWhole(Math.abs(v))}`;
    body.append(
      statRow(you.phone.atRest, b.bmr !== null ? nWhole(b.bmr) : "–"),
      statRow(you.phone.yourDays, b.activityDeltaKcal !== null ? signedWhole(b.activityDeltaKcal) : "–"),
      statRow(you.phone.yourPace, signedWhole(b.appliedDeltaKcal)),
      statRow(you.planLabel, fill(you.kcalADay, { kcal: nWhole(me!.targets.kcal) }), true),
      el("span", "pest", fill(you.floorMarker, { floor: nWhole(b.floorKcal) })),
    );
    const change = el("button", "cta s", you.phone.changeAnswer) as HTMLButtonElement;
    change.type = "button";
    change.addEventListener("click", () => openEditor());
    body.append(change);
  }

  /**
   * The subscription panel (web/you-subscription.html) — STATUS ONLY, and the closing line says
   * where the subscription lives: with Apple, managed in the App Store on the iPhone. The trial
   * card is the trial state — the day off the server's `trialDaysLeft`, the length off the
   * host's `paywall.trialDays` (`TRIAL_DAYS` the fallback) — then the what-happens rows, "Then"
   * priced off the plan the trial rides on (`productId`), a plan the host never configured
   * drawing no row. "free"/"ended" never reach this — their row goes to #/pay.
   */
  function openSubscription(): void {
    const e = me!.entitlement;
    const sub = subscriptionState(e);
    const { body } = openPanel(you.subscription);
    if (sub.kind === "trial") {
      const trialLen = me!.paywall?.trialDays || TRIAL_DAYS;
      const trialDay = Math.max(1, trialLen - sub.daysLeft);
      const ends = e.expiresAt !== null ? weekdayDayMonthAt(lang, zone, new Date(e.expiresAt)) : null;
      const card = el("div", "card flat");
      card.append(el("span", "lab", you.phone.freeTrialTitle));
      const day = el("div", "row between");
      day.style.marginTop = "6px";
      day.append(el("b", "d d22", fill(you.phone.dayOfTotal, { n: nWhole(trialDay), total: nWhole(trialLen) })));
      if (ends !== null) day.append(el("span", "t13 m", fill(you.phone.untilDate, { date: ends })));
      card.append(day);
      const bar = el("div", "bar");
      const fillEl = el("i", "");
      fillEl.style.width = `${Math.min(100, (trialDay / trialLen) * 100)}%`;
      bar.append(fillEl);
      card.append(bar);
      body.append(card, statRow(you.phone.beforeEnds, you.phone.weRemind));
      const yearly = /year/i.test(e.productId ?? "");
      const plan = yearly ? me!.paywall?.yearly : me!.paywall?.monthly;
      if (plan) body.append(statRow(you.phone.thenLabel, fill(yearly ? pay.pricePerYear : pay.pricePerMonth, { price: plan.price })));
    } else if (sub.kind === "until") {
      body.append(statRow(pay.renewsLabelPhone, weekdayDayMonthAt(lang, zone, new Date(sub.date))));
    } else if (sub.kind === "lifetime") {
      body.append(statRow(you.subscription, you.subscriptionLifetime));
    }
    body.append(el("p", "t13 m mnote", you.web.subscriptionWithApple));
  }

  /**
   * The delete confirm (web/you-delete.html) — the narrow card OVER the account panel: the
   * question, what goes, Keep it | Delete. Erasure is the server's act — `DELETE /v1/account`
   * answers first, and only then does the local teardown run; a refused call keeps the sheet
   * up, its failure said in the card, for a retry or a Keep it.
   */
  function openDelete(): void {
    const { card, close } = openDialog(you.phone.deleteTitle);
    const keep = el("button", "cta p", you.phone.keepIt) as HTMLButtonElement;
    const del = el("button", "cta s bad", you.phone.deleteConfirm) as HTMLButtonElement;
    keep.type = "button";
    del.type = "button";
    const notice = panelNote("", "");
    notice.hidden = true;
    const row = el("div", "row dlgbtns");
    row.append(keep, del);
    card.append(el("b", "d d22", you.phone.deleteTitle), el("p", "m", you.phone.deleteBody), notice, row);
    keep.addEventListener("click", close);
    // Focus the SAFE button — a blind Enter after the card opens must never erase an account.
    keep.focus();
    let busy = false;
    del.addEventListener("click", () => {
      if (busy) return;
      busy = true;
      keep.disabled = del.disabled = true;
      void (async () => {
        try {
          await api("/account", { method: "DELETE" });
        } catch (err) {
          if (err instanceof Unauthenticated) { closeAllPanels(); await render(); return; }
          console.error(err);
          busy = false;
          keep.disabled = del.disabled = false;
          notice.replaceChildren(el("b", "", you.web.deleteFailedTitle), el("span", "t13 m", keptWords(err, you.web.deleteFailedBody)));
          notice.hidden = false;
          return;
        }
        await leave();
      })();
    });
  }

  /**
   * The account panel (web/you-account.html) — the provider this browser is signed in with, the
   * two sign-outs, and "Delete everything", whose confirm stacks over this panel. For an
   * ANONYMOUS account — a paired browser on an unsigned phone account, a /start flow nobody
   * finished — no provider names it and a sign-out orphans it, so the one row offers the way
   * IN (to /start), the phone's own guard on the same screen.
   */
  function openAccount(ids: IdentitiesResponse | null, providers: string[]): void {
    const anonymous = ids !== null && providers.length === 0;
    const { body, close } = openPanel(you.account);
    const notice = panelNote("", "");
    notice.hidden = true;
    if (anonymous) {
      // A LINK, not a fetch: /start is the server-rendered flow whose sign-in attaches to this
      // account. The row keeps the board's opt shape.
      const offer = el("a", "opt") as HTMLAnchorElement;
      offer.href = "/start";
      offer.append(el("span", "ot", you.web.signInOffer));
      body.append(offer);
    } else {
      body.append(statRow(you.phone.signedInWith, listConjunction(lang, providers)));
      body.append(actRow(you.web.signOutBrowser, () => { close(); void leave(); }));
      const everywhere = actRow(you.phone.signOutEverywhere, () => {
        everywhere.disabled = true;
        void api("/auth/signout/all", { method: "POST" })
          .then(() => leave())
          .catch(async (err: unknown) => {
            everywhere.disabled = false;
            if (err instanceof Unauthenticated) { closeAllPanels(); await render(); return; }
            console.error(err);
            notice.replaceChildren(el("b", "", you.web.signOutFailedTitle), el("span", "t13 m", keptWords(err, you.web.signOutFailedBody)));
            notice.hidden = false;
          });
      });
      body.append(everywhere, notice);
    }
    const del = el("button", "cta g bad", you.phone.deleteEverything) as HTMLButtonElement;
    del.type = "button";
    del.addEventListener("click", () => openDelete());
    body.append(del);
  }

  // ── The two columns — the left is the board's order; the right is the flat rows. ────────────

  const cols = el("div", "ygrid");
  const leftCol = el("div", "wcol");
  const rightCol = el("div", "wcol");
  cols.append(leftCol, rightCol);
  wrap.append(strip, cols);

  async function draw(): Promise<void> {
    const mine = ++drawing;
    // EVERY READ DEGRADES ALONE: one refused fetch must not blank the surface — a card that can
    // still answer does, and the notice under the columns says what did not.
    const ids = await api<IdentitiesResponse>("/auth/identities").catch(() => null);
    // The option labels are read once — a language change reloads the page rather than refetching.
    if (content === null) {
      const res = await api<OnboardingContentResponse>(`/onboarding?lang=${lang}`).catch(() => null);
      content = res?.content ?? null;
    }
    if (mine !== drawing) return;

    const rn = noticeFor();
    clear(leftCol).append(identityCard(), planCard());
    // Signing OUT an account no provider names — anonymous — would orphan it, so the card is
    // not drawn for one (the same guard the account panel runs). An unanswered read is not
    // anonymity: `ids` null keeps the card up.
    const anonymous = ids !== null
      && !(ids.identities ?? []).some((i) => signsIn(i.provider) && i.provider !== "device");
    const refer = anonymous ? null : referralCard();
    clear(rightCol).append(...(refer ? [refer] : []), rowsCard(ids, rn), ...(anonymous ? [] : [signOutCard()]), rn.notice);
  }

  await draw();
  return wrap;
}
