// The grammY half of the Telegram connector: updates in, handler calls out, and the loop that polls.
//
// THIN ON PURPOSE. Every decision a test needs to see is in `handlers.ts`; this file unwraps a
// `ctx` into a Telegram user id and a port, and owns the four things only a live bot has — the
// middleware order, the file download, the album buffer and the supervisor. The download, the
// supervisor, the callback guard and the middleware order are carried over from the old @eait_bot
// (`kirmalyshev/eait-telegram`, `src/tg_bot/bot.ts`), where each was learned the hard way.

import { run, sequentialize, type RunnerHandle } from "@grammyjs/runner";
import { Bot, GrammyError, type Api, type Context } from "grammy";
import type { EngineDeps } from "../engine/index.ts";
import { AlbumBuffer } from "./albums.ts";
import { TELEGRAM_COPY, TelegramFileError, telegramHandlers, type Button, type Tap } from "./handlers.ts";

/** The Bot API serves a file up to 20 MB through `getFile`, and refuses anything larger. */
const TELEGRAM_FILE_MAX_BYTES = 20 * 1024 * 1024;

/**
 * How long one photo download may take. Downloads run inside `sequentialize`, so a hung one would
 * stall everything else that user sends until the process restarts.
 */
const DOWNLOAD_TIMEOUT_MS = 30_000;

/** Telegram sends an album's photos as separate updates; this long without another closes it. */
const ALBUM_FLUSH_MS = 1_500;

/** Update ids remembered for the dedupe. Far more than one poll's redelivery can repeat. */
const SEEN_UPDATES = 10_000;

export interface BotOptions {
  /** The download's `fetch`, so a test never reaches api.telegram.org. */
  fetch?: typeof fetch;
  albumMs?: number;
}

/**
 * Download one Telegram file into memory, or throw a `TelegramFileError`.
 *
 * THE URL CARRIES THE BOT TOKEN, so no error thrown or logged here ever quotes it — not the URL, not
 * `fetch`'s own message, which can. Only a status or an error name reaches the log. And a non-2xx
 * body is never returned as bytes: an expired `file_path` answers JSON, and handed on as a photo it
 * would be reported to the user as "not food" rather than as a download that failed.
 */
export async function fetchFile(
  api: Pick<Api, "getFile">,
  token: string,
  fileId: string,
  opts: { maxBytes: number; timeoutMs: number; fetch?: typeof fetch },
): Promise<Uint8Array> {
  const limit = Math.min(TELEGRAM_FILE_MAX_BYTES, opts.maxBytes);
  let path: string | undefined;
  try {
    const file = await api.getFile(fileId);
    if (file.file_size !== undefined && file.file_size > limit) throw new TelegramFileError("too-large");
    path = file.file_path;
  } catch (e) {
    if (e instanceof TelegramFileError) throw e;
    if (/too big/i.test(describeError(e))) throw new TelegramFileError("too-large");
    console.error(`[eait] telegram getFile failed: ${describeError(e)}`);
    throw new TelegramFileError("failed");
  }
  if (!path) throw new TelegramFileError("failed");

  let bytes: Uint8Array;
  try {
    const res = await (opts.fetch ?? fetch)(`https://api.telegram.org/file/bot${token}/${path}`, {
      signal: AbortSignal.timeout(opts.timeoutMs),
    });
    if (!res.ok) {
      console.error(`[eait] telegram file download answered ${res.status}`);
      throw new TelegramFileError("failed");
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    if (e instanceof TelegramFileError) throw e;
    console.error(`[eait] telegram file download failed: ${(e as Error)?.name ?? "error"}`);
    throw new TelegramFileError("failed");
  }
  if (bytes.length > limit) throw new TelegramFileError("too-large");
  return bytes;
}

/** A Telegram error in the words worth logging: its code and description, never a request. */
export function describeError(err: unknown): string {
  if (err instanceof GrammyError) return `${err.error_code} ${err.description}`;
  return err instanceof Error ? err.message : String(err);
}

/**
 * The codes that mean this token will never work: 401 is revoked or wrong, 404 is what the Bot API
 * answers for a token that was never valid. Everything else — a 409 while an old poller hands over,
 * a 5xx, the network — is what the supervisor exists to ride out.
 */
export function isFatalTelegramError(err: unknown): boolean {
  return err instanceof GrammyError && (err.error_code === 401 || err.error_code === 404);
}

const keyboard = (buttons: Button[]) => ({
  inline_keyboard: [buttons.map((b) => ("url" in b ? { text: b.text, url: b.url } : { text: b.text, callback_data: b.data }))],
});

/** The ports a handler answers through, over one update's `ctx`. */
function portsOf(ctx: Context): Tap {
  return {
    async send(text, buttons) {
      await ctx.reply(text, buttons ? { reply_markup: keyboard(buttons) } : {});
    },
    async edit(text) {
      // Without `reply_markup` the edit drops the buttons, which is the point: a decided card
      // offers nothing. Telegram refuses an edit that changes nothing, which a double tap produces.
      await ctx.editMessageText(text).catch((e: unknown) => {
        if (!/message is not modified/.test(describeError(e))) throw e;
      });
    },
    async answer() {
      // Guarded: a query id goes stale (a backlog replayed after downtime), and dismissing the
      // spinner is cosmetic while the confirm behind the tap is not.
      await ctx.answerCallbackQuery().catch((e: unknown) => {
        console.warn(`[eait] telegram answerCallbackQuery failed: ${describeError(e)}`);
      });
    },
  };
}

/** A bot, and the turns it still has running — which a stop waits for (`superviseBot`). */
export type TelegramBot = Bot & { drain(): Promise<void> };

export function createBot(deps: EngineDeps, token: string, opts: BotOptions = {}): TelegramBot {
  const bot = new Bot(token);
  const h = telegramHandlers(deps);

  // 0. EVERY TURN IS TRACKED UNTIL IT ENDS. The runner hands updates to its sink and does not wait
  //    for them, so its `stop()` returns while a photo is still being analysed. A turn cut off there
  //    is an analysis charged and a meal never logged, for an update Telegram will not send again.
  const inFlight = new Set<Promise<unknown>>();
  const track = <T>(p: Promise<T>): Promise<T> => {
    inFlight.add(p);
    void p.finally(() => inFlight.delete(p)).catch(() => {});
    return p;
  };
  bot.use((_ctx, next) => track(next()));

  // 1. PRIVATE CHATS ONLY. The subject is `from.id` in a conversation with that one person; a group
  //    would put several people's diaries in one room. First, because it reads no state and writes
  //    none.
  bot.use(async (ctx, next) => {
    if (ctx.chat?.type !== "private" || ctx.from === undefined) return;
    await next();
  });

  // 2. UPDATE_ID DEDUPE, ahead of anything that does work: a poll restarted by the supervisor
  //    re-fetches from an offset the last one may not have acknowledged, and a replayed photo is a
  //    second paid analysis.
  // ponytail: in memory, so a process crash forgets; a table if crash redelivery ever shows in the log.
  const seen = new Set<number>();
  bot.use(async (ctx, next) => {
    const id = ctx.update.update_id;
    if (seen.has(id)) return;
    seen.add(id);
    if (seen.size > SEEN_UPDATES) seen.delete(seen.values().next().value!);
    await next();
  });

  // 3. ONE UPDATE AT A TIME PER USER. A confirm must not race the proposal it confirms, and one
  //    person's slow vision call must not hold anybody else's.
  bot.use(sequentialize((ctx) => String(ctx.from?.id ?? "")));

  const download = (api: Api, fileId: string) => () => fetchFile(api, token, fileId, {
    maxBytes: deps.config.maxUploadBytes, timeoutMs: DOWNLOAD_TIMEOUT_MS, ...(opts.fetch ? { fetch: opts.fetch } : {}),
  });

  interface Part { from: number; read: () => Promise<Uint8Array>; caption: string | undefined; chat: Tap }
  // The flush runs on a timer, outside every handler and outside `bot.catch`, so it says its own
  // failure. It is also outside `sequentialize`: an album and a message sent during its 1.5 s can
  // run side by side, which costs an ordering, never a double charge.
  // ponytail: an album still inside its debounce when the process stops is dropped unanswered; a
  // flush-on-stop in `AlbumBuffer` if a deploy ever lands on one.
  const albums = new AlbumBuffer<Part>(opts.albumMs ?? ALBUM_FLUSH_MS, (_key, parts) => {
    const first = parts[0]!;
    return track(h.photos(first.from, parts.map((p) => p.read), parts.find((p) => p.caption)?.caption, first.chat)
      .catch(async (e: unknown) => {
        console.error(`[eait] telegram album failed: ${describeError(e)}`);
        await first.chat.send(TELEGRAM_COPY.failed).catch(() => {});
      }));
  });

  bot.command("start", (ctx) => h.start(ctx.from!.id, ctx.match, portsOf(ctx)));
  bot.command("today", (ctx) => h.today(ctx.from!.id, portsOf(ctx)));
  bot.on("callback_query:data", (ctx) => h.tap(ctx.from.id, ctx.callbackQuery.data, portsOf(ctx)));
  bot.on("message:text", (ctx) => h.text(ctx.from.id, ctx.message.text, portsOf(ctx)));
  bot.on("message:photo", async (ctx) => {
    const largest = ctx.message.photo.at(-1)!;
    const part: Part = {
      from: ctx.from.id, read: download(ctx.api, largest.file_id), caption: ctx.message.caption, chat: portsOf(ctx),
    };
    const group = ctx.message.media_group_id;
    if (group !== undefined) return albums.add(`${ctx.from.id}:${group}`, part);
    await h.photos(part.from, [part.read], part.caption, part.chat);
  });

  // A failed handler never takes the loop down, and the person hears something. Worded as "it may
  // have gone through": the throw can come after a meal was logged, and "try again" logs it twice.
  bot.catch(async (err) => {
    console.error(`[eait] telegram handler failed (update ${err.ctx.update.update_id}): ${describeError(err.error)}`);
    await err.ctx.reply(TELEGRAM_COPY.failed).catch(() => {});
  });

  return Object.assign(bot, {
    async drain() {
      while (inFlight.size > 0) await Promise.allSettled([...inFlight]);
    },
  });
}

/**
 * Poll, and keep polling: getMe, then the runner, and on a transient failure the same again after
 * `retryMs`. A 401 or 404 ends the loop with `down()` and a line naming the variable — never the
 * process, because the API beside it is the product and a Telegram token is not.
 *
 * `up(username)` fires each time getMe answers, which is what switches the Connect Telegram links on.
 */
export function superviseBot(
  bot: TelegramBot,
  hooks: { up(username: string): void; down(): void },
  retryMs = 15_000,
): { stop(): Promise<void> } {
  let stopping = false;
  let handle: RunnerHandle | undefined;
  let wake = () => {};
  // getMe retries a 5xx or a network failure inside `init` on its own backoff, so a stop has to be
  // able to reach into it.
  const abort = new AbortController();

  const loop = (async () => {
    while (!stopping) {
      try {
        // grammY's Node build types its signal as the `abort-controller` shim; the runtime one is the same object.
        await bot.init(abort.signal as Parameters<Bot["init"]>[0]);
        if (stopping) break;
        hooks.up(bot.botInfo.username);
        // SILENT, AND NO RETRIES OF ITS OWN. The runner's default logs every failed poll as the
        // whole error object, whose inner fetch error carries the request URL — the token. And it
        // retries anything but 401/409 itself for up to fifteen hours on a backoff a stop cannot
        // interrupt, so the supervisor below never heard of an outage. Failing at once hands the
        // error here, where it is logged through `describeError` and retried on `retryMs`.
        handle = run(bot, { runner: { silent: true, maxRetryTime: 0 } });
        await handle.task();
        if (stopping) break;
      } catch (e) {
        if (stopping) break;
        if (isFatalTelegramError(e)) {
          hooks.down();
          console.error(`[eait] telegram connector stopped: ${describeError(e)}. `
            + "Check EAIT__BACKEND__TELEGRAM_BOT_TOKEN; the API keeps serving.");
          break;
        }
        console.error(`[eait] telegram connector error, retrying in ${Math.round(retryMs / 1000)}s: ${describeError(e)}`);
      }
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, retryMs);
        wake = () => { clearTimeout(timer); resolve(); };
      });
    }
  })();

  return {
    async stop() {
      stopping = true;
      abort.abort();
      wake();
      if (handle?.isRunning()) await handle.stop();
      await loop;
      await bot.drain();
    },
  };
}
