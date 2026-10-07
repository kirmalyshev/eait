import { beforeEach, describe, expect, it } from "bun:test";
import { LANGS, NOTIFICATION_IDS, copyFromPushRows, notificationCopyFor } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { patchProfile, type EngineDeps } from "./index.ts";
import { dailyNotification } from "./notify.ts";
import {
  listPushTemplates, reviewPushTemplate, rotatedVariant, savePushTemplate, sendableCopy,
} from "./push-templates.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  timezone: "Europe/Berlin",
};
const DAY = "2026-10-08";
const NOW = Date.parse("2026-10-08T20:30:00+02:00");

let store: Store;
let deps: EngineDeps;
let userId: string;

beforeEach(async () => {
  store = memoryStore();
  deps = { store, config: CONFIG, llm: demoPorts(), push: fakePush() };
  // A free, onboarded account: its one daily message is the nudge.
  userId = (await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;
  await store.addIdentity(userId, "google", "g-" + userId.slice(0, 8));
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "some", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true,
  });
  if (!out || !out.ok) throw new Error("onboarding failed");
});

const nudge = (lang: (typeof LANGS)[number]) => ({
  key: "nudge", lang, variant: "default", title: "Today's meals", body: "Log what you ate today.",
});

describe("push templates", () => {
  it("migrates the shipped copy in as reviewed and round-trips it unchanged", async () => {
    const { rows, keys } = await listPushTemplates(deps);
    expect(rows.every((r) => r.status === "reviewed" && r.reviewed_by === "migration")).toBe(true);
    expect(keys.every((k) => k.gaps.length === 0)).toBe(true);
    for (const lang of LANGS) {
      expect(copyFromPushRows(rows, lang, notificationCopyFor(lang))).toEqual(notificationCopyFor(lang));
    }
  });

  it("listing twice seeds once", async () => {
    const a = await listPushTemplates(deps);
    const b = await listPushTemplates(deps);
    expect(b.rows.length).toBe(a.rows.length);
    expect(a.rows.length).toBe(LANGS.length * 4); // trial-end, evening x2, nudge
  });

  it("a language left as a draft makes the sender refuse the key — for every language", async () => {
    expect(await dailyNotification(deps, userId, DAY, NOW)).not.toBeNull();
    const saved = await savePushTemplate(deps, nudge("ru"), "draft", "kirill");
    expect(saved.ok).toBe(true);
    expect(await sendableCopy(deps, "nudge", "en")).toBeNull();
    expect(await dailyNotification(deps, userId, DAY, NOW)).toBeNull();
    // The other keys are untouched.
    expect(await sendableCopy(deps, "evening", "en")).not.toBeNull();
    const reviewed = await reviewPushTemplate(deps, nudge("ru"), "kirill");
    expect(reviewed.ok).toBe(true);
    expect(await dailyNotification(deps, userId, DAY, NOW)).not.toBeNull();
  });

  it("an edit marked reviewed reaches the very next send", async () => {
    const out = await savePushTemplate(
      deps, { ...nudge("en"), body: "Evening — what did you eat?" }, "reviewed", "kirill",
    );
    expect(out.ok).toBe(true);
    const sent = await dailyNotification(deps, userId, DAY, NOW);
    expect(sent?.body).toBe("Evening — what did you eat?");
  });

  it("the claims gate refuses to mark a health claim reviewed, and still lets it be a draft", async () => {
    const claim = { ...nudge("de"), body: "Garantierter Gewichtsverlust" };
    const refused = await savePushTemplate(deps, claim, "reviewed", "kirill");
    expect(refused.ok).toBe(false);
    expect((await savePushTemplate(deps, claim, "draft", "kirill")).ok).toBe(true);
    const review = await reviewPushTemplate(deps, claim, "kirill");
    expect(review.ok).toBe(false);
    expect((await store.listPushTemplates()).find((r) => r.key === "nudge" && r.lang === "de")!.status).toBe("draft");
  });

  it("no health value in push text", async () => {
    const out = await savePushTemplate(deps, { ...nudge("en"), body: "You are at 1800 kcal" }, "reviewed", "kirill");
    expect(out.ok).toBe(false);
  });

  it("plural rules are checked on save, per language", async () => {
    const withPlural = (lang: "en" | "ru", cats: string) => ({
      ...nudge(lang), body: `Log {days, plural, ${cats}}`,
    });
    // `days` is declared by no shipped key, so even a well-formed block is refused: nothing fills it.
    const refused = await savePushTemplate(deps, withPlural("en", "one {a} other {b}"), "draft", "k");
    expect(refused.ok).toBe(false);
    expect(refused.ok ? "" : refused.errors.join()).toContain("days");
  });

  it("a save naming an unknown key, language or status is refused", async () => {
    expect((await savePushTemplate(deps, { ...nudge("en"), key: "spam" }, "draft", "k")).ok).toBe(false);
    expect((await savePushTemplate(deps, { ...nudge("en"), lang: "xx" }, "draft", "k")).ok).toBe(false);
    expect((await savePushTemplate(deps, nudge("en"), "published", "k")).ok).toBe(false);
  });

  it("seeds once per process, not once per send", async () => {
    let seeds = 0;
    const real = store.seedPushTemplates.bind(store);
    store.seedPushTemplates = async (rows) => { seeds++; return real(rows); };
    for (let i = 0; i < 3; i++) await dailyNotification(deps, userId, DAY, NOW);
    expect(seeds).toBe(1);
  });

  it("old stored copy the gate refuses migrates as a draft and blocks the key", async () => {
    await store.putNotificationCopy("de", {
      ...notificationCopyFor("de"), nudge: { title: "Heute", body: "Du hast 1.800 Kalorien" },
    });
    const { keys } = await listPushTemplates(deps);
    expect(keys.find((k) => k.key === "nudge")!.gaps).toEqual(["de/default"]);
    expect(await dailyNotification(deps, userId, DAY, NOW)).toBeNull();
  });

  it("reviewed_by is the admin account id, and the empty body goes out under the default title", async () => {
    const empty = { key: "evening", lang: "en", variant: "empty", title: "", body: "Nothing yet — {plan}kcal. {tomorrow}" };
    const out = await savePushTemplate(deps, empty, "reviewed", "admin-account-id");
    expect(out.ok && out.row.reviewed_by).toBe("admin-account-id");
    expect((await savePushTemplate(deps, { ...empty, title: "Edited" }, "reviewed", "a")).ok).toBe(false);
    const copy = (await sendableCopy(deps, "evening", "en"))!;
    expect(copy.evening.emptyBody).toBe(empty.body);
    expect(copy.evening.title).toBe(notificationCopyFor("en").evening.title);
  });

  it("every key the product sends has rows after listing", async () => {
    const { rows } = await listPushTemplates(deps);
    for (const key of NOTIFICATION_IDS) expect(rows.some((r) => r.key === key)).toBe(true);
  });
});

describe("rotation port", () => {
  const day = 86_400_000;
  it("reads uses through the port and avoids the last 7 days", async () => {
    const uses = async () => [{ variant: "a", sentAt: NOW - day }];
    expect(await rotatedVariant("u", "evening", uses, NOW, ["a", "b"])).toBe("b");
    expect(await rotatedVariant("u", "evening", async () => [], NOW, ["a", "b"])).toBe("a");
  });
});
