// Entrypoint: env → config → db → bot (long-polling via @grammyjs/runner).
import { loadConfig } from "./config.ts";
import { startBot } from "./bot.ts";

const config = loadConfig(process.env);
startBot(config);
console.log(`eait started · model=${config.llmModel} · db=${config.dbPath}`);
