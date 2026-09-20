// THE CHECK THAT KEEPS `LANGS_READY` HONEST IN THIS WORKSPACE.
//
// `LANGS_READY` is a claim: "the app can render itself end to end in these languages". Prose in a
// markdown file saying so goes stale the first time somebody adds a sentence. This does not — it
// walks every export of `index.ts` (which is `export *`, so there is no registry to forget) and
// fails by NAME when a `Localized<T>` table is missing a language the claim covers.
//
// Adding a table needs nothing here. Adding a sentence to one needs nothing here. Adding a
// LANGUAGE to `LANGS_READY` with a table unwritten fails, which is the whole point.

import { describe, expect, it } from "bun:test";
import * as shared from "./index.ts";
import { LANGS_READY, describeGaps, genderedRussian, localizedGaps } from "./lang.ts";
import { LANGS } from "./types.ts";
import { catalogArgs, catalogText } from "./i18n.ts";
import { lintCopy } from "./claims.ts";

describe("every Localized table in @eait/shared", () => {
  it("speaks every language LANGS_READY claims", () => {
    expect(describeGaps(localizedGaps(shared, LANGS_READY))).toEqual([]);
  });

  it("is actually being walked — the guard against a test that greens on an empty root", () => {
    // `localizedGaps` reports nothing for a root it found no tables in, which is indistinguishable
    // from a clean one. So: ask for a language nobody has written and assert it finds the tables.
    //
    // BY NAME, not by count. A table that stops being exported vanishes from the walk, and a check
    // that only counts stays green while the language it was hiding is lost — which is exactly how
    // `VERDICT_COPY`, the words on every meal card, sat outside this check unnoticed. Adding a
    // table needs no edit here; removing one from the walk fails.
    const found = new Set(localizedGaps(shared, ["en", "zz" as never]).map((g) => g.table.split(".")[0]));
    for (const table of [
      // `VERDICT_COPY` is NOT here any more, and its absence is the first sign of the migration:
      // those words live in `locales/*/messages.po` now and their completeness is `lingui compile
      // --strict`'s job. This list shrinks by one every time a table moves; when it is empty, this
      // test and `localizedGaps` go with it.
      "CHAT_COPY", "THREAD_COPY", "HEALTH_COPY",
      "NOTIFICATION_COPY", "EVENING_PRESCRIPTIONS", "ONBOARDING_CONTENT",
    ]) {
      expect(found.has(table), `${table} is not being walked — is it exported?`).toBe(true);
    }
  });
  it("never tells a Russian reader what gender they are", () => {
    // Russian past tense agrees with the speaker's gender and has no neutral form, so `что ты ел?`
    // greets every woman here as a man. It is invisible to a reviewer who does not read Russian:
    // the string is correct, idiomatic and complete. See `genderedRussian` in `shared/lang.ts`.
    expect(genderedRussian(shared)).toEqual([]);
  });

});

// ── The same two guards, on the copy that has left the tables ────────────────────────────────
//
// `localizedGaps` and `genderedRussian` walk `Localized<T>` tables. A table that migrates to a
// `.po` walks out of both of them, and NOTHING FAILS — the suite stays green while the guard
// stops guarding, which is the failure mode this repo keeps finding (`VERDICT_COPY` was not
// exported, so the check never saw the words on every meal card).
//
// So the catalogs are swept here by the same rules, and this file is what makes migrating a table
// safe rather than a quiet loss of coverage.

describe("the compiled catalogs, held to the rules the tables are held to", () => {
  it("is actually reading them — the guard against a sweep over nothing", () => {
    // Same argument as the walk above: an empty catalog and a clean one are indistinguishable to
    // an assertion that only says "no violations". So: the Russian catalog must have Russian in it.
    const ru = catalogText("ru");
    expect(Object.keys(ru).length, "the ru catalog is empty").toBeGreaterThan(0);
    expect(Object.values(ru).some((v) => /[а-яё]/i.test(v)), "no Cyrillic in the ru catalog")
      .toBe(true);
    // And every language has the same ids, which is `lingui compile --strict`'s job — asserted
    // here too because a catalog that silently lost a message is a screen that renders English.
    const ids = Object.keys(catalogText("en")).sort();
    for (const lang of LANGS) expect(Object.keys(catalogText(lang)).sort(), lang).toEqual(ids);
  });

  it("never tells a Russian reader what gender they are", () => {
    expect(genderedRussian(catalogText("ru"))).toEqual([]);
  });

  it("takes the same arguments in every language — `--strict` does not check this", () => {
    // MEASURED, NOT ASSUMED. Dropping `{plan}` from the German `/today` header compiles clean
    // under `lingui compile --strict` and renders "Heute: 1 kcal, 3 von 4 g Eiweiß" — a sentence
    // about a plan with no plan in it. `--strict` means every message is TRANSLATED, not that
    // every translation takes the same arguments.
    //
    // This is the worst shape a translation bug has: the sentence reads, parses, passes the
    // completeness check, and the only thing wrong is the number that is not there.
    const source = catalogArgs("en");
    for (const lang of LANGS) {
      if (lang === "en") continue;
      for (const [id, expected] of Object.entries(source)) {
        expect(catalogArgs(lang)[id] ?? [], `${lang}/${id}`).toEqual(expected);
      }
    }
  });

  it("carries no health claim, in any of the eight", () => {
    // The gate reads four families in all eight and the rest in English only — `claims.ts` says
    // which. Run over every language for the same reason `NOTIFICATION_COPY` is: these words are
    // public copy, and a translator working in a PO editor is further from review than an admin.
    for (const lang of LANGS) {
      expect(lintCopy(catalogText(lang)).map((v) => `${v.field}: ${v.pattern} "${v.span}"`), lang)
        .toEqual([]);
    }
  });
});
