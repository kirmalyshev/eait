import { spudSvg, type MascotMood } from "@eait/shared/mascot";
import type { Lang, MomentId, MomentPose } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { topBar } from "./parts.ts";
import { escape, shell } from "./shell.ts";

/**
 * A support moment (#42): the full-screen beat after one of the four answers that earns one.
 * Words and pose are `supportMoment`'s — this is only the drawing: the halo, the prop that names
 * the pose, the answer echoed back, the title, the body and the one button.
 */
export interface MomentView {
  id: MomentId;
  pose: MomentPose;
  echo: string;
  title: string;
  body: string;
  cta: string;
  /** Where the one button goes — the next question, the struggles ask, or the plan. */
  next: string;
  /** Back (#53): the answer this moment reacts to, shown again to change. */
  back?: string;
  lang: Lang;
}

/** Which face goes with each pose — the pose's PROP is drawn beside him by `poseProp`. */
const POSE_MOOD: Record<MomentPose, MascotMood> = {
  cheer: "joy", lift: "happy", think: "think", heart: "care",
};

/**
 * The pose's prop, one small inline SVG at his side. `MascotMood` has no cheer/lift/heart — the
 * faces it knows do not stretch that far — so the moment carries a thing instead: sparkles for
 * the celebration, a dumbbell for the encouragement, a thought bubble, a heart.
 */
const poseProp = (pose: MomentPose): string => {
  switch (pose) {
    case "cheer":
      return `<svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3l2.2 6.4 6.4 2.2-6.4 2.2L16 20.2l-2.2-6.4-6.4-2.2 6.4-2.2z"/><path fill="currentColor" d="M25.5 18l1.2 3.4 3.4 1.2-3.4 1.2-1.2 3.4-1.2-3.4-3.4-1.2 3.4-1.2z"/></svg>`;
    case "lift":
      return `<svg viewBox="0 0 32 20" aria-hidden="true"><rect fill="currentColor" x="9" y="8" width="14" height="4" rx="2"/><rect fill="currentColor" x="3" y="4" width="4" height="12" rx="1.5"/><rect fill="currentColor" x="25" y="4" width="4" height="12" rx="1.5"/><rect fill="currentColor" x="7" y="6" width="2.6" height="8" rx="1"/><rect fill="currentColor" x="22.4" y="6" width="2.6" height="8" rx="1"/></svg>`;
    case "think":
      return `<svg viewBox="0 0 32 26" aria-hidden="true"><path fill="var(--surface)" stroke="currentColor" stroke-width="1.8" d="M10.5 4a6.5 6.5 0 0 1 10.8 2.3A5.5 5.5 0 0 1 27 10.5a5 5 0 0 1-4.5 5H9a4.5 4.5 0 0 1 1.5-11.5z"/><circle fill="currentColor" cx="8" cy="20.5" r="2"/><circle fill="currentColor" cx="4" cy="24" r="1.2"/></svg>`;
    case "heart":
      return `<svg viewBox="0 0 24 22" aria-hidden="true"><path fill="currentColor" d="M12 20C12 20 2 13.8 2 7.6 2 4.6 4.4 2.5 7.3 2.5c1.8 0 3.6 1 4.7 2.4 1.1-1.4 2.9-2.4 4.7-2.4 2.9 0 5.3 2.1 5.3 5.1C22 13.8 12 20 12 20z"/></svg>`;
  }
};

export function moment(v: MomentView): string {
  // A GET form, not a link: the button is what a browser-onboarding walk presses to move on, and
  // `method=get` on an empty form IS plain navigation. The hidden prompt names the beat in the
  // same shape the question pages carry, so a driver can tell this screen from a question.
  return shell(v.title, `
${topBar(pageCopyFor(v.lang))}
${v.back ? `<a class="back" href="${escape(v.back)}">${escape(pageCopyFor(v.lang).back)}</a>` : ""}
<div class="moment">
  <div class="halo">${spudSvg(POSE_MOOD[v.pose], "spud-moment")}<span class="prop prop-${escape(v.pose)}">${poseProp(v.pose)}</span></div>
  <p class="echo">${escape(v.echo)}</p>
  <h1>${escape(v.title)}</h1>
  <p class="muted">${escape(v.body)}</p>
</div>
<input type="hidden" name="prompt" value="moment_${escape(v.id)}">
<form method="get" action="${escape(v.next)}"><button class="primary" type="submit">${escape(v.cta)}</button></form>
`, v.lang);
}
