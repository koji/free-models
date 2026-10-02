# Free-models verification map

This directory is the maintained source for verifying the user-facing behavior of the OpenRouter free-models site. Read the index before driving the app, then use the matching feature file as the recipe.

## Baseline preconditions

- Serve the site from the repo root: `node .opencode/skills/verify-free-models/helpers/serve.mjs start --target pages --run-id $rid --port 8788`.
- Seed local KV with the skill fixture before any UI or API drive (exact command in the skill body; run it from `website/`).
- The repo pins wrangler 3. A bare `npx wrangler` from the repo root can resolve another major whose `kv` syntax differs; helpers always call the pinned binary by path.
- Start headless Edge for UI drives: `node .opencode/skills/verify-free-models/helpers/serve.mjs start --target edge --run-id $rid`.
- Run `node .opencode/skills/verify-free-models/helpers/doctor.mjs --run-id $rid` and require `DOCTOR OK`.
- Never drive an instance that was not started by this verification run.
- Default ports are 8788 for pages and 9223 for CDP; every recipe assumes the defaults.
- The fixture holds 3 models: `meta-llama/llama-3-8b:free` (old, no badge), `stealth/space-bunny-alpha` (old, no badge), `x-ai/grok-4-fast:free` (fresh, NEW badge). `updatedAt` is `2026-10-02T06:00:00.000Z` and `newWindowDays` is 7.

## Driving conventions

- Start every recipe from the baseline state unless its preconditions say otherwise.
- Prefer IDs and `data-sort` attributes over CSS position or tab order.
- Treat every command as literal. Keep quoted JS expressions and flags unchanged.
- Run browser actions through `node helpers/cdp-eval.mjs`.
- Run API assertions through `node helpers/api-check.mjs`.
- Restore seeded data after a mutation. Do not remove proof artifacts during cleanup.

## Proof and skip reporting

- Capture the user action and the resulting state, not only the final screen.
- UI proof includes the evaluated expression output plus a DOM dump and a screenshot with the app identity visible.
- API proof includes the command, the status code, the body shape check, and the cache header.
- Record the feature ID and entry point used with every artifact.
- Report an unreachable path with the attempted command and the unmet precondition.
- Do not report a skipped entry point as verified through a different path.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the user-visible behavior. It then uses exactly four H2 sections in this order.

1. `Sub-features` lists short IDs with one line for each behavior.
2. `How to get to it (user POV)` lists every user entry point.
3. `Driving it with verify helpers` starts with `Preconditions:` and uses labeled bullets that pair each user action with an exact command and observable result.
4. `Gotchas` lists traps that can waste or invalidate a verification run.

Helper output is JSON: strings print with double quotes, numbers print bare. The expected values below copy that form exactly.

Keep implementation details out of the map. Name only user paths, stable handles, required state, commands, and observable proof.

## Features

- [Model list](./model-list.md) covers page load, rendered rows, counts, dates, badges, links, and reload. Live-proven at generation.
- [Search filter](./search-filter.md) covers narrowing, hints, and the empty state. Live-proven at generation.
- [Column sort](./column-sort.md) covers sort keys, direction toggle, and indicators. Live-proven at generation.
- [Models API](./api-models.md) covers the seeded contract, cache headers, and the empty-store state. Live-proven at generation.
- [Hourly refresh](./hourly-refresh.md) covers the cron scheduled run. Not live-proven at generation: the local worker does not boot (see that file). Do not claim coverage.
