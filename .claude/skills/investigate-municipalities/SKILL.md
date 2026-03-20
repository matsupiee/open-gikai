---
name: investigate-municipalities
description: 議事録検索URLが未設定の自治体を並列調査し、スクレイピング方針を決定する
version: 3.0.0
---

# 自治体スクレイピング調査スキル

## 概要

`municipalities.csv` で議事録検索 URL が空の自治体について、Web 検索で会議録システムを特定し、スクレイピング方針を決定する。

## 引数

このスキルは以下の形式で呼び出される:

```
/investigate-municipalities [フィルタ]
```

**フィルタ例:**
- `/investigate-municipalities 北海道` → 北海道の未設定自治体のみ
- `/investigate-municipalities 東京都` → 東京都の未設定自治体のみ
- `/investigate-municipalities 夕張市,岩見沢市,網走市` → 指定自治体のみ
- `/investigate-municipalities --limit 10` → 先頭 10 件のみ
- 引数なし → ユーザーにフィルタを確認する（全件は非推奨）

## 実行手順

### Step 1: 対象自治体の抽出

`packages/db/src/seeds/municipalities.csv` から、6 列目（議事録検索 URL）が空の行を抽出する。

```
フォーマット: 団体コード,都道府県名,市区町村名,都道府県名カナ,市区町村名カナ,議事録検索URL,人口,人口基準年
URL が空 = 6列目が空文字 (連続カンマ ,,)
```

引数で指定されたフィルタに従い、対象を絞り込む。

**対象数の上限チェック:** 20 件を超える場合はユーザーに確認を取る。並列 Agent の数が多すぎるとレート制限に抵触する可能性がある。

### Step 2: 並列調査の実行

対象自治体それぞれについて **Agent ツール（subagent_type: general-purpose）** を並列起動する。

各 Agent には以下のプロンプトを渡す:

```
「{都道府県名}{市区町村名}」の議会 会議録検索システムの URL を調査してください。

## 調査手順

1. Web 検索で「{市区町村名} 議会 会議録」を検索
2. 公式サイトの議会ページから会議録検索システムへのリンクを探す
3. 会議録検索システムの URL を特定する

## 判定基準

URL が以下のいずれかのドメインを含む場合、対応済みシステムとして分類する:

| ドメイン | system_type |
|---------|-------------|
| ssp.kaigiroku.net | discussnet_ssp |
| dbsr.jp | dbsearch |
| kensakusystem.jp | kensakusystem |
| gijiroku.com | gijiroku_com |

上記以外の URL の場合は「カスタム」として分類する。

## 出力フォーマット（厳守）

以下の JSON 形式で結果を返してください。それ以外のテキストは不要です。

{
  "municipalityCode": "{団体コード}",
  "prefecture": "{都道府県名}",
  "name": "{市区町村名}",
  "status": "found" | "custom" | "not_found",
  "url": "{見つかった URL}" | null,
  "systemType": "discussnet_ssp" | "dbsearch" | "kensakusystem" | "gijiroku_com" | "custom" | null,
  "notes": "{補足情報（カスタムの場合はシステムの特徴など）}"
}
```

**並列度のガイドライン:**
- 10 件以下: 全件同時に Agent 起動
- 11〜20 件: 10 件ずつ 2 バッチに分ける
- 21 件以上: ユーザー確認後、10 件ずつバッチ実行

### Step 3: 結果の集約・分類・表示

全 Agent の結果を以下の 3 カテゴリに分類してユーザーに表示する:

#### A. 対応済みシステム（CSV 更新のみで対応可能）

| 自治体 | system_type | URL |
|--------|-------------|-----|
| ... | ... | ... |

#### B. カスタムシステム（個別対応が必要）

| 自治体 | URL | 備考 |
|--------|-----|------|
| ... | ... | ... |

#### C. 未発見（会議録システムが見つからない）

| 自治体 | 備考 |
|--------|------|
| ... | ... |

表示後、**ユーザーの承認を待たずに Step 4 に進む。**

### Step 4: 実装フェーズ（worktree 並列実行）

結果の分類が完了したら、**即座にカテゴリごとに Agent を worktree で並列起動**して実装する。ユーザーへの確認は不要。

#### カテゴリ A: CSV 更新 → PR

カテゴリ A の自治体が存在する場合、**1 つの Agent を `isolation: "worktree"` で起動**し、対象自治体の CSV を一括更新して PR を作成する。

```
Agent 起動パラメータ:
  subagent_type: general-purpose
  isolation: worktree
  prompt: |
    以下の自治体の議事録検索 URL を municipalities.csv に追加してください。

    {カテゴリ A の自治体リスト（コード, 都道府県, 市区町村, URL）}

    ## 手順
    1. `git checkout -b feat/add-municipality-urls` でブランチを作成
    2. `packages/db/src/seeds/municipalities.csv` の該当行の6列目に URL を追加
    3. 変更をコミット
    4. `git push -u origin feat/add-municipality-urls`
    5. `gh pr create` で PR を作成

    ## コミットメッセージ
    feat: {N}自治体の会議録検索URLを追加

    ## PR タイトル
    feat: {都道府県名}の自治体会議録検索URL追加
```

#### カテゴリ B: カスタムスクレイピング方針ドキュメント → PR

カテゴリ B の自治体**それぞれについて個別の Agent を `isolation: "worktree"` で並列起動**し、方針ドキュメントを作成して PR を作成する。

各 Agent は独立した worktree で動くため、並列に異なるブランチで作業できる。

```
Agent 起動パラメータ（自治体ごとに 1 つ）:
  subagent_type: general-purpose
  isolation: worktree
  prompt: |
    「{都道府県名}{市区町村名}」の議会会議録のカスタムスクレイピング方針ドキュメントを作成してください。

    会議録検索システム URL: {URL}
    備考: {notes}

    ## 手順
    1. `git checkout -b docs/{市区町村名ローマ字}-scraping-strategy` でブランチを作成
    2. {URL} にアクセスして以下を調査:
       - URL 構造（検索ページ、一覧ページ、詳細ページ）
       - 検索パラメータ（年、会議種別など）
       - 会議録の HTML 構造（発言者パターン、メタ情報の位置）
       - 文字コード
       - ページネーションの有無
    3. `docs/custom-scraping/{市区町村名}.md` に方針ドキュメントを作成
       - テンプレート: `docs/custom-scraping/nakano.md` を参考にする
    4. 変更をコミット
    5. `git push -u origin docs/{市区町村名ローマ字}-scraping-strategy`
    6. `gh pr create` で PR を作成

    ## コミットメッセージ
    docs: {市区町村名}議会のカスタムスクレイピング方針を追加

    ## PR タイトル
    docs: {市区町村名}議会のカスタムスクレイピング方針
```

#### カテゴリ C: 未発見自治体の URL メモ → PR

カテゴリ C の自治体が存在する場合、**1 つの Agent を `isolation: "worktree"` で起動**し、議会関連ページの URL をメモした簡易 md ファイルを一括作成して PR を作成する。

会議録検索システムが見つからなくても、議会だよりや審議結果 PDF など何らかの議会関連ページが存在する場合はその URL を記録しておく。

```
Agent 起動パラメータ:
  subagent_type: general-purpose
  isolation: worktree
  prompt: |
    以下の自治体について、議会関連ページの URL をメモした簡易 md ファイルを作成してください。

    {カテゴリ C の自治体リスト（市区町村名, URL, 備考）}

    ## 各ファイルのフォーマット

    ```markdown
    # {市区町村名}議会

    ## ステータス

    会議録検索システム未導入

    ## PDF掲載ページ

    - {URL}

    ## 備考

    {一行メモ}
    ```

    ## 手順
    1. `git checkout -b docs/not-found-municipalities-urls` でブランチを作成
    2. 各自治体の md ファイルを `docs/custom-scraping/{市区町村名ローマ字}.md` に作成
    3. 変更をコミット
    4. `git push -u origin docs/not-found-municipalities-urls`
    5. `gh pr create` で PR を作成

    ## コミットメッセージ
    docs: 会議録検索システム未導入の{N}自治体のURL記録

    ## PR タイトル
    docs: 会議録検索システム未導入の{都道府県名}{N}自治体のURL記録
```

**並列度のガイドライン（実装フェーズ）:**
- カテゴリ A: 常に 1 Agent（CSV は 1 ファイルなので分割不要）
- カテゴリ B: 5 件以下は全件同時、6 件以上は 5 件ずつバッチ
- カテゴリ C: 常に 1 Agent（簡易ファイルなので一括作成）
- カテゴリ A, B, C は同時に並列起動してよい（worktree で分離されるため衝突しない）

## 対応済みシステムの URL パターン例

調査時の参考情報として、各システムの典型的な URL パターン:

| system_type | URL パターン例 |
|-------------|---------------|
| discussnet_ssp | `https://ssp.kaigiroku.net/tenant/{自治体}/SpMinuteSearch.html` |
| dbsearch | `https://www.{自治体}.dbsr.jp/` |
| kensakusystem | `https://{自治体}.kensakusystem.jp/` |
| gijiroku_com | `http://{自治体}.gijiroku.com/voices/` |

## 注意事項

- Web 検索のレート制限を考慮し、大量の自治体を一度に調査しない
- 議会サイトの URL は変更されることがあるため、調査結果は最新状態を反映している保証はない
- カスタムシステムの方針ドキュメントは `docs/custom-scraping/nakano.md` をテンプレートとして参考にする
