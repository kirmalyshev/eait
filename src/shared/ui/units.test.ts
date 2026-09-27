// The unit helpers, against the persona every Register P board is drawn with: 172 cm is 5 ft 8 in,
// 74 kg is 163 lb, and the US stays imperial while everywhere the eight languages are spoken stays
// metric.
//
// Stored values never leave metric — `Profile.height_cm` and `weight_kg` are what the server keeps;
// everything here is for the ruler under the user's thumb and the number beside it.

import { describe, expect, test } from "bun:test";
import { spellUnit } from "../lang.ts";
import {
  cmToFtIn, defaultUnits, ftInToCm, heightDisplayValue, heightText, heightToCm, kgToLb, lbToKg,
  rulerLabels, RULER_TICKS, weightDisplayValue, weightToKg,
} from "./units.ts";

describe("cm ↔ ft/in", () => {
  test("172 cm is the persona's 5 ft 8 in", () => {
    expect(cmToFtIn(172)).toEqual({ ft: 5, in: 8 });
  });

  test("the inch rounds first, and a rounded 12 carries into the foot", () => {
    expect(cmToFtIn(182)).toEqual({ ft: 6, in: 0 }); // 71.65″, not 5 ft 12
    expect(cmToFtIn(152)).toEqual({ ft: 5, in: 0 }); // the ruler's low end
    expect(cmToFtIn(193)).toEqual({ ft: 6, in: 4 }); // the ruler's high end
  });

  test("ft/in back to cm, for the toggle", () => {
    expect(ftInToCm(5, 8)).toBe(173);
    expect(ftInToCm(6, 4)).toBe(193);
  });

  test("the round trips drift — which is why the toggle relabels and never writes", () => {
    // 172 cm displays as 5′8″, and 5′8″ converts back to 173. If flipping the unit wrote back the
    // converted value, the stored profile would move on its own; it must not.
    const { ft, in: inch } = cmToFtIn(172);
    expect(ftInToCm(ft, inch)).toBe(173);
  });
});

describe("kg ↔ lb", () => {
  test("74 kg is the persona's 163 lb", () => {
    expect(kgToLb(74)).toBe(163);
  });

  test("lb back to kg keeps a tenth, like every stored weight", () => {
    expect(lbToKg(163)).toBe(73.9);
  });

  test("74 kg → 163 lb → 73.9 kg: the display drift, pinned", () => {
    expect(lbToKg(kgToLb(74))).toBe(73.9);
  });
});

describe("defaultUnits", () => {
  test("imperial only in the countries that use it", () => {
    for (const region of ["US", "LR", "MM"]) expect(defaultUnits(region)).toBe("imperial");
  });

  test("metric everywhere else, and when the region is not a code", () => {
    for (const region of ["DE", "FR", "GB", "BR", "VN", "ID", "RU", ""]) {
      expect(defaultUnits(region)).toBe("metric");
    }
  });

  test("the code is read case-insensitively", () => {
    expect(defaultUnits("us")).toBe("imperial");
  });
});

describe("the ruler tick sets", () => {
  test("the height ruler stands up in cm: the board's window is 15 wide, a label every 5", () => {
    const t = RULER_TICKS.height.metric;
    expect(t.span).toBe(15); // the board's window is 165–180 — a window, not a bound
    expect(t.pxPerUnit).toBe(9.5);
    expect(t.majorEvery).toBe(5);
    expect(t.labelEvery).toBe(5);
    expect(rulerLabels(t, 165, 180)).toEqual([165, 170, 175, 180]);
  });

  test("the imperial height ruler: a 16-inch window, a label every four inches", () => {
    const t = RULER_TICKS.height.imperial;
    expect(t.span).toBe(16); // 5′0″–6′4″ on the board
    expect(t.pxPerUnit).toBe(9.5);
    expect(t.majorEvery).toBe(4);
    expect(t.labelEvery).toBe(4);
    expect(rulerLabels(t, 60, 76)).toEqual([60, 64, 68, 72, 76]);
    expect(t.format(76)).toBe("6′4″");
    expect(t.format(68)).toBe("5′8″");
  });

  test("the weight ruler: a kilo or a pound per tick, a long tick every five, a label every ten", () => {
    expect(RULER_TICKS.weight.metric.pxPerUnit).toBe(9);
    expect(RULER_TICKS.weight.imperial.pxPerUnit).toBe(9);
    expect(RULER_TICKS.weight.metric.majorEvery).toBe(5);
    expect(RULER_TICKS.weight.imperial.majorEvery).toBe(5);
    expect(RULER_TICKS.weight.metric.labelEvery).toBe(10);
    expect(RULER_TICKS.weight.imperial.labelEvery).toBe(10);
  });

  test("the weight labels around the persona read like the boards", () => {
    // 07-weight.html draws 70 and 80 around the centred 74; the lb board draws 150/160/170.
    expect(rulerLabels(RULER_TICKS.weight.metric, 65, 85)).toEqual([70, 80]);
    expect(rulerLabels(RULER_TICKS.weight.imperial, 145, 175)).toEqual([150, 160, 170]);
  });
});

describe("the wire — display value back to stored metric", () => {
  test("height: metric is the identity, imperial counts whole inches", () => {
    expect(heightDisplayValue(172, "metric")).toBe(172);
    expect(heightDisplayValue(172, "imperial")).toBe(68); // 5′8″
    expect(heightToCm("metric", 172)).toBe(172);
    // 5′8″ is 172.7 cm — imperial granularity, the inch the user picked is stored honestly.
    expect(heightToCm("imperial", 68)).toBe(173);
  });

  test("weight: kg stays, lb is the whole-pound display", () => {
    expect(weightDisplayValue(74, "metric")).toBe(74);
    expect(weightDisplayValue(74, "imperial")).toBe(163);
    expect(weightToKg("metric", 74)).toBe(74);
    expect(weightToKg("imperial", 163)).toBeCloseTo(73.9, 5);
  });
});

describe("heightText — the copy-ready height", () => {
  test("metric spells the unit in the reader's language", () => {
    expect(heightText(172, "metric", "en")).toBe("172 cm");
    expect(heightText(172, "metric", "ru")).toBe("172 см");
  });
  test("imperial is the ft-in join, digits in the language's format", () => {
    expect(heightText(172, "imperial", "en")).toBe("5′8″");
  });
});

describe("spellUnit — the weigh-in's and macro cards' unit words", () => {
  // The editors and the "{g} g" cards reach for kg, lb and g, and the You surface must not
  // re-spell them itself: Cyrillic is the one divergence, everything else passes through.
  test("kg, lb and g spell the way the reader's language writes them", () => {
    expect(spellUnit("en", "kg")).toBe("kg");
    expect(spellUnit("en", "lb")).toBe("lb");
    expect(spellUnit("en", "g")).toBe("g");
    expect(spellUnit("ru", "kg")).toBe("кг");
    expect(spellUnit("ru", "g")).toBe("г");
    // lb has no Cyrillic spelling — the symbol stays Latin, like the table says it does.
    expect(spellUnit("ru", "lb")).toBe("lb");
    expect(spellUnit("de", "kg")).toBe("kg");
    expect(spellUnit("vi", "g")).toBe("g");
  });
});
