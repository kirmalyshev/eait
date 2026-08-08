// Onboarding: the shape, the sequence, and the boundary an admin cannot cross.
//
// The tests that matter here are the refusals. Editable copy is a feature with an obvious failure
// mode — an admin removes a question, or renames an option value, and the app either renders blank
// rows or collects nothing for a field the calorie target is computed from. Every `expect(...ok)
// .toBe(false)` below is one of those failures caught at the save rather than on a phone.

import { describe, expect, it } from "bun:test";
import {
  DEFAULT_ONBOARDING_CONTENT, ONBOARDING_PLACES, ONBOARDING_SCREENS, ONBOARDING_STEPS,
  KCAL_FLOOR, COUNTRY_CODES, countryFromRegion,
  REPORTABLE_FIELDS, SCREEN_FIELDS, applicableScreens, disabledScreens, nextScreenIndex, nextStep,
  orderedScreens, screenForStep, usableContent, validateOnboardingContent,
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
    // Switched ON for this test. `country` ships disabled — it is read from the device region
    // instead of asked — and a disabled screen is filtered out before ordering is even considered,
    // which would make this assert nothing. The claim here is about ORDER, so the subject has to be
    // a screen that renders.
    const country = reordered.screens.find((s) => s.id === "country")!;
    country.enabled = true;
    reordered.screens = [country, ...reordered.screens.filter((s) => s.id !== "country")];
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

describe("the interstitials", () => {
  // `welcome` and `building` are places, not screens. They collect nothing, so they stay out of
  // ONBOARDING_SCREENS and SCREEN_FIELDS — which is what keeps the three-layer boundary the same
  // shape it was before they existed.

  it("are not screens", () => {
    for (const id of ["welcome", "building", "summary"]) {
      expect(ONBOARDING_SCREENS as readonly string[]).not.toContain(id);
    }
  });

  it("are places", () => {
    for (const place of ["welcome", "building", "summary"] as const) {
      expect(ONBOARDING_PLACES).toContain(place);
    }
    for (const id of ONBOARDING_SCREENS) expect(ONBOARDING_PLACES).toContain(id);
  });

  it("ship with copy that validates", () => {
    const result = validateOnboardingContent(DEFAULT_ONBOARDING_CONTENT);
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(DEFAULT_ONBOARDING_CONTENT.welcome.points.length).toBeGreaterThan(0);
    expect(DEFAULT_ONBOARDING_CONTENT.building.title.trim()).not.toBe("");
  });

  it("refuse copy the app could not render", () => {
    const bad = (mutate: (c: OnboardingContent) => unknown) =>
      expect(validateOnboardingContent(mutate(clone(DEFAULT_ONBOARDING_CONTENT))).ok).toBe(false);

    bad((c) => { (c as { welcome?: unknown }).welcome = undefined; return c; });
    bad((c) => { (c as { building?: unknown }).building = undefined; return c; });
    bad((c) => { c.welcome.title = ""; return c; });
    bad((c) => { c.welcome.points = []; return c; });
    bad((c) => { c.welcome.points = ["a", "b", "c", "d", "e"]; return c; });
    bad((c) => { c.welcome.mascot.mood = "smug" as never; return c; });
    bad((c) => { c.building.cta = ""; return c; });
  });

  // The billing beat is the largest complaint cluster in the category cross-read, and the wording
  // rule from that doc is specific: "no card to start" is true and checkable; "free" is not, and
  // naming a competitor invites a comparison argument we lose.
  it("say what we do not ask for, without naming anyone or claiming free", () => {
    const words = [
      DEFAULT_ONBOARDING_CONTENT.welcome.title,
      ...DEFAULT_ONBOARDING_CONTENT.welcome.points,
      DEFAULT_ONBOARDING_CONTENT.welcome.mascot.line,
    ].join(" ").toLowerCase();

    expect(words).toContain("card");
    for (const competitor of ["cal ai", "calai", "myfitnesspal", "noom", "yazio", "lose it"]) {
      expect(words).not.toContain(competitor);
    }
    // An unqualified "free" is the one claim DECISIONS.md rules out by name.
    expect(words).not.toMatch(/\bfree\b/);
  });

  it("fills a missing interstitial from the default without discarding the revision", () => {
    // The opposite of the screens rule, and deliberately so. `usableContent` drops a whole revision
    // when a SCREEN is missing because the result would be a flow that never asks a question the
    // calorie target needs. An interstitial asks nothing, so the same penalty would cost an admin
    // every word they edited in exchange for nothing.
    const old = clone(DEFAULT_ONBOARDING_CONTENT);
    old.version = 12;
    old.screens[0]!.title = "Edited by an admin";
    delete (old as { welcome?: unknown }).welcome;

    const used = usableContent(old);
    expect(used.version).toBe(12);
    expect(used.screens[0]!.title).toBe("Edited by an admin");
    expect(used.welcome).toEqual(DEFAULT_ONBOARDING_CONTENT.welcome);
  });

  it("still discards a revision missing a screen, interstitials or not", () => {
    const old = clone(DEFAULT_ONBOARDING_CONTENT);
    old.screens = old.screens.filter((s) => s.id !== "target");
    expect(usableContent(old)).toBe(DEFAULT_ONBOARDING_CONTENT);
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

describe("the safety promise on the goal screen", () => {
  it("quotes the floors the engine actually enforces", () => {
    // The same rule the landing page is held to: a number quoted in copy is read from the code that
    // produces it. A safety guarantee the app does not implement is the worst sentence it could
    // show, and this one is shown at the exact moment a user commits to losing weight.
    //
    // BOTH are asserted because the goal screen is asked before sex is known, so the copy has to
    // name the female and male floors rather than the user's own.
    const goal = DEFAULT_ONBOARDING_CONTENT.screens.find((s) => s.id === "goal");
    expect(goal?.why).toBeTruthy();
    expect(goal!.why).toContain(String(KCAL_FLOOR.female));
    expect(goal!.why).toContain(String(KCAL_FLOOR.male));
  });

  it("stays inside the length an admin is held to", () => {
    // Shipped copy that would be rejected on the way back in is copy the admin cannot edit and
    // resave, so the default has to pass its own validator.
    const ok = validateOnboardingContent(DEFAULT_ONBOARDING_CONTENT).ok;
    expect(ok).toBe(true);
  });
});

describe("the country the device already knows", () => {
  it("maps a curated region onto its own code, case-insensitively", () => {
    expect(countryFromRegion("DE")).toBe("de");
    expect(countryFromRegion("gb")).toBe("gb");
    expect(countryFromRegion(" US ")).toBe("us");
  });

  it("answers 'other' for a region the list does not carry, and for no region at all", () => {
    // "other" is a real answer here, not a failure: it is precisely what the curated list means by
    // "somewhere we have not tuned the analyzer for". A device that reports nothing lands in the
    // same place a user picking from the list would, so no caller has an unknown state to handle.
    expect(countryFromRegion("FR")).toBe("other");
    expect(countryFromRegion(null)).toBe("other");
    expect(countryFromRegion(undefined)).toBe("other");
    expect(countryFromRegion("")).toBe("other");
  });

  it("only ever returns a value the profile field accepts", () => {
    for (const region of ["DE", "gb", "us", "RU", "FR", "zz", "", "other"]) {
      expect(COUNTRY_CODES).toContain(countryFromRegion(region));
    }
  });

  it("ships the screen off, because the device answers it", () => {
    const country = DEFAULT_ONBOARDING_CONTENT.screens.find((s) => s.id === "country");
    expect(country?.enabled).toBe(false);
    // Disabled, NOT deleted: the validator requires every known screen to be present, and an admin
    // who wants the question back should have a switch rather than a deploy.
    expect(country).toBeTruthy();
    expect(validateOnboardingContent(DEFAULT_ONBOARDING_CONTENT).ok).toBe(true);
  });
});
