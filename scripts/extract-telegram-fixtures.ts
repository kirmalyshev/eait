// MANUAL dev tool. Hits the Telegram Bot API. Spends no LLM money.
//
// Recovers the photos behind already-logged meals and writes them as eval fixtures, because the
// diary is the only source of ground truth in the principal's own cuisine that does not require a
// kitchen scale.
//
//   bun run scripts/extract-telegram-fixtures.ts [--dir eval/telegram] [--user <id>]
//     [--limit 50] [--corrected-only] [--dry-run]
//
// HOW IT GETS THE PHOTOS, AND WHY IT LOOKS LIKE THIS. The bot stores no image and no file_id — the
// runtime is ephemeral by design and stays that way; this script changes no bot code path. What IS
// stored is `meals.user_message_id`, and the Bot API cannot read chat history, so the only route to
// the original photo is to forward that message somewhere the bot can see the file_id. It forwards
// to the ADMIN chat, downloads the bytes, and DELETES the forwarded copy immediately. Collect,
// process, delete — nothing accumulates in the chat, and the only lasting artefact is the fixture
// in a gitignored directory.
//
// EVERY MEAL BY DEFAULT, BUT SORTED BY WHAT ITS LABELS ARE WORTH. The photos are the valuable part
// and are worth having regardless of label quality — the self-consistency and vote-margin
// experiments need no labels at all, and an unlabelled photo of real food is still a labelling
// queue. But the labels are not equal, so they are not mixed:
//
//   <dir>/            corrected meals   — NAMES checked by the person who ate it. Real (if
//                                         unweighed) identification ground truth.
//   <dir>-unverified/ everything else   — names AND numbers came from the model. Scoring that
//                                         model against them measures agreement with an earlier
//                                         run of itself, and reads as near-perfect. NOT truth.
//
// One directory produces one aggregate, which is exactly why these cannot share one. Each fixture
// also carries its own `groundTruth` provenance, so the distinction survives a file being moved.
// `--corrected-only` skips the unverified set entirely.

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseArgv } from "../src/argv.ts";
import { storedMealToExpectation } from "../src/eval.ts";
import { loadConfig } from "../src/config.ts";
import { openDb } from "../src/db.ts";

const fail = (msg: string): never => {
  console.error(msg);
  process.exit(2);
};

const argv = parseArgv(process.argv.slice(2), {
  valued: ["dir", "user", "limit"],
  boolean: ["corrected-only", "dry-run"],
});
const flag = (name: string) => argv.flags.has(name);
const value = (name: string): string | undefined => argv.values[name];

const dir = value("dir") ?? "eval/telegram";
const limit = Number(value("limit") ?? "50");
if (!Number.isInteger(limit) || limit < 1) fail("--limit must be a positive integer");
const onlyUser = value("user") === undefined ? null : Number(value("user"));
if (onlyUser !== null && !Number.isInteger(onlyUser)) fail("--user must be a Telegram id");

const config = loadConfig(process.env);
if (!config.adminUserId) {
  fail("ADMIN_USER_ID must be set — forwarded photos are routed there and deleted immediately");
}
const admin = config.adminUserId;
const api = (method: string) => `https://api.telegram.org/bot${config.telegramBotToken}/${method}`;

async function tg(method: string, body: unknown): Promise<any> {
  const res = await fetch(api(method), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as { ok: boolean; result?: unknown; description?: string };
  // Never interpolate the response wholesale into an error: a Telegram error body echoes the
  // request, and the request contains the bot token in the URL only, but keeping the habit strict
  // costs nothing.
  if (!json.ok) throw new Error(`${method}: ${json.description ?? "failed"}`);
  return json.result;
}

const env = process.env;
const db = await openDb({
  host: env.PGHOST?.trim() || "127.0.0.1",
  port: Number(env.PGPORT) || 5439,
  user: env.PGUSER?.trim() || "eait",
  password: env.PGPASSWORD?.trim() || "eait",
  database: env.PGDATABASE?.trim() || "eait",
});
const rows = await db`
  SELECT id, user_id, chat_id, user_message_id, items, kcal, protein_g, carbs_g, fat_g, corrected
  FROM meals
  WHERE user_message_id IS NOT NULL AND chat_id IS NOT NULL
    ${onlyUser === null ? db`` : db`AND user_id = ${onlyUser}`}
    ${flag("corrected-only") ? db`AND corrected = 1` : db``}
  ORDER BY ts DESC LIMIT ${limit}`;

if (rows.length === 0) {
  console.log(
    flag("corrected-only")
      ? "no CORRECTED meals with a recoverable user message — correct a few meals first, or drop --corrected-only"
      : "no meals with a recoverable user message",
  );
  process.exit(0);
}

const unverifiedDir = `${dir}-unverified`;
const correctedCount = rows.filter((r: any) => r.corrected === 1).length;
console.log(
  `${rows.length} candidate meal(s): ${correctedCount} corrected → ${dir}, ` +
    `${rows.length - correctedCount} unverified → ${unverifiedDir}` +
    (flag("dry-run") ? "  [DRY RUN — nothing forwarded, nothing written]" : ""),
);
if (flag("dry-run")) {
  for (const r of rows) {
    const items = (JSON.parse(r.items ?? "[]") as { name: string }[]).map((i) => i.name);
    const mark = r.corrected === 1 ? "corrected " : "unverified";
    console.log(`  ${mark}  ${r.id}  user=${r.user_id}  ${r.kcal} kcal  ${items.join(", ")}`);
  }
  process.exit(0);
}

let written = 0;
let writtenUnverified = 0;
let noPhoto = 0;
let failed = 0;

for (const r of rows) {
  let forwardedId: number | undefined;
  try {
    const fwd = await tg("forwardMessage", {
      chat_id: admin,
      from_chat_id: Number(r.chat_id),
      message_id: Number(r.user_message_id),
      disable_notification: true,
    });
    forwardedId = fwd.message_id as number;

    // Largest PhotoSize at or under Telegram's 1280 long edge — the same ceiling the analyzer sees
    // in production. Evaluating on a larger image would measure a bot we do not ship.
    const sizes = (fwd.photo ?? []) as { file_id: string; width: number; height: number }[];
    if (sizes.length === 0) {
      noPhoto++;
      continue;
    }
    const best = sizes
      .slice()
      .sort((a, b) => Math.max(b.width, b.height) - Math.max(a.width, a.height))
      .find((s) => Math.max(s.width, s.height) <= 1280) ?? sizes[0]!;

    const file = await tg("getFile", { file_id: best.file_id });
    const url = `https://api.telegram.org/file/bot${config.telegramBotToken}/${file.file_path}`;
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer());

    const corrected = r.corrected === 1;
    const expectation = storedMealToExpectation(
      {
        items: JSON.parse(r.items ?? "[]"),
        kcal: Number(r.kcal),
        protein_g: r.protein_g === null ? undefined : Number(r.protein_g),
        carbs_g: r.carbs_g === null ? undefined : Number(r.carbs_g),
        fat_g: r.fat_g === null ? undefined : Number(r.fat_g),
      },
      corrected,
    );
    // Created on demand rather than up front, so a run that finds only one kind does not leave an
    // empty directory that later reads as "we looked and there was nothing".
    const target = corrected ? dir : unverifiedDir;
    if (!existsSync(target)) mkdirSync(target, { recursive: true });

    // JSON first and exclusively, as in add-fixture.ts: the json write is the atomic claim on the
    // stem, so two runs cannot both believe they own it and leave one photo orphaned.
    const stem = String(r.id);
    writeFileSync(join(target, `${stem}.json`), `${JSON.stringify(expectation)}\n`, { flag: "wx" });
    writeFileSync(join(target, `${stem}.jpg`), bytes);
    if (corrected) written++;
    else writtenUnverified++;
  } catch (e) {
    // An already-extracted meal (wx on an existing stem) and a message the user has since deleted
    // both land here, and neither is worth aborting a batch for.
    failed++;
    console.warn(`  skip ${r.id}: ${e instanceof Error ? e.message : String(e)}`);
  } finally {
    // The delete runs even when the download failed — a forwarded copy left sitting in the admin
    // chat is exactly the accumulation this script exists to avoid.
    if (forwardedId !== undefined) {
      await tg("deleteMessage", { chat_id: admin, message_id: forwardedId }).catch((e) =>
        console.warn(`  WARNING: forwarded copy ${forwardedId} not deleted: ${e.message}`),
      );
    }
  }
}

console.log(
  `wrote ${written} corrected → ${dir}, ${writtenUnverified} unverified → ${unverifiedDir}` +
    (noPhoto ? `; ${noPhoto} had no photo (text meal)` : "") +
    (failed ? `; ${failed} skipped` : ""),
);
console.log(
  `\n${dir}: item NAMES were checked by the person who ate the meal. The macros were NOT weighed,\n` +
    "  so score identification against these and never average their kcal into an accuracy metric.\n" +
    `${unverifiedDir}: names AND numbers came from the model. These are NOT ground truth — scoring\n` +
    "  the model against them measures agreement with an earlier run of itself. Use them for the\n" +
    "  experiments that need no labels, or as a queue to label by hand.",
);
await db.close();
