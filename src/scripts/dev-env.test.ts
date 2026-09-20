// The derivation's own rules. Almost everything here is pure — no git, no ports — because what can
// actually go wrong is arithmetic and naming, and both are cheap to prove. The one exception reads
// `worktree.sh`, because the thing it proves is that the two files agree about which keys exist.

import { test, expect, describe } from "bun:test";
import { readFileSync } from "node:fs";
import {
  PORT_BASE, PORT_STEP, dbNameFor, safeToken, branchDrift, planFor, parseWorktrees,
  resolveSlot, envIsSafe, worktreeEnvValues, carriedOver, parseEnvText, DERIVED_KEYS,
  TEST_DB_SUFFIX, testDbNameFor,
} from "./dev-env.ts";

describe("ports", () => {
  // THE WHOLE POINT OF SLOTS. Two worktrees that compute one port is the collision this exists to
  // prevent, and it is the kind of thing a reader checks by eye and gets wrong.
  test("no two slots share a port, over twenty of them", () => {
    const seen = new Map<number, string>();
    for (let slot = 0; slot < 20; slot++) {
      const p = planFor(slot, `branch-${slot}`);
      for (const [name, port] of [["backend", p.backendPort], ["web", p.webPort]] as const) {
        expect(`${port} ${seen.get(port) ?? "free"}`).toBe(`${port} free`);
        seen.set(port, `slot${slot}.${name}`);
      }
    }
  });

  test("slot 0 is the documented pair, unchanged", () => {
    const p = planFor(0, "main");
    expect([p.backendPort, p.webPort]).toEqual([PORT_BASE.backend, PORT_BASE.web]);
  });

  test("the web port stays inside its own slot's range", () => {
    // web is backend + 1, and a slot owns PORT_STEP consecutive numbers. If that ever stops being
    // true the two ladders cross and the test above starts failing for a reason nobody can see.
    for (let slot = 0; slot < 20; slot++) {
      const p = planFor(slot, "x");
      expect(p.webPort - p.backendPort).toBeLessThan(PORT_STEP);
    }
  });

  // THE OTHER REPOSITORY ON THE SAME LAPTOP. The private monorepo that carries this one as a
  // submodule runs its own `./dev` stack, and this one was ported from it and kept its base — so
  // both called slot 0 8787/8788 and whichever came up second died on a taken port (#24). Both
  // ladders step by 10, so the last digit decides it for every slot at once: theirs end in 7, 8, 1
  // and 3, and no port here may end in any of those. Checked as arithmetic rather than as a list of
  // numbers, because a list only ever covers the slots somebody thought to write down.
  test("no slot here can land on a port the monorepo's stack derives", () => {
    const theirs = { backend: 8787, web: 8788, metro: 8081, landing: 4173 };
    for (const ours of [PORT_BASE.backend, PORT_BASE.web]) {
      for (const [name, base] of Object.entries(theirs)) {
        expect(`${ours} vs ${name}`).toBe(
          `${ours} vs ${Math.abs(ours - base) % PORT_STEP === 0 ? `${name} COLLIDES` : name}`,
        );
      }
    }
  });
});

describe("the keys dev.sh clears", () => {
  const devSh = readFileSync(new URL("./dev.sh", import.meta.url), "utf8");

  // ONE LIST. `dev.sh` clears the caller's copies so `.env` wins, and it asks this file which keys
  // those are — a second spelling in sh would go stale the next time one is added.
  test("`derived-keys` prints exactly what the generator owns", () => {
    const out = Bun.spawnSync({
      cmd: ["bun", new URL("./dev-env.ts", import.meta.url).pathname, "derived-keys"],
    });
    expect(new TextDecoder().decode(out.stdout).trim()).toBe(DERIVED_KEYS.join(" "));
  });

  test("dev.sh asks for them rather than listing them", () => {
    expect(devSh).toContain("dev-env.ts derived-keys");
    // COMMENTS MAY NAME A KEY — the one above that loop names three, and naming the failure is the
    // point of it. What may not exist is a second EXECUTABLE copy of the list.
    const code = devSh.split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");
    for (const key of DERIVED_KEYS) {
      expect(`${key} spelled in dev.sh: ${code.includes(key)}`).toBe(`${key} spelled in dev.sh: false`);
    }
  });
});

describe("database names", () => {
  test("slot 0 keeps the plain name everything already points at", () => {
    expect(dbNameFor(0, "anything")).toBe("eait");
  });

  test("a branch becomes a legal identifier that cannot start with a digit", () => {
    expect(dbNameFor(3, "feat/Photo-Upload")).toBe("eait_feat_photo_upload");
    expect(dbNameFor(3, "123")).toBe("eait_123");
  });

  // Postgres truncates at 63 SILENTLY, which would make two long branches one database.
  test("a long branch is truncated to Postgres's limit", () => {
    expect(dbNameFor(1, "x".repeat(200)).length).toBe(63);
  });

  // THE SUFFIX COMES OUT OF THE BUDGET, NOT AFTER IT. Appending to a name already at 63 hands
  // Postgres 69 characters; it keeps the first 63 and drops the rest with only a NOTICE, and the
  // first 63 ARE the dev name. So the naive version does not merely collide two test databases —
  // it points the migrating, writing contract suite at the database you develop in. The second
  // assertion is the one that catches that.
  test("a test name is 63 characters INCLUDING the suffix, and is never the dev name", () => {
    const dev = dbNameFor(1, "x".repeat(200));
    const name = testDbNameFor(dev);
    expect([name.length, name.endsWith(TEST_DB_SUFFIX)]).toEqual([63, true]);
    expect(name).not.toBe(dev);
  });

  test("slot 0's test database sits beside slot 0's dev one", () => {
    expect(testDbNameFor(dbNameFor(0, "anything"))).toBe("eait__test");
    expect(planFor(0, "main").testDbName).toBe("eait__test");
  });

  // THE TWO NAMESPACES ARE DISJOINT BY CONSTRUCTION, and a single `_test` is what makes that false:
  // `eait_fix_test` is branch `fix-test`'s DEV database and branch `fix`'s TEST database, and the
  // contract suite migrates and writes. `dbNameFor` collapses every run of non-alphanumerics to one
  // underscore, so no dev name it produces can contain `__` — which every test name does.
  test("a branch named for a test cannot take another worktree's test database", () => {
    for (const [devBranch, testBranch] of [["fix-test", "fix"], ["test", "main"], ["7-test", "---"]]) {
      expect(dbNameFor(1, devBranch!)).not.toBe(planFor(2, testBranch!).testDbName);
    }
    expect(dbNameFor(7, "---")).not.toBe(planFor(7, "anything").testDbName);
    // The general rule, rather than the three cases above: a dev name never contains `__`.
    for (const branch of ["fix--test", "a/__b", "feat/x  y", "__lead", "trail__"]) {
      expect(dbNameFor(1, branch)).not.toContain("__");
    }
  });

  test("no two slots share a database, dev or test, and no dev database is a test one", () => {
    const seen = new Map<string, string>();
    for (let slot = 0; slot < 20; slot++) {
      const p = planFor(slot, `feat/branch-${slot}`);
      for (const [kind, name] of [["dev", p.dbName], ["test", p.testDbName]] as const) {
        expect(`${name} ${seen.get(name) ?? "free"}`).toBe(`${name} free`);
        seen.set(name, `slot${slot}.${kind}`);
      }
      expect(p.testDatabaseUrl).toBe(p.databaseUrl.replace(/[^/]+$/, p.testDbName));
    }
  });

  // An overridden dev name takes its test database with it. Deriving the test name from the slot
  // and the branch instead would have left the override pointing at a stranger's rows.
  test("an overridden database name carries its own test database", () => {
    const p = planFor(2, "feat/x", { dbName: "borrowed" });
    expect([p.dbName, p.testDbName]).toEqual(["borrowed", "borrowed__test"]);
  });

  test("a branch with nothing usable in it falls back to the slot", () => {
    expect(dbNameFor(7, "---")).toBe("eait_7");
  });
});

describe("what may be written to .env.worktree", () => {
  // The file is SOURCED. A value that a shell reads as syntax leaves the variable UNSET, and an
  // unset key here silently means slot 0's — another worktree's database.
  test("a shell control operator is refused", () => {
    for (const bad of ["a b", "a&b", "a;b", "a|b", "a$b", "a`b`", 'a"b', "a'b", "a#b", "a(b)", "a<b", "a!b"]) {
      expect(`${bad}: ${envIsSafe(bad)}`).toBe(`${bad}: false`);
    }
  });

  test("what a URL is actually spelled with is allowed", () => {
    expect(envIsSafe("postgres://eait:p%26ss@127.0.0.1:5433/eait_x?sslmode=require")).toBe(true);
  });

  test("an unwritable value throws rather than being dropped", () => {
    // Dropping it would fall back to slot 0 — the exact collision slots exist to prevent.
    expect(() => worktreeEnvValues(planFor(2, "b", { dbName: "has space" }))).toThrow(/cannot be written/);
  });

  test("every generated value is writable, over twenty slots", () => {
    for (let slot = 0; slot < 20; slot++) {
      const values = worktreeEnvValues(planFor(slot, `feat/x-${slot}`));
      for (const v of Object.values(values)) expect(envIsSafe(v)).toBe(true);
    }
  });

  // THE TWO FILES ARE ONE CONTRACT. `worktree.sh` supplies a slot-0 default per key so a checkout
  // that never derived behaves as a single checkout always did — which means a key added to the
  // generator alone reaches a linked worktree as UNSET, and a key defaulted in the shell alone is
  // slot 0's value everywhere forever. Both are the silent slot-0 fallback, and both read as
  // working. Nothing else in the repo compares the two lists.
  test("the generator's keys and worktree.sh's slot-0 defaults are the same set", () => {
    const sh = readFileSync(new URL("./worktree.sh", import.meta.url), "utf8");
    const defaulted = [...sh.matchAll(/^([A-Z0-9_]+)="\$\{\1:-/gm)].map((m) => m[1]!);
    const emitted = Object.keys(worktreeEnvValues(planFor(3, "feat/x")));
    expect({
      emittedWithNoShellDefault: emitted.filter((k) => !defaulted.includes(k)),
      defaultedButNeverEmitted: defaulted.filter((k) => !emitted.includes(k)),
    }).toEqual({ emittedWithNoShellDefault: [], defaultedButNeverEmitted: [] });
  });

  // CI IS SLOT 0 AND MUST SAY SO. It sets `TEST_DATABASE_URL` itself, at its own ephemeral Postgres,
  // so nothing there can collide and nothing there would ever report drift — which is precisely why
  // the name is worth pinning. A reader copies what CI does; if that name were `eait_test` they
  // would copy the collision this derivation removed, onto a machine that has worktrees.
  test("CI runs the contract suite against slot 0's derived test database", () => {
    const ci = readFileSync(new URL("../../.github/workflows/test.yml", import.meta.url), "utf8");
    const plan = planFor(0, "main");
    // The ROLE is derived too, not typed. It is `eait_app` and not the `eait` the image creates,
    // because that one is a superuser and a superuser bypasses row-level security — CI drifting
    // back to it would make five assertions pass for the reason they exist to refuse.
    const role = new URL(plan.databaseUrl).username;
    expect(ci).toContain(`TEST_DATABASE_URL: postgres://${role}:eait@127.0.0.1:5432/${plan.testDbName}`);
    expect(ci).toContain(`POSTGRES_DB: ${plan.testDbName}`);
  });

  // Exported, not merely assigned: `db.sh` and `dev.sh` read these out of the environment, and a
  // variable a sourced script sets without exporting is invisible to the `docker compose exec` and
  // `bun test` that need it.
  test("worktree.sh exports every key it defaults", () => {
    const sh = readFileSync(new URL("./worktree.sh", import.meta.url), "utf8");
    const exported = sh.slice(sh.lastIndexOf("export ")).split(/\s+/);
    const defaulted = [...sh.matchAll(/^([A-Z0-9_]+)="\$\{\1:-/gm)].map((m) => m[1]!);
    expect(defaulted.filter((k) => !exported.includes(k))).toEqual([]);
  });
});

describe("slot allocation", () => {
  const wt = (path: string, branch: string) => ({ path, branch });
  const none = () => null;

  test("the main worktree is always 0", () => {
    const worktrees = [wt("/repo", "main"), wt("/wt/a", "a")];
    expect(resolveSlot({ worktrees, cwd: "/repo", claimOf: none }).slot).toBe(0);
  });

  test("a claimed slot is kept, so adding a worktree cannot renumber a running one", () => {
    const worktrees = [wt("/repo", "main"), wt("/wt/a", "a"), wt("/wt/b", "b")];
    const claims: Record<string, number> = { "/wt/a": 4 };
    const r = resolveSlot({ worktrees, cwd: "/wt/a", claimOf: (p) => claims[p] ?? null });
    expect([r.slot, r.source, r.persist]).toEqual([4, "claimed", false]);
  });

  test("a new worktree takes the lowest number nobody holds", () => {
    const worktrees = [wt("/repo", "main"), wt("/wt/a", "a"), wt("/wt/b", "b")];
    const claims: Record<string, number> = { "/wt/a": 1 };
    const r = resolveSlot({ worktrees, cwd: "/wt/b", claimOf: (p) => claims[p] ?? null });
    expect([r.slot, r.source, r.persist]).toEqual([2, "allocated", true]);
  });

  test("an override wins, and is never persisted as a claim", () => {
    const worktrees = [wt("/repo", "main")];
    const r = resolveSlot({ worktrees, cwd: "/repo", override: "9", claimOf: none });
    expect([r.slot, r.source, r.persist]).toEqual([9, "override", false]);
  });

  test("a cwd outside every worktree is named, not guessed at", () => {
    expect(() => resolveSlot({ worktrees: [wt("/repo", "main")], cwd: "/elsewhere", claimOf: none }))
      .toThrow(/not inside any git worktree/);
  });

  // `/repo-two` starts with `/repo` as a STRING but is not inside it.
  test("a sibling path with a shared prefix is not 'inside'", () => {
    const worktrees = [wt("/repo", "main"), wt("/repo-two", "b")];
    expect(resolveSlot({ worktrees, cwd: "/repo-two", claimOf: none }).entry.path).toBe("/repo-two");
  });
});

describe("git plumbing", () => {
  test("the first worktree listed is the main one", () => {
    const out = parseWorktrees(
      "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /wt/a\nHEAD def\nbranch refs/heads/feat/x\n",
    );
    expect(out).toEqual([{ path: "/repo", branch: "main" }, { path: "/wt/a", branch: "feat/x" }]);
  });

  test("a detached worktree still parses, as HEAD", () => {
    expect(parseWorktrees("worktree /wt/d\nHEAD abc\ndetached\n")[0]!.branch).toBe("HEAD");
  });
});

describe("branch drift", () => {
  test("silent when the file names the branch checked out", () => {
    expect(branchDrift("EAIT_BRANCH=feat/x\n", "feat/x")).toBeNull();
  });

  test("names the branch it was derived for when they differ", () => {
    expect(branchDrift("EAIT_BRANCH=old\n", "new")).toBe("old");
  });

  // Compared through the same mangling that wrote it, or every branch carrying an awkward
  // character would report drift forever.
  test("compared through safeToken, not raw", () => {
    expect(branchDrift(`EAIT_BRANCH=${safeToken("feat/a b")}\n`, "feat/a b")).toBeNull();
  });

  test("nothing to compare is not drift", () => {
    expect(branchDrift("", "main")).toBeNull();
  });
});

describe("re-deriving is lossless", () => {
  test("a hand-written key survives; a derived one is replaced", () => {
    const existing = parseEnvText(
      "EAIT__BACKEND__LLM_API_KEY=secret\nEAIT__BACKEND__PORT=1\nEAIT__BACKEND__TZ_NAME=Europe/Berlin\n",
    );
    const kept = carriedOver(existing, DERIVED_KEYS);
    expect(kept).toEqual({ EAIT__BACKEND__LLM_API_KEY: "secret", EAIT__BACKEND__TZ_NAME: "Europe/Berlin" });
    expect(kept.EAIT__BACKEND__PORT).toBeUndefined();
  });

  test("quotes and `export` are understood, because people write them", () => {
    expect(parseEnvText('export A="one"\nB=\'two\'\n# C=three\n')).toEqual({ A: "one", B: "two" });
  });
});
