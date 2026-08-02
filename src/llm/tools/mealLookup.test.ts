import { afterAll, describe, expect, test } from "bun:test";
import { cleanupTestDbs, freshTestDb } from "../../testutil.ts";
import { insertMeal, upsertUser } from "../../db.ts";
import { buildRequestContext } from "../context.ts";
import { makeFindMealsTool, FIND_MEALS_WINDOW_DAYS, FIND_MEALS_MAX_ROWS } from "./mealLookup.ts";
import type { Db } from "../../db.ts";
import type { MealAnalysis } from "../../types.ts";

afterAll(cleanupTestDbs, 60_000);

function analysis(over: Partial<MealAnalysis> = {}): MealAnalysis {
  return {
    isFood: true,
    items: [{ name: "pasta carbonara", grams: 300 }],
    kcal: 520, protein_g: 22, carbs_g: 60, fat_g: 20,
    satfat_g: 8, fiber_g: 3, sugar_g: 4, sodium_mg: 600,
    plant_protein_pct: 20, verdicts: {}, confidence: "medium", notes: "",
    ...over,
  };
}

/** Calls the tool the way Mastra does: input first, execution context second. */
const NOW = new Date("2026-08-02T18:00:00Z");
const toolFor = (db: Db) => makeFindMealsTool(db, { tz: "Europe/Berlin", now: () => NOW });

const run = (db: Db, userId: number, input: Record<string, unknown>) =>
  toolFor(db).execute!(input as never, {
    requestContext: buildRequestContext(userId),
  } as never) as Promise<{ meals: { mealId: string; date: string; items: string[] }[] }>;

async function seed(db: Db) {
  await upsertUser(db, { telegram_id: 1 });
  await upsertUser(db, { telegram_id: 2 });
  await insertMeal(db, {
    id: "m-pasta", user_id: 1, ts: "2026-08-02T13:20:00Z", date: "2026-08-02",
    analysis: analysis(),
  });
  await insertMeal(db, {
    id: "m-oats", user_id: 1, ts: "2026-08-02T09:00:00Z", date: "2026-08-02",
    analysis: analysis({ items: [{ name: "oatmeal", grams: 250 }], kcal: 300 }),
  });
  await insertMeal(db, {
    id: "m-other", user_id: 2, ts: "2026-08-02T13:20:00Z", date: "2026-08-02",
    analysis: analysis(),
  });
}

describe("find_meals", () => {
  test("returns the caller's meals, newest first, with the id an edit can target", async () => {
    const db = await freshTestDb();
    await seed(db);
    const out = await run(db, 1, {});
    expect(out.meals.map((m) => m.mealId)).toEqual(["m-pasta", "m-oats"]);
    expect(out.meals[0]!.items).toEqual(["pasta carbonara"]);
  });

  test("NEVER reaches another user's meals — the id comes from the request context, not the input", async () => {
    const db = await freshTestDb();
    await seed(db);
    const out = await run(db, 2, {});
    expect(out.meals.map((m) => m.mealId)).toEqual(["m-other"]);
  });

  test("a userId supplied in the tool input is ignored — only the bound one is used", async () => {
    const db = await freshTestDb();
    await seed(db);
    // A model that invents this field must not be able to read user 1's diary.
    const out = await run(db, 2, { userId: 1, user_id: 1 });
    expect(out.meals.map((m) => m.mealId)).toEqual(["m-other"]);
  });

  test("an unbound request context throws rather than defaulting to somebody", async () => {
    const db = await freshTestDb();
    await seed(db);
    await expect(
      toolFor(db).execute!({} as never, {} as never),
    ).rejects.toThrow(/userId/);
  });

  test("queries filter by item name, case- and substring-insensitively", async () => {
    const db = await freshTestDb();
    await seed(db);
    const out = await run(db, 1, { queries: ["Pasta"] });
    expect(out.meals.map((m) => m.mealId)).toEqual(["m-pasta"]);
  });

  test("a query matching nothing returns an empty list, not everything", async () => {
    const db = await freshTestDb();
    await seed(db);
    const out = await run(db, 1, { queries: ["sushi"] });
    expect(out.meals).toEqual([]);
  });

  test("the window is bounded — meals older than the window are unreachable", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await insertMeal(db, {
      id: "ancient", user_id: 1, ts: "2026-07-01T10:00:00Z", date: "2026-07-01",
      analysis: analysis(),
    });
    const out = await run(db, 1, {});
    expect(out.meals).toEqual([]);
    // and the constant is the window the design names, not an accident
    expect(FIND_MEALS_WINDOW_DAYS).toBe(7);
  });

  test("a query reaches a matching meal the newest rows have pushed past the cap", async () => {
    // The cap bounds the ANSWER, not the search. With the LIMIT applied before the filter, a busy
    // week buried the one meal the model asked for: `find_meals(["sushi"])` answered "nothing"
    // while the row sat in the window — the exact lookup this tool exists to serve.
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await insertMeal(db, {
      id: "m-sushi", user_id: 1, ts: "2026-07-28T12:00:00Z", date: "2026-07-28",
      analysis: analysis({ items: [{ name: "sushi", grams: 300 }] }),
    });
    for (let i = 0; i < FIND_MEALS_MAX_ROWS + 5; i++) {
      await insertMeal(db, {
        id: `m${i}`, user_id: 1, ts: `2026-08-01T${String(i % 24).padStart(2, "0")}:00:00Z`,
        date: "2026-08-01", analysis: analysis({ items: [{ name: "salad", grams: 100 }] }),
      });
    }
    expect((await run(db, 1, { queries: ["sushi"] })).meals.map((m) => m.mealId)).toEqual(["m-sushi"]);
    // and a modest limit — the shape a model actually emits — does not narrow the search either
    expect((await run(db, 1, { queries: ["sushi"], limit: 5 })).meals.map((m) => m.mealId))
      .toEqual(["m-sushi"]);
  });

  test("row count is capped however large a limit the model asks for", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    for (let i = 0; i < FIND_MEALS_MAX_ROWS + 5; i++) {
      await insertMeal(db, {
        id: `m${i}`, user_id: 1, ts: `2026-08-02T${String(i % 24).padStart(2, "0")}:00:00Z`,
        date: "2026-08-02", analysis: analysis(),
      });
    }
    const out = await run(db, 1, { limit: 999 });
    expect(out.meals.length).toBe(FIND_MEALS_MAX_ROWS);
  });
});
