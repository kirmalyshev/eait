// Build-blocking health-claims linter for the landing copy.
//
// PROVENANCE. The rule set is ported from `eait-marketer/src/claims.ts`, which encodes the
// compliance pass in that repo's `docs/research/2026-07-21-content-factory-stack.md` §5. It is a
// copy on purpose: the two repositories are separate products with separate release cadences, and
// a cross-repo import would make a landing build depend on a marketing checkout being present. The
// cost of the copy is that a rule added there does not arrive here — so if you change one, change
// both, and the comment at the top of the other file says the same thing.
//
// WHY IT BLOCKS THE BUILD RATHER THAN WARNING. FTC substantiation applies per claim, at up to
// $50,120 per violation, and EU Reg 1924/2006 treats marketing copy about food much like a product
// label. A reviewer's memory is not a control; a failing exit code is.
//
// The patterns are deliberately narrow, for the reason the original gives: a linter that flags
// "sweet treats" gets disabled within a week, and a disabled linter protects nothing.

export interface ClaimViolation {
  field: string;
  pattern: string;
  span: string;
  index: number;
}

export class ClaimsError extends Error {
  readonly violations: ClaimViolation[];
  constructor(violations: ClaimViolation[]) {
    const detail = violations.map((v) => `  ${v.field}: "${v.span}" (${v.pattern})`).join("\n");
    super(`Landing copy failed the claims gate — nothing was written:\n${detail}`);
    this.name = "ClaimsError";
    this.violations = violations;
  }
}

interface Rule {
  name: string;
  re: RegExp;
}

const RULES: readonly Rule[] = [
  // Disease verbs. Word-bounded on both ends for the ones that are common prefixes of ordinary
  // words ("healthy", "preventable", "reversible"); "cure" has no such collision so its trailing
  // boundary is dropped, which is what catches a delimiter-free "#curesacne".
  {
    name: "disease-verb",
    re: /\b(?:prevents?|prevented|preventing|heals?|healed|healing|reverses?|reversed|reversing)\b/gi,
  },
  { name: "disease-verb", re: /\b(?:cures?|cured|curing)/gi },
  { name: "treats-disease", re: /\btreats?\s+(diabetes|cancer|obesity|hypertension|disease|illness)\b/gi },
  { name: "lowers-marker", re: /\blowers?\s+(cholesterol|blood\s+sugar|blood\s+pressure)\b/gi },
  { name: "detox", re: /\bdetox(?:ification|ifying|ifies|ify|ing|es)?/gi },
  { name: "burns-fat", re: /\b(?:burns?|burning)\s*fat\b|\bfat\s*burn(?:s|ing)?\b/gi },
  { name: "disease-term", re: /\b(diabetes|cancer|hypertension|heart\s+disease)/gi },
  { name: "guarantee", re: /\bguarantee(?:d|s|ing)?\b/gi },
  { name: "weight-promise", re: /\blose\s*\d+\s*(?:kg|kilos?|pounds?|lbs)\b|\blose\s*weight/gi },

  // ── Added here, not present in the marketing repo's version ─────────────────────────────────
  //
  // That linter guards social assets, where the risk is a health claim. A landing page carries a
  // second class of risk the social captions do not: comparative and exclusivity claims about
  // competitors, sitting on a domain we own, indexed, and durable.
  //
  // An Alleinstellungsbehauptung — "the only", "the first", "no other app" — is actionable under
  // §5 UWG by any competitor or by the Wettbewerbszentrale, and an Abmahnung with costs is the
  // standard response. `marketing/DECISIONS.md` (2026-07-26) retired a caption for exactly
  // this after the repo's own research disproved it. The page is written to make no such claim;
  // this is what keeps it that way after the fourth edit by someone who has not read that entry.
  { name: "exclusivity", re: /\bthe\s+only\s+(?:app|tracker|one)\b|\bno\s+other\s+app\b/gi },
  { name: "superiority", re: /\bevery\s+other\s+app\b|\bbetter\s+than\s+(?:any|every|all)\b/gi },
];

/**
 * Normalizes an invisible-character bypass before matching — a zero-width space or soft hyphen
 * splits a banned token for the regex while the rendered page shows the word intact. NFKC first,
 * then every Unicode format character.
 */
function normalizeForMatch(text: string): string {
  return text.normalize("NFKC").replace(/\p{Cf}/gu, "");
}

/** Returns every violation across every field. Never throws. */
export function lintCopy(fields: Record<string, string>): ClaimViolation[] {
  const violations: ClaimViolation[] = [];
  for (const [field, rawText] of Object.entries(fields)) {
    const text = normalizeForMatch(rawText);
    for (const rule of RULES) {
      // Fresh regex per scan: a /g regex carries lastIndex between calls.
      const re = new RegExp(rule.re.source, rule.re.flags);
      let match: RegExpExecArray | null;
      while ((match = re.exec(text)) !== null) {
        violations.push({ field, pattern: rule.name, span: match[0]!, index: match.index });
      }
    }
  }
  return violations;
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
