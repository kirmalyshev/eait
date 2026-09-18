// `web/api.ts`, driven rather than read.
//
// IN `test/` FOR THE REASON `client.test.ts` GIVES: `web/tsconfig.json` sets `types: []`
// on purpose, so a `bun:test` file inside that workspace would have to undo the one setting that
// keeps browser code from typechecking against bun's globals. This file imports the module and
// stubs `fetch`, which is all it needs — nothing in `api.ts` touches the DOM.
//
// What it covers is the half of #407 a source-text check cannot: the browser's bearer now has a
// lifetime of hours rather than the phone's six idle months, and what keeps that from being a
// sign-out every twelve hours is the retry below.

import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { Unauthenticated, api, forget, signIn, signedIn } from "../api.ts";

type Call = { url: string; method: string };

let calls: Call[] = [];
let answer: (call: Call, n: number) => Response;
const realFetch = globalThis.fetch;

beforeEach(() => {
  calls = [];
  forget();
  globalThis.fetch = ((input: string, init: RequestInit = {}) => {
    const call = { url: String(input), method: init.method ?? "GET" };
    calls.push(call);
    return Promise.resolve(answer(call, calls.length));
  }) as unknown as typeof fetch;
});

afterEach(() => { globalThis.fetch = realFetch; });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const MINT = "/start/session/token";

describe("a bearer that has expired is replaced, not surfaced", () => {
  it("re-mints from the session cookie and retries the call once", async () => {
    // The bearer lives twelve hours; the session cookie behind it lives as long as the browser is
    // open. So the ordinary end of a bearer's life is a 401 on a page whose person is still signed
    // in — and the honest answer is another token, not a sign-in screen. Without this, a tab left
    // open overnight sends its owner back to `/start`, which is a server-rendered flow that ends on
    // the plan page rather than back in the app they were using.
    answer = (call, n) => {
      if (call.url === MINT) return json({ token: n === 1 ? "first" : "second" });
      return n === 2 ? json({ error: "unauthenticated" }, 401) : json({ ok: true });
    };
    await signIn();

    expect(await api<{ ok: boolean }>("/profile")).toEqual({ ok: true });

    // Mint, the refused call, the re-mint, the retry. Four, in that order.
    expect(calls.map((c) => c.url)).toEqual([MINT, "/api/v1/profile", MINT, "/api/v1/profile"]);
    expect(signedIn()).toBe(true);
  });

  it("retries a write too, because a 401 is a request that did nothing", async () => {
    // The refusal happens before any handler runs, so the first attempt cannot have written
    // anything and replaying it cannot write twice. (A body that is a stream could not be replayed
    // at all — every call here sends a string or nothing, which is why this is safe as written.)
    answer = (call, n) => {
      if (call.url === MINT) return json({ token: "t" });
      return n === 2 ? json({ error: "unauthenticated" }, 401) : json({ sent: true });
    };
    await signIn();

    expect(await api<{ sent: boolean }>("/messages", { method: "POST", body: "{}" }))
      .toEqual({ sent: true });
    expect(calls.filter((c) => c.method === "POST" && c.url === "/api/v1/messages")).toHaveLength(2);
  });

  it("gives up after ONE re-mint, so a dead session cannot spin", async () => {
    // A session that is genuinely over answers 401 again with the new token. Retrying on that is an
    // endless pair of requests against a server that has already said no.
    answer = (call) => (call.url === MINT ? json({ token: "t" }) : json({ error: "x" }, 401));
    await signIn();

    await expect(api("/profile")).rejects.toBeInstanceOf(Unauthenticated);
    // The refused call and its one retry, and no third.
    expect(calls.filter((c) => c.url === "/api/v1/profile")).toHaveLength(2);
    // And the page is told: `render()` draws the sign-in screen on this.
    expect(signedIn()).toBe(false);
  });

  it("stops at a re-mint that finds no session, rather than calling again with no bearer", async () => {
    // The cookie died between the two — signed out everywhere from the phone. The re-mint says so,
    // and a retry after it would present `Bearer null` to a server that has already answered.
    answer = (call, n) => {
      if (call.url === MINT) return json({ token: n === 1 ? "t" : null });
      return json({ error: "unauthenticated" }, 401);
    };
    await signIn();

    await expect(api("/profile")).rejects.toBeInstanceOf(Unauthenticated);
    expect(calls.map((c) => c.url)).toEqual([MINT, "/api/v1/profile", MINT]);
    expect(signedIn()).toBe(false);
  });

  it("gives up when the session cookie is gone too", async () => {
    // The browser was closed and reopened, so there is no cookie, and the mint answers that in its
    // body (#457) — never a redirect or a 401, both of which Chrome paints red in the console. This
    // is the case that SHOULD end at `/start`, and the retry must not hide it.
    answer = (call) => (call.url === MINT ? json({ token: null }) : json({ error: "x" }, 401));
    await expect(signIn()).rejects.toBeInstanceOf(Unauthenticated);
    expect(signedIn()).toBe(false);

    await expect(api("/profile")).rejects.toBeInstanceOf(Unauthenticated);
    // Nothing to present, so nothing was sent to the API at all.
    expect(calls.filter((c) => c.url.startsWith("/api/"))).toHaveLength(0);
  });
});
