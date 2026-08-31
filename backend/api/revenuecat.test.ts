// The purchase webhook, which is the only path by which an account becomes paid.
//
// Two halves are tested here and they fail differently. The CREDENTIAL half fails loudly — a wrong
// token is a 401 and nothing is written. The MEANING half fails quietly by design: an event about
// another entitlement, or for an account this server never issued, is answered 200 and ignored,
// because the alternative is RevenueCat retrying a message that will never mean anything different.

import { beforeEach, describe, expect, it, spyOn } from "bun:test";
import { ROUTES, entitlementActive, type ProfileResponse } from "@eait/shared";
import { configDefaults, type Config } from "../config.ts";
import { demoPorts } from "../llm/demo.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import type { EngineDeps } from "../engine/index.ts";
import { createRouter } from "./routes.ts";
import { fakeMailer } from "../mail/fake.ts";
import { fakePush } from "../push/fake.ts";
import { REVENUECAT_WEBHOOK_PATH, createRevenueCatWebhook, parseRevenueCatEvent } from "./revenuecat.ts";
import { AuthError, type Verifier } from "../auth/verify.ts";

const TOKEN = "rc-webhook-secret-token-long-enough";

const verifier: Verifier = {
  async verify() { throw new AuthError("invalid"); },
  async verifyAppleNotification() { throw new AuthError("invalid"); },
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
  const deps: EngineDeps = { store, config, llm: demoPorts(), mailer: fakeMailer(), push: fakePush() };
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
  entitlement_ids: ["eait_fit_pro"],
  product_id: "yearly",
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
    // NOT reported. A date is sent only while it is the grant keeping somebody in — a spent one is
    // still on the record, because the lifetime unlock beside it may be what matters now, and
    // sending it anyway is what made the settings screen say "Active until" a date in the past.
    expect(after.entitlement.expiresAt).toBeNull();
  });
});

describe("deliveries this server ignores", () => {
  // A Test Store or sandbox purchase is a simulated one. Accepting it in production would sell the
  // tier for free to anybody with a development build; the deployed host opts in explicitly, and
  // only while purchases are exercised from development and TestFlight builds.
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
    await deliver(purchase(userId, { entitlement_ids: ["eait_fit_pro"] }));
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
      app_user_id: id, entitlement_id: "eait_fit_pro", product_id: "p", event_timestamp_ms: 1,
      expiration_at_ms: 2,
    } });
    expect(e?.entitlementIds).toEqual(["eait_fit_pro"]);
  });

  // Without one, nothing can be ordered against what is already stored — which is what makes
  // out-of-order delivery safe.
  it("refuses a delivery with no event timestamp", () => {
    expect(parseRevenueCatEvent({ event: {
      app_user_id: id, entitlement_ids: ["eait_fit_pro"], product_id: "p", expiration_at_ms: 2,
    } })).toBeNull();
  });

  // `Number.isFinite(1e20)` is true and `new Date(1e20).toISOString()` throws. Unguarded that is a
  // 500, and a 500 is what makes RevenueCat retry — forever, for a delivery that never parses.
  // `new Date(1e20).toISOString()` THROWS, which from inside the handler is a 500 — and a 500 is
  // what makes RevenueCat redeliver, forever, an event that will never parse any differently.
  it("refuses an out-of-range timestamp rather than throwing on it", () => {
    expect(parseRevenueCatEvent({ event: {
      app_user_id: id, entitlement_ids: ["eait_fit_pro"], product_id: "p", event_timestamp_ms: 1e20,
    } })).toBeNull();

    // An out-of-range EXPIRY refuses the whole delivery too, and that is a deliberate change:
    // absent and nonsense are not the same field. Absent is meaningful here — it is what a
    // non-consumable sends — so reading a broken value as absent would turn a provider bug into a
    // lifetime grant, or into the refund of one.
    expect(parseRevenueCatEvent({ event: {
      app_user_id: id, entitlement_ids: ["eait_fit_pro"], product_id: "p", event_timestamp_ms: 1,
      expiration_at_ms: 1e20,
    } })).toBeNull();
  });

  // The one field that separates a trial ending from a subscription renewing. Without it the two
  // trial reminders fire two days before every renewal, telling somebody who pays that the free
  // week is ending and that stopping now costs nothing.
  it("reads period_type, and treats every paid period as not a trial", () => {
    const parse = (period_type?: string) => parseRevenueCatEvent({ event: {
      app_user_id: id, entitlement_ids: ["pro"], product_id: "p", event_timestamp_ms: 1,
      expiration_at_ms: 2, ...(period_type ? { period_type } : {}),
    } });
    expect(parse("TRIAL")?.trial).toBe(true);
    for (const paid of ["NORMAL", "INTRO", "PROMOTIONAL", undefined]) {
      expect(parse(paid)?.trial).toBe(false);
    }
  });

  it("treats a missing expiry as no expiry rather than as zero", () => {
    const e = parseRevenueCatEvent({ event: {
      app_user_id: id, entitlement_ids: ["eait_fit_pro"], product_id: "p", event_timestamp_ms: 1,
    } });
    expect(e?.expirationAtMs).toBeNull();
  });
});

// ── Lifetime ───────────────────────────────────────────────────────────────────────────────────
//
// A lifetime unlock is a NON-CONSUMABLE, so there is no period and RevenueCat sends
// `expiration_at_ms: null` ("This can be null for non-subscription purchases or lifetime
// products"). Every other event that arrives with no expiry is still ignored, and the difference
// between them is the event TYPE — which is why the parser now reads it.
describe("a lifetime purchase", () => {
  it("grants the tier with no expiry, and the profile reports it active", async () => {
    const { userId, token } = await account();
    const res = await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", product_id: "lifetime", expiration_at_ms: null,
    }));
    expect(await res.json()).toEqual({ ok: true, applied: true });

    const stored = await store.getEntitlement(userId);
    expect(stored?.expiresAt).toBeNull();

    const p = await profile(token);
    expect(p.entitlement.active).toBe(true);
    expect(p.entitlement.expiresAt).toBeNull();
  });

  it("is revoked by the refund, which arrives as a CANCELLATION with no expiry", async () => {
    const { userId, token } = await account();
    const boughtAt = Date.now() - 60_000;
    await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", product_id: "lifetime", expiration_at_ms: null,
      event_timestamp_ms: boughtAt,
    }));
    expect((await profile(token)).entitlement.active).toBe(true);

    // The refund ends it AT THE EVENT, so the stored expiry is the moment Apple refunded — which
    // is in the past by the time the delivery arrives. Timestamps here are real ones for that
    // reason: an event dated in the future would leave the tier alive until it caught up.
    const refundedAt = Date.now() - 1_000;
    await deliver(purchase(userId, {
      type: "CANCELLATION", product_id: "lifetime", expiration_at_ms: null,
      event_timestamp_ms: refundedAt,
    }));
    const p = await profile(token);
    expect(p.entitlement.active).toBe(false);
    // No date, because there is no SUBSCRIPTION to report an end for. The refund cleared the
    // unlock; it did not invent a subscription that ended.
    expect(p.entitlement.expiresAt).toBeNull();
  });

  // The guard that stops the rule above from reaching subscriptions. A CANCELLATION on a running
  // subscription means "will not renew", NOT "ends now" — the period already paid for is still
  // owed. Revoking on it would take the app away from somebody mid-month.
  it("does not let a no-expiry cancellation end a TIMED subscription early", async () => {
    const { userId, token } = await account();
    const endsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await deliver(purchase(userId, { expiration_at_ms: endsAt }));

    await deliver(purchase(userId, {
      type: "CANCELLATION", expiration_at_ms: null, event_timestamp_ms: Date.now() + 1000,
    }));
    const p = await profile(token);
    expect(p.entitlement.active).toBe(true);
    expect(Date.parse(p.entitlement.expiresAt as string)).toBe(endsAt);
  });

  it("still ignores a no-expiry event that is neither a grant nor a revocation", async () => {
    const { userId, token } = await account();
    const endsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await deliver(purchase(userId, { expiration_at_ms: endsAt }));

    const res = await deliver(purchase(userId, {
      type: "BILLING_ISSUE", expiration_at_ms: null, event_timestamp_ms: Date.now() + 1000,
    }));
    expect(await res.json()).toEqual({ ok: true, applied: false });
    expect((await profile(token)).entitlement.active).toBe(true);
  });

  it("grants nothing when the lifetime product does not carry OUR entitlement", async () => {
    const { userId, token } = await account();
    await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", entitlement_ids: ["something-else"], expiration_at_ms: null,
    }));
    expect((await profile(token)).entitlement.active).toBe(false);
  });

  it("is refused in sandbox like any other purchase", async () => {
    const { userId, token } = await account();
    const res = await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", expiration_at_ms: null, environment: "SANDBOX",
    }));
    expect(await res.json()).toEqual({ ok: true, applied: false });
    expect((await profile(token)).entitlement.active).toBe(false);
  });

  // ORDERING IS PER GRANT, and these two tests are the pair that says so. Within one grant the
  // newer event wins; ACROSS the two it must not, because the subscription and the unlock are
  // separate event streams with independent clocks.
  it("obeys the ordering rule within the unlock's own stream", async () => {
    const { userId, token } = await account();
    const now = Date.now();
    // Bought, then refunded. A re-delivery of the ORIGINAL purchase must not undo the refund.
    await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: now - 10_000,
    }));
    await deliver(purchase(userId, {
      type: "CANCELLATION", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: now,
    }));
    const res = await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: now - 5_000,
    }));
    expect(await res.json()).toEqual({ ok: true, applied: false });
    expect((await profile(token)).entitlement.active).toBe(false);
  });

  // The money case: a lifetime purchase delivered after an unrelated, newer subscription event.
  // One clock for both grants dropped it outright — charged, and the unlock never delivered.
  it("does not let a newer subscription event refuse an older lifetime purchase", async () => {
    const { userId, token } = await account();
    const now = Date.now();
    await deliver(purchase(userId, {
      type: "CANCELLATION", product_id: "monthly",
      expiration_at_ms: now - 1000, event_timestamp_ms: now,
    }));
    const res = await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: now - 5000,
    }));
    expect(await res.json()).toEqual({ ok: true, applied: true });
    expect((await profile(token)).entitlement.active).toBe(true);
  });

  // And its mirror: a renewal generated before the unlock but delivered after it must still record
  // the subscription's real end, or refunding the unlock leaves a paid month unrecorded.
  it("does not let a newer lifetime purchase refuse an older renewal", async () => {
    const { userId, token } = await account();
    const now = Date.now();
    const monthEnd = now + 20 * 24 * 60 * 60 * 1000;
    await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: now,
    }));
    await deliver(purchase(userId, {
      type: "RENEWAL", product_id: "monthly",
      expiration_at_ms: monthEnd, event_timestamp_ms: now - 5000,
    }));
    // Refund the unlock. The monthly it never knew about must be what keeps them in.
    await deliver(purchase(userId, {
      type: "CANCELLATION", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: now + 5000,
    }));
    const p = await profile(token);
    expect(p.entitlement.active).toBe(true);
    expect(Date.parse(p.entitlement.expiresAt as string)).toBe(monthEnd);
  });

  it("parses the event type, and tolerates a delivery that omits it", () => {
    const withType = parseRevenueCatEvent({ event: {
      type: "NON_RENEWING_PURCHASE", app_user_id: crypto.randomUUID(),
      entitlement_ids: ["eait_fit_pro"], expiration_at_ms: null, event_timestamp_ms: Date.now(),
    } });
    expect(withType?.type).toBe("NON_RENEWING_PURCHASE");

    const withoutType = parseRevenueCatEvent({ event: {
      app_user_id: crypto.randomUUID(), entitlement_ids: ["eait_fit_pro"],
      expiration_at_ms: null, event_timestamp_ms: Date.now(),
    } });
    expect(withoutType?.type).toBe("");
  });
});

// ── A lifetime unlock and a subscription on the SAME entitlement ───────────────────────────────
//
// All three products grant `eait_fit_pro`, and the store holds ONE record per account. So a
// subscription's ordinary lifecycle events name the same entitlement a lifetime unlock does, and
// "the newest event wins" is not enough on its own: the newest event about a MONTHLY plan says
// nothing about a lifetime the customer already owns.
describe("a lifetime unlock alongside a subscription", () => {
  it("is not overwritten by a subscription renewal, and survives that subscription lapsing", async () => {
    const { userId, token } = await account();
    const t0 = Date.now() - 60_000;

    await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: t0,
    }));
    expect((await profile(token)).entitlement.expiresAt).toBeNull();

    // They also hold a monthly plan. Its renewal carries a period end — which must NOT become the
    // end of an entitlement they own outright.
    await deliver(purchase(userId, {
      type: "RENEWAL", product_id: "monthly",
      expiration_at_ms: t0 + 30 * 24 * 60 * 60 * 1000, event_timestamp_ms: t0 + 1_000,
    }));
    // The renewal records the MONTHLY's end, which is true and useful — they do hold a monthly.
    // What it must not do is speak for the unlock, and it does not: they stay entitled below,
    // after that same plan lapses.
    const afterRenewal = await profile(token);
    expect(afterRenewal.entitlement.active).toBe(true);

    // And when the monthly plan finally lapses, the lifetime is still a lifetime. This is the one
    // that costs real money to get wrong: they paid once, forever, and a plan they also happened
    // to hold ran out.
    await deliver(purchase(userId, {
      type: "EXPIRATION", product_id: "monthly",
      expiration_at_ms: Date.now() - 1_000, event_timestamp_ms: Date.now() - 500,
    }));
    const afterLapse = await profile(token);
    expect(afterLapse.entitlement.active).toBe(true);
  });

  it("still lets the lifetime's OWN refund revoke it", async () => {
    const { userId, token } = await account();
    const t0 = Date.now() - 60_000;
    await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: t0,
    }));
    await deliver(purchase(userId, {
      type: "CANCELLATION", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: Date.now() - 1_000,
    }));
    expect((await profile(token)).entitlement.active).toBe(false);
  });

  it("lets a subscription behave normally when no lifetime is held", async () => {
    const { userId, token } = await account();
    const endsAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
    await deliver(purchase(userId, { type: "RENEWAL", product_id: "monthly", expiration_at_ms: endsAt }));
    expect((await profile(token)).entitlement.active).toBe(true);

    await deliver(purchase(userId, {
      type: "EXPIRATION", product_id: "monthly",
      expiration_at_ms: Date.now() - 1_000, event_timestamp_ms: Date.now() + 1_000,
    }));
    expect((await profile(token)).entitlement.active).toBe(false);
  });
});

// ── The misconfiguration alarm ─────────────────────────────────────────────────────────────────
//
// The identifier this server checks lives in config; the identifier RevenueCat grants lives in a
// dashboard somebody else can rename. When they disagree, every real purchase is charged and grants
// nothing — and before this warning existed, the log said exactly the same thing as it does on a
// quiet day. It was found by auditing the dashboard by hand, which is not a control.
describe("a live purchase that grants an entitlement this server does not know", () => {
  it("says so, naming OUR identifier and nothing from the payload", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { userId } = await account();
      await deliver(purchase(userId, { entitlement_ids: ["someone-elses-identifier"] }));
      const said = warn.mock.calls.flat().join(" ");
      expect(said).toContain("no entitlement this server knows");
      expect(said).toContain("eait_fit_pro");
      // The payload is not log material, here least of all.
      expect(said).not.toContain("someone-elses-identifier");
    } finally {
      warn.mockRestore();
    }
  });

  it("stays quiet for sandbox, and for events that grant nothing at all", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { userId } = await account();
      // Staging points a second webhook here with sandbox events; it must not warn all day.
      await deliver(purchase(userId, { entitlement_ids: ["other"], environment: "SANDBOX" }));
      // A dashboard test ping, a transfer, an alias: they grant nothing, so they say nothing.
      await deliver(purchase(userId, { type: "TEST", entitlement_ids: [] }));
      const said = warn.mock.calls.flat().join(" ");
      expect(said).not.toContain("no entitlement this server knows");
    } finally {
      warn.mockRestore();
    }
  });
});

// The sequence that made the two grants separate columns: buy a monthly, upgrade to the lifetime
// unlock, then refund the unlock inside Apple's window while the monthly is still running.
describe("refunding the lifetime unlock while a subscription is still paid for", () => {
  it("leaves the subscription entitled to the end of the period it paid for", async () => {
    const { userId, token } = await account();
    const now = Date.now();
    const monthEnd = now + 20 * 24 * 60 * 60 * 1000;

    await deliver(purchase(userId, {
      type: "RENEWAL", product_id: "monthly",
      expiration_at_ms: monthEnd, event_timestamp_ms: now - 10 * 24 * 60 * 60 * 1000,
    }));
    await deliver(purchase(userId, {
      type: "NON_RENEWING_PURCHASE", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: now - 5 * 24 * 60 * 60 * 1000,
    }));
    await deliver(purchase(userId, {
      type: "CANCELLATION", product_id: "lifetime",
      expiration_at_ms: null, event_timestamp_ms: now - 1 * 24 * 60 * 60 * 1000,
    }));

    const p = await profile(token);
    expect(p.entitlement.active).toBe(true);
    expect(Date.parse(p.entitlement.expiresAt as string)).toBe(monthEnd);
  });
});

// The quiet period exists so a project with a second entitlement does not warn on every event for
// it. Nothing exercised it — every test mounts a fresh router, so the suppression branch and its
// expiry were both unreached, and deleting the whole mechanism would not have failed anything.
describe("the misconfiguration warning's quiet period", () => {
  const deps = () => ({
    store: memoryStore(), config: { ...base, revenueCatWebhookToken: TOKEN },
    llm: demoPorts(), mailer: fakeMailer(),
  }) as unknown as EngineDeps;

  const post = (event: unknown) =>
    new Request(`http://localhost${REVENUECAT_WEBHOOK_PATH}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: TOKEN },
      body: JSON.stringify({ api_version: "1.0", event }),
    });

  const said = async (latch: { matched(): boolean; markMatched(): void }) => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      const { revenueCatWebhook } = await import("./revenuecat.ts");
      await revenueCatWebhook(post({
        type: "INITIAL_PURCHASE", app_user_id: crypto.randomUUID(),
        entitlement_ids: ["somebody-elses"], product_id: "yearly",
        expiration_at_ms: Date.now() + 1000, event_timestamp_ms: Date.now(),
      }), deps(), latch);
      return warn.mock.calls.flat().join(" ");
    } finally { warn.mockRestore(); }
  };

  it("warns while nothing has matched recently", async () => {
    expect(await said({ matched: () => false, markMatched: () => {} }))
      .toContain("no entitlement this server knows");
  });

  it("stays silent while a recent delivery has matched", async () => {
    expect(await said({ matched: () => true, markMatched: () => {} }))
      .not.toContain("no entitlement this server knows");
  });

  // End to end through the factory: a real match quiets the next mismatch, which is the whole
  // behaviour and the part no unit-level stub can vouch for.
  it("quiets itself after a delivery actually matches", async () => {
    const handle = createRevenueCatWebhook();
    const d = deps();
    // The id RevenueCat names is OUR account id, which upsert returns — not the device id.
    const { userId } = await d.store.upsertDeviceUser(
      crypto.randomUUID() + crypto.randomUUID(), "en");

    const warn = spyOn(console, "warn").mockImplementation(() => {});
    try {
      await handle(post({
        type: "INITIAL_PURCHASE", app_user_id: userId, entitlement_ids: ["eait_fit_pro"],
        product_id: "yearly", expiration_at_ms: Date.now() + 1000, event_timestamp_ms: Date.now(),
      }), d);
      await handle(post({
        type: "INITIAL_PURCHASE", app_user_id: crypto.randomUUID(),
        entitlement_ids: ["somebody-elses"], product_id: "yearly",
        expiration_at_ms: Date.now() + 1000, event_timestamp_ms: Date.now(),
      }), d);
      expect(warn.mock.calls.flat().join(" ")).not.toContain("no entitlement this server knows");
    } finally { warn.mockRestore(); }
  });
});
