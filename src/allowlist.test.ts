import { afterAll, describe, expect, test } from "bun:test";
import { loadAllowlist } from "./allowlist.ts";
import { getSetting, setSetting } from "./db.ts";
import { cleanupTestDbs, freshTestDb } from "./testutil.ts";

afterAll(cleanupTestDbs, 60_000);

const open = { allowedUserIds: null as number[] | null };
const seeded = { allowedUserIds: [10, 20] as number[] | null };

describe("loadAllowlist semantics", () => {
  test("no stored list + no env list = open: everyone admitted, unknown sender refused only when closed", async () => {
    const db = await freshTestDb();
    const al = await loadAllowlist(db, open);
    expect(al.isOpen()).toBe(true);
    expect(al.has(1)).toBe(true);
    expect(al.has(undefined)).toBe(true); // mirrors isAllowed: open bot admits unidentifiable senders
    expect(al.list()).toBeNull();
  });

  test("env seed enforced when nothing is stored — including against unknown ids", async () => {
    const db = await freshTestDb();
    const al = await loadAllowlist(db, seeded);
    expect(al.isOpen()).toBe(false);
    expect(al.has(10)).toBe(true);
    expect(al.has(11)).toBe(false);
    expect(al.has(undefined)).toBe(false);
    expect(al.list()).toEqual([10, 20]);
  });

  test("a stored list overrides the env seed entirely", async () => {
    const db = await freshTestDb();
    await setSetting(db, "allowed_user_ids", JSON.stringify([99]));
    const al = await loadAllowlist(db, seeded);
    expect(al.has(99)).toBe(true);
    expect(al.has(10)).toBe(false); // env-seeded id is gone once the stored list owns access
  });

  test("a stored EMPTY list means nobody, not open", async () => {
    const db = await freshTestDb();
    await setSetting(db, "allowed_user_ids", "[]");
    const al = await loadAllowlist(db, open);
    expect(al.isOpen()).toBe(false);
    expect(al.has(1)).toBe(false);
  });

  test("corrupt stored JSON falls back to the env seed rather than opening the bot", async () => {
    const db = await freshTestDb();
    await setSetting(db, "allowed_user_ids", "not-json");
    const al = await loadAllowlist(db, seeded);
    expect(al.has(10)).toBe(true);
    expect(al.has(11)).toBe(false);
  });
});

describe("add / remove", () => {
  test("add on an open bot starts a closed list containing exactly the added id", async () => {
    const db = await freshTestDb();
    const al = await loadAllowlist(db, open);
    await al.add(7);
    expect(al.isOpen()).toBe(false);
    expect(al.has(7)).toBe(true);
    expect(al.has(8)).toBe(false);
  });

  test("add extends an env-seeded list and persists the union", async () => {
    const db = await freshTestDb();
    const al = await loadAllowlist(db, seeded);
    await al.add(30);
    expect(al.list()).toEqual([10, 20, 30]);
    // persisted: a fresh load (a restart) sees the same list without the env seed's help
    const al2 = await loadAllowlist(db, open);
    expect(al2.list()).toEqual([10, 20, 30]);
  });

  test("add is idempotent", async () => {
    const db = await freshTestDb();
    const al = await loadAllowlist(db, seeded);
    await al.add(10);
    expect(al.list()).toEqual([10, 20]);
  });

  test("remove materializes the env seed minus the id, and persists", async () => {
    const db = await freshTestDb();
    const al = await loadAllowlist(db, seeded);
    await al.remove(10);
    expect(al.has(10)).toBe(false);
    expect(al.has(20)).toBe(true);
    const al2 = await loadAllowlist(db, seeded); // restart: env seed must NOT resurrect 10
    expect(al2.has(10)).toBe(false);
  });

  test("remove on an open bot is a no-op that keeps the bot open", async () => {
    const db = await freshTestDb();
    const al = await loadAllowlist(db, open);
    await al.remove(5);
    expect(al.isOpen()).toBe(true);
    expect(await getSetting(db, "allowed_user_ids")).toBeNull();
  });
});
