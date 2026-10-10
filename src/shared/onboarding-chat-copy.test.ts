import { describe, expect, it } from "bun:test";
import { LANGS, STRUGGLES, type Lang, type Profile } from "./types.ts";
import { MAX_DEFICIT_SHARE, MAX_SURPLUS_SHARE, MIN_AGE, RESTRICTION_TAGS, explainTargets } from "./targets.ts";
import { STRUGGLE_LABELS } from "./onboarding-chat.ts";
import { CHAT_COPY, chatCopyFor } from "./onboarding-chat-copy.ts";
import { threadCopyFor } from "./chat-copy.ts";
import { lintCopy } from "./claims.ts";
import {
  AMBIGUOUS_AGE, UNDER_AGE_CARD, belowHealthyCard, checkDirection, checkNumber,
  ontrackCaption, pacePreview, planRows, switchedLine,
} from "./onboarding-chat.ts";
import { DEFAULT_ONBOARDING_CONTENT } from "./onboarding.ts";

// The words around the questions. `onboarding.ts`'s copy is admin-editable; this is not — the
// refusals, the chart's accessible name and the captions carry numbers and branches a translator
// must not move. What is asserted here is that every branch has words in every language — a line
// that falls back to English mid-flow is the wart that reads as the app breaking.

describe("every language's chat copy", () => {
  it("has a refusal for every number field, so no refusal is wordless", () => {
    for (const lang of LANGS) {
      const invalid = chatCopyFor(lang).invalid;
      for (const field of ["age", "height_cm", "weight_kg", "target_weight_kg"] as const) {
        expect(invalid[field]?.trim(), `${lang}.invalid.${field}`).toBeTruthy();
      }
    }
  });

  it("names the coach through {coach} on the two captions that promise Chat, never a literal", () => {
    // S9: the support and ideas captions answer "who do I ask" with `coach.name`, so a rename
    // changes one key rather than sixteen strings. No caption may name the coach literally —
    // the day the name changes again, every one of these still fills from `coach.name`.
    for (const lang of LANGS) {
      const captions = chatCopyFor(lang).ontrack.captions;
      expect(captions.support, `${lang}.support`).toContain("{coach}");
      expect(captions.ideas, `${lang}.ideas`).toContain("{coach}");
      for (const s of STRUGGLES) {
        const said = ontrackCaption([s], lang)!;
        expect(said, `${lang}.${s}`).not.toMatch(/\{coach\}|Gabie|Габи/);
      }
      expect(ontrackCaption(["support"], lang), lang).toContain(threadCopyFor(lang).coach.name);
      expect(ontrackCaption(["ideas"], lang), lang).toContain(threadCopyFor(lang).coach.name);
    }
  });

  it("has a caption for every struggle, keyed by the id union", () => {
    // `Record<Struggle, string>` makes the compiler name the language that forgets one; this
    // asserts none of them is an empty string.
    for (const lang of LANGS) {
      for (const s of STRUGGLES) {
        expect(chatCopyFor(lang).ontrack.captions[s]?.trim(), `${lang}.ontrack.${s}`).toBeTruthy();
      }
    }
  });

  it("has the new beats' words — how, health, the Continue button — in every language", () => {
    for (const lang of LANGS) {
      const c = chatCopyFor(lang);
      expect(c.continueLabel.trim(), `${lang}.continue`).toBeTruthy();
      expect(c.how.title.trim(), `${lang}.how`).toBeTruthy();
      expect(c.how.steps, `${lang}.how.steps`).toHaveLength(3);
      for (const key of ["title", "body", "connect", "skip"] as const) {
        expect(c.health[key].trim(), `${lang}.health.${key}`).toBeTruthy();
      }
    }
  });

  it("has every chart word, in every language — the a11y name most of all", () => {
    for (const lang of LANGS) {
      const ch = chatCopyFor(lang).chart;
      for (const key of ["byEait", "weightTrend", "without", "now", "later", "twoWays",
        "estimatedProgress", "estimate", "target", "monthEstimate"] as const) {
        expect(ch[key].trim(), `${lang}.chart.${key}`).toBeTruthy();
      }
      expect(ch.target, `${lang}.chart.target`).toContain("{weight}");
      expect(ch.monthEstimate, `${lang}.chart.monthEstimate`).toContain("{month}");
    }
  });

  it("keeps every placeholder code fills, and introduces none it does not", () => {
    const known = new Set([
      "share", "age", "kg", "year", "weight", "target", "n", "label", "pct", "month",
      "rate", "kcal", "floor", "delta", "from", "to", "coach",
    ]);
    for (const lang of LANGS) {
      for (const [at, text] of Object.entries(flatten(chatCopyFor(lang)))) {
        for (const m of text.matchAll(/\{(\w+)\}/g)) {
          expect(known.has(m[1]!), `${lang}.${at} uses {${m[1]}}`).toBe(true);
        }
      }
    }
    for (const lang of LANGS) {
      const copy = chatCopyFor(lang);
      expect(copy.underAgeCard.title, lang).toContain("{age}");
      expect(copy.belowHealthy.body, lang).toContain("{kg}");
      expect(copy.ambiguousAge.line, lang).toContain("{year}");
      expect(copy.ambiguousAge.confirm, lang).toContain("{age}");
      expect(copy.capNoteTail, lang).toContain("{kg}");
      for (const k of ["gain", "lose"] as const) {
        expect(copy.direction[k], `${lang}.direction.${k}`).toContain("{weight}");
        expect(copy.direction[k], `${lang}.direction.${k}`).toContain("{target}");
      }
      // THE SWEEP ALONE DOES NOT HOLD THESE. The unknown-name half passes any name on the shared
      // list, so renaming `{weight}` to `{rate}` here would be green AND render a literal
      // `{rate}` on the pace screen. Each placeholder a reader fills is pinned by name.
      expect(copy.direction.above, `${lang}.direction.above`).toContain("{weight}");
      expect(copy.direction.below, `${lang}.direction.below`).toContain("{weight}");
      expect(copy.underAge.endedPlaceholder, `${lang}.underAge.endedPlaceholder`).toContain("{age}");
      expect(copy.underAge.stopped[1], `${lang}.underAge.stopped[1]`).toContain("{age}");
      // The pace line and its markers, the goal lines, the target ruler's markers.
      expect(copy.pace.result, `${lang}.pace.result`).toContain("{target}");
      expect(copy.pace.result, `${lang}.pace.result`).toContain("{month}");
      expect(copy.pace.result, `${lang}.pace.result`).toContain("{kcal}");
      expect(copy.pace.rate, `${lang}.pace.rate`).toContain("{rate}");
      expect(copy.pace.floorMarker, `${lang}.pace.floorMarker`).toContain("{floor}");
      expect(copy.plan.goalLose, `${lang}.plan.goalLose`).toContain("{delta}");
      expect(copy.plan.goalLose, `${lang}.plan.goalLose`).toContain("{month}");
      for (const k of ["lowest", "now", "deltaDown", "deltaUp"] as const) {
        expect(copy.target[k], `${lang}.target.${k}`).toContain("{weight}");
      }
      // The two On-track captions that promise Chat name her through `{coach}` (S9).
      expect(copy.ontrack.captions.support, `${lang}.ontrack.support`).toContain("{coach}");
      expect(copy.ontrack.captions.ideas, `${lang}.ontrack.ideas`).toContain("{coach}");
    }
  });
});

describe("the readers of those tables", () => {
  const today = new Date("2026-09-24T12:00:00Z");
  const her = (lang: Lang): Profile => ({
    user_id: "u1", lang, goal: "lose", sex: "female", birth_year: 1994, height_cm: 172,
    weight_kg: 74, weight_measured_at: null, target_weight_kg: 68, activity: "few",
    pace: "steady", units: null, struggles: ["consistency"], streak_goal_days: null, milestone_celebrations: true, streak_on_home: true, country: "gb",
    restrictions: ["vegan", "ldl"], medical_limitations: null, food_allergies: null,
    product_limitations: null, onboarded_at: null,
  });

  it("say every branch in the asked language, with nothing left to fill", () => {
    for (const lang of LANGS) {
      const p = her(lang);
      const preview = pacePreview(p, "steady", today, lang)!;
      const said = [
        switchedLine("gain", lang), switchedLine("lose", lang),
        UNDER_AGE_CARD(lang).title,
        belowHealthyCard(58, lang).body,
        AMBIGUOUS_AGE(lang).line(90), AMBIGUOUS_AGE(lang).confirm(90),
        checkDirection("gain", 93, 88, lang)!.line,
        checkDirection("lose", 93, 95, lang)!.line,
        ontrackCaption(p.struggles, lang)!,
        preview.line!,
        ...planRows(p, explainTargets(p, today).targets, DEFAULT_ONBOARDING_CONTENT, lang)
          .flatMap((r) => [r.label, r.value]),
      ];
      for (const [i, line] of said.entries()) {
        expect(line, `${lang}[${i}]`).toBeTruthy();
        expect(line, `${lang}[${i}]`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("quotes the minimum age the code enforces, in every language", () => {
    for (const lang of LANGS) {
      expect(UNDER_AGE_CARD(lang).title, lang).toContain(String(MIN_AGE));
    }
    expect(Math.round(MAX_DEFICIT_SHARE * 100)).toBeGreaterThan(0);
    expect(Math.round(MAX_SURPLUS_SHARE * 100)).toBeGreaterThan(0);
  });

  it("refuses a bad number with words in the reader's language", () => {
    for (const lang of LANGS) {
      const bad = checkNumber("height_cm", "nonsense", lang, new Date());
      expect(bad.ok).toBe(false);
      if (!bad.ok && "line" in bad) expect(bad.line).toBe(chatCopyFor(lang).invalid.height_cm);
    }
  });

  it("writes its figures in the reader's grouping — the German never reads 1,454", () => {
    expect(checkDirection("gain", 93.5, 90, "de")!.line).toContain("93,5");
    expect(checkDirection("gain", 93.5, 90, "en")!.line).toContain("93.5");
  });

  it("labels the struggle chips from the screen's own options", () => {
    for (const lang of LANGS) {
      for (const tag of RESTRICTION_TAGS) expect(typeof tag).toBe("string");
      expect(Object.keys(STRUGGLE_LABELS(DEFAULT_ONBOARDING_CONTENT)).sort())
        .toEqual([...STRUGGLES].sort());
    }
  });

  it("carries no claim the linter would refuse — every new template, every language", () => {
    // lintCopy over every rendered string the new surfaces can show: the captions, the pace line
    // with its placeholders filled, the chart words, the how/health beats.
    //
    // ONE SCOPED EXEMPTION, the same one `ONBOARDING_CLAIM_RULES` makes: `weight-promise` cannot
    // tell "lose 6kg" the user's own stated goal (the plan card echoes it back) from a promise.
    // `direction`, `plan`, `switched`, `goalEdit`, `belowHealthy` and `invalid` all quote the
    // user's own numbers back at them — they are out of the sweep for exactly that reason.
    // `planGoal` is out by S6's own published exemption — `CLAIM_EXEMPTIONS` names the qualified
    // key `CHAT_COPY.planGoal`, which is exactly this table flattened, so `lintCopy` alone would
    // not carry the qualifier through.
    const EXEMPT = /^(direction|plan|planGoal|switched|goalEdit|belowHealthy|invalid|ambiguousAge|underAge|underAgeCard|capNoteTail|targetSuggestion|target)\./;
    const FILL = {
      weight: "68kg", target: "68kg", delta: "6kg", month: "January 2027", kcal: "1,434",
      rate: "0.4kg", floor: "1,200", share: "20", age: "16", kg: "58", year: "1990",
      n: "13", label: "0–2", pct: "8", coach: "Gabie",
    };
    const filled = (s: string) =>
      s.replace(/\{(\w+)\}/g, (_, k: string) => FILL[k as keyof typeof FILL] ?? "X");
    for (const lang of LANGS) {
      const fields: Record<string, string> = {};
      for (const [at, text] of Object.entries(flatten(chatCopyFor(lang)))) {
        if (!EXEMPT.test(at)) fields[at] = filled(text);
      }
      const violations = lintCopy(fields).map((v) => `${v.field}: ${v.pattern} "${v.span}"`);
      expect(violations, lang).toEqual([]);
    }
  });
});

describe("the under-16 stop (#65)", () => {
  const OLD = [
    "there is no account to delete", "il n'y a aucun compte à supprimer", "es gibt kein Konto zu löschen",
    "non c'è nessun account da cancellare", "no hay ninguna cuenta que borrar", "không có tài khoản nào để xoá",
    "tidak ada akun yang perlu dihapus", "удалять нечего",
  ];
  it("says what is happening — the delete — in every language, and never that there is no account", () => {
    expect(chatCopyFor("en").underAge.stopped[0]).toBe("Then this is where we stop. I'm deleting everything you told me.");
    for (const lang of LANGS) {
      const line = chatCopyFor(lang).underAge.stopped[0]!;
      for (const old of OLD) expect(line, lang).not.toContain(old);
      expect(line, lang).not.toMatch(/\b(sent|envoyé|geschickt|mandato|enviado|gửi|dikirim|отправля)/i);
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
