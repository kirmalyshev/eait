import { describe, expect, test } from "bun:test";

import { memoryStore } from "../store.memory.ts";
import { normaliseEmail, subscribe, unsubscribe } from "./subscribe.ts";

const deps = (cap = 100) => ({ store: memoryStore(), config: { subscribeDailyCap: cap } });

describe("subscribe", () => {
  test("accepts an ordinary address", async () => {
    const d = deps();
    expect(await subscribe(d, { email: "kirill@example.com", source: "web" }))
      .toEqual({ ok: true, created: true });
  });

  test("a repeat submission is not a second row, and not an error", async () => {
    // A double-tapped button must not produce two rows with two tokens of which only one
    // unsubscribes them — and it must not show the person an error either.
    const d = deps();
    const first = await subscribe(d, { email: "a@example.com", source: "web" });
    const again = await subscribe(d, { email: "A@Example.com ", source: "web" });
    expect(first).toEqual({ ok: true, created: true });
    expect(again).toEqual({ ok: true, created: false });
    expect(await d.store.countSubscribersSince(new Date(0).toISOString())).toBe(1);
  });

  test("normalisation is what makes that true", () => {
    expect(normaliseEmail("  Kirill@Example.COM ")).toBe("kirill@example.com");
  });

  test("refuses what is certainly not an address", async () => {
    const d = deps();
    for (const email of ["", "   ", "nope", "a@b", "a b@example.com", "a@@example.com",
                         "<a@example.com>", "a@example.com, b@example.com"]) {
      expect(await subscribe(d, { email, source: "web" })).toEqual({ ok: false, reason: "invalid" });
    }
    expect(await d.store.countSubscribersSince(new Date(0).toISOString())).toBe(0);
  });

  test("refuses an address longer than any real one", async () => {
    const d = deps();
    const long = `${"a".repeat(250)}@example.com`;
    expect(await subscribe(d, { email: long, source: "web" })).toEqual({ ok: false, reason: "invalid" });
  });

  test("a filled honeypot stores nothing", async () => {
    const d = deps();
    const result = await subscribe(d, { email: "bot@example.com", honeypot: "Acme", source: "web" });
    expect(result).toEqual({ ok: false, reason: "honeypot" });
    expect(await d.store.countSubscribersSince(new Date(0).toISOString())).toBe(0);
  });

  test("an empty honeypot is the normal case", async () => {
    const d = deps();
    expect(await subscribe(d, { email: "a@example.com", honeypot: "", source: "web" }))
      .toEqual({ ok: true, created: true });
  });

  test("the daily cap is charged on rows added, not on rows we liked", async () => {
    const d = deps(2);
    expect(await subscribe(d, { email: "a@example.com", source: "web" })).toEqual({ ok: true, created: true });
    expect(await subscribe(d, { email: "b@example.com", source: "web" })).toEqual({ ok: true, created: true });
    expect(await subscribe(d, { email: "c@example.com", source: "web" })).toEqual({ ok: false, reason: "capped" });
  });

  test("the cap is a day wide, not forever", async () => {
    const store = memoryStore();
    const yesterday = { store, config: { subscribeDailyCap: 1 }, now: () => Date.now() };
    expect(await subscribe(yesterday, { email: "a@example.com", source: "web" })).toEqual({ ok: true, created: true });
    // Two days on, yesterday's row is outside the window the cap counts.
    const later = { store, config: { subscribeDailyCap: 1 }, now: () => Date.now() + 2 * 86_400_000 };
    expect(await subscribe(later, { email: "b@example.com", source: "web" })).toEqual({ ok: true, created: true });
  });

  test("the source is recorded, so a code can be told from a bare visit", async () => {
    const d = deps();
    await subscribe(d, { email: "a@example.com", source: "web_hero" });
    expect(await d.store.countSubscribersSince(new Date(0).toISOString())).toBe(1);
  });
});

describe("unsubscribe", () => {
  test("the token removes exactly one address", async () => {
    const d = deps();
    await subscribe(d, { email: "a@example.com", source: "web" });
    await subscribe(d, { email: "b@example.com", source: "web" });
    const { token } = await d.store.addSubscriber("a@example.com", "web");

    await unsubscribe(d, token);
    expect(await d.store.countSubscribersSince(new Date(0).toISOString())).toBe(1);
    expect(await d.store.removeSubscriber(token)).toBe(false);
  });

  test("clicking the link twice is not an error", async () => {
    const d = deps();
    await subscribe(d, { email: "a@example.com", source: "web" });
    const { token } = await d.store.addSubscriber("a@example.com", "web");
    await unsubscribe(d, token);
    // The second call must be silent: the page it lands on says "you are off the list", and that
    // is true both times.
    await unsubscribe(d, token);
    expect(await d.store.countSubscribersSince(new Date(0).toISOString())).toBe(0);
  });

  test("a token nobody issued removes nothing and says nothing", async () => {
    const d = deps();
    await subscribe(d, { email: "a@example.com", source: "web" });
    await unsubscribe(d, "0".repeat(64));
    await unsubscribe(d, "");
    await unsubscribe(d, "x".repeat(500));
    expect(await d.store.countSubscribersSince(new Date(0).toISOString())).toBe(1);
  });
});
