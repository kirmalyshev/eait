// Product analytics (ieat-app#2054). OFF UNLESS CONFIGURED: the server puts PostHog's public key in
// `<meta name="eait-posthog">` only when `EAIT__FRONTEND__POSTHOG_KEY` is set, and without it there
// is no client and every `analytics?.` is a no-op.
//
// ONE ORIGIN STILL HOLDS. Events go to `/ingest` on this origin and the edge forwards them to
// PostHog's EU host, so `connect-src 'self'` is unchanged. The `no-external` slim build loads no
// script of its own — the nonce policy would refuse one anyway.
//
// Events carry names and flags only — never a weight, a kcal, a meal, a photo or anything typed —
// and a person is identified by our user id, never an email. Nothing is captured automatically:
// no clicks, no page views, no recordings, no surveys; and nothing is persisted in this browser.
import posthog from "posthog-js/dist/module.slim.no-external";
import { pageUrl } from "./route.ts";

const key = document.querySelector<HTMLMetaElement>('meta[name="eait-posthog"]')?.content ?? "";

/** The URL properties posthog-js adds on its own; each carries the hash route, and so a meal id. */
const URL_PROPS = ["$current_url", "$initial_current_url", "$referrer", "$initial_referrer"];
const scrub = (props: Record<string, unknown> | undefined): void => {
  for (const k of URL_PROPS) if (typeof props?.[k] === "string") props[k] = pageUrl(props[k]);
};

export const analytics = key === "" ? null : posthog.init(key, {
  api_host: "/ingest",
  ui_host: "https://eu.posthog.com",
  persistence: "memory",
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
    if (event !== null) { scrub(event.properties); scrub(event.$set); scrub(event.$set_once); }
    return event;
  },
}) ?? null;
