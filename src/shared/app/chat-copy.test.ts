// The chat surface's words (W7 #94). Completeness in all eight languages is `localizedGaps`' job
// in `copy.i18n.test.ts`; this file holds the table's own contract: the keys exist, the
// placeholders survive every language, the English is the boards' words, and the claims linter
// passes over every rendered string.

import { describe, expect, it } from "bun:test";
import { lintCopy } from "../claims.ts";
import { LANGS, type Lang } from "../types.ts";
import { STRUGGLES, type Struggle } from "../types.ts";
import {
  CHAT_SCREEN_COPY, chatScreenCopyFor, coachRowIcon, starterRows, STARTER_ICONS,
  type ChatScreenCopy,
} from "./chat-copy.ts";
import { starterRowsFor } from "../chat.ts";

const flatten = (node: unknown, at = "", out: Record<string, string> = {}): Record<string, string> => {
  if (typeof node === "string") { out[at] = node; return out; }
  if (node && typeof node === "object") {
    for (const [k, v] of Object.entries(node)) flatten(v, at === "" ? k : `${at}.${k}`, out);
  }
  return out;
};

describe("CHAT_SCREEN_COPY", () => {
  it("has every key in every language", () => {
    const enKeys = Object.keys(flatten(CHAT_SCREEN_COPY.en)).sort();
    for (const lang of LANGS) {
      const copy = CHAT_SCREEN_COPY[lang];
      expect(copy, lang).toBeDefined();
      const flat = flatten(copy);
      expect(Object.keys(flat).sort(), lang).toEqual(enKeys);
      for (const [k, v] of Object.entries(flat)) {
        expect(v.length, `${lang}.${k}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every placeholder in every language", () => {
    // `{coach}` is the coach's name (THREAD_COPY's `coach.name`, S9); `{value}`/`{target}`/`{n}`
    // are figures filled by the caller. A translation that drops one renders the hole literally.
    const withPlaceholders: Record<string, string[]> = {
      composerThread: ["{coach}"],
      macroEaten: ["{value}"],
      macroTarget: ["{target}", "{unit}"],
      movedCaption: ["{day}"],
      "phone.photoCaption": ["{caption}"],
      "phone.refusals.longTextNote": ["{max}"],
      "phone.refusals.longNoteNote": ["{max}"],
      mealLine: ["{name}", "{kcal}"],
      "phone.typing": ["{coach}"],
    };
    for (const lang of LANGS) {
      const flat = flatten(CHAT_SCREEN_COPY[lang]);
      for (const [key, placeholders] of Object.entries(withPlaceholders)) {
        for (const ph of placeholders) {
          expect(flat[key], `${lang}.${key}`).toContain(ph);
        }
      }
    }
  });

  it("draws the boards' words in English", () => {
    const en: ChatScreenCopy = chatScreenCopyFor("en" as Lang);
    expect(en.greeting).toBe("Tell me what you ate, or ask me anything.");
    expect(en.composerAsk).toBe("What did you eat?");
    expect(en.composerThread).toBe("Tell {coach} what you ate, or ask");
    expect(en.proposalCheck).toBe("Logging to today — look right?");
    expect(en.proposalAccept).toBe("Log it");
    expect(en.proposalDecline).toBe("No");
    expect(en.loadFailed).toBe("Couldn't load the conversation.");
    expect(en.tryAgain).toBe("Try again");
    expect(en.offlineTitle).toBe("Couldn't reach eait.");
    expect(en.offlineBody).toBe("Nothing was logged.");
    expect(en.sendAgain).toBe("Send again");
    expect(en.waitingToSend).toBe("Waiting to send");
    expect(en.unknownTitle).toBe("That didn't finish cleanly.");
    expect(en.analysisFailed).toBe("The analysis didn't come back.");
    expect(en.phone.notSent).toBe("Not sent. It's back in the box.");
    expect(en.expired).toBe("That one timed out. Describe it again and I'll re-read it.");
  });

  it("shows the catalog's own starter words — every language, every struggle set", () => {
    // The bundle's table restates THREAD_COPY because it cannot reach Lingui (#145): the check
    // that keeps it honest is the catalog's `starterRowsFor` producing the same rows, text for
    // text, for every language and every subset an onboarding can set.
    const sets: (readonly Struggle[] | null)[] = [
      null,
      STRUGGLES,
      ["busy", "ideas"] as const,
      ["support", "consistency", "habits"] as const,
      ["ideas"] as const,
    ];
    for (const lang of LANGS) {
      for (const set of sets) {
        const expected = starterRowsFor(set, lang).map((r) => r.text);
        const actual = starterRows(set, lang).map((r) => r.text);
        expect(actual, `${lang} ${String(set)}`).toEqual(expected);
        expect(starterRows(set, lang).map((r) => STARTER_ICONS[r.struggle]))
          .toEqual(starterRowsFor(set, lang).map((r) => STARTER_ICONS[r.struggle]));
      }
    }
  });

  it("pairs each starter with its board icon, the struggles in the same order as startersFor", () => {
    const rows = starterRowsFor(["busy", "ideas"], "en" as Lang);
    expect(rows.map((r) => r.text)).toEqual([
      "I'll just tell you what I ate", "What should I eat tonight?", "How's my week going?",
    ]);
    expect(rows.map((r) => STARTER_ICONS[r.struggle])).toEqual(["busy", "ideas", "consistency"]);
  });

  it("gives a coach row the starter's icon, a named macro's icon, or ideas", () => {
    expect(coachRowIcon("How's my week going?", "en" as Lang)).toBe("consistency");
    expect(coachRowIcon("Am I getting enough protein?", "en" as Lang)).toBe("protein");
    expect(coachRowIcon("which meal had the most Fat?", "en" as Lang)).toBe("fat");
    // Whole words only — "father" is not "fat", and an inflected form ("белка" ≠ "Белок") is not
    // the label either; an unrecognised row reads `ideas`.
    expect(coachRowIcon("what should I cook?", "en" as Lang)).toBe("ideas");
    expect(coachRowIcon("Сколько БЕЛОК сегодня?", "ru" as Lang)).toBe("protein");
  });

  it("carries no claim the linter would refuse — every language", () => {
    // The figures and the coach's name filled, as a render would. Russian's declension sits inside
    // templates, so the sweep reads the same strings the screen shows.
    const FILL: Record<string, string> = { coach: "Gabie", value: "54", target: "109", n: "34" };
    const filled = (s: string) => s.replace(/\{(\w+)\}/g, (_, k: string) => FILL[k] ?? "X");
    for (const lang of LANGS) {
      const fields: Record<string, string> = {};
      for (const [at, text] of Object.entries(flatten(CHAT_SCREEN_COPY[lang]))) {
        fields[at] = filled(text);
      }
      const violations = lintCopy(fields).map((v) => `${v.field}: ${v.pattern} "${v.span}"`);
      expect(violations, lang).toEqual([]);
    }
  });
});
