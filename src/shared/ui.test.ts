// `src/shared/ui/` is the one place dependency-free modules live so a browser surface may import
// them by relative path — tokens, icons, motion, geometry, units (src/frontend/AGENTS.md names the
// precedent). That works only while nothing in there reaches back into the workspace: a ui module
// that imports `i18n.ts` or `targets.ts` pulls the barrel's runtime into a bundle that was promised
// none. So a module in `ui/` may import another module in `ui/`, `palette.ts`, `design.ts` or
// `lang.ts` — palette and design have zero imports of their own, which is what keeps the allow-list
// transitive-safe — and nothing else.

import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const UI_DIR = join(import.meta.dir, "ui");

/**
 * Every way a module can pull in another: a static `import … from` or side-effect `import`, a
 * `export … from` re-export (a value leaves through it the same way), and a dynamic `import()`.
 */
const IMPORTS = [
  /import\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g,
  /export\s+(?:type\s+)?(?:\*|\{[^}]*\})\s+from\s+["']([^"']+)["']/g,
  /import\s*\(\s*["']([^"']+)["']\s*\)/g,
];

const importsOf = (src: string): string[] =>
  IMPORTS.flatMap((re) => [...src.matchAll(re)].map((m) => m[1]!));

// The allow-list, and no more: `../palette.ts` and `../design.ts` carry no imports of their own,
// `../lang.ts` is the copy/table base the frontend precedent already leans on.
const ALLOWED = new Set(["../palette.ts", "../design.ts", "../lang.ts"]);

const offTheList = (src: string): string[] =>
  importsOf(src).filter((spec) => !(spec.startsWith("./") || ALLOWED.has(spec)));

test("the allow-list itself, so the guard below is tested code and not a hoped-for regex", () => {
  expect(offTheList(`import { icons } from "./icons.ts"`)).toEqual([]);
  expect(offTheList(`import { light } from "../palette.ts"`)).toEqual([]);
  expect(offTheList(`import { TYPE } from "../design.ts"`)).toEqual([]);
  expect(offTheList(`import { t } from "../lang.ts"`)).toEqual([]);
  expect(offTheList(`import { targets } from "../targets.ts"`)).toEqual(["../targets.ts"]);
  expect(offTheList(`import { View } from "react-native"`)).toEqual(["react-native"]);
  // A re-export and a dynamic import pull a module the same way — both are matched, both fail.
  expect(offTheList(`export { explainTargets } from "../targets.ts"`)).toEqual(["../targets.ts"]);
  expect(offTheList(`const m = await import("../i18n.ts")`)).toEqual(["../i18n.ts"]);
});

test("a module in ui/ imports only another ui/ module or the allow-listed neighbours", () => {
  if (!existsSync(UI_DIR)) return; // No modules yet — the rule binds the day one lands.
  // `.test.ts` files are not modules a browser can import — `bun:test` is fine there.
  const files = readdirSync(UI_DIR).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  for (const file of files) {
    const src = readFileSync(join(UI_DIR, file), "utf8");
    expect(offTheList(src), file).toEqual([]);
  }
});
