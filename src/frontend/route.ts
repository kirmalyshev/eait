// The route table's one piece of string arithmetic — DOM-free on purpose, the way `portion.ts`
// is, so the bun half of this workspace (`test/`, `types: []`) can reach it.

/**
 * The hash without its query — `#/chat?focus=<id>` is Chat (the meal-focus handoff, #93, and the
 * log surface's Edit/Correct, #92). The screen registry and the tab row both look up by this, so
 * a query only ever carries context, never a second route.
 */
export const routeBase = (route: string): string => route.split("?")[0]!;

/**
 * A page URL as an analytics event may carry it: origin and path only. The hash is the route and
 * names a meal by its id (`#/meal/<id>`), and the query carries ids too (`?focus=<id>`).
 */
export const pageUrl = (url: string): string => url.split(/[?#]/)[0]!;
