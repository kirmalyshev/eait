// The sample the page promises, at the values a real host actually sets.
//
// `landing.test.ts` checks the copy against whatever THIS build resolved, which is the right shape
// for a page built per instance and proves nothing about the other configurations. Production was
// pinned to one analysis (`iac/inventories/production/hosts.yml`) from #96 to #198 while the
// instance-wide cap was decided, so the SINGULAR renderings were what the deployed page served — and
// they had no test at all, in the one configuration that was live. `e2e-paywall.sh` still pins one.
import { describe, expect, test } from "bun:test";
import { FREE_ANALYSES } from "@eait/shared";
import { LandingConfigError } from "./config.ts";
import { configuredSample, sampleAnalyses } from "./config.ts";

describe("sampleAnalyses", () => {
  test("unset is the shipped default", () => {
    expect(sampleAnalyses({})).toBe(FREE_ANALYSES);
    expect(sampleAnalyses({ EAIT__BACKEND__FREE_ANALYSES: "  " })).toBe(FREE_ANALYSES);
  });

  test("a whole number of analyses is what the page promises", () => {
    expect(sampleAnalyses({ EAIT__BACKEND__FREE_ANALYSES: "1" })).toBe(1);
    expect(sampleAnalyses({ EAIT__BACKEND__FREE_ANALYSES: "7" })).toBe(7);
  });

  // ZERO IS THE ONE WORTH NAMING. It is a legitimate backend value — `int()` takes it, and it
  // means an instance handing out nothing — and it rendered "The first 0 answers are yours" in the
  // refusal copy, both FAQs and the Google snippet before the guard read `< 1`.
  test("a value this page cannot promise anybody fails the build", () => {
    for (const raw of ["0", "-2", "2.5", "three", ""]) {
      const env = { EAIT__BACKEND__FREE_ANALYSES: raw };
      if (raw === "") { expect(sampleAnalyses(env)).toBe(FREE_ANALYSES); continue; }
      expect(() => sampleAnalyses(env)).toThrow(LandingConfigError);
    }
  });
});

// The total read `content.ts` uses while it is being imported, which is before `build.ts` can catch
// anything. It must never be the thing that throws: the validation belongs to `loadLandingConfig`,
// inside that try, where the operator gets one line instead of a stack ending in a copy file.
test("configuredSample falls back instead of throwing during import", () => {
  expect(configuredSample({ EAIT__BACKEND__FREE_ANALYSES: "nonsense" })).toBe(FREE_ANALYSES);
  expect(configuredSample({ EAIT__BACKEND__FREE_ANALYSES: "0" })).toBe(FREE_ANALYSES);
  expect(configuredSample({ EAIT__BACKEND__FREE_ANALYSES: "2" })).toBe(2);
});

// THE MODULE-LOAD PATH, IN A SUBPROCESS, because that is the only way to observe it: `content.ts`
// reads the variable as it is imported, and this file has already imported it.
test("a host pinned to one analysis renders the singular copy", async () => {
  const proc = Bun.spawn({
    cmd: ["bun", "-e", `
      const c = await import("./src/backend/landing/content.ts");
      const billing = c.refusals[0].body + " " + c.faqs.map((f) => f.a).join(" ");
      console.log(JSON.stringify({ sample: c.SAMPLE_ANALYSES, billing }));
    `],
    cwd: new URL("../../..", import.meta.url).pathname,
    env: { ...process.env, EAIT__BACKEND__FREE_ANALYSES: "1" },
    stdout: "pipe",
    stderr: "pipe",
  });
  const out = await new Response(proc.stdout).text();
  expect(await proc.exited).toBe(0);
  const { sample, billing } = JSON.parse(out.trim().split("\n").at(-1)!);
  expect(sample).toBe(1);
  expect(billing).toContain("That first answer is yours");
  expect(billing).toContain("Your first analysis costs nothing");
  expect(billing).toContain("The first one costs you nothing");
  expect(billing).not.toContain("analyses cost nothing");
});
