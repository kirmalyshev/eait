// The Lingui runtime, one instance per language.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHY EIGHT INSTANCES AND NOT `i18n.activate()`.
//
// Lingui's documented usage is a single global `i18n` whose locale is switched with `activate`.
// That is right for a browser tab, where there is one reader, and it is WRONG HERE: this server
// renders for many accounts in many languages concurrently, and a global active locale is read
// between an `await` and the line that uses it. It is the same defect as a module-scope copy
// table captured at import — the one #358 spent its review rounds removing — wearing a library's
// name.
//
// So `setupI18n` is called once per language at module load, each instance loaded and activated
// with its own catalog and never switched again. `i18nFor(lang)` is a lookup, not a mutation, and
// two requests in two languages cannot interfere. The cost is eight catalogs resident, which is
// what the compiled-in tables cost before.
//
// A CLIENT MAY STILL USE ONE. Nothing here stops a phone or a browser holding a single instance
// for the reader in front of it; `i18nFor` is simply the shape a server needs, and one shape that
// works everywhere beats two that disagree.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { setupI18n, type I18n, type Messages } from "@lingui/core";
import { LANGS, type Lang } from "./types.ts";
import { messages as en } from "./locales/en/messages.ts";
import { messages as fr } from "./locales/fr/messages.ts";
import { messages as de } from "./locales/de/messages.ts";
import { messages as it } from "./locales/it/messages.ts";
import { messages as es } from "./locales/es/messages.ts";
import { messages as vi } from "./locales/vi/messages.ts";
import { messages as id } from "./locales/id/messages.ts";
import { messages as ru } from "./locales/ru/messages.ts";

const CATALOGS: Record<Lang, Messages> = { en, fr, de, it, es, vi, id, ru };

const INSTANCES: Record<Lang, I18n> = Object.fromEntries(
  LANGS.map((lang) => [lang, setupI18n({ locale: lang, messages: { [lang]: CATALOGS[lang] } })]),
) as Record<Lang, I18n>;

/**
 * The runtime for one language. Bound once per screen, exactly as `t(lang)` was.
 *
 * A missing translation falls back to the message id, which for this codebase is the ENGLISH
 * source — `{ id, message }` descriptors carry it inline, so `lingui compile` writes the source
 * string into every catalog that has no translation. That is the same rule `Localized<T>` had:
 * fallback at the key, never at the screen.
 */
export const i18nFor = (lang: Lang): I18n => INSTANCES[lang];
