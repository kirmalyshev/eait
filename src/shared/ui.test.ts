// `src/shared/ui/` is the one place dependency-free modules live so a browser surface may import
// them by relative path — tokens, icons, motion, geometry, units (src/frontend/AGENTS.md names the
// precedent). That works only while nothing in there reaches back into the workspace: a ui module
// that imports `i18n.ts` or `targets.ts` pulls the barrel's runtime into a bundle that was promised
// none. So a module in `ui/` may import another module in `ui/`, or `lang.ts`, and nothing else —
// the same boundary `mascot.ts` already holds.

import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const UI_DIR = join(import.meta.dir, "ui");

const IMPORT = /import\s+(?:type\s+)?(?:[^"']*?\s+from\s+)?["']([^"']+)["']/g;

test("a module in ui/ imports only another ui/ module or lang.ts", () => {
  if (!existsSync(UI_DIR)) return; // No modules yet — the rule binds the day one lands.
  const files = readdirSync(UI_DIR).filter((f) => f.endsWith(".ts"));
  for (const file of files) {
    const src = readFileSync(join(UI_DIR, file), "utf8");
    for (const m of src.matchAll(IMPORT)) {
      const spec = m[1]!;
      // A bare package specifier or an alias is already out; a relative path must stay inside
      // ui/ itself or name ../lang.ts.
      const allowed = spec === "../lang.ts" || spec === "./lang.ts" || spec.startsWith("./");
      expect(allowed, `${file} imports ${spec}`).toBe(true);
    }
  }
});
