// The two questions a surface asks about a body it did not expect: is this a refusal, and did the
// server mean it? Both are derived from the status map rather than listed a second time, because
// the hand-written list is what shipped one kind short and answered a 200 with a refusal inside it.

import { describe, expect, it } from "bun:test";
import { RATE_LIMITED, capScope, isRefusal, isServerAnswer, outcomeUnknown, refusalFrom } from "./results.ts";
import { OUTCOME_UNKNOWN, REFUSAL_STATUS } from "./contract.ts";

describe("RATE_LIMITED", () => {
  it("is the string the routes actually send", () => {
    expect(RATE_LIMITED).toBe("rate-limited");
  });

  it("is not a refusal kind, which is the whole reason it needs a name of its own", () => {
    // Nothing is spent and nothing is refused: it is "slow down". A surface that treats it as a
    // refusal kind is looking it up in a map it is not in, and reports an answered request as a
    // network failure.
    expect(isRefusal({ kind: RATE_LIMITED })).toBe(false);
    expect(Object.hasOwn(REFUSAL_STATUS, RATE_LIMITED)).toBe(false);
  });
});

// #158. Three surfaces branched on the three scopes and had already drifted about the fourth case:
// the camera and the chat reached the per-user sentence as their DEFAULT, so a cap-exceeded whose
// scope was absent or unrecognised was announced as the user's own allowance — on a screen where
// the honest answer may be the shared budget or a carrier network's. The DECISION is one copy; the
// three sentences stay three, because each surface says it for what the user was doing there.
describe("capScope", () => {
  it("answers each scope the server sends with itself", () => {
    expect(capScope("address")).toBe("address");
    expect(capScope("global")).toBe("global");
    expect(capScope("user")).toBe("user");
  });

  it("never guesses `user` — an unnamed cap is unknown, not yours", () => {
    // "YOUR daily allowance resets at midnight" is a lie told to somebody behind a carrier NAT, and
    // the global budget is per-day too, so the wrong sentence is also plausible.
    expect(capScope(undefined)).toBe("unknown");
    expect(capScope(null)).toBe("unknown");
    expect(capScope("")).toBe("unknown");
    expect(capScope("instance")).toBe("unknown");
  });
});

// #180. `ApiError.isRefusal` spelled out `isRefusal(kind) || kind === "rate-limited"`, and every
// second consumer of that rule had to spell it out again. The next non-refusal body the server
// grows has to be added to each of them, and whichever forgets reports an answered request as
// "Couldn't reach eait." — the regression `api.ts` records having already been fixed once.
describe("isServerAnswer", () => {
  it("is true for every refusal kind, derived from the map rather than listed again", () => {
    for (const kind of Object.keys(REFUSAL_STATUS)) {
      expect(`${kind}: ${isServerAnswer({ kind })}`).toBe(`${kind}: true`);
    }
  });

  it("is true for the one answered body that is not a refusal", () => {
    expect(isServerAnswer({ kind: RATE_LIMITED })).toBe(true);
    expect(isRefusal({ kind: RATE_LIMITED })).toBe(false);
  });

  it("is false for a request that never arrived, and for a body nobody here knows", () => {
    expect(isServerAnswer({ kind: "offline" })).toBe(false);
    expect(isServerAnswer({ kind: "bad-edit" })).toBe(false);
  });
});

// #546: the chat worded a turn the server got and failed on as "Couldn't reach eait".
describe("outcomeUnknown — #546", () => {
  it("is true for a turn the server got and failed on, answered as JSON or in a stream", () => {
    expect(outcomeUnknown("internal")).toBe(true);
    expect(outcomeUnknown(OUTCOME_UNKNOWN)).toBe(true);
  });

  it("is false for a request that never arrived, and for every refusal the server meant", () => {
    expect(outcomeUnknown("offline")).toBe(false);
    for (const kind of Object.keys(REFUSAL_STATUS)) {
      expect(`${kind}: ${outcomeUnknown(kind)}`).toBe(`${kind}: false`);
    }
  });
});

describe("refusalFrom — #145", () => {
  it("reads the kind and the scope the server sent, and never invents one", () => {
    expect(refusalFrom({ error: "cap-exceeded", scope: "address" })).toEqual({ kind: "cap-exceeded", scope: "address" });
    // Most refusals carry no scope, and the key is ABSENT rather than undefined: the screens spread
    // this into objects under `exactOptionalPropertyTypes`, where the two are not the same thing.
    expect(refusalFrom({ error: "not-food" })).toEqual({ kind: "not-food" });
    expect(Object.hasOwn(refusalFrom({ error: "not-food" }), "scope")).toBe(false);
    // A scope that is not a string is not a scope. The five hand-written ternaries this replaces
    // each had their own defensive read of it, and each could have drifted from the others.
    expect(refusalFrom({ error: "cap-exceeded", scope: 7 })).toEqual({ kind: "cap-exceeded" });
    expect(refusalFrom({ error: "cap-exceeded", scope: null })).toEqual({ kind: "cap-exceeded" });
  });

  it("says 'offline' for a throw that carried no body at all, and only for that", () => {
    // The ONE thing that means the request never landed. An `ApiError` with any body arrived and
    // was answered, so blaming the connection for it is the regression `ApiError.isRefusal`
    // already records having happened once.
    expect(refusalFrom(null)).toEqual({ kind: "offline" });
    expect(refusalFrom(undefined)).toEqual({ kind: "offline" });
    // A body with no `error` DID arrive; it is not offline, and stringifying keeps that true.
    expect(refusalFrom({})).toEqual({ kind: "undefined" });
    expect(refusalFrom({ error: 500 })).toEqual({ kind: "500" });
  });
});
