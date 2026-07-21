#!/usr/bin/env bun
// Repo safety gate. Runs in CI and locally (`bun run security` / pre-commit hook).
// Exits 1 on any finding so a leak can't be committed or merged.
//
// Checks over TRACKED files:
//   1. Secret patterns (tokens, API keys, private keys).
//   2. Personal-data leaks — operator-specific strings that must never enter the repo.
//   3. Files that must never be tracked (.env).
//
// The personal patterns are deliberately NOT in this file. They used to be, which meant the
// guard against leaking the operator's identity leaked it itself the moment the repo went
// public. They now load from an untracked source (see PERSONAL_PATTERNS_FILE below).
//
// The scanner file itself is skipped, as are lockfiles (hashes cause false positives).

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const SELF = "scripts/security-scan.ts";

/** Gitignored, machine-local. See `.security-personal.example.json` for the shape. */
const PERSONAL_PATTERNS_FILE = ".security-personal.json";

const SECRET_RULES: Array<[string, RegExp]> = [
  ["telegram-bot-token", /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/],
  ["openai-openrouter-key", /\bsk-(?:or-v1-)?[A-Za-z0-9-]{24,}\b/],
  ["aws-access-key-id", /\bAKIA[0-9A-Z]{16}\b/],
  ["private-key-block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["hardcoded-bearer", /Bearer\s+[A-Za-z0-9._-]{24,}/],
];

/**
 * Operator-specific patterns, loaded from outside the repo.
 *
 * Source order: `SECURITY_PERSONAL_PATTERNS` env (a JSON array — use a CI secret), then the
 * gitignored `.security-personal.json`. Absent from both means the personal rules do not run,
 * which is correct for a fork or a contributor: they have no operator identity to protect.
 *
 * Shape: `[{ "name": "operator-telegram-id", "pattern": "\\b123456789\\b" }]`
 */
function loadPersonalRules(): Array<[string, RegExp]> {
  let raw: string | null = null;
  if (process.env.SECURITY_PERSONAL_PATTERNS?.trim()) {
    raw = process.env.SECURITY_PERSONAL_PATTERNS;
  } else if (existsSync(PERSONAL_PATTERNS_FILE)) {
    raw = readFileSync(PERSONAL_PATTERNS_FILE, "utf8");
  }
  if (!raw) return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Fail loudly: a malformed file must not silently disable the guard.
    console.error(`❌ security-scan: could not parse personal patterns (${PERSONAL_PATTERNS_FILE})`);
    process.exit(1);
  }
  if (!Array.isArray(parsed)) {
    console.error("❌ security-scan: personal patterns must be a JSON array");
    process.exit(1);
  }
  return parsed.map((entry: any) => [String(entry.name ?? "personal"), new RegExp(entry.pattern)]);
}

const PERSONAL_RULES = loadPersonalRules();

// Exact names, plus any .env variant. setup.sh writes .env.backup.<timestamp> before
// replacing a config, and those hold live secrets — a tracked one is as bad as a tracked .env.
const NEVER_TRACKED = [".env"];
const NEVER_TRACKED_PATTERNS: RegExp[] = [/^\.env\.(?!example$).+/];

function trackedFiles(): string[] {
  return execSync("git ls-files", { encoding: "utf8" }).split("\n").filter(Boolean);
}

function isScannable(path: string): boolean {
  if (path === SELF) return false;
  if (path.endsWith(".lock") || path === "bun.lock") return false;
  return true;
}

function main(): void {
  const files = trackedFiles();
  const findings: string[] = [];

  for (const forbidden of NEVER_TRACKED) {
    if (files.includes(forbidden)) findings.push(`forbidden file is tracked: ${forbidden}`);
  }
  for (const file of files) {
    if (NEVER_TRACKED_PATTERNS.some((re) => re.test(file))) {
      findings.push(`forbidden file is tracked: ${file}`);
    }
  }

  for (const file of files) {
    if (!isScannable(file)) continue;
    let text: string;
    try {
      text = readFileSync(file, "utf8");
    } catch {
      continue; // unreadable / binary
    }
    for (const [name, re] of [...SECRET_RULES, ...PERSONAL_RULES]) {
      const m = text.match(re);
      if (m) findings.push(`${file}: ${name} → "${m[0].slice(0, 16)}…"`);
    }
  }

  if (findings.length > 0) {
    console.error(`❌ security-scan: ${findings.length} finding(s):`);
    for (const f of findings) console.error("   - " + f);
    process.exit(1);
  }
  const personal = PERSONAL_RULES.length
    ? `${PERSONAL_RULES.length} personal`
    : "personal rules OFF (no patterns configured)";
  console.log(
    `✓ security-scan clean — ${files.length} tracked files, ${SECRET_RULES.length} secret + ${personal}`,
  );
}

main();
