// Telegram glue. The grammy handlers are thin adapters over the exported `process*` functions,
// which hold the real logic and are unit-tested without grammy (a fake `send` + temp db + fake
// provider). Routing precedence (spec §18): command > reply-to-meal (correction) > onboarding text
// > nudge. Concurrency via @grammyjs/runner + sequentialize(by user); update_id dedupe; images
// are in-memory only (never written to disk — ephemeral by construction).

import { Bot, InlineKeyboard } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import type { Database } from "bun:sqlite";
import type { Config } from "./config.ts";
import type { LLMProvider } from "./llm/provider.ts";
import { OpenRouterProvider } from "./llm/openrouter.ts";
import {
  openDb, berlinDate, upsertUser, getUser, setConsent, setProfile, setUserState,
  insertMeal, setMealReply, applyCorrection, mealByReply, dailyTotals, countMealsToday,
  deleteUser, userCount, mealCount, seenUpdate, markUpdate, type UserRow,
} from "./db.ts";
import { analyzeMeal, analyzeCorrection } from "./analyzer.ts";
import { targetsFor } from "./targets.ts";
import { formatReply } from "./reply.ts";
import { step, type OnboardingInput, type OnboardingResult, type InlineButton } from "./onboarding.ts";
import { DEFAULT_LANG, translatorFor } from "./i18n/index.ts";
import type { Lang, MealAnalysis, MealRecord, Profile } from "./types.ts";

export interface BotDeps {
  db: Database;
  provider: LLMProvider;
  config: Config;
}

export interface Sent {
  chat_id: number;
  message_id: number;
}
/** How the process* functions emit to the user. Returns the sent message ids (for reply-routing). */
export type Send = (text: string, buttons?: InlineButton[][]) => Promise<Sent | void>;

// ---------- pure helpers ----------

export function profileOf(u: UserRow): Profile {
  return {
    telegram_id: u.telegram_id,
    lang: (u.lang === "en" ? "en" : "ru") as Lang,
    goal: u.goal,
    restrictions: u.restrictions,
  };
}

export function mealToAnalysis(m: MealRecord): MealAnalysis {
  return {
    isFood: true,
    items: m.items,
    kcal: m.kcal, protein_g: m.protein_g, carbs_g: m.carbs_g, fat_g: m.fat_g,
    satfat_g: m.satfat_g, fiber_g: m.fiber_g, sugar_g: m.sugar_g, sodium_mg: m.sodium_mg,
    plant_protein_pct: m.plant_protein_pct, verdicts: m.verdicts,
    confidence: m.confidence ?? "", notes: m.notes ?? "",
  };
}

/** Persist an onboarding transition. setConsent/setProfile already move state; setUserState reconciles. */
export function applyOnboarding(db: Database, telegram_id: number, r: OnboardingResult): void {
  if (r.patch?.consent_at) setConsent(db, telegram_id, r.patch.consent_at);
  if (r.patch?.goal) setProfile(db, telegram_id, { goal: r.patch.goal });
  if (r.patch?.restrictions !== undefined) setProfile(db, telegram_id, { restrictions: r.patch.restrictions });
  setUserState(db, telegram_id, r.nextState);
}

// ---------- process functions (grammy-free, testable) ----------

export async function processOnboarding(
  deps: BotDeps,
  from: { id: number; username?: string | null },
  input: OnboardingInput,
  send: Send,
): Promise<void> {
  upsertUser(deps.db, { telegram_id: from.id, username: from.username ?? null });
  const u = getUser(deps.db, from.id);
  const t = translatorFor(u ? profileOf(u).lang : DEFAULT_LANG);
  const r = step(u ? { state: u.state, goal: u.goal } : undefined, input, t);
  applyOnboarding(deps.db, from.id, r);
  await send(r.reply, r.buttons);
}

export async function processPhoto(
  deps: BotDeps,
  from: { id: number },
  getBytes: () => Promise<Uint8Array>,
  send: Send,
): Promise<void> {
  const { db, provider, config } = deps;
  const u = getUser(db, from.id);
  if (!u || u.state !== "active") {
    await send("Сначала пройди /start.");
    return;
  }
  const prof = profileOf(u);
  const date = berlinDate(new Date(), config.tz);
  if (countMealsToday(db, from.id, date) >= config.perUserDailyPhotoCap) {
    await send("Лимит фото на сегодня достигнут — вернись завтра.");
    return;
  }
  let analysis: MealAnalysis;
  try {
    const bytes = await getBytes(); // in-memory only; never written to disk
    analysis = await analyzeMeal(bytes, prof, provider);
  } catch (e) {
    console.error(`[eait] analyze failed user=${from.id}: ${(e as any)?.message}`);
    await send("Не смог разобрать 🤔 пришли фото ещё раз.");
    return;
  }
  console.log(`[eait] photo user=${from.id} isFood=${analysis.isFood} kcal=${analysis.kcal} items=${analysis.items.length}`);
  if (!analysis.isFood) {
    await send("Это не похоже на еду 🤔");
    return;
  }
  const id = crypto.randomUUID();
  insertMeal(db, {
    id, user_id: from.id, ts: new Date().toISOString(), date, analysis, model: config.llmModel,
  });
  console.log(`[eait] meal stored ${id} user=${from.id}`);
  const totals = dailyTotals(db, from.id, date);
  const sent = await send(
    formatReply(analysis, totals, targetsFor(prof), translatorFor(prof.lang)) +
      "\n\n↩️ Не так? Ответь реплаем на это сообщение с уточнением.",
  );
  if (sent) setMealReply(db, id, from.id, sent.chat_id, sent.message_id);
}

/** Returns true if the text was a correction of a known meal (so the caller stops routing). */
export async function processCorrection(
  deps: BotDeps,
  from: { id: number },
  replyToMessageId: number,
  text: string,
  send: Send,
): Promise<boolean> {
  const { db, provider } = deps;
  const meal = mealByReply(db, from.id, replyToMessageId);
  if (!meal) return false;
  const u = getUser(db, from.id);
  if (!u) return false;
  const prof = profileOf(u);
  let updated: MealAnalysis;
  try {
    updated = await analyzeCorrection(mealToAnalysis(meal), text, prof, provider);
  } catch {
    await send("Не смог применить правку — попробуй иначе.");
    return true;
  }
  applyCorrection(db, meal.id, from.id, updated);
  const totals = dailyTotals(db, from.id, meal.date);
  await send("Обновил:\n" + formatReply(updated, totals, targetsFor(prof), translatorFor(prof.lang)));
  return true;
}

export function meCard(deps: BotDeps, userId: number): string | null {
  const u = getUser(deps.db, userId);
  if (!u || u.state !== "active") return null;
  const prof = profileOf(u);
  const date = berlinDate(new Date(), deps.config.tz);
  const totals = dailyTotals(deps.db, userId, date);
  const targets = targetsFor(prof);
  const goalRu = u.goal === "lose" ? "похудеть" : u.goal === "gain" ? "набрать" : "держать";
  const restr = prof.restrictions.length ? prof.restrictions.join(", ") : "нет";
  return (
    `Профиль: цель — ${goalRu}; ограничения — ${restr}\n` +
    `Сегодня: ${Math.round(totals.kcal)} / ${targets.kcal} ккал · Б ${Math.round(totals.protein_g)} / ${targets.protein_g} г`
  );
}

export function statsCard(deps: BotDeps): string {
  return `Пользователей: ${userCount(deps.db)} · приёмов еды: ${mealCount(deps.db)}`;
}

// ---------- grammy wiring ----------

function toKeyboard(buttons: InlineButton[][]): InlineKeyboard {
  const k = new InlineKeyboard();
  for (const row of buttons) {
    for (const b of row) k.text(b.text, b.data);
    k.row();
  }
  return k;
}

export function createBot(deps: BotDeps): Bot {
  const { db, config } = deps;
  const bot = new Bot(config.telegramBotToken);

  // update_id dedupe (crash-redelivery safety) — must be first
  bot.use(async (ctx, next) => {
    const uid = ctx.update.update_id;
    if (seenUpdate(db, uid)) return;
    markUpdate(db, uid);
    await next();
  });
  // one user's slow vision call must not block others
  bot.use(sequentialize((ctx) => String(ctx.from?.id ?? "")));

  const sendVia = (ctx: any): Send => async (text, buttons) => {
    const m = await ctx.reply(text, buttons ? { reply_markup: toKeyboard(buttons) } : undefined);
    return { chat_id: m.chat.id, message_id: m.message_id };
  };

  bot.command("start", async (ctx) => {
    if (ctx.from) await processOnboarding(deps, ctx.from, { type: "command", command: "start" }, sendVia(ctx));
  });
  bot.command("me", async (ctx) => {
    const card = ctx.from ? meCard(deps, ctx.from.id) : null;
    await ctx.reply(card ?? "Сначала пройди /start.");
  });
  bot.command("delete", async (ctx) => {
    await ctx.reply("Удалить все твои данные?", {
      reply_markup: new InlineKeyboard().text("Да, удалить", "delete_confirm").text("Отмена", "delete_cancel"),
    });
  });
  bot.command("stats", async (ctx) => {
    if (!ctx.from || config.adminUserId === null || config.adminUserId !== ctx.from.id) {
      await ctx.reply("Команда только для админа.");
      return;
    }
    await ctx.reply(statsCard(deps));
  });

  bot.on("callback_query:data", async (ctx) => {
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const data = ctx.callbackQuery.data;
    if (data === "delete_confirm") {
      deleteUser(db, ctx.from.id);
      await ctx.reply("Все твои данные удалены. /start — начать заново.");
      return;
    }
    if (data === "delete_cancel") {
      await ctx.reply("Отменено.");
      return;
    }
    await processOnboarding(deps, ctx.from, { type: "callback", data }, sendVia(ctx));
  });

  bot.on("message:photo", async (ctx) => {
    if (!ctx.from) return;
    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1]; // largest PhotoSize
    await processPhoto(
      deps,
      ctx.from,
      async () => {
        const file = await ctx.api.getFile(largest.file_id);
        const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
        const res = await fetch(url);
        return new Uint8Array(await res.arrayBuffer());
      },
      sendVia(ctx),
    );
  });

  bot.on("message:text", async (ctx) => {
    if (!ctx.from) return;
    const rt = ctx.message.reply_to_message;
    if (rt) {
      const handled = await processCorrection(deps, ctx.from, rt.message_id, ctx.message.text, sendVia(ctx));
      if (handled) return;
    }
    await processOnboarding(deps, ctx.from, { type: "text", text: ctx.message.text }, sendVia(ctx));
  });

  // Handler-level errors (a failed reply, a bad update) must never crash the process.
  bot.catch((err) => {
    console.error("[eait] handler error:", (err as any)?.error ?? err);
  });

  return bot;
}

export function startBot(config: Config): { db: Database; stop: () => Promise<void> } {
  const db = openDb(config.dbPath);
  const provider = new OpenRouterProvider({
    apiKey: config.openrouterApiKey,
    model: config.llmModel,
    timeoutMs: config.llmTimeoutMs,
  });
  const bot = createBot({ db, provider, config });

  // Resilient polling: a source error (e.g. a 409 Conflict during a poller
  // hand-off, or a transient network blip) logs + retries instead of crashing
  // the process. Without this, an uncaught runner rejection exits the process
  // and (under launchd KeepAlive) crash-loops.
  let stopping = false;
  let handle = run(bot);
  const supervise = async () => {
    while (!stopping) {
      try {
        await handle.task();
        break; // stopped cleanly
      } catch (err) {
        if (stopping) break;
        console.error(`[eait] runner error, retry in 15s: ${(err as any)?.description ?? err}`);
        await new Promise((r) => setTimeout(r, 15000));
        if (stopping) break;
        handle = run(bot);
      }
    }
  };
  void supervise();

  const stop = async () => {
    stopping = true;
    if (handle.isRunning()) await handle.stop();
    db.close();
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  return { db, stop };
}
