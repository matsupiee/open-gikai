---
name: debug-bulk-scraper
description: local-bulk-scraper を実行し、取得0件の自治体を洗い出して原因調査・修正する
version: 1.0.0
---

# Bulk Scraper デバッグスキル

## 概要

`apps/local-bulk-scraper` の `scrape:ndjson` を system-type ごとに実行し、取得件数 0 件で終わった自治体を洗い出して原因を調査・修正する。

## 引数

```
/debug-bulk-scraper [system-type] [オプション]
```

**system-type（必須でなければ全 system-type を順に実行）:**
- `dbsearch`
- `gijiroku_com`
- `discussnet_ssp`
- `kensakusystem`

**オプション:**
- `--year 2025` — 対象年度（デフォルト: 2025）
- `--meeting-limit 1` — 会議数上限（デフォルト: 1）
- `--fix` — 原因調査だけでなく修正まで行う（デフォルト: 調査のみ）

引数が不足している場合はユーザーに確認する。

## 実行手順

### Step 1: scrape:ndjson を実行する

`apps/local-bulk-scraper` ディレクトリから実行する。**絶対パスで cwd を指定すること。**

```bash
cd {worktree_root}/apps/local-bulk-scraper && bun run scrape:ndjson -- --system-type {system_type} --year {year} --meeting-limit {meeting_limit}
```

- タイムアウトは 600000ms（10 分）に設定する
- 出力が大量になるため、コマンド完了後にログファイルから結果を読み取る

### Step 2: ログファイルから 0 件・失敗の自治体を抽出する

出力ディレクトリ `apps/local-bulk-scraper/output/` 配下の最新日付ディレクトリにあるログファイルを読む。

```bash
# 最新のログファイルを特定
ls -t {worktree_root}/apps/local-bulk-scraper/output/*/scrape-*.log | head -1
```

ログファイルの末尾に以下の形式で失敗・0 件の自治体が記載されている:

```
[INFO] [scrape-to-ndjson] 失敗・0件の自治体: N 件
[INFO]   {system_type}: N 件
[INFO]
[INFO]   [FAIL] {都道府県} {市区町村名} ({system_type}): {reason}
```

**`reason` のパターン:**
- `0 件（データなし）` — スクレイピングは成功したがデータが 0 件
- その他のエラーメッセージ — スクレイピング自体が失敗

これらをリストアップしてユーザーに表示する:

| # | 都道府県 | 市区町村 | system_type | reason |
|---|---------|---------|-------------|--------|
| 1 | ... | ... | ... | ... |

### Step 3: 原因を調査する

0 件・失敗の自治体について、以下の手順で原因を調査する。**5 件以上ある場合は Agent を並列起動して効率化する。**

#### 調査手順（各自治体に対して）

1. **DB から自治体情報を取得**: municipalities テーブルから baseUrl を確認する（db-access スキル参照）
2. **実際の URL にアクセスして確認**: WebFetch で baseUrl にアクセスし、ページの構造を確認する
3. **スクレイパーのコードを確認**: `apps/local-bulk-scraper/src/bulk-scrapers/{system_type}.ts` と `packages/scrapers/src/{system_type}/` のコードを読む
4. **原因を特定**: 以下のよくある原因を確認する

#### よくある原因

| 原因 | 説明 | 修正箇所 |
|------|------|---------|
| URL 構造の変更 | 自治体サイトのリニューアル等で URL パスが変わった | `municipalities.csv` の baseUrl を更新 |
| HTML 構造の変更 | パーサーが想定する HTML セレクタと実際の構造が不一致 | `packages/scrapers/src/{system_type}/` のパーサーを修正 |
| 年度パラメータの不一致 | 検索パラメータの形式が自治体ごとに異なる（和暦/西暦、年度/年など） | スクレイパーの検索パラメータ生成ロジックを修正 |
| レスポンスエンコーディング | Shift_JIS 等の文字コードで文字化け → パース失敗 | エンコーディング処理を追加 |
| 該当年度のデータが本当にない | まだ公開されていない、またはその年度の会議録がない | 対処不要（正常動作） |
| baseUrl が間違っている | CSV に登録された URL が誤っている | `municipalities.csv` を修正 |

#### 並列調査の Agent プロンプト

5 件以上の場合、Agent を並列起動する:

```
Agent 起動パラメータ:
  subagent_type: general-purpose
  model: sonnet（コード読解が必要なため haiku では不足）
  prompt: |
    「{都道府県}{市区町村名}」の {system_type} スクレイパーが {year} 年度のデータを取得できない原因を調査してください。

    baseUrl: {baseUrl}
    エラー: {reason}

    ## 調査手順
    1. WebFetch で {baseUrl} にアクセスし、ページが正常に表示されるか確認
    2. `packages/scrapers/src/{system_type}/` のコードを読み、どのような URL/パラメータでリクエストしているか確認
    3. 実際のリクエスト URL を WebFetch で叩き、レスポンスを確認
    4. 原因を特定し、修正方針を提案

    ## 出力（厳守）
    Write ツールで `/tmp/debug-scraper-results/{市区町村名}.json` に以下を書き出してください:

    {
      "municipality": "{市区町村名}",
      "prefecture": "{都道府県}",
      "baseUrl": "{baseUrl}",
      "cause": "原因の簡潔な説明",
      "category": "url_changed" | "html_changed" | "param_mismatch" | "encoding" | "no_data" | "base_url_wrong" | "other",
      "fix": "修正内容の説明",
      "fixFiles": ["修正が必要なファイルパスのリスト"]
    }
```

### Step 4: 調査結果をまとめて報告する

全調査が完了したら、結果をカテゴリ別にまとめてユーザーに報告する:

#### A. 修正可能（コード変更で対応）

| 自治体 | 原因 | 修正内容 | 修正ファイル |
|--------|------|---------|------------|
| ... | ... | ... | ... |

#### B. CSV 更新が必要

| 自治体 | 原因 | 新しい URL |
|--------|------|-----------|
| ... | ... | ... |

#### C. 対処不要（データなし等）

| 自治体 | 理由 |
|--------|------|
| ... | ... |

#### D. 原因不明（追加調査が必要）

| 自治体 | 状況 |
|--------|------|
| ... | ... |

### Step 5: 修正を実装する（`--fix` 指定時、または Step 4 でユーザーが承認した場合）

カテゴリ A・B の自治体について修正を実装する。

1. **コード修正**（カテゴリ A）: スクレイパーのコードを修正する
2. **CSV 更新**（カテゴリ B）: `packages/db/src/seeds/municipalities.csv` を更新する
3. **修正後に再実行**: 修正した自治体だけを対象に再度 `scrape:ndjson` を実行し、データが取得できることを確認する

確認が取れたらコミットする。

### Step 6: worktree の場合は PR を作成する

worktree で作業している場合（`.claude/worktrees/` 配下）、コミット → プッシュ → PR 作成まで一連で実行する。

## 注意事項

- `scrape:ndjson` は外部サイトにリクエストを送るため、短時間に何度も実行しない
- `--meeting-limit 1` を指定することで、各自治体 1 会議分だけ取得して素早く動作確認できる
- 修正後の再実行も `--meeting-limit 1` で十分（データ取得の可否だけ確認できればよい）
- ログファイルは `output/{YYYY-MM-DD}/` に日付ごとに保存されるため、過去の実行結果と比較可能
