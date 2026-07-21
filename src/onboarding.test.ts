import { describe, expect, test } from "bun:test";
import { step, type OnboardingUser } from "./onboarding.ts";

function user(over: Partial<OnboardingUser> = {}): OnboardingUser {
  return { state: "consent", goal: null, ...over };
}
function buttonData(r: { buttons?: { text: string; data: string }[][] }): string[] {
  return (r.buttons ?? []).flat().map((b) => b.data);
}

describe("happy path consent -> profile -> active", () => {
  test("new user /start -> consent with agree/decline buttons", () => {
    const r = step(undefined, { type: "command", command: "start" });
    expect(r.nextState).toBe("consent");
    expect(r.reply).toContain("/delete"); // consent copy names how to erase
    expect(buttonData(r)).toEqual(expect.arrayContaining(["consent_agree", "consent_decline"]));
  });

  test("[Согласен] -> profile, records consent_at, asks goal", () => {
    const at = new Date("2026-07-21T10:00:00Z");
    const r = step(user({ state: "consent" }), { type: "callback", data: "consent_agree" }, at);
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
    });
    expect(r.nextState).toBe("profile");
    expect(r.patch?.goal).toBe("lose");
    expect(buttonData(r)).toContain("restrictions_skip");
  });

  test("restriction free text -> active, parses tags", () => {
    const r = step(user({ state: "profile", goal: "lose" }), {
      type: "text",
      text: "почки, без сахара",
    });
    expect(r.nextState).toBe("active");
    expect(r.patch?.restrictions).toEqual(["kidneys", "lowsugar"]);
    expect(r.reply).toContain("фото"); // "шли фото еды"
  });

  test("[Пропустить] restrictions -> active with empty tags", () => {
    const r = step(user({ state: "profile", goal: "gain" }), {
      type: "callback",
      data: "restrictions_skip",
    });
    expect(r.nextState).toBe("active");
    expect(r.patch?.restrictions).toEqual([]);
  });
});

describe("decline", () => {
  test("[Отказ] stays consent, tells them how to resume", () => {
    const r = step(user({ state: "consent" }), { type: "callback", data: "consent_decline" });
    expect(r.nextState).toBe("consent");
    expect(r.reply).toContain("/start");
    expect(r.patch?.consent_at).toBeUndefined();
  });
});

describe("/start mid-flow resumes without clobbering progress", () => {
  test("resume at profile (no goal yet) re-asks goal", () => {
    const r = step(user({ state: "profile", goal: null }), { type: "command", command: "start" });
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
    });
    expect(r.nextState).toBe("profile");
    expect(buttonData(r)).toContain("restrictions_skip");
    expect(r.patch?.goal).toBeUndefined(); // does not overwrite the chosen goal
  });

  test("resume at active just tells them to send photos", () => {
    const r = step(user({ state: "active", goal: "lose" }), {
      type: "command",
      command: "start",
    });
    expect(r.nextState).toBe("active");
    expect(r.reply).toContain("фото");
  });
});

describe("guards / idempotency", () => {
  test("consent_agree when already active is a no-op resume (does not reset)", () => {
    const r = step(user({ state: "active", goal: "lose" }), {
      type: "callback",
      data: "consent_agree",
    });
    expect(r.nextState).toBe("active");
    expect(r.patch?.consent_at).toBeUndefined();
  });

  test("goal callback when goal already set does not overwrite", () => {
    const r = step(user({ state: "profile", goal: "lose" }), {
      type: "callback",
      data: "goal_gain",
    });
    expect(r.patch?.goal).toBeUndefined();
    expect(r.nextState).toBe("profile");
  });

  test("text during consent nudges toward the buttons", () => {
    const r = step(user({ state: "consent" }), { type: "text", text: "hi" });
    expect(r.nextState).toBe("consent");
  });
});
