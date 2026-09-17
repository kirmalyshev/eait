// The Telegram connector's handlers, against the memory store and the canned model, with a fake chat.
//
// Nothing here knows grammY exists: a handler takes a Telegram user id and a port it answers
// through, calls ONE engine function, and says the result in plain text. `bot.test.ts` covers the
// wiring that turns a Telegram update into these calls.

import { beforeEach, describe, expect, it } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { REFUSAL_STATUS, lintCopy, localDate, scriptedLine, type Refusal } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts, DEMO_NOT_FOOD } from "../llm/demo.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { mintPairingCode, patchProfile, type EngineDeps } from "../engine/index.ts";
import {
  TELEGRAM_COPY, TelegramFileError, refusalText, telegramHandlers, type Button, type Tap,
} from "./handlers.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  freeAnalyses: 100,
  publicWebUrl: "https://app.eait.fit",
};

let store: Store;
let deps: EngineDeps;
let h: ReturnType<typeof telegramHandlers>;

beforeEach(() => {
  store = memoryStore();
  deps = { store, config: { ...CONFIG }, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
  h = telegramHandlers(deps);
});

/** Made-up ids in Telegram's range. Never a real one: this repository is public. */
let nextId = 7_000_000_100;
const telegramId = () => nextId++;

/** What a handler said, in order. */
function fakeChat(): Tap & {
  sent: { text: string; buttons?: Button[] }[]; edits: string[]; answered: number;
} {
  const chat = {
    sent: [] as { text: string; buttons?: Button[] }[],
    edits: [] as string[],
    answered: 0,
    async send(text: string, buttons?: Button[]) { chat.sent.push(buttons ? { text, buttons } : { text }); },
    async edit(text: string) { chat.edits.push(text); },
    async answer() { chat.answered++; },
  };
  return chat;
}

/** An account onboarded elsewhere, with this Telegram id attached — the only kind the bot serves. */
async function linked(over: Record<string, unknown> = {}): Promise<{ userId: string; from: number }> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  const out = await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "moderate", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true, ...over,
  });
  if (!out || !out.ok) throw new Error("onboarding failed");
  const from = telegramId();
  await store.addIdentity(userId, "telegram", String(from));
  return { userId, from };
}

/** A provider subject that is this test file's own. */
const subject = (name: string) => `tg-test-${name}`;

const jpeg = () => { const b = new Uint8Array(64).fill(1); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; return b; };
const SIGN_IN = "https://app.eait.fit/start";

describe("somebody Telegram has not been connected for", () => {
  it("gets one line and a button to the web sign-in, whatever they send, and nothing is spent", async () => {
    const from = telegramId();
    const chat = fakeChat();
    await h.text(from, "two eggs and toast", chat);
    await h.photos(from, [async () => { throw new Error("must not be read"); }], undefined, chat);
    await h.today(from, chat);
    await h.start(from, "", chat);

    expect(chat.sent).toHaveLength(4);
    for (const said of chat.sent) {
      expect(said.text).toBe(TELEGRAM_COPY.stranger);
      expect(said.buttons).toEqual([{ text: TELEGRAM_COPY.signIn, url: SIGN_IN }]);
    }
    expect(await store.countGlobalAnalyses(localDate(CONFIG.timezone))).toBe(0);
  });

  it("gets the address in the text instead where there is no https origin to put on a button", async () => {
    // Telegram refuses a button whose URL it considers invalid, and a development host is one.
    h = telegramHandlers({ ...deps, config: { ...deps.config, publicWebUrl: "", publicApiUrl: "" } });
    const chat = fakeChat();
    await h.text(telegramId(), "hi", chat);
    expect(chat.sent[0]!.buttons).toBeUndefined();
    expect(chat.sent[0]!.text).toBe(`${TELEGRAM_COPY.stranger}\nhttp://127.0.0.1:0/start`);
  });
});

describe("/start with a code", () => {
  const account = async () =>
    (await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en")).userId;

  it("connects this Telegram id to the account that minted the code, and only the id", async () => {
    const userId = await account();
    const { code } = await mintPairingCode(deps, userId);
    const from = telegramId();
    const chat = fakeChat();

    await h.start(from, code, chat);
    expect(chat.sent).toHaveLength(1);
    expect(chat.sent[0]!.text).toStartWith(TELEGRAM_COPY.connectedLead);
    expect(await store.userIdForIdentity("telegram", String(from))).toBe(userId);
    expect(await store.identitySubject(userId, "telegram")).toBe(String(from));
  });

  it("names the account it connected to — the provider, and an address masked to its first letter", async () => {
    // The whole point: somebody who pressed a link another person sent them sees, at that moment,
    // an account that is not theirs. A full address would put somebody's email into a Telegram chat.
    const userId = await account();
    await store.addIdentity(userId, "google", subject("named"));
    await store.setIdentityEmail(userId, "google", subject("named"), "kirill@example.com");
    const chat = fakeChat();

    await h.start(telegramId(), (await mintPairingCode(deps, userId)).code, chat);
    const said = chat.sent[0]!.text;
    expect(said).toContain("Google");
    expect(said).toContain("k***@example.com");
    expect(said).not.toContain("kirill@");
    // And the way back out, said where the person who did not mean to be here will read it.
    expect(said).toContain(TELEGRAM_COPY.notYours);
  });

  it("names an account with no address by how it was made", async () => {
    const chat = fakeChat();
    await h.start(telegramId(), (await mintPairingCode(deps, await account())).code, chat);
    expect(chat.sent[0]!.text).toStartWith(`${TELEGRAM_COPY.connectedLead} ${TELEGRAM_COPY.viaApp}.`);
  });

  it("masks an address that is too short to keep a letter of", async () => {
    const userId = await account();
    await store.addIdentity(userId, "apple", subject("short"));
    await store.setIdentityEmail(userId, "apple", subject("short"), "k@example.com");
    const chat = fakeChat();
    await h.start(telegramId(), (await mintPairingCode(deps, userId)).code, chat);
    expect(chat.sent[0]!.text).toContain("***@example.com");
    expect(chat.sent[0]!.text).not.toContain("k@example.com");
  });

  it("says the link has expired for a spent, unknown or malformed code", async () => {
    const { code } = await mintPairingCode(deps, await account());
    await h.start(telegramId(), code, fakeChat());
    for (const bad of [code, "ABCD2345", "not a code"]) {
      const chat = fakeChat();
      await h.start(telegramId(), bad, chat);
      expect(chat.sent).toEqual([{ text: TELEGRAM_COPY.codeInvalid }]);
    }
  });

  it("moves a link made onto the wrong account, and says which account it is on now", async () => {
    const { from, userId } = await linked();
    const mine = await account();
    await store.addIdentity(mine, "apple", subject("recover"));
    await store.setIdentityEmail(mine, "apple", subject("recover"), "owner@example.com");
    const chat = fakeChat();

    await h.start(from, (await mintPairingCode(deps, mine)).code, chat);
    expect(await store.userIdForIdentity("telegram", String(from))).toBe(mine);
    expect(chat.sent[0]!.text).toContain("Apple");
    expect(chat.sent[0]!.text).toContain("o***@example.com");
    // The account it came off is untouched — its own data, its own identities.
    expect(await store.getProfile(userId)).not.toBeNull();
    expect((await store.listIdentities(userId)).map((i) => i.provider)).toEqual(["device"]);
  });

  it("is bounded per Telegram id, on the allowance the pairing form takes, before any code is looked at", async () => {
    h = telegramHandlers({ ...deps, config: { ...deps.config, authRateLimitPerHour: 2 } });
    const from = telegramId();
    await h.start(from, "ABCD2345", fakeChat());
    await h.start(from, "ABCD2346", fakeChat());

    const { code } = await mintPairingCode(deps, await account());
    const chat = fakeChat();
    await h.start(from, code, chat);
    expect(chat.sent).toEqual([{ text: TELEGRAM_COPY.tooManyTries }]);
    expect(await store.userIdForIdentity("telegram", String(from))).toBeNull();
    // Somebody else's allowance is their own.
    const other = fakeChat();
    await h.start(telegramId(), code, other);
    expect(other.sent[0]!.text).toStartWith(TELEGRAM_COPY.connectedLead);
  });

  it("reads a limit of zero the way the API does: no limit at all", async () => {
    // `EAIT__BACKEND__AUTH_RATE_LIMIT_PER_HOUR=0` disables the allowance (`config.ts`, and
    // `api/routes.ts` short-circuits on it). The bot calls the limiter directly, where a limit of
    // zero refuses everything — so the setting that switches the limit off switched the bot off.
    h = telegramHandlers({ ...deps, config: { ...deps.config, authRateLimitPerHour: 0 } });
    const from = telegramId();
    for (let i = 0; i < 5; i++) await h.start(from, "ABCD2345", fakeChat());
    const chat = fakeChat();
    await h.start(from, (await mintPairingCode(deps, await account())).code, chat);
    expect(chat.sent[0]!.text).toStartWith(TELEGRAM_COPY.connectedLead);
  });

  it("tells a connected account which account it is on when it sends a bare /start", async () => {
    const { from } = await linked();
    const chat = fakeChat();
    await h.start(from, "", chat);
    expect(chat.sent[0]!.text).toStartWith(TELEGRAM_COPY.connectedLead);
  });
});

describe("text", () => {
  it("answers a question as Gabie, by name", async () => {
    const { from } = await linked();
    const chat = fakeChat();
    await h.text(from, "how much protein have I had today?", chat);
    expect(chat.sent).toHaveLength(1);
    expect(chat.sent[0]!.text).toStartWith("Gabie: ");
    expect(chat.sent[0]!.buttons).toBeUndefined();
  });

  it("proposes a described meal with Log it / Not this, in callback data Telegram accepts", async () => {
    const { from, userId } = await linked();
    const chat = fakeChat();
    await h.text(from, "two eggs and toast", chat);

    const [proposal] = chat.sent;
    expect(proposal!.text).toStartWith(TELEGRAM_COPY.proposalLead);
    expect(proposal!.text).toMatch(/\d+ kcal/);
    const [pending] = await store.pendingsFor(userId);
    expect(proposal!.buttons).toEqual([
      { text: TELEGRAM_COPY.logIt, data: `ok:${pending!.id}` },
      { text: TELEGRAM_COPY.notThis, data: `no:${pending!.id}` },
    ]);
    for (const b of proposal!.buttons!) {
      if ("data" in b) expect(new TextEncoder().encode(b.data).length).toBeLessThanOrEqual(64);
    }
  });

  it("points a command it does not know at the web, and spends nothing on it", async () => {
    // @eait_bot's old users know /settings, /me and /delete. Sent to the router, each is a billed turn.
    const { from, userId } = await linked();
    const chat = fakeChat();
    await h.text(from, "/settings", chat);
    expect(chat.sent).toEqual([{ text: `${TELEGRAM_COPY.onTheWeb}\n${SIGN_IN}` }]);
    expect(await store.countUserAnalyses(userId)).toBe(0);
  });

  it("refuses a message longer than a thread line, before anything is charged", async () => {
    const { from, userId } = await linked();
    const chat = fakeChat();
    await h.text(from, "a".repeat(5000), chat);
    expect(chat.sent).toEqual([{ text: TELEGRAM_COPY.tooLong }]);
    expect(await store.countUserAnalyses(userId)).toBe(0);
  });
});

describe("tapping Log it / Not this", () => {
  async function proposed() {
    const who = await linked();
    const chat = fakeChat();
    await h.text(who.from, "two eggs and toast", chat);
    const [pending] = await store.pendingsFor(who.userId);
    return { ...who, pendingId: pending!.id, card: chat.sent[0]!.text };
  }

  it("Log it logs the meal and turns the proposal into the logged card", async () => {
    const { from, userId, pendingId } = await proposed();
    const tap = fakeChat();
    await h.tap(from, `ok:${pendingId}`, tap);
    expect(tap.answered).toBe(1);
    expect(await store.getMeal(userId, pendingId)).not.toBeNull();
    expect(tap.edits).toHaveLength(1);
    expect(tap.edits[0]).toStartWith(TELEGRAM_COPY.logged);

    // A second tap on a stale keyboard answers with what stands, and logs nothing twice.
    const again = fakeChat();
    await h.tap(from, `no:${pendingId}`, again);
    expect(again.edits[0]).toStartWith(TELEGRAM_COPY.alreadyLogged);
    expect((await store.mealsForDate(userId, (await store.getMeal(userId, pendingId))!.date))).toHaveLength(1);
  });

  it("Not this drops it, in Spud's scripted words", async () => {
    const { from, userId, pendingId } = await proposed();
    const tap = fakeChat();
    await h.tap(from, `no:${pendingId}`, tap);
    expect(tap.edits).toEqual([scriptedLine("dropped")]);
    expect(await store.pendingsFor(userId)).toEqual([]);
  });

  it("an id that is not this account's pending is expired, never somebody else's meal", async () => {
    const { pendingId } = await proposed();
    const stranger = await linked();
    const tap = fakeChat();
    await h.tap(stranger.from, `ok:${pendingId}`, tap);
    expect(tap.edits).toEqual([TELEGRAM_COPY.expired]);
    expect(await store.getMeal(stranger.userId, pendingId)).toBeNull();
  });

  it("answers the tap even when the data is not ours, and does nothing else", async () => {
    const { from } = await linked();
    const tap = fakeChat();
    await h.tap(from, "st:format:plain", tap);
    expect(tap.answered).toBe(1);
    expect(tap.edits).toEqual([]);
    expect(tap.sent).toEqual([]);
  });
});

describe("photos", () => {
  it("logs a photo as a meal and sends the card", async () => {
    const { from, userId } = await linked();
    const chat = fakeChat();
    await h.photos(from, [async () => jpeg()], "lunch", chat);
    expect(chat.sent).toHaveLength(1);
    expect(chat.sent[0]!.text).toStartWith(TELEGRAM_COPY.logged);
    expect(chat.sent[0]!.text).toMatch(/\d+ kcal/);
    expect(await store.countUserAnalyses(userId)).toBe(1);
  });

  it("reads no more photos of one meal than the server allows", async () => {
    h = telegramHandlers({ ...deps, config: { ...deps.config, maxPhotosPerMeal: 2 } });
    const { from } = await linked();
    let read = 0;
    const part = async () => { read++; return jpeg(); };
    await h.photos(from, [part, part, part, part, part], undefined, fakeChat());
    expect(read).toBe(2);
  });

  it("says a refusal in a sentence with the web link", async () => {
    const { from } = await linked();
    const chat = fakeChat();
    await h.photos(from, [async () => jpeg()], DEMO_NOT_FOOD, chat);
    expect(chat.sent).toEqual([{ text: refusalText(deps.config, { kind: "not-food" }) }]);
  });

  it("says a download that failed as that, and charges nothing for it", async () => {
    const { from, userId } = await linked();
    for (const [reason, words] of [["failed", TELEGRAM_COPY.downloadFailed], ["too-large", TELEGRAM_COPY.tooLarge]] as const) {
      const chat = fakeChat();
      await h.photos(from, [async () => { throw new TelegramFileError(reason); }], undefined, chat);
      expect(chat.sent).toEqual([{ text: words }]);
    }
    expect(await store.countUserAnalyses(userId)).toBe(0);
  });

  it("refuses a caption longer than a thread line, before any photo is read", async () => {
    const { from } = await linked();
    const chat = fakeChat();
    await h.photos(from, [async () => { throw new Error("must not be read"); }], "a".repeat(5000), chat);
    expect(chat.sent).toEqual([{ text: TELEGRAM_COPY.tooLong }]);
  });
});

describe("/today", () => {
  it("lists the day's meals and where the total stands against the target", async () => {
    const { from } = await linked();
    await h.photos(from, [async () => jpeg()], "lunch", fakeChat());
    const chat = fakeChat();
    await h.today(from, chat);
    expect(chat.sent).toHaveLength(1);
    expect(chat.sent[0]!.text).toMatch(/^Today: \d+ of \d+ kcal, \d+ of \d+ g protein\n\d\d:\d\d .+ — \d+ kcal$/);
  });

  it("says so when nothing is logged", async () => {
    const { from } = await linked();
    const chat = fakeChat();
    await h.today(from, chat);
    expect(chat.sent[0]!.text).toEndWith(TELEGRAM_COPY.todayEmpty);
  });
});

describe("every refusal", () => {
  it("is a sentence and a link to the web, for every kind and every cap scope", () => {
    const kinds: Refusal[] = [
      ...Object.keys(REFUSAL_STATUS).filter((k) => k !== "cap-exceeded").map((kind) => ({ kind }) as Refusal),
      ...(["user", "global", "address"] as const).map((scope) => ({ kind: "cap-exceeded", scope }) as const),
    ];
    const said = new Set<string>();
    for (const r of kinds) {
      const text = refusalText(CONFIG, r);
      const [sentence, link, ...rest] = text.split("\n");
      expect(sentence!.length).toBeGreaterThan(10);
      expect(link).toBe(SIGN_IN);
      expect(rest).toEqual([]);
      said.add(sentence!);
    }
    // Three cap scopes, three different sentences: "your allowance" is not said about the budget.
    expect(said.size).toBe(kinds.length);
  });
});

describe("the copy the bot writes", () => {
  it("passes the claims gate", () => {
    expect(lintCopy({ ...TELEGRAM_COPY })).toEqual([]);
    const refusals = Object.fromEntries(Object.keys(REFUSAL_STATUS).map((kind) =>
      [kind, refusalText(CONFIG, { kind, scope: "user" } as Refusal)]));
    expect(lintCopy(refusals)).toEqual([]);
  });
});

describe("the boundary", () => {
  it("keeps grammY out of the engine and out of the handlers", () => {
    const backend = join(import.meta.dir, "..");
    const files = [
      ...readdirSync(join(backend, "engine")).map((f) => join(backend, "engine", f)),
      join(import.meta.dir, "handlers.ts"),
    ].filter((f) => f.endsWith(".ts"));
    const offenders = files.filter((f) => /from\s+["'](grammy|@grammyjs\/)/.test(readFileSync(f, "utf8")));
    expect(offenders).toEqual([]);
  });

  it("reaches the engine only through its public surface", () => {
    const imports = [...readFileSync(join(import.meta.dir, "handlers.ts"), "utf8")
      .matchAll(/from\s+["']([^"']+)["']/g)].map((m) => m[1]!);
    expect(imports.filter((i) => i.startsWith("../engine/") && i !== "../engine/index.ts")).toEqual([]);
  });
});
