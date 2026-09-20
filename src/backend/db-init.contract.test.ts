// `src/iac/db-init.sh` is the other half of this file's row-level security, and nothing bound them.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// WHAT THE SCRIPT PROMISES. `store.pg.ts` enables AND FORCES a deny-by-default policy on every
// user-scoped table, and forcing is what makes an owner subject to its own policies — but a
// SUPERUSER is exempt even then. So the backend must connect as an ordinary role, and that role
// must OWN everything the migration touches, because the migration alters all of it on every boot:
// `create or replace function app_user_id()` requires owning that function, and a database whose
// functions belong to somebody else refuses the whole schema before the server listens.
//
// WHY CI DID NOT ALREADY PROVE THIS. `.github/workflows/test.yml` runs the script — and runs it
// against a database that `migrate()` has not touched yet, because the step comes before
// `bun run check`. There are no tables, no sequences and no functions to hand over at that moment,
// so all three loops in the script match zero rows, every run, and the suite that follows passes
// because `migrate()` then created everything AS `eait_app` in the first place.
//
// That is the opposite of the case the script exists for. A deployed database is FULL of objects
// somebody else created — every production host that predates the role has a schema owned by the
// image's superuser — and the hand-over path had therefore never run anywhere that a test looked.
//
// WHAT THIS ASKS INSTEAD. It builds the production shape: a database whose whole schema was created
// by the superuser, exactly as a host upgrading into this feature has. Then it runs the script and
// asks a question the script's own text cannot answer — *is anything left over* — rather than
// checking that it mentions the three statements it happens to mention today. A new object class in
// `SCHEMA` that the script does not hand over fails here, on the commit that adds it, instead of on
// a box at the next migration.
// ─────────────────────────────────────────────────────────────────────────────────────────────
//
// Skipped LOUDLY without a superuser URL, like the contract suite next door: a silently skipped
// test reads as a passing one. `./dev test` does not set this; CI does, and so does anybody who
// points it at a local `db.sh` server.

import { afterAll, describe, expect, it } from "bun:test";
import { SQL } from "bun";
import { postgresStore } from "./store.pg.ts";

const SUPER_URL = process.env.TEST_SUPERUSER_DATABASE_URL;
/** The password `db-init.sh` gives the role it creates. `db.sh` and CI both use `eait`. */
const APP_PASSWORD = process.env.EAIT__DEPLOY__APP_DB_PASSWORD ?? "eait";
const APP_ROLE = "eait_app";

if (!SUPER_URL) {
  describe.skip("db-init.sh hands over a database the superuser built", () => {
    it("needs TEST_SUPERUSER_DATABASE_URL (a SUPERUSER url — this one creates and drops a database)", () => {});
  });
} else {
  const base = new URL(SUPER_URL);
  // A database of its own, dropped at the end. It cannot be the contract suite's: this one is built
  // by the superuser on purpose, which is the state that suite asserts it is NOT in.
  const scratch = `eait__dbinit_${Math.random().toString(36).slice(2, 8)}`;
  const urlFor = (db: string, user?: string, password?: string) => {
    const u = new URL(base.toString());
    u.pathname = `/${db}`;
    if (user) {
      u.username = user;
      u.password = password ?? "";
    }
    return u.toString();
  };

  const maintenance = new SQL(urlFor("postgres"));

  afterAll(async () => {
    await maintenance.unsafe(`drop database if exists "${scratch}" with (force)`).catch(() => {});
    await maintenance.end().catch(() => {});
  });

  describe("db-init.sh hands over a database the superuser built", () => {
    it("leaves NOTHING in public owned by anybody but the app role", async () => {
      await maintenance.unsafe(`create database "${scratch}"`);

      // The production shape: the whole schema, created by the superuser. `postgresStore` runs the
      // migration, so this is the real `SCHEMA` rather than a hand-written imitation of it that
      // would stop resembling the product the moment somebody added a table.
      const built = await postgresStore(urlFor(scratch));
      await built.close();

      const before = await ownedByOthers(urlFor(scratch));
      // The premise. If this is empty the test proves nothing, because there was nothing to hand
      // over — which is exactly the shape CI was silently in.
      expect(`objects the superuser owns before the hand-over: ${before.length > 0}`)
        .toBe("objects the superuser owns before the hand-over: true");

      const ran = Bun.spawnSync(["sh", "src/iac/db-init.sh"], {
        cwd: `${import.meta.dir}/../..`,
        env: {
          ...process.env,
          PGHOST: base.hostname,
          PGPORT: base.port || "5432",
          PGPASSWORD: decodeURIComponent(base.password),
          POSTGRES_USER: decodeURIComponent(base.username),
          POSTGRES_DB: scratch,
          EAIT__DEPLOY__APP_DB_PASSWORD: APP_PASSWORD,
        },
      });
      expect(`db-init.sh exit ${ran.exitCode}: ${ran.stderr.toString().trim()}`).toBe("db-init.sh exit 0: ");

      // THE QUESTION THAT HAS TEETH. Not "does the script say `alter function`" — that passes for a
      // script that says it about the wrong things. Every object in `public`, whatever its kind,
      // and the failure names the ones left behind.
      const after = await ownedByOthers(urlFor(scratch));
      expect(after).toEqual([]);
    }, 60_000);

    // The consequence, stated as the thing an operator would actually see. A database whose
    // functions belong to another role refuses `create or replace function app_user_id()` — so the
    // container dies on every boot after the hand-over, with an error naming nothing anybody can
    // act on. This is the same migration the backend runs at startup, as the role it runs it as.
    it("lets the app role run the migration afterwards, which is what a restart does", async () => {
      const again = await postgresStore(urlFor(scratch, APP_ROLE, APP_PASSWORD));
      await again.close();
    }, 60_000);

    // And the point of all of it: the second lock is now locked. A transaction that declares nobody
    // sees nobody — as the app role, which is what production connects as.
    it("makes the policies refuse, as the role production uses", async () => {
      const app = new SQL(urlFor(scratch, APP_ROLE, APP_PASSWORD));
      const [role] = await app`
        select bool_or(rolsuper or rolbypassrls) as bypasses
        from pg_roles where pg_has_role(current_user, oid, 'usage')`;
      expect(`${APP_ROLE} bypasses: ${role?.bypasses}`).toBe(`${APP_ROLE} bypasses: false`);

      const [seen] = await app`select count(*)::int as n from meals`;
      expect(`rows visible with no app.user_id declared: ${seen?.n}`)
        .toBe("rows visible with no app.user_id declared: 0");
      await app.end();
    }, 30_000);
  });

  /**
   * Every object in `public` owned by somebody other than the app role.
   *
   * Relations of EVERY kind (`pg_class` covers tables, sequences, views, materialised views,
   * partitioned and foreign tables) and every function, because the classes this has to cover are
   * the ones nobody has added yet. Extension members are excluded: pgcrypto owns its own functions
   * and reassigning one behind the extension's back is not something to ask for.
   */
  async function ownedByOthers(url: string): Promise<string[]> {
    const sql = new SQL(url);
    try {
      const rows = await sql`
        select c.relkind::text || ' ' || c.relname::text as what
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relkind in ('r', 'S', 'v', 'm', 'p', 'f')
           and pg_get_userbyid(c.relowner) <> ${APP_ROLE}
           and not exists (select 1 from pg_depend d
                            where d.objid = c.oid and d.classid = 'pg_class'::regclass and d.deptype = 'e')
        union all
        select 'function ' || p.proname::text
          from pg_proc p
          join pg_namespace n on n.oid = p.pronamespace
         where n.nspname = 'public'
           and pg_get_userbyid(p.proowner) <> ${APP_ROLE}
           and not exists (select 1 from pg_depend d
                            where d.objid = p.oid and d.classid = 'pg_proc'::regclass and d.deptype = 'e')
        order by 1`;
      return rows.map((r: { what: string }) => r.what);
    } finally {
      await sql.end();
    }
  }
}
