// Onboarding as an engine flow: read the user, advance the pure state machine, refine the
// restriction tags with the model when the keyword pass found none, persist the patch.
//
// Extracted from `tg_bot/bot.ts`'s `processOnboarding` + `applyOnboarding` +
// `applyRestrictionFallback`. Before the move, the ONLY way to create or advance a user was a
// Telegram update — `api/` could log meals for a user it had no way to bring into existence, which
// made "both front ends are peers" true only for the half of the product that comes after signup.
//
// What did NOT move: locale negotiation (`resolveLang` reads a Telegram `language_code` or an HTTP
// `Accept-Language`; both are protocol details, so the surface resolves one and passes a `Lang`),
// and sending. `step()` itself stays pure and stays where it is.

import {
  berlinDate, getUser, logEvent, logLlmCall, setAcquisitionSource, setConsent, setProfile,
  upsertUser,
} from "../db.ts";
import { step, type OnboardingInput, type OnboardingResult, type Translator } from "../onboarding.ts";
import { DEFAULT_LANG } from "../i18n/registry.ts";
import { profileFromRow } from "./profile.ts";
import type { EngineDeps, UserId } from "./deps.ts";
import type { Lang } from "../types.ts";

/**
 * How the engine gets copy: a factory, not a translator.
 *
 * The engine picks the LANGUAGE (it is profile data, read from the row) and the surface owns
 * CONSTRUCTION (`translatorFor` builds an i18next-backed function, which is exactly what the engine
 * is not allowed to do). Passing a ready-made translator instead would mean resolving it before the
 * row exists, and every user's first screen would render in the default language.
 */
export type TranslatorFactory = (lang: Lang) => Translator;

export interface AdvanceOnboardingInput {
  input: OnboardingInput;
  /** First-contact identity hints. Written on INSERT only, so a later contact never overwrites. */
  username?: string | null;
  /**
   * An ALREADY-RESOLVED language. The engine cannot map a protocol's locale string to a `Lang` —
   * that needs `i18n/index.ts`, which builds an i18next instance — and it should not: which header
   * carries the hint is the surface's business.
   */
  langHint?: Lang | null;
}

/**
 * Telegram deep links (`t.me/<bot>?start=<payload>`) carry at most 64 chars of `A-Za-z0-9_-`.
 * Anything outside that grammar is dropped rather than stored — the payload is an attribution
 * campaign code, not user input. The bare `start` event is still logged so organic arrivals form
 * the no-code baseline. The grammar is enforced here rather than at the surface because every front
 * end that grows a referral link inherits the same column.
 */
const START_PAYLOAD_RE = /^[A-Za-z0-9_-]{1,64}$/;

/**
 * Advance one user through onboarding by one input, and persist the result.
 *
 * Returns the view the caller renders. The caller sends it; this function never does.
 */
export async function advanceOnboarding(
  deps: EngineDeps,
  userId: UserId,
  { input, username, langHint }: AdvanceOnboardingInput,
  translatorFor: TranslatorFactory,
): Promise<OnboardingResult> {
  const { db } = deps;
  // Language is seeded at first contact so the consent screen already arrives localized.
  // `upsertUser` only writes `lang` on INSERT, so a later /start never undoes a /lang change.
  await upsertUser(db, {
    telegram_id: userId,
    username: username ?? null,
    ...(langHint ? { lang: langHint } : {}),
  });
  const u = await getUser(db, userId);
  if (input.type === "command") await recordStart(deps, userId, input.payload);

  // Resolved AFTER the upsert, not before: on first contact the row is created by the line above
  // and its `lang` is the hint the surface just negotiated, so the consent screen arrives localized.
  // Reading a translator before the insert would render every user's first screen in the default.
  const lang = u ? profileFromRow(u).lang : DEFAULT_LANG;
  const t = translatorFor(lang);

  const r = step(
    u
      ? {
          state: u.state,
          goal: u.goal,
          weight_kg: u.weight_kg,
          target_weight_kg: u.target_weight_kg,
          country: u.country,
        }
      : undefined,
    input,
    t,
  );

  await refineRestrictions(deps, userId, lang, input, r);
  await persist(deps, userId, r);
  if (u?.state !== "active" && r.nextState === "active") {
    await logEvent(db, userId, "onboarding_complete");
  }
  return r;
}

/**
 * Persist a step's patch. `consent_at` is separate because `setConsent` owns the `consent_at`
 * column and moves state to `profile` in a single UPDATE of its own.
 */
async function persist(deps: EngineDeps, userId: UserId, r: OnboardingResult): Promise<void> {
  if (r.patch?.consent_at) await setConsent(deps.db, userId, r.patch.consent_at);
  await setProfile(deps.db, userId, {
    goal: r.patch?.goal,
    weight_kg: r.patch?.weight_kg,
    target_weight_kg: r.patch?.target_weight_kg,
    country: r.patch?.country,
    restrictions: r.patch?.restrictions,
    medical_limitations: r.patch?.medical_limitations,
    state: r.nextState,
  });
}

async function recordStart(
  deps: EngineDeps,
  userId: UserId,
  payload: string | undefined,
): Promise<void> {
  const code = payload && START_PAYLOAD_RE.test(payload) ? payload : null;
  if (code) await setAcquisitionSource(deps.db, userId, code); // first-touch: set-once in db layer
  await logEvent(deps.db, userId, "start", code);
}

/**
 * The keyword pass in `targets.ts` only knows the languages someone wrote keywords for, so a German
 * user typing "Nieren, kein Zucker" silently loses their kidney verdict and sodium cap. When it
 * matches nothing, ask the model instead.
 *
 * Kept out of `onboarding.ts` because `step()` is a pure no-I/O state machine and must stay one.
 * Mutates `r.patch` in place before it is persisted.
 */
async function refineRestrictions(
  deps: EngineDeps,
  userId: UserId,
  lang: Lang,
  input: OnboardingInput,
  r: OnboardingResult,
): Promise<void> {
  // Only the free-text restrictions step: a `restrictions_skip` tap also yields [], and an explicit
  // skip must never be second-guessed by the model.
  if (input.type !== "text" || !input.text.trim()) return;
  if (r.patch?.restrictions === undefined || r.patch.restrictions.length > 0) return;

  // This is a REFINEMENT: the deterministic parse (keyword tags + raw limitations) is already in
  // `r.patch` and must persist even if this path fails, so the whole thing is guarded. The LLM
  // classifier itself never throws (it catches internally and returns []), but the metering write
  // `logLlmCall` can — and a throw here would propagate past the caller and skip `persist` entirely,
  // discarding an answer that needed no model. The model may only IMPROVE the tags.
  try {
    // Metered like every other provider call ("every LLM call draws one"), but deliberately NOT
    // cap-gated: refusing an onboarding step over a spend cap would strand the user mid-flow, and
    // this path runs at most once per user.
    await logLlmCall(deps.db, userId, berlinDate(new Date(), deps.config.tz), "classify");
    const tags = await deps.classifyRestrictions(input.text, { telegram_id: userId, lang });
    if (tags.length) r.patch.restrictions = tags;
  } catch (e) {
    // Keep the keyword-only result already in r.patch; the answer (tags + limitations) still saves.
    console.error(
      `[eait] restriction classify/meter failed, keeping keyword parse: ${(e as Error)?.message ?? e}`,
    );
  }
}
