// Settings as an ENGINE flow, driven with no Telegram in the call.
//
// Same argument as `onboarding.test.ts`: before the move, changing a goal, a weight, a locale or a
// reply format required a Telegram callback, so `api/` had a user it could not configure. Every
// assertion here is one an HTTP client makes.

import { afterAll, describe, expect, test } from "bun:test";
import {
  openSettings, applySettingsAction, submitSettingsInput, setUserLanguage,
} from "./settings.ts";
import { cleanupTestDbs, freshTestDb } from "../testutil.ts";
import { getUser, setProfile, upsertUser, type Db } from "../db.ts";
import { translatorFor } from "../i18n/index.ts";
import type { Config } from "../config.ts";
import type { EngineDeps } from "./deps.ts";

afterAll(cleanupTestDbs, 60_000);

const cfg: Config = {
  telegramBotToken: "x", openrouterApiKey: "x", llmProvider: "openrouter", llmModel: "test",
  llmTimeoutMs: 1000, tz: "Europe/Berlin",
  pg: { host: "127.0.0.1", port: 5439, user: "eait", password: "eait", database: "unused" },
  perUserDailyPhotoCap: 5, adminUserId: null, allowedUserIds: null, globalDailyAnalysisCap: null,
  replyFormat: "plain", apiPort: null, apiHost: "127.0.0.1",
};

const tf = translatorFor;

async function ctx(over: Partial<Config> = {}) {
  const db = await freshTestDb();
  const deps: EngineDeps = {
    db, config: { ...cfg, ...over },
    analyzePhoto: async () => { throw new Error("unused"); },
    routeText: async () => { throw new Error("unused"); },
    classifyRestrictions: async () => [],
  };
  return { db, deps };
}

async function activeUser(db: Db, id: number) {
  await upsertUser(db, { telegram_id: id });
  await setProfile(db, id, { state: "active", goal: "lose", weight_kg: 93 });
}

/** Narrow to the view, failing loudly rather than silently skipping the assertions. */
function view(r: Awaited<ReturnType<typeof openSettings>>) {
  if (r.kind !== "view") throw new Error(`expected a view, got ${r.kind}`);
  return r.view;
}

describe("engine settings", () => {
  test("a non-onboarded user gets a refusal, not a view", async () => {
    const { db, deps } = await ctx();
    await upsertUser(db, { telegram_id: 800 });
    expect((await openSettings(deps, 800, tf)).kind).toBe("not-onboarded");
    expect((await applySettingsAction(deps, 800, "st:g:goal", tf)).kind).toBe("not-onboarded");
  });

  test("opening cancels a half-finished text prompt from a previous session", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 801);
    // Arm one, then reopen.
    const armed = view(await applySettingsAction(deps, 801, "st:weight", tf));
    expect(armed.awaitInput).toBe("weight");
    expect((await getUser(db, 801))?.pending_input).toBe("weight");

    await openSettings(deps, 801, tf);
    expect((await getUser(db, 801))?.pending_input).toBeNull();
  });

  test("a goal change persists and the root summary reflects it", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 802);
    await applySettingsAction(deps, 802, "st:goal:gain", tf);
    expect((await getUser(db, 802))?.goal).toBe("gain");
    const root = view(await openSettings(deps, 802, tf));
    expect(root.text).toContain(translatorFor("en")("me.goal.gain"));
  });

  test("a typed weight is parsed, persisted, and disarms the prompt", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 803);
    await applySettingsAction(deps, 803, "st:weight", tf);
    const v = view(await submitSettingsInput(deps, 803, "weight", "88.5", tf));
    expect(v.awaitInput).toBeUndefined();
    expect((await getUser(db, 803))?.weight_kg).toBe(88.5);
    expect((await getUser(db, 803))?.pending_input).toBeNull();
  });

  test("an unparseable weight re-arms the prompt instead of storing nonsense", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 804);
    await applySettingsAction(deps, 804, "st:weight", tf);
    const v = view(await submitSettingsInput(deps, 804, "weight", "banana", tf));
    expect(v.awaitInput).toBe("weight");
    expect((await getUser(db, 804))?.weight_kg).toBe(93); // unchanged
    expect((await getUser(db, 804))?.pending_input).toBe("weight");
  });

  test("submitting text with no prompt armed is refused, not applied", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 805);
    const r = await submitSettingsInput(deps, 805, "weight", "70", tf);
    expect(r.kind).toBe("no-prompt");
    expect((await getUser(db, 805))?.weight_kg).toBe(93);
  });

  test("submitting text for a DIFFERENT field than the one armed is refused", async () => {
    // The engine trusts the row, not the caller: an API client that posts `field: "country"` while
    // the weight prompt is armed must not get a country write out of it.
    const { db, deps } = await ctx();
    await activeUser(db, 806);
    await applySettingsAction(deps, 806, "st:weight", tf);
    const r = await submitSettingsInput(deps, 806, "country", "Neverland", tf);
    expect(r.kind).toBe("no-prompt");
    expect((await getUser(db, 806))?.country).toBeNull();
  });

  test("tapping any other button cancels an armed prompt", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 807);
    await applySettingsAction(deps, 807, "st:weight", tf);
    await applySettingsAction(deps, 807, "st:g:goal", tf);
    expect((await getUser(db, 807))?.pending_input).toBeNull();
  });

  test("the reply format shown is the EFFECTIVE one — user choice, else the instance default", async () => {
    const { db, deps } = await ctx({ replyFormat: "rich" });
    await activeUser(db, 808);
    // No user choice yet: the instance default is what the machine renders against.
    const before = view(await openSettings(deps, 808, tf));
    expect(before.text).toContain(translatorFor("en")("settings.format.rich"));
    await applySettingsAction(deps, 808, "st:format:plain", tf);
    expect((await getUser(db, 808))?.reply_format).toBe("plain");
  });

  test("a food field clears to the '' sentinel, distinct from never-asked", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 809);
    await applySettingsAction(deps, 809, "st:medical", tf);
    await submitSettingsInput(deps, 809, "medical", "no peanuts", tf);
    expect((await getUser(db, 809))?.medical_limitations).toBe("no peanuts");
    await applySettingsAction(deps, 809, "st:medical:clear", tf);
    expect((await getUser(db, 809))?.medical_limitations).toBe("");
  });

  test("setUserLanguage stores a registered code and rejects anything else", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 810);
    expect(await setUserLanguage(deps, 810, "ru")).toEqual({ kind: "ok", lang: "ru" });
    expect((await getUser(db, 810))?.lang).toBe("ru");
    expect(await setUserLanguage(deps, 810, "klingon")).toEqual({ kind: "unknown-language" });
    expect((await getUser(db, 810))?.lang).toBe("ru"); // untouched
  });

  test("one user's settings write never reaches another's row", async () => {
    const { db, deps } = await ctx();
    await activeUser(db, 811);
    await activeUser(db, 812);
    await applySettingsAction(deps, 811, "st:goal:gain", tf);
    expect((await getUser(db, 811))?.goal).toBe("gain");
    expect((await getUser(db, 812))?.goal).toBe("lose");
  });
});
