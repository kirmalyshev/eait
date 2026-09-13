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
  DayTotals, HealthDay, Lang, MealAnalysis, MealRecord, NotificationCopy, OnboardingContent,
  OnboardingEvent, Profile, Provider, ChatEvent, ChatSpeaker } from "@eait/shared";
import type { RouteResult } from "./llm/port.ts";

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
 * What is stored about an account's paid tier: the two grants, kept apart.
 *
 * A customer can hold BOTH — a subscription with a period, and the lifetime unlock with none —
 * because every product grants the same entitlement. One field cannot carry both: it did once, and
 * refunding a lifetime then revoked a monthly plan that was still paid for.
 *
 * Turn this into a yes/no with `entitlementLive` from `@eait/shared` and with nothing else.
 * `entitlementActive` answers only the subscription half, and a lifetime holder reads as unentitled
 * through it — which is exactly the mistake the Postgres reader made in its first version.
 *
 * `productId` decides nothing and is kept anyway, because the first support question about a charge
 * is "what did they actually buy" and the alternative is asking the person to read it off their
 * Apple receipt. `eventAt` is the instant the STORE generated the event, never the instant we
 * received it: it is what makes out-of-order delivery safe. See `putEntitlement`.
 */
export interface StoredEntitlement {
  /** When the SUBSCRIPTION lapses. Null when this account has never held one. */
  expiresAt: string | null;
  /** The product that bought the perpetual unlock, or null if there is none. */
  lifetimeProductId: string | null;
  /** The product named by the most recently APPLIED delivery, in arrival order. Decides nothing. */
  productId: string;
  /** When the store generated that event — the ordering key. */
  eventAt: string;
  /** Whether the current subscription period is a free trial. Absent on rows written before the
   *  field existed; both implementations read that back as false. See `EntitlementPatch.trial`. */
  trial?: boolean;
}

/**
 * One event's effect: set the subscription's end, or set/clear the lifetime unlock, never both.
 *
 * Undefined means LEAVE ALONE, and that is the whole point. A monthly renewal says nothing about a
 * lifetime unlock and must not touch it; a lifetime refund says nothing about a subscription that
 * is still running and must not end it.
 */
export interface EntitlementPatch {
  /** The subscription's new end. Undefined leaves the stored one untouched. */
  expiresAt?: string;
  /**
   * The product granting the perpetual unlock, or null to clear it. Undefined leaves it untouched.
   *
   * Clearing is CONDITIONAL on the stored unlock having come from this same product, checked inside
   * the write — a subscription's cancellation must not revoke a lifetime somebody bought.
   */
  lifetimeProductId?: string | null;
  productId: string;
  eventAt: string;
  /**
   * Whether the period this event describes is a FREE TRIAL (RevenueCat's `period_type`).
   *
   * Kept because nothing else can reconstruct it. An expiry seven days out and an expiry a year out
   * are the same shape, so two days before a yearly renewal is indistinguishable from two days
   * before a trial ends — and the trial reminders would fire before every renewal, telling somebody
   * who pays that "the free week ends" and that stopping now costs nothing.
   *
   * Optional so a row written before this existed reads as `false`: a reminder that does not arrive
   * is a smaller failure than a wrong one that does.
   */
  trial?: boolean;
}

/** The one platform there is. On the wire and in the row, so adding Android is not a migration. */
export type PushPlatform = "ios";

/** One device this account can be reached on. */
export interface PushToken {
  token: string;
  platform: PushPlatform;
}

/** A line to append to the thread. The shapes are the wire's (`ChatEntry`), minus what the store assigns. */
/** What the router decided a user's words were — the branch the turn took (#486). */
export type ChatIntent = RouteResult["intent"];

export type ChatAppend =
  | { role: "user"; kind: "text"; text: string; clientId?: string | null; pendingId?: string | null; intent?: ChatIntent | null; analysisId?: string | null }
  /** No bytes, ever. `text` is the caption, if there was one; `mealId` the meal it logged, so the bubble can show it. */
  | { role: "user"; kind: "photo"; text: string | null; mealId?: string | null; analysisId?: string | null }
  | { role: "assistant"; kind: "text"; text: string; speaker?: ChatSpeaker | null; model?: string | null }
  | { role: "assistant"; kind: "meal"; mealId: string; event: ChatEvent };

/** A stored line. `seq` is the paging cursor: monotonic per STORE, never reused — so its gaps reflect every account's writes, and it is on the wire as an opaque cursor, not as a count. */
export interface ChatMessage {
  id: string;
  userId: string;
  seq: number;
  ts: string;
  role: "user" | "assistant";
  kind: "text" | "photo" | "meal";
  text: string | null;
  mealId: string | null;
  event: ChatEvent | null;
  /** The phone's id for the turn, on a user text line; null otherwise. */
  clientId: string | null;
  /** On the user line of a proposal: the proposal's id, which is the meal's id once confirmed. */
  pendingId: string | null;
  /** On an assistant text line: who said it. Null is Spud, so every line from before Gabie stays his. */
  speaker: ChatSpeaker | null;
  /** On a user text line the router read: what it decided the words were. Null anywhere else, and before #486. */
  intent: ChatIntent | null;
  /** On an assistant text line a model wrote: which model. Null is code — a scripted line — or before #486. */
  model: string | null;
  /** On the user line that opened a charged turn: the analysis that paid for it. Null anywhere else, and before #525. */
  analysisId: string | null;
}

/**
 * What an edit may change on a stored meal.
 *
 * `verdicts` is here because the ENGINE recomputes it on every write — no caller supplies one.
 * `date` is here for the re-date path ONLY; `EditMealRequest` deliberately has no date field, so a
 * manual edit cannot reach it and the "a meal moves days only by asking" rule holds by typing
 * rather than by convention. `question` is here so the write that answers it is the write that
 * clears it: one question per meal, asked once, and never two statements that can disagree.
 */
export type MealPatch = Partial<
  Pick<MealRecord,
    "items" | "kcal" | "protein_g" | "carbs_g" | "fat_g" | "satfat_g" | "fiber_g" | "sugar_g" |
    "sodium_mg" | "verdicts" | "notes" | "corrected" | "date" | "question" | "model" | "confidence">
>;

/** One stored photo of a meal. `position` is its order on the plate, 0-based, as uploaded. */
export interface StoredPhoto {
  position: number;
  mime: string;
  bytes: Uint8Array;
}

/**
 * One measurement of how this person's portions differ from the model's first read.
 *
 * `name_en` is the item's canonical English name, or its display name when it carried none — the
 * same key `buildRepertoire` groups by, so the two priors talk about the same foods.
 */
export interface PortionCorrection {
  name_en: string;
  grams_before: number;
  grams_after: number;
}

/** What those corrections add up to for one food. */
export interface PortionPrior {
  name: string;
  /** Median `grams_after / grams_before`: 1.4 means this person's portion runs 40% over the read. */
  ratio: number;
  /** How many corrections it was computed from. The list is ordered by this, most corrected first. */
  n: number;
}

/** Defaults for `portionPriors`, applied in `portionPriorsFrom` so both stores mean the same thing. */
export const PORTION_PRIOR_MIN_COUNT = 3;
export const PORTION_PRIOR_LIMIT = 10;
/**
 * How many corrections either store reads back before computing the prior, most recent first.
 *
 * A bound rather than the whole table, because this read is on the path of every billed photo and
 * the table only ever grows. Recency is the right thing to drop, too: a portion habit from a year
 * ago is not evidence about the plate in front of the camera today.
 */
export const PORTION_PRIOR_ROWS = 500;

/**
 * The prior, computed from raw rows — in TypeScript, for BOTH implementations.
 *
 * A median Postgres interpolates (`percentile_cont`) and a median a hand-written reducer picks are
 * two different numbers on every even-sized sample, and this one changes the grams the model
 * answers with. So neither store computes it: they fetch rows and call this. Same reason
 * `aggregateFunnel` exists, and the funnel's median is where that lesson was learned.
 */
export function portionPriorsFrom(
  rows: readonly PortionCorrection[],
  minCount = PORTION_PRIOR_MIN_COUNT,
  limit = PORTION_PRIOR_LIMIT,
): PortionPrior[] {
  const byName = new Map<string, number[]>();
  for (const r of rows) {
    const ratios = byName.get(r.name_en) ?? [];
    ratios.push(r.grams_after / r.grams_before);
    byName.set(r.name_en, ratios);
  }
  const out: PortionPrior[] = [];
  for (const [name, ratios] of byName) {
    if (ratios.length < minCount) continue;
    ratios.sort((a, b) => a - b);
    const mid = ratios.length >> 1;
    out.push({
      name,
      ratio: ratios.length % 2 === 1 ? ratios[mid]! : (ratios[mid - 1]! + ratios[mid]!) / 2,
      n: ratios.length,
    });
  }
  // The name settles ties, so the two stores answer in one order whatever order their rows arrive in.
  return out.sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, limit);
}

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

/**
 * What an account is allowed to be.
 *
 * SERVER STATE, and deliberately not in `shared`: the phone has no use for the word, and a
 * type both sides import is a type the client eventually sends. It is also deliberately NOT a
 * field on `Profile` — see `roleOf` below.
 */
export type Role = "user" | "admin";

/**
 * One account as the admin's list shows it (#374).
 *
 * RAW, and computing nothing. Whether an entitlement is LIVE is `entitlementLive`'s answer and the
 * engine's to ask — a store that decided it here would be a second definition of "paid", and the
 * panel and the refusal would eventually disagree about one account.
 */
export interface AdminUserRow {
  userId: string;
  createdAt: string;
  onboardedAt: string | null;
  /** Every provider linked to the account, oldest link first. `device` is an anonymous install. */
  providers: Provider[];
  /** The address the oldest identity carrying one vouches for, or null. */
  email: string | null;
  /** What the account has bought, or null. Read `entitlementLive` for whether it is live. */
  entitlement: StoredEntitlement | null;
  /** The account's own sample size, or null when it takes the instance default. */
  freeAnalyses: number | null;
  /** Analyses of BOTH scopes on the day asked for — the sample counts a typed meal too. */
  analysesToday: number;
  /** Every analysis this account has ever spent. The number the sample is spent against. */
  spent: number;
  /** The most recent use of any of this account's sessions, or null if it has never held one. */
  lastSeen: string | null;
}

/** What the admin's list was asked for. */
export interface AdminUserQuery {
  /**
   * An exact address or an id PREFIX. Anything else matches nothing.
   *
   * Never a substring and never a `LIKE '%…%'`: both are a scan of every account on the box that
   * serves the app, and the questions this exists for — "which account is this support email",
   * "is this the id in the crash report" — are both answered by an index seek.
   */
  q?: string;
  limit: number;
  /** The last row of the previous page, opaque. Keyset, never an offset — see the contract test. */
  cursor?: string;
  /** The instance's today, in its own timezone. Passed in, because a store has no calendar. */
  today: string;
}

export interface AdminUserPage {
  rows: AdminUserRow[];
  /** Null when this was the last page. */
  nextCursor: string | null;
}

/** Nothing may ask for a bigger page than this, whatever it passes. */
export const ADMIN_USER_PAGE_MAX = 200;

/**
 * The longest window the metrics may cover, whatever is asked for.
 *
 * Just over a year, so "the same week last year" is reachable and a runaway parameter is not a scan
 * of a table that only grows.
 */
export const ADMIN_METRICS_MAX_DAYS = 400;

export interface AdminMetricsQuery {
  /** How many days back, ending today. Bounded by the caller AND by the implementation. */
  days: number;
  /** The instance's today. A store has no calendar. */
  today: string;
  /** The instance's zone, for turning `users.created_at` into the same day `analyses.date` is. */
  timezone: string;
}

/** One day, on the instance's own calendar. */
export interface AdminDay {
  date: string;
  /** Accounts created that day — every account, including the anonymous ones a device auth mints. */
  signups: number;
  /** Accounts that FINISHED onboarding that day. A signup is not a user of anything yet. */
  activations: number;
  /** Analyses spent that day, both scopes — what the bill and `globalDailyAnalysisCap` count. */
  analyses: number;
  /**
   * What the provider said that day's analyses cost, in US dollars, or null when it priced none.
   * A FLOOR whenever `unpriced` is not zero. Never a local price table (#484).
   */
  costUsd: number | null;
  /** Analyses that day with a call the provider did not price — a timeout, an error, or before #484. */
  unpriced: number;
}

/**
 * How many accounts came back, and what "came back" is allowed to mean.
 *
 * IT MEANS "SPENT AN ANALYSIS", and that is narrower than opening the app. It is also the only
 * thing this database can answer historically: `tokens.last_used_at` is slid forward on every
 * request and keeps only the LAST one, so it cannot say what happened on somebody's second day.
 * `analyses` has a row per billed call with the day on it, which is a trace that survives.
 *
 * `eligible` is the accounts that COULD have come back — created inside the window and at least N
 * days ago. Reporting a rate without it would count yesterday's signups as people who did not
 * return, which drags every number down as the product grows.
 */
export interface AdminReturn {
  eligible: number;
  returned: number;
}

export interface AdminMetrics {
  days: AdminDay[];
  d1: AdminReturn;
  d7: AdminReturn;
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
   *
   * `ttlMs` is THIS token's idle lifetime, and it is stored on the row. Absent means the store's
   * own `sessionTtlMs`, which is what the phone gets. The browser's bearer passes
   * `BROWSER_SESSION_TTL_MS` (#407): it is re-minted from the session cookie on every page load,
   * so six idle months would be a credential nobody needs outliving the tab it was made for — and
   * it is minted on the origin that also serves the admin.
   */
  issueToken(userId: string, ttlMs?: number): Promise<string>;
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
  /**
   * The same row, plus WHEN it was linked.
   *
   * `linked_at` is what makes a revocation orderable. Apple's notifications carry no expiry and its
   * deliveries are not ordered, so the only thing separating "this user just revoked" from "this is
   * a copy of a message about a link that has since been replaced" is whether the event predates
   * the link it names. Same rule as `putEntitlement` and `weight_measured_at`: apply an event only
   * when it is newer than what is stored.
   */
  identityFor(
    provider: Provider,
    subject: string,
  ): Promise<{ userId: string; linkedAt: string; email: string | null } | null>;
  /** Attach a verified identity to an account. Unique on `(provider, subject)`. */
  addIdentity(userId: string, provider: Provider, subject: string): Promise<void>;
  /**
   * Record the address the provider vouched for on an identity this account already holds.
   *
   * SEPARATE FROM `addIdentity` because the address does not arrive with the link. Apple sends one
   * only on the FIRST authorization ever, and every account that signed in before the scope was
   * requested is already linked — so the only chance to store theirs is a later sign-in, which
   * takes the `switched` or `already` path and adds no identity at all. Google sends one every
   * time, which is also how a changed address catches up.
   *
   * SCOPED BY `userId` like every other write here. The subject comes out of a verified token and
   * the account comes out of the session; a row whose account disagrees is somebody else's, and
   * this writes nothing to it. A subject that is not linked at all is likewise a no-op — this
   * never creates an identity.
   *
   * Never called with an absent address: a returning Apple user's token carries none, and writing
   * that over a stored one would erase the only thing this column is for.
   */
  setIdentityEmail(
    userId: string,
    provider: Provider,
    subject: string,
    email: string,
  ): Promise<void>;
  /**
   * Detach one identity from one account AND delete the account when that was the last way into
   * it — as one atomic step. Idempotent, and SCOPED BY `userId` like every other write here.
   *
   * The scope is not decoration. This is reached from Apple's server-to-server notification, where
   * the subject arrives in a signed message rather than from a session — the caller resolves the
   * account from that subject and passes both, so a row can only ever be removed by the account
   * that owns it.
   *
   * THE DELETION IS HERE RATHER THAN IN THE ENGINE because "is anything else still linked" is a
   * read, and a read followed by a separate delete is two deliveries away from erasing an account
   * somebody can still reach: one removes the Apple row, the other then sees a single remaining
   * row, assumes it is the one it came to remove, and deletes a user whose device identity was
   * working. Asked as one step, the condition is "no identities at all", which no interleaving can
   * make wrong.
   *
   * `not-found` means the row was already gone — a concurrent delivery got there first. Nothing is
   * deleted in that case, and that guard is load-bearing: an account can legitimately hold zero
   * identities for a moment, and a conditional delete that ran anyway would erase it.
   *
   * ONE STEP MEANS A LOCK, not just a transaction. Postgres runs this at READ COMMITTED, where
   * every statement takes a fresh snapshot, so two removals of DIFFERENT rows on one account each
   * see the other's row and neither deletes the account — leaving one with no identity at all,
   * which no login path can reach and no deletion path can erase. The implementation takes the
   * account row `for update` first, which serialises those and also blocks a sign-in linking a
   * second provider from landing inside. A contract test runs two removals at once; the memory
   * store passed it for free and Postgres did not.
   */
  removeIdentity(
    userId: string,
    provider: Provider,
    subject: string,
  ): Promise<"removed" | "account-deleted" | "not-found">;
  /**
   * Drop every token of one account. Sign-out on every device the person ever used.
   *
   * `revokeToken` ends one session because someone pressed a button in it. This ends all of them
   * because the account's right to be signed in has been withdrawn — which is what revoking Sign
   * in with Apple means, and Apple's own guidance for receiving that notification.
   */
  revokeTokensFor(userId: string): Promise<void>;
  /** What is linked to this account — for the settings screen, and for the merge guard. */
  listIdentities(userId: string): Promise<{ provider: Provider; linkedAt: string }[]>;
  /**
   * The SUBJECT this account holds at one provider, or null (#246).
   *
   * SEPARATE FROM `listIdentities` for the same reason `emailForUser` is: that one feeds
   * `/v1/auth/identities`, which the APP reads, and a subject added to it is a provider's opaque
   * account id shipped to a phone that has no use for one. This is read on the server only, by the
   * unlink route, and only so that `removeIdentity` can be handed a subject the SERVER resolved —
   * the alternative being a subject out of a request body, which is the one thing that route may
   * never do.
   */
  identitySubject(userId: string, provider: Provider): Promise<string | null>;
  /**
   * THE ONE READ IN THIS PORT THAT IS NOT SCOPED TO A USER (#374). The admin's list of accounts.
   *
   * `AGENTS.md`: every read is scoped by a `userId` resolved from credentials. This one is not, and
   * that is why it has a name of its own rather than a relaxed `WHERE` on something the product
   * already calls — the widening is visible in this interface, proven by its own contract tests,
   * and reachable only from `adminRoutes`, which answers 404 to an account without the role.
   *
   * READ-ONLY, newest first, bounded by `ADMIN_USER_PAGE_MAX` whatever is asked for.
   */
  adminListUsers(query: AdminUserQuery): Promise<AdminUserPage>;
  /**
   * The account's sign-in address, or null — the oldest identity that carries one.
   *
   * SEPARATE FROM `listIdentities` ON PURPOSE, and it must stay separate. That one feeds
   * `/v1/auth/identities`, which the APP reads: adding an `email` field to it would put the address
   * on a phone, and the settings screen ships a promise that the address runs the account and
   * nothing else. This one is read on the server, by `/start` alone, and only its ANSWER — a
   * two-letter country code the user is about to be shown as an option — leaves the process.
   */
  emailForUser(userId: string): Promise<string | null>;

  // ── Pairing codes ──────────────────────────────────────────────────────────────────────────
  //
  // A short-lived credential an authenticated app session mints so that a BROWSER can be handed an
  // ordinary session on the same account. It is not an identity and it never becomes one: nothing
  // here creates a user, links a provider, or merges anything.
  //
  // Stored as a HASH, for the reason `auth/tokens.ts` gives about tokens — the nightly dump leaves
  // this box, and a column holding the eight characters a person types would make that file a way
  // into every account that is pairing right now.

  /**
   * Hold `codeHash` for `userId` until `expiresAt` (epoch ms), replacing whatever that account had.
   *
   * ONE LIVE CODE PER ACCOUNT is the point of the replacement, not an optimisation: a person who
   * presses the button twice because the first code did not arrive should be left with exactly the
   * code in front of them, and the one they walked away from should stop working immediately.
   *
   * Sweeps every expired row on the way through — the lazy sweep `issueToken` does, and for the
   * same reason: minting is rare, and this process has no scheduler.
   */
  putPairingCode(userId: string, codeHash: string, expiresAt: number): Promise<void>;
  /**
   * Spend a code: delete the row and return the account it named, or null.
   *
   * ONE GUARDED DELETE, like `dropPending`. Reading the row and then deleting it would be two
   * statements a second redemption can interleave between, and the thing being handed out twice is
   * a session on somebody's account.
   *
   * Null covers three cases the caller must not be able to tell apart: never minted, already
   * spent, and expired. An expired row is DELETED as it is refused, so a clock that moves backwards
   * cannot make it live again.
   */
  claimPairingCode(codeHash: string): Promise<string | null>;
  /**
   * Move everything owned by `fromUserId` onto `intoUserId`, then delete the empty account.
   * Returns the number of meals moved. Photos move with their meals.
   *
   * Called in exactly one situation: an ANONYMOUS session signs in with an identity that already
   * has an account. Merging two real accounts is a different problem and is not attempted — the
   * caller checks that before getting here.
   */
  mergeUsers(fromUserId: string, intoUserId: string): Promise<number>;

  // ── The role ───────────────────────────────────────────────────────────────────────────────
  //
  // #391a. The admin is becoming something an account carries rather than a shared secret typed
  // into a box, and these three are the whole of what the store knows about it.
  //
  // IT IS NOT PART OF `Profile`, and that is structural rather than stylistic. Postgres allowlists
  // the columns `patchProfile` may write; the memory store writes every key it is handed. A role
  // on the profile object would therefore be settable by a PATCH on one implementation and refused
  // on the other — a divergence in the one direction that matters. Keeping it out of `Profile`
  // means neither can write it, and a contract test says so.

  /** The account's role, or null if there is no such account. Never `undefined`. */
  roleOf(userId: string): Promise<Role | null>;
  /**
   * Grant or revoke, idempotently. `false` means there is no such account — nothing was created.
   *
   * A grant is an OUT-OF-BAND act: the caller is the boot-time bootstrap reading a UUID from
   * configuration, never a request. Nothing reachable from the network calls this.
   */
  setRole(userId: string, role: Role): Promise<boolean>;
  /**
   * Whether any admin exists at all.
   *
   * This is what lets the admin surface keep the property its shared-token version had: with
   * nobody holding the role, every path under it answers 404 rather than 403, because "there is an
   * admin and you cannot have it" is information. Deleting the last admin switches the surface off.
   */
  hasAdmin(): Promise<boolean>;

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
   * Clearing the lifetime unlock carries one more condition, enforced in the same statement rather
   * than by the caller: it applies only when the stored unlock came from the SAME product. A
   * subscription's cancellation must not revoke something bought outright.
   *
   * That second guard is the important one. Webhook delivery is not ordered, so a cancellation
   * that was generated before a renewal can arrive after it, and applying it would revoke a
   * subscription somebody is paying for — silently, since nothing in the app says why. This is the
   * same rule `weight_measured_at` enforces for Apple Health: the newer MEASUREMENT wins, not the
   * later write.
   */
  putEntitlement(userId: string, patch: EntitlementPatch): Promise<boolean>;

  // ── Push tokens ────────────────────────────────────────────────────────────────────────────
  //
  // One row per DEVICE, keyed on the token, because that is what an Expo push token is: an
  // installation, not an account. The same phone signing into a second account must MOVE the token
  // rather than gain a second row, or the evening sweep sends one person's day to the other's lock
  // screen — and the person who signed out has no way to notice.
  //
  // Erased with the account like everything else that names a device. A token this server keeps is
  // a message it will try to send.
  //
  // THE RESIDUAL RISK, STATED. Because the token is the key and the upsert moves it, ANY account
  // can claim ANY device by registering a token it has learned — and an Expo push token is not a
  // strong secret: it is handed to the client and routinely ends up in client logs and analytics
  // payloads. The victim silently stops receiving their own 20:30 line until their next launch, and
  // until then the claimer's numbers arrive on the victim's lock screen. It is accepted rather than
  // fixed because the move is what makes signing out and in on one device work, and nothing in the
  // request can tell the two apart. The real control is the app sending the value it last
  // registered and the server refusing a move whose predecessor does not match — a feature, not a
  // guard, and not in this change. The per-address rate limit on the route bounds the rate at which
  // guesses can be tried; it does not make a known token safe.

  /**
   * Register a device's push token for an account. Idempotent per token: the app re-registers on
   * every launch, because a token changes on reinstall, on a restore from backup, and whenever
   * Apple reissues one.
   */
  putPushToken(userId: string, token: string, platform: PushPlatform): Promise<void>;
  /** Scoped. True when this call removed one of THIS account's tokens. */
  dropPushToken(userId: string, token: string): Promise<boolean>;
  /** Scoped. Every device this account can be reached on. */
  pushTokensFor(userId: string): Promise<PushToken[]>;
  /**
   * Every account with at least one device, for the nightly sweep. Reads across users — the one
   * other place in this interface that does, and it is the same kind of read as `onboardingFunnel`.
   *
   * Ids only, and no paging: at one row per installed app this is a list of strings, and the sweep
   * that consumes it does the per-user work one account at a time. It is the thing to revisit
   * first if this product ever has enough users for a list of their ids to be a problem.
   */
  usersWithPushTokens(): Promise<string[]>;

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

  // ── Notification copy ──────────────────────────────────────────────────────────────────────
  //
  // The same shape as the onboarding copy above, and for the same reason: the words are editable
  // in the admin, the shape is not, and null means "no admin has ever touched this" rather than
  // "broken". Its own row rather than a field on the onboarding content, because the two are edited
  // by different screens and a save of one must not be able to overwrite the other.

  /** The admin-edited notification copy, or null when nothing has ever been saved. */
  getNotificationCopy(): Promise<NotificationCopy | null>;
  /** Replace it. Validated by the caller — the store writes what it is given. */
  putNotificationCopy(copy: NotificationCopy): Promise<void>;
  /**
   * Append funnel events, ignoring ids already stored. Returns how many were new.
   *
   * Idempotent on `event.id` because the app retries a batch it could not confirm, and a funnel
   * that double-counts a bad connection reports its best numbers for its worst users.
   */
  recordOnboardingEvents(userId: string, events: OnboardingEvent[]): Promise<number>;
  /** The funnel over the last `days`, aggregated. Reads every user — this is the admin's view. */
  onboardingFunnel(days: number): Promise<FunnelAggregate>;
  /**
   * The numbers past the funnel (#377), over a window. Reads every user, like `onboardingFunnel`.
   *
   * THE SECOND UNSCOPED READ IN THIS PORT, and named like the first (`adminListUsers`) for the same
   * reason: an aggregate is still a query over other people's rows, so the widening is visible in
   * this interface and reachable only from `adminRoutes`.
   *
   * THE TIMEZONE IS AN ARGUMENT because the day is the PRODUCT's day. `analyses.date` is already a
   * calendar date in the instance's zone, and `users.created_at` is an instant — counting signups
   * by its UTC date and analyses by their local one would put the two on different calendars, and
   * the gap only shows up as a row that does not add up, hours either side of midnight.
   */
  adminMetrics(query: AdminMetricsQuery): Promise<AdminMetrics>;

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
  /** False when a meal with this id already exists — a confirm racing itself; the first one won. */
  insertMeal(record: MealRecord): Promise<boolean>;
  /** Scoped: another user's meal id resolves to null, not to their row. */
  getMeal(userId: string, mealId: string): Promise<MealRecord | null>;
  /** Scoped, several at once; ids that are not this user's are simply absent. Any order. */
  getMeals(userId: string, mealIds: string[]): Promise<MealRecord[]>;
  /** Scoped. Returns null when the row vanished between lookup and write (a delete race). */
  updateMeal(userId: string, mealId: string, patch: MealPatch): Promise<MealRecord | null>;
  /** The meal and its photos (#608). True when this call removed the caller's meal. */
  deleteMeal(userId: string, mealId: string): Promise<boolean>;
  mealsForDate(userId: string, date: string): Promise<MealRecord[]>;
  /**
   * The meals dated within `[from, to]`, both inclusive, NEWEST first, at most `limit`.
   *
   * The coach's window onto what was actually eaten — dishes, not sums — for "what did I have
   * last week that ran the sodium up". Bounded by the caller and by the store both: the bound
   * keeps the newest rows, because a question about lately is a question about the near end.
   */
  mealsSince(userId: string, from: string, to: string, limit: number): Promise<MealRecord[]>;

  // ── Photos ─────────────────────────────────────────────────────────────────────────────────
  /**
   * Keep a logged meal's photos, in upload order, and set `meals.photos` to the count. Writes
   * NOTHING when the meal is not the caller's. Idempotent per position.
   */
  putPhotos(userId: string, mealId: string, photos: { mime: string; bytes: Uint8Array }[]): Promise<void>;
  /**
   * Add more angles to a meal that already has some, AFTER the ones it holds. Returns the new
   * count; 0 when the meal is not the caller's, so nothing was written.
   *
   * Separate from `putPhotos` rather than a flag on it, because the two want opposite things and
   * one of them is load-bearing: the log path writes positions from 0 and must stay idempotent per
   * position, while appending is by definition not idempotent — calling it twice adds twice, which
   * is what a second photo of one plate means. Making `putPhotos` offset by the current count would
   * have given the log path the append behaviour too, silently.
   */
  appendPhotos(userId: string, mealId: string, photos: { mime: string; bytes: Uint8Array }[]): Promise<number>;
  /** Scoped: another user's meal id is an empty list. Position ascending. */
  getPhotos(userId: string, mealId: string): Promise<StoredPhoto[]>;
  /** Scoped: null for another user's meal, and for a position that does not exist. */
  getPhoto(userId: string, mealId: string, position: number): Promise<StoredPhoto | null>;
  /** Most recent first, `since` inclusive. Feeds the week view and the chat router's context. */
  totalsSince(userId: string, since: string): Promise<DayTotals[]>;

  // ── Portion corrections ────────────────────────────────────────────────────────────────────
  //
  // Every time a user changes an item's grams they are measuring the gap between their portion and
  // the model's first read of it. Kept as raw pairs rather than as a running ratio: the summary is
  // a median, and a median cannot be updated in place without keeping what it was computed from.

  /**
   * Record what an edit changed. Scoped, and never a reason for the edit to fail — the caller logs
   * a failure and carries on, because a lost measurement is worth less than the correction itself.
   */
  recordPortionCorrections(userId: string, rows: PortionCorrection[]): Promise<void>;
  /**
   * What this user's own corrections say about their portions, most corrected first.
   *
   * `minCount` is the evidence bar: below it a "prior" is one afternoon's typo fed back into every
   * later estimate. Both stores read raw rows and hand them to `portionPriorsFrom`, so the number
   * that reaches the prompt cannot depend on which implementation is running.
   */
  portionPriors(userId: string, minCount?: number, limit?: number): Promise<PortionPrior[]>;

  // ── The thread ─────────────────────────────────────────────────────────────────────────────
  /**
   * Append lines, in order, as ONE write. A photo bubble and its card are one moment; two writes
   * could leave the bubble without the card, or interleave with a chat turn from the same account.
   * `seq` and `ts` are the store's; the caller never orders the thread.
   */
  appendChat(userId: string, lines: ChatAppend[]): Promise<void>;
  /** Scoped. Newest first, `seq < before` (all when null), at most `limit`. */
  chatBefore(userId: string, before: number | null, limit: number): Promise<ChatMessage[]>;
  /** Lines this account has in the thread. `remember` and `appendLines` refuse past the bound. */
  countUserChat(userId: string): Promise<number>;
  /** One line by id, the caller's or null (#608): another account's id is indistinguishable from none. */
  getLine(userId: string, lineId: string): Promise<ChatMessage | null>;
  /** The caller's photo line for a meal, or null: where the caption an edit re-reads with lives. */
  photoLineFor(userId: string, mealId: string): Promise<ChatMessage | null>;
  /** True when this call removed the caller's line. */
  deleteLine(userId: string, lineId: string): Promise<boolean>;
  /** Every `kind: "meal"` line for the caller's meal; how many went. The engine cascades, not the schema, so the memory store cannot drift from Postgres. */
  deleteMealLines(userId: string, mealId: string): Promise<number>;
  /** True when the caller's line existed and now holds `text`. */
  updateLineText(userId: string, lineId: string, text: string | null): Promise<boolean>;
  /**
   * True exactly once per account: the first verdict is spoken by whoever wins this. An atomic
   * claim, not a count — two first meals racing, or a first meal dated to another day, would
   * otherwise burn or double the one greeting. Goes with the account.
   */
  claimFirstVerdict(userId: string): Promise<boolean>;
  /** Give the claim back — the greeting could not be written, so the next meal may take it. */
  releaseFirstVerdict(userId: string): Promise<void>;

  // ── Pending text meals ─────────────────────────────────────────────────────────────────────
  putPending(pending: PendingMeal): Promise<void>;
  getPending(userId: string, pendingId: string): Promise<PendingMeal | null>;
  /**
   * The account's LIVE proposals, oldest first (#530): what a page that lost its card reads back.
   * Scoped by `user_id` like every read here, and never an expired row, which nobody may confirm.
   */
  pendingsFor(userId: string): Promise<PendingMeal[]>;
  /** True when this call removed a LIVE row. The drop is the CLAIM on a proposal: confirm and cancel both take it first, and whoever gets false lost the race — or found it expired, which nobody may claim. */
  dropPending(userId: string, pendingId: string): Promise<boolean>;
  /**
   * Delete every proposal past its expiry. Returns how many went. A proposal nobody confirmed or
   * cancelled is never read again, so `getPending`'s lazy delete never reaches it; the rows are an
   * analysis and a date that stopped meaning anything. Swept at startup and with every new
   * proposal; there is no scheduler in this process.
   */
  pruneExpiredPendings(): Promise<number>;

  // ── Caps ───────────────────────────────────────────────────────────────────────────────────
  /**
   * PHOTO analyses this user has spent on `date` — text turns are excluded on purpose.
   *
   * The per-user cap is a photo allowance. If chat counted against it, asking "how much protein
   * have I had" would cost the user a meal they could have logged, which quietly teaches people
   * not to use the chat. The global budget counts both, because both cost money.
   */
  countUserPhotos(userId: string, date: string): Promise<number>;
  /** Every analysis the instance has spent on `date`, whatever its scope — see `recordAnalysis`. */
  countGlobalAnalyses(date: string): Promise<number>;
  /**
   * Every analysis this account has EVER spent, photo or text. The sample rule reads it: one
   * analysis without an entitlement, then refusal. Lifetime and both scopes on purpose — a typed
   * meal is the sample as much as a photographed one, or a sentence is the free way around the ask.
   */
  countUserAnalyses(userId: string): Promise<number>;
  /**
   * This account's OWN sample size, or null when it takes the instance default
   * (`config.freeAnalyses`). Written by the admin only — there is no client route to it.
   */
  getFreeAnalyses(userId: string): Promise<number | null>;
  /** Set this account's own sample size, or clear it with null. False when there is no such user. */
  setFreeAnalyses(userId: string, n: number | null): Promise<boolean>;
  /** Recorded BEFORE the model is called: a failed call still costs money. Returns the row's id. */
  recordAnalysis(userId: string, date: string, scope: "photo" | "text"): Promise<string>;
  /**
   * Add what one model call cost to the analysis that paid for it, as the provider reported it —
   * or, given null, count a call it did not price. ADDED, because one charge pays for several calls
   * and they land in any order. Scoped `id = ? AND user_id = ?`; false when no such row is theirs.
   */
  addCost(userId: string, analysisId: string, usd: number | null): Promise<boolean>;
  /**
   * What each of these analyses cost, for the admin's thread (#525). Scoped: only this account's
   * rows, and an id with no row — refunded, or not theirs — is simply absent, never a zero.
   */
  analysisCosts(userId: string, analysisIds: string[]): Promise<{ id: string; costUsd: number | null; unpricedCalls: number }[]>;
  /**
   * Give back the analysis a refused turn charged. True when that row was deleted, false when there
   * was nothing to give.
   *
   * The counterpart to charging before the call: a gateway refusal that generated nothing was
   * billed nothing, so the account keeps its analysis. Deletes the ONE row the turn charged, scoped
   * `id = ? AND user_id = ?` — never the newest of its day, which a concurrent turn on the same
   * scope may own, cost and all (#537).
   */
  undoAnalysis(userId: string, analysisId: string): Promise<boolean>;

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
  /**
   * Delete every health row dated before `before`, for EVERY account. Returns how many went.
   *
   * The one write in this port that is not scoped by `userId`, and it has to be: retention is a
   * property of the data, not of an account, so a sweep that needed a user id would keep the rows
   * of everybody who stopped opening the app — the accounts whose data is least defensible to hold.
   * It takes a DATE rather than a day count so the caller owns the boundary, which is the same
   * `windowStart(today, HEALTH_RETENTION_DAYS)` `recordHealthDays` refuses on ingest.
   *
   * Nothing served changes: every read is already inside that window. What changes is what is KEPT.
   * `HEALTH_RETENTION_DAYS` is documented as how old a row may be and still be stored, and until
   * this existed only the ingest bound enforced it — so an account open for six years held six
   * years of special-category data of which five were servable and the sixth was reachable by
   * nothing but a database dump (#562).
   */
  pruneHealthDaysBefore(before: string): Promise<number>;

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
