// In-memory Store. What the tests run against, and what `bun run start:demo` runs against.
//
// It is a real implementation of the same interface, not a stub with holes: the user-scoping rules
// are enforced here exactly as they are in Postgres, so a test that proves "another user's meal id
// resolves to null" is proving something about the engine rather than about a mock's mood.

import type {
  DayTotals, HealthDay, Lang, MealRecord, NotificationCopy, OnboardingContent, OnboardingEvent,
  Profile, Provider,
} from "@eait/shared";
import {
  DEFAULT_SESSION_TTL_MS, hashToken, newSessionToken, sessionRefreshAfterMs,
} from "./auth/tokens.ts";
import { type ChatMessage,
  PORTION_PRIOR_ROWS, blankProfile, portionPriorsFrom, type FunnelAggregate, type MealPatch,
  type PendingMeal, type PortionCorrection, type ProfilePatch, type PushPlatform, type PushToken,
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

export function memoryStore(opts: StoreOptions = {}): Store {
  const sessionTtlMs = opts.sessionTtlMs ?? DEFAULT_SESSION_TTL_MS;
  const refreshAfterMs = sessionRefreshAfterMs(sessionTtlMs);
  const now = opts.now ?? Date.now;

  const users = new Map<string, Profile>();
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
  /** The later of two instants, tolerating the first not existing yet. */
  const newest = (a: string | undefined, b: string): string =>
    a !== undefined && Date.parse(a) > Date.parse(b) ? a : b;
  const blank = (c: StoredWithClocks | undefined): StoredWithClocks => c ?? {
    expiresAt: null, expiresEventAt: null, lifetimeProductId: null, lifetimeEventAt: null,
    productId: "", eventAt: "", trial: false,
  };
  const devices = new Map<string, string>(); // deviceId -> userId
  // Keyed by the HASH of the token, exactly as Postgres is. Storing the raw value here would make
  // demo mode the one environment where a token is recoverable from the store — and demo mode is
  // where the sign-in flows get driven, so it is the environment where that would be noticed last.
  const tokens = new Map<string, { userId: string; lastUsedAt: number }>();
  const meals = new Map<string, MealRecord>(); // mealId -> record
  const photos = new Map<string, (StoredPhoto & { userId: string })[]>(); // mealId -> in position order
  const pendings = new Map<string, PendingMeal>(); // pendingId -> pending
  // Append-only; `seq` comes from a monotonic counter, never reused, the same way the Postgres
  // bigserial is. Rows of a deleted user are removed, so it gaps.
  const chat: ChatMessage[] = [];
  let chatSeq = 0;
  const firstVerdictSpoken = new Set<string>();
  let notificationCopy: NotificationCopy | null = null;
  // Keyed by the TOKEN, exactly as Postgres is: a token is an installation, so registering it under
  // a second account moves it rather than adding a row.
  const pushTokens = new Map<string, { userId: string; platform: PushPlatform }>();
  const analyses: { userId: string; date: string; scope: "photo" | "text" }[] = [];
  // Append-only and read newest-first, which is the order Postgres reads them in.
  const portionCorrections: (PortionCorrection & { userId: string })[] = [];
  const identities: {
    userId: string; provider: Provider; subject: string; linkedAt: string; email: string | null;
  }[] = [];
  const onboardingEvents = new Map<string, StoredEvent>(); // event id -> event
  // `${userId}\n${date}` -> the day. One row per user per date, exactly as in Postgres, so the
  // upsert semantics the tests assert are the semantics production has.
  const healthDays = new Map<string, HealthDay & { userId: string }>();
  // Keyed by address, which is what makes a repeat subscription an upsert here too.
  const subscribers = new Map<string, {
    token: string;
    confirmToken: string;
    /** Null until the address is confirmed. A pending row is not a subscriber. */
    confirmedAt: number | null;
    source: string;
    createdAt: number;
  }>();
  let onboardingContent: OnboardingContent | null = null;

  /** 256 bits of hex. Used for both subscriber capabilities: confirmation and withdrawal. */
  const randomHex = (): string =>
    [...crypto.getRandomValues(new Uint8Array(32))].map((b) => b.toString(16).padStart(2, "0")).join("");

  /** Deep-copies on the way out so a caller mutating a returned object cannot edit the store. */
  const clone = <T>(v: T): T => structuredClone(v);

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
      if (at - row.lastUsedAt > sessionTtlMs) {
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
    // Goes with the account. In Postgres this is a column on `users` and needs no statement at
    // all; here it is a second map, so it needs this line to keep the two stores honest.
    entitlements.delete(userId);
    freeAnalyses.delete(userId);
    for (const [d, u] of devices) if (u === userId) devices.delete(d);
    for (const [h, row] of tokens) if (row.userId === userId) tokens.delete(h);
    for (const [id, m] of meals) if (m.user_id === userId) meals.delete(id);
    for (const [id, list] of photos) if (list.some((p) => p.userId === userId)) photos.delete(id);
    for (const [id, p] of pendings) if (p.userId === userId) pendings.delete(id);
    // The thread holds the medical free text a person typed at Spud. It goes with the account.
    for (let i = chat.length - 1; i >= 0; i--) if (chat[i]!.userId === userId) chat.splice(i, 1);
    firstVerdictSpoken.delete(userId);
    for (let i = analyses.length - 1; i >= 0; i--) {
      if (analyses[i]!.userId === userId) analyses.splice(i, 1);
    }
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
  };

  return {
    async upsertDeviceUser(deviceId, lang: Lang) {
      const existing = devices.get(deviceId);
      const userId = existing ?? crypto.randomUUID();
      if (existing === undefined) {
        devices.set(deviceId, userId);
        users.set(userId, blankProfile(userId, lang));
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

    async createUser(lang: Lang) {
      const userId = crypto.randomUUID();
      users.set(userId, blankProfile(userId, lang));
      return userId;
    },

    async issueToken(userId) {
      const token = newSessionToken();
      tokens.set(await hashToken(token), { userId, lastUsedAt: now() });
      prune();
      return token;
    },

    async userIdForToken(token) {
      const row = tokens.get(await hashToken(token));
      if (!row) return null;

      const at = now();
      // Idle past its lifetime is indistinguishable from never issued, and deliberately so. The row
      // is dropped on the way out rather than left for the next prune: a token that has just been
      // refused must not be answerable again if the clock moves backwards.
      if (at - row.lastUsedAt > sessionTtlMs) {
        tokens.delete(await hashToken(token));
        return null;
      }

      // Slide the deadline, but only once the value is actually stale. See `sessionRefreshAfterMs`.
      if (at - row.lastUsedAt >= refreshAfterMs) row.lastUsedAt = at;
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
      if (identities.some((i) => i.userId === userId)) return "removed";
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
      for (const a of analyses) if (a.userId === fromUserId) a.userId = intoUserId;
      // What the app has learned about this person's portions is learned before they sign in.
      for (const c of portionCorrections) if (c.userId === fromUserId) c.userId = intoUserId;
      for (const m of chat) if (m.userId === fromUserId) m.userId = intoUserId;
      // The greeting travels with the thread that holds it, or Spud says "First one in." twice.
      if (firstVerdictSpoken.delete(fromUserId)) firstVerdictSpoken.add(intoUserId);
      // The paid tier moves too — see store.pg.ts for why this is the one entry here that is
      // somebody's money. Per grant, and only into a gap.
      const from = entitlements.get(fromUserId);
      if (from) {
        const into = entitlements.get(intoUserId);
        entitlements.set(intoUserId, {
          expiresAt: into?.expiresAt ?? from.expiresAt,
          expiresEventAt: into?.expiresEventAt ?? from.expiresEventAt,
          lifetimeProductId: into?.lifetimeProductId ?? from.lifetimeProductId,
          lifetimeEventAt: into?.lifetimeEventAt ?? from.lifetimeEventAt,
          // `??`, not `||`: an empty productId is a stored value, and Postgres's coalesce keeps it.
          productId: into?.productId ?? from.productId,
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
      // time we get here, so those are device identities only — and repointing one would mean that
      // after signing out, plain device auth silently walks back into the full account without any
      // credential being presented. Sign-out has to mean something.
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

      // Tokens are deleted, not moved: one that pointed at the now-empty account must stop working
      // rather than silently start addressing someone else's diary.
      for (const [h, row] of tokens) if (row.userId === fromUserId) tokens.delete(h);
      users.delete(fromUserId);
      return moved;
    },

    async getProfile(userId) {
      const p = users.get(userId);
      return p ? clone(p) : null;
    },

    async patchProfile(userId, patch: ProfilePatch) {
      const current = users.get(userId);
      if (!current) throw new Error("no such user");
      // Explicit key iteration, not a spread of `patch`: a spread would copy keys whose value is
      // `undefined` and overwrite a stored value with nothing. Absent means "leave alone".
      const next: Profile = { ...current };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) (next as unknown as Record<string, unknown>)[k] = v;
      }
      users.set(userId, next);
      return clone(next);
    },

    async getEntitlement(userId) {
      const e = entitlements.get(userId);
      // The per-grant clocks are the store's own bookkeeping and are deliberately NOT part of
      // `StoredEntitlement`: nothing outside here may order events, and a field that escapes the
      // port is a field somebody will branch on.
      if (!e) return null;
      return {
        expiresAt: e.expiresAt, lifetimeProductId: e.lifetimeProductId,
        productId: e.productId, eventAt: e.eventAt, trial: e.trial === true,
      };
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
        productId: patch.productId,
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

    async usersWithPushTokens() {
      return [...new Set([...pushTokens.values()].map((r) => r.userId))];
    },

    async getOnboardingContent() {
      return onboardingContent ? clone(onboardingContent) : null;
    },

    async putOnboardingContent(content) {
      onboardingContent = clone(content);
    },

    async getNotificationCopy() {
      return notificationCopy ? clone(notificationCopy) : null;
    },

    async putNotificationCopy(copy) {
      notificationCopy = clone(copy);
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

    // ── The mailing list ─────────────────────────────────────────────────────────────────────
    //
    // Same rules as the Postgres implementation, so a test proving "a repeat subscription returns
    // the FIRST token" proves something about the engine rather than about a mock's mood.

    async addSubscriber(email, source) {
      const existing = subscribers.get(email);
      if (existing) {
        return {
          // Null once confirmed — the caller's signal to send nothing at all. Re-submitting a
          // pending address returns the SAME token, so the link already in somebody's inbox keeps
          // working rather than being quietly replaced.
          confirmToken: existing.confirmedAt === null ? existing.confirmToken : null,
          unsubscribeToken: existing.token,
          created: false,
        };
      }
      const token = randomHex();
      const confirmToken = randomHex();
      subscribers.set(email, {
        token, confirmToken, confirmedAt: null, source, createdAt: now(),
      });
      return { confirmToken, unsubscribeToken: token, created: true };
    },

    async confirmSubscriber(confirmToken) {
      for (const row of subscribers.values()) {
        if (row.confirmToken === confirmToken) {
          // Idempotent: the first click sets the time, the second finds it already set and still
          // reports success, exactly as unsubscribing twice does.
          row.confirmedAt ??= now();
          return true;
        }
      }
      return false;
    },

    async removeSubscriber(token) {
      for (const [email, row] of subscribers) {
        if (row.token === token) { subscribers.delete(email); return true; }
      }
      return false;
    },

    async countSubscribersSince(sinceIso) {
      // Pending rows count. A cap that only counted confirmed ones is a cap a bot never reaches.
      const since = Date.parse(sinceIso);
      return [...subscribers.values()].filter((r) => r.createdAt >= since).length;
    },

    async pruneUnconfirmedSubscribers(beforeIso) {
      const before = Date.parse(beforeIso);
      let removed = 0;
      for (const [email, row] of subscribers) {
        if (row.confirmedAt === null && row.createdAt < before) {
          subscribers.delete(email);
          removed++;
        }
      }
      return removed;
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
      return [...meals.values()].filter((m) => m.user_id === userId && want.has(m.id)).map(clone);
    },

    async getMeal(userId, mealId) {
      const m = meals.get(mealId);
      // The scoping rule, enforced here and not merely intended: a meal belonging to someone else
      // is indistinguishable from a meal that does not exist.
      return m && m.user_id === userId ? clone(m) : null;
    },

    async updateMeal(userId, mealId, patch: MealPatch) {
      const m = meals.get(mealId);
      if (!m || m.user_id !== userId) return null;
      const next: MealRecord = { ...m };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) (next as unknown as Record<string, unknown>)[k] = v;
      }
      meals.set(mealId, clone(next));
      return clone(next);
    },

    async mealsForDate(userId, date) {
      return [...meals.values()]
        .filter((m) => m.user_id === userId && m.date === date)
        .sort((a, b) => a.ts.localeCompare(b.ts))
        .map(clone);
    },

    async mealsSince(userId, from, to, limit) {
      return [...meals.values()]
        .filter((m) => m.user_id === userId && m.date >= from && m.date <= to)
        .sort((a, b) => b.date.localeCompare(a.date) || b.ts.localeCompare(a.ts))
        .slice(0, Math.max(0, limit))
        .map(clone);
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
        const row = byDate.get(m.date) ?? { date: m.date, kcal: 0, protein_g: 0 };
        row.kcal += m.kcal;
        row.protein_g += m.protein_g;
        byDate.set(m.date, row);
      }
      return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
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

    async pruneExpiredPendings() {
      let n = 0;
      for (const [id, p] of pendings) if (p.expiresAt <= now()) { pendings.delete(id); n++; }
      return n;
    },

    async dropPending(userId, pendingId) {
      const p = pendings.get(pendingId);
      return p !== undefined && p.userId === userId && p.expiresAt > now() && pendings.delete(pendingId);
    },

    async appendChat(userId, lines) {
      const ts = new Date(now()).toISOString();
      for (const line of lines) {
        chat.push({
          id: crypto.randomUUID(), userId, seq: ++chatSeq, ts, role: line.role, kind: line.kind,
          text: "text" in line ? line.text : null,
          mealId: line.kind === "meal" ? line.mealId : line.kind === "photo" ? line.mealId ?? null : null,
          event: line.kind === "meal" ? line.event : null,
          clientId: line.role === "user" && line.kind === "text" ? line.clientId ?? null : null,
          pendingId: line.role === "user" && line.kind === "text" ? line.pendingId ?? null : null,
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

    async countUserAnalyses(userId) {
      return analyses.filter((a) => a.userId === userId).length;
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
      analyses.push({ userId, date, scope });
    },

    async undoAnalysis(userId, date, scope) {
      // The newest match, like the Postgres one. Analysis rows carry no identity beyond user, date
      // and scope, so "the one just charged" and "the newest" are the same row by construction.
      for (let i = analyses.length - 1; i >= 0; i--) {
        const a = analyses[i]!;
        if (a.userId === userId && a.date === date && a.scope === scope) {
          analyses.splice(i, 1);
          return true;
        }
      }
      return false;
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

    async deleteUser(userId) {
      eraseUser(userId);
    },

    async close() {},
  };
}
