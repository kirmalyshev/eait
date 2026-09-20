// Resend, over plain `fetch`.
//
// No SDK. The whole API surface this product uses is one POST with a JSON body, and a dependency
// that wraps that is a dependency to keep current, audit, and pull into an image — for code that
// fits on a screen. The same reasoning that keeps `llm/openrouter.ts` thin.
//
// `baseUrl` is configurable because Resend has regional endpoints and the EU one is the one that
// matters here: the sender is in Berlin, the subscribers are mostly in the EU, and routing their
// addresses through a US region is a transfer that would have to be justified in the privacy policy.

import { confirmationMessage, type Mailer } from "./port.ts";

export interface ResendOptions {
  apiKey: string;
  /** The From header. Must be an address on a domain verified with the provider, or every send 403s. */
  from: string;
  baseUrl: string;
  timeoutMs: number;
  /** Injected in tests, so this file is covered without an account and without a billed send. */
  fetchImpl?: typeof fetch;
}

export function resendMailer(opts: ResendOptions): Mailer {
  const doFetch = opts.fetchImpl ?? fetch;

  return {
    async sendConfirmation(to, confirmUrl, lang) {
      const { subject, text } = confirmationMessage(confirmUrl, lang);

      // A send that hangs would hold the request that a person is waiting on, on the one page whose
      // entire job is to feel like it worked. Same reasoning, and same shape, as the model call.
      const abort = new AbortController();
      const timer = setTimeout(() => abort.abort(), opts.timeoutMs);
      let res: Response;
      try {
        res = await doFetch(`${opts.baseUrl}/emails`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${opts.apiKey}`,
            "content-type": "application/json",
          },
          body: JSON.stringify({ from: opts.from, to: [to], subject, text }),
          signal: abort.signal,
        });
      } catch (e) {
        if (abort.signal.aborted) throw new Error(`mail timeout after ${opts.timeoutMs}ms`);
        throw e;
      } finally {
        clearTimeout(timer);
      }

      if (!res.ok) {
        // The status and a short body, and NOT the recipient. An upstream error frequently quotes
        // the request it rejected, and the request contains the address — so a naive
        // `throw new Error(await res.text())` puts a subscriber's email into the server log, into
        // whatever collects that log, and into the error path of a page that promises the opposite.
        const detail = (await res.text()).slice(0, 300);
        throw new Error(`mail http ${res.status}: ${redactAddresses(detail)}`);
      }
    },
  };
}

/**
 * Blank out anything address-shaped in a provider's error text before it reaches a log.
 *
 * Deliberately crude and deliberately over-eager: this runs on an error path where the cost of
 * mangling a diagnostic is a slightly worse message, and the cost of missing one is a subscriber's
 * address written down in the one system that promised not to hold it.
 */
function redactAddresses(text: string): string {
  return text.replace(/[^\s"'<>,;]+@[^\s"'<>,;]+/g, "<address>");
}
