// The Telegram connector's words, in every language the product speaks.
//
// A SECOND TRANSPORT OVER ONE ENGINE, so it has its own copy for the same reason `PAGE_COPY` and
// `frontend/copy.ts` do: `not-onboarded` is a navigation push in the app, a form on the web and a
// sentence with a link here, and the engine hands all three the same `Refusal` kind. What it must
// NOT have is its own idea of what the engine said — `refusals` is keyed by the kinds
// `REFUSAL_STATUS` defines, and a kind with no sentence falls back to the generic failure.
//
// WHICH LANGUAGE. The account's, once there is one — a Telegram is attached to an eait account made
// elsewhere, and that account has answered the question. Before that there is no account to ask, so
// the one sentence a stranger gets reads their `from.language_code`, which is the only thing
// Telegram tells us that is about them rather than about their message.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE WORDS ARE IN `src/shared/locales/*/messages.po`, not in eight objects below.
//
// `telegramCopyFor(lang)` still returns one `TelegramCopy`, so no caller changed: what moved is
// where the sentences come from. Every id is a LITERAL, because `lingui extract` reads the source
// and an id built at runtime never reaches a translator — the only symptom would be an English
// sentence in a Russian chat.
//
// THE TWO TEMPLATED FIELDS ARE FUNCTIONS NOW, and that is the real gain. They carried `{date}` and
// the four `/today` figures as raw braces, filled by a private `fill` in `handlers.ts` — a second
// substitution engine beside the one the i18n runtime already has. They are ICU arguments now and
// `fill` is gone with them.
//
// What that does NOT buy is a compiler check. `lingui compile --strict` means "every message is
// translated", not "every translation takes the same arguments": dropping `{plan}` from the
// German header compiles clean and ships "Heute: 1 kcal, 3 von 4 g Eiweiß". The guard is
// `catalogArgs` in `shared/copy.i18n.test.ts`, which compares every language's argument set
// against the source and fails naming the id — written because this comment first claimed
// `--strict` did it and the claim was tested and was false.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { i18nFor, type I18n, type Lang } from "@eait/shared";

export interface TelegramCopy {
  stranger: string;
  signIn: string;
  connectedLead: string;
  viaApp: string;
  connectedTail: string;
  notYours: string;
  codeInvalid: string;
  tooManyTries: string;
  onTheWeb: string;
  tooLong: string;
  proposalLead: string;
  /** A proposal for a day that is not today names it. */
  proposalLeadDated: (v: { date: string }) => string;
  logIt: string;
  notThis: string;
  logged: string;
  alreadyLogged: string;
  expired: string;
  updated: string;
  moved: string;
  targetGone: string;
  downloadFailed: string;
  tooLarge: string;
  todayEmpty: string;
  /** The `/today` header. */
  todayHead: (v: { eaten: string; plan: string; protein: string; proteinTarget: string }) => string;
  /** What an unnamed dish is called on a card. */
  meal: string;
  macros: { protein: string; carbs: string; fat: string };
  failed: string;
  /** Keyed by refusal kind, with `cap-exceeded` split by scope. */
  refusals: Record<string, string>;
}

const COPY = (i18n: I18n): TelegramCopy => ({
  stranger: i18n._("tg.stranger", undefined, { message: "This is the new eait. Your meals and photos are kept in your eait account: sign in on the web and press Connect Telegram on your plan." }),
  signIn: i18n._("tg.signIn", undefined, { message: "Sign in" }),
  connectedLead: i18n._("tg.connectedLead", undefined, { message: "Connected to the eait account signed in with" }),
  viaApp: i18n._("tg.viaApp", undefined, { message: "the app" }),
  connectedTail: i18n._("tg.connectedTail", undefined, { message: "Send a photo of a meal, tell me what you ate, or ask Gabie a question." }),
  notYours: i18n._("tg.notYours", undefined, { message: "Not your account? Sign in to your own on the web and press Connect Telegram there — this Telegram moves to it." }),
  codeInvalid: i18n._("tg.codeInvalid", undefined, { message: "That link has expired. Open your plan on the web and press Connect Telegram again." }),
  tooManyTries: i18n._("tg.tooManyTries", undefined, { message: "Too many tries from this Telegram. Wait a while, then press the link again." }),
  onTheWeb: i18n._("tg.onTheWeb", undefined, { message: "Your profile and settings are on the web." }),
  tooLong: i18n._("tg.tooLong", undefined, { message: "That message is too long to send." }),
  proposalLead: i18n._("tg.proposalLead", undefined, { message: "Logging this — look right?" }),
  proposalLeadDated: (v: { date: string }) => i18n._("tg.proposalLeadDated", v, { message: "Logging this for {date} — look right?" }),
  logIt: i18n._("tg.logIt", undefined, { message: "Log it" }),
  notThis: i18n._("tg.notThis", undefined, { message: "Not this" }),
  logged: i18n._("tg.logged", undefined, { message: "Logged." }),
  alreadyLogged: i18n._("tg.alreadyLogged", undefined, { message: "That one was already logged." }),
  expired: i18n._("tg.expired", undefined, { message: "That one is no longer being held. Say it again." }),
  updated: i18n._("tg.updated", undefined, { message: "Updated." }),
  moved: i18n._("tg.moved", undefined, { message: "Moved." }),
  targetGone: i18n._("tg.targetGone", undefined, { message: "There is no meal open here to change. Say what you ate and log it again." }),
  downloadFailed: i18n._("tg.downloadFailed", undefined, { message: "That photo did not come through from Telegram. Send it again." }),
  tooLarge: i18n._("tg.tooLarge", undefined, { message: "That photo is too large to send." }),
  todayHead: (v: { eaten: string, plan: string, protein: string, proteinTarget: string }) => i18n._("tg.todayHead", v, { message: "Today: {eaten} of {plan} kcal, {protein} of {proteinTarget} g protein" }),
  todayEmpty: i18n._("tg.todayEmpty", undefined, { message: "Nothing logged today yet." }),
  meal: i18n._("tg.meal", undefined, { message: "Meal" }),
  failed: i18n._("tg.failed", undefined, { message: "Something went wrong, and it may still have gone through. Check /today before sending it again." }),
  macros: { protein: i18n._("tg.macro.protein", undefined, { message: "Protein" }), carbs: i18n._("tg.macro.carbs", undefined, { message: "Carbs" }), fat: i18n._("tg.macro.fat", undefined, { message: "Fat" }) },
  refusals: {
    "not-onboarded": i18n._("tg.refusal.not-onboarded", undefined, { message: "Answer the plan questions on the web first." }),
    "not-food": i18n._("tg.refusal.not-food", undefined, { message: "That did not look like food." }),
    "cap-user": i18n._("tg.refusal.cap-user", undefined, { message: "That was your last one today — your daily allowance resets at midnight." }),
    "cap-global": i18n._("tg.refusal.cap-global", undefined, { message: "Everyone has used today's allowance. Tomorrow is a fresh number." }),
    "cap-address": i18n._("tg.refusal.cap-address", undefined, { message: "That's the limit for now. Try again later." }),
    "subscription-required": i18n._("tg.refusal.subscription-required", undefined, { message: "The analyses this account came with are used up. Subscribe on the web to carry on." }),
    "analysis-failed": i18n._("tg.refusal.analysis-failed", undefined, { message: "That did not come back. Try it again." }),
    "unsupported-image": i18n._("tg.refusal.unsupported-image", undefined, { message: "That file is not a photo this can read. JPEG, PNG or WebP." }),
    "no-photo": i18n._("tg.refusal.no-photo", undefined, { message: "That photo did not come through. Send it again." }),
  },
});

/**
 * The bot's words in one language. English for one nobody has written yet.
 *
 * BUILT PER CALL, not cached per language, and deliberately: a cached object is a module-scope
 * copy table captured at import, which is the defect #358 spent its review rounds removing. Two
 * dozen string lookups from a compiled catalog is not a cost worth a correctness risk, and every
 * caller here already binds it once per update.
 */
export const telegramCopyFor = (lang: Lang): TelegramCopy => COPY(i18nFor(lang));
