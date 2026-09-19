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
 * these four wrong is that they are read inside a sentence. `spellUnit` below is that same test
 * applied to the other units, for the one place they are read inside one.
 * ─────────────────────────────────────────────────────────────────────────────────────────────
 */
export const UNIT_KCAL: Record<Lang, string> = {
  en: "kcal", fr: "kcal", de: "kcal", it: "kcal", es: "kcal", vi: "kcal", id: "kcal", ru: "ккал",
};

/**
 * How this language spells a `HEALTH_FIELDS.unit`, for the ONE place a unit is read aloud.
 *
 * ON AN AXIS, DO NOT CALL THIS. `HEALTH_FIELDS.unit` is the axis's own symbol beside a scale and
 * stays SI, exactly as `UNIT_KCAL`'s note above says. What this is for is `trendSummary`, which is
 * the chart rendered as a SENTENCE for VoiceOver — so by the rule that made the four kcal sites
 * wrong, a Russian hearing "девяносто четыре точка два kg" mid-clause is the same defect.
 *
 * Only Cyrillic differs; the other seven use the Latin symbol and fall through unchanged. An
 * unknown unit is returned as it came, because a unit this table has never heard of is more likely
 * a new field than a translation gap, and a `%` is a `%` everywhere.
 */
const UNIT_SPELLING: Partial<Record<Lang, Record<string, string>>> = {
  ru: { kg: "кг", cm: "см", km: "км", g: "г", mg: "мг", min: "мин", ms: "мс", bpm: "уд/мин",
        kcal: "ккал", "ml/kg/min": "мл/кг/мин" },
  // Only the two that are WORDS rather than symbols. `kg`, `cm`, `km`, `ms`, `%` and
  // `ml/kg/min` are the same in both, and de/fr/it/es need nothing at all.
  // `bpm` is the one unit here that is not an SI symbol but an abbreviated PHRASE, so it is
  // the one that translates. Spanish writes `latidos por minuto`; fr/it/de all use `bpm`.
  es: { bpm: "lpm" },
  vi: { min: "phút", bpm: "nhịp/phút" },
  id: { min: "menit", bpm: "denyut/menit" },
};

export const spellUnit = (lang: Lang, unit: string): string => UNIT_SPELLING[lang]?.[unit] ?? unit;

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
 *
 * THE `;q=` IS STRIPPED HERE, not by the caller. An `Accept-Language` entry carries a weight —
 * `de;q=0.9` — and dropping only the region subtag left the whole tag unrecognised, so a browser
 * that ranked its languages got English. `/start` had its own parser that handled this and the
 * subscribe route did not, which is the three-parsers-in-two-workspaces situation this function
 * was written to end, reappearing inside one binary. Anything after `;` is a parameter, never a
 * language, so it cannot belong to the caller.
 */
export function narrowLang(locale: string | null | undefined): Lang {
  const head = (locale ?? "").split(";")[0]!.trim().toLowerCase().split(/[-_]/)[0] ?? "";
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
 * WHY THIS IS A TEST AND NOT A STYLE NOTE. Russian past tense and short adjectives agree with the
 * speaker's gender — there is no neutral form — so `что ты ел?` greets every woman using this app
 * as a man. It shipped on the chat composer's placeholder, in three surfaces at once, and no
 * reviewer who does not read Russian could have seen it: the string is correct, idiomatic,
 * complete, and wrong about half the people who read it. English has nothing that behaves this
 * way, so reviewing the English source could not catch it either.
 *
 * IT NEEDS NO LANGUAGE BUCKET. A string in any other language has no Cyrillic in it, so nothing
 * here can match one — which means it walks every string in the graph and asks the question of all
 * of them, and a table that stops being `Localized` does not slip out of the check.
 *
 * HOW IT DECIDES. A gendered WORD is only a defect when it describes the READER, so a hit needs
 * two things near each other: a gendered form, and a second-person marker (`ты`, `тебе`, `твой`…).
 * A first-person marker (`я`, `мне`, `мой`) nearer to the word than any second-person one EXEMPTS
 * it, because that is Spud talking about himself and his gender is his own to have. The window is
 * counted in TOKENS OF ANY SCRIPT, so `Ты {days} дней подряд записывал еду` and `Ты 5 дней подряд
 * держался плана` are caught — an earlier version counted Cyrillic words only, which quietly
 * exempted every templated sentence in the codebase.
 *
 * WHAT IT CANNOT DO, stated because the alternative is a false claim. Russian drops the pronoun
 * constantly, and `Отлично справился сегодня` is gendered with no marker of person at all — while
 * `Записал.` is Spud saying "noted" about himself and is perfectly fine. The two are
 * indistinguishable without understanding the sentence, so pro-drop is NOT covered and a check
 * that guessed would fire on Spud's own voice every second line. `validateOnboardingContent` and
 * `validateNotificationCopy` run this on admin-typed Russian, which is where a human is present to
 * read the rejection; for the compiled-in tables it is a reviewer's job, and `AGENTS.md` says so.
 */
// TWO CLASSES, because they need different evidence.
//
// GATED: a past-tense verb, and the numeral-adjective `один`. These are only about the reader when
// a second-person marker is nearby — `один раз` is "once" and `Записал.` is Spud.
const RU_GENDERED_GATED = new RegExp(
  "^(?:"
  + "[а-яё]+л(?:а|ся|ась)?"
  + "|(?:с?мог|привык|замёрз|исчез|промок|достиг)(?:ла)?|нёс|вёз|пёк"
  + "|один|одна"
  + ")$", "iu");

// Nouns that end in `-л` and are not verbs. `ккал` is the one this corpus actually contains; the
// list is short on purpose, because a long one is a way of not fixing the pattern.
const RU_NOT_A_VERB = new Set(["ккал", "стол", "угол", "мл", "рубль", "апрель", "июль"]);

// STANDALONE: short adjectives and participles. `Готов?` is a whole screen's call to action and
// carries no pronoun at all, and `поправь граммы сам` has only an imperative. These are gendered
// wherever they appear, so they need no second-person marker — only the absence of a first-person
// one, which is still Spud describing himself.
const RU_GENDERED_ALONE = new RegExp(
  "^(?:"
  + "готов|уверен|рад|должен|должн|сам|сама|прав|голоден|голодн|сыт|занят|доволен|довольн"
  + "|согласен|согласн|болен|больн|беременн|уставш|одинок|подписан|зарегистрирован|новичок"
  // ONLY the feminine `-а`. Neuter (`готово`, `само`) describes a thing and never a person, and
  // `самая` is the superlative particle — both were firing on ordinary copy.
  + ")а?$", "iu");

// The reader, as a PERSON. Deliberately no possessives: in `твой вес не подходил` the past tense
// agrees with `вес`, so `твой` marks a masculine THING and says nothing about who is reading.
const RU_SECOND = /(?<![а-яё])(?:ты|тебе|тебя|тобой)(?![а-яё])/giu;
const RU_FIRST = /(?<![а-яё])(?:я|мне|меня|мной|мой|моя|моё|мои|моего|мою)(?![а-яё])/giu;

/**
 * How many tokens either side of a gendered word a person marker still governs it from.
 *
 * FOUR, measured rather than picked: the longest real case is `Ты 5 дней подряд держался плана`,
 * where the verb is four tokens from the pronoun. Five let `первый день начался … прежде чем ты`
 * match across a sentence boundary — there the verb agrees with `день`, and the reader's gender is
 * nowhere in it.
 */
const RU_WINDOW = 4;

/** Every string under `root` that tells a Russian reader what gender they are. */
export function genderedRussian(root: unknown): { at: string; text: string }[] {
  const found: { at: string; text: string }[] = [];
  const seen = new WeakSet<object>();

  const hits = (text: string): string[] => {
    if (!/[а-яё]/i.test(text)) return [];
    // Split into tokens ONCE and work in token indices, so a `{placeholder}`, a digit or a Latin
    // word costs exactly one step of the window rather than ending the match.
    const tokens = text.split(/\s+/);
    const at = (re: RegExp, i: number): boolean => { re.lastIndex = 0; return re.test(tokens[i] ?? ""); };
    const nearest = (re: RegExp, i: number): number => {
      for (let d = 1; d <= RU_WINDOW; d++) {
        if (at(re, i - d) || at(re, i + d)) return d;
      }
      return Infinity;
    };
    const out: string[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const word = (tokens[i] ?? "").replace(/[^\p{L}]/gu, "");
      if (RU_NOT_A_VERB.has(word.toLowerCase())) continue;
      const alone = RU_GENDERED_ALONE.test(word);
      if (!alone && !RU_GENDERED_GATED.test(word)) continue;
      const second = nearest(RU_SECOND, i);
      // A gated word says nothing about the reader unless the reader is in the sentence.
      if (!alone && second === Infinity) continue;
      // Spud, about Spud — but only when he is actually there. With NEITHER marker present both
      // distances are Infinity, and `Infinity <= Infinity` had been exempting every standalone.
      const first = nearest(RU_FIRST, i);
      if (first !== Infinity && first <= second) continue;
      out.push(tokens.slice(Math.max(0, i - 1), i + 1).join(" "));
    }
    return out;
  };

  const walk = (node: unknown, path: string): void => {
    if (typeof node === "string") {
      for (const h of hits(node)) found.push({ at: path, text: h });
      return;
    }
    if (typeof node !== "object" || node === null || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { node.forEach((v, i) => { walk(v, `${path}[${i}]`); }); return; }
    for (const [k, v] of Object.entries(node)) walk(v, path === "" ? k : `${path}.${k}`);
  };
  walk(root, "");
  return found;
}
