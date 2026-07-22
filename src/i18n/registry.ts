// The locale registry — the ONE file you edit to add a language.
//
// Adding a locale: drop `locales/<code>.json` next to the others, import it, add one entry
// here. Nothing else in `src/` changes. `Lang` widens automatically, and `i18n.test.ts` will
// tell you precisely which keys the new file is missing.
//
// `nativeName` is the /lang button label. `llmName` and `cuisineHint` are PROMPT inputs
// (the language the model should write food names and notes in; the regional cuisine the
// interface language weakly implies) — deliberately not part of the translation namespace,
// because they are never shown to a user. `cuisineHint: null` means no useful prior (an
// English UI implies nothing about the plate).

import de from "./locales/de.json";
import en from "./locales/en.json";
import ru from "./locales/ru.json";

export const LOCALES = {
  en: { nativeName: "English", llmName: "English", cuisineHint: null, resource: en },
  ru: {
    nativeName: "Русский",
    llmName: "Russian",
    cuisineHint: "Russian and Eastern European home cooking",
    resource: ru,
  },
  de: {
    nativeName: "Deutsch",
    llmName: "German",
    cuisineHint: "German and Central European home cooking",
    resource: de,
  },
} as const;

/** Derived from the registry — a new locale widens this with no hand-editing. */
export type Lang = keyof typeof LOCALES;

/** Fallback for an absent or unsupported Telegram `language_code`. */
export const DEFAULT_LANG: Lang = "en";

/** The locale every other locale is checked against for key/placeholder parity. */
export const REFERENCE_LANG: Lang = "en";

export const LANGS = Object.keys(LOCALES) as Lang[];

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && v in LOCALES;
}
