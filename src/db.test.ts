import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MealAnalysis } from "./types.ts";
import { DEFAULT_LANG } from "./i18n/registry.ts";
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
  markUpdate,
  mealByReply,
  eventsFor,
  logEvent,
  funnelByCode,
  mealCount,
  mealCountToday,
  openDb,
  seenUpdate,
  setAcquisitionSource,
  setConsent,
  setLang,
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
  test("sets PRAGMAs and user_version=3", () => {
    const db = freshDb();
    expect((db.query("PRAGMA user_version").get() as any).user_version).toBe(3);
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

describe("berlinTime renders HH:MM in the zone, not UTC", () => {
  test("summer (+02:00)", () => {
    expect(berlinTime(new Date("2026-07-21T10:00:00Z"))).toBe("12:00");
  });
  test("winter (+01:00), crossing midnight", () => {
    expect(berlinTime(new Date("2026-01-15T23:30:00Z"))).toBe("00:30");
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

test("upsertUser stores the seeded language; a re-upsert never overwrites it", () => {
  const db = freshDb();
  upsertUser(db, { telegram_id: 1, username: "a", lang: "de" });
  expect(getUser(db, 1)?.lang).toBe("de");
  // a later /start must not reset a language the user has since changed
  setLang(db, 1, "ru");
  upsertUser(db, { telegram_id: 1, username: "a", lang: "de" });
  expect(getUser(db, 1)?.lang).toBe("ru");
});

test("upsertUser without an explicit language falls back to DEFAULT_LANG", () => {
  const db = freshDb();
  upsertUser(db, { telegram_id: 1, username: "a" });
  expect(getUser(db, 1)?.lang).toBe(DEFAULT_LANG);
});

test("setLang changes only the target user's language", () => {
  const db = freshDb();
  upsertUser(db, { telegram_id: 1, username: "a", lang: "en" });
  upsertUser(db, { telegram_id: 2, username: "b", lang: "en" });
  setLang(db, 1, "de");
  expect(getUser(db, 1)?.lang).toBe("de");
  expect(getUser(db, 2)?.lang).toBe("en");
});

test("setLang on an unknown user is a no-op, not a crash", () => {
  const db = freshDb();
  expect(() => setLang(db, 999, "de")).not.toThrow();
  expect(getUser(db, 999)).toBeUndefined();
});

test("mealCountToday counts across ALL users for a date, not per user", () => {
  const db = freshDb();
  upsertUser(db, { telegram_id: 1 });
  upsertUser(db, { telegram_id: 2 });
  insertMeal(db, { id: "a", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
  insertMeal(db, { id: "b", user_id: 2, ts: "t", date: "2026-07-21", analysis: analysis() });
  insertMeal(db, { id: "c", user_id: 2, ts: "t", date: "2026-07-22", analysis: analysis() });
  expect(mealCountToday(db, "2026-07-21")).toBe(2);
  expect(mealCountToday(db, "2026-07-22")).toBe(1);
  expect(mealCountToday(db, "2026-01-01")).toBe(0);
});

describe("settings key/value store", () => {
  test("returns null for an unset key", () => {
    expect(getSetting(freshDb(), "global_cap")).toBeNull();
  });

  test("round-trips a value and overwrites on re-set", () => {
    const db = freshDb();
    setSetting(db, "global_cap", "200");
    expect(getSetting(db, "global_cap")).toBe("200");
    setSetting(db, "global_cap", "50");
    expect(getSetting(db, "global_cap")).toBe("50");
  });

  test("clearSetting removes the override", () => {
    const db = freshDb();
    setSetting(db, "global_cap", "200");
    clearSetting(db, "global_cap");
    expect(getSetting(db, "global_cap")).toBeNull();
  });

  test("settings survive reopening the same database file", () => {
    const path = join(tmpdir(), `eait-settings-${crypto.randomUUID()}.sqlite`);
    created.push(path);
    const a = openDb(path);
    setSetting(a, "global_cap", "123");
    a.close();
    const b = openDb(path); // a restart must not lose the override
    expect(getSetting(b, "global_cap")).toBe("123");
    b.close();
  });

  test("migrating an existing v1 database adds settings without touching user data", () => {
    const path = join(tmpdir(), `eait-mig-${crypto.randomUUID()}.sqlite`);
    created.push(path);
    const a = openDb(path);
    upsertUser(a, { telegram_id: 1, username: "keepme" });
    insertMeal(a, { id: "m1", user_id: 1, ts: "t", date: "2026-07-21", analysis: analysis() });
    a.run("DROP TABLE settings");         // simulate a pre-settings database
    a.run("DROP TABLE events");           // v3 artifacts must also be absent in a real v1 db
    a.run("ALTER TABLE users DROP COLUMN acquisition_source");
    a.run("PRAGMA user_version = 1");
    a.close();

    const b = openDb(path);               // reopen: migration should run
    expect(getSetting(b, "global_cap")).toBeNull();
    setSetting(b, "global_cap", "7");
    expect(getSetting(b, "global_cap")).toBe("7");
    expect(getUser(b, 1)?.username).toBe("keepme"); // existing rows intact
    expect(getMeal(b, "m1", 1)?.id).toBe("m1");
    b.close();
  });
});

describe("acquisition attribution", () => {
  test("acquisition_source is null by default and set-once — a second code never overwrites", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1 });
    expect(getUser(db, 1)?.acquisition_source).toBeNull();
    setAcquisitionSource(db, 1, "tt_001");
    expect(getUser(db, 1)?.acquisition_source).toBe("tt_001");
    setAcquisitionSource(db, 1, "ig_002"); // later /start with a different code
    expect(getUser(db, 1)?.acquisition_source).toBe("tt_001");
  });

  test("logEvent appends and eventsFor returns the user's events in order", () => {
    const db = freshDb();
    upsertUser(db, { telegram_id: 1 });
    upsertUser(db, { telegram_id: 2 });
    logEvent(db, 1, "start", "tt_001");
    logEvent(db, 1, "first_photo");
    logEvent(db, 2, "start"); // another user's event must not leak into user 1's list
    const events = eventsFor(db, 1);
    expect(events.map((e) => e.event)).toEqual(["start", "first_photo"]);
    expect(events[0]?.source_code).toBe("tt_001");
    expect(events[1]?.source_code).toBeNull();
    expect(events[0]?.ts).toBeTruthy();
    expect(eventsFor(db, 2)).toHaveLength(1);
  });

  test("migrating an existing v2 database adds events + acquisition_source without touching data", () => {
    const path = join(tmpdir(), `eait-mig3-${crypto.randomUUID()}.sqlite`);
    created.push(path);
    const a = openDb(path);
    upsertUser(a, { telegram_id: 1, username: "keepme" });
    insertMeal(a, { id: "m1", user_id: 1, ts: "t", date: "2026-07-22", analysis: analysis() });
    a.run("DROP TABLE events"); // simulate a pre-attribution database
    a.run("ALTER TABLE users DROP COLUMN acquisition_source");
    a.run("PRAGMA user_version = 2");
    a.close();

    const b = openDb(path); // reopen: migration should run
    logEvent(b, 1, "start", "tt_001");
    setAcquisitionSource(b, 1, "tt_001");
    expect(getUser(b, 1)?.acquisition_source).toBe("tt_001");
    expect(getUser(b, 1)?.username).toBe("keepme"); // existing rows intact
    expect(getMeal(b, "m1", 1)?.id).toBe("m1");
    b.close();
  });
});

describe("funnelByCode (Measure Monday report)", () => {
  test("aggregates users, first photos, D7 retention, cap hits and waitlist per source", () => {
    const db = freshDb();
    // two tt_001 users: one photographed + retained past day 7, one bounced
    upsertUser(db, { telegram_id: 1 });
    setAcquisitionSource(db, 1, "tt_001");
    logEvent(db, 1, "first_photo");
    insertMeal(db, { id: "m1", user_id: 1, ts: "t", date: "2099-01-01", analysis: analysis() });
    upsertUser(db, { telegram_id: 2 });
    setAcquisitionSource(db, 2, "tt_001");
    // one organic user who hit the cap twice and joined the waitlist
    upsertUser(db, { telegram_id: 3 });
    logEvent(db, 3, "cap_hit");
    logEvent(db, 3, "cap_hit");
    logEvent(db, 3, "waitlist_join");

    const rows = funnelByCode(db);
    const tt = rows.find((r) => r.source === "tt_001");
    expect(tt).toEqual({ source: "tt_001", users: 2, first_photo: 1, d7_retained: 1, cap_hits: 0, waitlist: 0 });
    const organic = rows.find((r) => r.source === "organic");
    expect(organic).toEqual({ source: "organic", users: 1, first_photo: 0, d7_retained: 0, cap_hits: 2, waitlist: 1 });
    db.close();
  });
});
