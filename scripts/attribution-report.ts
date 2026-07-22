// Measure-Monday attribution report: the acquisition funnel grouped by /start code.
// Read-only against the live database (WAL allows concurrent reads while the bot runs).
//
//   bun run scripts/attribution-report.ts            # uses DB_PATH from .env, else ./data/eait.sqlite
//   bun run scripts/attribution-report.ts <db-path>  # explicit path
//
// Views per code live in the platform dashboards and are entered by hand into the week file;
// only the denominator is manual — everything below comes from the bot's own event log.

import { openDb, funnelByCode } from "../src/db.ts";

const path = process.argv[2] ?? process.env.DB_PATH?.trim() ?? "./data/eait.sqlite";
const db = openDb(path);
const rows = funnelByCode(db);

if (rows.length === 0) {
  console.log(`No users yet (${path}).`);
  process.exit(0);
}

const pct = (n: number, d: number) => (d === 0 ? "—" : `${Math.round((100 * n) / d)}%`);
const header = ["source", "users", "first_photo", "d7_retained", "cap_hits", "waitlist"];
const table = rows.map((r) => [
  r.source,
  String(r.users),
  `${r.first_photo} (${pct(r.first_photo, r.users)})`,
  `${r.d7_retained} (${pct(r.d7_retained, r.users)})`,
  String(r.cap_hits),
  String(r.waitlist),
]);

const widths = header.map((h, i) => Math.max(h.length, ...table.map((row) => row[i]!.length)));
const line = (cells: string[]) => cells.map((c, i) => c.padEnd(widths[i]!)).join("  ");
console.log(line(header));
console.log(line(widths.map((w) => "-".repeat(w))));
for (const row of table) console.log(line(row));
db.close();
