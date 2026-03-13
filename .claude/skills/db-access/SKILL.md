---
name: db-access
description: open-gikai プロジェクトで Claude Code から DB にアクセスする手順（Supabase MCP / psql）
version: 1.0.0
---

# DB アクセス手順

## 構成

| 環境 | 接続先 | 手段 |
|------|--------|------|
| ローカル開発 | `127.0.0.1:54322` (Supabase CLI) | psql |
| 本番 | Supabase クラウドプロジェクト | Supabase MCP |

---

## 1. Supabase MCP（本番・クラウド）

### セットアップ確認

- `.mcp.json` がプロジェクトルートに存在することを確認（`open-gikai/.mcp.json`）
- Claude Code 再起動後に OAuth 認証（ブラウザで Supabase アカウントにログイン）

### 使い方

```
# プロジェクト一覧を確認
mcp__supabase__list_projects を使用

# テーブル一覧
mcp__supabase__list_tables を使用（project_id が必要）

# SQL を直接実行
mcp__supabase__execute_sql を使用
```

**注意**: Supabase MCP は**クラウドプロジェクト**に接続する。ローカル Supabase には接続できないため、ローカル開発時は psql を使う。

---

## 2. psql（ローカル開発）

ローカル Supabase が起動中の場合は psql で直接アクセスできる。

接続文字列: `postgresql://postgres:postgres@127.0.0.1:54322/postgres`（`apps/web/.env` の `DATABASE_URL` を参照）

```bash
# 接続確認
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "SELECT 1;"

# テーブル一覧
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c "\dt"
```

### よく使うクエリ

```bash
# スクレイパージョブの状態確認
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT id, source, status, created_at FROM scraper_jobs ORDER BY created_at DESC LIMIT 10;"

# ジョブログの確認
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "SELECT j.source, j.status, l.level, l.message FROM scraper_jobs j JOIN scraper_job_logs l ON l.job_id = j.id ORDER BY l.created_at DESC LIMIT 20;"

# テーブルをリセット（危険: データ消去）
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -c \
  "TRUNCATE scraper_jobs CASCADE;"
```

---

## 3. スキーマ参照

最新のテーブル定義は `packages/db/src/schema/` を参照すること。スキーマは頻繁に更新される。

---

## 4. ローカル Supabase の起動・停止

```bash
# packages/db ディレクトリで
npx supabase start   # 起動
npx supabase stop    # 停止
npx supabase status  # 状態確認（接続URLなど）
```

起動中は Supabase Studio に http://127.0.0.1:54323 でアクセスできる（GUI でデータ確認可能）。
