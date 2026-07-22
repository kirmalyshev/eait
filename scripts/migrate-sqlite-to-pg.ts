// One-shot importer for the sqlite→Postgres cutover: copies an existing bun:sqlite eait
// database into a Postgres database. Manual and offline — stop the sqlite-era bot first, run
// once, check the printed counts, then start the Postgres bot. Idempotent: rows that already
// exist (by primary key) are skipped, so a re-run after a partial import is safe.
//
//   bun run scripts/migrate-sqlite-to-pg.ts <path/to/eait.sqlite> [pg-database]
//
// The target defaults to PGDATABASE from .env. Connection comes from PGHOST/PGPORT/PGUSER/
// PGPASSWORD with the same defaults as the bot (the shared dev server from `sh scripts/db.sh up`).

import { Database } from "bun:sqlite";
import { openDb } from "../src/db.ts";

const src = process.argv[2];
if (!src) {
  console.error("usage: bun run scripts/migrate-sqlite-to-pg.ts <sqlite-file> [pg-database]");
  process.exit(1);
}

const env = process.env;
const database = process.argv[3] ?? env.PGDATABASE?.trim() ?? "eait";
// Not readonly: the sqlite-era databases are WAL, and a readonly open of a WAL file needs a
// writable -shm — bun:sqlite fails with SQLITE_CANTOPEN. The script never writes to it.
const sqlite = new Database(src);
const pg = await openDb({
  host: env.PGHOST?.trim() || "127.0.0.1",
  port: Number(env.PGPORT) || 5439,
  user: env.PGUSER?.trim() || "eait",
  password: env.PGPASSWORD?.trim() || "eait",
  database,
});

const all = (table: string, order = "rowid") =>
  sqlite.query(`SELECT * FROM ${table} ORDER BY ${order}`).all() as Record<string, any>[];

let copied = 0;
for (const u of all("users")) {
  await pg`
    INSERT INTO users (telegram_id, username, lang, state, consent_at, goal, restrictions, created_at, acquisition_source)
    VALUES (${u.telegram_id}, ${u.username}, ${u.lang}, ${u.state}, ${u.consent_at}, ${u.goal},
            ${u.restrictions}, ${u.created_at}, ${u.acquisition_source ?? null})
    ON CONFLICT (telegram_id) DO NOTHING`;
  copied++;
}
for (const m of all("meals")) {
  await pg`
    INSERT INTO meals (id, user_id, ts, date, chat_id, bot_message_id, items,
                       kcal, protein_g, carbs_g, fat_g, satfat_g, fiber_g, sugar_g, sodium_mg,
                       plant_protein_pct, verdicts, confidence, notes, corrected, model)
    VALUES (${m.id}, ${m.user_id}, ${m.ts}, ${m.date}, ${m.chat_id}, ${m.bot_message_id}, ${m.items},
            ${m.kcal}, ${m.protein_g}, ${m.carbs_g}, ${m.fat_g}, ${m.satfat_g}, ${m.fiber_g},
            ${m.sugar_g}, ${m.sodium_mg}, ${m.plant_protein_pct}, ${m.verdicts}, ${m.confidence},
            ${m.notes}, ${m.corrected}, ${m.model})
    ON CONFLICT (id) DO NOTHING`;
  copied++;
}
for (const s of all("settings", "key")) {
  await pg`
    INSERT INTO settings (key, value) VALUES (${s.key}, ${s.value})
    ON CONFLICT (key) DO NOTHING`;
  copied++;
}
for (const p of all("processed_updates", "update_id")) {
  await pg`
    INSERT INTO processed_updates (update_id, at) VALUES (${p.update_id}, ${p.at})
    ON CONFLICT (update_id) DO NOTHING`;
  copied++;
}
// events has no natural key — refuse a double import instead of duplicating the funnel log.
const existingEvents = Number((await pg`SELECT COUNT(*)::int AS n FROM events`)[0].n);
if (existingEvents > 0) {
  console.log(`events: target already has ${existingEvents} rows — skipping (delete them to re-import)`);
} else {
  for (const e of all("events")) {
    await pg`
      INSERT INTO events (ts, user_id, event, source_code)
      VALUES (${e.ts}, ${e.user_id}, ${e.event}, ${e.source_code})`;
    copied++;
  }
}

const count = async (t: string) => Number((await pg.unsafe(`SELECT COUNT(*)::int AS n FROM ${t}`))[0].n);
const scount = (t: string) => (sqlite.query(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
let ok = true;
for (const t of ["users", "meals", "settings", "processed_updates", "events"]) {
  const s = scount(t);
  const p = await count(t);
  const mark = p >= s ? "✓" : "✗";
  if (p < s) ok = false;
  console.log(`${mark} ${t}: sqlite=${s} postgres=${p}`);
}
sqlite.close();
await pg.close();
if (!ok) {
  console.error("some tables have fewer rows in Postgres than in sqlite — inspect before going live");
  process.exit(1);
}
console.log(`done (${copied} rows visited) → ${database}`);
