// The Telegram connector's handlers: a Telegram user id and a message in, plain text out.
//
// NO GRAMMY IN THIS FILE, and a test says so. A handler resolves the account from the Telegram id,
// calls ONE engine function through `engine/index.ts`, and says the result through a port — the same
// shape as a route in `api/routes.ts`, with a chat where the `Response` would be. `bot.ts` is the
// thin grammY half that turns updates into these calls; everything a test needs to prove is here.
//
// THE SUBJECT IS `from.id`, as a string, and nothing else Telegram sends is stored or trusted: not
// the username, not the first name, not the chat id, not text in a message. Callback data carries a
// pending id and nothing that names an account — the store scopes every pending by the user id this
// file resolved, which is why a stale or crafted tap can only ever find "expired".

import {
  MAX_USER_LINE, UNIT_KCAL, localDate, localTime, narrowLang, renderableVerdicts, scriptedLine,
  verdictPillLabel, wholeNumbers,
  type Lang, type MealAnalysis, type Refusal,
} from "@eait/shared";
import { telegramCopyFor, type TelegramCopy } from "./copy.ts";
import type { Config } from "../config.ts";
import { rateLimiter } from "../api/ratelimit.ts";
import {
  cancelPendingMeal, confirmPendingMeal, day, handleText, identitiesFor, linkTelegram, logPhotoMeal,
  type EngineDeps,
} from "../engine/index.ts";

/** A button under a message: a tap that comes back as callback data, or a link. */
export type Button = { text: string; data: string } | { text: string; url: string };

/** The chat a message came from. Plain text only, one row of buttons at most. */
export interface Chat {
  send(text: string, buttons?: Button[]): Promise<void>;
}

/** A tap on a button under one of the bot's own messages. */
export interface Tap extends Chat {
  /** Dismiss the tap's spinner. `bot.ts` guards it: a stale query id must not cost the tap. */
  answer(): Promise<void>;
  /** Replace the tapped message's text, and its buttons with none. */
  edit(text: string): Promise<void>;
}

/** A Telegram photo that could not be fetched. Thrown by `bot.ts`, before anything is charged. */
export class TelegramFileError extends Error {
  constructor(readonly reason: "failed" | "too-large") {
    super(`telegram file ${reason}`);
  }
}

/**
 * An address with its local part masked: `kirill@example.com` → `k***@example.com`.
 *
 * ENOUGH TO RECOGNISE, NOT ENOUGH TO READ. The line exists so somebody who pressed a link another
 * person sent them sees an account that is not theirs; a full address would put somebody's email in
 * front of whoever holds that Telegram account, and in Telegram's own storage. Two characters or
 * fewer keep nothing: one letter of a two-letter local part is most of it.
 */
function maskAddress(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "***";
  const local = email.slice(0, at);
  return `${local.length > 2 ? local[0] : ""}***${email.slice(at)}`;
}

/** Where a person signs in, finishes onboarding, subscribes and changes settings. */
function webStart(config: Config): string {
  const origin = (config.publicWebUrl || config.publicApiUrl || `http://${config.host}:${config.port}`)
    .replace(/\/+$/, "");
  return `${origin}/start`;
}

/** A refusal as the bot says it: a sentence, then the web link on its own line. */
export function refusalText(config: Config, r: Refusal, lang: Lang): string {
  const words = telegramCopyFor(lang).refusals;
  const key = r.kind === "cap-exceeded" ? `cap-${r.scope}` : r.kind;
  // A kind with no sentence falls back to the generic failure rather than to English: a refusal is
  // the one message a user cannot act on without understanding it.
  return `${words[key] ?? words["analysis-failed"]}\n${webStart(config)}`;
}

/** A meal as plain text: what it is, the numbers, and the verdicts in words. */
function card(a: MealAnalysis, lang: Lang): string {
  const copy = telegramCopyFor(lang);
  const n = wholeNumbers(lang);
  const g = (x: number) => `${n(x)} g`;
  const lines = [
    `${a.items.map((i) => i.name).join(", ") || copy.meal} — ${n(a.kcal)} ${UNIT_KCAL[lang]}`,
    `${copy.macros.protein} ${g(a.protein_g)} · ${copy.macros.carbs} ${g(a.carbs_g)} · ${copy.macros.fat} ${g(a.fat_g)}`,
  ];
  const verdicts = renderableVerdicts(a.verdicts).map((d) => verdictPillLabel(d, a.verdicts[d]!, lang));
  if (verdicts.length > 0) lines.push(verdicts.join(" · "));
  return lines.join("\n");
}

const HOUR = 60 * 60 * 1000;

export function telegramHandlers(deps: EngineDeps) {
  const { config, store } = deps;
  // `/start <code>` is a guess at a pairing code as much as the pairing form is, and gets the same
  // allowance per Telegram id that the form gets per address. In memory, like the API's own.
  const limiter = rateLimiter();

  const account = (from: number) => store.userIdForIdentity("telegram", String(from));

  /**
   * WHICH LANGUAGE THIS CHAT IS IN.
   *
   * The ACCOUNT's, once there is one: a Telegram is a transport onto an eait account made
   * elsewhere, and that account has already answered the question — in Settings, or at sign-in.
   * Telegram's own `language_code` is a hint about the client, and a user who switched the app to
   * German should not be answered in the language their phone was bought in.
   *
   * Before there is an account there is nothing to ask, so the one sentence a stranger gets reads
   * `language_code` — the only thing Telegram tells us that is about the person rather than about
   * the message, and the reason `stranger` is worth localizing at all.
   */
  const langOf = async (userId: string | null, locale?: string): Promise<Lang> =>
    (userId !== null ? (await store.getProfile(userId))?.lang : undefined) ?? narrowLang(locale);

  /**
   * "Connected to the eait account signed in with Google, k***@example.com."
   *
   * WHICH ACCOUNT, said at the moment it is connected and again on a bare `/start`. A pairing code
   * can be handed to somebody with a pretext, and "Connected." alone let that go unnoticed for as
   * long as they kept sending photos. The provider comes from the account's own identities and the
   * address is masked; neither is anything Telegram told us.
   */
  const connected = async (userId: string, copy: TelegramCopy): Promise<string> => {
    const providers = (await identitiesFor(deps, userId)).map((i) => i.provider);
    const named = providers.find((p) => p === "apple" || p === "google");
    const email = named ? await store.emailForUser(userId) : null;
    const label = named === "apple" ? "Apple" : named === "google" ? "Google" : copy.viaApp;
    return `${copy.connectedLead} ${label}${email ? `, ${maskAddress(email)}` : ""}.\n`
      + `${copy.connectedTail}\n${copy.notYours}`;
  };

  /** The one thing an unconnected Telegram user is told, whatever they sent. */
  const stranger = (chat: Chat, copy: TelegramCopy) => {
    const url = webStart(config);
    // Telegram refuses a URL button it considers invalid, and a development host is one.
    return url.startsWith("https://")
      ? chat.send(copy.stranger, [{ text: copy.signIn, url }])
      : chat.send(`${copy.stranger}\n${url}`);
  };

  return {
    async start(from: number, payload: string, chat: Chat, locale?: string): Promise<void> {
      // THE LIMITER RUNS BEFORE ANY STORE READ, which is the whole point of shedding. A pairing
      // code is guessable, so this bounds the guessing — and resolving the account and its
      // language first made every REFUSED attempt cost two queries where it used to cost none.
      // The refusal is worded from Telegram's own `locale`: the one signal available without the
      // read this is declining to do.
      //
      // Zero means NO LIMIT, the reading `api/routes.ts` and `config.ts` already have. Passed
      // straight to the limiter it means one an hour, so the setting that switches the allowance
      // off would have switched the bot off instead.
      const allowance = config.authRateLimitPerHour;
      if (payload.trim() !== "" && allowance > 0
        && limiter.check(`telegram:${from}`, { limit: allowance, windowMs: HOUR }) !== null) {
        return chat.send(telegramCopyFor(narrowLang(locale)).tooManyTries);
      }

      const before = await account(from);
      const copy = telegramCopyFor(await langOf(before, locale));
      if (payload.trim() === "") {
        return before === null ? stranger(chat, copy) : chat.send(await connected(before, copy));
      }
      // `moved` is the recovery path and reads exactly like a fresh link: what matters to the
      // person in front of it is which account they are on now, which the line names either way.
      if ((await linkTelegram(deps, payload, String(from))) === "invalid") {
        return chat.send(copy.codeInvalid);
      }
      // AFTER the link, because linking is what gives a stranger an account — and the account's
      // language is the one that wins. A code spent from a German phone onto an Italian account
      // answers in Italian, which is the account somebody is about to be told they are on.
      const userId = (await account(from))!;
      await chat.send(await connected(userId, telegramCopyFor(await langOf(userId, locale))));
    },

    async today(from: number, chat: Chat, locale?: string): Promise<void> {
      const userId = await account(from);
      const lang = await langOf(userId, locale);
      const copy = telegramCopyFor(lang);
      if (userId === null) return stranger(chat, copy);
      const today = await day(deps, userId);
      if (today === null) return chat.send(refusalText(config, { kind: "not-onboarded" }, lang));
      const { totals, targets } = today;
      const n = wholeNumbers(lang);
      const head = copy.todayHead({
        eaten: n(totals.kcal), plan: n(targets.kcal),
        protein: n(totals.protein_g), proteinTarget: n(targets.protein_g),
      });
      const meals = today.meals.map((m) =>
        `${localTime(config.timezone, new Date(m.ts))} ${m.items.map((i) => i.name).join(", ") || copy.meal} — ${n(m.kcal)} ${UNIT_KCAL[lang]}`);
      await chat.send([head, ...(meals.length > 0 ? meals : [copy.todayEmpty])].join("\n"));
    },

    async text(from: number, text: string, chat: Chat, locale?: string): Promise<void> {
      const userId = await account(from);
      const lang = await langOf(userId, locale);
      const copy = telegramCopyFor(lang);
      if (userId === null) return stranger(chat, copy);
      // A command nothing handled. @eait_bot's old users know several; routed as text, each is a
      // billed turn answering a question nobody asked.
      if (text.startsWith("/")) return chat.send(`${copy.onTheWeb}\n${webStart(config)}`);
      if (text.length > MAX_USER_LINE) return chat.send(copy.tooLong);

      const r = await handleText(deps, userId, { text });
      switch (r.kind) {
        case "answered":
          return chat.send(r.text);
        case "proposed": {
          // A SECOND TEMPLATE, not a substring surgery on the first. The old line spliced " for
          // <date>" in front of an em dash, which is a claim about where a date goes in an English
          // sentence — and there is no dash to find in half of these languages.
          const lead = r.date === localDate(config.timezone)
            ? copy.proposalLead
            : copy.proposalLeadDated({ date: r.date });
          return chat.send(`${lead}\n${card(r.analysis, lang)}`, [
            { text: copy.logIt, data: `ok:${r.pendingId}` },
            { text: copy.notThis, data: `no:${r.pendingId}` },
          ]);
        }
        case "updated":
          return chat.send(`${copy.updated}\n${card(r.analysis, lang)}`);
        case "redated":
          return chat.send(`${copy.moved}\n${card(r.analysis, lang)}`);
        case "target-gone":
          return chat.send(copy.targetGone);
        default:
          return chat.send(refusalText(config, r, lang));
      }
    },

    async photos(
      from: number,
      images: (() => Promise<Uint8Array>)[],
      caption: string | undefined,
      chat: Chat,
      locale?: string,
    ): Promise<void> {
      const userId = await account(from);
      const lang = await langOf(userId, locale);
      const copy = telegramCopyFor(lang);
      if (userId === null) return stranger(chat, copy);
      if (caption !== undefined && caption.length > MAX_USER_LINE) return chat.send(copy.tooLong);

      let r: Awaited<ReturnType<typeof logPhotoMeal>>;
      try {
        // Capped, not refused: an album is up to ten photos, and the first ones are the meal.
        r = await logPhotoMeal(deps, userId, {
          images: images.slice(0, config.maxPhotosPerMeal),
          ...(caption !== undefined ? { caption } : {}),
        });
      } catch (e) {
        // The bytes are read after the caps and before the charge, so a download that failed
        // spent nothing, and saying so is the whole answer.
        if (!(e instanceof TelegramFileError)) throw e;
        return chat.send(e.reason === "too-large" ? copy.tooLarge : copy.downloadFailed);
      }
      await chat.send(r.kind === "logged" ? `${copy.logged}\n${card(r.analysis, lang)}` : refusalText(config, r, lang));
    },

    async tap(from: number, data: string, tap: Tap, locale?: string): Promise<void> {
      await tap.answer();
      const [verb, pendingId] = data.split(":");
      if ((verb !== "ok" && verb !== "no") || !pendingId) return;
      const userId = await account(from);
      const lang = await langOf(userId, locale);
      const copy = telegramCopyFor(lang);
      if (userId === null) return stranger(tap, copy);

      if (verb === "ok") {
        const r = await confirmPendingMeal(deps, userId, pendingId);
        return tap.edit(r.kind === "logged" ? `${copy.logged}\n${card(r.analysis, lang)}`
          : r.kind === "expired" ? copy.expired : refusalText(config, r, lang));
      }
      const r = await cancelPendingMeal(deps, userId, pendingId);
      return tap.edit(r.kind === "cancelled" ? scriptedLine("dropped", lang, {})
        : r.kind === "expired" ? copy.expired : `${copy.alreadyLogged}\n${card(r.analysis, lang)}`);
    },
  };
}
