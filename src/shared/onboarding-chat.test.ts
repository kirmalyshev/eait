// The conversation: its order, its branches, and the three rules every reply obeys.
//
// This is the file that stands in for a simulator. The replies read answers given six questions
// earlier, and the failures they guard against are all silent: a gainer told that losing weight is
// hard to keep, a citation bent to fit the wrong direction, a plan aimed at a number below where
// the person already is. None of those throws, none shows up in a screenshot, and all three shipped
// in the design's own drafts before the context pass caught them.

import { describe, expect, it, test } from "bun:test";
import {
  ACTIVITY_LEVELS, CHAT_PROMPTS, COUNTRY_CODES, DEFAULT_ONBOARDING_CONTENT, LANGS,
  ONBOARDING_INTERSTITIALS, ONBOARDING_PLACES, ONBOARDING_STEPS,
  GAIN_PACE_CARD, GOAL_CARDS, MASCOT_MOODS, MOMENT_POSES, SCREEN_OPTIONS,
  activityFromHealthLine, chatCopyFor, countryLabel,
  screenForStep, screenOptionValues, screenOptions,
  MAX_STRUGGLE_CARDS, MAX_SURPLUS_SHARE, MAX_DEFICIT_SHARE, MIN_AGE, MIN_WEIGHT_KG, STRUGGLES,
  answerLabel, askLines, askPlaceholder, capNote, checkDirection, checkNumber,
  isAnswered, minHealthyKg, promptsFor, reactionTo, reconcileGoalEdit,
  restrictionsReply, resumeAt, supportMoment,
  struggleCard, strugglesCloser, switchedLine, weightAck,
  type ChatPromptId, type Profile, type Struggle,
} from "./index.ts";
import { spudSvg } from "./mascot.ts";
import { onboardingContentFor } from "./onboarding-content.ts";

function profile(over: Partial<Profile> = {}): Profile {
  return {
    user_id: "u1", lang: "en", goal: null, sex: null, birth_year: null, height_cm: null,
    weight_kg: null, weight_measured_at: null, target_weight_kg: null, activity: null, pace: null,
    country: null,
    restrictions: [], medical_limitations: null, food_allergies: null, product_limitations: null,
    onboarded_at: null,
    ...over,
  };
}

// A browser cannot read Apple Health, so the web's surface is { health: false } — see C1.
const ids = (p: Profile, off: "country"[] = ["country"], health = false) =>
  promptsFor(p, off, { health }).map((x) => x.id);
const content = DEFAULT_ONBOARDING_CONTENT;
const promptById = (id: ChatPromptId) => CHAT_PROMPTS.find((p) => p.id === id)!;

describe("the order of the conversation", () => {
  it("is the design's", () => {
    expect(ids(profile())).toEqual([
      "welcome", "goal", "sex", "birth_year", "height_cm", "weight_kg",
      "target_weight_kg", "pace", "activity", "struggles",
      "restrictions", "building", "summary",
    ]);
  });

  it("drops the goal weight and the pace for a maintainer, and nothing else", () => {
    const maintaining = ids(profile({ goal: "maintain" }));
    expect(maintaining).not.toContain("target_weight_kg");
    expect(maintaining).not.toContain("pace");
    // The empathy layer stays: a maintainer gets the same support and the same plan.
    expect(maintaining).toContain("struggles");
    expect(maintaining).toContain("summary");
  });

  it("asks the country only when the admin has switched it back on", () => {
    expect(ids(profile(), ["country"])).not.toContain("country");
    expect(ids(profile(), [])).toContain("country");
  });

  it("asks every profile field the calorie target needs", () => {
    const fields = promptsFor(profile(), [], { health: false }).flatMap((p) => (p.field ? [p.field] : []));
    for (const step of ONBOARDING_STEPS) expect(fields).toContain(step);
  });
});

describe("where a killed run picks up", () => {
  const prompts = () => promptsFor(profile(), ["country"], { health: false });

  it("starts on the front door when nothing has been answered", () => {
    expect(resumeAt(prompts(), profile())).toBe(0);
  });

  it("resumes at the first unanswered field, never past it", () => {
    const p = profile({ goal: "lose", sex: "male", birth_year: 1990, height_cm: 183 });
    expect(promptsFor(p, ["country"], { health: false })[resumeAt(promptsFor(p, ["country"], { health: false }), p)]!.id).toBe("weight_kg");
  });

  it("skips a conversation question that sits before the resume point", () => {
    // `struggles` is not a profile column, so re-asking is the only way to have it — and re-asking
    // "what's been hard?" after a kill is worse than never asking. Everything before the resume
    // point is replayed from the profile, and `struggles` has nothing to replay.
    const p = profile({
      goal: "lose", sex: "male", birth_year: 1990, height_cm: 183, weight_kg: 93,
      target_weight_kg: 88, pace: "steady", activity: "moderate",
    });
    const list = promptsFor(p, ["country"], { health: false });
    const at = resumeAt(list, p);
    expect(list[at]!.id).toBe("restrictions");
    expect(list.slice(at).map((x) => x.id)).not.toContain("struggles");
  });

  it("still asks a conversation question that sits after the resume point", () => {
    // It is conversation, not history: the run has not reached it, so it is asked.
    const p = profile({ goal: "lose", sex: "male", birth_year: 1990, height_cm: 183 });
    const list = promptsFor(p, ["country"], { health: false });
    expect(list.slice(resumeAt(list, p)).map((x) => x.id)).toContain("struggles");
  });

  it("holds on restrictions until onboarding is completed", () => {
    const p = profile({
      goal: "lose", sex: "male", birth_year: 1990, height_cm: 183, weight_kg: 93,
      target_weight_kg: 88, pace: "steady", activity: "moderate",
    });
    const list = promptsFor(p, ["country"], { health: false });
    expect(list[resumeAt(list, p)]!.id).toBe("restrictions");
    expect(isAnswered(promptById("restrictions"), p)).toBe(false);
    expect(isAnswered(promptById("restrictions"), profile({ ...p, onboarded_at: "2026-01-01T00:00:00Z" }))).toBe(true);
  });
});

describe("what Spud asks", () => {
  it("reads the admin's words for a profile question", () => {
    expect(askLines(promptById("goal"), { content: content, lang: "en" }, profile())[0]).toContain("what are you here to do");
  });

  it("warns about pace only when the goal is to lose", () => {
    // Rule 1. "Faster isn't better here — it's just harder to keep" is a warning about losing
    // weight; said to somebody gaining it is a reply written for no one.
    const asked = (goal: Profile["goal"]) =>
      askLines(promptById("target_weight_kg"), { content: content, lang: "en" }, profile({ goal })).join(" ");
    expect(asked("lose")).toContain("Faster isn't better");
    expect(asked("gain")).not.toContain("Faster isn't better");
    // And the substitution never leaks its own placeholder.
    expect(asked("gain")).not.toContain("{loseTail}");
    expect(asked("lose")).not.toContain("{loseTail}");
  });

  it("carries a placeholder for everything typed and none for what is tapped", () => {
    expect(askPlaceholder(promptById("birth_year"), content)).toBe("Your age");
    expect(askPlaceholder(promptById("goal"), content)).toBeNull();
    // No question that collects nothing takes typed input any more.
    expect(askPlaceholder(promptById("struggles"), content)).toBeNull();
  });

  it("asks the front door from the content, and asks nothing on the two cards", () => {
    // `welcome` is the one prompt with no field and no constant — it reads `content.welcome.lines`.
    // The version that fell through to the constants threw on the very first render.
    expect(askLines(promptById("welcome"), { content: content, lang: "en" }, profile())).toEqual(content.welcome.lines);
    for (const id of ["building", "summary"] as const) {
      expect(askLines(promptById(id), { content: content, lang: "en" }, profile())).toEqual([]);
    }
  });

  it("asks the conversation question from code, not from the admin", () => {
    expect(askLines(promptById("struggles"), { content: content, lang: "en" }, profile())[0]).toContain("What's been hard?");
  });
});

describe("the answer a resumed run draws back", () => {
  it("writes an enumerated answer the way it was labelled", () => {
    expect(answerLabel(promptById("goal"), profile({ goal: "lose" }), { content: content, lang: "en" })).toBe("Lose weight");
    expect(answerLabel(promptById("activity"), profile({ activity: "moderate" }), { content: content, lang: "en" })).toBe("2–3 times a week");
  });

  it("writes a number the way it was typed", () => {
    expect(answerLabel(promptById("weight_kg"), profile({ weight_kg: 93 }), { content: content, lang: "en" })).toBe("93");
  });

  it("draws the year of birth back as an age, plain arithmetic, no eligibility band", () => {
    // The user typed an age; the column holds the year. Replaying the column raw would show them a
    // year they never said — and routing the replay through `ageFrom` would too, at the band's
    // edge: an accepted 100-year-old crosses New Year, ageFrom(101) is null, and the fallback drew
    // the raw year. Display is subtraction, not eligibility.
    const year = new Date().getUTCFullYear();
    expect(answerLabel(promptById("birth_year"), profile({ birth_year: 1990 }), { content: content, lang: "en" })).toBe(String(year - 1990));
    expect(answerLabel(promptById("birth_year"), profile({ birth_year: year - 101 }), { content: content, lang: "en" })).toBe("101");
  });

  it("says nothing for an unanswered question", () => {
    expect(answerLabel(promptById("weight_kg"), profile(), { content: content, lang: "en" })).toBeNull();
    expect(answerLabel(promptById("welcome"), profile(), { content: content, lang: "en" })).toBeNull();
  });

  it("names the restrictions picked, or says none applied", () => {
    const done = { onboarded_at: "2026-01-01T00:00:00Z" };
    expect(answerLabel(promptById("restrictions"), profile({ ...done, restrictions: ["kidneys", "ldl"] }), { content: content, lang: "en" }))
      .toBe("Kidney condition · High cholesterol");
    expect(answerLabel(promptById("restrictions"), profile({ ...done, restrictions: [] }), { content: content, lang: "en" }))
      .toBe("Nothing applies");
  });
});

describe("the numbers", () => {
  const today = new Date("2026-08-26T00:00:00Z");

  it("takes a plain number and a comma decimal", () => {
    expect(checkNumber("weight_kg", "93", "en", today)).toEqual({ ok: true, value: 93 });
    expect(checkNumber("weight_kg", "93,5", "en", today)).toEqual({ ok: true, value: 93.5 });
    expect(checkNumber("height_cm", "183 cm", "en", today)).toEqual({ ok: true, value: 183 });
  });

  it("refuses in the design's words rather than the server's", () => {
    expect(checkNumber("height_cm", "6", "en", today)).toEqual({ ok: false, line: "In centimetres — something like 175." });
    expect(checkNumber("weight_kg", "nope", "en", today)).toEqual({ ok: false, line: "In kilograms — roughly is fine." });
    expect(checkNumber("target_weight_kg", "900", "en", today)).toEqual({ ok: false, line: "A number in kg — like 70." });
  });

  it("never accepts a value the server would refuse without words", () => {
    // The client band is a SUBSET of the server's, so the only refusals a user can meet are the two
    // that have sentences written for them.
    expect(checkNumber("weight_kg", String(MIN_WEIGHT_KG - 1), "en", today).ok).toBe(false);
    expect(checkNumber("target_weight_kg", String(MIN_WEIGHT_KG - 1), "en", today).ok).toBe(false);
    expect(checkNumber("height_cm", "99", "en", today).ok).toBe(false);
    expect(checkNumber("height_cm", "251", "en", today).ok).toBe(false);
  });

  it("reads an age and says so when the input is not one", () => {
    // The question is "how old are you?" and the AGE is what travels: the server derives the year
    // with its own clock (`engine/profile.ts`), because the device's can be wrong.
    expect(checkNumber("birth_year", "36", "en", today)).toEqual({ ok: true, value: 36 });
    expect(checkNumber("birth_year", "36 years", "en", today)).toEqual({ ok: true, value: 36 });
    expect(checkNumber("birth_year", "nope", "en", today).ok).toBe(false);
    expect(checkNumber("birth_year", "-3", "en", today).ok).toBe(false);
    expect(checkNumber("birth_year", "500", "en", today).ok).toBe(false);
  });

  it("takes a four-digit year as the year itself, whatever separator it came with", () => {
    // Copy saved before this question changed still asks for a year, and people type years out of
    // habit under the age question too. "1.990" is how a German writes 1990; the comma form is the
    // US thousands separator. Both are the year, never age 1.99 — which used to reach the STOP.
    expect(checkNumber("birth_year", "1990", "en", today)).toEqual({ ok: true, value: 36 });
    expect(checkNumber("birth_year", "1.990", "en", today)).toEqual({ ok: true, value: 36 });
    expect(checkNumber("birth_year", "1,990", "en", today)).toEqual({ ok: true, value: 36 });
    expect(checkNumber("birth_year", "1800", "en", today).ok).toBe(false);
  });

  it("stops on a plausible child's age and refuses a typo as a typo", () => {
    // The stop's quick reply DELETES THE ACCOUNT, so it is reserved for answers that plausibly
    // mean a child (5-15). "0", "-0.4" and a premature send of "3" are typos: they get the retry
    // line, from which nothing worse than retyping can happen.
    expect(checkNumber("birth_year", String(MIN_AGE - 1), "en", today)).toEqual({ ok: false, underAge: true });
    expect(checkNumber("birth_year", "5", "en", today)).toEqual({ ok: false, underAge: true });
    expect(checkNumber("birth_year", String(MIN_AGE), "en", today)).toEqual({ ok: true, value: MIN_AGE });
    for (const typo of ["0", "4", "-0.4", "3"]) {
      const out = checkNumber("birth_year", typo, "en", today);
      expect(out.ok).toBe(false);
      expect("underAge" in out).toBe(false);
    }
  });

  it("asks before taking a high two-digit answer that could be a year shorthand", () => {
    // "90" under year-worded copy means 1990; typed by a 90-year-old it means 90. Neither reading
    // may be guessed: one wrongly computes a nonagenarian's target, the other a 36-year-old's.
    expect(checkNumber("birth_year", "90", "en", today)).toEqual({ ok: false, ambiguousAge: 90 });
    expect(checkNumber("birth_year", "85", "en", today)).toEqual({ ok: false, ambiguousAge: 85 });
    // 100 is three digits — no shorthand reading — and 84 is below the band.
    expect(checkNumber("birth_year", "100", "en", today)).toEqual({ ok: true, value: 100 });
    expect(checkNumber("birth_year", "84", "en", today)).toEqual({ ok: true, value: 84 });
  });
});

describe("the goal weight", () => {
  it("catches a target that is not in the direction of the goal", () => {
    const gain = checkDirection("gain", 93, 88, "en")!;
    expect(gain.line).toContain("that's not a gain from here");
    expect(gain.switchTo).toBe("lose");
    const lose = checkDirection("lose", 93, 95, "en")!;
    expect(lose.line).toContain("that's not a loss from here");
    expect(lose.switchTo).toBe("gain");
  });

  it("catches the equal case, which is neither", () => {
    expect(checkDirection("gain", 93, 93, "en")).not.toBeNull();
    expect(checkDirection("lose", 93, 93, "en")).not.toBeNull();
  });

  it("lets a real target through", () => {
    expect(checkDirection("lose", 93, 88, "en")).toBeNull();
    expect(checkDirection("gain", 60, 66, "en")).toBeNull();
    // A maintainer is never asked, so there is nothing to check.
    expect(checkDirection("maintain", 93, 93, "en")).toBeNull();
  });

  it("re-asks in the words of the goal it was switched to", () => {
    expect(switchedLine("lose", "en")).toContain("Faster isn't better");
    expect(switchedLine("gain", "en")).not.toContain("Faster isn't better");
  });

  it("agrees with the guard that will refuse it", () => {
    // `minHealthyKg` is what Spud quotes; `checkTargetWeight` is what refuses. Two numbers that
    // must agree, so they are computed the same way and asserted against each other here.
    expect(minHealthyKg(155)).toBe(45);
    expect(minHealthyKg(183)).toBe(62);
  });
});

describe("the support cards", () => {
  it("gives every goal its own card, with a source", () => {
    for (const goal of ["lose", "gain", "maintain"] as const) {
      expect(GOAL_CARDS("en")[goal].source, goal).toBeTruthy();
      expect(GOAL_CARDS("en")[goal].body.length).toBeGreaterThan(40);
    }
  });

  it("gives every struggle a card", () => {
    for (const s of STRUGGLES) {
      expect(struggleCard(s, "lose", "en").title, s).not.toBe("");
      expect(struggleCard(s, "lose", "en").body, s).not.toBe("");
    }
  });

  it("never quotes the regain study at somebody gaining", () => {
    // Rule 1 as a citation rule: the meta-analysis is about weight LOSS. The gain variant says the
    // weaker thing that is true, and carries no source, because there is not one for it.
    const losing = struggleCard("diets", "lose", "en");
    const gaining = struggleCard("diets", "gain", "en");
    expect(losing.source).toBeTruthy();
    expect(losing.body).toContain("80%");
    expect(gaining.source).toBeUndefined();
    expect(gaining.body).not.toContain("80%");
  });

  it("quotes the surplus cap from the constant that enforces it", () => {
    expect(GAIN_PACE_CARD("en").body).toContain(`${Math.round(MAX_SURPLUS_SHARE * 100)}%`);
  });

  it("shows at most two", () => {
    expect(MAX_STRUGGLE_CARDS).toBe(2);
  });

  it("closes on the number picked, and promises only what is still coming", () => {
    expect(strugglesCloser(0, "en")).toContain("Even better");
    expect(strugglesCloser(1, "en")).toContain("with that");
    expect(strugglesCloser(3, "en")).toContain("each of these");
    // It used to promise "one more question about them" — the hardest-moment question, which is
    // gone. A closer that names a beat the flow no longer has is the flow lying about itself.
    for (const n of [1, 3]) expect(strugglesCloser(n, "en")).toContain("Two quick ones left");
  });
});

describe("restrictions", () => {
  it("says only what was declared gets scored", () => {
    expect(restrictionsReply([], false, "en").join(" ")).toContain("undeclared things never are");
  });

  it("chains the cholesterol line onto the kidney one, never alone", () => {
    // "too" and "same rule" refer to a sentence that has to be there.
    const both = restrictionsReply(["kidneys", "ldl"], false, "en");
    expect(both[0]).toContain("Sodium");
    expect(both[1]).toContain("too");
    const alone = restrictionsReply(["ldl"], false, "en");
    expect(alone[0]).toContain("Saturated fat gets scored from here on");
    expect(alone[0]).not.toContain("too");
  });

  it("acknowledges free text without quoting it", () => {
    // The medical free text is the most sensitive thing anybody types here; it goes on the profile
    // and is never read back into a bubble.
    const lines = restrictionsReply(["kidneys"], true, "en").join(" ");
    expect(lines).toContain("free text");
  });

  it("has something to say for a tag with no scoring line of its own", () => {
    expect(restrictionsReply(["vegan"], false, "en")[0]).toContain("only they get scored");
  });
});

describe("the plan", () => {
  it("quotes the cap from the constant for the direction taken", () => {
    const template = content.summary.capNote;
    expect(capNote(template, "lose", null, "en")).toContain(`${Math.round(MAX_DEFICIT_SHARE * 100)}%`);
    expect(capNote(template, "gain", null, "en")).toContain(`${Math.round(MAX_SURPLUS_SHARE * 100)}%`);
    expect(capNote(template, "lose", null, "en")).not.toContain("{share}");
  });

  it("names the safe outcome, not a fault, when the pace was capped", () => {
    // #676's sibling #675: a person who picked "Steady" was told "You asked to move faster than
    // would be safe". The card says what they got; it never says they asked for too much.
    const line = capNote(content.summary.capNote, "lose", null, "en");
    expect(line).not.toMatch(/you asked/i);
    expect(line).not.toContain("adjustment");
    expect(line).toContain("what your body burns in a day");
  });

  it("gives the resulting pace in kg a week, so a percentage isn't the only answer", () => {
    // Two independent reviews (13-14 Sep 2026, novice and veteran personas) both read the cap
    // note's percentage and still didn't know their real weekly pace.
    const line = capNote(content.summary.capNote, "lose", 0.417, "en");
    expect(line).toContain("0.4 kg a week");
  });

  it("gives the first number the moment the weight lands", () => {
    expect(weightAck(1900, "en").join(" ")).toContain("1,900 kcal");
    // And says nothing about a number that could not be computed, rather than "about null".
    expect(weightAck(null, "en")).toHaveLength(1);
  });
});

describe("what the conversation never does", () => {
  const everySentence = () => {
    const out: string[] = [];
    for (const goal of ["lose", "gain", "maintain"] as const) {
      out.push(...askLines(promptById("target_weight_kg"), { content: content, lang: "en" }, profile({ goal })));
      for (const s of STRUGGLES) out.push(struggleCard(s as Struggle, goal, "en").body);
    }
    out.push(...askLines(promptById("struggles"), { content: content, lang: "en" }, profile()));
    for (const n of [0, 1, 3]) out.push(strugglesCloser(n, "en"));
    out.push(...Object.values(content.welcome.lines));
    return out;
  };

  it("mentions a step, a screen or a number of questions", () => {
    // Rule 3. The user experiences one chat, not the step diagram this was designed against.
    for (const line of everySentence()) {
      // "screen positive" is a clinical verb in the binge card, so the screen check is the UI noun.
      expect(line.toLowerCase(), line)
        .not.toMatch(/\bstep \d|\bquestion \d|\b(this|next|last|previous|the) screen\b/);
    }
  });

  it("leaves no placeholder unfilled", () => {
    for (const line of everySentence()) expect(line, line).not.toMatch(/\{[a-z]+\}/i);
  });
});

describe("reconcileGoalEdit", () => {
  const losing = { goal: "lose" as const, weight_kg: 94, target_weight_kg: 88 };

  test("a coherent edit passes straight through", () => {
    expect(reconcileGoalEdit(losing, { target_weight_kg: 85 }, "en"))
      .toEqual({ patch: { target_weight_kg: 85 }, note: null });
  });

  test("a contradictory TARGET is refused, in the words onboarding already uses", () => {
    const out = reconcileGoalEdit(losing, { target_weight_kg: 99 }, "en");
    expect(out.patch).toBeNull();
    expect(out.note).toContain("that's not a loss from here");
  });

  test("a contradictory GOAL wins and clears the target it invalidated", () => {
    const out = reconcileGoalEdit(losing, { goal: "gain" }, "en");
    expect(out.patch).toEqual({ goal: "gain", target_weight_kg: null });
    expect(out.note).toContain("cleared");
  });

  test("WEIGHT is a fact and is always recorded, even when it strands the target", () => {
    // Someone who set out to lose from 94 to 88 and now weighs 86 has met their goal. Refusing to
    // store the scale reading because it disagrees with an old target is the app arguing with it.
    const out = reconcileGoalEdit(losing, { weight_kg: 86 }, "en");
    expect(out.patch).toEqual({ weight_kg: 86 });
    expect(out.note).toContain("worth setting a new one");
  });

  test("maintain has no target to contradict, and a half-filled profile is left alone", () => {
    expect(reconcileGoalEdit({ goal: "maintain", weight_kg: 94, target_weight_kg: 88 }, { weight_kg: 99 }, "en").note)
      .toBeNull();
    expect(reconcileGoalEdit({ goal: "lose", weight_kg: null, target_weight_kg: null }, { goal: "gain" }, "en").note)
      .toBeNull();
  });
});

describe("checkNumber as the guard in front of a profile patch", () => {
  // The settings editor called `Number(draft)` raw. `NumberField` filters to digits and dots, so
  // ".", "94.." and "9.4.5" all arrive as NaN — and NaN is `null` once `JSON.stringify` has been
  // over it. `patchProfile` reads an explicit null as "clear this field", so it SKIPS the range
  // check, answers 200, and wipes `weight_kg` and `weight_measured_at`: silent loss of the one
  // number the calorie target is computed from, reported as a successful save.
  test("never yields a value that would reach the wire as null", () => {
    for (const raw of [".", "..", "94..", "9.4.5", "  ", "", "abc", "-", ".5.", "1e9"]) {
      const out = checkNumber("weight_kg", raw, "en");
      // Either refused, or salvaged into a real number — never NaN, which `JSON.stringify` turns
      // into `null`, which `patchProfile` reads as "clear this field".
      if (out.ok) {
        expect(Number.isFinite(out.value)).toBe(true);
        expect(JSON.parse(JSON.stringify({ v: out.value })).v).not.toBeNull();
      }
      // What `Number(raw)` would have sent instead, which is the bug this guard exists in front of.
      if (!Number.isFinite(Number(raw)) && raw.trim() !== "") {
        expect(JSON.parse(JSON.stringify({ v: Number(raw) })).v).toBeNull();
      }
    }
  });

  test("still takes the numbers a person actually types", () => {
    expect(checkNumber("weight_kg", "93", "en")).toEqual({ ok: true, value: 93 });
    expect(checkNumber("weight_kg", "93,5", "en")).toEqual({ ok: true, value: 93.5 });
    expect(checkNumber("target_weight_kg", "88.4", "en")).toEqual({ ok: true, value: 88.4 });
  });
});

// ── The vocabulary, in one place ─────────────────────────────────────────────────────────────

describe("a choice prompt's options are the screen's, not a second copy of them", () => {
  // THE DRIFT THAT ALREADY HAPPENED. `CHAT_PROMPTS` carried `["de", "gb", "us", "other"]` beside
  // `SCREEN_OPTIONS.country`, and `optionsFor` reads the PROMPT first — so growing `COUNTRY_CODES`
  // from four entries to fifteen changed nothing at all on either surface. Typecheck was green,
  // every unit test passed, and the rendered page still offered three countries to eight
  // languages. Nothing here is clever; it just refuses the second copy.

  it("matches SCREEN_OPTIONS wherever a prompt names one", () => {
    for (const prompt of CHAT_PROMPTS) {
      if (!prompt.options || !prompt.field) continue;
      const screen = screenForStep(prompt.field);
      expect([...prompt.options], `${prompt.id} disagrees with SCREEN_OPTIONS.${screen}`)
        .toEqual([...(SCREEN_OPTIONS[screen] ?? [])]);
    }
  });

  it("leaves the country prompt's list to the language, because its order is not a constant", () => {
    expect(CHAT_PROMPTS.find((p) => p.id === "country")!.options).toBeUndefined();
    for (const lang of LANGS) {
      expect([...screenOptionValues("country", lang)].sort(), lang).toEqual([...COUNTRY_CODES].sort());
    }
  });
});

describe("the answer drawn back in the user's own bubble", () => {
  it("names the country in words, in every language — a bare code is not an answer", () => {
    // `answerLabel` gated on `prompt.options` and echoed the raw value without them. The moment
    // the country prompt stopped carrying a list, that would have drawn "de" back at the user.
    const prompt = CHAT_PROMPTS.find((p) => p.id === "country")!;
    for (const lang of LANGS) {
      for (const country of ["de", "vn", "ru", "mx"] as const) {
        const label = answerLabel(prompt, profile({ country }), {
          content: DEFAULT_ONBOARDING_CONTENT, lang,
        });
        expect(label, `${lang}/${country}`).toBe(countryLabel(country, lang));
      }
    }
  });
});

// ── v5: the Spud onboarding contract ─────────────────────────────────────────────────────────
//
// The agreed contract with the app (contract-v5.md, issue #42): the Health offer as a prompt,
// an age asked as an age, a suggested target with a stepper range, exercise in plain
// frequencies, a one-line reaction on every answer, and the four support moments.

describe("the health prompt (C1)", () => {
  it("sits right after the goal, only on a surface that can read Apple Health", () => {
    expect(ids(profile(), ["country"], true)).toEqual([
      "welcome", "goal", "health", "sex", "birth_year", "height_cm", "weight_kg",
      "target_weight_kg", "pace", "activity", "struggles",
      "restrictions", "building", "summary",
    ]);
    // The browser passes { health: false } and never meets it — the v5 web spec draws no
    // Health screen, because there is nothing to connect to.
    expect(ids(profile(), ["country"], false)).not.toContain("health");
  });

  it("is a funnel place between the goal and the first question, and not a screen", () => {
    // It collects no profile field — its reader is the HealthKit fill — so it belongs to the
    // interstitials and stays out of SCREEN_FIELDS, like every place before it.
    const at = (s: string) => (ONBOARDING_PLACES as readonly string[]).indexOf(s);
    expect(at("goal")).toBeLessThan(at("health"));
    expect(at("health")).toBeLessThan(at("about"));
    expect(ONBOARDING_INTERSTITIALS).toContain("health");
  });

  it("asks from the copy table, not from a screen's asks — it collects nothing", () => {
    expect(askLines(promptById("health"), { content, lang: "en" }, profile()))
      .toEqual([chatCopyFor("en").health.ask]);
  });
});

describe("the age question (C2)", () => {
  it("asks for an age, and '32' is a valid answer to it", () => {
    const ask = content.screens.find((s) => s.id === "about")!.asks.birth_year!.lines.join(" ");
    expect(ask.toLowerCase()).toContain("how old");
    // `checkNumber` already takes a two-digit answer as an age; the copy is what changed.
    expect(checkNumber("birth_year", "32", "en", new Date("2026-08-26T00:00:00Z")))
      .toEqual({ ok: true, value: 32 });
  });
});

describe("the activity choices (C4)", () => {
  it("asks in plain frequencies, on the five levels in order", () => {
    const labels = screenOptions(content, "activity");
    expect(ACTIVITY_LEVELS.map((l) => labels[l]!.label)).toEqual([
      "No", "A little each week", "2–3 times a week", "4–5 times a week", "6–7 times a week",
    ]);
  });

  it("confirms a Health-computed level with the workouts it counted", () => {
    expect(activityFromHealthLine(4, "light", "en"))
      .toBe("Health shows 4 workouts in the last 4 weeks. A little each week?");
    for (const lang of LANGS) {
      const line = activityFromHealthLine(4, "moderate", lang);
      expect(line, lang).not.toMatch(/\{[a-z]+\}/);
      // The label is the option's own words — the same chip the user is about to see.
      const label = onboardingContentFor(lang).screens.find((s) => s.id === "activity")!
        .options!.moderate!.label;
      expect(line, lang).toContain(label);
    }
  });
});

describe("the one-line reaction to each answer (C5)", () => {
  const answered = profile({
    goal: "lose", sex: "female", birth_year: 1994, height_cm: 172, weight_kg: 74,
    target_weight_kg: 68, pace: "steady", activity: "light", country: "gb",
    restrictions: ["ldl"],
  });

  it("speaks to the goal taken, in joy", () => {
    expect(reactionTo("goal", profile({ goal: "lose" }), "en"))
      .toEqual({ line: "Lose weight. Good, let's make it stick", mood: "joy" });
    for (const goal of ["maintain", "gain"] as const) {
      const r = reactionTo("goal", profile({ goal }), "en");
      expect(r?.mood, goal).toBe("joy");
      expect(r?.line, goal).toBeTruthy();
      expect(r?.line, goal).not.toBe("Lose weight. Good, let's make it stick");
    }
    // Rule 1: no answer, no reply — a line written for every goal is written for none.
    expect(reactionTo("goal", profile(), "en")).toBeNull();
  });

  it("acknowledges the plain answers in the spec's words", () => {
    expect(reactionTo("sex", answered, "en")).toEqual({ line: "Thanks", mood: "happy" });
    expect(reactionTo("birth_year", answered, "en")).toEqual({ line: "Got it", mood: "happy" });
    expect(reactionTo("height_cm", answered, "en"))
      .toEqual({ line: "Last number. No judgement, it's just where we start", mood: "care" });
    expect(reactionTo("country", answered, "en")).toEqual({ line: "Nearly there", mood: "care" });
  });

  it("pays the weight answer its first real number", () => {
    // bmr for 74 kg / 172 cm / 32 / female is 1494 — the figure the spec's walk says aloud.
    const r = reactionTo("weight_kg", answered, "en")!;
    expect(r.mood).toBe("happy");
    expect(r.line).toBe("Thank you. At rest, your body burns about 1,494 kcal a day");
    // And says nothing about a number that could not be computed, rather than "about null".
    const noBmr = reactionTo("weight_kg", profile({ weight_kg: 74 }), "en")!;
    expect(noBmr.line).not.toContain("kcal");
  });

  it("answers the pace in the pace's own words", () => {
    expect(reactionTo("pace", profile({ pace: "steady" }), "en"))
      .toEqual({ line: "Steady is the one people keep", mood: "think" });
    for (const pace of ["easy", "push"] as const) {
      const r = reactionTo("pace", profile({ pace }), "en");
      expect(r?.mood, pace).toBe("think");
      expect(r?.line, pace).toBeTruthy();
      expect(r?.line, pace).not.toBe("Steady is the one people keep");
    }
  });

  it("names what restrictions will be scored — only because they were declared", () => {
    const r = reactionTo("restrictions", answered, "en")!;
    expect(r.mood).toBe("joy");
    expect(r.line).toContain("Saturated fat");
    expect(r.line).toContain("only because you asked");
    const none = reactionTo("restrictions", profile({ restrictions: [] }), "en")!;
    expect(none.line).toContain("nothing extra");
  });

  it("says nothing on the beats a support moment already covers, or that are not answers", () => {
    for (const id of ["target_weight_kg", "activity", "welcome", "health", "building", "summary"] as const) {
      expect(reactionTo(id, answered, "en"), id).toBeNull();
    }
  });
});

describe("the support moments (C6)", () => {
  const ctx = (over: Partial<Profile> = {}, struggles: Struggle[] = ["diets"]) => ({
    profile: profile({
      goal: "lose", sex: "female", birth_year: 1994, height_cm: 172, weight_kg: 74,
      target_weight_kg: 68, activity: "light", restrictions: ["ldl"], ...over,
    }),
    struggles,
    lang: "en" as const,
    content,
  });

  it("celebrates an in-band target with the 5–10% claim, echoing the answer", () => {
    // 74 -> 68 is about 8% down: inside the band the claim is about.
    const m = supportMoment("target", ctx())!;
    expect(m.pose).toBe("cheer");
    expect(m.echo).toBe("68 kg");
    expect(m.title).toBe("A goal you can keep");
    expect(m.body).toContain("5–10%");
    expect(m.body).toContain("68 kg");
    expect(m.cta).toBe("Continue");
  });

  it("speaks the neutral variant when the target sits outside the band", () => {
    const m = supportMoment("target", ctx({ target_weight_kg: 60 }))!;
    // 74 -> 60 is a 19% cut: real, but not the claim this sentence is making.
    expect(m.body).not.toContain("5–10%");
    expect(m.body).toContain("60 kg");
  });

  it("exists only where the moment applies", () => {
    // A maintainer is never asked a target, so there is no target moment.
    expect(supportMoment("target", ctx({ goal: "maintain", target_weight_kg: null }))).toBeNull();
    expect(supportMoment("struggles", ctx({}, []))).toBeNull();
    // The restrictions moment always stands: its body speaks about what was shared.
    expect(supportMoment("restrictions", ctx({ restrictions: [] }))).not.toBeNull();
  });

  it("echoes the answer's own label", () => {
    expect(supportMoment("activity", ctx())!.echo).toBe("A little each week");
    expect(supportMoment("struggles", ctx())!.echo).toBe("Diets that didn't stick");
    expect(supportMoment("restrictions", ctx())!.echo).toBe("High cholesterol");
    expect(supportMoment("restrictions", ctx({ restrictions: [] }))!.echo)
      .toBe(chatCopyFor("en").nothingApplies);
  });

  it("keeps the struggles body on the card's own statistics", () => {
    // The moment's body IS the card's — the sourced numbers stay in code, in one place.
    const m = supportMoment("struggles", ctx())!;
    expect(m.title).toBe("That's completely normal!");
    expect(m.body).toBe(struggleCard("diets", "lose", "en").body);
    // And the gain variant still swaps the citation rather than bending it.
    expect(supportMoment("struggles", ctx({ goal: "gain" }, ["diets"]))!.body)
      .toBe(struggleCard("diets", "gain", "en").body);
  });

  it("poses each moment the way the spec draws it", () => {
    expect(supportMoment("activity", ctx())!.pose).toBe("lift");
    expect(supportMoment("struggles", ctx())!.pose).toBe("think");
    expect(supportMoment("restrictions", ctx())!.pose).toBe("heart");
    for (const pose of Object.values(MOMENT_POSES)) expect(typeof pose).toBe("string");
  });
});

describe("the mascot's new face (C5)", () => {
  it("adds joy to the shared vocabulary and draws it as an open smile", () => {
    expect(MASCOT_MOODS).toContain("joy");
    // The web drawing is a FILLED mouth — the open grin — not the usual stroke.
    const svg = spudSvg("joy", "spud-joy-test");
    expect(svg).toContain(`fill="${"#3A2612"}"`);
  });
});
