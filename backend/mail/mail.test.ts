import { describe, expect, it } from "bun:test";
import { confirmationMessage } from "./port.ts";
import { logMailer } from "./log.ts";
import { resendMailer } from "./resend.ts";

const URL_ = "https://api.eait.fit/v1/subscribe/confirm?t=abc123";

describe("the confirmation message", () => {
  it("says that ignoring it is a complete answer", () => {
    // The most important sentence in the email. Somebody whose address was typed in by a stranger
    // must be able to do nothing and be finished — that is what makes this a confirmation rather
    // than an unsolicited message with a link in it.
    const { text } = confirmationMessage(URL_);
    expect(text).toContain("If it was not you, ignore this");
    expect(text).toContain("deleted within a week");
    expect(text).toContain(URL_);
  });

  it("is plain text, so there is no place to put a tracking pixel", () => {
    const { text } = confirmationMessage(URL_);
    expect(text).not.toContain("<html");
    expect(text).not.toContain("<img");
  });
});

describe("resendMailer", () => {
  const opts = {
    apiKey: "test-key", from: "ieat <lets@eait.fit>",
    baseUrl: "https://api.resend.test", timeoutMs: 5_000,
  };

  it("posts the message and nothing else", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const mailer = resendMailer({
      ...opts,
      fetchImpl: (async (url: string, init: RequestInit) => {
        seen = { url: String(url), init };
        return new Response("{}", { status: 200 });
      }) as unknown as typeof fetch,
    });

    await mailer.sendConfirmation("reader@example.com", URL_);

    expect(seen!.url).toBe("https://api.resend.test/emails");
    const body = JSON.parse(String(seen!.init.body));
    expect(body.to).toEqual(["reader@example.com"]);
    expect(body.from).toBe("ieat <lets@eait.fit>");
    expect(body.text).toContain(URL_);
    // No `html` field at all, rather than an empty one: a provider that receives both picks the
    // HTML part, and then there is a document to put a pixel in.
    expect(body).not.toHaveProperty("html");
  });

  it("keeps the recipient out of the error it throws", async () => {
    // Providers quote the request they rejected. `throw new Error(await res.text())` therefore puts
    // a subscriber's address into the server log, into whatever collects that log, and into the
    // error path of the one feature that promises the opposite.
    const mailer = resendMailer({
      ...opts,
      fetchImpl: (async () => new Response(
        '{"message":"Invalid `to` field: reader@example.com is not allowed"}',
        { status: 422 },
      )) as unknown as typeof fetch,
    });

    await expect(mailer.sendConfirmation("reader@example.com", URL_)).rejects.toThrow(/mail http 422/);
    try {
      await mailer.sendConfirmation("reader@example.com", URL_);
    } catch (e) {
      expect(String(e)).not.toContain("reader@example.com");
      expect(String(e)).toContain("<address>");
    }
  });

  it("gives up rather than holding the request forever", async () => {
    const mailer = resendMailer({
      ...opts,
      timeoutMs: 10,
      fetchImpl: ((_u: string, init: RequestInit) => new Promise((_resolve, reject) => {
        init.signal?.addEventListener("abort", () => reject(new Error("aborted")));
      })) as unknown as typeof fetch,
    });
    await expect(mailer.sendConfirmation("reader@example.com", URL_)).rejects.toThrow(/mail timeout/);
  });
});

describe("logMailer", () => {
  it("prints the link and never the recipient", async () => {
    const lines: string[] = [];
    const original = console.log;
    console.log = (...args: unknown[]) => { lines.push(args.join(" ")); };
    try {
      await logMailer().sendConfirmation("reader@example.com", URL_);
    } finally {
      console.log = original;
    }

    expect(lines.join("\n")).toContain(URL_);
    // A log that carries the addresses is a second copy of the list, in the system that promised
    // not to keep one.
    expect(lines.join("\n")).not.toContain("reader@example.com");
  });
});
