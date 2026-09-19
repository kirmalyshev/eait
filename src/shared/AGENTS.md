# AGENTS.md — shared

> This workspace also lives inside a private monorepo (the app, the web client, the landing, the deploy tree). Paths such as `src/mobile/…`, `docs/…`, `scripts/…`, `deploy/…` and `#NNN` issue references point there; the rules they support hold here regardless.

The contract both sides implement. Root `AGENTS.md` covers the repo; this covers this workspace.

**It may not import from `backend` or `src/mobile`.** A dependency in either direction makes it
a third implementation instead of the agreement between two.

## What lives here, and why it is here rather than on one side

| file | it is here because |
|---|---|
| `contract.ts` | routes, request/response types, the refusal→status map. Change an endpoint and both sides break together, which is the point. |
| `types.ts` | `Profile`, `MealAnalysis`, `MealRecord`, the verdict vocabulary. |
| `targets.ts` | the calorie target and **the floor**. Read its header before touching any of it. |
| `dates.ts` | calendar maths in a named zone. The phone aggregates health into days, so both sides compute dates. |
| `health.ts` | `HEALTH_FIELDS` + `aggregateDays`. Day attribution is tested with no simulator. |
| `trend.ts` | a daily series by day/week/month/year, and Pearson between two of them. Every number on a health chart. |
| `onboarding.ts`, `onboarding-chat.ts` | the question set and the branch logic. |
| `lang.ts` | `Localized<T>`, `t(lang)`, `LANGS_READY`, the two number formatters, and `localizedGaps`. |
| `onboarding-content.ts`, `onboarding-chat-copy.ts`, `chat-copy.ts`, `health-copy.ts`, `verdicts.ts` | the WORDS, keyed by language. The rules stay in the file beside each. |
| `perf.ts` | `PERF_SCREENS` and every screen's budget. |
| `entitlement.ts`, `chat.ts`, `thread.ts`, `projection.ts`, `claims.ts`, `notifications.ts` | same rule: one definition, two consumers. |
| `outbox.ts` | the turns a client could not send (#708): the order, the holds, and what is retried under the same id. The phone and the browser persist it; this decides it. |

Everything is exported through `index.ts` (`export *`), so a new export needs no wiring.

## Invariants a reviewer should check first

- **A limit the server enforces is SENT, never compiled into both sides.** `Limits` is the carrier
  and `configDefaults()` the source. A constant here that also exists as a server bound is two
  numbers that will eventually disagree — and the user meets that as a refusal after they have
  already acted. `MAX_UPLOAD_BYTES`, `MAX_PHOTOS_PER_MEAL` and `DIARY_WINDOW_DAYS` are FALLBACKS for
  a client with no profile yet; the server is the authority.
- **A bound means exactly what its comment says it bounds.** `DIARY_WINDOW_DAYS` bounds
  `/v1/diary/week` — which days can be MARKED. It does not bound `/v1/diary/day`, which answers for
  any date. Using it to gate anything else is how the date picker came to refuse days the server
  would happily return.
- **`signsIn` says which providers put somebody INTO an account**, and it lives here because both
  sides of the identity graph read it: the store's deletion rule and the engine's merge rule.
  `telegram` is a transport and answers false. A rule that counts identity rows instead asks a
  question about storage rather than about access.
- **Verdicts are computed, never accepted** — not from the model, not from the client.
  `AnalyzedMeal` is `MealAnalysis` minus `verdicts` and the gap must never be closed with a cast.
- **Dates are computed in the configured zone, never UTC.** Shift a stored `YYYY-MM-DD` with
  `dateMinus` — calendar subtraction, DST-safe. Never subtract fixed 24-hour spans.
- **`YYYY-MM-DD` and `YYYY-MM` compare correctly as strings.** That is deliberate and is why
  ordering, windows and month arithmetic use plain `<`/`>` rather than parsing.
- **The calorie floor is unconditional.** Share cap first, floor second. Any new code path that
  produces a kcal target goes through `explainTargets`.
- **Copy is `Localized<T>`; a rule is not.** A table holds the WORDING of each branch and the code
  beside it holds which branch a case takes. `eveningPrescription` picks the lever, `checkNumber`
  decides what is a valid age, `correlationWords` owns the 0.5 that separates weak from moderate —
  a translator moving any of those would be moving a rule. This is also what makes a translation
  reviewable: a table diffs as prose.
- **A sentence is a WHOLE template, never fragments joined by code.** `"{left} of your {plan} left
  today"` and not `` `${rest} left today` `` with `rest` built elsewhere. The old thread built
  "930 of your 1,450" in TypeScript and handed it over as one parameter, which is an English
  genitive compiled into the code and unreachable by any translation.

## Localization (#358)

**The product speaks eight languages: `en`, `fr`, `de`, `it`, `es`, `vi`, `id`, `ru`.** `LANGS`
(`types.ts`) is what the server stores and the model answers in. `LANGS_READY` (`lang.ts`) is the
smaller, honest claim — what the app can render ITSELF end to end — and it is what a picker offers.
They are equal today and are two names because they mean different things: `PATCH /v1/profile`
accepts any `LANGS` code, because a phone in a language the browser pages have no words in still
gets its meal names in that language.

- **A new string goes in the `*-copy.ts` beside the module that reads it**, as a key on that
  module's one `Localized` table, in all eight languages. Not in a `.json` bundle, not behind an
  extraction step: `lang.ts`'s header says why, and eight compiled-in languages need neither.
- **`localizedGaps` is what keeps `LANGS_READY` honest.** One test per workspace
  (`copy.i18n.test.ts`) hands it `import * as everything` and fails by name — "CHAT_COPY has no vi
  (Tiếng Việt)" — when a table is missing a language the list claims. A table nothing EXPORTS is a
  table it cannot see, which is the one way a language can be lost quietly; export it.
- **Fallback happens at the KEY, never at the screen.** `en` is required by `Localized<T>`, so
  `t(lang)` cannot return undefined. One untranslated button is a wart; a screen that throws is a
  process abort in a Release build.
- **THE UNIT SYSTEM IS NOT THE LANGUAGE.** `de` is metric, `en` is not automatically imperial, and
  nothing in a copy table may reach `targets.ts`. `Intl.NumberFormat` is asked for a decimal, never
  for a measurement — `LANG_TAG` moves a separator and cannot move a kilogram.
- **A unit SYMBOL beside a figure is `UNIT_KCAL`; a unit symbol on an axis is not.** Every sentence
  carries its own unit word in its template; the four places that CONCATENATE one onto a figure
  (the plan card, the diary headline, a Telegram meal line) read `UNIT_KCAL`, because a Russian plan
  card read "1 500 kcal" with "Порог — 1500 ккал." two lines under it. That table is a SPELLING and
  not a unit: the same quantity in all eight, which is the `LANG_LABEL` situation and not the
  imperial one. `HEALTH_FIELDS.unit` stays SI and this does not license changing it.
- **Numbers and dates are `Intl`.** `numbers(lang)` keeps a tenth (a weight somebody typed);
  `wholeNumbers(lang)` rounds (a kcal from a photo, where a decimal claims a precision the analyzer
  does not have). `monthYear` is `Intl.DateTimeFormat` — CLDR's forms are not all "<month> <year>",
  and a table of ours got Spanish, Russian and Vietnamese wrong at once before it was deleted.
- **A TABLE THAT IS NOT `Localized<T>` IS INVISIBLE TO EVERY CHECK HERE.** `localizedGaps` detects
  a table by SHAPE, so English literals in an ordinary record are not a gap — they are not a table.
  That is how the whole health-trend screen stayed English inside a translated app: `TREND_PERIODS`
  held `label`/`noun` as plain strings, the axis formatters were pinned to `en-GB`/`en-US`, and
  `trendSummary` took no language at all. Making `lang` required repo-wide would not have found it
  either, because none of those functions HAD a language parameter to make required. The fix is the
  general one — the words moved into `HEALTH_COPY`, the formatters are built from `LANG_TAG[lang]`,
  and `trendPeriods(lang)`/`trendBuckets(…, lang)`/`trendSummary(…, lang)` take the language. When
  you add a surface, ask whether its words are in a `Localized<T>`; if they are not, no test here
  is watching them.
- **A sentence is a TEMPLATE, never fragments joined by code.** `trendSummary` built the VoiceOver
  line by concatenating "by", "from", "to", "Lowest" around the numbers. Word order is not a
  constant across eight languages, and for a reader with low vision that sentence IS the chart. It
  is one string per language with named placeholders now. The same rule caught Russian's `по`,
  which governs the dative plural: `HealthCopy.periods[p].per` exists beside `noun` because one
  field cannot be both `неделя` and `неделям`.
- **A test refuses to let the Russian decide who the reader is.** Russian past tense agrees with
  the speaker's gender and has NO neutral form, so `Что ты ел?` greets every woman using this app
  as a man — and it shipped on the chat composer's placeholder, in three surfaces at once. Nothing
  about the string is wrong to a reviewer reading it: it is correct, idiomatic and complete, and
  English has no construction that behaves this way, so reviewing the English source could not
  catch it either. `genderedRussian` (`lang.ts`) walks every string in the graph — it needs no
  language bucket, because nothing but Russian has Cyrillic in it — and the three `copy.i18n`
  tests fail naming the key. Fifteen sentences, four of them in `fr`/`it`/`es`/`ru` where the
  adjective in "you're not alone" picks a gender too; those were rephrased around the situation
  rather than the person, which is the move that works in all eight.

- **`LANG_LABEL` is never translated.** A list of languages written in the language the reader is
  trying to leave is the one list they cannot read. It is also what the LLM prompt names the reply
  language with (`languageLine`), because a language's own name is the same string wherever it is
  read.
- **The largest text surface is in no table.** Meal names, the coach's answers, the glance and the
  follow-up chips are written by the model per turn. `languageLine` in `llm/prompt.ts` is the whole
  of what steers them, and it reaches every prompt that produces words a user reads.
- **The claims gate (`claims.ts`) is English-only, and it now covers one language in eight.** It
  matches English patterns, so running it over the German passes regardless. For the COMPILED-IN
  tables that is survivable: they are translations of English that passed the gate, the English is
  the source, and a sentence changes there first. It is NOT true of the two DB-stored surfaces —
  `onboarding_content` and `notification_copy` — where an admin types the words directly and
  `?lang=` gave them seven more revisions to type into. `validateNotificationCopy` accepts a German
  push reading *Garantierter Gewichtsverlust*; the English *Guaranteed weight loss* is refused.
  A push notification arrives unasked, on a lock screen, with no review and no recall, and §5 UWG
  is the product's own jurisdiction. Open, tracked, and named here rather than left to be
  rediscovered: what would close it is per-language pattern sets, and what would falsify the
  framing is the stored surfaces losing their language dimension.
- **THE iOS CLIENT RENDERS FROM THESE TABLES TOO, and that is why they are here rather than in the
  backend.** `src/mobile` is not in this repo and imports `@eait/shared` from the parent monorepo,
  so a table in `backend/` is a table the phone cannot read. What the app consumes:
  `onboardingContentFor` / `usableContentFor` (the flow), `chatCopyFor` and its readers
  (`GOAL_CARDS(lang)`, `STRUGGLE_LABELS(lang)`, `checkNumber(…, lang, …)` and the rest — every one
  of them takes the language now, and a caller that captures one at module scope renders in
  whatever language the process started in), `threadCopyFor` / `firstVerdictLines` / `runningLine` /
  `scriptedLine`, `verdictPillLabel`, `healthLabel`, `correlationWords`, `notificationCopyFor` +
  `eveningPrescription`, `projectionMonth`, `trendPeriods` / `trendBuckets` / `trendSummary` for
  the health charts, and `numbers` / `wholeNumbers` / `monthYear` for every figure.
  **`trendSummary`'s `format` callback must spell its unit with `spellUnit(lang, …)`** — that
  sentence is the chart read aloud, so a raw `HEALTH_FIELDS.unit` puts `kg` in the middle of a
  Russian clause. The AXIS keeps the SI symbol; only the spoken sentence does not. The language itself is `ProfileResponse.profile.lang`; the picker writes it with
  `PATCH /v1/profile { lang }` and offers `LANGS_READY` labelled by `LANG_LABEL`.
- **`lang` IS REQUIRED ON EVERY ONE OF THEM, and that is deliberately a breaking change.** `t()`
  falls back at the KEY, which is the wart this design accepts; a defaulted PARAMETER falls back at
  the SCREEN, and it does it where nothing can see — the call site that forgot it compiles, every
  test passes, and the screen is English. Removing the defaults made the compiler name three live
  ones no gate here could reach: `oneLiveProposal` in `chat-core.ts` (two call sites, one of them
  wrong, so every non-English reader saw "dropped" in English), `projectionMonth` in `coach.ts` (an
  English month handed to a model told to answer in Russian), and `scriptedLine` in `meals.ts`. So a
  `src/mobile` call site that has no language is a BUILD ERROR rather than a screen somebody
  eventually notices. Where the optional argument sat in front of the required one — `scriptedLine`,
  `checkNumber` — the order was swapped, because reaching the language must never cost a caller an
  argument it has no opinion about.
- **The phone's two LOCAL notifications must read `notificationCopyFor(lang)`, not the default.**
  `reminderPlan` says WHICH reminders to schedule and the words come from the table; scheduling
  them off `DEFAULT_NOTIFICATION_COPY` is an English lock screen on an account that asked for
  Italian, and nothing on the server would ever see it.
- **`Intl` must be real on the device.** Every figure and every month name goes through it.
  Hermes ships full ICU on the RN versions this app is built with, and `projection.ts`'s old
  twelve-month table was written against a build that did not — if a device ever answers a numeric
  month or an ungrouped thousand, that is the thing to check, not these tables.
- **Admin-editable copy is stored per language in the SAME row.** `onboarding_content` and
  `notification_copy` hold a `Localized<…>` map rather than one revision: no column, no migration,
  and a row written before #358 is read as English, which is what it was. A save in one language
  carries the seven it is not editing. `usableContentFor(lang, stored)` falls back to THAT
  language's compiled-in copy, never to English.

## Testing

`bun test ./src/shared` — no database, no simulator. Every file here has a `.test.ts` beside it and
that is the expectation for anything added: this is the layer where a rule can be proven cheaply,
so a rule that is only exercised through the app is in the wrong place.

TDD is the repo's rule and it is enforceable here more than anywhere: write the failing test, watch
it fail, implement, watch it pass.

## Adding to this workspace

A new domain rule or type both sides need → a file here, exported from `index.ts`. If only one side
will ever use it, it does not belong here — put it in that side and keep this the agreement.

## Dates, health arithmetic, and the onboarding contract

> Moved verbatim from the root `AGENTS.md`, which is the router and no longer carries the detail.

- **`HEALTH_RETENTION_DAYS` is one number with four jobs, and they must agree.** How old a health
  row may be and still be stored, the widest trend a client may read, how far the phone's first
  sync reaches, and — through `DIARY_WINDOW_DAYS` — how far the diary's per-day totals go, because
  the health screen draws intake on the same axis as energy burned. It was three constants on two
  sides once; the year view is what made the drift visible.
- **Every number on a health chart is `src/shared/trend.ts`.** `trendBuckets` (Monday weeks,
  calendar months, every stored year), `bucketSeries` (the MEAN of the days with a reading — a
  weekly total and a monthly total do not share an axis, an average per day does — and null stays
  null, a gap and never a zero), `correlate` (Pearson over the buckets known on both sides, and no
  answer under five of them) and `correlationWords`. `app/health.tsx` draws; it computes nothing.
  `lib/components/chart.tsx` is hand-drawn on `react-native-svg`, which was already a dependency,
  and takes only theme tokens: the accent for the primary series, `textMuted` for the second, and
  a caption in words saying which is which.
- **The phone aggregates health in the SERVER's timezone, never its own.** `ProfileResponse.timezone`
  carries it, and `dates.ts` lives in `shared` for that reason. Two zones means a day's meals and
  that same day's health describe two different twenty-four-hour windows — on one screen, invisibly,
  only for people who travel.
- **Dates are computed in the configured zone, not UTC.** `dates.ts`. To shift a stored
  `YYYY-MM-DD`, use `dateMinus` — calendar subtraction, DST-safe. Never subtract fixed 24-hour spans
  and re-derive; that is off by one across a DST transition near midnight, twice a year, never
  reproducibly.
- **A meal's date changes ONLY via re-date.** `EditMealRequest` has no `date` field, so the manual
  editor cannot reach it. `MealPatch` does, for the one sanctioned path.
- **Onboarding is ONE CHAT with Spud, and the design is `product/design/onboarding/`.** `copy.md` is
  every sentence and is the source of truth: change it before changing a string. The ten profile
  questions are asked one at a time in `ONBOARDING_STEPS` order, plus ONE that collects no profile
  field (what has been hard) whose answer lives in the stored thread rather than in a column, and
  `REPORTABLE_FIELDS` has no room for it by construction, which is what keeps "binge episodes" out
  of a funnel row. **A question earns its place by having a reader.** There were four; why now, the
  hardest moment and eating out were cut on 2026-08-26 because nothing in `src/` read back what they
  wrote — the user pays for a question like that and never sees it come back. `struggles` survived
  because it picks the support cards a sentence later, which the user does see.
- **Onboarding: the WORDS are editable, the QUESTIONS are not.** `src/shared/onboarding.ts` holds
  three layers and the line between them is the whole design. STEPS are the profile fields the
  calorie target needs — fixed in code. SCREENS are how those fields are grouped and the unit the
  copy is keyed by — fixed in code, and one may be switched off only when nothing on it reaches
  `explainTargets` (today: only `country`). CONTENT is `asks` (what Spud says to pose each field,
  one entry per bubble), the option labels, the front door and the plan — fully editable in the
  backend admin. `validateOnboardingContent` enforces that boundary ON THE WRITE, so bad copy never
  reaches a phone; an admin can rewrite every question and cannot produce a target computed from a
  value nobody chose.
- **The REPLIES and the support cards are code, not copy.** `src/shared/onboarding-chat.ts` holds
  the branch logic and every sourced statistic ("about 42% of adults", "n = 1.18M"). An admin text
  box in front of a health statistic is an unsubstantiated claim one typo away from every phone,
  with no gate in front of it — the thing `landing/claims.ts` exists to stop in public copy. Two
  percentages in that file are READ from `MAX_DEFICIT_SHARE`/`MAX_SURPLUS_SHARE` rather than typed.
  Three rules hold over every reply and each has a test: speak to the branch taken, deliver a stat
  once, and never lean on structure the user cannot see.
- **Onboarding content is fetched at runtime, so both directions of drift are normal.** A shipped
  app outlives its server. The app walks `CHAT_PROMPTS`, which is compiled in, so a screen from a
  newer server is carried and never rendered; `usableContent` discards a whole revision from an
  OLDER one when any question is missing its `asks` — a question with no sentence to ask it with is
  a conversation that stops, not a degraded screen. The app renders the compiled-in default first
  and upgrades in place — onboarding must never open on a spinner. The server runs the same guard
  on the read, so the admin editor opens on something that can be saved.
- **Onboarding analytics carry no answers.** `REPORTABLE_FIELDS` is the whitelist: enumerated
  choices only (`goal`, `sex`, `activity`, `pace`, `country`, `restrictions`). Never a weight, a
  height, a year of birth, the medical free text, or the conversation answer. Enforced
  on the client AND again in `recordOnboardingEvents`, because a client-side promise about what it
  sends is not a control. The funnel is erased with the account, which is a real analytics cost
  accepted deliberately.
