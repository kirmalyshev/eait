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
import { LANGS_READY, describeGaps, localizedGaps } from "./lang.ts";

describe("every Localized table in @eait/shared", () => {
  it("speaks every language LANGS_READY claims", () => {
    expect(describeGaps(localizedGaps(shared, LANGS_READY))).toEqual([]);
  });

  it("is actually being walked — the guard against a test that greens on an empty root", () => {
    // `localizedGaps` reports nothing for a root it found no tables in, which is indistinguishable
    // from a clean one. So: ask for a language nobody has written and assert it finds the tables.
    expect(localizedGaps(shared, ["en", "zz" as never]).length).toBeGreaterThan(0);
  });
});
