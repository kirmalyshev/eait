// The limiter, and the address it keys on.
//
// The address half is the part with a real attack in it: `X-Forwarded-For` is client-controlled up
// to the point where the proxy appends what it actually saw, so reading the WRONG end of that header
// hands every attacker their own bucket and the limiter stops existing. That is what the first block
// of tests is about.

import { describe, expect, it } from "bun:test";
import { clientAddress, rateLimiter } from "./ratelimit.ts";

const req = (headers: Record<string, string> = {}) =>
  new Request("https://api.example/v1/auth/device", { headers });

describe("clientAddress", () => {
  it("takes the LAST X-Forwarded-For entry, which is the one the proxy observed", () => {
    // Caddy APPENDS the peer it saw to whatever arrived. So the rightmost value is the only one
    // this server has any reason to believe, and every value to its left was written by the client.
    //
    // Reading the leftmost — which is what almost every example on the internet does, because in a
    // trusted-proxy chain that is the original client — would let an attacker send a fresh
    // `X-Forwarded-For: <random>` on every request and get a fresh bucket each time.
    expect(clientAddress(req({ "x-forwarded-for": "203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientAddress(req({ "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientAddress(req({ "x-forwarded-for": "spoofed, also-spoofed, 203.0.113.9" })))
      .toBe("203.0.113.9");
  });

  it("collapses an IPv6 address to its /64", () => {
    // A residential IPv6 allocation is a /64 at minimum and frequently a /56. Keying on the full
    // 128 bits means one household has 18 quintillion buckets, which is the same as having none.
    const a = clientAddress(req({ "x-forwarded-for": "2001:db8:1234:5678:0:0:0:1" }));
    const b = clientAddress(req({ "x-forwarded-for": "2001:db8:1234:5678:aaaa:bbbb:cccc:dddd" }));
    expect(a).toBe(b);

    // A different /64 is a different bucket.
    expect(clientAddress(req({ "x-forwarded-for": "2001:db8:1234:9999::1" }))).not.toBe(a);
  });

  it("falls back to the socket peer, then to a shared bucket", () => {
    expect(clientAddress(req(), "198.51.100.7")).toBe("198.51.100.7");
    // Nothing to key on at all. One shared bucket is the safe direction: the alternative is a
    // unique key per request, which is an unlimited limiter that looks configured.
    expect(clientAddress(req())).toBe("unknown");
  });
});

describe("rateLimiter", () => {
  it("allows up to the limit and then refuses, with the wait in seconds", () => {
    let clock = 1_000_000;
    const limiter = rateLimiter({ now: () => clock });
    const rule = { limit: 3, windowMs: 60_000 };

    expect(limiter.check("a", rule)).toBeNull();
    expect(limiter.check("a", rule)).toBeNull();
    expect(limiter.check("a", rule)).toBeNull();

    const wait = limiter.check("a", rule);
    expect(wait).toBe(60);

    // A refused request must not extend the window. Otherwise a client that retries in a loop can
    // never get back in, and a limiter that punishes retries punishes bad connections hardest.
    clock += 30_000;
    expect(limiter.check("a", rule)).toBe(30);
  });

  it("keys separately, so one address cannot spend another's allowance", () => {
    const limiter = rateLimiter({ now: () => 0 });
    const rule = { limit: 1, windowMs: 60_000 };
    expect(limiter.check("a", rule)).toBeNull();
    expect(limiter.check("b", rule)).toBeNull();
    expect(limiter.check("a", rule)).not.toBeNull();
  });

  it("lets the window lapse", () => {
    let clock = 0;
    const limiter = rateLimiter({ now: () => clock });
    const rule = { limit: 1, windowMs: 60_000 };

    expect(limiter.check("a", rule)).toBeNull();
    expect(limiter.check("a", rule)).not.toBeNull();
    clock += 60_000;
    expect(limiter.check("a", rule)).toBeNull();
  });

  it("rounds a sub-second wait up to 1 rather than down to 0", () => {
    let clock = 0;
    const limiter = rateLimiter({ now: () => clock });
    const rule = { limit: 1, windowMs: 60_000 };
    limiter.check("a", rule);
    clock += 59_500;
    // `Retry-After: 0` reads as "go ahead", and a client that obeys it retries into another refusal.
    expect(limiter.check("a", rule)).toBe(1);
  });

  it("does not grow without bound as addresses come and go", () => {
    let clock = 0;
    const limiter = rateLimiter({ now: () => clock, maxKeys: 100 });
    const rule = { limit: 5, windowMs: 1_000 };

    // A scanner walking a /64 gives every request a new key. Without eviction this map is a memory
    // leak with a network interface attached.
    for (let i = 0; i < 5_000; i++) {
      limiter.check(`addr-${i}`, rule);
      clock += 1;
    }
    expect(limiter.size()).toBeLessThanOrEqual(100);

    // And the limiter still works after all that.
    expect(limiter.check("real", rule)).toBeNull();
  });

  it("forgets lapsed addresses on a schedule, without a timer", () => {
    let clock = 0;
    const limiter = rateLimiter({ now: () => clock, sweepEvery: 4 });
    const rule = { limit: 1, windowMs: 1_000 };

    for (const key of ["a", "b", "c"]) limiter.check(key, rule);
    expect(limiter.size()).toBe(3);

    clock += 10_000;
    // Amortised rather than on every insert: a sweep is O(tracked addresses), and doing one per
    // insert under an address-flood is quadratic — the exact condition where it must stay cheap.
    limiter.check("d", rule);
    expect(limiter.size()).toBe(1);
  });

  it("sweeps each window against its OWN length, not the caller's", () => {
    let clock = 0;
    const limiter = rateLimiter({ now: () => clock, sweepEvery: 2 });
    const hourly = { limit: 1, windowMs: 3_600_000 };
    const brief = { limit: 1, windowMs: 1_000 };

    limiter.check("slow", hourly);
    clock += 5_000;

    // This insert triggers a sweep. If the sweep used the CALLER's window it would decide the
    // hourly entry had lapsed after five seconds and hand that address a fresh allowance — a
    // limiter that a second request against a different route quietly resets.
    limiter.check("fast", brief);
    expect(limiter.check("slow", hourly)).not.toBeNull();
  });
});
