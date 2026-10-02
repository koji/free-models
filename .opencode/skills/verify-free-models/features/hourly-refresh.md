# Hourly refresh

The cron worker fetches the OpenRouter catalog once an hour, keeps only free models, stamps first-seen dates, and stores the snapshot the page reads.

## Sub-features

- `refresh-trigger` runs the scheduled fetch on demand through the manual trigger.
- `refresh-filter` stores only IDs ending with `:free` or starting with `stealth/` whose pricing is all zero.
- `refresh-dates` preserves `firstSeenAt` for known IDs and stamps new ones with now.

## How to get to it (user POV)

- There is no visible entry point; the snapshot timestamp on the page moves hourly. Drive it through the worker trigger.

## Driving it with verify helpers

Status: not live-proven at generation. Do not claim coverage of this feature.

Preconditions (for a future run on a booted worker):

- A worker booted from `website/src/cron.ts` with an isolated local KV, `CRON_SECRET` set to a test value, and network access to `https://openrouter.ai`.

- **Trigger.** Fire the schedule. Run `curl.exe -s -X POST http://127.0.0.1:8787/__scheduled -H "authorization: Bearer test-secret"`. The printed body is `scheduled ok`.
- **Filter.** Read the stored key back. Run `npx wrangler kv:key get "openrouter:free-models:latest" --namespace-id FREE_MODELS_KV --local --persist-to $env:TEMP/verify-free-models/$rid/cron-persist`. Every stored ID ends with `:free` or starts with `stealth/`, and the IDs sort case-insensitively.
- **Dates.** Fire the trigger twice and compare `firstSeenAt` values across both reads. Known IDs keep their stamps; only new IDs gain fresh ones.

## Gotchas

- The local worker does not boot under the repo's pinned toolchain. Attempted route: `npx wrangler dev --local --port 8787` (wrangler 3.114 and wrangler 4, from `website/`). Both fail before serving with `service core:user:openrouter-free-models-cron: Uncaught TypeError: Incorrect type for map entry 'NEW_WINDOW_DAYS': the provided value is not of type 'function or ExportedHandler'`. The deployed worker runs the same code and updates hourly, so this is a local-runtime limitation, not a product regression.
- A live trigger reads the real OpenRouter catalog, so assert properties (ID shape, sort order, date preservation), never exact model sets.
- The trigger is guarded by `CRON_SECRET`; without the Bearer token it answers 401, and with no secret configured it answers 403.
