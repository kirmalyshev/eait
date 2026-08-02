import { afterAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import type { PostgresStore } from "@mastra/pg";
import { freshTestName, openTestDb, cleanupTestDbs } from "../testutil.ts";
import { createMastra } from "./mastra.ts";

afterAll(cleanupTestDbs, 60_000); // dropping N databases outlives the 5s default under load

function pgBase() {
  return {
    host: process.env.PGHOST?.trim() || "127.0.0.1",
    port: Number(process.env.PGPORT) || 5439,
    user: process.env.PGUSER?.trim() || "eait",
    password: process.env.PGPASSWORD?.trim() || "eait",
  };
}

describe("createMastra", () => {
  test("Memory's storage.init() creates Mastra's own tables, independent of db.ts's migrations", async () => {
    const database = freshTestName();
    await openTestDb(database); // creates + runs db.ts's own schema_version migrations first

    const { mastra, memory } = await createMastra({ ...pgBase(), database });
    expect(memory).toBeDefined();

    // Bun's SQL client takes hostname/username, not host/user — pgBase()'s field names match
    // PgConfig (what createMastra/pgConnectionString want), so they're mapped explicitly here.
    const base = pgBase();
    const sql = new SQL({
      hostname: base.host,
      port: base.port,
      username: base.user,
      password: base.password,
      database,
    });
    const rows = await sql`
      SELECT table_name FROM information_schema.tables WHERE table_name = 'mastra_threads'
    `;
    expect(rows.length).toBe(1);
    await sql.close();

    // PostgresStore owns its own connection pool (no external `pool` was passed to its
    // constructor), so it must be closed explicitly here — otherwise afterAll's
    // cleanupTestDbs FORCE-drops this database out from under a still-open pool connection,
    // and PostgresStore logs "idle pool client error" noise from the forced disconnect.
    await (mastra.getStorage() as PostgresStore | undefined)?.close();
  });
});
