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
import { revokeAppleIdentity, type EngineDeps } from "./index.ts";

const CONFIG: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  appleAudiences: ["app.ieat"], googleAudiences: ["test.apps.googleusercontent.com"],
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
