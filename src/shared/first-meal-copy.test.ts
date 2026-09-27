import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { FIRST_MEAL_COPY } from "./first-meal-copy.ts";
import { chatCopyFor } from "./onboarding-chat-copy.ts";
import { threadCopyFor } from "./chat-copy.ts";
import { LANGS } from "./types.ts";

// ONE SOURCE for the free meal's sentences (#42). The phone reads them through `chatCopyFor`, the
// browser imports this module by path — and a module the browser imports must stay small, which is
// why these are not simply a key on the eight-language chat table.
describe("the free meal's words", () => {
  it("are the chat table's own, in every language — the same object, not an equal copy", () => {
    for (const lang of LANGS) expect(chatCopyFor(lang).firstMeal).toBe(FIRST_MEAL_COPY[lang]!);
  });

  it("carry every language, so no reader falls back to English at the screen", () => {
    for (const lang of LANGS) expect(FIRST_MEAL_COPY[lang]).toBeDefined();
  });

  it("names the coach — the button opens Chat, and she is the one who answers there (S9)", () => {
    // The overseer's ruling is `{coach}` filled from `coach.name`, but this table stays
    // DEPENDENCY-FREE — the browser imports it raw and `src/frontend`'s reader renders `tell`
    // unfilled — so the name is written per language, and this assertion is the tether: the day
    // the confirmed per-language name table lands, coach.name changes here first and every `tell`
    // that still names the old one fails by name. A test is how a frozen table takes a variable.
    for (const lang of LANGS) {
      expect(FIRST_MEAL_COPY[lang]!.tell, lang).toContain(threadCopyFor(lang).coach.name);
      expect(FIRST_MEAL_COPY[lang]!.tell, lang).not.toMatch(/Spud|Спад/);
    }
  });

  it("import nothing a browser bundle would carry beyond types", () => {
    const src = readFileSync(new URL("./first-meal-copy.ts", import.meta.url), "utf8");
    const imports = [...src.matchAll(/^import\s+(type\s+)?.*from\s+"([^"]+)"/gm)];
    for (const [, isType, from] of imports) expect(`${isType ? "type " : ""}${from}`).toMatch(/^type /);
  });
});
