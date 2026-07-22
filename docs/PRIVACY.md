# Privacy

Covers the **hosted demo bot** [@eait_bot](https://t.me/eait_bot). If you self-host, none of
your users' data reaches the maintainer — you become the operator, and this document is a
template for the one you owe your own users.

Last updated: 2026-07-21.

## What is collected

| Data | Why | Kept |
|---|---|---|
| Telegram user id, username | Identify your account and scope every row to it | Until you `/delete` |
| Language | Reply in your language | Until you `/delete` |
| Reply style (rich cards / plain text) | Render meal replies the way you chose | Until you `/delete` |
| Goal (lose / maintain / gain) | Set your calorie and protein targets | Until you `/delete` |
| Current weight (optional — the question is skippable) | Personalize your protein target (1.6 g/kg) | Until you `/delete` |
| Dietary and health restrictions | Judge meals on the dimensions you declared | Until you `/delete` |
| Per-meal estimates — items, calories, macros, verdicts, notes | Daily totals and corrections | Until you `/delete` |
| Pending text-meal descriptions (stored briefly while you confirm) | Hold your text input between the confirm prompt and your tap | Deleted immediately on confirm or cancel; auto-pruned after 48 h if neither arrives |
| LLM call counts per day | Enforce per-user and global spend caps | Deleted with your account on `/delete`; no message content, just a kind tag and timestamp |
| Update ids | Avoid processing the same message twice after a restart | Kept indefinitely — numeric Telegram ids only, no content and no link to your account |

### Health data

Restrictions may include health conditions — kidney disease, cholesterol/LDL. Under GDPR that
is **special-category data (Art 9)**. The legal basis is your **explicit consent**, given on the
consent screen before anything is stored, and withdrawable at any time via `/delete`.

You are not required to declare a restriction. Tap "Skip" during setup, or clear them in
`/settings → Restrictions`, and the bot works on calories and your weight goal alone.

## Photos are not stored

A meal photo is downloaded into memory, sent to the model, and dropped. No image and no image
path is ever written to the database — enforced in code and covered by tests, not just policy.

The photo does leave the server to reach the model provider (below).

## Who else sees it

- **Telegram** — carries every message. Subject to [Telegram's privacy policy](https://telegram.org/privacy).
- **OpenRouter**, and the model provider it routes to — receives the photo and your goal and
  restrictions as prompt context, in order to produce the estimate. Subject to
  [OpenRouter's privacy policy](https://openrouter.ai/privacy). The hosted bot's configured
  model is stated in the README.

No analytics, no advertising, no third-party trackers, and no sale or sharing of data with
anyone else.

## Where it lives

A Postgres database on the operator's machine. The hosted instance runs in **Germany (EU)**.

## Your rights

- **Erasure** — `/delete` removes your profile, every meal, any pending text-meal descriptions,
  and LLM call logs — immediately and irreversibly. This is also how you withdraw consent.
- **Access / portability** — there is currently **no self-service export**. Ask via the contact
  below and the operator will extract your rows manually.
- **Rectification** — reply to any meal message with a correction and it is re-estimated.
- **Objection / restriction** — stop using the bot and run `/delete`.

## Retention

Indefinite until you `/delete`. There is no automatic expiry. If the hosted bot is ever retired,
its database is destroyed rather than transferred.

## Contact

Open an issue at <https://github.com/kirmalyshev/eait/issues>, or use the private channel in
[SECURITY.md](../SECURITY.md) if the matter is sensitive.

## The honest disclaimer

This is a personal side project run on one person's API budget, not a company. There is no SLA,
no uptime guarantee, and no support commitment. The demo bot can be capped, paused, or shut
down without notice.

**Estimates from a photo are approximate and are not medical advice.** Do not use them to make
medical decisions. If you have kidney disease, high cholesterol, or any condition where diet is
part of treatment, talk to your doctor rather than a Telegram bot.

If any of this is not acceptable for your data, **self-host instead** — see
[SELF_HOSTING.md](SELF_HOSTING.md). That is the recommended path, and the reason the code is
open.
