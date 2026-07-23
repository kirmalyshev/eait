// Pure settings state machine — the /settings hub. No I/O: it takes the current profile plus a
// callback string and returns the view to render, along with the patch `bot.ts` should persist.
// Same discipline as onboarding.ts, for the same reason (it is trivially testable).
//
// Two levels. The root shows the full profile summary + four GROUP buttons; tapping a group opens a
// sub-menu of its items. An item screen's Back returns to its GROUP (not root); a group's Back and
// the country picker's Back return to root (Country is a top-level one-screen entry per the design).
// After an edit, the machine returns to the relevant GROUP menu so the user stays in context.
//
// Callback data is namespaced `st:` deliberately, and `st:g:<group>` for group menus. Onboarding
// owns `goal_lose` and friends; reusing those here would route settings taps into `step()`, where
// the state guards would reject them silently.

import type { TFunction } from "i18next";
import { LANGS, LOCALES, isLang, translatorFor } from "./i18n/index.ts";
import { RESTRICTION_TAGS, isRestrictionTag } from "./targets.ts";
import { countryCodeRows, countryLabel, isCountryCode, parseCountry } from "./country.ts";
import { LIMITATIONS_MAX_LEN, limitationsDisplay, limitationsTruncated, parseLimitations } from "./limitations.ts";
import { parseWeight, type InlineButton } from "./onboarding.ts";
import { REPLY_FORMATS, isReplyFormat } from "./types.ts";
import type { Goal, Lang, Profile, ReplyFormat } from "./types.ts";

/** The profile keys the three food-specifics free-text fields write to. */
type FoodProfileKey = "medical_limitations" | "food_allergies" | "product_limitations";

/**
 * The profile fields editable by typing rather than tapping (weight, target weight, a free-text
 * "other" country, and the three food-specifics fields). A picker sets `awaitInput` to one of
 * these; `bot.ts` stores it, and the user's next text message is routed to `settingsInput`. Kept a
 * literal union so the db marker validates against it at the read boundary.
 */
export const PENDING_INPUTS = ["weight", "target_weight", "country", "medical", "allergies", "products"] as const;
export type PendingInput = (typeof PENDING_INPUTS)[number];
export function isPendingInput(v: unknown): v is PendingInput {
  return typeof v === "string" && (PENDING_INPUTS as readonly string[]).includes(v);
}

/**
 * The three food-specifics free-text fields. They share every mechanic (prompt, current-value echo,
 * Clear, invalid re-prompt, truncation notice) and differ only in their profile column, callback
 * token, and i18n keys — so they are described by data, not triplicated code. `as const` preserves
 * the i18n-key literals so the typed `t` accepts them; `satisfies` validates the shape. `key` is the
 * callback + `pending_input` token, e.g. "medical" → `st:medical`, `st:medical:clear`.
 */
const FOOD_FIELDS = [
  {
    key: "medical", profile: "medical_limitations",
    button: "settings.button.medical", clear: "settings.button.clearMedical",
    ask: "settings.askMedical", current: "settings.medicalCurrent", invalid: "settings.medicalInvalid",
    line: "settings.medicalLine", none: "me.noMedical",
  },
  {
    key: "allergies", profile: "food_allergies",
    button: "settings.button.allergies", clear: "settings.button.clearAllergies",
    ask: "settings.askAllergies", current: "settings.allergiesCurrent", invalid: "settings.allergiesInvalid",
    line: "settings.allergiesLine", none: "me.noAllergies",
  },
  {
    key: "products", profile: "product_limitations",
    button: "settings.button.products", clear: "settings.button.clearProducts",
    ask: "settings.askProducts", current: "settings.productsCurrent", invalid: "settings.productsInvalid",
    line: "settings.productsLine", none: "me.noProducts",
  },
] as const satisfies readonly {
  key: Extract<PendingInput, "medical" | "allergies" | "products">;
  profile: FoodProfileKey;
  button: string; clear: string; ask: string; current: string; invalid: string; line: string; none: string;
}[];
type FoodField = (typeof FOOD_FIELDS)[number];

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
    /** '' is the explicit-clear sentinel on each, so persist on `!== undefined`, never truthiness. */
    medical_limitations?: string;
    food_allergies?: string;
    product_limitations?: string;
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

/** A Back button targeting `data` (a group menu or root). One-button row by convention. */
const backRow = (t: TFunction, data = "st:root"): InlineButton[] => [
  { text: t("settings.button.back"), data },
];

/** A weight value or the "not set" placeholder — shared by the current-weight and target lines. */
function weightDisplay(kg: number | null | undefined, t: TFunction): string {
  return kg ? t("me.weightValue", { kg }) : t("me.noWeight");
}

/** A restriction tag's display name; an unknown tag (from an older build) shows as itself. */
function tagName(tag: string, t: TFunction): string {
  return isRestrictionTag(tag) ? t(`me.restriction.${tag}`) : tag;
}

function restrictionsSummary(p: SettingsProfile, t: TFunction): string {
  return p.restrictions.length
    ? p.restrictions.map((tag) => tagName(tag, t)).join(", ")
    : t("me.noRestrictions");
}

/** A food field's summary line: its stored value (display-truncated) or the "not set" placeholder. */
function foodLine(f: FoodField, p: SettingsProfile, t: TFunction): string {
  const value = p[f.profile];
  return t(f.line, { value: value ? limitationsDisplay(value) : t(f.none) });
}

// ---------- root + group menus ----------

/** The root: the full profile summary + the four group buttons. */
export function settingsRoot(p: SettingsProfile, t: TFunction): SettingsView {
  return {
    text: [
      t("settings.title"),
      t("settings.goalLine", { goal: t(`me.goal.${p.goal ?? "maintain"}`) }),
      t("settings.weightLine", { weight: weightDisplay(p.weight_kg, t) }),
      t("settings.targetWeightLine", { weight: weightDisplay(p.target_weight_kg, t) }),
      t("settings.countryLine", { country: p.country ? countryLabel(p.country, t) : t("me.noCountry") }),
      t("settings.restrictionsLine", { restrictions: restrictionsSummary(p, t) }),
      ...FOOD_FIELDS.map((f) => foodLine(f, p, t)),
      t("settings.langLine", { lang: LOCALES[p.lang].nativeName }),
      t("settings.formatLine", { format: t(`settings.format.${p.reply_format}`) }),
    ].join("\n"),
    buttons: [
      [{ text: t("settings.group.goal"), data: "st:g:goal" }],
      [{ text: t("settings.group.country"), data: "st:country" }], // top-level → opens the picker directly
      [{ text: t("settings.group.food"), data: "st:g:food" }],
      [{ text: t("settings.group.prefs"), data: "st:g:prefs" }],
    ],
  };
}

/** Goal group: goal + current weight + target weight. */
function goalGroup(p: SettingsProfile, t: TFunction): SettingsView {
  return {
    text: [
      t("settings.groupTitle.goal"),
      t("settings.goalLine", { goal: t(`me.goal.${p.goal ?? "maintain"}`) }),
      t("settings.weightLine", { weight: weightDisplay(p.weight_kg, t) }),
      t("settings.targetWeightLine", { weight: weightDisplay(p.target_weight_kg, t) }),
    ].join("\n"),
    buttons: [
      [{ text: t("settings.button.goal"), data: "st:goal" }],
      [
        { text: t("settings.button.weight"), data: "st:weight" },
        { text: t("settings.button.targetWeight"), data: "st:targetw" },
      ],
      backRow(t),
    ],
  };
}

/** Food specifics group: the restriction tags + the three free-text fields. */
function foodGroup(p: SettingsProfile, t: TFunction): SettingsView {
  return {
    text: [
      t("settings.groupTitle.food"),
      t("settings.restrictionsLine", { restrictions: restrictionsSummary(p, t) }),
      ...FOOD_FIELDS.map((f) => foodLine(f, p, t)),
    ].join("\n"),
    buttons: [
      [{ text: t("settings.button.restrictions"), data: "st:restr" }],
      ...FOOD_FIELDS.map((f) => [{ text: t(f.button), data: `st:${f.key}` }]),
      backRow(t),
    ],
  };
}

/** Preferences group: language + reply style. */
function prefsGroup(p: SettingsProfile, t: TFunction): SettingsView {
  return {
    text: [
      t("settings.groupTitle.prefs"),
      t("settings.langLine", { lang: LOCALES[p.lang].nativeName }),
      t("settings.formatLine", { format: t(`settings.format.${p.reply_format}`) }),
    ].join("\n"),
    buttons: [
      [
        { text: t("settings.button.language"), data: "st:lang" },
        { text: t("settings.button.format"), data: "st:format" },
      ],
      backRow(t),
    ],
  };
}

// ---------- item screens ----------

function goalPicker(t: TFunction): SettingsView {
  return {
    text: t("onboarding.askGoal"),
    buttons: [
      GOALS.map(({ goal, labelKey }) => ({ text: t(labelKey), data: `st:goal:${goal}` })),
      backRow(t, "st:g:goal"),
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
    buttons: [...chunk(toggles, TOGGLES_PER_ROW), backRow(t, "st:g:food")],
  };
}

function langPicker(t: TFunction): SettingsView {
  return {
    text: t("lang.prompt"),
    buttons: [
      LANGS.map((code) => ({ text: LOCALES[code].nativeName, data: `st:lang:${code}` })),
      backRow(t, "st:g:prefs"),
    ],
  };
}

function formatPicker(t: TFunction): SettingsView {
  return {
    text: t("settings.askFormat"),
    buttons: [
      REPLY_FORMATS.map((f) => ({ text: t(`settings.format.${f}`), data: `st:format:${f}` })),
      backRow(t, "st:g:prefs"),
    ],
  };
}

/** A text prompt: only a "back" button (which cancels, returning to `back`), plus `awaitInput` so
 * bot.ts captures the user's next text message as this field's value. `text` is pre-translated by
 * the caller (keeps the i18n key literal at the call site, where the typed `t` can check it). */
function textPrompt(text: string, field: PendingInput, t: TFunction, back = "st:root"): SettingsView {
  return { text, buttons: [backRow(t, back)], awaitInput: field };
}

/**
 * A food-specifics field prompt. Echoes the current value and offers Clear only when there IS one —
 * a Clear button over an empty field is a dead control that patches '' to no visible effect.
 * `invalid` swaps the lead line to the "came through empty" notice on a re-prompt after input that
 * normalized to nothing (mirrors weight/country's *Invalid copy, which a bare re-render of the
 * identical ask would not — the user would see no sign anything failed). Back returns to the group.
 */
function foodPrompt(f: FoodField, p: SettingsProfile, t: TFunction, invalid = false): SettingsView {
  const current = p[f.profile];
  const headline = invalid ? t(f.invalid) : t(f.ask);
  const text = current ? `${headline}\n\n${t(f.current, { value: current })}` : headline;
  const buttons: InlineButton[][] = current
    ? [[{ text: t(f.clear), data: `st:${f.key}:clear` }], backRow(t, "st:g:food")]
    : [backRow(t, "st:g:food")];
  return { text, buttons, awaitInput: f.key };
}

/** Curated countries + an "Other" (free-text) entry + back to root (Country is a top-level entry). */
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

/** `{ [field]: value }` typed as a patch — the computed food-field key is always a valid patch key,
 * but a single computed property widens to an index signature, so the cast restores the exact shape. */
function foodPatch(f: FoodField, value: string): SettingsView["patch"] {
  return { [f.profile]: value } as SettingsView["patch"];
}

// ---------- routing ----------

/**
 * Applies `data` to `p` and returns the resulting view. An invalid goal, format, or locale falls
 * back to the relevant group; an unknown restriction tag re-renders the toggles. Nothing
 * unrecognised ever patches — the same "re-prompt rather than break" rule onboarding follows.
 */
export function settingsStep(p: SettingsProfile, data: string, t: TFunction): SettingsView {
  if (data === "st:root") return settingsRoot(p, t);
  if (data === "st:g:goal") return goalGroup(p, t);
  if (data === "st:g:food") return foodGroup(p, t);
  if (data === "st:g:prefs") return prefsGroup(p, t);

  if (data === "st:goal") return goalPicker(t);
  if (data === "st:restr") return restrictionToggles(p, t);
  if (data === "st:lang") return langPicker(t);
  if (data === "st:format") return formatPicker(t);
  if (data === "st:weight") return textPrompt(t("settings.askWeight"), "weight", t, "st:g:goal");
  if (data === "st:targetw") return textPrompt(t("settings.askTargetWeight"), "target_weight", t, "st:g:goal");
  if (data === "st:country") return countryPicker(t);

  // Food-specifics fields — the specific `:clear` action is matched before the bare open, and both
  // are exact `===`, so ordering carries no meaning (as with country below, only a future
  // prefix-match would need the specific-before-generic order).
  for (const f of FOOD_FIELDS) {
    if (data === `st:${f.key}:clear`) {
      const next = { ...p, [f.profile]: "" };
      return { ...foodGroup(next, t), patch: foodPatch(f, "") };
    }
    if (data === `st:${f.key}`) return foodPrompt(f, p, t);
  }

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
    if (!GOAL_VALUES.includes(goal)) return goalGroup(p, t);
    const next = { ...p, goal: goal as Goal };
    return { ...goalGroup(next, t), patch: { goal: next.goal } };
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
    if (!isLang(lang)) return prefsGroup(p, t);
    // Render the group in the language just chosen, not the one they arrived with. Reaching for
    // the factory here does not compromise purity — translatorFor is itself a pure function of
    // its argument. This is the one view whose language differs from the caller's.
    return { ...prefsGroup({ ...p, lang }, translatorFor(lang)), patch: { lang } };
  }

  const format = suffix(data, "st:format:");
  if (format !== null) {
    if (!isReplyFormat(format)) return prefsGroup(p, t);
    const next = { ...p, reply_format: format };
    return { ...prefsGroup(next, t), patch: { reply_format: format } };
  }

  return settingsRoot(p, t);
}

/** `"st:goal:lose"` with prefix `"st:goal:"` -> `"lose"`; null when the prefix does not match. */
function suffix(data: string, prefix: string): string | null {
  return data.startsWith(prefix) ? data.slice(prefix.length) : null;
}

/**
 * Applies a typed value to the field a prompt is awaiting. On success returns the refreshed GROUP
 * menu (no `awaitInput`, so bot.ts clears the marker); on a parse failure re-prompts with
 * `awaitInput` still set, so the marker stays armed for a corrected retry. Same "re-prompt, never
 * break" rule the callback machine follows. Reuses onboarding's parsers and invalid-input copy.
 */
export function settingsInput(
  field: PendingInput,
  text: string,
  p: SettingsProfile,
  t: TFunction,
): SettingsView {
  const food = FOOD_FIELDS.find((f) => f.key === field);
  if (food) {
    // Over-length input truncates rather than failing (see parseLimitations); only input that
    // normalizes to NOTHING re-prompts, against the unchanged profile so the existing value is
    // still echoed alongside Clear.
    const value = parseLimitations(text);
    if (value == null) return foodPrompt(food, p, t, true);
    const group = foodGroup({ ...p, [food.profile]: value }, t);
    // Surface the loss rather than truncating silently — the copy solicits a full list, and the
    // group summary only shows the first 60 chars.
    const notice = limitationsTruncated(text)
      ? `${t("settings.limitationsTruncated", { max: LIMITATIONS_MAX_LEN })}\n\n`
      : "";
    return { ...group, text: notice + group.text, patch: foodPatch(food, value) };
  }

  switch (field) {
    case "weight": {
      const kg = parseWeight(text);
      if (kg == null) return textPrompt(t("onboarding.weightInvalid"), "weight", t, "st:g:goal");
      return { ...goalGroup({ ...p, weight_kg: kg }, t), patch: { weight_kg: kg } };
    }
    case "target_weight": {
      const kg = parseWeight(text);
      if (kg == null) return textPrompt(t("onboarding.targetWeightInvalid"), "target_weight", t, "st:g:goal");
      return { ...goalGroup({ ...p, target_weight_kg: kg }, t), patch: { target_weight_kg: kg } };
    }
    case "country": {
      const country = parseCountry(text);
      if (country == null) return textPrompt(t("onboarding.countryInvalid"), "country", t);
      return { ...settingsRoot({ ...p, country }, t), patch: { country } };
    }
    // medical/allergies/products handled above via FOOD_FIELDS.
    case "medical":
    case "allergies":
    case "products":
      return settingsRoot(p, t); // unreachable: `food` matched above
  }
}
