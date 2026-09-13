# Deploy

このリポジトリの変更がどこに反映されるかの対応表と、手順をまとめる。

## 変更と反映先の対応表

| 変更ファイル | 反映先 | 反映方法 |
| --- | --- | --- |
| `website/src/cron.ts` | Cloudflare Workers（Cron） | 手動デプロイが必要 |
| `website/public/*`、`website/functions/*` | Cloudflare Pages | 手動デプロイが必要 |
| `scripts/post_openrouter_free_models.py` | GitHub Actions（Bluesky 投稿） | git push のみ。次回定時実行から有効 |
| `website/README.md`、`Deploy.md` | なし（ドキュメント） | デプロイ不要 |

## 前提条件

- `website/` で `pnpm install` 済みであること
- Cloudflare にログイン済みであること（`pnpm wrangler login`）
- KV 名前空間 `FREE_MODELS_KV` が `website/wrangler.toml` に設定済みであること

## 1. Cron Worker のデプロイ

フィルタロジック（無料判定）の変更はこちら。最も重要なデプロイ。

```bash
cd website
pnpm deploy:cron
```

## 2. Pages のデプロイ

静的サイト（`public/`）と Pages Function（`functions/`）の変更はこちら。

```bash
cd website
pnpm deploy:pages
```

## 3. KV の即時更新（任意）

Worker をデプロイしても、KV には前回取得の古いデータが残る。次の毎時 cron 実行まで表示は変わらない。すぐ反映したい場合は手動トリガーする。`CRON_SECRET` が Worker に設定済みであること。

```powershell
Invoke-WebRequest -Method POST `
  -Uri "https://<worker>/__scheduled" `
  -Headers @{ Authorization = "Bearer <CRON_SECRET>" }
```

## 4. Bluesky 投稿スクリプト

`.github/workflows/post-openrouter-free-models.yml` の定時実行（UTC 0:00 / 12:00）で動く。Cloudflare へのデプロイは不要。git push 後、次回実行から新ロジックになる。手動実行したい場合は Actions の `workflow_dispatch` を使う。

## 動作確認

1. `https://<pages>/api/models` を開く
2. 件数が期待値（2026-09-13 時点で 25 件）であること
3. 非無料モデル（例：`google/lyria-3-clip-preview`）が含まれていないこと
4. 音声無料モデル（例：`deepgram/flux-tts:free`）が含まれていること

注意：API 応答は 60 秒キャッシュ（`Cache-Control: public, max-age=60`）される。デプロイ直後の確認では 1 分待つこと。

## トラブルシューティング

- 表示が変わらない → KV が未更新の可能性。手順 3 の手動トリガーを行う
- `/api/models` が 503 → KV が空。手順 3 の手動トリガーで初回データを作成する
- 手動トリガーが 403 → `CRON_SECRET` 未設定。Worker の環境変数を確認する
