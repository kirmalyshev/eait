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
import type { InlineButton } from "./onboarding.ts";
import { REPLY_FORMATS, isReplyFormat } from "./types.ts";
import type { Goal, Lang, Profile, ReplyFormat } from "./types.ts";

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
  patch?: { goal?: Goal; restrictions?: string[]; lang?: Lang; reply_format?: ReplyFormat };
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

/** Renders the profile summary + the four section buttons. */
export function settingsRoot(p: SettingsProfile, t: TFunction): SettingsView {
  const restrictions = p.restrictions.length
    ? p.restrictions.map((tag) => tagName(tag, t)).join(", ")
    : t("me.noRestrictions");
  return {
    text: [
      t("settings.title"),
      t("settings.goalLine", { goal: t(`me.goal.${p.goal ?? "maintain"}`) }),
      t("settings.restrictionsLine", { restrictions }),
      t("settings.langLine", { lang: LOCALES[p.lang].nativeName }),
      t("settings.formatLine", { format: t(`settings.format.${p.reply_format}`) }),
    ].join("\n"),
    buttons: [
      [
        { text: t("settings.button.goal"), data: "st:goal" },
        { text: t("settings.button.restrictions"), data: "st:restr" },
      ],
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
