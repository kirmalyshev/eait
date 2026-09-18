// The same check as `shared/copy.i18n.test.ts` and `backend/copy.i18n.test.ts`, for this client's
// one table. Under `server/` because that is the half of the workspace with bun's types.

import { describe, expect, it } from "bun:test";
import { LANGS_READY, describeGaps, localizedGaps } from "@eait/shared";
import * as copy from "../copy.ts";

describe("every Localized table the web client owns", () => {
  it("speaks every language LANGS_READY claims", () => {
    expect(describeGaps(localizedGaps(copy, LANGS_READY))).toEqual([]);
  });

  it("is actually being walked", () => {
    expect(localizedGaps(copy, ["en", "zz" as never]).map((g) => g.table)).toEqual(["WEB_COPY"]);
  });
});
