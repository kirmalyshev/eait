import { test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, getUser, mealByReply, countMealsToday, berlinDate, type UserRow } from "./db.ts";
import {
  processOnboarding, processPhoto, processCorrection, meCard, statsCard, type BotDeps, type Send,
} from "./bot.ts";
import type { Config } from "./config.ts";
import type { LLMProvider } from "./llm/provider.ts";

const cfg: Config = {
  telegramBotToken: "x", openrouterApiKey: "x", llmProvider: "openrouter", llmModel: "test",
  llmTimeoutMs: 1000, dbPath: ":memory:", photoDir: "./photos", tz: "Europe/Berlin",
  perUserDailyPhotoCap: 2, adminUserId: 42,
};

function tmpDb() {
  return openDb(join(mkdtempSync(join(tmpdir(), "eait-")), "t.sqlite"));
}

const foodJson = (kcal = 600) =>
  JSON.stringify({
    isFood: true, items: [{ name: "гречка", grams: 180 }], kcal, protein_g: 40, carbs_g: 60,
    fat_g: 15, satfat_g: 3, fiber_g: 8, sugar_g: 5, sodium_mg: 400, plant_protein_pct: 45,
    verdicts: { weight: "good" }, confidence: "med", notes: "",
  });

const fakeProvider = (out: string): LLMProvider => ({ chat: async () => out });

function collector() {
  const msgs: string[] = [];
  const send: Send = async (t) => {
    msgs.push(t);
    return { chat_id: 1, message_id: msgs.length };
  };
  return { msgs, send };
}
const noop: Send = async () => undefined;

async function onboardToActive(deps: BotDeps, id: number) {
  await processOnboarding(deps, { id }, { type: "command", command: "start" }, noop);
  await processOnboarding(deps, { id }, { type: "callback", data: "consent_agree" }, noop);
  await processOnboarding(deps, { id }, { type: "callback", data: "goal_lose" }, noop);
  await processOnboarding(deps, { id }, { type: "callback", data: "restrictions_skip" }, noop);
}

test("onboarding drives consent → profile → active", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 100);
  const u = getUser(db, 100) as UserRow;
  expect(u.state).toBe("active");
  expect(u.goal).toBe("lose");
});

test("processPhoto rejects a non-active user (no row written)", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 1 }, async () => new Uint8Array([1]), send);
  expect(msgs[0]).toContain("/start");
  expect(countMealsToday(db, 1, berlinDate(new Date(), cfg.tz))).toBe(0);
});

test("processPhoto (active) inserts a meal, replies with the daily total, sets reply id", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: cfg };
  await onboardToActive(deps, 7);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 7 }, async () => new Uint8Array([1]), send);
  expect(msgs[0]).toContain("600");
  expect(countMealsToday(db, 7, berlinDate(new Date(), cfg.tz))).toBe(1);
  expect(mealByReply(db, 7, 1)).toBeDefined(); // reply msg id 1 → this meal
});

test("processPhoto enforces the per-user daily cap", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 1 } };
  await onboardToActive(deps, 9);
  const c1 = collector();
  await processPhoto(deps, { id: 9 }, async () => new Uint8Array([1]), c1.send);
  const c2 = collector();
  await processPhoto(deps, { id: 9 }, async () => new Uint8Array([1]), c2.send);
  expect(c2.msgs[0]).toContain("Лимит");
});

test("processCorrection updates the matched meal; false when the reply matches nothing", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: cfg };
  await onboardToActive(deps, 5);
  const { send } = collector();
  await processPhoto(deps, { id: 5 }, async () => new Uint8Array([1]), send); // meal reply id = 1
  deps.provider = fakeProvider(foodJson(900)); // correction re-estimate returns 900
  const cc = collector();
  const handled = await processCorrection(deps, { id: 5 }, 1, "2 куска, без масла", cc.send);
  expect(handled).toBe(true);
  expect(cc.msgs[0]).toContain("900");
  const handled2 = await processCorrection(deps, { id: 5 }, 999, "x", noop);
  expect(handled2).toBe(false);
});

test("meCard is null unless active; statsCard counts users+meals", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  expect(meCard(deps, 1)).toBeNull();
  await onboardToActive(deps, 3);
  expect(meCard(deps, 3)).toContain("цель");
  expect(statsCard(deps)).toContain("Пользователей: 1");
});
