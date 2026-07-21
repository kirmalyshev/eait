// i18next instance + the two functions the rest of the app uses: `resolveLang` (Telegram
// language_code -> a supported Lang) and `translatorFor` (a Lang -> a bound `t`).
//
// `getFixedT`, never `changeLanguage`: changeLanguage mutates instance-global state, and this
// bot renders for concurrent users (grammy's sequentialize serializes per user, not across
// users). A global switch would let one user's locale land in another user's reply mid-flight.
// A fixed-T translator binds the language to the function and removes the race by construction.

import { createInstance, type TFunction } from "i18next";
import { DEFAULT_LANG, LOCALES, isLang, type Lang } from "./registry.ts";

const resources = Object.fromEntries(
  Object.entries(LOCALES).map(([code, meta]) => [code, { translation: meta.resource }]),
);

// Under test, a key missing from EVERY locale is a bug, not a fallback case — fail loudly
// instead of rendering the key name at a user. In production the same key degrades to the
// fallback language, because a broken string beats a crashed handler mid-conversation.
// (A key missing from only SOME locales resolves via fallbackLng and never reaches this
// handler; `i18n.test.ts`'s parity test is what catches that case.)
const strict = process.env.NODE_ENV === "test";

const i18n = createInstance();

i18n.init({
  resources,
  lng: DEFAULT_LANG,
  fallbackLng: DEFAULT_LANG,
  defaultNS: "translation",
  saveMissing: strict,
  missingKeyHandler: strict
    ? (_lngs, _ns, key) => {
        throw new Error(`i18n: missing key "${key}" in every locale`);
      }
    : undefined,
  interpolation: {
    // Telegram messages are plain text, not HTML. Escaping would mangle «», &, and quotes.
    escapeValue: false,
  },
});

// init() returns a promise, but with resources already in memory and no backend plugin it
// completes synchronously. The whole module depends on that (every export is sync), so assert
// it rather than assume it — a future plugin that breaks the assumption fails here at import,
// not silently at a user with raw key names in their reply.
if (!i18n.isInitialized) {
  throw new Error("i18n: instance did not initialise synchronously");
}

/**
 * Telegram's `language_code` (BCP-47-ish: "ru", "ru-RU", "de-AT") -> a supported Lang.
 * Anything unknown, empty, or absent falls back to DEFAULT_LANG.
 */
export function resolveLang(code: string | null | undefined): Lang {
  if (!code) return DEFAULT_LANG;
  const base = code.trim().toLowerCase().split(/[-_]/)[0];
  return isLang(base) ? base : DEFAULT_LANG;
}

/** A `t` bound to one language. Safe to hold across awaits and to interleave across users. */
export function translatorFor(lang: Lang): TFunction {
  return i18n.getFixedT(lang);
}

export { DEFAULT_LANG, LANGS, LOCALES, isLang, REFERENCE_LANG } from "./registry.ts";
export type { Lang } from "./registry.ts";
