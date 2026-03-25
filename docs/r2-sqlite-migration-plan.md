# R2 + SQLite + D1 アーキテクチャ移行計画

## 背景と課題

現状、議会議事録データを PostgreSQL（Supabase）に蓄積しているが、以下の課題がある。

- **データ量の爆発的増加**: 全国約 1,700 自治体 × 年 4 回議会 × 複数発言 で statements テーブルが巨大化
- **コスト**: Supabase の有料プランや Hyperdrive のコストが増大
- **クエリ遅延**: フルテキスト検索・ベクター検索が大規模データでスケールしにくい
- **運用複雑度**: pgvector 拡張・tsvector 生成カラムなど PostgreSQL 固有機能への依存
- **ベクトル検索**: 大変なので一旦後回しにしたい。とりあえず全文検索がサポートできれば問題ない

## 初期投入の前提

初回移行は Cloudflare Worker ベースではなく、既存の **`apps/local-bulk-scraper` を使ったローカル一括処理** を前提にする。

- 過去データはローカルで全件スクレイピングし、`meetings.ndjson` / `statements.ndjson` / `statement_chunks.ndjson` を生成する
- SQLite 変換もローカル CLI で実行し、完成した SQLite ファイルだけを R2 にアップロードする
- **`apps/scraper-worker` は初期投入には使わない**。必要なら移行完了後の差分更新フェーズで活用する

## 提案アーキテクチャ

### 概要

初期移行では、`apps/local-bulk-scraper` が出力した NDJSON を入力に、ローカルのビルダー CLI が **SQLite シャードを生成して Cloudflare R2 にアップロード**する。ランタイムでは、議会コンテンツを R2 上の SQLite から読み、認証やジョブ管理のような小さなトランザクショナルデータは D1 に置く。

```
[apps/local-bulk-scraper]
    ↓ 過去データをローカルで一括スクレイプ
[NDJSON 出力]
    ↓ ローカルの builder CLI で SQLite 生成
[upload CLI]
    ↓ アップロード
[Cloudflare R2 (SQLite shards)] ←→ [apps/web / API Worker] ←→ [Supabase]
    議会コンテンツ検索                                           認証 / セッション管理
                ↓
          [ユーザーへレスポンス]
```

### データ配置

- **R2 + SQLite**: `index.sqlite`, `municipalities`, `system_types`, `meetings`, `statements`
- **Supabase**: `users`, `sessions`, `accounts`, `verifications`

### R2 上のファイル構成

```
r2://open-gikai-db/
├── manifests/
│   ├── latest.json           # 現在参照すべきシャード一覧
│   └── 2026-03-24.json       # リリースごとの固定 manifest
├── index.sqlite              # 自治体マスタ・system_types（軽量、全体共通）
└── minutes/
    ├── 2024_hokkaido
    ├── 2024_tohoku
    ├── 2024_kanto
    ├── 2024_chubu
    ├── 2024_kinki
    ├── 2024_chugoku
    ├── 2024_shikoku
    ├── 2024_kyushu
    └── ....
```

**分割戦略の選択肢**
- 1ファイル2GBくらいに納めたい。1ファイル10GBとかになるとキャッシュが効きにくい
- 検索をかける際に、走査するファイル数が増えすぎないようにしたい

**分割戦略の選択肢**:
- シンプル路線
  - **年度単位**: 1ファイルのサイズが大きくなりすぎる
  - **都道府県単位**: 1ファイルのサイズがまだ大きい
  - **自治体単位**: 約 1,700 ファイル規模になり、初期投入や manifest 管理が重い
- 組み合わせ路線
  - **都道府県 + 年度単位**: 10 年分で `47 × 10 = 470` ファイルになり、複数年を検索する際に走査するファイルが多くなる
  - **8地方分類 + 年度単位**: 10 年分で `8 × 10 = 80`ファイル。複数年を検索する際も走査するファイルが減る

**実際のデータ**
- 2024年540自治体のデータが3.6GB -> 1700自治体で11GB
- 1ファイル2GB以下に収めるには1年分を6分割くらいにするのがいい

→ **採用: 8地方分類 + 年度単位**

`manifests/latest.json` のイメージ:

```json
{
  "version": "2026-03-24",
  "prefectures": {
    "01": ["prefectures/01.sqlite"],
    "13": [
      "prefectures/13_2016_2020.sqlite",
      "prefectures/13_2021_2025.sqlite"
    ]
  }
}
```

Web アプリはこの manifest を見て、1ファイル読むか、複数ファイルを順に検索するかを決める。

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

-- statement_chunks → 一旦実装しない（embedding検索は完全に後回しにする）

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

## 実装フェーズ

### フェーズ1: 不要な機能を削除

以下を順番に実行する
- スクレイピング進捗管理画面の削除
- system_types、statement_chunks、scraper_jobs、scraper_job_logsの削除
- apps/scraper-workerの削除

### フェーズ 2: ローカル一括ビルド + R2 初期投入

1. **`packages/db-sqlite`** パッケージを新規作成
   - SQLite スキーマ定義（Drizzle ORM の `better-sqlite3` dialect）
   - SQLite ファイルのビルダー関数
   - FTS5 インデックス構築ロジック（2-gram トークナイズ）

2. **`apps/db-builder`** スクリプトを作成
   - `apps/local-bulk-scraper` の NDJSON 出力を読み込む
   - `index.sqlite` と都道府県シャードを生成・FTS5 インデックスを構築する
   - シャードサイズを見て、必要な県だけ 5 年バケットに分割する
   - `manifests/latest.json` を生成し、R2 にアップロードする（`wrangler r2 object put` または AWS SDK）

3. **初期公開手順を手動で固定**
   - ローカルで `scrape -> build sqlite -> upload` を通しで実行する
   - まずは手動実行で再現性を固め、安定後に GitHub Actions への移行を検討する

### フェーズ 3: Web アプリの R2 / D1 対応

1. **`packages/r2-client`** パッケージ（または `packages/api` 内に追加）
   - R2 からSQLiteファイルをダウンロードする関数
   - `manifests/latest.json` を取得して対象シャードを解決する関数
   - インメモリキャッシュ（Workers の `caches` API or KV）

2. **D1 向け DB 層を追加**
   - `packages/db` を multi-dialect 化するか、`packages/db-d1` を追加する
   - `users`, `sessions`, `accounts`, `verifications`, `scraper_jobs`, `scraper_job_logs` を D1 スキーマとして定義する
   - `packages/auth` の Better Auth adapter を D1 backed な Drizzle インスタンスに切り替える

3. **API ルーターの更新**
   - `statements.service.ts` を PostgreSQL クエリ → SQLite クエリに変更
   - 検索ロジックを FTS5 ベースに書き換え
   - 例外分割された都道府県では複数 SQLite を順に検索してマージする

4. **キャッシュ戦略**
   - Cloudflare Workers のメモリキャッシュ（同一リクエスト内）
   - Cache API でリクエスト間キャッシュ（TTL: 1 時間）

### フェーズ 4: 差分更新の自動化

TODO 後から考える


## 未解決事項（要検討）
- **全国横断検索**: 一旦考えない

## 参考

- [Cloudflare D1 ドキュメント](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 ドキュメント](https://developers.cloudflare.com/r2/)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [Drizzle ORM - LibSQL/SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- [Cloudflare Durable Objects SQLite](https://developers.cloudflare.com/durable-objects/api/storage-api/#sqlite)
