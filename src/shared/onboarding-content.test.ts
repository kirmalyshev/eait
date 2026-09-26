import { describe, expect, it } from "bun:test";
import { LANGS, type Lang } from "./types.ts";
import { LANG_LABEL } from "./lang.ts";
import {
  DEFAULT_ONBOARDING_CONTENT, ONBOARDING_SCREENS, SCREEN_FIELDS, optionLabel, screenOptionValues,
  validateOnboardingContent,
} from "./onboarding.ts";
import { ONBOARDING_CONTENT, onboardingContentFor, usableContentFor } from "./onboarding-content.ts";

// Onboarding is the one flow where a missing sentence is not a wart: `usableContent` drops a whole
// revision that is missing an ask, because a question with nothing to ask it with is a conversation
// that stops. So a translation of it is checked the way the English is — through the validator that
// guards the admin's write, in every language.

describe("every language's onboarding content", () => {
  it("is the same editorial revision, so one funnel number covers all eight", () => {
    for (const lang of LANGS) {
      expect(onboardingContentFor(lang).version, lang).toBe(DEFAULT_ONBOARDING_CONTENT.version);
    }
  });

  it("passes the validator the admin's own saves go through", () => {
    for (const lang of LANGS) {
      const result = validateOnboardingContent(onboardingContentFor(lang));
      // Printed rather than merely asserted: a failure here should say WHICH sentence is wrong.
      if (!result.ok) throw new Error(`${lang} (${LANG_LABEL[lang]}):\n${result.errors.join("\n")}`);
      expect(result.ok).toBe(true);
    }
  });

  it("has a sentence for every question, in every language", () => {
    for (const lang of LANGS) {
      for (const screen of onboardingContentFor(lang).screens) {
        for (const field of SCREEN_FIELDS[screen.id]) {
          expect(screen.asks[field]?.lines?.length, `${lang}.${screen.id}.${field}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("labels every option in every language — a blank chip is a tappable hole", () => {
    // THROUGH THE SAME FALLBACK THE RENDERER USES, not against the stored content, because the
    // content is no longer the only source: a country's name is CLDR's (`optionLabel`), and
    // asserting the content carries one would demand fifteen countries in eight languages be
    // typed by hand. What must hold is that the chip has words on it, wherever they came from.
    for (const lang of LANGS) {
      for (const screen of onboardingContentFor(lang).screens) {
        for (const key of screenOptionValues(screen.id, lang)) {
          const label = screen.options?.[key]?.label ?? optionLabel(screen.id, key, lang);
          expect(label.trim(), `${lang}.${screen.id}.${key}`).toBeTruthy();
          // And it is a NAME, not the code falling through. `optionLabel` returns the bare value
          // when it has nothing, which on a chip looks like a label and is not one.
          expect(label.trim(), `${lang}.${screen.id}.${key} rendered its own code`).not.toBe(key);
        }
      }
    }
  });

  it("keeps every placeholder the composer fills — a dropped one renders as a hole in a number", () => {
    // `{floor}`, `{target}`, `{month}`, `{share}` and `{loseTail}` are substituted by code. A
    // translator who drops one produces a sentence with a figure missing and no error anywhere.
    for (const lang of LANGS) {
      const c = onboardingContentFor(lang);
      expect(c.building.floorTitle, lang).toContain("{floor}");
      expect(c.summary.projection, lang).toContain("{target}");
      expect(c.summary.projection, lang).toContain("{month}");
      expect(c.summary.capNote, lang).toContain("{share}");
      const target = c.screens.find((s) => s.id === "target")!;
      expect(target.asks.target_weight_kg!.lines.join(" "), lang).toContain("{loseTail}");
    }
  });

  it("introduces no placeholder nothing fills", () => {
    for (const lang of LANGS) {
      const known = new Set(["floor", "target", "month", "share", "loseTail", "weeks"]);
      for (const [at, text] of Object.entries(flatten(onboardingContentFor(lang)))) {
        for (const m of text.matchAll(/\{(\w+)\}/g)) {
          expect(known.has(m[1]!), `${lang}.${at} uses {${m[1]}}`).toBe(true);
        }
      }
    }
  });

  it("says the same screens in the same order, so the funnel rows line up", () => {
    for (const lang of LANGS) {
      expect(onboardingContentFor(lang).screens.map((s) => s.id), lang).toEqual([...ONBOARDING_SCREENS]);
    }
  });

  it("is English for a language nobody has written, never undefined", () => {
    expect(onboardingContentFor("en")).toBe(ONBOARDING_CONTENT.en);
    expect(DEFAULT_ONBOARDING_CONTENT).toBe(ONBOARDING_CONTENT.en);
  });

  it("says nothing that is false where the line now stands (#50)", () => {
    // The web asks for a sign-in BEFORE the first question, so "No account needed to start" was
    // false there, and one content tree cannot say it on the phone only. The restrictions ask's
    // free-text sentence went with it — the web's chips screen has no text field.
    const welcomeClaim: Record<Lang, string> = {
      en: "No account needed to start",
      fr: "Pas besoin de compte pour commencer",
      de: "Zum Starten brauchst du kein Konto",
      it: "Per iniziare non serve un account",
      es: "No hace falta cuenta para empezar",
      vi: "Bắt đầu thì không cần tài khoản",
      id: "Mulai tanpa perlu akun",
      ru: "Чтобы начать, аккаунт не нужен",
    };
    const freeText = /free text|texte libre|Freitext|testo libero|texto libre|Viết tự do|Teks bebas|Свободный текст/i;
    for (const lang of LANGS) {
      const c = onboardingContentFor(lang);
      expect(c.welcome.lines[2], lang).not.toContain(welcomeClaim[lang]!);
      expect(c.welcome.lines.join(" "), lang).not.toContain(welcomeClaim[lang]!);
      const restrictions = c.screens.find((s) => s.id === "restrictions")!;
      expect(restrictions.asks.restrictions!.lines.join(" "), lang).not.toMatch(freeText);
    }
  });
});

describe("usableContentFor", () => {
  it("falls back to THIS language's compiled-in copy, not to English", () => {
    // The whole point of the per-language fallback. A German whose host has never saved German
    // copy gets the German the binary ships with — falling back to English here would be the
    // "half the screens are English" failure #358 exists to prevent.
    expect(usableContentFor("de", null)).toBe(ONBOARDING_CONTENT.de!);
    expect(usableContentFor("de", { junk: true })).toBe(ONBOARDING_CONTENT.de!);
  });

  it("reads a stored revision for the language it was saved under", () => {
    const stored = structuredClone(ONBOARDING_CONTENT.de!);
    stored.version = 99;
    expect(usableContentFor("de", { de: stored }).version).toBe(99);
    // And the languages beside it are untouched by that save.
    expect(usableContentFor("fr", { de: stored })).toBe(ONBOARDING_CONTENT.fr!);
  });

  it("reads a LEGACY row — a bare OnboardingContent — as English and nothing else", () => {
    // Every host that pressed Save before this branch has one. It was English, because English was
    // all there was, and reading it as the German revision would serve English to Germans.
    const legacy = structuredClone(DEFAULT_ONBOARDING_CONTENT);
    legacy.version = 42;
    expect(usableContentFor("en", legacy).version).toBe(42);
    expect(usableContentFor("de", legacy)).toBe(ONBOARDING_CONTENT.de!);
  });
});

/** Every string in a content tree, keyed well enough to name in a failure. */
function flatten(node: unknown, at = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === "string") { out[at] = node; return out; }
  if (Array.isArray(node)) { node.forEach((v, i) => flatten(v, `${at}[${i}]`, out)); return out; }
  if (typeof node === "object" && node !== null) {
    for (const [k, v] of Object.entries(node)) flatten(v, at === "" ? k : `${at}.${k}`, out);
  }
  return out;
}
