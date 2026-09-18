// Read and edit the system prompts this instance sends.
//
//   bun src/scripts/prompts.ts list                  every prompt, with who wrote the live text
//   bun src/scripts/prompts.ts show coach            the live text, on stdout and nothing else
//   bun src/scripts/prompts.ts shipped coach         what THIS BUILD was written with
//   bun src/scripts/prompts.ts history coach         every version, newest first
//   bun src/scripts/prompts.ts set coach ./new.txt   save a file as the new live text
//   cat new.txt | bun src/scripts/prompts.ts set coach -
//   bun src/scripts/prompts.ts restore coach         save the build's own text back
//   ./dev prompts <command>                      the same, with the database URL worked out
//
// IT GOES THROUGH THE ENGINE, NOT THE TABLE. `savePrompt` is the same function the admin API calls,
// so the write gate, the version and the `admin` provenance are identical whichever surface a
// person uses. A CLI that wrote rows itself would be a second set of rules to keep in step, and the
// one it would drift from is the one that decides what a model may be told.
//
// It talks to POSTGRES DIRECTLY rather than to the admin API: an operator on the box has the
// database URL and may not have a bearer, and a prompt is exactly the thing you want to fix when
// the server is too unhappy to serve its own admin page.
//
// The database URL is taken from the environment, then from `.env.worktree`, then from `.env` — the
// order `seed.ts` uses, so `./dev` can be explicit without stopping this from standing alone. It is
// never printed with its credentials in it.

import { join } from "node:path";
import { postgresStore } from "../backend/store.pg.ts";
import { livePrompts, promptHistory, savePrompt } from "../backend/engine/prompts.ts";
import { PROMPT_KEYS, type PromptKey } from "../backend/llm/prompt.ts";
import type { EngineDeps } from "../backend/engine/deps.ts";
import { readEnvFile } from "./dev-env.ts";

const root = join(import.meta.dir, "..", "..");
const [command, key, source] = process.argv.slice(2);

const USAGE = `  bun src/scripts/prompts.ts <command> [prompt] [file]

  list                  every prompt: who wrote the live text, and when
  show <prompt>         the live text, alone on stdout
  shipped <prompt>      the text THIS BUILD was written with
  history <prompt>      every version, newest first
  set <prompt> <file>   save a file as the new live text ("-" reads stdin)
  restore <prompt>      save the build's own text back

  prompts: ${PROMPT_KEYS.join(", ")}`;

function die(message: string): never {
  console.error(`[eait] ${message}`);
  process.exit(1);
}

if (!command || command === "--help" || command === "-h") {
  console.log(USAGE);
  process.exit(command ? 0 : 1);
}

const needsKey = ["show", "shipped", "history", "set", "restore"];
if (needsKey.includes(command) && !key) die(`${command} needs a prompt.\n\n${USAGE}`);
if (key && !PROMPT_KEYS.includes(key as PromptKey)) {
  die(`"${key}" is not a prompt this server sends.\n       known: ${PROMPT_KEYS.join(", ")}`);
}

const worktreeEnv = readEnvFile(join(root, ".env.worktree"));
const backendEnv = readEnvFile(join(root, ".env"));
const databaseUrl =
  process.env.EAIT__BACKEND__DATABASE_URL || worktreeEnv.EAIT_DATABASE_URL || backendEnv.EAIT__BACKEND__DATABASE_URL || "";
if (!databaseUrl) {
  die(
    "no database.\n" +
    "       Run `./dev env` to generate this worktree's configuration, or pass EAIT__BACKEND__DATABASE_URL.",
  );
}

/** The text to save: a file, or stdin when the argument is `-`. */
async function textToSave(): Promise<string> {
  if (!source) die(`set needs a file, or "-" to read stdin.\n\n${USAGE}`);
  if (source === "-") return await new Response(Bun.stdin.stream()).text();
  const file = Bun.file(source);
  if (!await file.exists()) die(`no such file: ${source}`);
  return await file.text();
}

const store = await postgresStore(databaseUrl);
// Only the store is real. The CLI reaches two engine functions and neither looks at anything else,
// so the rest of `EngineDeps` is deliberately absent rather than faked into something that could be
// called by accident.
const deps = { store } as unknown as EngineDeps;

try {
  if (command === "list") {
    const rows = await livePrompts(deps);
    const width = Math.max(...rows.map((r) => r.key.length));
    for (const row of rows) {
      const when = row.updated_at ? new Date(row.updated_at).toISOString().slice(0, 16).replace("T", " ") : "—";
      // The one column that matters: a prompt marked `admin` is one no deploy will update.
      const drifted = row.source === "admin" && row.text !== row.shipped ? "  (the build has since shipped different text)" : "";
      console.log(
        `  ${row.key.padEnd(width)}  v${String(row.version).padEnd(3)} ${row.source.padEnd(7)} ${when}  ${row.text.length} chars${drifted}`,
      );
    }
  } else if (command === "show") {
    // Alone on stdout, with no decoration, so it pipes into a file and back through `set`.
    const row = (await livePrompts(deps)).find((r) => r.key === key)!;
    console.log(row.text);
  } else if (command === "shipped") {
    const row = (await livePrompts(deps)).find((r) => r.key === key)!;
    console.log(row.shipped);
  } else if (command === "history") {
    const revisions = await promptHistory(deps, key);
    if (!revisions || revisions.length === 0) {
      console.log(`  no stored revision of ${key} — the server is sending the build's own text.`);
    } else {
      for (const r of revisions) {
        console.log(`  v${r.version}  ${r.source.padEnd(7)}  ${new Date(r.updated_at).toISOString()}  ${r.text.length} chars`);
      }
    }
  } else if (command === "set" || command === "restore") {
    const text = command === "restore"
      ? (await livePrompts(deps)).find((r) => r.key === key)!.shipped
      : await textToSave();
    const result = await savePrompt(deps, key, text);
    if (!result.ok) {
      // The errors are the write gate's own words. Printed one per line because a refusal usually
      // names an invisible character, and a reader needs to be told which one.
      for (const e of result.errors) console.error(`[eait] ${e}`);
      process.exit(1);
    }
    // A restore is a SAVE, and saying so matters: it puts the build's words back but the row is
    // still yours, so the next deploy leaves it alone. Somebody who reads "restored" and expects to
    // be back on the shipped track would be wrong about what happens next.
    console.log(command === "restore"
      ? `  ${key} is back to the text this build ships, saved as version ${result.version}. The row is still yours — a later deploy will not update it. Delete its rows to hand it back to the shipper.`
      : `  ${key} saved as version ${result.version}. It is yours now — no deploy will change it.`);
  } else {
    die(`unknown command: ${command}\n\n${USAGE}`);
  }
} finally {
  await store.close();
}
