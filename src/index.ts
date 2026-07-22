// Entrypoint: env → config → db → bot (long-polling via @grammyjs/runner).
import { loadConfig } from "./config.ts";
import { startBot } from "./tg_bot/bot.ts";

// A misconfiguration (missing env var, unknown LLM_PROVIDER, unreachable Postgres) throws
// here. Under a supervisor with a short restart interval this would loop forever — print one
// readable line instead of a stack trace repeated every 10 seconds in the error log.
try {
  const config = loadConfig(process.env);
  await startBot(config);
  // "starting", not "started": startBot returns as soon as polling is scheduled, before the
  // first getUpdates round-trip. Claiming success here would print a reassuring line even
  // when the token is wrong and the supervisor is about to give up.
  console.log(`eait starting · model=${config.llmModel} · db=${config.pg.database}`);
} catch (e) {
  console.error(`[eait] startup failed: ${(e as Error)?.message ?? e}`);
  process.exit(1);
}
