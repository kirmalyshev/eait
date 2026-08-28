// The canned analyzer is what `--demo`, the seeder and every screenshot render, so a defect in its
// fixtures is a defect in every picture of this product.

import { expect, test } from "bun:test";
import { explainTargets } from "@ieat/shared";
import type { Profile } from "@ieat/shared";
import { demoPorts } from "./demo.ts";

// The canned analyzer reads only the caption and the bytes, but `PhotoInput` is the real port's
// shape and a test that invented a narrower one would stop compiling against the port it checks.
const PROFILE = {
  lang: "en", goal: "lose", sex: "male", birth_year: 1990, height_cm: 183, weight_kg: 94,
  target_weight_kg: 88, activity: "moderate", pace: "steady", country: "de", restrictions: [],
  medical_limitations: null, food_allergies: null, product_limitations: null, onboarded: true,
} as unknown as Profile;

const analyze = (caption: string) =>
  demoPorts().analyzePhoto({
    images: [new Uint8Array([1, 2, 3])],
    profile: PROFILE,
    targets: explainTargets(PROFILE).targets,
    caption,
  });

test("a canned plate never lists the same food twice", async () => {
  // The stride used to be `i * 3` over a six-entry table, so a three-item plate was always
  // [X, Y, X] — every screenshot of this app carried a duplicated row. A fake may be poorer than
  // the real analyzer; it may not be wrong in a way a reader can see.
  for (let i = 0; i < 200; i++) {
    const meal = await analyze(`plate-${i}`);
    const names = meal.items.map((it) => it.name);
    expect(new Set(names).size).toBe(names.length);
  }
});

test("the same input still produces the same plate", async () => {
  expect(await analyze("stable")).toEqual(await analyze("stable"));
});
