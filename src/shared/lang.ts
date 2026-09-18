// The localization spine (#358). Everything the app says in more than one language goes through
// here, and nothing else does.
//
// NO FRAMEWORK, AND THAT IS THE DESIGN RATHER THAN A SHORTCUT. This repo already stores copy as
// typed constants in `shared` that both clients import, and `Lang` already exists — so the
// change is to KEY those constants by language. An i18next or an ICU catalogue buys plural rules
// and runtime loading, neither of which eight compiled-in languages need, and each costs an
// extraction step plus `.json` bundles to keep in sync with the code that reads them.
//
// THE UNIT SYSTEM IS NOT THE LANGUAGE. `de` is metric, `en` is not automatically imperial, and
// nothing here may reach `shared/targets.ts`. A string table must never move the arithmetic.
//
// Numbers and dates are `Intl.NumberFormat` / `Intl.DateTimeFormat`, which Hermes and bun both
// have. `numbers` and `monthYear` below are the only two shapes this product needs, and every
// figure in every sentence goes through one of them rather than through a hand-written table.

import { LANGS, type Lang } from "./types.ts";

/**
 * One phrase in every language it has been written in. `en` is REQUIRED and the rest are optional,
 * which is the type-level statement of the fallback rule below — and what lets a slice land one
 * surface at a time instead of demanding all eight before anything ships.
 *
 * Holds anything, not only strings: the tables here are the product's typed constants (option
 * lists, arrays of lines, whole content trees), not a flat string catalogue.
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
 * IT IS AN HONEST LIST AND `localizedGaps` IS WHAT KEEPS IT HONEST. A language only belongs here
 * once every `Localized` table in the codebase carries it, and there is a test per workspace that
 * fails by name when one does not.
 */
export const LANGS_READY: readonly Lang[] = [...LANGS];

/**
 * Each language's name IN ITSELF, and deliberately not `Localized`.
 *
 * A list of languages written in the language the reader is trying to leave is the one list they
 * cannot read. Translating these would be the bug, so they are a plain record over every `Lang` —
 * including the ones not yet in `LANGS_READY`, so adding one there needs no edit here.
 */
export const LANG_LABEL: Record<Lang, string> = {
  en: "English",
  fr: "Français",
  de: "Deutsch",
  it: "Italiano",
  es: "Español",
  vi: "Tiếng Việt",
  id: "Bahasa Indonesia",
  ru: "Русский",
};

/**
 * The BCP-47 tag each language formats numbers and dates with.
 *
 * A `Lang` IS NOT A LOCALE, which is why this table exists rather than passing the code straight to
 * `Intl`. Bare `en` resolves to US conventions in most ICU builds, and this product is metric,
 * Berlin-based and writes kilograms — so English here is `en-GB`. The rest name their principal
 * region, so a reader gets their own grouping and their own month names.
 *
 * NOT A UNIT SYSTEM. `Intl.NumberFormat` is asked for a decimal, never for a measurement, so
 * nothing on this line can turn a kilogram into a pound. `targets.ts` is untouched by any of it.
 */
export const LANG_TAG: Record<Lang, string> = {
  en: "en-GB",
  fr: "fr-FR",
  de: "de-DE",
  it: "it-IT",
  es: "es-ES",
  vi: "vi-VN",
  id: "id-ID",
  ru: "ru-RU",
};

/**
 * Every figure in every sentence this product writes.
 *
 * ONE SHAPE, because the thread only ever writes one: a whole number, or one decimal place when
 * there is one to keep ("92.4 kg", never "92.40 kg" and never "1454"). It was
 * `toLocaleString("en-US")` in four files, which is a German reading their own weight with a
 * decimal point and their calorie target with a comma for a thousand.
 *
 * Bound once per surface, like `t`.
 */
export const numbers = (lang: Lang) => {
  const whole = wholeNumbers(lang);
  const tenth = new Intl.NumberFormat(LANG_TAG[lang], { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (x: number): string =>
    Math.round(x * 10) % 10 === 0 ? whole(x) : tenth.format(Math.round(x * 10) / 10);
};

/**
 * A figure ROUNDED TO A WHOLE NUMBER, which is what the thread and the 20:30 line write.
 *
 * TWO HELPERS AND NOT ONE, because the two are about different things. A WEIGHT keeps its tenth —
 * "93.5 kg" is a number somebody typed and 93 is a different weight. A kcal or a gram of protein
 * does not: they are estimates from a photo, and "74.8 of the 104 g protein" claims a precision the
 * analyzer does not have. That distinction was two private `n()` helpers in two files before #358,
 * and unifying them on the wrong one is how the protein figure grew a decimal point.
 */
export const wholeNumbers = (lang: Lang) => {
  const format = new Intl.NumberFormat(LANG_TAG[lang], { maximumFractionDigits: 0 });
  return (x: number): string => format.format(Math.round(x));
};

/**
 * How this language SPELLS the kilocalorie, for the four places that concatenate it onto a figure.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * A SPELLING, NOT A UNIT. This is the same quantity in all eight — nothing here picks a different
 * unit, and `targets.ts` is as untouched by it as by `LANG_TAG`. Russian writes the kilocalorie in
 * Cyrillic and the other seven use the Latin symbol; that is the `LANG_LABEL` situation, not the
 * imperial one, and the distinction is the whole reason this constant is allowed to exist.
 *
 * WHY IT EXISTS AT ALL. Every sentence that mentions kcal carries the word in its own template, so
 * this is only for the figures code builds: the plan card's headline, the diary's, and a Telegram
 * meal line. Those sat next to translated prose — a Russian plan card read "1 500 kcal" with
 * "Порог — 1500 ккал." two lines under it, on one card.
 *
 * A CHART AXIS IS STILL NOT PROSE. `HEALTH_FIELDS.unit` stays SI (`kg`, `km`, `ms`, `ml/kg/min`)
 * and this does not license changing it: an axis label is a symbol beside a scale, and what made
 * these four wrong is that they are read inside a sentence.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export const UNIT_KCAL: Record<Lang, string> = {
  en: "kcal", fr: "kcal", de: "kcal", it: "kcal", es: "kcal", vi: "kcal", id: "kcal", ru: "ккал",
};

/**
 * A month and a year, as the plan's projection names one: "November 2026", "novembre 2026".
 *
 * `Intl.DateTimeFormat` rather than a table of month names. `projection.ts` used to carry twelve
 * English strings and a comment saying Hermes had once answered a numeric month for
 * `toLocaleString` — that was a reduced-ICU build, both runtimes this ships on carry a full one,
 * and twelve names in a table is eighty-four names the day a second language lands.
 */
export const monthYear = (lang: Lang, at: Date): string =>
  new Intl.DateTimeFormat(LANG_TAG[lang], { month: "long", year: "numeric", timeZone: "UTC" }).format(at);

/**
 * A client-supplied locale, narrowed to a language this server stores. Unknown is English.
 *
 * ONE COPY, because there were three: `/v1/auth/device` narrowing a phone's locale, `/start`
 * reading `Accept-Language`, and the Telegram connector reading `from.language_code`. Each took the
 * first two characters and compared against `LANGS`, and the day a three-letter code or a language
 * with a script subtag arrives they would have to be fixed three times — in two workspaces.
 *
 * It narrows to `LANGS` and NOT to `LANGS_READY`: this is what the server will STORE and what the
 * model answers in, which is the wider claim. A phone in a language the app has no screens for
 * still gets its meal names in that language, which is what it got before any of this.
 */
export function narrowLang(locale: string | null | undefined): Lang {
  const head = (locale ?? "").trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return (LANGS as readonly string[]).includes(head) ? (head as Lang) : "en";
}

/** Every language, in a stable order, for a picker. `LANGS` is the source; this is its array form. */
export const ALL_LANGS: readonly Lang[] = LANGS;

// ── The check that keeps `LANGS_READY` honest ────────────────────────────────────────────────

/** One table that claims to speak a language it has no words in. */
export interface LocalizedGap {
  /** Where it is, as a path through the module's exports: `GOAL_CARDS.lose`. */
  table: string;
  lang: Lang;
}

const IS_LANG = new Set<string>(LANGS);

/**
 * Every `Localized<T>` under `root` that is missing a language `ready` claims.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 * PROSE IN A MARKDOWN FILE GOES STALE; A RED TEST DOES NOT
 *
 * A language reaches `LANGS_READY` when every table has its words, and the only way that stays
 * true through the next copy change is for the next copy change to fail. So each workspace has one
 * test that hands this function `import * as everything` and asserts an empty answer — which means
 * a new table, or a new sentence in an old one, is checked the moment it is exported, with no
 * registry to remember to add it to and no extraction step to run.
 *
 * A TABLE IS DETECTED BY SHAPE, not by a marker: a plain object whose keys are ALL `Lang` codes and
 * which carries `en`. That is exactly `Localized<T>`, and nothing else in this codebase has that
 * shape by accident — an ordinary copy record is keyed by its own vocabulary (`title`, `lose`,
 * `kidneys`), and the one record keyed by every language on purpose (`LANG_LABEL`, `LANG_TAG`) is
 * complete by construction and so reports nothing.
 *
 * Detection STOPS at the table. What sits under `en` is the value, whatever shape it has, and
 * walking into it would report a sentence twice per language it is written in.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export function localizedGaps(root: unknown, ready: readonly Lang[] = LANGS_READY): LocalizedGap[] {
  const gaps: LocalizedGap[] = [];
  // A module graph has cycles, and `export *` re-exports mean one object is reached twice. Both
  // would otherwise be an infinite walk or a doubled report.
  const seen = new WeakSet<object>();

  const walk = (node: unknown, at: string) => {
    if (typeof node !== "object" || node === null) return;
    if (seen.has(node)) return;
    seen.add(node);

    if (Array.isArray(node)) {
      node.forEach((v, i) => { walk(v, `${at}[${i}]`); });
      return;
    }

    const keys = Object.keys(node);
    if (keys.length > 0 && keys.every((k) => IS_LANG.has(k)) && Object.hasOwn(node, "en")) {
      for (const lang of ready) if (!Object.hasOwn(node, lang)) gaps.push({ table: at, lang });
      return;
    }

    for (const [k, v] of Object.entries(node)) walk(v, at === "" ? k : `${at}.${k}`);
  };

  walk(root, "");
  return gaps;
}

/** `localizedGaps` as a sentence per gap, for a test that has to name what to go and write. */
export const describeGaps = (gaps: readonly LocalizedGap[]): string[] =>
  gaps.map((g) => `${g.table} has no ${g.lang} (${LANG_LABEL[g.lang]})`);

// ── The check that keeps the Russian from deciding who the reader is ─────────────────────────

/**
 * A Russian sentence that has picked a gender for the person reading it.
 *
 * WHY THIS IS A TEST AND NOT A STYLE NOTE. Russian past tense agrees with the speaker's gender —
 * there is no neutral form — so `что ты ел?` greets every woman using this app as a man. It shipped
 * on the chat composer's placeholder, in three surfaces at once, and no reviewer who does not read
 * Russian could have seen it: the string is correct, idiomatic, complete, and wrong about half the
 * people who read it. English has nothing that behaves this way, so nothing in the review of the
 * English source could have caught it either.
 *
 * IT NEEDS NO LANGUAGE BUCKET. A string in any other language has no Cyrillic in it, so the pattern
 * cannot match one — which means this walks every string in the graph and asks the question of all
 * of them, and a table that stops being `Localized` does not slip out of the check.
 *
 * WHAT IT COVERS, and why each part earns its place — measured over the whole corpus rather than
 * guessed, because a check that cries wolf gets deleted:
 *
 *   1. SECOND-PERSON PAST TENSE (`ты … ел`). Always gendered, never ambiguous, and thirteen of the
 *      eighteen instances this repo had. Up to two words may intervene: `ты об этом попросил` is
 *      the shape a hand search misses and this one does not.
 *   2. SHORT ADJECTIVES (`готов`, `уверен`, `рад`, `должен`, `сам`) anywhere in the string, since
 *      `Готов?` carries no `ты` at all — EXCEPT after `я`, because that is Spud talking about
 *      himself and his gender is his own to have.
 *   3. `ты … один`, and `был … ты`, whose verb precedes the pronoun.
 *
 * `один` alone is NOT a token: it is the numeral, and flagging every `один раз` would drown the
 * three real ones. It is only caught after `ты`, which is where it stops being a number.
 */
// NOT `\b`: JavaScript's word boundary is ASCII, so it never fires between a space and `т`
// and the whole pattern silently matches nothing. The lookarounds are the Cyrillic version.
const RU_READER_GENDERED = new RegExp([
  // 1. `ты … <verb>л`
  "(?<![а-яё])ты\\s+(?:[а-яё]+\\s+){0,2}[а-яё]+л(?:а|о|и|ся|ась)?(?![а-яё])",
  // 2. a short adjective, but never Spud's own
  "(?<![а-яё])(?<!я\\s)(?<!я\\sне\\s)(?:готов|уверен|рад|должен|сам)(?:а|ы)?(?![а-яё])",
  // 3. `ты … один`, and the inversion `был … ты`
  "(?<![а-яё])ты(?:\\s+[а-яё]+){0,3}\\s+одн?(?:ин|а)(?![а-яё])",
  "(?<![а-яё])был(?:а)?\\s+(?:не\\s+)?ты(?![а-яё])",
].join("|"), "giu");

/** Every string under `root` that tells a Russian reader what gender they are. */
export function genderedRussian(root: unknown): { at: string; text: string }[] {
  const found: { at: string; text: string }[] = [];
  const seen = new WeakSet<object>();
  const walk = (node: unknown, at: string): void => {
    if (typeof node === "string") {
      for (const m of node.matchAll(RU_READER_GENDERED)) found.push({ at, text: m[0] });
      return;
    }
    if (typeof node !== "object" || node === null || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { node.forEach((v, i) => { walk(v, `${at}[${i}]`); }); return; }
    for (const [k, v] of Object.entries(node)) walk(v, at === "" ? k : `${at}.${k}`);
  };
  walk(root, "");
  return found;
}
