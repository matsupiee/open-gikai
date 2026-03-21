# 岩手町議会 カスタムスクレイピング方針

## 概要

- サイト: https://town.iwate.iwate.jp/gikai/minutes/search-minutes/
- 分類: NTT アドバンステクノロジ製クラウド型会議録管理システム（ssp.kaigiroku.net）経由。既存の `discussnet_ssp` アダプターで対応可能。
- 文字コード: UTF-8
- 対象期間: 平成26年（2014年）〜 現在
- 特記: 2024年12月に独自の会議録検索システムを導入。町公式サイトの検索ページは外部システム（ssp.kaigiroku.net）へのリンクのみ掲載。

---

## 構成の全体像

```
岩手町公式サイト
└─ /gikai/minutes/search-minutes/  … 会議録検索ページ（外部システムへのリンクのみ）

外部システム（DNP 製 DiscussNet SSP）
└─ https://ssp.kaigiroku.net/tenant/iwate/SpTop.html  … 会議録検索トップ
   └─ REST API: https://ssp.kaigiroku.net/dnp/search/  … データ取得 API
```

会議録データは外部システムの REST API からのみ取得可能。町公式サイトにはリンクのみ存在する。

---

## テナント情報

| 項目 | 値 |
| --- | --- |
| テナントスラッグ | `iwate` |
| テナント ID | `625` |
| tenant.js URL | `https://ssp.kaigiroku.net/tenant/iwate/js/tenant.js` |
| 閲覧 URL | `https://ssp.kaigiroku.net/tenant/iwate/SpTop.html` |
| WEB マニュアル | `https://ssp.kaigiroku.net/tenant/help/user_guide.html` |

---

## API エンドポイント

ベース URL: `https://ssp.kaigiroku.net/dnp/search`

全エンドポイントは `POST` メソッド、`Content-Type: application/x-www-form-urlencoded` で共通パラメータ `tenant_id=625` を送信する。

| エンドポイント | 用途 |
| --- | --- |
| `councils/index` | 会議（council）一覧の取得 |
| `minutes/get_schedule` | 指定 council の日程（schedule）一覧の取得 |
| `minutes/get_minute` | 指定 schedule の議事録本文の取得 |

---

## 会議種別

| 種別 | council_type_path | 説明 |
| --- | --- | --- |
| 定例会 | `/0/1/3/6/` | 本会議 > 定例会。年4回（第1回〜第4回）開催 |
| 臨時会 | `/0/1/3/7/` | 本会議 > 臨時会。年1〜3回程度 |
| 予算審査特別委員会 | `/0/1/4/9/10/` | 委員会 > 特別委員会 > 予算審査特別委員会 |
| 決算審査特別委員会 | `/0/1/4/9/11/` | 委員会 > 特別委員会 > 決算審査特別委員会 |

---

## データ範囲

| 年 | 和暦 | 会議数 |
| --- | --- | --- |
| 2014 | 平成26年 | 10 |
| 2015 | 平成27年 | 11 |
| 2016 | 平成28年 | 9 |
| 2017 | 平成29年 | 7 |
| 2018 | 平成30年 | 9 |
| 2019 | 令和元年/平成31年 | 9 |
| 2020 | 令和2年 | 11 |
| 2021 | 令和3年 | 9 |
| 2022 | 令和4年 | 9 |
| 2023 | 令和5年 | 12 |
| 2024 | 令和6年 | 9 |
| 2025 | 令和7年 | 8 |
| 2026 | 令和8年 | 1 |

合計: 114 件の council エントリ（2014年〜2026年）

---

## 議事録本文の構造

### minute_type_code

| code | minute_type | 説明 |
| --- | --- | --- |
| 2 | 名簿 | 出席議員・説明員の名簿（パース対象外） |
| 3 | △議題 | 議題の区切り（パース対象外） |
| 4 | ○議長 | 議長発言 → `kind: "remark"` |
| 5 | （質問） | 議員による質問 → `kind: "question"` |
| 6 | （答弁） | 執行部による答弁 → `kind: "answer"` |

### 発言者パターン（title フィールド）

```
議長（武田茂議員）
1番（中居拓也議員）
町長（佐々木光司君）
教育長（八重樫勝君）
```

- `役職（氏名＋敬称）` の形式
- 敬称は「議員」または「君」
- 既存の `parseSpeakerFromTitle()` で対応可能

### 本文（body フィールド）

```html
<pre>○議長（武田茂議員）　ただいまから令和６年第４回岩手町議会定例会を開会いたします。...</pre>
```

- `<pre>` タグで囲まれたプレーンテキスト
- 一部古いデータは `<PRE><TT><FONT SIZE=+１>` 等のレガシー HTML を含む
- 既存の `extractTextFromBody()` で対応可能

---

## スクレイピング戦略

既存の `discussnet_ssp` アダプターがそのまま利用可能。カスタム実装は不要。

### Step 1: テナント ID の取得

`tenant.js` から `tenant_id=625` を取得する（既存の `fetchTenantId("iwate")` で対応）。

### Step 2: 会議一覧の取得

`councils/index` API で全会議一覧を取得する（既存の `fetchCouncils(625)` で対応）。

### Step 3: 日程一覧の取得

各 council_id について `minutes/get_schedule` API で日程一覧を取得する（既存の `fetchSchedules()` で対応）。

### Step 4: 議事録本文の取得

各 schedule_id について `minutes/get_minute` API で議事録本文を取得し、`MeetingData` に変換する（既存の `fetchMinuteData()` で対応）。

---

## 注意事項

- ユーザー向け案内では「2005年〜2024年8月の会議録が閲覧可能」とされているが、API から取得できる実際のデータ範囲は 2014年（平成26年）〜 現在。2005年〜2013年のデータは API には存在しない。
- `ssp.kaigiroku.net` は SPA（Single Page Application）構成のため、HTML を直接スクレイピングしてもデータは取得できない。必ず REST API を使用すること。
- 会議名に全角数字・全角スペースが含まれる（例: `令和　７年　　第４回　定例会`）。既存の `normalizeFullWidth()` で正規化する。
- リクエスト間には適切な待機時間（1〜2秒）を設けること。

---

## 推奨アプローチ

1. **既存アダプターを利用**: `discussnet_ssp` アダプターがそのまま利用可能。テナントスラッグ `iwate`、テナント ID `625` を設定するだけで対応できる。
2. **municipalities.csv への登録**: `system_type` を `discussnet_ssp`、`base_url` を `https://ssp.kaigiroku.net/tenant/iwate/SpTop.html` として登録する。
3. **差分更新**: `externalId`（`discussnet_ssp_625_{council_id}_{schedule_id}` 形式）で既取得分を判定し、差分更新が可能。
4. **レート制限**: 外部サービスのため、リクエスト間に適切な待機時間（1〜2秒）を設ける。
