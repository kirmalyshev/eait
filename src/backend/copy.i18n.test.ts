// THE CHECK THAT KEEPS `LANGS_READY` HONEST IN THIS WORKSPACE.
//
// The backend has three copy tables of its own — `/start`'s, the Telegram connector's, and the
// confirmation email's — because each says the same refusal in a form its own surface can use.
// `@eait/shared`'s tables are checked by `src/shared/copy.i18n.test.ts`; these are the ones that
// live here, and this is the file that fails by NAME when one of them is missing a language.
//
// Adding a table needs nothing here EXCEPT an import: unlike `shared`, this workspace has no
// `index.ts` re-exporting everything, so the list below is the registry. It is four lines long and
// the alternative — walking the filesystem at test time — reads worse than it protects.

import { describe, expect, it } from "bun:test";
import { LANGS_READY, describeGaps, localizedGaps } from "@eait/shared";
import * as page from "./web/copy.ts";
import * as telegram from "./telegram/copy.ts";
import * as mail from "./mail/port.ts";

const TABLES = { page, telegram, mail };

describe("every Localized table the backend owns", () => {
  it("speaks every language LANGS_READY claims", () => {
    expect(describeGaps(localizedGaps(TABLES, LANGS_READY))).toEqual([]);
  });

  it("is actually being walked — the guard against a green on an empty root", () => {
    // `localizedGaps` reports nothing for a root it found no tables in, which is indistinguishable
    // from a clean one. Asking for a language nobody has written proves it found them, and naming
    // the three proves it found all three rather than one.
    const found = new Set(localizedGaps(TABLES, ["en", "zz" as never]).map((g) => g.table.split(".")[0]));
    expect([...found].sort()).toEqual(["mail", "page", "telegram"]);
  });
});
