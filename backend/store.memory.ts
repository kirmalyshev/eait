// In-memory Store. What the tests run against, and what `bun run start:demo` runs against.
//
// It is a real implementation of the same interface, not a stub with holes: the user-scoping rules
// are enforced here exactly as they are in Postgres, so a test that proves "another user's meal id
// resolves to null" is proving something about the engine rather than about a mock's mood.

import type {
  DayTotals, Lang, MealRecord, OnboardingContent, OnboardingEvent, Profile, Provider,
} from "@ieat/shared";
import {
  blankProfile, type FunnelAggregate, type MealPatch, type PendingMeal, type ProfilePatch,
  type Store,
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

export function memoryStore(): Store {
  const users = new Map<string, Profile>();
  const devices = new Map<string, string>(); // deviceId -> userId
  const tokens = new Map<string, string>(); // token -> userId
  const meals = new Map<string, MealRecord>(); // mealId -> record
  const pendings = new Map<string, PendingMeal>(); // pendingId -> pending
  const analyses: { userId: string; date: string; scope: "photo" | "text" }[] = [];
  const identities: { userId: string; provider: Provider; subject: string; linkedAt: string }[] = [];
  const onboardingEvents = new Map<string, StoredEvent>(); // event id -> event
  // Keyed by address, which is what makes a repeat subscription an upsert here too.
  const subscribers = new Map<string, { token: string; source: string; createdAt: number }>();
  let onboardingContent: OnboardingContent | null = null;

  /** Deep-copies on the way out so a caller mutating a returned object cannot edit the store. */
  const clone = <T>(v: T): T => structuredClone(v);

  return {
    async upsertDeviceUser(deviceId, lang: Lang) {
      const existing = devices.get(deviceId);
      if (existing) return { userId: existing, created: false };
      const userId = crypto.randomUUID();
      devices.set(deviceId, userId);
      users.set(userId, blankProfile(userId, lang));
      identities.push({ userId, provider: "device", subject: deviceId, linkedAt: new Date().toISOString() });
      return { userId, created: true };
    },

    async createUser(lang: Lang) {
      const userId = crypto.randomUUID();
      users.set(userId, blankProfile(userId, lang));
      return userId;
    },

    async issueToken(userId) {
      const token = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
      tokens.set(token, userId);
      return token;
    },

    async userIdForToken(token) {
      return tokens.get(token) ?? null;
    },

    async revokeToken(token) {
      tokens.delete(token);
    },

    async userIdForIdentity(provider, subject) {
      return identities.find((i) => i.provider === provider && i.subject === subject)?.userId ?? null;
    },

    async addIdentity(userId, provider, subject) {
      const clash = identities.find((i) => i.provider === provider && i.subject === subject);
      // Uniqueness is enforced here, not merely expected — the Postgres implementation has a
      // constraint and the in-memory one must fail the same way or a test proves nothing.
      if (clash && clash.userId !== userId) throw new Error("identity already linked to another account");
      if (clash) return;
      identities.push({ userId, provider, subject, linkedAt: new Date().toISOString() });
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
      for (const a of analyses) if (a.userId === fromUserId) a.userId = intoUserId;
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

      // Tokens are deleted, not moved: one that pointed at the now-empty account must stop working
      // rather than silently start addressing someone else's diary.
      for (const [t, u] of tokens) if (u === fromUserId) tokens.delete(t);
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

    async getOnboardingContent() {
      return onboardingContent ? clone(onboardingContent) : null;
    },

    async putOnboardingContent(content) {
      onboardingContent = clone(content);
    },

    async recordOnboardingEvents(userId, events) {
      let added = 0;
      for (const e of events) {
        // Keyed on the CLIENT's id, so a retried batch overwrites nothing and adds nothing. The
        // Postgres implementation gets the same behaviour from a primary key.
        if (onboardingEvents.has(e.id)) continue;
        onboardingEvents.set(e.id, { ...clone(e), userId, receivedAt: Date.now() });
        added++;
      }
      return added;
    },

    async onboardingFunnel(days) {
      const since = Date.now() - days * 24 * 60 * 60 * 1000;
      return aggregateFunnel([...onboardingEvents.values()].filter((e) => e.receivedAt >= since));
    },

    // ── The mailing list ─────────────────────────────────────────────────────────────────────
    //
    // Same rules as the Postgres implementation, so a test proving "a repeat subscription returns
    // the FIRST token" proves something about the engine rather than about a mock's mood.

    async addSubscriber(email, source) {
      const existing = subscribers.get(email);
      if (existing) return { token: existing.token, created: false };
      const token = [...crypto.getRandomValues(new Uint8Array(32))]
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      subscribers.set(email, { token, source, createdAt: Date.now() });
      return { token, created: true };
    },

    async removeSubscriber(token) {
      for (const [email, row] of subscribers) {
        if (row.token === token) { subscribers.delete(email); return true; }
      }
      return false;
    },

    async countSubscribersSince(sinceIso) {
      const since = Date.parse(sinceIso);
      return [...subscribers.values()].filter((r) => r.createdAt >= since).length;
    },

    async insertMeal(record) {
      meals.set(record.id, clone(record));
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

    async putPending(pending) {
      pendings.set(pending.id, clone(pending));
    },

    async getPending(userId, pendingId) {
      const p = pendings.get(pendingId);
      if (!p || p.userId !== userId) return null;
      if (p.expiresAt <= Date.now()) {
        pendings.delete(pendingId);
        return null;
      }
      return clone(p);
    },

    async dropPending(userId, pendingId) {
      const p = pendings.get(pendingId);
      if (p && p.userId === userId) pendings.delete(pendingId);
    },

    async countUserPhotos(userId, date) {
      return analyses.filter((a) => a.userId === userId && a.date === date && a.scope === "photo").length;
    },

    async countGlobalAnalyses(date) {
      return analyses.filter((a) => a.date === date).length;
    },

    async recordAnalysis(userId, date, scope) {
      analyses.push({ userId, date, scope });
    },

    async deleteUser(userId) {
      users.delete(userId);
      for (const [d, u] of devices) if (u === userId) devices.delete(d);
      for (const [t, u] of tokens) if (u === userId) tokens.delete(t);
      for (const [id, m] of meals) if (m.user_id === userId) meals.delete(id);
      for (const [id, p] of pendings) if (p.userId === userId) pendings.delete(id);
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
    },

    async close() {},
  };
}
