import { describe, expect, test } from "bun:test";
import { parseArgv, type ArgvSpec } from "./argv.ts";

const SPEC: ArgvSpec = { valued: ["photo", "name", "dir"], boolean: ["dry-run", "force", "foods"] };
const parse = (...argv: string[]) => parseArgv(argv, SPEC);

describe("parseArgv — the happy shapes", () => {
  test("valued flags, boolean flags and positionals in any order", () => {
    const r = parse("--photo", "p.jpg", "--name", "n", "--dry-run", "a: 1", "b: 2");
    expect(r.values).toEqual({ photo: "p.jpg", name: "n" });
    expect([...r.flags]).toEqual(["dry-run"]);
    expect(r.positional).toEqual(["a: 1", "b: 2"]);
  });

  test("a positional before any flag is kept", () => {
    expect(parse("a: 1", "--photo", "p.jpg").positional).toEqual(["a: 1"]);
  });

  test("a boolean flag directly before a positional does not consume it", () => {
    expect(parse("--force", "a: 1").positional).toEqual(["a: 1"]);
  });

  test("no arguments at all is not an error here — the caller decides what is required", () => {
    expect(parse()).toEqual({ values: {}, flags: new Set(), positional: [] });
  });

  test("a repeated boolean flag is harmless", () => {
    expect([...parse("--force", "--force").flags]).toEqual(["force"]);
  });
});

describe("parseArgv — every malformed shape is an error, never a silent drop", () => {
  // The defect this module exists to kill: the previous hand-rolled parser used indexOf for flag
  // values and a separate filter for positionals, so the two passes could disagree and a weighed
  // component would vanish from the meal while the script exited 0 with wrong ground truth.

  test("an unknown flag is rejected — a typo must not be silently ignored", () => {
    // `--dryrun` for `--dry-run` previously wrote a real fixture while the user believed otherwise.
    expect(() => parse("--dryrun", "a: 1")).toThrow(/unknown flag --dryrun/);
  });

  test("a valued flag with no value is rejected", () => {
    expect(() => parse("--photo")).toThrow(/--photo was given with no value/);
  });

  test("a valued flag followed by another flag is rejected, not given that flag as its value", () => {
    expect(() => parse("--photo", "--force")).toThrow(/--photo was given with no value/);
  });

  test("a repeated valued flag is rejected rather than silently taking the first", () => {
    // indexOf took the first occurrence while the positional filter skipped the token after BOTH,
    // so `--name a --name "rice: 210"` dropped the rice from the meal without a word.
    expect(() => parse("--name", "a", "--name", "b")).toThrow(/--name was given twice/);
  });

  test("a bare -- ends flag parsing, so a positional may start with dashes", () => {
    const r = parse("--force", "--", "--photo", "-x: 5");
    expect([...r.flags]).toEqual(["force"]);
    expect(r.positional).toEqual(["--photo", "-x: 5"]);
    expect(r.values).toEqual({});
  });

  test("a single-dash token is a positional, not a flag", () => {
    expect(parse("-x").positional).toEqual(["-x"]);
  });

  test("an empty flag name is rejected", () => {
    expect(() => parse("--=", "x")).toThrow(/unknown flag/);
  });
});
