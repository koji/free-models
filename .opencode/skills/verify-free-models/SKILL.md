---
name: verify-free-models
description: Drives the OpenRouter free-models website (Pages UI plus /api/models) and the cron filter logic to prove behavior end to end. Reach for it when a change touches website/, scripts/, or the free-model definition and a reviewer must see real evidence, not a code reading.
---

# Verify free-models

## Launch

The app is the static site plus the Pages Function. Serve both with one command:

```pwsh
$rid = "run1"
node .opencode/skills/verify-free-models/helpers/serve.mjs start --target pages --run-id $rid --port 8788
```

Seed the local KV with the skill fixture so the page has deterministic data. Run this from `website/` so the repo's pinned wrangler answers (a bare `npx wrangler` from the repo root can resolve a different major with different `kv` syntax):

```pwsh
cd website
npx wrangler kv:key put "openrouter:free-models:latest" --path ../.opencode/skills/verify-free-models/fixtures/models.json --namespace-id FREE_MODELS_KV --local --persist-to $env:TEMP/verify-free-models/$rid/state/persist
cd ..
```

Drive the UI through headless Edge over CDP. Start it with the same helper:

```pwsh
node .opencode/skills/verify-free-models/helpers/serve.mjs start --target edge --run-id $rid
```

Ready means all three answer: `/` returns 200, `/api/models` returns 200 once seeded (503 before seeding), and the CDP endpoint lists a page target. Confirm with:

```pwsh
node .opencode/skills/verify-free-models/helpers/doctor.mjs --run-id $rid
```

Teardown kills only what this run started, tracked by pidfiles under the run directory:

```pwsh
node .opencode/skills/verify-free-models/helpers/serve.mjs stop --run-id $rid
```

Run every command from the repo root unless a recipe says otherwise.

## Doctor

Run doctor first whenever anything looks off, after every failed drive, and before the first drive of a run:

```pwsh
node .opencode/skills/verify-free-models/helpers/doctor.mjs --run-id $rid
```

Doctor checks the toolchain (node, wrangler, Edge binary), that recorded PIDs are alive, that the pages server answers on its port, that `/api/models` parses as JSON, and that the CDP endpoint is reachable. It exits non-zero with one line per failed check. A stale pidfile (PID dead or port owned by a foreign process) fails the run: stop, delete the run directory, and start a fresh `--run-id`.

## Drive

Pick the feature file from `features/`, follow its recipe exactly, and use the helpers it names:

```pwsh
node .opencode/skills/verify-free-models/helpers/api-check.mjs --base http://127.0.0.1:8788 --mode seeded
node .opencode/skills/verify-free-models/helpers/cdp-eval.mjs --eval "document.querySelectorAll('#tbody tr').length"
```

Prefer stable handles from the recipes (`#tbody`, `#searchInput`, `[data-sort="name"]`). Never sleep for rendering: poll `document.readyState` plus the recipe's settle step, or assert on the DOM state the recipe names.

## Evidence

Put every artifact under `$env:TEMP/verify-free-models/<run-id>/artifacts/`, one subdirectory per feature ID. State the proof standards for every drive:

- Exercise the real user path through the served page or the real API route, never an internal setter or a stub server.
- Capture the action and the resulting state: the evaluated expression plus a DOM dump and a screenshot that shows the app identity.
- Verify side effects with a read-only second view: re-GET `/api/models` after UI actions, read the KV key back after a cron trigger.
- Quote the exact command, observed output, and exit code in run notes.

## Cleanup

Stop servers with `serve.mjs stop --run-id`. Never kill by process name; kill only the PIDs the run recorded. Cleanup removes server processes, Edge profiles, and KV persist dirs. Cleanup never removes `artifacts/`. Run cleanup after every failed iteration too, then confirm the evidence still exists at its named path before reporting.

## Helpers

| Helper | Invocation | Job |
|---|---|---|
| `serve.mjs` | `node helpers/serve.mjs start\|stop --target pages\|edge --run-id ID [--port N]` | Starts and stops the pages server and headless Edge, records PIDs |
| `doctor.mjs` | `node helpers/doctor.mjs --run-id ID` | Read-only health check for toolchain and running instances |
| `api-check.mjs` | `node helpers/api-check.mjs --base URL --mode seeded\|empty` | Asserts the `/api/models` contract including headers and body shape |
| `cdp-eval.mjs` | `node helpers/cdp-eval.mjs --eval JS [--url U] [--navigate] [--settle-ms N] [--screenshot P] [--dump P] [--viewport WxH]` | Evaluates JS in the app tab, prints the JSON result, captures evidence |

All helpers run with plain `node`. No extra installs. Every flag above has a default shown in `--help`.

## Isolation

One run owns one `--run-id`: its own persist dir, Edge profile, ports, and pidfiles. Default ports are 8788 for pages and 9223 for CDP. If doctor reports a port owned by a foreign process, do not drive it and do not kill it. Pick a new run ID and ports, or stop and report the conflict.

## Out of scope

- `scripts/post_openrouter_free_models.py` posts to the public Bluesky timeline and needs real credentials. No recipe drives it live. Static review only.
- The cron scheduled run has no working local path (see `features/hourly-refresh.md`). Its predicate is covered indirectly through the seeded API payload and the served definition note.
