// The web bundle ships with no `node_modules` — `deploy/Dockerfile.web` runs `bun build` on the
// sources alone — so a value import inside `src/frontend` can only ever reach dependency-free
// modules. The one thing that must never get in is the i18n stack: `@lingui/*`, `shared/i18n.ts`,
// `shared/locales/*` — their words are written for the server and the phone, and a browser module
// that reaches them fails to resolve at image build, or silently bundles a second copy of the
// wording. Every string the browser prints therefore arrives ON the payload (`verdictInline`,
// `verdictLabels`, the stream's `line`) or out of a `Localized` table.
//
// The rule, pinned: a frontend file may VALUE-import (a) its own relative modules and (b) the
// shared modules on WEB_MODULES below; type imports are erased and free to go anywhere
// (`import type` from `@eait/shared` is the contract). Anything else — a bare package, or a shared
// module off the list — fails here, and any module the graph then reaches that imports `@lingui`
// or `i18n.ts`/`locales` fails with the whole path, so the leak is named, not just flagged.

import { describe, expect, test } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const FRONTEND = resolve(import.meta.dir, "..");
const SHARED = resolve(FRONTEND, "../shared");

/** The shared modules the browser may value-import — dependency-free by construction. */
const WEB_MODULES = new Set([
  "app/",              // the per-surface Localized copy tables (shell-copy, home-copy, …)
  "ui/",               // the generated markup/tokens/icons — ui.test.ts pins their own imports
  "lang.ts",
  "palette.ts",
  "design.ts",
  "mascot.ts",
  "types.ts",
  "dates.ts",
  "budget.ts",
  "stream.ts",         // the NDJSON path only — its Lingui-fed readers live in chat-copy.ts
  "outbox.ts",
  "results.ts",
  "contract.ts",
  "first-meal-copy.ts",
]);

/** Where a shared module may never let the bundle reach. */
const FORBIDDEN = /(^|\/)i18n\.ts$|(^|\/)locales\//;

const walk = (dir: string, out: string[] = []): string[] => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === "node_modules" || name === "dist" || name === "server" || name === "test") continue;
    else if (name.endsWith(".ts")) out.push(p);
    else if (!name.includes(".")) walk(p, out);
  }
  return out;
};

/**
 * A file's VALUE imports: `import … from "…"` and `export … from "…"` statements minus the ones
 * marked `type` on the statement itself. `import { type X, y }` still counts — `y` is a value.
 */
const importsOf = (file: string): { spec: string; line: number }[] => {
  const src = readFileSync(file, "utf8");
  const out: { spec: string; line: number }[] = [];
  for (const m of src.matchAll(/(?:^|\n)[ \t]*(?:import|export)[ \t]+([^;]*?)\sfrom\s+["']([^"']+)["']/g)) {
    if (/^type\b/.test(m[1]!.trim())) continue;
    const line = src.slice(0, m.index).split("\n").length;
    out.push({ spec: m[2]!, line });
  }
  // Side-effect imports (`import "./x.ts"`) are value imports too.
  for (const m of src.matchAll(/(?:^|\n)[ \t]*import\s+["']([^"']+)["']/g)) {
    out.push({ spec: m[1]!, line: src.slice(0, m.index).split("\n").length });
  }
  return out;
};

const asFile = (base: string, spec: string): string | null => {
  if (!spec.startsWith(".")) return null;
  const p = resolve(dirname(base), spec);
  return p.endsWith(".ts") ? p : null;
};

describe("the browser bundle's imports", () => {
  const files = walk(FRONTEND);
  test("only the listed shared modules, and never a package", () => {
    const bad: string[] = [];
    for (const f of files) {
      for (const { spec, line } of importsOf(f)) {
        if (!spec.startsWith(".")) { bad.push(`${f}:${line} imports a package: "${spec}"`); continue; }
        const target = asFile(f, spec);
        if (target === null || !target.startsWith(SHARED)) continue;
        const rel = target.slice(SHARED.length + 1);
        if (![...WEB_MODULES].some((m) => m.endsWith("/") ? rel.startsWith(m) : rel === m)) {
          bad.push(`${f}:${line} imports ../shared/${rel} — not on WEB_MODULES`);
        }
      }
    }
    expect(bad).toEqual([]);
  });

  test("nothing in the graph reaches the i18n stack", () => {
    // DFS through the modules a frontend file value-imports; every forbidden edge reports the
    // whole path so the leak names itself.
    const bad: string[] = [];
    for (const f of files) {
      const seen = new Set<string>();
      const visit = (file: string, via: string[]): void => {
        if (seen.has(file)) return;
        seen.add(file);
        for (const { spec } of importsOf(file)) {
          if (!spec.startsWith(".")) {
            if (file.startsWith(SHARED)) bad.push([...via, file, `package "${spec}"`].join(" → "));
            continue;
          }
          const target = asFile(file, spec);
          if (target === null) continue;
          if (FORBIDDEN.test(target)) { bad.push([...via, file, target].join(" → ")); continue; }
          if (target.startsWith(SHARED) || target.startsWith(FRONTEND)) visit(target, [...via, file]);
        }
      };
      visit(f, []);
    }
    expect(bad).toEqual([]);
  });
});
