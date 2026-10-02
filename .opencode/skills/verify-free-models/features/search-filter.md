# Search filter

The search box narrows the table to models whose ID or name contains the query, names the match count, and shows a complete empty state when nothing matches.

## Sub-features

- `search-narrow` keeps only rows whose ID or name contains the query.
- `search-hint` names the match count as `N of M` while a query is active.
- `search-empty` shows the no-match message and hides the table for a query with no matches.
- `search-clear` restores all rows when the query is emptied.

## How to get to it (user POV)

- Type in the `Search models` box in the dataset card.

## Driving it with verify helpers

Preconditions:

- Baseline state holds with the 3-model fixture showing 3 rows.

- **Narrow.** Enter `llama`. Run `node helpers/cdp-eval.mjs --eval "document.getElementById('searchInput').value='llama';document.getElementById('searchInput').dispatchEvent(new Event('input',{bubbles:true}))" --settle-ms 500`. Then run `node helpers/cdp-eval.mjs --eval "document.querySelectorAll('#tbody tr').length"`. The printed value is `1`.
- **Hint.** Read the counter. Run `node helpers/cdp-eval.mjs --eval "document.getElementById('searchHint').textContent"`. The printed value is `"1 of 3"`.
- **Empty.** Enter a query with no matches. Run `node helpers/cdp-eval.mjs --eval "document.getElementById('searchInput').value='zzz-no-such-model';document.getElementById('searchInput').dispatchEvent(new Event('input',{bubbles:true}))" --settle-ms 500`. Then run `node helpers/cdp-eval.mjs --eval "document.querySelectorAll('#tbody tr').length + '|' + document.getElementById('emptyMsg').hidden + '|' + document.getElementById('emptyMsg').textContent + '|' + document.getElementById('searchHint').textContent"`. The printed value is `"0|false|No models match your search.|0 of 3"`.
- **Clear.** Empty the box. Run `node helpers/cdp-eval.mjs --eval "document.getElementById('searchInput').value='';document.getElementById('searchInput').dispatchEvent(new Event('input',{bubbles:true}))" --settle-ms 500`. Then run `node helpers/cdp-eval.mjs --eval "document.querySelectorAll('#tbody tr').length"`. The printed value is `3`.
- **Proof.** Capture the narrowed state. Run `node helpers/cdp-eval.mjs --eval "document.getElementById('searchInput').value='stealth';document.getElementById('searchInput').dispatchEvent(new Event('input',{bubbles:true}))" --settle-ms 500 --viewport 1280x1000 --dump $env:TEMP/verify-free-models/$rid/artifacts/search-filter/dom.txt --screenshot $env:TEMP/verify-free-models/$rid/artifacts/search-filter/shot.png`. The dump contains one `cell-id` cell holding `stealth/space-bunny-alpha`.

## Gotchas

- Matching is case-insensitive and covers ID and name together; `GROK` matches the Grok row.
- Filtering is immediate on `input`; there is no debounce to wait for, but keep the settle step so the render lands before the read.
- Leaving a query in the box changes later recipes: always clear it at the end of a drive.
