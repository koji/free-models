# Column sort

The table headers sort by model ID, name, or context length, toggling direction on repeat choice, with an arrow marking the active key.

## Sub-features

- `sort-id` orders rows by model ID case-insensitively; this is the default.
- `sort-name` orders rows by model name; repeat choice flips direction.
- `sort-context` orders rows numerically with missing values last.
- `sort-indicator` shows the arrow only on the active header.

## How to get to it (user POV)

- Choose the `Model ID`, `Name`, or `Context` header button above the table.

## Driving it with verify helpers

Preconditions:

- Baseline state holds with the 3-model fixture, the search box empty, and default ID order showing `meta-llama/llama-3-8b:free` first.

- **Name ascending.** Choose the Name header once. Run `node helpers/cdp-eval.mjs --eval "document.querySelector('[data-sort=\"name\"]').click()" --settle-ms 500`. Then run `node helpers/cdp-eval.mjs --eval "document.querySelector('#tbody tr td').textContent + '|' + document.querySelector('[data-ind=\"name\"]').textContent"`. The printed value is `"x-ai/grok-4-fast:free|▲"`.
- **Name descending.** Choose the Name header again. Run `node helpers/cdp-eval.mjs --eval "document.querySelector('[data-sort=\"name\"]').click()" --settle-ms 500`. Then run `node helpers/cdp-eval.mjs --eval "document.querySelector('#tbody tr td').textContent + '|' + document.querySelector('[data-ind=\"name\"]').textContent"`. The printed value is `"stealth/space-bunny-alpha|▼"`.
- **Context ascending.** Choose the Context header. Run `node helpers/cdp-eval.mjs --eval "document.querySelector('[data-sort=\"context_length\"]').click()" --settle-ms 500`. Then run `node helpers/cdp-eval.mjs --eval "[...document.querySelectorAll('#tbody tr td:first-child')].map(e=>e.textContent)"`. The printed value is `["meta-llama/llama-3-8b:free","stealth/space-bunny-alpha","x-ai/grok-4-fast:free"]`.
- **Proof.** Capture the sorted state. Run `node helpers/cdp-eval.mjs --eval "document.querySelector('[data-sort=\"name\"]').click()" --settle-ms 500 --viewport 1280x1000 --dump $env:TEMP/verify-free-models/$rid/artifacts/column-sort/dom.txt --screenshot $env:TEMP/verify-free-models/$rid/artifacts/column-sort/shot.png`. The dump shows the Grok row first with the `▲` marker on Name.

## Gotchas

- Choosing a new key resets direction to ascending; only repeating the same key toggles.
- The expected orders above come from the fixture: names Grok 4 Fast, Llama 3 8B, Space Bunny Alpha; contexts 32768, 128000, 1000000.
- A leftover search query silently shrinks the sorted set: clear the box before sorting.
