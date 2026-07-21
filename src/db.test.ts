import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MealAnalysis } from "./types.ts";
import {
  applyCorrection,
  berlinDate,
  countMealsToday,
  dailyTotals,
  deleteUser,
  getMeal,
  getUser,
  insertMeal,
  markUpdate,
  mealByReply,
  mealCount,
  openDb,
  seenUpdate,
  setConsent,
  setMealReply,
  setProfile,
  upsertUser,
  userCount,
} from "./db.ts";

const created: string[] = [];
function freshDb() {
  const path = join(tmpdir(), `eait-test-${crypto.randomUUID()}.sqlite`);
  created.push(path);
  return openDb(path);
}
afterAll(() => {
  for (const p of created) {
    for (const suffix of ["", "-wal", "-shm", "-journal"]) {
      try {
        rmSync(p + suffix, { force: true });
      } catch {}
    }
  }
});

function analysis(over: Partial<MealAnalysis> = {}): MealAnalysis {
  return {
    isFood: true,
    items: [{ name: "rice", grams: 200 }],
    kcal: 300,
    protein_g: 8,
    carbs_g: 60,
    fat_g: 2,
    satfat_g: 0.5,
    fiber_g: 1,
    sugar_g: 1,
    sodium_mg: 5,
    plant_protein_pct: 100,
    verdicts: { weight: "good" },
    confidence: "medium",
    notes: "",
    ...over,
  };
}

describe("openDb + migrations", () => {
  test("sets PRAGMAs and user_version=1", () => {
    const db = freshDb();
    expect((db.query("PRAGMA user_version").get() as any).user_version).toBe(1);
    expect((db.query("PRAGMA journal_mode").get() as any).journal_mode).toBe("wal");
    expect((db.query("PRAGMA foreign_keys").get() as any).foreign_keys).toBe(1);
    expect((db.query("PRAGMA busy_timeout").get() as any).timeout).toBe(5000);
    db.close();
  });
});

describe("users", () => {
  test("upsert then get; new user starts at consent with empty restrictions", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1, username: "a" });
    const u = getUser(db, 1);
    expect(u?.state).toBe("consent");
    expect(u?.restrictions).toEqual([]);
    expect(u?.consent_at).toBeNull();
    db.close();
  });

  test("upsert is resume-safe — never clobbers consent_at/goal/state", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1, username: "a" });
    setConsent(db, 1, "2026-07-21T10:00:00Z");
    setProfile(db, 1, { goal: "lose", restrictions: ["ldl"], state: "active" });
    // a later /start re-upserts — must not reset progress
    upsertUser(db, { telegram_id: 1, username: "a2" });
    const u = getUser(db, 1);
    expect(u?.state).toBe("active");
    expect(u?.goal).toBe("lose");
    expect(u?.restrictions).toEqual(["ldl"]);
    expect(u?.consent_at).toBe("2026-07-21T10:00:00Z");
    expect(u?.username).toBe("a2"); // username does update
    db.close();
  });
});

describe("meals + daily totals", () => {
  test("insert meals, sum daily totals for user+date", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1 });
    insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis({ kcal: 300, protein_g: 8 }) });
    insertMeal(db, { id: "m2", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis({ kcal: 500, protein_g: 20 }) });
    insertMeal(db, { id: "m3", user_id: 1, ts: "t", date: "2026-07-22", analysis: analysis({ kcal: 999 }) });
    const totals = dailyTotals(db, 1, "2026-07-21");
    expect(totals.kcal).toBe(800);
    expect(totals.protein_g).toBe(28);
    expect(countMealsToday(db, 1, "2026-07-21")).toBe(2);
    db.close();
  });

  test("empty day totals are zero, not null", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1 });
    const totals = dailyTotals(db, 1, "2026-07-21");
    expect(totals.kcal).toBe(0);
    expect(totals.sodium_mg).toBe(0);
    db.close();
  });

  test("setMealReply then mealByReply routes back to the meal (scoped to sender)", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1 });
    upsertUser(db, { telegram_id: 2 });
    insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
    setMealReply(db, "m1", 1, 555, 42);
    expect(mealByReply(db, 1, 42)?.id).toBe("m1");
    // user 2 replying to the same message id must NOT reach user 1's meal
    expect(mealByReply(db, 2, 42)).toBeUndefined();
    db.close();
  });
});

describe("corrections are scoped", () => {
  test("applyCorrection only touches the matching id+user and sets corrected=1", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1 });
    upsertUser(db, { telegram_id: 2 });
    insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis({ kcal: 300 }) });

    // wrong user cannot correct user 1's meal
    applyCorrection(db, "m1", 2, { kcal: 9999 });
    expect(getMeal(db, "m1", 1)?.kcal).toBe(300);
    expect(getMeal(db, "m1", 1)?.corrected).toBe(false);

    // correct owner can
    applyCorrection(db, "m1", 1, { kcal: 450, protein_g: 12 });
    const m = getMeal(db, "m1", 1);
    expect(m?.kcal).toBe(450);
    expect(m?.protein_g).toBe(12);
    expect(m?.corrected).toBe(true);
    db.close();
  });
});

describe("cross-user isolation", () => {
  test("user B cannot read user A's meal by id", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1 });
    upsertUser(db, { telegram_id: 2 });
    insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
    expect(getMeal(db, "m1", 1)?.id).toBe("m1");
    expect(getMeal(db, "m1", 2)).toBeUndefined();
    db.close();
  });
});

describe("delete cascade", () => {
  test("deleteUser removes the user and all their meals; other users untouched", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1 });
    upsertUser(db, { telegram_id: 2 });
    insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
    insertMeal(db, { id: "m2", user_id: 2, ts: "t", date: "2026-07-21", analysis: analysis() });
    deleteUser(db, 1);
    expect(getUser(db, 1)).toBeUndefined();
    expect(getMeal(db, "m1", 1)).toBeUndefined();
    expect(getUser(db, 2)?.telegram_id).toBe(2);
    expect(getMeal(db, "m2", 2)?.id).toBe("m2");
    db.close();
  });
});

describe("update dedupe", () => {
  test("seenUpdate flips after markUpdate; double-mark is safe", () => {
    const db = freshDb();
    expect(seenUpdate(db, 1001)).toBe(false);
    markUpdate(db, 1001);
    expect(seenUpdate(db, 1001)).toBe(true);
    markUpdate(db, 1001); // idempotent, no throw
    expect(seenUpdate(db, 1001)).toBe(true);
    db.close();
  });
});

describe("admin counts", () => {
  test("userCount and mealCount", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1 });
    upsertUser(db, { telegram_id: 2 });
    insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
    expect(userCount(db)).toBe(2);
    expect(mealCount(db)).toBe(1);
    db.close();
  });
});

describe("berlinDate is TZ-correct at the midnight boundary", () => {
  test("summer (+02:00): 22:30Z falls on the next Berlin day", () => {
    expect(berlinDate(new Date("2026-07-21T22:30:00Z"))).toBe("2026-07-22");
  });
  test("winter (+01:00): 23:30Z falls on the next Berlin day", () => {
    expect(berlinDate(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
  });
  test("midday is same day", () => {
    expect(berlinDate(new Date("2026-07-21T10:00:00Z"))).toBe("2026-07-21");
  });
});

describe("file db is created on disk", () => {
  test("openDb makes the file", () => {
    const path = join(tmpdir(), `eait-test-${crypto.randomUUID()}.sqlite`);
    created.push(path);
    const db = openDb(path);
    db.close();
    expect(existsSync(path)).toBe(true);
  });
});
