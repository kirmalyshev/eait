import { describe, expect, it } from "bun:test";
import { confirmationMessage } from "./port.ts";
import { logMailer } from "./log.ts";
import { resendMailer } from "./resend.ts";
import { chooseMailer } from "./choose.ts";

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

describe("chooseMailer", () => {
  const base = {
    mailProvider: "log" as const, mailFrom: "ieat <lets@eait.fit>", resendApiKey: "",
    resendBaseUrl: "https://api.resend.test", mailTimeoutMs: 1_000, landingUrl: "",
  };
  const quiet = async (fn: () => Promise<void>) => {
    const log = console.log, warn = console.warn;
    console.log = () => {}; console.warn = () => {};
    try { await fn(); } finally { console.log = log; console.warn = warn; }
  };

  it("prints the link when there is no landing page, or a local one", async () => {
    await quiet(async () => {
      await chooseMailer(base, false).sendConfirmation("reader@example.com", URL_);
      await chooseMailer({ ...base, landingUrl: "http://localhost:4173" }, false)
        .sendConfirmation("reader@example.com", URL_);
    });
  });

  it("refuses to pretend a link was sent when the landing page is public", async () => {
    // eait.fit ran for weeks with MAIL_PROVIDER=log: the boot warning fired, nobody read it, and
    // every visitor was sent to "check your email" for a link that went to a container log. A send
    // that fails routes the visitor to /try-later and puts an error in the log per submission.
    await quiet(async () => {
      const mailer = chooseMailer({ ...base, landingUrl: "https://eait.fit" }, false);
      await expect(mailer.sendConfirmation("reader@example.com", URL_)).rejects.toThrow(/MAIL_PROVIDER=log/);
      try {
        await mailer.sendConfirmation("reader@example.com", URL_);
      } catch (e) {
        expect(String(e)).not.toContain("reader@example.com");
      }
    });
  });

  it("still prints under --demo, whatever the landing url or provider", async () => {
    await quiet(async () => {
      await chooseMailer({ ...base, landingUrl: "https://eait.fit" }, true)
        .sendConfirmation("reader@example.com", URL_);
      let calls = 0;
      const original = globalThis.fetch;
      globalThis.fetch = (async () => { calls++; return new Response("{}"); }) as unknown as typeof fetch;
      try {
        await chooseMailer({ ...base, mailProvider: "resend", resendApiKey: "k", landingUrl: "https://eait.fit" }, true)
          .sendConfirmation("reader@example.com", URL_);
      } finally {
        globalThis.fetch = original;
      }
      expect(calls).toBe(0);
    });
  });
});
