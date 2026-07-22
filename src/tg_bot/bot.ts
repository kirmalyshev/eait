// Telegram glue. The grammy handlers are thin adapters over the exported `process*` functions,
// which hold the real logic and are unit-tested without grammy (a fake `send` + temp db + fake
// provider). Routing precedence (spec §18): command > reply-to-meal (correction) > onboarding text
// > nudge. Concurrency via @grammyjs/runner + sequentialize(by user); update_id dedupe; images
// are in-memory only (never written to disk — ephemeral by construction).

import { Bot, InlineKeyboard } from "grammy";
import { run, sequentialize } from "@grammyjs/runner";
import type { Config } from "../config.ts";
import type { LLMProvider } from "../llm/provider.ts";
import { createProvider } from "../llm/factory.ts";
import {
  openDb, berlinDate, berlinTime, upsertUser, getUser, setConsent, setProfile, setUserState,
  insertMeal, setMealReply, applyCorrection, mealByReply, dailyTotals, countMealsToday,
  deleteUser, userCount, mealCount, mealCountToday, seenUpdate, markUpdate, setLang,
  getSetting, setSetting, clearSetting, hasMeals, hasEvent, logEvent, setAcquisitionSource,
  type Db, type UserRow,
} from "../db.ts";
import { loadAllowlist, type Allowlist } from "../allowlist.ts";
import { analyzeMeal, analyzeCorrection, classifyRestrictions } from "../analyzer.ts";
import { targetsFor, isRestrictionTag } from "../targets.ts";
import { formatReply } from "../reply.ts";
import { settingsRoot, settingsStep } from "../settings.ts";
import { step, type OnboardingInput, type OnboardingResult, type InlineButton } from "../onboarding.ts";
import { DEFAULT_LANG, LANGS, LOCALES, isLang, resolveLang, translatorFor } from "../i18n/index.ts";
import type { TFunction } from "i18next";
import type { Lang, MealAnalysis, MealContext, MealRecord, Profile } from "../types.ts";

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
}

export interface Sent {
  chat_id: number;
  message_id: number;
}
/** How the process* functions emit to the user. Returns the sent message ids (for reply-routing). */
export type Send = (text: string, buttons?: InlineButton[][]) => Promise<Sent | void>;

/**
 * Rewrites the message a callback came from. Settings needs this: four restriction toggles
 * would otherwise produce four chat messages.
 */
export type Edit = (text: string, buttons?: InlineButton[][]) => Promise<void>;

// ---------- pure helpers ----------

export function profileOf(u: UserRow): Profile {
  return {
    telegram_id: u.telegram_id,
    // Validate against the registry rather than coercing: a stored value can predate a locale
    // being renamed or removed, and an unvalidated one would render raw keys at the user.
    lang: isLang(u.lang) ? u.lang : DEFAULT_LANG,
    goal: u.goal,
    // 0 is the db's "explicitly skipped" sentinel — outside the db/bot boundary it means unknown.
    weight_kg: u.weight_kg ? u.weight_kg : null,
    restrictions: u.restrictions,
  };
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
        used: await mealCountToday(db, date),
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
  const prof = profileOf(u);
  const v = settingsRoot(prof, translatorFor(prof.lang));
  await send(v.text, v.buttons);
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
  const prof = profileOf(u);
  const v = settingsStep(prof, data, translatorFor(prof.lang));
  if (v.patch) {
    if (v.patch.lang) await setLang(deps.db, from.id, v.patch.lang);
    if (v.patch.goal || v.patch.restrictions) {
      await setProfile(deps.db, from.id, { goal: v.patch.goal, restrictions: v.patch.restrictions });
    }
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
  getBytes: () => Promise<Uint8Array>,
  send: Send,
  meta?: { caption?: string; ack?: () => Promise<void> },
): Promise<void> {
  const { db, provider, config } = deps;
  const u = await getUser(db, from.id);
  if (!u || u.state !== "active") {
    await send(translatorForUser(u)("errors.notOnboarded"));
    return;
  }
  // Instant "seen" signal (a 👀 reaction from the handler): the vision call takes seconds and
  // silence reads as broken. Deliberately after the active-state gate (a refusal should not be
  // preceded by a 👀) and before the cap checks. Promise.resolve wrapping makes even a
  // SYNCHRONOUSLY throwing thunk harmless, and failures are logged — a Telegram-side reaction
  // rejection must be visible to the operator, never a silent permanent degradation.
  void Promise.resolve()
    .then(() => meta?.ack?.())
    .catch((e) => console.warn(`[eait] ack failed user=${from.id}: ${describeError(e)}`));
  const prof = profileOf(u);
  const t = translatorFor(prof.lang);
  const date = berlinDate(new Date(), config.tz);
  if ((await countMealsToday(db, from.id, date)) >= config.perUserDailyPhotoCap) {
    await send(t("errors.dailyCap"));
    return;
  }
  // Global spend bound, checked BEFORE the vision call — the per-user cap bounds one account,
  // but a publicly linked bot has unbounded accounts. A cap enforced after the call would cost
  // exactly as much as no cap at all.
  const cap = await effectiveGlobalCap(db, config);
  if (cap !== null && (await mealCountToday(db, date)) >= cap) {
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
    const bytes = await getBytes(); // in-memory only; never written to disk
    analysis = await analyzeMeal(bytes, prof, provider, context);
  } catch (e) {
    console.error(`[eait] analyze failed user=${from.id}: ${(e as any)?.message}`);
    await send(t("errors.analyzeFailed"));
    return;
  }
  // confidence is logged so a model drifting off the high/medium/low vocabulary is visible —
  // off-vocabulary values silently route to the generic hint, and nothing else would say so.
  console.log(`[eait] photo user=${from.id} isFood=${analysis.isFood} kcal=${analysis.kcal} items=${analysis.items.length} confidence=${analysis.confidence}`);
  if (!analysis.isFood) {
    await send(t("errors.notFood"));
    return;
  }
  const id = crypto.randomUUID();
  const firstPhoto = !(await hasMeals(db, from.id)); // read before the insert makes it true forever
  await insertMeal(db, {
    id, user_id: from.id, ts: new Date().toISOString(), date, analysis, model: config.llmModel,
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
  const sent = await send(formatReply(analysis, totals, targetsFor(prof), t) + "\n\n" + hint);
  if (sent) await setMealReply(db, id, from.id, sent.chat_id, sent.message_id);
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
  meta?: { caption?: string; ack?: () => Promise<void> },
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
  await processPhoto(deps, from, getBytes, send, meta);
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
  const meal = await mealByReply(db, from.id, replyToMessageId);
  if (!meal) return false;
  const u = await getUser(db, from.id);
  if (!u) return false;
  const prof = profileOf(u);
  const t = translatorFor(prof.lang);
  let updated: MealAnalysis;
  try {
    updated = await analyzeCorrection(mealToAnalysis(meal), text, prof, provider);
  } catch (e) {
    // Log like processPhoto does — otherwise a model outage and a parse bug look identical
    // from the operator's side: the user gets a message, the logs get nothing.
    console.error(`[eait] correction failed user=${from.id} meal=${meal.id}: ${(e as any)?.message}`);
    await send(t("errors.correctionFailed"));
    return true;
  }
  await applyCorrection(db, meal.id, from.id, updated);
  const totals = await dailyTotals(db, from.id, meal.date);
  await send(t("meal.updatedPrefix") + "\n" + formatReply(updated, totals, targetsFor(prof), t));
  return true;
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
    await ctx.answerCallbackQuery();
    if (!ctx.from) return;
    const data = ctx.callbackQuery.data;
    if (data === "delete_confirm") {
      const t = await tFor(ctx); // read the language BEFORE the row is deleted
      await deleteUser(db, ctx.from.id);
      await ctx.reply(t("delete.done"));
      return;
    }
    if (data === "delete_cancel") {
      await ctx.reply((await tFor(ctx))("delete.cancelled"));
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

  /** The instant "photo received" signal — a 👀 reaction on the user's own message. */
  const ackVia = (ctx: any) => () => ctx.react("👀");

  bot.on("message:photo", async (ctx) => {
    if (!ctx.from) return;
    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1]; // largest PhotoSize
    await processPhoto(deps, ctx.from, fetchFile(ctx, largest.file_id), sendVia(ctx), {
      caption: ctx.message.caption,
      ack: ackVia(ctx),
    });
  });

  // A meal photo sent uncompressed ("send as file") arrives here, not as a photo.
  bot.on("message:document", async (ctx) => {
    if (!ctx.from) return;
    const doc = ctx.message.document;
    await processDocument(deps, ctx.from, doc, fetchFile(ctx, doc.file_id), sendVia(ctx), {
      caption: ctx.message.caption,
      ack: ackVia(ctx),
    });
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
