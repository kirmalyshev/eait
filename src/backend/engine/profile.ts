// Profile reads and writes, and the validation that makes onboarding safe.
//
// The onboarding SEQUENCE lives in `@eait/shared` (`onboarding.ts`) because the app needs the same
// answer to "what comes next" in order to render without a round trip. What lives HERE is the part
// that must not be client-side: the validation. Every rejection below is a refusal the app has to
// re-ask, and the target-weight one is a safety guard — a client that decided to skip it would
// simply be told no.

import { MAX_PROFILE_TEXT,
  DIETS, LANGS, MEDICAL_TAGS, PACES, RESTRICTION_TAGS, SEXES, STREAK_GOALS, STRUGGLES, UNITS,
  checkTargetWeight, explainTargets,
  ageFrom, isAcceptableWeightKg, isDietTag, isMedicalTag, dateMinus, localDate, migrateActivityLevel, offerMath,
  paywallPrice, perMonth, threadCopyFor,
  type Lang, type Pace, type PatchProfileRequest, type Profile,
  type Limits, type ProfileRejected, type ProfileResponse, type WebPaywall,
  ROUTES,
} from "@eait/shared";
import { MIN_AGE } from "@eait/shared";
import type { ProfilePatch } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { dailyPhotoCap, entitlementFor, freeAnalysesFor } from "./entitlement.ts";
import { MAX_WINDOW_DAYS } from "./diary.ts";

/**
 * The sample, as the app is told about it: spent or not, and how much is left.
 *
 * ONE COUNT, READ ONCE. Two `countUserAnalyses` calls for two fields could disagree with each
 * other across a concurrent analysis, and the app would render "spent" beside "2 left".
 *
 * AN ENTITLED ACCOUNT HAS NONE OF IT LEFT, whatever it has spent. The sample is not what a
 * subscriber is drawing on — `checkCaps` never reaches the sample branch for them — so reporting
 * three remaining to somebody who subscribed before logging anything is a promise about an
 * allowance that does not apply, and `contract.ts` says so in as many words.
 */
function sampleOf(
  spent: number,
  sample: number,
  entitled: boolean,
): Pick<Limits, "sampleUsed" | "sampleRemaining"> {
  return {
    sampleUsed: spent >= sample,
    sampleRemaining: entitled ? 0 : Math.max(0, sample - spent),
  };
}

/**
 * The limits THIS server enforces, so the client stops guessing at them.
 *
 * Every one of them is env-configured and therefore differs per environment. Sending them is what
 * keeps the app from offering four photo slots to a server that accepts two, or counting down a
 * sample whose size it guessed.
 */
async function limitsOf(deps: EngineDeps, userId: string, entitled: boolean): Promise<Limits> {
  return {
    maxUploadBytes: deps.config.maxUploadBytes,
    maxPhotosPerMeal: deps.config.maxPhotosPerMeal,
    // The SAME function and the SAME count `checkCaps` refuses with. Anything else here is the
    // app promising an allowance the server will not honour.
    dailyPhotoCap: dailyPhotoCap(deps.config),
    ...sampleOf(await deps.store.countUserAnalyses(userId), await freeAnalysesFor(deps, userId), entitled),
    // The SAME bound `/v1/diary/week` refuses with. It governs which days can be MARKED, not which
    // can be opened: `/v1/diary/day` answers for any date, and the picker offers every past one.
    diaryWindowDays: MAX_WINDOW_DAYS,
    // THE RUNNING SERVER'S PER-CALL BUDGET, not the one the app was compiled against.
    // `EAIT__BACKEND__LLM_TIMEOUT_MS` is set explicitly in production, so this is the only channel
    // by which a phone can learn it — and it is sent PER CALL because how many budgets a turn
    // spends depends on the route, which only the caller knows.
    modelCallTimeoutMs: deps.config.llmTimeoutMs,
  };
}

/**
 * Where a browser pairs with an account, as the phone should PRINT it (#408).
 *
 * Two origins, and this is the browser's one: `publicWebUrl` is where a person signs in, and
 * `publicApiUrl` is where an emailed link points (#406). A pairing address is something somebody
 * types into an address bar, so it follows the browser — and it falls back to the API's own name,
 * which is where `/start` is still served on every host that has not moved yet.
 *
 * EMPTY WHEN NEITHER IS SET, rather than derived from the request. This value is composed once per
 * response and handed to a client that already knows which host it dialled; a server that has not
 * been told its public name cannot improve on the client's own answer, and inventing one would put
 * a wrong hostname in front of a person as an instruction.
 */
function pairAddressOf(config: { publicWebUrl: string; publicApiUrl: string }): string {
  const origin = config.publicWebUrl || config.publicApiUrl;
  if (!origin) return "";
  // The scheme is dropped because this is read aloud off a screen; the trailing slash because
  // `https://host/` + `/start` is `host//start`, which is a 404 nobody would suspect.
  return `${origin.replace(/^https?:\/\//, "").replace(/\/+$/, "")}${ROUTES.webStart}`;
}

/**
 * The web paywall, computed per account (#77): the operator's `EAIT__BACKEND__WEB_*` block with
 * every price formatted in the account's language and configured currency, the offer's discount
 * derived by the shared `offerMath` (never a fixed percentage), and `{userId}` filled into every
 * checkout link from THIS account — the one the credential resolved, so no client ever carries an
 * id it was not issued.
 *
 * A plan with no configured checkout is null rather than half-offered, and an exit offer whose
 * discount cannot stand — a regular price of nothing, or a saving under one percent — is no offer
 * at all: the decline then goes straight to the app.
 */
function paywallOf(deps: EngineDeps, lang: Lang, userId: string): WebPaywall {
  const w = deps.config.webPaywall;
  const url = (template: string) => template.replaceAll("{userId}", encodeURIComponent(userId));
  const price = (n: number) => paywallPrice(n, w.currency, lang);
  const math = offerMath(w.exitOfferRegularPrice, w.exitOfferPrice);
  return {
    trialDays: w.trialDays,
    yearly: w.yearlyCheckoutUrl === "" ? null : {
      checkoutUrl: url(w.yearlyCheckoutUrl),
      price: price(w.yearlyPrice),
      pricePerMonth: price(perMonth(w.yearlyPrice)),
    },
    monthly: w.monthlyCheckoutUrl === "" ? null : {
      checkoutUrl: url(w.monthlyCheckoutUrl),
      price: price(w.monthlyPrice),
    },
    exitOffer: w.exitOfferCheckoutUrl === "" || math === null ? null : {
      checkoutUrl: url(w.exitOfferCheckoutUrl),
      price: price(w.exitOfferPrice),
      regularPrice: price(w.exitOfferRegularPrice),
      percentOff: math.percentOff,
      perMonth: price(math.perMonth),
    },
    // The footer's links — the same two the `/start` pages already render, sent so the app's pay
    // surfaces never carry a second copy of where they point.
    termsUrl: deps.config.termsUrl,
    privacyUrl: deps.config.landingUrl === "" ? "" : `${deps.config.landingUrl}/privacy`,
  };
}

/**
 * How fresh a health sync has to be before "connected" is claimed on it (`ProfileResponse.healthConnected`,
 * #97). A week, in the server's zone: the phone syncs on every launch, so a row older than that is
 * a sync that stopped.
 */
const HEALTH_CONNECTED_DAYS = 7;

/**
 * Whether this account's health sync is live: a `HealthDay` row exists inside the window.
 * Computed here rather than asked of the client, because a boolean the client could set for
 * itself would be a claim, not a fact.
 */
async function healthConnected(deps: EngineDeps, userId: string): Promise<boolean> {
  const since = dateMinus(localDate(deps.config.timezone), HEALTH_CONNECTED_DAYS - 1);
  return (await deps.store.healthDaysSince(userId, since)).length > 0;
}

export async function profileView(deps: EngineDeps, userId: string): Promise<ProfileResponse | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const { targets, basis } = explainTargets(profile);
  const entitlement = await entitlementFor(deps, userId);
  return {
    profile, targets, basis, onboarded: profile.onboarded_at !== null,
    // Computed HERE, in this server's zone — a client that subtracts the year itself is off by
    // one for the hour the zones disagree, and `ageFrom` keeps the band check honest.
    age: ageFrom(profile.birth_year, new Date(`${localDate(deps.config.timezone)}T12:00:00Z`)),
    isAdmin: await deps.store.roleOf(userId) === "admin",
    limits: await limitsOf(deps, userId, entitlement.active), timezone: deps.config.timezone, entitlement,
    healthConnected: await healthConnected(deps, userId),
    pairAddress: pairAddressOf(deps.config),
    telegramBot: deps.config.telegramBotUsername || null,
    paywall: paywallOf(deps, profile.lang, userId),
    coachName: threadCopyFor(profile.lang).coach.name,
    hasLoggedMeal: await hasLoggedMeal(deps, userId),
    donate: donateOf(deps.config),
  };
}

/** The operator's donation links, per provider — null while its variable is unset (#200). */
const donateOf = (config: EngineDeps["config"]): ProfileResponse["donate"] => ({
  github: config.donateGithubUrl || null,
  kofi: config.donateKofiUrl || null,
  buyMeACoffee: config.donateBmcUrl || null,
});

/**
 * "Has this account ever logged a meal", read the way the diary reads its window — `totalsSince`
 * answers only days that have something, so a year of history deep enough to matter is still one
 * scoped query. `1970` predates every meal that can exist; the date is a bound `totalsSince`
 * needs, not a decision about history.
 */
const hasLoggedMeal = async (deps: EngineDeps, userId: string): Promise<boolean> =>
  (await deps.store.totalsSince(userId, "1970-01-01")).length > 0;

export type PatchOutcome =
  | { ok: true; view: ProfileResponse }
  | { ok: false; rejected: ProfileRejected };

/**
 * Apply a profile patch after validating it.
 *
 * Every rejection here is a REFUSAL the app must re-ask, never a warning it may click past. The
 * target-weight check is the one that matters most: it is the anorexia guard, and the users it
 * exists for are exactly the ones who would dismiss a warning.
 */
export async function patchProfile(
  deps: EngineDeps,
  userId: string,
  req: PatchProfileRequest,
): Promise<PatchOutcome | null> {
  const current = await deps.store.getProfile(userId);
  if (!current) return null;

  const patch: ProfilePatch = {};
  const MAX_COUNTRY = 64;
  const reject = (field: keyof PatchProfileRequest, reason: ProfileRejected["reason"], extra?: Partial<ProfileRejected>): PatchOutcome =>
    ({ ok: false, rejected: { error: "invalid-profile", field, reason, ...extra } });

  // `LANGS`, NOT `LANGS_READY`, and the difference is the whole point of there being two lists.
  //
  // `LANGS` is what this server STORES and what the model is told to answer in; `LANGS_READY` is
  // what a client may OFFER in its picker, because every table is complete enough to render it end
  // to end. They happen to be equal today. Validating the write against the narrower one would
  // make a language unstorable until the last table was translated — and since fallback happens at
  // the KEY, a language in `LANGS` but not `LANGS_READY` renders as a few English strings inside
  // an otherwise translated app, with the coach answering correctly. That is the designed
  // behaviour, not a bug to refuse at the boundary.
  if (req.lang !== undefined) {
    if (!(LANGS as readonly string[]).includes(req.lang)) return reject("lang", "out-of-range");
    patch.lang = req.lang as Lang;
  }
  if (req.goal !== undefined) {
    if (req.goal !== null && !["lose", "maintain", "gain"].includes(req.goal)) return reject("goal", "out-of-range");
    patch.goal = req.goal;
  }
  if (req.sex !== undefined) {
    if (req.sex !== null && !(SEXES as readonly string[]).includes(req.sex)) return reject("sex", "out-of-range");
    patch.sex = req.sex;
  }
  // Asked as an AGE; the server does the subtraction, with its own clock — see the contract's
  // comment on `age`. The reject names `birth_year` because that is the field the app's stop
  // handler and the editor's copy are keyed by.
  if (req.age !== undefined) {
    if (!Number.isInteger(req.age) || req.age < MIN_AGE || req.age > 100) {
      return reject("birth_year", "age-below-minimum");
    }
    patch.birth_year = new Date().getUTCFullYear() - req.age;
  }
  if (req.birth_year !== undefined) {
    if (req.birth_year !== null) {
      const age = new Date().getUTCFullYear() - req.birth_year;
      // Refused, not clamped. A 14-year-old handed an adult's deficit is the failure mode, and
      // growth-phase energy needs are not what Mifflin-St Jeor models.
      if (!Number.isInteger(req.birth_year) || age < MIN_AGE || age > 100) {
        return reject("birth_year", "age-below-minimum");
      }
    }
    patch.birth_year = req.birth_year;
  }
  if (req.height_cm !== undefined) {
    if (req.height_cm !== null && (!Number.isFinite(req.height_cm) || req.height_cm < 100 || req.height_cm > 250)) {
      return reject("height_cm", "out-of-range");
    }
    patch.height_cm = req.height_cm;
  }
  if (req.weight_kg !== undefined) {
    if (req.weight_kg !== null && !isAcceptableWeightKg(req.weight_kg)) {
      return reject("weight_kg", "out-of-range");
    }
    patch.weight_kg = req.weight_kg;
    // Stamped HERE, on the server, because the client does not get to assert when something was
    // weighed. This is the other half of the Apple Health clobber guard: an import wins only if its
    // sample is newer than this, so a number the user typed a moment ago survives the next sync.
    patch.weight_measured_at = req.weight_kg === null ? null : new Date().toISOString();
  }
  if (req.target_weight_kg !== undefined) {
    if (req.target_weight_kg !== null) {
      if (!Number.isFinite(req.target_weight_kg) || req.target_weight_kg < 30 || req.target_weight_kg > 400) {
        return reject("target_weight_kg", "out-of-range");
      }
      // Checked against the height being SET in this same patch when there is one, so a client that
      // sends height and target together cannot slip past the guard by ordering its fields.
      const height = req.height_cm !== undefined ? req.height_cm : current.height_cm;
      const check = checkTargetWeight(req.target_weight_kg, height);
      if (!check.ok) {
        return reject("target_weight_kg", "target-weight-below-healthy-bmi", { minHealthyKg: check.minHealthyKg });
      }
    }
    patch.target_weight_kg = req.target_weight_kg;
  }
  if (req.activity !== undefined) {
    // Stored values migrate with the enum (targets v2, decision 7): a build still speaking the
    // five-level vocabulary lands migrated rather than refused. A word from no vocabulary still is.
    const activity = req.activity === null ? null : migrateActivityLevel(req.activity);
    if (req.activity !== null && activity === null) return reject("activity", "out-of-range");
    patch.activity = activity;
  }
  if (req.pace !== undefined) {
    if (req.pace !== null && !(PACES as readonly string[]).includes(req.pace)) {
      return reject("pace", "out-of-range");
    }
    patch.pace = req.pace as Pace | null;
  }
  if (req.units !== undefined) {
    if (req.units !== null && !(UNITS as readonly string[]).includes(req.units)) {
      return reject("units", "out-of-range");
    }
    patch.units = req.units;
  }
  if (req.struggles !== undefined) {
    if (req.struggles !== null && !Array.isArray(req.struggles)) return reject("struggles", "out-of-range");
    // Filtered against the closed vocabulary, walking IT rather than the request — the stored
    // order is the list order, which is what the on-track caption's "first pick" reads.
    patch.struggles = req.struggles === null
      ? null
      : STRUGGLES.filter((t) => (req.struggles as unknown[]).includes(t));
  }
  if (req.streak_goal_days !== undefined) {
    if (req.streak_goal_days !== null && !(STREAK_GOALS as readonly number[]).includes(req.streak_goal_days)) {
      return reject("streak_goal_days", "out-of-range");
    }
    patch.streak_goal_days = req.streak_goal_days;
  }
  if (req.country !== undefined) {
    if (req.country !== null && (typeof req.country !== "string" || req.country.length > MAX_COUNTRY)) {
      return reject("country", "out-of-range");
    }
    patch.country = req.country;
  }
  // ONE COLUMN, THREE WRITERS (onboarding v2): `restrictions` replaces the array outright, `diet`
  // replaces its diet subset and `medical` its medical subset, merged on the server so no client
  // ever composes it. `restrictions` sent WITH either of them is two spellings of one column —
  // refused as ambiguous rather than arbitrated.
  if (req.restrictions !== undefined && (req.diet !== undefined || req.medical !== undefined)) {
    return reject("restrictions", "out-of-range");
  }
  if (req.restrictions !== undefined) {
    if (!Array.isArray(req.restrictions)) return reject("restrictions", "out-of-range");
    // Filtered against the CLOSED vocabulary rather than rejected: an unknown tag is a client that
    // is ahead of or behind the server, and dropping it is recoverable where a 422 is not. Anything
    // outside the list is meaningless to `targetsFor` and to the prompt anyway. Walking the
    // vocabulary rather than the body bounds, dedupes and orders the result in one step.
    const given = req.restrictions as unknown[];
    patch.restrictions = RESTRICTION_TAGS.filter((t) => given.includes(t));
  }
  if (req.diet !== undefined) {
    if (req.diet !== null && !(DIETS as readonly string[]).includes(req.diet)) {
      return reject("diet", "out-of-range");
    }
  }
  if (req.medical !== undefined) {
    if (req.medical !== null && (!Array.isArray(req.medical) ||
        (req.medical as unknown[]).some((t) => !(MEDICAL_TAGS as readonly string[]).includes(t as string)))) {
      return reject("medical", "out-of-range");
    }
  }
  if (req.diet !== undefined || req.medical !== undefined) {
    const diet = req.diet === undefined
      ? undefined
      : req.diet === null || req.diet === "balanced" ? null : req.diet;
    const medical = req.medical === undefined
      ? undefined
      : new Set(req.medical ?? []);
    patch.restrictions = RESTRICTION_TAGS.filter((t) =>
      isDietTag(t)
        ? diet === undefined ? current.restrictions.includes(t) : t === diet
        : isMedicalTag(t)
          ? medical === undefined ? current.restrictions.includes(t) : medical.has(t)
          : current.restrictions.includes(t));
  }
  for (const f of ["medical_limitations", "food_allergies", "product_limitations"] as const) {
    if (req[f] === undefined) continue;
    // Prose about a person's body, bounded like everything else that crosses this boundary.
    if (req[f] !== null && (typeof req[f] !== "string" || req[f].length > MAX_PROFILE_TEXT)) return reject(f, "out-of-range");
    patch[f] = req[f];
  }

  if (req.complete_onboarding) {
    const merged = { ...current, ...patch } as Profile;
    // Goal and bodyweight are the minimum for any target at all. Everything else degrades to the
    // flat band, which is safe; missing these two makes the number meaningless.
    if (merged.goal === null || merged.weight_kg === null) {
      return reject("complete_onboarding", "out-of-range");
    }
    patch.onboarded_at = new Date().toISOString();
  }

  const profile = await deps.store.patchProfile(userId, patch);

  // A typed weight is also a weigh-in (#84): the log the Progress chart draws has a manual half,
  // and this is where it is written. The row is dated TODAY, in the account's zone — the same
  // rule `weight_measured_at` holds for the profile field — and the last write of a day wins, so
  // retyping a weight corrects the chart rather than adding a second point to it.
  if (patch.weight_kg !== undefined && patch.weight_kg !== null) {
    await deps.store.putWeight(userId, localDate(deps.config.timezone), patch.weight_kg);
  }

  const { targets, basis } = explainTargets(profile);
  const entitlement = await entitlementFor(deps, userId);
  return {
    ok: true,
    view: {
      profile, targets, basis, onboarded: profile.onboarded_at !== null,
      age: ageFrom(profile.birth_year, new Date(`${localDate(deps.config.timezone)}T12:00:00Z`)),
      isAdmin: await deps.store.roleOf(userId) === "admin",
      limits: await limitsOf(deps, userId, entitlement.active), timezone: deps.config.timezone, entitlement,
      healthConnected: await healthConnected(deps, userId),
      pairAddress: pairAddressOf(deps.config),
      telegramBot: deps.config.telegramBotUsername || null,
      paywall: paywallOf(deps, profile.lang, userId),
      coachName: threadCopyFor(profile.lang).coach.name,
      donate: donateOf(deps.config),
      hasLoggedMeal: await hasLoggedMeal(deps, userId),
    },
  };
}
