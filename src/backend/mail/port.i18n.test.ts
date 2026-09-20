import { describe, expect, it } from "bun:test";
import { LANGS, lintCopy } from "@eait/shared";
import { confirmationMessage } from "./port.ts";

const URL_IN = "https://eait.fit/v1/subscribe/confirm?t=abc123";

describe("the confirmation email in eight languages", () => {
  it("carries the link, and carries it once", () => {
    for (const lang of LANGS) {
      const { text } = confirmationMessage(URL_IN, lang);
      expect(text.split(URL_IN).length - 1, lang).toBe(1);
      expect(text, lang).not.toMatch(/\{\w+\}/);
    }
  });

  it("has a subject in the reader's language, not just a body", () => {
    // A confirmation whose subject is in a language the reader does not have is indistinguishable
    // from spam in an inbox, which is the one place this message has to survive.
    const subjects = LANGS.map((l) => confirmationMessage(URL_IN, l).subject);
    for (const [i, s] of subjects.entries()) expect(s.trim(), LANGS[i]).not.toBe("");
    expect(new Set(subjects).size).toBe(LANGS.length);
  });

  it("keeps the sentence that makes ignoring it a complete answer", () => {
    // "Nothing happens, and the address is deleted within a week." Until the link is clicked the
    // address is on no list, and that promise is what makes this email lawful to send unasked.
    // Counted by SHAPE — eight lines, two of them blank separators — rather than by matching prose
    // no English regex can check in Vietnamese.
    //
    // THE SHAPE IS NOW BUILT IN CODE, not carried in the catalog, and this test is why that is
    // safe rather than merely tidier: the blank lines and the link were eight×three strings a
    // translator could silently drop, and a PO editor does not even display an empty message.
    for (const lang of LANGS) {
      const lines = confirmationMessage(URL_IN, lang).text.split("\n");
      expect(lines.length, lang).toBe(8);
      expect(lines[1], lang).toBe("");
      expect(lines[3], lang).toBe(URL_IN);
      expect(lines[5]!.length, lang).toBeGreaterThan(40);
      expect(lines[7]!.length, lang).toBeGreaterThan(40);
    }
  });

  it("says something different in each of the eight, rather than eight copies of a fallback", () => {
    // A MISSING TRANSLATION IS INVISIBLE HERE OTHERWISE. `lingui compile` writes the English
    // source into any catalog that has no translation for an id — fallback at the key, exactly as
    // `Localized<T>` did — so a catalog nobody filled renders a complete, correct English email
    // and every assertion above passes. This is the one that would fail.
    const bodies = LANGS.map((l) => confirmationMessage(URL_IN, l).text);
    expect(new Set(bodies).size, "two languages send the same words").toBe(LANGS.length);
  });

  it("passes the claims gate in English, which is the language the gate can read", () => {
    const en = confirmationMessage(URL_IN, "en");
    expect(lintCopy({ subject: en.subject, text: en.text })).toEqual([]);
  });
});
