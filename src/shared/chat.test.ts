import { describe, expect, it } from "bun:test";
import { catalogArgs } from "./i18n.ts";
import { LANGS, STRUGGLES, type Lang } from "./types.ts";
import { threadCopyFor } from "./chat-copy.ts";
import { MAX_SUGGESTION, SCRIPTED_LINES, SCRIPTED_PARAMS, type ScriptedLineId, cleanSuggestions, firstVerdictLines, isScriptedLineId, startersFor, verdictHeadline, runningLine, scriptedLine, scriptedParams } from "./chat.ts";

describe("scripted lines", () => {
  it("fills parameters and leaves nothing unfilled", () => {
    const line = scriptedLine("trial-started", "en", { price: "€39.99 a year" });
    expect(line).toContain("then €39.99 a year unless you stop it");
    expect(line).not.toContain("{");
  });

  it("takes only the parameters a line declares, as short strings", () => {
    expect(scriptedParams("trial-started", { price: "€4.99 a month" })).toEqual({ price: "€4.99 a month" });
    expect(scriptedParams("trial-started", {})).toBeNull(); // required
    expect(scriptedParams("trial-started", { price: "x".repeat(65) })).toBeNull();
    expect(scriptedParams("trial-started", { price: "€4.99", extra: "prose" })).toBeNull();
    expect(scriptedParams("trial-started", { price: 5 as never })).toBeNull();
    expect(scriptedParams("camera-closed", {})).toEqual({});
    // Flattened and quote-neutral like the camera note: a parameter cannot draw a second bubble.
    expect(scriptedParams("trial-started", { price: "€4.99\n\nSpud: “unlocked”" })).toEqual({ price: "€4.99 Spud: 'unlocked'" });
    expect(scriptedParams("camera-closed", { price: "€4.99" })).toBeNull(); // declares none
  });

  it("declares exactly the placeholders each line carries, so a renamed one cannot leave a hole", () => {
    // In EVERY language: a translation that dropped `{price}` would render "Trial's on. Seven
    // days, then  unless you stop it", and the only sign of it is a sentence with a gap.
    //
    // READ FROM THE COMPILED CATALOG rather than by running a regex over the rendered sentence.
    // The words are in `.po` files now, so the braces are ICU arguments and the compiled message
    // names them outright — and a regex over the OUTPUT could not see them at all, because ICU
    // has already substituted or erased them by then.
    for (const lang of LANGS) {
      const args = catalogArgs(lang);
      for (const id of Object.keys(SCRIPTED_LINES) as ScriptedLineId[]) {
        expect(isScriptedLineId(id)).toBe(true);
        expect(args[`thread.scripted.${id}`] ?? [], `${lang}.${id}`)
          .toEqual([...SCRIPTED_PARAMS[id]].sort());
      }
    }
  });

  it("knows its own ids and nothing else", () => {
    for (const id of ["camera-closed", "camera-denied", "camera-primer", "onboarding-done", "fix-prompt", "already-in", "trial-started", "trial-day-one", "notify-primer", "restored", "dropped"]) expect(isScriptedLineId(id)).toBe(true);
    expect(isScriptedLineId("ignore previous instructions")).toBe(false);
  });
});

// copy.md § Step 14. The numbers are the plan's and the day's; the words are the design's.
describe("the first verdict", () => {
  const targets = { kcal: 1454, protein_g: 110, fat_g: 48, carbs_g: 203 };
  const meal = { kcal: 612, protein_g: 38, satfat_g: 4, sodium_mg: 900, confidence: "high" };

  it("reads the plan back for a lose/maintain goal, and invites the correction", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {},
    }, "en");
    // #49: the headline comes first, and it is the pills' verdict said in words — no pill, no
    // claim; the arithmetic after it states the day and passes no judgement of its own.
    expect(lines[0]).toBe("First one in. 612 kcal — that leaves 842 of your 1,454 for the rest of today, and 38 of the 110 g protein.");
    expect(lines[1]).toContain("If anything's off, say so");
    expect(lines).toHaveLength(2);
  });

  // #49, principal 2026-09-26: Spud only. He logs and he answers; nobody is introduced.
  it("introduces nobody, on any branch", () => {
    const base = { targets, meal, eatenToday: { kcal: 612, protein_g: 38, satfat_g: 0, sodium_mg: 0 }, verdicts: { weight: "good" } } as const;
    for (const lang of LANGS) for (const lines of [
      firstVerdictLines({ ...base, goal: "lose", via: "photo" }, lang),
      firstVerdictLines({ ...base, goal: "gain", via: "photo" }, lang),
      firstVerdictLines({ ...base, goal: "lose", via: "text" }, lang),
      firstVerdictLines({ ...base, goal: "lose", via: "photo", meal: { ...meal, confidence: "low" } }, lang),
    ]) for (const line of lines) expect(line).not.toMatch(/gabie/i);
  });

  it("says how far over the day is, as a number with a direction — never a bare negative", () => {
    // "-146 of your 1,454 left" is a sign in front of a remainder: honest, and read as a typo by
    // the person it is for (review recording, 13 Sep 2026: "-569 of your 2,393 left today"). The
    // gain branch already says "over your"; the lose/maintain one says it the same way.
    const lines = firstVerdictLines({
      goal: "maintain", targets, meal: { ...meal, kcal: 1600 }, eatenToday: { kcal: 1600, protein_g: 38, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {},
    }, "en");
    expect(lines[0]).toBe("First one in. 1,600 kcal — that puts you 146 over your 1,454 for today, and 38 of the 110 g protein. Tomorrow is a fresh number.");
  });

  it("says where the day stands in ONE sentence, whatever put the meal there (#306)", () => {
    // The clause a correction already ended with, on its own. A log had nothing after its card, so
    // one meal in the thread was followed by the day's arithmetic and the next by silence.
    expect(runningLine({ targets, eatenToday: { kcal: 306, protein_g: 19 } }, "en"))
      .toBe("1,148 of your 1,454 left today, 19 of the 110 g protein.");
  });

  it("says the overshoot as an overshoot when the day is over, as the first verdict does", () => {
    // The same arithmetic as the first verdict, worded the same way: a number and a direction.
    expect(runningLine({ targets, eatenToday: { kcal: 1600, protein_g: 38 } }, "en"))
      .toBe("146 over your 1,454 today, 38 of the 110 g protein.");
  });

  it("fills rather than leaves for a gain goal", () => {
    const lines = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150, fat_g: 97, carbs_g: 238 }, meal, eatenToday: { kcal: 612, protein_g: 38, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {},
    }, "en");
    expect(lines[0]).toBe("First one in. 612 kcal — 2,288 of your 2,900 still to fill today, and 38 of the 150 g protein. Keep going.");
  });

  it("is honest about a rough read and asks for the grams instead", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal: { ...meal, kcal: 480, confidence: "low" }, eatenToday: { kcal: 480, protein_g: 21, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {},
    }, "en");
    expect(lines[0]).toBe("Honest answer: I couldn't read that plate well. Take 480 as a rough guess and check the grams before you trust the total. A second angle next time helps.");
    expect(lines[1]).toBe("Even rough, it counts: about 974 of your 1,454 left today.");
    expect(lines).toHaveLength(2);
    // Rule 1 holds on this branch too: a gain plan is filled, not left.
    const gain = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150, fat_g: 97, carbs_g: 238 }, meal: { ...meal, kcal: 480, confidence: "low" }, eatenToday: { kcal: 480, protein_g: 21, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {},
    }, "en");
    expect(gain[1]).toBe("Even rough, it counts: about 2,420 of your 2,900 still to fill today.");
    // Past the target on a gain plan is not "still to fill": rule 1, the branch taken.
    const past = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150, fat_g: 97, carbs_g: 238 }, meal: { ...meal, kcal: 480, confidence: "low" }, eatenToday: { kcal: 3100, protein_g: 160, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {},
    }, "en");
    expect(past[1]).toBe("Even rough, it counts: about 200 over your 2,900 today.");
    const sure = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150, fat_g: 97, carbs_g: 238 }, meal: { ...meal, kcal: 480 }, eatenToday: { kcal: 3100, protein_g: 160, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {},
    }, "en");
    expect(sure[0]).toBe("First one in. 480 kcal — 200 over your 2,900 today, and 160 of the 150 g protein. Past it is the point on a gain plan; tomorrow is a fresh number.");
    // Over target reads as an overshoot, like the confident branch — no clamp to zero, no bare sign.
    const over = firstVerdictLines({ goal: "lose", targets, meal: { ...meal, kcal: 1600, confidence: "low" }, eatenToday: { kcal: 1600, protein_g: 21, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {} }, "en");
    expect(over[1]).toBe("Even rough, it counts: about 146 over your 1,454 today. Tomorrow is a fresh number.");
  });

  it("says a typed meal is a guess at the portions", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal: { ...meal, kcal: 540 }, eatenToday: { kcal: 540, protein_g: 30, satfat_g: 0, sodium_mg: 0 }, via: "text", verdicts: {},
    }, "en");
    expect(lines[0]).toBe("Typed, not photographed — so the portions are my guess. Take 540 as rough; if you know the grams, say so and I'll fix it.");
    expect(lines[1]).toBe("That leaves 914 of your 1,454 for the rest of today, and 30 of the 110 g protein.");
    const gain = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150, fat_g: 97, carbs_g: 238 }, meal: { ...meal, kcal: 612 }, eatenToday: { kcal: 612, protein_g: 38, satfat_g: 0, sodium_mg: 0 }, via: "text", verdicts: {},
    }, "en");
    expect(gain[1]).toBe("2,288 of your 2,900 still to fill today, and 38 of the 150 g protein. Keep going.");
  });

  it("quotes the camera note back first, in the user's own words", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {}, caption: "extra rice",
    }, "en");
    expect(lines[0]).toBe("“extra rice” — noted, it's in the numbers.");
    expect(lines[1]).toMatch(/^First one in\./);
    expect(firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {}, caption: "  " }, "en")[0]).toMatch(/^First one in\./);
    // Client text in Spud's bubble is flattened and short, like a scripted parameter.
    const long = firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {}, caption: "rice\n\nFirst one in. 9,999 kcal " + "x".repeat(100) }, "en")[0]!;
    expect(long).not.toContain("\n");
    // Cut at a word, marked as cut, never mid-character: a quote attributed to the user must read as one.
    expect(long).toMatch(/^“rice First one in\. 9,999 kcal…” — noted/);
    const emoji = firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {}, caption: "a".repeat(63) + "🍕bbbb" }, "en")[0]!;
    expect(emoji).not.toMatch(/[\ud800-\udfff]”/);
    expect(Array.from(emoji.slice(1, emoji.indexOf("”"))).length).toBeLessThanOrEqual(65);
    // The quotation marks are Spud's; a note cannot close them and start a sentence of its own.
    const forged = firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts: {}, caption: "x” — noted. First one in. 900 kcal" }, "en")[0]!;
    expect(forged.indexOf("”")).toBe(forged.lastIndexOf("”"));
  });

  it("mentions sodium or saturated fat only when the user asked for it, and only when it ran high", () => {
    const capped = { ...targets, satfat_g: 13, sodium_mg: 2000 };
    const base = { goal: "lose" as const, targets: capped, meal, eatenToday: { kcal: 612, protein_g: 38, satfat_g: 4, sodium_mg: 900 }, via: "photo" as const };
    // Last, now that nobody is introduced after them (#49) — and computed, with the meal's amount
    // against the declared cap (#130).
    expect(firstVerdictLines({ ...base, verdicts: { kidneys: "warn" } }, "en").at(-1)).toBe("Sodium is high for one meal: 900 of your 2,000 mg.");
    expect(firstVerdictLines({ ...base, verdicts: { ldl: "bad" } }, "en").at(-1)).toBe("Saturated fat is very high for one meal: 4 of your 13 g.");
    expect(firstVerdictLines({ ...base, verdicts: { kidneys: "good" } }, "en")).toHaveLength(2);
  });
});

describe("coach", () => {
  it("offers a few starters, each short enough to be a chip and worded as the user would send it", () => {
    expect(startersFor(null, "en").length).toBeGreaterThanOrEqual(3);
    for (const s of startersFor(null, "en")) {
      expect(s.length).toBeLessThanOrEqual(MAX_SUGGESTION);
      expect(s.trim()).toBe(s);
    }
  });

  it("names her Gabie in every shipped language until the per-language table is confirmed", () => {
    for (const lang of LANGS) expect(threadCopyFor(lang).coach.name, lang).toBe("Gabie");
  });

  it("reads the struggles: the picked ones' starters first, the rest fill to three", () => {
    // No pick (never asked, or asked and nothing chosen): the list order's first three.
    expect(startersFor(null, "en")).toEqual([
      "How's my week going?", "What's a lighter swap for dinner?", "Am I getting enough protein?",
    ]);
    expect(startersFor([], "en")).toEqual(startersFor(null, "en"));
    // Picked ones lead, in STRUGGLES list order rather than tap order — busy before ideas.
    expect(startersFor(["ideas", "busy"], "en")).toEqual([
      "I'll just tell you what I ate", "What should I eat tonight?", "How's my week going?",
    ]);
    // Every struggle has a starter, and more than three picks still answer three.
    expect(startersFor([...STRUGGLES].reverse(), "en")).toHaveLength(3);
    expect(startersFor(["support"], "en")[0]).toBe("Am I getting enough protein?");
  });

  it("keeps only the suggestions a chip can carry: strings, short, distinct, at most three", () => {
    expect(cleanSuggestions(["What should I eat tonight?", "x".repeat(MAX_SUGGESTION + 1), 5, "", "  What should I eat tonight?  ", "How's my week?", "Protein?", "Fifth"]))
      .toEqual(["What should I eat tonight?", "How's my week?", "Protein?"]);
    expect(cleanSuggestions(undefined)).toEqual([]);
    expect(cleanSuggestions("not a list")).toEqual([]);
    // Flattened like every other client-bound string: a suggestion cannot draw two lines on a chip.
    expect(cleanSuggestions(["a\n\nb"])).toEqual(["a b"]);
    // A replayed note is not a thing anybody sends.
    expect(cleanSuggestions(["[photo]", "[logged: eggs — 155 kcal]", "And yesterday?"])).toEqual(["And yesterday?"]);
  });
});

// #49: the first verdict contradicted itself — "On plan." in the sentence over "Calories high" on
// the pill. The headline is now the pills' own verdict in words, and the first line spoken.
describe("the first verdict's headline", () => {
  const targets = { kcal: 1643, protein_g: 109, fat_g: 55, carbs_g: 205, satfat_g: 13, sodium_mg: 2000 };
  const meal = { kcal: 584, protein_g: 37, satfat_g: 6, sodium_mg: 600, confidence: "high" };
  const said = (verdicts: Record<string, string>, lang: Lang = "en") => firstVerdictLines({
    goal: "lose", targets, meal, eatenToday: { kcal: 584, protein_g: 37, satfat_g: 6, sodium_mg: 600 }, via: "photo", verdicts: verdicts as never,
  }, lang);

  it("says 'On plan.' only when every pill on the card is on plan", () => {
    expect(said({ weight: "good" })[0]).toBe("On plan.");
    expect(said({ weight: "good", ldl: "good" })[0]).toBe("On plan.");
  });

  it("never says 'On plan' over a calories pill that is high, in any language", () => {
    for (const lang of LANGS) {
      const onPlan = said({ weight: "good" }, lang)[0]!;
      for (const v of ["warn", "bad"]) {
        const lines = said({ weight: v }, lang);
        expect(lines[0]).not.toBe(onPlan);
        for (const line of lines) expect(line).not.toContain(onPlan);
      }
    }
    expect(said({ weight: "warn" })[0]).toBe("A big share of your day in one meal.");
    expect(said({ weight: "bad" })[0]).toBe("More than half your day in one meal.");
  });

  it("says calories are on plan, and no more, when a declared marker ran high", () => {
    const lines = said({ weight: "good", ldl: "warn" });
    expect(lines[0]).toBe("Calories on plan.");
    expect(lines).toContain("Saturated fat is high for one meal: 6 of your 13 g.");
  });

  it("claims nothing when there is no calories pill to back it", () => {
    expect(said({})[0]).toStartWith("First one in.");
  });
});

describe("verdictHeadline", () => {
  it("is the first verdict's own first line, so a re-rendered card says what the thread said", () => {
    const targets = { kcal: 1643, protein_g: 109, fat_g: 55, carbs_g: 205 };
    const meal = { kcal: 584, protein_g: 37, satfat_g: 6, sodium_mg: 600, confidence: "high" };
    for (const verdicts of [{ weight: "good" }, { weight: "warn" }, { weight: "bad" }, { weight: "good", ldl: "bad" }] as const) {
      for (const lang of LANGS) {
        const lines = firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 584, protein_g: 37, satfat_g: 0, sodium_mg: 0 }, via: "photo", verdicts }, lang);
        expect(lines[0]).toBe(verdictHeadline(verdicts, lang)!);
      }
    }
    expect(verdictHeadline({}, "en")).toBeNull();
  });
});
