import { describe, expect, test } from "bun:test";
import { step, type OnboardingUser } from "./onboarding.ts";
import { LANGS, translatorFor } from "./i18n/index.ts";

const t = translatorFor("ru");

function user(over: Partial<OnboardingUser> = {}): OnboardingUser {
  return { state: "consent", goal: null, weight_kg: null, ...over };
}
function buttonData(r: { buttons?: { text: string; data: string }[][] }): string[] {
  return (r.buttons ?? []).flat().map((b) => b.data);
}
function buttonText(r: { buttons?: { text: string; data: string }[][] }): string[] {
  return (r.buttons ?? []).flat().map((b) => b.text);
}

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

  test("weight text -> stays profile, stores kg, asks restrictions", () => {
    const r = step(user({ state: "profile", goal: "lose" }), { type: "text", text: "92,5 кг" }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.weight_kg).toBe(92.5);
    expect(buttonData(r)).toContain("restrictions_skip");
  });

  test("weight skip -> stores the 0 sentinel, asks restrictions", () => {
    const r = step(user({ state: "profile", goal: "lose" }), {
      type: "callback",
      data: "weight_skip",
    }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.weight_kg).toBe(0);
    expect(buttonData(r)).toContain("restrictions_skip");
  });

  test("unparseable or out-of-range weight re-asks without a patch", () => {
    for (const text of ["abc", "20", "500", "-5"]) {
      const r = step(user({ state: "profile", goal: "lose" }), { type: "text", text }, t);
      expect(r.nextState).toBe("profile");
      expect(r.patch).toBeUndefined();
      expect(r.reply).toBe(t("onboarding.weightInvalid"));
      expect(buttonData(r)).toContain("weight_skip"); // skip stays available on a re-ask
    }
  });

  test("restriction free text -> active, parses tags", () => {
    const r = step(user({ state: "profile", goal: "lose", weight_kg: 92 }), {
      type: "text",
      text: "почки, без сахара",
    }, t);
    expect(r.nextState).toBe("active");
    expect(r.patch?.restrictions).toEqual(["kidneys", "lowsugar"]);
    expect(r.reply).toBe(t("onboarding.done"));
  });

  test("restrictions work after a skipped weight (0 sentinel counts as answered)", () => {
    const r = step(user({ state: "profile", goal: "lose", weight_kg: 0 }), {
      type: "text",
      text: "kidneys",
    }, t);
    expect(r.nextState).toBe("active");
    expect(r.patch?.restrictions).toEqual(["kidneys"]);
  });

  test("skip restrictions -> active with empty tags", () => {
    const r = step(user({ state: "profile", goal: "gain", weight_kg: 80 }), {
      type: "callback",
      data: "restrictions_skip",
    }, t);
    expect(r.nextState).toBe("active");
    expect(r.patch?.restrictions).toEqual([]);
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
    const r = step(user({ state: "profile", goal: "lose" }), {
      type: "command",
      command: "start",
    }, t);
    expect(r.nextState).toBe("profile");
    expect(buttonData(r)).toContain("weight_skip");
    expect(r.patch?.goal).toBeUndefined(); // does not overwrite the chosen goal
  });

  test("resume at profile (weight answered or skipped) re-asks restrictions", () => {
    for (const weight_kg of [92, 0]) {
      const r = step(user({ state: "profile", goal: "lose", weight_kg }), {
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
    const r = step(user({ state: "profile", goal: "lose" }), {
      type: "callback",
      data: "goal_gain",
    }, t);
    expect(r.patch?.goal).toBeUndefined();
    expect(r.nextState).toBe("profile");
  });

  test("restrictions_skip while the weight question is open resumes at weight, never completes", () => {
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

  test("an active user with no stored weight texting a number is nudged, not re-onboarded", () => {
    // Every pre-weight-step user is exactly this shape after the migration.
    const r = step(user({ state: "active", goal: "lose", weight_kg: null }), {
      type: "text",
      text: "92",
    }, t);
    expect(r.nextState).toBe("active");
    expect(r.patch).toBeUndefined();
  });

  test("parseWeight accepts the documented boundaries and takes the FIRST number", () => {
    expect(step(user({ state: "profile", goal: "lose" }), { type: "text", text: "30" }, t).patch?.weight_kg).toBe(30);
    expect(step(user({ state: "profile", goal: "lose" }), { type: "text", text: "300" }, t).patch?.weight_kg).toBe(300);
    // "92 kg, yesterday 80" must not silently prefer the wrong number
    expect(step(user({ state: "profile", goal: "lose" }), { type: "text", text: "92 kg yesterday 80" }, t).patch?.weight_kg).toBe(92);
  });

  test("weight_skip after the weight was answered does not zero it", () => {
    const r = step(user({ state: "profile", goal: "lose", weight_kg: 92 }), {
      type: "callback",
      data: "weight_skip",
    }, t);
    expect(r.patch?.weight_kg).toBeUndefined();
    expect(r.nextState).toBe("profile");
    expect(buttonData(r)).toContain("restrictions_skip"); // resumes at the real current step
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
    { u: user({ state: "profile", goal: "lose" }), i: { type: "text", text: "92" } },
    { u: user({ state: "profile", goal: "lose" }), i: { type: "text", text: "not a weight" } },
    { u: user({ state: "profile", goal: "lose" }), i: { type: "callback", data: "weight_skip" } },
    { u: user({ state: "profile", goal: "lose", weight_kg: 92 }), i: { type: "callback", data: "restrictions_skip" } },
    { u: user({ state: "profile", goal: "lose", weight_kg: 92 }), i: { type: "text", text: "x" } },
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
        expect(label).not.toMatch(/onboarding\.[a-zA-Z.]+/);
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
