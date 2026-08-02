// Which tools a turn may call, and when the turn is over.
//
// WHY THE STOP CONDITION EXISTS. Every terminal-tool call site sets `toolChoice: "required"`, which
// is what stops the model answering in prose and losing the user's meal. But `toolChoice` applies to
// EVERY step of the agent loop, not just the first — so a model that has already called
// `submit_meal` is still forbidden from replying with text on the next step, and must call another
// tool, and another, until `maxSteps` runs out. Measured at 6 model calls for one photo, with the
// correct answer sitting in step 1 the whole time. `maxSteps` cannot fix that; it IS the number the
// loop runs to. The loop has to be told the work is done.
//
// WHY THE TOOL SETS EXIST, and why they are not optional once the stop condition is. The agent
// registers every terminal tool, because it is one agent. Before the stop condition, a photo turn
// that wandered into `answer_question` would keep looping and could still recover. With it, that
// call ENDS the turn — `analyzeMealViaAgent` then finds no `submit_meal` and throws, and the user's
// meal is gone. So each flow passes `activeTools`, and a tool that cannot be called cannot end a
// turn it has no business ending.

/** Terminal for the photo flow. Grounding is a mid-turn lookup, not an ending. */
export const PHOTO_TOOLS = ["submit_meal"] as const;

/** Terminal for the free-text router — one per variant of the `RouteResult` union. */
export const ROUTER_TOOLS = [
  "submit_meal",
  "submit_correction",
  "submit_redate",
  "answer_question",
  // "I found more than one meal this could be." Terminal because the turn genuinely ends there:
  // the user's tap replays the message with a focus meal rather than resuming this turn.
  "ask_which_meal",
] as const;

/** Terminal for onboarding. Restricted hardest: it runs before a profile exists, so a diary tool
 * would query rows the user does not have and `submit_meal` would log a meal out of a list of
 * allergies. */
export const ONBOARDING_TOOLS = ["submit_restrictions"] as const;

/** The composition-table lookup. Available mid-turn wherever grounding helps; never ends a turn. */
export const LOOKUP_TOOL = "search_food_db";

/**
 * The user's-own-diary lookup. Mid-turn, never terminal — like `search_food_db`, it answers a
 * question the model then has to act on.
 *
 * ROUTER ONLY, and the omission from the photo set is deliberate: a photo is a NEW meal, so a
 * diary search could only tempt the model into "correcting" an existing one out of a picture of a
 * different plate. Onboarding is restricted harder still — it runs before the user has any rows.
 */
export const MEAL_LOOKUP_TOOL = "find_meals";

/** Every tool that ENDS a turn, in any flow. The stop condition matches this whole set — safe
 * precisely because `activeTools` decides which of them a given turn can reach. */
export const TERMINAL_TOOLS = [
  ...new Set<string>([...PHOTO_TOOLS, ...ROUTER_TOOLS, ...ONBOARDING_TOOLS]),
] as readonly string[];

const isTerminal = (name: unknown): name is string =>
  typeof name === "string" && TERMINAL_TOOLS.includes(name);

/**
 * Stop as soon as any terminal tool has been called.
 *
 * Deliberately looks across ALL steps rather than only the last: a turn that called
 * `search_food_db` and then `submit_meal`, or that retried after a validation error, still has its
 * answer, and re-asking the model would only invite it to produce a second one.
 *
 * Written out rather than using the AI SDK's `hasToolCall` helper — this must match ANY terminal
 * tool, and that helper is not on Mastra's public surface.
 */
export const stopAtTerminalTool = ({ steps }: { steps: Array<{ toolCalls?: unknown[] }> }): boolean =>
  steps.some((s) =>
    (s.toolCalls ?? []).some((c) => isTerminal((c as { toolName?: unknown })?.toolName)),
  );
