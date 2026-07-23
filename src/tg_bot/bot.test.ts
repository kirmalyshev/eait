import { afterAll, test, expect, spyOn } from "bun:test";
import { getUser, mealByReply, countMealsToday, mealCountToday, llmCallsToday, logLlmCall, berlinDate, berlinDateMinus, setSetting, setReplyFormat, eventsFor, type UserRow } from "../db.ts";
import { loadAllowlist } from "../allowlist.ts";
import { RejectionLog } from "./rejections.ts";
import { cleanupTestDbs, freshTestDb } from "../testutil.ts";
import {
  processOnboarding, processPhoto, processText, processTextMealDecision, meCard, statsCard, profileOf,
  processLangPrompt, processLangChoice, buildCommands, processSettingsOpen,
  processSettingsCallback, helpText, commandRegistrations, isAllowed,
  processCap, effectiveGlobalCap, processWaitlist,
  createBot, startBot, adminLangFor, isFatalTelegramError, describeError, processDocument,
  processAlbum, makeSendRich,
  type BotDeps, type Send, type Edit, type PendingAlbumPart,
} from "./bot.ts";
import { DEFAULT_LANG, LANGS, translatorFor } from "../i18n/index.ts";
import { berlinDayLabel } from "../reply.ts";
import type { Config } from "../config.ts";
import type { LLMProvider } from "../llm/provider.ts";

const cfg: Config = {
  telegramBotToken: "x", openrouterApiKey: "x", llmProvider: "openrouter", llmModel: "test",
  llmTimeoutMs: 1000, tz: "Europe/Berlin",
  // Never connected: every test injects an already-open db. Only the startBot ordering test
  // uses it, overriding the port to something unreachable.
  pg: { host: "127.0.0.1", port: 5439, user: "eait", password: "eait", database: "eait_test_cfg_unused" },
  perUserDailyPhotoCap: 2, adminUserId: 42, allowedUserIds: null, globalDailyAnalysisCap: null,
  // Plain keeps the long-standing text assertions exact; the rich path has its own tests.
  replyFormat: "plain",
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
  await processPhoto(deps, { id: 1 }, [async () => new Uint8Array([1])], send);
  expect(msgs[0]).toContain("/start");
  expect(await countMealsToday(db, 1, berlinDate(new Date(), cfg.tz))).toBe(0);
});

test("processPhoto (active) inserts a meal, replies with the daily total, sets reply id", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: cfg };
  await onboardToActive(deps, 7);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 7 }, [async () => new Uint8Array([1])], send);
  expect(msgs[0]).toContain("600");
  expect(await countMealsToday(db, 7, berlinDate(new Date(), cfg.tz))).toBe(1);
  expect(await mealByReply(db, 7, 1)).toBeDefined(); // reply msg id 1 → this meal
});

test("processPhoto enforces the per-user daily cap", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 1 } };
  await onboardToActive(deps, 9);
  const c1 = collector();
  await processPhoto(deps, { id: 9 }, [async () => new Uint8Array([1])], c1.send);
  const c2 = collector();
  await processPhoto(deps, { id: 9 }, [async () => new Uint8Array([1])], c2.send);
  expect(c2.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.dailyCap"));
});

test("processPhoto forwards the caption and Berlin local time into the analysis prompt", async () => {
  const db = await freshTestDb();
  let seen = "";
  const provider: LLMProvider = { chat: async (req) => ((seen = req.userText), foodJson()) };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 11);
  await processPhoto(deps, { id: 11 }, [async () => new Uint8Array([1])], noop, { caption: "борщ со сметаной" });
  expect(seen).toContain("борщ со сметаной");
  expect(seen).toMatch(/Local time of the meal: \d{2}:\d{2}/);
});

test("processPhoto without a caption still injects the local time", async () => {
  const db = await freshTestDb();
  let seen = "";
  const provider: LLMProvider = { chat: async (req) => ((seen = req.userText), foodJson()) };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 12);
  await processPhoto(deps, { id: 12 }, [async () => new Uint8Array([1])], noop);
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

test("a correction routed through processText updates the matched meal", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: cfg };
  await onboardToActive(deps, 5);
  const { send } = collector();
  await processPhoto(deps, { id: 5 }, [async () => new Uint8Array([1])], send); // meal reply id = 1
  deps.provider = fakeProvider(JSON.stringify({ intent: "correction", analysis: JSON.parse(foodJson(900)) }));
  const cc = collector();
  const handled = await processText(deps, { id: 5 }, { text: "2 куска, без масла", messageId: 50, replyTo: 1 }, cc.send);
  expect(handled).toBe(true);
  expect(cc.msgs[0]).toContain("900");
  // The corrected meal is today's, so its card must NOT carry a date line and must use the
  // plain "Today:" total — pins the correction-card today-branch (mealDateLabel → undefined).
  const today = berlinDate(new Date(), cfg.tz);
  expect(cc.msgs[0]).not.toContain(berlinDayLabel(today, DEFAULT_LANG, cfg.tz));
  expect(cc.msgs[0]).toContain(translatorFor(DEFAULT_LANG)("meal.totalKcal", { now: 900, target: 1800 }));
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
  const base = { telegram_id: 1, username: null, state: "active", consent_at: null, goal: null, weight_kg: null, restrictions: [], created_at: "t", acquisition_source: null, reply_format: null };
  expect(profileOf({ ...base, lang: "de" } as UserRow).lang).toBe("de");
  expect(profileOf({ ...base, lang: "ru" } as UserRow).lang).toBe("ru");
  // a value that predates (or outlives) the registry must not render as a raw key
  expect(profileOf({ ...base, lang: "klingon" } as UserRow).lang).toBe(DEFAULT_LANG);
  expect(profileOf({ ...base, lang: "" } as UserRow).lang).toBe(DEFAULT_LANG);
});

test("profileOf maps the db's 0-skip weight sentinel to null, real weights pass through", () => {
  const base = { telegram_id: 1, username: null, state: "active", consent_at: null, goal: null, weight_kg: null, restrictions: [], created_at: "t", acquisition_source: null, lang: "en", reply_format: null };
  expect(profileOf({ ...base, weight_kg: 0 } as UserRow).weight_kg).toBeNull();
  expect(profileOf({ ...base, weight_kg: 92.5 } as UserRow).weight_kg).toBe(92.5);
  expect(profileOf(base as UserRow).weight_kg).toBeNull();
});

test("profileOf maps a junk reply_format to null (never coerces to a hardcoded format)", () => {
  const base = { telegram_id: 1, username: null, state: "active", consent_at: null, goal: null, weight_kg: null, restrictions: [], created_at: "t", acquisition_source: null, lang: "en" };
  // null is the only value that distinguishes "→ null" from a mutant that coerces to "rich" or
  // passes junk through: on a plain instance either mutant would render the wrong format.
  expect(profileOf({ ...base, reply_format: "markdown" } as UserRow).reply_format).toBeNull();
  expect(profileOf({ ...base, reply_format: "" } as UserRow).reply_format).toBeNull();
  expect(profileOf({ ...base, reply_format: "rich" } as UserRow).reply_format).toBe("rich");
  expect(profileOf({ ...base, reply_format: null } as UserRow).reply_format).toBeNull();
});

test("profileOf warns LOUDLY on off-vocabulary stored values, stays quiet on the normal states", () => {
  const base = { telegram_id: 55, username: null, state: "active", consent_at: null, goal: null, weight_kg: null, restrictions: [], created_at: "t", acquisition_source: null, lang: "en", reply_format: null };
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  try {
    profileOf({ ...base, lang: "en", reply_format: null } as UserRow); // both normal → silent
    expect(warn).toHaveBeenCalledTimes(0);
    profileOf({ ...base, lang: "klingon", reply_format: "markdown" } as UserRow); // both junk → 2
    expect(warn).toHaveBeenCalledTimes(2);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("klingon") && String(c[0]).includes("user=55"))).toBe(true);
    expect(warn.mock.calls.some((c) => String(c[0]).includes("markdown"))).toBe(true);
    warn.mockClear();
    profileOf({ ...base, lang: "" } as UserRow); // empty-string lang is a hand-edited NOT-NULL row → warns
    expect(warn).toHaveBeenCalledTimes(1);
  } finally {
    warn.mockRestore();
  }
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
  await processPhoto(deps, { id: 70 }, [async () => new Uint8Array([1])], c1.send);
  expect(c1.msgs[0]).toContain(tde("meal.correctionHint"));

  const c2 = collector(); // over the cap now
  await processPhoto(deps, { id: 70 }, [async () => new Uint8Array([1])], c2.send);
  expect(c2.msgs[0]).toBe(tde("errors.dailyCap"));

  const c3 = collector(); // not food
  deps.provider = fakeProvider(JSON.stringify({ isFood: false }));
  await processPhoto(deps, { id: 71 }, [async () => new Uint8Array([1])], c3.send);
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
  await processPhoto(deps, { id: 90 }, [async () => new Uint8Array([1])], send);
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
  await processPhoto(deps, { id: 91 }, [async () => new Uint8Array([1])], send);
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
  await processPhoto(deps, { id: 92 }, [async () => new Uint8Array([1])], send);
  expect(msgs[0]).toContain(translatorFor(DEFAULT_LANG)("meal.lowConfidenceHint"));
});

test("/me shows the stored weight, and 'not set' after a skip — misparses stay visible", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 88); // answers weight 92
  expect(await meCard(deps, 88)).toContain("92");
  const t = translatorFor(DEFAULT_LANG);
  await processOnboarding(deps, { id: 89 }, { type: "command", command: "start" }, noop);
  await processOnboarding(deps, { id: 89 }, { type: "callback", data: "consent_agree" }, noop);
  await processOnboarding(deps, { id: 89 }, { type: "callback", data: "goal_lose" }, noop);
  await processOnboarding(deps, { id: 89 }, { type: "callback", data: "weight_skip" }, noop);
  await processOnboarding(deps, { id: 89 }, { type: "callback", data: "restrictions_skip" }, noop);
  expect(await meCard(deps, 89)).toContain(t("me.noWeight"));
});

/** Collects reaction emojis; flush() lets fire-and-forget microtasks land before asserting. */
function reactionLog() {
  const seen: string[] = [];
  return { seen, react: async (e: string) => { seen.push(e); } };
}
const flush = () => new Promise((r) => setTimeout(r, 0));

test("a capped user still gets the 👀 — the bot saw the photo even when it refuses", async () => {
  // Deliberate: ack = "seen", not "will analyze". Pinned so a refactor can't flip it silently.
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 1 } };
  await onboardToActive(deps, 87);
  await processPhoto(deps, { id: 87 }, [async () => new Uint8Array([1])], noop);
  const r = reactionLog();
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 87 }, [async () => new Uint8Array([1])], send, { react: r.react });
  await flush();
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.dailyCap"));
  expect(r.seen).toEqual(["👀"]); // seen, but never 👍 — nothing was processed
});

test("the stored weight drives the protein target on both user-visible surfaces", async () => {
  // onboardToActive answers weight 92 → target round(92 × 1.6) = 147, not the flat 100.
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 98);
  expect(await meCard(deps, 98)).toContain("147");
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 98 }, [async () => new Uint8Array([1])], send);
  expect(msgs[0]).toContain("147");
  expect(msgs[0]).not.toContain("/ 100");
});

test("weight-step text never reaches the LLM restriction classifier", async () => {
  const db = await freshTestDb();
  const { p, calls } = countingProvider(JSON.stringify({ tags: ["vegan"] }));
  const deps: BotDeps = { db, provider: p, config: cfg };
  await processOnboarding(deps, { id: 99 }, { type: "command", command: "start" }, noop);
  await processOnboarding(deps, { id: 99 }, { type: "callback", data: "consent_agree" }, noop);
  await processOnboarding(deps, { id: 99 }, { type: "callback", data: "goal_lose" }, noop);
  await processOnboarding(deps, { id: 99 }, { type: "text", text: "not a weight" }, noop);
  await processOnboarding(deps, { id: 99 }, { type: "text", text: "92" }, noop);
  expect(calls()).toBe(0);
});

test("photo lifecycle reactions: 👀 before the vision call, 👍 after success", async () => {
  const db = await freshTestDb();
  const order: string[] = [];
  const provider: LLMProvider = { chat: async () => (order.push("chat"), foodJson()) };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 95);
  await processPhoto(deps, { id: 95 }, [async () => new Uint8Array([1])], noop, {
    react: async (e: string) => { order.push(e); },
  });
  await flush();
  expect(order).toEqual(["👀", "chat", "👍"]);
});

test("no 👍 when the analysis fails or the photo is not food", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: { chat: async () => "not json" }, config: cfg };
  await onboardToActive(deps, 94);
  const r1 = reactionLog();
  await processPhoto(deps, { id: 94 }, [async () => new Uint8Array([1])], noop, { react: r1.react });
  await flush();
  expect(r1.seen).toEqual(["👀"]);

  deps.provider = fakeProvider(JSON.stringify({ isFood: false }));
  const r2 = reactionLog();
  await processPhoto(deps, { id: 94 }, [async () => new Uint8Array([1])], noop, { react: r2.react });
  await flush();
  expect(r2.seen).toEqual(["👀"]);
});

test("a correction reply gets 👀 on receipt and 👍 when the update lands", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: cfg };
  await onboardToActive(deps, 93);
  const { send } = collector(); // meal reply gets message_id 1
  await processPhoto(deps, { id: 93 }, [async () => new Uint8Array([1])], send);
  deps.provider = fakeProvider(JSON.stringify({ intent: "correction", analysis: JSON.parse(foodJson(700)) }));
  const r = reactionLog();
  const handled = await processText(deps, { id: 93 }, { text: "actually 340 g", messageId: 60, replyTo: 1 }, collector().send, { react: r.react });
  await flush();
  expect(handled).toBe(true);
  expect(r.seen).toEqual(["👀", "👍"]);
});

test("a failed correction keeps the 👀 but never earns the 👍", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: cfg };
  await onboardToActive(deps, 92);
  const { send } = collector();
  await processPhoto(deps, { id: 92 }, [async () => new Uint8Array([1])], send);
  deps.provider = { chat: async () => { throw new Error("model down"); } };
  const r = reactionLog();
  const handled = await processText(deps, { id: 92 }, { text: "no oil", messageId: 61, replyTo: 1 }, collector().send, { react: r.react });
  await flush();
  expect(handled).toBe(true);
  expect(r.seen).toEqual(["👀"]);
});

test("a reply that matches no meal still routes (router without focus) — but a non-active user gets no reaction", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("nothing on that")), config: cfg };
  await onboardToActive(deps, 91);
  const r = reactionLog();
  const { msgs, send } = collector();
  const handled = await processText(deps, { id: 91 }, { text: "text", messageId: 62, replyTo: 555 }, send, { react: r.react });
  await flush();
  expect(handled).toBe(true);
  expect(msgs[0]).toBe("nothing on that");
  expect(r.seen).toEqual(["👀", "👍"]);
  // non-active user: no reaction, not handled
  const r2 = reactionLog();
  const handled2 = await processText(deps, { id: 9199 }, { text: "hi", messageId: 63 }, noop, { react: r2.react });
  await flush();
  expect(handled2).toBe(false);
  expect(r2.seen).toEqual([]);
});

test("a non-onboarded sender gets no reactions — the 👀 must not precede a refusal", async () => {
  const db = await freshTestDb();
  const r = reactionLog();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 401 }, [async () => new Uint8Array([1])], send, { react: r.react });
  await flush();
  expect(msgs[0]).toContain("/start");
  expect(r.seen).toEqual([]);
});

test("a SYNCHRONOUSLY throwing react neither blocks the analysis nor crashes", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 402);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 402 }, [async () => new Uint8Array([1])], send, {
    react: (() => { throw new Error("sync react throw"); }) as unknown as (e: string) => Promise<void>,
  });
  expect(msgs[0]).toContain("600");
  expect(await countMealsToday(db, 402, berlinDate(new Date(), cfg.tz))).toBe(1);
});

test("a rejected document (wrong mime) gets no reactions; an accepted one gets 👀 then 👍", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 403);
  const r = reactionLog();
  await processDocument(deps, { id: 403 }, { mime_type: "application/pdf" }, async () => new Uint8Array([1]), noop, { react: r.react });
  await flush();
  expect(r.seen).toEqual([]);
  await processDocument(deps, { id: 403 }, { mime_type: "image/jpeg", file_size: 1 }, async () => new Uint8Array([1]), noop, { react: r.react });
  await flush();
  expect(r.seen).toEqual(["👀", "👍"]);
});

test("a failing react never blocks the analysis or the meal insert", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 96);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 96 }, [async () => new Uint8Array([1])], send, {
    react: async () => { throw new Error("reaction rejected"); },
  });
  expect(msgs[0]).toContain("600");
  expect(await countMealsToday(db, 96, berlinDate(new Date(), cfg.tz))).toBe(1);
});

test("processDocument forwards the react thunk to the photo path", async () => {
  const db = await freshTestDb();
  const r = reactionLog();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 97);
  await processDocument(
    deps, { id: 97 },
    { mime_type: "image/jpeg", file_size: 1024 },
    async () => new Uint8Array([1]),
    noop,
    { react: r.react },
  );
  await flush();
  expect(r.seen).toEqual(["👀", "👍"]);
});

test("medium and high confidence get the generic hint, never the weight nudge", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 93);
  const t = translatorFor(DEFAULT_LANG);
  for (const confidence of ["medium", "high"]) {
    deps.provider = fakeProvider(JSON.stringify({ ...JSON.parse(foodJson()), confidence }));
    const { msgs, send } = collector();
    await processPhoto(deps, { id: 93 }, [async () => new Uint8Array([1])], send);
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
  await processPhoto(deps, { id: 94 }, [async () => new Uint8Array([1])], photo.send);
  deps.provider = fakeProvider(JSON.stringify({ intent: "correction", analysis: { ...JSON.parse(foodJson()), confidence: "low" } }));
  const { msgs, send } = collector();
  const handled = await processText(deps, { id: 94 }, { text: "actually 340 g", messageId: 64, replyTo: 1 }, send);
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
  await processPhoto(deps, { id: 80 }, [async () => new Uint8Array([1])], send);
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

test("/settings opens the root view with the four sections", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 401);
  const seen: string[][] = [];
  const send: Send = async (_t, buttons) => {
    seen.push((buttons ?? []).flat().map((b) => b.data));
    return { chat_id: 1, message_id: 1 };
  };
  await processSettingsOpen(deps, { id: 401 }, send);
  expect(seen[0]).toEqual(["st:goal", "st:restr", "st:lang", "st:format"]);
});

test("choosing a goal persists it and edits the message in place", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 402); // onboards as 'lose'
  const { edits, edit, last } = editor();
  await processSettingsCallback(deps, { id: 402 }, "st:goal:maintain", edit);
  expect((await getUser(db, 402))?.goal).toBe("maintain");
  expect(edits).toHaveLength(1); // edited, not appended
  expect(last().data).toEqual(["st:goal", "st:restr", "st:lang", "st:format"]); // back at root
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
  await processPhoto(deps, { id: 404 }, [async () => new Uint8Array([1])], send);
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

test("choosing a reply format in settings persists it per user", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 408);
  const { edit, last } = editor();
  await processSettingsCallback(deps, { id: 408 }, "st:format:rich", edit);
  expect((await getUser(db, 408))?.reply_format).toBe("rich");
  expect(last().data).toEqual(["st:goal", "st:restr", "st:lang", "st:format"]); // back at root
  expect(last().text).toContain(translatorFor(DEFAULT_LANG)("settings.format.rich"));
});

test("choosing the format that MATCHES the instance default still stores it (pins the user)", async () => {
  const db = await freshTestDb();
  // Plain instance, user taps plain: a naive "skip write if == default" would leave NULL and let
  // the user silently follow a future REPLY_FORMAT flip. The docstring promises the choice pins.
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg }; // plain
  await onboardToActive(deps, 418);
  const { edit } = editor();
  await processSettingsCallback(deps, { id: 418 }, "st:format:plain", edit);
  expect((await getUser(db, 418))?.reply_format).toBe("plain"); // stored, not NULL
  // and it holds against a later instance flip to rich:
  const rich: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: { ...cfg, replyFormat: "rich" } };
  let richCalls = 0;
  const sendRich = async () => (richCalls++, { chat_id: 1, message_id: 88 });
  const { msgs, send } = collector();
  await processPhoto(rich, { id: 418 }, [async () => new Uint8Array([1])], send, { sendRich });
  expect(richCalls).toBe(0); // still plain — the pin survived the instance-default change
  expect(msgs).toHaveLength(1);
});

test("the settings root shows the INSTANCE default format when the user never chose", async () => {
  const db = await freshTestDb();
  // PLAIN instance deliberately: a rich instance could never distinguish real resolution
  // (settingsProfile) from a hard-coded default. Plain is the only config that proves the
  // instance default actually flows through to the Style line.
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg }; // cfg is plain
  await onboardToActive(deps, 409); // reply_format NULL
  const texts: string[] = [];
  const send: Send = async (t) => { texts.push(t); return { chat_id: 1, message_id: 1 }; };
  await processSettingsOpen(deps, { id: 409 }, send);
  expect(texts[0]).toContain(translatorFor(DEFAULT_LANG)("settings.format.plain"));
});

test("a settings CALLBACK re-render also resolves the instance default (st:root, plain instance)", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg }; // plain instance
  await onboardToActive(deps, 415); // reply_format NULL
  const { edit, last } = editor();
  await processSettingsCallback(deps, { id: 415 }, "st:root", edit);
  expect(last().text).toContain(translatorFor(DEFAULT_LANG)("settings.format.plain"));
});

test("a user's plain preference beats a rich instance at the meal card", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: { ...cfg, replyFormat: "rich" } };
  await onboardToActive(deps, 410);
  await setReplyFormat(db, 410, "plain");
  let richCalls = 0;
  const sendRich = async () => (richCalls++, { chat_id: 1, message_id: 95 });
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 410 }, [async () => new Uint8Array([1])], send, { sendRich });
  expect(richCalls).toBe(0);
  expect(msgs).toHaveLength(1); // went plain despite the rich instance
});

test("a user's rich preference beats a plain instance at the meal card", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: cfg }; // cfg is plain
  await onboardToActive(deps, 411);
  await setReplyFormat(db, 411, "rich");
  let richCalls = 0;
  const sendRich = async () => (richCalls++, { chat_id: 1, message_id: 96 });
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 411 }, [async () => new Uint8Array([1])], send, { sendRich });
  expect(richCalls).toBe(1);
  expect(msgs).toHaveLength(0);
});

test("a junk stored reply_format falls back to the instance default", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: { ...cfg, replyFormat: "rich" } };
  await onboardToActive(deps, 412);
  await db`UPDATE users SET reply_format = 'markdown' WHERE telegram_id = 412`; // hand-edited or renamed-format row — never writable through the app
  let richCalls = 0;
  const sendRich = async () => (richCalls++, { chat_id: 1, message_id: 97 });
  const { send } = collector();
  await processPhoto(deps, { id: 412 }, [async () => new Uint8Array([1])], send, { sendRich });
  expect(richCalls).toBe(1); // junk ignored → instance default (rich)
});

test("a user's plain preference beats a rich instance at the correction card", async () => {
  const db = await freshTestDb();
  const outs = [foodJson(600)];
  const deps: BotDeps = { db, provider: { chat: async () => outs.shift() ?? corrIntentJson(900) }, config: { ...cfg, replyFormat: "rich" } };
  await onboardToActive(deps, 413);
  await setReplyFormat(db, 413, "plain");
  let richCalls = 0;
  const sendRich = async () => (richCalls++, { chat_id: 1, message_id: 98 });
  await processPhoto(deps, { id: 413 }, [async () => new Uint8Array([1])], collector().send, { sendRich });
  const { msgs, send } = collector();
  // reply to the photo analysis (bot message id 1 from the collector above)
  await processText(deps, { id: 413 }, { text: "actually 900 kcal", messageId: 5, replyTo: 1 }, send, { sendRich });
  expect(richCalls).toBe(0); // pref plain despite rich instance — at BOTH card sites
  expect(msgs.some((m) => m.includes("900"))).toBe(true); // correction applied, plain rendering
});

test("a user's rich preference renders the tm:log card rich and wires the reply id", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(mealIntentJson(450)), config: cfg }; // plain instance
  await onboardToActive(deps, 414);
  await setReplyFormat(db, 414, "rich");
  const { id } = await seedPending(db, 414);
  let richCalls = 0;
  const sendRich = async () => (richCalls++, { chat_id: 1, message_id: 99 });
  const { msgs, send } = collector();
  await processTextMealDecision(deps, { id: 414 }, `tm:log:${id}`, send, { sendRich });
  expect(richCalls).toBe(1); // rich pref wins at the confirm-card site too
  expect(msgs).toHaveLength(0);
  expect((await mealByReply(db, 414, 99))?.kcal).toBe(450); // rich Sent reaches setMealReply
});

test("an album flush carries the user's rich preference through to the card", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(300)), config: cfg }; // plain instance
  await onboardToActive(deps, 416);
  await setReplyFormat(db, 416, "rich");
  let richCalls = 0;
  const sendRich = async () => (richCalls++, { chat_id: 1, message_id: 100 });
  const { msgs, send } = collector(); // real send so a rich+plain double-send would show
  const bytes = new Uint8Array([1]);
  const parts: PendingAlbumPart[] = [
    { getBytes: async () => bytes, caption: undefined, messageId: 30, send, sendRich, react: async () => {}, from: { id: 416 } },
    { getBytes: async () => bytes, caption: undefined, messageId: 31, send, sendRich, react: async () => {}, from: { id: 416 } },
  ];
  await processAlbum(deps, "416:g9", parts);
  expect(richCalls).toBe(1); // one album → one rich card
  expect(msgs).toHaveLength(0); // and nothing went out the plain path
});

test("Q&A answers stay plain even for a rich-preference user", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("only text")), config: cfg };
  await onboardToActive(deps, 417);
  await setReplyFormat(db, 417, "rich");
  let richCalls = 0;
  const sendRich = async () => (richCalls++, { chat_id: 1, message_id: 101 });
  const { msgs, send } = collector();
  await processText(deps, { id: 417 }, { text: "how am I doing?", messageId: 40 }, send, { sendRich });
  expect(richCalls).toBe(0); // LLM text has unknown markup — never rich
  expect(msgs[0]).toBe("only text");
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

  await processPhoto(deps, { id: 1 }, [async () => new Uint8Array([1])], noop);
  await processPhoto(deps, { id: 2 }, [async () => new Uint8Array([1])], noop);
  const date = berlinDate(new Date(), cfg.tz);
  expect(await mealCountToday(db, date)).toBe(2);

  // a THIRD user, well under their own cap, is refused because the day is spent
  const c = collector();
  await processPhoto(deps, { id: 3 }, [async () => new Uint8Array([1])], c.send);
  expect(c.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.globalCap"));
  expect(await mealCountToday(db, date)).toBe(2); // no row written
});

test("the global cap is checked BEFORE the model is called, so it actually saves money", async () => {
  const db = await freshTestDb();
  let calls = 0;
  const counting: LLMProvider = { chat: async () => { calls++; return foodJson(); } };
  const deps: BotDeps = { db, provider: counting, config: { ...cfg, globalDailyAnalysisCap: 0 } };
  await onboardToActive(deps, 1);
  await processPhoto(deps, { id: 1 }, [async () => new Uint8Array([1])], noop);
  expect(calls).toBe(0); // a cap that fires after the call would be decorative
});

test("no global cap configured means unlimited", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 50, globalDailyAnalysisCap: null } };
  await onboardToActive(deps, 1);
  for (let i = 0; i < 5; i++) await processPhoto(deps, { id: 1 }, [async () => new Uint8Array([1])], noop);
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

test("a failing answerCallbackQuery does not abort the tap — the setting still persists", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider("{}"), config: cfg };
  await onboardToActive(deps, 505);
  const bot = createBot(deps);
  bot.botInfo = {
    id: 1, is_bot: true, first_name: "eait", username: "eait_bot",
    can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false,
    can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false,
    allows_users_to_create_topics: false, can_manage_bots: false,
    supports_join_request_queries: false,
  };
  // Stale query id: answerCallbackQuery throws ("query is too old"), everything else succeeds.
  bot.api.config.use(async (prev, method, payload, signal) => {
    if (method === "answerCallbackQuery") throw new Error("Bad Request: query is too old");
    return { ok: true, result: true as any };
  });
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  try {
    await bot.handleUpdate({
      update_id: 700001,
      callback_query: {
        id: "q-stale", chat_instance: "ci", data: "st:format:plain",
        from: { id: 505, is_bot: false, first_name: "u" },
        message: { message_id: 5, date: 0, chat: { id: 505, type: "private" } } as any,
      },
    } as any);
  } finally {
    warn.mockRestore();
  }
  // The guard means the throw is swallowed and the persist behind the tap still runs.
  expect((await getUser(db, 505))?.reply_format).toBe("plain");
});

test("a tm:log tap through createBot fires ctx.deleteMessage (the prompt-delete wiring is connected)", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 856);
  const { id } = await seedPending(db, 856);
  const bot = createBot(deps);
  bot.botInfo = {
    id: 1, is_bot: true, first_name: "eait", username: "eait_bot",
    can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false,
    can_connect_to_business: false, has_main_web_app: false, has_topics_enabled: false,
    allows_users_to_create_topics: false, can_manage_bots: false,
    supports_join_request_queries: false,
  };
  const methods: string[] = [];
  bot.api.config.use(async (_prev, method) => {
    methods.push(method);
    if (method === "sendMessage") return { ok: true, result: { message_id: 7, date: 0, chat: { id: 856, type: "private" } } as any };
    return { ok: true, result: true as any };
  });
  await bot.handleUpdate({
    update_id: 700200,
    callback_query: {
      id: "q1", chat_instance: "ci", data: `tm:log:${id}`,
      from: { id: 856, is_bot: false, first_name: "u" },
      message: { message_id: 33, date: 0, chat: { id: 856, type: "private" } } as any,
    },
  } as any);
  expect(methods).toContain("deleteMessage"); // the production wiring actually fires the delete
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
  await processPhoto(deps, { id: 42 }, [async () => new Uint8Array([1])], noop);
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

  await processPhoto(deps, { id: 42 }, [async () => new Uint8Array([1])], noop); // uses the 1
  const c = collector();
  await processPhoto(deps, { id: 42 }, [async () => new Uint8Array([1])], c.send);
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
  await processPhoto(deps, { id: 64 }, [async () => new Uint8Array([1])], send);
  await processPhoto(deps, { id: 64 }, [async () => new Uint8Array([1])], send);
  const firsts = (await eventsFor(db, 64)).filter((e) => e.event === "first_photo");
  expect(firsts).toHaveLength(1);
});

test("a photo blocked by the global cap logs a cap_hit event", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, globalDailyAnalysisCap: 0 } };
  await onboardToActive(deps, 65);
  const { send } = collector();
  await processPhoto(deps, { id: 65 }, [async () => new Uint8Array([1])], send);
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

// ---------- unified LLM-call caps (photo + correction + router draw one pool) ----------

test("photo and correction draw one per-user llm-call pool", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: { ...cfg, perUserDailyPhotoCap: 2 } };
  await onboardToActive(deps, 700);
  const c1 = collector();
  await processPhoto(deps, { id: 700 }, [async () => new Uint8Array([1])], c1.send); // call 1
  deps.provider = fakeProvider(JSON.stringify({ intent: "correction", analysis: JSON.parse(foodJson(300)) }));
  const c2 = collector();
  const handled = await processText(deps, { id: 700 }, { text: "actually 300 kcal", messageId: 65, replyTo: 1 }, c2.send); // call 2
  expect(handled).toBe(true);
  const date = berlinDate(new Date(), cfg.tz);
  expect(await llmCallsToday(db, 700, date)).toBe(2);
  const c3 = collector();
  await processPhoto(deps, { id: 700 }, [async () => new Uint8Array([1])], c3.send); // over cap
  expect(c3.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.dailyCap"));
  expect(await countMealsToday(db, 700, date)).toBe(1); // only the first photo became a meal
});

test("global cap counts llm calls across users, including not-food analyses", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = {
    db, provider: fakeProvider(JSON.stringify({ isFood: false })),
    config: { ...cfg, perUserDailyPhotoCap: 50, globalDailyAnalysisCap: 1 },
  };
  await onboardToActive(deps, 701);
  await onboardToActive(deps, 702);
  const date = berlinDate(new Date(), cfg.tz);
  const c1 = collector();
  await processPhoto(deps, { id: 701 }, [async () => new Uint8Array([1])], c1.send); // not food, still 1 call
  expect(await llmCallsToday(db, 701, date)).toBe(1);
  expect(await countMealsToday(db, 701, date)).toBe(0); // no meal row
  const c2 = collector();
  await processPhoto(deps, { id: 702 }, [async () => new Uint8Array([1])], c2.send);
  expect(c2.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.globalCap"));
});

test("correction over the per-user cap is refused before the provider is called", async () => {
  const db = await freshTestDb();
  let calls = 0;
  const provider: LLMProvider = { chat: async () => (calls++, foodJson()) };
  const deps: BotDeps = { db, provider, config: { ...cfg, perUserDailyPhotoCap: 1 } };
  await onboardToActive(deps, 703);
  const c1 = collector();
  await processPhoto(deps, { id: 703 }, [async () => new Uint8Array([1])], c1.send); // uses the pool
  const c2 = collector();
  const handled = await processText(deps, { id: 703 }, { text: "make it 900 kcal", messageId: 66, replyTo: 1 }, c2.send);
  expect(handled).toBe(true);
  expect(c2.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.dailyCap"));
  expect(calls).toBe(1); // the correction never reached the model
});

// ---------- albums: many photos, one meal ----------

test("photo meal stores user_message_id so a reply to the photo finds the meal", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 710);
  const { send } = collector();
  await processPhoto(deps, { id: 710 }, [async () => new Uint8Array([1])], send, { userMessageId: 321 });
  const meal = await mealByReply(db, 710, 321);
  expect(meal).toBeDefined();
  expect(meal!.user_message_id).toBe(321);
});

test("album parts produce ONE analysis with N images and one llm call", async () => {
  const db = await freshTestDb();
  let req: import("../llm/provider.ts").ChatRequest | undefined;
  const provider: LLMProvider = { chat: async (r) => ((req = r), foodJson()) };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 711);
  const { msgs, send } = collector();
  await processPhoto(
    deps, { id: 711 },
    [async () => new Uint8Array([1]), async () => new Uint8Array([2])],
    send,
    { caption: "порция и этикетка", userMessageId: 400 },
  );
  expect(req!.imagesB64?.length).toBe(2);
  expect(req!.userText).toContain("порция и этикетка");
  const date = berlinDate(new Date(), cfg.tz);
  expect(await llmCallsToday(db, 711, date)).toBe(1);
  expect(await countMealsToday(db, 711, date)).toBe(1);
  expect(msgs.length).toBe(1); // one reply for the whole album
});

// ---------- processText: the free-text router ----------

const qJson = (answer: string) => JSON.stringify({ intent: "question", answer });
const mealIntentJson = (kcal = 450) => JSON.stringify({ intent: "meal", analysis: JSON.parse(foodJson(kcal)) });
const datedMealJson = (dayOffset: number, kcal = 450) =>
  JSON.stringify({ intent: "meal", dayOffset, analysis: JSON.parse(foodJson(kcal)) });
const corrIntentJson = (kcal = 900) => JSON.stringify({ intent: "correction", analysis: JSON.parse(foodJson(kcal)) });

test("processText returns false for a non-active user (caller falls to onboarding)", async () => {
  const db = await freshTestDb();
  let calls = 0;
  const provider: LLMProvider = { chat: async () => (calls++, qJson("hi")) };
  const deps: BotDeps = { db, provider, config: cfg };
  const handled = await processText(deps, { id: 800 }, { text: "hello", messageId: 1 }, noop);
  expect(handled).toBe(false);
  expect(calls).toBe(0);
});

test("a reply to a remembered rejection gets the canned explain with zero provider calls", async () => {
  const db = await freshTestDb();
  let calls = 0;
  const provider: LLMProvider = { chat: async () => (calls++, qJson("hi")) };
  const rejections = new RejectionLog();
  rejections.add(801, 55);
  const deps: BotDeps = { db, provider, config: cfg, rejections };
  await onboardToActive(deps, 801);
  const { msgs, send } = collector();
  const handled = await processText(deps, { id: 801 }, { text: "what was it?", messageId: 2, replyTo: 55 }, send);
  expect(handled).toBe(true);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.rejectionExplain"));
  expect(calls).toBe(0);
});

test("a not-food photo registers its reply in the rejection log", async () => {
  const db = await freshTestDb();
  const rejections = new RejectionLog();
  const deps: BotDeps = { db, provider: fakeProvider(JSON.stringify({ isFood: false })), config: cfg, rejections };
  await onboardToActive(deps, 802);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 802 }, [async () => new Uint8Array([1])], send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.notFood"));
  expect(rejections.has(802, 1)).toBe(true); // collector's first message id is 1
});

test("a reply to the user's own photo reaches the router with the focus meal", async () => {
  const db = await freshTestDb();
  const outs = [foodJson(600), qJson("It was pasta")];
  let seen = "";
  const provider: LLMProvider = { chat: async (req) => { seen = req.userText; return outs.shift()!; } };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 803);
  await processPhoto(deps, { id: 803 }, [async () => new Uint8Array([1])], collector().send, { userMessageId: 777 });
  const { msgs, send } = collector();
  const handled = await processText(deps, { id: 803 }, { text: "what was it?", messageId: 3, replyTo: 777 }, send);
  expect(handled).toBe(true);
  expect(seen).toContain("focus meal");
  expect(msgs[0]).toBe("It was pasta");
});

test("a question replied to the bot's analysis answers without touching the meal", async () => {
  const db = await freshTestDb();
  const outs = [foodJson(600), qJson("about 600")];
  const provider: LLMProvider = { chat: async () => outs.shift()! };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 804);
  await processPhoto(deps, { id: 804 }, [async () => new Uint8Array([1])], collector().send);
  const { msgs, send } = collector();
  await processText(deps, { id: 804 }, { text: "how many kcal?", messageId: 4, replyTo: 1 }, send);
  expect(msgs[0]).toBe("about 600");
  const meal = await mealByReply(db, 804, 1);
  expect(meal!.kcal).toBe(600); // unchanged
  expect(meal!.corrected).toBe(false);
});

test("a correction replied to the bot's analysis updates the meal", async () => {
  const db = await freshTestDb();
  const outs = [foodJson(600), corrIntentJson(900)];
  const provider: LLMProvider = { chat: async () => outs.shift()! };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 805);
  await processPhoto(deps, { id: 805 }, [async () => new Uint8Array([1])], collector().send);
  const { msgs, send } = collector();
  await processText(deps, { id: 805 }, { text: "actually 900", messageId: 5, replyTo: 1 }, send);
  expect(msgs[0]).toContain(translatorFor(DEFAULT_LANG)("meal.updatedPrefix"));
  expect(msgs[0]).toContain("900");
  const meal = await mealByReply(db, 805, 1);
  expect(meal!.kcal).toBe(900);
  expect(meal!.corrected).toBe(true);
});

test("a plain-text question answers and draws one router llm call", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("You're at 0 kcal")), config: cfg };
  await onboardToActive(deps, 806);
  const { msgs, send } = collector();
  const handled = await processText(deps, { id: 806 }, { text: "how am I doing?", messageId: 6 }, send);
  expect(handled).toBe(true);
  expect(msgs[0]).toBe("You're at 0 kcal");
  expect(await llmCallsToday(db, 806, berlinDate(new Date(), cfg.tz))).toBe(1);
});

test("a text meal creates a pending row with confirm buttons and NO meal row", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(mealIntentJson(450)), config: cfg };
  await onboardToActive(deps, 807);
  const sentButtons: Array<Array<{ text: string; data: string }>> = [];
  const msgs: string[] = [];
  const send: Send = async (t, buttons) => {
    msgs.push(t);
    if (buttons) sentButtons.push(...buttons);
    return { chat_id: 9, message_id: 33 };
  };
  await processText(deps, { id: 807 }, { text: "ate 2 eggs and toast", messageId: 7 }, send);
  const t = translatorFor(DEFAULT_LANG);
  expect(msgs[0]).toContain(t("text.confirmPrompt"));
  expect(msgs[0]).toContain("450");
  expect(sentButtons.length).toBe(1);
  expect(sentButtons[0]!.map((b) => b.data.split(":").slice(0, 2).join(":"))).toEqual(["tm:log", "tm:cancel"]);
  expect(await countMealsToday(db, 807, berlinDate(new Date(), cfg.tz))).toBe(0);
});

test("a dated text meal ('yesterday') pends on the offset day, names it on the PROMPT and LOGGED card", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(datedMealJson(1, 450)), config: cfg };
  await onboardToActive(deps, 820);
  const sentButtons: Array<Array<{ text: string; data: string }>> = [];
  const msgs: string[] = [];
  const send: Send = async (t, buttons) => {
    msgs.push(t);
    if (buttons) sentButtons.push(...buttons);
    return { chat_id: 9, message_id: 40 };
  };
  await processText(deps, { id: 820 }, { text: "add on yesterday 2 beers", messageId: 40 }, send);

  const today = berlinDate(new Date(), cfg.tz);
  const yesterday = berlinDateMinus(today, 1);
  const label = berlinDayLabel(yesterday, DEFAULT_LANG, cfg.tz);
  const t = translatorFor(DEFAULT_LANG);
  // The DATED prompt line names the date — assert the prompt string itself, not just that the
  // label appears somewhere (formatReply also emits it, which would mask a dropped prompt line).
  expect(msgs[0]).toContain(t("text.confirmPromptDated", { date: label }));
  // Log it, capturing the card the user keeps: it must name the day too.
  const id = sentButtons[0]![0]!.data.split(":")[2]!;
  const dec = collector();
  await processTextMealDecision(deps, { id: 820 }, `tm:log:${id}`, dec.send);
  expect(dec.msgs[0]).toContain(label); // logged card names the day
  expect(await countMealsToday(db, 820, yesterday)).toBe(1);
  expect(await countMealsToday(db, 820, today)).toBe(0);
});

test("a dayOffset=7 meal lands exactly 7 calendar days back (independent expected date)", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(datedMealJson(7, 450)), config: cfg };
  await onboardToActive(deps, 826);
  const { msgs, send } = collector();
  const sentButtons: Array<Array<{ text: string; data: string }>> = [];
  const capture: Send = async (text, buttons) => { msgs.push(text); if (buttons) sentButtons.push(...buttons); return { chat_id: 9, message_id: 77 }; };
  await processText(deps, { id: 826 }, { text: "a week ago I had ramen", messageId: 77 }, capture);
  const today = berlinDate(new Date(), cfg.tz);
  const weekAgo = berlinDateMinus(today, 7);
  const id = sentButtons[0]![0]!.data.split(":")[2]!;
  await processTextMealDecision(deps, { id: 826 }, `tm:log:${id}`, collector().send);
  expect(await countMealsToday(db, 826, weekAgo)).toBe(1);
});

test("a dated preview's totals are the OFFSET day's, not today's", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(700)), config: cfg };
  await onboardToActive(deps, 827);
  // Log a real meal on TODAY first (700 kcal via a photo).
  await processPhoto(deps, { id: 827 }, [async () => new Uint8Array([1])], collector().send);
  // Now a dated (yesterday) text meal: its preview totals must NOT include today's 700.
  deps.provider = fakeProvider(datedMealJson(1, 450));
  const { msgs, send } = collector();
  await processText(deps, { id: 827 }, { text: "yesterday a snack", messageId: 78 }, send);
  const today = berlinDate(new Date(), cfg.tz);
  const label = berlinDayLabel(berlinDateMinus(today, 1), DEFAULT_LANG, cfg.tz);
  const t = translatorFor(DEFAULT_LANG);
  // The preview totals are yesterday's bucket (empty — confirm-first, nothing logged there yet),
  // NOT today's 700. Aggregating on `date` instead of `mealDate` would show 700 here.
  expect(msgs[0]).toContain(t("meal.totalKcalDated", { date: label, now: 0, target: 1800 }));
  expect(msgs[0]).not.toContain("700"); // today's total must not leak into a yesterday preview
});

test("correcting a past-dated meal names its date, not 'Today'", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(datedMealJson(1, 450)), config: cfg };
  await onboardToActive(deps, 828);
  // Log a yesterday meal, capturing its bot message id for the reply.
  const sentButtons: Array<Array<{ text: string; data: string }>> = [];
  const cap: Send = async (_t, buttons) => { if (buttons) sentButtons.push(...buttons); return { chat_id: 9, message_id: 50 }; };
  await processText(deps, { id: 828 }, { text: "yesterday 2 beers", messageId: 50 }, cap);
  const id = sentButtons[0]![0]!.data.split(":")[2]!;
  await processTextMealDecision(deps, { id: 828 }, `tm:log:${id}`, async () => ({ chat_id: 9, message_id: 51 }));

  const today = berlinDate(new Date(), cfg.tz);
  const yesterday = berlinDateMinus(today, 1);
  const label = berlinDayLabel(yesterday, DEFAULT_LANG, cfg.tz);
  const t = translatorFor(DEFAULT_LANG);
  // Reply to the logged card (bot message id 51) with a correction.
  deps.provider = fakeProvider(corrIntentJson(900));
  const { msgs, send } = collector();
  await processText(deps, { id: 828 }, { text: "actually one beer", messageId: 52, replyTo: 51 }, send);
  expect(msgs[0]).toContain(label); // correction card names yesterday
  expect(msgs[0]).not.toContain(t("meal.totalKcal", { now: 900, target: 1800 })); // not the "Today:" line
});

test("a plain text meal (no relative date) still pends and logs on today, with no date line", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(mealIntentJson(450)), config: cfg };
  await onboardToActive(deps, 821);
  const { msgs, send } = collector();
  await processText(deps, { id: 821 }, { text: "ate 2 eggs", messageId: 41 }, send);
  const today = berlinDate(new Date(), cfg.tz);
  // No "for <date>" line on a same-day meal — output is unchanged from before the feature.
  expect(msgs[0]).not.toContain(berlinDayLabel(today, DEFAULT_LANG, cfg.tz));
});

test("the per-user cap blocks the router before the provider is called", async () => {
  const db = await freshTestDb();
  let calls = 0;
  const provider: LLMProvider = { chat: async () => (calls++, qJson("x")) };
  const deps: BotDeps = { db, provider, config: { ...cfg, perUserDailyPhotoCap: 0 } };
  await onboardToActive(deps, 808);
  const { msgs, send } = collector();
  await processText(deps, { id: 808 }, { text: "hi", messageId: 8 }, send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.dailyCap"));
  expect(calls).toBe(0);
});

test("a router failure reports errors.textFailed and keeps the 👀", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: { chat: async () => { throw new Error("down"); } }, config: cfg };
  await onboardToActive(deps, 809);
  const r = reactionLog();
  const { msgs, send } = collector();
  await processText(deps, { id: 809 }, { text: "hi", messageId: 9 }, send, { react: r.react });
  await flush();
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.textFailed"));
  expect(r.seen).toEqual(["👀"]);
});

// ---------- tm: confirm callbacks ----------

async function seedPending(db: Awaited<ReturnType<typeof freshTestDb>>, userId: number): Promise<{ id: string; msgs: string[] }> {
  const deps: BotDeps = { db, provider: fakeProvider(mealIntentJson(450)), config: cfg };
  const sentButtons: Array<Array<{ text: string; data: string }>> = [];
  const msgs: string[] = [];
  const send: Send = async (t, buttons) => {
    msgs.push(t);
    if (buttons) sentButtons.push(...buttons);
    return { chat_id: 9, message_id: 33 };
  };
  await processText(deps, { id: userId }, { text: "ate 2 eggs", messageId: 70 }, send);
  const id = sentButtons[0]![0]!.data.split(":")[2]!;
  return { id, msgs };
}

test("tm:log inserts the meal, deletes pending, replies with totals, and the reply is correctable", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 810);
  const { id } = await seedPending(db, 810);
  const { msgs, send } = collector();
  await processTextMealDecision(deps, { id: 810 }, `tm:log:${id}`, send);
  expect(msgs[0]).toContain("450");
  expect(msgs[0]).toContain(translatorFor(DEFAULT_LANG)("meal.correctionHint"));
  const date = berlinDate(new Date(), cfg.tz);
  expect(await countMealsToday(db, 810, date)).toBe(1);
  const meal = await mealByReply(db, 810, 1); // collector's reply id
  expect(meal).toBeDefined();
  expect(meal!.kcal).toBe(450);
  // double-tap: pending row is gone
  const again = collector();
  await processTextMealDecision(deps, { id: 810 }, `tm:log:${id}`, again.send);
  expect(again.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("text.pendingGone"));
  expect(await countMealsToday(db, 810, date)).toBe(1); // still one meal
});

test("tm:log deletes the confirm prompt AFTER sending the result card", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 850);
  const { id } = await seedPending(db, 850);
  const events: string[] = [];
  const send: Send = async (text) => { events.push("send"); return { chat_id: 9, message_id: 5 }; };
  const deleteConfirm = async () => { events.push("delete"); };
  await processTextMealDecision(deps, { id: 850 }, `tm:log:${id}`, send, { deleteConfirm });
  // Card sent, prompt deleted, and the card came first — a failed send must never leave the
  // user with neither the prompt nor the result.
  expect(events).toEqual(["send", "delete"]);
});

test("tm:log: a failed prompt-delete does not throw, still logs, and warns WITH context", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 851);
  const { id } = await seedPending(db, 851);
  const { send } = collector();
  const deleteConfirm = async () => { throw new Error("message to delete not found"); };
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  try {
    await processTextMealDecision(deps, { id: 851 }, `tm:log:${id}`, send, { deleteConfirm });
    expect(await countMealsToday(db, 851, berlinDate(new Date(), cfg.tz))).toBe(1); // logged despite delete failure
    // The swallow must not be silent — an operator needs the user + call site to diagnose.
    expect(warn.mock.calls.some((c) => String(c[0]).includes("failed to delete confirm prompt") && String(c[0]).includes("user=851") && String(c[0]).includes("at=post-log"))).toBe(true);
  } finally {
    warn.mockRestore();
  }
});

test("tm:log: both sends failed (sendCard→undefined) keeps the prompt AND the re-tappable pending row", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 854);
  const { id } = await seedPending(db, 854);
  const { getPendingMeal } = await import("../db.ts");
  let deleted = false;
  const failSend: Send = async () => undefined; // both rich+plain failed → sendCard returns undefined
  const err = spyOn(console, "error").mockImplementation(() => {});
  try {
    await processTextMealDecision(deps, { id: 854 }, `tm:log:${id}`, failSend, { deleteConfirm: async () => { deleted = true; } });
    expect(await countMealsToday(db, 854, berlinDate(new Date(), cfg.tz))).toBe(1); // meal is in (idempotent insert)
    expect(deleted).toBe(false); // prompt NOT deleted — never "neither"
    expect(await getPendingMeal(db, id, 854)).toBeDefined(); // pending row survives for a re-tap
    expect(err.mock.calls.some((c) => String(c[0]).includes("card send failed"))).toBe(true); // loud, not silent
  } finally {
    err.mockRestore();
  }
});

test("tm:log on a TTL-expired pending still deletes the confirm prompt", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 855);
  const id = crypto.randomUUID();
  const staleTs = new Date(Date.now() - 49 * 3_600_000).toISOString();
  const { insertPendingMeal } = await import("../db.ts");
  await insertPendingMeal(db, { id, user_id: 855, ts: staleTs, date: "2026-07-20", analysis: JSON.parse(foodJson(300)), model: null });
  let deleted = false;
  const { send } = collector();
  await processTextMealDecision(deps, { id: 855 }, `tm:log:${id}`, send, { deleteConfirm: async () => { deleted = true; } });
  expect(deleted).toBe(true); // the stale dead-button prompt is cleared on the expiry path too
});

test("tm:cancel deletes the confirm prompt too (no lingering dead buttons)", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 852);
  const { id } = await seedPending(db, 852);
  let deleted = false;
  const { send } = collector();
  await processTextMealDecision(deps, { id: 852 }, `tm:cancel:${id}`, send, { deleteConfirm: async () => { deleted = true; } });
  expect(deleted).toBe(true);
});

test("tm:cancel deletes pending and acks; a stale id reports pendingGone", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 811);
  const { id } = await seedPending(db, 811);
  const { msgs, send } = collector();
  await processTextMealDecision(deps, { id: 811 }, `tm:cancel:${id}`, send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("text.cancelled"));
  expect(await countMealsToday(db, 811, berlinDate(new Date(), cfg.tz))).toBe(0);
  const stale = collector();
  await processTextMealDecision(deps, { id: 811 }, `tm:log:${id}`, stale.send);
  expect(stale.msgs[0]).toBe(translatorFor(DEFAULT_LANG)("text.pendingGone"));
});

test("a foreign user's tap cannot log someone else's pending meal", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 812);
  await onboardToActive(deps, 813);
  const { id } = await seedPending(db, 812);
  const { msgs, send } = collector();
  await processTextMealDecision(deps, { id: 813 }, `tm:log:${id}`, send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("text.pendingGone"));
  expect(await countMealsToday(db, 812, berlinDate(new Date(), cfg.tz))).toBe(0);
});

// ---------- rich formatting ----------

test("rich mode sends the HTML card through sendRich and wires the reply id for corrections", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: { ...cfg, replyFormat: "rich" } };
  await onboardToActive(deps, 820);
  const richCalls: Array<{ html: string; fallback: string }> = [];
  const sendRich = async ({ html, plain }: { html: string; plain: string }) => {
    richCalls.push({ html, fallback: plain });
    return { chat_id: 1, message_id: 91 };
  };
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 820 }, [async () => new Uint8Array([1])], send, { sendRich });
  expect(richCalls.length).toBe(1);
  expect(richCalls[0]!.html).toContain("<table");
  expect(richCalls[0]!.html).toContain("600");
  expect(richCalls[0]!.fallback).toContain("600"); // plain fallback rides along
  expect(msgs.length).toBe(0); // nothing went through the plain path
  expect((await mealByReply(db, 820, 91))?.kcal).toBe(600); // rich Sent wired into setMealReply
});

test("plain mode never calls sendRich even when it is wired", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson(600)), config: cfg };
  await onboardToActive(deps, 821);
  let richCalls = 0;
  const sendRich = async () => (richCalls++, { chat_id: 1, message_id: 92 });
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 821 }, [async () => new Uint8Array([1])], send, { sendRich });
  expect(richCalls).toBe(0);
  expect(msgs.length).toBe(1);
});

test("Q&A answers stay plain even in rich mode", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("just text")), config: { ...cfg, replyFormat: "rich" } };
  await onboardToActive(deps, 822);
  let richCalls = 0;
  const sendRich = async () => (richCalls++, { chat_id: 1, message_id: 93 });
  const { msgs, send } = collector();
  await processText(deps, { id: 822 }, { text: "hi", messageId: 80 }, send, { sendRich });
  expect(richCalls).toBe(0);
  expect(msgs[0]).toBe("just text");
});

// ---------- review-fix regression tests ----------

test("/cap 'used today' counts LLM calls, not stored meals", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(JSON.stringify({ isFood: false })), config: { ...cfg, adminUserId: 830, perUserDailyPhotoCap: 50, globalDailyAnalysisCap: 500 } };
  await onboardToActive(deps, 830);
  await processPhoto(deps, { id: 830 }, [async () => new Uint8Array([1])], collector().send); // not-food: 1 call, 0 meals
  deps.provider = fakeProvider(qJson("hi"));
  await processText(deps, { id: 830 }, { text: "how much left?", messageId: 90 }, collector().send); // 1 more call
  const cap = collector();
  await processCap(deps, { id: 830 }, "", cap.send);
  expect(cap.msgs[0]).toContain("2"); // 2 llm calls, 0 meals — display must show the enforced basis
});

test("the GLOBAL cap blocks the router before the provider is called", async () => {
  const db = await freshTestDb();
  let calls = 0;
  const provider: LLMProvider = { chat: async () => (calls++, qJson("x")) };
  const deps: BotDeps = { db, provider, config: { ...cfg, perUserDailyPhotoCap: 50, globalDailyAnalysisCap: 1 } };
  await onboardToActive(deps, 831);
  await onboardToActive(deps, 832);
  await logLlmCall(db, 832, berlinDate(new Date(), cfg.tz), "photo"); // someone else spent the cap
  const { msgs, send } = collector();
  await processText(deps, { id: 831 }, { text: "hi", messageId: 91 }, send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.globalCap"));
  expect(calls).toBe(0);
  expect((await eventsFor(db, 831)).some((e) => e.event === "cap_hit")).toBe(true);
});

test("tm:log after /delete reports pendingGone — no orphan crash", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 833);
  const { id } = await seedPending(db, 833);
  const { deleteUser } = await import("../db.ts");
  await deleteUser(db, 833);
  const { msgs, send } = collector();
  await processTextMealDecision(deps, { id: 833 }, `tm:log:${id}`, send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("text.pendingGone"));
});

test("a correction whose meal vanished mid-flight is NOT confirmed as updated", async () => {
  const db = await freshTestDb();
  const outs = [foodJson(600), corrIntentJson(900)];
  const provider: LLMProvider = { chat: async () => outs.shift()! };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 834);
  await processPhoto(deps, { id: 834 }, [async () => new Uint8Array([1])], collector().send);
  // meal vanishes between mealByReply and applyCorrection
  const meal = await mealByReply(db, 834, 1);
  const realApply = provider.chat;
  provider.chat = async (req) => {
    await db`DELETE FROM meals WHERE id = ${meal!.id}`;
    return realApply.call(provider, req);
  };
  const { msgs, send } = collector();
  await processText(deps, { id: 834 }, { text: "actually 900", messageId: 92, replyTo: 1 }, send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.correctionFailed"));
});

test("a confirmed text meal is reply-correctable via the ORIGINAL text message", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(mealIntentJson(450)), config: cfg };
  await onboardToActive(deps, 835);
  const sentButtons: Array<Array<{ text: string; data: string }>> = [];
  const send: Send = async (t, buttons) => {
    if (buttons) sentButtons.push(...buttons);
    return { chat_id: 9, message_id: 33 };
  };
  await processText(deps, { id: 835 }, { text: "ate 2 eggs", messageId: 4242 }, send);
  const id = sentButtons[0]![0]!.data.split(":")[2]!;
  await processTextMealDecision(deps, { id: 835 }, `tm:log:${id}`, collector().send);
  const meal = await mealByReply(db, 835, 4242); // reply to the user's own text message
  expect(meal).toBeDefined();
  expect(meal!.kcal).toBe(450);
});

test("a failed Telegram download is not billed as an LLM call", async () => {
  const db = await freshTestDb();
  let calls = 0;
  const provider: LLMProvider = { chat: async () => (calls++, foodJson()) };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 836);
  const { msgs, send } = collector();
  await processPhoto(deps, { id: 836 }, [async () => { throw new Error("telegram file download failed: 404"); }], send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("errors.analyzeFailed"));
  expect(calls).toBe(0);
  expect(await llmCallsToday(db, 836, berlinDate(new Date(), cfg.tz))).toBe(0);
});

test("first_photo fires for the first PHOTO even when a text meal came first", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(mealIntentJson(300)), config: cfg };
  await onboardToActive(deps, 837);
  const sentButtons: Array<Array<{ text: string; data: string }>> = [];
  const send: Send = async (t, buttons) => {
    if (buttons) sentButtons.push(...buttons);
    return { chat_id: 9, message_id: 33 };
  };
  await processText(deps, { id: 837 }, { text: "ate rice", messageId: 95 }, send);
  await processTextMealDecision(deps, { id: 837 }, `tm:log:${sentButtons[0]![0]!.data.split(":")[2]}`, collector().send);
  deps.provider = fakeProvider(foodJson(500));
  await processPhoto(deps, { id: 837 }, [async () => new Uint8Array([1])], collector().send);
  expect((await eventsFor(db, 837)).filter((e) => e.event === "first_photo").length).toBe(1);
});

test("a capped text user still gets the 👀 (seen ≠ will analyze, same as photos)", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("x")), config: { ...cfg, perUserDailyPhotoCap: 0 } };
  await onboardToActive(deps, 838);
  const r = reactionLog();
  await processText(deps, { id: 838 }, { text: "hi", messageId: 96 }, collector().send, { react: r.react });
  await flush();
  expect(r.seen).toEqual(["👀"]);
});

test("a pending older than the TTL cannot be confirmed", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 839);
  const id = crypto.randomUUID();
  const staleTs = new Date(Date.now() - 49 * 3_600_000).toISOString();
  const { insertPendingMeal } = await import("../db.ts");
  await insertPendingMeal(db, { id, user_id: 839, ts: staleTs, date: "2026-07-20", analysis: JSON.parse(foodJson(300)), model: null });
  const { msgs, send } = collector();
  await processTextMealDecision(deps, { id: 839 }, `tm:log:${id}`, send);
  expect(msgs[0]).toBe(translatorFor(DEFAULT_LANG)("text.pendingGone"));
  expect(await countMealsToday(db, 839, "2026-07-20")).toBe(0);
});

test("processText triggers the stale-pending sweep", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(mealIntentJson(300)), config: cfg };
  await onboardToActive(deps, 840);
  const oldId = crypto.randomUUID();
  const { insertPendingMeal, getPendingMeal } = await import("../db.ts");
  await insertPendingMeal(db, { id: oldId, user_id: 840, ts: new Date(Date.now() - 72 * 3_600_000).toISOString(), date: "2026-07-19", analysis: JSON.parse(foodJson(1)), model: null });
  await processText(deps, { id: 840 }, { text: "ate rice", messageId: 97 }, collector().send);
  expect(await getPendingMeal(db, oldId, 840)).toBeUndefined(); // swept by the insert-path prune
});

test("a reply with focus can still be a NEW meal (\"also had a coke\") — confirm flow, focus untouched", async () => {
  const db = await freshTestDb();
  const outs = [foodJson(600), mealIntentJson(140)];
  const provider: LLMProvider = { chat: async () => outs.shift()! };
  const deps: BotDeps = { db, provider, config: cfg };
  await onboardToActive(deps, 841);
  await processPhoto(deps, { id: 841 }, [async () => new Uint8Array([1])], collector().send);
  const sentButtons: Array<Array<{ text: string; data: string }>> = [];
  const send: Send = async (t, buttons) => {
    if (buttons) sentButtons.push(...buttons);
    return { chat_id: 9, message_id: 34 };
  };
  await processText(deps, { id: 841 }, { text: "also had a coke", messageId: 98, replyTo: 1 }, send);
  expect(sentButtons.length).toBe(1); // confirm prompt, not a correction
  expect((await mealByReply(db, 841, 1))!.kcal).toBe(600); // focus meal untouched
});

test("tm:log across midnight logs to the pending's own date (pinned as deliberate)", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(qJson("unused")), config: cfg };
  await onboardToActive(deps, 842);
  const id = crypto.randomUUID();
  const { insertPendingMeal } = await import("../db.ts");
  const yesterday = new Date(Date.now() - 20 * 3_600_000).toISOString();
  await insertPendingMeal(db, { id, user_id: 842, ts: yesterday, date: "2026-07-21", analysis: JSON.parse(foodJson(300)), model: null });
  await processTextMealDecision(deps, { id: 842 }, `tm:log:${id}`, collector().send);
  expect(await countMealsToday(db, 842, "2026-07-21")).toBe(1); // the described day, not today
});

test("the onboarding restriction classifier is metered as an llm call", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(JSON.stringify({ tags: ["kidneys"] })), config: cfg };
  await processOnboarding(deps, { id: 843 }, { type: "command", command: "start" }, noop);
  await processOnboarding(deps, { id: 843 }, { type: "callback", data: "consent_agree" }, noop);
  await processOnboarding(deps, { id: 843 }, { type: "callback", data: "goal_lose" }, noop);
  await processOnboarding(deps, { id: 843 }, { type: "text", text: "92" }, noop);
  await processOnboarding(deps, { id: 843 }, { type: "text", text: "j'ai des problèmes rénaux" }, noop); // no keyword match → classifier
  expect(await llmCallsToday(db, 843, berlinDate(new Date(), cfg.tz))).toBe(1);
});

// ---------- processAlbum ----------

test("processAlbum: caption on the second part reaches the analyzer prompt", async () => {
  // The user sends a portion photo + a product-label photo as one album.
  // Only the label photo carries a caption; processAlbum must find it and pass it through.
  const db = await freshTestDb();
  let capturedReq: any;
  const captureProvider: LLMProvider = {
    chat: async (req) => { capturedReq = req; return foodJson(300); },
  };
  const deps: BotDeps = { db, provider: captureProvider, config: cfg };
  await onboardToActive(deps, 900);

  const bytes = new Uint8Array([1]);
  const parts: PendingAlbumPart[] = [
    { getBytes: async () => bytes, caption: undefined, messageId: 10, send: noop, sendRich: async () => undefined, react: async () => {}, from: { id: 900 } },
    { getBytes: async () => bytes, caption: "Oatmeal 100g", messageId: 11, send: noop, sendRich: async () => undefined, react: async () => {}, from: { id: 900 } },
  ];

  await processAlbum(deps, "900:g1", parts);

  // The provider saw the caption in the userText of the chat request
  expect(capturedReq).toBeDefined();
  expect(capturedReq.userText).toContain("Oatmeal 100g");
  // A meal row was inserted (album treated as one meal)
  expect(await countMealsToday(db, 900, berlinDate(new Date(), cfg.tz))).toBe(1);
});

test("processAlbum: getBytes throw yields errors.analyzeFailed reply and no meal row", async () => {
  const db = await freshTestDb();
  const deps: BotDeps = { db, provider: fakeProvider(foodJson()), config: cfg };
  await onboardToActive(deps, 901);

  const { msgs, send } = collector();
  const parts: PendingAlbumPart[] = [
    {
      getBytes: async () => { throw new Error("download failed: 403"); },
      caption: undefined, messageId: 20, send, sendRich: async () => undefined, react: async () => {},
      from: { id: 901 },
    },
  ];

  // processAlbum must not throw — it catches internally and sends the error reply
  await processAlbum(deps, "901:g2", parts);

  // The English locale has "Couldn't read that 🤔 send the photo again."
  expect(msgs.some((m) => m.toLowerCase().includes("couldn") || m.includes("🤔"))).toBe(true);
  expect(await countMealsToday(db, 901, berlinDate(new Date(), cfg.tz))).toBe(0);
});

// ---------- makeSendRich ----------

const card = { html: "<h3>Test</h3>", plain: "Test plain" };

test("makeSendRich: rich succeeds → returns the Sent from sendRichMessage", async () => {
  const ctx = {
    chat: { id: 99 },
    api: { sendRichMessage: async (_: number, __: any) => ({ chat: { id: 99 }, message_id: 7 }) },
    reply: async (_: string) => { throw new Error("should not fall back"); },
  };
  const sendRich = makeSendRich(ctx);
  const result = await sendRich(card);
  expect(result).toEqual({ chat_id: 99, message_id: 7 });
});

test("makeSendRich: rich fails → falls back to plain, returns Sent, warns WITH the chat id", async () => {
  const ctx = {
    chat: { id: 99 },
    api: { sendRichMessage: async () => { throw new Error("rich not supported"); } },
    reply: async (_: string) => ({ chat: { id: 99 }, message_id: 3 }),
  };
  const warn = spyOn(console, "warn").mockImplementation(() => {});
  try {
    const sendRich = makeSendRich(ctx);
    const result = await sendRich(card);
    expect(result).toEqual({ chat_id: 99, message_id: 3 });
    // chat id in the warn is what makes a per-user "I chose rich, nothing changed" diagnosable.
    expect(warn.mock.calls.some((c) => String(c[0]).includes("chat=99"))).toBe(true);
  } finally {
    warn.mockRestore();
  }
});

test("makeSendRich: both fail → returns undefined, never throws", async () => {
  const ctx = {
    chat: { id: 99 },
    api: { sendRichMessage: async () => { throw new Error("rich not supported"); } },
    reply: async (_: string) => { throw new Error("plain also failed"); },
  };
  const sendRich = makeSendRich(ctx);
  const result = await sendRich(card);
  expect(result).toBeUndefined();
});
