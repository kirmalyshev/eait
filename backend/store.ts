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

import type {
  DayTotals, HealthDay, Lang, MealAnalysis, MealRecord, OnboardingContent, OnboardingEvent, Profile,
  Provider,
} from "@ieat/shared";

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
 * The paid tier as stored: what the store says, plus when it said it.
 *
 * `expiresAt` is the whole entitlement — `entitlementActive` in `@ieat/shared` turns it into a
 * yes/no, and nothing else may. `productId` is not used to decide anything and is kept anyway,
 * because the first support question about a charge is "what did they actually buy" and the
 * alternative is asking the person to read it off their Apple receipt.
 *
 * `eventAt` is the instant the STORE generated the event, never the instant we received it. It is
 * what makes out-of-order delivery safe; see `putEntitlement`.
 */
export interface StoredEntitlement {
  expiresAt: string;
  productId: string;
  eventAt: string;
}

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

/**
 * The onboarding funnel, aggregated by the store.
 *
 * Aggregated THERE rather than here because the raw table is one row per screen per user and the
 * admin wants seven numbers. Pulling a million rows into the process to count them is how an admin
 * page becomes the reason the server fell over.
 */
export interface FunnelAggregate {
  /** Distinct onboarding runs in the window. */
  sessions: number;
  /** Runs that reached the end. */
  completed: number;
  rows: {
    place: string;
    views: number;
    answers: number;
    backs: number;
    rejects: number;
    /** Median time on screen before an answer, in ms. Null when nothing was answered. */
    medianMs: number | null;
  }[];
}

/**
 * What a store may be built with. Both implementations take the same options and mean the same
 * thing by them, because a lifetime that differs between them is a lifetime the tests do not cover.
 */
export interface StoreOptions {
  /**
   * How long a bearer token survives WITHOUT BEING USED. Defaults to `DEFAULT_SESSION_TTL_MS`.
   * See `auth/tokens.ts` for why it is idle time and not absolute age.
   */
  sessionTtlMs?: number;
  /**
   * The clock, injectable so a test can reach an expiry that is six months away in production.
   * Everything time-dependent in a store reads from here rather than calling `Date.now()` directly
   * — including the values it writes, so an injected clock governs both sides of a comparison.
   */
  now?: () => number;
  /**
   * Upper bound on the connection pool, for the implementations that have one.
   *
   * Stated rather than inherited from the driver. Postgres refuses at `max_connections` (100 in the
   * shipped image) with "sorry, too many clients already", which arrives as a FATAL on a connection
   * the app was in the middle of using — so the failure is not "the pool is busy", it is requests
   * dying. A number here is one that can be reasoned about against that limit; a driver default is
   * one that changes when the driver does.
   */
  maxConnections?: number;
}

/** What `addSubscriber` found or created. */
export interface SubscriberUpsert {
  /**
   * The capability that turns this pending row into a subscriber.
   *
   * NULL when the address is already confirmed. That is the signal not to send anything: a
   * "you are already on the list" email is unsolicited mail to somebody who did not ask for it
   * this time, and answering the form differently for a known address makes the endpoint an
   * oracle for who is on the list.
   */
  confirmToken: string | null;
  /** The capability that removes the address. Carried in every message the list ever sends. */
  unsubscribeToken: string;
  /** True when this call created the row. */
  created: boolean;
}

export interface Store {
  // ── Identity ───────────────────────────────────────────────────────────────────────────────
  /** Find or create the user behind a device id. Returns whether the row was created. */
  upsertDeviceUser(deviceId: string, lang: Lang): Promise<{ userId: string; created: boolean }>;
  /** Create a bare account with no device — a user who signed in with Apple/Google on a fresh install. */
  createUser(lang: Lang): Promise<string>;
  /**
   * Mint a bearer token for a user, and return it.
   *
   * This is the ONLY moment the token exists in a readable form on this side of the wire. What the
   * store keeps is `hashToken()` of it — see `auth/tokens.ts` — so nothing that can read the
   * database, a dump, or a backup can present a token back.
   */
  issueToken(userId: string): Promise<string>;
  /**
   * Resolve a bearer token to a user id, or null. The ONLY way a request becomes a userId.
   *
   * Null covers three cases the caller must NOT be able to tell apart: never issued, revoked, and
   * idle past its lifetime. All three mean "not authenticated", and a caller that could distinguish
   * them would be an oracle for which tokens have ever existed.
   *
   * A successful lookup slides the token's deadline forward, so a session in daily use never
   * expires and one on a phone nobody opens again does.
   */
  userIdForToken(token: string): Promise<string | null>;
  /** Drop one token. Sign-out — the account and its data are untouched. */
  revokeToken(token: string): Promise<void>;
  /**
   * Delete every token that is past its idle lifetime. Returns how many went.
   *
   * Called at startup and again whenever a token is issued, which is rare enough to be free and
   * frequent enough to keep the table bounded without a scheduler this process does not have.
   * Expired rows are already refused by `userIdForToken`; this is about not keeping a row that
   * names a user and a login time for years after it stopped meaning anything.
   */
  pruneExpiredTokens(): Promise<number>;

  // ── Federated identities ───────────────────────────────────────────────────────────────────
  /** The account behind a verified `(provider, subject)`, or null. */
  userIdForIdentity(provider: Provider, subject: string): Promise<string | null>;
  /** Attach a verified identity to an account. Unique on `(provider, subject)`. */
  addIdentity(userId: string, provider: Provider, subject: string): Promise<void>;
  /** What is linked to this account — for the settings screen, and for the merge guard. */
  listIdentities(userId: string): Promise<{ provider: Provider; linkedAt: string }[]>;
  /**
   * Move everything owned by `fromUserId` onto `intoUserId`, then delete the empty account.
   * Returns the number of meals moved.
   *
   * Called in exactly one situation: an ANONYMOUS session signs in with an identity that already
   * has an account. Merging two real accounts is a different problem and is not attempted — the
   * caller checks that before getting here.
   */
  mergeUsers(fromUserId: string, intoUserId: string): Promise<number>;

  // ── Profile ────────────────────────────────────────────────────────────────────────────────
  getProfile(userId: string): Promise<Profile | null>;
  patchProfile(userId: string, patch: ProfilePatch): Promise<Profile>;

  // ── The paid tier ──────────────────────────────────────────────────────────────────────────
  //
  // Stored per user because that is what it is, and stored as the RESOLVED STATE rather than as a
  // log of store events. The question anything here ever asks is "is this account paid right now";
  // keeping the event history would be keeping a second, richer copy of something RevenueCat
  // already keeps properly, in a table nothing reads.
  //
  // It lives on the user row, so deleting an account deletes it with everything else. There is no
  // subscription row that outlives the person, which matters: the row would name an Apple
  // transaction belonging to somebody who asked to be erased.

  /** What this account has bought, or null when it has never bought anything. */
  getEntitlement(userId: string): Promise<StoredEntitlement | null>;
  /**
   * Record what a store event says, and answer whether it was applied.
   *
   * FALSE has two meanings and both are ordinary: there is no such user (RevenueCat can name an id
   * this server has never seen), or the stored state came from a LATER event than this one.
   *
   * That second guard is the important one. Webhook delivery is not ordered, so a cancellation
   * that was generated before a renewal can arrive after it, and applying it would revoke a
   * subscription somebody is paying for — silently, since nothing in the app says why. This is the
   * same rule `weight_measured_at` enforces for Apple Health: the newer MEASUREMENT wins, not the
   * later write.
   */
  putEntitlement(userId: string, entitlement: StoredEntitlement): Promise<boolean>;

  // ── Onboarding ─────────────────────────────────────────────────────────────────────────────
  /**
   * The admin-edited onboarding copy, or null when nothing has ever been saved.
   *
   * Null is a real answer, not an error: a fresh database has no row, and the engine answers with
   * `DEFAULT_ONBOARDING_CONTENT` rather than refusing. Seeding on boot would work too and is worse
   * — it makes "has an admin ever touched this?" unanswerable.
   */
  getOnboardingContent(): Promise<OnboardingContent | null>;
  /** Replace it. Validated by the caller — the store writes what it is given. */
  putOnboardingContent(content: OnboardingContent): Promise<void>;
  /**
   * Append funnel events, ignoring ids already stored. Returns how many were new.
   *
   * Idempotent on `event.id` because the app retries a batch it could not confirm, and a funnel
   * that double-counts a bad connection reports its best numbers for its worst users.
   */
  recordOnboardingEvents(userId: string, events: OnboardingEvent[]): Promise<number>;
  /** The funnel over the last `days`, aggregated. Reads every user — this is the admin's view. */
  onboardingFunnel(days: number): Promise<FunnelAggregate>;

  // ── The mailing list ───────────────────────────────────────────────────────────────────────
  //
  // Not scoped by `userId`, and that is the one place in this interface where that is correct: a
  // subscriber is not an account. Nothing joins these rows to `users`, so the app's "we never store
  // an email address" stays true of the app, and leaving the list does not require having one.

  /**
   * Record an address as PENDING, or return what is already known about it.
   *
   * Idempotent on the address, which is the primary key. A second submission returns the tokens
   * already issued rather than a second row — so a double-tapped button, or somebody subscribing
   * twice a month apart, cannot produce two entries with two tokens of which only one unsubscribes
   * them.
   *
   * A row here is NOT a subscriber. It becomes one when `confirmSubscriber` is called with the
   * confirmation token, and until then it is an address somebody typed into a form, which is not
   * the same thing as consent — see `engine/subscribe.ts`.
   */
  addSubscriber(email: string, source: string): Promise<SubscriberUpsert>;
  /**
   * Turn a pending row into a subscriber, by its confirmation token.
   *
   * Returns false for an unknown token. Idempotent for a known one: clicking the link twice says
   * the same thing both times, exactly as unsubscribing does.
   */
  confirmSubscriber(confirmToken: string): Promise<boolean>;
  /** Removes by unsubscribe token. False when unknown — already gone, or never valid. */
  removeSubscriber(token: string): Promise<boolean>;
  /**
   * Rows added at or after `sinceIso`, CONFIRMED OR NOT.
   *
   * Counting only the confirmed ones would be a cap a bot walks straight through: submitting is
   * what costs the server something — a row and an outbound email — and confirming is the part an
   * abuser never does.
   */
  countSubscribersSince(sinceIso: string): Promise<number>;
  /**
   * Delete pending rows created before `beforeIso`. Returns how many went.
   *
   * The point is not tidiness. An address that was typed into a form and never confirmed is
   * personal data held with no basis whatsoever — quite possibly somebody else's address, typed by
   * a stranger — and the only defensible thing to do with it is to stop having it.
   */
  pruneUnconfirmedSubscribers(beforeIso: string): Promise<number>;

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
  /**
   * Every analysis this account has EVER spent, photo or text. The sample rule reads it: one
   * analysis without an entitlement, then refusal. Lifetime and both scopes on purpose — a typed
   * meal is the sample as much as a photographed one, or a sentence is the free way around the ask.
   */
  countUserAnalyses(userId: string): Promise<number>;
  /** Recorded BEFORE the model is called: a failed call still costs money. */
  recordAnalysis(userId: string, date: string, scope: "photo" | "text"): Promise<void>;

  // ── Health ─────────────────────────────────────────────────────────────────────────────────
  //
  // Daily aggregates read off the user's phone. Scoped like everything else, and stored as one row
  // per `(user_id, date)` — never as raw samples, which this product has no use for and which would
  // be a large pile of special-category data whose only property is risk.

  /**
   * Upsert a batch of days. Returns how many rows were written.
   *
   * Idempotent on `(user_id, date)` because the app re-reads a rolling window on every sync: health
   * data arrives late — a scale that syncs hours after the weigh-in, sleep written the following
   * morning, a watch backfilling a week — so a sync that only looked forward would miss all three.
   * Re-sending a day must correct it, not double it.
   *
   * A LATER read wins over an earlier one for the same day, wholesale. The phone aggregates from
   * the full window each time, so the newest batch is the most complete view of that day rather
   * than a delta to merge.
   */
  putHealthDays(userId: string, days: HealthDay[]): Promise<number>;
  /** Scoped. `since` inclusive, most recent first — the same shape as `totalsSince`. */
  healthDaysSince(userId: string, since: string): Promise<HealthDay[]>;

  // ── Erasure ────────────────────────────────────────────────────────────────────────────────
  /**
   * Full account deletion. Everything, not a soft-delete flag.
   *
   * That INCLUDES the account's onboarding funnel rows, and the analytics cost of losing them is
   * accepted deliberately. Onboarding copy tells the user "deleting your account erases it" while
   * they are answering questions about their kidneys; keeping a per-user row of how they moved
   * through those questions would make that sentence false. The funnel is a tool, the promise is
   * not negotiable.
   */
  deleteUser(userId: string): Promise<void>;

  close(): Promise<void>;
}

/** A blank profile for a freshly created user. Every answerable field starts null — onboarding is
 *  field-derived, so "never asked" must be distinguishable from "answered". */
export function blankProfile(userId: string, lang: Lang): Profile {
  return {
    user_id: userId, lang, goal: null, sex: null, birth_year: null, height_cm: null,
    weight_kg: null, weight_measured_at: null, target_weight_kg: null, activity: null, pace: null,
    country: null,
    restrictions: [], medical_limitations: null, food_allergies: null, product_limitations: null,
    onboarded_at: null,
  };
}
