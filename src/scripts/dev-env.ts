// This worktree's ports, database and env files, derived from ONE number: its slot.
//
//   bun src/scripts/dev-env.ts setup          derive, and write .env.worktree and .env
//   bun src/scripts/dev-env.ts show           print what this worktree resolves to
//   bun src/scripts/dev-env.ts branch-check   warn when .env.worktree names another branch
//   bun src/scripts/dev-env.ts clean          give this worktree's derived identity back
//
// Ported from the private monorepo that carries this repository as a submodule, with the iOS,
// Metro and landing halves removed — this repo is a backend, a contract and a web application, and
// a simulator or an EAS project is not among the things it can start. What is kept is the part
// that makes several checkouts of THIS repo coexist: one Postgres server, one database each, and
// ports that cannot collide.
//
// Environment overrides:
//   EAIT_WORKTREE_SLOT   pin the slot rather than deriving it
//   EAIT_PG_BASE_URL     the Postgres server, default the one docker-compose.yml runs
//   EAIT_API_HOST        the host the generated URLs name, default 127.0.0.1

import { join } from "node:path";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";

// ── The derivation ───────────────────────────────────────────────────────────────────────────

/** Base ports. These are the slot-0 values, which are the ones every doc and script already names. */
export const PORT_BASE = { backend: 8787, web: 8788 } as const;

/**
 * The gap between one slot's ports and the next.
 *
 * Ten rather than one, so a service added later has room beside the one it belongs to without
 * landing on the next worktree's. The web port is BACKEND + 1 rather than a ladder of its own:
 * slot N owns `8787 + 10N` through `8796 + 10N`, and the number above its backend is inside that
 * range and inside no other slot's.
 */
export const PORT_STEP = 10;

/**
 * The dev Postgres `docker-compose.yml` runs — one container, shared by every worktree.
 *
 * The user is `eait_app`, NOT the `eait` the image creates. `eait` is the image's POSTGRES_USER and
 * Postgres makes that a superuser, which bypasses row-level security silently — so the backend
 * connecting as it would make every policy in `store.pg.ts` decorative on a developer's machine.
 * `src/scripts/db.sh` creates `eait_app` and gives it this worktree's database; `eait` stays the
 * maintenance role behind `./dev db`.
 */
export const DEFAULT_PG_BASE_URL = "postgres://eait_app:eait@127.0.0.1:5433";

/** The file that remembers a worktree's slot. Gitignored; one line; a number. */
export const SLOT_FILE = ".eait-slot";

export interface WorktreeEntry {
  path: string;
  branch: string;
}

/**
 * `git worktree list --porcelain` → entries, in git's order. The FIRST is the main worktree, which
 * is the definition of slot 0.
 */
export function parseWorktrees(porcelain: string): WorktreeEntry[] {
  const out: WorktreeEntry[] = [];
  let current: WorktreeEntry | null = null;
  for (const line of porcelain.split("\n")) {
    if (line.startsWith("worktree ")) {
      if (current) out.push(current);
      current = { path: line.slice("worktree ".length).trim(), branch: "HEAD" };
    } else if (line.startsWith("branch ") && current) {
      current.branch = line.slice("branch ".length).trim().replace(/^refs\/heads\//, "");
    } else if (line === "bare" && current) {
      current.branch = "main";
    }
  }
  if (current) out.push(current);
  return out;
}

/**
 * What a test database's name is the dev one's plus.
 *
 * A DOUBLE UNDERSCORE, AND THAT IS THE WHOLE COLLISION ARGUMENT. `dbNameFor` collapses every run of
 * non-alphanumerics to ONE underscore and strips them from both ends, so no dev name it can ever
 * produce contains `__` — while every name this suffix makes does. The two namespaces are therefore
 * disjoint by construction rather than by luck.
 *
 * A single `_test` is NOT disjoint, and the failure is silent and destructive: `eait_fix_test` is
 * the dev database of a worktree on branch `fix-test` AND the test database of a worktree on branch
 * `fix`. The contract suite MIGRATES AND WRITES, so the second worktree's test run rewrites the
 * first one's development data. `eait_test` itself is the dev name of a branch called plain `test`.
 * Branches ending in `-test` are not exotic, and nothing would have reported the overlap.
 */
export const TEST_DB_SUFFIX = "__test";

/**
 * A dev database's name → the name of the test database beside it.
 *
 * THE SUFFIX IS SPENT INSIDE THE 63-CHARACTER BUDGET, NOT AFTER IT. Appending to a name already at
 * 63 hands Postgres 69 characters, which it truncates back to 63 with only a NOTICE — and what
 * survives is the first 63, which is the DEV name exactly. Verified against the real server: a
 * 65-character branch gave `…for_the_alpha__test` → stored as `…for_the_alpha_`, character for
 * character the unsuffixed name. The migrating, writing contract suite would have run against the
 * database you develop in, and the only thing that ever said so was a notice on a `createdb`
 * nobody reads twice.
 *
 * Taking the DEV NAME rather than the slot and the branch is what keeps one rule: an overridden
 * `dbName` gets the test database that belongs to it, and `src/scripts/worktree.sh` can fall back
 * to the same value for a `.env.worktree` written before this key existed.
 *
 * (Two dev names identical in their first 57 characters share a test database, the same way two
 * branches identical in their first 63 have always shared a dev one.)
 */
export function testDbNameFor(dbName: string): string {
  return dbName.slice(0, 63 - TEST_DB_SUFFIX.length) + TEST_DB_SUFFIX;
}

/**
 * A branch name as a Postgres database name.
 *
 * Slot 0 keeps the plain `eait`, which is the database everything already points at. Every other
 * slot is prefixed, so `psql -l` groups them and so a name starting with a digit — which Postgres
 * would need quoted everywhere — cannot happen.
 */
export function dbNameFor(slot: number, branch: string): string {
  if (slot === 0) return "eait";
  const cleaned = branch.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  // 63 is Postgres's identifier limit and it truncates silently, which would make two long branch
  // names the same database without saying so.
  return `eait_${cleaned || String(slot)}`.slice(0, 63);
}

/**
 * A branch name reduced to characters a POSIX shell reads as one word.
 *
 * `.env.worktree` is SOURCED, and a `#` in a branch name starts a comment there while a `$` would
 * be expanded. The branch appears in that file for a human to read, so mangling it is free and the
 * alternative is a value that silently parses as something else.
 */
export function safeToken(value: string): string {
  return value.replace(/[^A-Za-z0-9._/-]+/g, "-");
}

/**
 * The branch this worktree was DERIVED for, against the one checked out now, or `null` when they
 * agree and when there is nothing to compare.
 *
 * THE DATABASE NAME CARRIES THE BRANCH AND IS NOT RE-DERIVED ON `git switch`. `./dev up` derives
 * only when `.env.worktree` is MISSING, correctly — re-deriving would move the ports of a running
 * stack — so drift here is normal and silent, and the symptom is a worktree reading the database
 * of the branch you left.
 *
 * Compared through `safeToken` because that is what was written.
 */
export function branchDrift(envWorktree: string, currentBranch: string): string | null {
  const stored = envWorktree.match(/^EAIT_BRANCH=(.*)$/m)?.[1];
  if (!stored) return null;
  return stored === safeToken(currentBranch) ? null : stored;
}

export interface WorktreePlan {
  slot: number;
  branch: string;
  backendPort: number;
  /** The WEB APPLICATION's port — a different application from the backend, so a different port. */
  webPort: number;
  /** Where a browser reaches it. Also `EAIT__BACKEND__PUBLIC_WEB_URL` for this worktree. */
  webUrl: string;
  dbName: string;
  databaseUrl: string;
  /**
   * The store contract suite's database, and NOT `dbName`.
   *
   * That suite migrates and writes, and two of its assertions are about a database with no admin
   * in it — which `./dev seed` puts into the dev one. Derived rather than hardcoded so it cannot
   * miss the slot: every worktree following one set of documented instructions against one fixed
   * `eait_test` is several agents writing the same rows.
   */
  testDbName: string;
  testDatabaseUrl: string;
  apiUrl: string;
}

export interface PlanOverrides {
  dbName?: string | undefined;
  pgBaseUrl?: string | undefined;
  apiHost?: string | undefined;
}

export function planFor(slot: number, branch: string, o: PlanOverrides = {}): WorktreePlan {
  const backendPort = PORT_BASE.backend + slot * PORT_STEP;
  const webPort = PORT_BASE.web + slot * PORT_STEP;
  const dbName = o.dbName || dbNameFor(slot, branch);
  const testDbName = testDbNameFor(dbName);
  const pgBase = (o.pgBaseUrl || DEFAULT_PG_BASE_URL).replace(/\/+$/, "");
  const apiHost = o.apiHost || "127.0.0.1";
  return {
    slot,
    branch,
    backendPort,
    webPort,
    webUrl: `http://${apiHost}:${webPort}`,
    dbName,
    databaseUrl: `${pgBase}/${dbName}`,
    testDbName,
    testDatabaseUrl: `${pgBase}/${testDbName}`,
    apiUrl: `http://${apiHost}:${backendPort}`,
  };
}

// ── Slot allocation ──────────────────────────────────────────────────────────────────────────

export interface SlotResolution {
  slot: number;
  entry: WorktreeEntry;
  mainPath: string;
  /** True when the slot was freshly allocated and should be written to `.eait-slot`. */
  persist: boolean;
  /** How the number was arrived at — printed, so a surprising slot explains itself. */
  source: "override" | "main" | "claimed" | "allocated";
}

/**
 * Which slot this worktree gets.
 *
 * The order is deliberate. An explicit override always wins. The main worktree is ALWAYS 0, so the
 * repo's documented ports keep working there. Otherwise a worktree keeps the slot it has already
 * claimed — which is the whole reason `.eait-slot` exists: allocating from the position in
 * `git worktree list` alone means adding or removing a worktree renumbers the others, and a backend
 * left running on a port nobody computes any more is invisible until something fails to connect.
 * Only a worktree with no claim allocates, and it takes the lowest number nobody else holds.
 */
export function resolveSlot(input: {
  worktrees: WorktreeEntry[];
  cwd: string;
  override?: string | undefined;
  claimOf: (worktreePath: string) => number | null;
}): SlotResolution {
  const { worktrees, cwd, claimOf } = input;
  if (worktrees.length === 0) throw new Error("no git worktrees found");
  const entry = worktreeContaining(worktrees, cwd);
  const mainPath = worktrees[0]!.path;

  const pinned = overrideSlot(input.override);
  if (pinned !== null) return { slot: pinned, entry, mainPath, persist: false, source: "override" };
  if (entry.path === mainPath) return { slot: 0, entry, mainPath, persist: false, source: "main" };
  const claimed = claimOf(entry.path);
  if (claimed !== null && claimed > 0) return { slot: claimed, entry, mainPath, persist: false, source: "claimed" };
  return { slot: lowestFreeSlot(worktrees, entry, claimOf), entry, mainPath, persist: true, source: "allocated" };
}

/** The worktree `cwd` is inside, or a throw that names every worktree it is not. */
function worktreeContaining(worktrees: WorktreeEntry[], cwd: string): WorktreeEntry {
  const entry = worktrees.find((w) => cwd === w.path || cwd.startsWith(w.path + "/"));
  if (entry) return entry;
  throw new Error(
    `not inside any git worktree of this repo\n  cwd: ${cwd}\n` +
    `  worktrees: ${worktrees.map((w) => w.path).join(", ")}`,
  );
}

/** `EAIT_WORKTREE_SLOT` as a slot number, or null when it is unset or empty. */
function overrideSlot(override: string | undefined): number | null {
  if (override === undefined || override === "") return null;
  const n = Number(override);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`EAIT_WORKTREE_SLOT must be a non-negative integer, got "${override}"`);
  }
  return n;
}

/** The lowest slot no other worktree has claimed. 0 is the main worktree's and never handed out. */
function lowestFreeSlot(
  worktrees: WorktreeEntry[],
  entry: WorktreeEntry,
  claimOf: (worktreePath: string) => number | null,
): number {
  const taken = new Set<number>([0]);
  for (const w of worktrees) {
    if (w.path === entry.path) continue;
    const c = claimOf(w.path);
    if (c !== null) taken.add(c);
  }
  let slot = 1;
  while (taken.has(slot)) slot++;
  return slot;
}

// ── env files ────────────────────────────────────────────────────────────────────────────────

/** A `.env` file → key/value pairs. Comments, blanks and surrounding quotes are dropped. */
export function parseEnvText(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of text.split("\n")) {
    const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue;
    out[m[1]!] = m[2]!.trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return out;
}

export function readEnvFile(path: string): Record<string, string> {
  return existsSync(path) ? parseEnvText(readFileSync(path, "utf8")) : {};
}

export interface EnvSection {
  comment?: string;
  values: Record<string, string>;
}

/** Sections → file text. Empty sections are dropped rather than leaving a heading over nothing. */
export function renderEnv(header: string[], sections: EnvSection[]): string {
  const lines = header.map((h) => (h === "" ? "#" : `# ${h}`));
  for (const section of sections) {
    const keys = Object.keys(section.values);
    if (keys.length === 0) continue;
    lines.push("");
    if (section.comment) for (const l of section.comment.split("\n")) lines.push(l === "" ? "#" : `# ${l}`);
    for (const k of keys) lines.push(`${k}=${section.values[k]}`);
  }
  return lines.join("\n") + "\n";
}

/**
 * Whether a value means the same thing to `sh` when written unquoted.
 *
 * AN ALLOWLIST, because a denylist is wrong in the direction that matters. A Postgres password with
 * an ampersand — `postgres://eait:p&ss@host` — written unquoted makes `sh` BACKGROUND the
 * assignment and run `ss@host…` as a command, leaving the variable UNSET. An unset key here is the
 * silent slot-0 fallback that `worktreeEnvValues` throws to prevent. Enumerating every character a
 * shell treats specially is a losing game; enumerating the inert ones is not.
 *
 * `% ? = +` are here for URLs: a percent-encoded password is the STANDARD way to carry a special
 * character, and `?sslmode=require` is an ordinary connection string. None is special on an
 * assignment's right-hand side — there is no pathname expansion there, so `?` is literal.
 */
export function envIsSafe(value: string): boolean {
  return /^[A-Za-z0-9._/:@%?=+-]+$/.test(value);
}

/**
 * The values `.env.worktree` carries, which is the file `src/scripts/worktree.sh` sources.
 *
 * EVERY KEY IS MANDATORY. A missing one falls back to whatever its reader defaults to, and every
 * reader here defaults to SLOT 0 — so dropping a key silently is a way to point a worktree at the
 * main worktree's database, which is exactly the collision slots exist to prevent. A value that
 * cannot be written safely is a hard error at generation time instead.
 */
export function worktreeEnvValues(plan: WorktreePlan): Record<string, string> {
  const values: Record<string, string> = {
    EAIT_SLOT: String(plan.slot),
    EAIT_BRANCH: safeToken(plan.branch),
    EAIT_BACKEND_PORT: String(plan.backendPort),
    EAIT_WEB_PORT: String(plan.webPort),
    EAIT_WEB_URL: plan.webUrl,
    EAIT_DB_NAME: plan.dbName,
    EAIT_DATABASE_URL: plan.databaseUrl,
    EAIT_TEST_DB_NAME: plan.testDbName,
    EAIT_TEST_DATABASE_URL: plan.testDatabaseUrl,
    EAIT_API_URL: plan.apiUrl,
  };
  for (const key of Object.keys(values)) {
    if (envIsSafe(values[key]!)) continue;
    throw new Error(
      `${key} is "${values[key]}", which cannot be written to .env.worktree: that file is sourced ` +
      `by sh, and a value containing a space, quote, #, $, backslash, backtick or one of ` +
      `& ; | ( ) < > ! means something else there. There is no safe fallback for this key — ` +
      `leaving it out would silently give this worktree slot 0's value. Allowed characters are ` +
      `letters, digits, and . _ - / : @ % ? = + — percent-encode anything else in a URL.`,
    );
  }
  return values;
}

/**
 * Keys the generator owns in `.env`. These are rewritten on every run because they are DERIVED from
 * the slot; everything else in the file is carried across untouched.
 */
export const DERIVED_KEYS = [
  "EAIT__BACKEND__PORT",
  "EAIT__BACKEND__HOST",
  "EAIT__BACKEND__DATABASE_URL",
  "EAIT__BACKEND__PUBLIC_API_URL",
  "EAIT__BACKEND__PUBLIC_WEB_URL",
  "EAIT__FRONTEND__PORT",
  "EAIT__FRONTEND__HOST",
  "EAIT__FRONTEND__BACKEND_ORIGIN",
] as const;

/**
 * Everything in an existing `.env` that this generator does NOT own — API keys, a real database
 * URL, anything a person put there by hand. Carried across verbatim, so re-deriving is lossless.
 */
export function carriedOver(existing: Record<string, string>, owned: readonly string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(existing)) {
    if (!owned.includes(k)) out[k] = v;
  }
  return out;
}

export function derivedValues(plan: WorktreePlan): Record<string, string> {
  return {
    EAIT__BACKEND__PORT: String(plan.backendPort),
    EAIT__BACKEND__HOST: "127.0.0.1",
    EAIT__BACKEND__DATABASE_URL: plan.databaseUrl,
    EAIT__BACKEND__PUBLIC_API_URL: plan.apiUrl,
    // The backend needs to know a web application exists, so `/start/chat` sends people to it.
    EAIT__BACKEND__PUBLIC_WEB_URL: plan.webUrl,
    EAIT__FRONTEND__PORT: String(plan.webPort),
    EAIT__FRONTEND__HOST: "127.0.0.1",
    // The dev-server proxy: the app calls the API on its own origin and this forwards it.
    EAIT__FRONTEND__BACKEND_ORIGIN: plan.apiUrl,
  };
}

// ── The CLI ──────────────────────────────────────────────────────────────────────────────────

function git(args: string[], cwd: string): string {
  const r = Bun.spawnSync({ cmd: ["git", ...args], cwd, stdout: "pipe", stderr: "pipe" });
  if (!r.success) throw new Error(`git ${args.join(" ")} failed: ${r.stderr.toString().trim()}`);
  return r.stdout.toString();
}

function claimOfPath(worktreePath: string): number | null {
  const f = join(worktreePath, SLOT_FILE);
  if (!existsSync(f)) return null;
  const n = Number(readFileSync(f, "utf8").trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function resolveHere(root: string) {
  const worktrees = parseWorktrees(git(["worktree", "list", "--porcelain"], root));
  const res = resolveSlot({
    worktrees,
    cwd: root,
    override: process.env.EAIT_WORKTREE_SLOT,
    claimOf: claimOfPath,
  });
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], root).trim();
  const plan = planFor(res.slot, branch, {
    pgBaseUrl: process.env.EAIT_PG_BASE_URL,
    apiHost: process.env.EAIT_API_HOST,
  });
  return { res, plan };
}

function setup(root: string): void {
  const { res, plan } = resolveHere(root);
  if (res.persist) writeFileSync(join(root, SLOT_FILE), `${plan.slot}\n`);

  writeFileSync(join(root, ".env.worktree"), renderEnv([
    "This worktree's ports and database. GENERATED by `./dev env` — edit nothing here.",
    "",
    "Sourced by src/scripts/worktree.sh, which supplies slot-0 defaults when this file is absent.",
    "Nothing secret lives here, by construction, so it can be sourced without care.",
  ], [{ values: worktreeEnvValues(plan) }]));

  const envPath = join(root, ".env");
  const existing = readEnvFile(envPath);
  writeFileSync(envPath, renderEnv([
    "This worktree's environment.",
    "",
    "The keys below the first heading are DERIVED from the slot and rewritten by `./dev env`.",
    "Everything after them was already in this file and is carried across untouched — so",
    "re-deriving never eats an API key. `.env.example` is the full inventory of what the",
    "server reads.",
  ], [
    { comment: `Derived — slot ${plan.slot}, branch ${safeToken(plan.branch)}.`, values: derivedValues(plan) },
    { comment: "Yours.", values: carriedOver(existing, DERIVED_KEYS) },
  ]));

  console.log(`slot ${plan.slot} (${res.source}) — backend :${plan.backendPort}, web :${plan.webPort}, db ${plan.dbName}`);
}

function show(root: string): void {
  const { res, plan } = resolveHere(root);
  const rows: Array<[string, string]> = [
    ["slot", `${plan.slot} (${res.source})`],
    ["branch", plan.branch],
    ["backend", plan.apiUrl],
    ["web", plan.webUrl],
    ["database", plan.dbName],
    ["database url", plan.databaseUrl],
    ["test database", plan.testDbName],
    ["test database url", plan.testDatabaseUrl],
    ["worktree", res.entry.path],
  ];
  const w = Math.max(...rows.map(([k]) => k.length));
  for (const [k, v] of rows) console.log(`${k.padEnd(w)}  ${v}`);
}

/**
 * Give this worktree's derived identity back: `.env.worktree` and the slot claim.
 *
 * NOT `.env`. That file carries the API key and anything else you put there by hand, and the whole
 * design of `setup` is that re-deriving never eats it — deleting it here would be the one path that
 * does.
 *
 * IT REFUSES WHILE A STACK IS RUNNING, and that refusal is what makes this safe to offer from
 * `./dev ls` as a single keystroke. Removing `.env.worktree` from under a live backend leaves a
 * process whose port and database nothing in the repo can name again: `./dev down` would fall back
 * to slot 0's values and stop nothing. The check is the same one `dev.sh` makes — a `.dev/*.pid`
 * whose process is still alive.
 */
function clean(root: string): number {
  const live: string[] = [];
  for (const service of ["backend", "web"]) {
    const f = join(root, ".dev", `${service}.pid`);
    if (!existsSync(f)) continue;
    const pid = Number(readFileSync(f, "utf8").trim());
    if (!Number.isInteger(pid) || pid <= 0) continue;
    try {
      process.kill(pid, 0);
      live.push(`${service} (pid ${pid})`);
    } catch {
      // Not running: a stale pidfile is not a reason to refuse.
    }
  }
  if (live.length > 0) {
    console.error(`dev-env: ${live.join(", ")} still running here — \`./dev down\` first.`);
    console.error("dev-env: removing .env.worktree under a live stack leaves a process nothing can name again.");
    return 1;
  }
  let removed = 0;
  for (const name of [".env.worktree", SLOT_FILE]) {
    const f = join(root, name);
    if (!existsSync(f)) continue;
    rmSync(f);
    console.log(`removed ${name}`);
    removed++;
  }
  if (removed === 0) console.log("nothing to remove — this worktree has no derived files");
  else console.log("`./dev env setup` derives them back; the values come from the slot, not the file.");
  return 0;
}

/** Non-zero is not failure here: `./dev up` calls it for a warning and carries on regardless. */
function branchCheck(root: string): number {
  const f = join(root, ".env.worktree");
  if (!existsSync(f)) return 0;
  const branch = git(["rev-parse", "--abbrev-ref", "HEAD"], root).trim();
  const stale = branchDrift(readFileSync(f, "utf8"), branch);
  if (!stale) return 0;
  console.error(`dev: .env.worktree was derived for "${stale}", you are on "${safeToken(branch)}".`);
  console.error(`dev: the database name still names the old branch. \`./dev env\` re-derives it.`);
  return 1;
}

if (import.meta.main) {
  const root = join(import.meta.dir, "..", "..");
  const cmd = process.argv[2] ?? "show";
  try {
    if (cmd === "setup") setup(root);
    else if (cmd === "show") show(root);
    else if (cmd === "branch-check") process.exit(branchCheck(root));
    else if (cmd === "clean") process.exit(clean(root));
    else {
      console.error(`dev-env: unknown command "${cmd}" — setup | show | branch-check | clean`);
      process.exit(2);
    }
  } catch (e) {
    console.error(`dev-env: ${(e as Error).message}`);
    process.exit(1);
  }
}
