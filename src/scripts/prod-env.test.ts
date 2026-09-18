// The deploy and `src/backend/config.ts` describe the same set of settings, or one of them is lying.
//
// ─────────────────────────────────────────────────────────────────────────────────────────────
// THREE WAYS A DEPLOY GOES WRONG SILENTLY, AND THIS FILE IS THE GUARD FOR ALL THREE.
//
// 1. A SETTING THE SERVER READS THAT THE DEPLOY NEVER OFFERS. The server starts, `/health` answers,
//    and the setting keeps a compiled-in default nobody chose. Nothing logs it. `configDefaults()`
//    is written for a laptop — loopback, no credentials, generous caps — so the default a forgotten
//    production variable falls back to is the development one.
//
// 2. A VARIABLE IN `.env.prod` THAT NO CONTAINER READS. `--env-file` feeds compose's
//    INTERPOLATION — the `${VAR}` expressions inside the compose file — and never the environment
//    of a container. A name that is not spelled somewhere in `docker-compose.prod.yml` (or in the
//    Caddyfile, for the edge's own settings) is deployed, correct, and read by nobody.
//
// 3. A VARIABLE THE EXAMPLE OFFERS THAT THE SERVER DOES NOT READ. That is a setting somebody will
//    fill in, restart for, and watch do nothing.
//
// The checks below run in both directions for that reason. `.env.prod.example` is the inventory a
// self-hoster fills in, and it is the only description of the surface there is — nothing generates
// it and nothing checks it but this.
// ─────────────────────────────────────────────────────────────────────────────────────────────

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");
const read = (rel: string): string => readFileSync(join(ROOT, rel), "utf8");

const CONFIG = "src/backend/config.ts";
const EXAMPLE = ".env.prod.example";
const COMPOSE = "docker-compose.prod.yml";
const CADDYFILE = "src/iac/Caddyfile";

/**
 * Every environment variable `config.ts` actually READS — the call sites, not every name the file
 * mentions.
 *
 * A name-anywhere scrape would be wrong in both directions: half the names in that file appear only
 * inside an error message, and `EAIT__BACKEND__USER_DAILY_PHOTO_CAP` below is READ precisely so it
 * can be refused. Two shapes reach the environment there and only two: `process.env.NAME`, and a
 * literal passed to `int`/`list`/`required`.
 */
const configReads = (): string[] => [...read(CONFIG).matchAll(
  /process\.env\.(EAIT__[A-Z0-9_]+)|(?:\bint|\blist|\brequired)\(\s*"(EAIT__[A-Z0-9_]+)"/g,
)].map((m) => m[1] ?? m[2]!);

/** Every `NAME=` assigned at the start of a line. A commented-out example never matches. */
const assigned = (text: string): string[] => [...text.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((m) => m[1]!);

const unique = (names: string[]): string[] => [...new Set(names)].sort();

/**
 * Read by `config.ts` and DELIBERATELY absent from the deploy. Both entries are asserted below
 * rather than merely skipped — an exception nobody checks is how a retired variable comes back.
 */
const NOT_DEPLOYED: Record<string, string> = {
  // Retired with the free tier. `loadConfig` throws when a host still spells it, so offering it in
  // `.env.prod.example` would ship an example that refuses to boot.
  EAIT__BACKEND__USER_DAILY_PHOTO_CAP: "retired — loadConfig refuses it",
  // `demoConfig()`'s carve-out, set by one e2e script. Named separately from the production limit
  // exactly so a value in the ambient environment cannot meter `./dev up --demo`; a production
  // deploy has no business setting it.
  EAIT__BACKEND__E2E_AUTH_RATE_LIMIT_PER_HOUR: "demo only — never read by loadConfig",
};

describe("every setting the backend reads is offered by the deploy", () => {
  it("offers it in .env.prod.example, or names it in the compose file", () => {
    const example = assigned(read(EXAMPLE));
    const compose = read(COMPOSE);
    // Two ways to be offered, and both count. Most settings arrive through `.env.prod`; a few —
    // DATABASE_URL, HOST, PORT — are composed or fixed by the compose file itself, which is the
    // right place for a value an operator must not be able to get wrong.
    const missing = configReads()
      .filter((name) => !(name in NOT_DEPLOYED))
      .filter((name) => !example.includes(name) && !compose.includes(name));
    // Named rather than counted: the fix is one line, and the symptom in production is silence.
    expect(unique(missing)).toEqual([]);
  });

  it("keeps the two deliberate exceptions out of the deploy entirely", () => {
    const reads = configReads();
    const example = read(EXAMPLE);
    const compose = read(COMPOSE);
    for (const [name, why] of Object.entries(NOT_DEPLOYED)) {
      // It is still read — otherwise this exception is stale and should be deleted.
      expect(`${name} read: ${reads.includes(name)}`).toBe(`${name} read: true`);
      expect(`${name} (${why}) in example: ${assigned(example).includes(name)}`)
        .toBe(`${name} (${why}) in example: false`);
      expect(`${name} (${why}) in compose: ${compose.includes(name)}`)
        .toBe(`${name} (${why}) in compose: false`);
    }
  });
});

describe("every variable the deploy sets is one the backend reads", () => {
  it("offers no EAIT__BACKEND__ setting that config.ts ignores", () => {
    const reads = configReads();
    const orphans = assigned(read(EXAMPLE))
      .filter((name) => name.startsWith("EAIT__BACKEND__"))
      .filter((name) => !reads.includes(name));
    expect(unique(orphans)).toEqual([]);
  });

  it("spells every EAIT__DEPLOY__ setting somewhere that consumes it", () => {
    // The edge and the database are third-party images: their settings are not read by `config.ts`
    // at all, so they carry the `DEPLOY` surface rather than `BACKEND`. They still have to reach a
    // consumer, and there are exactly two — the compose file, which maps them onto each image's own
    // names, and the Caddyfile, which reads its own through `{$…}`.
    const consumers = read(COMPOSE) + read(CADDYFILE);
    const orphans = assigned(read(EXAMPLE))
      .filter((name) => name.startsWith("EAIT__DEPLOY__"))
      .filter((name) => !consumers.includes(name));
    expect(unique(orphans)).toEqual([]);
  });

  it("names every variable in the compose file, because --env-file feeds interpolation only", () => {
    const compose = read(COMPOSE);
    const caddy = read(CADDYFILE);
    const orphans = assigned(read(EXAMPLE))
      .filter((name) => !compose.includes(name) && !caddy.includes(name));
    expect(unique(orphans)).toEqual([]);
  });
});

describe("the extraction itself still works", () => {
  it("finds the variables at all, so an empty list cannot pass for a clean one", () => {
    // Every check above is a filter over these lists. A rename or a restructure that stopped them
    // matching would make all of it vacuously green forever.
    expect(configReads().length).toBeGreaterThan(40);
    expect(configReads()).toContain("EAIT__BACKEND__DATABASE_URL");
    expect(assigned(read(EXAMPLE)).length).toBeGreaterThan(40);
    expect(assigned(read(EXAMPLE))).toContain("EAIT__BACKEND__TELEGRAM_BOT_TOKEN");
  });
});
