// Onboarding restriction classification through the Mastra agent — migration stage 4
// (`docs/design/2026-07-28-mastra-engine-boundary.md`). Replaces `analyzer.ts:classifyRestrictions`.
//
// NEVER THROWS. This is the contract the old function carried and the reason it is worth restating:
// the call runs mid-onboarding, at most once per user, purely as a REFINEMENT of a keyword pass
// that already produced an answer. A throw here would propagate past `applyRestrictionFallback`
// and skip `applyOnboarding` entirely, discarding a profile the user already typed. So every error
// path returns `[]`, which means "keep the keyword result" — and every one of them logs, because
// this path only runs when the keyword pass matched NOTHING, so a silent failure leaves the user
// with no restrictions at all, no kidney verdict, no sodium cap, and nothing saying why.

import type { Agent } from "@mastra/core/agent";
import type { RequestContext } from "@mastra/core/request-context";
import { stopAtTerminalTool, ONBOARDING_TOOLS } from "./stop.ts";
import { SYSTEM_CLASSIFY, buildClassifyText } from "../analyzer.ts";
import { isRestrictionTag } from "../targets.ts";
import type { Profile } from "../types.ts";

const isToolError = (v: unknown): v is { error: true; message?: string } =>
  typeof v === "object" && v !== null && (v as { error?: unknown }).error === true;

export async function classifyRestrictionsViaAgent(
  agent: Agent,
  text: string,
  lang: Profile["lang"],
  requestContext: RequestContext,
): Promise<string[]> {
  try {
    const result = await agent.generate(
      [{ role: "user", content: [{ type: "text", text: buildClassifyText(text, lang) }] }],
      {
        instructions: SYSTEM_CLASSIFY,
        requestContext,
        // NO MEMORY: classifying one sentence of free text against a fixed vocabulary has no
        // history to carry, and this runs once per user before a profile exists.
        // The ONE per-call tool subset in the codebase, and the one place it is clearly right: this
        // runs before a profile exists, so a diary tool would query rows the user does not have,
        // and `submit_meal` on an onboarding answer would log a meal out of a list of allergies.
        //
        // `activeTools`, NOT `toolsets`: `ToolsetsInput = Record<string, ToolsInput>` MERGES extra
        // tools into the agent's set, so passing a subset there would have restricted nothing and
        // left every terminal tool reachable on an onboarding turn.
        activeTools: [...ONBOARDING_TOOLS],
        toolChoice: "required",
        // `toolChoice: "required"` applies to EVERY step, so without this the loop cannot end: the model
        // is forbidden from replying in prose even after it has submitted, and burns maxSteps producing
        // answers nobody reads. Measured at 6 model calls for one photo.
        stopWhen: stopAtTerminalTool,
        maxSteps: 3,
      },
    );

    const calls = ((result as { toolResults?: unknown[] }).toolResults ?? []) as {
      payload?: { toolName?: string; result?: unknown };
    }[];
    const submitted = calls.filter((c) => c.payload?.toolName === "submit_restrictions").at(-1);
    if (!submitted) {
      console.error("[eait] restriction classification returned no submit_restrictions call");
      return [];
    }
    const payload = submitted.payload?.result;
    if (isToolError(payload)) {
      console.error(
        `[eait] restriction classification returned an unusable shape: ${payload.message ?? "unknown"}`,
      );
      return [];
    }
    // Filtered against the vocabulary the rest of the app can act on, exactly as the old path did.
    // The tool's schema accepts any string precisely so that three good tags and one invented one
    // yield three tags rather than a Mastra retry.
    return ((payload as { tags?: unknown }).tags as string[] ?? []).filter(isRestrictionTag);
  } catch (e) {
    console.error(`[eait] restriction classification failed: ${(e as Error)?.message}`);
    return [];
  }
}
