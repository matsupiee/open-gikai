---
name: investigate-municipalities
description: 議事録検索URLが未設定の自治体を並列調査し、スクレイピング方針を決定する
version: 1.0.0
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

### Step 3: 結果の集約と分類

全 Agent の結果を以下の 3 カテゴリに分類して表示する:

#### A. 対応済みシステム（CSV 更新のみで対応可能）

| 自治体 | system_type | URL |
|--------|-------------|-----|
| ... | ... | ... |

→ これらは `municipalities.csv` の URL 列を埋めるだけでスクレイピング可能。

#### B. カスタムシステム（個別対応が必要）

| 自治体 | URL | 備考 |
|--------|-----|------|
| ... | ... | ... |

→ `docs/custom-scraping/{自治体名}.md` に方針ドキュメントを作成する必要あり。

#### C. 未発見（会議録システムが見つからない）

| 自治体 | 備考 |
|--------|------|
| ... | ... |

→ 会議録がオンライン公開されていない、または PDF のみの可能性。

### Step 4: ユーザーへの確認と実行

集約結果を表示した後、ユーザーに次のアクションを確認する:

1. **カテゴリ A の自治体**: 「CSV を更新しますか？」→ 承認されたら `municipalities.csv` を一括更新
2. **カテゴリ B の自治体**: 「調査ドキュメントを作成しますか？」→ 承認されたら `docs/custom-scraping/` に方針ドキュメントを生成
3. **カテゴリ C の自治体**: 情報として報告のみ

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
