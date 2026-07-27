import type { PgConfig } from "../config.ts";

/** Builds the libpq connection string @mastra/pg's PostgresStore takes, from the SAME PgConfig
 * shape db.ts/openDb use — one source of truth for connection info, no second place that can
 * drift from the real host/port/credentials. */
export function pgConnectionString(pg: PgConfig): string {
  const auth = `${encodeURIComponent(pg.user)}:${encodeURIComponent(pg.password)}`;
  return `postgres://${auth}@${pg.host}:${pg.port}/${pg.database}`;
}
