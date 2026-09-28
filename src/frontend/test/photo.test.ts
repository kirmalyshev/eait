// `photo.ts`'s pure half — the frame a picked file is drawn into before upload.
//
// IN `test/` FOR THE REASON `client.test.ts` GIVES: the canvas half of `photo.ts` is browser code,
// but `fitWithin` has no DOM in it, and this is the tsconfig with bun's types. What is pinned here
// is the one number both clients must agree on — the web edge equals the app's `UPLOAD_EDGE`
// (`src/mobile/lib/capture.ts`), because both feed the same billed analysis.

import { describe, expect, it } from "bun:test";
import { UPLOAD_EDGE, fitWithin } from "../photo.ts";

describe("fitWithin", () => {
  it("leaves an already-small image untouched", () => {
    expect(fitWithin(576, 768, UPLOAD_EDGE)).toEqual({ width: 576, height: 768 });
    expect(fitWithin(400, 300, UPLOAD_EDGE)).toEqual({ width: 400, height: 300 });
  });

  it("caps the long edge and keeps the aspect", () => {
    expect(fitWithin(960, 1280, UPLOAD_EDGE)).toEqual({ width: 576, height: 768 });
    expect(fitWithin(4032, 3024, UPLOAD_EDGE)).toEqual({ width: 768, height: 576 });
    expect(fitWithin(3024, 4032, UPLOAD_EDGE)).toEqual({ width: 576, height: 768 });
  });

  it("never enlarges", () => {
    const { width, height } = fitWithin(100, 50, UPLOAD_EDGE);
    expect(Math.max(width, height)).toBe(100);
  });
});
