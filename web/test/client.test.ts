// The web client, checked from outside it.
//
// IN `test/` RATHER THAN BESIDE THE CODE because `web/tsconfig.json` sets `types: []` on purpose —
// this workspace is the only one whose code runs in a browser, and a `Bun.file` that typechecks
// there is a `Bun.file` that ships to a page and is undefined. A bun test file beside it would have
// to undo that; `test/tsconfig.json` is the bun half, and the browser config excludes it.
//
// These cover what a file can prove. The rendering is proven by driving a real browser
// (`backend/web/browser`, `bun run web:e2e`).

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (name: string): string =>
  readFileSync(join(import.meta.dir, "..", name), "utf8");

/**
 * The same file with its comments removed.
 *
 * Every rule below is about what the CODE does, and this house comments heavily — `api.ts` explains
 * at length why the bearer is not in `localStorage`, and `main.ts` says "text, never innerHTML". A
 * check that reads those as violations is a check that forbids explaining itself, which is how a
 * comment ends up deleted to make a test pass.
 */
const code = (name: string): string => source(name)
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n").filter((l) => !l.trimStart().startsWith("//")).join("\n");

describe("the client speaks the contract rather than a copy of it", () => {
  it("names no response shape of its own", () => {
    // `api<{ messages: ... }>(...)` is the bug that shipped: an inline structural type for a
    // response `shared/contract.ts` already describes. It typechecks and it is a second copy —
    // which is what the root AGENTS.md forbids: "if you change an endpoint and only one side
    // breaks, you changed it in the wrong place."
    const inline = [...code("main.ts").matchAll(/api<\{([^}]*)\}>/g)].map((m: RegExpMatchArray) => m[0]);
    expect(inline).toEqual([]);
  });

  it("takes its response types from the contract", () => {
    const main = source("main.ts");
    expect(main).toContain('from "@eait/shared/contract"');
    for (const t of ["ChatHistoryResponse", "DayResponse", "ProfileResponse"]) {
      expect(`${t}: ${main.includes(t)}`).toBe(`${t}: true`);
    }
  });

  it("calls the API relatively, and never the other origin by name", () => {
    // `connect-src 'self'` makes the browser enforce this, but a call written to the API's own
    // hostname would fail at runtime rather than here, and the fix that suggests itself then is
    // CORS — a door this backend does not have and must not grow.
    const api = code("api.ts");
    expect(api).toContain('fetch(`/api/v1${path}`');
    for (const f of [code("main.ts"), api]) {
      expect(f).not.toMatch(/https?:\/\/api\./);
    }
  });

  it("keeps the bearer out of storage", () => {
    // A token in localStorage survives the tab and is readable by any script that ever runs on this
    // origin — an origin that also serves the admin.
    const api = code("api.ts");
    expect(api).not.toContain("localStorage");
    expect(api).not.toContain("sessionStorage");
  });

  it("builds every node through the one helper, never innerHTML", () => {
    // Everything on these screens came from a server response or from a person, and the shell's CSP
    // has no 'unsafe-inline' to fall back on.
    const main = code("main.ts");
    expect(main).not.toContain("innerHTML");
    // No inline handler either: the shell is served under a nonce policy, which refuses `onclick=`
    // outright — so one added here is a control that silently stops working.
    expect(main).not.toMatch(/\son[a-z]+=["']/);
  });
});

describe("the pages that are one template literal contain no backtick", () => {
  // FOUR TIMES IN ONE BRANCH. `admin.page.ts`, the shell, `store.pg.ts` and `admin.page.ts` again:
  // a comment written in the house style — which quotes identifiers in backticks — landed inside a
  // template literal and ended it. The failure is a TypeScript parse error a hundred lines away
  // from the edit, and every time it cost a round trip to work out.
  //
  // These files are one big literal each, so the rule is simply: no backtick anywhere between the
  // opening one and the closing one. Cheaper than remembering.
  const enclosed: Array<[string, string, RegExp]> = [
    ["backend/api/admin.page.ts", "adminPage", /=> `([\s\S]*)`;\s*$/],
    ["web/server/index.ts", "shell", /return `<!doctype html>([\s\S]*?)`;\n}/],
  ];

  for (const [file, what, re] of enclosed) {
    it(`${file} — the ${what} document`, () => {
      const body = re.exec(readFileSync(join(import.meta.dir, "..", "..", file), "utf8"))?.[1];
      expect(`${file}: ${body !== undefined}`).toBe(`${file}: true`);
      // `${...}` interpolation is legitimate; a bare backtick is not.
      expect(body!.includes("`")).toBe(false);
    });
  }
});
