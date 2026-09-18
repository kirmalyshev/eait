// The only file in `push/` that talks to somebody else, and the only one a fake cannot stand in
// for: the payload shape, the ticket-to-token matching and the two-phase protocol are all claims
// about what Expo does with what we send. Without this, the first contact with the real service is
// production traffic.
//
// `expoPush` takes its two URLs as options for exactly this reason, so a stub server can answer.

import { afterAll, describe, expect, it } from "bun:test";
import { expoPush } from "./expo.ts";

interface Seen { url: string; headers: Headers; body: unknown }

const seen: Seen[] = [];
let answer: (body: unknown) => Response = () => Response.json({ data: [] });

const server = Bun.serve({
  port: 0,
  async fetch(req) {
    const body = await req.json().catch(() => null);
    seen.push({ url: new URL(req.url).pathname, headers: req.headers, body });
    return answer(body);
  },
});
afterAll(() => { void server.stop(true); });

const base = `http://127.0.0.1:${server.port}`;
const client = () => expoPush({
  accessToken: "expo-token-not-real", timeoutMs: 5_000,
  sendUrl: `${base}/send`, receiptsUrl: `${base}/receipts`,
});
const message = (to: string) => ({ to, title: "Today against the plan", body: "1,600 of your 2,100 kcal today." });

describe("send", () => {
  it("posts the batch with the credential and returns one ticket per message, in order", async () => {
    seen.length = 0;
    answer = () => Response.json({ data: [{ status: "ok", id: "r1" }, { status: "ok", id: "r2" }] });
    const tickets = await client().send([message("ExponentPushToken[a]"), message("ExponentPushToken[b]")]);

    expect(seen).toHaveLength(1);
    expect(seen[0]!.headers.get("authorization")).toBe("Bearer expo-token-not-real");
    expect(seen[0]!.headers.get("content-type")).toBe("application/json");
    expect(seen[0]!.body).toEqual([
      { to: "ExponentPushToken[a]", title: "Today against the plan", body: "1,600 of your 2,100 kcal today.", sound: "default" },
      { to: "ExponentPushToken[b]", title: "Today against the plan", body: "1,600 of your 2,100 kcal today.", sound: "default" },
    ]);
    expect(tickets).toEqual([
      { token: "ExponentPushToken[a]", id: "r1", error: null },
      { token: "ExponentPushToken[b]", id: "r2", error: null },
    ]);
  });

  it("maps Expo's error vocabulary to the one outcome this server acts on", async () => {
    answer = () => Response.json({ data: [
      { status: "error", details: { error: "DeviceNotRegistered" } },
      { status: "error", details: { error: "MessageRateExceeded" } },
      { status: "error", details: { error: "MessageTooBig" } },
      { status: "error", details: { error: "SomethingNew" } },
      { status: "error" },
    ] });
    const tickets = await client().send(["a", "b", "c", "d", "e"].map((t) => message(`ExponentPushToken[${t}]`)));
    expect(tickets.map((t) => t.error)).toEqual([
      "device-not-registered", "message-rate-exceeded", "message-too-big", "other", "other",
    ]);
    // A refused message has no receipt to follow up on.
    expect(tickets.every((t) => t.id === null)).toBe(true);
  });

  it("keeps a token when Expo answers with fewer tickets than we sent", async () => {
    // Positional matching is Expo's contract. A short array is a message we can say nothing about,
    // and "other" is the answer that keeps the row — dropping a live device on a malformed reply
    // would unsubscribe somebody for a provider's bad day.
    answer = () => Response.json({ data: [{ status: "ok", id: "r1" }] });
    const tickets = await client().send([message("ExponentPushToken[a]"), message("ExponentPushToken[b]")]);
    expect(tickets).toEqual([
      { token: "ExponentPushToken[a]", id: "r1", error: null },
      { token: "ExponentPushToken[b]", id: null, error: "other" },
    ]);
  });

  it("chunks at Expo's documented batch size, and keeps every ticket lined up with its token", async () => {
    seen.length = 0;
    answer = (body) => Response.json({
      data: (body as { to: string }[]).map((m, i) => ({ status: "ok", id: `${m.to}-${i}` })),
    });
    const messages = Array.from({ length: 250 }, (_, i) => message(`ExponentPushToken[t${i}]`));
    const tickets = await client().send(messages);

    expect(seen.map((s) => (s.body as unknown[]).length)).toEqual([100, 100, 50]);
    expect(tickets).toHaveLength(250);
    // The failure this guards: a per-chunk index used as if it were a whole-batch index would put
    // chunk 2's tickets against chunk 1's tokens, and the wrong device would be dropped.
    expect(tickets[0]!.token).toBe("ExponentPushToken[t0]");
    expect(tickets[100]!.token).toBe("ExponentPushToken[t100]");
    expect(tickets[249]!.token).toBe("ExponentPushToken[t249]");
    expect(tickets.every((t, i) => t.id === `ExponentPushToken[t${i}]-${i % 100}`)).toBe(true);
  });

  it("keeps the tickets from the chunks that were accepted when a later chunk fails", async () => {
    // THE FAILURE THIS GUARDS. Expo has already accepted and will deliver chunk 1. If the throw
    // escaped `send`, the sweep would count all 150 as failed, and — worse — chunk 1's receipt ids
    // would never be read. DeviceNotRegistered normally arrives on the RECEIPT, so every dead token
    // in that chunk would survive to be pushed again every night, which is the one thing the
    // receipt pass exists to prevent.
    seen.length = 0;
    let call = 0;
    answer = (body) => (++call === 1
      ? Response.json({ data: (body as { to: string }[]).map((m) => ({ status: "ok", id: `${m.to}-ok` })) })
      : new Response("upstream exploded", { status: 500 }));

    const messages = Array.from({ length: 150 }, (_, i) => message(`ExponentPushToken[c${i}]`));
    const tickets = await client().send(messages);

    expect(tickets).toHaveLength(150);
    expect(tickets.slice(0, 100).every((t) => t.error === null && t.id !== null)).toBe(true);
    expect(tickets.slice(100).every((t) => t.error === "other" && t.id === null)).toBe(true);
    expect(tickets[100]!.token).toBe("ExponentPushToken[c100]");
  });

  it("keeps the token on a non-2xx, and quotes the status rather than the body", async () => {
    answer = () => new Response("device ExponentPushToken[secret] rejected", { status: 502 });
    const lines: string[] = [];
    const err = console.error;
    console.error = (...args: unknown[]) => { lines.push(args.join(" ")); };
    let tickets;
    try {
      tickets = await client().send([message("ExponentPushToken[a]")]);
    } finally {
      console.error = err;
    }
    // "other", never "device-not-registered": a push service having a bad night is not a phone
    // that has gone away, and dropping on it would unsubscribe somebody for a provider's outage.
    expect(tickets).toEqual([{ token: "ExponentPushToken[a]", id: null, error: "other" }]);
    // An error body from a push service echoes the request, and the request carries device tokens
    // and a sentence about what somebody ate.
    expect(lines.join(" ")).toContain("502");
    expect(lines.join(" ")).not.toContain("secret");
  });
});

describe("receipts", () => {
  it("reads the second phase and reports only what came back", async () => {
    seen.length = 0;
    answer = () => Response.json({ data: {
      r1: { status: "ok" },
      r2: { status: "error", details: { error: "DeviceNotRegistered" } },
      r3: { status: "error", details: { error: "MessageRateExceeded" } },
    } });
    const out = await client().receipts(["r1", "r2", "r3", "r4"]);
    expect(seen[0]!.body).toEqual({ ids: ["r1", "r2", "r3", "r4"] });
    expect(out.get("r1")).toBeNull();
    expect(out.get("r2")).toBe("device-not-registered");
    expect(out.get("r3")).toBe("message-rate-exceeded");
    // r4 is not ready yet. Absent is not a failure, and absent must not become a dropped token.
    expect(out.has("r4")).toBe(false);
  });

  it("throws on a non-2xx WITHOUT quoting the body", async () => {
    // `receipts` has no partial state to protect — nothing has been accepted by anybody — so it
    // still throws, and `collectPushReceipts` treats that as "read them again another day".
    answer = () => new Response("receipt r1 for ExponentPushToken[secret] failed", { status: 500 });
    await expect(client().receipts(["r1"])).rejects.toThrow(/500/);
    await expect(client().receipts(["r1"])).rejects.not.toThrow(/secret/);
  });

  it("chunks receipt ids too", async () => {
    seen.length = 0;
    answer = () => Response.json({ data: {} });
    await client().receipts(Array.from({ length: 150 }, (_, i) => `r${i}`));
    expect(seen.map((s) => ((s.body as { ids: string[] }).ids).length)).toEqual([100, 50]);
  });

  it("asks nothing when there is nothing to ask about", async () => {
    seen.length = 0;
    expect((await client().send([])).length).toBe(0);
    expect((await client().receipts([])).size).toBe(0);
    expect(seen).toHaveLength(0);
  });
});
