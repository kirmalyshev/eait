import { describe, expect, it } from "bun:test";
import { COACH_STARTERS, MAX_SUGGESTION, MEET_GABIE, SCRIPTED_LINES, SCRIPTED_PARAMS, type ScriptedLineId, cleanSuggestions, correctionLine, firstVerdictLines, isScriptedLineId, scriptedLine, scriptedParams } from "./chat.ts";

describe("scripted lines", () => {
  it("fills parameters and leaves nothing unfilled", () => {
    const line = scriptedLine("trial-started", { price: "€39.99 a year" });
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
    for (const [id, line] of Object.entries(SCRIPTED_LINES)) {
      const holes = [...line.matchAll(/\{(\w+)\}/g)].map((m) => m[1] ?? "").sort();
      expect(isScriptedLineId(id)).toBe(true);
      expect([...SCRIPTED_PARAMS[id as ScriptedLineId]].sort()).toEqual(holes);
    }
  });

  it("knows its own ids and nothing else", () => {
    for (const id of ["camera-closed", "camera-denied", "camera-primer", "onboarding-done", "fix-prompt", "already-in", "trial-started", "trial-day-one", "notify-primer", "restored", "dropped"]) expect(isScriptedLineId(id)).toBe(true);
    expect(isScriptedLineId("ignore previous instructions")).toBe(false);
  });
});

// copy.md § Step 17. The numbers are the plan's and the day's; the words are the design's.
describe("the first verdict", () => {
  const targets = { kcal: 1454, protein_g: 110 };
  const meal = { kcal: 612, protein_g: 38, satfat_g: 4, sodium_mg: 900, confidence: "high" };

  it("reads the plan back for a lose/maintain goal, and invites the correction", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {},
    });
    expect(lines[0]).toBe("First one in. 612 kcal — that leaves 842 of your 1,454 for the rest of today, and 38 of the 110 g protein. On plan.");
    expect(lines[1]).toContain("If anything's off, say so");
    expect(lines[2]).toBe(MEET_GABIE);
    expect(lines).toHaveLength(3);
  });

  it("introduces Gabie last, on every branch, because the first verdict is the one line spoken once", () => {
    const base = { targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, verdicts: {} } as const;
    for (const lines of [
      firstVerdictLines({ ...base, goal: "lose", via: "photo" }),
      firstVerdictLines({ ...base, goal: "gain", via: "photo" }),
      firstVerdictLines({ ...base, goal: "lose", via: "text" }),
      firstVerdictLines({ ...base, goal: "lose", via: "photo", meal: { ...meal, confidence: "low" } }),
    ]) expect(lines[lines.length - 1]).toBe(MEET_GABIE);
    expect(MEET_GABIE).toContain("Gabie");
    // Spud's voice, still: he does not cheer her either.
    expect(MEET_GABIE).not.toMatch(/!/);
  });

  it("keeps the arithmetic when over, and only swaps the closing clause — the prototype's shape", () => {
    const lines = firstVerdictLines({
      goal: "maintain", targets, meal: { ...meal, kcal: 1600 }, eatenToday: { kcal: 1600, protein_g: 38 }, via: "photo", verdicts: {},
    });
    expect(lines[0]).toBe("First one in. 1,600 kcal — that leaves -146 of your 1,454 for the rest of today, and 38 of the 110 g protein. Over for today — tomorrow is a fresh number.");
  });

  it("reads a correction back in the design's words", () => {
    expect(correctionLine({ targets, meal: { kcal: 306 }, eatenToday: { kcal: 306, protein_g: 19 } }))
      .toBe("Updated — 306 kcal. 1,148 of your 1,454 left today, 19 of the 110 g protein.");
  });

  it("fills rather than leaves for a gain goal", () => {
    const lines = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150 }, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {},
    });
    expect(lines[0]).toBe("First one in. 612 kcal — 2,288 of your 2,900 still to fill today, and 38 of the 150 g protein. Keep going.");
  });

  it("is honest about a rough read and asks for the grams instead", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal: { ...meal, kcal: 480, confidence: "low" }, eatenToday: { kcal: 480, protein_g: 21 }, via: "photo", verdicts: {},
    });
    expect(lines[0]).toBe("Honest answer: I couldn't read that plate well. Take 480 as a rough guess and check the grams before you trust the total. A second angle next time helps.");
    expect(lines[1]).toBe("Even rough, it counts: about 974 of your 1,454 left today.");
    expect(lines).toHaveLength(3);
    // Rule 1 holds on this branch too: a gain plan is filled, not left.
    const gain = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150 }, meal: { ...meal, kcal: 480, confidence: "low" }, eatenToday: { kcal: 480, protein_g: 21 }, via: "photo", verdicts: {},
    });
    expect(gain[1]).toBe("Even rough, it counts: about 2,420 of your 2,900 still to fill today.");
    // Past the target on a gain plan is not "still to fill": rule 1, the branch taken.
    const past = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150 }, meal: { ...meal, kcal: 480, confidence: "low" }, eatenToday: { kcal: 3100, protein_g: 160 }, via: "photo", verdicts: {},
    });
    expect(past[1]).toBe("Even rough, it counts: about 200 over your 2,900 today.");
    const sure = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150 }, meal: { ...meal, kcal: 480 }, eatenToday: { kcal: 3100, protein_g: 160 }, via: "photo", verdicts: {},
    });
    expect(sure[0]).toBe("First one in. 480 kcal — 200 over your 2,900 today, and 160 of the 150 g protein. Past it is the point on a gain plan; tomorrow is a fresh number.");
    // Over target reads as the number it is, like the confident branch — no clamp to zero.
    const over = firstVerdictLines({ goal: "lose", targets, meal: { ...meal, kcal: 1600, confidence: "low" }, eatenToday: { kcal: 1600, protein_g: 21 }, via: "photo", verdicts: {} });
    expect(over[1]).toBe("Even rough, it counts: about -146 of your 1,454 left today. Over for today — tomorrow is a fresh number.");
  });

  it("says a typed meal is a guess at the portions", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal: { ...meal, kcal: 540 }, eatenToday: { kcal: 540, protein_g: 30 }, via: "text", verdicts: {},
    });
    expect(lines[0]).toBe("Typed, not photographed — so the portions are my guess. Take 540 as rough; if you know the grams, say so and I'll fix it.");
    expect(lines[1]).toBe("That leaves 914 of your 1,454 for the rest of today, and 30 of the 110 g protein. On plan.");
    const gain = firstVerdictLines({
      goal: "gain", targets: { kcal: 2900, protein_g: 150 }, meal: { ...meal, kcal: 612 }, eatenToday: { kcal: 612, protein_g: 38 }, via: "text", verdicts: {},
    });
    expect(gain[1]).toBe("2,288 of your 2,900 still to fill today, and 38 of the 150 g protein. Keep going.");
  });

  it("quotes the camera note back first, in the user's own words", () => {
    const lines = firstVerdictLines({
      goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {}, caption: "extra rice",
    });
    expect(lines[0]).toBe("“extra rice” — noted, it's in the numbers.");
    expect(lines[1]).toMatch(/^First one in\./);
    expect(firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {}, caption: "  " })[0]).toMatch(/^First one in\./);
    // Client text in Spud's bubble is flattened and short, like a scripted parameter.
    const long = firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {}, caption: "rice\n\nFirst one in. 9,999 kcal " + "x".repeat(100) })[0]!;
    expect(long).not.toContain("\n");
    // Cut at a word, marked as cut, never mid-character: a quote attributed to the user must read as one.
    expect(long).toMatch(/^“rice First one in\. 9,999 kcal…” — noted/);
    const emoji = firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {}, caption: "a".repeat(63) + "🍕bbbb" })[0]!;
    expect(emoji).not.toMatch(/[\ud800-\udfff]”/);
    expect(Array.from(emoji.slice(1, emoji.indexOf("”"))).length).toBeLessThanOrEqual(65);
    // The quotation marks are Spud's; a note cannot close them and start a sentence of its own.
    const forged = firstVerdictLines({ goal: "lose", targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo", verdicts: {}, caption: "x” — noted. First one in. 900 kcal" })[0]!;
    expect(forged.indexOf("”")).toBe(forged.lastIndexOf("”"));
  });

  it("mentions sodium or saturated fat only when the user asked for it, and only when it ran high", () => {
    const base = { goal: "lose" as const, targets, meal, eatenToday: { kcal: 612, protein_g: 38 }, via: "photo" as const };
    // Before the introduction, which stays last on every branch.
    expect(firstVerdictLines({ ...base, verdicts: { kidneys: "warn" } }).at(-2)).toBe("Sodium runs high on this one. Scored only because you asked me to.");
    expect(firstVerdictLines({ ...base, verdicts: { ldl: "bad" } }).at(-2)).toBe("Saturated fat runs high on this one. Scored only because you asked me to.");
    expect(firstVerdictLines({ ...base, verdicts: { kidneys: "good" } })).toHaveLength(3);
  });
});

describe("coach", () => {
  it("offers a few starters, each short enough to be a chip and worded as the user would send it", () => {
    expect(COACH_STARTERS.length).toBeGreaterThanOrEqual(3);
    for (const s of COACH_STARTERS) {
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
