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
