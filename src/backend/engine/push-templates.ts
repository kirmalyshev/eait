/**
 * Push templates: seed, edit, review, and the one door a sender goes through (ieat-app#1758).
 * The rules are `shared/push-templates.ts`; this is the store round-trip around them.
 */
import {
  LANGS, NOTIFICATION_IDS, PUSH_TEMPLATE_VARIANTS, copyFromPushRows, pickVariant, pushClaimErrors,
  pushKeyGaps, pushRowsFromCopy, validatePushTemplate,
  type CampaignTemplateKey, type Lang, type NotificationCopy, type NotificationId, type PushTemplateRow, type PushTemplateText,
} from "@eait/shared";
import type { Store } from "../store.ts";
import type { EngineDeps } from "./deps.ts";
import { notificationCopy } from "./notify.ts";

const MIGRATION = "migration";
const seeded = new WeakSet<Store>();

/**
 * Migrate the shipped (and admin-saved) notification copy in as `reviewed`.
 *
 * Insert-if-absent, so it is idempotent, race-safe between replicas and can never take back an
 * edit. Lazy — called by every reader — rather than on boot, so a store that never sends a push
 * never grows rows and "has anybody edited this?" is still a question the rows answer.
 */
export async function ensurePushTemplates(deps: EngineDeps): Promise<void> {
  // Once per process per store: the rows it would insert are all already there after the first
  // call, and a sweep calls this per user. Another replica seeding first is harmless (do nothing).
  if (seeded.has(deps.store)) return;
  const now = new Date().toISOString();
  const rows: PushTemplateRow[] = [];
  for (const lang of LANGS) {
    for (const t of pushRowsFromCopy(lang, await notificationCopy(deps, lang))) {
      // The migrated words go through the same gate as every save: an old admin edit that the
      // gate refuses comes in as a DRAFT (the key then blocks and says so), never as reviewed.
      const ok = validatePushTemplate(t).ok && pushClaimErrors(t.title, t.body).length === 0;
      if (!ok) console.warn(`push template ${t.key}/${t.lang}/${t.variant} fails the gate; migrated as draft`);
      rows.push({
        ...t, status: ok ? "reviewed" : "draft",
        reviewed_by: ok ? MIGRATION : null, reviewed_at: ok ? now : null, updated_at: now,
      });
    }
  }
  await deps.store.seedPushTemplates(rows);
  // Rows seeded before the empty variant lost its title (61d2a13) still carry one the sender never
  // reads. Strip it, keeping status and review fields as they are.
  for (const r of await deps.store.listPushTemplates()) {
    if (r.variant === "empty" && r.title !== "") await deps.store.putPushTemplate({ ...r, title: "" });
  }
  seeded.add(deps.store);
}

export interface PushTemplateListing {
  rows: PushTemplateRow[];
  /** Per key: what stops it being sent. Empty = usable. */
  keys: { key: NotificationId; variants: readonly string[]; gaps: string[] }[];
}

export async function listPushTemplates(deps: EngineDeps): Promise<PushTemplateListing> {
  await ensurePushTemplates(deps);
  const rows = await deps.store.listPushTemplates();
  return {
    rows,
    keys: NOTIFICATION_IDS.map((key) => ({ key, variants: PUSH_TEMPLATE_VARIANTS[key], gaps: pushKeyGaps(rows, key) })),
  };
}

export type SavePushTemplateResult = { ok: true; row: PushTemplateRow } | { ok: false; errors: string[] };

/**
 * Save one template. `draft` validates structure only (placeholders, plurals, lengths).
 * `reviewed` also runs the claims gate and refuses on a failure — nothing reaches a lock screen
 * without having passed it. Any save puts the row in the status asked for, so an edited text is
 * never silently still "reviewed" under words nobody reviewed.
 */
export async function savePushTemplate(
  deps: EngineDeps,
  input: unknown,
  status: unknown,
  actor: string,
): Promise<SavePushTemplateResult> {
  if (status !== "draft" && status !== "reviewed") return { ok: false, errors: ['status must be "draft" or "reviewed"'] };
  const checked = validatePushTemplate(input as Record<string, unknown>);
  if (!checked.ok) return checked;
  const t = input as PushTemplateText;
  if (status === "reviewed") {
    const claims = pushClaimErrors(t.variant === "default" ? t.title : "", t.body);
    if (claims.length > 0) return { ok: false, errors: claims };
  }
  const now = new Date().toISOString();
  const row: PushTemplateRow = {
    key: t.key, lang: t.lang, variant: t.variant, title: t.variant === "default" ? t.title : "", body: t.body, status,
    reviewed_by: status === "reviewed" ? actor : null,
    reviewed_at: status === "reviewed" ? now : null,
    updated_at: now,
  };
  await ensurePushTemplates(deps); // so an edit is never the first row and then seeded around
  await deps.store.putPushTemplate(row);
  return { ok: true, row };
}

/** Mark an existing draft reviewed, unchanged — through the same gate as a save. */
export async function reviewPushTemplate(
  deps: EngineDeps,
  id: { key: unknown; lang: unknown; variant: unknown },
  actor: string,
): Promise<SavePushTemplateResult> {
  await ensurePushTemplates(deps);
  const found = (await deps.store.listPushTemplates()).find(
    (r) => r.key === id.key && r.lang === id.lang && r.variant === id.variant,
  );
  if (!found) return { ok: false, errors: ["no such template"] };
  return savePushTemplate(deps, found, "reviewed", actor);
}

/**
 * The copy a sender may use for `key` in `lang`, or null when the key is incomplete.
 *
 * Null means REFUSE: a key with a missing or draft language is not sent to anybody, in any
 * language, because the fallback to English is allowed only for a template that is complete (and
 * then every language has its own row, so it never fires). The other keys' copy is returned
 * untouched — this overlays one key's reviewed rows on the account's language, nothing else.
 */
export async function sendableCopy(
  deps: EngineDeps,
  key: NotificationId,
  lang: Lang,
): Promise<NotificationCopy | null> {
  await ensurePushTemplates(deps);
  const rows = await deps.store.listPushTemplates();
  const gaps = pushKeyGaps(rows, key);
  if (gaps.length > 0) {
    console.warn(`push template "${key}" is not sendable: ${gaps.join(", ")}`);
    return null;
  }
  return copyFromPushRows(rows.filter((r) => r.key === key), lang, await notificationCopy(deps, lang));
}

/**
 * Rotation: the variant for this user, not used for them in the last 7 days.
 *
 * `uses` is a port so tests can hand it a fixed history; `sendLogUses` is the real reader, over
 * phase 1's `send_log` (#1765): this user's recent sends of this template key, by variant.
 */
export type VariantUses = (userId: string, key: NotificationId) => Promise<{ variant: string; sentAt: number }[]>;

export const sendLogUses = (deps: EngineDeps): VariantUses => async (userId, key) =>
  (await deps.store.sendLogFor(userId, 200))
    .filter((r) => r.templateKey === key && r.variant !== null)
    .map((r) => ({ variant: r.variant as string, sentAt: Date.parse(r.createdAt) }));

export async function rotatedVariant(
  userId: string,
  key: NotificationId,
  uses: VariantUses,
  now: number,
  among: readonly string[] = PUSH_TEMPLATE_VARIANTS[key],
): Promise<string> {
  return pickVariant(among, await uses(userId, key), now);
}

/**
 * A campaign's words for one account: the row of its own `campaign:<slug>` key for the account's
 * language and the variant it was assigned, or null while any language of any variant the campaign
 * RUNS (`variantCount`) is missing or still a draft. Null means REFUSE, as for a system key: half of a
 * translated set on a lock screen is worse than silence. No placeholders, so there is nothing to fill.
 */
export async function campaignWords(
  deps: EngineDeps, key: CampaignTemplateKey, lang: Lang, variant: string, variantCount: number,
): Promise<{ title: string; body: string } | null> {
  const rows = (await deps.store.listPushTemplates()).filter((r) => r.key === key);
  if (pushKeyGaps(rows, key, variantCount).length > 0) return null;
  const row = rows.find((r) => r.lang === lang && r.variant === variant);
  return row ? { title: row.title, body: row.body } : null;
}
