import { describe, expect, it } from "bun:test";
import { LANGS, type Profile } from "./types.ts";
import { MAX_DEFICIT_SHARE, MAX_SURPLUS_SHARE, MIN_AGE, RESTRICTION_TAGS } from "./targets.ts";
import { ACTIVITY_LEVELS } from "./types.ts";
import { STRUGGLES, supportMoment } from "./onboarding-chat.ts";
import { CHAT_COPY, chatCopyFor } from "./onboarding-chat-copy.ts";
import { onboardingContentFor } from "./onboarding-content.ts";
import { lintCopy } from "./claims.ts";
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

  it("puts no crowd statistic on a struggle card, in any language (#50)", () => {
    // The card stands under the reader's OWN pick, so a number about other people does not
    // belong there: no percentages, no study counts, and no `source` line to cite one.
    for (const lang of LANGS) {
      const copy = chatCopyFor(lang);
      for (const s of STRUGGLES) {
        const card = copy.struggleCards[s]!;
        expect(card.body, `${lang}.struggleCards.${s}.body`).not.toMatch(/[\d%]/);
        expect(card.source, `${lang}.struggleCards.${s}`).toBeUndefined();
      }
      expect(copy.dietsGainCard.body, `${lang}.dietsGainCard.body`).not.toMatch(/[\d%]/);
      expect(copy.dietsGainCard.source, `${lang}.dietsGainCard`).toBeUndefined();
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
    const known = new Set(["share", "age", "kg", "bmr", "year", "weight", "target", "n", "label", "pct", "month"]);
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
      // THE FOUR THE SWEEP ALONE DOES NOT HOLD. The unknown-name half passes any name on the
      // shared list, so renaming `{weight}` to `{bmr}` here was green AND rendered a literal
      // `{bmr}` in the box the user is about to type their goal weight into. Deleting it was
      // green too, and hard-coded one language's number.
      expect(copy.direction.above, `${lang}.direction.above`).toContain("{weight}");
      expect(copy.direction.below, `${lang}.direction.below`).toContain("{weight}");
      expect(copy.underAge.endedPlaceholder, `${lang}.underAge.endedPlaceholder`).toContain("{age}");
      expect(copy.underAge.stopped[1], `${lang}.underAge.stopped[1]`).toContain("{age}");
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

describe("the v5 additions to the chat copy", () => {
  it("has the Health offer's words in every language", () => {
    for (const lang of LANGS) {
      const h = chatCopyFor(lang).health;
      for (const key of ["ask", "connect", "manual", "connected", "partial", "denied"] as const) {
        expect(h[key]?.trim(), `${lang}.health.${key}`).toBeTruthy();
      }
      expect(h.rows, lang).toHaveLength(3);
      for (const [i, row] of h.rows.entries()) expect(row.trim(), `${lang}.health.rows[${i}]`).toBeTruthy();
    }
  });

  it("has a suggestion line, a reaction set and the four moments, in every language", () => {
    for (const lang of LANGS) {
      const copy = chatCopyFor(lang);
      expect(copy.targetSuggestion.down, `${lang}.targetSuggestion.down`).toContain("{kg}");
      expect(copy.targetSuggestion.down, `${lang}.targetSuggestion.down`).toContain("{pct}");
      expect(copy.targetSuggestion.up, `${lang}.targetSuggestion.up`).toContain("{kg}");
      expect(copy.healthActivity, `${lang}.healthActivity`).toContain("{n}");
      expect(copy.healthActivity, `${lang}.healthActivity`).toContain("{label}");
      for (const [at, text] of Object.entries(flatten(copy.reactions))) {
        expect(text.trim(), `${lang}.reactions.${at}`).toBeTruthy();
      }
      for (const [at, text] of Object.entries(flatten(copy.moments))) {
        expect(text.trim(), `${lang}.moments.${at}`).toBeTruthy();
      }
    }
  });

  it("carries no claim the linter would refuse, in any language, in any moment", () => {
    // The moments are full screens — headline, two sentences, a button — which makes them the
    // loudest copy in the walk, and the claim rules apply to them the same as to the landing.
    for (const lang of LANGS) {
      const fields: Record<string, string> = {};
      const put = (at: string, m: { echo: string; title: string; body: string; cta: string } | null) => {
        if (!m) return;
        fields[`${at}.echo`] = m.echo;
        fields[`${at}.title`] = m.title;
        fields[`${at}.body`] = m.body;
        fields[`${at}.cta`] = m.cta;
      };
      const p = (over: Partial<Profile> = {}) => ({
        user_id: "u1", lang, goal: "lose", sex: "female", birth_year: 1994, height_cm: 172,
        weight_kg: 74, weight_measured_at: null, target_weight_kg: 68, activity: "light",
        pace: "steady", country: "gb",
        restrictions: ["ldl"], medical_limitations: null, food_allergies: null,
        product_limitations: null, onboarded_at: null, ...over,
      }) as Profile;
      const content = onboardingContentFor(lang);
      put("target.inBand", supportMoment("target", { profile: p(), struggles: [], lang, content }));
      put("target.neutral", supportMoment("target", { profile: p({ target_weight_kg: 60 }), struggles: [], lang, content }));
      put("target.gain", supportMoment("target", { profile: p({ goal: "gain", target_weight_kg: 78 }), struggles: [], lang, content }));
      put("activity", supportMoment("activity", { profile: p(), struggles: [], lang, content }));
      for (const s of STRUGGLES) {
        for (const goal of ["lose", "gain", "maintain"] as const) {
          put(`struggles.${s}.${goal}`, supportMoment("struggles", { profile: p({ goal }), struggles: [s], lang, content }));
        }
      }
      put("restrictions.some", supportMoment("restrictions", { profile: p(), struggles: [], lang, content }));
      put("restrictions.none", supportMoment("restrictions", { profile: p({ restrictions: [] }), struggles: [], lang, content }));
      const violations = lintCopy(fields).map((v) => `${v.field}: ${v.pattern} "${v.span}"`);
      expect(violations, lang).toEqual([]);
    }
  });
});
