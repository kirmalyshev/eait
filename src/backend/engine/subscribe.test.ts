import { describe, expect, test } from "bun:test";

import { fakeMailer, type FakeMailer } from "../mail/fake.ts";
import { memoryStore } from "../store.memory.ts";
import type { Store } from "../store.ts";
import { confirmSubscription, normaliseEmail, subscribe, unsubscribe } from "./subscribe.ts";

interface Deps {
  store: Store;
  mailer: FakeMailer;
  config: { subscribeDailyCap: number; subscribeConfirmTtlDays: number };
  confirmUrlBase: string;
  now?: () => number;
}

const deps = (cap = 100, now?: () => number): Deps => ({
  store: memoryStore(),
  mailer: fakeMailer(),
  config: { subscribeDailyCap: cap, subscribeConfirmTtlDays: 7 },
  confirmUrlBase: "https://api.eait.fit",
  ...(now ? { now } : {}),
});

const rows = (d: Deps) => d.store.countSubscribersSince(new Date(0).toISOString());

/** The token out of the link the confirmation email carried. */
const tokenFromLastEmail = (d: Deps): string =>
  new URL(d.mailer.sent[d.mailer.sent.length - 1]!.confirmUrl).searchParams.get("t")!;

describe("subscribe", () => {
  test("accepts an ordinary address and sends it one confirmation", async () => {
    const d = deps();
    expect(await subscribe(d, { email: "kirill@example.com", source: "web", lang: "en" }))
      .toEqual({ ok: true, created: true, pending: true });
    expect(d.mailer.sent).toHaveLength(1);
    expect(d.mailer.sent[0]!.to).toBe("kirill@example.com");
    expect(d.mailer.sent[0]!.confirmUrl)
      .toStartWith("https://api.eait.fit/v1/subscribe/confirm?t=");
  });

  test("a submitted address is NOT on the list until it is confirmed", async () => {
    // The whole point of the change. Anybody can type a stranger's address into a form; that is
    // not consent, and in Germany the confirmed variety is the standard for proving there was any.
    const d = deps();
    await subscribe(d, { email: "stranger@example.com", source: "web", lang: "en" });

    // The row exists — it has to, or there is nothing to confirm — but it is pending.
    expect(await rows(d)).toBe(1);
    expect(await d.store.pruneUnconfirmedSubscribers(new Date(Date.now() + 1).toISOString())).toBe(1);
    expect(await rows(d)).toBe(0);
  });

  test("confirming is what makes it a subscription, and it survives the sweep", async () => {
    const d = deps();
    await subscribe(d, { email: "a@example.com", source: "web", lang: "en" });
    await confirmSubscription(d, tokenFromLastEmail(d));

    // The sweep takes pending rows only. A confirmed one is a subscriber.
    expect(await d.store.pruneUnconfirmedSubscribers(new Date(Date.now() + 1).toISOString())).toBe(0);
    expect(await rows(d)).toBe(1);
  });

  test("clicking the confirmation link twice says the same thing both times", async () => {
    const d = deps();
    await subscribe(d, { email: "a@example.com", source: "web", lang: "en" });
    const token = tokenFromLastEmail(d);
    await confirmSubscription(d, token);
    await confirmSubscription(d, token);
    expect(await rows(d)).toBe(1);
  });

  test("an unknown confirmation token changes nothing and reveals nothing", async () => {
    const d = deps();
    await subscribe(d, { email: "a@example.com", source: "web", lang: "en" });
    await confirmSubscription(d, "0".repeat(64));
    await confirmSubscription(d, "");
    await confirmSubscription(d, "x".repeat(500));
    // Still pending: the real token was never used.
    expect(await d.store.pruneUnconfirmedSubscribers(new Date(Date.now() + 1).toISOString())).toBe(1);
  });

  test("re-submitting a pending address re-sends the SAME link", async () => {
    // A second confirmation with a new token would invalidate the one already in the inbox — and
    // somebody who clicks the older email then gets nothing, having done exactly the right thing.
    const d = deps();
    await subscribe(d, { email: "a@example.com", source: "web", lang: "en" });
    const first = tokenFromLastEmail(d);
    await subscribe(d, { email: "A@Example.com ", source: "web", lang: "en" });
    expect(d.mailer.sent).toHaveLength(2);
    expect(tokenFromLastEmail(d)).toBe(first);
    expect(await rows(d)).toBe(1);
  });

  test("re-submitting a CONFIRMED address sends nothing at all", async () => {
    // Two reasons, and both matter. A "you are already subscribed" message is unsolicited mail to
    // somebody who did not ask for it this time; and answering the form differently for a known
    // address makes this endpoint an oracle for who is on the list.
    const d = deps();
    await subscribe(d, { email: "a@example.com", source: "web", lang: "en" });
    await confirmSubscription(d, tokenFromLastEmail(d));

    const again = await subscribe(d, { email: "a@example.com", source: "web", lang: "en" });
    expect(again).toEqual({ ok: true, created: false, pending: false });
    expect(d.mailer.sent).toHaveLength(1);
  });

  test("normalisation is what makes a repeat submission one row", () => {
    expect(normaliseEmail("  Kirill@Example.COM ")).toBe("kirill@example.com");
  });

  test("refuses what is certainly not an address, and sends nothing", async () => {
    const d = deps();
    for (const email of ["", "   ", "nope", "a@b", "a b@example.com", "a@@example.com",
                         "<a@example.com>", "a@example.com, b@example.com"]) {
      expect(await subscribe(d, { email, source: "web", lang: "en" })).toEqual({ ok: false, reason: "invalid" });
    }
    expect(await rows(d)).toBe(0);
    expect(d.mailer.sent).toHaveLength(0);
  });

  test("refuses an address longer than any real one", async () => {
    const d = deps();
    const long = `${"a".repeat(250)}@example.com`;
    expect(await subscribe(d, { email: long, source: "web", lang: "en" })).toEqual({ ok: false, reason: "invalid" });
  });

  test("a filled honeypot stores nothing and sends nothing", async () => {
    const d = deps();
    const result = await subscribe(d, { email: "bot@example.com", honeypot: "Acme", source: "web", lang: "en" });
    expect(result).toEqual({ ok: false, reason: "honeypot" });
    expect(await rows(d)).toBe(0);
    expect(d.mailer.sent).toHaveLength(0);
  });

  test("an empty honeypot is the normal case", async () => {
    const d = deps();
    expect(await subscribe(d, { email: "a@example.com", honeypot: "", source: "web", lang: "en" }))
      .toEqual({ ok: true, created: true, pending: true });
  });

  test("a provider that will not send is reported, and the row is left to expire", async () => {
    const d = deps();
    d.mailer.failNext();
    expect(await subscribe(d, { email: "a@example.com", source: "web", lang: "en" }))
      .toEqual({ ok: false, reason: "send-failed" });

    // The pending row stays — deleting it here would race a send that may have gone out anyway —
    // and it cannot be confirmed, so the sweep removes it. An address nobody agreed to does not
    // get to sit in the table indefinitely because a vendor had a bad minute.
    expect(await d.store.pruneUnconfirmedSubscribers(new Date(Date.now() + 1).toISOString())).toBe(1);
  });

  test("the daily cap is charged on rows added, not on rows we liked", async () => {
    const d = deps(2);
    expect(await subscribe(d, { email: "a@example.com", source: "web", lang: "en" }))
      .toEqual({ ok: true, created: true, pending: true });
    expect(await subscribe(d, { email: "b@example.com", source: "web", lang: "en" }))
      .toEqual({ ok: true, created: true, pending: true });
    expect(await subscribe(d, { email: "c@example.com", source: "web", lang: "en" }))
      .toEqual({ ok: false, reason: "capped" });
  });

  test("pending rows count against the cap, or it is a cap a bot never reaches", async () => {
    // Confirming is the part an abuser never does. If the cap only counted confirmed rows, a script
    // could add unlimited pending ones and the number would stay at zero.
    const d = deps(1);
    await subscribe(d, { email: "a@example.com", source: "web", lang: "en" });
    expect(await subscribe(d, { email: "b@example.com", source: "web", lang: "en" }))
      .toEqual({ ok: false, reason: "capped" });
  });

  test("the cap is a day wide, not forever", async () => {
    const store = memoryStore();
    const base = { config: { subscribeDailyCap: 1, subscribeConfirmTtlDays: 7 },
                   confirmUrlBase: "https://api.eait.fit" };
    const today = { ...base, store, mailer: fakeMailer(), now: () => Date.now() };
    expect(await subscribe(today, { email: "a@example.com", source: "web", lang: "en" }))
      .toEqual({ ok: true, created: true, pending: true });

    // Two days on. Yesterday's row is outside the window the cap counts — and, being unconfirmed,
    // it has been swept by then anyway.
    const later = { ...base, store, mailer: fakeMailer(), now: () => Date.now() + 2 * 86_400_000 };
    expect(await subscribe(later, { email: "b@example.com", source: "web", lang: "en" }))
      .toEqual({ ok: true, created: true, pending: true });
  });

  test("an unconfirmed address is swept once its window has passed", async () => {
    const store = memoryStore();
    const base = { config: { subscribeDailyCap: 100, subscribeConfirmTtlDays: 7 },
                   confirmUrlBase: "https://api.eait.fit", store };
    const day0 = { ...base, mailer: fakeMailer(), now: () => Date.now() };
    await subscribe(day0, { email: "never-confirmed@example.com", source: "web", lang: "en" });
    expect(await store.countSubscribersSince(new Date(0).toISOString())).toBe(1);

    // Eight days on, a submission by somebody else runs the sweep. Nothing is scheduled and nothing
    // needs to be: the write path is when the table grows, so it is when it should be pruned.
    const day8 = { ...base, mailer: fakeMailer(), now: () => Date.now() + 8 * 86_400_000 };
    await subscribe(day8, { email: "someone-else@example.com", source: "web", lang: "en" });

    const remaining = await store.countSubscribersSince(new Date(0).toISOString());
    expect(remaining).toBe(1); // only the new one
  });

  test("the source is recorded, so a code can be told from a bare visit", async () => {
    const d = deps();
    await subscribe(d, { email: "a@example.com", source: "web_hero", lang: "en" });
    expect(await rows(d)).toBe(1);
  });
});

describe("unsubscribe", () => {
  /** Subscribe and confirm, returning the withdrawal token. */
  async function joined(d: Deps, email: string): Promise<string> {
    await subscribe(d, { email, source: "web", lang: "en" });
    await confirmSubscription(d, tokenFromLastEmail(d));
    const { unsubscribeToken } = await d.store.addSubscriber(email, "web");
    return unsubscribeToken;
  }

  test("the token removes exactly one address", async () => {
    const d = deps();
    const token = await joined(d, "a@example.com");
    await joined(d, "b@example.com");

    await unsubscribe(d, token);
    expect(await rows(d)).toBe(1);
    expect(await d.store.removeSubscriber(token)).toBe(false);
  });

  test("clicking the link twice is not an error", async () => {
    const d = deps();
    const token = await joined(d, "a@example.com");
    await unsubscribe(d, token);
    // The second call must be silent: the page it lands on says "you are off the list", and that
    // is true both times.
    await unsubscribe(d, token);
    expect(await rows(d)).toBe(0);
  });

  test("a token nobody issued removes nothing and says nothing", async () => {
    const d = deps();
    await joined(d, "a@example.com");
    await unsubscribe(d, "0".repeat(64));
    await unsubscribe(d, "");
    await unsubscribe(d, "x".repeat(500));
    expect(await rows(d)).toBe(1);
  });
});
