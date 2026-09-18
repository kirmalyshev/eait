// The check that keeps the two halves honest, with no database in sight.
//
// `PROMPT_KEYS` is what the code expects to be able to send. The `llm_prompts` check constraint is
// what the database will accept. They are written out by hand in two places ON PURPOSE — a
// constraint generated from the array could not disagree with it, and so could not catch the
// failure this test exists for: a seventh prompt added to the code, sent by `openrouter.ts`, and
// rejected by every attempt to store an override for it. That failure would otherwise surface as
// an admin's save returning 500 long after the change shipped.
//
// The contract suite proves the same thing against real Postgres. This one costs no database, so
// it fails on the machine of whoever adds the seventh prompt.

import { expect, test } from "bun:test";
import * as prompt from "./prompt.ts";
import { PROMPT_KEYS } from "./prompt.ts";
import { SCHEMA } from "../store.pg.ts";

/** The key list out of `alter table llm_prompts add constraint llm_prompts_key_check ...`. */
function keysInSchema(): string[] {
  expect(SCHEMA, "no `llm_prompts` table in the Postgres schema at all")
    .toContain("create table if not exists llm_prompts");
  const check = /add constraint llm_prompts_key_check\s*\n?\s*check \(key in \(([^)]*)\)\)/.exec(SCHEMA);
  expect(check, "`llm_prompts` has no `llm_prompts_key_check` constraint — any key would be accepted").not.toBeNull();
  return [...check![1]!.matchAll(/'([^']+)'/g)].map((m) => m[1]!);
}

test("every prompt key the code sends has a home in the database schema", () => {
  const inSchema = keysInSchema();
  for (const key of PROMPT_KEYS) {
    expect(
      inSchema,
      `prompt key "${key}" is in PROMPT_KEYS but not in the llm_prompts check constraint: the code sends it and the database would refuse to store an override for it`,
    ).toContain(key);
  }
});

test("the database schema accepts no key the code does not send", () => {
  for (const key of keysInSchema()) {
    expect(
      [...PROMPT_KEYS] as string[],
      `the llm_prompts check constraint accepts "${key}", which no code path sends: a row saved under it would be edited by an admin and read by nothing`,
    ).toContain(key);
  }
});

/**
 * The FOURTH edit a new prompt needs, and the one nothing else could name.
 *
 * `PROMPT_KEYS` and the check constraint are compared above; `PROMPT_DEFAULTS` is compared in
 * `prompt.stored.test.ts`. What none of them can see is a call site in `openrouter.ts` that still
 * IMPORTS the constant: that build typechecks, passes every test, sends the reviewed prose forever,
 * and silently ignores the row an admin saved. So the rule is the simple one — the transport reads
 * its prompts off `await prompts()` and holds no prompt constant at all.
 *
 * The names are DERIVED (every export whose string is one of the defaults) rather than listed, so a
 * seventh prompt is covered the day it is written, whatever it is called.
 */
test("the transport reads its prompts off the store, holding no prompt constant", async () => {
  const defaults = Object.values(prompt.PROMPT_DEFAULTS) as string[];
  const names = Object.entries(prompt)
    .filter(([, v]) => typeof v === "string" && defaults.includes(v))
    .map(([name]) => name);
  expect(names.length, "no exported constant holds any prompt default — this test has stopped looking at anything")
    .toBeGreaterThanOrEqual(PROMPT_KEYS.length);

  const source = await Bun.file(new URL("./openrouter.ts", import.meta.url)).text();
  for (const name of names) {
    expect(
      new RegExp(`\\b${name}\\b`).test(source),
      `openrouter.ts still names "${name}": that call site sends the compiled-in prose and ignores any stored override of it`,
    ).toBe(false);
  }
});
