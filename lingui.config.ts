import { defineConfig } from "@lingui/conf";
import { formatter } from "@lingui/format-po";
import { LANGS } from "./src/shared/types.ts";

/**
 * Lingui's catalogs, for the eight languages `LANGS` declares.
 *
 * THE LOCALE LIST IS READ FROM THE CODE, not typed again here. `LANGS` is what the server stores
 * and what the model answers in; a second list in a config file is the drift this repo removes
 * everywhere else it finds it.
 *
 * `.po` RATHER THAN `.json`, which is Lingui's default and the reason is the whole point of
 * adopting a framework: every translation management system reads PO, none of them reads our
 * TypeScript. It also carries a comment and a source reference per message, so a translator sees
 * where a string lives without being handed the repository.
 *
 * NO MACROS ANYWHERE. Lingui's ergonomic API (`t`, `Trans`, `msg`) is a babel/swc macro, and this
 * repo has neither — the backend runs TypeScript directly under bun and the only bundler is
 * `bun build` for the browser client. The runtime API (`i18n._`) needs no transform, so the ids
 * are explicit and `extractorBabelOptions` is irrelevant. That is a constraint worth stating
 * rather than discovering: adding babel to make a macro work would put a build step in front of
 * `bun run index.ts`, which is the thing that makes this server debuggable.
 */
export default defineConfig({
  sourceLocale: "en",
  locales: [...LANGS],
  catalogs: [
    {
      path: "<rootDir>/src/shared/locales/{locale}/messages",
      include: ["<rootDir>/src/shared", "<rootDir>/src/backend", "<rootDir>/src/frontend"],
      exclude: ["**/node_modules/**", "**/*.test.ts", "**/*.pw.ts", "**/locales/**"],
    },
  ],
  // `lineNumbers: false`: a source reference that carries a LINE makes every catalog churn
  // whenever anything above the string moves, which turns a copy review into a diff nobody
  // reads. The file path is the useful half and it is kept.
  format: formatter({ lineNumbers: false }),
  // COMPILED TO TYPESCRIPT, so the catalogs a runtime loads are typechecked like everything else
  // and `bun` can import them without a loader.
  compileNamespace: "ts",
});
