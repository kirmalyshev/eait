// The Telegram connector's words, in eight languages, after they left the table.
//
// WHY THIS FILE EXISTS NOW. `TELEGRAM_COPY` was a `Localized<T>` and its eight-language coverage
// came from `localizedGaps` walking the backend's table registry. The words are in the catalogs
// now, so that walk no longer sees them — and a migration that removes a guard without replacing
// it is a migration that loses coverage silently, which is the one thing `i18n.ts` says must not
// happen. `shared/copy.i18n.test.ts` covers the catalogs for gendered Russian, health claims and
// argument parity; these are the things that are true of THIS surface in particular.

import { describe, expect, it } from "bun:test";
import { LANGS, lintCopy } from "@eait/shared";
import { telegramCopyFor } from "./copy.ts";

const FIGURES = { eaten: "1 100", plan: "1 900", protein: "82", proteinTarget: "120" };

describe("the bot's words in eight languages", () => {
  it("says something in every field, in every language", () => {
    for (const lang of LANGS) {
      const copy = telegramCopyFor(lang);
      for (const [key, value] of Object.entries(copy)) {
        if (typeof value === "string") expect(value.trim(), `${lang}.${key}`).not.toBe("");
        else if (typeof value === "object") {
          for (const [k, v] of Object.entries(value as Record<string, string>)) {
            expect(v.trim(), `${lang}.${key}.${k}`).not.toBe("");
          }
        }
      }
    }
  });

  it("says something DIFFERENT in each, rather than eight copies of a fallback", () => {
    // WHAT THIS CATCHES, now that `i18n:check` runs `extract` and `compile --strict`. An id
    // missing from a catalog is caught by `--strict`, and an id missing from every catalog is
    // caught by the extract in front of it. What neither can see is a TRANSLATION THAT IS THE
    // ENGLISH — a translator pasting the source string, or a `msgstr` filled from the `msgid` by
    // a tool. That renders a complete, correct English sentence and passes every gate and every
    // other assertion in this file. This is the one that would fail.
    for (const field of ["stranger", "connectedTail", "notYours", "logged", "failed"] as const) {
      const said = LANGS.map((l) => telegramCopyFor(l)[field]);
      expect(new Set(said).size, `${field} is not translated in all eight`).toBe(LANGS.length);
    }
    const refusals = LANGS.map((l) => telegramCopyFor(l).refusals["not-onboarded"]);
    expect(new Set(refusals).size, "not-onboarded is not translated in all eight").toBe(LANGS.length);
  });

  it("fills both templates in every language, with nothing left over", () => {
    // The two fields that take arguments. A translation that drops one is caught by
    // `catalogArgs` in `shared/copy.i18n.test.ts`; this proves the rendered sentence carries the
    // figures and no `{brace}` reaches a chat.
    for (const lang of LANGS) {
      const copy = telegramCopyFor(lang);
      const head = copy.todayHead(FIGURES);
      for (const value of Object.values(FIGURES)) expect(head, `${lang}: ${value}`).toContain(value);
      expect(head, lang).not.toMatch(/\{\w+\}/);

      const dated = copy.proposalLeadDated({ date: "2026-09-20" });
      expect(dated, lang).toContain("2026-09-20");
      expect(dated, lang).not.toMatch(/\{\w+\}/);
    }
  });

  it("passes the claims gate in English, which is the language the gate reads in full", () => {
    const copy = telegramCopyFor("en");
    const fields: Record<string, string> = { ...copy.refusals, ...copy.macros };
    for (const [k, v] of Object.entries(copy)) if (typeof v === "string") fields[k] = v;
    fields["todayHead"] = copy.todayHead(FIGURES);
    fields["proposalLeadDated"] = copy.proposalLeadDated({ date: "2026-09-20" });
    expect(lintCopy(fields).map((v) => `${v.field}: ${v.pattern} "${v.span}"`)).toEqual([]);
  });
});
