import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
// The onboarding engine: content storage, event sanitising, and the funnel.
//
// The event tests are the important ones. `/v1/onboarding/events` is authenticated with an ordinary
// user's token, so every rule about what may be stored has to hold against a caller who is not our
// app — a client that sends a body weight as an event value, or a place name that is a megabyte of
// text, is not hypothetical once the API is public.

import { beforeEach, describe, expect, it } from "bun:test";
import { ONBOARDING_CONTENT, ONBOARDING_PLACES, DEFAULT_ONBOARDING_CONTENT, type OnboardingContent } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import {
  onboardingContent, onboardingFunnel, recordOnboardingEvents, resetOnboardingContent,
  saveOnboardingContent,
} from "./onboarding.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
};

let store: Store;
let deps: EngineDeps;
let userId: string;

beforeEach(async () => {
  store = memoryStore();
  deps = { store, config: CONFIG, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
  userId = await store.createUser("en");
});

const clone = (c: OnboardingContent): OnboardingContent => structuredClone(c);

const event = (over: Record<string, unknown> = {}) => ({
  id: crypto.randomUUID(),
  sessionId: "s1",
  place: "goal",
  action: "view",
  contentVersion: 1,
  at: new Date().toISOString(),
  ...over,
});

describe("content", () => {
  it("serves the shipped copy when nothing has been saved", async () => {
    // Not seeded on boot, deliberately: seeding makes "has an admin ever touched this?"
    // unanswerable, and the answer decides whether a copy change is worth attributing anything to.
    expect(await store.getOnboardingContent()).toBeNull();
    expect((await onboardingContent(deps, "en")).version).toBe(DEFAULT_ONBOARDING_CONTENT.version);
  });

  it("bumps the version on save, ignoring whatever the admin sent", async () => {
    const before = (await onboardingContent(deps, "en")).version;
    const payload = clone(DEFAULT_ONBOARDING_CONTENT);
    payload.version = 99; // an admin's stale copy, or a hand-edited JSON
    payload.screens[0]!.asks.goal!.lines = ["Why are you here?"];

    const saved = await saveOnboardingContent(deps, payload, "en");
    expect(saved.ok).toBe(true);
    // The version is the join key between a funnel row and the words that produced it. Accepting
    // the client's number would let two different flows share one, which silently averages two
    // experiments into one meaningless number.
    expect(saved.ok && saved.content.version).toBe(before + 1);
    expect((await onboardingContent(deps, "en")).screens[0]!.asks.goal!.lines).toEqual(["Why are you here?"]);
  });

  it("refuses invalid copy and stores nothing", async () => {
    const payload = clone(DEFAULT_ONBOARDING_CONTENT);
    payload.screens = payload.screens.filter((s) => s.id !== "target");

    const result = await saveOnboardingContent(deps, payload, "en");
    expect(result.ok).toBe(false);
    expect(result.ok === false && result.errors.join(" ")).toContain("target");
    // The refusal is total: a half-saved flow is worse than an unsaved one.
    expect(await store.getOnboardingContent()).toBeNull();
  });

  it("restores the defaults with a version ahead of the edit it replaces", async () => {
    const edited = clone(DEFAULT_ONBOARDING_CONTENT);
    edited.screens[0]!.asks.goal!.lines = ["Broken but valid"];
    await saveOnboardingContent(deps, edited, "en");

    const restored = await resetOnboardingContent(deps, "en");
    expect(restored.screens[0]!.asks.goal!.lines)
      .toEqual(DEFAULT_ONBOARDING_CONTENT.screens[0]!.asks.goal!.lines);
    // Ahead, not back to 1. An app that cached the bad copy compares versions, and a lower number
    // would leave it showing the thing the admin just undid.
    expect(restored.version).toBeGreaterThan(DEFAULT_ONBOARDING_CONTENT.version + 1);
  });
});

describe("events", () => {
  it("stores what the app sends", async () => {
    const n = await recordOnboardingEvents(deps, userId, [
      event({ place: "goal", action: "view" }),
      event({ place: "goal", action: "answer", field: "goal", value: "lose", ms: 2400 }),
    ]);
    expect(n).toBe(2);

    const funnel = await onboardingFunnel(deps, 30);
    const goal = funnel.rows.find((r) => r.place === "goal")!;
    expect(goal.views).toBe(1);
    expect(goal.answers).toBe(1);
    expect(goal.medianMs).toBe(2400);
  });

  it("is idempotent on the event id", async () => {
    const e = event({ action: "view" });
    expect(await recordOnboardingEvents(deps, userId, [e])).toBe(1);
    // The app re-sends a batch it could not confirm. A funnel that double-counted those would
    // report its best numbers for its worst-connected users.
    expect(await recordOnboardingEvents(deps, userId, [e])).toBe(0);
    expect((await onboardingFunnel(deps, 30)).rows.find((r) => r.place === "goal")!.views).toBe(1);
  });

  it("drops an unknown place or action rather than storing it", async () => {
    const n = await recordOnboardingEvents(deps, userId, [
      event({ place: "the-paywall" }),
      event({ action: "purchased" }),
      event({ place: "x".repeat(5000) }),
    ]);
    expect(n).toBe(0);
  });

  it("strips a value for a field that is not enumerated", async () => {
    // THE PRIVACY RULE, enforced on the write. A client that sends a body weight as an event value
    // must not be able to put it in the analytics table, whatever the app promises to send.
    await recordOnboardingEvents(deps, userId, [
      event({ place: "body", action: "answer", field: "weight_kg", value: "93" }),
      event({ place: "restrictions", action: "answer", field: "medical_limitations", value: "stage 3 CKD" }),
      event({ place: "goal", action: "answer", field: "goal", value: "lose" }),
    ]);

    const stored = await store.onboardingFunnel(30);
    expect(stored.rows.find((r) => r.place === "body")!.answers).toBe(1);
    // The rows exist — the funnel still knows those screens were answered — and the values do not.
    const raw = JSON.stringify(stored);
    expect(raw).not.toContain("93");
    expect(raw).not.toContain("CKD");
  });

  it("caps a batch", async () => {
    const many = Array.from({ length: 500 }, () => event({ action: "view" }));
    expect(await recordOnboardingEvents(deps, userId, many)).toBe(100);
  });

  it("survives junk without throwing", async () => {
    expect(await recordOnboardingEvents(deps, userId, "not an array")).toBe(0);
    expect(await recordOnboardingEvents(deps, userId, [null, 7, {}, { id: "x" }])).toBe(0);
    // A phone whose clock is wrong must not break the insert.
    expect(await recordOnboardingEvents(deps, userId, [event({ at: "tuesday" })])).toBe(1);
  });

  it("is erased with the account", async () => {
    await recordOnboardingEvents(deps, userId, [event({ action: "view" })]);
    expect((await onboardingFunnel(deps, 30)).sessions).toBe(1);

    await store.deleteUser(userId);
    // Onboarding tells the user "deleting your account erases it" while asking about their kidneys.
    // The funnel is not an exception to that sentence.
    expect((await onboardingFunnel(deps, 30)).sessions).toBe(0);
  });
});

describe("the funnel", () => {
  beforeEach(async () => {
    const at = new Date().toISOString();
    // Two runs. One completes; one abandons on the body screen, which is the screen a real
    // onboarding loses people on.
    await recordOnboardingEvents(deps, userId, [
      { id: "a1", sessionId: "a", place: "goal", action: "view", contentVersion: 1, at },
      { id: "a2", sessionId: "a", place: "goal", action: "answer", field: "goal", value: "lose", ms: 1000, at },
      { id: "a3", sessionId: "a", place: "body", action: "view", contentVersion: 1, at },
      { id: "a4", sessionId: "a", place: "body", action: "answer", field: "weight_kg", ms: 5000, at },
      { id: "a5", sessionId: "a", place: "summary", action: "complete", contentVersion: 1, at },
      { id: "b1", sessionId: "b", place: "goal", action: "view", contentVersion: 1, at },
      { id: "b2", sessionId: "b", place: "goal", action: "answer", field: "goal", value: "gain", ms: 3000, at },
      { id: "b3", sessionId: "b", place: "body", action: "view", contentVersion: 1, at },
      { id: "b4", sessionId: "b", place: "body", action: "back", ms: 9000, at },
    ] as never);
  });

  it("counts runs and completions", async () => {
    const f = await onboardingFunnel(deps, 30);
    expect(f.sessions).toBe(2);
    expect(f.completed).toBe(1);
  });

  it("shows the drop-off as views minus answers", async () => {
    const f = await onboardingFunnel(deps, 30);
    const body = f.rows.find((r) => r.place === "body")!;
    expect(body.views).toBe(2);
    expect(body.answers).toBe(1);
    expect(body.backs).toBe(1);
  });

  it("medians the time to answer, ignoring views", async () => {
    const f = await onboardingFunnel(deps, 30);
    // 1000 and 3000 → 2000. A median that had counted the view events (which carry no elapsed
    // time) or the 9000ms back would be measuring something else entirely.
    expect(f.rows.find((r) => r.place === "goal")!.medianMs).toBe(2000);
  });

  it("lists every place in order, including ones nobody reached", async () => {
    const f = await onboardingFunnel(deps, 30);
    const places = f.rows.map((r) => r.place);
    // The order a person meets them in — the welcome beat, the questions (the profile ones and the
    // one that is conversation), the plan being built, the plan. A drop between two adjacent rows
    // is only readable as a drop if the rows are in the order they happened. Fixed in code: the
    // chat asks in an order its own replies depend on, so there is no admin ordering to follow.
    expect(places).toEqual([...ONBOARDING_PLACES]);
    // A screen with no events is a row of zeroes, not a missing row: "nobody got here" is the most
    // important thing a funnel can say, and it cannot say it by omission.
    expect(f.rows.find((r) => r.place === "country")!.views).toBe(0);
  });

  it("reports the content version the numbers belong to", async () => {
    const f = await onboardingFunnel(deps, 30);
    expect(f.contentVersion).toBe(DEFAULT_ONBOARDING_CONTENT.version);
  });
});

describe("copy is stored per language, in one row", () => {
  it("serves each language its own compiled-in copy when nothing has been saved", async () => {
    expect((await onboardingContent(deps, "de")).welcome.lines).toEqual(ONBOARDING_CONTENT.de!.welcome.lines);
    expect((await onboardingContent(deps, "vi")).summary.cta).toBe(ONBOARDING_CONTENT.vi!.summary.cta);
  });

  it("does not let a save in one language reach a reader of another", async () => {
    // The whole reason the row holds a map. An admin editing German must not be able to put German
    // in front of an Italian, and must not be able to blank the Italian somebody else wrote.
    const german = clone(ONBOARDING_CONTENT.de!);
    german.welcome.cta = "Auf geht's";
    const italian = clone(ONBOARDING_CONTENT.it!);
    italian.welcome.cta = "Andiamo";

    expect((await saveOnboardingContent(deps, italian, "it")).ok).toBe(true);
    expect((await saveOnboardingContent(deps, german, "de")).ok).toBe(true);

    expect((await onboardingContent(deps, "de")).welcome.cta).toBe("Auf geht's");
    expect((await onboardingContent(deps, "it")).welcome.cta).toBe("Andiamo");
    // Untouched languages are the SHIPPED copy, never the other admin's.
    expect((await onboardingContent(deps, "fr")).welcome.cta).toBe(ONBOARDING_CONTENT.fr!.welcome.cta);
    expect((await onboardingContent(deps, "en")).welcome.cta).toBe(DEFAULT_ONBOARDING_CONTENT.welcome.cta);
    expect(Object.keys((await store.getOnboardingContent())!).sort()).toEqual(["de", "it"]);
  });

  it("reads a row written before the language dimension as English", async () => {
    // Every host that pressed Save before #358 has one, and it was English because English was all
    // there was. Adopting it for every language would serve an admin's English to a German.
    const legacy = clone(DEFAULT_ONBOARDING_CONTENT);
    legacy.welcome.cta = "Onwards";
    // SEEDED, not written: `putOnboardingContent` takes one language now, so the shape this test is
    // about — a bare revision with no language dimension at all — can no longer be written through
    // the port. Which is the point: only an older server could have made this row.
    const legacyDeps = { ...deps, store: memoryStore({ seed: { onboardingContent: legacy } }) };

    expect((await onboardingContent(legacyDeps, "en")).welcome.cta).toBe("Onwards");
    expect((await onboardingContent(legacyDeps, "de")).welcome.cta).toBe(ONBOARDING_CONTENT.de!.welcome.cta);
  });

  it("numbers every revision from ONE counter, so two languages never share a version", async () => {
    // `version` is the join key between a funnel row and the words that produced it. Counting per
    // language would let a German save and an English save both land on the same number — two
    // revisions, different words, one row in the funnel.
    const base = DEFAULT_ONBOARDING_CONTENT.version;
    const german = clone(ONBOARDING_CONTENT.de!);
    const english = clone(DEFAULT_ONBOARDING_CONTENT);

    await saveOnboardingContent(deps, german, "de");
    expect((await onboardingContent(deps, "de")).version).toBe(base + 1);
    await saveOnboardingContent(deps, english, "en");
    expect((await onboardingContent(deps, "en")).version).toBe(base + 2);
    await saveOnboardingContent(deps, german, "de");
    expect((await onboardingContent(deps, "de")).version).toBe(base + 3);

    // A reset takes a new number too: it is a change to what is live, not a return to an old row.
    expect((await resetOnboardingContent(deps, "en")).version).toBe(base + 4);
    // And the funnel names the newest revision in ANY language, not English's.
    await saveOnboardingContent(deps, german, "de");
    expect((await onboardingFunnel(deps, 30)).contentVersion).toBe(base + 5);
  });

  it("resets one language and leaves the rest alone", async () => {
    const german = clone(ONBOARDING_CONTENT.de!);
    german.welcome.cta = "Auf geht's";
    await saveOnboardingContent(deps, german, "de");
    const english = clone(DEFAULT_ONBOARDING_CONTENT);
    english.welcome.cta = "Onwards";
    await saveOnboardingContent(deps, english, "en");

    await resetOnboardingContent(deps, "de");
    expect((await onboardingContent(deps, "de")).welcome.cta).toBe(ONBOARDING_CONTENT.de!.welcome.cta);
    expect((await onboardingContent(deps, "en")).welcome.cta).toBe("Onwards");
  });
});

describe("a row an older build left behind", () => {
  // Both store implementations MIGRATE these on write, and until now only the READ was tested —
  // a reviewer wrote onto each shape and found the memory store spreading a JSON string into
  // 3,724 numeric keys while Postgres repaired it, and BOTH stores accepting a German save onto a
  // bare pre-#358 row, versioning it, and then discarding it on every read forever.

  it("takes a German save onto a BARE pre-#358 revision, and serves it back", async () => {
    // `storedContentSet` branches on a top-level `screens`, so hanging the language off the bare
    // revision left the whole row reading as English: the save succeeded, returned a version, and
    // was invisible. On any host that pressed Save before #358 that was every non-English save.
    const legacy = structuredClone(DEFAULT_ONBOARDING_CONTENT);
    legacy.welcome.cta = "Onwards";
    const store = memoryStore({ seed: { onboardingContent: legacy } });
    const deps = { store, config: CONFIG, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };

    const saved = await saveOnboardingContent(deps, contentWith("Los geht's"), "de");
    expect(saved.ok).toBe(true);
    expect((await onboardingContent(deps, "de")).welcome.cta).toBe("Los geht's");
    // ...and the English the bare row carried is still there, because it WAS the English.
    expect((await onboardingContent(deps, "en")).welcome.cta).toBe("Onwards");
  });

  it("takes a save onto a row stored as a JSON STRING, which every deployed host holds", async () => {
    // `${JSON.stringify(doc)}::jsonb` is a no-op cast — bun's driver already encodes a bound value
    // — so the column held text. Spreading that scatters it character by character.
    const legacy = structuredClone(DEFAULT_ONBOARDING_CONTENT);
    legacy.welcome.cta = "Onwards";
    const store = memoryStore({ seed: { onboardingContent: JSON.stringify({ en: legacy }) } });
    const deps = { store, config: CONFIG, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };

    await saveOnboardingContent(deps, contentWith("Los geht's"), "de");
    expect((await onboardingContent(deps, "de")).welcome.cta).toBe("Los geht's");
    expect((await onboardingContent(deps, "en")).welcome.cta).toBe("Onwards");
    expect(Object.keys((await store.getOnboardingContent())!).sort()).toEqual(["de", "en"]);
  });
});

/** A valid revision with one word changed, for the legacy-row tests above. */
function contentWith(cta: string): OnboardingContent {
  const c = structuredClone(DEFAULT_ONBOARDING_CONTENT);
  c.welcome.cta = cta;
  return c;
}
