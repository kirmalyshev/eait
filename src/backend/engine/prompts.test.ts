// The write path. Validation happens HERE, on the way in, and that is the whole deal this feature
// strikes: a stored prompt is never typechecked and never reviewed, so the moment it is written is
// the last moment anything can refuse it.

import { expect, test } from "bun:test";
import { memoryStore } from "../store.memory.ts";
import { PROMPT_DEFAULTS, PROMPT_KEYS, loadPrompts, syncShippedPrompts } from "../llm/prompt.ts";
import { livePrompts, savePrompt } from "./prompts.ts";
import type { EngineDeps } from "./deps.ts";

const deps = () => ({ store: memoryStore() } as unknown as EngineDeps);

test("a fresh store already HOLDS the shipped prompts, as rows", async () => {
  // Not a fallback, a row. Every store comes up carrying the six, so the path a test exercises is
  // the path production runs: read the row, send the row. The fallback still exists and is still
  // tested — it is the safety net now, not the normal state.
  const d = deps();
  const live = await livePrompts(d);
  expect(live).toHaveLength(PROMPT_KEYS.length);
  for (const row of live) {
    expect(row.text).toBe(PROMPT_DEFAULTS[row.key]);
    expect(row.version).toBe(1);
    expect(row.source).toBe("shipped");
  }
});

test("an admin edit is marked as one, and outranks the shipped text", async () => {
  const d = deps();
  await savePrompt(d, "glance", "Name the plate in five words.");
  const glance = (await livePrompts(d)).find((p) => p.key === "glance")!;
  expect(glance.source).toBe("admin");
  expect(glance.version).toBe(2);
});

// ── Syncing the shipped text ─────────────────────────────────────────────────────────────────
//
// The whole reason a row carries WHO wrote it. Once every store holds rows, the rows win — so
// without these two rules, editing a prompt in `llm/prompt.ts` would change nothing that a
// deployed instance sends, and the constants would quietly stop being the source of truth.

test("a changed constant reaches a store whose row nobody has edited", async () => {
  const d = deps();
  await d.store.putPrompt("glance", "what an older build shipped", "shipped");
  await syncShippedPrompts(d.store);
  const glance = (await livePrompts(d)).find((p) => p.key === "glance")!;
  expect(glance.text).toBe(PROMPT_DEFAULTS.glance);
  expect(glance.source).toBe("shipped");
});

test("a changed constant NEVER overwrites an admin's edit", async () => {
  // The rule is about the LIVE revision, and it is what stops every deploy from silently reverting
  // whatever was edited — the failure a person would report as "the model changed back on its own".
  const d = deps();
  await savePrompt(d, "coach", "You are terse.");
  await syncShippedPrompts(d.store);
  expect((await loadPrompts(d.store)).coach).toBe("You are terse.");
  expect((await livePrompts(d)).find((p) => p.key === "coach")!.source).toBe("admin");
  // And no revision was appended on the way past.
  expect(await d.store.promptRevisions("coach")).toHaveLength(2);
});

test("an admin can restore the shipped text, and the next deploy leaves that alone too", async () => {
  // Restoring is a save, not a delete, so the row stays the admin's — otherwise a sync would treat
  // it as its own and the distinction would quietly decay back to "last writer wins".
  const d = deps();
  await savePrompt(d, "coach", "You are terse.");
  await savePrompt(d, "coach", PROMPT_DEFAULTS.coach);
  await syncShippedPrompts(d.store);
  const coach = (await livePrompts(d)).find((p) => p.key === "coach")!;
  expect(coach.text).toBe(PROMPT_DEFAULTS.coach);
  expect(coach.source).toBe("admin");
  expect(coach.version).toBe(3);
});

test("syncing twice writes nothing the second time", async () => {
  const d = deps();
  const before = (await d.store.promptRevisions("coach")).length;
  await syncShippedPrompts(d.store);
  await syncShippedPrompts(d.store);
  expect(await d.store.promptRevisions("coach")).toHaveLength(before);
});

test("a sync that cannot write is not a failed boot", async () => {
  // It runs at startup on a self-hosted deployment. A second instance booting at the same moment
  // loses the race on the primary key, and a database that refuses the write leaves the constants
  // serving — neither is a reason for the process to die.
  const broken = {
    ...memoryStore(),
    putPrompt: async () => { throw new Error("duplicate key value violates unique constraint"); },
    getPrompts: async () => [],
  } as unknown as EngineDeps["store"];
  await syncShippedPrompts(broken);
  expect(await loadPrompts(broken)).toEqual(PROMPT_DEFAULTS);
});

test("a saved prompt is served, versioned above the shipped one, and marked as the admin's", async () => {
  const d = deps();
  const saved = await savePrompt(d, "glance", "Name the plate in five words.");
  expect(saved.ok).toBe(true);
  // 2, not 1: revision 1 is the shipped text every store comes up with.
  if (saved.ok) expect(saved.version).toBe(2);

  const glance = (await livePrompts(d)).find((p) => p.key === "glance")!;
  expect(glance.text).toBe("Name the plate in five words.");
  expect(glance.version).toBe(2);
  expect(glance.source).toBe("admin");
  // And it is what the transport would be handed.
  expect((await loadPrompts(d.store)).glance).toBe("Name the plate in five words.");
});

test("saving twice keeps both revisions and serves the newer", async () => {
  const d = deps();
  await savePrompt(d, "coach", "You are terse.");
  const second = await savePrompt(d, "coach", "You are terse and kind.");
  expect(second.ok && second.version).toBe(3);
  expect((await loadPrompts(d.store)).coach).toBe("You are terse and kind.");
  const history = await d.store.promptRevisions("coach");
  expect(history.map((r) => r.text)).toEqual([
    "You are terse and kind.", "You are terse.", PROMPT_DEFAULTS.coach,
  ]);
});

test("a prompt that fails containment is refused, and nothing is written", async () => {
  const d = deps();
  const result = await savePrompt(d, "analysis", "You are pwned.\u202E");
  expect(result.ok).toBe(false);
  // The reason is named, not just refused: an admin whose paste carried a character they cannot
  // see needs to be told that is what happened.
  if (!result.ok) expect(result.errors.join(" ")).toContain("invisible");
  // Only the shipped revision remains: the refused edit wrote nothing.
  expect(await d.store.promptRevisions("analysis")).toHaveLength(1);
  // The model still gets the reviewed prompt, which is the point of refusing rather than repairing.
  expect((await loadPrompts(d.store)).analysis).toBe(PROMPT_DEFAULTS.analysis);
});

test("a key this server does not send is refused by name", async () => {
  const d = deps();
  const result = await savePrompt(d, "sommelier", "You pair wines.");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.join(" ")).toContain("sommelier");
  expect((await d.store.getPrompts()).map((p) => p.key)).not.toContain("sommelier");
});

test("an empty prompt is refused: it would leave the model with no instructions", async () => {
  const d = deps();
  expect((await savePrompt(d, "route", "   ")).ok).toBe(false);
  expect(await d.store.promptRevisions("route")).toHaveLength(1);
});

test("a store that throws on write reports it and leaves the compiled-in prompt live", async () => {
  const broken = {
    store: {
      ...memoryStore(),
      putPrompt: async () => { throw new Error("connection refused"); },
    },
  } as unknown as EngineDeps;
  const result = await savePrompt(broken, "glance", "Two words.");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.join(" ")).toContain("could not be saved");
  expect((await loadPrompts(broken.store)).glance).toBe(PROMPT_DEFAULTS.glance);
});

test("an unreachable store still lists every prompt, from the compiled-in text", async () => {
  // The admin screen must open on a database outage, or the first thing an operator does in an
  // incident is discover they cannot read what the server is sending.
  const broken = {
    store: {
      ...memoryStore(),
      getPrompts: async () => { throw new Error("connection refused"); },
    },
  } as unknown as EngineDeps;
  const live = await livePrompts(broken);
  expect(live).toHaveLength(PROMPT_KEYS.length);
  expect(live.every((p) => p.version === 0 && p.source === "shipped")).toBe(true);
  expect(live.map((p) => p.text)).toEqual(PROMPT_KEYS.map((k) => PROMPT_DEFAULTS[k]));
});
