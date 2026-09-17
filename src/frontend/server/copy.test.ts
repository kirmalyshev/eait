// The claims gate over the sentences the browser client writes for itself.
//
// Under `server/` because this directory is the half of the workspace with bun's types; the file
// under test is browser code and imports nothing from bun. Same rule as `backend/web/page.ts`
// and its `PAGE_COPY`: what is gated is OUR sentences, not the rendered page.

import { describe, expect, it } from "bun:test";
import { lintCopy } from "@eait/shared";
import { COPY } from "../copy.ts";

describe("the copy the web client writes", () => {
  it("passes the claims gate", () => {
    expect(lintCopy({ ...COPY })).toEqual([]);
  });
});
