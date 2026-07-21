import { test, expect } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openDb, getUser, mealByReply, countMealsToday, mealCountToday, berlinDate, type UserRow } from "../db.ts";
import {
  processOnboarding, processPhoto, processCorrection, meCard, statsCard, profileOf,
  processLangPrompt, processLangChoice, buildCommands, processSettingsOpen,
  processSettingsCallback, helpText, commandRegistrations, isAllowed,
  type BotDeps, type Send, type Edit,
} from "./bot.ts";
import { DEFAULT_LANG, LANGS, translatorFor } from "../i18n/index.ts";
import type { Config } from "../config.ts";
import type { LLMProvider } from "../llm/provider.ts";

const cfg: Config = {
  telegramBotToken: "x", openrouterApiKey: "x", llmProvider: "openrouter", llmModel: "test",
  llmTimeoutMs: 1000, dbPath: ":memory:", photoDir: "./photos", tz: "Europe/Berlin",
  perUserDailyPhotoCap: 2, adminUserId: 42, allowedUserIds: null, globalDailyAnalysisCap: null,
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
  expect(c2.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.dailyCap"));
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
  expect(meCard(deps, 3)).toContain(translatorFor(DEFAULT_LANG)("me.goal.lose"));
  expect(statsCard(deps, "ru")).toContain("1 пользователь");
});

// ---------- language ----------

test("profileOf accepts any registered locale and falls back for anything else", () => {
  const base = { telegram_id: 1, username: null, state: "active", consent_at: null, goal: null, restrictions: [], created_at: "t" };
  expect(profileOf({ ...base, lang: "de" } as UserRow).lang).toBe("de");
  expect(profileOf({ ...base, lang: "ru" } as UserRow).lang).toBe("ru");
  // a value that predates (or outlives) the registry must not render as a raw key
  expect(profileOf({ ...base, lang: "klingon" } as UserRow).lang).toBe(DEFAULT_LANG);
  expect(profileOf({ ...base, lang: "" } as UserRow).lang).toBe(DEFAULT_LANG);
});

test("first contact seeds the language from Telegram's language_code", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const { msgs, send } = collector();
  await processOnboarding(deps, { id: 50, language_code: "de-AT" }, { type: "command", command: "start" }, send);
  expect(getUser(db, 50)?.lang).toBe("de");
  expect(msgs[0]).toBe(translatorFor("de")("onboarding.consent"));
});

test("an unsupported language_code falls back without breaking onboarding", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const { msgs, send } = collector();
  await processOnboarding(deps, { id: 51, language_code: "pt-BR" }, { type: "command", command: "start" }, send);
  expect(getUser(db, 51)?.lang).toBe(DEFAULT_LANG);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("onboarding.consent"));
});

test("/lang lists every registered locale", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 60);
  const seen: string[][] = [];
  const send: Send = async (_t, buttons) => {
    seen.push((buttons ?? []).flat().map((b) => b.data));
    return { chat_id: 1, message_id: 1 };
  };
  await processLangPrompt(deps, { id: 60 }, send);
  expect(seen[0]).toEqual(expect.arrayContaining(LANGS.map((l) => `lang_${l}`)));
});

test("/lang change switches the user's language and confirms in the NEW one", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 61);
  const { msgs, send } = collector();
  await processLangChoice(deps, { id: 61 }, "lang_de", send);
  expect(getUser(db, 61)?.lang).toBe("de");
  expect(msgs[0]).toBe(translatorFor("de")("lang.changed"));
});

test("/lang ignores an unregistered code instead of storing it", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 62);
  const before = getUser(db, 62)?.lang;
  const { send } = collector();
  await processLangChoice(deps, { id: 62 }, "lang_klingon", send);
  expect(getUser(db, 62)?.lang).toBe(before);
});

test("a user's language drives every bot-emitted string", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 1 } };
  await onboardToActive(deps, 70);
  await processLangChoice(deps, { id: 70 }, "lang_de", noop);
  const tde = translatorFor("de");

  const c1 = collector();
  await processPhoto(deps, { id: 70 }, async () => new Uint8Array([1]), c1.send);
  expect(c1.msgs[0]).toContain(tde("meal.correctionHint"));

  const c2 = collector(); // over the cap now
  await processPhoto(deps, { id: 70 }, async () => new Uint8Array([1]), c2.send);
  expect(c2.msgs[0]).toBe(tde("errors.dailyCap"));

  const c3 = collector(); // not food
  deps.provider = fakeProvider(JSON.stringify({ isFood: false }));
  await processPhoto(deps, { id: 71 }, async () => new Uint8Array([1]), c3.send);
  expect(c3.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.notOnboarded")); // 71 never onboarded
});

test("analysis failure is reported in the user's language and writes no row", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: { chat: async () => "not json" }, config: cfg };
  await onboardToActive(deps, 80);
  await processLangChoice(deps, { id: 80 }, "lang_de", noop);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 80 }, async () => new Uint8Array([1]), send);
  expect(msgs[0]).toBe(translatorFor("de")("errors.analyzeFailed"));
  expect(countMealsToday(db, 80, berlinDate(new Date(), cfg.tz))).toBe(0);
});

test("meCard and statsCard render in the user's language, with correct plurals", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 90);
  await processLangChoice(deps, { id: 90 }, "lang_de", noop);
  const card = meCard(deps, 90) as string;
  expect(card).toContain(translatorFor("de")("me.goal.lose"));
  expect(card).not.toMatch(/me\.[a-zA-Z.]+/);

  // ru plural categories differ at 1 / 2 / 5 — a wrong plural key shows up here
  const tru = translatorFor("ru");
  expect(tru("stats.users", { count: 1 })).not.toBe(tru("stats.users", { count: 2 }));
  expect(tru("stats.users", { count: 2 })).not.toBe(tru("stats.users", { count: 5 }));
  expect(statsCard(deps, "ru")).toContain(tru("stats.users", { count: 1 }));
});

test("no locale leaks a raw key through any bot card", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 95);
  for (const lang of LANGS) {
    await processLangChoice(deps, { id: 95 }, `lang_${lang}`, noop);
    expect(meCard(deps, 95)).not.toMatch(/\b(me|meal|errors|stats)\.[a-zA-Z.]+/);
    expect(statsCard(deps, lang)).not.toMatch(/\b(me|meal|errors|stats)\.[a-zA-Z.]+/);
  }
});

// ---------- restriction classification fallback ----------

/** A provider that records whether it was consulted at all. */
function countingProvider(out: string) {
  let calls = 0;
  return { p: { chat: async () => { calls++; return out; } } as LLMProvider, calls: () => calls };
}

async function toRestrictionsStep(deps: BotDeps, id: number, language_code?: string) {
  await processOnboarding(deps, { id, language_code }, { type: "command", command: "start" }, noop);
  await processOnboarding(deps, { id }, { type: "callback", data: "consent_agree" }, noop);
  await processOnboarding(deps, { id }, { type: "callback", data: "goal_lose" }, noop);
}

test("a keyword match short-circuits — the classifier is never consulted", async () => {
  const db = tmpDb();
  const { p, calls } = countingProvider(JSON.stringify({ tags: ["vegan"] }));
  const deps: BotDeps = { db, provider: p, config: cfg };
  await toRestrictionsStep(deps, 200);
  await processOnboarding(deps, { id: 200 }, { type: "text", text: "почки" }, noop);
  expect(getUser(db, 200)?.restrictions).toEqual(["kidneys"]);
  expect(calls()).toBe(0);
});

test("a keyword miss falls back to the classifier — German text still yields tags", async () => {
  const db = tmpDb();
  const { p, calls } = countingProvider(JSON.stringify({ tags: ["kidneys", "lowsugar"] }));
  const deps: BotDeps = { db, provider: p, config: cfg };
  await toRestrictionsStep(deps, 201, "de");
  await processOnboarding(deps, { id: 201 }, { type: "text", text: "Nieren, kein Zucker" }, noop);
  expect(getUser(db, 201)?.restrictions).toEqual(["kidneys", "lowsugar"]);
  expect(calls()).toBe(1);
  expect(getUser(db, 201)?.state).toBe("active");
});

test("a classifier failure leaves restrictions empty but still completes onboarding", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: { chat: async () => { throw new Error("down"); } }, config: cfg };
  await toRestrictionsStep(deps, 202, "de");
  const { msgs, send } = collector();
  await processOnboarding(deps, { id: 202 }, { type: "text", text: "Nieren" }, send);
  expect(getUser(db, 202)?.restrictions).toEqual([]);
  expect(getUser(db, 202)?.state).toBe("active");
  expect(msgs[0]).toBe(translatorFor("de")("onboarding.done"));
});

test("the classifier is not consulted for non-restriction steps", async () => {
  const db = tmpDb();
  const { p, calls } = countingProvider(JSON.stringify({ tags: ["vegan"] }));
  const deps: BotDeps = { db, provider: p, config: cfg };
  // text typed during consent is a nudge, not a restriction declaration
  await processOnboarding(deps, { id: 203 }, { type: "command", command: "start" }, noop);
  await processOnboarding(deps, { id: 203 }, { type: "text", text: "hello there" }, noop);
  expect(calls()).toBe(0);
});

test("skipping restrictions never consults the classifier", async () => {
  const db = tmpDb();
  const { p, calls } = countingProvider(JSON.stringify({ tags: ["vegan"] }));
  const deps: BotDeps = { db, provider: p, config: cfg };
  await toRestrictionsStep(deps, 204);
  await processOnboarding(deps, { id: 204 }, { type: "callback", data: "restrictions_skip" }, noop);
  expect(getUser(db, 204)?.restrictions).toEqual([]);
  expect(calls()).toBe(0);
});

test("/me renders restriction tags as localized names, not raw identifiers", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await processOnboarding(deps, { id: 300, language_code: "de" }, { type: "command", command: "start" }, noop);
  await processOnboarding(deps, { id: 300 }, { type: "callback", data: "consent_agree" }, noop);
  await processOnboarding(deps, { id: 300 }, { type: "callback", data: "goal_lose" }, noop);
  await processOnboarding(deps, { id: 300 }, { type: "text", text: "почки, холестерин" }, noop);

  const card = meCard(deps, 300) as string;
  expect(card).toContain("Nieren");
  expect(card).toContain("Cholesterin");
  expect(card).not.toContain("kidneys"); // the storage identifier must not reach the user
  expect(card).not.toContain("ldl");
});

test("an unknown stored tag degrades to itself rather than throwing", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 301);
  // a tag written by an older build that the catalog has no name for
  db.query("UPDATE users SET restrictions = ? WHERE telegram_id = ?").run('["gluten"]', 301);
  expect(() => meCard(deps, 301)).not.toThrow();
  expect(meCard(deps, 301)).toContain("gluten");
});

// ---------- commands & settings ----------

function editor() {
  const edits: { text: string; data: string[] }[] = [];
  const edit: Edit = async (text, buttons) => {
    edits.push({ text, data: (buttons ?? []).flat().map((b) => b.data) });
  };
  return { edits, edit, last: () => edits[edits.length - 1]! };
}

test("buildCommands lists the menu commands, localized, with no blanks", () => {
  for (const lang of LANGS) {
    const cmds = buildCommands(translatorFor(lang));
    expect(cmds.map((c) => c.command)).toEqual(["start", "me", "settings", "help", "delete"]);
    for (const c of cmds) {
      expect(c.description.trim()).not.toBe("");
      expect(c.description).not.toMatch(/commands\./); // a missing key would leak here
      expect(c.description.length).toBeLessThanOrEqual(256); // Telegram's cap
    }
  }
  // descriptions must actually differ per locale, not silently fall back
  expect(buildCommands(translatorFor("de"))[0]!.description)
    .not.toBe(buildCommands(translatorFor("ru"))[0]!.description);
});

test("/settings is refused until onboarding is finished", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const { msgs, send } = collector();
  await processSettingsOpen(deps, { id: 400 }, send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.notOnboarded"));
});

test("/settings opens the root view with the three sections", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 401);
  const seen: string[][] = [];
  const send: Send = async (_t, buttons) => {
    seen.push((buttons ?? []).flat().map((b) => b.data));
    return { chat_id: 1, message_id: 1 };
  };
  await processSettingsOpen(deps, { id: 401 }, send);
  expect(seen[0]).toEqual(["st:goal", "st:restr", "st:lang"]);
});

test("choosing a goal persists it and edits the message in place", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 402); // onboards as 'lose'
  const { edits, edit, last } = editor();
  await processSettingsCallback(deps, { id: 402 }, "st:goal:maintain", edit);
  expect(getUser(db, 402)?.goal).toBe("maintain");
  expect(edits).toHaveLength(1); // edited, not appended
  expect(last().data).toEqual(["st:goal", "st:restr", "st:lang"]); // back at root
});

test("toggling a restriction twice persists on and then off, with no new messages", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 403);
  const { edits, edit } = editor();
  await processSettingsCallback(deps, { id: 403 }, "st:restr:kidneys", edit);
  expect(getUser(db, 403)?.restrictions).toEqual(["kidneys"]);
  await processSettingsCallback(deps, { id: 403 }, "st:restr:kidneys", edit);
  expect(getUser(db, 403)?.restrictions).toEqual([]);
  expect(edits).toHaveLength(2); // two edits, zero sends
});

test("a restriction toggled in settings reaches the analyzer prompt and the targets", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 404);
  const { edit } = editor();
  await processSettingsCallback(deps, { id: 404 }, "st:restr:kidneys", edit);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 404 }, async () => new Uint8Array([1]), send);
  // the sodium cap line only exists when a kidneys restriction is declared
  expect(msgs[0]).toContain("2000");
});

test("changing the language from settings re-renders the root in the new language", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 405);
  const { edit, last } = editor();
  await processSettingsCallback(deps, { id: 405 }, "st:lang:de", edit);
  expect(getUser(db, 405)?.lang).toBe("de");
  expect(last().text).toContain(translatorFor("de")("settings.title"));
});

test("settings callbacks from a non-active user change nothing", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await processOnboarding(deps, { id: 406 }, { type: "command", command: "start" }, noop);
  const { edits, edit } = editor();
  await processSettingsCallback(deps, { id: 406 }, "st:goal:gain", edit);
  expect(getUser(db, 406)?.goal).toBeNull();
  expect(edits).toHaveLength(0);
});

test("/help works before onboarding, in the language of the Telegram client", () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const body = helpText(deps, { id: 407, language_code: "de" });
  expect(body).toBe(translatorFor("de")("help.body"));
  expect(body).toContain("/settings"); // command list is part of it
});

test("/help follows a stored language over the client's", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 408);
  await processLangChoice(deps, { id: 408 }, "lang_ru", noop);
  expect(helpText(deps, { id: 408, language_code: "de" })).toBe(translatorFor("ru")("help.body"));
});

test("command registrations cover every locale, for the default scope and the admin's", () => {
  const plan = commandRegistrations({ ...cfg, adminUserId: 42 });
  const defaults = plan.filter((r) => !r.options.scope);
  const admin = plan.filter((r) => r.options.scope);

  expect(defaults.map((r) => r.options.language_code).sort()).toEqual([...LANGS].sort());
  // Chat scope OUTRANKS default, so the admin must get every locale too — registering the
  // admin in one language only would replace their localized menu with that language.
  expect(admin.map((r) => r.options.language_code).sort()).toEqual([...LANGS].sort());
  for (const r of admin) {
    expect(r.commands.map((c) => c.command)).toContain("stats");
    expect(r.options.scope).toEqual({ type: "chat", chat_id: 42 });
  }
  for (const r of defaults) expect(r.commands.map((c) => c.command)).not.toContain("stats");
});

test("registrations for the admin are in the admin's own language, not a fixed one", () => {
  const plan = commandRegistrations({ ...cfg, adminUserId: 42 });
  const ru = plan.find((r) => r.options.scope && r.options.language_code === "ru")!;
  expect(ru.commands.find((c) => c.command === "stats")!.description)
    .toBe(translatorFor("ru")("commands.stats"));
});

test("no admin registrations when no admin is configured", () => {
  const plan = commandRegistrations({ ...cfg, adminUserId: null });
  expect(plan.filter((r) => r.options.scope)).toEqual([]);
  expect(plan).toHaveLength(LANGS.length);
});

// ---------- access control ----------

test("with no allowlist configured, everyone is admitted", () => {
  const open = { ...cfg, allowedUserIds: null };
  expect(isAllowed(open, 1)).toBe(true);
  expect(isAllowed(open, 999999)).toBe(true);
});

test("with an allowlist, only listed ids are admitted", () => {
  const closed = { ...cfg, allowedUserIds: [10, 20] };
  expect(isAllowed(closed, 10)).toBe(true);
  expect(isAllowed(closed, 20)).toBe(true);
  expect(isAllowed(closed, 11)).toBe(false);
});

test("an empty allowlist admits nobody, including the admin", () => {
  // an all-junk ALLOWED_USER_IDS lands here; it must fail closed
  const nobody = { ...cfg, allowedUserIds: [], adminUserId: 42 };
  expect(isAllowed(nobody, 42)).toBe(false);
  expect(isAllowed(nobody, 1)).toBe(false);
});

test("an unidentifiable sender is never admitted when an allowlist exists", () => {
  expect(isAllowed({ ...cfg, allowedUserIds: [10] }, undefined)).toBe(false);
  expect(isAllowed({ ...cfg, allowedUserIds: null }, undefined)).toBe(true);
});

// ---------- global spend cap ----------

test("the global cap blocks analysis once the day's total is reached, across users", async () => {
  const db = tmpDb();
  // per-user cap high, global cap low: proves the global one is what bites
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 50, globalDailyAnalysisCap: 2 } };
  await onboardToActive(deps, 1);
  await onboardToActive(deps, 2);
  await onboardToActive(deps, 3);

  await processPhoto(deps, { id: 1 }, async () => new Uint8Array([1]), noop);
  await processPhoto(deps, { id: 2 }, async () => new Uint8Array([1]), noop);
  const date = berlinDate(new Date(), cfg.tz);
  expect(mealCountToday(db, date)).toBe(2);

  // a THIRD user, well under their own cap, is refused because the day is spent
  const c = collector();
  await processPhoto(deps, { id: 3 }, async () => new Uint8Array([1]), c.send);
  expect(c.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.globalCap"));
  expect(mealCountToday(db, date)).toBe(2); // no row written
});

test("the global cap is checked BEFORE the model is called, so it actually saves money", async () => {
  const db = tmpDb();
  let calls = 0;
  const counting: LLMProvider = { chat: async () => { calls++; return foodJson(); } };
  const deps: BotDeps = { db, provider: counting, config: { ...cfg, globalDailyAnalysisCap: 0 } };
  await onboardToActive(deps, 1);
  await processPhoto(deps, { id: 1 }, async () => new Uint8Array([1]), noop);
  expect(calls).toBe(0); // a cap that fires after the call would be decorative
});

test("no global cap configured means unlimited", async () => {
  const db = tmpDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 50, globalDailyAnalysisCap: null } };
  await onboardToActive(deps, 1);
  for (let i = 0; i < 5; i++) await processPhoto(deps, { id: 1 }, async () => new Uint8Array([1]), noop);
  expect(mealCountToday(db, berlinDate(new Date(), cfg.tz))).toBe(5);
});

test("the cap message points at self-hosting rather than just refusing", () => {
  for (const lang of LANGS) {
    const msg = translatorFor(lang)("errors.globalCap");
    expect(msg.trim()).not.toBe("");
    expect(msg).not.toMatch(/errors\./);
  }
});
