// The grammY wiring, driven with real update objects through `bot.handleUpdate` against a recorded
// fake Bot API (`bot.api.config.use`), the memory store and the canned model. No network: the one
// call grammY does not make itself — the file download — goes through an injected `fetch`.

import { afterEach, beforeEach, describe, expect, it, spyOn } from "bun:test";
import { GrammyError, HttpError } from "grammy";
import type { UserFromGetMe } from "grammy/types";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { mintPairingCode, patchProfile, type EngineDeps } from "../engine/index.ts";
import { createBot, fetchFile, isFatalTelegramError, superviseBot, type TelegramBot } from "./bot.ts";
import { TELEGRAM_COPY, TelegramFileError } from "./handlers.ts";

/** Shaped like a token, and not one: this repository is public. */
const TOKEN = "123456789:not-a-real-token_not-a-real-token";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  freeAnalyses: 100,
  publicWebUrl: "https://app.eait.fit",
};

const BOT_INFO = {
  id: 1, is_bot: true, first_name: "eait", username: "eait_test_bot",
  can_join_groups: false, can_read_all_group_messages: false, supports_inline_queries: false,
  can_connect_to_business: false, has_main_web_app: false,
} as unknown as UserFromGetMe;

let store: Store;
let deps: EngineDeps;
let quiet: ReturnType<typeof spyOn>[] = [];

beforeEach(() => {
  store = memoryStore();
  deps = { store, config: { ...CONFIG }, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
  quiet = [spyOn(console, "warn").mockImplementation(() => {}), spyOn(console, "error").mockImplementation(() => {})];
});
afterEach(() => { for (const q of quiet) q.mockRestore(); });

let nextUpdate = 900_000;
let nextId = 7_000_000_500;

const jpeg = () => { const b = new Uint8Array(64).fill(1); b[0] = 0xff; b[1] = 0xd8; b[2] = 0xff; return b; };

interface Call { method: string; payload: Record<string, unknown> }

/** A bot on the fake API. Every call is recorded; `answer` overrides what one method returns. */
function harness(
  answer: (method: string, payload: Record<string, unknown>) => unknown = () => undefined,
  d: EngineDeps = deps,
) {
  const downloads: string[] = [];
  const bot = createBot(d, TOKEN, {
    albumMs: 20,
    fetch: (async (url: string | URL | Request) => {
      downloads.push(String(url));
      return new Response(jpeg());
    }) as typeof fetch,
  });
  bot.botInfo = BOT_INFO;
  const calls: Call[] = [];
  bot.api.config.use(async (_prev, method, payload) => {
    const p = (payload ?? {}) as Record<string, unknown>;
    calls.push({ method, payload: p });
    const override = answer(method, p);
    if (override instanceof Error) throw override;
    if (override !== undefined) return { ok: true, result: override } as never;
    if (method === "getFile") {
      return { ok: true, result: { file_id: p.file_id, file_unique_id: "u", file_size: 64, file_path: "photos/file_1.jpg" } } as never;
    }
    if (method === "sendMessage") {
      return { ok: true, result: { message_id: 1, date: 0, chat: { id: p.chat_id, type: "private" }, text: p.text } } as never;
    }
    return { ok: true, result: true } as never;
  });
  const sent = () => calls.filter((c) => c.method === "sendMessage").map((c) => c.payload);
  return { bot, calls, sent, downloads };
}

/** Somebody Telegram knows by more than an id — which is the point of the tests that read the store. */
const person = (id: number) => ({ id, is_bot: false, first_name: "Markerfirst", username: "marker_username", language_code: "en" });

function text(from: number, body: string, chat: { id: number; type: string } = { id: from, type: "private" }) {
  const command = body.startsWith("/") ? body.split(" ")[0]! : null;
  return {
    update_id: nextUpdate++,
    message: {
      message_id: nextUpdate, date: 0, chat, from: person(from), text: body,
      ...(command ? { entities: [{ type: "bot_command", offset: 0, length: command.length }] } : {}),
    },
  } as never;
}

function photo(from: number, extra: Record<string, unknown> = {}) {
  return {
    update_id: nextUpdate++,
    message: {
      message_id: nextUpdate, date: 0, chat: { id: from, type: "private" }, from: person(from),
      photo: [
        { file_id: "small", file_unique_id: "s", width: 90, height: 90 },
        { file_id: "large", file_unique_id: "l", width: 1280, height: 1280 },
      ],
      ...extra,
    },
  } as never;
}

function tap(from: number, data: string) {
  return {
    update_id: nextUpdate++,
    callback_query: {
      id: `q${nextUpdate}`, chat_instance: "ci", data, from: person(from),
      message: { message_id: 33, date: 0, chat: { id: from, type: "private" }, text: "card" },
    },
  } as never;
}

async function linked(): Promise<{ userId: string; from: number }> {
  const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
  await patchProfile(deps, userId, {
    goal: "lose", sex: "female", birth_year: 1990, height_cm: 165, weight_kg: 70,
    target_weight_kg: 65, activity: "moderate", pace: "steady", country: "de",
    restrictions: [], complete_onboarding: true,
  });
  const from = nextId++;
  await store.addIdentity(userId, "telegram", String(from));
  return { userId, from };
}

describe("the middleware", () => {
  it("answers private chats only: a group message reaches nothing and calls nothing", async () => {
    const { bot, calls } = harness();
    const { from } = await linked();
    await bot.handleUpdate(text(from, "how much protein?", { id: -100123, type: "supergroup" }));
    expect(calls).toEqual([]);
  });

  it("handles an update_id once, however often Telegram delivers it", async () => {
    const { bot, sent } = harness();
    const update = text(nextId++, "hello");
    await bot.handleUpdate(update);
    await bot.handleUpdate(update);
    expect(sent()).toHaveLength(1);
  });

  it("says something rather than nothing when a handler throws", async () => {
    const broken: EngineDeps = { ...deps, store: { ...store, userIdForIdentity: async () => { throw new Error("db down"); } } };
    const { bot, sent } = harness(undefined, broken);
    // What the runner's sink does with a middleware throw: hand it to the bot's error handler.
    await bot.handleUpdate(text(nextId++, "hello")).catch((e) => bot.errorHandler(e));
    expect(sent().map((m) => m.text)).toEqual([TELEGRAM_COPY.failed]);
  });
});

describe("connecting", () => {
  it("stranger → sign-in button; /start <code> → connected, storing the numeric id and nothing else Telegram sent", async () => {
    const { bot, sent } = harness();
    const from = nextId++;
    await bot.handleUpdate(text(from, "hello"));
    expect(sent()[0]!.reply_markup).toEqual({
      inline_keyboard: [[{ text: TELEGRAM_COPY.signIn, url: "https://app.eait.fit/start" }]],
    });

    const { userId } = await store.upsertDeviceUser(crypto.randomUUID() + crypto.randomUUID(), "en");
    const { code } = await mintPairingCode(deps, userId);
    await bot.handleUpdate(text(from, `/start ${code}`));
    expect(sent()[1]!.text).toBe(TELEGRAM_COPY.connected);

    const identity = await store.identityFor("telegram", String(from));
    expect(identity).toEqual({ userId, linkedAt: expect.any(String), email: null });
    expect(await store.identitySubject(userId, "telegram")).toBe(String(from));
    // The username and the first name reached this process in the update and were never written.
    expect(JSON.stringify(await store.getProfile(userId))).not.toMatch(/marker/i);
  });
});

describe("taps", () => {
  it("a stale callback query id does not cost the tap: the meal is still logged and the card edited", async () => {
    const { bot, calls } = harness((method) =>
      method === "answerCallbackQuery" ? new Error("Bad Request: query is too old") : undefined);
    const { from, userId } = await linked();
    await bot.handleUpdate(text(from, "two eggs and toast"));
    const [pending] = await store.pendingsFor(userId);

    await bot.handleUpdate(tap(from, `ok:${pending!.id}`));
    expect(await store.getMeal(userId, pending!.id)).not.toBeNull();
    const edit = calls.find((c) => c.method === "editMessageText")!;
    expect(String(edit.payload.text)).toStartWith(TELEGRAM_COPY.logged);
  });

  it("an edit Telegram calls unchanged is not a failure", async () => {
    const { bot, sent } = harness((method) => method === "editMessageText"
      ? new GrammyError("Call to 'editMessageText' failed!", {
        ok: false, error_code: 400, description: "Bad Request: message is not modified",
      }, "editMessageText", {})
      : undefined);
    const { from } = await linked();
    await bot.handleUpdate(tap(from, "no:00000000-0000-4000-8000-000000000000"));
    expect(sent()).toEqual([]);
  });
});

describe("photos", () => {
  it("downloads the largest size through getFile and logs it", async () => {
    const { bot, calls, sent, downloads } = harness();
    const { from, userId } = await linked();
    await bot.handleUpdate(photo(from, { caption: "lunch" }));
    expect(calls.find((c) => c.method === "getFile")!.payload.file_id).toBe("large");
    expect(downloads).toEqual([`https://api.telegram.org/file/bot${TOKEN}/photos/file_1.jpg`]);
    expect(String(sent()[0]!.text)).toStartWith(TELEGRAM_COPY.logged);
    expect(await store.countUserAnalyses(userId)).toBe(1);
  });

  it("an album is ONE meal: one analysis, one card", async () => {
    const { bot, sent } = harness();
    const { from, userId } = await linked();
    await bot.handleUpdate(photo(from, { media_group_id: "g1" }));
    await bot.handleUpdate(photo(from, { media_group_id: "g1", caption: "both sides" }));
    expect(sent()).toEqual([]);
    for (let i = 0; i < 50 && sent().length === 0; i++) await Bun.sleep(10);
    expect(sent()).toHaveLength(1);
    expect(await store.countUserAnalyses(userId)).toBe(1);
  });
});

describe("commands", () => {
  it("/today reads the day", async () => {
    const { bot, sent } = harness();
    const { from } = await linked();
    await bot.handleUpdate(text(from, "/today"));
    expect(String(sent()[0]!.text)).toStartWith("Today: 0 of ");
  });
});

describe("fetchFile", () => {
  const api = (file: Record<string, unknown>) => ({ getFile: async () => ({ file_id: "f", file_unique_id: "u", ...file }) });
  const opts = (f: typeof fetch) => ({ maxBytes: 1024, timeoutMs: 1000, fetch: f });

  it("never lets the token into an error, whatever the download does", async () => {
    const failures: (typeof fetch)[] = [
      (async () => new Response("{}", { status: 404 })) as unknown as typeof fetch,
      (async (url: string) => { throw new Error(`Unable to connect to ${url}`); }) as unknown as typeof fetch,
    ];
    for (const f of failures) {
      const err = await fetchFile(api({ file_path: "p.jpg" }) as never, TOKEN, "f", opts(f)).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(TelegramFileError);
      expect((err as TelegramFileError).reason).toBe("failed");
      expect(String((err as Error).message) + String((err as Error).stack)).not.toContain("not-a-real-token");
    }
    for (const call of (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls) {
      expect(JSON.stringify(call)).not.toContain("not-a-real-token");
    }
  });

  it("refuses a file over the limit before downloading it, and a body over it after", async () => {
    let fetched = 0;
    const f = (async () => { fetched++; return new Response(new Uint8Array(2048)); }) as unknown as typeof fetch;
    const declared = await fetchFile(api({ file_path: "p.jpg", file_size: 4096 }) as never, TOKEN, "f", opts(f)).catch((e: unknown) => e);
    expect((declared as TelegramFileError).reason).toBe("too-large");
    expect(fetched).toBe(0);
    const actual = await fetchFile(api({ file_path: "p.jpg" }) as never, TOKEN, "f", opts(f)).catch((e: unknown) => e);
    expect((actual as TelegramFileError).reason).toBe("too-large");
  });

  it("gives up on a download that hangs", async () => {
    const hang = ((_url: string, init: RequestInit) => new Promise((_r, reject) => {
      init.signal!.addEventListener("abort", () => reject(init.signal!.reason));
    })) as unknown as typeof fetch;
    const err = await fetchFile(api({ file_path: "p.jpg" }) as never, TOKEN, "f", { maxBytes: 1024, timeoutMs: 20, fetch: hang })
      .catch((e: unknown) => e);
    expect((err as TelegramFileError).reason).toBe("failed");
  });
});

describe("the supervisor", () => {
  it("names 401 and 404 fatal, and nothing else", () => {
    const e = (code: number) => new GrammyError("x", { ok: false, error_code: code, description: "d" }, "getMe", {});
    expect(isFatalTelegramError(e(401))).toBe(true);
    expect(isFatalTelegramError(e(404))).toBe(true);
    expect(isFatalTelegramError(e(409))).toBe(false);
    expect(isFatalTelegramError(e(502))).toBe(false);
    expect(isFatalTelegramError(new Error("network"))).toBe(false);
  });

  /** A bot whose getMe answers from `me`, and whose getUpdates is an idle long poll. */
  function polled(me: () => unknown): TelegramBot {
    const bot = createBot(deps, TOKEN);
    bot.api.config.use(async (_prev, method, _payload, signal) => {
      if (method === "getMe") {
        const r = me();
        return (r instanceof Error ? { ok: false, error_code: Number(r.message), description: "d" } : { ok: true, result: r }) as never;
      }
      if (method === "getUpdates") {
        await new Promise((r) => { const t = setTimeout(r, 20); signal?.addEventListener("abort", () => { clearTimeout(t); r(null); }); });
        return { ok: true, result: [] } as never;
      }
      return { ok: true, result: true } as never;
    });
    return bot;
  }

  it("stops the connector on a dead token and says so, and never exits the process", async () => {
    const exit = spyOn(process, "exit").mockImplementation((() => undefined) as never);
    const events: string[] = [];
    const run = superviseBot(polled(() => new Error("401")), {
      up: (u) => events.push(`up ${u}`), down: () => events.push("down"),
    }, 10);
    for (let i = 0; i < 50 && !events.includes("down"); i++) await Bun.sleep(10);
    expect(events).toEqual(["down"]);
    await run.stop();
    expect(exit).not.toHaveBeenCalled();
    exit.mockRestore();
  });

  it("retries a transient failure, comes up with the username from getMe, and stops cleanly", async () => {
    let attempts = 0;
    const events: string[] = [];
    const run = superviseBot(polled(() => (++attempts === 1 ? new Error("502") : BOT_INFO)), {
      up: (u) => events.push(`up ${u}`), down: () => events.push("down"),
    }, 10);
    for (let i = 0; i < 100 && events.length === 0; i++) await Bun.sleep(10);
    expect(events).toEqual(["up eait_test_bot"]);
    expect(attempts).toBe(2);
    await run.stop();
  });

  it("hands a polling failure to the supervisor at once, and no log line carries the token", async () => {
    // What a DNS failure or a reset looks like from grammY: a safe message around Bun's fetch error,
    // whose `path` is the request URL — token included. The runner's own logging prints the whole
    // object, and its own retry loop keeps the failure from the supervisor for up to fifteen hours.
    const bot = polled(() => BOT_INFO);
    let polls = 0;
    bot.api.config.use(async (prev, method, payload, signal) => {
      if (method !== "getUpdates") return prev(method, payload, signal);
      polls++;
      throw new HttpError("Network request for 'getUpdates' failed!",
        Object.assign(new Error("Unable to connect"), { path: `https://api.telegram.org/bot${TOKEN}/getUpdates` }));
    });
    const run = superviseBot(bot, { up: () => {}, down: () => {} }, 60_000);
    const said = () => (console.error as unknown as { mock: { calls: unknown[][] } }).mock.calls.map((c) => Bun.inspect(c));
    for (let i = 0; i < 50 && !said().some((l) => l.includes("retrying")); i++) await Bun.sleep(10);

    expect(said().some((l) => l.includes("telegram connector error, retrying"))).toBe(true);
    expect(polls).toBe(1);
    for (const line of said()) expect(line).not.toContain("not-a-real-token");
    const t = Date.now();
    await run.stop();
    expect(Date.now() - t).toBeLessThan(1000);
  });

  it("finishes the turns already running before stop resolves", async () => {
    let finished = false;
    let started = false;
    const slow: EngineDeps = {
      ...deps,
      store: {
        ...store,
        userIdForIdentity: async () => { started = true; await Bun.sleep(300); finished = true; return null; },
      },
    };
    const bot = createBot(slow, TOKEN);
    let delivered = false;
    bot.api.config.use(async (_prev, method, _payload, signal) => {
      if (method === "getMe") return { ok: true, result: BOT_INFO } as never;
      if (method === "getUpdates" && !delivered) {
        delivered = true;
        return { ok: true, result: [text(nextId++, "hello")] } as never;
      }
      if (method === "getUpdates") {
        await new Promise((r) => { const t = setTimeout(r, 20); signal?.addEventListener("abort", () => { clearTimeout(t); r(null); }); });
        return { ok: true, result: [] } as never;
      }
      return { ok: true, result: { message_id: 1, date: 0, chat: { id: 1, type: "private" } } } as never;
    });
    const run = superviseBot(bot, { up: () => {}, down: () => {} }, 10);
    for (let i = 0; i < 100 && !started; i++) await Bun.sleep(5);
    expect(started).toBe(true);
    await run.stop();
    expect(finished).toBe(true);
  });

  it("stops promptly while it is retrying", async () => {
    const run = superviseBot(polled(() => new Error("502")), { up: () => {}, down: () => {} }, 60_000);
    await Bun.sleep(20);
    const t = Date.now();
    await run.stop();
    expect(Date.now() - t).toBeLessThan(1000);
  });
});
