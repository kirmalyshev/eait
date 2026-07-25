// Argument parsing for the dev scripts (`scripts/*.ts`). Pure — no process.argv, no exiting, no
// I/O. Lives under src/ so `bun test` covers it: the scripts themselves are manual and unbilled,
// but a parser bug there writes wrong ground truth and exits 0, which nothing downstream catches.
//
// WHY A MODULE. `scripts/add-fixture.ts` originally parsed argv twice — `indexOf` to find each
// flag's value, and a separate `filter` to collect the positional weighed components. Two
// independent algorithms over one array can disagree, and every disagreement lost a component
// silently:
//
//   --dir "cucumber: 100" "chicken breast: 180"   the cucumber became the output directory
//   --name a --name "rice, cooked: 210"           the rice vanished; indexOf had already taken "a"
//   --dryrun                                      unknown flag ignored; a real fixture was written
//
// Each exited 0 with a plausible, wrong fixture on disk. One left-to-right pass that owns both
// jobs cannot disagree with itself, and anything it does not understand is an error.

/** Which flags take a following value, and which stand alone. Anything else is unknown. */
export interface ArgvSpec {
  valued: readonly string[];
  boolean: readonly string[];
}

export interface ParsedArgv {
  /** `--name x` → `{ name: "x" }`. */
  values: Record<string, string>;
  /** Bare flags that were present. */
  flags: Set<string>;
  /** Everything that was not a flag or a flag's value, in order. */
  positional: string[];
}

/**
 * One left-to-right pass over `argv` (already sliced past the interpreter and script path).
 *
 * Throws on anything ambiguous — unknown flag, missing value, repeated valued flag. The caller
 * turns that into an exit code; this stays pure so it can be tested without spawning a process.
 * A bare `--` ends flag parsing, so a positional is still expressible even if it starts with `--`.
 */
export function parseArgv(argv: readonly string[], spec: ArgvSpec): ParsedArgv {
  const valued = new Set(spec.valued);
  const boolean = new Set(spec.boolean);
  const values: Record<string, string> = {};
  const flags = new Set<string>();
  const positional: string[] = [];

  let flagsEnded = false;
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]!;
    if (flagsEnded || !token.startsWith("--")) {
      positional.push(token);
      continue;
    }
    if (token === "--") {
      flagsEnded = true;
      continue;
    }
    const key = token.slice(2);
    if (boolean.has(key)) {
      // Repeating a boolean says the same thing twice; unlike a repeated value it cannot hide data.
      flags.add(key);
      continue;
    }
    if (!valued.has(key)) throw new Error(`unknown flag ${token}`);
    if (key in values) {
      // Rejected rather than last-wins or first-wins: whichever is discarded, the user believes
      // both were read, and for a valued flag the discarded token is often a weighed component.
      throw new Error(`${token} was given twice`);
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${token} was given with no value`);
    }
    values[key] = value;
    i++;
  }
  return { values, flags, positional };
}
