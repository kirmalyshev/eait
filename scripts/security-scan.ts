#!/usr/bin/env bun
// Repo safety gate. Runs in CI and locally (`bun run security` / pre-commit hook).
// Exits 1 on any finding so a leak can't be committed or merged.
//
// Checks over TRACKED files:
//   1. Secret patterns (tokens, API keys, private keys).
//   2. Personal-data leaks that must never re-enter this public-facing repo
//      (the operator's real Telegram id + name — scrubbed once, guarded forever).
//   3. Files that must never be tracked (.env).
//
// The scanner file itself is skipped (it legitimately contains the patterns), as are
// lockfiles (hashes cause false positives). Tune patterns here as the repo grows.

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SELF = "scripts/security-scan.ts";

const SECRET_RULES: Array<[string, RegExp]> = [
  ["telegram-bot-token", /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/],
  ["openai-openrouter-key", /\bsk-(?:or-v1-)?[A-Za-z0-9-]{24,}\b/],
  ["aws-access-key-id", /\bAKIA[0-9A-Z]{16}\b/],
  ["private-key-block", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["hardcoded-bearer", /Bearer\s+[A-Za-z0-9._-]{24,}/],
];

const PERSONAL_RULES: Array<[string, RegExp]> = [
  ["operator-telegram-id", /\b179249804\b/],
  ["operator-name", /Kirill|Кирилл/],
];

const NEVER_TRACKED = [".env"];

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
  console.log(
    `✓ security-scan clean — ${files.length} tracked files, ${SECRET_RULES.length + PERSONAL_RULES.length} rules`,
  );
}

main();
