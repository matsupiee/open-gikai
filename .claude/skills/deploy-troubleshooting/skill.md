---
name: deploy-troubleshooting
description: GitHub Actions デプロイ失敗時の調査・対応手順
version: 1.1.0
source: local-git-analysis
---

# Deploy Troubleshooting

## デプロイパイプラインの構成

```
main push → GitHub Actions (.github/workflows/deploy.yml)
  ├─ Step 1: bun install --frozen-lockfile
  ├─ Step 2: bun run db:migrate   (turbo → drizzle-kit migrate)
  └─ Step 3: bun run deploy       (turbo → alchemy deploy)
```

- `db:migrate` が失敗するとデプロイは実行されない（安全）
- `concurrency: deploy` により同時実行は1つだけ

## DB 接続の使い分け

| 用途 | GitHub Secret | 接続先 |
|------|--------------|--------|
| マイグレーション | `DATABASE_MIGRATION_URL` | Supabase Session Pooler（IPv4） |
| ランタイム（Workers） | `DATABASE_URL` | Supabase 直接接続（IPv6 可） |

**なぜ分けるか:** GitHub Actions ランナーは IPv6 非対応。Supabase の直接接続ホスト (`db.*.supabase.co`) は IPv6 のみを返すため、マイグレーションには IPv4 対応の Session Pooler を使う。

**注意:** Transaction Pooler はマイグレーションに使えない（prepared statements 非対応のため DDL が失敗する可能性あり）。必ず **Session Pooler** を使うこと。

---

## 調査手順

### 1. 失敗したワークフローのログを確認する

```bash
# 最近の実行一覧
gh run list --limit 5

# 失敗したランのログを表示（失敗ステップのみ）
gh run view <RUN_ID> --log-failed

# 全ログが必要な場合
gh run view <RUN_ID> --log
```

### 2. 失敗箇所を特定する

ログから失敗したステップを確認し、以下のどれかに分類する:

| 失敗ステップ | 分類 |
|---|---|
| `bun install` | 依存関係の問題 |
| `Run database migrations` | DB マイグレーション失敗 |
| `Deploy to Cloudflare` | Alchemy / Cloudflare デプロイ失敗 |

---

## エラー別の対処法

### A. `bun install --frozen-lockfile` の失敗

**原因:** `bun.lock` と `package.json` の不整合

**対処:**
```bash
# ローカルで lockfile を再生成
bun install
git add bun.lock
git commit -m "fix: update bun.lock"
git push
```

---

### B. DB マイグレーション失敗

#### B-1. `url: ''` — DATABASE_URL が空

**ログ例:**
```
Error  Please provide required params for Postgres driver:
    [x] url: ''
```

**原因:** 環境変数が turbo の子プロセスに渡っていない

**対処:** `turbo.json` の `db:migrate` タスクに `env` を追加:
```json
"db:migrate": {
  "cache": false,
  "env": ["DATABASE_URL"]
}
```

#### B-2. `ENETUNREACH` — IPv6 接続エラー

**ログ例:**
```
cause: Error: connect ENETUNREACH 2406:da12:... - Local (:::0)
```

**原因:** GitHub Actions ランナーが IPv6 非対応で、Supabase 直接接続（IPv6 のみ）に到達できない

**対処:**
1. Supabase ダッシュボード > Settings > Database から **Session Pooler** の接続文字列を取得
2. GitHub Secret `DATABASE_MIGRATION_URL` に Session Pooler URL を設定:
   ```bash
   gh secret set DATABASE_MIGRATION_URL
   ```
3. `.github/workflows/deploy.yml` のマイグレーションステップで `DATABASE_MIGRATION_URL` を使っているか確認

#### B-3. マイグレーション SQL のエラー

**ログ例:**
```
error: relation "xxx" already exists
error: column "xxx" does not exist
```

**原因:** 本番DBの状態とマイグレーションファイルの不整合

**対処:**
1. `packages/db/src/migrations/` の最新ファイルを確認
2. 本番 DB のスキーマ状態を確認（Supabase ダッシュボードまたは psql）
3. 必要に応じてマイグレーションを修正して `drizzle-kit generate` で再生成

#### B-4. 接続タイムアウト / 認証エラー

**ログ例:**
```
error: connection refused
error: password authentication failed
```

**対処:**
1. GitHub Secrets が正しいか確認: `gh secret list`
2. Supabase のステータスを確認（ダッシュボード）
3. 必要に応じて Secret を再設定: `gh secret set DATABASE_MIGRATION_URL`

---

### C. Alchemy デプロイ失敗

#### C-1. Cloudflare 認証エラー

**ログ例:**
```
Authentication error
```

**対処:**
1. `CLOUDFLARE_API_TOKEN` が設定されているか確認
2. トークンの権限が十分か確認（Edit Cloudflare Workers テンプレート推奨）
3. トークンが失効していれば Cloudflare ダッシュボードで再発行:
   ```bash
   gh secret set CLOUDFLARE_API_TOKEN
   ```

#### C-2. 環境変数の不足

**ログ例:**
```
TypeError: Cannot read properties of undefined
```

**原因:** `alchemy.run.ts` が参照する環境変数が GitHub Secrets に未登録

**対処:**
必要な Secrets が全て登録されているか確認:
```bash
gh secret list
```

必要な Secrets 一覧:
- `CLOUDFLARE_API_TOKEN`
- `ALCHEMY_PASSWORD`
- `DATABASE_URL`（ランタイム用・直接接続）
- `DATABASE_MIGRATION_URL`（マイグレーション用・Session Pooler）
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `CORS_ORIGIN`

一括登録する場合:
```bash
gh secret set -f apps/web/.env
gh secret set -f packages/infra/.env
```

#### C-3. Worker ビルドエラー

**原因:** TypeScript コンパイルエラーや依存関係の問題

**対処:**
1. ローカルで `bun run build` を実行してエラーを確認
2. エラーを修正してコミット・push

---

### D. turbo が環境変数を渡さない問題（共通）

turbo はデフォルトで環境変数を子プロセスにパススルーしない。
新しい環境変数を追加した場合は `turbo.json` の該当タスクの `env` 配列に追加が必要。

**関連ファイル:** `turbo.json`

```json
"db:migrate": {
  "cache": false,
  "env": ["DATABASE_URL"]
},
"deploy": {
  "cache": false,
  "env": [
    "CLOUDFLARE_API_TOKEN",
    "ALCHEMY_PASSWORD",
    "DATABASE_URL",
    "BETTER_AUTH_SECRET",
    "BETTER_AUTH_URL",
    "CORS_ORIGIN"
  ]
}
```

---

## 手動リトライ

修正不要で再実行したい場合（一時的なネットワーク障害など）:

```bash
gh run rerun <RUN_ID>
```

---

## 関連ファイル

| ファイル | 役割 |
|----------|------|
| `.github/workflows/deploy.yml` | ワークフロー定義 |
| `turbo.json` | タスク定義・環境変数パススルー |
| `packages/db/drizzle.config.ts` | マイグレーション設定 |
| `packages/infra/alchemy.run.ts` | Cloudflare デプロイ定義 |
| `packages/infra/README.md` | デプロイ概要・Secrets 一覧 |
