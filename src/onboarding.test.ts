import { describe, expect, test } from "bun:test";
import { step, type OnboardingUser } from "./onboarding.ts";
import { LANGS, translatorFor } from "./i18n/index.ts";

const t = translatorFor("ru");

function user(over: Partial<OnboardingUser> = {}): OnboardingUser {
  return { state: "consent", goal: null, ...over };
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

  test("goal chosen -> stays profile, sets goal, asks restrictions with skip", () => {
    const r = step(user({ state: "profile", goal: null }), {
      type: "callback",
      data: "goal_lose",
    }, t);
    expect(r.nextState).toBe("profile");
    expect(r.patch?.goal).toBe("lose");
    expect(buttonData(r)).toContain("restrictions_skip");
  });

  test("restriction free text -> active, parses tags", () => {
    const r = step(user({ state: "profile", goal: "lose" }), {
      type: "text",
      text: "почки, без сахара",
    }, t);
    expect(r.nextState).toBe("active");
    expect(r.patch?.restrictions).toEqual(["kidneys", "lowsugar"]);
    expect(r.reply).toBe(t("onboarding.done"));
  });

  test("skip restrictions -> active with empty tags", () => {
    const r = step(user({ state: "profile", goal: "gain" }), {
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

  test("resume at profile (goal set) re-asks restrictions", () => {
    const r = step(user({ state: "profile", goal: "lose" }), {
      type: "command",
      command: "start",
    }, t);
    expect(r.nextState).toBe("profile");
    expect(buttonData(r)).toContain("restrictions_skip");
    expect(r.patch?.goal).toBeUndefined(); // does not overwrite the chosen goal
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
    { u: user({ state: "profile", goal: "lose" }), i: { type: "callback", data: "restrictions_skip" } },
    { u: user({ state: "profile", goal: "lose" }), i: { type: "text", text: "x" } },
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
