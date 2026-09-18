// Put the development fixtures into this worktree's database.
//
// The rules live in `src/backend/dev/seed.ts` and are tested against the memory store; this is the
// thin part that opens a real Postgres and prints what it wrote. It REPLACES the seeded accounts
// and touches nothing else, so it is safe to re-run and safe to run against a database you have
// been testing in by hand.
//
//   bun scripts/seed.ts                     every persona
//   bun scripts/seed.ts --only onboarded    just one
//   ./dev seed                              the same, with the database URL worked out for you
//
// The database URL is taken from the environment, then from `.env.worktree`, then from `.env` —
// which is the order that lets `./dev` be explicit without stopping the script from standing alone.
// It is never printed with its credentials in it.

import { join } from "node:path";
import { postgresStore } from "../src/backend/store.pg.ts";
import { SEED_PERSONAS, seedDevData } from "../src/backend/dev/seed.ts";
import { readEnvFile } from "./dev-env.ts";

const root = join(import.meta.dir, "..");

function flagList(name: string): string[] {
  const i = process.argv.indexOf(`--${name}`);
  const raw = i >= 0 ? process.argv[i + 1] : undefined;
  return raw && !raw.startsWith("--") ? raw.split(",").map((s) => s.trim()).filter(Boolean) : [];
}

const worktreeEnv = readEnvFile(join(root, ".env.worktree"));
const backendEnv = readEnvFile(join(root, ".env"));

const databaseUrl =
  process.env.EAIT__BACKEND__DATABASE_URL || worktreeEnv.EAIT_DATABASE_URL || backendEnv.EAIT__BACKEND__DATABASE_URL || "";
if (!databaseUrl) {
  console.error(
    "[eait] no database to seed.\n" +
    "       Run `./dev env` to generate this worktree's configuration, or pass EAIT__BACKEND__DATABASE_URL.",
  );
  process.exit(1);
}

const timezone = process.env.EAIT__BACKEND__TZ_NAME || backendEnv.EAIT__BACKEND__TZ_NAME || "Europe/Berlin";
const only = flagList("only");
const unknown = only.filter((k) => !SEED_PERSONAS.some((p) => p.key === k));
if (unknown.length > 0) {
  console.error(
    `[eait] unknown persona: ${unknown.join(", ")}\n` +
    `       known: ${SEED_PERSONAS.map((p) => p.key).join(", ")}`,
  );
  process.exit(1);
}

// The database must already exist — `migrate()` creates TABLES inside one, never the database
// itself. `sh scripts/db.sh up` is what creates it. See the header of store.pg.ts for the incident.
const store = await postgresStore(databaseUrl);
try {
  const seeded = await seedDevData(store, { timezone, only });

  console.log(`\n  seeded ${databaseUrl.replace(/\/\/[^@]*@/, "//***@")}\n`);
  for (const s of seeded) {
    console.log(`  ${s.key}`);
    console.log(`    ${s.summary}`);
    console.log(`    device id  ${s.deviceId}`);
    console.log(`    meals      ${s.meals}`);
    // The USER ID, and only for the admin, because it is the one value an operator has to copy:
    // `EAIT__BACKEND__ADMIN_BOOTSTRAP_USER_ID` takes it, and a real deployment grants the role that
    // way rather than by seeding. Printing it for every persona would be four ids nobody needs.
    if (s.admin) {
      console.log(`    role       admin`);
      console.log(`    user id    ${s.userId}   (EAIT__BACKEND__ADMIN_BOOTSTRAP_USER_ID)`);
    }
  }
  console.log(
    `\n  In a browser: sign in at /start, then /admin opens for the account holding the role.\n` +
    `  A seeded grant is for DEVELOPMENT — a deployed host grants it at boot from the user id above.\n`,
  );
} finally {
  await store.close();
}
