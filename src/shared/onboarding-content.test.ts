import { describe, expect, it } from "bun:test";
import { LANGS } from "./types.ts";
import { LANG_LABEL } from "./lang.ts";
import {
  DEFAULT_ONBOARDING_CONTENT, ONBOARDING_SCREENS, SCREEN_FIELDS, SCREEN_OPTIONS,
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
    for (const lang of LANGS) {
      for (const screen of onboardingContentFor(lang).screens) {
        for (const key of SCREEN_OPTIONS[screen.id] ?? []) {
          expect(screen.options?.[key]?.label.trim(), `${lang}.${screen.id}.${key}`).toBeTruthy();
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
