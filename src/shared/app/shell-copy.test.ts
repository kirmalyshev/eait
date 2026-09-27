// The shell's words: the nav labels every client draws (#87). Completeness in all eight languages
// is `localizedGaps`' job in `copy.i18n.test.ts` — this file holds the table's own contract: the
// keys exist, and the labels are the boards' words.

import { describe, expect, it } from "bun:test";
import { LANGS, type Lang } from "../types.ts";
import { SHELL_COPY, shellCopyFor } from "./shell-copy.ts";

describe("SHELL_COPY", () => {
  it("has every nav label in every language", () => {
    for (const lang of LANGS) {
      const copy = SHELL_COPY[lang];
      expect(copy, lang).toBeDefined();
      for (const key of ["navHome", "navProgress", "navChat", "navProfile", "logMeal"] as const) {
        expect(copy![key].length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("draws the boards' labels in English", () => {
    const en = shellCopyFor("en" as Lang);
    expect(en.navHome).toBe("Home");
    expect(en.navProgress).toBe("Progress");
    expect(en.navChat).toBe("Chat");
    expect(en.navProfile).toBe("Profile");
  });
});
