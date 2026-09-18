import { describe, expect, it } from "bun:test";
import { LANGS } from "./types.ts";
import { MAX_DEFICIT_SHARE, MAX_SURPLUS_SHARE, MIN_AGE, RESTRICTION_TAGS } from "./targets.ts";
import { ACTIVITY_LEVELS } from "./types.ts";
import { STRUGGLES } from "./onboarding-chat.ts";
import { CHAT_COPY, chatCopyFor } from "./onboarding-chat-copy.ts";
import {
  ACTIVITY_REPLIES, AMBIGUOUS_AGE, GAIN_PACE_CARD, GOAL_CARDS, STRUGGLE_LABELS, UNDER_AGE_CARD,
  belowHealthyCard, checkDirection, checkNumber, restrictionsReply, struggleCard, strugglesCloser,
  switchedLine, weightAck,
} from "./onboarding-chat.ts";

// The conversation around the questions. `onboarding.ts`'s copy is admin-editable; this is not,
// because it carries sourced statistics and a translator's typo in one is an unsubstantiated health
// claim on every phone. So it is code, and what is asserted here is that every branch has words in
// every language — a reply that falls back to English mid-conversation is the wart that reads as
// the app breaking.

describe("every language's chat copy", () => {
  it("has a label for every struggle chip, and a card behind it", () => {
    for (const lang of LANGS) {
      const copy = chatCopyFor(lang);
      for (const s of STRUGGLES) {
        expect(copy.struggles[s]?.trim(), `${lang}.struggles.${s}`).toBeTruthy();
        expect(copy.struggleCards[s]?.title.trim(), `${lang}.struggleCards.${s}.title`).toBeTruthy();
        expect(copy.struggleCards[s]?.body.trim(), `${lang}.struggleCards.${s}.body`).toBeTruthy();
      }
    }
  });

  it("has a reply for every activity level this binary offers", () => {
    for (const lang of LANGS) {
      for (const level of ACTIVITY_LEVELS) {
        expect(chatCopyFor(lang).activityReplies[level]?.trim(), `${lang}.${level}`).toBeTruthy();
      }
    }
  });

  it("has a refusal for every number field, so no refusal is wordless", () => {
    for (const lang of LANGS) {
      const invalid = chatCopyFor(lang).invalid;
      for (const field of ["age", "height_cm", "weight_kg", "target_weight_kg"] as const) {
        expect(invalid[field]?.trim(), `${lang}.invalid.${field}`).toBeTruthy();
      }
    }
  });

  it("keeps every placeholder code fills, and introduces none it does not", () => {
    const known = new Set(["share", "age", "kg", "bmr", "year", "weight", "target"]);
    for (const lang of LANGS) {
      for (const [at, text] of Object.entries(flatten(chatCopyFor(lang)))) {
        for (const m of text.matchAll(/\{(\w+)\}/g)) {
          expect(known.has(m[1]!), `${lang}.${at} uses {${m[1]}}`).toBe(true);
        }
      }
    }
    for (const lang of LANGS) {
      const copy = chatCopyFor(lang);
      expect(copy.gainPaceCard.body, lang).toContain("{share}");
      expect(copy.underAgeCard.title, lang).toContain("{age}");
      expect(copy.belowHealthy.body, lang).toContain("{kg}");
      expect(copy.weightAck.bmr, lang).toContain("{bmr}");
      expect(copy.ambiguousAge.line, lang).toContain("{year}");
      expect(copy.ambiguousAge.confirm, lang).toContain("{age}");
      expect(copy.capNoteTail, lang).toContain("{kg}");
      for (const k of ["gain", "lose"] as const) {
        expect(copy.direction[k], `${lang}.direction.${k}`).toContain("{weight}");
        expect(copy.direction[k], `${lang}.direction.${k}`).toContain("{target}");
      }
    }
  });
});

describe("the readers of those tables", () => {
  it("say every branch in the asked language, with nothing left to fill", () => {
    for (const lang of LANGS) {
      const said = [
        ...weightAck(1700, lang),
        ...weightAck(null, lang),
        strugglesCloser(0, lang), strugglesCloser(1, lang), strugglesCloser(2, lang),
        ...restrictionsReply(["kidneys", "ldl"], true, lang),
        ...restrictionsReply(["vegan"], false, lang),
        ...restrictionsReply([], false, lang),
        switchedLine("gain", lang), switchedLine("lose", lang),
        GOAL_CARDS(lang).lose.body, struggleCard("diets", "gain", lang).body,
        GAIN_PACE_CARD(lang).body, UNDER_AGE_CARD(lang).title,
        belowHealthyCard(58, lang).body,
        AMBIGUOUS_AGE(lang).line(90), AMBIGUOUS_AGE(lang).confirm(90),
        ACTIVITY_REPLIES(lang).athlete!,
        STRUGGLE_LABELS(lang).binge,
        checkDirection("gain", 93, 88, lang)!.line,
        checkDirection("lose", 93, 95, lang)!.line,
      ];
      for (const [i, line] of said.entries()) {
        expect(line, `${lang}[${i}]`).toBeTruthy();
        expect(line, `${lang}[${i}]`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("quotes the share caps the arithmetic actually applies, in every language", () => {
    // A safety guarantee described in copy that the code does not implement is the worst sentence
    // this repo could ship — so the percentage is READ from the constant, in all eight.
    for (const lang of LANGS) {
      expect(GAIN_PACE_CARD(lang).body, lang).toContain(String(Math.round(MAX_SURPLUS_SHARE * 100)));
      expect(UNDER_AGE_CARD(lang).title, lang).toContain(String(MIN_AGE));
    }
    expect(Math.round(MAX_DEFICIT_SHARE * 100)).toBeGreaterThan(0);
  });

  it("refuses a bad number with words in the reader's language", () => {
    for (const lang of LANGS) {
      const bad = checkNumber("height_cm", "nonsense", lang, new Date());
      expect(bad.ok).toBe(false);
      if (!bad.ok && "line" in bad) expect(bad.line).toBe(chatCopyFor(lang).invalid.height_cm);
    }
  });

  it("writes its figures in the reader's grouping — the German never reads 1,454", () => {
    // `checkDirection` quotes the weights back. 1454 is not a weight, but the grouping rule is the
    // same one every figure in the thread follows, and the wrong one turns 1.5 kg into 15.
    expect(checkDirection("gain", 93.5, 90, "de")!.line).toContain("93,5");
    expect(checkDirection("gain", 93.5, 90, "en")!.line).toContain("93.5");
  });

  it("labels the struggle chips for a card the user is about to be shown", () => {
    for (const lang of LANGS) {
      for (const tag of RESTRICTION_TAGS) expect(typeof tag).toBe("string");
      expect(Object.keys(STRUGGLE_LABELS(lang)).sort()).toEqual([...STRUGGLES].sort());
    }
  });
});

/** Every string in the table, keyed well enough to name in a failure. */
function flatten(node: unknown, at = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === "string") { out[at] = node; return out; }
  if (Array.isArray(node)) { node.forEach((v, i) => flatten(v, `${at}[${i}]`, out)); return out; }
  if (typeof node === "object" && node !== null) {
    for (const [k, v] of Object.entries(node)) flatten(v, at === "" ? k : `${at}.${k}`, out);
  }
  return out;
}
