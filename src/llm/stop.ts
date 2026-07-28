// When an agent turn is finished.
//
// WHY THIS EXISTS. Every terminal-tool call site sets `toolChoice: "required"`, which is what stops
// the model answering in prose and losing the user's meal. But `toolChoice` applies to EVERY step of
// the agent loop, not just the first — so a model that has already called `submit_meal` is still
// forbidden from replying with text on the next step, and must call another tool, and another,
// until `maxSteps` runs out. Left alone that is one photo costing `maxSteps` model calls instead of
// one or two: a silent multiplication of the bill and the latency, with a correct answer sitting in
// step 1 the whole time.
//
// `maxSteps` cannot fix it — it IS the number the loop runs to. The loop has to be told that the
// work is done, which is what a stop condition is for.
//
// Written out rather than using the AI SDK's `hasToolCall` helper: this needs to match ANY of the
// terminal tools (a router turn ends in whichever one the model picked), and the version of that
// helper reachable through Mastra's bundled types is not part of its public surface.

/** The tools that END a turn. Anything else — `search_food_db` — is a lookup mid-turn. */
export const TERMINAL_TOOLS = [
  "submit_meal",
  "submit_correction",
  "submit_redate",
  "answer_question",
  "submit_restrictions",
] as const;

export type TerminalTool = (typeof TERMINAL_TOOLS)[number];

const isTerminal = (name: unknown): name is TerminalTool =>
  typeof name === "string" && (TERMINAL_TOOLS as readonly string[]).includes(name);

/**
 * Stop as soon as any terminal tool has been called.
 *
 * Deliberately looks across ALL steps rather than only the last: a turn that called
 * `search_food_db` and then `submit_meal` in one step, or that retried after a validation error,
 * still has its answer, and re-asking the model would only invite it to produce a second one.
 */
export const stopAtTerminalTool = ({ steps }: { steps: Array<{ toolCalls?: unknown[] }> }): boolean =>
  steps.some((s) =>
    (s.toolCalls ?? []).some((c) => isTerminal((c as { toolName?: unknown })?.toolName)),
  );
