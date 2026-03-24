# R2 + SQLite アーキテクチャ移行計画

## 背景と課題

現状、議会議事録データを PostgreSQL（Supabase）に蓄積しているが、以下の課題がある。

- **データ量の爆発的増加**: 全国約 1,700 自治体 × 年 4 回議会 × 複数発言 で statements テーブルが巨大化
- **コスト**: Supabase の有料プランや Hyperdrive のコストが増大
- **クエリ遅延**: フルテキスト検索・ベクター検索が大規模データでスケールしにくい
- **運用複雑度**: pgvector 拡張・tsvector 生成カラムなど PostgreSQL 固有機能への依存

## 提案アーキテクチャ

### 概要

スクレイパーが自治体ごと（または都道府県単位）に **SQLite ファイルを生成** し、**Cloudflare R2 にアップロード**する。Web アプリはリクエスト時に R2 から SQLite ファイルを取得してクエリを実行する。

```
[scraper-worker]
    ↓ 議会データをスクレイプ
[SQLite ファイル生成]
    ↓ アップロード
[Cloudflare R2]
    ↓ ダウンロード（オンデマンドまたはキャッシュ）
[apps/web / API Worker]
    ↓ SQLite クエリ
[ユーザーへレスポンス]
```

### R2 上のファイル構成

```
r2://open-gikai-db/
├── index.sqlite              # 自治体マスタ・system_types（軽量、全体共通）
├── municipalities/
│   ├── 011001.sqlite         # 札幌市の全議事録
│   ├── 011002.sqlite         # 函館市の全議事録
│   └── ...
├── prefectures/
│   ├── 01.sqlite             # 北海道全体（小規模自治体をまとめる場合）
│   └── ...
└── search/
    └── fts_index.sqlite      # 全文検索用インデックス（定期再ビルド）
```

**分割戦略の選択肢**:
- **自治体単位**: 検索範囲を絞り込める。大規模自治体は大きくなりすぎる可能性
- **都道府県単位**: バランスが良い。クロス市区町村検索も対応しやすい
- **年度単位**: `011001_2024.sqlite` のように年度で分割し、差分更新を容易にする

→ **推奨: 都道府県単位 + 年度サフィックス** (`01_2024.sqlite`)

### SQLite スキーマ（変更点）

PostgreSQL 固有機能を SQLite 対応に変換する。

```sql
-- meetings テーブル（変更なし）
CREATE TABLE meetings (
  id TEXT PRIMARY KEY,
  municipality_id TEXT NOT NULL,
  title TEXT,
  meeting_type TEXT,
  held_on TEXT,  -- DATE → TEXT (ISO 8601)
  source_url TEXT,
  external_id TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT
);

-- statements テーブル（tsvector 削除、FTS5 は仮想テーブルで対応）
CREATE TABLE statements (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES meetings(id),
  kind TEXT,
  speaker_name TEXT,
  speaker_role TEXT,
  content TEXT NOT NULL,
  content_hash TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- FTS5 仮想テーブル（全文検索）
CREATE VIRTUAL TABLE statements_fts USING fts5(
  id UNINDEXED,
  content,
  speaker_name,
  content='statements',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- statement_chunks テーブル（embedding を JSON で保存）
CREATE TABLE statement_chunks (
  id TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL,
  speaker_name TEXT,
  speaker_role TEXT,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  content_hash TEXT,
  embedding TEXT,  -- JSON array (Float32Array → JSON)
  created_at TEXT DEFAULT (datetime('now'))
);

-- インデックス
CREATE INDEX idx_meetings_municipality_id ON meetings(municipality_id);
CREATE INDEX idx_meetings_held_on ON meetings(held_on);
CREATE INDEX idx_statements_meeting_id ON statements(meeting_id);
CREATE INDEX idx_chunks_meeting_id ON statement_chunks(meeting_id);
```

### 全文検索の実装

PostgreSQL の `tsvector` / `to_tsquery` を **SQLite FTS5** で置き換える。

```typescript
// 現在（PostgreSQL）
const results = await db.execute(sql`
  SELECT * FROM statements
  WHERE content_tsv @@ plainto_tsquery('japanese', ${query})
`);

// 移行後（SQLite FTS5）
const results = db.prepare(`
  SELECT s.* FROM statements_fts fts
  JOIN statements s ON s.id = fts.id
  WHERE statements_fts MATCH ?
  ORDER BY rank
  LIMIT ?
`).all(query, limit);
```

**日本語トークナイズの課題**: SQLite の `unicode61` トークナイザは日本語の分かち書きに対応していない。対策：
1. **インデックス時にアプリ側でトークナイズ**: kuromoji / Sudachi で形態素解析してスペース区切りで保存
2. **N-gram アプローチ**: 2-gram や 3-gram で content を前処理してから FTS5 に投入
3. **外部検索エンジン**: Cloudflare Vectorize や Orama をオプションで検討

→ **推奨: 2-gram + FTS5**（シンプルで依存なし）

### ベクター検索の実装

`pgvector` の `<->` 演算子を使ったコサイン類似度検索の代替。

**オプション A: SQLite-VSS（sqlite-vss 拡張）**
- Cloudflare Workers では実行困難（native 拡張が必要）

**オプション B: embedding を JSON で保存 → アプリ層でコサイン類似度計算**
```typescript
// 対象チャンクを絞り込んでからコサイン類似度でソート
const chunks = db.prepare(`
  SELECT id, embedding, content FROM statement_chunks
  WHERE meeting_id IN (SELECT id FROM meetings WHERE municipality_id = ?)
`).all(municipalityId);

const queryEmbedding = await generateEmbedding(query);
const ranked = chunks
  .map(chunk => ({
    ...chunk,
    score: cosineSimilarity(queryEmbedding, JSON.parse(chunk.embedding)),
  }))
  .sort((a, b) => b.score - a.score)
  .slice(0, topK);
```

→ **推奨: オプション B**（自治体 or 都道府県単位で絞り込めば対象件数が現実的な範囲に収まる）

**オプション C: Cloudflare Vectorize**
- embedding を Vectorize に別途保存し、セマンティック検索は Vectorize API 経由
- 実装コストが高いため、フェーズ 2 以降で検討

## 実装フェーズ

### フェーズ 1: SQLite ファイル生成パイプライン

1. **`packages/db-sqlite`** パッケージを新規作成
   - SQLite スキーマ定義（Drizzle ORM の `better-sqlite3` dialect）
   - SQLite ファイルのビルダー関数
   - FTS5 インデックス構築ロジック（2-gram トークナイズ）

2. **`apps/db-builder`** スクリプトを作成
   - PostgreSQL から都道府県単位でデータを読み込み
   - SQLite ファイルを生成・FTS5 インデックスを構築
   - R2 にアップロード（`wrangler r2 object put` または AWS SDK）

3. **CI/CD**: GitHub Actions で定期実行（週 1 回 or スクレイプ完了後）

### フェーズ 2: Web アプリの R2 対応

1. **`packages/r2-client`** パッケージ（または `packages/api` 内に追加）
   - R2 からSQLiteファイルをダウンロードする関数
   - インメモリキャッシュ（Workers の `caches` API or KV）

2. **API ルーターの更新**
   - `statements.service.ts` を PostgreSQL クエリ → SQLite クエリに変更
   - 検索ロジックを FTS5 ベースに書き換え

3. **キャッシュ戦略**
   - Cloudflare Workers のメモリキャッシュ（同一リクエスト内）
   - Cache API でリクエスト間キャッシュ（TTL: 1 時間）
   - ファイルサイズが大きい場合はストリーミング + Range リクエストを検討

### フェーズ 3: PostgreSQL の段階的廃止

1. 認証・セッションデータ（`users`, `sessions`）は PostgreSQL に残す
2. スクレイパージョブ管理（`scraper_jobs`, `scraper_job_logs`）は PostgreSQL に残す
3. 議会コンテンツ（`meetings`, `statements`, `statement_chunks`）を R2/SQLite に移行
4. `municipalities`, `system_types` を `index.sqlite` に移行

## 技術的なトレードオフ

| 観点 | 現在（PostgreSQL） | 移行後（R2 + SQLite） |
|------|-------------------|----------------------|
| 全文検索精度 | tsvector（日本語対応） | FTS5 + 2-gram（精度やや低下） |
| ベクター検索 | pgvector（高速） | アプリ層コサイン計算（低速だが絞り込みで緩和） |
| スケール | DB スケールアップ必要 | ファイル分割で水平スケール可能 |
| コスト | Supabase 従量課金 | R2 は読み取り無料、保存コストのみ |
| リアルタイム性 | 即時反映 | SQLite 再生成 + アップロードまでラグあり |
| 更新複雑度 | INSERT/UPDATE | ファイル全体の再ビルドが基本 |
| 読み取り一貫性 | トランザクション保証 | スナップショット読み取り（ファイル単位） |

## 未解決事項（要検討）

1. **SQLite ファイルの最大サイズ**: 都道府県単位でどの程度になるか見積もりが必要
2. **Workers でのSQLite実行方法**: `@cloudflare/workers-types` での better-sqlite3 利用可否 → Durable Objects の SQLite API または `@sqlite.org/sqlite-wasm` の WASM 版を利用
3. **差分更新**: ファイル全体の再ビルドかスクレイプ済みデータのみ追記かの戦略
4. **認証が必要なAPIとの統合**: 認証は引き続き PostgreSQL で管理し、コンテンツのみ R2 から取得するハイブリッド構成

## 参考

- [Cloudflare R2 ドキュメント](https://developers.cloudflare.com/r2/)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [Drizzle ORM - LibSQL/SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- [Cloudflare Durable Objects SQLite](https://developers.cloudflare.com/durable-objects/api/storage-api/#sqlite)
