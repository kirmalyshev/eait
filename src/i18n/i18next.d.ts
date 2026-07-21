// Type-level contract for `t()`. Augmenting CustomTypeOptions with the reference locale makes
// an unknown key a COMPILE error rather than a runtime surprise.
//
// What this does NOT give you: typed interpolation arguments. `resolveJsonModule` widens JSON
// string values to `string`, so i18next cannot infer `{{placeholder}}` names from the literal.
// `i18n.test.ts` covers that gap with a placeholder-parity test — do not delete it.

import type en from "./locales/en.json";

declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: { translation: typeof en };
  }
}
