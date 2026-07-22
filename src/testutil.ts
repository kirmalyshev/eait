// Test-only Postgres helpers: one throwaway database per test against the shared dev server
// (sh scripts/db.sh up), dropped in afterAll. Never imported by runtime code and excluded from
// the docker image via .dockerignore.
//
// The name base comes from PGDATABASE_TEST (compose-env.sh writes eait_test_<branch>), so test
// runs in parallel worktrees never touch each other's databases; the random suffix isolates
// tests within a run exactly like the old one-sqlite-file-per-test fixture did.

import { SQL } from "bun";
import { openDb, type Db } from "./db.ts";

const env = process.env;
const base = {
  host: env.PGHOST?.trim() || "127.0.0.1",
  port: Number(env.PGPORT) || 5439,
  user: env.PGUSER?.trim() || "eait",
  password: env.PGPASSWORD?.trim() || "eait",
};
const testBase = env.PGDATABASE_TEST?.trim() || "eait_test";

const created: string[] = [];
const handles: Db[] = [];

/** A unique test database name, registered for afterAll cleanup. */
export function freshTestName(): string {
  const name = `${testBase}_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
  created.push(name);
  return name;
}

/** Open (auto-creating) a test database by name. Use for close-and-reopen persistence tests. */
export async function openTestDb(name: string): Promise<Db> {
  // max 1: handles stay open until afterAll, and a test file opens dozens of databases —
  // default-size pools would exhaust the server's connection limit mid-file.
  const db = await openDb({ ...base, database: name, max: 1 });
  handles.push(db);
  return db;
}

/** A migrated, empty, throwaway database — the per-test fixture. */
export function freshTestDb(): Promise<Db> {
  return openTestDb(freshTestName());
}

/** afterAll: close every handle, then drop every database this file created. */
export async function cleanupTestDbs(): Promise<void> {
  for (const h of handles) {
    try {
      await h.close();
    } catch {}
  }
  handles.length = 0;
  // max 4: a test file creates dozens of databases, and serial drops overrun bun's hook
  // timeout. FORCE kills any connection a crashed test left behind; leftovers from a killed
  // run are swept by `sh scripts/db.sh clean-test`.
  const admin = new SQL({ ...connOpts(base), database: "postgres", max: 4 });
  try {
    await Promise.all(
      created
        // Same identifier guard openDb applies — these names are interpolated into DDL.
        .filter((n) => /^[a-z_][a-z0-9_]*$/.test(n))
        .map((n) => admin.unsafe(`DROP DATABASE IF EXISTS "${n}" WITH (FORCE)`)),
    );
  } finally {
    created.length = 0;
    await admin.close();
  }
}

function connOpts(b: typeof base) {
  return { hostname: b.host, port: b.port, username: b.user, password: b.password };
}
