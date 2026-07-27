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

  test("throws on negative or fractional userId — only positive integers are valid Telegram ids", () => {
    const ctxNegative = buildRequestContext(-5);
    expect(() => requireUserId(ctxNegative)).toThrow(/no userId bound/);

    const ctxFractional = buildRequestContext(4242.5);
    expect(() => requireUserId(ctxFractional)).toThrow(/no userId bound/);

    const ctxZero = buildRequestContext(0);
    expect(() => requireUserId(ctxZero)).toThrow(/no userId bound/);
  });
});
