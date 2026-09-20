// The thread's WORDS that are not the model's, in every language the product speaks.
//
// `chat.ts` keeps the RULES — which line a first verdict takes, when the arithmetic is spoken as
// its own sentence rather than after a dash, what a client may put in Spud's mouth — and the
// wording of each of them is here. Same split as `onboarding-chat-copy.ts`, same reason.
//
// ONE THING THAT IS NOT COPY AND MUST NOT BECOME IT: `ScriptedLineId` itself. A client names a
// line by id and the server owns the words, so the id set is a contract between two binaries and
// is the same in every language. What varies is what each id says. That is why `scripted` is
// keyed by the union rather than by `string` — a language that forgets an id is a compile error
// instead of a TypeError inside a chat bubble — and why the ids live in `chat.ts`, not here.
//
// THE ARITHMETIC HAS TWO FORMS PER BRANCH, and that is not redundancy. English says "First one in.
// 520 kcal — that leaves 930 of your 1,450" after a dash and "That leaves…" as its own sentence,
// and the old code got the second by running a regex over the first. A regex over prose is a rule
// about English grammar hiding in a string operation; four more strings are cheaper than eight
// languages' worth of capitalisation quirks, and the seven translations are free to make the pair
// identical where their language lets them.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THE WORDS ARE IN `src/shared/locales/*/messages.po` NOW, and the templates are FUNCTIONS.
//
// Twenty of these forty-three messages interpolate a figure, and they used to do it through
// `fillCopy` — a `.replace(/\{(\w+)\}/g, …)` exported from this file and applied by the caller.
// That is a second substitution engine beside the runtime's own, and it could not be checked: a
// translation that drops `{plan}` produced a sentence with the number missing and nothing
// anywhere said so. They are ICU arguments now, and `catalogArgs` in `copy.i18n.test.ts` compares
// every language's argument set against the source — because `lingui compile --strict` does NOT,
// which was measured rather than assumed.
//
// EVERY `scripted` LINE IS A THUNK, including the ten that take nothing. They are reached by a
// runtime id (`scriptedLine`), so a mixed record of strings and functions would need a typeof at
// the one call site — and the uniform shape is what lets the id set stay a `Record` the compiler
// checks. `trial-started` is the only one with a parameter today.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { i18nFor, type I18n } from "./i18n.ts";
import type { Lang } from "./types.ts";
// Type-only: `chat.ts` imports this file. Keying `scripted` by the id set rather than by
// `string` is what lets `scriptedLine` drop its `!` — a language that forgets an id is a
// compile error instead of a TypeError inside a chat bubble.
import type { ScriptedLineId } from "./chat.ts";

/**
 * The bare figures every sentence about the day interpolates.
 *
 * ONE TYPE FOR ALL OF THEM, because the four arithmetic branches are chosen at runtime and a
 * caller cannot know which it will land on. `left` and `over` are both always present and one of
 * them is always "0" — `figures()` in `chat.ts` clamps, so a branch never has to ask.
 */
// A `type` and not an `interface`, and that is load-bearing rather than stylistic: Lingui's
// `_(id, values)` takes `Record<string, unknown>`, and TypeScript gives an object type alias an
// implicit index signature while an interface gets none. As an interface this does not compile.
export type Figures = {
  left: string;
  over: string;
  plan: string;
  protein: string;
  proteinTarget: string;
};

/** The four branches of the running arithmetic: the goal, crossed with whether the day is spent. */
export type ArithmeticCopy = Record<
  "gainLeft" | "gainOver" | "otherLeft" | "otherOver",
  (v: Figures) => string
>;

export interface ThreadCopy {
  /** Keyed by `ScriptedLineId`. `{price}` on `trial-started` is the one parameter any of them takes. */
  scripted: Record<ScriptedLineId, (v?: Record<string, string>) => string>;
  meetGabie: string;
  coachStarters: string[];
  /**
   * WHOLE SENTENCES, never fragments joined by code.
   *
   * The figures are bare; everything around them — "of your", "g protein", the word order — is in
   * the template. The earlier shape built "930 of your 1,450" in TypeScript and handed it over as
   * one parameter, which is an English genitive compiled into the code and unreachable by any
   * translation.
   */
  running: { left: (v: Figures) => string; over: (v: Figures) => string };
  /** The meal's own kcal, and the sentence above. */
  correction: (v: { kcal: string; day: string }) => string;
  firstVerdict: {
    /** After a dash, so English leads lowercase. */
    arithmetic: ArithmeticCopy;
    /** The same four as a sentence of their own. */
    arithmeticAlone: ArithmeticCopy;
    /** A typed meal, where the portions are a guess. */
    typed: (v: { kcal: string }) => string;
    /** The analyzer could not read the plate. */
    lowConfidence: (v: { kcal: string }) => string;
    /** The rough-but-it-counts follow-up, per goal and per side of the plan. */
    lowOverGain: (v: Figures) => string;
    lowOverOther: (v: Figures) => string;
    lowLeftGain: (v: Figures) => string;
    lowLeftOther: (v: Figures) => string;
    firstIn: (v: { kcal: string; arithmetic: string }) => string;
    fixHint: string;
    sodium: string;
    satfat: string;
    /** The camera caption, quoted back. */
    noted: (v: { note: string }) => string;
  };
}

const THREAD = (i18n: I18n): ThreadCopy => ({
  scripted: {
    "camera-closed": (v) => i18n._("thread.scripted.camera-closed", v, { message: "No rush. The plan is on your diary — photograph the next meal when it happens. That's the whole habit, and I'll say so once tomorrow if it hasn't." }),
    "trial-started": (v) => i18n._("thread.scripted.trial-started", v, { message: "Trial's on. Seven days, then {price} unless you stop it — I'll remind you on day five and the day before it ends, never the day after." }),
    "trial-day-one": (v) => i18n._("thread.scripted.trial-day-one", v, { message: "Your first day is started. At 20:30 you get one line — today against the plan, and one concrete thing for tomorrow. Nothing before that." }),
    "notify-primer": (v) => i18n._("thread.scripted.notify-primer", v, { message: "One more thing iOS is about to ask about: notifications. One a day and never more — the 20:30 line, plus two reminders before the free week ends if you're on it. Nothing else, ever." }),
    "restored": (v) => i18n._("thread.scripted.restored", v, { message: "Restored — you're in. A photo or a sentence both log a meal." }),
    "camera-primer": (v) => i18n._("thread.scripted.camera-primer", v, { message: "One thing first: iOS will ask for the camera. I use it for the plate and nothing else — the photo is kept with the meal so you can see it in your diary, and erased with your account." }),
    "fix-prompt": (v) => i18n._("thread.scripted.fix-prompt", v, { message: "Tell me what's off — \"half the rice\", \"no avocado\", \"it was 500\" all work. Or open the card and edit the grams yourself." }),
    "already-in": (v) => i18n._("thread.scripted.already-in", v, { message: "Good. I'm here in Chat whenever — a photo or a sentence both log a meal." }),
    "camera-denied": (v) => i18n._("thread.scripted.camera-denied", v, { message: "No camera, no problem. Pick a photo from your library, or just tell me what you ate — both get a verdict." }),
    "onboarding-done": (v) => i18n._("thread.scripted.onboarding-done", v, { message: "Good — that's onboarding done, and the first day started. One more thing before you go, and it's the only time I'll ask." }),
    "dropped": (v) => i18n._("thread.scripted.dropped", v, { message: "Dropped it." }),
  },
  meetGabie: i18n._("thread.meetGabie", undefined, { message: "Questions go to Gabie, the nutritionist here — what to eat tonight, how the week's going. Same chat; she reads your diary before she answers. I log, she advises." }),
  coachStarters: [
    i18n._("thread.coachStarters.0", undefined, { message: "How's my week going?" }),
    i18n._("thread.coachStarters.1", undefined, { message: "What should I eat tonight?" }),
    i18n._("thread.coachStarters.2", undefined, { message: "Am I getting enough protein?" }),
  ],
  running: {
    left: (v: Figures) => i18n._("thread.running.left", v, { message: "{left} of your {plan} left today, {protein} of the {proteinTarget} g protein." }),
    over: (v: Figures) => i18n._("thread.running.over", v, { message: "{over} over your {plan} today, {protein} of the {proteinTarget} g protein." }),
  },
  correction: (v: { kcal: string; day: string }) => i18n._("thread.correction", v, { message: "Updated — {kcal} kcal. {day}" }),
  firstVerdict: {
    arithmetic: {
      gainLeft: (v: Figures) => i18n._("thread.firstVerdict.arithmetic.gainLeft", v, { message: "{left} of your {plan} still to fill today, and {protein} of the {proteinTarget} g protein. Keep going." }),
      gainOver: (v: Figures) => i18n._("thread.firstVerdict.arithmetic.gainOver", v, { message: "{over} over your {plan} today, and {protein} of the {proteinTarget} g protein. Past it is the point on a gain plan; tomorrow is a fresh number." }),
      otherLeft: (v: Figures) => i18n._("thread.firstVerdict.arithmetic.otherLeft", v, { message: "that leaves {left} of your {plan} for the rest of today, and {protein} of the {proteinTarget} g protein. On plan." }),
      otherOver: (v: Figures) => i18n._("thread.firstVerdict.arithmetic.otherOver", v, { message: "that puts you {over} over your {plan} for today, and {protein} of the {proteinTarget} g protein. Tomorrow is a fresh number." }),
    },
    arithmeticAlone: {
      gainLeft: (v: Figures) => i18n._("thread.firstVerdict.arithmeticAlone.gainLeft", v, { message: "About {left} of your {plan} still to fill today, and {protein} of the {proteinTarget} g protein. Keep going." }),
      gainOver: (v: Figures) => i18n._("thread.firstVerdict.arithmeticAlone.gainOver", v, { message: "About {over} over your {plan} today, and {protein} of the {proteinTarget} g protein. Past it is the point on a gain plan; tomorrow is a fresh number." }),
      otherLeft: (v: Figures) => i18n._("thread.firstVerdict.arithmeticAlone.otherLeft", v, { message: "That leaves about {left} of your {plan} for the rest of today, and {protein} of the {proteinTarget} g protein. On plan." }),
      otherOver: (v: Figures) => i18n._("thread.firstVerdict.arithmeticAlone.otherOver", v, { message: "That puts you about {over} over your {plan} for today, and {protein} of the {proteinTarget} g protein. Tomorrow is a fresh number." }),
    },
    typed: (v: { kcal: string }) => i18n._("thread.firstVerdict.typed", v, { message: "Typed, not photographed — so the portions are my guess. Take {kcal} as rough; if you know the grams, say so and I'll fix it." }),
    lowConfidence: (v: { kcal: string }) => i18n._("thread.firstVerdict.lowConfidence", v, { message: "Honest answer: I couldn't read that plate well. Take {kcal} as a rough guess and check the grams before you trust the total. A second angle next time helps." }),
    lowOverGain: (v: Figures) => i18n._("thread.firstVerdict.lowOverGain", v, { message: "About {over} over your {plan} today." }),
    lowOverOther: (v: Figures) => i18n._("thread.firstVerdict.lowOverOther", v, { message: "About {over} over your {plan} today. Tomorrow is a fresh number." }),
    lowLeftGain: (v: Figures) => i18n._("thread.firstVerdict.lowLeftGain", v, { message: "About {left} of your {plan} still to fill today." }),
    lowLeftOther: (v: Figures) => i18n._("thread.firstVerdict.lowLeftOther", v, { message: "About {left} of your {plan} left today." }),
    firstIn: (v: { kcal: string; arithmetic: string }) => i18n._("thread.firstVerdict.firstIn", v, { message: "First one in. {kcal} kcal — {arithmetic}" }),
    fixHint: i18n._("thread.firstVerdict.fixHint", undefined, { message: "If anything's off, say so — \"half the rice\", \"no avocado\" — or tap the card and change the grams." }),
    sodium: i18n._("thread.firstVerdict.sodium", undefined, { message: "Sodium runs high on this one. Scored only because you asked me to." }),
    satfat: i18n._("thread.firstVerdict.satfat", undefined, { message: "Saturated fat runs high on this one. Scored only because you asked me to." }),
    noted: (v: { note: string }) => i18n._("thread.firstVerdict.noted", v, { message: "“{note}” — noted, it's in the numbers." }),
  },
});

/** The thread's words in one language. English for one nobody has written yet. */
export const threadCopyFor = (lang: Lang): ThreadCopy => THREAD(i18nFor(lang));

// ── What the analyzer says while it is still thinking (#663) ────────────────────────────────
//
// IN THE CATALOG rather than as literals in `stream.ts`, for the reason it was a `Localized` table
// before: literals there were invisible to every check. The web app writes `pendingLine` straight
// into the DOM (`frontend/main.ts`), so a German mid-photo watched "Reading the plate…" under a
// fully translated composer.

export interface StreamCopy {
  /** Shown while the analyzer works: the glance replaces it once there is one. */
  reading: string;
  weighing: string;
  /** The four steps of the card, in order. */
  steps: readonly [string, string, string, string];
}

const STREAM = (i18n: I18n): StreamCopy => ({
  reading: i18n._("stream.reading", undefined, { message: "Reading the plate…" }),
  weighing: i18n._("stream.weighing", undefined, { message: "Weighing portions…" }),
  steps: [
    i18n._("stream.steps.0", undefined, { message: "Reading the plate" }),
    i18n._("stream.steps.1", undefined, { message: "Naming what's on it" }),
    i18n._("stream.steps.2", undefined, { message: "Weighing portions" }),
    i18n._("stream.steps.3", undefined, { message: "Checking against your plan" }),
  ],
});

/** The analyzer's progress words, in one language. */
export const streamCopyFor = (lang: Lang): StreamCopy => STREAM(i18nFor(lang));
