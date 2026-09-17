import { describe, expect, test } from "bun:test";
import { API, UNDOCUMENTED } from "./openapi.ts";
import { ROUTES } from "./contract.ts";

describe("openapi manifest", () => {
  test("every ROUTES key is documented or excused", () => {
    const covered = new Set<string>([...API.map((e) => e.route), ...Object.keys(UNDOCUMENTED)]);
    expect(Object.keys(ROUTES).filter((k) => !covered.has(k))).toEqual([]);
  });

  test("each path template matches the ROUTES entry it names", () => {
    for (const e of API) {
      const r = ROUTES[e.route];
      const params = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!);
      const concrete = typeof r === "function"
        ? (r as (...a: (string | number)[]) => string)(...params.map((p) => (p === "n" ? 0 : `x-${p}`)))
        : r;
      const expected = params.reduce((p, name) => p.replace(`{${name}}`, name === "n" ? "0" : `x-${name}`), e.path);
      expect(concrete).toBe(expected);
    }
  });

  test("method+path pairs are unique", () => {
    const keys = API.map((e) => `${e.method} ${e.path}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
