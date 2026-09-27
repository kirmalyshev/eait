// The logging surface's words (#92): pick/drop, the scan, the logged card, the rough-guess
// options, the first verdict, and the failed/unknown/refused states — for BOTH clients, so
// `web` and `phone` hold the strings only one of them draws. Completeness in all eight
// languages is `localizedGaps`' job in `copy.i18n.test.ts`; this file holds the table's own
// contract: the keys exist, every template keeps its placeholders, the English is the boards'
// words verbatim, and nothing carries a claim the linter refuses.

import { describe, expect, it } from "bun:test";
import { LANGS } from "../types.ts";
import { lintCopy } from "../claims.ts";
import { LOG_COPY, logCopyFor } from "./log-copy.ts";

const SHARED = [
  "notePlaceholder", "reading", "checking", "close", "logged", "today", "waitingToSend",
  "noFood", "tryAnotherPhoto", "roughGuess", "roughAsk", "roughAbout", "roughHalf", "roughMore",
  "edit", "agree", "firstVerdict", "correct", "continueCta", "analysisFailedNote",
  "unknownTitle", "unknownNote", "verdictDetail", "dayEaten", "dayLeft",
] as const;
const WEB = [
  "title", "dropHint", "chooseFile", "analyzeCta", "chatInstead", "fromPhoto",
  "failedTitle", "sendAgain",
] as const;
const PHONE = [
  "cameraTitle", "cameraHint", "shotCount", "analyzeCta", "pickTitle", "pickHint",
  "cameraOffTitle", "cameraOffNote", "pickLibrary", "refusedTitle", "failedTitle",
  "tryAgain", "formatTitle", "formatNote",
] as const;

// Every placeholder the boards' numbers ride on, filled the way a renderer fills them.
const FILL: Record<string, string> = {
  item: "rice", grams: "150", n: "1", total: "3",
  noun: "Saturated fat", amount: "5", target: "13", coach: "Gabie",
  eaten: "852", plan: "1,434", left: "582",
};

describe("LOG_COPY", () => {
  it("has every key in every language", () => {
    for (const lang of LANGS) {
      const copy = LOG_COPY[lang];
      expect(copy, lang).toBeDefined();
      for (const key of SHARED) expect(copy![key].length, `${lang}.${key}`).toBeGreaterThan(0);
      for (const key of WEB) expect(copy!.web[key].length, `${lang}.web.${key}`).toBeGreaterThan(0);
      for (const key of PHONE) expect(copy!.phone[key].length, `${lang}.phone.${key}`).toBeGreaterThan(0);
    }
  });

  it("keeps every template's placeholders in every language", () => {
    // A translation that drops `{grams}` renders "More like  g" and nothing anywhere says so.
    const TEMPLATED: Array<[string, string[]]> = [
      ["roughAsk", ["{item}", "{grams}"]],
      ["roughMore", ["{grams}"]],
      ["verdictDetail", ["{noun}", "{amount}", "{target}"]],
      ["dayEaten", ["{eaten}", "{plan}"]],
      ["dayLeft", ["{left}"]],
    ];
    for (const lang of LANGS) {
      const copy = LOG_COPY[lang]!;
      for (const [key, phs] of TEMPLATED) {
        for (const ph of phs) expect(copy[key as never] as string, `${lang}.${key}`).toContain(ph);
      }
      expect(copy.phone.shotCount, `${lang}.phone.shotCount`).toContain("{n}");
      expect(copy.phone.shotCount, `${lang}.phone.shotCount`).toContain("{total}");
      // The coach is `{coach}`, never a literal name — S9 owns what fills it.
      expect(copy.web.chatInstead, `${lang}.web.chatInstead`).toContain("{coach}");
      expect(copy.web.chatInstead, `${lang}.web.chatInstead`).not.toContain("Gabie");
    }
  });

  it("draws the boards' words in English", () => {
    const en = logCopyFor("en");
    expect(en.reading).toBe("Reading the plate. One moment for the numbers.");
    expect(en.checking).toBe("Checking the numbers");
    expect(en.noFood).toBe("No food in that one");
    expect(en.tryAnotherPhoto).toBe("Try another photo");
    expect(en.roughGuess).toBe("Rough guess");
    expect(en.roughAbout).toBe("About that");
    expect(en.roughHalf).toBe("Half that");
    expect(en.firstVerdict).toBe("Your first verdict");
    expect(en.correct).toBe("Correct");
    expect(en.continueCta).toBe("Continue");
    expect(en.analysisFailedNote).toBe("Nothing was logged. Your photo is kept.");
    expect(en.unknownTitle).toBe("That didn't finish cleanly.");
    expect(en.unknownNote).toBe("Kept, and re-sent on its own — sending again is safe.");
    expect(en.waitingToSend).toBe("Waiting to send");
    expect(en.web.title).toBe("A photo of the meal");
    expect(en.web.dropHint).toBe("Drop a photo here");
    expect(en.web.chooseFile).toBe("or choose a file · JPEG, PNG or WebP");
    expect(en.web.chatInstead).toBe("or tell {coach} about it in Chat");
    expect(en.web.fromPhoto).toBe("from a photo");
    expect(en.web.sendAgain).toBe("Send it again");
    expect(en.phone.cameraTitle).toBe("One meal, any angle");
    expect(en.phone.pickTitle).toBe("Pick a photo");
    expect(en.phone.cameraOffTitle).toBe("Camera access is off");
    expect(en.phone.pickLibrary).toBe("Pick from library instead");
    expect(en.phone.refusedTitle).toBe("Couldn’t log that");
    expect(en.phone.tryAgain).toBe("Try again");
    expect(en.phone.formatTitle).toBe("That photo format can’t be read");
    expect(en.phone.formatNote).toBe("JPEG, PNG or WebP — or photograph the plate instead.");
  });

  it("keeps the boards' own differences between the two clients", () => {
    // The boards spell the CTA two ways and punctuate the failure title two ways; the table
    // repeats the design rather than smoothing it over.
    const en = logCopyFor("en");
    expect(en.web.analyzeCta).toBe("Analyse");
    expect(en.phone.analyzeCta).toBe("Analyze");
    expect(en.web.failedTitle).toBe("The analysis didn't come back.");
    expect(en.phone.failedTitle).toBe("The analysis didn’t come back");
  });

  it("carries no claim the linter would refuse — every template filled, every language", () => {
    const filled = (s: string) =>
      s.replace(/\{(\w+)\}/g, (_, k: string) => FILL[k] ?? "X");
    for (const lang of LANGS) {
      const fields: Record<string, string> = {};
      for (const [at, text] of Object.entries(flatten(logCopyFor(lang)))) {
        fields[`LOG_COPY.${at}`] = filled(text);
      }
      const violations = lintCopy(fields).map((v) => `${v.field}: ${v.pattern} "${v.span}"`);
      expect(violations, lang).toEqual([]);
    }
  });
});

function flatten(node: unknown, at = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === "string") { out[at] = node; return out; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) flatten(v, at ? `${at}.${k}` : k, out);
  }
  return out;
}
