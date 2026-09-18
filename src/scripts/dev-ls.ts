// Every worktree of this repo on this machine, and what each one is running.
//
//   bun src/scripts/dev-ls.ts            interactive on a terminal (or: ./dev ls)
//   bun src/scripts/dev-ls.ts --plain    the table, printed once, for a pipe
//
// ONE QUESTION THIS ANSWERS AND `./dev status` CANNOT: which OTHER checkout is holding the port
// you wanted. A backend left running in a worktree you have since moved on from is invisible from
// inside the one you are in — the symptom is `./dev up` refusing a port, with nothing saying who
// has it.
//
// Ported from the private monorepo that carries this repository as a submodule, minus the
// simulator and build-slot columns this repo has none of.
//
// EVERY ACTION IS THE TARGET WORKTREE'S OWN COMMAND — `<path>/dev down`, its `db.sh drop`, its
// `dev-env.ts clean` — never a reimplementation of what those do. That is what makes them safe to
// offer as one keystroke: `clean` refuses while a stack is running and `down` knows how to walk a
// process tree, so this view does not have to know either rule and cannot get it wrong.

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

const REVERSE = sgr("\x1b[7m");
const ALT_ON = "\x1b[?1049h\x1b[?25l";
const ALT_OFF = "\x1b[?25h\x1b[?1049l";

interface Cursor { at: number; selected: Set<string> }

function renderTable(rows: Row[], cursor?: Cursor, pathWidth = Infinity): string[] {
  const header = [" ", "slot", "branch", "backend", "web", "worktree"];
  const body = rows.map((r) => [
    cursor && cursor.selected.has(r.path) ? `${BOLD}•${OFF}` : r.here ? `${BOLD}▸${OFF}` : " ",
    r.slot === null ? `${DIM}—${OFF}` : String(r.slot),
    r.branch,
    cell(r.ports.backend, r.state.backend),
    cell(r.ports.web, r.state.web),
    r.path.length > pathWidth ? `…${r.path.slice(-(pathWidth - 1))}` : r.path,
  ]);
  const widths = header.map((h, i) => Math.max(width(h), ...body.map((row) => width(row[i]!))));
  const line = (cells: string[]) => cells.map((c, i) => pad(c, widths[i]!)).join("  ");
  const out = [header.map((h, i) => `${DIM}${pad(h, widths[i]!)}${OFF}`).join("  ")];
  body.forEach((row, i) => {
    const text = line(row);
    // Reverse video on the whole row rather than a marker in one column: at a glance the cursor is
    // where the eye already is.
    out.push(cursor && cursor.at === i ? `${REVERSE}${text}${OFF}` : text);
  });
  return out;
}

function notes(rows: Row[]): string[] {
  const out: string[] = [];
  const foreign = rows.flatMap((r) => SERVICES.filter((s) => r.state[s] === "foreign").map((s) => ({ r, s })));
  for (const { r, s } of foreign) {
    out.push(`${YELLOW}?${OFF} ${r.ports[s]} (${s}, slot ${r.slot}) is listening, but no pidfile in ${r.path} names it.`);
  }
  if (foreign.length > 0) {
    out.push(`${DIM}  Either a stack started before its pidfile was lost, or another program. \`lsof -nP -iTCP:<port> -sTCP:LISTEN\` names it.${OFF}`);
  }
  const underived = rows.filter((r) => r.slot === null).length;
  if (underived > 0) out.push(`${DIM}${underived} worktree(s) have never been derived — \`./dev env setup\` in one gives it a slot.${OFF}`);
  return out;
}

// ── Acting on a row ──────────────────────────────────────────────────────────────────────────

interface Step { label: string; cmd: string[]; cwd: string }

const exists = (p: string) => existsSync(p);
/** The directory stands but its `.git` is gone — git refuses to remove such an entry by name. */
const isHusk = (r: Row) => exists(r.path) && !exists(join(r.path, ".git"));

/** Uncommitted files, or null when git could not be asked. An unanswerable guard is a refusal. */
function dirtyCount(path: string): number | null {
  const r = Bun.spawnSync({ cmd: ["git", "status", "--porcelain"], cwd: path, stdout: "pipe", stderr: "pipe" });
  if (!r.success) return null;
  return r.stdout.toString().split("\n").filter((l) => l.trim() !== "").length;
}

function stopPlan(r: Row): Step[] {
  return exists(join(r.path, ".dev")) ? [{ label: "stop the stack", cmd: [join(r.path, "dev"), "down"], cwd: r.path }] : [];
}

function cleanPlan(r: Row): Step[] {
  const has = exists(join(r.path, ".env.worktree")) || exists(join(r.path, SLOT_FILE));
  return has ? [{ label: "remove its env files", cmd: ["bun", "src/scripts/dev-env.ts", "clean"], cwd: r.path }] : [];
}

/**
 * `x`: stop, drop the database, give the env files back, remove the worktree.
 *
 * THE THREE ACTIONS NEST BY CALLING EACH OTHER, not by resembling each other, so a fix to what
 * stopping or cleaning means reaches retire the same day and cannot reach only two of the three.
 *
 * THE DROP IS LEFT OUT ENTIRELY when the worktree was never derived. `db.sh` falls back to `eait`
 * without a `.env.worktree` to read — correct for slot 0, which IS that database, and catastrophic
 * here: retiring an underived worktree would drop the MAIN worktree's data.
 */
function retirePlan(r: Row, here: string): Step[] {
  if (!exists(r.path)) {
    return [{ label: "clear the stale worktree entry", cmd: ["git", "worktree", "remove", "--force", r.path], cwd: here }];
  }
  return [
    ...stopPlan(r),
    // BEFORE `clean`, which removes the `.env.worktree` that names the database.
    ...(r.slot === null || !exists(join(r.path, ".env.worktree"))
      ? []
      : [{ label: `drop the database`, cmd: ["sh", "src/scripts/db.sh", "drop", "--yes"], cwd: r.path }]),
    ...cleanPlan(r),
    { label: "remove the worktree", cmd: ["git", "worktree", "remove", r.path], cwd: here },
  ];
}

/** Why this row may not be retired, or null when it may. */
function retireBlocker(r: Row, mainPath: string, cwd: string): string | null {
  if (r.path === mainPath) return "it is the main worktree";
  if (r.path === cwd || cwd.startsWith(r.path + "/")) return "you are standing in it";
  if (isHusk(r)) return "its .git file is gone — delete the directory by hand, then x clears the entry";
  if (!exists(r.path)) return null;
  const dirty = dirtyCount(r.path);
  // "git did not say" and "nothing to lose" must not resolve the same way: the next step drops a
  // database and removes a directory.
  if (dirty === null) return "its git status could not be read";
  if (dirty > 0) return `it has ${dirty} uncommitted change${dirty === 1 ? "" : "s"}`;
  return null;
}

function planLines(path: string, steps: Step[]): string[] {
  const w = Math.max(0, ...steps.map((s) => s.label.length));
  return [
    `${DIM}<worktree> = ${path}${OFF}`,
    ...steps.map((s) => `  ${s.label.padEnd(w)}  ${DIM}${s.cmd.join(" ").replaceAll(path, "<worktree>")}${OFF}`),
  ];
}

// ── Interactive ──────────────────────────────────────────────────────────────────────────────

async function interactive(initial: Row[], mainPath: string): Promise<void> {
  const cwd = process.cwd();
  let rows = initial;
  let at = 0;
  let selected = new Set<string>();
  let log: string[] = [];

  const stdin = process.stdin;
  const raw = (on: boolean) => { if (stdin.isRaw !== on) stdin.setRawMode?.(on); };
  // ONE READER FOR THE WHOLE PROGRAM. `for await (… of stdin) { … break }` looks like the way to
  // wait for a single key and it destroys the stream — leaving a `for await` early calls the
  // iterator's `return()`, which closes stdin for everyone, and the next key then aborts.
  const keys = stdin[Symbol.asyncIterator]();
  const nextKey = async (): Promise<string> => {
    raw(true);
    const { value, done } = await keys.next();
    return done ? "q" : String(value);
  };

  const draw = () => {
    const width = process.stdout.columns ?? 120;
    const out = [
      `${BOLD}dev worktrees${OFF}`,
      "",
      ...renderTable(rows, { at, selected }, Math.max(24, width - 46)),
      "",
      ...notes(rows),
      "",
      `${DIM}↑↓/jk move · space select · s stop · c clean · x retire · r refresh · q quit${OFF}`,
      ...log.slice(-8),
    ];
    process.stdout.write("\x1b[H\x1b[2J" + out.join("\n") + "\n");
  };

  const targets = (): Row[] => {
    const picked = rows.filter((r) => selected.has(r.path));
    const here = rows[at];
    return picked.length > 0 ? picked : here ? [here] : [];
  };

  const ask = async (question: string, detail: string[]): Promise<boolean> => {
    log = [];
    process.stdout.write("\x1b[H\x1b[2J" + [
      `${BOLD}${question}${OFF}`,
      "",
      ...detail,
      "",
      `${DIM}y to confirm, anything else to cancel${OFF}`,
    ].join("\n") + "\n");
    const k = await nextKey();
    return k === "y" || k === "Y";
  };

  const runPlan = async (name: string, steps: Step[]): Promise<void> => {
    for (const step of steps) {
      const r = Bun.spawnSync({ cmd: step.cmd, cwd: step.cwd, stdout: "pipe", stderr: "pipe" });
      if (r.success) {
        log.push(`${GREEN}✓${OFF} ${name}: ${step.label}`);
      } else {
        // STOPS AT ITS OWN FIRST FAILURE. The recoverable half of a sequence that ends in something
        // irreversible must not run when an earlier step did not do what it said.
        const why = (r.stderr.toString() || r.stdout.toString()).trim().split("\n").pop() ?? "failed";
        log.push(`${RED}✗${OFF} ${name}: ${step.label} — ${why}`);
        return;
      }
    }
  };

  const act = async (kind: "stop" | "clean" | "retire"): Promise<void> => {
    const chosen = targets();
    if (chosen.length === 0) return;
    const plans: Array<[Row, Step[]]> = [];
    const refused: string[] = [];
    for (const r of chosen) {
      if (kind === "retire") {
        const why = retireBlocker(r, mainPath, cwd);
        if (why) { refused.push(`${YELLOW}·${OFF} ${r.branch}: ${why}`); continue; }
      }
      const steps = kind === "stop" ? stopPlan(r) : kind === "clean" ? cleanPlan(r) : retirePlan(r, mainPath);
      if (steps.length > 0) plans.push([r, steps]);
    }
    if (plans.length === 0) { log = refused.length > 0 ? refused : [`${DIM}nothing to do${OFF}`]; return; }
    const verb = kind === "retire" ? "Retire" : kind === "stop" ? "Stop" : "Clean";
    const detail = [...refused, ...(refused.length > 0 ? [""] : []), ...plans.flatMap(([r, st]) => planLines(r.path, st))];
    const tail = kind === "retire" ? " This cannot be undone." : "";
    if (!await ask(`${verb} ${plans.map(([r]) => r.branch).join(", ")}?${tail}`, detail)) { log = [`${DIM}cancelled${OFF}`]; return; }
    log = refused;
    // Per worktree, so one that fails halfway does not cancel the others.
    for (const [r, steps] of plans) await runPlan(r.branch, steps);
  };

  process.stdout.write(ALT_ON);
  const restore = () => process.stdout.write(ALT_OFF);
  process.on("exit", restore);
  draw();

  for (;;) {
    const key = await nextKey();
    if (key === "q" || key === "\x03") break;
    // Both arrow encodings: `ESC [ B` from a terminal in normal cursor mode and `ESC O B` from one
    // in application mode, which a previous full-screen program can leave switched on.
    if (key === "\x1b[A" || key === "\x1bOA" || key === "k") at = (at - 1 + rows.length) % rows.length;
    else if (key === "\x1b[B" || key === "\x1bOB" || key === "j") at = (at + 1) % rows.length;
    else if (key === " ") {
      const path = rows[at]?.path;
      if (path) { if (selected.has(path)) selected.delete(path); else selected.add(path); }
    } else if (key === "r") {
      rows = build(parseWorktrees(sh(["git", "worktree", "list", "--porcelain"])));
      // Clamped: a worktree retired from another terminal shrinks the table, and an unclamped
      // cursor indexes past its end — `targets()` then returns nothing and s/x silently do nothing.
      at = Math.min(at, Math.max(0, rows.length - 1));
    } else if (key === "s" || key === "c" || key === "x") {
      await act(key === "s" ? "stop" : key === "c" ? "clean" : "retire");
      // The world moved: re-read it. The selection is keyed by PATH rather than by row index, so
      // what survives is what still exists rather than whatever now sits at that position.
      rows = build(parseWorktrees(sh(["git", "worktree", "list", "--porcelain"])));
      selected = new Set([...selected].filter((p) => rows.some((r) => r.path === p)));
      at = Math.min(at, Math.max(0, rows.length - 1));
    }
    draw();
  }
  // QUITTING HAS TO LET GO OF STDIN, or the process does not exit — it hangs, with the terminal
  // restored and nothing on screen to say why. A raw-mode async iterator holds a REFERENCED handle,
  // so the event loop stays alive with no work left to do.
  raw(false);
  await keys.return?.();
  stdin.pause();
  restore();
}

// ── Entry ────────────────────────────────────────────────────────────────────────────────────

const entries = parseWorktrees(sh(["git", "worktree", "list", "--porcelain"]));
if (entries.length === 0) {
  console.error("dev-ls: not inside a git repository with worktrees");
  process.exit(1);
}
const rows = build(entries);

if (PLAIN) {
  for (const line of renderTable(rows)) console.log(line);
  const n = notes(rows);
  if (n.length > 0) { console.log(""); for (const line of n) console.log(line); }
} else {
  await interactive(rows, entries[0]!.path);
}
