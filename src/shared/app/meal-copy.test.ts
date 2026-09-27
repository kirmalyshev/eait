// The meal surface's words (#93): the detail, the correct-as-chat sheet, the phone menu and
// keypad, the delete sheet, and the gone state — web boards `web/meal{,-edit,-edited,-delete}.html`
// and phone boards `phone/meal{,-edit,-edited,-keypad,-menu,-delete,-gone}.html` on ieat-app main.
// Completeness in all eight languages is `localizedGaps`' job in `copy.i18n.test.ts`; this file
// holds the table's own contract: the keys exist, the templates keep their placeholders, and the
// English is the boards' words verbatim.

import { describe, expect, it } from "bun:test";
import { LANGS, type Lang } from "../types.ts";
import { MEAL_COPY, mealCopyFor } from "./meal-copy.ts";

const KEYS = [
  "metaPhoto", "sheetWhen", "roughEstimate",
  "macroProtein", "macroCarbs", "macroFat",
  "coachLine", "correctOpener", "itemAmount", "composeHint",
  "deleteTitle", "deleteBody", "deleteCta", "cancelCta",
  "webCorrect", "webLoggedPhoto",
  "phoneCorrect", "phoneDone", "phoneEdit",
  "phoneMenuReread", "phoneMenuMoveYesterday",
  "phoneCorrectTitle", "phoneSheetMeal", "phoneWasAmount", "phoneThisMeal", "phoneSaveRecheck",
  "phoneKeypadBackspace",
  "phoneFixTitle", "phoneFixMeal", "phoneFixExample", "phoneUpdate",
  "phoneIngredientTitle", "phoneAmount", "phoneCalories", "phoneRemoveIngredient", "phoneNavBack",
  "phoneGoneTitle", "phoneGoneBody", "phoneGoneBack",
  "webGoneTitle", "webGoneBody", "webGoneBack", "itemAmount", "menuButton",
  "changeItem", "changeTotal", "changeWithItems",
  "changeStillHighOne", "changeStillHighTwo", "changeStillHighAll",
  "changeToPlan", "changeToHigh", "changeToVeryHigh", "changeAllOnPlan",
] as const;

describe("MEAL_COPY", () => {
  it("has every key in every language", () => {
    for (const lang of LANGS) {
      const copy = MEAL_COPY[lang];
      expect(copy, lang).toBeDefined();
      for (const key of KEYS) {
        expect(copy![key].length, `${lang}.${key}`).toBeGreaterThan(0);
      }
    }
  });

  it("keeps every placeholder in every language", () => {
    // A dropped `{coach}` prints the placeholder beside Gabie's avatar; a dropped `{items}` turns
    // the correct-sheet opener into a claim that nothing was read at all.
    const placeholders: Partial<Record<(typeof KEYS)[number], string[]>> = {
      metaPhoto: ["{day}", "{time}"],
      sheetWhen: ["{day}", "{time}"],
      coachLine: ["{coach}"],
      correctOpener: ["{items}"],
      itemAmount: ["{amount}", "{item}"],
      phoneSheetMeal: ["{meal}", "{time}"],
      phoneWasAmount: ["{amount}"],
      phoneFixMeal: ["{name}", "{kcal}", "{time}"],
      changeItem: ["{item}", "{before}", "{after}", "{unit}"],
      changeTotal: ["{kcalBefore}", "{kcalAfter}", "{kcal}"],
      changeWithItems: ["{items}", "{total}"],
      changeStillHighOne: ["{dim}"],
      changeToPlan: ["{dim}"],
      changeToHigh: ["{dim}"],
      changeToVeryHigh: ["{dim}"],
    };
    for (const lang of LANGS) {
      const copy = MEAL_COPY[lang]!;
      for (const [key, phs] of Object.entries(placeholders)) {
        for (const ph of phs) {
          expect(copy[key as keyof typeof copy], `${lang}.${key}`).toContain(ph);
        }
      }
    }
  });

  it("never names the coach literally — {coach} fills her name", () => {
    for (const lang of LANGS) {
      expect(MEAL_COPY[lang]!.coachLine, lang).not.toContain("Gabie");
    }
  });

  it("draws the boards' words in English", () => {
    const en = mealCopyFor("en" as Lang);
    expect(en.metaPhoto).toBe("{day} · {time} · from a photo");
    expect(en.webCorrect).toBe("Correct this meal");
    expect(en.phoneCorrect).toBe("Correct");
    expect(en.phoneDone).toBe("Done");
    expect(en.phoneMenuReread).toBe("Re-read the photo");
    expect(en.phoneMenuMoveYesterday).toBe("Move to yesterday");
    expect(en.correctOpener).toBe("I read {items}. Tell me what I got wrong.");
    expect(en.composeHint).toBe("Say what was wrong");
    expect(en.deleteTitle).toBe("Delete this meal?");
    expect(en.deleteBody).toBe("It comes off today’s diary. This can’t be undone.");
    expect(en.deleteCta).toBe("Delete this meal");
    expect(en.phoneGoneTitle).toBe("Not on today’s diary");
    expect(en.phoneGoneBack).toBe("Back to today");
    expect(en.changeItem).toBe("{item} {before} → {after} {unit}");
    expect(en.changeTotal).toBe("{kcalBefore} → {kcalAfter} {kcal}.");
    expect(en.changeWithItems).toBe("{items}: {total}");
    expect(en.changeStillHighOne).toBe("{dim} still high for one meal.");
    expect(en.changeStillHighTwo).toBe("Both still high for one meal.");
    expect(en.changeStillHighAll).toBe("All still high for one meal.");
    expect(en.changeToPlan).toBe("{dim} now on plan.");
    expect(en.changeToHigh).toBe("{dim} now high for one meal.");
    expect(en.changeToVeryHigh).toBe("{dim} now very high for one meal.");
    expect(en.changeAllOnPlan).toBe("All on plan now.");
  });
});
