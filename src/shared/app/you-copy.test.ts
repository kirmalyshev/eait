// The You surface's words (#97): the profile screen both clients draw (web/you.html,
// phone/you.html), the web's today column beside it, and the phone's weight editor, profile
// editor, saved state, plan basis, subscription, account and delete sheet. Completeness in all
// eight languages is `localizedGaps`' job in `copy.i18n.test.ts` — this file holds the table's own
// contract: the keys exist, the placeholders survive translation, the claims sweep runs over it,
// and the English is the boards' words.

import { describe, expect, it } from "bun:test";
import { LANGS, type Lang } from "../types.ts";
import { lintCopy } from "../claims.ts";
import { YOU_COPY, youCopyFor, youFacts } from "./you-copy.ts";

function flatten(node: unknown, at = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof node === "string") { out[at] = node; return out; }
  // A plural table (`CountForms`) is ONE entry: its categories are the language's own, so English's
  // one/other and Russian's one/few/many/other are the same key. Its `other` stands for it.
  if (typeof node === "object" && node !== null && "other" in node) { out[at] = (node as { other: string }).other; return out; }
  if (typeof node === "object" && node !== null) {
    for (const [k, v] of Object.entries(node)) flatten(v, at === "" ? k : `${at}.${k}`, out);
  }
  return out;
}

const placeholders = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort();

describe("YOU_COPY", () => {
  it("says the same keys in every language", () => {
    const en = Object.keys(flatten(YOU_COPY.en)).sort();
    for (const lang of LANGS) {
      expect(Object.keys(flatten(YOU_COPY[lang])).sort(), lang).toEqual(en);
    }
  });

  it("has no empty string anywhere", () => {
    for (const lang of LANGS) {
      for (const [at, text] of Object.entries(flatten(YOU_COPY[lang]))) {
        expect(text.length, `${lang}.${at}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every placeholder in every language — a dropped one renders a hole", () => {
    const en = flatten(YOU_COPY.en);
    for (const lang of LANGS) {
      const copy = flatten(YOU_COPY[lang]);
      for (const [at, text] of Object.entries(en)) {
        expect(placeholders(copy[at] ?? ""), `${lang}.${at}`).toEqual(placeholders(text));
      }
    }
  });

  it("carries no claim the linter would refuse — every template, filled, every language", () => {
    // Placeholders stand for numbers and names; the sweep fills them with the boards' own
    // persona values so a pattern that could fire on the filled sentence is what fails.
    const FILL: Record<string, string> = {
      age: "32", height: "172cm", flags: "high cholesterol declared", condition: "high cholesterol",
      w: "73.4", prev: "74", source: "Apple Health", time: "18:30", kcal: "1,434", g: "109",
      noun: "Saturated fat",
      floor: "1,200", n: "5", total: "7", date: "Sat 26 Sep",
      from: "1,434", to: "1,429", url: "app.eait.fit/start",
    };
    const filled = (s: string) =>
      s.replace(/\{(\w+)\}/g, (_, k: string) => FILL[k] ?? "X");
    for (const lang of LANGS) {
      const fields: Record<string, string> = {};
      for (const [at, text] of Object.entries(flatten(YOU_COPY[lang]))) fields[at] = filled(text);
      const violations = lintCopy(fields).map((v) => `${v.field}: ${v.pattern} "${v.span}"`);
      expect(violations, lang).toEqual([]);
    }
  });

  it("draws the boards' words in English", () => {
    const en = youCopyFor("en" as Lang);
    // web/you.html + phone/you.html — the screen itself.
    expect(en.headerFacts).toBe("{age} · {height} · {flags}");
    expect(en.flagDeclared).toBe("{condition} declared");
    expect(en.weightLabel).toBe("Weight");
    expect(en.logWeight).toBe("Log weight");
    expect(en.planLabel).toBe("Your plan");
    expect(en.planEdit).toBe("edit");
    expect(en.kcalADay).toBe("{kcal}kcal a day");
    expect(en.perDay).toBe("a day");
    expect(en.grams).toBe("{g}g");
    expect(en.satFatGrams).toBe("{g}g {noun}");
    expect(en.floorMarker).toBe("never below {floor}");
    expect(en.appleHealth).toBe("Apple Health");
    expect(en.connected).toBe("connected");
    expect(en.subscription).toBe("Subscription");
    expect(en.freeTrialDay).toBe("free trial · day {n}");
    // The row's other states (#175): paid, lifetime, lapsed (dated and bare), and never bought.
    expect(en.subscriptionUntil).toBe("until {date}");
    expect(en.subscriptionLifetime).toBe("lifetime");
    expect(en.subscriptionEnded).toBe("ended {date}");
    expect(en.subscriptionEndedNoDate).toBe("ended");
    expect(en.subscriptionFree).toBe("free");
    expect(en.account).toBe("Account");
    // phone/you-weight.html
    expect(en.phone.weightTitle).toBe("Your weight");
    expect(en.phone.weightCheckKg).toBe("{source} says {w}kg. Is that right?");
    expect(en.phone.weightSourceKg).toBe("{prev}kg · {source}, today {time}");
    expect(en.phone.planRevised).toBe("{from} → {to}kcal a day");
    expect(en.phone.save).toBe("Save");
    // phone/you-profile.html
    expect(en.phone.profileTitle).toBe("Profile");
    expect(en.phone.goalLabel).toBe("Goal");
    expect(en.phone.weightFromKg).toBe("{w}kg · {source}");
    expect(en.phone.targetLabel).toBe("Target");
    expect(en.phone.weightKg).toBe("{w}kg");
    expect(en.phone.activitySection).toBe("Exercise frequency");
    expect(en.phone.activityOption).toBe("{n} workouts a week");
    expect(en.phone.countryRow).toBe("Country");
    expect(en.phone.judgedAgainst).toBe("Judged against");
    // phone/you-saved.html
    expect(en.phone.activityLabel).toBe("Exercise");
    expect(en.phone.savedNoteKg).toBe("{w}kg from {source}, saved");
    // phone/you-basis.html
    expect(en.phone.basisTitle).toBe("How we got there");
    expect(en.phone.atRest).toBe("At rest");
    expect(en.phone.yourDays).toBe("Your days");
    expect(en.phone.yourPace).toBe("Your pace");
    expect(en.phone.changeAnswer).toBe("Change an answer");
    // phone/you-subscription.html
    expect(en.phone.freeTrialTitle).toBe("Your free trial");
    expect(en.phone.dayOfTotal).toBe("Day {n} of {total}");
    expect(en.phone.untilDate).toBe("until {date}");
    expect(en.phone.beforeEnds).toBe("Before it ends");
    expect(en.phone.weRemind).toBe("We remind you");
    expect(en.phone.thenLabel).toBe("Then");
    expect(en.phone.manageStore).toBe("Manage in the App Store");
    expect(en.phone.restore).toBe("Restore");
    expect(en.phone.termsLink).toBe("Terms");
    expect(en.phone.privacyLink).toBe("Privacy");
    // phone/you-account.html + you-delete.html
    expect(en.phone.signedInWith).toBe("Signed in with");
    expect(en.phone.signOutThis).toBe("Sign out of this account");
    expect(en.phone.signOutEverywhere).toBe("Sign out everywhere");
    expect(en.phone.pairingTitle).toBe("Use eait in a browser");
    expect(en.phone.pairingHint).toBe("{url} · expires at {time}");
    expect(en.phone.newPairingCode).toBe("New pairing code");
    expect(en.phone.deleteEverything).toBe("Delete everything");
    expect(en.phone.deleteTitle).toBe("Delete your account?");
    expect(en.phone.deleteBody).toBe(
      "Every meal, your profile, your health information and your conversation are erased. " +
      "This cannot be undone.",
    );
    expect(en.phone.keepIt).toBe("Keep it");
    expect(en.phone.deleteConfirm).toBe("Delete");
  });
});

describe("youFacts", () => {
  const medical = {
    ldl: { label: "High cholesterol" },
    kidneys: { label: "Kidney disease" },
    none: { label: "None" },
  };
  const base = { restrictions: ["ldl"], medicalOptions: medical, units: "metric" as const };

  it("composes the board's line out of templates — no fragment joins", () => {
    expect(youFacts("en", { age: 32, heightCm: 172, ...base })).toBe(
      "32 · 172cm · high cholesterol declared",
    );
    expect(youFacts("en", { age: 32, heightCm: 172, ...base, restrictions: [] })).toBe(
      "32 · 172cm",
    );
    expect(youFacts("de", { age: 32, heightCm: 172, ...base })).toBe(
      "32 · 172cm · von dir angegeben: High cholesterol",
    );
    expect(youFacts("ru", { age: 32, heightCm: 172, ...base })).toBe(
      "32 · 172см · указано: High cholesterol",
    );
  });

  it("lists two declared conditions the language's own way inside ONE flag", () => {
    expect(youFacts("en", { age: 32, heightCm: 172, ...base, restrictions: ["ldl", "kidneys"] })).toBe(
      "32 · 172cm · high cholesterol and kidney disease declared",
    );
  });

  it("drops a missing fact by template, and prints nothing for a null age", () => {
    expect(youFacts("en", { age: null, heightCm: 172, ...base })).toBe(
      "172cm · high cholesterol declared",
    );
    expect(youFacts("en", { age: null, heightCm: null, ...base })).toBe("high cholesterol declared");
    expect(youFacts("en", { age: 32, heightCm: null, ...base })).toBe("32 · high cholesterol declared");
    expect(youFacts("en", { age: null, heightCm: null, ...base, restrictions: [] })).toBe("");
    expect(youFacts("en", { age: 32, heightCm: null, ...base, restrictions: [] })).toBe("32");
  });

  it("follows the account's units for the height", () => {
    expect(youFacts("en", { age: 32, heightCm: 172, ...base, units: "imperial" })).toContain("5′8″");
  });

  it("reads an unknown or 'none' restriction as undeclared", () => {
    expect(youFacts("en", { age: 32, heightCm: 172, ...base, restrictions: ["none"] })).toBe("32 · 172cm");
    expect(youFacts("en", { age: 32, heightCm: 172, ...base, restrictions: ["keto"] })).toBe("32 · 172cm");
  });
});
