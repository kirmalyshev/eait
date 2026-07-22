import { afterAll, describe, expect, test } from "bun:test";
import type { MealAnalysis } from "./types.ts";
import { DEFAULT_LANG } from "./i18n/registry.ts";
import { cleanupTestDbs, freshTestDb, freshTestName, openTestDb } from "./testutil.ts";
import {
  applyCorrection,
  berlinDate,
  berlinTime,
  countMealsToday,
  dailyTotals,
  deleteUser,
  getMeal,
  getUser,
  getSetting,
  setSetting,
  clearSetting,
  insertMeal,
  insertPendingMeal,
  setPendingReply,
  getPendingMeal,
  deletePendingMeal,
  prunePendingMeals,
  logLlmCall,
  llmCallsToday,
  llmCallCountToday,
  mealsOnDate,
  totalsByDate,
  markUpdate,
  mealByReply,
  eventsFor,
  logEvent,
  funnelByCode,
  mealCount,
  mealCountToday,
  seenUpdate,
  setAcquisitionSource,
  setConsent,
  setLang,
  setMealReply,
  setProfile,
  upsertUser,
  userCount,
} from "./db.ts";

afterAll(cleanupTestDbs, 60_000);

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

describe("weight", () => {
  test("a new user has no weight; setProfile stores and getUser returns it", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1, username: null, lang: DEFAULT_LANG });
    expect((await getUser(db, 1))!.weight_kg).toBeNull();
    await setProfile(db, 1, { weight_kg: 92.5 });
    expect((await getUser(db, 1))!.weight_kg).toBe(92.5);
  });

  test("weight 0 (the explicit-skip sentinel) round-trips distinctly from null", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 2, username: null, lang: DEFAULT_LANG });
    await setProfile(db, 2, { weight_kg: 0 });
    expect((await getUser(db, 2))!.weight_kg).toBe(0);
  });
});

describe("migration 2 upgrade path (pre-existing databases, not fresh creates)", () => {
  test("active users keep NULL weight; users mid-flow past goal are backfilled to skipped", async () => {
    const name = freshTestName();
    const a = await openTestDb(name);
    // Rewind to v1: drop the v2+v3 artifacts and reset the version, then seed pre-migration rows.
    await a`ALTER TABLE users DROP COLUMN weight_kg`;
    await a`ALTER TABLE meals DROP COLUMN user_message_id`;
    await a`DROP TABLE pending_meals`;
    await a`DROP TABLE llm_calls`;
    await a`UPDATE schema_version SET version = 1`;
    await upsertUser(a, { telegram_id: 1 });
    await setProfile(a, 1, { goal: "lose", restrictions: [], state: "active" });
    await upsertUser(a, { telegram_id: 2 }); // mid-flow at the OLD restrictions step
    await setProfile(a, 2, { goal: "maintain", state: "profile" });
    await upsertUser(a, { telegram_id: 3 }); // mid-flow at the goal step
    await setProfile(a, 3, { state: "profile" });
    await a.close();

    const b = await openTestDb(name); // migrations 2+3 run against existing rows
    expect(Number((await b`SELECT version FROM schema_version`)[0].version)).toBe(3);
    // Active user: never asked — NULL, and never re-asked (resume() skips active users).
    expect((await getUser(b, 1))!.weight_kg).toBeNull();
    // Restrictions-step user: backfilled to the skip sentinel, or their next message — composed
    // as a restrictions answer — would be silently eaten by the new weight step.
    expect((await getUser(b, 2))!.weight_kg).toBe(0);
    expect((await getUser(b, 2))!.goal).toBe("maintain"); // untouched otherwise
    // Goal-step user: still NULL — they haven't seen the weight question and should get it.
    expect((await getUser(b, 3))!.weight_kg).toBeNull();
  });
});

describe("openDb + migrations", () => {
  test("auto-creates a missing database and records the schema version", async () => {
    const db = await freshTestDb();
    const rows = await db`SELECT version FROM schema_version`;
    expect(Number(rows[0].version)).toBe(3);
  });

  test("reopening is idempotent — data survives, migrations do not rerun", async () => {
    const name = freshTestName();
    const a = await openTestDb(name);
    await upsertUser(a, { telegram_id: 1, username: "keepme" });
    await a.close();
    const b = await openTestDb(name);
    expect((await getUser(b, 1))?.username).toBe("keepme");
    expect(Number((await b`SELECT version FROM schema_version`)[0].version)).toBe(3);
  });

  test("two concurrent openDb calls on a missing database both succeed (create race)", async () => {
    const name = freshTestName();
    const [a, b] = await Promise.all([openTestDb(name), openTestDb(name)]);
    await upsertUser(a, { telegram_id: 1 });
    expect((await getUser(b, 1))?.telegram_id).toBe(1);
  });
});

describe("users", () => {
  test("upsert then get; new user starts at consent with empty restrictions", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1, username: "a" });
    const u = await getUser(db, 1);
    expect(u?.state).toBe("consent");
    expect(u?.restrictions).toEqual([]);
    expect(u?.consent_at).toBeNull();
  });

  test("a full-size Telegram id (past int32) survives the round trip as a number", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 7_000_000_123, username: "big" });
    const u = await getUser(db, 7_000_000_123);
    expect(u?.telegram_id).toBe(7_000_000_123);
    expect(typeof u?.telegram_id).toBe("number");
  });

  test("upsert is resume-safe — never clobbers consent_at/goal/state", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1, username: "a" });
    await setConsent(db, 1, "2026-07-21T10:00:00Z");
    await setProfile(db, 1, { goal: "lose", restrictions: ["ldl"], state: "active" });
    // a later /start re-upserts — must not reset progress
    await upsertUser(db, { telegram_id: 1, username: "a2" });
    const u = await getUser(db, 1);
    expect(u?.state).toBe("active");
    expect(u?.goal).toBe("lose");
    expect(u?.restrictions).toEqual(["ldl"]);
    expect(u?.consent_at).toBe("2026-07-21T10:00:00Z");
    expect(u?.username).toBe("a2"); // username does update
  });
});

describe("meals + daily totals", () => {
  test("insert meals, sum daily totals for user+date", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis({ kcal: 300, protein_g: 8 }) });
    await insertMeal(db, { id: "m2", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis({ kcal: 500, protein_g: 20 }) });
    await insertMeal(db, { id: "m3", user_id: 1, ts: "t", date: "2026-07-22", analysis: analysis({ kcal: 999 }) });
    const totals = await dailyTotals(db, 1, "2026-07-21");
    expect(totals.kcal).toBe(800);
    expect(totals.protein_g).toBe(28);
    expect(await countMealsToday(db, 1, "2026-07-21")).toBe(2);
  });

  test("empty day totals are zero, not null", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    const totals = await dailyTotals(db, 1, "2026-07-21");
    expect(totals.kcal).toBe(0);
    expect(totals.sodium_mg).toBe(0);
  });

  test("setMealReply then mealByReply routes back to the meal (scoped to sender)", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await upsertUser(db, { telegram_id: 2 });
    await insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
    await setMealReply(db, "m1", 1, 555, 42);
    expect((await mealByReply(db, 1, 42))?.id).toBe("m1");
    // user 2 replying to the same message id must NOT reach user 1's meal
    expect(await mealByReply(db, 2, 42)).toBeUndefined();
  });
});

describe("corrections are scoped", () => {
  test("applyCorrection only touches the matching id+user and sets corrected=1", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await upsertUser(db, { telegram_id: 2 });
    await insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis({ kcal: 300 }) });

    // wrong user cannot correct user 1's meal
    await applyCorrection(db, "m1", 2, { kcal: 9999 });
    expect((await getMeal(db, "m1", 1))?.kcal).toBe(300);
    expect((await getMeal(db, "m1", 1))?.corrected).toBe(false);

    // correct owner can
    await applyCorrection(db, "m1", 1, { kcal: 450, protein_g: 12 });
    const m = await getMeal(db, "m1", 1);
    expect(m?.kcal).toBe(450);
    expect(m?.protein_g).toBe(12);
    expect(m?.corrected).toBe(true);
  });
});

describe("cross-user isolation", () => {
  test("user B cannot read user A's meal by id", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await upsertUser(db, { telegram_id: 2 });
    await insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
    expect((await getMeal(db, "m1", 1))?.id).toBe("m1");
    expect(await getMeal(db, "m1", 2)).toBeUndefined();
  });
});

describe("delete cascade", () => {
  test("deleteUser removes the user and all their meals; other users untouched", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await upsertUser(db, { telegram_id: 2 });
    await insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
    await insertMeal(db, { id: "m2", user_id: 2, ts: "t", date: "2026-07-21", analysis: analysis() });
    await deleteUser(db, 1);
    expect(await getUser(db, 1)).toBeUndefined();
    expect(await getMeal(db, "m1", 1)).toBeUndefined();
    expect((await getUser(db, 2))?.telegram_id).toBe(2);
    expect((await getMeal(db, "m2", 2))?.id).toBe("m2");
  });

  test("deleteUser also purges the user's funnel events — PRIVACY.md promises full erasure", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await upsertUser(db, { telegram_id: 2 });
    await logEvent(db, 1, "start");
    await logEvent(db, 1, "first_photo");
    await logEvent(db, 2, "start");
    await deleteUser(db, 1);
    expect(await eventsFor(db, 1)).toEqual([]);
    expect((await eventsFor(db, 2)).length).toBe(1); // other users' funnels untouched
  });
});

describe("update dedupe", () => {
  test("seenUpdate flips after markUpdate; double-mark is safe", async () => {
    const db = await freshTestDb();
    expect(await seenUpdate(db, 1001)).toBe(false);
    await markUpdate(db, 1001);
    expect(await seenUpdate(db, 1001)).toBe(true);
    await markUpdate(db, 1001); // idempotent, no throw
    expect(await seenUpdate(db, 1001)).toBe(true);
  });
});

describe("admin counts", () => {
  test("userCount and mealCount", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await upsertUser(db, { telegram_id: 2 });
    await insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
    expect(await userCount(db)).toBe(2);
    expect(await mealCount(db)).toBe(1);
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

describe("berlinTime renders HH:MM in the zone, not UTC", () => {
  test("summer (+02:00)", () => {
    expect(berlinTime(new Date("2026-07-21T10:00:00Z"))).toBe("12:00");
  });
  test("winter (+01:00), crossing midnight", () => {
    expect(berlinTime(new Date("2026-01-15T23:30:00Z"))).toBe("00:30");
  });
});

describe("openDb input safety", () => {
  test("a database name outside the safe charset is refused before any SQL runs", async () => {
    const { openDb } = await import("./db.ts");
    await expect(
      openDb({ host: "127.0.0.1", port: 5439, user: "eait", password: "eait", database: 'x"; DROP DATABASE eait;--' }),
    ).rejects.toThrow(/invalid database name/);
  });

  test("a nonexistent role gets the friendly connect error, not the create-database path", async () => {
    const { openDb } = await import("./db.ts");
    // Only a missing DATABASE may trigger auto-create; a missing role/user is a misconfig
    // that must surface as "connect failed", never as a doomed CREATE DATABASE attempt.
    await expect(
      openDb({ host: "127.0.0.1", port: 5439, user: "eait_no_such_role", password: "x", database: "eait_wontmatter" }),
    ).rejects.toThrow(/postgres connect failed/);
  });
});

test("upsertUser stores the seeded language; a re-upsert never overwrites it", async () => {
  const db = await freshTestDb();
  await upsertUser(db, { telegram_id: 1, username: "a", lang: "de" });
  expect((await getUser(db, 1))?.lang).toBe("de");
  // a later /start must not reset a language the user has since changed
  await setLang(db, 1, "ru");
  await upsertUser(db, { telegram_id: 1, username: "a", lang: "de" });
  expect((await getUser(db, 1))?.lang).toBe("ru");
});

test("upsertUser without an explicit language falls back to DEFAULT_LANG", async () => {
  const db = await freshTestDb();
  await upsertUser(db, { telegram_id: 1, username: "a" });
  expect((await getUser(db, 1))?.lang).toBe(DEFAULT_LANG);
});

test("setLang changes only the target user's language", async () => {
  const db = await freshTestDb();
  await upsertUser(db, { telegram_id: 1, username: "a", lang: "en" });
  await upsertUser(db, { telegram_id: 2, username: "b", lang: "en" });
  await setLang(db, 1, "de");
  expect((await getUser(db, 1))?.lang).toBe("de");
  expect((await getUser(db, 2))?.lang).toBe("en");
});

test("setLang on an unknown user is a no-op, not a crash", async () => {
  const db = await freshTestDb();
  await setLang(db, 999, "de");
  expect(await getUser(db, 999)).toBeUndefined();
});

test("mealCountToday counts across ALL users for a date, not per user", async () => {
  const db = await freshTestDb();
  await upsertUser(db, { telegram_id: 1 });
  await upsertUser(db, { telegram_id: 2 });
  await insertMeal(db, { id: "a", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
  await insertMeal(db, { id: "b", user_id: 2, ts: "t", date: "2026-07-21", analysis: analysis() });
  await insertMeal(db, { id: "c", user_id: 2, ts: "t", date: "2026-07-22", analysis: analysis() });
  expect(await mealCountToday(db, "2026-07-21")).toBe(2);
  expect(await mealCountToday(db, "2026-07-22")).toBe(1);
  expect(await mealCountToday(db, "2026-01-01")).toBe(0);
});

describe("settings key/value store", () => {
  test("returns null for an unset key", async () => {
    expect(await getSetting(await freshTestDb(), "global_cap")).toBeNull();
  });

  test("round-trips a value and overwrites on re-set", async () => {
    const db = await freshTestDb();
    await setSetting(db, "global_cap", "200");
    expect(await getSetting(db, "global_cap")).toBe("200");
    await setSetting(db, "global_cap", "50");
    expect(await getSetting(db, "global_cap")).toBe("50");
  });

  test("clearSetting removes the override", async () => {
    const db = await freshTestDb();
    await setSetting(db, "global_cap", "200");
    await clearSetting(db, "global_cap");
    expect(await getSetting(db, "global_cap")).toBeNull();
  });

  test("settings survive reopening the same database", async () => {
    const name = freshTestName();
    const a = await openTestDb(name);
    await setSetting(a, "global_cap", "123");
    await a.close();
    const b = await openTestDb(name); // a restart must not lose the override
    expect(await getSetting(b, "global_cap")).toBe("123");
  });
});

describe("acquisition attribution", () => {
  test("acquisition_source is null by default and set-once — a second code never overwrites", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    expect((await getUser(db, 1))?.acquisition_source).toBeNull();
    await setAcquisitionSource(db, 1, "tt_001");
    expect((await getUser(db, 1))?.acquisition_source).toBe("tt_001");
    await setAcquisitionSource(db, 1, "ig_002"); // later /start with a different code
    expect((await getUser(db, 1))?.acquisition_source).toBe("tt_001");
  });

  test("logEvent appends and eventsFor returns the user's events in order", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await upsertUser(db, { telegram_id: 2 });
    await logEvent(db, 1, "start", "tt_001");
    await logEvent(db, 1, "first_photo");
    await logEvent(db, 2, "start"); // another user's event must not leak into user 1's list
    const events = await eventsFor(db, 1);
    expect(events.map((e) => e.event)).toEqual(["start", "first_photo"]);
    expect(events[0]?.source_code).toBe("tt_001");
    expect(events[1]?.source_code).toBeNull();
    expect(events[0]?.ts).toBeTruthy();
    expect(await eventsFor(db, 2)).toHaveLength(1);
  });
});

describe("funnelByCode (Measure Monday report)", () => {
  test("aggregates users, first photos, D7 retention, cap hits and waitlist per source", async () => {
    const db = await freshTestDb();
    // two tt_001 users: one photographed + retained past day 7, one bounced
    await upsertUser(db, { telegram_id: 1 });
    await setAcquisitionSource(db, 1, "tt_001");
    await logEvent(db, 1, "first_photo");
    await insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2099-01-01", analysis: analysis() });
    await upsertUser(db, { telegram_id: 2 });
    await setAcquisitionSource(db, 2, "tt_001");
    // one organic user who hit the cap twice and joined the waitlist
    await upsertUser(db, { telegram_id: 3 });
    await logEvent(db, 3, "cap_hit");
    await logEvent(db, 3, "cap_hit");
    await logEvent(db, 3, "waitlist_join");

    const rows = await funnelByCode(db);
    const tt = rows.find((r) => r.source === "tt_001");
    expect(tt).toEqual({ source: "tt_001", users: 2, first_photo: 1, d7_retained: 1, cap_hits: 0, waitlist: 0 });
    const organic = rows.find((r) => r.source === "organic");
    expect(organic).toEqual({ source: "organic", users: 1, first_photo: 0, d7_retained: 0, cap_hits: 2, waitlist: 1 });
  });
});

describe("migration v3", () => {
  test("meals.user_message_id round-trips and mealByReply matches either id", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    const id = crypto.randomUUID();
    await insertMeal(db, { id, user_id: 1, ts: "t", date: "2026-07-22", analysis: analysis(), user_message_id: 555 });
    const viaUserMsg = await mealByReply(db, 1, 555);
    expect(viaUserMsg?.user_message_id).toBe(555);
    // still matches via bot_message_id after setMealReply
    await setMealReply(db, id, 1, 10, 777);
    expect((await mealByReply(db, 1, 777))?.id).toBe(id);
    // cross-user probe finds nothing
    expect(await mealByReply(db, 2, 555)).toBeUndefined();
  });

  test("llm_calls counting is per-user and global per date", async () => {
    const db = await freshTestDb();
    await logLlmCall(db, 1, "2026-07-22", "photo");
    await logLlmCall(db, 1, "2026-07-22", "router");
    await logLlmCall(db, 2, "2026-07-22", "router");
    await logLlmCall(db, 1, "2026-07-21", "photo");
    expect(await llmCallsToday(db, 1, "2026-07-22")).toBe(2);
    expect(await llmCallCountToday(db, "2026-07-22")).toBe(3);
  });

  test("pending meals: insert/get/delete are user-scoped; prune drops old rows", async () => {
    const db = await freshTestDb();
    const id = crypto.randomUUID();
    await insertPendingMeal(db, { id, user_id: 1, ts: "2026-07-22T10:00:00.000Z", date: "2026-07-22", analysis: analysis(), model: "m" });
    await setPendingReply(db, id, 1, 10, 42);
    const p = await getPendingMeal(db, id, 1);
    expect(p?.analysis.kcal).toBe(300);
    expect(p?.analysis.items).toEqual([{ name: "rice", grams: 200 }]);
    expect(p?.bot_message_id).toBe(42);
    expect(await getPendingMeal(db, id, 2)).toBeUndefined(); // cross-user
    expect(await deletePendingMeal(db, id, 2)).toBe(false); // cross-user delete no-op
    expect(await deletePendingMeal(db, id, 1)).toBe(true);
    // prune
    const old = crypto.randomUUID();
    await insertPendingMeal(db, { id: old, user_id: 1, ts: "2026-07-20T00:00:00.000Z", date: "2026-07-20", analysis: analysis(), model: null });
    await prunePendingMeals(db, "2026-07-21T00:00:00.000Z");
    expect(await getPendingMeal(db, old, 1)).toBeUndefined();
  });

  test("mealsOnDate and totalsByDate", async () => {
    const db = await freshTestDb();
    await upsertUser(db, { telegram_id: 1 });
    await insertMeal(db, { id: "m1", user_id: 1, ts: "2026-07-21T09:00:00.000Z", date: "2026-07-21", analysis: analysis({ kcal: 300 }) });
    await insertMeal(db, { id: "m2", user_id: 1, ts: "2026-07-22T09:00:00.000Z", date: "2026-07-22", analysis: analysis({ kcal: 500 }) });
    expect((await mealsOnDate(db, 1, "2026-07-22")).length).toBe(1);
    const week = await totalsByDate(db, 1, "2026-07-16", "2026-07-22");
    expect(week.map((r) => r.date)).toEqual(["2026-07-21", "2026-07-22"]);
    expect(week[0].kcal).toBeCloseTo(300);
    expect(week[1].kcal).toBeCloseTo(500);
  });
});
