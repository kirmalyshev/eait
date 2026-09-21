// The design system's own rules.
//
// BESIDE THE MODULE rather than in a client, because these are claims about the SYSTEM: that its
// values are data a second product can read, that the three colours which mean one thing each
// mean only that, and that a component the design names keeps its name. The client's side of the
// bargain — that it renders from this and holds no colour of its own — is asserted where the
// client is, in `src/frontend/server/index.test.ts` and `src/frontend/test/client.test.ts`.

import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import {
  CLASS, COLOR, FAMILY, FILL, GAUGE, GEOMETRY, STYLESHEET, THOUSANDS_GAP, TOKEN_HEXES, TYPE,
} from "./design.ts";

describe("it is a system a second product can consume", () => {
  it("states its sizes and spacing as NUMBERS, not as CSS", () => {
    // THE WHOLE REASON THIS FILE IS IN `shared`. The other consumer is React Native, which cannot
    // read `font: 800 44px/1 …` — a token written as a CSS declaration is a token that is quietly
    // web-only, and the drift starts the day somebody adds one.
    for (const [role, spec] of Object.entries(TYPE)) {
      expect(`${role}.size`).toBe(`${role}.size`);
      expect(typeof spec.size, `${role}.size`).toBe("number");
      expect(typeof spec.weight, `${role}.weight`).toBe("number");
      expect(typeof spec.tracking, `${role}.tracking`).toBe("number");
      expect(typeof spec.leading, `${role}.leading`).toBe("number");
    }
    for (const [name, value] of Object.entries(GEOMETRY)) {
      expect(typeof value, name).toBe("number");
    }
    expect(typeof GAUGE.stroke).toBe("number");
    expect(typeof GAUGE.length).toBe("number");
  });

  it("carries the whole scale and both families, not the handful one screen needed", () => {
    // The drawn source names ten roles and two families. A scale with the three sizes the first
    // screen happened to want is a list of numbers, and the next screen invents a fourth.
    expect(Object.keys(TYPE).sort()).toEqual([
      "body", "chip", "cta", "headline", "hero", "micro", "row", "secondary", "section", "title",
    ]);
    expect(FAMILY.ui).toContain("Plus Jakarta Sans");
    expect(FAMILY.mono).toContain("DM Mono");
    // The mono is first in its own stack and nowhere in the other: the division of labour is the
    // point, and a mono that falls back to the UI face makes a column of figures stop lining up.
    expect(FAMILY.ui).not.toContain("DM Mono");
  });

  it("says what every colour MEANS", () => {
    // A token with no comment is a hex somebody will spend on the nearest thing that looks close.
    // The three that mean one thing each are the reason this is enforced rather than asked for.
    const src = readFileSync(new URL("./design.ts", import.meta.url), "utf8");
    const block = src.slice(src.indexOf("export const COLOR"), src.indexOf("} as const", src.indexOf("export const COLOR")));
    for (const name of Object.keys(COLOR)) {
      const at = block.indexOf(`${name}:`);
      expect(`${name} declared`).toBe(`${name} declared`);
      // The line before a token is either the end of its doc comment or a one-line one.
      const before = block.slice(0, at).trimEnd();
      expect(`${name}: ${before.endsWith("*/")}`).toBe(`${name}: true`);
    }
  });
});

describe("the three colours that mean one thing", () => {
  const rulesUsing = (token: string) => STYLESHEET.split("}")
    .filter((rule) => rule.includes(`var(--${token})`))
    .map((rule) => rule.split("{")[0]!.replace(/\/\*[\s\S]*?\*\//g, "").trim().replace(/\s+/g, " "));

  it("spends amber on the guess and on nothing else", () => {
    // Three, and each is the guess: `.abt` is the hedge word in front of a figure, `.meal-sub
    // .flag` is the worded flag on the one ROW it is about, and `.lab.amber` is the same flag as
    // a screen's single label. A fourth selector here is amber meaning a second thing, and the
    // grammar stops being readable the moment it does.
    expect(rulesUsing("amber")).toEqual([".abt", ".meal-sub .flag", ".lab.amber"]);
  });

  it("spends blue on the floor and on nothing else", () => {
    // A status line, never a tick on a gauge and never a region on a chart — both were the range
    // machinery this grammar removed.
    expect(rulesUsing("blue")).toEqual([".sl.floor"]);
  });

  it("keeps the guess tint out of the green family and the other way round", () => {
    expect(FILL.guess).toContain("255,197,61");
    expect(FILL.selected).toContain("90,240,90");
  });
});

describe("the components are named the way the design names them", () => {
  it("styles every one this product draws", () => {
    // A component that exists in both places has ONE name, so a screen drawn against the design
    // and a screen drawn against this file are the same screen.
    for (const name of [
      "card", "note", "wash", "ink", "gauge", "gnum", "big", "stat", "sl", "lab",
      "tiles", "tile", "bar", "prog", "mono", "ts", "abt", "num", "rowsel",
      "opt", "sel", "tk", "btn", "btn2", "bub", "them", "me", "comp", "send", "nav",
      "ph", "phl", "kbd", "entry", "meals", "meal", "thread",
    ]) {
      expect(`${name}: ${STYLESHEET.includes(`.${name}`)}`).toBe(`${name}: true`);
    }
    // The table is element-selected, because a table's cells have no other name.
    for (const sel of ["th {", "td {", "tr:last-child td"]) {
      expect(`${sel}: ${STYLESHEET.includes(sel)}`).toBe(`${sel}: true`);
    }
  });

  it("hands the two class names that are a CLAIM to its consumers", () => {
    // A row that is a guess and an option that was chosen are statements about the data. Typed at
    // the call site, a typo in either is a claim that silently stops being made.
    expect(STYLESHEET).toContain(`.${CLASS.guessed}`);
    expect(STYLESHEET).toContain(`.${CLASS.selected}`);
    expect(STYLESHEET).toContain(`.${CLASS.about}`);
    expect(STYLESHEET).toContain(`.${CLASS.figure}`);
    expect(STYLESHEET).toContain(`.${CLASS.thousands}`);
  });

  it("makes the option row a border and a tint, never a solid green fill", () => {
    // Three deep in a column, a filled row makes every option that was not chosen read disabled.
    const selected = STYLESHEET.slice(STYLESHEET.indexOf(".opt.sel {"));
    expect(selected.slice(0, selected.indexOf("}"))).toContain(FILL.selected);
    expect(selected.slice(0, selected.indexOf("}"))).not.toContain("background: var(--green)");
  });

  it("draws the gauge as a semicircle with no band and no tick", () => {
    // An arc, an arc length, and nothing else: a band segment and a floor tick were both range
    // machinery, and the number grammar is what removed them.
    expect(GAUGE.path.startsWith("M")).toBe(true);
    expect(GAUGE.path).not.toContain("Z");
    expect(GAUGE.length).toBeCloseTo(Math.PI * 130, 1);
  });
});

describe("the mono word-space trap is designed out", () => {
  it("gives the thousands gap a width rather than a space", () => {
    // DM Mono's word space is a full advance. A thousands gap typed as a space, or a unit left
    // inside the mono run, renders "141 g" with a hole you can park a bus in.
    expect(THOUSANDS_GAP).toBe("0.24em");
    expect(STYLESHEET).toContain(`.ts { display: inline-block; width: ${THOUSANDS_GAP}; }`);
  });
});

describe("the hexes", () => {
  it("are all declared, so the clients' own guards have something to check against", () => {
    const inSheet = new Set((STYLESHEET.match(/#[0-9a-fA-F]{3,8}\b/g) ?? []).map((h) => h.toLowerCase()));
    expect([...inSheet].filter((h) => !TOKEN_HEXES.includes(h))).toEqual([]);
    expect(TOKEN_HEXES).toContain(COLOR.amber.toLowerCase());
    expect(TOKEN_HEXES).toContain(COLOR.blue.toLowerCase());
    // Including the STOPS of the two gradients. They are not named tokens — they are part of one
    // fill, which carries the comment — but they are declared, and a hex that is declared nowhere
    // is exactly the hole the clients' guards are pointed at.
    expect(TOKEN_HEXES).toContain("#3fc551");
  });
});
