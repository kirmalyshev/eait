import { afterAll, describe, expect, test } from "bun:test";
import { SQL } from "bun";
import { freshTestName, openTestDb, cleanupTestDbs } from "../testutil.ts";
import { createMastra } from "./mastra.ts";

afterAll(cleanupTestDbs);

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

    const { memory } = await createMastra({ ...pgBase(), database });
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
  });
});
