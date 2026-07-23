import { describe, expect, test } from "bun:test";
import { settingsInput, settingsRoot, settingsStep, type SettingsProfile } from "./settings.ts";
import { LANGS, translatorFor } from "./i18n/index.ts";
import { RESTRICTION_TAGS } from "./targets.ts";
import { COUNTRIES } from "./country.ts";

const t = translatorFor("en");

// The machine demands a RESOLVED profile (SettingsProfile) — the default "rich" here plays
// the instance default the bot resolves in before calling.
function profile(over: Partial<SettingsProfile> = {}): SettingsProfile {
  return { telegram_id: 1, lang: "en", goal: "lose", restrictions: [], reply_format: "rich", ...over };
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

  test("shows the current weight, target weight, and country (or 'not set')", () => {
    const set = settingsRoot(profile({ weight_kg: 92, target_weight_kg: 85, country: "de" }), t);
    expect(set.text).toContain(t("me.weightValue", { kg: 92 }));
    expect(set.text).toContain(t("me.weightValue", { kg: 85 }));
    expect(set.text).toContain(t("country.de"));
    const unset = settingsRoot(profile({ weight_kg: null, target_weight_kg: null, country: null }), t);
    expect(unset.text).toContain(t("me.noWeight"));
    expect(unset.text).toContain(t("me.noCountry"));
  });

  test("shows a raw 'other' country as itself", () => {
    const v = settingsRoot(profile({ country: "Portugal" }), t);
    expect(v.text).toContain("Portugal");
  });

  test("offers every section", () => {
    expect(data(settingsRoot(profile(), t))).toEqual(["st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"]);
  });

  test("shows the current reply format", () => {
    const v = settingsRoot(profile({ reply_format: "plain" }), t);
    expect(v.text).toContain(t("settings.format.plain"));
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
    expect(data(v)).toEqual(["st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"]);
    expect(v.text).toContain(t("me.goal.maintain")); // root reflects the new value immediately
  });

  test("an invalid goal is ignored rather than persisted", () => {
    const v = settingsStep(profile({ goal: "lose" }), "st:goal:teleport", t);
    expect(v.patch).toBeUndefined();
    expect(data(v)).toEqual(["st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"]);
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

describe("format", () => {
  test("st:format opens a picker with both formats and a way back", () => {
    const v = settingsStep(profile(), "st:format", t);
    expect(data(v)).toEqual(["st:format:rich", "st:format:plain", "st:root"]);
    expect(v.patch).toBeUndefined();
  });

  test("choosing a format patches it and returns to the root view", () => {
    const v = settingsStep(profile({ reply_format: "rich" }), "st:format:plain", t);
    expect(v.patch).toEqual({ reply_format: "plain" });
    expect(data(v)).toEqual(["st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"]);
    expect(v.text).toContain(t("settings.format.plain")); // root reflects the new value
  });

  test("an unknown format is ignored rather than persisted", () => {
    const v = settingsStep(profile(), "st:format:markdown", t);
    expect(v.patch).toBeUndefined();
    expect(data(v)).toEqual(["st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"]);
  });
});

describe("weight + target weight (text input)", () => {
  test("st:weight arms a text prompt, patches nothing yet", () => {
    const v = settingsStep(profile(), "st:weight", t);
    expect(v.awaitInput).toBe("weight");
    expect(v.patch).toBeUndefined();
    expect(data(v)).toEqual(["st:root"]); // only a way back while typing
  });

  test("st:targetw arms a target-weight prompt", () => {
    const v = settingsStep(profile(), "st:targetw", t);
    expect(v.awaitInput).toBe("target_weight");
    expect(v.patch).toBeUndefined();
  });

  test("a valid weight input patches it, returns to root, and clears the prompt", () => {
    const v = settingsInput("weight", "80,5", profile({ weight_kg: 92 }), t);
    expect(v.patch).toEqual({ weight_kg: 80.5 });
    expect(v.awaitInput).toBeUndefined();
    expect(data(v)).toEqual(["st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"]);
    expect(v.text).toContain(t("me.weightValue", { kg: 80.5 }));
  });

  test("an invalid weight re-prompts, keeps the prompt armed, patches nothing", () => {
    const v = settingsInput("weight", "banana", profile(), t);
    expect(v.patch).toBeUndefined();
    expect(v.awaitInput).toBe("weight");
  });

  test("a valid target-weight input patches target_weight_kg", () => {
    const v = settingsInput("target_weight", "85", profile(), t);
    expect(v.patch).toEqual({ target_weight_kg: 85 });
    expect(v.awaitInput).toBeUndefined();
  });

  test("an invalid target weight keeps the target prompt armed", () => {
    const v = settingsInput("target_weight", "soon", profile(), t);
    expect(v.patch).toBeUndefined();
    expect(v.awaitInput).toBe("target_weight");
  });
});

describe("country", () => {
  test("st:country opens a picker with every curated country, Other, and back", () => {
    const v = settingsStep(profile(), "st:country", t);
    const ds = data(v);
    for (const c of COUNTRIES) expect(ds).toContain(`st:country:${c}`);
    expect(ds).toContain("st:country:other");
    expect(ds).toContain("st:root");
    expect(v.patch).toBeUndefined();
    expect(v.awaitInput).toBeUndefined();
  });

  test("picking a country patches the code and returns to root", () => {
    const v = settingsStep(profile({ country: null }), "st:country:de", t);
    expect(v.patch).toEqual({ country: "de" });
    expect(v.text).toContain(t("country.de"));
    expect(data(v)).toEqual(["st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"]);
  });

  test("an unknown country code re-shows the picker, patches nothing", () => {
    const v = settingsStep(profile(), "st:country:zz", t);
    expect(v.patch).toBeUndefined();
    expect(data(v)).toContain("st:country:other"); // still the picker
  });

  test("st:country:other arms a free-text prompt", () => {
    const v = settingsStep(profile(), "st:country:other", t);
    expect(v.awaitInput).toBe("country");
    expect(v.patch).toBeUndefined();
  });

  test("a free-text country input is stored raw and returns to root", () => {
    const v = settingsInput("country", "  Portugal ", profile(), t);
    expect(v.patch).toEqual({ country: "Portugal" });
    expect(v.awaitInput).toBeUndefined();
    expect(v.text).toContain("Portugal");
  });

  test("an empty country input keeps the country prompt armed", () => {
    const v = settingsInput("country", "   ", profile(), t);
    expect(v.patch).toBeUndefined();
    expect(v.awaitInput).toBe("country");
  });
});

describe("robustness", () => {
  test("unknown callback data falls back to the root view without patching", () => {
    for (const junk of ["", "st:", "st:nope", "garbage", "st:goal:", "goal_lose"]) {
      const v = settingsStep(profile(), junk, t);
      expect(v.patch).toBeUndefined();
      expect(data(v)).toEqual(["st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"]);
    }
  });

  test("st:root returns the root view", () => {
    expect(data(settingsStep(profile(), "st:root", t))).toEqual(["st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"]);
  });
});

describe("localization", () => {
  const VIEWS = ["st:root", "st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"];
  const RAW_KEY = /\b(settings|me|onboarding|lang|country)\.[a-zA-Z.]+/;

  test.each(LANGS)("%s renders every view with no raw key", (lang) => {
    const tl = translatorFor(lang);
    for (const d of VIEWS) {
      const v = settingsStep(profile({ restrictions: ["kidneys"], weight_kg: 92, target_weight_kg: 85, country: "de" }), d, tl);
      expect(v.text.trim()).not.toBe("");
      expect(v.text).not.toMatch(RAW_KEY);
      for (const label of labels(v)) {
        expect(label.trim()).not.toBe("");
        expect(label).not.toMatch(RAW_KEY);
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
    for (const d of ["st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:lang", "st:format"]) {
      const v = settingsStep(profile(), d, t);
      const last = v.buttons[v.buttons.length - 1]!;
      expect(last).toHaveLength(1);
      expect(last[0]!.data).toBe("st:root");
    }
  });
});
