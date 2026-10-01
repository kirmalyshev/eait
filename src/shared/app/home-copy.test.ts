// Home's words: the surface copy table for W4 (#91) and M4 (ieat-app#923). Completeness in all
// eight languages is `localizedGaps`' job in `copy.i18n.test.ts` — this file holds the table's own
// contract: the keys exist, the placeholders travel whole, and the board English is pinned.

import { describe, expect, it } from "bun:test";
import { lintCopy } from "../claims.ts";
import { LANGS, type Lang } from "../types.ts";
import { HOME_COPY, homeCopyFor } from "./home-copy.ts";

/** Every string in a `HomeCopy`, keyed well enough to name — `lintCopy` takes a flat record. */
function flat(node: unknown, at = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === "string") {
    out[at] = node;
    return out;
  }
  if (typeof node === "object" && node !== null) {
    const keys = Object.keys(node);
    // A CountForms node is one placeholder-bearing sentence whose SHAPES are the language's own —
    // Russian needs `few`/`many`, Vietnamese only `other`. The completeness invariant is `other`,
    // `countText`'s fallback; the rest are the pluralisation, not a gap.
    const FORMS = new Set(["one", "few", "many", "other"]);
    if (keys.every((k) => FORMS.has(k)) && keys.includes("other")) {
      out[`${at}.other`] = (node as { other: string }).other;
      return out;
    }
    for (const [k, v] of Object.entries(node)) flat(v, at === "" ? k : `${at}.${k}`, out);
  }
  return out;
}

const args = (s: string): string[] => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe("HOME_COPY", () => {
  it("has every key in every language, with English's placeholders intact", () => {
    const en = flat(HOME_COPY.en);
    for (const lang of LANGS) {
      const copy = flat(HOME_COPY[lang]!);
      expect(Object.keys(copy).sort(), lang).toEqual(Object.keys(en).sort());
      for (const [key, text] of Object.entries(copy)) {
        expect(text.length, `${lang}.${key}`).toBeGreaterThan(0);
        expect(args(text), `${lang}.${key}`).toEqual(args(en[key]!));
      }
    }
  });

  it("pins the boards' English", () => {
    const en = homeCopyFor("en" as Lang);
    // today.html — the layout board, both clients
    expect(en.kcalLeft).toBe("kcal left");
    expect(en.macros.protein.left).toBe("Protein left");
    expect(en.macros.carbs.left).toBe("Carbs left");
    expect(en.macros.fat.left).toBe("Fat left");
    expect(en.recentlyUploaded).toBe("Recent");
    // the compact cards — today-empty, today-picker, today-logging, states-diary-failed
    expect(en.kcalLeftDetail).toBe("kcal left · {eaten} of {plan}");
    expect(en.macros.protein.ofTarget).toBe("of {target} protein");
    expect(en.macros.satFat.ofTarget).toBe("of {target} sat fat");
    expect(en.macros.carbs.name).toBe("carbs");
    // sodium counts in mg — the board's "sodium 835 mg", never a gram
    expect(en.macros.sodium.chip).toBe("sodium {n} mg");
    expect(en.milligrams).toBe("{n} mg");
    // today-past — the over day
    expect(en.kcalOverDetail).toBe("kcal over · {eaten} of {plan}");
    // the empty and the failed days
    expect(en.nothingLogged).toBe("Nothing logged yet.");
    expect(en.diaryFailed).toBe("Couldn't load your diary.");
    expect(en.tryAgain).toBe("Try again");
    // web only: the upload CTA and the in-diary proposal
    expect(en.webUploadPhoto).toBe("Upload a photo");
    expect(en.webComposerPlaceholder).toBe("Tell Spud what you ate, or drop a photo");
    expect(en.webProposalLead.replace("{day}", en.todayWord)).toBe("Logging to today — look right?");
    expect(en.webLogIt).toBe("Log it");
    expect(en.webProposalNo).toBe("No");
    // phone only: the title, the streak chip's accessible name, the month sheet
    expect(en.phoneToday).toBe("Today");
    expect(en.phoneStreakAria.replace("{n}", "4")).toBe("4-day streak");
    expect(en.phoneGoToDay).toBe("Go to {day}");
  });

  it("is not English wearing another language's name", () => {
    // The boards' words actually differ per language — a copied English string is the failure
    // `localizedGaps` cannot see, so the headline keys are pinned per language here.
    expect(homeCopyFor("de" as Lang).nothingLogged).not.toBe(HOME_COPY.en.nothingLogged);
    expect(homeCopyFor("ru" as Lang).diaryFailed).toMatch(/[а-яё]/i);
    expect(homeCopyFor("ru" as Lang).grams.replace("{n}", "5")).toBe("5 г");
    expect(homeCopyFor("vi" as Lang).kcalLeft).not.toBe(HOME_COPY.en.kcalLeft);
  });

  it("passes the claims sweep in all eight", () => {
    for (const lang of LANGS) {
      expect(lintCopy(flat(HOME_COPY[lang]!)).map((v) => `${v.field}: ${v.pattern} "${v.span}"`), lang)
        .toEqual([]);
    }
  });
});
