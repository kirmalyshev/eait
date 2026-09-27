// The unit helpers, against the persona every Register P board is drawn with: 172 cm is 5 ft 8 in,
// 74 kg is 163 lb, and the US stays imperial while everywhere the eight languages are spoken stays
// metric.
//
// Stored values never leave metric — `Profile.height_cm` and `weight_kg` are what the server keeps;
// everything here is for the ruler under the user's thumb and the number beside it.

import { describe, expect, test } from "bun:test";
import {
  cmToFtIn,
  defaultUnits,
  ftInToCm,
  kgToLb,
  lbToKg,
  rulerLabels,
  RULER_TICKS,
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
});

describe("kg ↔ lb", () => {
  test("74 kg is the persona's 163 lb", () => {
    expect(kgToLb(74)).toBe(163);
  });

  test("lb back to kg keeps a tenth, like every stored weight", () => {
    expect(lbToKg(163)).toBe(73.9);
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
  test("the height ruler stands up in cm: 165–180, a label every 5", () => {
    const t = RULER_TICKS.height.metric;
    expect(t.min).toBe(165);
    expect(t.max).toBe(180);
    expect(t.pxPerUnit).toBe(9.5);
    expect(t.majorEvery).toBe(5);
    expect(t.labelEvery).toBe(5);
    expect(rulerLabels(t, t.min, t.max)).toEqual([165, 170, 175, 180]);
  });

  test("the imperial height ruler: 5′0″–6′4″, a label every four inches", () => {
    const t = RULER_TICKS.height.imperial;
    expect(t.min).toBe(60);
    expect(t.max).toBe(76);
    expect(t.pxPerUnit).toBe(9.5);
    expect(t.majorEvery).toBe(4);
    expect(t.labelEvery).toBe(4);
    expect(rulerLabels(t, t.min, t.max)).toEqual([60, 64, 68, 72, 76]);
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
