// The canned analyzer is what `--demo`, the seeder and every screenshot render, so a defect in its
// fixtures is a defect in every picture of this product.

import { expect, test } from "bun:test";
import { explainTargets } from "@eait/shared";
import type { Profile } from "@eait/shared";
import { DEMO_NOT_FOOD, demoPorts } from "./demo.ts";

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

const profile = { } as never;
const targets = { } as never;
const shot = { images: [new Uint8Array([1, 2, 3])], profile, targets };

// `not-food` is a real branch on both sides — the engine refuses before charging anything and the
// camera draws a panel from it — and until this caption existed nothing could reach either.
test("answers not-food when the caption says there is none", async () => {
  const out = await analyze(DEMO_NOT_FOOD);
  expect(out.isFood).toBe(false);
  expect(out.items).toEqual([]);
  expect(out.kcal).toBe(0);
});

test("matches case-insensitively and inside a longer caption", async () => {
  for (const caption of [DEMO_NOT_FOOD.toUpperCase(), `my desk, ${DEMO_NOT_FOOD}`]) {
    expect((await analyze(caption)).isFood).toBe(false);
  }
});

test("every other caption is still food, including ones that merely mention it", async () => {
  // "no food yesterday" is the near miss worth pinning: a looser match on "no food" would refuse a
  // perfectly good plate because of what somebody wrote in the note.
  for (const caption of ["", "lunch", "no food yesterday", "food"]) {
    const out = await analyze(caption);
    expect(out.isFood).toBe(true);
    expect(out.kcal).toBeGreaterThan(0);
  }
});

// The schema the real analyzer answers now asks for per-item numbers, a scale reference and cooking
// fat as its own row. A fake that answered a poorer shape than the real one would let every test and
// every screenshot pass over a field the production path depends on.
test("every canned plate says what it measured against, and one says nothing", async () => {
  const scales = [];
  for (let i = 0; i < 200; i++) {
    const meal = await analyze(`plate-${i}`);
    expect(meal).toHaveProperty("scale");
    scales.push(meal.scale);
  }
  expect(scales.some((s) => s === null)).toBe(true);
  expect(scales.some((s) => s?.reference)).toBe(true);
});

test("some canned plates were cooked in something, and it is its own row", async () => {
  const fats = [];
  for (let i = 0; i < 200; i++) {
    for (const item of (await analyze(`plate-${i}`)).items) {
      if (item.role === "cooking-fat") fats.push(item);
    }
  }
  expect(fats.length).toBeGreaterThan(0);
  // Poorer than the real analyzer is fine; a row the reconciler cannot sum is not.
  for (const f of fats) expect(f.kcal_per_100g).toBeGreaterThan(0);
});

test("the plates it is least sure of are the ones carrying a question", async () => {
  // `logPhotoMeal` puts a question to nobody unless the confidence is low, so a canned question on
  // a confident plate would be a question no demo and no E2E flow could ever reach the chips of.
  const asked = [];
  for (let i = 0; i < 200; i++) {
    const meal = await analyze(`plate-${i}`);
    if (!meal.question) continue;
    expect(meal.confidence).toBe("low");
    asked.push(meal.question);
  }
  expect(asked.length).toBeGreaterThan(0);
  // Two chips at least: one option is not a choice.
  for (const q of asked) expect(q!.options.length).toBeGreaterThanOrEqual(2);
});

test("a canned plate's items still add up to its totals", async () => {
  // `prepareAnalysis` takes the totals from the items, so a fake whose parts did not add up would
  // be silently re-totalled — and downgraded — in every demo and every test that binds to it.
  for (let i = 0; i < 200; i++) {
    const meal = await analyze(`plate-${i}`);
    for (const k of ["kcal", "protein_g", "carbs_g", "fat_g"] as const) {
      expect(meal.items.reduce((n, it) => n + (it[k] ?? 0), 0)).toBeCloseTo(meal[k], 5);
    }
  }
});

// ── The canned coach ─────────────────────────────────────────────────────────────────────────

const COACH = {
  context: {
    profile: PROFILE, targets: explainTargets(PROFILE).targets, basis: explainTargets(PROFILE).basis,
    today: "2026-09-02", localTime: "12:00", todayMeals: [], week: [], projection: null,
  },
  history: [],
};

test("the canned coach reaches for the meals tool on a question about the week, and says so", async () => {
  const asked: string[] = [];
  const out = await demoPorts().coach({ ...COACH, text: "how did my week go?" }, {
    get_meals: async (args) => { asked.push(`meals ${JSON.stringify(args)}`); return [{ date: "2026-09-01", kcal: 640, items: [{ name: "Rice", grams: 200 }] }]; },
    get_health: async () => { asked.push("health"); return []; },
  });
  expect(asked).toEqual([`meals ${JSON.stringify({ from: "2026-08-27", to: "2026-09-02" })}`]);
  expect(out.reply).toContain("640");
  expect(out.reply).toContain("Demo");
  expect(out.suggestions.length).toBeLessThanOrEqual(3);
});

test("the canned coach reaches for the health tool on a question about weight or sleep", async () => {
  const asked: string[] = [];
  const out = await demoPorts().coach({ ...COACH, text: "how is my weight trending?" }, {
    get_meals: async () => { asked.push("meals"); return []; },
    get_health: async (args) => { asked.push(`health ${JSON.stringify(args)}`); return [{ date: "2026-09-01", weight_kg: 93.4 }]; },
  });
  expect(asked).toEqual([`health ${JSON.stringify({ days: 30 })}`]);
  expect(out.reply).toContain("93.4");
});

test("the canned coach answers a plain question from the context alone", async () => {
  const out = await demoPorts().coach({ ...COACH, text: "is pizza ok tonight?" }, {
    get_meals: async () => { throw new Error("must not be called"); },
    get_health: async () => { throw new Error("must not be called"); },
  });
  expect(out.reply).toContain(String(COACH.context.targets.kcal));
});
