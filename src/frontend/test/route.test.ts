// The router's query strip (eait#92): `#/chat?focus=<mealId>` must land on Chat, not on the `#/`
// fallthrough — the log surface's Edit and the meal detail's both hand off by it.

import { describe, expect, test } from "bun:test";
import { routeBase } from "../route.ts";

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
