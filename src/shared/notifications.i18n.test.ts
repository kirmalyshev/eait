import { describe, expect, it } from "bun:test";
import { LANGS } from "./types.ts";
import { LANG_LABEL } from "./lang.ts";
import { i18nFor } from "./i18n.ts";
import {
  DEFAULT_NOTIFICATION_COPY, NOTIFICATION_COPY, NOTIFICATION_IDS, eveningPrescription,
  fillNotification, notificationCopyFor, validateNotificationCopy,
} from "./notifications.ts";

// A notification is the one surface that arrives unasked, on a lock screen, with no way to ask for
// it again. So every language's copy goes through the validator the admin's own save goes through —
// the placeholder rules especially, because a dropped `{plan}` renders as a literal `{plan}` on a
// phone and nothing recovers it.

describe("every language's notification copy", () => {
  it("passes the validator the admin's own saves go through", () => {
    for (const lang of LANGS) {
      const result = validateNotificationCopy(notificationCopyFor(lang));
      if (!result.ok) throw new Error(`${lang} (${LANG_LABEL[lang]}):\n${result.errors.join("\n")}`);
      expect(result.ok).toBe(true);
    }
  });

  it("says all three messages, and no fourth", () => {
    for (const lang of LANGS) {
      expect(Object.keys(notificationCopyFor(lang)).sort(), lang).toEqual([...NOTIFICATION_IDS].sort());
    }
  });

  it("is English where nobody has written it, never undefined", () => {
    expect(notificationCopyFor("en")).toBe(DEFAULT_NOTIFICATION_COPY);
    expect(NOTIFICATION_COPY.en).toBe(DEFAULT_NOTIFICATION_COPY);
  });

  it("fills its placeholders in every language, leaving no braces on a lock screen", () => {
    for (const lang of LANGS) {
      const copy = notificationCopyFor(lang);
      const full = fillNotification(copy, "evening", { eaten: "1.100", plan: "1.900", tomorrow: "…" });
      const empty = fillNotification(copy, "evening", { plan: "1.900", tomorrow: "…" }, { empty: true });
      for (const [what, m] of [["body", full], ["emptyBody", empty]] as const) {
        // ANY BRACE, not `\{\w+\}`. A doubled `{{plan}}` passes the validator on its inner pair,
        // `fillNotification` replaces that pair, and the outer one reaches the lock screen around
        // a grouped figure — which `\w` cannot match, because it does not match the `.` in `1.900`.
        expect(m.body, `${lang}.${what}`).not.toMatch(/[{}]/);
        expect(m.title, `${lang}.${what}`).not.toMatch(/[{}]/);
        expect(m.body, `${lang}.${what}`).toContain("1.900");
      }
    }
  });
});

describe("the evening prescription", () => {
  const targets = { kcal: 2000, protein_g: 140, carbs_g: 200, fat_g: 60 };

  it("names one lever in every language, and never a brace", () => {
    const cases = [
      { totals: { kcal: 0, protein_g: 0 }, meals: 0, goal: "lose" as const },
      { totals: { kcal: 2600, protein_g: 140 }, meals: 3, goal: "lose" as const },
      { totals: { kcal: 1900, protein_g: 80 }, meals: 3, goal: "lose" as const },
      { totals: { kcal: 1400, protein_g: 140 }, meals: 2, goal: "lose" as const },
      { totals: { kcal: 1600, protein_g: 140 }, meals: 2, goal: "gain" as const },
      { totals: { kcal: 1990, protein_g: 140 }, meals: 3, goal: "maintain" as const },
    ];
    for (const lang of LANGS) {
      for (const [i, c] of cases.entries()) {
        const line = eveningPrescription({ targets, ...c }, lang);
        expect(line.length, `${lang}[${i}]`).toBeGreaterThan(0);
        expect(line, `${lang}[${i}]`).not.toMatch(/\{\w+\}/);
      }
    }
  });

  it("writes its figures in the reader's own grouping, not in en-US", () => {
    // 600 over a 2,000 plan. German groups thousands with a dot, so "2.000" and never "2,000".
    const over = { targets, totals: { kcal: 2600, protein_g: 140 }, meals: 3, goal: "lose" as const };
    expect(eveningPrescription(over, "en")).toContain("2,000");
    expect(eveningPrescription(over, "de")).toContain("2.000");
  });

  it("says something DIFFERENT in another language, which is what the language is for", () => {
    // This compared `eveningPrescription(on, "en")` with itself and could not fail for any
    // implementation, including one returning "". Its title referred to a default parameter that
    // no longer exists — the sweep in 6406de1 removed it — so it was testing nothing, twice.
    const on = { targets, totals: { kcal: 1990, protein_g: 140 }, meals: 3, goal: "maintain" as const };
    const en = eveningPrescription(on, "en");
    expect(en.length).toBeGreaterThan(0);
    for (const lang of LANGS.filter((l) => l !== "en")) {
      expect(eveningPrescription(on, lang), lang).not.toBe(en);
    }
  });
});

// ── Why this table does NOT move to a catalog ────────────────────────────────────────────────

describe("the admin-editable copy stays in a Localized table, and this is the reason", () => {
  // THE MIGRATION STOPS HERE, AT THE TWO ADMIN-EDITABLE TABLES — this one and
  // `onboarding-content.ts`. Everything else in the repo is code-owned copy and belongs in a `.po`
  // where a translator can reach it. These two do not, for two reasons that compound.
  //
  // FIRST: ICU OWNS THE BRACES. `{eaten}` is this product's placeholder syntax, filled by
  // `fillNotification`, and it is also ICU MessageFormat's argument syntax. Run an admin's
  // template through Lingui and the placeholders are consumed, not preserved — the test below is
  // that, executed rather than asserted in a comment.
  //
  // SECOND, AND WORSE: `fillNotification` must fill a STORED string identically to a compiled-in
  // one. An admin's text never passes through Lingui and never can, so a migration would put two
  // substitution engines behind one sentence — and the one that ships is whichever the admin last
  // saved. Two sources for one string, with no merge rule, where the wrong answer arrives unasked
  // on a lock screen with no review and no recall.
  //
  // If this ever does move, the placeholder syntax has to move with it, and `NOTIFICATION_PLACEHOLDERS`
  // and the admin editor move too. That is a product change, not a refactor.

  it("has placeholders ICU would eat", () => {
    const body = DEFAULT_NOTIFICATION_COPY.evening.body;
    expect(body).toContain("{eaten}");
    // Not in the catalog: `i18n._` compiles the fallback message at runtime, which is exactly what
    // a migrated string would do in a language nobody has translated yet.
    const throughIcu = i18nFor("en")._("notifications.collision.proof", undefined, { message: body });
    expect(throughIcu, "ICU left the placeholders alone — re-open the migration question")
      .not.toContain("{eaten}");
    expect(throughIcu).not.toContain("{plan}");
  });

  it("still fills them, in every language, through the one engine that also fills an admin's", () => {
    for (const lang of LANGS) {
      const out = fillNotification(notificationCopyFor(lang), "evening", {
        eaten: "1 100", plan: "1 900", tomorrow: "x",
      });
      expect(out.body, lang).toContain("1 100");
      expect(out.body, lang).not.toMatch(/\{\w+\}/);
    }
  });
});
