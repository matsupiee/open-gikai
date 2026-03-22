# 中城村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.nakagusuku.okinawa.jp/detail.jsp?id=99965&menuid=16662&funcid=1
- 会議録検索システム: https://ssp.kaigiroku.net/tenant/nakagusuku/SpTop.html
- 分類: 公式サイト PDF 公開 + 会議録検索システム（SPA / JSON API）
- 文字コード: 公式サイトは EUC-JP、検索システムは UTF-8
- 特記: 検索システムは DNP（大日本印刷）製 SPA で、バックエンドに REST API を持つ。tenant_id=622

---

## データソース

中城村には 2 つのデータソースがある。

| ソース | URL | 形式 | 対象期間 |
| --- | --- | --- | --- |
| 公式サイト | `www.vill.nakagusuku.okinawa.jp` | PDF ファイル | 平成24年度〜令和6年度 |
| 会議録検索システム | `ssp.kaigiroku.net/tenant/nakagusuku/` | JSON API（構造化データ） | 令和2年（2020）〜現在 |

**推奨: 会議録検索システムの JSON API を使用する。** 構造化された発言単位のデータが取得でき、PDF パースが不要。

---

## 会議録検索システム（JSON API）

### API ベース URL

```
https://ssp.kaigiroku.net/dnp/search/
```

### 主要 API エンドポイント

| API | メソッド | 用途 |
| --- | --- | --- |
| `minute_searches/get_search_options` | GET | 検索オプション（年、会議種別、発言者一覧）取得 |
| `councils/index` | POST | 会議一覧（年度別・種別別） |
| `minutes/get_schedule` | POST | 会議の日程一覧（schedule_id の取得） |
| `minutes/get_minute` | POST | 会議録本文（発言単位で構造化済み） |
| `minute_searches/search` | GET | キーワード検索 |
| `councils/get_view_years` | GET | 閲覧可能な年の一覧 |

全 API 共通パラメータ: `tenant_id=622`

### 会議種別（council_type_id）

| council_type_id | 種別 |
| --- | --- |
| 1 | 全会議 |
| 3 | 本会議 |
| 4 | 委員会 |
| 5 | 他会議 |
| 6 | 定例会 |
| 7 | 臨時会 |
| 8 | 常任委員会 |
| 9 | 特別委員会 |
| 10 | 資料 |

### 閲覧可能年

| 年 | 和暦 |
| --- | --- |
| 2025 | 令和7年 |
| 2024 | 令和6年 |
| 2023 | 令和5年 |
| 2022 | 令和4年 |
| 2021 | 令和3年 |
| 2020 | 令和2年 |

---

## スクレイピング戦略

### Step 1: 会議一覧の取得

`councils/index` API で全会議の `council_id` を収集する。

```
POST https://ssp.kaigiroku.net/dnp/search/councils/index
Body: tenant_id=622
```

レスポンス構造:

```json
{
  "councils": [{
    "view_years": [{
      "view_year": "2025",
      "japanese_year": "令和7年",
      "council_type": [{
        "council_type_path": "/0/1/3/6/",
        "council_type_name3": "定例会",
        "councils": [{
          "council_id": 49,
          "name": "令和　７年　　６月　定例会（第５回）"
        }]
      }]
    }]
  }]
}
```

- 1 回の API コールで全年度・全種別の会議一覧が取得できる
- `council_id` は数値（1〜49+）

### Step 2: 日程一覧の取得

各 `council_id` に対して `minutes/get_schedule` で `schedule_id` を取得する。

```
POST https://ssp.kaigiroku.net/dnp/search/minutes/get_schedule
Body: tenant_id=622&council_id=49
```

レスポンス構造:

```json
{
  "council_schedules": [{
    "schedule_id": 2,
    "name": "06月13日－01号",
    "page_no": 33,
    "member_list": "<pre>令和　７年　　６月　定例会（第５回）\n..."
  }]
}
```

- `schedule_id` は会議内の日程（第1日目、第2日目など）を識別
- `member_list` に出席議員名簿がプレーンテキストで含まれる

### Step 3: 会議録本文の取得

`minutes/get_minute` で発言単位の構造化データを取得する。

```
POST https://ssp.kaigiroku.net/dnp/search/minutes/get_minute
Body: tenant_id=622&council_id=49&schedule_id=3
```

レスポンス構造:

```json
{
  "tenant_minutes": [{
    "minute_id": 5,
    "title": "９番（大城常良議員）",
    "page_no": 79,
    "body": "<pre>...</pre>"
  }]
}
```

---

## 発言の構造

### 発言者パターン（title フィールド）

API のレスポンスでは `title` フィールドに発言者情報が構造化されている。

```
議長（伊佐則勝）
村長（比嘉麻乃）
副村長（新垣正）
教育長（比嘉良治）
９番（大城常良議員）
１２番（金城章議員）
総務課長（大湾朝也）
住民生活課長（新垣忍）
福祉課長（照屋淳）
こども課長（比嘉昌子）
産業振興課長兼農業委員会事務局長（仲村武宏）
都市建設課長（呉屋克行）
企画課長（金城勉）
教育総務課長（我謝慎太郎）
生涯学習課長（渡久地真）
```

### 特殊タイトル

```
（名簿）          → 出席者名簿（パース不要）
（１０時００分）    → 開議・議事進行の記述
休憩（１０時５９分） → 休憩
再開（１１時１０分） → 再開
散会（１５時１３分） → 散会
```

### パース用正規表現（案）

```typescript
// 議員の発言者抽出
const memberPattern = /^[０-９]+番（(.+?)議員）$/;
// 例: "９番（大城常良議員）" → name="大城常良"

// 役職者の発言者抽出
const officialPattern = /^(.+?)（(.+?)）$/;
// 例: "議長（伊佐則勝）" → role="議長", name="伊佐則勝"
// 例: "村長（比嘉麻乃）" → role="村長", name="比嘉麻乃"

// 休憩・再開・散会の検出
const sessionControlPattern = /^(休憩|再開|散会)（(.+?)）$/;

// 名簿の検出
const rosterPattern = /^（名簿）$/;
```

### body フィールド

- `<pre>` タグで囲まれたプレーンテキスト
- HTML タグは `<pre>` のみ（パースが容易）
- 改行はそのまま `\n` で含まれる

---

## 公式サイト（PDF）

### URL パターン

```
https://www.vill.nakagusuku.okinawa.jp/UserFiles/File/songikai/gikaigiziroku/{ファイル名}.pdf
```

### ファイル名の命名規則

一貫性のない命名規則が使われている。

```
R6_10kaigiroku.pdf           → 令和6年10月
R6_7_9kaigiroku.pdf          → 令和6年7月〜9月
R5_6_8kaigiroku.pdf          → 令和5年6月〜8月
R4_10-11kaigiroku.pdf        → 令和4年10月〜11月
H30_7.8kaigiroku.pdf         → 平成30年7月〜8月
2015_8-9kaigiroku.pdf        → 2015年8月〜9月（西暦表記）
H24_vol.1_2.pdf              → 平成24年 vol.1〜2
R3_dai2kai_kaigiroku.pdf     → 令和3年 第2回
dai7kaikaigiroku.pdf         → 第7回（年度なし）
```

- 区切り文字が `_`、`-`、`.` と混在
- 年号が和暦（R, H）、西暦（2015）と混在
- PDF のため本文パースは困難

**公式サイトの PDF は検索システムの対象期間外（平成24年〜令和元年）の補完用途としてのみ検討する。**

---

## 注意事項

- API は `tenant_id=622` が必須パラメータ
- `councils/index` は POST メソッドのみ対応（GET ではエラー）
- `get_search_options` は GET メソッドで取得可能
- 会議名は全角数字・全角スペースを含む（例: `令和　７年　　６月　定例会（第５回）`）
- 検索システムの対象期間は令和2年（2020年）以降のみ
- SPA フロントエンドの URL（`SpTop.html` 等）にはデータが含まれず、JavaScript が API を呼び出してレンダリングする

---

## 推奨アプローチ

1. **JSON API を優先**: 会議録検索システムの REST API から構造化データを直接取得する。PDF パースは不要
2. **全量取得フロー**: `councils/index` → 各 `council_id` の `get_schedule` → 各 `schedule_id` の `get_minute` の 3 段階で取得
3. **発言単位の構造化**: API レスポンスの `tenant_minutes` が発言単位で分割済みのため、`title` から発言者、`body` から発言内容を抽出するだけでよい
4. **レート制限**: API サーバへの負荷を考慮し、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: `council_id` は増加方向の数値のため、前回取得済みの最大 ID 以降のみを処理する差分更新が可能
6. **過去データの補完**: 2020年以前のデータが必要な場合のみ、公式サイトの PDF を対象とする
