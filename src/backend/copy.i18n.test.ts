// THE CHECK THAT KEEPS `LANGS_READY` HONEST IN THIS WORKSPACE.
//
// The backend has two copy tables of its own — `/start`'s and the Telegram connector's — because
// each says the same refusal in a form its own surface can use. The confirmation email had a
// third and no longer does: its words are in `src/shared/locales/*/messages.po`, and
// `shared/copy.i18n.test.ts` sweeps the catalogs with these same two rules. This list shrinks by
// one every time a table moves.
// `@eait/shared`'s tables are checked by `src/shared/copy.i18n.test.ts`; these are the ones that
// live here, and this is the file that fails by NAME when one of them is missing a language.
//
// Adding a table needs nothing here EXCEPT an import: unlike `shared`, this workspace has no
// `index.ts` re-exporting everything, so the list below is the registry. It is four lines long and
// the alternative — walking the filesystem at test time — reads worse than it protects.

import { describe, expect, it } from "bun:test";
import { LANGS_READY, describeGaps, genderedRussian, localizedGaps } from "@eait/shared";
import * as page from "./web/copy.ts";
import * as telegram from "./telegram/copy.ts";

const TABLES = { page, telegram };

describe("every Localized table the backend owns", () => {
  it("speaks every language LANGS_READY claims", () => {
    expect(describeGaps(localizedGaps(TABLES, LANGS_READY))).toEqual([]);
  });

  it("is actually being walked — the guard against a green on an empty root", () => {
    // `localizedGaps` reports nothing for a root it found no tables in, which is indistinguishable
    // from a clean one. Asking for a language nobody has written proves it found them, and naming
    // them proves it found both rather than one.
    const found = new Set(localizedGaps(TABLES, ["en", "zz" as never]).map((g) => g.table.split(".")[0]));
    expect([...found].sort()).toEqual(["page", "telegram"]);
  });
  it("never tells a Russian reader what gender they are", () => {
    // Russian past tense agrees with the speaker's gender and has no neutral form, so `что ты ел?`
    // greets every woman here as a man. It is invisible to a reviewer who does not read Russian:
    // the string is correct, idiomatic and complete. See `genderedRussian` in `shared/lang.ts`.
    expect(genderedRussian(TABLES)).toEqual([]);
  });

});
