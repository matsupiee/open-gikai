---
name: duckdb-analytics
description: DuckDB を使って local-bulk-scraper の NDJSON 出力を分析し、スクレイピング結果の問題を検出する
version: 1.0.0
---

# DuckDB スクレイピング分析スキル

## 概要

`apps/local-bulk-scraper/output/{日付}/` にある NDJSON ファイル（meetings, statements, statement_chunks）を DuckDB で読み込み、スクレイピング結果の品質チェックを行う。

## 引数

```
/duckdb-analytics [日付ディレクトリ] [オプション]
```

**日付ディレクトリ（必須）:**
- `output/` 配下の日付ディレクトリ名（例: `2026-03-22`）
- 省略された場合は `output/` 配下の最新ディレクトリを使う

**オプション:**
- `--municipality <municipalityId>` — 特定の自治体に絞って分析
- `--check <チェック名>` — 特定のチェックだけ実行（下記チェック一覧参照）

引数が不足している場合はユーザーに確認する。

## 前提条件

- `duckdb` CLI がインストールされていること（`brew install duckdb`）
- NDJSON ファイルが `apps/local-bulk-scraper/output/{日付}/` に存在すること

## 実行手順

### Step 1: NDJSON ファイルのパスを確定する

```bash
OUTDIR={worktree_root}/apps/local-bulk-scraper/output/{日付}
ls -lh $OUTDIR/*.ndjson
```

3 ファイルが存在することを確認:
- `meetings.ndjson`
- `statements.ndjson`
- `statement_chunks.ndjson`

### Step 2: DuckDB でチェッククエリを実行する

以下のチェックを **順番に** Bash ツールで実行する。各クエリは `duckdb -c` で実行する。

**NDJSON ファイルが大きい（数 GB）場合があるため、タイムアウトは 300000ms（5 分）に設定する。**

NDJSON の読み込みには `read_ndjson_auto()` を使う:

```bash
duckdb -c "
SELECT ...
FROM read_ndjson_auto('{OUTDIR}/meetings.ndjson') AS m
"
```

---

#### チェック 1: 基本統計（overview）

全体の件数とファイルサイズ感を把握する。

```sql
SELECT
  (SELECT count(*) FROM read_ndjson_auto('{OUTDIR}/meetings.ndjson')) AS total_meetings,
  (SELECT count(DISTINCT municipalityId) FROM read_ndjson_auto('{OUTDIR}/meetings.ndjson')) AS total_municipalities,
  (SELECT count(*) FROM read_ndjson_auto('{OUTDIR}/statements.ndjson')) AS total_statements,
  (SELECT count(*) FROM read_ndjson_auto('{OUTDIR}/statement_chunks.ndjson')) AS total_chunks;
```

---

#### チェック 2: 自治体別の会議数・発言数（per-municipality）

自治体ごとの取得件数を把握し、0 件や極端に少ない自治体を検出する。

```sql
SELECT
  m.municipalityId,
  count(DISTINCT m.id) AS meeting_count,
  count(DISTINCT s.id) AS statement_count,
  min(m.heldOn) AS earliest_meeting,
  max(m.heldOn) AS latest_meeting
FROM read_ndjson_auto('{OUTDIR}/meetings.ndjson') AS m
LEFT JOIN read_ndjson_auto('{OUTDIR}/statements.ndjson') AS s
  ON m.id = s.meetingId
GROUP BY m.municipalityId
ORDER BY meeting_count ASC;
```

**注目ポイント:**
- `statement_count = 0` の自治体 → 会議は取れたが発言が取れていない（パーサーの問題）
- `meeting_count` が極端に少ない自治体 → 一覧ページの取得に問題がある可能性

---

#### チェック 3: 発言のない会議（empty-meetings）

会議レコードはあるが発言が 1 件も紐づいていない会議を検出する。

```sql
SELECT
  m.id AS meeting_id,
  m.municipalityId,
  m.title,
  m.heldOn,
  m.sourceUrl
FROM read_ndjson_auto('{OUTDIR}/meetings.ndjson') AS m
LEFT JOIN read_ndjson_auto('{OUTDIR}/statements.ndjson') AS s
  ON m.id = s.meetingId
WHERE s.id IS NULL
ORDER BY m.municipalityId, m.heldOn;
```

**注目ポイント:**
- 「名簿」「目次」「資料」などのタイトルは発言がないのが正常
- 「本文」「議事日程」で発言が 0 件なら問題

---

#### チェック 4: 空コンテンツの発言（empty-content）

`content` が空文字列・NULL・空白のみの発言を検出する。

```sql
SELECT
  s.id,
  s.meetingId,
  s.kind,
  s.speakerName,
  length(s.content) AS content_length
FROM read_ndjson_auto('{OUTDIR}/statements.ndjson') AS s
WHERE s.content IS NULL
   OR trim(s.content) = ''
   OR length(trim(s.content)) < 5
ORDER BY s.meetingId;
```

---

#### チェック 5: 重複 externalId（duplicate-external-ids）

同じ `externalId` を持つ会議が複数存在する場合、重複取得されている可能性がある。

```sql
SELECT
  externalId,
  count(*) AS dup_count,
  array_agg(id) AS meeting_ids,
  array_agg(DISTINCT municipalityId) AS municipality_ids
FROM read_ndjson_auto('{OUTDIR}/meetings.ndjson')
WHERE externalId IS NOT NULL
GROUP BY externalId
HAVING count(*) > 1
ORDER BY dup_count DESC
LIMIT 50;
```

---

#### チェック 6: 重複コンテンツハッシュ（duplicate-content）

異なる会議間で同じ `contentHash` を持つ発言がある場合、同一内容が重複登録されている可能性がある。

```sql
SELECT
  s.contentHash,
  count(*) AS dup_count,
  count(DISTINCT s.meetingId) AS across_meetings,
  min(length(s.content)) AS content_length
FROM read_ndjson_auto('{OUTDIR}/statements.ndjson') AS s
GROUP BY s.contentHash
HAVING count(DISTINCT s.meetingId) > 1
ORDER BY dup_count DESC
LIMIT 30;
```

**注目ポイント:**
- 同じ自治体内の同一日程の会議でコンテンツが重複 → externalId が異なるだけで同じ会議の可能性
- 異なる自治体間で重複 → 問題なし（同じシステムを使っているなど）

---

#### チェック 7: 孤立レコード（orphans）

statements や statement_chunks が存在しない meetingId を参照していないか確認する。

```sql
-- statements の孤立チェック
SELECT count(*) AS orphan_statements
FROM read_ndjson_auto('{OUTDIR}/statements.ndjson') AS s
LEFT JOIN read_ndjson_auto('{OUTDIR}/meetings.ndjson') AS m
  ON s.meetingId = m.id
WHERE m.id IS NULL;

-- statement_chunks の孤立チェック
SELECT count(*) AS orphan_chunks
FROM read_ndjson_auto('{OUTDIR}/statement_chunks.ndjson') AS c
LEFT JOIN read_ndjson_auto('{OUTDIR}/meetings.ndjson') AS m
  ON c.meetingId = m.id
WHERE m.id IS NULL;
```

---

#### チェック 8: chunk と statement の整合性（chunk-statement-consistency）

statements の `chunkId` が statement_chunks に存在するか確認する。

```sql
SELECT count(*) AS missing_chunks
FROM read_ndjson_auto('{OUTDIR}/statements.ndjson') AS s
LEFT JOIN read_ndjson_auto('{OUTDIR}/statement_chunks.ndjson') AS c
  ON s.chunkId = c.id
WHERE s.chunkId IS NOT NULL
  AND c.id IS NULL;
```

---

#### チェック 9: 会議日付の妥当性（date-validation）

未来日付や極端に古い日付の会議がないか確認する。

```sql
SELECT
  id,
  municipalityId,
  title,
  heldOn,
  sourceUrl
FROM read_ndjson_auto('{OUTDIR}/meetings.ndjson')
WHERE TRY_CAST(heldOn AS DATE) IS NULL
   OR TRY_CAST(heldOn AS DATE) > CURRENT_DATE
   OR TRY_CAST(heldOn AS DATE) < '2000-01-01'
ORDER BY heldOn;
```

---

#### チェック 10: meetingType の分布（meeting-type-distribution）

想定外の meetingType が混入していないか確認する。

```sql
SELECT
  meetingType,
  count(*) AS cnt
FROM read_ndjson_auto('{OUTDIR}/meetings.ndjson')
GROUP BY meetingType
ORDER BY cnt DESC;
```

**想定される meetingType:** `plenary`（本会議）、`committee`（委員会）、`other`（その他）

---

### Step 3: 結果をまとめて報告する

全チェックの結果をカテゴリ別にまとめてユーザーに報告する。

#### サマリーテーブル

| チェック | 結果 | 問題件数 | 重要度 |
|---------|------|---------|--------|
| 基本統計 | ... | - | info |
| 自治体別会議数 | ... | N 件 | ... |
| 発言のない会議 | ... | N 件 | ... |
| ... | ... | ... | ... |

**重要度の基準:**
- **critical**: データの整合性が壊れている（孤立レコード、chunk 不整合）
- **warning**: データ品質に問題あり（空コンテンツ、重複、日付異常）
- **info**: 確認用（基本統計、分布）

#### 問題の詳細

問題が見つかった場合、具体的なレコードを示して原因を推測する。特に:

1. **自治体単位で問題が集中しているか** → スクレイパーアダプターの問題
2. **特定の meetingType に偏っているか** → パーサーの特定パスの問題
3. **日付範囲に偏りがあるか** → サイト側の変更

### Step 4: 自治体名の解決（オプション）

`municipalityId` だけでは自治体を特定しにくい場合、`municipalities.csv` と突合する。

```sql
SELECT
  m.municipalityId,
  csv."都道府県名（漢字）" AS prefecture,
  csv."市区町村名（漢字）" AS city,
  count(*) AS meeting_count
FROM read_ndjson_auto('{OUTDIR}/meetings.ndjson') AS m
LEFT JOIN read_csv_auto('{worktree_root}/packages/db/src/seeds/municipalities.csv') AS csv
  ON true  -- municipalities.csv には municipalityId がないため直接結合できない
GROUP BY m.municipalityId, csv."都道府県名（漢字）", csv."市区町村名（漢字）"
ORDER BY meeting_count ASC;
```

**注意:** `municipalities.csv` には内部 ID（`municipalityId`）が含まれていない。自治体名の解決が必要な場合は、DB にアクセスして municipalities テーブルから取得する（db-access スキル参照）。

代替手段として、NDJSON の `sourceUrl` から自治体ドメインを抽出して推測できる:

```sql
SELECT
  municipalityId,
  regexp_extract(sourceUrl, 'https?://([^/]+)', 1) AS domain,
  count(*) AS meeting_count
FROM read_ndjson_auto('{OUTDIR}/meetings.ndjson')
GROUP BY municipalityId, domain
ORDER BY meeting_count ASC;
```

## 注意事項

- NDJSON ファイルは数 GB になることがあるため、JOIN を伴うクエリは時間がかかる場合がある
- DuckDB はメモリ内で処理するため、メモリ不足の場合は `PRAGMA memory_limit='4GB';` を設定する
- 結果が大量に返る場合は `LIMIT` を付けて段階的に確認する
- 問題が見つかった場合、修正はこのスキルの範囲外。`debug-bulk-scraper` や `create-custom-adapter` スキルを参照する
