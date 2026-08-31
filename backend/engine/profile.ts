// Profile reads and writes, and the validation that makes onboarding safe.
//
// The onboarding SEQUENCE lives in `@ieat/shared` (`onboarding.ts`) because the app needs the same
// answer to "what comes next" in order to render without a round trip. What lives HERE is the part
// that must not be client-side: the validation. Every rejection below is a refusal the app has to
// re-ask, and the target-weight one is a safety guard — a client that decided to skip it would
// simply be told no.

import { MAX_PROFILE_TEXT,
  ACTIVITY_LEVELS, LANGS, PACES, RESTRICTION_TAGS, checkTargetWeight, explainTargets,
  isAcceptableWeightKg,
  type ActivityLevel, type Lang, type Pace, type PatchProfileRequest, type Profile,
  type Limits, type ProfileRejected, type ProfileResponse,
} from "@ieat/shared";
import { MIN_AGE } from "@ieat/shared";
import type { ProfilePatch } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { dailyPhotoCap, entitlementFor } from "./entitlement.ts";
import { MAX_WINDOW_DAYS } from "./diary.ts";

/**
 * The limits THIS server enforces, so the client stops guessing at them.
 *
 * Both are env-configured and therefore differ per environment. Sending them is what keeps the app
 * from offering four photo slots to a server that accepts two.
 */
async function limitsOf(deps: EngineDeps, userId: string): Promise<Limits> {
  return {
    maxUploadBytes: deps.config.maxUploadBytes,
    maxPhotosPerMeal: deps.config.maxPhotosPerMeal,
    // The SAME function and the SAME count `checkCaps` refuses with. Anything else here is the
    // app promising an allowance the server will not honour.
    dailyPhotoCap: dailyPhotoCap(deps.config),
    sampleUsed: (await deps.store.countUserAnalyses(userId)) >= deps.config.freeAnalyses,
    // The SAME bound `/v1/diary/week` refuses with. It governs which days can be MARKED, not which
    // can be opened: `/v1/diary/day` answers for any date, and the picker offers every past one.
    diaryWindowDays: MAX_WINDOW_DAYS,
  };
}

export async function profileView(deps: EngineDeps, userId: string): Promise<ProfileResponse | null> {
  const profile = await deps.store.getProfile(userId);
  if (!profile) return null;
  const { targets, basis } = explainTargets(profile);
  const entitlement = await entitlementFor(deps, userId);
  return {
    profile, targets, basis, onboarded: profile.onboarded_at !== null,
    limits: await limitsOf(deps, userId), timezone: deps.config.timezone, entitlement,
  };
}

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

  if (req.lang !== undefined) {
    if (!(LANGS as readonly string[]).includes(req.lang)) return reject("lang", "out-of-range");
    patch.lang = req.lang as Lang;
  }
  if (req.goal !== undefined) {
    if (req.goal !== null && !["lose", "maintain", "gain"].includes(req.goal)) return reject("goal", "out-of-range");
    patch.goal = req.goal;
  }
  if (req.sex !== undefined) {
    if (req.sex !== null && !["female", "male"].includes(req.sex)) return reject("sex", "out-of-range");
    patch.sex = req.sex;
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
    if (req.activity !== null && !(ACTIVITY_LEVELS as readonly string[]).includes(req.activity)) {
      return reject("activity", "out-of-range");
    }
    patch.activity = req.activity as ActivityLevel | null;
  }
  if (req.pace !== undefined) {
    if (req.pace !== null && !(PACES as readonly string[]).includes(req.pace)) {
      return reject("pace", "out-of-range");
    }
    patch.pace = req.pace as Pace | null;
  }
  if (req.country !== undefined) {
    if (req.country !== null && (typeof req.country !== "string" || req.country.length > MAX_COUNTRY)) {
      return reject("country", "out-of-range");
    }
    patch.country = req.country;
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
  const { targets, basis } = explainTargets(profile);
  const entitlement = await entitlementFor(deps, userId);
  return {
    ok: true,
    view: {
      profile, targets, basis, onboarded: profile.onboarded_at !== null,
      limits: await limitsOf(deps, userId), timezone: deps.config.timezone, entitlement,
    },
  };
}

/** Free text → tags, keyword pass first, LLM only when it found nothing. */
export async function classifyRestrictions(deps: EngineDeps, text: string): Promise<string[]> {
  const { parseRestrictions } = await import("@ieat/shared");
  const keyword = parseRestrictions(text);
  if (keyword.length > 0) return keyword;
  try {
    const tags = await deps.llm.classifyRestrictions(text);
    // Validated against the same closed list the keyword pass uses — one source of truth, so the
    // two paths cannot disagree about what a valid tag is.
    return tags.filter((t) => (RESTRICTION_TAGS as string[]).includes(t));
  } catch (e) {
    console.error(`[eait] restriction classification failed: ${(e as Error).message}`);
    return [];
  }
}
