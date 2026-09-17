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
  MAX_USER_LINE, localDate, localTime, renderableVerdicts, scriptedLine, verdictPillLabel,
  type MealAnalysis, type Refusal,
} from "@eait/shared";
import type { Config } from "../config.ts";
import { rateLimiter } from "../api/ratelimit.ts";
import {
  cancelPendingMeal, confirmPendingMeal, day, handleText, linkTelegram, logPhotoMeal, type EngineDeps,
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

/** Every fixed sentence the bot sends, gated by `lintCopy` in its test like `PAGE_COPY`. */
export const TELEGRAM_COPY = {
  stranger:
    "This is the new eait. Your meals and photos are kept in your eait account: sign in on the web " +
    "and press Connect Telegram on your plan.",
  signIn: "Sign in",
  connected: "Connected. Send a photo of a meal, tell me what you ate, or ask Gabie a question.",
  codeInvalid: "That link has expired. Open your plan on the web and press Connect Telegram again.",
  elsewhere: "This Telegram is already connected to a different eait account.",
  tooManyTries: "Too many tries from this Telegram. Wait a while, then press the link again.",
  onTheWeb: "Your profile and settings are on the web.",
  tooLong: "That message is too long to send.",
  proposalLead: "Logging this — look right?",
  logIt: "Log it",
  notThis: "Not this",
  logged: "Logged.",
  alreadyLogged: "That one was already logged.",
  expired: "That one is no longer being held. Say it again.",
  updated: "Updated.",
  moved: "Moved.",
  targetGone: "There is no meal open here to change. Say what you ate and log it again.",
  downloadFailed: "That photo did not come through from Telegram. Send it again.",
  tooLarge: "That photo is too large to send.",
  todayEmpty: "Nothing logged today yet.",
  failed: "Something went wrong, and it may still have gone through. Check /today before sending it again.",
} as const;

/** One sentence per refusal. The link is added by `refusalText`, so every one of them carries it. */
const REFUSAL_WORDS: Record<string, string> = {
  "not-onboarded": "Answer the plan questions on the web first.",
  "not-food": "That did not look like food.",
  "cap-user": "That was your last one today — your daily allowance resets at midnight.",
  "cap-global": "Everyone has used today's allowance. Tomorrow is a fresh number.",
  "cap-address": "That's the limit for now. Try again later.",
  "subscription-required": "The analyses this account came with are used up. Subscribe on the web to carry on.",
  "analysis-failed": "That did not come back. Try it again.",
  "unsupported-image": "That file is not a photo this can read. JPEG, PNG or WebP.",
  "no-photo": "That photo did not come through. Send it again.",
};

/** Where a person signs in, finishes onboarding, subscribes and changes settings. */
function webStart(config: Config): string {
  const origin = (config.publicWebUrl || config.publicApiUrl || `http://${config.host}:${config.port}`)
    .replace(/\/+$/, "");
  return `${origin}/start`;
}

/** A refusal as the bot says it: a sentence, then the web link on its own line. */
export function refusalText(config: Config, r: Refusal): string {
  const key = r.kind === "cap-exceeded" ? `cap-${r.scope}` : r.kind;
  return `${REFUSAL_WORDS[key] ?? REFUSAL_WORDS["analysis-failed"]}\n${webStart(config)}`;
}

/** A meal as plain text: what it is, the numbers, and the verdicts in words. */
function card(a: MealAnalysis): string {
  const g = (n: number) => `${Math.round(n)} g`;
  const lines = [
    `${a.items.map((i) => i.name).join(", ") || "Meal"} — ${Math.round(a.kcal)} kcal`,
    `Protein ${g(a.protein_g)} · Carbs ${g(a.carbs_g)} · Fat ${g(a.fat_g)}`,
  ];
  const verdicts = renderableVerdicts(a.verdicts).map((d) => verdictPillLabel(d, a.verdicts[d]!));
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

  /** The one thing an unconnected Telegram user is told, whatever they sent. */
  const stranger = (chat: Chat) => {
    const url = webStart(config);
    // Telegram refuses a URL button it considers invalid, and a development host is one.
    return url.startsWith("https://")
      ? chat.send(TELEGRAM_COPY.stranger, [{ text: TELEGRAM_COPY.signIn, url }])
      : chat.send(`${TELEGRAM_COPY.stranger}\n${url}`);
  };

  return {
    async start(from: number, payload: string, chat: Chat): Promise<void> {
      if (payload.trim() === "") {
        return (await account(from)) === null ? stranger(chat) : chat.send(TELEGRAM_COPY.connected);
      }
      if (limiter.check(`telegram:${from}`, { limit: config.authRateLimitPerHour, windowMs: HOUR }) !== null) {
        return chat.send(TELEGRAM_COPY.tooManyTries);
      }
      const outcome = await linkTelegram(deps, payload, String(from));
      await chat.send(outcome === "linked" ? TELEGRAM_COPY.connected
        : outcome === "elsewhere" ? TELEGRAM_COPY.elsewhere : TELEGRAM_COPY.codeInvalid);
    },

    async today(from: number, chat: Chat): Promise<void> {
      const userId = await account(from);
      if (userId === null) return stranger(chat);
      const today = await day(deps, userId);
      if (today === null) return chat.send(refusalText(config, { kind: "not-onboarded" }));
      const { totals, targets } = today;
      const head = `Today: ${Math.round(totals.kcal)} of ${targets.kcal} kcal, `
        + `${Math.round(totals.protein_g)} of ${targets.protein_g} g protein`;
      const meals = today.meals.map((m) =>
        `${localTime(config.timezone, new Date(m.ts))} ${m.items.map((i) => i.name).join(", ") || "Meal"} — ${Math.round(m.kcal)} kcal`);
      await chat.send([head, ...(meals.length > 0 ? meals : [TELEGRAM_COPY.todayEmpty])].join("\n"));
    },

    async text(from: number, text: string, chat: Chat): Promise<void> {
      const userId = await account(from);
      if (userId === null) return stranger(chat);
      // A command nothing handled. @eait_bot's old users know several; routed as text, each is a
      // billed turn answering a question nobody asked.
      if (text.startsWith("/")) return chat.send(`${TELEGRAM_COPY.onTheWeb}\n${webStart(config)}`);
      if (text.length > MAX_USER_LINE) return chat.send(TELEGRAM_COPY.tooLong);

      const r = await handleText(deps, userId, { text });
      switch (r.kind) {
        case "answered":
          return chat.send(r.speaker === "gabie" ? `Gabie: ${r.text}` : r.text);
        case "proposed": {
          const lead = r.date === localDate(config.timezone)
            ? TELEGRAM_COPY.proposalLead
            : TELEGRAM_COPY.proposalLead.replace(" —", ` for ${r.date} —`);
          return chat.send(`${lead}\n${card(r.analysis)}`, [
            { text: TELEGRAM_COPY.logIt, data: `ok:${r.pendingId}` },
            { text: TELEGRAM_COPY.notThis, data: `no:${r.pendingId}` },
          ]);
        }
        case "updated":
          return chat.send(`${TELEGRAM_COPY.updated}\n${card(r.analysis)}`);
        case "redated":
          return chat.send(`${TELEGRAM_COPY.moved}\n${card(r.analysis)}`);
        case "target-gone":
          return chat.send(TELEGRAM_COPY.targetGone);
        default:
          return chat.send(refusalText(config, r));
      }
    },

    async photos(
      from: number,
      images: (() => Promise<Uint8Array>)[],
      caption: string | undefined,
      chat: Chat,
    ): Promise<void> {
      const userId = await account(from);
      if (userId === null) return stranger(chat);
      if (caption !== undefined && caption.length > MAX_USER_LINE) return chat.send(TELEGRAM_COPY.tooLong);

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
        return chat.send(e.reason === "too-large" ? TELEGRAM_COPY.tooLarge : TELEGRAM_COPY.downloadFailed);
      }
      await chat.send(r.kind === "logged" ? `${TELEGRAM_COPY.logged}\n${card(r.analysis)}` : refusalText(config, r));
    },

    async tap(from: number, data: string, tap: Tap): Promise<void> {
      await tap.answer();
      const [verb, pendingId] = data.split(":");
      if ((verb !== "ok" && verb !== "no") || !pendingId) return;
      const userId = await account(from);
      if (userId === null) return stranger(tap);

      if (verb === "ok") {
        const r = await confirmPendingMeal(deps, userId, pendingId);
        return tap.edit(r.kind === "logged" ? `${TELEGRAM_COPY.logged}\n${card(r.analysis)}`
          : r.kind === "expired" ? TELEGRAM_COPY.expired : refusalText(config, r));
      }
      const r = await cancelPendingMeal(deps, userId, pendingId);
      return tap.edit(r.kind === "cancelled" ? scriptedLine("dropped")
        : r.kind === "expired" ? TELEGRAM_COPY.expired : `${TELEGRAM_COPY.alreadyLogged}\n${card(r.analysis)}`);
    },
  };
}
