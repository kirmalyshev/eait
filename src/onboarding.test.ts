import { describe, expect, test } from "bun:test";
import { step, type OnboardingUser } from "./onboarding.ts";
import { LANGS, translatorFor } from "./i18n/index.ts";

const t = translatorFor("ru");

function user(over: Partial<OnboardingUser> = {}): OnboardingUser {
  return { state: "consent", goal: null, weight_kg: null, target_weight_kg: null, country: null, ...over };
}
function buttonData(r: { buttons?: { text: string; data: string }[][] }): string[] {
  return (r.buttons ?? []).flat().map((b) => b.data);
}
function buttonText(r: { buttons?: { text: string; data: string }[][] }): string[] {
  return (r.buttons ?? []).flat().map((b) => b.text);
}

// Reaching each profile step: the machine derives the step from which fields are still null.
const atWeight = { state: "profile", goal: "lose" } as const;
const atTarget = { state: "profile", goal: "lose", weight_kg: 92 } as const;
const atCountry = { state: "profile", goal: "lose", weight_kg: 92, target_weight_kg: 85 } as const;
const atRestrictions = {
  state: "profile",
  goal: "lose",
  weight_kg: 92,
  target_weight_kg: 85,
  country: "de",
} as const;

describe("happy path consent -> profile -> active", () => {
  test("new user /start -> consent with agree/decline buttons", () => {
    const r = step(undefined, { type: "command", command: "start" }, t);
    expect(r.nextState).toBe("consent");
    expect(r.reply).toContain("/delete"); // consent copy names how to erase
    expect(buttonData(r)).toEqual(expect.arrayContaining(["consent_agree", "consent_decline"]));
  });

  test("agree -> profile, records consent_at, asks goal", () => {
    const at = new Date("2026-07-21T10:00:00Z");
    const r = step(user({ state: "consent" }), { type: "callback", data: "consent_agree" }, t, at);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.consent_at).toBe(at.toISOString());
    expect(buttonData(r)).toEqual(
      expect.arrayContaining(["goal_lose", "goal_maintain", "goal_gain"]),
    );
  });

  test("goal chosen -> stays profile, sets goal, asks weight with skip", () => {
    const r = step(user({ state: "profile", goal: null }), {
      type: "callback",
      data: "goal_lose",
    }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.goal).toBe("lose");
    expect(buttonData(r)).toContain("weight_skip");
  });

  test("weight text -> stays profile, stores kg, echoes it back, asks target weight", () => {
    const r = step(user(atWeight), { type: "text", text: "92,5 кг" }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.weight_kg).toBe(92.5);
    // The parsed value is echoed so a misparse is visible and correctable, not silent.
    expect(r.reply).toContain("92.5");
    expect(r.reply).toContain(t("onboarding.askTargetWeight"));
    expect(buttonData(r)).toContain("target_weight_skip");
  });

  test("pounds are converted, not stored as kilograms", () => {
    const r = step(user(atWeight), { type: "text", text: "180 lbs" }, t);
    expect(r.patch?.weight_kg).toBe(81.6); // 180 × 0.45359237, rounded to 0.1
    expect(step(user(atWeight), { type: "text", text: "200lb" }, t).patch?.weight_kg).toBe(90.7);
  });

  test("weight skip -> stores the 0 sentinel, asks target weight", () => {
    const r = step(user(atWeight), { type: "callback", data: "weight_skip" }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.weight_kg).toBe(0);
    expect(buttonData(r)).toContain("target_weight_skip");
  });

  test("unparseable or out-of-range weight re-asks without a patch", () => {
    for (const text of ["abc", "20", "500", "-5"]) {
      const r = step(user(atWeight), { type: "text", text }, t);
      expect(r.nextState).toBe("profile");
      expect(r.patch).toBeUndefined();
      expect(r.reply).toBe(t("onboarding.weightInvalid"));
      expect(buttonData(r)).toContain("weight_skip"); // skip stays available on a re-ask
    }
  });

  test("target weight text -> stays profile, stores kg, echoes it, asks country", () => {
    const r = step(user(atTarget), { type: "text", text: "85" }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.target_weight_kg).toBe(85);
    expect(r.reply).toContain("85");
    expect(r.reply).toContain(t("onboarding.askCountry"));
    expect(buttonData(r)).toContain("country_de");
    expect(buttonData(r)).toContain("country_other");
    expect(buttonData(r)).toContain("country_skip");
  });

  test("target weight skip -> stores the 0 sentinel, asks country", () => {
    const r = step(user(atTarget), { type: "callback", data: "target_weight_skip" }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.target_weight_kg).toBe(0);
    expect(buttonData(r)).toContain("country_skip");
  });

  test("unparseable target weight re-asks without a patch", () => {
    const r = step(user(atTarget), { type: "text", text: "soon" }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch).toBeUndefined();
    expect(r.reply).toBe(t("onboarding.targetWeightInvalid"));
    expect(buttonData(r)).toContain("target_weight_skip");
  });

  test("country pick -> stores the code, echoes it, asks restrictions", () => {
    const r = step(user(atCountry), { type: "callback", data: "country_de" }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.country).toBe("de");
    expect(r.reply).toContain(t("country.de"));
    expect(r.reply).toContain(t("onboarding.askRestrictions"));
    expect(buttonData(r)).toContain("restrictions_skip");
  });

  test("an unknown country code is rejected, re-asks the picker", () => {
    const r = step(user(atCountry), { type: "callback", data: "country_zz" }, t);
    expect(r.patch).toBeUndefined();
    expect(buttonData(r)).toContain("country_other"); // resumed at the country picker
  });

  test("country 'Other' -> prompts free text with a lone Skip, stores nothing yet", () => {
    const r = step(user(atCountry), { type: "callback", data: "country_other" }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch).toBeUndefined();
    expect(r.reply).toBe(t("onboarding.countryOther"));
    // Minimal prompt: just Skip, not the whole picker again (matches the /settings "Other" flow).
    expect(buttonData(r)).toEqual(["country_skip"]);
  });

  test("country free text -> stores it raw, asks restrictions", () => {
    const r = step(user(atCountry), { type: "text", text: "Portugal" }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.country).toBe("Portugal");
    expect(r.reply).toContain("Portugal");
    expect(r.reply).toContain(t("onboarding.askRestrictions"));
    expect(buttonData(r)).toContain("restrictions_skip");
  });

  test("empty/whitespace country text re-asks without a patch", () => {
    const r = step(user(atCountry), { type: "text", text: "   " }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch).toBeUndefined();
    expect(r.reply).toBe(t("onboarding.countryInvalid"));
    expect(buttonData(r)).toContain("country_skip");
  });

  test("country skip -> stores the '' sentinel, asks restrictions", () => {
    const r = step(user(atCountry), { type: "callback", data: "country_skip" }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.country).toBe("");
    expect(buttonData(r)).toContain("restrictions_skip");
  });

  test("restriction free text -> active, parses tags", () => {
    const r = step(user(atRestrictions), { type: "text", text: "почки, без сахара" }, t);
    expect(r.nextState).toBe("active");
    expect(r.patch?.restrictions).toEqual(["kidneys", "lowsugar"]);
    expect(r.reply).toBe(t("onboarding.done"));
  });

  test("restrictions work after skipped weight/target/country (sentinels count as answered)", () => {
    const r = step(user({ state: "profile", goal: "lose", weight_kg: 0, target_weight_kg: 0, country: "" }), {
      type: "text",
      text: "kidneys",
    }, t);
    expect(r.nextState).toBe("active");
    expect(r.patch?.restrictions).toEqual(["kidneys"]);
  });

  test("skip restrictions -> active with empty tags", () => {
    const r = step(user({ ...atRestrictions, goal: "gain" }), {
      type: "callback",
      data: "restrictions_skip",
    }, t);
    expect(r.nextState).toBe("active");
    expect(r.patch?.restrictions).toEqual([]);
  });

  // The step keeps the words, not just the tags it could classify. Everything outside the
  // four-tag vocabulary ("no peanuts") used to be silently discarded here.
  test("restriction free text ALSO stores the raw words as limitations", () => {
    const r = step(user(atRestrictions), { type: "text", text: "почки, без сахара, no peanuts" }, t);
    expect(r.patch?.restrictions).toEqual(["kidneys", "lowsugar"]);
    expect(r.patch?.limitations).toBe("почки, без сахара, no peanuts");
  });

  test("text the tag vocabulary cannot classify still survives as limitations", () => {
    const r = step(user(atRestrictions), { type: "text", text: "gastritis, nothing spicy" }, t);
    expect(r.patch?.restrictions).toEqual([]); // no tag matches
    expect(r.patch?.limitations).toBe("gastritis, nothing spicy");
    expect(r.nextState).toBe("active");
  });

  test("skipping restrictions stores the '' limitations sentinel, not undefined", () => {
    const r = step(user({ ...atRestrictions, goal: "gain" }), {
      type: "callback",
      data: "restrictions_skip",
    }, t);
    // '' not undefined: applyOnboarding persists on `!== undefined`, and "asked and declined"
    // must be distinguishable from "never asked".
    expect(r.patch?.limitations).toBe("");
  });

  test("a whitespace-only restrictions answer stores '' rather than null", () => {
    const r = step(user(atRestrictions), { type: "text", text: "   \n  " }, t);
    expect(r.patch?.limitations).toBe("");
    expect(r.nextState).toBe("active");
  });

  test("the stored limitation is normalized (single line, no quotes)", () => {
    const r = step(user(atRestrictions), { type: "text", text: 'no  "junk"\nno peanuts' }, t);
    expect(r.patch?.limitations).toBe("no junk no peanuts");
  });
});

describe("decline", () => {
  test("decline stays consent, tells them how to resume", () => {
    const r = step(user({ state: "consent" }), { type: "callback", data: "consent_decline" }, t);
    expect(r.nextState).toBe("consent");
    expect(r.reply).toContain("/start");
    expect(r.patch?.consent_at).toBeUndefined();
  });
});

describe("/start mid-flow resumes without clobbering progress", () => {
  test("resume at profile (no goal yet) re-asks goal", () => {
    const r = step(user({ state: "profile", goal: null }), { type: "command", command: "start" }, t);
    expect(r.nextState).toBe("profile");
    expect(buttonData(r)).toEqual(
      expect.arrayContaining(["goal_lose", "goal_maintain", "goal_gain"]),
    );
    expect(r.patch?.consent_at).toBeUndefined(); // does not re-stamp consent
  });

  test("resume at profile (goal set, no weight yet) re-asks weight", () => {
    const r = step(user(atWeight), { type: "command", command: "start" }, t);
    expect(r.nextState).toBe("profile");
    expect(buttonData(r)).toContain("weight_skip");
    expect(r.patch?.goal).toBeUndefined(); // does not overwrite the chosen goal
  });

  test("resume at profile (weight answered/skipped, no target) re-asks target weight", () => {
    for (const weight_kg of [92, 0]) {
      const r = step(user({ state: "profile", goal: "lose", weight_kg }), {
        type: "command",
        command: "start",
      }, t);
      expect(r.nextState).toBe("profile");
      expect(buttonData(r)).toContain("target_weight_skip");
    }
  });

  test("resume at profile (target answered/skipped, no country) re-asks country", () => {
    for (const target_weight_kg of [85, 0]) {
      const r = step(user({ state: "profile", goal: "lose", weight_kg: 92, target_weight_kg }), {
        type: "command",
        command: "start",
      }, t);
      expect(r.nextState).toBe("profile");
      expect(buttonData(r)).toContain("country_skip");
    }
  });

  test("resume at profile (country answered/skipped) re-asks restrictions", () => {
    for (const country of ["de", ""]) {
      const r = step(user({ state: "profile", goal: "lose", weight_kg: 92, target_weight_kg: 85, country }), {
        type: "command",
        command: "start",
      }, t);
      expect(r.nextState).toBe("profile");
      expect(buttonData(r)).toContain("restrictions_skip");
    }
  });

  test("resume at active just tells them to send photos", () => {
    const r = step(user({ state: "active", goal: "lose" }), {
      type: "command",
      command: "start",
    }, t);
    expect(r.nextState).toBe("active");
    expect(r.reply).toBe(t("onboarding.alreadyActive"));
  });
});

describe("guards / idempotency", () => {
  test("consent_agree when already active is a no-op resume (does not reset)", () => {
    const r = step(user({ state: "active", goal: "lose" }), {
      type: "callback",
      data: "consent_agree",
    }, t);
    expect(r.nextState).toBe("active");
    expect(r.patch?.consent_at).toBeUndefined();
  });

  test("goal callback when goal already set does not overwrite", () => {
    const r = step(user(atWeight), { type: "callback", data: "goal_gain" }, t);
    expect(r.patch?.goal).toBeUndefined();
    expect(r.nextState).toBe("profile");
  });

  test("restrictions_skip while an earlier question is open resumes there, never completes", () => {
    const r = step(user({ state: "profile", goal: "lose", weight_kg: null }), {
      type: "callback",
      data: "restrictions_skip",
    }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch).toBeUndefined();
    expect(buttonData(r)).toContain("weight_skip"); // resumed at the weight step
  });

  test("weight_skip before a goal is chosen re-asks the goal, stores nothing", () => {
    const r = step(user({ state: "profile", goal: null }), {
      type: "callback",
      data: "weight_skip",
    }, t);
    expect(r.patch).toBeUndefined();
    expect(buttonData(r)).toContain("goal_lose");
  });

  test("target_weight_skip before the weight is answered resumes at weight", () => {
    const r = step(user(atWeight), { type: "callback", data: "target_weight_skip" }, t);
    expect(r.patch).toBeUndefined();
    expect(buttonData(r)).toContain("weight_skip");
  });

  test("country_skip before the target is answered resumes at target", () => {
    const r = step(user(atTarget), { type: "callback", data: "country_skip" }, t);
    expect(r.patch).toBeUndefined();
    expect(buttonData(r)).toContain("target_weight_skip");
  });

  test("an active user with no stored weight texting a number is nudged, not re-onboarded", () => {
    const r = step(user({ state: "active", goal: "lose", weight_kg: null }), {
      type: "text",
      text: "92",
    }, t);
    expect(r.nextState).toBe("active");
    expect(r.patch).toBeUndefined();
  });

  test("parseWeight accepts the documented boundaries and takes the FIRST number", () => {
    expect(step(user(atWeight), { type: "text", text: "30" }, t).patch?.weight_kg).toBe(30);
    expect(step(user(atWeight), { type: "text", text: "300" }, t).patch?.weight_kg).toBe(300);
    // "92 kg, yesterday 80" must not silently prefer the wrong number
    expect(step(user(atWeight), { type: "text", text: "92 kg yesterday 80" }, t).patch?.weight_kg).toBe(92);
  });

  test("weight_skip after the weight was answered does not zero it (resumes at target)", () => {
    const r = step(user(atTarget), { type: "callback", data: "weight_skip" }, t);
    expect(r.patch?.weight_kg).toBeUndefined();
    expect(r.nextState).toBe("profile");
    expect(buttonData(r)).toContain("target_weight_skip"); // resumes at the real current step
  });

  test("text during consent nudges toward the buttons", () => {
    const r = step(user({ state: "consent" }), { type: "text", text: "hi" }, t);
    expect(r.nextState).toBe("consent");
  });

  test("an unknown callback re-prompts the current step rather than advancing", () => {
    const r = step(user({ state: "profile", goal: null }), { type: "callback", data: "nope" }, t);
    expect(r.nextState).toBe("profile");
    expect(buttonData(r)).toContain("goal_lose");
  });
});

describe("localization", () => {
  // Every reachable reply and button label, in every locale, must be real copy — a missing
  // key would surface here as the raw key name leaking to a user.
  const INPUTS = [
    { u: undefined, i: { type: "command", command: "start" } },
    { u: user({ state: "consent" }), i: { type: "callback", data: "consent_agree" } },
    { u: user({ state: "consent" }), i: { type: "callback", data: "consent_decline" } },
    { u: user({ state: "profile", goal: null }), i: { type: "callback", data: "goal_lose" } },
    { u: user(atWeight), i: { type: "text", text: "92" } },
    { u: user(atWeight), i: { type: "text", text: "not a weight" } },
    { u: user(atWeight), i: { type: "callback", data: "weight_skip" } },
    { u: user(atTarget), i: { type: "text", text: "85" } },
    { u: user(atTarget), i: { type: "text", text: "nope" } },
    { u: user(atTarget), i: { type: "callback", data: "target_weight_skip" } },
    { u: user(atCountry), i: { type: "callback", data: "country_de" } },
    { u: user(atCountry), i: { type: "callback", data: "country_other" } },
    { u: user(atCountry), i: { type: "text", text: "Portugal" } },
    { u: user(atCountry), i: { type: "callback", data: "country_skip" } },
    { u: user(atRestrictions), i: { type: "callback", data: "restrictions_skip" } },
    { u: user(atRestrictions), i: { type: "text", text: "x" } },
    { u: user({ state: "active", goal: "lose" }), i: { type: "command", command: "start" } },
    { u: user({ state: "consent" }), i: { type: "text", text: "hi" } },
  ] as const;

  test.each(LANGS)("%s renders every reply and button label", (lang) => {
    const tl = translatorFor(lang);
    for (const { u, i } of INPUTS) {
      const r = step(u, i as any, tl);
      expect(r.reply.trim()).not.toBe("");
      expect(r.reply).not.toMatch(/onboarding\.[a-zA-Z.]+/);
      for (const label of buttonText(r)) {
        expect(label.trim()).not.toBe("");
        expect(label).not.toMatch(/(onboarding|country)\.[a-zA-Z.]+/);
      }
    }
  });

  test("locales differ — the same step yields different copy", () => {
    const replies = LANGS.map(
      (l) => step(undefined, { type: "command", command: "start" }, translatorFor(l)).reply,
    );
    expect(new Set(replies).size).toBe(LANGS.length);
  });
});
