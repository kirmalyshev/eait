import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The engine boundary, enforced instead of documented.
 *
 * `src/engine/` is what makes `tg_bot/` and `api/` peers rather than one being a special case of
 * the other. That property is invisible at runtime — nothing breaks the day someone imports a
 * translator here, it just quietly stops being true, and the next front end inherits Telegram's
 * assumptions. So it is checked.
 */
const dir = new URL(".", import.meta.url).pathname;
const sources = readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
const importsOf = (file: string): string[] =>
  [...readFileSync(join(dir, file), "utf8").matchAll(/^import\s[^;]*?from\s+"([^"]+)";/gms)]
    .map((m) => m[1]!);

describe("engine boundary", () => {
  test("there is something to check", () => {
    expect(sources.length).toBeGreaterThan(5);
  });

  test.each(sources)("%s imports no transport", (file) => {
    for (const spec of importsOf(file)) {
      // grammy and i18next are the two runtimes that would drag presentation in; `tg_bot/` is the
      // surface itself. A engine that reaches for any of them has stopped being transport-agnostic.
      expect(spec).not.toMatch(/^grammy|^i18next|tg_bot/);
      // `i18n/index.ts` constructs an i18next instance; `i18n/registry.ts` is pure vocabulary and
      // IS allowed — a user's language is profile data, rendering in it is the surface's job.
      expect(spec).not.toBe("../i18n/index.ts");
    }
  });

  test("engine/ never imports api/, and neither imports the other's internals", () => {
    for (const file of sources) {
      for (const spec of importsOf(file)) expect(spec).not.toMatch(/\.\.\/api\//);
    }
  });
});

/**
 * The other half of the same boundary, and the half that was silently broken.
 *
 * `index.ts` says a front end imports from there and from nowhere deeper. `api/` obeyed;
 * `tg_bot/bot.ts` imported six engine modules directly, so the contract was documentation with no
 * gate. That costs nothing on the day it happens — the barrel is not what makes the code work, it
 * is what makes the engine's surface *reviewable*. Once surfaces reach past it, "what can a front
 * end depend on" stops having an answer, and the next extraction has nothing to extract against.
 */
const surfaceDirs = ["tg_bot", "api"];
const surfaceFiles = surfaceDirs.flatMap((d) => {
  const abs = join(dir, "..", d);
  return readdirSync(abs).filter((f) => f.endsWith(".ts")).map((f) => join(abs, f));
});
// `import ... from` AND `export ... from`: a re-export is an import with a wider blast radius, and
// `bot.ts` had one of those pointing at `engine/caps.ts` too.
const importsOfPath = (path: string): string[] =>
  [...readFileSync(path, "utf8").matchAll(/^(?:import|export)\s[^;]*?from\s+"([^"]+)";/gms)]
    .map((m) => m[1]!);

describe("surface boundary", () => {
  test("there is something to check", () => {
    expect(surfaceFiles.length).toBeGreaterThan(4);
  });

  test.each(surfaceFiles)("%s reaches the engine only through index.ts", (path) => {
    for (const spec of importsOfPath(path)) {
      // Not `engine/anything.ts` — `engine/index.ts` or nothing. Test files included: a test that
      // reaches inside is a test written against internals, which is how the internals become the
      // de-facto contract.
      if (spec.includes("/engine/")) expect(spec).toMatch(/\/engine\/index\.ts$/);
    }
  });
});
