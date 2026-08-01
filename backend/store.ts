// The persistence port.
//
// The engine depends on THIS interface, never on Postgres. Two implementations exist: `store.pg.ts`
// is what runs, `store.memory.ts` is what the tests run against. That is not test convenience for
// its own sake — it means the engine's rules (cap enforcement, user scoping, verdict gating) are
// covered by `bun test` with no database running, so they get tested on every commit instead of
// only when someone remembers to start docker.
//
// ONE INVARIANT ABOVE ALL: every read and every write is scoped by `userId`, and `userId` arrives
// as an ARGUMENT resolved from credentials — never from a request body, a model output, or a tool
// call. There is no method here that can reach a row without being told whose it is.

import type { DayTotals, Lang, MealAnalysis, MealRecord, Profile } from "@ieat/shared";

/** A text meal awaiting confirmation. Not in the diary yet, and expires. */
export interface PendingMeal {
  id: string;
  userId: string;
  analysis: MealAnalysis;
  date: string;
  expiresAt: number;
}

/** The columns a profile patch may touch. Mirrors `PatchProfileRequest` minus the control flags. */
export type ProfilePatch = Partial<Omit<Profile, "user_id">>;

/**
 * What an edit may change on a stored meal.
 *
 * `verdicts` is here because the ENGINE recomputes it on every write — no caller supplies one.
 * `date` is here for the re-date path ONLY; `EditMealRequest` deliberately has no date field, so a
 * manual edit cannot reach it and the "a meal moves days only by asking" rule holds by typing
 * rather than by convention.
 */
export type MealPatch = Partial<
  Pick<MealRecord,
    "items" | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "satfat_g" | "fiber_g" | "sugar_g" |
    "sodium_mg" | "verdicts" | "notes" | "corrected" | "date">
>;

export interface Store {
  // ── Identity ───────────────────────────────────────────────────────────────────────────────
  /** Find or create the user behind a device id. Returns whether the row was created. */
  upsertDeviceUser(deviceId: string, lang: Lang): Promise<{ userId: string; created: boolean }>;
  /** Mint a bearer token for a user. */
  issueToken(userId: string): Promise<string>;
  /** Resolve a bearer token to a user id, or null. The ONLY way a request becomes a userId. */
  userIdForToken(token: string): Promise<string | null>;

  // ── Profile ────────────────────────────────────────────────────────────────────────────────
  getProfile(userId: string): Promise<Profile | null>;
  patchProfile(userId: string, patch: ProfilePatch): Promise<Profile>;

  // ── Meals ──────────────────────────────────────────────────────────────────────────────────
  insertMeal(record: MealRecord): Promise<void>;
  /** Scoped: another user's meal id resolves to null, not to their row. */
  getMeal(userId: string, mealId: string): Promise<MealRecord | null>;
  /** Scoped. Returns null when the row vanished between lookup and write (a delete race). */
  updateMeal(userId: string, mealId: string, patch: MealPatch): Promise<MealRecord | null>;
  mealsForDate(userId: string, date: string): Promise<MealRecord[]>;
  /** Most recent first, `since` inclusive. Feeds the week view and the chat router's context. */
  totalsSince(userId: string, since: string): Promise<DayTotals[]>;

  // ── Pending text meals ─────────────────────────────────────────────────────────────────────
  putPending(pending: PendingMeal): Promise<void>;
  getPending(userId: string, pendingId: string): Promise<PendingMeal | null>;
  dropPending(userId: string, pendingId: string): Promise<void>;

  // ── Caps ───────────────────────────────────────────────────────────────────────────────────
  /**
   * PHOTO analyses this user has spent on `date` — text turns are excluded on purpose.
   *
   * The per-user cap is a photo allowance. If chat counted against it, asking "how much protein
   * have I had" would cost the user a meal they could have logged, which quietly teaches people
   * not to use the chat. The global budget counts both, because both cost money.
   */
  countUserPhotos(userId: string, date: string): Promise<number>;
  /** Every analysis the instance has spent on `date`, whatever its scope. */
  countGlobalAnalyses(date: string): Promise<number>;
  /** Recorded BEFORE the model is called: a failed call still costs money. */
  recordAnalysis(userId: string, date: string, scope: "photo" | "text"): Promise<void>;

  // ── Erasure ────────────────────────────────────────────────────────────────────────────────
  /** Full account deletion. Everything, not a soft-delete flag. */
  deleteUser(userId: string): Promise<void>;

  close(): Promise<void>;
}

/** A blank profile for a freshly created user. Every answerable field starts null — onboarding is
 *  field-derived, so "never asked" must be distinguishable from "answered". */
export function blankProfile(userId: string, lang: Lang): Profile {
  return {
    user_id: userId, lang, goal: null, sex: null, birth_year: null, height_cm: null,
    weight_kg: null, target_weight_kg: null, activity: null, pace: null, country: null,
    restrictions: [], medical_limitations: null, food_allergies: null, product_limitations: null,
    onboarded_at: null,
  };
}
