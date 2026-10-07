/**
 * Push copy as reviewed, per-language templates (ieat-app#1758, phase 2 of #1754).
 *
 * A row is `(key, lang, variant)` with a status. A key may be SENT only when every language in
 * `LANGS` has a `reviewed` row for every variant the key declares — one half-translated key is a
 * Russian lock screen in English, delivered unasked and unrecallable. The rules live here, pure,
 * so the store, the engine and the admin all read one definition.
 *
 * Not in the Lingui catalogs, for the reason `notifications.ts` gives: these are admin-editable
 * and `{eaten}` is the product's placeholder syntax and ICU's at once.
 */
import { lintCopy } from "./claims.ts";
import { genderedRussian } from "./lang.ts";
import {
  MAX_NOTIFICATION_BODY, MAX_NOTIFICATION_TITLE, NOTIFICATION_IDS, NOTIFICATION_PLACEHOLDERS,
  type NotificationCopy, type NotificationId,
} from "./notifications.ts";
import { LANGS, type Lang } from "./types.ts";

export type PushTemplateStatus = "draft" | "reviewed";

export interface PushTemplateRow {
  key: NotificationId;
  lang: Lang;
  variant: string;
  title: string;
  body: string;
  status: PushTemplateStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  updated_at: string;
}

/** What an admin edits: a row without its review bookkeeping. */
export type PushTemplateText = Pick<PushTemplateRow, "key" | "lang" | "variant" | "title" | "body">;

/**
 * The variants each key declares. `empty` is the evening line for a day with nothing logged — a
 * variant picked by a CONDITION, not by rotation. Adding a variant here makes every host's key
 * incomplete in all eight languages until it is written and reviewed, which is the point.
 */
export const PUSH_TEMPLATE_VARIANTS: Record<NotificationId, readonly string[]> = {
  "trial-end": ["default"],
  evening: ["default", "empty"],
  nudge: ["default"],
};

/** A variant's body is the `emptyBody` field of the legacy `NotificationCopy`. */
const bodyField = (variant: string): string => (variant === "empty" ? "emptyBody" : "body");

/** The plural categories a language needs, from CLDR. Server-side only: Hermes has no PluralRules. */
export function pluralCategories(lang: Lang): string[] {
  return new Intl.PluralRules(lang).resolvedOptions().pluralCategories as string[];
}

/** A balanced `{…}` starting at `from`, or null. Returns the inner text and the index after it. */
function braced(text: string, from: number): { inner: string; end: number } | null {
  if (text[from] !== "{") return null;
  let depth = 0;
  for (let i = from; i < text.length; i++) {
    if (text[i] === "{") depth++;
    else if (text[i] === "}" && --depth === 0) return { inner: text.slice(from + 1, i), end: i + 1 };
  }
  return null;
}

/**
 * Check one string: every `{name}` is in `allowed`, every `{n, plural, …}` has exactly the
 * categories `lang` has and an `other`. Returns every problem. The plural argument must itself be
 * in `allowed` — nothing else fills it.
 */
export function validatePushText(text: string, lang: Lang, allowed: readonly string[]): string[] {
  return scan(text, lang, allowed).errors;
}

function scan(
  text: string, lang: Lang, allowed: readonly string[],
): { errors: string[]; used: Set<string> } {
  const errors: string[] = [];
  const used = new Set<string>();
  const need = pluralCategories(lang);
  const use = (name: string) => {
    used.add(name);
    if (!allowed.includes(name)) errors.push(`{${name}} is not filled here`);
  };
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "}") { errors.push("unbalanced }"); continue; }
    if (text[i] !== "{") continue;
    const b = braced(text, i);
    if (!b) { errors.push("unbalanced {"); break; }
    i = b.end - 1;
    const plural = /^\s*(\w+)\s*,\s*plural\s*,([\s\S]*)$/.exec(b.inner);
    if (plural) {
      use(plural[1]!);
      const seen: string[] = [];
      const rest = plural[2]!;
      for (let j = 0; j < rest.length; j++) {
        if (/\s/.test(rest[j]!)) continue;
        const cat = /^\w+/.exec(rest.slice(j))?.[0];
        if (!cat) { errors.push("malformed plural block"); break; }
        j += cat.length;
        while (/\s/.test(rest[j] ?? "")) j++;
        const opt = braced(rest, j);
        if (!opt) { errors.push(`plural category "${cat}" has no {text}`); break; }
        j = opt.end - 1;
        seen.push(cat);
        const inner = scan(opt.inner, lang, allowed);
        errors.push(...inner.errors);
        inner.used.forEach((u) => used.add(u));
      }
      if (!seen.includes("other")) errors.push(`plural on {${plural[1]}} has no "other"`);
      for (const c of need) if (!seen.includes(c)) errors.push(`plural on {${plural[1]}} is missing "${c}" for ${lang}`);
      for (const c of seen) if (!need.includes(c) && c !== "other") errors.push(`plural on {${plural[1]}}: ${lang} has no "${c}"`);
    } else if (/^\w+$/.test(b.inner)) {
      use(b.inner);
    } else {
      errors.push(`"{${b.inner}}" is not a placeholder`);
    }
  }
  return { errors, used };
}

export type PushValidation = { ok: true } | { ok: false; errors: string[] };

/**
 * Structure of a template: a key and variant this product has, lengths, and placeholders against
 * the declared set (each declared one MUST appear). Runs on every save, draft or not. The claims
 * gate is `pushClaimErrors` and runs when a template is marked reviewed.
 */
export function validatePushTemplate(input: PushTemplateText | Record<string, unknown>): PushValidation {
  const t = input as Record<string, unknown>;
  const errors: string[] = [];
  const { key, lang, variant, title, body } = t;
  if (typeof key !== "string" || !(NOTIFICATION_IDS as readonly string[]).includes(key)) {
    return { ok: false, errors: [`"${String(key)}" is not a message this product sends`] };
  }
  if (typeof lang !== "string" || !(LANGS as readonly string[]).includes(lang)) {
    return { ok: false, errors: [`"${String(lang)}" is not a language this product speaks`] };
  }
  const variants = PUSH_TEMPLATE_VARIANTS[key as NotificationId];
  if (typeof variant !== "string" || !variants.includes(variant)) {
    return { ok: false, errors: [`${key} has no variant "${String(variant)}"`] };
  }
  const fields: [string, unknown, string, number][] = [];
  // Only the default variant has a title; the others are sent under it.
  if (variant === "default") fields.push(["title", title, `${key}.title`, MAX_NOTIFICATION_TITLE]);
  else if (title !== undefined && title !== "") errors.push(`${variant} has no title of its own`);
  fields.push(["body", body, `${key}.${bodyField(variant)}`, MAX_NOTIFICATION_BODY]);
  for (const [name, value, declaredAt, max] of fields) {
    if (typeof value !== "string" || value.trim() === "") { errors.push(`${name} is required`); continue; }
    if (value.length > max) errors.push(`${name} is over ${max} characters`);
    const declared = NOTIFICATION_PLACEHOLDERS[declaredAt] ?? [];
    const { errors: textErrors, used } = scan(value, lang as Lang, declared);
    errors.push(...textErrors.map((e) => `${name}: ${e}`));
    for (const d of declared) if (!used.has(d)) errors.push(`${name} is missing {${d}}`);
  }
  return errors.length === 0 ? { ok: true } : { ok: false, errors };
}

/**
 * No health VALUE in push text: a figure beside a unit is a reading of somebody's body on a lock
 * screen. A `{placeholder}` is not one — the composer fills it, and only for the account's own
 * subscriber. Digits with a unit, literal, in any of the eight spellings that matter.
 */
const UNITS = [
  // energy: kcal, calories, Kalorien, calorías, калорий, kilocalories, vi "calo"
  "kcal", "kilocal\\p{L}*", "calo\\p{L}*", "kalo\\p{L}*", "cal", "ккал", "кал\\p{L}*",
  // mass: kg, kilo, g, gram(s)/Gramm/gramos/grammes, кг, г, грамм, lb(s)/pounds/libras/livres/Pfund/фунт
  "kg", "kilo(?:s|gram\\p{L}*)?", "кг", "килограмм\\p{L}*", "g", "gr", "gram\\p{L}*", "г", "гр", "грамм\\p{L}*",
  "lbs?", "pounds?", "libras?", "livres?", "pfund\\p{L}*", "фунт\\p{L}*",
  // clinical
  "%", "mmhg", "mg\\/dl", "mmol", "bpm",
];
const HEALTH_VALUE = new RegExp(
  "\\d(?:[\\d.,\\u00a0\\u202f ]*\\d)?\\s?(?:" + UNITS.join("|") + ")(?![\\p{L}])", "iu",
);

/** Claims-gate problems for one template's words — the landing's rules plus the value rule. */
export function pushClaimErrors(title: string, body: string): string[] {
  const errors = lintCopy({ title, body }).map((v) => `${v.field}: "${v.span}" is a ${v.pattern} claim`);
  // Russian past tense and short adjectives agree with the reader's gender and have no neutral
  // form. Needs no `lang`: nothing but Russian has Cyrillic. Admin-typed Russian replaces the
  // compiled-in tables for every user, so the build-time guard alone does not cover it.
  for (const g of genderedRussian({ title, body })) {
    errors.push(`${g.at} tells a Russian reader their gender ("${g.text}") — Russian past tense`
      + " and short adjectives agree, so this greets half your readers as the wrong person");
  }
  for (const [field, text] of [["title", title], ["body", body]] as const) {
    const m = HEALTH_VALUE.exec(text);
    if (m) errors.push(`${field}: "${m[0].trim()}" is a health value`);
  }
  return errors;
}

/**
 * What stops `key` from being sent: one `lang/variant` per row that is absent or still a draft.
 * Empty means complete.
 */
export function pushKeyGaps(rows: readonly PushTemplateRow[], key: NotificationId): string[] {
  const gaps: string[] = [];
  for (const lang of LANGS) {
    for (const variant of PUSH_TEMPLATE_VARIANTS[key]) {
      const row = rows.find((r) => r.key === key && r.lang === lang && r.variant === variant);
      if (row?.status !== "reviewed") gaps.push(`${lang}/${variant}`);
    }
  }
  return gaps;
}

/** One language's legacy `NotificationCopy` as template rows (text only). */
export function pushRowsFromCopy(lang: Lang, copy: NotificationCopy): PushTemplateText[] {
  const out: PushTemplateText[] = [];
  for (const key of NOTIFICATION_IDS) {
    const m = copy[key];
    out.push({ key, lang, variant: "default", title: m.title, body: m.body });
    // The empty-day body is sent under the default title (one `NotificationMessage.title`), so
    // this variant carries none: a title field here would be edited and never read.
    if (m.emptyBody !== undefined) out.push({ key, lang, variant: "empty", title: "", body: m.emptyBody });
  }
  return out;
}

/** The inverse: template rows over `base` (a missing row keeps `base`'s words). */
export function copyFromPushRows(
  rows: readonly Pick<PushTemplateRow, "key" | "lang" | "variant" | "title" | "body">[],
  lang: Lang,
  base: NotificationCopy,
): NotificationCopy {
  const out = { ...base };
  for (const key of NOTIFICATION_IDS) {
    const find = (variant: string) => rows.find((r) => r.key === key && r.lang === lang && r.variant === variant);
    const d = find("default");
    const e = find("empty");
    out[key] = {
      ...base[key],
      ...(d ? { title: d.title, body: d.body } : {}),
      ...(e ? { emptyBody: e.body } : {}),
    };
  }
  return out;
}

export const PUSH_ROTATION_DAYS = 7;

/**
 * A variant not sent to this user in the last 7 days; when all were, the least recently sent.
 * `uses` come from `send_log` (phase 1) through a port — this function reads nothing.
 */
export function pickVariant(
  variants: readonly string[],
  uses: readonly { variant: string; sentAt: number }[],
  now: number,
): string {
  const cutoff = now - PUSH_ROTATION_DAYS * 86_400_000;
  const last = (v: string) => Math.max(-Infinity, ...uses.filter((u) => u.variant === v).map((u) => u.sentAt));
  const fresh = variants.find((v) => last(v) < cutoff);
  if (fresh !== undefined) return fresh;
  return [...variants].sort((a, b) => last(a) - last(b))[0]!;
}
