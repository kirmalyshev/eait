import { Mastra } from "@mastra/core";
import { Memory } from "@mastra/memory";
import { PostgresStore } from "@mastra/pg";
import type { PgConfig } from "../config.ts";
import { pgConnectionString } from "./pgConnection.ts";

/**
 * One Mastra instance for the process, created once at startup (a later plan wires this into
 * `index.ts`) — the same composition-root role `createProvider()` played for the retired
 * `llm/factory.ts`. Memory persists into the SAME Postgres database `db.ts` already uses;
 * `PostgresStore.init()` creates and manages its own tables there, independent of `db.ts`'s
 * `schema_version`-tracked migrations list — do not add Mastra's tables to that list.
 *
 * `init()` is called explicitly (not left to run lazily on first use) so a startup failure here
 * surfaces at boot, the same way `db.ts`'s migrations fail loudly at boot rather than on the
 * first request that happens to touch a missing table.
 *
 * `memory` is NOT passed into `new Mastra({...})` — the `Mastra` constructor's own `memory` field
 * is a named map (`Record<string, MastraMemory>`) for a different feature (multiple registered
 * memory backends), not a slot for a single instance. Callers (Task 6's `createEngineAgent`, and
 * later plans' `bot.ts` wiring) take `memory` straight from this function's return value and pass
 * it directly to `new Agent({ memory })`, whose `memory` field DOES accept a bare instance.
 */
export async function createMastra(pg: PgConfig): Promise<{ mastra: Mastra; memory: Memory }> {
  const storage = new PostgresStore({ id: "eait", connectionString: pgConnectionString(pg) });
  await storage.init();
  const memory = new Memory({ storage });
  const mastra = new Mastra({ storage });
  return { mastra, memory };
}
