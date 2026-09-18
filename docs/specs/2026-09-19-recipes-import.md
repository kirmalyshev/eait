# Recipes — saving a dish from a link, with its macros

> Design, 2026-09-19. Status: approved in outline, not yet planned.
> The half that lives in the private monorepo (the iOS Share Extension) is named here and specified there.

## The use case

Someone watches a recipe reel on Instagram, TikTok or YouTube and wants it kept — with its
calories, protein, carbs and fat worked out, filed under breakfast / lunch / dinner / party /
kids, and shown against what is left of their day. Today they bookmark it inside the platform,
where this product cannot see it and no nutrition is attached.

## What was checked first, and what it ruled out

The original shape of the request was "poll my Instagram saved collection". That cannot be built.

| Platform | Can we read what the user saved? | Source |
|---|---|---|
| Instagram saved posts / collections | **No.** The Graph API exposes own media, insights and messaging. Saved posts are private by design and appear in no scope. The only access is reverse-engineered private-API clients, which violate the ToS and put the **user's** account at risk, not ours. | [Phyllo, 2026](https://www.getphyllo.com/post/instagram-api-integration-101-for-developers-of-the-creator-economy), [instagrapi](https://github.com/subzeroid/instagrapi/blob/master/docs/usage-guide/collection.md) |
| TikTok favourites | **No.** The Display API reads the authenticated user's own uploads (`video.list`). Liked and saved videos exist only in the Research API, which is for accredited academics. | [Scopes overview](https://developers.tiktok.com/docs/en/scopes-overview), [Research API](https://developers.tiktok.com/docs/en/research-api-specs-query-user-liked-videos) |
| YouTube | **Yes** — `relatedPlaylists.likes` and any user-created playlist read through `playlistItems.list` with OAuth. `favorites` is deprecated; watch-later and history are not in the resource at all. | [channels resource](https://developers.google.com/youtube/v3/docs/channels) |

So one platform of three permits a poll, and it is not the one that was asked about. **The input has
to leave the platform by the user's own action.** That is not a workaround; it is the only shape
available, and it is also the one that needs no OAuth provider, no Meta app review and no scheduler.

## Decisions

- **The import is a branch in `handleText`, not a connector.** A message that is nothing but a URL
  on an allowlisted host is a recipe import. Every surface that already reaches `handleText` —
  the web app, the iOS app, the Telegram bot — gets the feature from that one branch.
- **The iOS Share Extension is the share surface.** Instagram → Share → eait. It is a new target in
  the private monorepo and needs its own App Store review, which makes it the long pole on calendar
  time and a small change in code. No PWA share target in v1 (Safari does not implement it, so it
  would serve Android only).
- **`yt-dlp` does the extraction, in a sidecar.** One tool covers all three platforms —
  title, description and subtitles — instead of three integrations, two of which do not exist.
- **v1 is import, inbox, save/dismiss, categories, per-serving targets fit, and a CLI.** Logging a
  cooked recipe to the diary is deliberately out; see § Not in v1.

## Flow

```
a message that is only a URL
  → host allowlist (a regex, not a model call)
  → caps gate: recordAnalysis(userId, date, "text")
  → extractor sidecar: POST /extract {url} → {title, description, subtitles, thumbnail}
  → one model call: text → { title, servings, items[], steps }
  → totals summed from items, divided by servings, BY THE SERVER
  → row written status=proposed
  → Recipes tab shows it; the user saves it with tags, or dismisses it
```

A URL on a host that is **not** allowlisted is not refused. It falls through to `routeText` and is
handled as ordinary text, because "I ate the thing in this link" is a sentence the router already
understands and a refusal there would be a regression.

## Storage

One table. `status` is the inbox, so there is no second table for proposals; `tags` is an array, so
there is no collections table either.

```sql
create table if not exists recipes (
  id            uuid primary key,
  user_id       uuid not null references users(id) on delete cascade,
  status        text not null check (status in ('proposed','saved','dismissed')),
  title         text not null,
  source_url    text not null,
  source_platform text not null check (source_platform in ('instagram','tiktok','youtube')),
  servings      integer not null check (servings >= 1),
  items         jsonb not null,
  kcal          integer not null,
  protein_g     integer not null,
  carbs_g       integer not null,
  fat_g         integer not null,
  satfat_g      integer not null,
  fiber_g       integer not null,
  sugar_g       integer not null,
  sodium_mg     integer not null,
  steps         text,
  tags          text[] not null default '{}',
  created_at    timestamptz not null default now()
);
```

- **The numbers are PER SERVING**, and the server computes them. The model returns the dish and its
  items; dividing by servings is arithmetic, and arithmetic a model does is arithmetic nobody
  checked. Same rule that keeps `verdictsFromTargets` out of the prompt.
- **`items` is `MealItem[]` verbatim.** A recipe is a plate that has not been eaten yet; nothing new
  needs to learn what food looks like, and the meal card renderer already draws this shape.
- **No verdicts are stored.** `verdictsFromTargets` → `visibleVerdicts` runs at render, because a
  verdict describes what is left of a day and a stored one is wrong by the next morning.
- **`tags`** carries `breakfast | lunch | dinner | party | kids | favourite`, declared once as
  `RECIPE_TAGS` in `src/shared/recipes.ts`. A free-text tag is refused by the engine — two
  spellings of "dinner" is two categories the user did not ask for — and the check is in the engine
  rather than in the column, because a `text[]` constraint cannot say it without a trigger.
  **The web app imports that const by RELATIVE PATH** (`../shared/recipes.ts`), never from
  `@eait/shared`: the package specifier is types-only here, and the frontend image builds the
  bundle with no `node_modules` at all. See the note at `src/frontend/main.ts:14`.

Five store methods, each written twice (`store.pg.ts`, `store.memory.ts`) and covered by the
contract suite: `insertRecipe`, `recipesFor(userId, {status?, tag?, limit})`, `recipeFor(userId, id)`,
`patchRecipe(userId, id, patch)`, `deleteRecipe(userId, id)`. Every one scoped
`id = ? AND user_id = ?`, and a test that says another account's recipe id resolves to null.

**Merge-order dependency:** per-user RLS (#13) is not on `main` as of this writing. Whichever of the
two lands second adds `recipes` to the policy catalog in the same commit.

## Engine

`src/backend/engine/recipes.ts`:

- `importRecipe(deps, userId, url)` → `RecipeProposed | Refusal`. Runs the caps gate first, then the
  sidecar, then the model. Charged like a text turn, for the same reason a photo turn is: it spends
  a model call, and a route that spends one for free is a route that gets found.
- `recipes(deps, userId, query)`, `saveRecipe`, `dismissRecipe`, `editRecipe`, `removeRecipe` —
  thin, one store call each.

Two new refusals in `REFUSAL_STATUS` (`src/shared/contract.ts`), both needing a sentence in the web
copy and in `REFUSAL_WORDS` for Telegram:

- `not-a-recipe` → **422**. The link was fetched and held no recipe. The sibling of `not-food`.
- `extract-failed` → **502**. The link could not be fetched: private account, deleted post, the
  sidecar down, the platform having changed something. The sibling of `analysis-failed`. It is
  distinct from `not-a-recipe` because one is worth retrying and the other never is.

## LLM

One new port type in `src/backend/llm/port.ts`:

```ts
export interface RecipeInput { title: string; text: string; lang: string; onCost?: OnCost }
export interface ExtractedRecipe { isRecipe: boolean; title: string; servings: number; items: MealItem[]; steps: string }
export type ExtractRecipe = (input: RecipeInput) => Promise<ExtractedRecipe>;
```

`servings` absent or unparseable is **1**, and the card says so — a recipe silently divided by a
number the model invented is worse than a recipe not divided at all.

Per `src/backend/AGENTS.md` this is four edits, not one: the key in `PROMPT_KEYS`, the seed text in
`prompt.ts`, the key in the `llm_prompts` check constraint, and a canned implementation in
`demo.ts`. The demo one must be **as poor as the real one** — canned, but never better-shaped than
what a real model returns, or the browser suite proves something about the fake.

Model routing goes through OpenRouter as everything else here does, which on this account reaches
x-ai and Chinese vendors only.

## The extractor sidecar

A third image and a fourth compose service. `POST /extract {url}` → `{title, description, subtitles,
thumbnail}`, publishing no port.

It is separate rather than an `apk add` in `Dockerfile.backend` for two reasons, and the second is
the load-bearing one:

1. That image says, deliberately, that nothing is installed in its runtime stage — no package
   manager call, so a deploy does not depend on the Alpine CDN and there is less in the image to
   carry a CVE. `yt-dlp`'s standalone build is glibc, so Alpine means `apk add yt-dlp` and python3
   behind it.
2. **`yt-dlp` fetches attacker-influenced URLs and follows redirects anywhere.** That subprocess
   does not belong in the process holding the database handle.

Rules the sidecar is built to:

- **It holds no secrets and reaches no database.** Compose gives it a network the API can call into
  and from which Postgres is not reachable.
- **The host allowlist is enforced on BOTH sides** — in the engine before the call, and in the
  sidecar before the fetch. The sidecar is reachable from inside the Docker network, so it is its
  own trust boundary and not merely the engine's errand-runner.
- **Output is capped** before it reaches the model: title + description + subtitles truncated to
  a configured character budget (`EAIT__EXTRACTOR__MAX_CHARS`, default 12000). A 40-minute video's
  subtitle track is a prompt-injection surface and a bill.
- **One URL, never a playlist** (`--no-playlist`), a hard timeout, no cookies, non-root.
- Every knob is an environment variable through `config.ts`, like every other setting here.

## API

Contract-first: the route in `src/shared/contract.ts`, one handler in `api/routes.ts` calling one
engine function, then the client method. Five routes.

| Route | Does |
|---|---|
| `POST /v1/recipes/import` | `{url}` → the proposed recipe, or a refusal. Charged. |
| `GET /v1/recipes` | `?status=&tag=` — the inbox and the shelf are the same list, filtered. Rows carry the per-serving numbers and the title, and NOT `items` or `steps`: a shelf of fifty recipes is fifty ingredient lists nobody is reading. |
| `GET /v1/recipes/:id` | The whole row, for the detail screen. |
| `PATCH /v1/recipes/:id` | status, tags, title, servings, items. |
| `DELETE /v1/recipes/:id` | Drops it. |

`servings` on a PATCH rescales the stored per-serving numbers server-side — the client never sends
computed macros, the same way it never sends verdicts.

## Web app

A third tab beside `#/chat` and `#/diary`, with the proposed count on it. List → detail. The detail
draws the per-serving numbers, the items, the steps, and the targets-fit verdicts computed at
render. Save with category chips, or dismiss. Vanilla, `el()`, `textContent`, no dependency.

## CLI

`src/scripts/recipes.ts`, in the `prompts.ts` idiom — through the engine, never the table, so the
gate and the provenance are identical whichever surface a person uses.

```
bun src/scripts/recipes.ts import <url> [--user <id>]
bun src/scripts/recipes.ts list [--user <id>] [--status proposed]
./dev recipes <command>
```

Its purpose is exercising the extractor and the prompt without a phone in the loop.

## Testing

- The URL branch: a message that is only an allowlisted link imports; a link with words around it
  routes as text; a link on an unknown host routes as text. No model call in any of the three.
- The caps gate: an import past the sample refuses with `subscription-required` **before** the
  sidecar is called, and spends nothing.
- Per-serving arithmetic: a four-serving recipe stores a quarter of the total, and a PATCH to two
  servings doubles what is stored.
- Scoping: another account's recipe id resolves to null on read, patch and delete.
- Store contract suite over both implementations, as every other table here.
- One browser spec: import → inbox → save with a category → it is on the shelf. Against the demo
  model, so it needs no network.

## Not in v1

- **Cook it → log to the diary.** `POST /v1/recipes/:id/log` writing a meal from the stored items,
  no model call. Deliberately deferred; it is what makes the feature feed the diary, and it is the
  first thing to add.
- **A YouTube playlist poll.** The one platform where a real poll is permitted. Wants Google OAuth,
  a token store and a scheduler — its own change, worth doing once imports are proven.
- **The Instagram Messaging webhook** — sharing a reel to eait inside Instagram DMs. The closest
  thing to the original request that can be built legitimately. Needs an IG business account and
  Meta app review for `instagram_manage_messages`.
- **Delivery receipts (Wolt, Uber Eats, Lieferando).** Neither has a consumer order-history API —
  both developer programmes are merchant-side, and every consumer tool in the wild works by taking
  the user's session token. The legitimate channel is the receipt email: one inbound address, one
  parse, and every delivery app is covered including ones nobody has integrated. It needs an
  `InboundMail` port (`src/backend/mail/` is outbound-only today) and carries its own privacy
  weight, so it gets its own spec. Note for that spec: **ordering is not eating** — a receipt must
  produce a proposal, never a logged meal.
- **A Web Share Target for the PWA.** Android only; revisit if Android becomes a surface.
