// Telegram glue. The grammy handlers are thin adapters over the exported `process*` functions,
// which hold the real logic and are unit-tested without grammy (a fake `send` + temp db + fake
// provider). Text routing (spec 2026-07-22-free-text-handling-design): command first, then the
// active-state gate — active users get processText (reply-to-rejection canned > caps > one
// router call deciding question / meal / correction, with a reply-mapped focus meal as context);
// non-active users' text belongs to onboarding. Concurrency via @grammyjs/runner +
// sequentialize(by user); update_id dedupe; images are in-memory only (never written to disk —
// ephemeral by construction).

import { Bot, InlineKeyboard } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import type { Config } from "../config.ts";
import type { LLMProvider } from "../llm/provider.ts";
import { createProvider } from "../llm/factory.ts";
import {
  openDb, berlinDate, berlinTime, upsertUser, getUser, setConsent, setProfile, setUserState,
  insertMeal, setMealReply, applyCorrection, mealByReply, dailyTotals,
  logLlmCall, llmCallsToday, llmCallCountToday, mealsOnDate, totalsByDate,
  insertPendingMeal, setPendingReply, getPendingMeal, deletePendingMeal, prunePendingMeals,
  deleteUser, userCount, mealCount, seenUpdate, markUpdate, setLang, setReplyFormat,
  getSetting, setSetting, clearSetting, hasEvent, logEvent, setAcquisitionSource,
  type Db, type UserRow,
} from "../db.ts";
import { loadAllowlist, type Allowlist } from "../allowlist.ts";
import { AlbumBuffer } from "./albums.ts";
import { analyzeMeal, classifyRestrictions, routeText, type RouteContext, type RouteResult } from "../analyzer.ts";
import { RejectionLog } from "./rejections.ts";
import { targetsFor, isRestrictionTag } from "../targets.ts";
import { formatReply } from "../reply.ts";
import { renderMealCard } from "../render.ts";
import { settingsRoot, settingsStep, type SettingsProfile } from "../settings.ts";
import { step, type OnboardingInput, type OnboardingResult, type InlineButton } from "../onboarding.ts";
import { DEFAULT_LANG, LANGS, LOCALES, isLang, resolveLang, translatorFor } from "../i18n/index.ts";
import type { TFunction } from "i18next";
import { isReplyFormat } from "../types.ts";
import type { Lang, MealAnalysis, MealContext, MealRecord, Profile, ReplyFormat } from "../types.ts";

export interface BotDeps {
  db: Db;
  provider: LLMProvider;
  config: Config;
  /**
   * Runtime access control (admin /allow · /deny). Optional so the many db+provider-only
   * tests need not build one; when absent, access falls back to the static env list via
   * isAllowed, and the allowlist commands report that runtime editing is unavailable.
   */
  allowlist?: Allowlist;
  /**
   * Not-food reply ids, so a follow-up reply gets the canned explanation. Optional like
   * allowlist; absent → such replies route to the LLM, which honestly has nothing on them.
   */
  rejections?: RejectionLog;
}

export interface Sent {
  chat_id: number;
  message_id: number;
}
/** How the process* functions emit to the user. Returns the sent message ids (for reply-routing). */
export type Send = (text: string, buttons?: InlineButton[][]) => Promise<Sent | void>;

/**
 * One meal card, both renderings. An object on purpose: `html` and `plain` are same-typed
 * strings, and as positional params a silent swap would ship raw tags to plain-mode users.
 */
export interface MealCard {
  html: string;
  plain: string;
}

/**
 * Sends a Rich Message (Bot API 10.1 HTML: tables, headings) with the card's plain fallback
 * when the rich send fails — the bot must never go silent over formatting.
 */
export type SendRich = (card: MealCard) => Promise<Sent | void>;

/** Rich when the user's effective format says so AND the rich sender is wired; plain otherwise.
 * One switch for every meal-card site. Callers resolve the format via replyFormatFor(u, config). */
async function sendCard(
  format: ReplyFormat,
  send: Send,
  sendRich: SendRich | undefined,
  card: MealCard,
): Promise<Sent | void> {
  if (format === "rich" && sendRich) return sendRich(card);
  return send(card.plain);
}

/**
 * Rewrites the message a callback came from. Settings needs this: four restriction toggles
 * would otherwise produce four chat messages.
 */
export type Edit = (text: string, buttons?: InlineButton[][]) => Promise<void>;

/**
 * Reacts on the USER'S message (grammy ctx.react). Two-phase lifecycle: 👀 the moment the
 * message is accepted for processing, 👍 replacing it when processing succeeded (Telegram
 * keeps one reaction set per message, so the second call swaps the first).
 */
export type React = (emoji: "👀" | "👍") => Promise<void>;

/**
 * Fire a reaction without ever letting it touch the pipeline: Promise.resolve wrapping makes
 * even a synchronously-throwing thunk harmless, and failures are logged — a Telegram-side
 * rejection must be visible to the operator, never a silent permanent degradation.
 */
function fireReaction(react: React | undefined, emoji: "👀" | "👍", userId: number): void {
  void Promise.resolve()
    .then(() => react?.(emoji))
    .catch((e) => console.warn(`[eait] reaction failed user=${userId}: ${describeError(e)}`));
}

// ---------- read-boundary helpers ----------
// profileOf is the ONE read boundary between the raw UserRow and the rest of the code; it both
// validates stored vocabulary and emits the operator warning, so it is intentionally not pure.
// Everything downstream (replyFormatFor, translatorForUser) consumes the resolved Profile.

export function profileOf(u: UserRow): Profile {
  // Off-vocabulary stored values (a renamed locale/format, a hand-edited row) degrade to the
  // default, but LOUDLY — a silent reset after a rename would strand affected users with no
  // operator trace. No truthiness guard on lang: '' is exactly the hand-edited NOT-NULL row the
  // warn exists for. reply_format's null is the normal "never chose" state and stays quiet.
  if (!isLang(u.lang)) {
    console.warn(`[eait] unknown lang ${JSON.stringify(u.lang)} user=${u.telegram_id} — using default`);
  }
  if (u.reply_format !== null && !isReplyFormat(u.reply_format)) {
    console.warn(`[eait] unknown reply_format ${JSON.stringify(u.reply_format)} user=${u.telegram_id} — using instance default`);
  }
  return {
    telegram_id: u.telegram_id,
    // Validate against the registry rather than coercing: a stored value can predate a locale
    // being renamed or removed, and an unvalidated one would render raw keys at the user.
    lang: isLang(u.lang) ? u.lang : DEFAULT_LANG,
    goal: u.goal,
    // 0 is the db's "explicitly skipped" sentinel — outside the db/bot boundary it means unknown.
    weight_kg: u.weight_kg ? u.weight_kg : null,
    restrictions: u.restrictions,
    // Same validation rule as lang: junk means "never chose", so the instance default applies.
    reply_format: isReplyFormat(u.reply_format) ? u.reply_format : null,
  };
}

/** The format a user's meal cards render in: their /settings choice, else the instance default.
 * Takes the already-resolved Profile so it never re-runs profileOf (which would re-warn). */
export function replyFormatFor(prof: Profile, config: Config): ReplyFormat {
  return prof.reply_format ?? config.replyFormat;
}

/** The translator for a user, or the default one if they have no row yet. */
function translatorForUser(u: UserRow | undefined): TFunction {
  return translatorFor(u ? profileOf(u).lang : DEFAULT_LANG);
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
export async function applyOnboarding(db: Db, telegram_id: number, r: OnboardingResult): Promise<void> {
  if (r.patch?.consent_at) await setConsent(db, telegram_id, r.patch.consent_at);
  if (r.patch?.goal) await setProfile(db, telegram_id, { goal: r.patch.goal });
  // !== undefined, not truthy: 0 is the explicit-skip sentinel and MUST be persisted,
  // or the weight question re-opens on every resume.
  if (r.patch?.weight_kg !== undefined) await setProfile(db, telegram_id, { weight_kg: r.patch.weight_kg });
  if (r.patch?.restrictions !== undefined) await setProfile(db, telegram_id, { restrictions: r.patch.restrictions });
  await setUserState(db, telegram_id, r.nextState);
}

// ---------- process functions (grammy-free, testable) ----------

export async function processOnboarding(
  deps: BotDeps,
  from: { id: number; username?: string | null; language_code?: string | null },
  input: OnboardingInput,
  send: Send,
): Promise<void> {
  // Language is seeded at first contact so the consent screen already arrives localized.
  // upsertUser only writes `lang` on INSERT, so a later /start never undoes a /lang change.
  await upsertUser(deps.db, {
    telegram_id: from.id,
    username: from.username ?? null,
    lang: resolveLang(from.language_code),
  });
  const u = await getUser(deps.db, from.id);
  if (input.type === "command") await recordStart(deps.db, from.id, input.payload);
  const t = translatorForUser(u);
  const r = step(u ? { state: u.state, goal: u.goal, weight_kg: u.weight_kg } : undefined, input, t);
  await applyRestrictionFallback(deps, u, input, r);
  await applyOnboarding(deps.db, from.id, r);
  if (u?.state !== "active" && r.nextState === "active") {
    await logEvent(deps.db, from.id, "onboarding_complete");
  }
  await send(r.reply, r.buttons);
}

/**
 * Telegram deep links (`t.me/<bot>?start=<payload>`) carry at most 64 chars of
 * `A-Za-z0-9_-`. Anything outside that grammar is dropped rather than stored — the payload
 * is an attribution campaign code, not user input. The bare `start` event is still logged
 * so organic arrivals form the no-code baseline.
 */
const START_PAYLOAD_RE = /^[A-Za-z0-9_-]{1,64}$/;

async function recordStart(db: Db, telegram_id: number, payload: string | undefined): Promise<void> {
  const code = payload && START_PAYLOAD_RE.test(payload) ? payload : null;
  if (code) await setAcquisitionSource(db, telegram_id, code); // first-touch: set-once in db layer
  await logEvent(db, telegram_id, "start", code);
}

/**
 * The keyword pass in `targets.ts` only knows the languages someone wrote keywords for, so a
 * German user typing "Nieren, kein Zucker" silently loses their kidney verdict and sodium cap.
 * When it matches nothing, ask the model instead.
 *
 * This lives here, not in `onboarding.ts`, because `step()` is a pure no-I/O state machine and
 * must stay one. Mutates `r.patch` in place before it is persisted.
 */
async function applyRestrictionFallback(
  deps: BotDeps,
  u: UserRow | undefined,
  input: OnboardingInput,
  r: OnboardingResult,
): Promise<void> {
  // Only the free-text restrictions step: a `restrictions_skip` tap also yields [], and an
  // explicit skip must never be second-guessed by the model.
  if (input.type !== "text" || !input.text.trim()) return;
  if (r.patch?.restrictions === undefined || r.patch.restrictions.length > 0) return;

  // Metered like every other provider call ("every LLM call draws one"), but deliberately NOT
  // cap-gated: refusing an onboarding step over a spend cap would strand the user mid-flow,
  // and this path runs at most once per user.
  if (u) await logLlmCall(deps.db, u.telegram_id, berlinDate(new Date(), deps.config.tz), "classify");
  const tags = await classifyRestrictions(input.text, deps.provider, translatorLangOf(u));
  if (tags.length) r.patch.restrictions = tags;
}

const translatorLangOf = (u: UserRow | undefined): Lang => (u ? profileOf(u).lang : DEFAULT_LANG);

// ---------- access control ----------

/**
 * Whether a sender may use the bot at all.
 *
 * Every photo is a billed vision call, so an open instance is a spending hole for whoever
 * hosts it. `allowedUserIds: null` preserves the original open behaviour; any configured list
 * is enforced strictly — including against the admin, so a mistyped list fails closed rather
 * than quietly admitting everyone.
 */
export function isAllowed(config: Config, userId: number | undefined): boolean {
  if (config.allowedUserIds === null) return true;
  if (userId === undefined) return false;
  return config.allowedUserIds.includes(userId);
}

// ---------- spend cap ----------

/** Key in the settings table holding the admin's runtime override. */
const CAP_KEY = "global_cap";

/**
 * The cap actually in force: a stored override if the admin set one, else the `.env` value.
 *
 * The override is read per photo rather than cached, so `/cap` takes effect on the very next
 * message with no restart — the whole point, since the moment you need to change a spend cap
 * is while traffic is arriving and you are holding a phone.
 *
 * A stored `"off"` means unlimited, which is deliberately distinct from having no override.
 * Anything unparseable falls back to the configured value rather than to unlimited: a corrupt
 * row must not silently remove the spend bound.
 */
export async function effectiveGlobalCap(db: Db, config: Config): Promise<number | null> {
  const raw = await getSetting(db, CAP_KEY);
  if (raw === null) return config.globalDailyAnalysisCap;
  if (raw === "off") return null;
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : config.globalDailyAnalysisCap;
}

/** `/cap`, `/cap <n>`, `/cap off`, `/cap reset` — admin only. */
export async function processCap(
  deps: BotDeps,
  from: { id: number },
  arg: string,
  send: Send,
): Promise<void> {
  const { db, config } = deps;
  const t = translatorForUser(await getUser(db, from.id));
  if (config.adminUserId === null || config.adminUserId !== from.id) {
    // Silent when no admin is configured at all: answering would advertise the command.
    if (config.adminUserId !== null) await send(t("errors.adminOnly"));
    return;
  }

  const a = arg.trim().toLowerCase();
  const shown = (v: number | null) => (v === null ? t("cap.unlimited") : String(v));

  if (a === "") {
    const date = berlinDate(new Date(), config.tz);
    await send(
      t("cap.current", {
        cap: shown(await effectiveGlobalCap(db, config)),
        // Must be the ENFORCED basis (LLM calls), not stored meals — not-food photos and Q&A
        // draw the cap without adding a meal row, and the /cap readout exists to watch spend.
        used: await llmCallCountToday(db, date),
      }),
    );
    return;
  }
  if (a === "off") {
    await setSetting(db, CAP_KEY, "off");
    await send(t("cap.off"));
    return;
  }
  if (a === "reset") {
    await clearSetting(db, CAP_KEY);
    await send(t("cap.reset", { cap: shown(config.globalDailyAnalysisCap) }));
    return;
  }

  const n = Number(a);
  // Number.isSafeInteger rejects 1.5, -5, and values past 2^53 that would round on the way in.
  if (!Number.isSafeInteger(n) || n < 0) {
    await send(t("cap.invalid"));
    return;
  }
  await setSetting(db, CAP_KEY, String(n));
  console.log(`[eait] global daily cap set to ${n} by admin`);
  await send(t("cap.set", { cap: n }));
}

// ---------- runtime allowlist (/allow · /deny · /allowed) ----------

/** Admin gate shared by the three allowlist commands. Mirrors processCap: silent when no
 *  admin is configured (answering would advertise the command), adminOnly otherwise. */
async function allowlistGate(
  deps: BotDeps,
  from: { id: number },
  send: Send,
): Promise<{ t: TFunction; al: Allowlist } | null> {
  const t = translatorForUser(await getUser(deps.db, from.id));
  const { config, allowlist } = deps;
  if (config.adminUserId === null || config.adminUserId !== from.id) {
    if (config.adminUserId !== null) await send(t("errors.adminOnly"));
    return null;
  }
  if (!allowlist) {
    // Constructed without runtime access control (static env list only).
    await send(t("allowlist.unavailable"));
    return null;
  }
  return { t, al: allowlist };
}

const parseUserId = (arg: string): number | null => {
  const n = Number(arg.trim());
  return Number.isSafeInteger(n) && n > 0 ? n : null;
};

/** /allow <id> — admits a user with no restart. On an open bot this STARTS an allowlist,
 *  auto-including the admin: closing the bot must never lock out the person closing it. */
export async function processAllow(
  deps: BotDeps,
  from: { id: number },
  arg: string,
  send: Send,
): Promise<void> {
  const gate = await allowlistGate(deps, from, send);
  if (!gate) return;
  const { t, al } = gate;
  const id = parseUserId(arg);
  if (id === null) {
    await send(t("allowlist.usage"));
    return;
  }
  if (al.isOpen()) {
    await al.add(from.id); // the admin; from.id === config.adminUserId past the gate
    await al.add(id);
    console.log(`[eait] allowlist started by admin: ${al.list()!.length} user(s)`);
    await send(t("allowlist.nowClosed", { id, count: al.list()!.length }));
    return;
  }
  if (al.has(id)) {
    await send(t("allowlist.already", { id }));
    return;
  }
  await al.add(id);
  console.log(`[eait] allowlist: admin allowed user=${id}`);
  await send(t("allowlist.added", { id, count: al.list()!.length }));
}

/** /deny <id>. Refuses to remove the admin: past the access middleware — which has no admin
 *  exemption — that would lock the admin out of every command, including /allow itself. */
export async function processDeny(
  deps: BotDeps,
  from: { id: number },
  arg: string,
  send: Send,
): Promise<void> {
  const gate = await allowlistGate(deps, from, send);
  if (!gate) return;
  const { t, al } = gate;
  const id = parseUserId(arg);
  if (id === null) {
    await send(t("allowlist.denyUsage"));
    return;
  }
  if (al.isOpen()) {
    await send(t("allowlist.open"));
    return;
  }
  if (id === deps.config.adminUserId) {
    await send(t("allowlist.cantDenyAdmin"));
    return;
  }
  if (!al.has(id)) {
    await send(t("allowlist.notListed", { id }));
    return;
  }
  await al.remove(id);
  console.log(`[eait] allowlist: admin denied user=${id}`);
  await send(t("allowlist.removed", { id, count: al.list()!.length }));
}

/** /allowed — the current list, or a loud reminder that the bot is open. */
export async function processAllowed(
  deps: BotDeps,
  from: { id: number },
  send: Send,
): Promise<void> {
  const gate = await allowlistGate(deps, from, send);
  if (!gate) return;
  const { t, al } = gate;
  const list = al.list();
  if (list === null) {
    await send(t("allowlist.open"));
    return;
  }
  await send(t("allowlist.list", { count: list.length, ids: list.join(", ") }));
}

/**
 * /waitlist — the willingness-to-pay instrument. No tier exists yet; the join is the signal.
 * Joining is recorded once per user (a re-join gets a different reply, no duplicate event),
 * so waitlist counts in the funnel report are users, not taps.
 */
export async function processWaitlist(deps: BotDeps, from: { id: number }, send: Send): Promise<void> {
  const t = translatorForUser(await getUser(deps.db, from.id));
  if (await hasEvent(deps.db, from.id, "waitlist_join")) {
    await send(t("waitlist.already"));
    return;
  }
  await logEvent(deps.db, from.id, "waitlist_join");
  await send(t("waitlist.joined"));
}

// ---------- commands, settings, help ----------

/** The commands shown in Telegram's `/` menu. Pure, so the list is testable without a token. */
export function buildCommands(t: TFunction): Array<{ command: string; description: string }> {
  return [
    { command: "start", description: t("commands.start") },
    { command: "me", description: t("commands.me") },
    { command: "settings", description: t("commands.settings") },
    { command: "help", description: t("commands.help") },
    { command: "waitlist", description: t("commands.waitlist") },
    { command: "delete", description: t("commands.delete") },
  ];
}

/** /help. Deliberately works before onboarding — it is how someone learns what to do. */
export async function helpText(
  deps: BotDeps,
  from: { id: number; language_code?: string | null },
): Promise<string> {
  const u = await getUser(deps.db, from.id);
  // No row yet (they ran /help before /start): fall back to their Telegram client language
  // rather than the default, so a German user reads German help from the first message.
  const lang = u ? profileOf(u).lang : resolveLang(from.language_code);
  return translatorFor(lang)("help.body");
}

/** /settings — sends a new message; every tap after this edits it. */
export async function processSettingsOpen(
  deps: BotDeps,
  from: { id: number },
  send: Send,
): Promise<void> {
  const u = await getUser(deps.db, from.id);
  if (!u || u.state !== "active") {
    await send(translatorForUser(u)("errors.notOnboarded"));
    return;
  }
  const prof = settingsProfile(u, deps.config);
  const v = settingsRoot(prof, translatorFor(prof.lang));
  await send(v.text, v.buttons);
}

/** The profile the settings machine renders: reply_format resolved to the EFFECTIVE value
 * (user choice, else instance default) — replyFormatFor is the ONE resolution implementation,
 * and the machine's SettingsProfile parameter type rejects unresolved profiles at compile time. */
function settingsProfile(u: UserRow, config: Config): SettingsProfile {
  const prof = profileOf(u); // once — profileOf is the warning site, don't double it
  return { ...prof, reply_format: replyFormatFor(prof, config) };
}

/** Handles an `st:` callback: persist whatever changed, then rewrite the message in place. */
export async function processSettingsCallback(
  deps: BotDeps,
  from: { id: number },
  data: string,
  edit: Edit,
): Promise<void> {
  const u = await getUser(deps.db, from.id);
  if (!u || u.state !== "active") return; // no row to edit against; stay silent
  const prof = settingsProfile(u, deps.config);
  const v = settingsStep(prof, data, translatorFor(prof.lang));
  if (v.patch) {
    if (v.patch.lang) await setLang(deps.db, from.id, v.patch.lang);
    if (v.patch.goal || v.patch.restrictions) {
      await setProfile(deps.db, from.id, { goal: v.patch.goal, restrictions: v.patch.restrictions });
    }
    if (v.patch.reply_format) await setReplyFormat(deps.db, from.id, v.patch.reply_format);
  }
  await edit(v.text, v.buttons);
}

/** /lang — a picker built from the registry, so a new locale appears with no code change. */
export async function processLangPrompt(
  deps: BotDeps,
  from: { id: number },
  send: Send,
): Promise<void> {
  const t = translatorForUser(await getUser(deps.db, from.id));
  const buttons = (Object.keys(LOCALES) as Lang[]).map((code) => [
    { text: LOCALES[code].nativeName, data: `lang_${code}` },
  ]);
  await send(t("lang.prompt"), buttons);
}

/** Handles a `lang_<code>` callback. An unregistered code is ignored, never stored. */
export async function processLangChoice(
  deps: BotDeps,
  from: { id: number },
  data: string,
  send: Send,
): Promise<void> {
  const code = data.slice("lang_".length);
  if (!isLang(code)) return;
  await setLang(deps.db, from.id, code);
  await send(translatorFor(code)("lang.changed")); // confirm in the language just chosen
}

export async function processPhoto(
  deps: BotDeps,
  from: { id: number },
  photos: Array<() => Promise<Uint8Array>>,
  send: Send,
  meta?: { caption?: string; react?: React; userMessageId?: number; sendRich?: SendRich },
): Promise<void> {
  const { db, provider, config } = deps;
  const u = await getUser(db, from.id);
  if (!u || u.state !== "active") {
    await send(translatorForUser(u)("errors.notOnboarded"));
    return;
  }
  // Instant "seen" signal: the vision call takes seconds and silence reads as broken.
  // Deliberately after the active-state gate (a refusal should not be preceded by a 👀)
  // and before the cap checks — 👀 means "seen", not "will analyze".
  fireReaction(meta?.react, "👀", from.id);
  const prof = profileOf(u);
  const t = translatorFor(prof.lang);
  const date = berlinDate(new Date(), config.tz);
  // Caps meter LLM CALLS, not stored meals — every provider call is billed (a not-food photo
  // or a Q&A costs real money even though no meal row appears), so every call draws one from
  // the same pool. Deliberately a per-call policy, not a token-cost model.
  if ((await llmCallsToday(db, from.id, date)) >= config.perUserDailyPhotoCap) {
    await send(t("errors.dailyCap"));
    return;
  }
  // Global spend bound, checked BEFORE the vision call — the per-user cap bounds one account,
  // but a publicly linked bot has unbounded accounts. A cap enforced after the call would cost
  // exactly as much as no cap at all.
  const cap = await effectiveGlobalCap(db, config);
  if (cap !== null && (await llmCallCountToday(db, date)) >= cap) {
    console.warn(`[eait] global daily cap ${cap} reached`);
    await logEvent(db, from.id, "cap_hit");
    await send(t("errors.globalCap"));
    return;
  }
  // Caption + local clock go into the prompt: both measurably cut estimation error
  // (the caption is user-supplied ground truth; the time implies the meal type).
  const context: MealContext = { caption: meta?.caption, localTime: berlinTime(new Date(), config.tz) };
  let analysis: MealAnalysis;
  try {
    const images: Uint8Array[] = [];
    for (const get of photos) images.push(await get()); // in-memory only; never written to disk
    // Metered only once the bytes are in hand: a Telegram-side download failure costs no
    // provider call and must not burn a cap unit.
    await logLlmCall(db, from.id, date, "photo");
    analysis = await analyzeMeal(images, prof, provider, context);
  } catch (e) {
    console.error(`[eait] analyze failed user=${from.id}: ${describeError(e)}`);
    await send(t("errors.analyzeFailed"));
    return;
  }
  // confidence is logged so a model drifting off the high/medium/low vocabulary is visible —
  // off-vocabulary values silently route to the generic hint, and nothing else would say so.
  console.log(`[eait] photo user=${from.id} isFood=${analysis.isFood} kcal=${analysis.kcal} items=${analysis.items.length} confidence=${analysis.confidence}`);
  if (!analysis.isFood) {
    const sent = await send(t("errors.notFood"));
    // Remember the rejection so a reply to it can be explained instead of guessed at.
    if (sent) deps.rejections?.add(from.id, sent.message_id);
    return;
  }
  const id = crypto.randomUUID();
  // Event-based, not hasMeals: text meals write to `meals` too, so "has any meal" would
  // suppress the funnel event for a user whose first photo follows a text meal.
  const firstPhoto = !(await hasEvent(db, from.id, "first_photo"));
  await insertMeal(db, {
    id, user_id: from.id, ts: new Date().toISOString(), date, analysis, model: config.llmModel,
    user_message_id: meta?.userMessageId ?? null,
  });
  if (firstPhoto) await logEvent(db, from.id, "first_photo");
  console.log(`[eait] meal stored ${id} user=${from.id}`);
  const totals = await dailyTotals(db, from.id, date);
  // When the model itself flags the estimate as shaky, ask for the strongest correction the
  // literature knows — a user-supplied weight — instead of the generic hint. The schema already
  // normalizes casing; prefix-match so a qualifier ("low (mixed dish)") can't turn the nudge off.
  const hint = analysis.confidence.startsWith("low")
    ? t("meal.lowConfidenceHint")
    : t("meal.correctionHint");
  const sent = await sendCard(replyFormatFor(prof, config), send, meta?.sendRich, {
    html: renderMealCard(analysis, totals, targetsFor(prof), t, { footer: hint }),
    plain: formatReply(analysis, totals, targetsFor(prof), t) + "\n\n" + hint,
  });
  if (sent) await setMealReply(db, id, from.id, sent.chat_id, sent.message_id);
  // Processed successfully — the 👍 replaces the 👀 on the user's photo.
  fireReaction(meta?.react, "👍", from.id);
}

/**
 * Telegram's Bot API refuses to serve a file over 20MB, and an uncompressed camera photo can
 * exceed that. Checked before the download so the user gets a reason instead of silence.
 */
const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

/**
 * A photo sent as a file ("send without compression", or dragged in on desktop) arrives as a
 * document, not a photo — Telegram does not convert it. Without this it matched no handler at
 * all and the user got no reply, which reads as the bot being broken.
 *
 * Only `image/*` is accepted: an unannounced mime type is refused rather than guessed, because
 * every analysis is a billed vision call and a PDF would burn one to be told it isn't food.
 */
export async function processDocument(
  deps: BotDeps,
  from: { id: number },
  doc: { mime_type?: string; file_size?: number },
  getBytes: () => Promise<Uint8Array>,
  send: Send,
  meta?: { caption?: string; react?: React; userMessageId?: number; sendRich?: SendRich },
): Promise<void> {
  const t = translatorForUser(await getUser(deps.db, from.id));
  if (!doc.mime_type?.startsWith("image/")) {
    await send(t("errors.notAnImage"));
    return;
  }
  if ((doc.file_size ?? 0) > MAX_DOCUMENT_BYTES) {
    await send(t("errors.fileTooBig"));
    return;
  }
  await processPhoto(deps, from, [getBytes], send, meta);
}

/** Stale pending text meals are swept lazily on the next pending insert; a tap on an older
 * confirm prompt is refused. 48 h. */
const PENDING_TTL_MS = 48 * 3_600_000;

/**
 * The free-text router (spec 2026-07-22-free-text-handling-design): every plain text from an
 * ACTIVE user goes through one LLM call that decides question / meal / correction. Returns
 * false only for non-active users, whose text still belongs to onboarding.
 *
 * Precedence inside: reply-to-rejection (canned, no LLM) > caps > one router call — a reply
 * that maps to a meal doesn't short-circuit, it becomes the call's focus-meal context.
 */
export async function processText(
  deps: BotDeps,
  from: { id: number },
  msg: { text: string; messageId: number; replyTo?: number },
  send: Send,
  opts?: { react?: React; sendRich?: SendRich },
): Promise<boolean> {
  const { db, provider, config } = deps;
  const u = await getUser(db, from.id);
  if (!u || u.state !== "active") return false; // onboarding owns non-active text

  const prof = profileOf(u);
  const t = translatorFor(prof.lang);

  // A reply to a known "not food" message: explain deterministically — there is nothing stored
  // about that photo (ephemeral), so no LLM call could say more.
  if (msg.replyTo !== undefined && deps.rejections?.has(from.id, msg.replyTo)) {
    await send(t("errors.rejectionExplain"));
    return true;
  }
  const focus = msg.replyTo !== undefined ? await mealByReply(db, from.id, msg.replyTo) : undefined;

  // 👀 before the cap checks, mirroring the photo path — "seen", not "will analyze".
  fireReaction(opts?.react, "👀", from.id);

  // Text calls draw from the same LLM-call pool as photo analyses — every provider call is
  // billed, so every call draws one. A per-call policy, not a token-cost model.
  const date = berlinDate(new Date(), config.tz);
  if ((await llmCallsToday(db, from.id, date)) >= config.perUserDailyPhotoCap) {
    await send(t("errors.dailyCap"));
    return true;
  }
  const cap = await effectiveGlobalCap(db, config);
  if (cap !== null && (await llmCallCountToday(db, date)) >= cap) {
    console.warn(`[eait] global daily cap ${cap} reached`);
    await logEvent(db, from.id, "cap_hit");
    await send(t("errors.globalCap"));
    return true;
  }

  const todayMeals = (await mealsOnDate(db, from.id, date)).map((m) => ({
    items: m.items, kcal: m.kcal, protein_g: m.protein_g,
  }));
  const weekStart = berlinDate(new Date(Date.now() - 7 * 86_400_000), config.tz);
  const routeCtx: RouteContext = {
    focusMeal: focus ? mealToAnalysis(focus) : undefined,
    todayMeals,
    weekTotals: await totalsByDate(db, from.id, weekStart, date),
    targets: targetsFor(prof),
    localTime: berlinTime(new Date(), config.tz),
  };
  await logLlmCall(db, from.id, date, "router");
  let route: RouteResult;
  try {
    route = await routeText(msg.text, prof, routeCtx, provider);
  } catch (e) {
    // Log like processPhoto does — otherwise a model outage and a parse bug look identical
    // from the operator's side: the user gets a message, the logs get nothing.
    console.error(`[eait] route failed user=${from.id}: ${describeError(e)}`);
    await send(t("errors.textFailed"));
    return true; // handled, but not processed — the 👀 stays, no 👍
  }

  if (route.intent === "question") {
    await send(route.answer);
    fireReaction(opts?.react, "👍", from.id);
    return true;
  }

  if (route.intent === "correction") {
    // routeText guarantees a correction only arrives with a focus meal; a missing one here is
    // a programming error — make it loud, never silently re-route a correction into a NEW meal.
    if (!focus) {
      console.error(`[eait] correction intent without focus row user=${from.id} — should be unreachable`);
      await send(t("errors.textFailed"));
      return true;
    }
    // The meal can vanish between lookup and update (/delete race, second instance) — a 0-row
    // update must not be confirmed to the user as applied.
    if (!(await applyCorrection(db, focus.id, from.id, route.analysis))) {
      await send(t("errors.correctionFailed"));
      return true;
    }
    const totals = await dailyTotals(db, from.id, focus.date);
    // Deliberately no hint suffix — the user just corrected; re-prompting would nag.
    // No footer on either rendering — the deliberate no-nag decision holds in both formats.
    await sendCard(replyFormatFor(prof, config), send, opts?.sendRich, {
      html: renderMealCard(route.analysis, totals, targetsFor(prof), t, { prefix: t("meal.updatedPrefix") }),
      plain: t("meal.updatedPrefix") + "\n" + formatReply(route.analysis, totals, targetsFor(prof), t),
    });
    fireReaction(opts?.react, "👍", from.id);
    return true;
  }

  // meal → confirm before logging: unlike a photo, free text is easy to misread as a meal,
  // so nothing is stored until the tap.
  const id = crypto.randomUUID();
  // Housekeeping must never cost the user their (already-metered) meal — sweep failures are
  // logged and skipped; the next insert retries anyway.
  try {
    await prunePendingMeals(db, new Date(Date.now() - PENDING_TTL_MS).toISOString());
  } catch (e) {
    console.warn(`[eait] pending sweep failed: ${describeError(e)}`);
  }
  await insertPendingMeal(db, {
    id, user_id: from.id, ts: new Date().toISOString(), date,
    analysis: route.analysis, model: config.llmModel,
    user_message_id: msg.messageId,
  });
  const totals = await dailyTotals(db, from.id, date);
  const preview =
    t("text.confirmPrompt") + "\n" + formatReply(route.analysis, totals, targetsFor(prof), t);
  const sent = await send(preview, [[
    { text: t("text.logButton"), data: `tm:log:${id}` },
    { text: t("text.cancelButton"), data: `tm:cancel:${id}` },
  ]]);
  if (sent) await setPendingReply(db, id, from.id, sent.chat_id, sent.message_id);
  fireReaction(opts?.react, "👍", from.id);
  return true;
}

/**
 * Rich Messages (Bot API 10.1). A failed rich send falls back to the plain rendering —
 * formatting must never cost the user their reply. The fallback is guarded too: if BOTH sends
 * fail, that is loudly logged and `undefined` is returned rather than thrown, because callers
 * may already have committed state (a logged meal) that a throw would hide behind "expired".
 * Module-level (not a createBot closure) so the failure ladder is unit-testable with a fake ctx.
 */
export const makeSendRich = (ctx: any): SendRich => async ({ html, plain }) => {
  try {
    const m = await ctx.api.sendRichMessage(ctx.chat.id, { html });
    return { chat_id: m.chat.id, message_id: m.message_id };
  } catch (e) {
    // chat id included: with per-user formats, "I chose rich and nothing changed" is only
    // diagnosable if the operator can correlate these lines to the complaining user.
    console.warn(`[eait] rich send failed chat=${ctx.chat?.id}, falling back to plain: ${describeError(e)}`);
  }
  try {
    const m = await ctx.reply(plain);
    return { chat_id: m.chat.id, message_id: m.message_id };
  } catch (e) {
    console.error(`[eait] BOTH rich and plain send failed chat=${ctx.chat?.id}: ${describeError(e)}`);
    return undefined;
  }
};

/** Handles the tm:log / tm:cancel taps on a text-meal confirm prompt. */
export async function processTextMealDecision(
  deps: BotDeps,
  from: { id: number },
  data: string,
  send: Send,
  opts?: { sendRich?: SendRich },
): Promise<void> {
  const { db } = deps;
  const u = await getUser(db, from.id);
  const t = translatorForUser(u);
  const m = /^tm:(log|cancel):(.+)$/.exec(data);
  if (!m) return;
  const [, action, id] = m;
  // User-scoped read: a forwarded/foreign tap sees nothing and gets the neutral "expired".
  const pending = await getPendingMeal(db, id!, from.id);
  if (!pending) {
    await send(t("text.pendingGone"));
    return;
  }
  // The lazy sweep only runs on inserts, so a confirm prompt can outlive the TTL on screen —
  // honor the TTL at tap time too, or "expired" and the actual lifetime disagree.
  if (Date.parse(pending.ts) < Date.now() - PENDING_TTL_MS) {
    await deletePendingMeal(db, id!, from.id);
    await send(t("text.pendingGone"));
    return;
  }
  if (action === "cancel") {
    await deletePendingMeal(db, id!, from.id);
    await send(t("text.cancelled"));
    return;
  }
  // Log: the analysis was already produced (and the LLM call already metered) at router time.
  // Order matters for crash/send-failure safety: insert (idempotent on id) → send the card →
  // only then delete the pending row. A failed send leaves the row re-tappable instead of
  // telling the user "expired" about a meal that WAS logged — the retry converges instead of
  // manufacturing a duplicate via re-sent text.
  await insertMeal(db, {
    id: pending.id, user_id: from.id, ts: pending.ts, date: pending.date,
    analysis: pending.analysis, model: pending.model,
    user_message_id: pending.user_message_id,
  });
  if (u) {
    const prof = profileOf(u);
    const totals = await dailyTotals(db, from.id, pending.date);
    const sent = await sendCard(replyFormatFor(prof, deps.config), send, opts?.sendRich, {
      html: renderMealCard(pending.analysis, totals, targetsFor(prof), t, { footer: t("meal.correctionHint") }),
      plain: formatReply(pending.analysis, totals, targetsFor(prof), t) + "\n\n" + t("meal.correctionHint"),
    });
    if (sent) await setMealReply(db, pending.id, from.id, sent.chat_id, sent.message_id);
  }
  if (!(await deletePendingMeal(db, id!, from.id))) {
    // Somebody else's sweep raced us — harmless (the meal is in), but worth a trace.
    console.warn(`[eait] pending row ${id} vanished before post-log delete user=${from.id}`);
  }
}

export async function meCard(deps: BotDeps, userId: number): Promise<string | null> {
  const u = await getUser(deps.db, userId);
  if (!u || u.state !== "active") return null;
  const prof = profileOf(u);
  const date = berlinDate(new Date(), deps.config.tz);
  const totals = await dailyTotals(deps.db, userId, date);
  const targets = targetsFor(prof);
  const t = translatorFor(prof.lang);
  return (
    t("me.profileLine", {
      goal: t(`me.goal.${u.goal ?? "maintain"}`),
      // Weight is shown so a misparsed onboarding answer stays visible and correctable —
      // the value silently driving the protein target must never be invisible.
      weight: prof.weight_kg ? t("me.weightValue", { kg: prof.weight_kg }) : t("me.noWeight"),
      // Tags are storage identifiers, not copy — render their localized names. Membership is
      // checked explicitly rather than leaning on i18next's defaultValue, which does not
      // suppress the strict missing-key handler. A tag from an older build shows as itself.
      restrictions: prof.restrictions.length
        ? prof.restrictions
            .map((tag) => (isRestrictionTag(tag) ? t(`me.restriction.${tag}`) : tag))
            .join(", ")
        : t("me.noRestrictions"),
    }) +
    "\n" +
    t("me.todayLine", {
      kcal: Math.round(totals.kcal),
      kcalTarget: targets.kcal,
      protein: Math.round(totals.protein_g),
      proteinTarget: targets.protein_g,
    })
  );
}

/**
 * The language to render /stats in. The admin may never have run /start (nothing requires them
 * to onboard before running an admin command), so there is no row to read a language from —
 * fall back to the default rather than dereferencing an absent user.
 */
export async function adminLangFor(
  deps: BotDeps,
  userId: number,
  languageCode?: string | null,
): Promise<Lang> {
  const u = await getUser(deps.db, userId);
  // No row: fall back to their Telegram client language rather than the default, matching
  // how /help treats a pre-onboarding user.
  return u ? profileOf(u).lang : resolveLang(languageCode);
}

/** Admin-only. Takes an explicit lang because it is rendered for whoever ran /stats. */
export async function statsCard(deps: BotDeps, lang: Lang): Promise<string> {
  const t = translatorFor(lang);
  return t("stats.card", {
    users: t("stats.users", { count: await userCount(deps.db) }),
    meals: t("stats.meals", { count: await mealCount(deps.db) }),
  });
}

// ---------- album flush (exported for tests) ----------

/** One photo part arriving as part of a Telegram media group (album). */
export interface PendingAlbumPart {
  getBytes: () => Promise<Uint8Array>;
  caption?: string;
  messageId: number;
  send: Send;
  sendRich: SendRich;
  react: React;
  from: { id: number };
}

/**
 * Flush a buffered album: all parts share one media_group_id and belong to one meal.
 * Runs outside every grammy handler (the AlbumBuffer fires on a timer), so bot.catch
 * can never intercept errors here — failure must be caught and reported inline.
 */
export async function processAlbum(
  deps: BotDeps,
  key: string,
  parts: PendingAlbumPart[],
): Promise<void> {
  const first = parts[0];
  const caption = parts.find((p) => p.caption)?.caption;
  try {
    await processPhoto(deps, first.from, parts.map((p) => p.getBytes), first.send, {
      caption,
      react: first.react,
      userMessageId: first.messageId,
      sendRich: first.sendRich,
    });
  } catch (e) {
    // Without this, an album failure is a permanent 👀 and eternal silence at the user.
    console.error(`[eait] album flush failed key=${key}: ${describeError(e)}`);
    try {
      const u = await getUser(deps.db, first.from.id);
      await first.send(translatorForUser(u)("errors.analyzeFailed"));
    } catch {
      // the AlbumBuffer's own catch is the last line; nothing more to do
    }
  }
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
  // Rejection tracking is per-process state; default it here so the live bot always has one.
  deps.rejections ??= new RejectionLog();
  const bot = new Bot(config.telegramBotToken);

  // Access control — first, ahead of the dedupe table, so a stranger's update never writes a
  // row or costs a vision call. Dropped silently: replying would confirm the bot exists and
  // hand a stranger something to poke at. The runtime allowlist (deps.allowlist) is a sync
  // in-memory check, so this stays query-free on the hot path.
  bot.use(async (ctx, next) => {
    const admitted = deps.allowlist ? deps.allowlist.has(ctx.from?.id) : isAllowed(config, ctx.from?.id);
    if (!admitted) {
      console.warn(`[eait] blocked update from user=${ctx.from?.id ?? "unknown"}`);
      return;
    }
    await next();
  });

  // update_id dedupe (crash-redelivery safety)
  bot.use(async (ctx, next) => {
    const uid = ctx.update.update_id;
    if (await seenUpdate(db, uid)) return;
    await markUpdate(db, uid);
    await next();
  });
  // one user's slow vision call must not block others
  bot.use(sequentialize((ctx) => String(ctx.from?.id ?? "")));

  const sendVia = (ctx: any): Send => async (text, buttons) => {
    const m = await ctx.reply(text, buttons ? { reply_markup: toKeyboard(buttons) } : undefined);
    return { chat_id: m.chat.id, message_id: m.message_id };
  };

  const sendRichVia = (ctx: any): SendRich => makeSendRich(ctx);

  const editVia = (ctx: any): Edit => async (text, buttons) => {
    try {
      await ctx.editMessageText(text, buttons ? { reply_markup: toKeyboard(buttons) } : undefined);
    } catch (e) {
      // Telegram rejects an edit whose result is byte-identical, which a stale keyboard can
      // produce. That is a no-op, not a failure. Anything else still propagates to bot.catch.
      const desc = String((e as any)?.description ?? "");
      if (!desc.includes("message is not modified")) throw e;
    }
  };

  /** The translator for whoever sent this update. */
  const tFor = async (ctx: any): Promise<TFunction> =>
    translatorForUser(ctx.from ? await getUser(db, ctx.from.id) : undefined);

  bot.command("start", async (ctx) => {
    // `ctx.match` is the deep-link payload (`t.me/<bot>?start=<code>`) — the attribution code.
    if (ctx.from) await processOnboarding(deps, ctx.from, { type: "command", command: "start", payload: String(ctx.match ?? "") }, sendVia(ctx));
  });
  bot.command("me", async (ctx) => {
    const card = ctx.from ? await meCard(deps, ctx.from.id) : null;
    await ctx.reply(card ?? (await tFor(ctx))("errors.notOnboarded"));
  });
  bot.command("settings", async (ctx) => {
    if (ctx.from) await processSettingsOpen(deps, ctx.from, sendVia(ctx));
  });
  bot.command("help", async (ctx) => {
    if (ctx.from) await ctx.reply(await helpText(deps, ctx.from));
  });
  bot.command("waitlist", async (ctx) => {
    if (ctx.from) await processWaitlist(deps, ctx.from, sendVia(ctx));
  });
  // Retained alias, deliberately absent from the / menu: /settings is the documented route.
  bot.command("lang", async (ctx) => {
    if (ctx.from) await processLangPrompt(deps, ctx.from, sendVia(ctx));
  });
  bot.command("delete", async (ctx) => {
    const t = await tFor(ctx);
    await ctx.reply(t("delete.prompt"), {
      reply_markup: new InlineKeyboard()
        .text(t("delete.button.confirm"), "delete_confirm")
        .text(t("delete.button.cancel"), "delete_cancel"),
    });
  });
  bot.command("stats", async (ctx) => {
    if (!ctx.from || config.adminUserId === null || config.adminUserId !== ctx.from.id) {
      await ctx.reply((await tFor(ctx))("errors.adminOnly"));
      return;
    }
    await ctx.reply(await statsCard(deps, await adminLangFor(deps, ctx.from.id, ctx.from.language_code)));
  });
  // The admin gate lives inside processCap (unlike /stats above), so this stays a two-line
  // adapter per this folder's rule. `ctx.match` is the text after the command.
  bot.command("cap", async (ctx) => {
    if (ctx.from) await processCap(deps, ctx.from, String(ctx.match ?? ""), sendVia(ctx));
  });
  bot.command("allow", async (ctx) => {
    if (ctx.from) await processAllow(deps, ctx.from, String(ctx.match ?? ""), sendVia(ctx));
  });
  bot.command("deny", async (ctx) => {
    if (ctx.from) await processDeny(deps, ctx.from, String(ctx.match ?? ""), sendVia(ctx));
  });
  bot.command("allowed", async (ctx) => {
    if (ctx.from) await processAllowed(deps, ctx.from, sendVia(ctx));
  });

  bot.on("callback_query:data", async (ctx) => {
    // Guarded: a stale query id (backlog replay after downtime) must not abort the tap —
    // dismissing the spinner is cosmetic; the state change behind the tap is not.
    await ctx.answerCallbackQuery().catch((e) => {
      console.warn(`[eait] answerCallbackQuery failed user=${ctx.from?.id} data=${ctx.callbackQuery.data}: ${describeError(e)}`);
    });
    if (!ctx.from) return;
    const data = ctx.callbackQuery.data;
    if (data === "delete_confirm") {
      const t = await tFor(ctx); // read the language BEFORE the row is deleted
      await deleteUser(db, ctx.from.id);
      // In-memory state too: the erasure promise is total, and a stale rejection entry would
      // leak a pre-delete interaction into the user's next life.
      deps.rejections?.remove(ctx.from.id);
      await ctx.reply(t("delete.done"));
      return;
    }
    if (data === "delete_cancel") {
      await ctx.reply((await tFor(ctx))("delete.cancelled"));
      return;
    }
    if (data.startsWith("tm:")) {
      await processTextMealDecision(deps, ctx.from, data, sendVia(ctx), { sendRich: sendRichVia(ctx) });
      return;
    }
    if (data.startsWith("st:")) {
      await processSettingsCallback(deps, ctx.from, data, editVia(ctx));
      return;
    }
    if (data.startsWith("lang_")) {
      await processLangChoice(deps, ctx.from, data, sendVia(ctx));
      return;
    }
    await processOnboarding(deps, ctx.from, { type: "callback", data }, sendVia(ctx));
  });

  /** Downloads a Telegram file by id. Shared by the photo and document handlers. */
  const fetchFile = (ctx: any, fileId: string) => async (): Promise<Uint8Array> => {
    const file = await ctx.api.getFile(fileId);
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
    // Time-box the download: sequentialize() is per-user, so a hung fetch would stall
    // everything else that user sends until the process restarts.
    const res = await fetch(url, { signal: AbortSignal.timeout(config.llmTimeoutMs) });
    // Without this, a non-2xx body (an expired file_path returns a JSON error) would be
    // base64'd and sent to the model as if it were a photo, and the user would be told
    // their meal "isn't food" — a download failure reported as a wrong diagnosis.
    // The status is thrown, never the URL: that carries the bot token.
    if (!res.ok) throw new Error(`telegram file download failed: ${res.status}`);
    return new Uint8Array(await res.arrayBuffer());
  };

  /** Reaction lifecycle on the user's own message: 👀 = accepted, 👍 = processed. */
  const reactVia = (ctx: any): React => (emoji) => ctx.react(emoji);

  // An album (media group) arrives as N separate photo updates sharing media_group_id.
  // Parts are buffered per (user, group) and flushed as ONE analysis after a quiet period —
  // otherwise a portion photo and its label photo get analyzed as two unrelated meals.
  const ALBUM_FLUSH_MS = 1500;
  const albums = new AlbumBuffer<PendingAlbumPart>(ALBUM_FLUSH_MS, (key, parts) =>
    processAlbum(deps, key, parts),
  );

  bot.on("message:photo", async (ctx) => {
    if (!ctx.from) return;
    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1]; // largest PhotoSize
    const part: PendingAlbumPart = {
      getBytes: fetchFile(ctx, largest.file_id),
      caption: ctx.message.caption,
      messageId: ctx.message.message_id,
      send: sendVia(ctx),
      sendRich: sendRichVia(ctx),
      react: reactVia(ctx),
      from: { id: ctx.from.id },
    };
    if (ctx.message.media_group_id) {
      albums.add(`${ctx.from.id}:${ctx.message.media_group_id}`, part);
      return; // the whole group flushes as one analysis
    }
    await processPhoto(deps, ctx.from, [part.getBytes], part.send, {
      caption: part.caption,
      react: part.react,
      userMessageId: part.messageId,
      sendRich: part.sendRich,
    });
  });

  // A meal photo sent uncompressed ("send as file") arrives here, not as a photo.
  bot.on("message:document", async (ctx) => {
    if (!ctx.from) return;
    const doc = ctx.message.document;
    await processDocument(deps, ctx.from, doc, fetchFile(ctx, doc.file_id), sendVia(ctx), {
      caption: ctx.message.caption,
      react: reactVia(ctx),
      userMessageId: ctx.message.message_id,
      sendRich: sendRichVia(ctx),
    });
  });

  bot.on("message:text", async (ctx) => {
    if (!ctx.from) return;
    const handled = await processText(deps, ctx.from, {
      text: ctx.message.text,
      messageId: ctx.message.message_id,
      replyTo: ctx.message.reply_to_message?.message_id,
    }, sendVia(ctx), { react: reactVia(ctx), sendRich: sendRichVia(ctx) });
    if (!handled) {
      await processOnboarding(deps, ctx.from, { type: "text", text: ctx.message.text }, sendVia(ctx));
    }
  });

  // Handler-level errors (a failed reply, a bad update) must never crash the process.
  bot.catch((err) => {
    // With user + update ids: "user X says the bot ignored them" must be greppable. And the
    // user hears SOMETHING — total silence after an unexpected throw reads as a broken bot.
    const ctx = (err as any)?.ctx;
    console.error(
      `[eait] handler error user=${ctx?.from?.id ?? "?"} update=${ctx?.update?.update_id ?? "?"}: ${describeError((err as any)?.error ?? err)}`,
    );
    void (async () => {
      const u = ctx?.from?.id ? await getUser(db, ctx.from.id) : undefined;
      await ctx?.reply?.(translatorForUser(u)("errors.textFailed"));
    })().catch(() => {}); // best-effort only — a failed apology must not recurse
  });

  return bot;
}

export interface CommandRegistration {
  commands: Array<{ command: string; description: string }>;
  options: { language_code: Lang; scope?: { type: "chat"; chat_id: number } };
}

/**
 * What to publish to Telegram, as data — pure, so the plan is testable without a live token.
 *
 * One registration per locale for the default scope; Telegram then matches each user's client
 * language itself, with no per-user call. The admin gets the same treatment plus /stats.
 *
 * The admin MUST be registered in every locale too. Chat scope outranks default scope, so a
 * single-language admin registration would silently replace their localized menu.
 */
export function commandRegistrations(config: Config): CommandRegistration[] {
  const plan: CommandRegistration[] = [];
  for (const lang of LANGS) {
    const t = translatorFor(lang);
    plan.push({ commands: buildCommands(t), options: { language_code: lang } });
    if (config.adminUserId !== null) {
      plan.push({
        commands: [
          ...buildCommands(t),
          { command: "stats", description: t("commands.stats") },
          { command: "cap", description: t("commands.cap") },
          { command: "allow", description: t("commands.allow") },
          { command: "deny", description: t("commands.deny") },
          { command: "allowed", description: t("commands.allowed") },
        ],
        options: { language_code: lang, scope: { type: "chat", chat_id: config.adminUserId } },
      });
    }
  }
  return plan;
}

/**
 * Publishes the `/` menu. Never throws: a stale menu is cosmetic, a bot that will not boot
 * is not.
 */
export async function registerCommands(bot: Bot, config: Config): Promise<void> {
  try {
    for (const { commands, options } of commandRegistrations(config)) {
      await bot.api.setMyCommands(commands, options);
    }
    console.log(`[eait] commands registered for ${LANGS.join(", ")}`);
  } catch (e) {
    console.error(`[eait] command registration failed (menu will be stale): ${(e as any)?.message}`);
  }
}

/**
 * Telegram error codes that mean "this will never work", as opposed to the 409 poller hand-off
 * and the network blips the supervisor exists to ride out. 401 is a revoked or wrong token;
 * 404 is what the API returns for a token that was never valid.
 */
const FATAL_TELEGRAM_CODES = new Set([401, 404]);

export function isFatalTelegramError(err: unknown): boolean {
  const code = (err as { error_code?: unknown })?.error_code;
  return typeof code === "number" && FATAL_TELEGRAM_CODES.has(code);
}

/** grammy puts the useful text in `description` but drops `error_code` — "Not Found" alone is
 *  weak signal for "your bot token is wrong", so keep both. */
export function describeError(err: unknown): string {
  const e = err as { error_code?: unknown; description?: unknown } | undefined;
  if (e?.description) {
    return e.error_code === undefined ? String(e.description) : `${e.error_code} ${e.description}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export async function startBot(config: Config): Promise<{ db: Db; stop: () => Promise<void> }> {
  // Validate config before touching the network: createProvider throws on an unknown
  // LLM_PROVIDER, and doing it first means that failure can't strand an open connection pool.
  const provider = createProvider(config);
  const db = await openDb(config.pg);
  let bot: Bot;
  try {
    const allowlist = await loadAllowlist(db, config);
    bot = createBot({ db, provider, config, allowlist });
    // Report the EFFECTIVE list (stored beats env), not the env value — after an admin
    // /allow, the two differ and the env line would lie.
    const effective = allowlist.list();
    if (effective === null) {
      console.warn(
        "[eait] WARNING: the bot is OPEN — anyone who finds it can use it and spend your " +
          "OpenRouter budget. Set ALLOWED_USER_IDS in .env, or have the admin send /allow <id>.",
      );
    } else {
      console.log(`[eait] allowlist active: ${effective.length} user(s)`);
    }
  } catch (e) {
    await db.close(); // `new Bot(token)` rejects a malformed token — don't strand the pool we just opened
    throw e;
  }
  void registerCommands(bot, config); // fire-and-forget: must not delay polling

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
        // A wrong or revoked token is not transient: retrying it every 15s forever looks
        // identical to a network blip in the log, so say what it is and stop.
        if (isFatalTelegramError(err)) {
          console.error(`[eait] fatal Telegram error, not retrying: ${describeError(err)}`);
          console.error("[eait] check TELEGRAM_BOT_TOKEN — the bot cannot authenticate.");
          stopping = true;
          await db.close();
          process.exitCode = 1;
          break;
        }
        console.error(`[eait] runner error, retry in 15s: ${describeError(err)}`);
        await new Promise((r) => setTimeout(r, 15000));
        if (stopping) break;
        handle = run(bot);
      }
    }
  };
  // The recovery path itself must not become an unhandled rejection — `void supervise()` would
  // otherwise let a throw from `run(bot)` escape with nothing to catch it.
  void supervise().catch((err) => {
    console.error(`[eait] supervisor failed: ${describeError(err)}`);
    process.exitCode = 1;
  });

  const stop = async () => {
    stopping = true;
    try {
      if (handle.isRunning()) await handle.stop();
    } finally {
      await db.close(); // must run even if stopping the runner rejects, or the pool leaks
    }
  };
  process.once("SIGTERM", stop);
  process.once("SIGINT", stop);
  return { db, stop };
}
