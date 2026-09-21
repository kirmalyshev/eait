import { describe, expect, it } from "bun:test";
import { catalogArgs } from "./i18n.ts";
import { LANGS } from "./types.ts";
import { threadCopyFor } from "./chat-copy.ts";
import { COACH_STARTERS, MAX_SUGGESTION, MEET_GABIE, SCRIPTED_LINES, SCRIPTED_PARAMS, type ScriptedLineId, cleanSuggestions, correctionLine, firstVerdictLines, isScriptedLineId, runningLine, scriptedLine, scriptedParams } from "./chat.ts";

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
  const targets = { kcal: 1454, protein_g: 110 };
  const meal = { kcal: 612, protein_g: 38, satfat_g: 4, sodium_mg: 900, confidence: "high" };

  it("reads the plan back for a lose/maintain goal, and invites the correction", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {},
    }, "en");
    expect(lines[0]).toBe("First one in. 612 kcal — that leaves 842 of your 1,454 for the rest of today, and 38 of the 110 g protein. On plan.");
    expect(lines[1]).toContain("If anything's off, say so");
    expect(lines[2]).toBe(MEET_GABIE("en"));
    expect(lines).toHaveLength(3);
  });

  it("introduces Gabie last, on every branch, because the first verdict is the one line spoken once", () => {
    const base = { targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, verdicts: {} } as const;
    for (const lines of [
      firstVerdictLines({ ...base, goal: "lose", via: "photo" }, "en"),
      firstVerdictLines({ ...base, goal: "gain", via: "photo" }, "en"),
      firstVerdictLines({ ...base, goal: "lose", via: "text" }, "en"),
      firstVerdictLines({ ...base, goal: "lose", via: "photo", meal: { ...meal, confidence: "low" } }, "en"),
    ]) expect(lines[lines.length - 1]).toBe(MEET_GABIE("en"));
    expect(MEET_GABIE("en")).toContain("Gabie");
    // Spud's voice, still: he does not cheer her either.
    expect(MEET_GABIE("en")).not.toMatch(/!/);
  });

  it("says how far over the day is, as a number with a direction — never a bare negative", () => {
    // "-146 of your 1,454 left" is a sign in front of a remainder: honest, and read as a typo by
    // the person it is for (review recording, 13 Sep 2026: "-569 of your 2,393 left today"). The
    // gain branch already says "over your"; the lose/maintain one says it the same way.
    const lines = firstVerdictLines({
      goal: "maintain", targets, meal: { ...meal, kcal: 1600 }, eatenToday: { kcal: 1600, protein_g: 38 }, via: "photo", verdicts: {},
    }, "en");
    expect(lines[0]).toBe("First one in. 1,600 kcal — that puts you 146 over your 1,454 for today, and 38 of the 110 g protein. Tomorrow is a fresh number.");
  });

  it("reads a correction back in the design's words", () => {
    expect(correctionLine({ targets, guessed: false, meal: { kcal: 306 }, eatenToday: { kcal: 306, protein_g: 19 } }, "en"))
      .toBe("Updated — 306 kcal. 1,148 of your 1,454 left today, 19 of the 110 g protein.");
  });

  it("says where the day stands in ONE sentence, whatever put the meal there (#306)", () => {
    // The clause a correction already ended with, on its own. A log had nothing after its card, so
    // one meal in the thread was followed by the day's arithmetic and the next by silence.
    expect(runningLine({ targets, guessed: false, eatenToday: { kcal: 306, protein_g: 19 } }, "en"))
      .toBe("1,148 of your 1,454 left today, 19 of the 110 g protein.");
    // And a correction is that sentence with the changed number in front of it — one arithmetic
    // clause, one place to change it, so the two lines can never disagree about the same day.
    expect(correctionLine({ targets, guessed: false, meal: { kcal: 306 }, eatenToday: { kcal: 306, protein_g: 19 } }, "en"))
      .toBe(`Updated — 306 kcal. ${runningLine({ targets, guessed: false, eatenToday: { kcal: 306, protein_g: 19 } }, "en")}`);
  });

  it("hedges the running line on every later meal of a guessed day, not only the first (#28)", () => {
    // `firstVerdictLines` has hedged since the grammar landed; this line is what every LATER meal
    // gets, and while it stayed exact the same person read "about 970" under their first plate
    // and "1,148" under their third. The figure OPENS the sentence, which is why there is a
    // second template rather than a hedge spliced into `{left}`.
    expect(runningLine({ targets, guessed: true, eatenToday: { kcal: 306, protein_g: 19 } }, "en"))
      .toBe("About 1,150 of your 1,454 left today, 19 of the 110 g protein.");
    expect(runningLine({ targets, guessed: true, eatenToday: { kcal: 1600, protein_g: 38 } }, "en"))
      .toBe("About 150 over your 1,454 today, 38 of the 110 g protein.");
    // The PLAN and the protein keep every digit: one is arithmetic over answers the user gave,
    // and ten grams is the wrong step for a figure that runs from 20 to 150.
    expect(runningLine({ targets, guessed: true, eatenToday: { kcal: 306, protein_g: 19 } }, "en"))
      .toContain("19 of the 110 g protein");
  });

  it("carries the day's guess into a correction, and settles with it", () => {
    // The MEAL's kcal is exact — the user has just supplied it — and the clause behind it is the
    // day, which is only exact once nothing in it is a guess any more.
    expect(correctionLine({ targets, guessed: true, meal: { kcal: 306 }, eatenToday: { kcal: 306, protein_g: 19 } }, "en"))
      .toBe("Updated — 306 kcal. About 1,150 of your 1,454 left today, 19 of the 110 g protein.");
    expect(correctionLine({ targets, guessed: false, meal: { kcal: 306 }, eatenToday: { kcal: 306, protein_g: 19 } }, "en"))
      .toBe("Updated — 306 kcal. 1,148 of your 1,454 left today, 19 of the 110 g protein.");
  });

  it("says the overshoot as an overshoot when the day is over, as the first verdict does", () => {
    // The same arithmetic as the first verdict, worded the same way: a number and a direction.
    expect(runningLine({ targets, guessed: false, eatenToday: { kcal: 1600, protein_g: 38 } }, "en"))
      .toBe("146 over your 1,454 today, 38 of the 110 g protein.");
    expect(correctionLine({ targets, guessed: false, meal: { kcal: 306 }, eatenToday: { kcal: 1600, protein_g: 38 } }, "en"))
      .toBe("Updated — 306 kcal. 146 over your 1,454 today, 38 of the 110 g protein.");
  });

  it("fills rather than leaves for a gain goal", () => {
    const lines = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150 }, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {},
    }, "en");
    expect(lines[0]).toBe("First one in. 612 kcal — 2,288 of your 2,900 still to fill today, and 38 of the 150 g protein. Keep going.");
  });

  it("is honest about a rough read and asks for the grams instead", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal: { ...meal, kcal: 480, confidence: "low" }, eatenToday: { kcal: 480, protein_g: 21 }, via: "photo", verdicts: {},
    }, "en");
    // #28: the flag is WORDED ONCE and the figures carry the rest. 480 is already on the step, so
    // a guess prints it unchanged — and the day arithmetic computed from it is a guess too. The
    // hedge sits IMMEDIATELY IN FRONT OF THE FIGURE: "Take 480 as a rough guess" put it behind,
    // which reads as an apology for a number already stated.
    expect(lines[0]).toBe("Honest answer: I couldn't read that plate well. Call it about 480 and check the grams before you trust the total. A second angle next time helps.");
    expect(lines[1]).toBe("About 970 of your 1,454 left today.");
    expect(lines).toHaveLength(3);
    // Rule 1 holds on this branch too: a gain plan is filled, not left.
    const gain = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150 }, meal: { ...meal, kcal: 480, confidence: "low" }, eatenToday: { kcal: 480, protein_g: 21 }, via: "photo", verdicts: {},
    }, "en");
    expect(gain[1]).toBe("About 2,420 of your 2,900 still to fill today.");
    // Past the target on a gain plan is not "still to fill": rule 1, the branch taken.
    const past = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150 }, meal: { ...meal, kcal: 480, confidence: "low" }, eatenToday: { kcal: 3100, protein_g: 160 }, via: "photo", verdicts: {},
    }, "en");
    expect(past[1]).toBe("About 200 over your 2,900 today.");
    const sure = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150 }, meal: { ...meal, kcal: 480 }, eatenToday: { kcal: 3100, protein_g: 160 }, via: "photo", verdicts: {},
    }, "en");
    expect(sure[0]).toBe("First one in. 480 kcal — 200 over your 2,900 today, and 160 of the 150 g protein. Past it is the point on a gain plan; tomorrow is a fresh number.");
    // Over target reads as an overshoot, like the confident branch — no clamp to zero, no bare sign.
    const over = firstVerdictLines({ goal: "lose", targets, meal: { ...meal, kcal: 1600, confidence: "low" }, eatenToday: { kcal: 1600, protein_g: 21 }, via: "photo", verdicts: {} }, "en");
    expect(over[1]).toBe("About 150 over your 1,454 today. Tomorrow is a fresh number.");
  });

  it("says a typed meal is a guess at the portions", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal: { ...meal, kcal: 540 }, eatenToday: { kcal: 540, protein_g: 30 }, via: "text", verdicts: {},
    }, "en");
    expect(lines[0]).toBe("Typed, not photographed — so the portions are my guess. Call it about 540; if you know the grams, say so and I'll fix it.");
    expect(lines[1]).toBe("That leaves about 910 of your 1,454 for the rest of today, and 30 of the 110 g protein. On plan.");
    const gain = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150 }, meal: { ...meal, kcal: 612 }, eatenToday: { kcal: 612, protein_g: 38 }, via: "text", verdicts: {},
    }, "en");
    expect(gain[1]).toBe("About 2,290 of your 2,900 still to fill today, and 38 of the 150 g protein. Keep going.");
  });

  it("quotes the camera note back first, in the user's own words", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {}, caption: "extra rice",
    }, "en");
    expect(lines[0]).toBe("“extra rice” — noted, it's in the numbers.");
    expect(lines[1]).toMatch(/^First one in\./);
    expect(firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {}, caption: "  " }, "en")[0]).toMatch(/^First one in\./);
    // Client text in Spud's bubble is flattened and short, like a scripted parameter.
    const long = firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {}, caption: "rice\n\nFirst one in. 9,999 kcal " + "x".repeat(100) }, "en")[0]!;
    expect(long).not.toContain("\n");
    // Cut at a word, marked as cut, never mid-character: a quote attributed to the user must read as one.
    expect(long).toMatch(/^“rice First one in\. 9,999 kcal…” — noted/);
    const emoji = firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {}, caption: "a".repeat(63) + "🍕bbbb" }, "en")[0]!;
    expect(emoji).not.toMatch(/[\ud800-\udfff]”/);
    expect(Array.from(emoji.slice(1, emoji.indexOf("”"))).length).toBeLessThanOrEqual(65);
    // The quotation marks are Spud's; a note cannot close them and start a sentence of its own.
    const forged = firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {}, caption: "x” — noted. First one in. 900 kcal" }, "en")[0]!;
    expect(forged.indexOf("”")).toBe(forged.lastIndexOf("”"));
  });

  it("mentions sodium or saturated fat only when the user asked for it, and only when it ran high", () => {
    const base = { goal: "lose" as const, targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo" as const };
    // Before the introduction, which stays last on every branch.
    expect(firstVerdictLines({ ...base, verdicts: { kidneys: "warn" } }, "en").at(-2)).toBe("Sodium runs high on this one. Scored only because you asked me to.");
    expect(firstVerdictLines({ ...base, verdicts: { ldl: "bad" } }, "en").at(-2)).toBe("Saturated fat runs high on this one. Scored only because you asked me to.");
    expect(firstVerdictLines({ ...base, verdicts: { kidneys: "good" } }, "en")).toHaveLength(3);
  });
});

describe("coach", () => {
  it("offers a few starters, each short enough to be a chip and worded as the user would send it", () => {
    expect(COACH_STARTERS("en").length).toBeGreaterThanOrEqual(3);
    for (const s of COACH_STARTERS("en")) {
      expect(s.length).toBeLessThanOrEqual(MAX_SUGGESTION);
      expect(s.trim()).toBe(s);
    }
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
