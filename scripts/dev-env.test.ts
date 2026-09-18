// The derivation's own rules. Everything here is pure — no git, no filesystem, no ports — because
// what can actually go wrong is arithmetic and naming, and both are cheap to prove.

import { test, expect, describe } from "bun:test";
import {
  PORT_BASE, PORT_STEP, dbNameFor, safeToken, branchDrift, planFor, parseWorktrees,
  resolveSlot, envIsSafe, worktreeEnvValues, carriedOver, parseEnvText, DERIVED_KEYS,
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
