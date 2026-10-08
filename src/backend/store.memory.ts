// In-memory Store. What the tests run against, and what `bun run start:demo` runs against.
//
// It is a real implementation of the same interface, not a stub with holes: the user-scoping rules
// are enforced here exactly as they are in Postgres, so a test that proves "another user's meal id
// resolves to null" is proving something about the engine rather than about a mock's mood.

import { dateMinus, healthScore, localDate, migrateActivityLevel, signsIn } from "@eait/shared";
import type {
  DayTotals, FoodRef, HealthDay, Lang, MealRecord, NotificationCopySet, OffProduct,
  OnboardingContentSet, OnboardingEvent,
  Profile, Provider, PushKind, PushTemplateRow,
} from "@eait/shared";
import {
  DEFAULT_SESSION_TTL_MS, hashToken, newSessionToken, sessionRefreshAfterMs,
} from "./auth/tokens.ts";
import { PROMPT_DEFAULTS, PROMPT_KEYS } from "./llm/prompt.ts";
import { type ChatMessage,
  ADMIN_METRICS_MAX_DAYS, ADMIN_USER_PAGE_MAX,
  PORTION_PRIOR_ROWS, blankProfile, portionPriorsFrom, type AdminUserRow, type FunnelAggregate,
  type MealPatch, type Role,
  type CampaignRow, type JobRecord, type PendingMeal, type PortionCorrection, type ProfilePatch, type PromptRevision, type PushPlatform, type PushStatRow, type PushToken, type SendLogRow,
  type StoredEntitlement, type Store, type StoreOptions, type StoredPhoto,
} from "./store.ts";

/** A stored funnel event: what the client sent, plus who and when we received it. */
type StoredEvent = OnboardingEvent & { userId: string; receivedAt: number };

/** The middle value, or the mean of the two middles. Null for an empty sample. */
function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 === 1 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

/**
 * Aggregate raw events into the admin's funnel. Shared by both stores' unit of meaning.
 *
 * The Postgres store does this in SQL rather than calling this function — but it must produce the
 * same numbers, and `store.contract.test.ts` runs the same assertions against both. A median that
 * differs between implementations is a metric that means nothing.
 */
export function aggregateFunnel(events: StoredEvent[]): FunnelAggregate {
  const byPlace = new Map<string, { views: number; answers: number; backs: number; rejects: number; ms: number[] }>();
  const sessions = new Set<string>();
  const completed = new Set<string>();

  for (const e of events) {
    sessions.add(e.sessionId);
    if (e.action === "complete") completed.add(e.sessionId);
    const row = byPlace.get(e.place) ?? { views: 0, answers: 0, backs: 0, rejects: 0, ms: [] };
    if (e.action === "view") row.views++;
    if (e.action === "answer") {
      row.answers++;
      if (typeof e.ms === "number") row.ms.push(e.ms);
    }
    if (e.action === "back") row.backs++;
    if (e.action === "reject") row.rejects++;
    byPlace.set(e.place, row);
  }

  return {
    sessions: sessions.size,
    completed: completed.size,
    rows: [...byPlace.entries()].map(([place, r]) => ({
      place, views: r.views, answers: r.answers, backs: r.backs, rejects: r.rejects,
      medianMs: median(r.ms),
    })),
  };
}

/**
 * A stored copy document as a LANGUAGE MAP, whatever shape an older build left behind.
 *
 * Three shapes reach this. A language map is returned as it is. A JSON STRING is what
 * `${JSON.stringify(doc)}::jsonb` used to write — bun's driver already encodes a bound value, so
 * the cast was a no-op — and spreading one scatters it into numeric keys. A BARE revision predates
 * the language dimension entirely and was English, because English was all there was.
 *
 * The Postgres statements repair both on write; this exists so the two implementations agree,
 * which is the whole contract `store.contract.test.ts` is for.
 */
function legacyLanguageMap(stored: unknown): Record<string, unknown> {
  if (stored === null || stored === undefined) return {};
  if (typeof stored === "string") {
    try { return legacyLanguageMap(JSON.parse(stored)); } catch { return {}; }
  }
  if (typeof stored !== "object" || Array.isArray(stored)) return {};
  const o = stored as Record<string, unknown>;
  const bare = Array.isArray(o.screens) || typeof o.evening === "object";
  return bare ? { en: o } : o;
}

export function memoryStore(opts: StoreOptions = {}): Store {
  const sessionTtlMs = opts.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const now = opts.now ?? Date.now;

  const users = new Map<string, Profile>();
  // WHEN the account was made. A column on `users` in Postgres and a second map here, like the
  // entitlement and the role — the admin's list (#374) is the only reader, and a store that could
  // not answer it would be a store the panel had to guess against.
  const createdAt = new Map<string, number>();
  /**
   * Roles, in their own map rather than on the profile (#391a).
   *
   * Kept apart for the same reason Postgres keeps the column out of its profile allowlist: a role
   * that lived on the `Profile` object would be writable by `patchProfile` here — this store writes
   * every key it is handed — and refused there. An absent entry is "user", never `undefined`.
   */
  const roles = new Map<string, Role>();
  /**
   * The sign-up consent stamps (S8). Postgres keeps them as columns on `users`; here it is a map,
   * keyed the same way and gone when the account is. An absent entry is "never given" — the two
   * timestamps answer null the way the columns do.
   */
  const consents = new Map<string, { termsAcceptedAt: string | null; marketingConsentAt: string | null }>();
  /**
   * The stored record PLUS the two per-grant ordering clocks, which are this store's own
   * bookkeeping and never leave it — `getEntitlement` projects them away. Postgres keeps the same
   * pair in two columns; the port declares neither, because nothing outside a store may order
   * events for itself.
   */
  interface StoredWithClocks extends StoredEntitlement {
    expiresEventAt: string | null;
    lifetimeEventAt: string | null;
  }
  const entitlements = new Map<string, StoredWithClocks>();
  const freeAnalyses = new Map<string, number>(); // userId -> the admin's own sample size
  /**
   * Per-user push state kept beside the profile (`users.timezone`, `push_slot`, `send_log`). Maps for the same reason
   * `roles` and `consents` are: the column lives on `users`, not on `Profile`, and this store's
   * profiles hold only what the port declares.
   */
  const timezones = new Map<string, string>();
  /** `push_slot`: `${userId}|${localDate}` -> the kind holding that day. */
  const pushSlots = new Map<string, PushKind>();
  const sendLog = new Map<string, SendLogRow>();
  /** `push_open`: `${userId}|${sendId}` for each send the phone reported opened — the table's primary key. */
  const pushOpens = new Set<string>();
  const campaigns = new Map<string, CampaignRow>();
  /** `campaign_send`: `${userId}|${campaignId}` -> handed. */
  const campaignSends = new Set<string>();
  let campaignKill = false;
  /** The later of two instants, tolerating the first not existing yet. */
  const newest = (a: string | undefined, b: string): string =>
    a !== undefined && Date.parse(a) > Date.parse(b) ? a : b;
  /** Whether grant clock `a` beats `b`: an absent `a` never wins, an absent `b` always loses. */
  const beats = (a: string | null, b: string | null): boolean =>
    a !== null && (b === null || Date.parse(a) > Date.parse(b));
  const blank = (c: StoredWithClocks | undefined): StoredWithClocks => c ?? {
    expiresAt: null, expiresEventAt: null, lifetimeProductId: null, lifetimeEventAt: null,
    productId: "", eventAt: "", trial: false,
  };
  const devices = new Map<string, string>(); // deviceId -> userId
  // Keyed by the HASH of the token, exactly as Postgres is. Storing the raw value here would make
  // demo mode the one environment where a token is recoverable from the store — and demo mode is
  // where the sign-in flows get driven, so it is the environment where that would be noticed last.
  // `ttlMs` is the row's OWN idle lifetime and undefined means the store's (#407). Postgres holds
  // the same thing in a nullable column, so both implementations answer the same question.
  const tokens = new Map<string, { userId: string; lastUsedAt: number; ttlMs?: number }>();
  const meals = new Map<string, MealRecord>(); // mealId -> record
  /**
   * `healthScore` is computed at READ (#118), like the Postgres `toMeal`: from the meal's own
   * numbers and stored verdicts plus the account's declared restrictions. Never trusted off the
   * stored record — an `updateMeal` patch can move every number under it.
   */
  const scored = (m: MealRecord): MealRecord =>
    ({ ...m, healthScore: healthScore(m, users.get(m.user_id)?.restrictions ?? []) });
  const photos = new Map<string, (StoredPhoto & { userId: string })[]>(); // mealId -> in position order
  const pendings = new Map<string, PendingMeal>(); // pendingId -> pending
  // Keyed by the HASH of the code, exactly as Postgres is — a demo store that held the code
  // itself would be the one environment where a dump is a way in, and demo mode is where this
  // flow gets driven.
  const pairingCodes = new Map<string, { userId: string; expiresAt: number }>();
  // Append-only; `seq` comes from a monotonic counter, never reused, the same way the Postgres
  // bigserial is. Rows of a deleted user are removed, so it gaps.
  const chat: ChatMessage[] = [];
  let chatSeq = 0;
  const firstVerdictSpoken = new Set<string>();
  let notificationCopy = (opts.seed?.notificationCopy ?? null) as NotificationCopySet | null;
  // Keyed (key, lang, variant), as the Postgres primary key is.
  const pushTemplates = new Map<string, PushTemplateRow>();
  const pushTemplateId = (r: Pick<PushTemplateRow, "key" | "lang" | "variant">) => `${r.key}/${r.lang}/${r.variant}`;
  // Keyed by the TOKEN, exactly as Postgres is: a token is an installation, so registering it under
  // a second account moves it rather than adding a row.
  const pushTokens = new Map<string, { userId: string; platform: PushPlatform }>();
  const analyses: {
    id: string; userId: string; date: string; scope: "photo" | "text" | "clip"; costUsd: number | null; unpricedCalls: number;
    /** Counts against the sample until `releaseSample` says the turn delivered nothing. */
    sample: boolean;
    /** Settled-turn timings, written by `recordTiming`; undefined until one lands. */
    msQueue?: number; msFirstItem?: number | null; msTotal?: number;
  }[] = [];
  let analysisSeq = 0;
  // `${userId}\n${clientId}` -> the claim. The key IS the uniqueness the Postgres primary key gives.
  const turns = new Map<string, { userId: string; clientId: string; outcome: object | null; claimedAt: number }>();
  const jobs = new Map<string, JobRecord & { photos: { mime: string; bytes: Uint8Array }[] }>();
  // Append-only and read newest-first, which is the order Postgres reads them in.
  const portionCorrections: (PortionCorrection & { userId: string })[] = [];
  const identities: {
    userId: string; provider: Provider; subject: string; linkedAt: string; email: string | null;
  }[] = [];
  const onboardingEvents = new Map<string, StoredEvent>(); // event id -> event
  // `${userId}\n${date}` -> the day. One row per user per date, exactly as in Postgres, so the
  // upsert semantics the tests assert are the semantics production has.
  const healthDays = new Map<string, HealthDay & { userId: string }>();
  // `${userId}\n${date}` -> the typed weigh-in. One row per day — `putWeight` upserts, the last
  // write of a day winning, which is `on conflict` on Postgres and a `set` here.
  const weights = new Map<string, { userId: string; date: string; kg: number }>();
  // The food catalog — global reference data, keyed on the row's own ids: food_ref on
  // `<source>:<code>`, off_product on the barcode itself.
  const foodRefs = new Map<string, FoodRef>();
  const offProducts = new Map<string, OffProduct>();
  // `opts.seed` is how a test starts from a row an OLDER server wrote — see `StoreOptions`. Cast
  // rather than validated, because the whole point of those shapes is that no current type fits.
  let onboardingContent = (opts.seed?.onboardingContent ?? null) as OnboardingContentSet | null;
  /**
   * Every prompt revision ever written, exactly as Postgres keeps them: nothing is overwritten and
   * the newest version per key is the live one. A flat list rather than a map by key, because the
   * history IS the storage here — a map would hold the live text and quietly drop the audit trail
   * the Postgres table keeps, and the two implementations would disagree about what the port means.
   *
   * IT STARTS WITH THE SHIPPED TEXT, which is what `postgresStore` reaches by running
   * `syncShippedPrompts` at boot. Synchronous here because this constructor is, and the result is
   * the same state — a contract test pins it against both. Every test therefore reads its prompts
   * out of a ROW, the way production does, rather than exercising the fallback and shipping the
   * other path untested.
   */
  const promptRevisionRows: PromptRevision[] = PROMPT_KEYS.map((key) => ({
    key, version: 1, text: PROMPT_DEFAULTS[key], source: "shipped" as const,
    updated_at: new Date(now()).toISOString(),
  }));

  /** Deep-copies on the way out so a caller mutating a returned object cannot edit the store. */
  const clone = <T>(v: T): T => structuredClone(v);
  const asRecord = ({ photos: _photos, ...j }: JobRecord & { photos: unknown }): JobRecord => ({
    ...clone(j), outcome: turns.get(`${j.userId}\n${j.clientId}`)?.outcome ?? null,
  });
  // `onJobNotify`'s twin: delivered after the write, as Postgres delivers on commit.
  const listeners = new Set<{ job: (userId: string, clientId: string) => void; enqueued: () => void }>();
  const notifyJob = (userId: string, clientId: string) =>
    queueMicrotask(() => { for (const l of listeners) l.job(userId, clientId); });
  const notifyEnqueued = () => queueMicrotask(() => { for (const l of listeners) l.enqueued(); });
  const settle = (j: JobRecord & { photos: unknown[] }, outcome: object) => {
    j.state = "settled"; j.leaseOwner = null; j.leaseUntil = null; j.updatedAt = now(); j.photos = [];
    const t = turns.get(`${j.userId}\n${j.clientId}`);
    if (t) t.outcome = clone(outcome);
    notifyJob(j.userId, j.clientId);
  };

  /**
   * Shared by `pruneExpiredTokens` and `issueToken`. A plain closure rather than `this.prune()`:
   * every method here is reachable as a detached function — `const { issueToken } = store` is a
   * thing callers do — and a `this` that silently becomes undefined is a runtime error in the one
   * path that mints credentials.
   */
  const prune = (): number => {
    const at = now();
    let removed = 0;
    for (const [hash, row] of tokens) {
      if (at - row.lastUsedAt > (row.ttlMs ?? sessionTtlMs)) {
        tokens.delete(hash);
        removed++;
      }
    }
    return removed;
  };

  /**
   * Erase one account and everything hanging off it.
   *
   * A closure rather than a method, because `removeIdentity` erases in the same step it
   * removes the last identity — the whole point of that step being one step — and reaching
   * it through `this` would break the moment a caller detached the method, which callers do.
   */
  const eraseUser = (userId: string): void => {
    users.delete(userId);
    createdAt.delete(userId);
    // Goes with the account. In Postgres this is a column on `users` and needs no statement at
    // all; here it is a second map, so it needs this line to keep the two stores honest.
    entitlements.delete(userId);
    // Same argument, same reason: a column there, a map here. An admin grant that outlived its
    // account would be handed to whoever the id belonged to next.
    roles.delete(userId);
    // Same again (S8): consent stamps are `users` columns in Postgres and a map here — an account
    // that consented and was deleted keeps neither the record nor the timestamp.
    consents.delete(userId);
    // The evening line's claim goes with the account, like the consent stamp beside it.
    timezones.delete(userId);
    for (const k of [...pushSlots.keys()]) if (k.startsWith(`${userId}|`)) pushSlots.delete(k);
    for (const [k, r] of sendLog) if (r.userId === userId) { sendLog.delete(k); pushOpens.delete(`${userId}|${k}`); }
    freeAnalyses.delete(userId);
    for (const [d, u] of devices) if (u === userId) devices.delete(d);
    for (const [h, row] of tokens) if (row.userId === userId) tokens.delete(h);
    for (const [id, m] of meals) if (m.user_id === userId) meals.delete(id);
    for (const [id, list] of photos) if (list.some((p) => p.userId === userId)) photos.delete(id);
    for (const [id, p] of pendings) if (p.userId === userId) pendings.delete(id);
    // In Postgres this is the cascade on the foreign key; here it is this line. A code that
    // outlived its account would mint a session for a user id nothing resolves.
    for (const [h, c] of pairingCodes) if (c.userId === userId) pairingCodes.delete(h);
    // The thread holds the medical free text a person typed at Spud. It goes with the account.
    for (let i = chat.length - 1; i >= 0; i--) if (chat[i]!.userId === userId) chat.splice(i, 1);
    firstVerdictSpoken.delete(userId);
    for (let i = analyses.length - 1; i >= 0; i--) {
      if (analyses[i]!.userId === userId) analyses.splice(i, 1);
    }
    for (const [k, t] of turns) if (t.userId === userId) turns.delete(k);
    for (const [k, j] of jobs) if (j.userId === userId) jobs.delete(k);
    // Identities go too, so deleting an account genuinely releases the Apple/Google subject
    // rather than leaving a row that would collide when the same person signs in again.
    for (let i = identities.length - 1; i >= 0; i--) {
      if (identities[i]!.userId === userId) identities.splice(i, 1);
    }
    // And the funnel rows. See the note on `deleteUser` in the port: onboarding promises erasure
    // while asking about the user's kidneys, so the analytics table is not an exception to it.
    for (const [id, e] of onboardingEvents) if (e.userId === userId) onboardingEvents.delete(id);
    // A device the account no longer has is a device this server would still push to. In here
    // rather than in `deleteUser`, so the Apple server-to-server revocation path erases it too.
    for (const [token, row] of pushTokens) if (row.userId === userId) pushTokens.delete(token);
    for (let i = portionCorrections.length - 1; i >= 0; i--) {
      if (portionCorrections[i]!.userId === userId) portionCorrections.splice(i, 1);
    }
    // Health days are the most sensitive rows here — bodyweight, sleep, heart rate. Erasure that
    // left them would make the settings screen's promise false in the one place it matters most.
    for (const [k, d] of healthDays) if (d.userId === userId) healthDays.delete(k);
    // The typed weigh-ins are the same data by another door: they go with it.
    for (const [k, w] of weights) if (w.userId === userId) weights.delete(k);
  };

  /**
   * The page cursor: where one row sits in the order, and nothing else.
   *
   * Both stores spell it the same way because it crosses the port — a page taken from one and
   * continued against the other has to mean the same thing, and the contract test runs the same
   * assertions against both.
   */
  const cursorOf = (userId: string, at: number): string => `${new Date(at).toISOString()}~${userId}`;

  /**
   * The accounts a `q` names, or null for "no filter". An EMPTY array means it named none.
   *
   * Exact address or id prefix, and nothing else — never a substring. The distinction is the whole
   * point: both questions the admin actually asks are an index seek, and a substring is a scan of
   * every account on the box that serves the app.
   */
  const matchingUsers = (q: string | undefined): string[] | null => {
    const needle = (q ?? "").trim();
    if (needle === "") return null;
    const byEmail = identities
      .filter((i) => i.email !== null && i.email.toLowerCase() === needle.toLowerCase())
      .map((i) => i.userId);
    if (byEmail.length > 0) return [...new Set(byEmail)];
    // A prefix of a uuid, which is what a crash report or a support thread carries. Anything that
    // is not one matches nothing — never everything, which is what a `q` falling through to an
    // unfiltered list would do.
    if (!/^[0-9a-f-]{4,36}$/i.test(needle)) return [];
    return [...users.keys()].filter((id) => id.startsWith(needle.toLowerCase()));
  };

  /** `getEntitlement`'s answer without the await, for the admin list's row builder. */
  const storedEntitlement = (userId: string): StoredEntitlement | null => {
    const e = entitlements.get(userId);
    if (!e) return null;
    return {
      expiresAt: e.expiresAt, lifetimeProductId: e.lifetimeProductId,
      productId: e.productId, eventAt: e.eventAt, trial: e.trial === true,
    };
  };

  return {
    async upsertDeviceUser(deviceId, lang: Lang) {
      const existing = devices.get(deviceId);
      const userId = existing ?? crypto.randomUUID();
      if (existing === undefined) {
        devices.set(deviceId, userId);
        users.set(userId, blankProfile(userId, lang));
        createdAt.set(userId, now());
      }
      // Re-asserted on every device auth, matching Postgres: the device map is what this method
      // resolves through and the identity row is what "is anything else still linked" counts, so
      // the two disagreeing is an account device auth can open and `removeIdentity` would delete.
      if (!identities.some((i) => i.provider === "device" && i.subject === deviceId)) {
        identities.push({
          userId, provider: "device", subject: deviceId, linkedAt: new Date().toISOString(),
          email: null,
        });
      }
      return { userId, created: existing === undefined };
    },

    async roleOf(userId) {
      if (!users.has(userId)) return null;
      return roles.get(userId) ?? "user";
    },

    async setRole(userId, role) {
      if (!users.has(userId)) return false;
      if (role === "user") roles.delete(userId); else roles.set(userId, role);
      return true;
    },

    async hasAdmin() {
      for (const [id, role] of roles) if (role === "admin" && users.has(id)) return true;
      return false;
    },

    async recordConsent(userId, consent) {
      if (!users.has(userId)) return;
      // `terms` is stamped every time — a call only reaches this having ticked the box — and the
      // marketing stamp only moves forward: an unticked box is no new consent, not a withdrawal
      // (the box starts empty on every screen; a deliberate switch-off is a settings act).
      const prior = consents.get(userId) ?? { termsAcceptedAt: null, marketingConsentAt: null };
      consents.set(userId, {
        termsAcceptedAt: new Date().toISOString(),
        marketingConsentAt: consent.marketing ? new Date().toISOString() : prior.marketingConsentAt,
      });
    },

    async setMarketingConsent(userId, on) {
      if (!users.has(userId)) return;
      const prior = consents.get(userId) ?? { termsAcceptedAt: null, marketingConsentAt: null };
      consents.set(userId, {
        ...prior,
        marketingConsentAt: on ? prior.marketingConsentAt ?? new Date().toISOString() : null,
      });
    },

    async consentOf(userId) {
      if (!users.has(userId)) return null;
      return consents.get(userId) ?? { termsAcceptedAt: null, marketingConsentAt: null };
    },

    async createUser(lang: Lang) {
      const userId = crypto.randomUUID();
      users.set(userId, blankProfile(userId, lang));
      createdAt.set(userId, now());
      return userId;
    },

    async issueToken(userId, ttlMs) {
      const token = newSessionToken();
      tokens.set(await hashToken(token), {
        userId, lastUsedAt: now(), ...(ttlMs === undefined ? {} : { ttlMs }),
      });
      prune();
      return token;
    },

    async userIdForToken(token) {
      const row = tokens.get(await hashToken(token));
      if (!row) return null;

      const at = now();
      // THE ROW'S lifetime, not the store's — see `issueToken`.
      const ttl = row.ttlMs ?? sessionTtlMs;
      // Idle past its lifetime is indistinguishable from never issued, and deliberately so. The row
      // is dropped on the way out rather than left for the next prune: a token that has just been
      // refused must not be answerable again if the clock moves backwards.
      if (at - row.lastUsedAt > ttl) {
        tokens.delete(await hashToken(token));
        return null;
      }

      // Slide the deadline, but only once the value is actually stale. See `sessionRefreshAfterMs`.
      // Computed from the ROW's lifetime: an eighth of the store's would never come around inside
      // a short-lived token's life, so it would expire mid-use however often it was presented.
      if (at - row.lastUsedAt >= sessionRefreshAfterMs(ttl)) row.lastUsedAt = at;
      return row.userId;
    },

    async revokeToken(token) {
      tokens.delete(await hashToken(token));
    },

    async pruneExpiredTokens() {
      return prune();
    },

    async userIdForIdentity(provider, subject) {
      return identities.find((i) => i.provider === provider && i.subject === subject)?.userId ?? null;
    },

    async identityFor(provider, subject) {
      const row = identities.find((i) => i.provider === provider && i.subject === subject);
      return row ? { userId: row.userId, linkedAt: row.linkedAt, email: row.email } : null;
    },

    async addIdentity(userId, provider, subject) {
      const clash = identities.find((i) => i.provider === provider && i.subject === subject);
      // Uniqueness is enforced here, not merely expected — the Postgres implementation has a
      // constraint and the in-memory one must fail the same way or a test proves nothing.
      if (clash && clash.userId !== userId) throw new Error("identity already linked to another account");
      if (clash) return;
      identities.push({
        userId, provider, subject, linkedAt: new Date().toISOString(), email: null,
      });
    },

    async moveIdentity(userId, provider, subject) {
      const held = identities.find((i) => i.provider === provider && i.subject === subject);
      if (!held) {
        identities.push({ userId, provider, subject, linkedAt: new Date().toISOString(), email: null });
        return "linked";
      }
      if (held.userId === userId) return "linked";
      // The row moves; the account it came off is left exactly as it was, empty of identities or not.
      held.userId = userId;
      held.linkedAt = new Date().toISOString();
      return "moved";
    },

    async setIdentityEmail(userId, provider, subject, email) {
      // Scoped by `userId`: a row belonging to another account is not this caller's to write.
      const row = identities.find(
        (i) => i.provider === provider && i.subject === subject && i.userId === userId,
      );
      if (row) row.email = email;
    },

    async removeIdentity(userId, provider, subject) {
      // Matched on all three, exactly like the Postgres predicate — an identity is removable only
      // by the account that holds it.
      const at = identities.findIndex(
        (i) => i.userId === userId && i.provider === provider && i.subject === subject);
      if (at < 0) return "not-found";
      identities.splice(at, 1);

      // Synchronous from here to the erase, which is what makes this the same single step the
      // Postgres transaction is: nothing can interleave between the test and the delete.
      //
      // `signsIn`, not "any row": a `telegram` row is a transport onto this account and cannot put
      // anybody into it, so an account left holding only that one is an account nobody can reach.
      if (identities.some((i) => i.userId === userId && signsIn(i.provider))) return "removed";
      eraseUser(userId);
      return "account-deleted";
    },

    async revokeTokensFor(userId) {
      for (const [hash, row] of tokens) if (row.userId === userId) tokens.delete(hash);
    },

    async listIdentities(userId) {
      return identities
        .filter((i) => i.userId === userId)
        .map((i) => ({ provider: i.provider, linkedAt: i.linkedAt }));
    },

    async adminListUsers({ q, limit, cursor, today }) {
      const bounded = Math.min(Math.max(1, Math.trunc(limit)), ADMIN_USER_PAGE_MAX);
      const wanted = matchingUsers(q);
      if (wanted !== null && wanted.length === 0) return { rows: [], nextCursor: null };

      const ordered = [...users.keys()]
        .filter((id) => wanted === null || wanted.includes(id))
        .map((id) => ({ id, at: createdAt.get(id) ?? 0 }))
        // Newest first, the id settling a tie, exactly as Postgres orders it — two accounts made in
        // the same millisecond must come back in ONE order or the cursor skips a row.
        .sort((a, b) => b.at - a.at || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));

      const after = cursor === undefined ? 0
        : ordered.findIndex((r) => cursorOf(r.id, r.at) === cursor) + 1;
      // An unknown cursor is an empty page, never the first one: paging from the top again would
      // walk the whole table a second time and look like it worked.
      if (cursor !== undefined && after === 0) return { rows: [], nextCursor: null };

      const page = ordered.slice(after, after + bounded);
      const rows = page.map(({ id, at }): AdminUserRow => {
        const mine = identities
          .filter((i) => i.userId === id)
          .sort((a, b) => a.linkedAt.localeCompare(b.linkedAt));
        const sessions = [...tokens.values()].filter((t) => t.userId === id);
        return {
          userId: id,
          createdAt: new Date(at).toISOString(),
          onboardedAt: users.get(id)?.onboarded_at ?? null,
          providers: mine.map((i) => i.provider),
          email: mine.find((i) => i.email)?.email ?? null,
          entitlement: storedEntitlement(id),
          freeAnalyses: freeAnalyses.get(id) ?? null,
          analysesToday: analyses.filter((a) => a.userId === id && a.date === today).length,
          spent: analyses.filter((a) => a.userId === id).length,
          lastSeen: sessions.length === 0 ? null
            : new Date(Math.max(...sessions.map((t) => t.lastUsedAt))).toISOString(),
        };
      });
      const last = page[page.length - 1];
      return {
        rows,
        nextCursor: ordered.length > after + page.length && last ? cursorOf(last.id, last.at) : null,
      };
    },

    async identitySubject(userId, provider) {
      return identities.find((i) => i.userId === userId && i.provider === provider)?.subject ?? null;
    },

    async adminMetrics({ days, today, timezone }) {
      const window = Math.min(Math.max(1, Math.trunc(days)), ADMIN_METRICS_MAX_DAYS);
      const dayOf = (at: number) => localDate(timezone, new Date(at));

      const dates: string[] = [];
      for (let i = window - 1; i >= 0; i--) dates.push(dateMinus(today, i));

      const signups = new Map<string, number>();
      const activations = new Map<string, number>();
      const bump = (m: Map<string, number>, d: string) => m.set(d, (m.get(d) ?? 0) + 1);
      for (const [id, at] of createdAt) {
        bump(signups, dayOf(at));
        const on = users.get(id)?.onboarded_at;
        if (on) bump(activations, dayOf(Date.parse(on)));
      }
      const spent = new Map<string, number>();
      const cost = new Map<string, number>();
      const unpriced = new Map<string, number>();
      for (const a of analyses) {
        bump(spent, a.date);
        if (a.costUsd !== null) cost.set(a.date, (cost.get(a.date) ?? 0) + a.costUsd);
        if (a.costUsd === null || a.unpricedCalls > 0) bump(unpriced, a.date);
      }

      // Who logged something on which day, so a return is one lookup rather than a scan per user.
      const active = new Map<string, Set<string>>();
      for (const a of analyses) {
        if (!active.has(a.userId)) active.set(a.userId, new Set());
        active.get(a.userId)!.add(a.date);
      }
      const cohort = (n: number) => {
        let eligible = 0;
        let returned = 0;
        for (const [id, at] of createdAt) {
          const born = dayOf(at);
          // Inside the window, and old enough to have HAD its nth day.
          if (born < dates[0]! || dateMinus(today, n) < born) continue;
          eligible++;
          if (active.get(id)?.has(dateMinus(born, -n))) returned++;
        }
        return { eligible, returned };
      };

      return {
        days: dates.map((date) => ({
          date,
          signups: signups.get(date) ?? 0,
          activations: activations.get(date) ?? 0,
          analyses: spent.get(date) ?? 0,
          costUsd: cost.get(date) ?? null,
          unpriced: unpriced.get(date) ?? 0,
        })),
        d1: cohort(1),
        d7: cohort(7),
        latency: (() => {
          // The percentile math Postgres does with percentile_cont, over the rows the window
          // holds — same rule the days series gets: outside the window is invisible.
          const inWindow = analyses.filter((a) => a.date >= dates[0]! && a.date <= today);
          const at = (p: number, xs: number[]) =>
            xs.length === 0 ? null : xs[Math.min(xs.length - 1, Math.max(0, Math.ceil(p * xs.length) - 1))]!;
          const legs = (pick: (a: typeof inWindow[number]) => number | null | undefined) => {
            const xs = inWindow.map(pick).filter((x): x is number => typeof x === "number").sort((a, b) => a - b);
            return { p50: at(0.5, xs), p95: at(0.95, xs) };
          };
          return {
            n: inWindow.filter((a) => a.msTotal !== undefined).length,
            queue: legs((a) => a.msQueue),
            firstItem: legs((a) => a.msFirstItem),
            total: legs((a) => a.msTotal),
          };
        })(),
      };
    },

    async emailForUser(userId) {
      // Same order as Postgres: the oldest identity that has one. Sorted rather than assumed —
      // the array is append-ordered today and a merge already reassigns rows in it.
      return identities
        .filter((i) => i.userId === userId && i.email)
        .sort((a, b) => a.linkedAt.localeCompare(b.linkedAt))[0]?.email ?? null;
    },

    async mergeUsers(fromUserId, intoUserId) {
      let moved = 0;
      for (const [id, m] of meals) {
        if (m.user_id !== fromUserId) continue;
        meals.set(id, { ...m, user_id: intoUserId });
        moved++;
      }
      for (const p of pendings.values()) if (p.userId === fromUserId) p.userId = intoUserId;
      for (const list of photos.values()) for (const p of list) if (p.userId === fromUserId) p.userId = intoUserId;
      // Health days move, but NEVER over a day the real account already has. The merge direction is
      // anonymous -> real, and the real account's own history is the one with a person's deliberate
      // corrections in it. Filling gaps is a gift; overwriting is data loss with no undo.
      for (const [k, d] of healthDays) {
        if (d.userId !== fromUserId) continue;
        healthDays.delete(k);
        const target = `${intoUserId}\n${d.date}`;
        if (!healthDays.has(target)) healthDays.set(target, { ...d, userId: intoUserId });
      }
      // Typed weigh-ins follow the same rule as health days: into a gap, never over a day the
      // surviving account already has. `store.pg.ts` runs the identical statements.
      for (const [k, w] of weights) {
        if (w.userId !== fromUserId) continue;
        weights.delete(k);
        const target = `${intoUserId}\n${w.date}`;
        if (!weights.has(target)) weights.set(target, { ...w, userId: intoUserId });
      }
      for (const a of analyses) if (a.userId === fromUserId) a.userId = intoUserId;
      // A turn the anonymous session sent is replayed by the same phone under the real account.
      // One id claimed on both sides keeps the survivor's.
      for (const [k, t] of turns) {
        if (t.userId !== fromUserId) continue;
        turns.delete(k);
        const into = `${intoUserId}\n${t.clientId}`;
        if (!turns.has(into)) turns.set(into, { ...t, userId: intoUserId });
      }
      for (const [k, j] of jobs) {
        if (j.userId !== fromUserId) continue;
        jobs.delete(k);
        const into = `${intoUserId}\n${j.clientId}`;
        if (!jobs.has(into)) jobs.set(into, { ...j, userId: intoUserId });
      }
      // What the app has learned about this person's portions is learned before they sign in.
      for (const c of portionCorrections) if (c.userId === fromUserId) c.userId = intoUserId;
      for (const m of chat) if (m.userId === fromUserId) m.userId = intoUserId;
      // The greeting travels with the thread that holds it, or Spud says "First one in." twice.
      if (firstVerdictSpoken.delete(fromUserId)) firstVerdictSpoken.add(intoUserId);
      // The paid tier moves too — see store.pg.ts for why this is the one entry here that is
      // somebody's money. Per grant, NEWER CLOCK WINS, whole grant at a time.
      const from = entitlements.get(fromUserId);
      if (from) {
        const into = entitlements.get(intoUserId);
        const takeSub = beats(from.expiresEventAt, into?.expiresEventAt ?? null);
        const takeLife = beats(from.lifetimeEventAt, into?.lifetimeEventAt ?? null);
        entitlements.set(intoUserId, {
          expiresAt: takeSub ? from.expiresAt : into?.expiresAt ?? null,
          expiresEventAt: takeSub ? from.expiresEventAt : into?.expiresEventAt ?? null,
          // The period's trial flag belongs to the period, so it travels with it or not at all.
          trial: takeSub ? from.trial === true : into?.trial === true,
          lifetimeProductId: takeLife ? from.lifetimeProductId : into?.lifetimeProductId ?? null,
          lifetimeEventAt: takeLife ? from.lifetimeEventAt : into?.lifetimeEventAt ?? null,
          // The subscription's id travels with the subscription; a lifetime never names it.
          productId: takeSub ? from.productId : into?.productId ?? "",
          eventAt: newest(into?.eventAt, from.eventAt),
        });
        entitlements.delete(fromUserId);
      }
      // The admin's sample size moves the same way: into a gap, never over the survivor's own.
      const ownCap = freeAnalyses.get(fromUserId);
      if (ownCap !== undefined && !freeAnalyses.has(intoUserId)) freeAnalyses.set(intoUserId, ownCap);
      freeAnalyses.delete(fromUserId);

      // Funnel rows move with the account. Signing in halfway through onboarding is a normal thing
      // to do, and a run split across two user ids reads as two abandoned runs.
      for (const e of onboardingEvents.values()) if (e.userId === fromUserId) e.userId = intoUserId;

      // The merged-away account's identities are DROPPED, not repointed. It is anonymous by the
      // time we get here, so those are the device identity and, since #205, possibly a `telegram`
      // row — and repointing either would mean that after signing out, plain device auth silently
      // walks back into the full account without any credential being presented, or that whoever
      // holds that Telegram is handed the real account this one merged into. Sign-out has to mean
      // something, and a connected bot is re-connected in one tap (`linkTelegram` moves a link).
      for (let i = identities.length - 1; i >= 0; i--) {
        if (identities[i]!.userId === fromUserId) identities.splice(i, 1);
      }
      for (const [d, u] of devices) if (u === fromUserId) devices.delete(d);

      // The DEVICE moves with the account. A push token is an address, not a credential: the same
      // phone is now signed into the real account, so its evening line belongs there. It is the
      // opposite decision from the bearer tokens below, and for the opposite reason — moving a
      // credential would let a signed-out session back in, while moving an address is the whole
      // point of a merge. Deleting it instead would cost the user their 20:30 line until their next
      // launch; leaving it on the emptied account would send that account's numbers to a phone
      // whose owner has since signed in as somebody else.
      for (const [t, row] of pushTokens) {
        if (row.userId === fromUserId) pushTokens.set(t, { ...row, userId: intoUserId });
      }
      // The day's slot moves too, never over a day the survivor already holds (see store.pg).
      for (const [k, kind] of [...pushSlots]) {
        if (!k.startsWith(`${fromUserId}|`)) continue;
        const into = `${intoUserId}|${k.slice(fromUserId.length + 1)}`;
        if (!pushSlots.has(into)) pushSlots.set(into, kind);
        pushSlots.delete(k);
      }
      for (const [id, r] of sendLog) {
        if (r.userId !== fromUserId) continue;
        sendLog.set(id, { ...r, userId: intoUserId });
        // The open follows its send, as `push_open` does in Postgres.
        if (pushOpens.delete(`${fromUserId}|${id}`)) pushOpens.add(`${intoUserId}|${id}`);
      }

      // Tokens are deleted, not moved: one that pointed at the now-empty account must stop working
      // rather than silently start addressing someone else's diary.
      for (const [h, row] of tokens) if (row.userId === fromUserId) tokens.delete(h);
      users.delete(fromUserId);
      // Goes with the row, exactly as `eraseUser` takes it. Postgres gets both of these for free —
      // one is a column on a deleted row, the other is a column this method never copies.
      createdAt.delete(fromUserId);
      // NOT MOVED, deleted with the account. A merge is anonymous→real, so the surviving account's
      // own role is the answer; carrying one across would let an anonymous session hand an admin
      // grant to somebody else's account. Postgres gets this for free by not listing the column.
      roles.delete(fromUserId);
      // The merged-away zone and slots were handled above (the zone only fills a gap); what is left
      // of it dies with the row, as Postgres drops it.
      const fromZone = timezones.get(fromUserId);
      if (fromZone !== undefined && !timezones.has(intoUserId)) timezones.set(intoUserId, fromZone);
      timezones.delete(fromUserId);
      return moved;
    },

    async getProfile(userId) {
      const p = users.get(userId);
      if (!p) return null;
      // The same read-side migration `rowToProfile` applies in store.pg: an activity level in the
      // five-level vocabulary — however it got here — answers in the three-level one.
      const next = clone(p);
      next.activity = migrateActivityLevel(next.activity);
      return next;
    },

    async patchProfile(userId, patch: ProfilePatch) {
      const current = users.get(userId);
      if (!current) throw new Error("no such user");
      // Explicit key iteration, not a spread of `patch`: a spread would copy keys whose value is
      // `undefined` and overwrite a stored value with nothing. Absent means "leave alone".
      //
      // AND ONLY KEYS A PROFILE ALREADY HAS. Postgres allowlists the columns it will write
      // (`PROFILE_COLUMNS`); without the same rule here this store accepted any key at all and put
      // it on the object `getProfile` hands back — so the two disagreed about what a profile even
      // IS, which is the divergence class the contract suite exists to catch. Found by the test
      // that patches `{ role: "admin" }`: Postgres dropped it, this kept it.
      const next: Profile = { ...current };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined && k in current) (next as unknown as Record<string, unknown>)[k] = v;
      }
      users.set(userId, next);
      return clone(next);
    },

    async getEntitlement(userId) {
      // The per-grant clocks are the store's own bookkeeping and are deliberately NOT part of
      // `StoredEntitlement`: nothing outside here may order events, and a field that escapes the
      // port is a field somebody will branch on. `storedEntitlement` is that projection, shared
      // with the admin list so the two cannot disagree about which fields leave.
      return storedEntitlement(userId);
    },

    async putEntitlement(userId, patch) {
      // No such user is a NO-OP, not a new row. RevenueCat names accounts by an id we gave it, and
      // it also has ids of its own for a device that never signed in here — writing an entitlement
      // for one would create paid state belonging to nobody.
      if (!users.has(userId)) return false;
      const current = entitlements.get(userId);
      const at = Date.parse(patch.eventAt);

      // The same conditions store.pg.ts carries in its statements, and the same reason for putting
      // them in the write. ONE CLOCK PER GRANT: a patch is ordered against the stream it belongs
      // to and against no other, or a late renewal would be refused by an unrelated unlock.
      if (patch.expiresAt !== undefined) {
        if (current && current.expiresEventAt !== null && Date.parse(current.expiresEventAt) >= at) return false;
        entitlements.set(userId, {
          ...blank(current),
          expiresAt: patch.expiresAt,
          expiresEventAt: patch.eventAt,
          lifetimeProductId: current?.lifetimeProductId ?? null,
          lifetimeEventAt: current?.lifetimeEventAt ?? null,
          productId: patch.productId,
          eventAt: newest(current?.eventAt, patch.eventAt),
          // Normalised to a boolean because Postgres reads its column back as one; a store that
          // answered undefined where the other answers false is a divergence only the contract
          // test would notice.
          trial: patch.trial === true,
        });
        return true;
      }
      if (patch.lifetimeProductId === undefined) return false;

      if (current && current.lifetimeEventAt !== null && Date.parse(current.lifetimeEventAt) >= at) return false;
      if (patch.lifetimeProductId === null &&
          (current?.lifetimeProductId ?? null) !== patch.productId) return false;
      entitlements.set(userId, {
        ...blank(current),
        expiresAt: current?.expiresAt ?? null,
        expiresEventAt: current?.expiresEventAt ?? null,
        lifetimeProductId: patch.lifetimeProductId,
        lifetimeEventAt: patch.eventAt,
        // The subscription's id; a lifetime event does not name it.
        productId: current?.productId ?? "",
        eventAt: newest(current?.eventAt, patch.eventAt),
        // A lifetime event says nothing about the subscription's period.
        trial: current?.trial ?? false,
      });
      return true;
    },

    async putPushToken(userId, token, platform) {
      pushTokens.set(token, { userId, platform });
    },

    async dropPushToken(userId, token) {
      const row = pushTokens.get(token);
      if (!row || row.userId !== userId) return false;
      pushTokens.delete(token);
      return true;
    },

    async pushTokensFor(userId) {
      const out: PushToken[] = [];
      for (const [token, row] of pushTokens) {
        if (row.userId === userId) out.push({ token, platform: row.platform });
      }
      return out;
    },

    async pushAudience() {
      return [...new Set([...pushTokens.values()].map((r) => r.userId))]
        .map((userId) => ({
          userId, timezone: timezones.get(userId) ?? null,
          createdAt: new Date(createdAt.get(userId) ?? 0).toISOString(),
          onboardedAt: users.get(userId)?.onboarded_at ?? null,
        }));
    },

    async timezoneOf(userId) {
      return timezones.get(userId) ?? null;
    },

    async setTimezone(userId, timezone) {
      if (users.has(userId)) timezones.set(userId, timezone);
    },

    async claimPushSlot(userId, localDate, kind) {
      // Postgres refuses an unknown account through the foreign key; so does this.
      if (!users.has(userId)) throw new Error("push_slot: no such user");
      const key = `${userId}|${localDate}`;
      const held = pushSlots.get(key);
      if (held !== undefined) return { claimed: false, heldBy: held };
      pushSlots.set(key, kind);
      return { claimed: true };
    },

    async createSend(userId, row) {
      if (!users.has(userId)) throw new Error("send_log: no such user");
      sendLog.set(row.id, {
        ...row, userId, ticketId: null, receiptError: null,
        createdAt: new Date().toISOString(), receiptAt: null,
      });
    },

    async settleSend(userId, id, patch) {
      const row = sendLog.get(id);
      if (!row || row.userId !== userId) return;
      sendLog.set(id, {
        ...row, state: patch.state,
        ticketId: patch.ticketId !== undefined ? patch.ticketId : row.ticketId,
        receiptError: patch.receiptError !== undefined ? patch.receiptError : row.receiptError,
        receiptAt: patch.receipt ? new Date().toISOString() : row.receiptAt,
      });
    },

    async sendsAwaitingReceipt(limit) {
      return [...sendLog.values()]
        .filter((r) => r.state === "accepted" && r.ticketId !== null && r.receiptAt === null)
        .slice(0, limit);
    },

    async sendLogFor(userId, limit) {
      return [...sendLog.values()].filter((r) => r.userId === userId).reverse().slice(0, limit);
    },

    async recordPushOpen(userId, sendId, _action) {
      const row = sendLog.get(sendId);
      const key = `${userId}|${sendId}`;
      if (!row || row.userId !== userId || pushOpens.has(key)) return false;
      pushOpens.add(key);
      return true;
    },

    async pushOpenStats(days, timezone) {
      const since = now() - days * 24 * 60 * 60 * 1000;
      const DAY = 24 * 60 * 60 * 1000;
      const out = new Map<string, PushStatRow>();
      for (const r of sendLog.values()) {
        const at = Date.parse(r.createdAt);
        if (at < since) continue;
        const day = localDate(timezone, new Date(at));
        const key = `${day}|${r.kind}|${r.templateKey}`;
        const row = out.get(key) ?? { day, kind: r.kind, templateKey: r.templateKey, sent: 0, accepted: 0, dead: 0, opened: 0, converted: 0 };
        row.sent++;
        // `expired` (no receipt within 24 h) is accepted-but-unconfirmed, never dead.
        if (["accepted", "delivered-to-apns", "expired"].includes(r.state)) row.accepted++;
        if (r.state === "dead") row.dead++;
        // A send that never reached a phone (`dead`, `refused`, `dry`) cannot have been opened or
        // acted on: counting its stray open or the meal that followed would be a false conversion.
        const reached = r.state !== "dead" && r.state !== "refused" && r.state !== "dry";
        if (reached && pushOpens.has(`${r.userId}|${r.id}`)) row.opened++;
        // [send, send + 24 h): a meal at the send's own instant counts, one a day later does not.
        if (reached && [...meals.values()].some((m) => m.user_id === r.userId && Date.parse(m.ts) >= at && Date.parse(m.ts) < at + DAY)) row.converted++;
        out.set(key, row);
      }
      return [...out.values()].sort((a, b) => b.day.localeCompare(a.day) || a.templateKey.localeCompare(b.templateKey));
    },

    async listCampaigns() {
      return [...campaigns.values()].map(clone).sort((x, y) => y.createdAt.localeCompare(x.createdAt));
    },

    async getCampaign(id) {
      const c = campaigns.get(id);
      return c ? clone(c) : null;
    },

    async createCampaign(row) {
      if (campaigns.has(row.id)) throw new Error("campaign: duplicate id");
      campaigns.set(row.id, clone(row));
    },

    async updateCampaign(id, patch) {
      const c = campaigns.get(id);
      if (!c) return null;
      const next: CampaignRow = { ...c, ...clone(patch), updatedAt: new Date(now()).toISOString() };
      campaigns.set(id, next);
      return clone(next);
    },

    async markCampaignRunning(id) {
      const c = campaigns.get(id);
      if (!c || c.status !== "scheduled") return false;
      campaigns.set(id, { ...c, status: "running", updatedAt: new Date(now()).toISOString() });
      return true;
    },

    async campaignsKilled() {
      return campaignKill;
    },

    async setCampaignsKilled(killed) {
      campaignKill = killed;
    },

    async hasCampaignSend(userId, campaignId) {
      return campaignSends.has(`${userId}|${campaignId}`);
    },

    async claimCampaignSend(userId, campaignId) {
      if (!users.has(userId)) throw new Error("campaign_send: no such user");
      const key = `${userId}|${campaignId}`;
      if (campaignSends.has(key)) return false;
      campaignSends.add(key);
      return true;
    },

    async campaignReport(campaignId) {
      const out = { sent: 0, accepted: 0, dead: 0, dry: 0, opened: 0, test: 0 };
      for (const r of sendLog.values()) {
        if (r.kind !== "campaign" || r.ref !== campaignId) continue;
        if (r.variant === "test") { out.test++; continue; }
        if (r.state === "dry") { out.dry++; continue; }
        out.sent++;
        if (["accepted", "delivered-to-apns", "expired"].includes(r.state)) out.accepted++;
        if (r.state === "dead") out.dead++;
        if (r.state !== "refused" && r.state !== "dead" && pushOpens.has(`${r.userId}|${r.id}`)) out.opened++;
      }
      return out;
    },

    async getOnboardingContent() {
      return onboardingContent ? clone(onboardingContent) : null;
    },

    async putOnboardingContent(lang, content, floorVersion) {
      // MERGE, not replace — the Postgres one does this with `jsonb_set` on the locked row, and a
      // memory store that replaced the document instead would prove the engine safe against a race
      // the real store is the only one that can have.
      //
      // AND IT MIGRATES THE TWO LEGACY SHAPES, because Postgres does. A spread of a STRING scatters
      // it character by character into numeric keys and destroys the revision under it; a spread of
      // a BARE pre-#358 revision hangs the language off it beside `screens`, which `usableContentFor`
      // then reads as bare English forever. Both were live here while the Postgres statement
      // repaired them, so `--demo` and every engine test ran against behaviour the real store does
      // not have — which is worse than a bug, because it is a bug that proves things.
      const set = { ...legacyLanguageMap(onboardingContent) } as Record<string, { version?: number }>;
      const highest = Math.max(0, ...Object.values(set)
        .map((c) => c?.version)
        .filter((v): v is number => typeof v === "number"));
      const version = Math.max(floorVersion, highest + 1);
      onboardingContent = clone({ ...set, [lang]: { ...content, version } }) as typeof onboardingContent;
      return version;
    },

    async getNotificationCopy() {
      return notificationCopy ? clone(notificationCopy) : null;
    },

    async listPushTemplates() {
      return [...pushTemplates.values()].map(clone).sort((a, b) => pushTemplateId(a).localeCompare(pushTemplateId(b)));
    },

    async seedPushTemplates(rows) {
      for (const r of rows) if (!pushTemplates.has(pushTemplateId(r))) pushTemplates.set(pushTemplateId(r), clone(r));
    },

    async putPushTemplate(row) {
      pushTemplates.set(pushTemplateId(row), clone(row));
    },

    async getPrompts() {
      const live = new Map<string, PromptRevision>();
      for (const r of promptRevisionRows) {
        const seen = live.get(r.key);
        if (!seen || r.version > seen.version) live.set(r.key, r);
      }
      return [...live.values()].map(clone).sort((a, b) => a.key.localeCompare(b.key));
    },

    async promptRevisions(key) {
      return promptRevisionRows
        .filter((r) => r.key === key)
        .sort((a, b) => b.version - a.version)
        .map(clone);
    },

    async putPrompt(key, text, source) {
      const version = Math.max(0, ...promptRevisionRows.filter((r) => r.key === key).map((r) => r.version)) + 1;
      // `now()` rather than `new Date()`: every other timestamp in this store comes from the
      // injectable clock, and a fixture that ignores it is one a time-travelling test cannot pin.
      promptRevisionRows.push({ key, version, text, source, updated_at: new Date(now()).toISOString() });
      return version;
    },

    async putNotificationCopy(lang, copy) {
      // Merged and migrated, for `putOnboardingContent`'s reasons.
      notificationCopy = clone({ ...legacyLanguageMap(notificationCopy), [lang]: copy }) as typeof notificationCopy;
    },

    // ── The food catalog ────────────────────────────────────────────────────────────────────

    async foodCandidates(words, limit) {
      const res = words.map((w) => new RegExp(`\\b${w.replace(/[^\p{L}\p{N}]/gu, "")}(s|es)?\\b`, "iu"));
      if (res.length === 0) return [];
      return [...foodRefs.values()]
        .filter((f) => f.name_en !== null && f.kcal_per_100g !== null && f.protein_g_per_100g !== null
          && f.carbs_g_per_100g !== null && f.fat_g_per_100g !== null && res.every((r) => r.test(f.name_en!)))
        .sort((a, b) => a.name_en!.length - b.name_en!.length || (a.name_en! < b.name_en! ? -1 : 1))
        .slice(0, limit)
        .map(clone);
    },
    async searchFoods(query, limit) {
      // Same match and same order as Postgres: case-insensitive substring in any of the three
      // name columns, earliest position first, then shortest name, then alphabetical.
      const needle = query.toLowerCase();
      const score = (f: FoodRef) =>
        Math.min(...[f.name, f.name_de, f.name_en]
          .filter((n): n is string => n !== null)
          .map((n) => { const i = n.toLowerCase().indexOf(needle); return i < 0 ? Infinity : i; }));
      return [...foodRefs.values()]
        .filter((f) => score(f) !== Infinity)
        .sort((a, b) =>
          score(a) - score(b) || a.name.length - b.name.length || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
        .slice(0, limit)
        .map(clone);
    },

    async offProductByBarcode(barcode) {
      const row = offProducts.get(barcode);
      return row ? clone(row) : null;
    },

    async putFoodRefs(foodRows) {
      for (const row of foodRows) foodRefs.set(row.id, clone(row));
      return foodRows.length;
    },

    async putOffProducts(products) {
      let written = 0;
      for (const row of products) {
        const existing = offProducts.get(row.barcode);
        // The Postgres `where` clause, stated the same way: an `off` row may replace a
        // `label-ocr` row only when the dump row carries a calorie figure.
        if (existing && row.source === "off" && existing.source === "label-ocr" && row.kcal_per_100g === null) continue;
        offProducts.set(row.barcode, clone(row));
        written++;
      }
      return written;
    },

    async recordOnboardingEvents(userId, events) {
      let added = 0;
      for (const e of events) {
        // Keyed on the CLIENT's id, so a retried batch overwrites nothing and adds nothing. The
        // Postgres implementation gets the same behaviour from a primary key.
        if (onboardingEvents.has(e.id)) continue;
        onboardingEvents.set(e.id, { ...clone(e), userId, receivedAt: now() });
        added++;
      }
      return added;
    },

    async onboardingFunnel(days) {
      const since = now() - days * 24 * 60 * 60 * 1000;
      return aggregateFunnel([...onboardingEvents.values()].filter((e) => e.receivedAt >= since));
    },

    async insertMeal(record) {
      if (meals.has(record.id)) return false;
      // `?? null` so a meal nobody was asked a question about reads back the same shape it does out
      // of Postgres, where an unwritten jsonb column is null and never an absent key.
      meals.set(record.id, clone({ ...record, question: record.question ?? null }));
      return true;
    },

    async getMeals(userId, mealIds) {
      const want = new Set(mealIds);
      return [...meals.values()].filter((m) => m.user_id === userId && want.has(m.id)).map((m) => scored(clone(m)));
    },

    async getMeal(userId, mealId) {
      const m = meals.get(mealId);
      // The scoping rule, enforced here and not merely intended: a meal belonging to someone else
      // is indistinguishable from a meal that does not exist.
      return m && m.user_id === userId ? scored(clone(m)) : null;
    },

    async deleteMeal(userId, mealId) {
      const m = meals.get(mealId);
      if (!m || m.user_id !== userId) return false;
      meals.delete(mealId);
      photos.delete(mealId);
      return true;
    },

    async updateMeal(userId, mealId, patch: MealPatch) {
      const m = meals.get(mealId);
      if (!m || m.user_id !== userId) return null;
      const next: MealRecord = { ...m };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) (next as unknown as Record<string, unknown>)[k] = v;
      }
      meals.set(mealId, clone(next));
      return scored(clone(next));
    },

    async mealsForDate(userId, date) {
      return [...meals.values()]
        .filter((m) => m.user_id === userId && m.date === date)
        .sort((a, b) => a.ts.localeCompare(b.ts))
        .map((m) => scored(clone(m)));
    },

    async mealsSince(userId, from, to, limit) {
      return [...meals.values()]
        .filter((m) => m.user_id === userId && m.date >= from && m.date <= to)
        .sort((a, b) => b.date.localeCompare(a.date) || b.ts.localeCompare(a.ts))
        .slice(0, Math.max(0, limit))
        .map((m) => scored(clone(m)));
    },

    async putPhotos(userId, mealId, input) {
      const m = meals.get(mealId);
      if (!m || m.user_id !== userId || input.length === 0) return;
      const list = photos.get(mealId) ?? [];
      for (const [i, p] of input.entries()) {
        if (list.some((q) => q.position === i)) continue;
        list.push({ userId, position: i, mime: p.mime, bytes: new Uint8Array(p.bytes) });
      }
      list.sort((a, b) => a.position - b.position);
      photos.set(mealId, list);
      meals.set(mealId, { ...m, photos: list.length });
    },
    async appendPhotos(userId, mealId, input) {
      const m = meals.get(mealId);
      if (!m || m.user_id !== userId) return 0;
      const list = photos.get(mealId) ?? [];
      let next = list.reduce((n, q) => Math.max(n, q.position + 1), 0);
      for (const p of input) {
        list.push({ userId, position: next++, mime: p.mime, bytes: new Uint8Array(p.bytes) });
      }
      list.sort((a, b) => a.position - b.position);
      photos.set(mealId, list);
      meals.set(mealId, { ...m, photos: list.length });
      return list.length;
    },

    async getPhotos(userId, mealId) {
      return (photos.get(mealId) ?? [])
        .filter((p) => p.userId === userId)
        .map(({ position, mime, bytes }) => ({ position, mime, bytes: new Uint8Array(bytes) }));
    },

    async getPhoto(userId, mealId, position) {
      const p = (photos.get(mealId) ?? []).find((q) => q.userId === userId && q.position === position);
      return p ? { position: p.position, mime: p.mime, bytes: new Uint8Array(p.bytes) } : null;
    },

    async totalsSince(userId, since) {
      const byDate = new Map<string, DayTotals>();
      for (const m of meals.values()) {
        if (m.user_id !== userId || m.date < since) continue;
        const row = byDate.get(m.date) ??
          { date: m.date, kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0, satfat_g: 0 };
        row.kcal += m.kcal;
        row.protein_g += m.protein_g;
        row.carbs_g += m.carbs_g;
        row.fat_g += m.fat_g;
        row.satfat_g += m.satfat_g;
        byDate.set(m.date, row);
      }
      return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
    },

    async putWeight(userId, date, kg) {
      weights.set(`${userId}\n${date}`, { userId, date, kg });
    },

    async weightsSince(userId, since) {
      return [...weights.values()]
        .filter((w) => w.userId === userId && w.date >= since)
        .map(({ date, kg }) => ({ date, kg }))
        .sort((a, b) => b.date.localeCompare(a.date));
    },

    async recordPortionCorrections(userId, rows) {
      // A zero before is a division by zero, not a small portion. Refused here as well as at the
      // call site, so no such row can exist to poison a median. Postgres refuses it identically.
      for (const r of rows) if (r.grams_before > 0) portionCorrections.push({ ...r, userId });
    },

    async portionPriors(userId, minCount, limit) {
      const mine: PortionCorrection[] = [];
      for (let i = portionCorrections.length - 1; i >= 0 && mine.length < PORTION_PRIOR_ROWS; i--) {
        if (portionCorrections[i]!.userId === userId) mine.push(portionCorrections[i]!);
      }
      return portionPriorsFrom(mine, minCount, limit);
    },

    async putPending(pending) {
      pendings.set(pending.id, clone(pending));
    },

    async getPending(userId, pendingId) {
      const p = pendings.get(pendingId);
      if (!p || p.userId !== userId) return null;
      if (p.expiresAt <= now()) {
        pendings.delete(pendingId);
        return null;
      }
      return clone(p);
    },

    async pendingsFor(userId) {
      return [...pendings.values()]
        .filter((p) => p.userId === userId && p.expiresAt > now())
        .sort((a, b) => a.expiresAt - b.expiresAt)
        .map((p) => clone(p));
    },

    async pruneExpiredPendings() {
      let n = 0;
      for (const [id, p] of pendings) if (p.expiresAt <= now()) { pendings.delete(id); n++; }
      return n;
    },

    async dropPending(userId, pendingId) {
      const p = pendings.get(pendingId);
      return p !== undefined && p.userId === userId && p.expiresAt > now() && pendings.delete(pendingId);
    },

    async updatePending(userId, pending) {
      const p = pendings.get(pending.id);
      if (!p || p.userId !== userId || p.expiresAt <= now()) return false;
      pendings.set(pending.id, clone(pending));
      return true;
    },

    async putPairingCode(userId, codeHash, expiresAt) {
      // The account's previous code and every expired one, then the insert — the same order and
      // the same lazy sweep as the Postgres statement.
      for (const [h, c] of pairingCodes) {
        if (c.userId === userId || c.expiresAt <= now()) pairingCodes.delete(h);
      }
      pairingCodes.set(codeHash, { userId, expiresAt });
    },

    async claimPairingCode(codeHash) {
      const row = pairingCodes.get(codeHash);
      // Deleted whether or not it is spendable, exactly as the Postgres delete-returning is: an
      // expired row that survived its refusal is a row a backwards clock would make live again.
      if (row === undefined) return null;
      pairingCodes.delete(codeHash);
      return row.expiresAt > now() ? row.userId : null;
    },

    async appendChat(userId, lines) {
      const ts = new Date(now()).toISOString();
      for (const line of lines) {
        chat.push({
          id: crypto.randomUUID(), userId, seq: ++chatSeq, ts, role: line.role, kind: line.kind,
          text: "text" in line ? line.text : null,
          mealId: line.kind === "meal" ? line.mealId : line.mealId ?? null,
          event: line.kind === "meal" ? line.event : null,
          clientId: line.role === "user" && line.kind === "text" ? line.clientId ?? null : null,
          pendingId: line.role === "user" && line.kind === "text" ? line.pendingId ?? null : null,
          speaker: line.role === "assistant" ? line.speaker ?? null : null,
          intent: line.role === "user" && line.kind === "text" ? line.intent ?? null : null,
          model: line.role === "assistant" && line.kind === "text" ? line.model ?? null : null,
          analysisId: line.role === "user" ? line.analysisId ?? null : null,
        });
      }
    },

    async chatBefore(userId, before, limit) {
      const out: ChatMessage[] = [];
      for (let i = chat.length - 1; i >= 0 && out.length < limit; i--) {
        const m = chat[i]!;
        if (m.userId === userId && (before === null || m.seq < before)) out.push(clone(m));
      }
      return out;
    },

    async countUserChat(userId) {
      return chat.filter((m) => m.userId === userId).length;
    },

    async getLine(userId, lineId) {
      const m = chat.find((l) => l.id === lineId);
      return m && m.userId === userId ? clone(m) : null;
    },
    async photoLineFor(userId, mealId) {
      for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i]!;
        if (m.userId === userId && m.kind === "photo" && m.mealId === mealId) return clone(m);
      }
      return null;
    },
    async carrierLineFor(userId, mealId) {
      for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i]!;
        if (m.userId !== userId || m.role !== "user") continue;
        if ((m.kind === "photo" && m.mealId === mealId) || (m.kind === "text" && m.pendingId === mealId)) {
          return clone(m);
        }
      }
      return null;
    },
    async deleteLine(userId, lineId) {
      const i = chat.findIndex((l) => l.id === lineId && l.userId === userId);
      if (i === -1) return false;
      chat.splice(i, 1);
      return true;
    },
    async deleteMealLines(userId, mealId) {
      let n = 0;
      for (let i = chat.length - 1; i >= 0; i--) {
        const m = chat[i]!;
        if (m.userId === userId && m.kind !== "photo" && m.mealId === mealId) { chat.splice(i, 1); n++; }
      }
      return n;
    },
    async deleteMealComments(userId, mealId) {
      const mine = chat.filter((m) => m.userId === userId);
      const untagged = (m: ChatMessage) => m.role === "assistant" && m.kind === "text" && m.mealId === null;
      const doomed = new Set<string>();
      mine.forEach((m, i) => {
        if (m.role === "assistant" && m.kind === "text" && m.mealId === mealId) { doomed.add(m.id); return; }
        // Legacy rows (before #1752) carry no meal id: they belong to the card they directly follow.
        if (!untagged(m)) return;
        let j = i - 1;
        while (j >= 0 && untagged(mine[j]!)) j--;
        if (j >= 0 && mine[j]!.kind === "meal" && mine[j]!.mealId === mealId) doomed.add(m.id);
      });
      for (let i = chat.length - 1; i >= 0; i--) if (doomed.has(chat[i]!.id)) chat.splice(i, 1);
      return doomed.size;
    },
    async updateLineText(userId, lineId, text) {
      const m = chat.find((l) => l.id === lineId && l.userId === userId);
      if (!m) return false;
      m.text = text;
      return true;
    },

    async claimFirstVerdict(userId) {
      if (!users.has(userId) || firstVerdictSpoken.has(userId)) return false;
      firstVerdictSpoken.add(userId);
      return true;
    },

    async releaseFirstVerdict(userId) {
      firstVerdictSpoken.delete(userId);
    },

    async countUserPhotos(userId, date) {
      return analyses.filter((a) => a.userId === userId && a.date === date && a.scope === "photo").length;
    },

    async countGlobalAnalyses(date) {
      return analyses.filter((a) => a.date === date).length;
    },

    async countClipAnalyses(date) {
      return analyses.filter((a) => a.date === date && a.scope === "clip").length;
    },

    async countUserAnalyses(userId) {
      return analyses.filter((a) => a.userId === userId && a.sample).length;
    },

    async getFreeAnalyses(userId) {
      return freeAnalyses.get(userId) ?? null;
    },

    async setFreeAnalyses(userId, n) {
      if (!users.has(userId)) return false;
      if (n === null) freeAnalyses.delete(userId); else freeAnalyses.set(userId, n);
      return true;
    },

    async recordAnalysis(userId, date, scope) {
      const id = String(++analysisSeq);
      analyses.push({ id, userId, date, scope, costUsd: null, unpricedCalls: 0, sample: true });
      return id;
    },

    async addCost(userId, analysisId, usd) {
      const a = analyses.find((x) => x.id === analysisId && x.userId === userId);
      if (!a) return false;
      if (usd === null) a.unpricedCalls++;
      else a.costUsd = (a.costUsd ?? 0) + usd;
      return true;
    },

    async recordTiming(userId, analysisId, timing) {
      const a = analyses.find((x) => x.id === analysisId && x.userId === userId);
      if (!a) return false;
      a.msQueue = timing.queue;
      a.msFirstItem = timing.firstItem;
      a.msTotal = timing.total;
      return true;
    },

    async analysisCosts(userId, analysisIds) {
      return analyses
        .filter((a) => a.userId === userId && analysisIds.includes(a.id))
        .map((a) => ({ id: a.id, costUsd: a.costUsd, unpricedCalls: a.unpricedCalls }));
    },

    async undoAnalysis(userId, analysisId) {
      const i = analyses.findIndex((a) => a.id === analysisId && a.userId === userId);
      if (i < 0) return false;
      analyses.splice(i, 1);
      return true;
    },

    async releaseSample(userId, analysisId) {
      const a = analyses.find((x) => x.id === analysisId && x.userId === userId);
      if (!a) return false;
      a.sample = false;
      return true;
    },

    async claimTurn(userId, clientId) {
      const k = `${userId}\n${clientId}`;
      if (turns.has(k)) return false;
      turns.set(k, { userId, clientId, outcome: null, claimedAt: now() });
      return true;
    },

    async getTurn(userId, clientId) {
      const t = turns.get(`${userId}\n${clientId}`);
      return t ? { outcome: t.outcome === null ? null : clone(t.outcome), claimedAt: t.claimedAt } : null;
    },

    async settleTurn(userId, clientId, outcome) {
      const t = turns.get(`${userId}\n${clientId}`);
      if (t) t.outcome = clone(outcome);
    },

    async enqueueJob(userId, input) {
      const k = `${userId}\n${input.clientId}`;
      if (turns.has(k)) return false;
      turns.set(k, { userId, clientId: input.clientId, outcome: null, claimedAt: now() });
      jobs.set(k, {
        userId, clientId: input.clientId, kind: input.kind, requestVersion: input.requestVersion, request: clone(input.request),
        state: "queued", attempts: 0, step: input.step, items: [], leaseOwner: null, leaseUntil: null, mealId: null, analysisId: null,
        removedAt: null, followedUntil: null, pushedAt: null, createdAt: now(), updatedAt: now(), outcome: null,
        photos: input.photos.map((p) => ({ mime: p.mime, bytes: new Uint8Array(p.bytes) })),
      });
      notifyEnqueued();
      return true;
    },

    async getJob(userId, clientId) {
      const j = jobs.get(`${userId}\n${clientId}`);
      return j ? asRecord(j) : null;
    },

    async listJobs(userId, opts) {
      const bar = opts.cursor ? opts.cursor.indexOf("|") : -1;
      const [cu, cc] = bar > 0 ? [opts.cursor!.slice(0, bar), opts.cursor!.slice(bar + 1)] : [null, null];
      const after = cu === null ? Infinity : Date.parse(cu);
      const all = [...jobs.values()]
        .filter((j) => j.userId === userId
          && (opts.state === "all" || (opts.state === "active") === (j.state !== "settled"))
          && (opts.since === null || j.updatedAt > opts.since)
          && (cu === null || j.updatedAt < after || (j.updatedAt === after && j.clientId < cc!)))
        .sort((a, b) => b.updatedAt - a.updatedAt || (a.clientId < b.clientId ? 1 : -1));
      const page = all.slice(0, opts.limit).map(asRecord);
      const last = page[page.length - 1];
      return { jobs: page, cursor: all.length > opts.limit && last ? `${new Date(last.updatedAt).toISOString()}|${last.clientId}` : null };
    },

    async jobPhotos(userId, clientId) {
      return (jobs.get(`${userId}\n${clientId}`)?.photos ?? []).map((p) => ({ mime: p.mime, bytes: new Uint8Array(p.bytes) }));
    },

    async jobProgress(userId, clientId, owner, step, items) {
      const j = jobs.get(`${userId}\n${clientId}`);
      if (!j || j.leaseOwner !== owner || j.state !== "running") return false;
      j.step = step; j.items = clone(items); j.updatedAt = now();
      notifyJob(userId, clientId);
      return true;
    },

    async followJob(userId, clientId, until) {
      const j = jobs.get(`${userId}\n${clientId}`);
      if (j) j.followedUntil = until;
    },

    async removeJob(userId, clientId) {
      const j = jobs.get(`${userId}\n${clientId}`);
      if (!j || j.state === "settled") return false;
      j.removedAt = now(); j.updatedAt = now();
      notifyJob(userId, clientId);
      return true;
    },

    async settleJob(userId, clientId, owner, outcome) {
      const j = jobs.get(`${userId}\n${clientId}`);
      if (!j || j.leaseOwner !== owner || j.state !== "running") return false;
      settle(j, outcome);
      return true;
    },

    async claimPush(userId, clientId) {
      const j = jobs.get(`${userId}\n${clientId}`);
      if (!j || j.pushedAt !== null || j.removedAt !== null || (j.followedUntil !== null && j.followedUntil >= now())) return false;
      j.pushedAt = now();
      return true;
    },

    async chargeJob(userId, clientId, owner, analysisId) {
      const j = jobs.get(`${userId}\n${clientId}`);
      if (!j || j.leaseOwner !== owner || j.state !== "running") return false;
      j.analysisId = analysisId;
      return true;
    },

    async landJobMeal(userId, clientId, owner, meal) {
      const j = jobs.get(`${userId}\n${clientId}`);
      if (!j || j.leaseOwner !== owner || j.state !== "running" || j.mealId !== null || meals.has(meal.id)) return false;
      j.mealId = meal.id; j.updatedAt = now();
      meals.set(meal.id, clone({ ...meal, question: meal.question ?? null }));
      const list = j.photos.map((p, position) => ({ userId, position, mime: p.mime, bytes: p.bytes }));
      j.photos = [];
      if (list.length > 0) photos.set(meal.id, list);
      meals.set(meal.id, { ...meals.get(meal.id)!, photos: list.length });
      return true;
    },

    async releaseJobs(owner) {
      let n = 0;
      for (const j of jobs.values()) {
        if (j.leaseOwner !== owner || j.state !== "running") continue;
        j.state = "queued"; j.leaseOwner = null; j.leaseUntil = null; j.updatedAt = now(); n++;
      }
      if (n > 0) notifyEnqueued();
      return n;
    },

    async claimJob(owner, registry, leaseMs) {
      const j = [...jobs.values()]
        .filter((x) => registry.some((r) => r.kind === x.kind && x.requestVersion <= r.version)
          && (x.state === "queued" || (x.state === "running" && x.leaseUntil! < now() && x.attempts < 2)))
        .sort((a, b) => a.createdAt - b.createdAt)[0];
      if (!j) return null;
      j.state = "running"; j.leaseOwner = owner; j.leaseUntil = now() + leaseMs; j.attempts++; j.updatedAt = now();
      return asRecord(j);
    },

    async heartbeatJobs(owner, leaseMs) {
      let n = 0;
      for (const j of jobs.values()) if (j.leaseOwner === owner && j.state === "running") { j.leaseUntil = now() + leaseMs; n++; }
      return n;
    },

    async expireJobs(createdBefore, outcome) {
      const out: { userId: string; clientId: string }[] = [];
      for (const j of jobs.values()) {
        if (j.state === "settled" || !(j.state === "queued" || j.leaseUntil! < now())) continue;
        if (!(j.createdAt < createdBefore || (j.state === "running" && j.attempts >= 2))) continue;
        settle(j, outcome);
        out.push({ userId: j.userId, clientId: j.clientId });
      }
      return out;
    },

    async forgetJobs(before) {
      let n = 0;
      for (const [k, j] of jobs) {
        if (j.state === "settled" && j.updatedAt < before) { jobs.delete(k); n++; }
        else if (j.createdAt < before) j.photos = [];
      }
      return n;
    },

    async forgetTurnOutcomes(before) {
      let n = 0;
      for (const t of turns.values()) {
        if (t.outcome !== null && t.claimedAt < before) { t.outcome = null; n++; }
      }
      return n;
    },

    async putHealthDays(userId, days) {
      let written = 0;
      for (const day of days) {
        healthDays.set(`${userId}\n${day.date}`, { ...clone(day), userId });
        written++;
      }
      return written;
    },

    async healthDaysSince(userId, since) {
      return [...healthDays.values()]
        .filter((d) => d.userId === userId && d.date >= since)
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(({ userId: _u, ...day }) => clone(day as HealthDay));
    },

    async pruneHealthDaysBefore(before) {
      // Across every account, like the statement it stands in for — see the port.
      let gone = 0;
      for (const [key, day] of healthDays) {
        if (day.date < before) { healthDays.delete(key); gone++; }
      }
      return gone;
    },

    async deleteUser(userId) {
      eraseUser(userId);
    },

    async pruneAbandonedAccounts(before) {
      // Collect first, erase after: `eraseUser` deletes from `createdAt` under the iteration.
      const gone: string[] = [];
      for (const [userId, at] of createdAt) {
        if (at >= before) continue;
        // Any entitlement event disqualifies, live or lapsed — the purchase history is what a
        // legacy anonymous account's next renewal would come back to.
        if (entitlements.has(userId)) continue;
        // `device` is the exception for the port's reason — it is the credential being swept.
        if (identities.some((i) => i.userId === userId && i.provider !== "device")) continue;
        if ([...meals.values()].some((m) => m.user_id === userId)) continue;
        if ([...tokens.values()].some((t) => t.userId === userId && t.lastUsedAt >= before)) continue;
        gone.push(userId);
      }
      for (const userId of gone) eraseUser(userId);
      return gone.length;
    },

    // One store IS the cluster: there is no second connection to contest the lock with, so this
    // process leads from the first ask. Two stores in one process are two universes, not two
    // replicas — the contract suite constructs them per case.
    async tryLeadership() {
      return true;
    },
    async releaseLeadership() {},

    async onJobNotify(handlers) {
      const l = { ...handlers };
      listeners.add(l);
      return async () => { listeners.delete(l); };
    },

    async close() {
      listeners.clear();
    },
  };
}
