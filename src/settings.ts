// Pure settings state machine — the /settings hub. No I/O: it takes the current profile plus a
// callback string and returns the view to render, along with the patch `bot.ts` should persist.
// Same discipline as onboarding.ts, for the same reason (it is trivially testable).
//
// Callback data is namespaced `st:` deliberately. Onboarding already owns `goal_lose` and
// friends; reusing those here would route settings taps into `step()`, where the state guards
// would reject them silently.

import type { TFunction } from "i18next";
import { LANGS, LOCALES, isLang, translatorFor } from "./i18n/index.ts";
import { RESTRICTION_TAGS, isRestrictionTag } from "./targets.ts";
import { countryCodeRows, countryLabel, isCountryCode, parseCountry } from "./country.ts";
import { limitationsDisplay, parseLimitations } from "./limitations.ts";
import { parseWeight, type InlineButton } from "./onboarding.ts";
import { REPLY_FORMATS, isReplyFormat } from "./types.ts";
import type { Goal, Lang, Profile, ReplyFormat } from "./types.ts";

/**
 * The profile fields editable by typing rather than tapping (weight, target weight, a free-text
 * "other" country, and the free-text limitations). A picker sets `awaitInput` to one of these;
 * `bot.ts` stores it, and the user's next text message is routed to `settingsInput`. Kept a literal
 * union so the db marker validates against it at the read boundary.
 */
export const PENDING_INPUTS = ["weight", "target_weight", "country", "limitations"] as const;
export type PendingInput = (typeof PENDING_INPUTS)[number];
export function isPendingInput(v: unknown): v is PendingInput {
  return typeof v === "string" && (PENDING_INPUTS as readonly string[]).includes(v);
}

/**
 * The profile the settings machine renders. reply_format must arrive RESOLVED to the effective
 * value (user choice, else instance default) — the machine has no config access, and a raw
 * profile here would mislabel the root's Style line. The compiler enforces what a comment
 * used to merely discourage.
 */
export type SettingsProfile = Profile & { reply_format: ReplyFormat };

export interface SettingsView {
  text: string;
  buttons: InlineButton[][];
  /** Present only when this step actually changed something. */
  patch?: {
    goal?: Goal;
    restrictions?: string[];
    lang?: Lang;
    reply_format?: ReplyFormat;
    weight_kg?: number;
    target_weight_kg?: number;
    country?: string;
    /** '' is the explicit-clear sentinel, so persist on `!== undefined`, never truthiness. */
    limitations?: string;
  };
  /** Present only when this step opens a text prompt: bot.ts arms pending_input to this field so
   * the user's next text message reaches `settingsInput`. Absent on every other view, which is how
   * bot.ts knows to CLEAR any armed prompt (tapping any other button cancels a pending edit). */
  awaitInput?: PendingInput;
}

/** Goals in picker order, paired with the onboarding button label they reuse. */
const GOALS = [
  { goal: "lose", labelKey: "onboarding.button.goalLose" },
  { goal: "maintain", labelKey: "onboarding.button.goalMaintain" },
  { goal: "gain", labelKey: "onboarding.button.goalGain" },
] as const satisfies ReadonlyArray<{ goal: Goal; labelKey: string }>;

const GOAL_VALUES: readonly string[] = GOALS.map((g) => g.goal);

const backRow = (t: TFunction): InlineButton[] => [
  { text: t("settings.button.back"), data: "st:root" },
];

/** A weight value or the "not set" placeholder — shared by the current-weight and target lines. */
function weightDisplay(kg: number | null | undefined, t: TFunction): string {
  return kg ? t("me.weightValue", { kg }) : t("me.noWeight");
}

/** Renders the profile summary + the section buttons. */
export function settingsRoot(p: SettingsProfile, t: TFunction): SettingsView {
  const restrictions = p.restrictions.length
    ? p.restrictions.map((tag) => tagName(tag, t)).join(", ")
    : t("me.noRestrictions");
  return {
    text: [
      t("settings.title"),
      t("settings.goalLine", { goal: t(`me.goal.${p.goal ?? "maintain"}`) }),
      t("settings.weightLine", { weight: weightDisplay(p.weight_kg, t) }),
      t("settings.targetWeightLine", { weight: weightDisplay(p.target_weight_kg, t) }),
      t("settings.countryLine", { country: p.country ? countryLabel(p.country, t) : t("me.noCountry") }),
      t("settings.restrictionsLine", { restrictions }),
      t("settings.limitationsLine", {
        limitations: p.limitations ? limitationsDisplay(p.limitations) : t("me.noLimitations"),
      }),
      t("settings.langLine", { lang: LOCALES[p.lang].nativeName }),
      t("settings.formatLine", { format: t(`settings.format.${p.reply_format}`) }),
    ].join("\n"),
    buttons: [
      [{ text: t("settings.button.goal"), data: "st:goal" }],
      [
        { text: t("settings.button.weight"), data: "st:weight" },
        { text: t("settings.button.targetWeight"), data: "st:targetw" },
      ],
      [
        { text: t("settings.button.country"), data: "st:country" },
        { text: t("settings.button.restrictions"), data: "st:restr" },
      ],
      // Its own row: the label is long in every locale, and paired with another it would be
      // squeezed to unreadable — the same reason the country picker wraps at two.
      [{ text: t("settings.button.limitations"), data: "st:limits" }],
      [
        { text: t("settings.button.language"), data: "st:lang" },
        { text: t("settings.button.format"), data: "st:format" },
      ],
    ],
  };
}

/** A restriction tag's display name; an unknown tag (from an older build) shows as itself. */
function tagName(tag: string, t: TFunction): string {
  return isRestrictionTag(tag) ? t(`me.restriction.${tag}`) : tag;
}

function goalPicker(t: TFunction): SettingsView {
  return {
    text: t("onboarding.askGoal"),
    buttons: [
      GOALS.map(({ goal, labelKey }) => ({ text: t(labelKey), data: `st:goal:${goal}` })),
      backRow(t),
    ],
  };
}

/** Telegram shrinks buttons to fit a row; long labels four-across are unreadable on a phone. */
const TOGGLES_PER_ROW = 2;

function chunk<T>(xs: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}

function restrictionToggles(p: SettingsProfile, t: TFunction): SettingsView {
  const toggles = RESTRICTION_TAGS.map((tag) => ({
    text: t(p.restrictions.includes(tag) ? "settings.toggleOn" : "settings.toggleOff", {
      name: t(`me.restriction.${tag}`),
    }),
    data: `st:restr:${tag}`,
  }));
  return {
    text: t("settings.askRestrictions"),
    buttons: [...chunk(toggles, TOGGLES_PER_ROW), backRow(t)],
  };
}

function langPicker(t: TFunction): SettingsView {
  return {
    text: t("lang.prompt"),
    buttons: [
      LANGS.map((code) => ({ text: LOCALES[code].nativeName, data: `st:lang:${code}` })),
      backRow(t),
    ],
  };
}

function formatPicker(t: TFunction): SettingsView {
  return {
    text: t("settings.askFormat"),
    buttons: [
      REPLY_FORMATS.map((f) => ({ text: t(`settings.format.${f}`), data: `st:format:${f}` })),
      backRow(t),
    ],
  };
}

/** A text prompt: only a "back" button (which cancels), plus `awaitInput` so bot.ts captures the
 * user's next text message as this field's value. `text` is pre-translated by the caller (keeps
 * the i18n key literal at the call site, where the typed `t` can check it). */
function textPrompt(text: string, field: PendingInput, t: TFunction): SettingsView {
  return { text, buttons: [backRow(t)], awaitInput: field };
}

/**
 * The free-text limitations prompt. Echoes the current value and offers Clear only when there IS
 * one — a Clear button over an empty field is a dead control that patches '' to no visible effect.
 * `headlineKey` swaps the lead line: the ask on a fresh open, the "came through empty" notice on a
 * re-prompt after input that normalized to nothing (mirrors weight/country's *Invalid copy, which
 * a bare re-render of the identical ask would not — the user would see no sign anything failed).
 */
function limitationsPrompt(
  p: SettingsProfile,
  t: TFunction,
  headlineKey: "settings.askLimitations" | "settings.limitationsInvalid" = "settings.askLimitations",
): SettingsView {
  const current = p.limitations;
  const text = current
    ? `${t(headlineKey)}\n\n${t("settings.limitationsCurrent", { limitations: current })}`
    : t(headlineKey);
  const buttons: InlineButton[][] = current
    ? [[{ text: t("settings.button.clearLimitations"), data: "st:limits:clear" }], backRow(t)]
    : [backRow(t)];
  return { text, buttons, awaitInput: "limitations" };
}

/** Curated countries + an "Other" (free-text) entry + back. Chosen codes patch; "other" prompts. */
function countryPicker(t: TFunction): SettingsView {
  return {
    text: t("settings.askCountry"),
    buttons: [
      ...countryCodeRows(t, (c) => `st:country:${c}`),
      [{ text: t("onboarding.button.countryOther"), data: "st:country:other" }],
      backRow(t),
    ],
  };
}

/**
 * Applies `data` to `p` and returns the resulting view. An invalid goal, format, or locale falls
 * back to the root view; an unknown restriction tag re-renders the toggles. Nothing unrecognised
 * ever patches — the same "re-prompt rather than break" rule onboarding follows.
 */
export function settingsStep(p: SettingsProfile, data: string, t: TFunction): SettingsView {
  if (data === "st:goal") return goalPicker(t);
  if (data === "st:restr") return restrictionToggles(p, t);
  if (data === "st:lang") return langPicker(t);
  if (data === "st:format") return formatPicker(t);
  if (data === "st:weight") return textPrompt(t("settings.askWeight"), "weight", t);
  if (data === "st:targetw") return textPrompt(t("settings.askTargetWeight"), "target_weight", t);
  if (data === "st:country") return countryPicker(t);
  // Both exact `===` (unlike the `st:country:` prefix match below), so order carries no meaning —
  // "st:limits:clear" cannot be shadowed by "st:limits". If either is ever converted to a
  // `suffix(data, "st:limits:")` match, restore the specific-before-generic ordering then.
  if (data === "st:limits:clear") {
    const next = { ...p, limitations: "" };
    return { ...settingsRoot(next, t), patch: { limitations: "" } };
  }
  if (data === "st:limits") return limitationsPrompt(p, t);

  const country = suffix(data, "st:country:");
  if (country !== null) {
    // "Other" opens a free-text prompt; a curated code patches; anything else re-shows the picker.
    if (country === "other") return textPrompt(t("onboarding.countryOther"), "country", t);
    if (!isCountryCode(country)) return countryPicker(t);
    const next = { ...p, country };
    return { ...settingsRoot(next, t), patch: { country } };
  }

  const goal = suffix(data, "st:goal:");
  if (goal !== null) {
    if (!GOAL_VALUES.includes(goal)) return settingsRoot(p, t);
    const next = { ...p, goal: goal as Goal };
    return { ...settingsRoot(next, t), patch: { goal: next.goal } };
  }

  const tag = suffix(data, "st:restr:");
  if (tag !== null) {
    if (!isRestrictionTag(tag)) return restrictionToggles(p, t);
    // Persist on every tap rather than on a final "Done": a user who walks away keeps what
    // they already toggled, and there is no half-applied state to reconcile.
    const has = p.restrictions.includes(tag);
    const set = new Set(p.restrictions);
    if (has) set.delete(tag);
    else set.add(tag);
    // Ordered by RESTRICTION_TAGS so stored output never depends on tap order.
    const restrictions = RESTRICTION_TAGS.filter((x) => set.has(x));
    const next = { ...p, restrictions };
    return { ...restrictionToggles(next, t), patch: { restrictions } };
  }

  const lang = suffix(data, "st:lang:");
  if (lang !== null) {
    if (!isLang(lang)) return settingsRoot(p, t);
    // Render the root in the language just chosen, not the one they arrived with. Reaching for
    // the factory here does not compromise purity — translatorFor is itself a pure function of
    // its argument. This is the one view whose language differs from the caller's.
    return { ...settingsRoot({ ...p, lang }, translatorFor(lang)), patch: { lang } };
  }

  const format = suffix(data, "st:format:");
  if (format !== null) {
    if (!isReplyFormat(format)) return settingsRoot(p, t);
    const next = { ...p, reply_format: format };
    return { ...settingsRoot(next, t), patch: { reply_format: format } };
  }

  return settingsRoot(p, t);
}

/** `"st:goal:lose"` with prefix `"st:goal:"` -> `"lose"`; null when the prefix does not match. */
function suffix(data: string, prefix: string): string | null {
  return data.startsWith(prefix) ? data.slice(prefix.length) : null;
}

/**
 * Applies a typed value to the field a prompt is awaiting. On success returns the refreshed root
 * (no `awaitInput`, so bot.ts clears the marker); on a parse failure re-prompts with `awaitInput`
 * still set, so the marker stays armed for a corrected retry. Same "re-prompt, never break" rule
 * the callback machine follows. Reuses onboarding's parsers and invalid-input copy.
 */
export function settingsInput(
  field: PendingInput,
  text: string,
  p: SettingsProfile,
  t: TFunction,
): SettingsView {
  switch (field) {
    case "weight": {
      const kg = parseWeight(text);
      if (kg == null) return textPrompt(t("onboarding.weightInvalid"), "weight", t);
      return { ...settingsRoot({ ...p, weight_kg: kg }, t), patch: { weight_kg: kg } };
    }
    case "target_weight": {
      const kg = parseWeight(text);
      if (kg == null) return textPrompt(t("onboarding.targetWeightInvalid"), "target_weight", t);
      return { ...settingsRoot({ ...p, target_weight_kg: kg }, t), patch: { target_weight_kg: kg } };
    }
    case "country": {
      const country = parseCountry(text);
      if (country == null) return textPrompt(t("onboarding.countryInvalid"), "country", t);
      return { ...settingsRoot({ ...p, country }, t), patch: { country } };
    }
    case "limitations": {
      // Over-length input truncates rather than failing (see parseLimitations); only input that
      // normalizes to NOTHING re-prompts, and it re-prompts against the unchanged profile so the
      // existing value is still echoed alongside Clear.
      const limitations = parseLimitations(text);
      if (limitations == null) return limitationsPrompt(p, t, "settings.limitationsInvalid");
      return { ...settingsRoot({ ...p, limitations }, t), patch: { limitations } };
    }
  }
}
