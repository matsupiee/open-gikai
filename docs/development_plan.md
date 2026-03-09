# 議会答弁ブレ防止支援ツール 開発計画書

> 設計の詳細は [mvp_design.md](./mvp_design.md) を参照。

---

## 1. プロジェクト概要

公開されている国会・地方議会の議事録をスクレイピングで取り込み、過去答弁をキーワード・類似検索できる Web アプリケーションを構築する。

**MVP ゴール（Done の定義）:**
- `bun run scrape` で議事録を DB に取り込める
- 都道府県・自治体名・日付範囲で絞り込んで過去答弁を検索できる
- キーワード検索（全文）と類似検索（ベクトル）の両方が動く

---

## 2. 技術スタック

| レイヤー | 技術 | 備考 |
|----------|------|------|
| ビルドシステム | Turborepo + Bun 1.3.10 | モノレポ管理 |
| フロントエンド | React 19 + TanStack Start | SSR, ファイルベースルーティング |
| データフェッチ | TanStack Query | サーバー状態管理 |
| UI コンポーネント | shadcn/ui + TailwindCSS 4 | すでに導入済み |
| API | oRPC | 型安全 RPC |
| データベース | PostgreSQL + pgvector | Supabase でホスティング |
| ORM | Drizzle ORM 0.45.1 | スキーマ定義・マイグレーション |
| 認証 | Better-Auth | すでに実装済み |
| 埋め込みモデル | OpenAI `text-embedding-3-small` | 1536 次元、類似検索用 |
| スクレイピング | Bun fetch + cheerio | NDL API & 地方議会 HTML |

---

## 3. 現状（実装済み）

| ファイル / パッケージ | 内容 |
|----------------------|------|
| `packages/auth/` | Better-Auth 設定 |
| `packages/db/src/schema/auth.ts` | 認証テーブル（Drizzle） |
| `packages/db/src/index.ts` | `drizzle()` インスタンス export |
| `packages/env/src/server.ts` | サーバー環境変数バリデーション |
| `packages/api/src/index.ts` | `publicProcedure` / `protectedProcedure` |
| `packages/api/src/routers/index.ts` | `appRouter`（healthCheck のみ） |
| `apps/web/src/routes/` | ログイン・ダッシュボード画面 |
| `apps/web/src/components/ui/` | shadcn/ui コンポーネント群 |

---

## 4. 実装対象ファイル一覧

### 新規作成

| ファイル | 説明 |
|---------|------|
| `packages/db/src/schema/meetings.ts` | `meetings` テーブル定義 |
| `packages/db/src/schema/statements.ts` | `statements` テーブル定義（pgvector, GIN） |
| `packages/db/src/schema/policy-tags.ts` | `policy_tags` / `statement_policy_tags` |
| `packages/api/src/services/embedding.ts` | OpenAI 埋め込み生成サービス |
| `packages/api/src/services/statement-processing.ts` | 発言分割・embedding 付与 |
| `packages/api/src/routers/meetings.ts` | meetings CRUD + フィルタ |
| `packages/api/src/routers/statements.ts` | 全文検索 + ベクトル検索 |
| `apps/web/src/routes/meetings/index.tsx` | 議事録ブラウザ画面 |
| `apps/web/src/routes/search/index.tsx` | 答弁検索画面 |
| `apps/scraper/package.json` | スクレイパーパッケージ |
| `apps/scraper/src/index.ts` | CLI エントリポイント |
| `apps/scraper/src/scrapers/ndl.ts` | 国会議事録 API スクレイパー |
| `apps/scraper/src/scrapers/local.ts` | 地方議会 HTML スクレイパー |
| `apps/scraper/src/utils/db-writer.ts` | DB 書き込みユーティリティ |
| `apps/scraper/scraper-targets.json` | 地方議会サイト設定 |

### 更新

| ファイル | 変更内容 |
|---------|---------|
| `packages/db/src/schema/index.ts` | 新スキーマを export に追加 |
| `packages/env/src/server.ts` | `OPENAI_API_KEY` 追加 |
| `packages/api/src/routers/index.ts` | meetings / statements ルーターを登録 |
| `apps/web/src/routes/__root.tsx` | ナビゲーションに 2 画面を追加 |

---

## 5. 実装フェーズ

依存関係に基づいた 4 ウェーブ構成。各ウェーブ内は並列実行可能。

### Wave 1（前提なし・並列）

**Agent A: DB スキーマ**
- `packages/db/src/schema/meetings.ts` 作成
  - assembly_level / prefecture / municipality / external_id / scraped_at を含む
  - UNIQUE(assembly_level, external_id)
  - インデックス: held_on, meeting_type, assembly_level, prefecture, municipality
- `packages/db/src/schema/statements.ts` 作成
  - content_tsv GENERATED カラム + GIN インデックス
  - HNSW インデックス on embedding(vector(1536))
- `packages/db/src/schema/policy-tags.ts` 作成
- `packages/db/src/schema/index.ts` 更新

**Agent B: 環境変数 + 埋め込みサービス**
- `packages/env/src/server.ts` に `OPENAI_API_KEY: z.string()` 追加
- `packages/api/src/services/embedding.ts` 作成
  - `generateEmbedding(text: string): Promise<number[]>`
  - モデル: `text-embedding-3-small`（1536 次元）

```
Wave1(DB スキーマ, env + embedding)
  ↓
Wave2(statement-processing, スクレイパー)
  ↓
Wave3(API ルーター)
  ↓
Wave4(フロントエンド 2 画面)
```

---

### Wave 2（Wave 1 完了後・並列）

**Agent C: 発言処理サービス**
- `packages/api/src/services/statement-processing.ts` 作成
  - `splitIntoStatements(rawText: string): StatementChunk[]`
    - `○発言者名：` パターンで発言単位に分割
    - kind 推定 (question / answer / remark / unknown)
    - content_hash (SHA-256) 生成
  - `processMeeting(meetingId: string, db): Promise<void>`
    - rawText → 分割 → embedding 生成 → statements 一括 INSERT
    - status: pending → processing → done / failed

**Agent D: スクレイパーパッケージ**
- `apps/scraper/` を新規パッケージとして追加
- `apps/scraper/src/scrapers/ndl.ts`
  - `GET https://kokkai.ndl.go.jp/api/speech` を叩く
  - レスポンスから SpeechRecord[] を取得
  - ON CONFLICT DO NOTHING で重複スキップ
  - リクエスト間に 500ms delay
- `apps/scraper/src/scrapers/local.ts`
  - `scraper-targets.json` の設定を読み込み
  - fetch + cheerio で HTML パース
- `apps/scraper/src/utils/db-writer.ts`
  - meeting INSERT → `processMeeting()` 呼び出し
  - 成功/スキップ/失敗件数をログ出力
- `apps/scraper/src/index.ts`
  - CLI: `--source ndl|local --from YYYY-MM --until YYYY-MM --prefecture XX --municipality XX`

---

### Wave 3（Wave 2 完了後・並列）

**Agent E: meetings ルーター**
- `packages/api/src/routers/meetings.ts`
  - `meetings.list`: heldOnFrom, heldOnTo, meetingType, assemblyLevel, prefecture, municipality, cursor
  - `meetings.get`: ID + statements 件数
  - `meetings.process`: 手動再処理トリガー（embedding 付与し直し）
- `packages/api/src/routers/index.ts` 更新

**Agent F: statements ルーター**
- `packages/api/src/routers/statements.ts`
  - `statements.search`: GIN 全文検索 + フィルタ（kind, speakerName, tagIds, heldOnFrom, heldOnTo, prefecture, municipality, assemblyLevel）
  - `statements.semanticSearch`: embedding 生成 → pgvector cosine 類似度 topK
- `packages/api/src/routers/index.ts` 更新

---

### Wave 4（Wave 3 完了後・並列）

**Agent G: 議事録ブラウザ画面**
- `apps/web/src/routes/meetings/index.tsx`
  - フィルタ UI: 都道府県セレクト、自治体名テキスト、会議種別、日付範囲、議会レベル
  - 一覧テーブル: タイトル、都道府県/自治体、開催日、ステータスバッジ
  - 行クリックで詳細（発言一覧）
  - TanStack Query でデータフェッチ

**Agent H: 答弁検索画面 + ナビ更新**
- `apps/web/src/routes/search/index.tsx`
  - キーワード / 類似検索切り替えトグル
  - フィルタ: 日付範囲、会議種別、kind、都道府県、自治体名、議会レベル
  - 結果カード: 発言内容、会議名、日付、発言者、source_url
  - TanStack Query でデータフェッチ
- `apps/web/src/routes/__root.tsx` のナビに 2 画面を追加

---

## 6. 依存パッケージ追加

```bash
# packages/api
bun add openai

# packages/api
bun add --dev @types/node   # crypto.createHash 等

# apps/scraper（新規パッケージ）
bun add cheerio
bun add @open-gikai/db @open-gikai/env
```

---

## 7. DB マイグレーション手順

```bash
# 1. pgvector 拡張を有効化（初回のみ）
# → Supabase ダッシュボード または migration SQL で
# CREATE EXTENSION IF NOT EXISTS vector;

# 2. スキーマ変更を DB に反映
cd packages/db
bun run db:generate   # マイグレーションファイル生成
bun run db:push       # DB に適用
```

---

## 8. 検証手順

```bash
# 1. 国会議事録を取り込む
bun run scrape --source ndl --from 2024-01 --until 2024-01

# 2. DB に meetings / statements が入っていることを確認
bun run db:studio

# 3. Web アプリを起動
bun run dev

# 4. 議事録ブラウザ (/meetings) でフィルタが動くことを確認

# 5. 答弁検索 (/search) でキーワード検索・類似検索がヒットすることを確認
```

---

## 9. 注意事項

- **NDL API レート制限**: 1 リクエストごとに 500ms delay を挿入。並列取得禁止。
- **地方議会 HTML 構造の多様性**: `scraper-targets.json` でセレクタを外部設定化。MVP では 1〜2 サイトのみ実装例を用意。
- **発言分割の精度**: 「○発言者：」パターンによるヒューリスティック分割。精度は MVP 後に改善。
- **pgvector HNSW インデックス**: データ 0 件でも作成可能。大量データ投入後に `REINDEX` 推奨。
- **embedding コスト**: `text-embedding-3-small` は低コストだが、大量インポート時は API コールをバッチ化すること。
