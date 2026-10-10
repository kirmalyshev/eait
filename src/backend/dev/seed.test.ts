// The seeder, against the memory store. No database, no docker, runs on every `bun test`.

import { describe, expect, test } from "bun:test";
import { FIXTURE_THREAD, HEALTH_FIELDS, dateMinus, firstVerdictLines, localDate, threadCopyFor } from "@eait/shared";
import { memoryStore } from "../store.memory.ts";
import { DEFAULT_SEED_PERSONA, SEED_PERSONAS, seedDeviceId, seedDevData } from "./seed.ts";
import { PROMPT_DEFAULTS, PROMPT_KEYS, loadPrompts } from "../llm/prompt.ts";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { logMail } from "../mail/log.ts";
import { days as daysRead, weights as weightsRead, profileView } from "../engine/index.ts";
import type { EngineDeps } from "../engine/deps.ts";

const TZ = "Europe/Berlin";
const TODAY = "2026-08-06";
/** The seven calendar days `TODAY` seeds health rows for, newest first. Written out rather than
 *  computed, so a bug in the date arithmetic under test cannot also be the thing asserting it. */
const SEEDED_WEEK = [
  "2026-08-06", "2026-08-05", "2026-08-04", "2026-08-03", "2026-08-02", "2026-08-01", "2026-07-31",
];
/** Anna's logged days — Mon–Thu of the boards' week, which is `TODAY` and the three days back. */
const ANNA_MEAL_DAYS = ["2026-08-06", "2026-08-05", "2026-08-04", "2026-08-03"];

describe("seedDevData", () => {
  test("every persona is reachable by its pinned device id", async () => {
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });

    expect(seeded.map((s) => s.key)).toEqual(SEED_PERSONAS.map((p) => p.key));
    for (const s of seeded) {
      const resolved = await store.upsertDeviceUser(s.deviceId, "en");
      expect(resolved.created).toBe(false);
      expect(resolved.userId).toBe(s.userId);
    }
  });

  test("a persona's thread holds its meals, and its first verdict is already spoken", async () => {
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });
    for (const s of seeded) {
      const lines = await store.chatBefore(s.userId, null, 1000);
      const cards = lines.filter((m) => m.kind === "meal");
      if (cards.length === 0) continue; // a persona without meals has nothing to say yet
      expect(lines.some((m) => m.kind === "photo")).toBe(true);
      // Oldest first, like a conversation: the newest card (highest seq) is today's meal.
      const newest = lines[0]!; // chatBefore is newest-first
      const meal = (await store.getMeals(s.userId, [newest.kind === "meal" ? newest.mealId! : cards[0]!.mealId!]))[0]!;
      expect(newest.kind).toBe("meal");
      expect(meal.date).toBe(TODAY);
      // Spud does not greet a week-old account as if this were its first meal — because the greeting
      // is already IN the thread, at its oldest meal, not merely flagged as spoken.
      expect(await store.claimFirstVerdict(s.userId)).toBe(false);
      const oldestFirst = [...lines].reverse();
      const greeting = oldestFirst.find((m) => m.role === "assistant" && m.kind === "text");
      // IN THAT PERSONA'S OWN LANGUAGE. Asserting the English literals pinned the seeder to
      // English — the Russian persona exists precisely so somebody can look at a translated app,
      // and a test that demanded "First one in." would have made adding it a test edit.
      const lang = SEED_PERSONAS.find((x) => x.key === s.key)?.profile?.lang ?? "en";
      // #49: the verdict leads with the pills' headline when they produce one, else the arithmetic
      // — so the greeting's first line is one of the headline strings or the "First one in" opener.
      const openers = [
        ...Object.values(threadCopyFor(lang).firstVerdict.headline),
        firstVerdictLines({
          goal: "lose", targets: { kcal: 2000, protein_g: 140, fat_g: 67, carbs_g: 230 },
          via: "photo", verdicts: {}, meal: { kcal: 500, satfat_g: 2, sodium_mg: 300, confidence: "high" },
          eatenToday: { kcal: 500, protein_g: 30, satfat_g: 2, sodium_mg: 300 },
        }, lang)[0]!,
      ];
      // The first few words, which is what identifies the sentence without pinning its figures.
      expect(openers.some((o) => greeting?.text?.startsWith(o.split(" ").slice(0, 2).join(" ")))).toBe(true);
      expect(oldestFirst.indexOf(greeting!)).toBeLessThan(4);
    }
    expect(seeded.some((s) => s.meals > 0)).toBe(true);
  });

  test("the pinned device id is deterministic and long enough to be an account key", () => {
    // 32 characters is the server's floor — see `POST /v1/auth/device`. Stability matters because
    // the value is compiled into a build: a device id that moved between two builds would silently
    // hand the second one a different account.
    for (const p of SEED_PERSONAS) {
      expect(seedDeviceId(p.key)).toBe(seedDeviceId(p.key));
      expect(seedDeviceId(p.key).length).toBeGreaterThanOrEqual(32);
      expect(seedDeviceId(p.key)).toMatch(/^5eed[0-9a-f]+$/);
    }
    // Distinct personas are distinct accounts.
    const ids = new Set(SEED_PERSONAS.map((p) => seedDeviceId(p.key)));
    expect(ids.size).toBe(SEED_PERSONAS.length);
  });

  test("the default persona is Anna — the boards' own week, written number for number (#84)", async () => {
    const store = memoryStore();
    const [seeded] = await seedDevData(store, {
      timezone: TZ, today: TODAY, only: [DEFAULT_SEED_PERSONA],
    });
    expect(seeded).toBeDefined();

    const profile = await store.getProfile(seeded!.userId);
    expect(profile?.onboarded_at).not.toBeNull();
    // The profile the boards are drawn against: 74kg typed, 68 to reach, a 1,434 plan.
    expect(profile?.weight_kg).toBe(74);
    expect(profile?.target_weight_kg).toBe(68);
    expect(profile?.restrictions).toContain("ldl");

    // Mon–Thu of her week each carry three cards; nothing before them — the streak is 4.
    for (const date of ANNA_MEAL_DAYS) {
      expect((await store.mealsForDate(seeded!.userId, date)).length).toBe(3);
    }
    expect((await store.mealsForDate(seeded!.userId, "2026-08-02")).length).toBe(0);
    expect(seeded!.meals).toBe(ANNA_MEAL_DAYS.length * 3);
  });

  test("Anna's days land on the boards' totals, and Today reads like `phone/today.html`", async () => {
    const store = memoryStore();
    const [anna] = await seedDevData(store, { timezone: TZ, today: TODAY, only: ["anna"] });

    // The Progress "This week" bars, oldest first: Mon 1,386 · Tue 1,429 · Wed 1,308 · Thu 1,066.
    const totals = await store.totalsSince(anna!.userId, "2026-08-03");
    expect(totals.map((t) => t.kcal)).toEqual([1066, 1308, 1429, 1386]);

    // And the day's own cards are the board's rows — the arithmetic the "368 left" line asserts.
    const today = await store.mealsForDate(anna!.userId, TODAY);
    expect(today.map((m) => m.kcal)).toEqual([312, 540, 214]);
    const sum = (key: "protein_g" | "carbs_g" | "fat_g") =>
      today.reduce((n, m) => n + m[key], 0);
    // The board's own words: 368kcal, 55g protein, 8g carbs and 13g fat left of a
    // 1,434 / 109 / 142 / 48 plan.
    expect({ kcal: 1434 - 1066, protein_g: 109 - sum("protein_g"), carbs_g: 142 - sum("carbs_g"), fat_g: 48 - sum("fat_g") })
      .toEqual({ kcal: 368, protein_g: 55, carbs_g: 8, fat_g: 13 });
    // The typed one is low-confidence; the photographed two are not.
    const flatWhite = today.find((m) => m.items[0]?.name === "Flat white")!;
    expect(flatWhite.confidence).toBe("low");
  });

  test("Anna's weigh-in log merges the typed rows and the scale's, the typed one winning", async () => {
    const store = memoryStore();
    const [anna] = await seedDevData(store, { timezone: TZ, today: TODAY, only: ["anna"] });

    expect(await store.weightsSince(anna!.userId, "2020-01-01"))
      .toEqual([{ date: "2026-07-16", kg: 74.0 }]);

    // On the day both halves have a reading — the onboarding morning — the typed row wins.
    const health = await store.healthDaysSince(anna!.userId, "2026-07-01");
    const byDate = new Map(health.filter((d) => d.weight_kg !== null).map((d) => [d.date, d.weight_kg]));
    expect(byDate.get("2026-07-06")).toBe(74.6); // the pre-onboarding backfill
    expect(byDate.get("2026-07-16")).toBe(74.2); // the scale's own figure that morning
    expect(byDate.get(TODAY)).toBe(73.4);
  });

  test("Anna's photographs are the licensed board images, not the placeholder square", async () => {
    const store = memoryStore();
    const [anna] = await seedDevData(store, { timezone: TZ, today: TODAY, only: ["anna"] });
    const today = await store.mealsForDate(anna!.userId, TODAY);
    for (const meal of today) {
      const photo = await store.getPhoto(anna!.userId, meal.id, 0);
      expect(photo).not.toBeNull();
      // Real webp files from product/design/pro/img — RIFF/WEBP magic, tens of kilobytes.
      expect(photo!.mime).toBe("image/webp");
      expect(photo!.bytes.length).toBeGreaterThan(10_000);
      expect(Buffer.from(photo!.bytes.slice(8, 12)).toString()).toBe("WEBP");
    }
  });

  test("the seeded account answers the boards' reads, not just their rows (#84)", async () => {
    // The fixture and the endpoints are only worth seeding if they meet: the streak the strip
    // draws, the line the Progress chart draws, and the arc the goal bar measures — all through
    // the engine, on the seeded rows, so a drift in either is a test failure and not a screenshot.
    //
    // Seeded against the REAL today rather than the pinned one: the streak and the `when` flags
    // are computed from the server's own clock, so asserting them needs the fixture's "today" to
    // be the engine's — which is also what makes the seed reproducible on any day it runs.
    const store = memoryStore();
    const [anna] = await seedDevData(store, { timezone: TZ, only: ["anna"] });
    const deps: EngineDeps = {
      store, config: { ...configDefaults(), timezone: TZ } as Config,
      llm: demoPorts(), push: fakePush(), mail: logMail(),
    };
    const today = localDate(TZ);
    const back = (n: number) => dateMinus(today, n);

    const range = await daysRead(deps, anna!.userId, back(3), today);
    expect(range).not.toBeNull();
    expect(range!.streak).toBe(4);
    expect(range!.days.map((d) => d.kcal)).toEqual([1386, 1429, 1308, 1066]);
    expect(range!.targetKcal).toBe(1434);

    const log = await weightsRead(deps, anna!.userId, "90D");
    // One row per day, oldest first, the typed onboarding value standing over the scale's.
    expect(log!.weights).toEqual([
      { date: back(31), kg: 74.6, source: "health" },
      { date: back(21), kg: 74.0, source: "manual" },
      { date: back(14), kg: 73.9, source: "health" },
      { date: back(4), kg: 73.8, source: "health" },
      { date: today, kg: 73.4, source: "health" },
    ]);

    const me = await profileView(deps, anna!.userId);
    expect(me!.targets.kcal).toBe(1434);
    expect(log!.projection).not.toBeNull();
    // The bar reads 0.6 down, 5.4 to go: start at the typed 74, current at Health's 73.4.
    expect(log!.projection!.startKg).toBe(74);
    expect(log!.projection!.currentKg).toBe(73.4);
    expect(log!.projection!.targetKg).toBe(68);
    expect(log!.projection!.beyondHorizon).toBe(false);
  });

  test("the 'onboarded' persona is still there beside her — its name is an API (#84 review)", async () => {
    // `only: ["onboarded"]` is how the monorepo's `scripts/eval-coach.ts` seeds its subject, and
    // the dev-env docs name the key — a rename would break callers outside this repository.
    const store = memoryStore();
    const [seeded] = await seedDevData(store, { timezone: TZ, today: TODAY, only: ["onboarded"] });
    expect(seeded).toBeDefined();
    expect(seeded!.key).toBe("onboarded");
    // The generated week, unchanged: three meals a day for seven days.
    for (const date of SEEDED_WEEK) {
      expect((await store.mealsForDate(seeded!.userId, date)).length).toBe(3);
    }
    expect(seeded!.meals).toBe(SEEDED_WEEK.length * 3);
  });

  test("the fresh persona exists, has never onboarded, and has no meals", async () => {
    const store = memoryStore();
    const [seeded] = await seedDevData(store, { timezone: TZ, today: TODAY, only: ["fresh"] });

    const profile = await store.getProfile(seeded!.userId);
    expect(profile?.onboarded_at ?? null).toBeNull();
    expect(seeded!.meals).toBe(0);
    expect((await store.mealsForDate(seeded!.userId, TODAY)).length).toBe(0);
  });

  test("verdicts are computed, and only for dimensions the profile declares", async () => {
    const store = memoryStore();
    const [seeded] = await seedDevData(store, {
      timezone: TZ, today: TODAY, only: [DEFAULT_SEED_PERSONA],
    });

    const meals = await store.mealsForDate(seeded!.userId, TODAY);
    expect(meals.length).toBe(3);
    for (const meal of meals) {
      // `weight` applies to everybody; `ldl` is unlocked by the declared restriction; `kidneys` is
      // NOT declared, so producing one would be a medical claim the user never asked for.
      expect(meal.verdicts.weight).toBeDefined();
      expect(meal.verdicts.ldl).toBeDefined();
      expect(meal.verdicts.kidneys).toBeUndefined();
    }
  });

  test("a seeded week is not all one colour", async () => {
    // A fixture where every meal is `bad` says nothing about whether the verdict row renders
    // correctly, and it makes the seeded app look like an emergency. The first version of the
    // macro mix did exactly that on the LDL dimension.
    const store = memoryStore();
    const [seeded] = await seedDevData(store, {
      timezone: TZ, today: TODAY, only: [DEFAULT_SEED_PERSONA],
    });

    const verdicts = { weight: new Set<string>(), ldl: new Set<string>() };
    let counted = 0;
    for (const date of ANNA_MEAL_DAYS) {
      for (const meal of await store.mealsForDate(seeded!.userId, date)) {
        counted++;
        if (meal.verdicts.weight) verdicts.weight.add(meal.verdicts.weight);
        if (meal.verdicts.ldl) verdicts.ldl.add(meal.verdicts.ldl);
      }
    }
    // Asserted, because a loop that quietly walked the wrong dates would find no meals and every
    // set below would be trivially satisfiable.
    expect(counted).toBe(12);
    expect(verdicts.weight.size).toBeGreaterThan(1);
    expect(verdicts.ldl.has("good")).toBe(true);
  });

  test("the default persona carries a health trend over the week, and the weigh-ins further", async () => {
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });
    const anna = seeded.find((s) => s.key === DEFAULT_SEED_PERSONA)!;

    // The full-metric rows cover the seeded week; the weigh-in log reaches further back.
    const days = await store.healthDaysSince(anna.userId, SEEDED_WEEK[SEEDED_WEEK.length - 1]!);
    expect(days.map((d) => d.date)).toEqual(SEEDED_WEEK);
    // Plus the three sparse backfill rows (scale readings with nothing else on the day) — the
    // weigh-ins of 6, 16 and 23 July.
    expect(anna.healthDays).toBe(SEEDED_WEEK.length + 3);
  });

  test("the seeded trend has gaps, because a real one does", async () => {
    // A fixture where every metric is present every day never exercises the "unknown, not zero"
    // rendering — and that is the branch a real trend spends most of its time in. A scale is not
    // stepped on daily and a watch is not worn every night.
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });
    const onboarded = seeded.find((s) => s.key === DEFAULT_SEED_PERSONA)!;
    const days = await store.healthDaysSince(onboarded.userId, SEEDED_WEEK[SEEDED_WEEK.length - 1]!);

    expect(days.some((d) => d.weight_kg === null)).toBe(true);
    expect(days.some((d) => d.weight_kg !== null)).toBe(true);
    expect(days.some((d) => d.asleep_minutes === null)).toBe(true);
    expect(days.every((d) => d.steps !== null)).toBe(true);
  });

  test("every health metric appears somewhere in the seeded week", async () => {
    // GAPS ARE THE POINT ABOVE; A METRIC THAT NEVER APPEARS IS NOT A GAP. `scripts/health-fake.test.ts`
    // makes this assertion about the canned phone source, for the reason that a field no fixture
    // emits is a field nothing renders anywhere — and it surfaces only as a row absent from a
    // screenshot nobody questions. The seeder is the OTHER fixture and had the same hole: body fat,
    // lean mass, VO2 max and in-bed minutes were never written, so `--demo` and every seeded
    // development build showed eleven of the fifteen metrics.
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });
    const onboarded = seeded.find((s) => s.key === DEFAULT_SEED_PERSONA)!;
    const days = await store.healthDaysSince(onboarded.userId, SEEDED_WEEK[SEEDED_WEEK.length - 1]!);

    const missing = HEALTH_FIELDS
      .filter((f) => !days.some((d) => d[f.key] !== null))
      .map((f) => f.key);
    expect(missing).toEqual([]);
  });

  test("the fresh persona has no health rows at all", async () => {
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });
    const fresh = seeded.find((s) => s.healthDays === 0);
    expect(fresh).toBeDefined();
    expect(await store.healthDaysSince(fresh!.userId, "2020-01-01")).toEqual([]);
  });

  test("seeds exactly one admin, and three accounts that are not", async () => {
    // What `./dev seed` is for: a database somebody can open the admin in. The role is the only
    // way in since #391b, so a development database with nobody holding it has an admin surface
    // that answers 404 — correct, and unusable.
    const store = memoryStore();
    const seeded = await seedDevData(store, { timezone: TZ, today: TODAY });
    const admins = seeded.filter((s) => s.admin);
    expect(admins).toHaveLength(1);
    expect(await store.roleOf(admins[0]!.userId)).toBe("admin");
    expect(await store.hasAdmin()).toBe(true);

    // And the other three are ordinary, because an instance where everybody is an admin proves
    // nothing about the gate.
    // COUNTED FROM THE LIST, not hardcoded: a persona added for a good reason should not have to
    // edit this number to be added.
    const others = seeded.filter((s) => !s.admin);
    expect(others).toHaveLength(SEED_PERSONAS.filter((x) => !x.admin).length);
    for (const p of others) expect(await store.roleOf(p.userId)).toBe("user");
  });

  test("re-seeding does not leave the old admin holding the role", async () => {
    // Each persona is deleted and rebuilt, which mints a NEW user id. A grant that was not
    // re-applied would leave the database with an admin nobody can sign in as — and `hasAdmin`
    // true, so the surface would exist with no way through it.
    const store = memoryStore();
    const first = await seedDevData(store, { timezone: TZ, today: TODAY });
    const second = await seedDevData(store, { timezone: TZ, today: TODAY });
    const before = first.find((s) => s.admin)!;
    const after = second.find((s) => s.admin)!;
    expect(after.userId).not.toBe(before.userId);
    expect(await store.roleOf(before.userId)).toBeNull();
    expect(await store.roleOf(after.userId)).toBe("admin");
  });

  test("seeding twice leaves one week of meals, not two", async () => {
    const store = memoryStore();
    await seedDevData(store, { timezone: TZ, today: TODAY });
    const second = await seedDevData(store, { timezone: TZ, today: TODAY });

    const onboarded = second.find((s) => s.key === DEFAULT_SEED_PERSONA)!;
    expect((await store.mealsForDate(onboarded.userId, TODAY)).length).toBe(3);
    expect(onboarded.meals).toBe(12);
  });

  // ── the baselineable Chat (#257) ──

  test("the chat persona is onboarded, has a fixed thread, and has nothing that moves", async () => {
    const store = memoryStore();
    const [seeded] = await seedDevData(store, { timezone: TZ, today: TODAY, only: ["chat"] });
    expect(seeded).toBeDefined();

    // Onboarded, so the app opens on the thread rather than on the questions.
    expect((await store.getProfile(seeded!.userId))?.onboarded_at).not.toBeNull();

    // And carrying NOTHING a screenshot cannot be compared against: no meals means no card and no
    // photo bubble, so no analyzer numbers and no date on the screen. That is the whole point of
    // the persona — `assertScreenshot` is disqualified from Chat today by exactly those.
    expect(seeded!.meals).toBe(0);
    expect(seeded!.healthDays).toBe(0);

    const lines = await store.chatBefore(seeded!.userId, null, 1000);
    expect(lines.length).toBe(FIXTURE_THREAD.length);
    expect(lines.some((m) => m.kind === "meal" || m.kind === "photo")).toBe(false);
    expect(lines.every((m) => m.role === "user" && m.kind === "text")).toBe(true);
    // `chatBefore` is newest-first; the thread reads in the order the constant declares.
    expect([...lines].reverse().map((m) => m.text)).toEqual([...FIXTURE_THREAD]);
  });

  test("the fixture thread does not depend on the day it was seeded", async () => {
    // The property that makes it baselineable at all. A thread that differed between two seedings
    // would be a checkpoint that goes red on a date rather than on a defect — which is the rule
    // `subflow-visual-check.yaml` states and the reason Chat had no baseline before this.
    const a = memoryStore();
    const b = memoryStore();
    const [today] = await seedDevData(a, { timezone: TZ, today: TODAY, only: ["chat"] });
    const [muchLater] = await seedDevData(b, { timezone: TZ, today: "2027-03-01", only: ["chat"] });

    const linesOf = async (store: ReturnType<typeof memoryStore>, userId: string) =>
      (await store.chatBefore(userId, null, 1000)).map((m) => m.text);
    expect(await linesOf(a, today!.userId)).toEqual(await linesOf(b, muchLater!.userId));
  });

  test("an account created by hand survives a re-seed", async () => {
    const store = memoryStore();
    await seedDevData(store, { timezone: TZ, today: TODAY });

    const mine = await store.upsertDeviceUser("a".repeat(64), "en");
    await store.patchProfile(mine.userId, { weight_kg: 71 });
    await seedDevData(store, { timezone: TZ, today: TODAY });

    const after = await store.upsertDeviceUser("a".repeat(64), "en");
    expect(after.created).toBe(false);
    expect((await store.getProfile(mine.userId))?.weight_kg).toBe(71);
  });
});

// The prompts a fresh install finds.
//
// They are NOT seeded here any more. `memoryStore()` holds them from construction and
// `postgresStore()` syncs them at boot, so by the time the seeder runs they already exist — and a
// second writer of the same rows would be a second answer to "what is this instance sending".
// What this file still owes is the proof that seeding does not disturb them.
describe("the shipped prompts", () => {
  test("a seeded database sends the shipped prompts, and seeding twice does not touch them", async () => {
    const store = memoryStore();
    await seedDevData(store, { timezone: TZ, today: TODAY });
    await seedDevData(store, { timezone: TZ, today: TODAY });
    expect(await loadPrompts(store)).toEqual(PROMPT_DEFAULTS);
    for (const key of PROMPT_KEYS) {
      expect(await store.promptRevisions(key), `seeding wrote a revision of "${key}"`).toHaveLength(1);
    }
  });

  test("seeding never reverts an edit", async () => {
    // The seeder replaces its own accounts and leaves everything else. An edited prompt is
    // everything else.
    const store = memoryStore();
    await store.putPrompt("coach", "You are terse.", "admin");
    await seedDevData(store, { timezone: TZ, today: TODAY });
    expect((await loadPrompts(store)).coach).toBe("You are terse.");
  });
});
