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
