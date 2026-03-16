# @open-gikai/infra

Alchemy を使った Cloudflare Workers へのデプロイを管理するパッケージ。

## デプロイの仕組み

`main` ブランチへの push をトリガーに、GitHub Actions が以下を順番に実行する:

1. **DB マイグレーション** (`drizzle-kit migrate`)
2. **Cloudflare Workers デプロイ** (`alchemy deploy`)

ワークフロー定義: `/.github/workflows/deploy.yml`

ローカルからのデプロイは廃止済み。すべて CI/CD 経由で行う。

## シークレット管理

GitHub リポジトリの Secrets に登録された値が CI/CD で使用される。
Alchemy がデプロイ時にこれらを読み取り、Cloudflare Workers Secrets に自動同期する。

### 必要な GitHub Secrets

| Secret | 用途 |
|--------|------|
| `CLOUDFLARE_API_TOKEN` | Cloudflare API 認証 |
| `ALCHEMY_PASSWORD` | Alchemy の state 暗号化 |
| `DATABASE_URL` | Workers binding（直接接続） |
| `DATABASE_MIGRATION_URL` | DB マイグレーション用（Session Pooler, IPv4） |
| `BETTER_AUTH_SECRET` | 認証用シークレット（Workers binding） |
| `BETTER_AUTH_URL` | 認証のベース URL（Workers binding） |
| `CORS_ORIGIN` | CORS 設定（Workers binding） |

### Secrets の登録方法

```bash
# .env ファイルから一括登録
gh secret set -f apps/web/.env
gh secret set -f packages/infra/.env

# マイグレーション用の Session Pooler URL（Supabase ダッシュボードから取得）
gh secret set DATABASE_MIGRATION_URL

# Cloudflare API トークン
# https://dash.cloudflare.com/profile/api-tokens で作成（テンプレート: Edit Cloudflare Workers）
gh secret set CLOUDFLARE_API_TOKEN

# 確認
gh secret list
```

## デプロイされるリソース

| リソース | 説明 |
|----------|------|
| `web` | TanStackStart フロントエンド（`apps/web`）、ドメイン: `opengikai.com` |
| `scraper-worker` | スクレイパー Worker（`apps/scraper-worker`）、1分ごとに pending ジョブを確認 |
| `scraper-jobs` | Cloudflare Queue、スクレイパーのメッセージキュー |
