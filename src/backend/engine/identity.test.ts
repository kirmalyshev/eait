// What a revocation does when a statement fails halfway through it.
//
// `revokeAppleIdentity` is three or four writes with no transaction around them, and Apple's
// answer to a 500 is to send the message again. That makes the ORDER a correctness property: every
// step must be safe to repeat, and the one that destroys the lookup key — the `identities` row the
// subject resolves through — must be the last one. Destroy it early and the redelivery resolves to
// nothing, answers 200, and the session the user revoked stays alive with nothing in any log.

import { beforeEach, describe, expect, it } from "bun:test";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { AuthError, type IdentityVerifier } from "../auth/verify.ts";
import { isAnonymous, revokeAppleIdentity, signInWithProvider, type EngineDeps } from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  appleAudiences: ["com.eait.fit.ios"], googleAudiences: ["test.apps.googleusercontent.com"],
};

let store: Store;
const depsFor = (s: Store): EngineDeps => ({ store: s, config: CONFIG, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() });

beforeEach(() => { store = memoryStore(); });

const device = () => crypto.randomUUID() + crypto.randomUUID();

/** One store method throws the first time it is called. A connection reset, a statement timeout. */
function failsOnce(inner: Store, method: keyof Store): Store {
  let thrown = false;
  return new Proxy(inner, {
    get(target, prop, receiver) {
      const value = Reflect.get(target, prop, receiver);
      if (prop !== method || typeof value !== "function") return value;
      return async (...args: unknown[]) => {
        if (!thrown) {
          thrown = true;
          throw new Error(`${String(prop)}: connection reset`);
        }
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    },
  }) as Store;
}

/** Every store call the revocation makes. A failure in any of them must survive one redelivery. */
const STEPS: (keyof Store)[] = ["identityFor", "revokeTokensFor", "removeIdentity"];

/**
 * One delivery, then the redelivery Apple sends after a 500. Returns the outcome that stuck.
 *
 * The first call is allowed to succeed: the two paths do not make the same writes, so a step that
 * only the other path touches never bites here. What must hold either way is the state afterwards.
 */
async function redelivered(deps: EngineDeps, subject: string): Promise<string> {
  const first = await revokeAppleIdentity(deps, subject, Date.now()).catch(() => null);
  return first ?? await revokeAppleIdentity(deps, subject, Date.now());
}

describe("a revocation interrupted halfway through", () => {
  for (const step of STEPS) {
    it(`completes on Apple's redelivery when ${String(step)} failed the first time`, async () => {
      // Apple-only: the account must end up erased AND signed out, not stranded in between.
      const userId = await store.createUser("en");
      await store.addIdentity(userId, "apple", "interrupted");
      const token = await store.issueToken(userId);

      const flaky = depsFor(failsOnce(store, step));
      expect(await redelivered(flaky, "interrupted")).toBe("deleted");

      expect(await store.userIdForToken(token)).toBeNull();
      expect(await store.getProfile(userId)).toBeNull();
      expect(await store.userIdForIdentity("apple", "interrupted")).toBeNull();
    });

    it(`completes on Apple's redelivery for a linked account when ${String(step)} failed`, async () => {
      // The same account with a device on it: unlinked, signed out, and still there.
      const { userId } = await store.upsertDeviceUser(device(), "en");
      await store.addIdentity(userId, "apple", "interrupted-linked");
      const token = await store.issueToken(userId);

      const flaky = depsFor(failsOnce(store, step));
      expect(await redelivered(flaky, "interrupted-linked")).toBe("unlinked");

      expect(await store.userIdForToken(token)).toBeNull();
      expect(await store.userIdForIdentity("apple", "interrupted-linked")).toBeNull();
      expect(await store.getProfile(userId)).not.toBeNull();
    });
  }
});

describe("an account carrying two Apple identities", () => {
  it("loses only the revoked one", async () => {
    // Possible: signing into an account that already has Apple with a SECOND Apple ID links it.
    // Deciding "nothing is left" by counting providers rather than rows would erase this account
    // while a subject that can still sign in points at it.
    const userId = await store.createUser("en");
    await store.addIdentity(userId, "apple", "first-apple");
    await store.addIdentity(userId, "apple", "second-apple");

    expect(await revokeAppleIdentity(depsFor(store), "first-apple", Date.now())).toBe("unlinked");

    expect(await store.getProfile(userId)).not.toBeNull();
    expect(await store.userIdForIdentity("apple", "first-apple")).toBeNull();
    expect(await store.userIdForIdentity("apple", "second-apple")).toBe(userId);
  });
});

describe("a delivery that predates the link it names", () => {
  // Apple's notifications carry no expiry and its deliveries are not ordered, so "this user just
  // revoked" and "this is a copy of a message about a link that has since been replaced" arrive
  // looking identical. The second one must do nothing: applied, it tears down a link the user
  // re-granted after the revocation, and on an account whose only way in is Apple it erases
  // everything the user has logged since. Same rule as `putEntitlement` and `weight_measured_at`.

  it("is ignored, leaving the identity and every session alone", async () => {
    const { userId } = await store.upsertDeviceUser(device(), "en");
    await store.addIdentity(userId, "apple", "re-linked");
    const token = await store.issueToken(userId);
    const beforeTheLink = Date.now() - 2 * 24 * 60 * 60 * 1000;

    expect(await revokeAppleIdentity(depsFor(store), "re-linked", beforeTheLink)).toBe("stale");

    expect(await store.userIdForIdentity("apple", "re-linked")).toBe(userId);
    expect(await store.userIdForToken(token)).toBe(userId);
  });

  it("does not erase an account rebuilt on the same Apple id", async () => {
    // The worst version: Apple-only account revoked and deleted, the user comes back, signs in
    // again, and a copy of the original message arrives. Ignoring it is the difference between a
    // returning user and a second erasure.
    const rebuilt = await store.createUser("en");
    await store.addIdentity(rebuilt, "apple", "rebuilt");

    expect(await revokeAppleIdentity(depsFor(store), "rebuilt", Date.now() - 60 * 60 * 1000)).toBe("stale");

    expect(await store.getProfile(rebuilt)).not.toBeNull();
    expect(await store.userIdForIdentity("apple", "rebuilt")).toBe(rebuilt);
  });

  it("applies when the event is newer than the link, which is every real revocation", async () => {
    const userId = await store.createUser("en");
    await store.addIdentity(userId, "apple", "ordinary");
    expect(await revokeAppleIdentity(depsFor(store), "ordinary", Date.now())).toBe("deleted");
  });

  it("applies when the event carries no usable time at all", async () => {
    // A revocation that cannot be ordered is still a revocation, and refusing it would leave the
    // session alive. Unorderable means unorderable — never a licence to ignore.
    const userId = await store.createUser("en");
    await store.addIdentity(userId, "apple", "no-time");
    expect(await revokeAppleIdentity(depsFor(store), "no-time", null)).toBe("deleted");
  });
});

describe("two deliveries for the same subject at once", () => {
  it("never erases an account a device could still reach", async () => {
    // One removes the Apple row; the other must not then read a single remaining row, assume it is
    // the one it came to remove, and delete a user whose device identity was working.
    const { userId } = await store.upsertDeviceUser(device(), "en");
    await store.addIdentity(userId, "apple", "concurrent");

    // A delay anywhere before the write is enough to interleave two deliveries.
    const slow = new Proxy(store, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (prop !== "revokeTokensFor" || typeof value !== "function") return value;
        return async (...args: unknown[]) => {
          await new Promise((resolve) => setTimeout(resolve, 5));
          return (value as (...a: unknown[]) => unknown).apply(target, args);
        };
      },
    }) as Store;

    const deps = depsFor(slow);
    await Promise.all([
      revokeAppleIdentity(deps, "concurrent", Date.now()),
      revokeAppleIdentity(deps, "concurrent", Date.now()),
    ]);

    expect(await store.getProfile(userId)).not.toBeNull();
    expect((await store.listIdentities(userId)).map((i) => i.provider)).toEqual(["device"]);
  });
});

/**
 * The address, and the only thing it is: a column on the identity. It is never an account key —
 * `subject` still is — so every one of these asserts on what got STORED, not on who was resolved.
 */
describe("the address the provider vouched for", () => {
  /** Accepts `<subject>` and hands back whatever address the test named, verified. */
  const verifierFor = (email?: string): IdentityVerifier => ({
    async verify(provider, idToken) {
      if (idToken === "") throw new AuthError("invalid");
      return { provider, subject: idToken, ...(email !== undefined ? { email } : {}) };
    },
  });

  const emailOf = async (subject: string, s: Store = store) =>
    (await s.identityFor("apple", subject))?.email ?? null;

  it("stores it on an account created by the sign-in itself", async () => {
    const deps = depsFor(store);
    await signInWithProvider(deps, verifierFor("new@example.com"), "apple", "fresh", undefined, null, "en");
    expect(await emailOf("fresh")).toBe("new@example.com");
  });

  it("stores it when the identity is linked to the anonymous account already in hand", async () => {
    const deps = depsFor(store);
    const anon = (await store.upsertDeviceUser(device(), "en")).userId;
    const out = await signInWithProvider(deps, verifierFor("link@example.com"), "apple", "linked", undefined, anon, "en");
    expect(out.outcome).toBe("linked");
    expect(await emailOf("linked")).toBe("link@example.com");
  });

  it("stores it on the SURVIVING account when an anonymous session merges into a real one", async () => {
    // The merge drops the anonymous account's identities, so the address has to land on the one
    // that is still there afterwards — which is the account the identity resolved to, not the
    // session that was signed in.
    const deps = depsFor(store);
    const real = await store.createUser("en");
    await store.addIdentity(real, "apple", "merger");
    const anon = (await store.upsertDeviceUser(device(), "en")).userId;

    const out = await signInWithProvider(deps, verifierFor("merge@example.com"), "apple", "merger", undefined, anon, "en");
    expect(out.outcome).toBe("merged");
    expect(out.userId).toBe(real);
    expect(await emailOf("merger")).toBe("merge@example.com");
  });

  it("stores it for a returning user, whose sign-in links nothing at all", async () => {
    // The whole reason this is not folded into `addIdentity`. Every account that signed in before
    // the scope was requested reaches this path and no other.
    const deps = depsFor(store);
    const real = await store.createUser("en");
    await store.addIdentity(real, "apple", "returning");

    const out = await signInWithProvider(deps, verifierFor("back@example.com"), "apple", "returning", undefined, null, "en");
    expect(out.outcome).toBe("switched");
    expect(await emailOf("returning")).toBe("back@example.com");
  });

  it("keeps the stored address when a later token carries none", async () => {
    // Apple sends an address on the FIRST authorization only. Every sign-in after that looks like
    // this, and treating it as "the user has no address" would erase the one we were given.
    const deps = depsFor(store);
    await signInWithProvider(deps, verifierFor("first@example.com"), "apple", "once", undefined, null, "en");
    await signInWithProvider(deps, verifierFor(), "apple", "once", undefined, null, "en");
    expect(await emailOf("once")).toBe("first@example.com");
  });

  it("does NOT fail the sign-in when the address write throws, on the path that has already merged", async () => {
    // The reason this write is guarded at all. By the time it runs the merge has COMMITTED: the
    // meals have moved and the anonymous device identity is gone. A throw here would surface as a
    // 500 and "sign-in didn't complete", the retry would take `switched` with the merge already
    // done, and for Apple the address is spent — it comes in the first authorization only.
    const store = memoryStore();
    const real = await store.createUser("en");
    await store.addIdentity(real, "apple", "guarded");
    const anon = (await store.upsertDeviceUser(device(), "en")).userId;

    const deps = depsFor(failsOnce(store, "setIdentityEmail"));
    const out = await signInWithProvider(deps, verifierFor("kept@example.com"), "apple", "guarded", undefined, anon, "en");

    expect(out.outcome).toBe("merged");
    expect(out.userId).toBe(real);
    expect(out.token).toBeTruthy();
    // The merge stands, which is the whole point: `mergeUsers` deleted the anonymous account, so
    // there is nothing left to retry into and the sign-in had to succeed.
    expect(await store.getProfile(anon)).toBeNull();
    // And the address is simply absent rather than the sign-in being lost with it.
    expect(await emailOf("guarded", store)).toBeNull();
  });

  it("writes nothing when the provider sent no address at all", async () => {
    const deps = depsFor(store);
    await signInWithProvider(deps, verifierFor(), "apple", "silent", undefined, null, "en");
    expect(await emailOf("silent")).toBeNull();
  });
});


/**
 * What a `telegram` row is NOT: a way into an account, and a reason to stop merging.
 *
 * Both rules below read the identities table and were written before a provider existed that
 * cannot sign anybody in. `signsIn` is the one predicate they now share.
 */
describe("a transport is not a sign-in", () => {
  const verifier: IdentityVerifier = {
    async verify(provider, idToken) { return { provider, subject: idToken }; },
  };

  it("leaves an account with a connected Telegram anonymous, so the first sign-in still MERGES", async () => {
    const { userId: anon } = await store.upsertDeviceUser(device(), "en");
    await store.moveIdentity(anon, "telegram", "7000000900");
    expect(await isAnonymous(depsFor(store), anon)).toBe(true);

    // The account the sign-in lands on already exists, which is the branch that merges.
    const real = await store.createUser("en");
    await store.addIdentity(real, "apple", "merge-me");
    const out = await signInWithProvider(depsFor(store), verifier, "apple", "merge-me", undefined, anon, "en");

    expect(out.outcome).toBe("merged");
    expect(out.userId).toBe(real);
    // And the transport does not follow: a merge repoints no credential, `telegram` included.
    expect(await store.userIdForIdentity("telegram", "7000000900")).toBeNull();
  });

  it("erases the account when Apple's revocation takes its last sign-in identity", async () => {
    const web = await store.createUser("en");
    await store.addIdentity(web, "apple", "revoke-with-telegram");
    await store.moveIdentity(web, "telegram", "7000000901");

    expect(await revokeAppleIdentity(depsFor(store), "revoke-with-telegram", Date.now())).toBe("deleted");
    expect(await store.getProfile(web)).toBeNull();
    expect(await store.userIdForIdentity("telegram", "7000000901")).toBeNull();
  });

  it("keeps an account a device can still reach", async () => {
    const { userId } = await store.upsertDeviceUser(device(), "en");
    await store.addIdentity(userId, "apple", "revoke-keeps");
    await store.moveIdentity(userId, "telegram", "7000000902");

    expect(await revokeAppleIdentity(depsFor(store), "revoke-keeps", Date.now())).toBe("unlinked");
    expect(await store.getProfile(userId)).not.toBeNull();
    expect(await store.userIdForIdentity("telegram", "7000000902")).toBe(userId);
  });
});

describe("the language an account is born in", () => {
  const verifier: IdentityVerifier = {
    async verify(provider, idToken) { return { provider, subject: idToken }; },
  };

  it("is the one the caller resolved, not English", async () => {
    // `/start` reads `Accept-Language` for the front door and then hands the browser to Apple or
    // Google. This is the ONLY path that surface has to an account, so an `en` hardcoded here is
    // not a default that something later corrects — it is the whole of German web onboarding
    // rendering in English, with the picker that would fix it living behind the onboarding the
    // user cannot read.
    const deps = depsFor(store);
    const out = await signInWithProvider(deps, verifier, "apple", "neu", undefined, null, "de");
    expect(out.outcome).toBe("created");
    expect((await store.getProfile(out.userId))?.lang).toBe("de");
  });

  it("is never re-decided for an account that already exists", async () => {
    // A returning user's language is THEIRS — set in Settings, possibly months ago. A sign-in from
    // a borrowed laptop with a French browser must not rewrite it.
    const deps = depsFor(store);
    const mine = await store.createUser("ru");
    await store.addIdentity(mine, "apple", "back");
    await signInWithProvider(deps, verifier, "apple", "back", undefined, null, "fr");
    expect((await store.getProfile(mine))?.lang).toBe("ru");
  });
});
