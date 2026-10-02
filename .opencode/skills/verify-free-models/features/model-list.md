# Model list

The page loads the hourly snapshot, renders one row per model with context length and NEW badges, and shows the model count with the update time.

## Sub-features

- `list-load` renders all fixture models as table rows after load.
- `list-meta` shows the count and the UTC update time.
- `list-badge` marks only models first seen inside the window with NEW.
- `list-links` links each model ID to its OpenRouter page in a new tab.
- `list-reload` refetches the snapshot when the user chooses Reload.

## How to get to it (user POV)

- Open the site root in a browser.
- Choose the `Reload` button in the dataset card.

## Driving it with verify helpers

Preconditions:

- Baseline state holds: pages serves on 8788, KV holds the fixture, Edge runs with CDP, doctor reports `DOCTOR OK`.

- **Load rows.** Navigate and count rows. Run `node helpers/cdp-eval.mjs --navigate --eval "document.querySelectorAll('#tbody tr').length"`. The printed value is `3`.
- **Meta line.** Read the header stats. Run `node helpers/cdp-eval.mjs --eval "document.getElementById('count').textContent + '|' + document.getElementById('updatedAt').textContent"`. The printed value is `"3|2026-10-02 06:00 UTC"`.
- **Context cells.** Read the formatted contexts. Run `node helpers/cdp-eval.mjs --eval "[...document.querySelectorAll('#tbody .cell-ctx')].map(e=>e.textContent).join(',')"`. The printed value is `"32.8K,128K,1M"` in default ID order.
- **Badge.** Inspect the NEW marker. Run `node helpers/cdp-eval.mjs --eval "document.querySelectorAll('#tbody .badge-new').length + '|' + document.querySelector('#tbody .badge-new').getAttribute('aria-label')"`. The printed value is `"1|New model, added 2026-10-01"`: exactly one badge, on the Grok row.
- **Links.** Read the destinations. Run `node helpers/cdp-eval.mjs --eval "[...document.querySelectorAll('#tbody .cell-id a')].map(e=>e.getAttribute('href')+'|'+e.getAttribute('target')).join(',')"`. The printed value is `"https://openrouter.ai/meta-llama/llama-3-8b:free|_blank,https://openrouter.ai/stealth/space-bunny-alpha|_blank,https://openrouter.ai/x-ai/grok-4-fast:free|_blank"`.
- **Reload.** Choose Reload and recount. Run `node helpers/cdp-eval.mjs --eval "document.getElementById('reloadBtn').click()" --settle-ms 1500` then `node helpers/cdp-eval.mjs --eval "document.querySelectorAll('#tbody tr').length"`. The printed value is `3`.
- **Proof.** Capture the populated state. Run `node helpers/cdp-eval.mjs --eval "document.getElementById('searchHint').textContent" --viewport 1280x1000 --dump $env:TEMP/verify-free-models/$rid/artifacts/model-list/dom.txt --screenshot $env:TEMP/verify-free-models/$rid/artifacts/model-list/shot.png`. The dump contains `stealth/space-bunny-alpha` and the screenshot shows the table with 3 models.

## Gotchas

- `--dump-dom` without `--virtual-time-budget` dumps before the fetch resolves; the helper waits for `readyState` plus settle instead.
- The update time always renders in UTC as `YYYY-MM-DD HH:MM UTC`, regardless of the machine zone.
- The fixture `updatedAt` is fixed, so the NEW badge is deterministic: only the 2026-10-01 model qualifies under the 7-day window.
