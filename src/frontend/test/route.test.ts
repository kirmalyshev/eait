// The router's query strip (eait#92): `#/chat?focus=<mealId>` must land on Chat, not on the `#/`
// fallthrough — the log surface's Edit and the meal detail's both hand off by it.

import { describe, expect, test } from "bun:test";
import { pageUrl, routeBase, scrubPageUrls } from "../route.ts";

describe("routeBase — a query never changes the route", () => {
  test("strips the query off a hash route", () => {
    expect(routeBase("#/chat?focus=m1")).toBe("#/chat");
    expect(routeBase("#/log?from=home")).toBe("#/log");
  });

  test("a route without a query is itself; a bare '#' strips to nothing worth a screen", () => {
    expect(routeBase("#/")).toBe("#/");
    expect(routeBase("#/chat")).toBe("#/chat");
    expect(routeBase("#")).toBe("#");
  });
});

describe("pageUrl — what an analytics event may say about where it was", () => {
  test("drops the hash and the query, which carry meal ids", () => {
    expect(pageUrl("https://app.eait.fit/#/meal/0b7f?from=home")).toBe("https://app.eait.fit/");
    expect(pageUrl("https://app.eait.fit/?focus=m1#/chat")).toBe("https://app.eait.fit/");
    expect(pageUrl("https://app.eait.fit/")).toBe("https://app.eait.fit/");
  });
});

describe("scrubPageUrls — every URL of this origin, whatever posthog-js named it", () => {
  test("rewrites any value on the origin, leaves everything else", () => {
    const props: Record<string, unknown> = {
      $current_url: "https://app.eait.fit/#/meal/0b7f",
      $session_entry_url: "https://app.eait.fit/?focus=m1#/chat",
      $referrer: "$direct",
      $screen_name: "#/meal/",
      elsewhere: "https://example.com/#/x",
      n: 3,
    };
    scrubPageUrls(props, "https://app.eait.fit");
    expect(props).toEqual({
      $current_url: "https://app.eait.fit/",
      $session_entry_url: "https://app.eait.fit/",
      $referrer: "$direct",
      $screen_name: "#/meal/",
      elsewhere: "https://example.com/#/x",
      n: 3,
    });
    expect(() => scrubPageUrls(undefined, "https://app.eait.fit")).not.toThrow();
  });
});
