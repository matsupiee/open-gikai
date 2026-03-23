---
name: batch-create-adapters
description: docs/custom-scraping のファイルを読み取り、create-custom-adapter を10件ずつ並列実行する
version: 1.0.0
---

# バッチ カスタムアダプター作成

## 概要

`docs/custom-scraping/` ディレクトリにあるスクレイピング方針ファイルを読み取り、`create-custom-adapter` スキルを **10件ずつ並列** で実行する。各アダプターは worktree で隔離して作業し、完了後に PR を作成する。

## 引数

```
/batch-create-adapters [件数]
```

- 件数を指定しない場合は `docs/custom-scraping/` 内の **全ファイル** を対象とする
- 例: `/batch-create-adapters 20` → 先頭 20 件を処理

## 実行手順

### Step 1: 対象ファイルの一覧取得

`docs/custom-scraping/` 内の `.md` ファイルを一覧取得し、対象件数を確認する。

```bash
ls docs/custom-scraping/*.md
```

引数で件数が指定されていればその件数分だけ取得する。

### Step 1.5: 情報不足ファイルのスキップ

各 `.md` ファイルの行数を確認し、**20行以下のファイルはスキップ** する。行数が少ないファイルはスクレイピング方針の情報が不足しており、アダプター実装に必要な詳細（HTML 構造、URL パターン等）が欠けている可能性が高い。

```bash
wc -l docs/custom-scraping/*.md | awk '$1 <= 20 && $2 != "total" { print $2 }'
```

スキップしたファイル名は進捗報告時にまとめて表示する。スキップしたファイルは削除しない。

### Step 2: 10件ずつバッチ分割して並列実行

対象ファイルを 10件ずつのバッチに分割し、各バッチ内のファイルを **Agent ツールで並列実行** する。

各 Agent は以下のように起動する:

- `subagent_type`: 指定なし（general-purpose）
- `isolation`: `"worktree"`（各エージェントが独立した worktree で作業）
- プロンプト: `/create-custom-adapter {ファイル名（拡張子なし）}` スキルの内容を展開して渡す

**重要**: 1バッチ（10件）の全エージェントが完了するまで待ってから、次のバッチを開始する。

各エージェントへのプロンプトテンプレート:

```
以下の自治体のカスタムスクレイピングアダプターを作成してください。

対象: {ファイル名（拡張子なし）}

手順は /create-custom-adapter スキルに従ってください。
具体的には:
1. docs/custom-scraping/{ファイル名}.md を読んでスクレイピング方針を把握
2. packages/db/src/seeds/municipalities.csv から自治体コードを特定
3. packages/scrapers/src/adapters/custom/{コード}-{名前}/ にアダプターを実装
4. テストを書いて通す
5. 型チェックを通す
6. NDJSON 出力で動作確認
7. コミット → プッシュ → PR 作成（worktree ルールに従う）
```

### Step 3: バッチ完了後にドキュメント削除

各バッチの全エージェントが完了したら、**成功したもののみ** 対応する `docs/custom-scraping/{ファイル名}.md` を削除する。

```bash
rm docs/custom-scraping/{成功したファイル名}.md
```

エージェントが失敗した（PR 作成まで到達しなかった）ファイルは削除しない。

### Step 4: 進捗報告

各バッチ完了時に以下を報告する:

- 成功件数 / 対象件数
- 失敗した自治体名（あれば）
- 作成された PR の URL 一覧
- 残りのバッチ数

全バッチ完了後に最終サマリーを報告する。

## 注意事項

- 各エージェントは worktree で隔離されるため、互いの変更が競合しない
- ネットワークアクセス（NDJSON 動作確認）を含むため、1バッチの完了に時間がかかる場合がある
- エラーが多発する場合はバッチサイズを小さくすることを検討する
