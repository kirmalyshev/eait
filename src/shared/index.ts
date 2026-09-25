// The shared package's public surface. The backend and the app import from HERE and from nowhere
// deeper — that is the whole contract, and it is what keeps them peers rather than one being a
// special case of the other.

export * from "./types.ts";
export * from "./targets.ts";
export * from "./projection.ts";
export * from "./results.ts";
export * from "./onboarding.ts";
export * from "./onboarding-chat-copy.ts";
export * from "./first-meal-copy.ts";
export * from "./onboarding-content.ts";
export * from "./onboarding-chat.ts";
export * from "./contract.ts";
export * from "./perf.ts";
export * from "./dates.ts";
export * from "./health.ts";
export * from "./health-copy.ts";
export * from "./trend.ts";
export * from "./entitlement.ts";
export * from "./chat.ts";
export * from "./chat-copy.ts";
export * from "./lang.ts";
// The Lingui runtime. Exported because copy is migrating OUT of the `Localized<T>` tables and into
// the catalogs: a module that renders a migrated string needs `i18nFor`, and it may not reach past
// this barrel to get it.
export * from "./i18n.ts";
export * from "./verdicts.ts";
export * from "./thread.ts";
export * from "./chat-core.ts";
export * from "./notifications.ts";
export * from "./claims.ts";
export * from "./stream.ts";
export * from "./typing.ts";
export * from "./budget.ts";
export * from "./outbox.ts";
// THE DESIGN SYSTEM (#28). Exported from the barrel AND available as `@eait/shared/design`: the
// subpath is for the two readers that must not pull the barrel in — `app.config.ts`, which runs
// under Node inside Expo's config loader, and the app's own `palette.ts`, which imports nothing
// that touches react-native.
export * from "./design.ts";
