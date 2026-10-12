// Product analytics (ieat-app#2054). OFF UNLESS CONFIGURED: the server puts PostHog's public key in
// `<meta name="eait-posthog">` only when `EAIT__FRONTEND__POSTHOG_KEY` is set, and without it every
// function here is a no-op.
//
// ONE ORIGIN STILL HOLDS. Events go to `/ingest` on this origin and the edge forwards them to
// PostHog's EU host, so `connect-src 'self'` is unchanged. The `no-external` slim build loads no
// script of its own — the nonce policy would refuse one anyway.
//
// Events carry names and flags only — never a weight, a kcal, a meal, a photo or anything typed —
// and a person is our user id, never an email. Nothing is captured automatically: no clicks, no
// page views, no recordings, no surveys. Nothing is persisted in this browser, and the client
// starts only once somebody is signed in, AS them (`bootstrap`): an anonymous id minted per page
// load and merged on every identify would pile ids onto one person until PostHog stops showing it.
import posthog, { type PostHog } from "posthog-js/dist/module.slim.no-external";
import { scrubPageUrls } from "./route.ts";

const key = document.querySelector<HTMLMetaElement>('meta[name="eait-posthog"]')?.content ?? "";

let client: PostHog | null = null;

/** Start as this account, or switch to it. Our user id, never anything a person typed. */
export function identify(userId: string): void {
  if (key === "") return;
  if (client === null) {
    posthog.init(key, {
      api_host: "/ingest",
      ui_host: "https://eu.posthog.com",
      persistence: "memory",
      bootstrap: { distinctID: userId, isIdentifiedID: true },
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      disable_surveys: true,
      capture_exceptions: false,
      capture_heatmaps: false,
      capture_dead_clicks: false,
      capture_performance: false,
      rageclick: false,
      advanced_disable_flags: true,
      before_send: (event) => {
        // posthog-js adds URLs of its own to every event, and the hash route in them names meals.
        if (event !== null) for (const p of [event.properties, event.$set, event.$set_once]) scrubPageUrls(p, location.origin);
        return event;
      },
    });
    // `init` hands back nothing for the default instance; the singleton IS the client.
    client = posthog;
  } else if (client.get_distinct_id() !== userId) {
    client.reset();
    client.identify(userId);
  }
}

/** One named event; nothing is sent before `identify`. */
export const capture = (event: string, props?: Record<string, string | number | boolean>): void => {
  client?.capture(event, props);
};

/** Signing out: whoever signs in next is somebody else. */
export const reset = (): void => { client?.reset(); };
