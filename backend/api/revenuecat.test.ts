// The purchase webhook, which is the only path by which an account becomes paid.
//
// Two halves are tested here and they fail differently. The CREDENTIAL half fails loudly — a wrong
// token is a 401 and nothing is written. The MEANING half fails quietly by design: an event about
// another entitlement, or for an account this server never issued, is answered 200 and ignored,
// because the alternative is RevenueCat retrying a message that will never mean anything different.

import { beforeEach, describe, expect, it } from "bun:test";
import { ROUTES, entitlementActive, type ProfileResponse } from "@ieat/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "../engine/index.ts";
import { createRouter } from "./routes.ts";
import { fakeMailer } from "../mail/fake.ts";
import { REVENUECAT_WEBHOOK_PATH, parseRevenueCatEvent } from "./revenuecat.ts";
import { AuthError, type IdentityVerifier } from "../auth/verify.ts";

const TOKEN = "rc-webhook-secret-token-long-enough";

const verifier: IdentityVerifier = {
  async verify() { throw new AuthError("invalid"); },
};

const base: Config = {
  ...configDefaults(),
  port: 0, databaseUrl: "memory://test",
  llmProvider: "demo", llmModel: "demo", llmApiKey: "unused",
  globalDailyAnalysisCap: 0,
};

let store: Store;
let handle: (req: Request) => Promise<Response>;

function mount(config: Config) {
  store = memoryStore();
  const deps: EngineDeps = { store, config, llm: demoPorts(), mailer: fakeMailer() };
  handle = createRouter(deps, store, verifier);
}

beforeEach(() => mount({ ...base, revenueCatWebhookToken: TOKEN }));

const deliver = (event: unknown, token: string | null = TOKEN) =>
  handle(new Request(`http://localhost${REVENUECAT_WEBHOOK_PATH}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(token === null ? {} : { authorization: token }) },
    body: JSON.stringify({ api_version: "1.0", event }),
  }));

/** An account, plus its bearer token, in the state a real one would be in. */
async function account(): Promise<{ userId: string; token: string }> {
  const res = await handle(new Request(`http://localhost${ROUTES.authDevice}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ deviceId: crypto.randomUUID() + crypto.randomUUID(), locale: "en" }),
  }));
  const { token, userId } = await res.json() as { token: string; userId: string };
  return { userId, token };
}

const profile = async (token: string): Promise<ProfileResponse> => {
  const res = await handle(new Request(`http://localhost${ROUTES.profile}`, {
    headers: { authorization: `Bearer ${token}` },
  }));
  return await res.json() as ProfileResponse;
};

const purchase = (userId: string, over: Record<string, unknown> = {}) => ({
  type: "INITIAL_PURCHASE",
  app_user_id: userId,
  entitlement_ids: ["pro"],
  product_id: "ieat_pro_yearly",
  expiration_at_ms: Date.now() + 30 * 24 * 60 * 60 * 1000,
  event_timestamp_ms: Date.now(),
  ...over,
});

describe("the webhook's credential", () => {
  // Unset means the surface does not exist. 404 rather than 403, because "there is a purchase
  // webhook here" is itself information — the same argument the admin makes.
  it("does not exist at all when no token is configured", async () => {
    mount({ ...base, revenueCatWebhookToken: "" });
    const { userId } = await account();
    expect((await deliver(purchase(userId), null)).status).toBe(404);
    expect((await deliver(purchase(userId))).status).toBe(404);
  });

  it("refuses a wrong token, and writes nothing", async () => {
    const { userId, token } = await account();
    expect((await deliver(purchase(userId), "wrong-token-of-the-right-length")).status).toBe(401);
    expect((await profile(token)).entitlement.active).toBe(false);
  });

  it("refuses a missing token", async () => {
    const { userId } = await account();
    expect((await deliver(purchase(userId), null)).status).toBe(401);
  });

  // A user's bearer token is a credential for the user API and worthless here. The two authorities
  // must not be confusable in either direction.
  it("refuses a user's own bearer token", async () => {
    const { userId, token } = await account();
    expect((await deliver(purchase(userId), `Bearer ${token}`)).status).toBe(401);
    expect((await profile(token)).entitlement.active).toBe(false);
  });
});

describe("a purchase", () => {
  it("makes the account paid, and says so on the profile", async () => {
    const { userId, token } = await account();
    expect((await profile(token)).entitlement.active).toBe(false);

    const res = await deliver(purchase(userId));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: true });

    const after = await profile(token);
    expect(after.entitlement.active).toBe(true);
    expect(entitlementActive(after.entitlement.expiresAt, Date.now())).toBe(true);
  });

  // The whole point of the tier. The app is TOLD the number rather than computing it, and the
  // number it is told is the one `checkCaps` refuses with.
  it("is what opens the account after the sample", async () => {
    const { userId, token } = await account();
    expect((await profile(token)).limits.dailyPhotoCap).toBe(base.paidDailyPhotoCap);
    await deliver(purchase(userId));
    expect((await profile(token)).entitlement.active).toBe(true);
  });

  it("lapses on its own once the expiry has passed", async () => {
    const { userId, token } = await account();
    await deliver(purchase(userId, { expiration_at_ms: Date.now() - 1000 }));
    const after = await profile(token);
    expect(after.entitlement.active).toBe(false);
    // Still reported, so a settings screen can say when it ended rather than pretending it never was.
    expect(after.entitlement.expiresAt).not.toBeNull();
  });
});

describe("deliveries this server ignores", () => {
  // A Test Store or sandbox purchase is a simulated one. Accepting it in production would sell the
  // tier for free to anybody with a development build; staging opts in explicitly.
  it("ignores a SANDBOX event unless configured to accept one", async () => {
    const { userId, token } = await account();
    const res = await deliver(purchase(userId, { environment: "SANDBOX" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: false });
    expect((await profile(token)).entitlement.active).toBe(false);

    mount({ ...base, revenueCatWebhookToken: TOKEN, revenueCatAcceptSandbox: true });
    const staged = await account();
    await deliver(purchase(staged.userId, { environment: "SANDBOX" }));
    expect((await profile(staged.token)).entitlement.active).toBe(true);
  });

  // A project can carry a lifetime unlock or an internal comp alongside the paid tier. Treating
  // "any entitlement at all" as this one would sell the tier to whoever holds any of them.
  it("ignores an event about a different entitlement", async () => {
    const { userId, token } = await account();
    const res = await deliver(purchase(userId, { entitlement_ids: ["some_other_thing"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, applied: false });
    expect((await profile(token)).entitlement.active).toBe(false);
  });

  it("honours a configured entitlement id other than the default", async () => {
    mount({ ...base, revenueCatWebhookToken: TOKEN, revenueCatEntitlementId: "lifetime" });
    const { userId, token } = await account();
    await deliver(purchase(userId, { entitlement_ids: ["pro"] }));
    expect((await profile(token)).entitlement.active).toBe(false);
    await deliver(purchase(userId, { entitlement_ids: ["lifetime"] }));
    expect((await profile(token)).entitlement.active).toBe(true);
  });

  // RevenueCat has ids of its own for a device that never identified itself. They are not accounts
  // here and must not become ones — and they must not reach a uuid column, where the cast error is
  // a 500 and therefore a retry, forever, of a delivery that was always going to be ignored.
  it("ignores an id this server never issued, without erroring", async () => {
    for (const id of ["$RCAnonymousID:8b4f2c", "not-a-uuid", crypto.randomUUID()]) {
      const res = await deliver(purchase(id));
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, applied: false });
    }
  });

  // A 400 here would buy retries of a message that will never parse any differently.
  it("answers 200 to a delivery it cannot read", async () => {
    for (const body of [{}, { type: "TEST" }, { app_user_id: 42 }, null]) {
      const res = await deliver(body);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ ok: true, applied: false });
    }
  });

  // An event with no period attached — a transfer, a billing issue — is not a cancellation. Writing
  // a null would be indistinguishable from never having subscribed.
  it("leaves a live entitlement alone when an event carries no expiry", async () => {
    const { userId, token } = await account();
    await deliver(purchase(userId));
    await deliver(purchase(userId, {
      type: "TRANSFER", expiration_at_ms: null, event_timestamp_ms: Date.now() + 1000,
    }));
    expect((await profile(token)).entitlement.active).toBe(true);
  });

  it("refuses a body larger than it will read", async () => {
    const res = await handle(new Request(`http://localhost${REVENUECAT_WEBHOOK_PATH}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: TOKEN,
        "content-length": String(1024 * 1024),
      },
      body: JSON.stringify({ event: {} }),
    }));
    expect(res.status).toBe(413);
  });
});

describe("parseRevenueCatEvent", () => {
  const id = crypto.randomUUID();

  // Both spellings are still sent, depending on the event. Reading only the plural would silently
  // drop purchases and nothing would say why.
  it("reads the deprecated singular entitlement_id too", () => {
    const e = parseRevenueCatEvent({ event: {
      app_user_id: id, entitlement_id: "pro", product_id: "p", event_timestamp_ms: 1,
      expiration_at_ms: 2,
    } });
    expect(e?.entitlementIds).toEqual(["pro"]);
  });

  // Without one, nothing can be ordered against what is already stored — which is what makes
  // out-of-order delivery safe.
  it("refuses a delivery with no event timestamp", () => {
    expect(parseRevenueCatEvent({ event: {
      app_user_id: id, entitlement_ids: ["pro"], product_id: "p", expiration_at_ms: 2,
    } })).toBeNull();
  });

  // `Number.isFinite(1e20)` is true and `new Date(1e20).toISOString()` throws. Unguarded that is a
  // 500, and a 500 is what makes RevenueCat retry — forever, for a delivery that never parses.
  it("treats an out-of-range timestamp as absent rather than throwing", () => {
    expect(parseRevenueCatEvent({ event: {
      app_user_id: id, entitlement_ids: ["pro"], product_id: "p", event_timestamp_ms: 1e20,
    } })).toBeNull();

    const e = parseRevenueCatEvent({ event: {
      app_user_id: id, entitlement_ids: ["pro"], product_id: "p", event_timestamp_ms: 1,
      expiration_at_ms: 1e20,
    } });
    expect(e?.expirationAtMs).toBeNull();
  });

  it("treats a missing expiry as no expiry rather than as zero", () => {
    const e = parseRevenueCatEvent({ event: {
      app_user_id: id, entitlement_ids: ["pro"], product_id: "p", event_timestamp_ms: 1,
    } });
    expect(e?.expirationAtMs).toBeNull();
  });
});
