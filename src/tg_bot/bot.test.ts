import { afterAll, test, expect } from "bun:test";
import { getUser, mealByReply, countMealsToday, mealCountToday, berlinDate, setSetting, eventsFor, type UserRow } from "../db.ts";
import { loadAllowlist } from "../allowlist.ts";
import { cleanupTestDbs, freshTestDb } from "../testutil.ts";
import {
  processOnboarding, processPhoto, processCorrection, meCard, statsCard, profileOf,
  processLangPrompt, processLangChoice, buildCommands, processSettingsOpen,
  processSettingsCallback, helpText, commandRegistrations, isAllowed,
  processCap, effectiveGlobalCap, processWaitlist,
  createBot, startBot, adminLangFor, isFatalTelegramError, describeError, processDocument,
  type BotDeps, type Send, type Edit,
} from "./bot.ts";
import { DEFAULT_LANG, LANGS, translatorFor } from "../i18n/index.ts";
import type { Config } from "../config.ts";
import type { LLMProvider } from "../llm/provider.ts";

const cfg: Config = {
  telegramBotToken: "x", openrouterApiKey: "x", llmProvider: "openrouter", llmModel: "test",
  llmTimeoutMs: 1000, tz: "Europe/Berlin",
  // Never connected: every test injects an already-open db. Only the startBot ordering test
  // uses it, overriding the port to something unreachable.
  pg: { host: "127.0.0.1", port: 5439, user: "eait", password: "eait", database: "eait_test_cfg_unused" },
  perUserDailyPhotoCap: 2, adminUserId: 42, allowedUserIds: null, globalDailyAnalysisCap: null,
};

afterAll(cleanupTestDbs, 60_000);

const foodJson = (kcal = 600) =>
  JSON.stringify({
    isFood: true, items: [{ name: "гречка", grams: 180 }], kcal, protein_g: 40, carbs_g: 60,
    fat_g: 15, satfat_g: 3, fiber_g: 8, sugar_g: 5, sodium_mg: 400, plant_protein_pct: 45,
    verdicts: { weight: "good" }, confidence: "medium", notes: "",
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
  await processOnboarding(deps, { id }, { type: "text", text: "92" }, noop);
  await processOnboarding(deps, { id }, { type: "callback", data: "restrictions_skip" }, noop);
}

test("onboarding drives consent → profile → active", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 100);
  const u = (await getUser(db, 100)) as UserRow;
  expect(u.state).toBe("active");
  expect(u.goal).toBe("lose");
  expect(u.weight_kg).toBe(92);
});

test("onboarding with a skipped weight still reaches active, weight stored as 0", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await processOnboarding(deps, { id: 101 }, { type: "command", command: "start" }, noop);
  await processOnboarding(deps, { id: 101 }, { type: "callback", data: "consent_agree" }, noop);
  await processOnboarding(deps, { id: 101 }, { type: "callback", data: "goal_lose" }, noop);
  await processOnboarding(deps, { id: 101 }, { type: "callback", data: "weight_skip" }, noop);
  await processOnboarding(deps, { id: 101 }, { type: "callback", data: "restrictions_skip" }, noop);
  const u = (await getUser(db, 101)) as UserRow;
  expect(u.state).toBe("active");
  expect(u.weight_kg).toBe(0);
});

test("processPhoto rejects a non-active user (no row written)", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 1 }, async () => new Uint8Array([1]), send);
  expect(msgs[0]).toContain("/start");
  expect(await countMealsToday(db, 1, berlinDate(new Date(), cfg.tz))).toBe(0);
});

test("processPhoto (active) inserts a meal, replies with the daily total, sets reply id", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: cfg };
  await onboardToActive(deps, 7);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 7 }, async () => new Uint8Array([1]), send);
  expect(msgs[0]).toContain("600");
  expect(await countMealsToday(db, 7, berlinDate(new Date(), cfg.tz))).toBe(1);
  expect(await mealByReply(db, 7, 1)).toBeDefined(); // reply msg id 1 → this meal
});

test("processPhoto enforces the per-user daily cap", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 1 } };
  await onboardToActive(deps, 9);
  const c1 = collector();
  await processPhoto(deps, { id: 9 }, async () => new Uint8Array([1]), c1.send);
  const c2 = collector();
  await processPhoto(deps, { id: 9 }, async () => new Uint8Array([1]), c2.send);
  expect(c2.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.dailyCap"));
});

test("processPhoto forwards the caption and Berlin local time into the analysis prompt", async () => {
  const db = await freshTestDb();
  let seen = "";
  const provider: LLMProvider = { chat: async (req) => ((seen = req.userText), foodJson()) };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 11);
  await processPhoto(deps, { id: 11 }, async () => new Uint8Array([1]), noop, { caption: "борщ со сметаной" });
  expect(seen).toContain("борщ со сметаной");
  expect(seen).toMatch(/Local time of the meal: \d{2}:\d{2}/);
});

test("processPhoto without a caption still injects the local time", async () => {
  const db = await freshTestDb();
  let seen = "";
  const provider: LLMProvider = { chat: async (req) => ((seen = req.userText), foodJson()) };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 12);
  await processPhoto(deps, { id: 12 }, async () => new Uint8Array([1]), noop);
  expect(seen).not.toContain("captioned");
  expect(seen).toMatch(/Local time of the meal: \d{2}:\d{2}/);
});

test("processDocument forwards the caption like the photo path does", async () => {
  const db = await freshTestDb();
  let seen = "";
  const provider: LLMProvider = { chat: async (req) => ((seen = req.userText), foodJson()) };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 13);
  await processDocument(
    deps, { id: 13 }, { mime_type: "image/jpeg", file_size: 100 },
    async () => new Uint8Array([1]), noop, { caption: "овсянка на воде" },
  );
  expect(seen).toContain("овсянка на воде");
});

test("processCorrection updates the matched meal; false when the reply matches nothing", async () => {
  const db = await freshTestDb();
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
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  expect(await meCard(deps, 1)).toBeNull();
  await onboardToActive(deps, 3);
  expect(await meCard(deps, 3)).toContain(translatorFor(DEFAULT_LANG)("me.goal.lose"));
  expect(await statsCard(deps, "ru")).toContain("1 пользователь");
});

// ---------- language ----------

test("profileOf accepts any registered locale and falls back for anything else", () => {
  const base = { telegram_id: 1, username: null, state: "active", consent_at: null, goal: null, weight_kg: null, restrictions: [], created_at: "t", acquisition_source: null };
  expect(profileOf({ ...base, lang: "de" } as UserRow).lang).toBe("de");
  expect(profileOf({ ...base, lang: "ru" } as UserRow).lang).toBe("ru");
  // a value that predates (or outlives) the registry must not render as a raw key
  expect(profileOf({ ...base, lang: "klingon" } as UserRow).lang).toBe(DEFAULT_LANG);
  expect(profileOf({ ...base, lang: "" } as UserRow).lang).toBe(DEFAULT_LANG);
});

test("profileOf maps the db's 0-skip weight sentinel to null, real weights pass through", () => {
  const base = { telegram_id: 1, username: null, state: "active", consent_at: null, goal: null, weight_kg: null, restrictions: [], created_at: "t", acquisition_source: null, lang: "en" };
  expect(profileOf({ ...base, weight_kg: 0 } as UserRow).weight_kg).toBeNull();
  expect(profileOf({ ...base, weight_kg: 92.5 } as UserRow).weight_kg).toBe(92.5);
  expect(profileOf(base as UserRow).weight_kg).toBeNull();
});

test("first contact seeds the language from Telegram's language_code", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const { msgs, send } = collector();
  await processOnboarding(deps, { id: 50, language_code: "de-AT" }, { type: "command", command: "start" }, send);
  expect((await getUser(db, 50))?.lang).toBe("de");
  expect(msgs[0]).toBe(translatorFor("de")("onboarding.consent"));
});

test("an unsupported language_code falls back without breaking onboarding", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const { msgs, send } = collector();
  await processOnboarding(deps, { id: 51, language_code: "pt-BR" }, { type: "command", command: "start" }, send);
  expect((await getUser(db, 51))?.lang).toBe(DEFAULT_LANG);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("onboarding.consent"));
});

test("/lang lists every registered locale", async () => {
  const db = await freshTestDb();
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
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 61);
  const { msgs, send } = collector();
  await processLangChoice(deps, { id: 61 }, "lang_de", send);
  expect((await getUser(db, 61))?.lang).toBe("de");
  expect(msgs[0]).toBe(translatorFor("de")("lang.changed"));
});

test("/lang ignores an unregistered code instead of storing it", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 62);
  const before = (await getUser(db, 62))?.lang;
  const { send } = collector();
  await processLangChoice(deps, { id: 62 }, "lang_klingon", send);
  expect((await getUser(db, 62))?.lang).toBe(before);
});

test("a user's language drives every bot-emitted string", async () => {
  const db = await freshTestDb();
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

test("a low-confidence analysis swaps the correction hint for a weight nudge", async () => {
  // User-supplied mass is the strongest accuracy lever the literature found; when the model
  // itself says the estimate is shaky, ask for it instead of the generic correction hint.
  const db = await freshTestDb();
  const lowConfidence = JSON.stringify({
    ...JSON.parse(foodJson()), confidence: "low",
  });
  const deps: BotDeps = { db, provider: fakeProvider(lowConfidence), config: cfg };
  await onboardToActive(deps, 90);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 90 }, async () => new Uint8Array([1]), send);
  const t = translatorFor(DEFAULT_LANG);
  expect(msgs[0]).toContain(t("meal.lowConfidenceHint"));
  expect(msgs[0]).not.toContain(t("meal.correctionHint"));
});

test("a whitespace-padded 'Low' still triggers the weight nudge", async () => {
  const db = await freshTestDb();
  const padded = JSON.stringify({ ...JSON.parse(foodJson()), confidence: " Low " });
  const deps: BotDeps = { db, provider: fakeProvider(padded), config: cfg };
  await onboardToActive(deps, 91);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 91 }, async () => new Uint8Array([1]), send);
  expect(msgs[0]).toContain(translatorFor(DEFAULT_LANG)("meal.lowConfidenceHint"));
});

test("a qualified 'low (mixed dish)' still triggers the weight nudge", async () => {
  // The wire enum is advisory (strict:false) — models do append qualifiers. Prefix-match,
  // so the headline lever doesn't silently turn off on a chatty model.
  const db = await freshTestDb();
  const qualified = JSON.stringify({ ...JSON.parse(foodJson()), confidence: "low (mixed dish)" });
  const deps: BotDeps = { db, provider: fakeProvider(qualified), config: cfg };
  await onboardToActive(deps, 92);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 92 }, async () => new Uint8Array([1]), send);
  expect(msgs[0]).toContain(translatorFor(DEFAULT_LANG)("meal.lowConfidenceHint"));
});

test("medium and high confidence get the generic hint, never the weight nudge", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 93);
  const t = translatorFor(DEFAULT_LANG);
  for (const confidence of ["medium", "high"]) {
    deps.provider = fakeProvider(JSON.stringify({ ...JSON.parse(foodJson()), confidence }));
    const { msgs, send } = collector();
    await processPhoto(deps, { id: 93 }, async () => new Uint8Array([1]), send);
    expect(msgs[0]).toContain(t("meal.correctionHint"));
    expect(msgs[0]).not.toContain(t("meal.lowConfidenceHint"));
  }
});

test("a correction reply carries no hint — neither the generic nor the weight nudge", async () => {
  // Deliberate: the user just corrected; re-prompting them again would nag. This test puts
  // that decision on the record so a shared-helper refactor can't silently change it.
  const db = await freshTestDb();
  const low = JSON.stringify({ ...JSON.parse(foodJson()), confidence: "low" });
  const deps: BotDeps = { db, provider: fakeProvider(low), config: cfg };
  await onboardToActive(deps, 94);
  const photo = collector();
  await processPhoto(deps, { id: 94 }, async () => new Uint8Array([1]), photo.send);
  const { msgs, send } = collector();
  const handled = await processCorrection(deps, { id: 94 }, 1, "actually 340 g", send);
  expect(handled).toBe(true);
  const t = translatorFor(DEFAULT_LANG);
  expect(msgs[0]).toContain(t("meal.updatedPrefix"));
  expect(msgs[0]).not.toContain(t("meal.lowConfidenceHint"));
  expect(msgs[0]).not.toContain(t("meal.correctionHint"));
});

test("analysis failure is reported in the user's language and writes no row", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: { chat: async () => "not json" }, config: cfg };
  await onboardToActive(deps, 80);
  await processLangChoice(deps, { id: 80 }, "lang_de", noop);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 80 }, async () => new Uint8Array([1]), send);
  expect(msgs[0]).toBe(translatorFor("de")("errors.analyzeFailed"));
  expect(await countMealsToday(db, 80, berlinDate(new Date(), cfg.tz))).toBe(0);
});

test("meCard and statsCard render in the user's language, with correct plurals", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 90);
  await processLangChoice(deps, { id: 90 }, "lang_de", noop);
  const card = (await meCard(deps, 90)) as string;
  expect(card).toContain(translatorFor("de")("me.goal.lose"));
  expect(card).not.toMatch(/me\.[a-zA-Z.]+/);

  // ru plural categories differ at 1 / 2 / 5 — a wrong plural key shows up here
  const tru = translatorFor("ru");
  expect(tru("stats.users", { count: 1 })).not.toBe(tru("stats.users", { count: 2 }));
  expect(tru("stats.users", { count: 2 })).not.toBe(tru("stats.users", { count: 5 }));
  expect(await statsCard(deps, "ru")).toContain(tru("stats.users", { count: 1 }));
});

test("no locale leaks a raw key through any bot card", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 95);
  for (const lang of LANGS) {
    await processLangChoice(deps, { id: 95 }, `lang_${lang}`, noop);
    expect(await meCard(deps, 95)).not.toMatch(/\b(me|meal|errors|stats)\.[a-zA-Z.]+/);
    expect(await statsCard(deps, lang)).not.toMatch(/\b(me|meal|errors|stats)\.[a-zA-Z.]+/);
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
  await processOnboarding(deps, { id }, { type: "callback", data: "weight_skip" }, noop);
}

test("a keyword match short-circuits — the classifier is never consulted", async () => {
  const db = await freshTestDb();
  const { p, calls } = countingProvider(JSON.stringify({ tags: ["vegan"] }));
  const deps: BotDeps = { db, provider: p, config: cfg };
  await toRestrictionsStep(deps, 200);
  await processOnboarding(deps, { id: 200 }, { type: "text", text: "почки" }, noop);
  expect((await getUser(db, 200))?.restrictions).toEqual(["kidneys"]);
  expect(calls()).toBe(0);
});

test("a keyword miss falls back to the classifier — German text still yields tags", async () => {
  const db = await freshTestDb();
  const { p, calls } = countingProvider(JSON.stringify({ tags: ["kidneys", "lowsugar"] }));
  const deps: BotDeps = { db, provider: p, config: cfg };
  await toRestrictionsStep(deps, 201, "de");
  await processOnboarding(deps, { id: 201 }, { type: "text", text: "Nieren, kein Zucker" }, noop);
  expect((await getUser(db, 201))?.restrictions).toEqual(["kidneys", "lowsugar"]);
  expect(calls()).toBe(1);
  expect((await getUser(db, 201))?.state).toBe("active");
});

test("a classifier failure leaves restrictions empty but still completes onboarding", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: { chat: async () => { throw new Error("down"); } }, config: cfg };
  await toRestrictionsStep(deps, 202, "de");
  const { msgs, send } = collector();
  await processOnboarding(deps, { id: 202 }, { type: "text", text: "Nieren" }, send);
  expect((await getUser(db, 202))?.restrictions).toEqual([]);
  expect((await getUser(db, 202))?.state).toBe("active");
  expect(msgs[0]).toBe(translatorFor("de")("onboarding.done"));
});

test("the classifier is not consulted for non-restriction steps", async () => {
  const db = await freshTestDb();
  const { p, calls } = countingProvider(JSON.stringify({ tags: ["vegan"] }));
  const deps: BotDeps = { db, provider: p, config: cfg };
  // text typed during consent is a nudge, not a restriction declaration
  await processOnboarding(deps, { id: 203 }, { type: "command", command: "start" }, noop);
  await processOnboarding(deps, { id: 203 }, { type: "text", text: "hello there" }, noop);
  expect(calls()).toBe(0);
});

test("skipping restrictions never consults the classifier", async () => {
  const db = await freshTestDb();
  const { p, calls } = countingProvider(JSON.stringify({ tags: ["vegan"] }));
  const deps: BotDeps = { db, provider: p, config: cfg };
  await toRestrictionsStep(deps, 204);
  await processOnboarding(deps, { id: 204 }, { type: "callback", data: "restrictions_skip" }, noop);
  expect((await getUser(db, 204))?.restrictions).toEqual([]);
  expect(calls()).toBe(0);
});

test("/me renders restriction tags as localized names, not raw identifiers", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await processOnboarding(deps, { id: 300, language_code: "de" }, { type: "command", command: "start" }, noop);
  await processOnboarding(deps, { id: 300 }, { type: "callback", data: "consent_agree" }, noop);
  await processOnboarding(deps, { id: 300 }, { type: "callback", data: "goal_lose" }, noop);
  await processOnboarding(deps, { id: 300 }, { type: "callback", data: "weight_skip" }, noop);
  await processOnboarding(deps, { id: 300 }, { type: "text", text: "почки, холестерин" }, noop);

  const card = (await meCard(deps, 300)) as string;
  expect(card).toContain("Nieren");
  expect(card).toContain("Cholesterin");
  expect(card).not.toContain("kidneys"); // the storage identifier must not reach the user
  expect(card).not.toContain("ldl");
});

test("an unknown stored tag degrades to itself rather than throwing", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 301);
  // a tag written by an older build that the catalog has no name for
  await db`UPDATE users SET restrictions = ${'["gluten"]'} WHERE telegram_id = ${301}`;
  expect(await meCard(deps, 301)).toContain("gluten");
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
    expect(cmds.map((c) => c.command)).toEqual(["start", "me", "settings", "help", "waitlist", "delete"]);
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
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const { msgs, send } = collector();
  await processSettingsOpen(deps, { id: 400 }, send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.notOnboarded"));
});

test("/settings opens the root view with the three sections", async () => {
  const db = await freshTestDb();
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
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 402); // onboards as 'lose'
  const { edits, edit, last } = editor();
  await processSettingsCallback(deps, { id: 402 }, "st:goal:maintain", edit);
  expect((await getUser(db, 402))?.goal).toBe("maintain");
  expect(edits).toHaveLength(1); // edited, not appended
  expect(last().data).toEqual(["st:goal", "st:restr", "st:lang"]); // back at root
});

test("toggling a restriction twice persists on and then off, with no new messages", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 403);
  const { edits, edit } = editor();
  await processSettingsCallback(deps, { id: 403 }, "st:restr:kidneys", edit);
  expect((await getUser(db, 403))?.restrictions).toEqual(["kidneys"]);
  await processSettingsCallback(deps, { id: 403 }, "st:restr:kidneys", edit);
  expect((await getUser(db, 403))?.restrictions).toEqual([]);
  expect(edits).toHaveLength(2); // two edits, zero sends
});

test("a restriction toggled in settings reaches the analyzer prompt and the targets", async () => {
  const db = await freshTestDb();
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
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 405);
  const { edit, last } = editor();
  await processSettingsCallback(deps, { id: 405 }, "st:lang:de", edit);
  expect((await getUser(db, 405))?.lang).toBe("de");
  expect(last().text).toContain(translatorFor("de")("settings.title"));
});

test("settings callbacks from a non-active user change nothing", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await processOnboarding(deps, { id: 406 }, { type: "command", command: "start" }, noop);
  const { edits, edit } = editor();
  await processSettingsCallback(deps, { id: 406 }, "st:goal:gain", edit);
  expect((await getUser(db, 406))?.goal).toBeNull();
  expect(edits).toHaveLength(0);
});

test("/help works before onboarding, in the language of the Telegram client", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const body = await helpText(deps, { id: 407, language_code: "de" });
  expect(body).toBe(translatorFor("de")("help.body"));
  expect(body).toContain("/settings"); // command list is part of it
});

test("/help follows a stored language over the client's", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 408);
  await processLangChoice(deps, { id: 408 }, "lang_ru", noop);
  expect(await helpText(deps, { id: 408, language_code: "de" })).toBe(translatorFor("ru")("help.body"));
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
  const db = await freshTestDb();
  // per-user cap high, global cap low: proves the global one is what bites
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 50, globalDailyAnalysisCap: 2 } };
  await onboardToActive(deps, 1);
  await onboardToActive(deps, 2);
  await onboardToActive(deps, 3);

  await processPhoto(deps, { id: 1 }, async () => new Uint8Array([1]), noop);
  await processPhoto(deps, { id: 2 }, async () => new Uint8Array([1]), noop);
  const date = berlinDate(new Date(), cfg.tz);
  expect(await mealCountToday(db, date)).toBe(2);

  // a THIRD user, well under their own cap, is refused because the day is spent
  const c = collector();
  await processPhoto(deps, { id: 3 }, async () => new Uint8Array([1]), c.send);
  expect(c.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.globalCap"));
  expect(await mealCountToday(db, date)).toBe(2); // no row written
});

test("the global cap is checked BEFORE the model is called, so it actually saves money", async () => {
  const db = await freshTestDb();
  let calls = 0;
  const counting: LLMProvider = { chat: async () => { calls++; return foodJson(); } };
  const deps: BotDeps = { db, provider: counting, config: { ...cfg, globalDailyAnalysisCap: 0 } };
  await onboardToActive(deps, 1);
  await processPhoto(deps, { id: 1 }, async () => new Uint8Array([1]), noop);
  expect(calls).toBe(0); // a cap that fires after the call would be decorative
});

test("no global cap configured means unlimited", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 50, globalDailyAnalysisCap: null } };
  await onboardToActive(deps, 1);
  for (let i = 0; i < 5; i++) await processPhoto(deps, { id: 1 }, async () => new Uint8Array([1]), noop);
  expect(await mealCountToday(db, berlinDate(new Date(), cfg.tz))).toBe(5);
});

test("the cap message points at self-hosting rather than just refusing", () => {
  for (const lang of LANGS) {
    const msg = translatorFor(lang)("errors.globalCap");
    expect(msg.trim()).not.toBe("");
    expect(msg).not.toMatch(/errors\./);
  }
});

// --- createBot: the docs claim this is constructable with no live token. Prove it. ---

test("createBot builds without a live token, given botInfo and an API transformer", async () => {
  const db = await freshTestDb();
  const bot = createBot({ db, provider: fakeProvider("{}"), config: cfg });
  // botInfo + a transformer are what let grammy skip getMe and never reach the network.
  bot.botInfo = {
    id: 1, is_bot: true, first_name: "eait", username: "eait_bot",
    can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false,
    can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false,
    allows_users_to_create_topics: false, can_manage_bots: false,
    supports_join_request_queries: false,
  };
  let calledApi = false;
  bot.api.config.use(async () => {
    calledApi = true;
    return { ok: true, result: true as any };
  });
  expect(bot.isInited()).toBe(true);
  expect(calledApi).toBe(false); // constructing must not touch Telegram
});

// --- /stats: admin who never ran /start ---

test("statsCard renders for an admin with no user row", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider("{}"), config: cfg };
  // The handler previously did profileOf(getUser(db, id)!) — undefined for an admin who never
  // sent /start, which threw inside the handler and left them with no reply at all.
  expect(await statsCard(deps, DEFAULT_LANG)).toBeTruthy();
  expect(await adminLangFor(deps, cfg.adminUserId!)).toBe(DEFAULT_LANG);
});

// --- supervisor error classification ---

test("isFatalTelegramError flags credential failures, not transient ones", () => {
  expect(isFatalTelegramError({ error_code: 401, description: "Unauthorized" })).toBe(true);
  expect(isFatalTelegramError({ error_code: 404, description: "Not Found" })).toBe(true);
  // 409 is the poller hand-off the supervisor exists to ride out.
  expect(isFatalTelegramError({ error_code: 409, description: "Conflict" })).toBe(false);
  expect(isFatalTelegramError({ error_code: 429, description: "Too Many Requests" })).toBe(false);
  expect(isFatalTelegramError(new Error("network blip"))).toBe(false);
  expect(isFatalTelegramError(undefined)).toBe(false);
});

test("describeError keeps the error_code that 'Not Found' alone hides", () => {
  expect(describeError({ error_code: 404, description: "Not Found" })).toBe("404 Not Found");
  expect(describeError(new Error("boom"))).toContain("boom");
  expect(describeError("plain")).toBe("plain");
});

test("startBot validates the provider before it connects anywhere", async () => {
  // Both the provider AND the pg target are invalid here; the provider must be what throws.
  // A db-first ordering would surface a connection error to port 1 instead of /LLM_PROVIDER/.
  await expect(
    startBot({ ...cfg, pg: { ...cfg.pg, port: 1 }, llmProvider: "nope" }),
  ).rejects.toThrow(/LLM_PROVIDER/);
});

// ---------- documents (a photo sent uncompressed) ----------

test("an image document is analyzed exactly like a photo", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: cfg };
  await onboardToActive(deps, 500);
  const { msgs, send } = collector();
  await processDocument(
    deps, { id: 500 },
    { mime_type: "image/jpeg", file_size: 1024 },
    async () => new Uint8Array([1]),
    send,
  );
  expect(msgs[0]).toContain("600");
  // The hint logic must survive a processDocument rewrite that stops delegating to processPhoto.
  expect(msgs[0]).toContain(translatorFor(DEFAULT_LANG)("meal.correctionHint"));
  expect(await countMealsToday(db, 500, berlinDate(new Date(), cfg.tz))).toBe(1);
});

test("a non-image document is refused, and never reaches the model", async () => {
  const db = await freshTestDb();
  let called = false;
  const deps: BotDeps = {
    db, config: cfg,
    provider: { chat: async () => { called = true; return foodJson(); } },
  };
  await onboardToActive(deps, 501);
  const { msgs, send } = collector();
  await processDocument(
    deps, { id: 501 },
    { mime_type: "application/pdf", file_size: 1024 },
    async () => new Uint8Array([1]),
    send,
  );
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.notAnImage"));
  expect(called).toBe(false); // a billed vision call for a PDF would be pure waste
  expect(await countMealsToday(db, 501, berlinDate(new Date(), cfg.tz))).toBe(0);
});

test("a document too large for the Bot API is refused before download", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 502);
  const { msgs, send } = collector();
  let downloaded = false;
  await processDocument(
    deps, { id: 502 },
    { mime_type: "image/png", file_size: 25 * 1024 * 1024 },
    async () => { downloaded = true; return new Uint8Array([1]); },
    send,
  );
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.fileTooBig"));
  expect(downloaded).toBe(false);
});

test("a document with no declared mime type is refused rather than guessed", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 503);
  const { msgs, send } = collector();
  await processDocument(deps, { id: 503 }, {}, async () => new Uint8Array([1]), send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.notAnImage"));
});

test("an image document still respects the daily cap", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 1 } };
  await onboardToActive(deps, 504);
  const doc = { mime_type: "image/jpeg", file_size: 10 };
  await processDocument(deps, { id: 504 }, doc, async () => new Uint8Array([1]), collector().send);
  const c2 = collector();
  await processDocument(deps, { id: 504 }, doc, async () => new Uint8Array([1]), c2.send);
  expect(c2.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.dailyCap"));
});

// ---------- /cap: runtime spend control ----------

test("effectiveGlobalCap falls back to the env value when no override is stored", async () => {
  const db = await freshTestDb();
  expect(await effectiveGlobalCap(db, { ...cfg, globalDailyAnalysisCap: 500 })).toBe(500);
  expect(await effectiveGlobalCap(db, { ...cfg, globalDailyAnalysisCap: null })).toBeNull();
});

test("a stored override beats the env value, and survives a 'restart'", async () => {
  const db = await freshTestDb();
  await setSetting(db, "global_cap", "40");
  expect(await effectiveGlobalCap(db, { ...cfg, globalDailyAnalysisCap: 500 })).toBe(40);
  // "off" is a real override meaning unlimited — distinct from having no override at all
  await setSetting(db, "global_cap", "off");
  expect(await effectiveGlobalCap(db, { ...cfg, globalDailyAnalysisCap: 500 })).toBeNull();
});

test("a corrupt stored override falls back to env rather than disabling the cap", async () => {
  const db = await freshTestDb();
  await setSetting(db, "global_cap", "not-a-number");
  expect(await effectiveGlobalCap(db, { ...cfg, globalDailyAnalysisCap: 500 })).toBe(500);
});

test("/cap with no argument reports the current cap and today's usage", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, globalDailyAnalysisCap: 500, adminUserId: 42 } };
  await onboardToActive(deps, 42);
  await processPhoto(deps, { id: 42 }, async () => new Uint8Array([1]), noop);
  const { msgs, send } = collector();
  await processCap(deps, { id: 42 }, "", send);
  expect(msgs[0]).toContain("500");
  expect(msgs[0]).toContain("1"); // used today
});

test("/cap <n> takes effect immediately, with no restart", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 50, globalDailyAnalysisCap: 500, adminUserId: 42 } };
  await onboardToActive(deps, 42);
  await processCap(deps, { id: 42 }, "1", noop);
  expect(await effectiveGlobalCap(db, deps.config)).toBe(1);

  await processPhoto(deps, { id: 42 }, async () => new Uint8Array([1]), noop); // uses the 1
  const c = collector();
  await processPhoto(deps, { id: 42 }, async () => new Uint8Array([1]), c.send);
  expect(c.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.globalCap"));
});

test("/cap off removes the limit; /cap reset returns to the .env value", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, globalDailyAnalysisCap: 500, adminUserId: 42 } };
  await onboardToActive(deps, 42);
  await processCap(deps, { id: 42 }, "off", noop);
  expect(await effectiveGlobalCap(db, deps.config)).toBeNull();
  await processCap(deps, { id: 42 }, "reset", noop);
  expect(await effectiveGlobalCap(db, deps.config)).toBe(500);
});

test("/cap rejects junk instead of storing it", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, globalDailyAnalysisCap: 500, adminUserId: 42 } };
  await onboardToActive(deps, 42);
  for (const bad of ["abc", "-5", "1.5", "99999999999999999999"]) {
    const c = collector();
    await processCap(deps, { id: 42 }, bad, c.send);
    expect(await effectiveGlobalCap(db, deps.config)).toBe(500); // unchanged
    expect(c.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("cap.invalid"));
  }
});

test("/cap is admin-only — a non-admin changes nothing", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, globalDailyAnalysisCap: 500, adminUserId: 42 } };
  await onboardToActive(deps, 99);
  const c = collector();
  await processCap(deps, { id: 99 }, "1", c.send);
  expect(await effectiveGlobalCap(db, deps.config)).toBe(500);
  expect(c.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.adminOnly"));
});

test("/cap is refused entirely when no admin is configured", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, globalDailyAnalysisCap: 500, adminUserId: null } };
  await onboardToActive(deps, 42);
  await processCap(deps, { id: 42 }, "1", noop);
  expect(await effectiveGlobalCap(db, deps.config)).toBe(500);
});

// ---------- acquisition attribution events ----------

test("/start with a deep-link payload records the source and a start event", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await processOnboarding(deps, { id: 60 }, { type: "command", command: "start", payload: "tt_001" }, noop);
  expect((await getUser(db, 60))?.acquisition_source).toBe("tt_001");
  const events = await eventsFor(db, 60);
  expect(events).toHaveLength(1);
  expect(events[0]?.event).toBe("start");
  expect(events[0]?.source_code).toBe("tt_001");
});

test("/start payload outside the allowed charset is ignored, start event still logged", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await processOnboarding(deps, { id: 61 }, { type: "command", command: "start", payload: "tt 001; DROP" }, noop);
  expect((await getUser(db, 61))?.acquisition_source).toBeNull();
  const events = await eventsFor(db, 61);
  expect(events).toHaveLength(1);
  expect(events[0]?.event).toBe("start");
  expect(events[0]?.source_code).toBeNull();
});

test("a later /start with a different code never overwrites the first source", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await processOnboarding(deps, { id: 62 }, { type: "command", command: "start", payload: "tt_001" }, noop);
  await processOnboarding(deps, { id: 62 }, { type: "command", command: "start", payload: "ig_009" }, noop);
  expect((await getUser(db, 62))?.acquisition_source).toBe("tt_001");
});

test("completing onboarding logs onboarding_complete exactly once", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 63);
  // a stale second tap resumes idempotently and must not double-log
  await processOnboarding(deps, { id: 63 }, { type: "callback", data: "restrictions_skip" }, noop);
  const completes = (await eventsFor(db, 63)).filter((e) => e.event === "onboarding_complete");
  expect(completes).toHaveLength(1);
});

test("first analyzed photo logs first_photo exactly once", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 64);
  const { send } = collector();
  await processPhoto(deps, { id: 64 }, async () => new Uint8Array([1]), send);
  await processPhoto(deps, { id: 64 }, async () => new Uint8Array([1]), send);
  const firsts = (await eventsFor(db, 64)).filter((e) => e.event === "first_photo");
  expect(firsts).toHaveLength(1);
});

test("a photo blocked by the global cap logs a cap_hit event", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, globalDailyAnalysisCap: 0 } };
  await onboardToActive(deps, 65);
  const { send } = collector();
  await processPhoto(deps, { id: 65 }, async () => new Uint8Array([1]), send);
  const hits = (await eventsFor(db, 65)).filter((e) => e.event === "cap_hit");
  expect(hits).toHaveLength(1);
  expect(await countMealsToday(db, 65, berlinDate(new Date(), cfg.tz))).toBe(0);
});

// ---------- waitlist (willingness-to-pay instrument) ----------

test("/waitlist logs waitlist_join once and confirms; a second call does not duplicate", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 70);
  const c1 = collector();
  await processWaitlist(deps, { id: 70 }, c1.send);
  expect(c1.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("waitlist.joined"));
  const c2 = collector();
  await processWaitlist(deps, { id: 70 }, c2.send);
  expect(c2.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("waitlist.already"));
  const joins = (await eventsFor(db, 70)).filter((e) => e.event === "waitlist_join");
  expect(joins).toHaveLength(1);
});

test("the global-cap message points at /waitlist in every language", () => {
  for (const lang of LANGS) {
    expect(translatorFor(lang)("errors.globalCap")).toContain("/waitlist");
  }
});

test("the / menu includes waitlist", () => {
  const commands = buildCommands(translatorFor(DEFAULT_LANG)).map((c) => c.command);
  expect(commands).toContain("waitlist");
});

// ---------- runtime allowlist (/allow · /deny · /allowed) ----------

import { processAllow, processDeny, processAllowed } from "./bot.ts";

const tEn = translatorFor(DEFAULT_LANG);

async function allowlistDeps(overrides: Partial<Config> = {}): Promise<BotDeps> {
  const db = await freshTestDb();
  const config = { ...cfg, ...overrides };
  return { db, provider: fakeProvider(foodJson()), config, allowlist: await loadAllowlist(db, config) };
}

test("/allow on an open bot starts a list containing the admin and the target", async () => {
  const deps = await allowlistDeps(); // allowedUserIds: null → open
  const { msgs, send } = collector();
  await processAllow(deps, { id: 42 }, "777", send);
  expect(deps.allowlist!.isOpen()).toBe(false);
  expect(deps.allowlist!.has(777)).toBe(true);
  expect(deps.allowlist!.has(42)).toBe(true); // closing the bot must never lock out the closer
  expect(deps.allowlist!.has(888)).toBe(false);
  expect(msgs[0]).toBe(tEn("allowlist.nowClosed", { id: 777, count: 2 }));
});

test("/allow extends a seeded list, persists across a reload, and is idempotent", async () => {
  const deps = await allowlistDeps({ allowedUserIds: [42, 10] });
  await processAllow(deps, { id: 42 }, "30", noop);
  expect(deps.allowlist!.list()).toEqual([10, 30, 42]);
  const c = collector();
  await processAllow(deps, { id: 42 }, "30", c.send);
  expect(c.msgs[0]).toBe(tEn("allowlist.already", { id: 30 }));
  // a restart must see the stored list, not the env seed
  const reloaded = await loadAllowlist(deps.db, { allowedUserIds: null });
  expect(reloaded.list()).toEqual([10, 30, 42]);
});

test("/allow rejects a non-numeric id with usage, changing nothing", async () => {
  const deps = await allowlistDeps({ allowedUserIds: [42] });
  const { msgs, send } = collector();
  await processAllow(deps, { id: 42 }, "@somehandle", send);
  expect(msgs[0]).toBe(tEn("allowlist.usage"));
  expect(deps.allowlist!.list()).toEqual([42]);
});

test("/allow is admin-only, and silent when no admin is configured", async () => {
  const deps = await allowlistDeps({ allowedUserIds: [42, 99] });
  const c1 = collector();
  await processAllow(deps, { id: 99 }, "777", c1.send); // non-admin
  expect(c1.msgs[0]).toBe(tEn("errors.adminOnly"));
  expect(deps.allowlist!.has(777)).toBe(false);

  const noAdmin = await allowlistDeps({ allowedUserIds: [99], adminUserId: null });
  const c2 = collector();
  await processAllow(noAdmin, { id: 99 }, "777", c2.send);
  expect(c2.msgs).toHaveLength(0); // answering would advertise the command
  expect(noAdmin.allowlist!.has(777)).toBe(false);
});

test("/deny removes a user and persists; unlisted and admin ids are refused", async () => {
  const deps = await allowlistDeps({ allowedUserIds: [42, 10] });
  const c1 = collector();
  await processDeny(deps, { id: 42 }, "10", c1.send);
  expect(c1.msgs[0]).toBe(tEn("allowlist.removed", { id: 10, count: 1 }));
  expect(deps.allowlist!.has(10)).toBe(false);
  const reloaded = await loadAllowlist(deps.db, { allowedUserIds: [42, 10] });
  expect(reloaded.has(10)).toBe(false); // the env seed must not resurrect a denied id

  const c2 = collector();
  await processDeny(deps, { id: 42 }, "10", c2.send);
  expect(c2.msgs[0]).toBe(tEn("allowlist.notListed", { id: 10 }));

  const c3 = collector();
  await processDeny(deps, { id: 42 }, "42", c3.send);
  expect(c3.msgs[0]).toBe(tEn("allowlist.cantDenyAdmin"));
  expect(deps.allowlist!.has(42)).toBe(true); // self-lockout refused
});

test("/deny on an open bot explains instead of closing it as a side effect", async () => {
  const deps = await allowlistDeps();
  const { msgs, send } = collector();
  await processDeny(deps, { id: 42 }, "777", send);
  expect(msgs[0]).toBe(tEn("allowlist.open"));
  expect(deps.allowlist!.isOpen()).toBe(true);
});

test("/allowed lists the ids, or says the bot is open", async () => {
  const deps = await allowlistDeps({ allowedUserIds: [42, 10] });
  const c1 = collector();
  await processAllowed(deps, { id: 42 }, c1.send);
  expect(c1.msgs[0]).toBe(tEn("allowlist.list", { count: 2, ids: "10, 42" }));

  const open = await allowlistDeps();
  const c2 = collector();
  await processAllowed(open, { id: 42 }, c2.send);
  expect(c2.msgs[0]).toBe(tEn("allowlist.open"));
});

test("without a runtime allowlist in deps, the admin is told it is unavailable", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg }; // no allowlist
  const { msgs, send } = collector();
  await processAllow(deps, { id: 42 }, "777", send);
  expect(msgs[0]).toBe(tEn("allowlist.unavailable"));
});

test("allow/deny/allowed are registered in the admin's scope only, in every locale", () => {
  const plan = commandRegistrations({ ...cfg, adminUserId: 42 });
  for (const r of plan.filter((x) => x.options.scope)) {
    const names = r.commands.map((c) => c.command);
    expect(names).toEqual(expect.arrayContaining(["allow", "deny", "allowed"]));
    for (const c of r.commands) expect(c.description).not.toMatch(/commands\./);
  }
  for (const r of plan.filter((x) => !x.options.scope)) {
    expect(r.commands.map((c) => c.command)).not.toContain("allow");
  }
});
