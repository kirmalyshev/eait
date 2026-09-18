// Every worktree of this repo on this machine, and what each one is running.
//
//   bun src/scripts/dev-ls.ts            the table          (or: ./dev ls)
//   bun src/scripts/dev-ls.ts --plain    the same, never coloured, for a pipe
//
// ONE QUESTION THIS ANSWERS AND `./dev status` CANNOT: which OTHER checkout is holding the port
// you wanted. A backend left running in a worktree you have since moved on from is invisible from
// inside the one you are in — the symptom is `./dev up` refusing a port, with nothing saying who
// has it.
//
// Ported from the private monorepo that carries this repository as a submodule. The interactive
// half of the original — moving between worktrees, stopping and retiring one from inside the table
// — is NOT here: it was built around simulators and build slots this repo has none of, and what is
// left of it is `./dev down` in the worktree itself. This is a reader, and it changes nothing.

import { join } from "node:path";
import { existsSync, readFileSync } from "node:fs";
import { parseWorktrees, planFor, readEnvFile, SLOT_FILE, type WorktreeEntry } from "./dev-env.ts";

const SERVICES = ["backend", "web"] as const;
type Service = (typeof SERVICES)[number];

const PLAIN = process.argv.includes("--plain") || !process.stdout.isTTY || Boolean(process.env.NO_COLOR);
const sgr = (code: string) => (PLAIN ? "" : code);
const DIM = sgr("\x1b[2m");
const GREEN = sgr("\x1b[32m");
const RED = sgr("\x1b[31m");
const YELLOW = sgr("\x1b[33m");
const BOLD = sgr("\x1b[1m");
const OFF = sgr("\x1b[0m");

function sh(cmd: string[]): string {
  const r = Bun.spawnSync({ cmd, stdout: "pipe", stderr: "pipe" });
  return r.success ? r.stdout.toString() : "";
}

/** pid → the command it is running. One `ps` for the whole machine rather than one per pidfile. */
function processCommands(): Map<number, string> {
  const out = new Map<number, string>();
  for (const line of sh(["ps", "-eo", "pid=,command="]).split("\n")) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (m) out.set(Number(m[1]), m[2]!);
  }
  return out;
}

/** pid → its working directory, which is what tells two worktrees' identical commands apart. */
function processCwds(pids: number[]): Map<number, string> {
  const out = new Map<number, string>();
  if (pids.length === 0) return out;
  const text = sh(["lsof", "-a", "-d", "cwd", "-p", pids.join(","), "-Fpn"]);
  let pid: number | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("n") && pid !== null) {
      if (!out.has(pid)) out.set(pid, line.slice(1));
    }
  }
  return out;
}

/** Every TCP port something is LISTENing on, machine-wide. */
function listeningPorts(): Set<number> {
  const out = new Set<number>();
  for (const line of sh(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"]).split("\n")) {
    const m = /:(\d+)\s*\(LISTEN\)/.exec(line);
    if (m) out.add(Number(m[1]));
  }
  return out;
}

type State = "running" | "stopped" | "foreign";

interface Row {
  path: string;
  branch: string;
  slot: number | null;
  ports: Record<Service, number | undefined>;
  state: Record<Service, State>;
  here: boolean;
}

function claimOf(path: string): number | null {
  const f = join(path, SLOT_FILE);
  if (!existsSync(f)) return null;
  const n = Number(readFileSync(f, "utf8").trim());
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function pidIn(path: string, service: Service): number | null {
  const f = join(path, ".dev", `${service}.pid`);
  if (!existsSync(f)) return null;
  const n = Number(readFileSync(f, "utf8").trim());
  return Number.isInteger(n) && n > 0 ? n : null;
}

const NEEDLE: Record<Service, RegExp> = {
  backend: /src\/backend\/index\.ts/,
  web: /src\/frontend\/server\/index\.ts/,
};

/**
 * What a worktree's slot is, WITHOUT deriving it: the generated file first, then the claim, then
 * the fact that the first worktree git lists is always slot 0.
 *
 * Deriving here would be wrong rather than merely slow — `resolveSlot` ALLOCATES for a worktree
 * that has never claimed one, and a reader that hands out slot numbers as a side effect of being
 * run is a reader that changes what it is reporting on.
 */
function slotOf(path: string, isMain: boolean): number | null {
  const env = readEnvFile(join(path, ".env.worktree"));
  if (env.EAIT_SLOT !== undefined && env.EAIT_SLOT !== "") return Number(env.EAIT_SLOT);
  const claimed = claimOf(path);
  if (claimed !== null) return claimed;
  return isMain ? 0 : null;
}

function portsOf(path: string, slot: number | null, branch: string): Record<Service, number | undefined> {
  const env = readEnvFile(join(path, ".env.worktree"));
  if (env.EAIT_BACKEND_PORT && env.EAIT_WEB_PORT) {
    return { backend: Number(env.EAIT_BACKEND_PORT), web: Number(env.EAIT_WEB_PORT) };
  }
  // No generated file: a slot-0 worktree still has the documented defaults, and one that has never
  // been derived has no ports at all rather than a guess that would name somebody else's.
  if (slot === null) return { backend: undefined, web: undefined };
  const plan = planFor(slot, branch);
  return { backend: plan.backendPort, web: plan.webPort };
}

function build(entries: WorktreeEntry[]): Row[] {
  const cwd = process.cwd();
  const commands = processCommands();
  const listening = listeningPorts();
  const pids: Array<{ path: string; service: Service; pid: number }> = [];
  for (const e of entries) {
    for (const s of SERVICES) {
      const pid = pidIn(e.path, s);
      if (pid !== null) pids.push({ path: e.path, service: s, pid });
    }
  }
  const cwds = processCwds(pids.map((p) => p.pid));

  return entries.map((e, i) => {
    const slot = slotOf(e.path, i === 0);
    const ports = portsOf(e.path, slot, e.branch);
    const state = {} as Record<Service, State>;
    for (const s of SERVICES) {
      const pid = pidIn(e.path, s);
      const command = pid === null ? null : commands.get(pid) ?? null;
      const dir = pid === null ? null : cwds.get(pid) ?? null;
      // ALL THREE, the same question `dev.sh` asks: alive, running THIS service, and running it out
      // of THIS worktree. A pidfile alone is a recycled pid waiting to be mistaken for a service.
      const ours = command !== null && NEEDLE[s].test(command) && dir !== null
        && (dir === e.path || dir.startsWith(e.path + "/"));
      if (ours) state[s] = "running";
      // A port this worktree owns, LISTENing, that no pidfile of its own names: either a stack
      // started before a pidfile was lost, or a stranger. Either way `./dev up` here will refuse,
      // and this is the line that says why.
      else if (ports[s] !== undefined && listening.has(ports[s]!)) state[s] = "foreign";
      else state[s] = "stopped";
    }
    return { path: e.path, branch: e.branch, slot, ports, state, here: cwd === e.path || cwd.startsWith(e.path + "/") };
  });
}

function cell(port: number | undefined, state: State): string {
  if (port === undefined) return `${DIM}—${OFF}`;
  if (state === "running") return `${GREEN}✓ ${port}${OFF}`;
  if (state === "foreign") return `${YELLOW}? ${port}${OFF}`;
  return `${DIM}· ${port}${OFF}`;
}

/** Visible width — the escape codes are zero-width and would otherwise pad every coloured cell short. */
function width(s: string): number {
  return s.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function pad(s: string, n: number): string {
  return s + " ".repeat(Math.max(0, n - width(s)));
}

const entries = parseWorktrees(sh(["git", "worktree", "list", "--porcelain"]));
if (entries.length === 0) {
  console.error("dev-ls: not inside a git repository with worktrees");
  process.exit(1);
}
const rows = build(entries);

const header = ["", "slot", "branch", "backend", "web", "worktree"];
const table = rows.map((r) => [
  r.here ? `${BOLD}▸${OFF}` : " ",
  r.slot === null ? `${DIM}—${OFF}` : String(r.slot),
  r.branch,
  cell(r.ports.backend, r.state.backend),
  cell(r.ports.web, r.state.web),
  r.path,
]);

const widths = header.map((h, i) => Math.max(width(h), ...table.map((row) => width(row[i]!))));
console.log(header.map((h, i) => `${DIM}${pad(h, widths[i]!)}${OFF}`).join("  "));
for (const row of table) console.log(row.map((c, i) => pad(c, widths[i]!)).join("  "));

const foreign = rows.flatMap((r) => SERVICES.filter((s) => r.state[s] === "foreign").map((s) => ({ r, s })));
if (foreign.length > 0) {
  console.log("");
  for (const { r, s } of foreign) {
    console.log(`${YELLOW}?${OFF} ${r.ports[s]} (${s}, slot ${r.slot}) is listening, but no pidfile in ${r.path} names it.`);
  }
  console.log(`${DIM}  Either a stack started before its pidfile was lost, or another program. \`lsof -nP -iTCP:<port> -sTCP:LISTEN\` names it.${OFF}`);
}

const undrived = rows.filter((r) => r.slot === null);
if (undrived.length > 0) {
  console.log("");
  console.log(`${DIM}${undrived.length} worktree(s) have never been derived — \`./dev env\` in one gives it a slot.${OFF}`);
}
