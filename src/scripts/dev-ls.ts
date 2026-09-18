// Every worktree of this repo on this machine, and what each one is running.
//
//   bun src/scripts/dev-ls.ts            interactive on a terminal (or: ./dev ls)
//   bun src/scripts/dev-ls.ts --plain    the table, printed once, for a pipe
//
// ONE QUESTION THIS ANSWERS AND `./dev status` CANNOT: which OTHER checkout is holding the port you
// wanted. A backend left running in a worktree you have since moved on from is invisible from
// inside the one you are in — the symptom is `./dev up` refusing a port, with nothing saying who
// has it.
//
// Ported from the private monorepo that carries this repository as a submodule, minus the four
// columns for services this repo has none of (Metro, the landing page, an iOS build, a Maestro
// run) and the simulator machinery under them. The layout, the state vocabulary and the key map
// are deliberately the same, because the two views are read by the same person on the same day.
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

/** `up` and `starting` are ours and live; `stale` is our file naming somebody else; `other` is a port we do not hold. */
type ServiceState = "up" | "starting" | "stale" | "other" | "down";

const PLAIN = process.argv.includes("--plain") || !process.stdout.isTTY;
const COLOR = (Boolean(process.stdout.isTTY) || Boolean(process.env.FORCE_COLOR)) && !process.env.NO_COLOR;
const sgr = (code: string) => (COLOR ? code : "");
const REVERSE = sgr("\x1b[7m");
const DIM = sgr("\x1b[2m");
const RESET = sgr("\x1b[0m");
const BOLD = sgr("\x1b[1m");
const RED = sgr("\x1b[31m");
const GREEN = sgr("\x1b[32m");
const YELLOW = sgr("\x1b[33m");
const MAGENTA = sgr("\x1b[35m");
/**
 * Alternate-row tint: a PALETTE entry, so it is whatever the user's theme calls bright black rather
 * than a shade chosen here. Most themes make that a grey a little off the background, which is what
 * a stripe wants. A light theme that maps it dark would make a heavy bar instead, so `EAIT_NO_ZEBRA`
 * turns it off without giving up the rest of the colour.
 */
const ZEBRA = process.env.EAIT_NO_ZEBRA ? "" : sgr("\x1b[100m");

/** What each service state looks like. `down` is the quiet one: a port with nothing on it. */
const STATE_STYLES: Record<ServiceState, string> = {
  up: GREEN,
  starting: YELLOW,
  stale: RED,
  other: MAGENTA,
  down: DIM,
};

const HOME_CURSOR = "\x1b[H";
const CLEAR_BELOW = "\x1b[J";
const ALT_ON = "\x1b[?1049h\x1b[?25l";
const ALT_OFF = "\x1b[?25h\x1b[?1049l";

function sh(cmd: string[], cwd?: string): string | null {
  const r = Bun.spawnSync(cwd ? { cmd, cwd, stdout: "pipe", stderr: "pipe" } : { cmd, stdout: "pipe", stderr: "pipe" });
  return r.success ? r.stdout.toString() : null;
}

/** pid → the command it is running. One `ps` for the whole machine rather than one per pidfile. */
function processCommands(): Map<number, string> {
  const out = new Map<number, string>();
  for (const line of (sh(["ps", "-eo", "pid=,command="]) ?? "").split("\n")) {
    const m = /^\s*(\d+)\s+(.*)$/.exec(line);
    if (m) out.set(Number(m[1]), m[2]!);
  }
  return out;
}

/** pid → its working directory, which is what tells two worktrees' identical commands apart. */
function processCwds(pids: number[]): Map<number, string> {
  const out = new Map<number, string>();
  if (pids.length === 0) return out;
  const text = sh(["lsof", "-a", "-d", "cwd", "-p", pids.join(","), "-Fpn"]) ?? "";
  let pid: number | null = null;
  for (const line of text.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    else if (line.startsWith("n") && pid !== null && !out.has(pid)) out.set(pid, line.slice(1));
  }
  return out;
}

/** Every TCP port something is LISTENing on, machine-wide. */
function listeningPorts(): Set<number> {
  const out = new Set<number>();
  for (const line of (sh(["lsof", "-nP", "-iTCP", "-sTCP:LISTEN"]) ?? "").split("\n")) {
    const m = /:(\d+)\s*\(LISTEN\)/.exec(line);
    if (m) out.add(Number(m[1]));
  }
  return out;
}

interface Row {
  path: string;
  branch: string;
  slot: number | null;
  exists: boolean;
  ports: Record<Service, number | undefined>;
  states: Record<Service, ServiceState>;
}

const NEEDLE: Record<Service, RegExp> = {
  backend: /src\/backend\/index\.ts/,
  web: /src\/frontend\/server\/index\.ts/,
};

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
  const commands = processCommands();
  const listening = listeningPorts();
  const pids: number[] = [];
  for (const e of entries) for (const s of SERVICES) {
    const pid = pidIn(e.path, s);
    if (pid !== null) pids.push(pid);
  }
  const cwds = processCwds(pids);

  return entries.map((e, i) => {
    const slot = slotOf(e.path, i === 0);
    const ports = portsOf(e.path, slot, e.branch);
    const states = {} as Record<Service, ServiceState>;
    for (const s of SERVICES) {
      const pid = pidIn(e.path, s);
      const port = ports[s];
      const bound = port !== undefined && listening.has(port);
      if (pid === null) { states[s] = bound ? "other" : "down"; continue; }
      const command = commands.get(pid) ?? null;
      const dir = cwds.get(pid) ?? null;
      // ALL THREE, the same question `dev.sh` asks: alive, running THIS service, and running it out
      // of THIS worktree. A pidfile alone is a recycled pid waiting to be mistaken for a service.
      const ours = command !== null && NEEDLE[s].test(command) && dir !== null
        && (dir === e.path || dir.startsWith(e.path + "/"));
      states[s] = ours ? (bound ? "up" : "starting") : "stale";
    }
    return { path: e.path, branch: e.branch, slot, exists: existsSync(e.path), ports, states };
  });
}

/**
 * Whether nothing of OURS is live here — the question both the headline count and the stop
 * confirmation ask.
 *
 * `up` and `starting` only. `other` is a port held by a process this worktree did not start, so it
 * is not ours to count as running and not ours to stop. `stale` is a leftover file, and clearing
 * one needs no warning.
 */
const isIdle = (r: Row) => !Object.values(r.states).some((s) => s === "up" || s === "starting");

export function cell(port: number | undefined, state: ServiceState): string {
  if (port === undefined) return "—";
  return state === "down" ? String(port) : `${port} ${state}`;
}

/**
 * Home-relative and, past `limit`, elided in the MIDDLE.
 *
 * Every path here shares a prefix that says nothing and ends in the part that names the worktree, so
 * cutting the tail is the one thing that must not happen: `~/.herdr/worktrees/eait/feature-x` and
 * `…/feature-y` differ only there.
 */
export function shortPath(path: string, limit = Infinity): string {
  const home = process.env.HOME;
  let out = home && path.startsWith(home + "/") ? "~" + path.slice(home.length) : path;
  if (out.length <= limit) return out;
  const parts = out.split("/").filter((p) => p !== "");
  if (parts.length <= 4) return out;
  return [...parts.slice(0, 2), "…", ...parts.slice(-2)].join("/");
}

interface Cursor { at: number; selected: Set<number> }

export function render(rows: Row[], cwd: string, cursor?: Cursor, pathWidth = 44): string {
  const interactive = cursor !== undefined;
  const header = [...(interactive ? [" "] : []), "#", "branch", ...SERVICES, "worktree"];
  // Text and style are kept apart until the widths are known: padding a string that already carries
  // escape codes counts them as characters, and every column after it drifts.
  const body = rows.map((r, i) => {
    const idle = isIdle(r);
    return [
      ...(interactive ? [{ text: cursor!.selected.has(i) ? "✓" : " ", style: GREEN }] : []),
      { text: r.slot === null ? "·" : String(r.slot), style: r.slot === null ? DIM : "" },
      // A worktree git still lists whose directory is gone: the branch column is the only place
      // that can say so, and printing its name would make it look like an ordinary idle checkout.
      r.exists
        ? { text: r.branch, style: r.path === cwd ? BOLD : idle ? DIM : "" }
        : { text: "worktree gone", style: RED },
      ...SERVICES.map((s) => ({ text: cell(r.ports[s], r.states[s]), style: STATE_STYLES[r.states[s]] })),
      { text: shortPath(r.path, pathWidth), style: DIM },
    ];
  });
  const widths = header.map((h, i) => Math.max(h.length, ...body.map((r) => r[i]!.text.length)));
  // THE LAST COLUMN IS NOT PADDED. The plain path is what agents and scripts read, and a row that
  // ends in a run of spaces is whitespace an assertion or a diff trips over.
  const line = (cells: { text: string; style: string }[], marker: string, styled = true) =>
    marker + cells
      .map((c, i) => {
        const text = i === cells.length - 1 ? c.text : c.text.padEnd(widths[i]!);
        return styled && c.style ? c.style + text + RESET : text;
      })
      .join("  ");

  // The marker column says which row you are standing in, which is the one question a list of
  // near-identical paths cannot answer on its own. The cursor is drawn in reverse video rather than
  // with a second marker character, so it cannot be mistaken for the `›`.
  //
  // ZEBRA IS A PALETTE BACKGROUND. `dim` is invisible here: most cells in an idle row are ALREADY
  // dim — the em dashes, the path, the slot — so dimming the row again changes nothing. It is
  // re-applied after every nested reset, or a coloured cell would end the stripe mid-row.
  const stripe = (text: string) =>
    ZEBRA === "" ? text : ZEBRA + text.replaceAll(RESET, RESET + ZEBRA) + "    " + RESET;
  return [
    DIM + line(header.map((h) => ({ text: h, style: "" })), "  ") + RESET,
    ...rows.map((r, i) => {
      const marker = r.path === cwd ? "› " : "  ";
      // THE CURSOR ROW IS DRAWN UNSTYLED. Reverse video swaps foreground and background, so a cell
      // that carries a colour becomes a BLOCK of that colour — a magenta `other` cell would paint a
      // magenta bar across the highlighted row. One attribute for the whole row.
      if (cursor?.at === i) return REVERSE + line(body[i]!, marker, false) + "  " + RESET;
      const text = line(body[i]!, marker);
      return interactive && i % 2 === 1 ? stripe(text) : text;
    }),
  ].join("\n");
}

function facts(rows: Row[]): [string, string] {
  const running = rows.filter((r) => !isIdle(r)).length;
  const stale = rows.filter((r) => Object.values(r.states).includes("stale")).length;
  const other = rows.filter((r) => Object.values(r.states).includes("other")).length;
  const gone = rows.filter((r) => !r.exists).length;
  const headline = [
    `${BOLD}eait${RESET}`,
    `${rows.length} worktrees`,
    `${running} running`,
    ...(stale ? [`${YELLOW}${stale} with a stale pidfile${RESET}`] : []),
    ...(other ? [`${MAGENTA}${other} with a port held by something else${RESET}`] : []),
    ...(gone ? [`${RED}${gone} gone${RESET}`] : []),
  ].join(" · ");
  const main = rows.find((r) => r.slot === 0)?.path;
  const claimed = new Set(rows.filter((r) => r.slot !== null).map((r) => r.slot)).size;
  const detail = [
    ...(main ? [`main copy ${shortPath(main, 60)}`] : []),
    `${claimed} slot${claimed === 1 ? "" : "s"} claimed`,
  ].join(" · ");
  return [headline, detail];
}

// ── Acting on a row ──────────────────────────────────────────────────────────────────────────

interface Step { label: string; cmd: string[]; cwd: string }

/** The directory stands but its `.git` is gone — git refuses to remove such an entry by name. */
const isHusk = (r: Row) => r.exists && !existsSync(join(r.path, ".git"));

/** What the TARGET worktree can actually run, which is a property of its checkout, not of ours. */
function capabilitiesOf(path: string): { hasDev: boolean; hasEnvToClean: boolean } {
  return {
    // `.dev/` as well as `dev`: the directory is created by `up`, so its absence means nothing was
    // ever started here and there is nothing for a stop step to do.
    hasDev: existsSync(join(path, "dev")) && existsSync(join(path, ".dev")),
    hasEnvToClean: existsSync(join(path, "src", "scripts", "dev-env.ts")) &&
      (existsSync(join(path, ".env.worktree")) || existsSync(join(path, SLOT_FILE))),
  };
}

/** null when git could not answer — which is NOT the same as a clean tree. */
function dirtyCount(path: string): number | null {
  const out = sh(["git", "-C", path, "status", "--porcelain"]);
  if (out === null) return null;
  const t = out.trim();
  return t === "" ? 0 : t.split("\n").length;
}

function stopPlan(r: Row): Step[] {
  return capabilitiesOf(r.path).hasDev
    ? [{ label: "stop the stack", cmd: [join(r.path, "dev"), "down"], cwd: r.path }]
    : [];
}

function cleanPlan(r: Row): Step[] {
  return capabilitiesOf(r.path).hasEnvToClean
    ? [{ label: "remove its env files", cmd: ["bun", "src/scripts/dev-env.ts", "clean"], cwd: r.path }]
    : [];
}

/** This worktree's own database, or null when it has never been given one. Never a default. */
function dbNameOf(path: string): string | null {
  return readEnvFile(join(path, ".env.worktree")).EAIT_DB_NAME ?? null;
}

/**
 * `x`: stop, drop the database, give the env files back, remove the worktree.
 *
 * THE THREE ACTIONS NEST BY CALLING EACH OTHER, not by resembling each other, so a fix to what
 * stopping or cleaning means reaches retire the same day and cannot reach only two of the three.
 *
 * `dbName` IS NULL FOR A WORKTREE THAT WAS NEVER DERIVED, and the drop step is then left out
 * entirely rather than run against a default. `db.sh` falls back to `eait` without a
 * `.env.worktree` to read — correct for slot 0, which IS that database, and catastrophic here.
 */
function retirePlan(r: Row, here: string): Step[] {
  // A worktree whose directory is gone has nothing to stop, drop or clean, and git will not remove
  // a registration whose tree is missing without being told to force it. One step, aimed at this
  // entry — not `git worktree prune`, which would also clear everyone else's.
  if (!r.exists) {
    return [{ label: "clear the stale worktree entry", cmd: ["git", "worktree", "remove", "--force", r.path], cwd: here }];
  }
  const db = dbNameOf(r.path);
  return [
    ...stopPlan(r),
    // BEFORE `clean`, which removes the `.env.worktree` that names the database.
    ...(db === null ? [] : [{ label: `drop the database ${db}`, cmd: ["sh", "src/scripts/db.sh", "drop", "--yes"], cwd: r.path }]),
    ...cleanPlan(r),
    { label: "remove the worktree", cmd: ["git", "worktree", "remove", r.path], cwd: here },
  ];
}

/**
 * Why this row may not be retired, or null when it may.
 *
 * This is the design rather than a precaution: retire ends in `git worktree remove` and the
 * database drop before it is irreversible. Dirty is refused because a worktree with uncommitted
 * work is the one case where the loss is unrecoverable and invisible from this table.
 */
function retireBlocker(r: Row, mainPath: string, cwd: string): string | null {
  if (r.path === mainPath) return "it is the main worktree";
  if (r.path === cwd || cwd.startsWith(r.path + "/")) return "you are standing in it";
  // A husk IS a refusal: `git worktree remove --force` fails validation while the directory stands
  // ("'<path>/.git' does not exist"), and deleting it is not a step this view can run — nothing
  // here runs anything that is not the target's own command.
  if (isHusk(r)) return "its .git file is gone, so git cannot remove it; delete the directory by hand and x clears the entry";
  // A missing directory is NOT a refusal: clearing that entry is the one useful thing left.
  if (!r.exists) return null;
  // AN UNANSWERABLE GUARD IS A REFUSAL, never a pass: "git did not say" and "nothing to lose"
  // cannot resolve the same way when the next step drops a database and removes a directory.
  const dirty = dirtyCount(r.path);
  if (dirty === null) return "its git status could not be read";
  if (dirty > 0) return `it has ${dirty} uncommitted change${dirty === 1 ? "" : "s"}`;
  return null;
}

/** A plan as the confirmation shows it: the path folded to `<worktree>` so the commands read. */
function planLines(path: string, steps: Step[]): string[] {
  // Width from the labels present, not a constant: `drop the database <name>` is as long as the
  // name, and a fixed column lets the longer ones push their command out of line.
  const w = Math.max(0, ...steps.map((s) => s.label.length));
  return [
    `<worktree> = ${path}`,
    ...steps.map((s) => `  ${s.label.padEnd(w)}  ${s.cmd.join(" ").replaceAll(path, "<worktree>")}`),
  ];
}

interface Modal { question: string; detail: string[] }

// ── Interactive ──────────────────────────────────────────────────────────────────────────────

async function interactive(initial: Row[], mainPath: string): Promise<void> {
  const cwd = process.cwd();
  let rows = initial;
  let at = 0;
  let selected = new Set<string>();
  let log: string[] = [];
  let modal: Modal | null = null;

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

  const reload = () => {
    rows = build(parseWorktrees(sh(["git", "worktree", "list", "--porcelain"]) ?? ""));
    // Clamped: a worktree retired from another terminal shrinks the table, and an unclamped cursor
    // indexes past its end — `targets()` then returns nothing and s/c/x silently do nothing at all.
    at = Math.min(at, Math.max(0, rows.length - 1));
    // The selection is kept by PATH — rows are re-read — so what survives is what still exists
    // rather than whatever now sits at that position.
    selected = new Set([...selected].filter((p) => rows.some((r) => r.path === p)));
  };

  const frame = (): string => {
    const height = process.stdout.rows ?? 40;
    const width = process.stdout.columns ?? 120;
    const marks = new Set(rows.flatMap((r, i) => (selected.has(r.path) ? [i] : [])));
    // The path column gives up what a narrow terminal cannot fit: the branch already names the
    // worktree, and squeezing the service columns would hide the thing the table is for.
    const table = render(rows, cwd, { at, selected: marks }, Math.max(24, width - 46));
    const [headline, detail] = facts(rows);
    const top = [headline, `${DIM}${detail}${RESET}`, "", table, ""];
    const key = (k: string, label: string) => `${BOLD}${k}${RESET} ${DIM}${label}${RESET}`;
    const footer = [
      key("↑↓/jk", "Move"), key("space", "Select"), key("s", "Stop"),
      key("c", "Clean"), key("x", "Retire"), key("r", "Refresh"), key("q", "Quit"),
    ].join(`${DIM}  ·  ${RESET}`);
    // What is left after the header block, the table, two rules and the footer.
    const paneHeight = Math.max(4, height - (top.length - 1) - table.split("\n").length - 4);

    // A QUESTION AND ITS PROMPT ARE NOT DETAIL. Building the modal as one list and slicing it to the
    // pane cuts from the END — the confirm line first, then the last worktree's steps — so on a
    // short terminal you are asked to approve a plan whose database-drop step is off-screen, with
    // no visible prompt, and enter still confirms it. The frame is fixed; the DETAIL is what gives.
    const pane = modal
      ? (() => {
        const head = [`${BOLD}${RED}${modal.question}${RESET}`, ""];
        const foot = ["", `${BOLD}[enter]${RESET} or ${BOLD}[y]${RESET} confirm   ${DIM}esc, n, or any other key cancels${RESET}`];
        const room = Math.max(1, paneHeight - head.length - foot.length);
        const d = modal.detail.length > room
          ? [...modal.detail.slice(0, room - 1), `… ${modal.detail.length - (room - 1)} more lines — enlarge the terminal to read the whole plan`]
          : modal.detail;
        return [...head, ...d.map((l) => `${DIM}${l}${RESET}`), ...foot];
      })()
      : log.slice(-paneHeight);

    // Padded to a fixed height so the footer sits on the same line whatever the pane holds — a
    // footer that walks up and down the screen as output arrives is one you stop reading.
    const body = modal ? pane : pane.slice(0, paneHeight);
    while (body.length < paneHeight) body.push("");

    const rule = `${DIM}${"─".repeat(Math.min(width, 100))}${RESET}`;
    return [...top, rule, ...body, rule, footer].join("\n") + "\n";
  };

  // HOME plus a per-line erase, not a full clear: clearing the screen and redrawing it flickers,
  // and on a slow pipe you see the blank.
  const draw = () => process.stdout.write(HOME_CURSOR + frame().replaceAll("\n", "\x1b[K\n") + CLEAR_BELOW);

  /** Everything an action applies to: the selection, or the row under the cursor. */
  const targets = (): Row[] => {
    const picked = rows.filter((r) => selected.has(r.path));
    const here = rows[at];
    return picked.length > 0 ? picked : here ? [here] : [];
  };

  const ask = async (question: string, detail: string[]): Promise<boolean> => {
    modal = { question, detail };
    draw();
    const k = await nextKey();
    modal = null;
    return k === "\r" || k === "\n" || k === "y" || k === "Y";
  };

  const runPlan = async (name: string, steps: Step[]): Promise<void> => {
    for (const step of steps) {
      const r = Bun.spawnSync({ cmd: step.cmd, cwd: step.cwd, stdout: "pipe", stderr: "pipe" });
      if (r.success) { log.push(`${GREEN}✓${RESET} ${name}: ${step.label}`); continue; }
      // STOPS AT ITS OWN FIRST FAILURE. The recoverable half of a sequence that ends in something
      // irreversible must not run when an earlier step did not do what it said.
      const why = (r.stderr.toString() || r.stdout.toString()).trim().split("\n").pop() ?? "failed";
      log.push(`${RED}✗${RESET} ${name}: ${step.label} — ${why}`);
      return;
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
        if (why) { refused.push(`${YELLOW}·${RESET} ${r.branch}: ${why}`); continue; }
      }
      const steps = kind === "stop" ? stopPlan(r) : kind === "clean" ? cleanPlan(r) : retirePlan(r, mainPath);
      if (steps.length > 0) plans.push([r, steps]);
    }
    if (plans.length === 0) { log = refused.length > 0 ? refused : [`${DIM}nothing to do${RESET}`]; return; }
    const verb = kind === "retire" ? "Retire" : kind === "stop" ? "Stop" : "Clean";
    const tail = kind === "retire" ? " This cannot be undone." : "";
    const detail = [...refused.map((l) => l.replace(/\x1b\[[0-9;]*m/g, "")), ...(refused.length ? [""] : []),
      ...plans.flatMap(([r, st]) => planLines(r.path, st))];
    if (!await ask(`${verb} ${plans.map(([r]) => r.branch).join(", ")}?${tail}`, detail)) {
      log = [`${DIM}cancelled${RESET}`];
      return;
    }
    log = refused;
    // Per worktree, so one that fails halfway does not cancel the others.
    for (const [r, steps] of plans) await runPlan(r.branch, steps);
  };

  process.stdout.write(ALT_ON);
  const restore = () => process.stdout.write(ALT_OFF);
  process.on("exit", restore);
  // The keys bold, their descriptions short: this line is read once, and what has to survive that
  // reading is which key does what — not a sentence about each.
  const hint = (k: string, what: string) => `${BOLD}${k}${RESET} ${DIM}${what}${RESET}`;
  log.push([hint("space", "selects"), hint("s", "stops"), hint("c", "gives env files back"), hint("x", "retires")].join(`${DIM}  ·  ${RESET}`));
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
    } else if (key === "r") reload();
    else if (key === "s" || key === "c" || key === "x") {
      await act(key === "s" ? "stop" : key === "c" ? "clean" : "retire");
      reload(); // The world moved: re-read it.
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

const entries = parseWorktrees(sh(["git", "worktree", "list", "--porcelain"]) ?? "");
if (entries.length === 0) {
  console.error("dev-ls: not inside a git repository with worktrees");
  process.exit(1);
}
const rows = build(entries);

if (PLAIN) console.log(render(rows, process.cwd()));
else await interactive(rows, entries[0]!.path);
