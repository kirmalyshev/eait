import { describe, expect, it } from "bun:test";
import { apiHostOf } from "./choose.ts";

describe("apiHostOf", () => {
  it("is the hostname of an https API origin", () => {
    expect(apiHostOf("https://api.eait.fit")).toBe("api.eait.fit");
    expect(apiHostOf("https://api.eait.fit:8443/x")).toBe("api.eait.fit");
  });

  it("allows no host when the origin is unset, unparseable or not https", () => {
    for (const v of ["", "api.eait.fit", "http://api.eait.fit", "not a url"]) expect(apiHostOf(v)).toBeUndefined();
  });
});
