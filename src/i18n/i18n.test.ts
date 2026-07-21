import { describe, expect, test } from "bun:test";
import { DEFAULT_LANG, LANGS, LOCALES, REFERENCE_LANG, type Lang } from "./registry.ts";
import { resolveLang, translatorFor } from "./index.ts";

// ---------- catalog introspection helpers ----------

const PLURAL_SUFFIX = /_(zero|one|two|few|many|other)$/;

/** Nested catalog -> flat "a.b.c" leaf keys. */
function flatten(obj: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof obj !== "object" || obj === null) return out;
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null) {
      for (const [ik, iv] of flatten(v, path)) out.set(ik, iv);
    } else {
      out.set(path, String(v));
    }
  }
  return out;
}

const CATALOGS = Object.fromEntries(
  LANGS.map((l) => [l, flatten(LOCALES[l].resource)]),
) as Record<Lang, Map<string, string>>;

/** "stats.users_few" -> "stats.users". Plural variants collapse to one logical key. */
const baseKey = (k: string) => k.replace(PLURAL_SUFFIX, "");

const baseKeys = (lang: Lang) => new Set([...CATALOGS[lang].keys()].map(baseKey));

/** Which base keys are pluralised (i.e. appear with a plural suffix) in a locale. */
function pluralBases(lang: Lang): Set<string> {
  const out = new Set<string>();
  for (const k of CATALOGS[lang].keys()) if (PLURAL_SUFFIX.test(k)) out.add(baseKey(k));
  return out;
}

/** The {{placeholder}} names used by one string. */
function placeholders(value: string): Set<string> {
  return new Set([...value.matchAll(/\{\{\s*([\w.]+)\s*\}\}/g)].map((m) => m[1]!));
}

const OTHERS = LANGS.filter((l) => l !== REFERENCE_LANG);

describe("resolveLang", () => {
  test("maps an exact locale code", () => {
    expect(resolveLang("de")).toBe("de");
    expect(resolveLang("ru")).toBe("ru");
  });

  test("maps a region-tagged code to its base language", () => {
    expect(resolveLang("ru-RU")).toBe("ru");
    expect(resolveLang("de-AT")).toBe("de");
    expect(resolveLang("en-GB")).toBe("en");
  });

  test("is case-insensitive", () => {
    expect(resolveLang("DE")).toBe("de");
    expect(resolveLang("ru_RU")).toBe("ru");
  });

  test("falls back to DEFAULT_LANG for unknown, empty, or absent codes", () => {
    expect(resolveLang("pt-BR")).toBe(DEFAULT_LANG);
    expect(resolveLang("")).toBe(DEFAULT_LANG);
    expect(resolveLang("   ")).toBe(DEFAULT_LANG);
    expect(resolveLang(undefined)).toBe(DEFAULT_LANG);
  });
});

describe("translatorFor", () => {
  test("renders a key in the requested language", () => {
    expect(translatorFor("ru")("errors.notOnboarded")).toContain("/start");
    expect(translatorFor("en")("errors.notOnboarded")).not.toBe("errors.notOnboarded");
  });

  test("different languages render different copy for the same key", () => {
    const ru = translatorFor("ru")("errors.notOnboarded");
    const en = translatorFor("en")("errors.notOnboarded");
    const de = translatorFor("de")("errors.notOnboarded");
    expect(new Set([ru, en, de]).size).toBe(3);
  });

  // getFixedT, not changeLanguage: two live translators must not interfere, because the bot
  // renders for concurrent users (sequentialize is per-user, not global).
  test("translators are independent — interleaved calls do not bleed languages", () => {
    const tru = translatorFor("ru");
    const tde = translatorFor("de");
    const ru1 = tru("errors.notOnboarded");
    const de1 = tde("errors.notOnboarded");
    const ru2 = tru("errors.notOnboarded");
    expect(ru2).toBe(ru1);
    expect(de1).not.toBe(ru1);
  });

  test("every registered locale resolves and renders", () => {
    for (const code of Object.keys(LOCALES)) {
      const t = translatorFor(code as keyof typeof LOCALES);
      expect(t("errors.notOnboarded")).not.toBe("errors.notOnboarded");
    }
  });
});

describe("missing keys", () => {
  // Without this, a typo'd key renders its own name to a user ("errors.notOnbarded").
  // Note the division of labour: this catches a key missing from EVERY locale; a key missing
  // from only some locales resolves via fallbackLng and is caught by the parity test instead.
  test("a key absent from every locale throws under test", () => {
    // @ts-expect-error — deliberately unknown key. That tsc rejects it here is itself the
    // proof that CustomTypeOptions is wired: unknown keys cannot reach production code.
    expect(() => translatorFor("en")("errors.thisKeyDoesNotExist")).toThrow(
      /errors\.thisKeyDoesNotExist/,
    );
  });
});

// These guards are what make JSON catalogs safe. i18next infers nothing from JSON string
// values (resolveJsonModule widens them to `string`), so nothing at the type level catches a
// missing key or a misspelt placeholder in one locale. These tests do.
describe("catalog parity", () => {
  test.each(OTHERS)("%s has exactly the reference locale's keys", (lang) => {
    const ref = baseKeys(REFERENCE_LANG);
    const got = baseKeys(lang);
    const missing = [...ref].filter((k) => !got.has(k)).sort();
    const extra = [...got].filter((k) => !ref.has(k)).sort();
    expect({ missing, extra }).toEqual({ missing: [], extra: [] });
  });

  test.each(OTHERS)("%s uses the same placeholders as the reference locale", (lang) => {
    const mismatches: Array<{ key: string; ref: string[]; got: string[] }> = [];
    for (const [refKey, refValue] of CATALOGS[REFERENCE_LANG]) {
      // compare against the same plural category, falling back to the base key
      const value = CATALOGS[lang].get(refKey) ?? CATALOGS[lang].get(baseKey(refKey));
      if (value === undefined) continue; // key parity test owns this failure
      const want = [...placeholders(refValue)].sort();
      const got = [...placeholders(value)].sort();
      if (want.join() !== got.join()) mismatches.push({ key: refKey, ref: want, got });
    }
    expect(mismatches).toEqual([]);
  });

  test("no catalog value is an empty string", () => {
    const empties: string[] = [];
    for (const lang of LANGS) {
      for (const [k, v] of CATALOGS[lang]) if (!v.trim()) empties.push(`${lang}:${k}`);
    }
    expect(empties).toEqual([]);
  });
});

describe("plural completeness", () => {
  // Categories come from Intl.PluralRules, never hardcoded: en/de need one+other, ru needs
  // one+few+many+other. A new locale gets its own requirements for free.
  test.each(LANGS)("%s carries every plural category its language requires", (lang) => {
    const required = new Intl.PluralRules(lang).resolvedOptions().pluralCategories;
    const problems: string[] = [];
    // a key is pluralised if ANY locale pluralises it — a locale may not opt out
    const bases = new Set(LANGS.flatMap((l) => [...pluralBases(l)]));
    for (const base of bases) {
      for (const cat of required) {
        if (!CATALOGS[lang].has(`${base}_${cat}`)) problems.push(`${base}_${cat}`);
      }
      if (CATALOGS[lang].has(base)) problems.push(`${base} (singular form shadows plurals)`);
    }
    expect(problems).toEqual([]);
  });
});
