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

  test("throws a distinct 'invalid userId' message on negative or fractional userId — only " +
    "positive integers are valid Telegram ids, and this must not be confused with the 'no userId " +
    "bound' wiring-bug case since a value WAS bound here, just an invalid one", () => {
    const ctxNegative = buildRequestContext(-5);
    expect(() => requireUserId(ctxNegative)).toThrow(/invalid userId bound.*-5/);

    const ctxFractional = buildRequestContext(4242.5);
    expect(() => requireUserId(ctxFractional)).toThrow(/invalid userId bound.*4242\.5/);

    const ctxZero = buildRequestContext(0);
    expect(() => requireUserId(ctxZero)).toThrow(/invalid userId bound.*\b0\b/);
  });
});
