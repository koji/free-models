# OpenRouter Free Models — Website

Hourly updated list of free models on OpenRouter. Cloudflare Workers Cron + Pages.

- Cron Worker: fetches `https://openrouter.ai/api/v1/models` every hour, filters free models, stores to KV
- Pages: static site (`public/`) + Pages Function (`functions/api/models.ts`) that reads KV

> Existing `scripts/post_openrouter_free_models.py` and `.github/workflows/post-openrouter-free-models.yml` are not modified.

## Architecture

- `website/src/cron.ts` — Cron Worker (plain TypeScript, `scheduled` + `fetch` for health check)
- `website/functions/api/models.ts` — Pages Function `GET /api/models`
- `website/public/` — static site (plain HTML/CSS/JS, no build)
- KV binding: `FREE_MODELS_KV`, key: `openrouter:free-models:latest`
- Stored payload: `{ updatedAt: ISO8601, count: number, models: [{ id, name, context_length }] }`

## Setup

### 1. Create KV namespace

```bash
cd website
pnpm wrangler kv namespace create FREE_MODELS_KV
# preview:
pnpm wrangler kv namespace create FREE_MODELS_KV --preview
```

Copy the returned `id` values into `wrangler.toml`:

```toml
[[kv_namespaces]]
binding = "FREE_MODELS_KV"
id = "YOUR_KV_ID"
preview_id = "YOUR_PREVIEW_KV_ID"
```

### 2. Bind KV to Pages (dashboard)

Cloudflare Dashboard → Pages → your project → Settings → Functions → KV namespace bindings:

- Variable name: `FREE_MODELS_KV`
- KV namespace: same as above

### 3. Local dev

```bash
cd website
pnpm install

# Cron Worker (local, Miniflare KV)
pnpm dev:cron
# Trigger scheduled run manually:
# curl -X POST http://localhost:8787/__scheduled

# Pages + Functions (local)
pnpm dev:pages
# open http://localhost:8788
```

### 4. Deploy

```bash
cd website

# Cron Worker
pnpm deploy:cron

# Pages (static + Functions)
pnpm deploy:pages
# or: pnpm wrangler pages deploy public --project-name openrouter-free-models
```

## API

- `GET /api/models` → `200 { updatedAt, count, models }` with `Cache-Control: public, max-age=60`
- KV empty → `503 { error: "data not yet available" }`

## Data logic

- Free model = every numeric field in `pricing` is `0`, with at least one numeric field present (mirrors `scripts/post_openrouter_free_models.py:is_free_pricing`)
- Sorted by `model_id` (case-insensitive) by default
- On fetch failure: KV is not overwritten (previous data kept), one retry with backoff

## Design

Uses 1881 Ventures design tokens (light background `#ffffff`, primary `#529fcb`, accent `#211f54`, border `#d5d5d5`).
