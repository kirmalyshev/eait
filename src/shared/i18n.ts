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

/**
 * Re-exported so the other two workspaces never import `@lingui/core` themselves.
 *
 * `shared` is the contract both sides implement, and which i18n library is behind it is this
 * package's business. A backend module typing a parameter as `I18n` would otherwise need Lingui in
 * its own `package.json` — a second copy of the runtime is a second set of instances, which is the
 * one thing `i18nFor` exists to prevent.
 */
export type { I18n } from "@lingui/core";

/**
 * Every message of one catalog as plain text, keyed by message id.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS, AND WHY IT IS NOT A DEBUG HELPER.
 *
 * Two checks in this repo read PROSE rather than types: `genderedRussian`, which refuses a Russian
 * sentence that tells the reader what gender they are, and `lintCopy`, which refuses a health
 * claim. Both walked `import * as everything` — a graph of `Localized<T>` tables — and both go
 * SILENTLY BLIND the moment a table's words move into a `.po`. A guard that stops watching is
 * worse than one that was never written, because the tests still pass and the file still says it
 * is guarded.
 *
 * So every table that migrates is swept HERE instead, from the compiled catalog, which is the
 * thing that actually ships. `lingui compile --strict` proves a language is complete; this proves
 * the sentences in it are allowed.
 *
 * THE COMPILED FORM IS TOKENS, not a string: `"{noun} — very high"` compiles to
 * `[["noun"], " — very high"]`. An argument contributes no prose and its NAME is not a word
 * anybody reads, so only the literals are returned — otherwise every sweep would be linting
 * variable names.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export function catalogText(lang: Lang): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [id, message] of Object.entries(CATALOGS[lang])) out[id] = literals(message).join("");
  return out;
}

const literals = (message: unknown): string[] => {
  if (typeof message === "string") return [message];
  if (!Array.isArray(message)) return [];
  return message.flatMap((token) => {
    if (typeof token === "string") return [token];
    // An ARGUMENT: `[name, type?, format?]`. Only a plural or select format holds further prose,
    // and it holds it under keys (`one`, `other`, `female`) that are not prose themselves.
    if (!Array.isArray(token)) return [];
    const format = token[2];
    return format && typeof format === "object"
      ? Object.values(format as Record<string, unknown>).flatMap(literals)
      : [];
  });
};
