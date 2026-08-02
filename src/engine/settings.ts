// Settings as an engine flow: read the row, run the pure settings machine, persist the patch, and
// arm or clear the text-capture marker.
//
// Extracted from `tg_bot/bot.ts`'s `processSettingsOpen` / `processSettingsCallback` /
// `processSettingsInput` / `applySettingsView` / `settingsProfile`. Before the move, `api/` had
// users it could not configure: no goal, no weight, no locale, no reply format, no food fields.
//
// What did NOT move: editing a Telegram message in place vs sending a new one, and the text
// PRECEDENCE chain (`pending_input` beats the router, but loses to a slash command and to a reply
// that targets a meal) — that is about how a Telegram message arrives, and it stays in the surface.

import { getUser, setLang, setPendingInput, setProfile, setReplyFormat } from "../db.ts";
import {
  isPendingInput, settingsInput, settingsRoot, settingsStep,
  type PendingInput, type SettingsProfile, type SettingsView,
} from "../settings.ts";
import { isLang } from "../i18n/registry.ts";
import { profileFromRow, replyFormatFor } from "./profile.ts";
import type { EngineDeps, UserId } from "./deps.ts";
import type { TranslatorFactory } from "./onboarding.ts";
import type { Lang } from "../types.ts";

/**
 * A view to render, or the one refusal this flow has.
 *
 * `no-prompt` is deliberately distinct from `not-onboarded`: it means the typed text arrived with
 * nothing armed to receive it (or with a DIFFERENT field armed than the caller named), which on
 * Telegram is a race with a button tap and on HTTP is a stale client. Collapsing it into a generic
 * failure would let the surface tell a user their weight did not save when the real answer is that
 * the prompt they answered is no longer the one open.
 */
export type SettingsResult =
  | { kind: "view"; view: SettingsView }
  | { kind: "not-onboarded" }
  | { kind: "no-prompt" };

/** Registering a locale: `ok` with the stored code, or a refusal naming why nothing was written. */
export type SetLanguageResult = { kind: "ok"; lang: Lang } | { kind: "unknown-language" };

/** The full settings summary, and a fresh open cancels any half-finished prompt. */
export async function openSettings(
  deps: EngineDeps,
  userId: UserId,
  translatorFor: TranslatorFactory,
): Promise<SettingsResult> {
  const u = await getUser(deps.db, userId);
  if (!u || u.state !== "active") return { kind: "not-onboarded" };
  // A fresh open cancels any half-finished text prompt from a previous session.
  await setPendingInput(deps.db, userId, null);
  const prof = settingsProfile(u, deps);
  return { kind: "view", view: settingsRoot(prof, translatorFor(prof.lang)) };
}

/** One `st:` action: persist whatever it changed, return the view that follows it. */
export async function applySettingsAction(
  deps: EngineDeps,
  userId: UserId,
  action: string,
  translatorFor: TranslatorFactory,
): Promise<SettingsResult> {
  const u = await getUser(deps.db, userId);
  if (!u || u.state !== "active") return { kind: "not-onboarded" };
  const prof = settingsProfile(u, deps);
  const view = settingsStep(prof, action, translatorFor(prof.lang));
  await persist(deps, userId, view, u.pending_input);
  return { kind: "view", view };
}

/**
 * The user's typed answer to an armed prompt: parse, persist, and disarm — or re-arm on a parse
 * failure so the question stays open rather than silently eating the answer.
 *
 * `field` is what the CALLER believes is armed, and it is checked against the row rather than
 * trusted. Without that check a client racing a button tap would write its text into whichever
 * field happens to be armed now — "88.5" landing in `country` is a real shape of that bug, and the
 * API is where a client can race in the first place.
 */
export async function submitSettingsInput(
  deps: EngineDeps,
  userId: UserId,
  field: PendingInput,
  text: string,
  translatorFor: TranslatorFactory,
): Promise<SettingsResult> {
  const u = await getUser(deps.db, userId);
  if (!u || u.state !== "active") return { kind: "not-onboarded" };
  if (!isPendingInput(u.pending_input) || u.pending_input !== field) return { kind: "no-prompt" };
  const prof = settingsProfile(u, deps);
  const view = settingsInput(field, text, prof, translatorFor(prof.lang));
  await persist(deps, userId, view, u.pending_input);
  return { kind: "view", view };
}

/** `/lang` and its HTTP equivalent. An unregistered code is refused, never stored. */
export async function setUserLanguage(
  deps: EngineDeps,
  userId: UserId,
  code: string,
): Promise<SetLanguageResult> {
  if (!isLang(code)) return { kind: "unknown-language" };
  await setLang(deps.db, userId, code);
  return { kind: "ok", lang: code };
}

/**
 * The profile the settings machine renders against: `reply_format` resolved to the EFFECTIVE value
 * (user choice, else instance default). `replyFormatFor` is the ONE resolution implementation, and
 * `SettingsProfile` rejects an unresolved profile at compile time.
 */
function settingsProfile(u: Parameters<typeof profileFromRow>[0], deps: EngineDeps): SettingsProfile {
  const prof = profileFromRow(u); // once — profileFromRow is the warning site, don't double it
  return { ...prof, reply_format: replyFormatFor(prof, deps.config) };
}

/**
 * Persist a settings patch across the field-specific setters, then arm/clear the text-capture
 * marker. `setProfile` no-ops when its whitelist fields are all undefined, so one call covers every
 * case. `currentPending` is the row's existing marker — the write is skipped when it would not
 * change, so plain picker navigation costs no extra UPDATE.
 */
async function persist(
  deps: EngineDeps,
  userId: UserId,
  v: SettingsView,
  currentPending: string | null,
): Promise<void> {
  if (v.patch) {
    if (v.patch.lang) await setLang(deps.db, userId, v.patch.lang);
    if (v.patch.reply_format) await setReplyFormat(deps.db, userId, v.patch.reply_format);
    await setProfile(deps.db, userId, {
      goal: v.patch.goal,
      restrictions: v.patch.restrictions,
      weight_kg: v.patch.weight_kg,
      target_weight_kg: v.patch.target_weight_kg,
      country: v.patch.country,
      medical_limitations: v.patch.medical_limitations,
      food_allergies: v.patch.food_allergies,
      product_limitations: v.patch.product_limitations,
    });
  }
  // A prompt view arms pending_input; every other view (including a completed edit) clears it, so
  // tapping any button cancels a half-finished text prompt. Only write on an actual change.
  const nextPending = v.awaitInput ?? null;
  if (nextPending !== currentPending) await setPendingInput(deps.db, userId, nextPending);
}
