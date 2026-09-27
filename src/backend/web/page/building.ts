import { PLAN_REVEAL, type Lang, type PlanRow } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { escape, shell } from "./shell.ts";

/**
 * The plan reveal (board `phone/ob-building`, drawn the same in the web column — it has no web
 * board of its own): the count to 100 while the plan's own rows tick in, then the one button.
 *
 * EVERY NUMBER IS THE PLAN'S. The rows arrive already computed — `planRows` over
 * `explainTargets`' output — so the strip "checks" nothing it did not compute. The theatre is
 * timing only (DIRECTION §8), and the timings are `PLAN_REVEAL`'s, shared so neither client
 * retypes them.
 *
 * NO SCRIPT DOES THIS: the count, the ticks and the button's arrival are CSS on `--d`, and the
 * plan's auto-open is a meta refresh — the one navigational instrument a no-script page has. The
 * seconds are `durationMs + autoOpenDelayMs`, never a hand-typed number.
 */
export interface BuildingView {
  /** The reveal's own words: `content.building.lines`, its card title and its CTA. */
  lines: readonly string[];
  title: string;
  cta: string;
  /** `planRows`' output — labels from the content, values computed. */
  rows: readonly PlanRow[];
  /** Where the button and the auto-open go — `/start/plan`. */
  next: string;
  lang: Lang;
}

/** A row's icon by its `planRows` id — the macro chips, the diet's, the declared limit's. */
const ROW_ICON: Record<PlanRow["id"], string> = {
  calories: "kcal",
  protein: "protein",
  carbs: "carbs",
  fat: "fat",
  diet: "balanced",
  limit: "health",
};

export function building(v: BuildingView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const ticks = PLAN_REVEAL.rowTicksMs;
  // The button and the auto-open arrive when the count does; a run that draws more rows than
  // there are marks (two declared caps) shares the last tick, per `planRows`' own note.
  const openS = (PLAN_REVEAL.durationMs + PLAN_REVEAL.autoOpenDelayMs) / 1000;
  return shell(PAGE_COPY.titlePlan, `
<div class="bld">
<div class="pct count num" style="--to:100" role="img" aria-label="100%"></div>
${v.lines.map((line) => `<p class="bld-line">${escape(line)}</p>`).join("\n")}
<div class="lbar"><i></i></div>
<div class="card"><span class="lab">${escape(v.title)}</span>
${v.rows.map((row, i) => `  <div class="chk" style="--d:${ticks[Math.min(i, ticks.length - 1)]! / 1000}s"><i></i><span class="mac"><i class="ico i-${ROW_ICON[row.id]}"></i>${escape(row.label)}</span><b class="num">${escape(row.value)}</b></div>`).join("\n")}
</div>
<a class="cta p go" href="${escape(v.next)}">${escape(v.cta)}</a>
</div>
`, v.lang, { head: `<meta http-equiv="refresh" content="${openS};url=${escape(v.next)}">` });
}
