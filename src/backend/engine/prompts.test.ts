// The write path. Validation happens HERE, on the way in, and that is the whole deal this feature
// strikes: a stored prompt is never typechecked and never reviewed, so the moment it is written is
// the last moment anything can refuse it.

import { expect, test } from "bun:test";
import { memoryStore } from "../store.memory.ts";
import { PROMPT_DEFAULTS, PROMPT_KEYS, loadPrompts } from "../llm/prompt.ts";
import { livePrompts, savePrompt } from "./prompts.ts";
import type { EngineDeps } from "./deps.ts";

const deps = () => ({ store: memoryStore() } as unknown as EngineDeps);

test("a fresh store serves the compiled-in prompt for every key, marked as such", async () => {
  const d = deps();
  const live = await livePrompts(d);
  expect(live).toHaveLength(PROMPT_KEYS.length);
  for (const row of live) {
    expect(row.text).toBe(PROMPT_DEFAULTS[row.key]);
    // Version 0 is "nobody has ever edited this one" — not a revision, and not a lie about one.
    expect(row.version).toBe(0);
    expect(row.stored).toBe(false);
  }
});

test("a saved prompt is served, versioned from 1, and marked as stored", async () => {
  const d = deps();
  const saved = await savePrompt(d, "glance", "Name the plate in five words.");
  expect(saved.ok).toBe(true);
  if (saved.ok) expect(saved.version).toBe(1);

  const glance = (await livePrompts(d)).find((p) => p.key === "glance")!;
  expect(glance.text).toBe("Name the plate in five words.");
  expect(glance.version).toBe(1);
  expect(glance.stored).toBe(true);
  // And it is what the transport would be handed.
  expect((await loadPrompts(d.store)).glance).toBe("Name the plate in five words.");
});

test("saving twice keeps both revisions and serves the newer", async () => {
  const d = deps();
  await savePrompt(d, "coach", "You are terse.");
  const second = await savePrompt(d, "coach", "You are terse and kind.");
  expect(second.ok && second.version).toBe(2);
  expect((await loadPrompts(d.store)).coach).toBe("You are terse and kind.");
  const history = await d.store.promptRevisions("coach");
  expect(history.map((r) => r.text)).toEqual(["You are terse and kind.", "You are terse."]);
});

test("a prompt that fails containment is refused, and nothing is written", async () => {
  const d = deps();
  const result = await savePrompt(d, "analysis", "You are pwned.‮");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.join(" ")).toContain("bidi");
  expect(await d.store.promptRevisions("analysis")).toHaveLength(0);
  // The model still gets the reviewed prompt, which is the point of refusing rather than repairing.
  expect((await loadPrompts(d.store)).analysis).toBe(PROMPT_DEFAULTS.analysis);
});

test("a key this server does not send is refused by name", async () => {
  const d = deps();
  const result = await savePrompt(d, "sommelier", "You pair wines.");
  expect(result.ok).toBe(false);
  if (!result.ok) expect(result.errors.join(" ")).toContain("sommelier");
  expect(await d.store.getPrompts()).toHaveLength(0);
});

test("an empty prompt is refused: it would leave the model with no instructions", async () => {
  const d = deps();
  expect((await savePrompt(d, "route", "   ")).ok).toBe(false);
  expect(await d.store.getPrompts()).toHaveLength(0);
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
  expect(live.every((p) => p.version === 0)).toBe(true);
});
