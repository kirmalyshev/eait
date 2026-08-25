// Build-blocking health-claims linter for the landing copy.
//
// THE RULE SET MOVED TO `src/shared/claims.ts` when the notification copy became the second
// admin-editable public surface — same words, one list, so a rule added for one gate reaches the
// other. Its header carries the provenance (`eait-marketer/src/claims.ts`) and the reason the rules
// are narrow. What stays here is the landing page's half: turning rendered HTML back into copy, and
// failing the build rather than returning a report.
//
// WHY IT BLOCKS THE BUILD RATHER THAN WARNING. FTC substantiation applies per claim, at up to
// $50,120 per violation, and EU Reg 1924/2006 treats marketing copy about food much like a product
// label. A reviewer's memory is not a control; a failing exit code is.

import { lintCopy, type ClaimViolation } from "@ieat/shared";

export { lintCopy, type ClaimViolation };

export class ClaimsError extends Error {
  readonly violations: ClaimViolation[];
  constructor(violations: ClaimViolation[]) {
    const detail = violations.map((v) => `  ${v.field}: "${v.span}" (${v.pattern})`).join("\n");
    super(`Landing copy failed the claims gate — nothing was written:\n${detail}`);
    this.name = "ClaimsError";
    this.violations = violations;
  }
}

/** Throws `ClaimsError` if any field contains a banned claim. */
export function assertClean(fields: Record<string, string>): void {
  const violations = lintCopy(fields);
  if (violations.length > 0) throw new ClaimsError(violations);
}

/**
 * Every human-readable string in a rendered page, keyed by a locator good enough to find it again.
 *
 * Runs on the RENDERED HTML rather than on `content.ts`, deliberately. The copy that reaches a
 * reader is the copy that matters, and a string assembled at render time out of two clean halves
 * can still read as a claim. Tags, attributes, comments and the inline stylesheet are stripped so
 * a CSS property named `fill` or an author comment cannot trip a rule.
 */
export function copyFromHtml(html: string): Record<string, string> {
  const withoutHead = html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");

  // Attributes carry real copy — alt text, aria-label, the meta description, the document title.
  const attributes = [...withoutHead.matchAll(/\b(?:alt|aria-label|content|title)="([^"]*)"/gi)]
    .map((m) => m[1]!)
    .filter((v) => /\s/.test(v)); // single tokens are ids and enum values, not prose

  const body = withoutHead.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

  return {
    "rendered text": decodeEntities(body),
    "attribute text": decodeEntities(attributes.join(" · ")),
  };
}

/** Enough of one to stop `&amp;` hiding a word boundary. The page emits no other entities. */
function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
