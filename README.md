# open-gikai（議会答弁ブレ防止支援ツール）

国会・地方議会の公開議事録をスクレイピングで取り込み、**過去答弁をキーワード検索・類似検索**できる Web アプリケーション。

---

## 概要

議会担当者が過去の答弁を素早く検索し、根拠 URL 付きで確認できるようにすることで、答弁内容のブレや矛盾を防止する。

- 国会議事録 API（NDL）および地方議会サイトから議事録を取得
- キーワード検索（全文）と類似検索（ベクトル）の両方に対応
- 都道府県・自治体名・日付範囲で絞り込み可能

---

## 技術スタック

| レイヤー | 技術 |
|---|---|
| ビルドシステム | Turborepo + Bun |
| フロントエンド | React 19 + TanStack Start (SSR) |
| UI | shadcn/ui + TailwindCSS 4 |
| API | oRPC（型安全 RPC） |
| データベース | PostgreSQL + pgvector（Supabase） |
| ORM | Drizzle ORM |
| 認証 | Better-Auth |
| 埋め込みモデル | OpenAI `text-embedding-3-small`（1536 次元） |
| スクレイピング | Bun fetch + cheerio |

---

## プロジェクト構成

```
open-gikai/
├── apps/
│   ├── web/             # フロントエンド + API サーバー（TanStack Start）
│   └── scraper/         # 議事録スクレイパー CLI
├── packages/
│   ├── api/             # oRPC ルーター・サービス層
│   ├── db/              # Drizzle スキーマ・マイグレーション
│   └── env/             # 環境変数バリデーション（Zod）
└── docs/
    ├── mvp_design.md    # 設計書
    └── development_plan.md  # 開発計画
```

---

## セットアップ

### 1. 依存パッケージのインストール

```bash
bun install
```

### 2. 環境変数の設定

`apps/web/.env` を作成して以下を設定：

```env
DATABASE_URL=postgresql://...
OPENAI_API_KEY=sk-...
```

### 3. データベースのセットアップ

```bash
# pgvector 拡張を有効化（Supabase ダッシュボードまたは migration SQL）
# CREATE EXTENSION IF NOT EXISTS vector;

# スキーマを DB に反映
bun run db:push
```

### 4. 開発サーバーの起動

```bash
bun run dev
```

[http://localhost:3001](http://localhost:3001) でアプリを確認できます。

---

## 議事録の取り込み

```bash
# 国会議事録（NDL API）
bun run scrape --source ndl --from 2024-01 --until 2024-03

# 地方議会（設定ファイルベース）
bun run scrape --source local --prefecture 東京都 --municipality 千代田区
```

地方議会のスクレイピング対象は `apps/scraper/scraper-targets.json` で設定します。

---

## 画面

| 画面 | URL | 説明 |
|---|---|---|
| 議事録ブラウザ | `/meetings` | 取り込み済み議事録の一覧・フィルタ |
| 答弁検索 | `/search` | キーワード / ベクトル検索で過去答弁を検索 |

---

## 利用可能なスクリプト

```bash
bun run dev          # 開発サーバー起動（全アプリ）
bun run build        # ビルド（全アプリ）
bun run check-types  # TypeScript 型チェック
bun run check        # Lint + Format (Oxlint + Oxfmt)

bun run db:push      # スキーマ変更を DB に反映
bun run db:generate  # マイグレーションファイル生成
bun run db:migrate   # マイグレーション実行
bun run db:studio    # Drizzle Studio を起動
```

---

## 今後の予定（MVP 後）

1. スクレイピングの自動スケジューリング
2. 承認ワークフロー
3. 矛盾スコアによるブレ検知
4. 政策タグの自動分類
5. 地方議会スクレイパーの対応サイト拡充
