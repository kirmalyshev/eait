import { describe, expect, test } from "bun:test";
import { settingsRoot, settingsStep } from "./settings.ts";
import { LANGS, translatorFor } from "./i18n/index.ts";
import { RESTRICTION_TAGS } from "./targets.ts";
import type { Profile } from "./types.ts";

const t = translatorFor("en");

function profile(over: Partial<Profile> = {}): Profile {
  return { telegram_id: 1, lang: "en", goal: "lose", restrictions: [], ...over };
}

const data = (v: { buttons: { text: string; data: string }[][] }) =>
  v.buttons.flat().map((b) => b.data);
const labels = (v: { buttons: { text: string; data: string }[][] }) =>
  v.buttons.flat().map((b) => b.text);

describe("root view", () => {
  test("shows the current goal, restrictions, and language", () => {
    const v = settingsRoot(profile({ goal: "gain", restrictions: ["kidneys"], lang: "de" }), t);
    expect(v.text).toContain(t("me.goal.gain"));
    expect(v.text).toContain(t("me.restriction.kidneys"));
    expect(v.text).toContain("Deutsch"); // nativeName, not the code
    expect(v.patch).toBeUndefined();
  });

  test("says so when there are no restrictions", () => {
    const v = settingsRoot(profile({ restrictions: [] }), t);
    expect(v.text).toContain(t("me.noRestrictions"));
  });

  test("offers exactly the three sections", () => {
    expect(data(settingsRoot(profile(), t))).toEqual(["st:goal", "st:restr", "st:lang"]);
  });
});

describe("goal", () => {
  test("st:goal opens a picker with all three goals and a way back", () => {
    const v = settingsStep(profile(), "st:goal", t);
    expect(data(v)).toEqual(["st:goal:lose", "st:goal:maintain", "st:goal:gain", "st:root"]);
    expect(v.patch).toBeUndefined(); // opening a picker changes nothing
  });

  test("choosing a goal patches it and returns to the root view", () => {
    const v = settingsStep(profile({ goal: "lose" }), "st:goal:maintain", t);
    expect(v.patch).toEqual({ goal: "maintain" });
    expect(data(v)).toEqual(["st:goal", "st:restr", "st:lang"]);
    expect(v.text).toContain(t("me.goal.maintain")); // root reflects the new value immediately
  });

  test("an invalid goal is ignored rather than persisted", () => {
    const v = settingsStep(profile({ goal: "lose" }), "st:goal:teleport", t);
    expect(v.patch).toBeUndefined();
    expect(data(v)).toEqual(["st:goal", "st:restr", "st:lang"]);
  });
});

describe("restrictions", () => {
  test("st:restr lists every tag with an on/off marker plus back", () => {
    const v = settingsStep(profile({ restrictions: ["kidneys"] }), "st:restr", t);
    expect(data(v)).toEqual([...RESTRICTION_TAGS.map((x) => `st:restr:${x}`), "st:root"]);
    expect(v.patch).toBeUndefined();
    const kidneys = labels(v).find((l) => l.includes(t("me.restriction.kidneys")))!;
    const vegan = labels(v).find((l) => l.includes(t("me.restriction.vegan")))!;
    expect(kidneys).toContain("✅");
    expect(vegan).toContain("⬜");
  });

  test("tapping an unset tag adds it and stays on the toggle view", () => {
    const v = settingsStep(profile({ restrictions: [] }), "st:restr:kidneys", t);
    expect(v.patch).toEqual({ restrictions: ["kidneys"] });
    expect(data(v)).toContain("st:restr:kidneys"); // still the toggle view
  });

  test("tapping a set tag removes it", () => {
    const v = settingsStep(profile({ restrictions: ["kidneys", "ldl"] }), "st:restr:kidneys", t);
    expect(v.patch).toEqual({ restrictions: ["ldl"] });
  });

  test("toggling twice returns to the original set", () => {
    const once = settingsStep(profile({ restrictions: [] }), "st:restr:ldl", t);
    const twice = settingsStep(
      profile({ restrictions: once.patch!.restrictions }),
      "st:restr:ldl",
      t,
    );
    expect(twice.patch).toEqual({ restrictions: [] });
  });

  test("tag order is stable regardless of the order they were toggled in", () => {
    const v = settingsStep(profile({ restrictions: ["lowsugar", "kidneys"] }), "st:restr:ldl", t);
    // must follow RESTRICTION_TAGS order, not insertion order
    expect(v.patch!.restrictions).toEqual(
      RESTRICTION_TAGS.filter((x) => ["kidneys", "ldl", "lowsugar"].includes(x)),
    );
  });

  test("an unknown tag is ignored rather than stored", () => {
    const v = settingsStep(profile({ restrictions: [] }), "st:restr:gluten", t);
    expect(v.patch).toBeUndefined();
  });
});

describe("language", () => {
  test("st:lang lists every registered locale by native name", () => {
    const v = settingsStep(profile(), "st:lang", t);
    expect(data(v)).toEqual([...LANGS.map((l) => `st:lang:${l}`), "st:root"]);
  });

  test("choosing a locale patches it and renders the root in the NEW language", () => {
    const v = settingsStep(profile({ lang: "en" }), "st:lang:de", t);
    expect(v.patch).toEqual({ lang: "de" });
    const tde = translatorFor("de");
    expect(v.text).toContain(tde("settings.title"));
  });

  test("an unregistered locale is ignored", () => {
    const v = settingsStep(profile(), "st:lang:klingon", t);
    expect(v.patch).toBeUndefined();
  });
});

describe("robustness", () => {
  test("unknown callback data falls back to the root view without patching", () => {
    for (const junk of ["", "st:", "st:nope", "garbage", "st:goal:", "goal_lose"]) {
      const v = settingsStep(profile(), junk, t);
      expect(v.patch).toBeUndefined();
      expect(data(v)).toEqual(["st:goal", "st:restr", "st:lang"]);
    }
  });

  test("st:root returns the root view", () => {
    expect(data(settingsStep(profile(), "st:root", t))).toEqual(["st:goal", "st:restr", "st:lang"]);
  });
});

describe("localization", () => {
  const VIEWS = ["st:root", "st:goal", "st:restr", "st:lang"];

  test.each(LANGS)("%s renders every view with no raw key", (lang) => {
    const tl = translatorFor(lang);
    for (const d of VIEWS) {
      const v = settingsStep(profile({ restrictions: ["kidneys"] }), d, tl);
      expect(v.text.trim()).not.toBe("");
      expect(v.text).not.toMatch(/\b(settings|me|onboarding|lang)\.[a-zA-Z.]+/);
      for (const label of labels(v)) {
        expect(label.trim()).not.toBe("");
        expect(label).not.toMatch(/\b(settings|me|onboarding|lang)\.[a-zA-Z.]+/);
      }
    }
  });
});

describe("keyboard layout", () => {
  // Telegram shrinks buttons to fit a row. Four "✅ Cholesterin"-length labels side by side are
  // unreadable on a phone, so wide sets wrap.
  test("no row holds more than two restriction toggles", () => {
    const v = settingsStep(profile(), "st:restr", t);
    for (const row of v.buttons) expect(row.length).toBeLessThanOrEqual(2);
  });

  test("the back button is on its own final row in every sub-view", () => {
    for (const d of ["st:goal", "st:restr", "st:lang"]) {
      const v = settingsStep(profile(), d, t);
      const last = v.buttons[v.buttons.length - 1]!;
      expect(last).toHaveLength(1);
      expect(last[0]!.data).toBe("st:root");
    }
  });
});
