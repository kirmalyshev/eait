// The router's query strip (eait#92): `#/chat?focus=<mealId>` must land on Chat, not on the `#/`
// fallthrough — the log surface's Edit and the meal detail's both hand off by it.

import { describe, expect, test } from "bun:test";
import { pageUrl, routeBase } from "../route.ts";

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
