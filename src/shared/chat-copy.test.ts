import { describe, expect, it } from "bun:test";
import { LANGS } from "./types.ts";
import { streamCopyFor, threadCopyFor } from "./chat-copy.ts";
import {
  SCRIPTED_LINES, capVerdictLines, firstVerdictLines,
  scriptedLine, startersFor, type ScriptedLineId,
} from "./chat.ts";

const TARGETS = { kcal: 1724, protein_g: 104, carbs_g: 190, fat_g: 55, satfat_g: 13, sodium_mg: 2000 };
const EATEN = { kcal: 1168, protein_g: 74.8, satfat_g: 8, sodium_mg: 1200 };

describe("the thread in eight languages", () => {
  it("says every scripted line, with nothing left unfilled", () => {
    for (const lang of LANGS) {
      for (const id of Object.keys(SCRIPTED_LINES) as ScriptedLineId[]) {
        const said = scriptedLine(id, lang, id === "trial-started" ? { price: "4,99 €" } : {});
        expect(said.length, `${lang}.${id}`).toBeGreaterThan(0);
        expect(said, `${lang}.${id}`).not.toMatch(/\{\w+\}/);
      }
      expect(scriptedLine("trial-started", lang, { price: "4,99 €" }), lang).toContain("4,99 €");
    }
  });

  it("offers three starters, in every language", () => {
    for (const lang of LANGS) {
      expect(startersFor(null, lang).length, lang).toBe(3);
      for (const s of startersFor(null, lang)) expect(s.length, lang).toBeGreaterThan(0);
    }
  });

  it("says the first verdict in every language and on every branch", () => {
    for (const lang of LANGS) {
      const said: string[] = [];
      for (const goal of ["gain", "lose", "maintain"] as const) {
        for (const via of ["photo", "text"] as const) {
          for (const confidence of ["high", "low"] as const) {
            for (const eaten of [EATEN, { kcal: 2100, protein_g: 120, satfat_g: 12, sodium_mg: 1900 }]) {
              said.push(...firstVerdictLines({
                goal, targets: TARGETS, meal: { kcal: 520, satfat_g: 8, sodium_mg: 1200, confidence }, eatenToday: eaten, via,
                verdicts: { weight: "good", kidneys: "bad", ldl: "warn" },
                caption: "two eggs and toast",
              }, lang));
            }
          }
        }
      }
      for (const [i, line] of said.entries()) {
        expect(line, `${lang}[${i}]`).toBeTruthy();
        expect(line, `${lang}[${i}]`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("writes its figures in the reader's grouping, and rounds them", () => {
    // The thread's figures are estimates from a photo: whole numbers, in the reader's own
    // separators. 74.8g of saturated fat is a precision the analyzer does not have.
    const line = (lang: (typeof LANGS)[number]) => capVerdictLines({
      meal: { satfat_g: 74.8, sodium_mg: 0 }, targets: TARGETS,
      verdicts: { ldl: "bad" }, eatenToday: { satfat_g: 74.8, sodium_mg: 0 },
    }, lang)[0]!;
    expect(line("en")).toContain("75");
    expect(line("en")).toContain("13");
    expect(line("en")).not.toContain("74.8");
    expect(line("de")).toContain("75");
  });

  it("says something DIFFERENT in each of the eight, rather than eight copies of a fallback", () => {
    // WHAT THIS CATCHES, now that `i18n:check` runs `extract` and `compile --strict`. An id
    // missing from a catalog is caught by `--strict`, and an id missing from every catalog is
    // caught by the extract in front of it. What neither can see is a TRANSLATION THAT IS THE
    // ENGLISH — a translator pasting the source string, or a `msgstr` filled from the `msgid` by
    // a tool. That renders a complete, correct English sentence and passes every gate and every
    // other assertion in this file. This is the one that would fail.
    for (const sample of [
      (l: (typeof LANGS)[number]) => scriptedLine("camera-closed", l, {}),
      (l: (typeof LANGS)[number]) => threadCopyFor(l).firstVerdict.headline.caloriesHigh,
      (l: (typeof LANGS)[number]) => threadCopyFor(l).firstVerdict.firstIn({ kcal: "612" }),
      (l: (typeof LANGS)[number]) => streamCopyFor(l).reading,
      (l: (typeof LANGS)[number]) => startersFor(null, l)[0]!,
    ]) {
      expect(new Set(LANGS.map(sample)).size).toBe(LANGS.length);
    }
  });

  it("gives every language the same scripted ids — they are a contract between two binaries", () => {
    for (const lang of LANGS) {
      expect(Object.keys(threadCopyFor(lang).scripted).sort(), lang)
        .toEqual(Object.keys(SCRIPTED_LINES).sort());
    }
  });
});
