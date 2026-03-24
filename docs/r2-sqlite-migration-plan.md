# R2 + SQLite + D1 アーキテクチャ移行計画

## 背景と課題

現状、議会議事録データを PostgreSQL（Supabase）に蓄積しているが、以下の課題がある。

- **データ量の爆発的増加**: 全国約 1,700 自治体 × 年 4 回議会 × 複数発言 で statements テーブルが巨大化
- **コスト**: Supabase の有料プランや Hyperdrive のコストが増大
- **クエリ遅延**: フルテキスト検索・ベクター検索が大規模データでスケールしにくい
- **運用複雑度**: pgvector 拡張・tsvector 生成カラムなど PostgreSQL 固有機能への依存

## 初期投入の前提

初回移行は Cloudflare Worker ベースではなく、既存の **`apps/local-bulk-scraper` を使ったローカル一括処理** を前提にする。

- 過去データはローカルで全件スクレイピングし、`meetings.ndjson` / `statements.ndjson` / `statement_chunks.ndjson` を生成する
- SQLite 変換もローカル CLI で実行し、完成した SQLite ファイルだけを R2 にアップロードする
- **まだサービス未リリースなので、PostgreSQL と新構成を長期間共存させる必要はない**
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
[Cloudflare R2 (SQLite shards)] ←→ [apps/web / API Worker] ←→ [Cloudflare D1]
    議会コンテンツ検索             認証 / セッション / ジョブ管理
                ↓
          [ユーザーへレスポンス]
```

### データ配置

- **R2 + SQLite**: `index.sqlite`, `municipalities`, `system_types`, `meetings`, `statements`, `statement_chunks`
- **Cloudflare D1**: `users`, `sessions`, `accounts`, `verifications`, `scraper_jobs`, `scraper_job_logs`
- **PostgreSQL**: 移行元データソースとしてのみ扱い、カットオーバー後はランタイム依存を残さない

### R2 上のファイル構成

```
r2://open-gikai-db/
├── manifests/
│   ├── latest.json           # 現在参照すべきシャード一覧
│   └── 2026-03-24.json       # リリースごとの固定 manifest
├── index.sqlite              # 自治体マスタ・system_types（軽量、全体共通）
└── prefectures/
    ├── 01.sqlite             # 北海道の10年分スナップショット
    ├── 02.sqlite             # 青森県の10年分スナップショット
    ├── 13_2016_2020.sqlite   # 例外的にサイズが大きい県だけ 5 年単位で分割
    ├── 13_2021_2025.sqlite
    └── ...
```

**分割戦略の選択肢**:
- **自治体単位**: 約 1,700 ファイル規模になり、初期投入や manifest 管理が重い
- **都道府県 + 年度単位**: 10 年分で `47 × 10 = 470` ファイルになり、アップロード・キャッシュ・整合性管理のコストが高い
- **都道府県単位スナップショット**: まず 47 ファイルで公開でき、初期投入がもっとも単純
- **都道府県単位 + 5 年バケット**: サイズが大きい県だけ `13_2016_2020.sqlite` のように例外分割できる

→ **推奨: 都道府県単位スナップショットを基本にし、サイズ超過時だけ 5 年バケットで例外分割する**

この方式なら、初期投入時のファイル数は原則 **47 + index + manifest** で済む。仮に全都道府県で 5 年バケット分割が必要になっても、10 年分で **94 ファイル** に収まり、年度単位の 470 ファイルより運用しやすい。

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

Web アプリはこの manifest を見て、都道府県ごとに 1 ファイル読むか、複数ファイルを順に検索するかを決める。全国横断検索用の専用インデックスは、必要性が確認できるまで後回しにする。

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

### フェーズ 1: ローカル一括ビルド + R2 初期投入

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

### フェーズ 2: Web アプリの R2 / D1 対応

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
   - 大きい県だけ 5 年バケット分割してダウンロードサイズを抑える

### フェーズ 3: 差分更新の自動化

1. `apps/scraper-worker` は引き続き最新データ収集に使うが、ジョブ状態とログは D1 に保存する
2. 差分更新単位は「都道府県全体」または「5 年バケット」に限定し、年度単位分割は採らない
3. SQLite 生成は別ジョブとして扱い、R2 の該当 shard だけを再ビルドする
4. 安定後に GitHub Actions あるいは定期バッチで再ビルドを自動化する

### フェーズ 4: PostgreSQL の一括撤去

1. D1 と R2 を参照する実装へ切り替え、アプリから `DATABASE_URL` 依存を外す
2. 認証・ジョブ管理・議会コンテンツをそれぞれ D1 / R2 に移し、PostgreSQL への書き込みを停止する
3. 検証後、`users`, `sessions`, `accounts`, `verifications`, `scraper_jobs`, `scraper_job_logs`, `municipalities`, `system_types`, `meetings`, `statements`, `statement_chunks` を **一括で drop** する
4. Supabase / Hyperdrive / PostgreSQL 用の運用設定を削除する

## 技術的なトレードオフ

| 観点 | 現在（PostgreSQL） | 移行後（R2 + SQLite + D1） |
|------|-------------------|----------------------|
| 全文検索精度 | tsvector（日本語対応） | FTS5 + 2-gram（精度やや低下） |
| ベクター検索 | pgvector（高速） | アプリ層コサイン計算（低速だが絞り込みで緩和） |
| スケール | DB スケールアップ必要 | ファイル分割で水平スケール可能 |
| コスト | Supabase 従量課金 | R2 は読み取り無料、保存コストのみ |
| 認証・運用メタデータ | PostgreSQL に集約 | D1 に集約 |
| リアルタイム性 | 即時反映 | SQLite 再生成 + アップロードまでラグあり |
| 更新複雑度 | INSERT/UPDATE | 都道府県 or 5 年バケット単位の再ビルドが基本 |
| 読み取り一貫性 | トランザクション保証 | スナップショット読み取り（ファイル単位） |

## 未解決事項（要検討）

1. **SQLite ファイルの最大サイズ**: 都道府県 1 ファイルでどの程度になるか、どの県から 5 年バケット分割が必要か見積もりが必要
2. **Workers でのSQLite実行方法**: `@cloudflare/workers-types` での better-sqlite3 利用可否 → Durable Objects の SQLite API または `@sqlite.org/sqlite-wasm` の WASM 版を利用
3. **差分更新**: 都道府県全体の再ビルドと 5 年バケット再ビルドのどちらを標準にするか
4. **全国横断検索**: 全 prefecture shard への fan-out で十分か、専用 search shard を別途持つか
5. **D1 スキーマ設計**: `users`, `sessions`, `accounts`, `verifications`, `scraper_jobs`, `scraper_job_logs` を 1 DB にまとめるか、用途別に分けるか

## 参考

- [Cloudflare D1 ドキュメント](https://developers.cloudflare.com/d1/)
- [Cloudflare R2 ドキュメント](https://developers.cloudflare.com/r2/)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
- [Drizzle ORM - LibSQL/SQLite](https://orm.drizzle.team/docs/get-started-sqlite)
- [Cloudflare Durable Objects SQLite](https://developers.cloudflare.com/durable-objects/api/storage-api/#sqlite)
