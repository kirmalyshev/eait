import { describe, expect, test } from "bun:test";
import { settingsInput, settingsRoot, settingsStep, type SettingsProfile } from "./settings.ts";
import { LANGS, translatorFor } from "./i18n/index.ts";
import { RESTRICTION_TAGS } from "./targets.ts";
import { COUNTRIES } from "./country.ts";

const t = translatorFor("en");

// The machine demands a RESOLVED profile (SettingsProfile) — the default "rich" here plays
// the instance default the bot resolves in before calling.
function profile(over: Partial<SettingsProfile> = {}): SettingsProfile {
  return {
    telegram_id: 1, lang: "en", goal: "lose", restrictions: [],
    medical_limitations: null, food_allergies: null, product_limitations: null,
    reply_format: "rich", ...over,
  };
}

const data = (v: { buttons: { text: string; data: string }[][] }) =>
  v.buttons.flat().map((b) => b.data);
const labels = (v: { buttons: { text: string; data: string }[][] }) =>
  v.buttons.flat().map((b) => b.text);

const ROOT_GROUPS = ["st:g:goal", "st:country", "st:g:food", "st:g:prefs"];
const GOAL_GROUP = ["st:goal", "st:weight", "st:targetw", "st:root"];
const FOOD_GROUP = ["st:restr", "st:medical", "st:allergies", "st:products", "st:root"];
const PREFS_GROUP = ["st:lang", "st:format", "st:root"];

// The three food-specifics free-text fields, parametrized [callback key, profile column] — they
// share every mechanic. Tuple form so bun's test.each spreads them into typed args.
const FIELDS = [
  ["medical", "medical_limitations"],
  ["allergies", "food_allergies"],
  ["products", "product_limitations"],
] as const;

describe("root view", () => {
  test("shows the full summary — goal, weights, country, restrictions, food fields, prefs", () => {
    const v = settingsRoot(
      profile({ goal: "gain", weight_kg: 92, target_weight_kg: 85, country: "de", restrictions: ["kidneys"], lang: "de", medical_limitations: "CKD" }),
      t,
    );
    expect(v.text).toContain(t("me.goal.gain"));
    expect(v.text).toContain(t("me.weightValue", { kg: 92 }));
    expect(v.text).toContain(t("me.weightValue", { kg: 85 }));
    expect(v.text).toContain(t("country.de"));
    expect(v.text).toContain(t("me.restriction.kidneys"));
    expect(v.text).toContain("CKD"); // a food field's value
    expect(v.text).toContain("Deutsch"); // lang nativeName
    expect(v.patch).toBeUndefined();
  });

  test("offers exactly the four groups", () => {
    expect(data(settingsRoot(profile(), t))).toEqual(ROOT_GROUPS);
  });

  test("says 'not set'/'none' for unset fields", () => {
    const v = settingsRoot(profile({ weight_kg: null, country: null }), t);
    expect(v.text).toContain(t("me.noWeight"));
    expect(v.text).toContain(t("me.noCountry"));
    expect(v.text).toContain(t("me.noRestrictions"));
    expect(v.text).toContain(t("me.noMedical"));
  });
});

describe("group menus", () => {
  test("st:g:goal opens goal + weights + Back-to-root", () => {
    const v = settingsStep(profile(), "st:g:goal", t);
    expect(data(v)).toEqual(GOAL_GROUP);
    expect(v.patch).toBeUndefined();
  });
  test("st:g:food opens restrictions + the three fields + Back-to-root", () => {
    expect(data(settingsStep(profile(), "st:g:food", t))).toEqual(FOOD_GROUP);
  });
  test("st:g:prefs opens language + style + Back-to-root", () => {
    expect(data(settingsStep(profile(), "st:g:prefs", t))).toEqual(PREFS_GROUP);
  });
});

describe("goal", () => {
  test("st:goal opens a picker whose Back returns to the goal GROUP", () => {
    const v = settingsStep(profile(), "st:goal", t);
    expect(data(v)).toEqual(["st:goal:lose", "st:goal:maintain", "st:goal:gain", "st:g:goal"]);
    expect(v.patch).toBeUndefined();
  });

  test("choosing a goal patches it and returns to the goal GROUP", () => {
    const v = settingsStep(profile({ goal: "lose" }), "st:goal:maintain", t);
    expect(v.patch).toEqual({ goal: "maintain" });
    expect(data(v)).toEqual(GOAL_GROUP);
    expect(v.text).toContain(t("me.goal.maintain"));
  });

  test("an invalid goal is ignored, returns to the group", () => {
    const v = settingsStep(profile({ goal: "lose" }), "st:goal:teleport", t);
    expect(v.patch).toBeUndefined();
    expect(data(v)).toEqual(GOAL_GROUP);
  });
});

describe("weight + target weight (text input)", () => {
  test("st:weight arms a prompt whose Back returns to the goal group", () => {
    const v = settingsStep(profile(), "st:weight", t);
    expect(v.awaitInput).toBe("weight");
    expect(v.patch).toBeUndefined();
    expect(data(v)).toEqual(["st:g:goal"]);
  });

  test("a valid weight input patches it and returns to the goal group", () => {
    const v = settingsInput("weight", "80,5", profile({ weight_kg: 92 }), t);
    expect(v.patch).toEqual({ weight_kg: 80.5 });
    expect(v.awaitInput).toBeUndefined();
    expect(data(v)).toEqual(GOAL_GROUP);
    expect(v.text).toContain(t("me.weightValue", { kg: 80.5 }));
  });

  test("an invalid weight re-prompts, prompt still armed", () => {
    const v = settingsInput("weight", "banana", profile(), t);
    expect(v.patch).toBeUndefined();
    expect(v.awaitInput).toBe("weight");
  });

  test("a valid target-weight input patches and returns to the goal group", () => {
    const v = settingsInput("target_weight", "85", profile(), t);
    expect(v.patch).toEqual({ target_weight_kg: 85 });
    expect(data(v)).toEqual(GOAL_GROUP);
  });
});

describe("restrictions (tags)", () => {
  test("st:restr lists every tag + Back to the food group", () => {
    const v = settingsStep(profile({ restrictions: ["kidneys"] }), "st:restr", t);
    expect(data(v)).toEqual([...RESTRICTION_TAGS.map((x) => `st:restr:${x}`), "st:g:food"]);
    const kidneys = labels(v).find((l) => l.includes(t("me.restriction.kidneys")))!;
    expect(kidneys).toContain("✅");
  });

  test("tapping a tag toggles it and stays on the toggle view", () => {
    const on = settingsStep(profile({ restrictions: [] }), "st:restr:kidneys", t);
    expect(on.patch).toEqual({ restrictions: ["kidneys"] });
    expect(data(on)).toContain("st:restr:kidneys");
    const off = settingsStep(profile({ restrictions: ["kidneys", "ldl"] }), "st:restr:kidneys", t);
    expect(off.patch).toEqual({ restrictions: ["ldl"] });
  });

  test("tag order follows RESTRICTION_TAGS, not tap order", () => {
    const v = settingsStep(profile({ restrictions: ["lowsugar", "kidneys"] }), "st:restr:ldl", t);
    expect(v.patch!.restrictions).toEqual(RESTRICTION_TAGS.filter((x) => ["kidneys", "ldl", "lowsugar"].includes(x)));
  });

  test("an unknown tag is ignored", () => {
    expect(settingsStep(profile({ restrictions: [] }), "st:restr:gluten", t).patch).toBeUndefined();
  });
});

describe("food specifics — three free-text fields", () => {
  test("each field's summary line shows its value or 'not set'", () => {
    const group = settingsStep(profile({ food_allergies: "peanuts" }), "st:g:food", t);
    expect(group.text).toContain("peanuts");
    expect(group.text).toContain(t("me.noMedical"));
    expect(group.text).toContain(t("me.noProducts"));
  });

  test.each(FIELDS)("st:%s arms a prompt whose Back returns to the food group", (key) => {
    const v = settingsStep(profile(), `st:${key}`, t);
    expect(v.awaitInput).toBe(key);
    expect(v.patch).toBeUndefined();
    expect(data(v)).toEqual(["st:g:food"]); // only Back — no dead Clear over an empty field
  });

  test.each(FIELDS)("%s: with a value set, the prompt echoes it and offers Clear", (key, col) => {
    const v = settingsStep(profile({ [col]: "no buckwheat" }), `st:${key}`, t);
    expect(data(v)).toEqual([`st:${key}:clear`, "st:g:food"]);
    expect(v.text).toContain("no buckwheat");
  });

  test.each(FIELDS)("%s: typed input is normalized, patched, and returns to the food group", (key, col) => {
    const v = settingsInput(key, '  no  "junk"\nno peanuts  ', profile(), t);
    expect(v.patch).toEqual({ [col]: "no junk no peanuts" });
    expect(v.awaitInput).toBeUndefined();
    expect(data(v)).toEqual(FOOD_GROUP);
    expect(v.text).toContain("no junk no peanuts");
  });

  test.each(FIELDS)("%s: st:*:clear patches '' and returns to the food group", (key, col) => {
    const v = settingsStep(profile({ [col]: "x" }), `st:${key}:clear`, t);
    expect(v.patch).toEqual({ [col]: "" });
    expect(v.awaitInput).toBeUndefined();
    expect(data(v)).toEqual(FOOD_GROUP);
  });

  test.each(FIELDS)("%s: input normalizing to nothing re-prompts with a distinct notice, still armed", (key, col) => {
    const v = settingsInput(key, "   \n ", profile({ [col]: "keep me" }), t);
    expect(v.patch).toBeUndefined();
    expect(v.awaitInput).toBe(key);
    expect(v.text).toContain("keep me"); // the existing value is still echoed alongside Clear
  });

  test.each(FIELDS)("%s: over-length input truncates to 300 AND shows the notice", (key) => {
    const v = settingsInput(key, "a".repeat(500), profile(), t);
    const stored = Object.values(v.patch ?? {})[0] as string;
    expect(stored).toHaveLength(300);
    expect(v.text).toContain(t("settings.limitationsTruncated", { max: 300 }));
  });

  // The three fields are independent of each other and of the tags (design invariant).
  test("editing one field leaves the other two and the tags untouched", () => {
    const v = settingsInput("allergies", "peanuts", profile({ restrictions: ["kidneys"], medical_limitations: "CKD" }), t);
    expect(v.patch).toEqual({ food_allergies: "peanuts" }); // ONLY food_allergies in the patch
    expect(v.text).toContain("CKD"); // medical still shown
    expect(v.text).toContain(t("me.restriction.kidneys")); // tag still shown
  });

  test("clearing a field does not drop a tag", () => {
    const v = settingsStep(profile({ restrictions: ["kidneys"], product_limitations: "x" }), "st:products:clear", t);
    expect(v.patch).toEqual({ product_limitations: "" });
    expect(v.text).toContain(t("me.restriction.kidneys"));
  });
});

describe("language + format", () => {
  test("st:lang picker Back returns to prefs; choosing renders the group in the new language", () => {
    const open = settingsStep(profile(), "st:lang", t);
    expect(data(open)).toEqual([...LANGS.map((l) => `st:lang:${l}`), "st:g:prefs"]);
    const v = settingsStep(profile({ lang: "en" }), "st:lang:de", t);
    expect(v.patch).toEqual({ lang: "de" });
    expect(data(v)).toEqual(PREFS_GROUP);
    expect(v.text).toContain(translatorFor("de")("settings.groupTitle.prefs"));
  });

  test("st:format picker Back returns to prefs; choosing returns to the prefs group", () => {
    const open = settingsStep(profile(), "st:format", t);
    expect(data(open)).toEqual(["st:format:rich", "st:format:plain", "st:g:prefs"]);
    const v = settingsStep(profile({ reply_format: "rich" }), "st:format:plain", t);
    expect(v.patch).toEqual({ reply_format: "plain" });
    expect(data(v)).toEqual(PREFS_GROUP);
  });

  test("unregistered locale / unknown format are ignored, returning to the group", () => {
    expect(settingsStep(profile(), "st:lang:klingon", t).patch).toBeUndefined();
    expect(data(settingsStep(profile(), "st:format:markdown", t))).toEqual(PREFS_GROUP);
  });
});

describe("country (top-level)", () => {
  test("st:country opens the picker with Back to root", () => {
    const v = settingsStep(profile(), "st:country", t);
    const ds = data(v);
    for (const c of COUNTRIES) expect(ds).toContain(`st:country:${c}`);
    expect(ds).toContain("st:country:other");
    expect(ds).toContain("st:root"); // country is top-level → Back to root
  });

  test("picking a country patches and returns to root", () => {
    const v = settingsStep(profile({ country: null }), "st:country:de", t);
    expect(v.patch).toEqual({ country: "de" });
    expect(data(v)).toEqual(ROOT_GROUPS);
  });

  test("st:country:other arms a free-text prompt; a free-text country returns to root", () => {
    expect(settingsStep(profile(), "st:country:other", t).awaitInput).toBe("country");
    const v = settingsInput("country", "  Portugal ", profile(), t);
    expect(v.patch).toEqual({ country: "Portugal" });
    expect(data(v)).toEqual(ROOT_GROUPS);
  });
});

describe("robustness", () => {
  test("unknown callback data falls back to root without patching", () => {
    // (`st:goal:` is NOT here — an empty goal suffix legitimately returns to the goal group, not root.)
    for (const junk of ["", "st:", "st:nope", "garbage", "goal_lose", "st:g:nope"]) {
      const v = settingsStep(profile(), junk, t);
      expect(v.patch).toBeUndefined();
      expect(data(v)).toEqual(ROOT_GROUPS);
    }
  });

  test("st:root returns the root", () => {
    expect(data(settingsStep(profile(), "st:root", t))).toEqual(ROOT_GROUPS);
  });
});

describe("localization", () => {
  const VIEWS = [
    "st:root", "st:g:goal", "st:g:food", "st:g:prefs",
    "st:goal", "st:weight", "st:targetw", "st:country", "st:restr",
    "st:medical", "st:allergies", "st:products", "st:lang", "st:format",
  ];
  const RAW_KEY = /\b(settings|me|onboarding|lang|country)\.[a-zA-Z.]+/;

  // The three food buttons are the natural translation of one word in ru/de ("Ограничения"/
  // "Einschränkungen"); they must be distinct from each other AND from the restrictions label,
  // or the food group shows repeated buttons (the collision the single-field version hit once).
  test.each(LANGS)("%s: food-field labels are all distinct from each other and from restrictions", (lang) => {
    const tl = translatorFor(lang);
    const ls = [
      tl("settings.button.restrictions"),
      tl("settings.button.medical"),
      tl("settings.button.allergies"),
      tl("settings.button.products"),
    ];
    expect(new Set(ls).size).toBe(ls.length);
    const root = settingsRoot(profile({ medical_limitations: "a", food_allergies: "b", product_limitations: "c" }), tl);
    const rows = root.text.split("\n");
    expect(new Set(rows).size).toBe(rows.length); // no two identical summary lines
  });

  test.each(LANGS)("%s renders every view with no raw key", (lang) => {
    const tl = translatorFor(lang);
    for (const d of VIEWS) {
      // Every food field set, so each prompt's "Current:" line + Clear button render too.
      const p = profile({
        restrictions: ["kidneys"], weight_kg: 92, target_weight_kg: 85, country: "de",
        medical_limitations: "a", food_allergies: "b", product_limitations: "c",
      });
      const v = settingsStep(p, d, tl);
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
  test("no row holds more than two restriction toggles", () => {
    const v = settingsStep(profile(), "st:restr", t);
    for (const row of v.buttons) expect(row.length).toBeLessThanOrEqual(2);
  });

  test("the last row is a single Back in every sub-view, both food-field branches", () => {
    const SUBVIEWS = ["st:g:goal", "st:g:food", "st:g:prefs", "st:goal", "st:weight", "st:targetw", "st:country", "st:restr", "st:medical", "st:allergies", "st:products", "st:lang", "st:format"];
    for (const p of [profile(), profile({ medical_limitations: "x", food_allergies: "y", product_limitations: "z" })]) {
      for (const d of SUBVIEWS) {
        const v = settingsStep(p, d, t);
        const last = v.buttons[v.buttons.length - 1]!;
        expect(last).toHaveLength(1);
        expect(last[0]!.data).toMatch(/^st:(root|g:goal|g:food|g:prefs)$/);
      }
    }
  });
});
