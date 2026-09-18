// The same check as `shared/copy.i18n.test.ts` and `backend/copy.i18n.test.ts`, for this client's
// one table. Under `server/` because that is the half of the workspace with bun's types.

import { describe, expect, it } from "bun:test";
import { LANGS_READY, describeGaps, genderedRussian, localizedGaps } from "@eait/shared";
import * as copy from "../copy.ts";

describe("every Localized table the web client owns", () => {
  it("speaks every language LANGS_READY claims", () => {
    expect(describeGaps(localizedGaps(copy, LANGS_READY))).toEqual([]);
  });

  it("is actually being walked", () => {
    expect(localizedGaps(copy, ["en", "zz" as never]).map((g) => g.table)).toEqual(["WEB_COPY"]);
  });
  it("never tells a Russian reader what gender they are", () => {
    // Russian past tense agrees with the speaker's gender and has no neutral form, so `что ты ел?`
    // greets every woman here as a man. It is invisible to a reviewer who does not read Russian:
    // the string is correct, idiomatic and complete. See `genderedRussian` in `shared/lang.ts`.
    expect(genderedRussian(copy)).toEqual([]);
  });

});
