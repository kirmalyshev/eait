// The compose project name must survive the caller's environment. `docker-compose.yml` pins
// `name: eait-dev` so every worktree drives the ONE shared Postgres container — but an exported
// COMPOSE_PROJECT_NAME outranks `name:`, and a line in `.env` does too. A caller carrying either
// makes `db.sh up` run under that other project: `refuse_foreign_container` still passes (the
// container IS eait-dev's) and `up` then dies on Docker's raw container-name conflict instead of
// reusing what is running.
//
// These are not static assertions of a string in the file: each runs `db.sh up` with a stub
// `docker` first on PATH, and reads back the project name every `docker compose` call saw.

import { test, expect, describe } from "bun:test";
import { mkdtempSync, writeFileSync, readFileSync, rmSync, chmodSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "../..");

// A `docker` that answers nothing and exits 0 is enough for `db.sh up` to complete: pg_isready
// is ready at once, `-lqt` lists no databases, and every write is a no-op. What it records is
// the point: COMPOSE_PROJECT_NAME as each `docker compose` invocation received it.
function runDbUp(composeProject: string | undefined): { status: number; seen: string[]; stderr: string } {
  const dir = mkdtempSync(join(tmpdir(), "eait-db-sh-"));
  const capture = join(dir, "seen");
  writeFileSync(
    join(dir, "docker"),
    '#!/bin/sh\n[ "$1" = "compose" ] && echo "${COMPOSE_PROJECT_NAME-unset}" >> "$EAIT_DB_TEST_CAPTURE"\ncat >/dev/null 2>&1\nexit 0\n',
  );
  chmodSync(join(dir, "docker"), 0o755);
  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    PATH: `${dir}:${process.env.PATH}`,
    EAIT_DB_TEST_CAPTURE: capture,
  };
  if (composeProject === undefined) delete env.COMPOSE_PROJECT_NAME;
  else env.COMPOSE_PROJECT_NAME = composeProject;
  try {
    const r = Bun.spawnSync({
      cmd: ["sh", "src/scripts/db.sh", "up"],
      cwd: ROOT,
      env,
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    });
    return {
      status: r.exitCode,
      seen: existsSync(capture) ? readFileSync(capture, "utf8").trim().split("\n") : [],
      stderr: r.stderr.toString(),
    };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("the compose project", () => {
  test("an exported COMPOSE_PROJECT_NAME cannot rename the pinned project", () => {
    const r = runDbUp("eait-main");
    expect({ status: r.status, stderr: r.stderr }).toEqual({ status: 0, stderr: "" });
    expect(r.seen.length).toBeGreaterThan(0);
    expect([...new Set(r.seen)]).toEqual(["eait-dev"]);
  });

  test("a caller without the variable gets the same project", () => {
    const r = runDbUp(undefined);
    expect(r.status).toBe(0);
    expect(r.seen.length).toBeGreaterThan(0);
    expect([...new Set(r.seen)]).toEqual(["eait-dev"]);
  });

  // THE TWO FILES NAME ONE PROJECT. The pin in db.sh exists because `name:` alone loses to the
  // environment; if they ever name different things, this is the test that says so.
  test("the pin in db.sh names the same project docker-compose.yml pins", () => {
    const sh = readFileSync(new URL("./db.sh", import.meta.url), "utf8");
    const yml = readFileSync(new URL("../../docker-compose.yml", import.meta.url), "utf8");
    expect({
      pinned: yml.match(/^name: (\S+)/m)?.[1],
      forced: sh.match(/^export COMPOSE_PROJECT_NAME=(\S+)/m)?.[1],
    }).toEqual({ pinned: "eait-dev", forced: "eait-dev" });
  });
});
