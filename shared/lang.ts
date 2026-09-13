// The localization spine (#358, slice 1). Everything the app says in more than one language goes
// through here, and nothing else does.
//
// NO FRAMEWORK, AND THAT IS THE DESIGN RATHER THAN A SHORTCUT. This repo already stores copy as
// typed constants in `shared` that both clients import, and `Lang` already exists — so the
// change is to KEY those constants by language. An i18next or an ICU catalogue buys plural rules
// and runtime loading, neither of which three compiled-in languages need, and each costs an
// extraction step plus `.json` bundles to keep in sync with the code that reads them.
//
// THE UNIT SYSTEM IS NOT THE LANGUAGE. `de` is metric, `en` is not automatically imperial, and
// nothing here may reach `shared/targets.ts`. A string table must never move the arithmetic.
//
// Numbers and dates are `Intl.NumberFormat` / `Intl.DateTimeFormat`, which Hermes and bun both
// have. There is nothing to add here for them.

import { LANGS, type Lang } from "./types.ts";

/**
 * One phrase in every language it has been written in. `en` is REQUIRED and the rest are optional,
 * which is the type-level statement of the fallback rule below — and what lets a slice land one
 * language at a time instead of demanding all three before anything ships.
 *
 * Holds anything, not only strings: the tables here are the product's typed constants (option
 * lists, arrays of lines), not a flat string catalogue.
 */
export type Localized<T> = { en: T } & Partial<Record<Lang, T>>;

/**
 * Read a phrase in one language. Bound ONCE per screen (`const say = t(lang)`) and then applied,
 * so a renderer reads its language in one place rather than threading it through every call.
 *
 * A MISSING TRANSLATION FALLS BACK AT THE KEY, NEVER AT THE SCREEN. One untranslated button is a
 * wart; a screen that throws is a crash, and an unhandled render error is a process abort in a
 * Release build rather than a red box — the failure `AGENTS.md` records from the `as MealAnalysis`
 * casts. `en` is required by the type, so this cannot return undefined.
 */
export const t = (lang: Lang) => <T>(entry: Localized<T>): T => entry[lang] ?? entry.en;

/**
 * WHAT THE APP HAS WORDS FOR, which is not what the server accepts.
 *
 * `LANGS` is the set the server stores, the device locale narrows to, and the model already answers
 * in — a phone set to Russian gets Russian meal names today. This is the smaller set the app can
 * render ITSELF end to end, and it is what Settings offers: a language that falls back to English
 * on every screen is worse than one that is not on the list, because choosing it looks like a bug.
 *
 * It grows as the slices of #358 land, and the two lists converge when the last one does.
 */
export const LANGS_READY: readonly Lang[] = ["en"];

/**
 * Each language's name IN ITSELF, and deliberately not `Localized`.
 *
 * A list of languages written in the language the reader is trying to leave is the one list they
 * cannot read. Translating these would be the bug, so they are a plain record over every `Lang` —
 * including the ones not yet in `LANGS_READY`, so adding one there needs no edit here.
 */
export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  ru: "Русский",
  de: "Deutsch",
};

/** Every language, in a stable order, for a picker. `LANGS` is the source; this is its array form. */
export const ALL_LANGS: readonly Lang[] = LANGS;
