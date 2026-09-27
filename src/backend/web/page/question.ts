import { chatCopyFor, spellUnit } from "@eait/shared";
import { spudSvg, type MascotMood } from "@eait/shared/mascot";
import type { Lang } from "@eait/shared";
import { pageCopyFor } from "../copy.ts";
import { askBubbles, topBar } from "./parts.ts";
import { escape, shell } from "./shell.ts";

export interface QuestionOption { value: string; label: string; hint?: string }

export interface QuestionView {
  promptId: string;
  kind: "choice" | "number" | "chips";
  lines: readonly string[];
  options: readonly QuestionOption[];
  placeholder: string | null;
  /** The server's own refusal, rendered rather than re-implemented. */
  error: string | null;
  /**
   * Extra submit buttons above the normal control — the app's quick replies, which is what they
   * are: "Switch to losing" when the target runs the wrong way, "That's my real age" when the year
   * says under sixteen. A refusal whose words offer a way out has to carry the way out.
   */
  actions: readonly { name: string; value: string; label: string }[];
  /**
   * Spud's line back on the PREVIOUS answer (#42) — `reactionTo`, said above this ask with the
   * mood's own face. Null on the first question, where there is nothing to react to.
   */
  reaction?: { line: string; mood: MascotMood } | null;
  /**
   * The target stepper: the value the card shows and the healthy range it stays inside. Set, it
   * REPLACES the number box — the −/+ submits carry the shown `answer` back with a direction, and
   * only the primary button commits it. Absent at the floor, where there is nothing to suggest.
   */
  stepper?: { value: number; min: number; max: number } | null;
  /** Where the form posts — `/start/q` for a profile question; the struggles screen is a route. */
  action?: string;
  /** The primary button's word — `continueLabel` unless a prompt carries its own ("Done"). */
  submitLabel?: string;
  step?: number;
  total?: number;
  /** Where Back goes (#53): the question before this one, or the welcome from the first. */
  back?: string;
  /** The answer already on the profile, when an answered question is shown again to change. */
  current?: readonly string[];
  /** Which language to render in. On the VIEW, because every string on the page reads it. */
  lang: Lang;
}

export function question(v: QuestionView): string {
  const PAGE_COPY = pageCopyFor(v.lang);
  const hidden = `<input type="hidden" name="prompt" value="${escape(v.promptId)}">`;
  const chosen = new Set(v.current ?? []);
  const submit = v.submitLabel ?? PAGE_COPY.continueLabel;
  let controls: string;
  if (v.stepper) {
    // The − and + ARE the answer field here: each posts the shown number back with a direction and
    // the server replies with the page, stepped. `disabled` at the bounds — and the server clamps
    // anyway, because a button is a suggestion and a POST is a fact.
    const st = chatCopyFor(v.lang).stepper;
    const { value, min, max } = v.stepper;
    controls =
      `<div class="card stepper"><div>` +
      `<div class="lab">${escape(PAGE_COPY.stepperSuggested)}</div>` +
      `<p class="figure"><input class="stepper-num" type="number" name="answer" inputmode="decimal"` +
      ` step="any" required value="${value}"` +
      ` aria-label="${escape(PAGE_COPY.stepperSuggested)}"> ` +
      `${escape(spellUnit(v.lang, "kg"))}</p></div>` +
      `<div class="stepper-btns">` +
      `<button type="submit" name="step" value="-1" aria-label="${escape(st.less)}"${value <= min ? " disabled" : ""}>−</button>` +
      `<button type="submit" name="step" value="1" aria-label="${escape(st.more)}"${value >= max ? " disabled" : ""}>+</button>` +
      `</div></div>` +
      `<button class="primary" type="submit">${escape(st.continue)}</button>`;
  } else if (v.kind === "choice") {
    // One button per option: with no JavaScript, a radio group needs a second tap on a submit
    // button, and the app's version is one tap.
    controls = v.options.map((o) =>
      `<button type="submit" name="answer" value="${escape(o.value)}"` +
      `${chosen.has(o.value) ? ` class="sel" aria-pressed="true"` : ""}>${escape(o.label)}` +
      `${o.hint ? `<span class="hint">${escape(o.hint)}</span>` : ""}</button>`).join("");
  } else if (v.kind === "number") {
    // A visible label (#53), and the refusal UNDER the field it is about, tied to it — never above
    // Spud's reaction, where it read as his.
    controls =
      `${v.placeholder ? `<label class="lab" for="answer">${escape(v.placeholder)}</label>` : ""}` +
      `<input id="answer" type="number" name="answer" inputmode="decimal" step="any" required autofocus` +
      `${v.current?.[0] !== undefined ? ` value="${escape(v.current[0])}"` : ""}` +
      `${v.error ? ` aria-invalid="true" aria-describedby="answer-error"` : ""}` +
      `${v.placeholder ? ` placeholder="${escape(v.placeholder)}"` : ""}>` +
      `${v.error ? `<p class="notice field-error" id="answer-error">${escape(v.error)}</p>` : ""}` +
      `<button class="primary" type="submit">${escape(submit)}</button>`;
  } else {
    controls = v.options.map((o) =>
      `<label class="check"><input type="checkbox" name="answer" value="${escape(o.value)}"` +
      `${chosen.has(o.value) ? " checked" : ""}> ` +
      `${escape(o.label)}</label>`).join("") +
      `<button class="primary" type="submit">${escape(submit)}</button>`;
  }
  const actions = v.actions.map((a) =>
    `<button type="submit" name="${escape(a.name)}" value="${escape(a.value)}">${escape(a.label)}</button>`,
  ).join("");
  const reaction = v.reaction
    ? `<div class="spk"><span class="av">${spudSvg(v.reaction.mood, "spud-react")}</span>` +
      `<p class="bubble typed">${escape(v.reaction.line)}</p></div>`
    : "";
  // The BRAND, untranslated — the same reason `LANG_LABEL` is not. A question page in the
  // middle of a flow is titled by the product, not by a sentence about it.
  return shell("eait", `
${topBar(PAGE_COPY)}
${v.back ? `<a class="back" href="${escape(v.back)}">${escape(PAGE_COPY.back)}</a>` : ""}
${v.step !== undefined && v.total !== undefined
  ? `<p class="progress">${escape(PAGE_COPY.progress
    .replace("{step}", String(v.step)).replace("{total}", String(v.total)))}</p>`
  : ""}
${v.error && (v.kind !== "number" || v.stepper) ? `<p class="notice">${escape(v.error)}</p>` : ""}
${reaction}
${askBubbles(v.lines)}
<form method="post" action="${escape(v.action ?? "/start/q")}">${hidden}${actions}${controls}</form>
`, v.lang);
}
