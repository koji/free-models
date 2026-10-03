# Free-model filter conformance tests

The free-model filter is implemented twice in this repo:

- Python: `is_free_model` / `is_free_pricing` in `scripts/post_openrouter_free_models.py`
- TypeScript: `isFreeModel` / `isFreePricing` in `website/src/cron.ts`

`fixtures/free-model-cases.json` is the single shared conformance fixture both
implementations are tested against. Each case is
`{ "description", "id", "pricing", "expected" }`. If you change the filter
definition (e.g. OpenRouter adds a new free marker), update the fixture first,
then make both suites pass.

## Running the suites

From the repo root:

```sh
# Python (Bluesky poster)
python3 -m unittest discover -s scripts/tests -v

# TypeScript (website cron) — plain Node, no test runner or build step.
# Requires Node >= 22.18 (native TypeScript type stripping).
node website/tests/cron.filter.test.mts
```

## Per-implementation overrides

Most cases share one `expected` value. Three edge cases carry
`expected_py` / `expected_ts` overrides because Python's
`Decimal(str(v))` and TypeScript's `Number(String(v))` disagree on inputs that
never occur in real OpenRouter payloads (pricing is always a JSON object of
numeric values):

| case | Python | TypeScript | why |
|---|---|---|---|
| pricing `{"prompt": " "}` (whitespace-only) | `false` | `true` | `Decimal(" ")` raises, `Number(" ")` is `0` |
| pricing `{"prompt": "0x10", ...}` | skips the hex value | treats it as `16` | `Decimal` rejects hex, `Number` parses it |
| pricing as an array `["0"]` | `false` | `true` | Python requires a `dict`; TS accepts any object |

Do not add an override to paper over a disagreement on realistic data —
align the implementations instead.
