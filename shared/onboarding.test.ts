// Onboarding: the shape, the sequence, and the boundary an admin cannot cross.
//
// The tests that matter here are the refusals. Editable copy is a feature with an obvious failure
// mode — an admin removes a question, or renames an option value, and the app either renders blank
// chips or collects nothing for a field the calorie target is computed from. Every `expect(...ok)
// .toBe(false)` below is one of those failures caught at the save rather than on a phone.

import { describe, expect, it } from "bun:test";
import {
  DEFAULT_ONBOARDING_CONTENT, ONBOARDING_PLACES, ONBOARDING_SCREENS, ONBOARDING_STEPS,
  KCAL_FLOOR, COUNTRY_CODES, countryFromRegion,
  REPORTABLE_FIELDS, SCREEN_FIELDS, disabledScreens, nextStep,
  screenForStep, usableContent, validateOnboardingContent,
  type OnboardingContent, type Profile,
} from "./index.ts";

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

/** A complete profile, one field short of done. */
const ANSWERED = profile({
  goal: "lose", sex: "male", birth_year: 1990, height_cm: 183, weight_kg: 93,
  target_weight_kg: 88, activity: "moderate", pace: "steady", country: "de",
});

const clone = (c: OnboardingContent): OnboardingContent => structuredClone(c);

describe("screens cover the steps", () => {
  it("collects every step in exactly one group", () => {
    const collected = ONBOARDING_SCREENS.flatMap((id) => [...SCREEN_FIELDS[id]]);
    expect([...collected].sort()).toEqual([...ONBOARDING_STEPS].sort());
    // No step in two groups — which would mean a question asked twice, and copy for it in two
    // places that can disagree.
    expect(new Set(collected).size).toBe(collected.length);
  });

  it("finds the group for every step", () => {
    for (const step of ONBOARDING_STEPS) {
      expect(ONBOARDING_SCREENS).toContain(screenForStep(step));
    }
  });

  it("keeps at most two entry fields in any group", () => {
    // Outlived the screens that needed it, and kept for the reason in the note on `SCREEN_FIELDS`:
    // a chat asks one thing at a time, and this is what stops the next person pairing three numbers
    // back into one form.
    for (const id of ONBOARDING_SCREENS) {
      expect(SCREEN_FIELDS[id].length, id).toBeLessThanOrEqual(2);
    }
  });

  it("asks the numbers before the goal weight that is checked against them", () => {
    // The wrong-direction check reads the current weight, and the BMR quick win needs sex, year and
    // height. Both are silently wrong if this order moves.
    const at = (s: string) => (ONBOARDING_STEPS as readonly string[]).indexOf(s);
    expect(at("weight_kg")).toBeLessThan(at("target_weight_kg"));
    for (const f of ["sex", "birth_year", "height_cm"]) {
      expect(at(f)).toBeLessThan(at("weight_kg"));
    }
  });
});

describe("the shipped copy", () => {
  it("validates", () => {
    const result = validateOnboardingContent(DEFAULT_ONBOARDING_CONTENT);
    // Printed, not just asserted: a failure here should say WHAT is wrong with the default.
    if (!result.ok) throw new Error(result.errors.join("\n"));
    expect(result.ok).toBe(true);
  });

  it("has a sentence for every question the app asks", () => {
    for (const screen of DEFAULT_ONBOARDING_CONTENT.screens) {
      for (const field of SCREEN_FIELDS[screen.id]) {
        expect(screen.asks[field]?.lines?.length, `${screen.id}.${field}`).toBeGreaterThan(0);
      }
    }
  });

  it("labels every option the app can render", () => {
    for (const screen of DEFAULT_ONBOARDING_CONTENT.screens) {
      if (!screen.options) continue;
      for (const [key, o] of Object.entries(screen.options)) {
        expect(o.label.trim(), `${screen.id}.${key}`).not.toBe("");
      }
    }
  });

  it("names no competitor and never claims 'free' or 'no card' bare", () => {
    // §5 of the billing cross-read, and the two wording rules the paywall added. "Free to try" and
    // "a week free" are true; "free" alone and "no card" stopped being true at step 18.
    const words = JSON.stringify(DEFAULT_ONBOARDING_CONTENT).toLowerCase();
    for (const name of ["myfitnesspal", "lose it", "noom", "cal ai", "yazio", "lifesum"]) {
      expect(words).not.toContain(name);
    }
    expect(words).not.toContain("no card");
    expect(DEFAULT_ONBOARDING_CONTENT.welcome.lines.join(" ")).toContain("free to try");
  });

  it("quotes the calorie floor the code actually enforces", () => {
    // A safety guarantee described in copy that the arithmetic does not implement is the worst
    // sentence this repo could ship.
    const floor = DEFAULT_ONBOARDING_CONTENT.building.floorTitle;
    expect(floor).toContain("{floor}");
    expect(Object.values(KCAL_FLOOR).every((v) => v > 0)).toBe(true);
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

  it("a question with nothing to ask it with", () => {
    // THE CHAT-SPECIFIC ONE. A missing ask is not a degraded screen — the conversation reaches a
    // field the target math needs and has no sentence to pose it with.
    const errors = bad((c) => {
      delete c.screens.find((s) => s.id === "body")!.asks.weight_kg;
      return c;
    });
    expect(errors.join(" ")).toContain("weight_kg");
  });

  it("an empty ask", () => {
    bad((c) => {
      c.screens.find((s) => s.id === "goal")!.asks.goal!.lines = [];
      return c;
    });
    bad((c) => {
      c.screens.find((s) => s.id === "goal")!.asks.goal!.lines = ["   "];
      return c;
    });
  });

  it("an ask for a field this group does not collect", () => {
    const errors = bad((c) => {
      c.screens.find((s) => s.id === "goal")!.asks.weight_kg = { lines: ["How heavy?"] };
      return c;
    });
    expect(errors.join(" ")).toContain("weight_kg");
  });

  it("an option value outside the closed vocabulary", () => {
    const errors = bad((c) => {
      const goal = c.screens.find((s) => s.id === "goal")!;
      goal.options = { ...goal.options, sprint: { label: "Sprint" } };
      return c;
    });
    expect(errors.join(" ")).toContain("sprint");
  });

  it("a missing option label — the blank tappable chip", () => {
    const errors = bad((c) => {
      const activity = c.screens.find((s) => s.id === "activity")!;
      delete activity.options!.athlete;
      return c;
    });
    expect(errors.join(" ")).toContain("athlete");
  });

  it("a bubble long enough to clip on a small phone", () => {
    const errors = bad((c) => {
      c.screens[0]!.asks.goal!.lines = ["x".repeat(400)];
      return c;
    });
    expect(errors.join(" ")).toContain("characters");
  });

  it("a front door that is a wall", () => {
    bad((c) => {
      c.welcome.lines = ["one", "two", "three", "four", "five"];
      return c;
    });
    bad((c) => {
      c.welcome.lines = [];
      return c;
    });
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

  it("a plan card with a hole in it", () => {
    bad((c) => {
      c.summary.kcalLabel = "";
      return c;
    });
    bad((c) => {
      c.building.floorBody = "";
      return c;
    });
  });

  it("reports every problem at once, not the first", () => {
    const errors = bad((c) => {
      c.screens[0]!.asks.goal!.lines = [""];
      c.welcome.cta = "";
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
        for (const a of Object.values(s.asks)) a.lines = ["Rewritten"];
        if (s.options) for (const o of Object.values(s.options)) o.label = "New label";
      }
      x.welcome.lines = ["A whole new opening"];
      return x;
    });
    expect(c.screens[0]!.asks.goal!.lines).toEqual(["Rewritten"]);
  });

  it("splitting one question into two bubbles", () => {
    const c = good((x) => {
      x.screens.find((s) => s.id === "goal")!.asks.goal!.lines = ["First.", "Second?"];
      return x;
    });
    expect(c.screens.find((s) => s.id === "goal")!.asks.goal!.lines).toHaveLength(2);
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

describe("which question comes next", () => {
  it("starts at the first one", () => {
    expect(nextStep(profile())).toBe("goal");
  });

  it("is derived from the fields, not from a counter", () => {
    // Height answered but weight not: still the weight question, which is what makes a mid-flow
    // kill resume correctly rather than skipping a question the target math needs.
    const p = profile({ goal: "lose", sex: "male", birth_year: 1990, height_cm: 183 });
    expect(nextStep(p)).toBe("weight_kg");
  });

  it("skips the goal weight and the pace for a maintainer", () => {
    const p = profile({ goal: "maintain", sex: "male", birth_year: 1990, height_cm: 183, weight_kg: 93 });
    expect(nextStep(p)).toBe("activity");
  });

  it("stops on restrictions until onboarding is completed, even with every field set", () => {
    // An empty restriction list is a real answer, indistinguishable from "never asked" — so the
    // completion flag carries that bit and this is the last stop rather than being skipped.
    expect(nextStep(ANSWERED)).toBe("restrictions");
  });

  it("ends once onboarding is complete", () => {
    expect(nextStep(profile({ ...ANSWERED, onboarded_at: new Date().toISOString() }))).toBeNull();
  });
});

describe("content from a server this binary does not match", () => {
  // The whole point of fetching copy at runtime is that the two sides drift. A shipped app outlives
  // the server it was built against, so BOTH directions of drift are normal operation rather than
  // edge cases — and one of them already turned onboarding into a blank screen on a simulator.

  it("keeps a revision that carries a screen from a newer server", () => {
    const future = clone(DEFAULT_ONBOARDING_CONTENT);
    future.version = 99;
    future.screens.push({ id: "sleep" as never, asks: { hours: { lines: ["New question."] } } });
    // The extra screen is carried but never asked: the app walks `CHAT_PROMPTS`, which is compiled
    // in, so an id it has no field for cannot reach a renderer at all.
    expect(usableContent(future).version).toBe(99);
  });

  it("falls back entirely when a question this binary asks has no words", () => {
    const old = clone(DEFAULT_ONBOARDING_CONTENT);
    delete old.screens.find((s) => s.id === "target")!.asks.pace;
    // Not "use it minus the missing ask" — that would be a conversation that stops dead on a field
    // the calorie target is computed from.
    expect(usableContent(old)).toBe(DEFAULT_ONBOARDING_CONTENT);
  });

  it("falls back entirely when a screen this binary needs is missing", () => {
    const old = clone(DEFAULT_ONBOARDING_CONTENT);
    old.screens = old.screens.filter((s) => s.id !== "target");
    expect(usableContent(old)).toBe(DEFAULT_ONBOARDING_CONTENT);
  });

  it("falls back on anything that is not content at all", () => {
    for (const junk of [null, undefined, 7, "{}", {}, { version: 1 }, { version: "x", screens: [], summary: {} }]) {
      expect(usableContent(junk)).toBe(DEFAULT_ONBOARDING_CONTENT);
    }
  });

  it("fills a cosmetic block that predates this binary, block by block", () => {
    // An interstitial asks nothing, so a revision missing one cannot produce a flow that skips a
    // question — charging the admin every word they edited would be a penalty with no defect.
    const old = clone(DEFAULT_ONBOARDING_CONTENT);
    old.version = 12;
    old.screens.find((s) => s.id === "goal")!.asks.goal!.lines = ["Edited"];
    delete (old as Partial<OnboardingContent>).summary;
    const used = usableContent(old);
    expect(used.version).toBe(12);
    expect(used.screens.find((s) => s.id === "goal")!.asks.goal!.lines).toEqual(["Edited"]);
    expect(used.summary).toBe(DEFAULT_ONBOARDING_CONTENT.summary);
  });

  it("keeps content that covers every question, whatever else it carries", () => {
    const fine = clone(DEFAULT_ONBOARDING_CONTENT);
    fine.version = 12;
    expect(usableContent(fine).version).toBe(12);
  });
});

describe("the interstitials", () => {
  // None of these collects a profile field, so they stay out of ONBOARDING_SCREENS and
  // SCREEN_FIELDS — which is what keeps the three-layer boundary the same shape it was before they
  // existed. `why`, `struggles`, `moment` and `eatout` are questions to the USER; nothing they
  // collect reaches `explainTargets`.

  it("are not screens", () => {
    for (const id of ["welcome", "why", "struggles", "moment", "eatout", "building", "summary"]) {
      expect(ONBOARDING_SCREENS as readonly string[]).not.toContain(id);
    }
  });

  it("are places", () => {
    for (const place of ["welcome", "why", "struggles", "moment", "eatout", "building", "summary"] as const) {
      expect(ONBOARDING_PLACES).toContain(place);
    }
    for (const id of ONBOARDING_SCREENS) expect(ONBOARDING_PLACES).toContain(id);
  });

  it("are counted in the order a person meets them", () => {
    const at = (s: string) => (ONBOARDING_PLACES as readonly string[]).indexOf(s);
    expect(at("welcome")).toBe(0);
    expect(at("goal")).toBeLessThan(at("why"));
    expect(at("why")).toBeLessThan(at("about"));
    expect(at("target")).toBeLessThan(at("activity"));
    expect(at("struggles")).toBeLessThan(at("moment"));
    expect(at("restrictions")).toBeLessThan(at("building"));
    expect(at("building")).toBeLessThan(at("summary"));
  });
});

describe("the analytics vocabulary", () => {
  it("reports enumerated fields only", () => {
    // Never a weight, a height, a year of birth or free text: these are answers to a health
    // questionnaire about an identified person, and analytics rows outlive the account.
    for (const f of REPORTABLE_FIELDS) {
      expect(["goal", "sex", "activity", "pace", "country", "restrictions"]).toContain(f);
    }
    for (const f of ["weight_kg", "height_cm", "birth_year", "target_weight_kg"]) {
      expect(REPORTABLE_FIELDS as readonly string[]).not.toContain(f);
    }
  });

  it("has no room for a struggle, a moment or a reason", () => {
    // The strongest case in the whole list: "binge episodes" is a disclosure, not a preference.
    // These are not `OnboardingStep`s, so they cannot be on `REPORTABLE_FIELDS` by construction.
    for (const f of ["struggles", "moment", "eatout", "why"]) {
      expect(REPORTABLE_FIELDS as readonly string[]).not.toContain(f);
    }
  });
});

describe("the country the phone already knows", () => {
  it("maps a curated region onto its code", () => {
    expect(countryFromRegion("DE")).toBe("de");
    expect(countryFromRegion("gb")).toBe("gb");
  });

  it("answers 'other' for a region we have not tuned for, and for none at all", () => {
    expect(countryFromRegion("BR")).toBe("other");
    expect(countryFromRegion(null)).toBe("other");
    expect(countryFromRegion(undefined)).toBe("other");
    expect(countryFromRegion("")).toBe("other");
  });

  it("only ever answers with a code the profile accepts", () => {
    for (const r of ["DE", "gb", "us", "RU", "zz", "", null]) {
      expect(COUNTRY_CODES as readonly string[]).toContain(countryFromRegion(r));
    }
  });
});
