# Models API

`GET /api/models` serves the stored snapshot with its shape and cache headers, and reports a precise unavailability state when the store is empty.

## Sub-features

- `api-seeded` returns the stored payload with model entries when KV holds data.
- `api-cache` marks successful responses cacheable for 10 minutes.
- `api-empty` returns 503 with a JSON error when the store holds nothing.

## How to get to it (user POV)

- There is no visible entry point; the page fetches this route on load and on Reload. Drive it directly over HTTP.

## Driving it with verify helpers

Preconditions:

- The pages server runs on 8788. For `api-seeded`, KV holds the fixture. For `api-empty`, KV holds nothing (fresh `--run-id` with no seeding).

- **Seeded contract.** Check status, shape, and headers. Run `node helpers/api-check.mjs --base http://127.0.0.1:8788 --mode seeded`. The output ends with `API PASS` and names status 200, three models, and `cache-control: public, max-age=600`.
- **Seeded body.** Read the payload back. Run `node helpers/api-check.mjs --base http://127.0.0.1:8788 --mode seeded --show-body`. The output includes the `stealth/space-bunny-alpha` entry and `count` equal to the models length.
- **Empty store.** Check the unavailability contract. Run `node helpers/api-check.mjs --base http://127.0.0.1:8788 --mode empty`. The output ends with `API PASS` and names status 503, the JSON `error` field, and `cache-control: no-store`.
- **Proof.** Capture the raw exchange. Run `New-Item -ItemType Directory -Force $env:TEMP/verify-free-models/$rid/artifacts/api-models | Out-Null` then `node helpers/api-check.mjs --base http://127.0.0.1:8788 --mode seeded --show-body > $env:TEMP/verify-free-models/$rid/artifacts/api-models/seeded.txt`. The file holds the command echo, status, headers, and body.

## Gotchas

- The empty state depends on a fresh persist dir: reuse of a seeded `--run-id` invalidates `api-empty`.
- The helper asserts `count` equals the models array length; the page renders `count` but iterates `models`, so a mismatch would show in UI proof, not here.
- `context_length` may be a number or null; both pass, anything else fails.
