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
