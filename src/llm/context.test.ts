import { describe, expect, test } from "bun:test";
import { RequestContext } from "@mastra/core/request-context";
import { buildRequestContext, requireUserId } from "./context.ts";

describe("buildRequestContext / requireUserId", () => {
  test("round-trips the bound user id", () => {
    const ctx = buildRequestContext(4242);
    expect(requireUserId(ctx)).toBe(4242);
  });

  test("throws on a RequestContext with no bound userId — a wiring bug, not a valid call", () => {
    const empty = new RequestContext();
    expect(() => requireUserId(empty)).toThrow(/no userId bound/);
  });
});
