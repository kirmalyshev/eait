// Onboarding: the shape, the sequence, and the boundary an admin cannot cross.
//
// The tests that matter here are the refusals. Editable copy is a feature with an obvious failure
// mode — an admin removes a question, or renames an option value, and the app either renders blank
// rows or collects nothing for a field the calorie target is computed from. Every `expect(...ok)
// .toBe(false)` below is one of those failures caught at the save rather than on a phone.

import { describe, expect, it } from "bun:test";
import {
  DEFAULT_ONBOARDING_CONTENT, ONBOARDING_SCREENS, ONBOARDING_STEPS, REPORTABLE_FIELDS,
  SCREEN_FIELDS, applicableScreens, disabledScreens, nextScreenIndex, nextStep, orderedScreens,
  screenForStep, usableContent, validateOnboardingContent,
  type OnboardingContent, type Profile,
} from "./index.ts";

function profile(over: Partial<Profile> = {}): Profile {
  return {
    user_id: "u1", lang: "en", goal: null, sex: null, birth_year: null, height_cm: null,
    weight_kg: null, target_weight_kg: null, activity: null, pace: null, country: null,
    restrictions: [], medical_limitations: null, food_allergies: null, product_limitations: null,
    onboarded_at: null,
    ...over,
  };
}

/** A complete profile, one field short of done. */
const ANSWERED = profile({
  goal: "lose", sex: "male", birth_year: 1990, height_cm: 183, weight_kg: 93,
  target_weight_kg: 88, activity: "moderate", pace: "steady", country: "de",
});

const clone = (c: OnboardingContent): OnboardingContent => structuredClone(c);

describe("screens cover the steps", () => {
  it("collects every step on exactly one screen", () => {
    const collected = ONBOARDING_SCREENS.flatMap((id) => [...SCREEN_FIELDS[id]]);
    expect([...collected].sort()).toEqual([...ONBOARDING_STEPS].sort());
    // No step on two screens — which would mean a question asked twice, and a "back" that lands
    // somewhere it did not come from.
    expect(new Set(collected).size).toBe(collected.length);
  });

  it("finds the screen for every step", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(ONBOARDING_SCREENS).toContain(screenForStep(step));
    }
  });

  it("is shorter than the step list — the whole point of grouping", () => {
    expect(ONBOARDING_SCREENS.length).toBeLessThan(ONBOARDING_STEPS.length);
  });
});

describe("the shipped copy", () => {
  it("validates", () => {
    const result = validateOnboardingContent(DEFAULT_ONBOARDING_CONTENT);
    // Printed, not just asserted: a failure here should say WHAT is wrong with the default.
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.ok).toBe(true);
  });

  it("labels every option the app can render", () => {
    for (const screen of DEFAULT_ONBOARDING_CONTENT.screens) {
      if (!screen.options) continue;
      for (const [key, o] of Object.entries(screen.options)) {
        expect(o.label.trim(), `${screen.id}.${key}`).not.toBe("");
      }
    }
  });
});

describe("validation refuses what would break the app", () => {
  const bad = (mutate: (c: OnboardingContent) => unknown) => {
    const result = validateOnboardingContent(mutate(clone(DEFAULT_ONBOARDING_CONTENT)));
    expect(result.ok).toBe(false);
    return result.ok ? [] : result.errors;
  };

  it("a missing screen", () => {
    const errors = bad((c) => {
      c.screens = c.screens.filter((s) => s.id !== "about");
      return c;
    });
    expect(errors.join(" ")).toContain("about");
  });

  it("a duplicated screen", () => {
    const errors = bad((c) => {
      c.screens = [...c.screens, c.screens[0]!];
      return c;
    });
    expect(errors.join(" ")).toContain("twice");
  });

  it("an option value outside the closed vocabulary", () => {
    const errors = bad((c) => {
      const goal = c.screens.find((s) => s.id === "goal")!;
      goal.options = { ...goal.options, sprint: { label: "Sprint" } };
      return c;
    });
    expect(errors.join(" ")).toContain("sprint");
  });

  it("a missing option label — the blank tappable row", () => {
    const errors = bad((c) => {
      const activity = c.screens.find((s) => s.id === "activity")!;
      delete activity.options!.athlete;
      return c;
    });
    expect(errors.join(" ")).toContain("athlete");
  });

  it("a mood the binary has no face for", () => {
    const errors = bad((c) => {
      c.screens[0]!.mascot.mood = "smug" as never;
      return c;
    });
    expect(errors.join(" ")).toContain("mood");
  });

  it("an empty mascot line", () => {
    bad((c) => {
      c.screens[0]!.mascot.line = "   ";
      return c;
    });
  });

  it("a title long enough to clip on a small phone", () => {
    const errors = bad((c) => {
      c.screens[0]!.title = "x".repeat(200);
      return c;
    });
    expect(errors.join(" ")).toContain("characters");
  });

  it("disabling a screen whose answer feeds the calorie target", () => {
    // THE ONE THAT MATTERS MOST. An admin who could switch off "activity" would be shipping a
    // target computed from a multiplier nobody chose, to every new user, silently.
    const errors = bad((c) => {
      c.screens.find((s) => s.id === "activity")!.enabled = false;
      return c;
    });
    expect(errors.join(" ")).toContain("calorie target");
  });

  it("reports every problem at once, not the first", () => {
    const errors = bad((c) => {
      c.screens[0]!.title = "";
      c.screens[1]!.title = "";
      return c;
    });
    expect(errors.length).toBeGreaterThan(1);
  });

  it("junk", () => {
    expect(validateOnboardingContent(null).ok).toBe(false);
    expect(validateOnboardingContent("nope").ok).toBe(false);
    expect(validateOnboardingContent({ version: 1 }).ok).toBe(false);
    expect(validateOnboardingContent({ version: 0, screens: [], summary: {} }).ok).toBe(false);
  });
});

describe("validation allows what an admin is meant to do", () => {
  const good = (mutate: (c: OnboardingContent) => OnboardingContent) => {
    const result = validateOnboardingContent(mutate(clone(DEFAULT_ONBOARDING_CONTENT)));
    if (!result.ok) throw new Error(result.errors.join("\n"));
    return result.content;
  };

  it("rewriting every word", () => {
    const c = good((x) => {
      for (const s of x.screens) {
        s.title = "Rewritten";
        s.mascot.line = "New line";
        if (s.options) for (const o of Object.values(s.options)) o.label = "New label";
      }
      return x;
    });
    expect(c.screens[0]!.title).toBe("Rewritten");
  });

  it("reordering", () => {
    const c = good((x) => {
      x.screens = [x.screens[x.screens.length - 1]!, ...x.screens.slice(0, -1)];
      return x;
    });
    expect(c.screens[0]!.id).toBe("restrictions");
  });

  it("switching off the one optional screen", () => {
    const c = good((x) => {
      x.screens.find((s) => s.id === "country")!.enabled = false;
      return x;
    });
    expect(disabledScreens(c)).toEqual(["country"]);
  });

  it("dropping an optional hint", () => {
    good((x) => {
      delete x.screens.find((s) => s.id === "activity")!.options!.moderate!.hint;
      return x;
    });
  });
});

describe("which screen comes next", () => {
  const content = DEFAULT_ONBOARDING_CONTENT;

  it("starts at the first one", () => {
    expect(nextScreenIndex(content, profile())).toBe(0);
    expect(orderedScreens(content, profile())[0]!.id).toBe("goal");
  });

  it("is derived from the fields, not from a counter", () => {
    // Height answered but weight not: still the body screen, which is what makes a mid-flow kill
    // resume correctly rather than skipping the unanswered half of a grouped screen.
    const p = profile({ goal: "lose", sex: "male", birth_year: 1990, height_cm: 183 });
    expect(orderedScreens(content, p)[nextScreenIndex(content, p)]!.id).toBe("body");
  });

  it("skips the whole target screen for a maintainer", () => {
    const p = profile({ goal: "maintain" });
    const ids = applicableScreens(p);
    // Goal weight and pace live on ONE screen, and it is exactly the pair a maintainer is asked
    // neither of — so the screen disappears rather than rendering with nothing on it.
    expect(ids).not.toContain("target");
    expect(ids).toContain("body");
    expect(ids).toHaveLength(applicableScreens(profile({ goal: "lose" })).length - 1);
  });

  it("keeps at most two entry fields on any screen", () => {
    // A hard layout constraint, not a preference — see the note on `SCREEN_FIELDS`. A third number
    // field puts itself and the primary button under a keyboard with no return key.
    for (const id of ONBOARDING_SCREENS) {
      expect(SCREEN_FIELDS[id].length, id).toBeLessThanOrEqual(2);
    }
  });

  it("ends on the summary once onboarding is complete", () => {
    const done = profile({ ...ANSWERED, onboarded_at: new Date().toISOString() });
    expect(nextScreenIndex(content, done)).toBe(orderedScreens(content, done).length);
    expect(nextStep(done)).toBeNull();
  });

  it("stops on restrictions until onboarding is completed, even with every field set", () => {
    // An empty restriction list is a real answer, indistinguishable from "never asked" — so the
    // completion flag carries that bit and this screen is the last stop rather than being skipped.
    const i = nextScreenIndex(content, ANSWERED);
    expect(orderedScreens(content, ANSWERED)[i]!.id).toBe("restrictions");
  });

  it("follows the admin's order, not the canonical one", () => {
    const reordered = clone(content);
    reordered.screens = [
      reordered.screens.find((s) => s.id === "country")!,
      ...reordered.screens.filter((s) => s.id !== "country"),
    ];
    const first = orderedScreens(reordered, profile())[nextScreenIndex(reordered, profile())]!;
    expect(first.id).toBe("country");
  });

  it("skips a disabled optional screen entirely", () => {
    const off = clone(content);
    off.screens.find((s) => s.id === "country")!.enabled = false;
    const ids = orderedScreens(off, profile()).map((s) => s.id);
    expect(ids).not.toContain("country");
    // And the flow still terminates: an unanswered `country` no longer holds anything up.
    const p = profile({ ...ANSWERED, country: null, onboarded_at: new Date().toISOString() });
    expect(nextScreenIndex(off, p)).toBe(orderedScreens(off, p).length);
  });
});

describe("content from a server this binary does not match", () => {
  // The whole point of fetching copy at runtime is that the two sides drift. A shipped app outlives
  // the server it was built against, so BOTH directions of drift are normal operation rather than
  // edge cases — and one of them already turned onboarding into a blank screen on a simulator.

  it("drops a screen from a newer server rather than crashing on it", () => {
    const future = clone(DEFAULT_ONBOARDING_CONTENT);
    future.screens.push({
      id: "sleep" as never,
      title: "How do you sleep?",
      mascot: { mood: "happy", line: "New question, newer app." },
    });

    const shown = orderedScreens(future, profile());
    expect(shown.map((s) => s.id)).not.toContain("sleep");
    // And the rest of the flow is intact — dropped, not discarded wholesale.
    expect(shown.map((s) => s.id)).toContain("goal");
    // The crash this replaced: `SCREEN_FIELDS["sleep"]` is undefined, and `.some` on it threw on
    // every render.
    expect(() => nextScreenIndex(future, profile())).not.toThrow();
  });

  it("falls back entirely when a screen this binary needs is missing", () => {
    const old = clone(DEFAULT_ONBOARDING_CONTENT);
    old.screens = old.screens.filter((s) => s.id !== "target");

    // Not "use it minus the missing screen" — that would be a flow that never asks for a goal
    // weight, and therefore a calorie target computed from a field nobody filled in.
    expect(usableContent(old)).toBe(DEFAULT_ONBOARDING_CONTENT);
  });

  it("falls back on anything that is not content at all", () => {
    for (const junk of [null, undefined, 7, "{}", {}, { version: 1 }, { version: "x", screens: [], summary: {} }]) {
      expect(usableContent(junk)).toBe(DEFAULT_ONBOARDING_CONTENT);
    }
  });

  it("keeps content that covers every screen, whatever else it carries", () => {
    const fine = clone(DEFAULT_ONBOARDING_CONTENT);
    fine.version = 12;
    expect(usableContent(fine).version).toBe(12);
  });
});

describe("what may be reported to analytics", () => {
  it("never the numbers, never the free text", () => {
    // The list is the mechanism that keeps body weight and a medical free-text field out of an
    // analytics table that outlives the screen it was typed on.
    for (const field of ["birth_year", "height_cm", "weight_kg", "target_weight_kg"] as const) {
      expect(REPORTABLE_FIELDS).not.toContain(field);
    }
    expect(REPORTABLE_FIELDS).toContain("goal");
    expect(REPORTABLE_FIELDS).toContain("restrictions");
  });

  it("covers only real profile fields", () => {
    for (const f of REPORTABLE_FIELDS) expect(ONBOARDING_STEPS).toContain(f);
  });
});
