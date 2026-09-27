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

const IMPORT = /import\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;

// The allow-list, and no more: `../palette.ts` and `../design.ts` carry no imports of their own,
// `../lang.ts` is the copy/table base the frontend precedent already leans on.
const ALLOWED = new Set(["../palette.ts", "../design.ts", "../lang.ts"]);

test("the allow-list itself, so the guard below is tested code and not a hoped-for regex", () => {
  const allowed = (spec: string) => spec.startsWith("./") || ALLOWED.has(spec);
  expect(allowed("./icons.ts")).toBe(true);
  expect(allowed("../palette.ts")).toBe(true);
  expect(allowed("../design.ts")).toBe(true);
  expect(allowed("../lang.ts")).toBe(true);
  expect(allowed("../targets.ts")).toBe(false);
  expect(allowed("../i18n.ts")).toBe(false);
  expect(allowed("@eait/shared")).toBe(false);
  expect(allowed("react-native")).toBe(false);
});

test("a module in ui/ imports only another ui/ module or the allow-listed neighbours", () => {
  if (!existsSync(UI_DIR)) return; // No modules yet — the rule binds the day one lands.
  const files = readdirSync(UI_DIR).filter((f) => f.endsWith(".ts"));
  for (const file of files) {
    const src = readFileSync(join(UI_DIR, file), "utf8");
    for (const m of src.matchAll(IMPORT)) {
      const spec = m[1]!;
      // A bare package specifier or an alias is already out; a relative path must stay inside
      // ui/ itself or name one of the allowed neighbours.
      const allowed = spec.startsWith("./") || ALLOWED.has(spec);
      expect(allowed, `${file} imports ${spec}`).toBe(true);
    }
  }
});
