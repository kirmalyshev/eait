// The conversation: its order, its branches, and the three rules every reply obeys.
//
// This is the file that stands in for a simulator. The screens read answers given steps earlier —
// the pace card's result needs the weight and the goal, the on-track caption reads the first
// struggle — and the failures they guard against are all silent: a plan that quotes the requested
// pace instead of the one the guards produced, a Balanced picker asked their diet twice, a
// restriction tag parsed where a reader should have been called.
//
// v2 (#82): the chat became plain screens — one question each, no per-answer replies, no support
// cards, no moments. What is tested here now is the ORDER, the resume bits (struggles, the
// diet/medical views of `restrictions`), and the computed words: pace preview, plan rows, the
// on-track caption.

import { describe, expect, it, test } from "bun:test";
import {
  ACTIVITY_LEVELS, CHAT_PROMPTS, COUNTRY_CODES, DEFAULT_ONBOARDING_CONTENT, LANGS,
  MASCOT_MOODS, ONBOARDING_INTERSTITIALS, ONBOARDING_PLACES, ONBOARDING_STEPS,
  PLAN_REVEAL, SCREEN_OPTIONS,
  MAX_DEFICIT_SHARE, MAX_SURPLUS_SHARE, MIN_AGE, MIN_WEIGHT_KG, STRUGGLES, DIETS, MEDICAL_TAGS,
  answerLabel, askLines, askPlaceholder, capNote, chatCopyFor, checkDirection, checkNumber,
  countryLabel, dietOf, explainTargets, isAnswered, medicalOf, minHealthyKg, offerHeadline,
  ontrackCaption, pacePreview, planHeadline, planRows, promptsFor, reconcileGoalEdit, resumeAt,
  screenForStep, screenOptionValues, screenOptions, switchedLine, weightDisplay,
  type ChatPromptId, type Profile, type Struggle,
} from "./index.ts";
import { spudSvg } from "./mascot.ts";
import { onboardingContentFor } from "./onboarding-content.ts";

function profile(over: Partial<Profile> = {}): Profile {
  return {
    user_id: "u1", lang: "en", goal: null, sex: null, birth_year: null, height_cm: null,
    weight_kg: null, weight_measured_at: null, target_weight_kg: null, activity: null, pace: null,
    units: null, struggles: null, streak_goal_days: null, milestone_celebrations: true, streak_on_home: true, country: null,
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
  it("is the design's — v2, one question a screen", () => {
    expect(ids(profile())).toEqual([
      "welcome", "goal", "sex", "birth_year", "height_cm", "weight_kg",
      "activity", "target_weight_kg", "pace", "struggles", "streak_goal_days",
      "diet", "medical", "ontrack", "how", "summary", "signup",
    ]);
  });

  it("puts the health sync LAST, only on a surface that can read it", () => {
    // v2 moved it out of the head: the body is typed on the rulers now, and Health only keeps the
    // numbers current — a post-sign-up offer, not a shortcut.
    const withHealth = ids(profile(), ["country"], true);
    expect(withHealth[withHealth.length - 1]).toBe("health");
    expect(withHealth.indexOf("health")).toBeGreaterThan(withHealth.indexOf("signup"));
    // The browser passes { health: false } and never meets it.
    expect(ids(profile(), ["country"], false)).not.toContain("health");
  });

  it("drops the goal weight and the pace for a maintainer, and nothing else", () => {
    const maintaining = ids(profile({ goal: "maintain" }));
    expect(maintaining).not.toContain("target_weight_kg");
    expect(maintaining).not.toContain("pace");
    // The struggles and the plan stay: a maintainer gets the same support and the same card.
    expect(maintaining).toContain("struggles");
    expect(maintaining).toContain("ontrack");
    expect(maintaining).toContain("summary");
  });

  it("asks the country only when the admin has switched it back on", () => {
    expect(ids(profile(), ["country"])).not.toContain("country");
    expect(ids(profile(), [])).toContain("country");
  });

  it("asks every field the calorie target needs, and the two restriction views last", () => {
    const fields = promptsFor(profile(), [], { health: false }).flatMap((p) => (p.field ? [p.field] : []));
    for (const step of ONBOARDING_STEPS) expect(fields).toContain(step);
    // `diet` and `medical` are steps without being profile columns — they are the two write-views
    // of `restrictions`, and they must sit AFTER every field the arithmetic reads.
    const at = (s: string) => (ONBOARDING_STEPS as readonly string[]).indexOf(s);
    expect(at("activity")).toBeLessThan(at("target_weight_kg"));
    expect(at("diet")).toBeGreaterThan(at("pace"));
    expect(at("medical")).toBeGreaterThan(at("diet"));
  });
});

describe("where a killed run picks up", () => {
  const prompts = () => promptsFor(profile(), ["country"], { health: false });

  it("starts on the front door when nothing has been answered", () => {
    expect(resumeAt(prompts(), profile())).toBe(0);
  });

  it("resumes at the first unanswered field, never past it", () => {
    const p = profile({ goal: "lose", sex: "male", birth_year: 1990, height_cm: 183 });
    const list = promptsFor(p, ["country"], { health: false });
    expect(list[resumeAt(list, p)]!.id).toBe("weight_kg");
  });

  it("reads struggles off its own column: null asks, an answered-empty does not", () => {
    // `struggles` IS a profile field now — `null` is "never asked" and `[]` is "asked, picked
    // nothing". A resumed run that answered-empty does not meet the question again.
    const before = profile({
      goal: "lose", sex: "male", birth_year: 1990, height_cm: 183, weight_kg: 93,
      activity: "some", target_weight_kg: 88, pace: "steady",
    });
    const list = promptsFor(before, ["country"], { health: false });
    expect(list[resumeAt(list, before)]!.id).toBe("struggles");
    const pickedNothing = profile({ ...before, struggles: [] });
    const list2 = promptsFor(pickedNothing, ["country"], { health: false });
    expect(list2.slice(resumeAt(list2, pickedNothing)).map((x) => x.id)).not.toContain("struggles");
  });

  it("holds diet only for a mid-run Balanced, and medical until completion — the binding rule", () => {
    // Overseer, on #82: diet is answered when a diet tag exists OR onboarding completed — a
    // Balanced pick stores no tag, so it is re-asked ONCE if the run died before the end.
    // Medical is answered by `onboarded_at`, exactly the rule `restrictions` always had.
    const midRun = profile({
      goal: "lose", sex: "male", birth_year: 1990, height_cm: 183, weight_kg: 93,
      activity: "some", target_weight_kg: 88, pace: "steady", struggles: ["busy"], streak_goal_days: 14,
    });
    expect(isAnswered(promptById("diet"), midRun)).toBe(false);
    expect(isAnswered(promptById("medical"), midRun)).toBe(false);

    const vegan = profile({ ...midRun, restrictions: ["vegan"] });
    expect(isAnswered(promptById("diet"), vegan)).toBe(true);
    expect(isAnswered(promptById("medical"), vegan)).toBe(false);
    const list = promptsFor(vegan, ["country"], { health: false });
    expect(list[resumeAt(list, vegan)]!.id).toBe("medical");

    // And after `onboarded_at`, nothing in the views is re-asked — however it was answered.
    const done = profile({ ...midRun, onboarded_at: "2026-01-01T00:00:00Z" });
    expect(isAnswered(promptById("diet"), done)).toBe(true);
    expect(isAnswered(promptById("medical"), done)).toBe(true);
  });
});

describe("what Spud asks", () => {
  it("reads the admin's words for a profile question", () => {
    expect(askLines(promptById("goal"), { content, lang: "en" }, profile())[0]).toContain("What are you here to do?");
  });

  it("asks the diet and medical questions from their own screens' asks", () => {
    // The two views of `restrictions` take their question from content like every other screen —
    // an admin who rewrites "Any medical limits?" has rewritten the question the flow asks.
    expect(askLines(promptById("diet"), { content, lang: "en" }, profile())[0]).toContain("diet");
    expect(askLines(promptById("medical"), { content, lang: "en" }, profile())[0]).toContain("medical");
  });

  it("carries a placeholder for everything typed and none for what is tapped", () => {
    expect(askPlaceholder(promptById("birth_year"), content)).toBe("Your age");
    expect(askPlaceholder(promptById("goal"), content)).toBeNull();
    expect(askPlaceholder(promptById("struggles"), content)).toBeNull();
  });

  it("asks the front door from the content, and asks nothing on the beats", () => {
    expect(askLines(promptById("welcome"), { content, lang: "en" }, profile())).toEqual(content.welcome.lines);
    for (const id of ["how", "ontrack", "summary", "signup"] as const) {
      expect(askLines(promptById(id), { content, lang: "en" }, profile()), id).toEqual([]);
    }
  });
});

describe("the answer a resumed run draws back", () => {
  it("writes an enumerated answer the way it was labelled", () => {
    expect(answerLabel(promptById("goal"), profile({ goal: "lose" }), { content, lang: "en" })).toBe("Lose weight");
    expect(answerLabel(promptById("activity"), profile({ activity: "some" }), { content, lang: "en" })).toBe("3–4");
  });

  it("writes a number the way it was typed", () => {
    expect(answerLabel(promptById("weight_kg"), profile({ weight_kg: 93 }), { content, lang: "en" })).toBe("93");
    expect(answerLabel(promptById("weight_kg"), profile({ weight_kg: 72.5 }), { content, lang: "fr" })).toBe("72,5");
  });

  it("draws the year of birth back as an age, plain arithmetic, no eligibility band", () => {
    const year = new Date().getUTCFullYear();
    expect(answerLabel(promptById("birth_year"), profile({ birth_year: 1990 }), { content, lang: "en" })).toBe(String(year - 1990));
    expect(answerLabel(promptById("birth_year"), profile({ birth_year: year - 101 }), { content, lang: "en" })).toBe("101");
  });

  it("says nothing for an unanswered question", () => {
    expect(answerLabel(promptById("weight_kg"), profile(), { content, lang: "en" })).toBeNull();
    expect(answerLabel(promptById("welcome"), profile(), { content, lang: "en" })).toBeNull();
  });

  it("reads the diet back through `dietOf`, never the raw tag list", () => {
    const done = { onboarded_at: "2026-01-01T00:00:00Z" };
    expect(answerLabel(promptById("diet"), profile({ ...done, restrictions: ["pescatarian", "ldl"] }), { content, lang: "en" }))
      .toBe("Pescatarian");
    // Balanced stores no tag — the draw-back is the Balanced LABEL, not an empty bubble.
    expect(answerLabel(promptById("diet"), profile({ ...done }), { content, lang: "en" })).toBe("Balanced");
  });

  it("reads medical back through `medicalOf` — diet tags never reach it", () => {
    const done = { onboarded_at: "2026-01-01T00:00:00Z" };
    expect(answerLabel(promptById("medical"), profile({ ...done, restrictions: ["vegan", "kidneys"] }), { content, lang: "en" }))
      .toBe("Kidney condition");
    expect(answerLabel(promptById("medical"), profile({ ...done, restrictions: [] }), { content, lang: "en" }))
      .toBe("None of these");
  });

  it("names the struggles picked, joined in stored (list) order", () => {
    // `struggles` is stored in vocabulary order at PATCH time, so the echo reads the same.
    expect(answerLabel(promptById("struggles"), profile({ struggles: ["habits", "busy"] }), { content, lang: "en" }))
      .toBe("Unhealthy eating habits · Busy schedule");
  });
});

describe("the numbers", () => {
  const today = new Date("2026-08-26T00:00:00Z");

  it("takes a plain number and a comma decimal", () => {
    expect(checkNumber("weight_kg", "93", "en", today)).toEqual({ ok: true, value: 93 });
    expect(checkNumber("weight_kg", "93,5", "en", today)).toEqual({ ok: true, value: 93.5 });
    expect(checkNumber("height_cm", "183cm", "en", today)).toEqual({ ok: true, value: 183 });
  });

  it("refuses in the design's words rather than the server's", () => {
    expect(checkNumber("height_cm", "6", "en", today)).toEqual({ ok: false, line: "In centimetres — something like 175." });
    expect(checkNumber("weight_kg", "nope", "en", today)).toEqual({ ok: false, line: "In kilograms — roughly is fine." });
    expect(checkNumber("target_weight_kg", "900", "en", today)).toEqual({ ok: false, line: "A number in kg — like 70." });
  });

  it("never accepts a value the server would refuse without words", () => {
    expect(checkNumber("weight_kg", String(MIN_WEIGHT_KG - 1), "en", today).ok).toBe(false);
    expect(checkNumber("target_weight_kg", String(MIN_WEIGHT_KG - 1), "en", today).ok).toBe(false);
    expect(checkNumber("height_cm", "99", "en", today).ok).toBe(false);
    expect(checkNumber("height_cm", "251", "en", today).ok).toBe(false);
  });

  it("reads an age and says so when the input is not one", () => {
    expect(checkNumber("birth_year", "36", "en", today)).toEqual({ ok: true, value: 36 });
    expect(checkNumber("birth_year", "36 years", "en", today)).toEqual({ ok: true, value: 36 });
    expect(checkNumber("birth_year", "nope", "en", today).ok).toBe(false);
    expect(checkNumber("birth_year", "-3", "en", today).ok).toBe(false);
    expect(checkNumber("birth_year", "500", "en", today).ok).toBe(false);
  });

  it("takes a four-digit year as the year itself, whatever separator it came with", () => {
    expect(checkNumber("birth_year", "1990", "en", today)).toEqual({ ok: true, value: 36 });
    expect(checkNumber("birth_year", "1.990", "en", today)).toEqual({ ok: true, value: 36 });
    expect(checkNumber("birth_year", "1,990", "en", today)).toEqual({ ok: true, value: 36 });
    expect(checkNumber("birth_year", "1800", "en", today).ok).toBe(false);
  });

  it("stops on a plausible child's age and refuses a typo as a typo", () => {
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
    expect(checkNumber("birth_year", "90", "en", today)).toEqual({ ok: false, ambiguousAge: 90 });
    expect(checkNumber("birth_year", "85", "en", today)).toEqual({ ok: false, ambiguousAge: 85 });
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
    expect(checkDirection("maintain", 93, 93, "en")).toBeNull();
  });

  it("agrees with the guard that will refuse it", () => {
    expect(minHealthyKg(155)).toBe(45);
    expect(minHealthyKg(183)).toBe(62);
  });
});

describe("the plan's computed words", () => {
  const her = profile({
    goal: "lose", sex: "female", birth_year: 1994, height_cm: 172, weight_kg: 74,
    target_weight_kg: 68, activity: "few", pace: "steady", units: null,
  });
  const SEP_24 = new Date("2026-09-24T12:00:00Z");

  it("quotes the cap from the constant for the direction taken", () => {
    const template = content.summary.capNote;
    expect(capNote(template, "lose", null, "en")).toContain(`${Math.round(MAX_DEFICIT_SHARE * 100)}%`);
    expect(capNote(template, "gain", null, "en")).toContain(`${Math.round(MAX_SURPLUS_SHARE * 100)}%`);
    expect(capNote(template, "lose", null, "en")).not.toContain("{share}");
  });

  it("names the safe outcome, not a fault, when the pace was capped", () => {
    const line = capNote(content.summary.capNote, "lose", null, "en");
    expect(line).not.toMatch(/you asked/i);
    expect(line).toContain("what your body burns in a day");
  });

  it("shows the pace the GUARDS produced, never the one that was asked", () => {
    // Steady requests 0.5kg/wk; the persona's deficit cap hands back less — and the pace
    // screen's big number is the computed `kgPerWeek` rounded, not `PACE_KG_PER_WEEK`. A screen
    // that printed the asked rate would describe a plan that does not exist.
    const p = pacePreview(her, "steady", SEP_24, "en")!;
    expect(p.ratePerWeek).not.toBe(0.5);
    expect(p.ratePerWeek).not.toBeNull();
    expect(Math.abs(p.ratePerWeek! * 10 - Math.round(p.ratePerWeek! * 10))).toBe(0);
    expect(p.line).toContain("68kg");
    expect(p.line).toContain("kcal a day");
    expect(p.line).not.toContain("{");
  });

  it("says which guard decided the pace's number, with its marker", () => {
    const capped = pacePreview(her, "push", SEP_24, "en")!;
    expect(capped.marker).toBe("cap");
    expect(capped.markerText).toContain("capped at the safe limit");
    // A profile light enough that the floor decides gets the floor's marker instead.
    const small = profile({ ...her, weight_kg: 55, target_weight_kg: 52, height_cm: 155 });
    const floored = pacePreview(small, "push", SEP_24, "en")!;
    if (floored.marker === "floor") {
      expect(floored.markerText).toContain("never below");
      expect(floored.markerText).not.toContain("{floor}");
    }
  });

  it("is null where the arithmetic honestly has nothing", () => {
    expect(pacePreview(profile({ ...her, target_weight_kg: null }), "steady", SEP_24, "en")).toBeNull();
  });
});

describe("the plan reveal's rows", () => {
  const him = profile({
    goal: "lose", sex: "male", birth_year: 1989, height_cm: 183, weight_kg: 93,
    target_weight_kg: 88, activity: "some", pace: "steady",
    restrictions: ["vegan"],
  });
  const SEP_24 = new Date("2026-09-24T12:00:00Z");

  it("labels the diet row through `dietOf`, not the tag", () => {
    const { targets } = explainTargets(him, SEP_24);
    const rows = planRows(him, targets, content, "en");
    expect(rows.find((r) => r.id === "diet")!.value).toBe("Vegan");
  });

  it("draws a limit row for a cap-bearing declaration, and none for lowsugar", () => {
    const withLdl = profile({ ...him, restrictions: ["vegan", "ldl"] });
    const rows = planRows(withLdl, explainTargets(withLdl, SEP_24).targets, content, "en");
    const limit = rows.filter((r) => r.id === "limit");
    expect(limit).toHaveLength(1);
    expect(limit[0]!.value).toContain("≤");
    expect(limit[0]!.value).not.toContain("{n}");
    // `lowsugar` declares intent, not a number — there is no cap to print.
    const sugar = profile({ ...him, restrictions: ["vegan", "lowsugar"] });
    const sugarRows = planRows(sugar, explainTargets(sugar, SEP_24).targets, content, "en");
    expect(sugarRows.filter((r) => r.id === "limit")).toHaveLength(0);
  });

  it("always opens with the four macro rows and the diet", () => {
    const rows = planRows(him, explainTargets(him, SEP_24).targets, content, "en");
    expect(rows.map((r) => r.id)).toEqual(["calories", "protein", "carbs", "fat", "diet"]);
  });

  it("times the reveal from the exported data, not a hand-typed number", () => {
    expect(PLAN_REVEAL.durationMs).toBe(3500);
    expect(PLAN_REVEAL.rowTicksMs).toHaveLength(6);
    for (const t of PLAN_REVEAL.rowTicksMs) {
      expect(t).toBeGreaterThan(0);
      expect(t).toBeLessThan(PLAN_REVEAL.durationMs);
    }
  });
});

describe("the on-track caption", () => {
  it("is the FIRST picked struggle's own line, in list order", () => {
    // The pick order is canonical (STRUGGLES order, not tap order) — the caption cannot depend on
    // which chip was touched first.
    expect(ontrackCaption(["consistency"], "en")).toContain("missed day");
    expect(ontrackCaption(["busy", "consistency"], "en")).toContain("missed day");
  });

  it("says nothing when nothing was picked — no guessed caption", () => {
    expect(ontrackCaption(null, "en")).toBeNull();
    expect(ontrackCaption([], "en")).toBeNull();
  });

  it("has a caption for every struggle in every language", () => {
    for (const lang of LANGS) {
      for (const s of STRUGGLES) {
        expect(ontrackCaption([s], lang), `${lang}.${s}`)?.toBeTruthy();
      }
    }
  });
});

describe("the units toggle", () => {
  it("writes the stored kilograms in the user's own spelling", () => {
    expect(weightDisplay(68, null, "en")).toBe("68kg");
    expect(weightDisplay(68, "imperial", "en")).toContain("lb");
    expect(weightDisplay(68, "imperial", "en")).not.toContain("kg");
    // One decimal, locale-formatted — the pace screen's "0.9lb a week".
    expect(parseFloat(weightDisplay(68, "imperial", "en"))).toBeCloseTo(149.9, 0);
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
  test("never yields a value that would reach the wire as null", () => {
    for (const raw of [".", "..", "94..", "9.4.5", "  ", "", "abc", "-", ".5.", "1e9"]) {
      const out = checkNumber("weight_kg", raw, "en");
      if (out.ok) {
        expect(Number.isFinite(out.value)).toBe(true);
        expect(JSON.parse(JSON.stringify({ v: out.value })).v).not.toBeNull();
      }
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
  // from four entries to fifteen changed nothing at all on either surface. Nothing here is clever;
  // it just refuses the second copy.

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

  it("offers medical's " + "none" + " as a drawn row, never a stored tag", () => {
    // "None of these" clears the medical subset — it is an OPTION, and nothing writes it into
    // `restrictions`, so the vocabulary it comes from names it while the tag vocabulary does not.
    expect(SCREEN_OPTIONS.medical).toContain("none");
    expect(MEDICAL_TAGS as readonly string[]).not.toContain("none");
    expect(DIETS).toHaveLength(7);
    expect(DIETS).toContain("balanced");
  });
});

describe("the answer drawn back in the user's own bubble", () => {
  it("names the country in words, in every language — a bare code is not an answer", () => {
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

describe("the age question (C2)", () => {
  it("asks for an age, and '32' is a valid answer to it", () => {
    const ask = content.screens.find((s) => s.id === "age")!.asks.birth_year!.lines.join(" ");
    expect(ask.toLowerCase()).toContain("age");
    expect(checkNumber("birth_year", "32", "en", new Date("2026-08-26T00:00:00Z")))
      .toEqual({ ok: true, value: 32 });
  });
});

describe("the activity choices (C4)", () => {
  it("asks in plain frequencies, on the four levels in order", () => {
    const labels = screenOptions(content, "activity");
    expect(ACTIVITY_LEVELS.map((l) => labels[l]!.label)).toEqual(["0", "1–2", "3–4", "5+"]);
  });
});

describe("the diet and medical vocabularies", () => {
  it("are the two subsets of one restrictions column", () => {
    // The binding model: seven diets where `balanced` is absence, three medical tags, and the
    // readers never look past their own half.
    expect(dietOf([])).toBe("balanced");
    expect(dietOf(["vegan", "ldl"])).toBe("vegan");
    expect(medicalOf(["vegan", "ldl", "lowsugar"])).toEqual(["ldl", "lowsugar"]);
    expect(medicalOf(["mediterranean"])).toEqual([]);
  });
});

describe("the mascot's new face (C5)", () => {
  it("adds joy to the shared vocabulary and draws it as an open smile", () => {
    expect(MASCOT_MOODS).toContain("joy");
    const svg = spudSvg("joy", "spud-joy-test");
    expect(svg).toContain(`fill="${"#3A2612"}"`);
  });
});

// spud-mobile's ask on the contract (#42): the words after the plan, and the stepper's labels.
describe("the soft offer's headline", () => {
  const her = profile({
    goal: "lose", sex: "female", birth_year: 1994, height_cm: 172, weight_kg: 74,
    target_weight_kg: 68, pace: "steady", activity: "few",
  });
  const SEP_24 = new Date("2026-09-24T12:00:00Z");

  it("names the target and the month the plan's own projection reaches it", () => {
    expect(offerHeadline(her, SEP_24, "en")).toBe("Get to 68kg by January 2027");
  });

  it("is null wherever the plan names no arrival: maintaining, or no target", () => {
    expect(offerHeadline(profile({ ...her, goal: "maintain", target_weight_kg: null }), SEP_24, "en")).toBeNull();
    expect(offerHeadline(profile({ ...her, target_weight_kg: null }), SEP_24, "en")).toBeNull();
  });

  it("is null past the projection horizon, where the plan says 'over two years' and not a date", () => {
    const far = profile({ ...her, weight_kg: 180, target_weight_kg: 80, pace: "easy" });
    expect(offerHeadline(far, SEP_24, "en")).toBeNull();
  });

  it("has a template in every language, with both placeholders", () => {
    for (const lang of LANGS) {
      const h = offerHeadline(her, SEP_24, lang);
      expect(h).not.toBeNull();
      expect(h).not.toContain("{");
    }
  });
});

describe("planHeadline", () => {
  // The same persona the soft-offer tests use: 74 → 68kg is a promise to lose 6kg.
  const her = profile({
    goal: "lose", sex: "female", birth_year: 1994, height_cm: 172, weight_kg: 74,
    target_weight_kg: 68, pace: "steady", activity: "few",
  });
  const SEP_24 = new Date("2026-09-24T12:00:00Z");

  it("names the amount to lose and the month the plan's own projection reaches it", () => {
    // The board's own numbers: the persona at 74 → 68kg reads "lose 6kg by January 2027".
    expect(planHeadline(her, SEP_24, "metric", "en")).toBe("Goal: lose 6kg by January 2027");
  });

  it("says it in the reader's units — pounds, never a stored one rewritten", () => {
    expect(planHeadline(her, SEP_24, "imperial", "en")).toBe("Goal: lose 13 lbs by January 2027");
  });

  it("writes Russian pounds as the symbol, because the word declines wrong for 1 and 2–4", () => {
    // A 1kg loss is 2lb: "минус 2lb", never "минус 2 фунтов".
    const near = profile({ ...her, target_weight_kg: 73 });
    expect(planHeadline(near, SEP_24, "imperial", "ru")).toContain("минус 2lb");
  });

  it("is null wherever the plan draws no such headline: maintaining, gaining, or no target", () => {
    expect(planHeadline(profile({ ...her, goal: "maintain", target_weight_kg: null }), SEP_24, "metric", "en")).toBeNull();
    expect(planHeadline(profile({ ...her, goal: "gain", target_weight_kg: 80 }), SEP_24, "metric", "en")).toBeNull();
    expect(planHeadline(profile({ ...her, target_weight_kg: null }), SEP_24, "metric", "en")).toBeNull();
  });

  it("is null past the projection horizon, where the plan names no month", () => {
    const far = profile({ ...her, weight_kg: 180, target_weight_kg: 80, pace: "easy" });
    expect(planHeadline(far, SEP_24, "metric", "en")).toBeNull();
  });

  it("has a metric and an imperial template in every language, each fully filled", () => {
    for (const lang of LANGS) {
      for (const units of ["metric", "imperial"] as const) {
        const h = planHeadline(her, SEP_24, units, lang);
        expect(h, `${lang}/${units}`).not.toBeNull();
        expect(h, `${lang}/${units}`).not.toContain("{");
      }
    }
  });
});

describe("the free meal's words and the stepper's labels", () => {
  it("are present in every language, and none of them is empty", () => {
    for (const lang of LANGS) {
      const c = chatCopyFor(lang);
      for (const v of [...Object.values(c.firstMeal), ...Object.values(c.stepper)]) {
        expect(typeof v).toBe("string");
        expect((v as string).trim()).not.toBe("");
      }
    }
  });
});
