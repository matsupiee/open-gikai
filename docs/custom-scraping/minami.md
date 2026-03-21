# 美波町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.minami.lg.jp/gikai/kaigiroku
- 分類: NTT アドバンステクノロジ製クラウド型会議録管理システム（ssp.kaigiroku.net）経由
- 文字コード: UTF-8
- 対象期間: 平成30年（2018年）以降の定例会・臨時会
- 特記: 会議録本体は外部システム（ssp.kaigiroku.net）の REST API で提供。役場公式サイトのページ（/gikai/docs/562.html）は外部システムへのリンクのみ掲載。

---

## 構成の全体像

```
美波町役場公式サイト
└─ /gikai/kaigiroku/         … 会議録一覧ページ（ページネーションあり）
   ├─ /gikai/docs/562.html   … 平成30年以降（外部システムへのリンク）
   └─ /gikai/docs/xxx.html   … 平成29年以前（PDF リンク）

外部システム（DNP 製）
└─ https://ssp.kaigiroku.net/tenant/minami/SpTop.html  … 会議録検索トップ
   └─ REST API: https://ssp.kaigiroku.net/dnp/search/  … データ取得 API
```

平成30年（2018年）以降の会議録は外部システムのみに存在し、API で取得する。
平成29年以前は役場サイト上の PDF リンクからのみ取得可能（本方針では対象外）。

---

## 外部システムの API

### 基本情報

| 項目 | 値 |
| --- | --- |
| API ベース URL | `https://ssp.kaigiroku.net/dnp/search/` |
| テナント ID | `426` |
| HTTP メソッド | POST |
| Content-Type | `application/x-www-form-urlencoded` |
| レスポンス形式 | JSON |

### 主要エンドポイント一覧

| エンドポイント | パス | 用途 |
| --- | --- | --- |
| 会議一覧 | `councils/index` | council_id の全量取得 |
| 会議詳細 | `councils/view` | 会議名・メタ情報の取得 |
| 日程一覧 | `minutes/get_schedule` | schedule_id 一覧の取得 |
| 会議録本文 | `minutes/get_minute` | 発言テキストの取得 |

---

## スクレイピング戦略

### Step 1: 会議一覧（council_id）の全量取得

```
POST https://ssp.kaigiroku.net/dnp/search/councils/index
Body: tenant_id=426
```

レスポンス構造:

```json
{
  "councils": [
    {
      "view_years": [
        {
          "view_year": "2025",
          "japanese_year": "令和7年",
          "council_type": [
            {
              "council_type_path": "/0/1/3/6/",
              "council_type_name1": "全会議",
              "council_type_name2": "本会議",
              "council_type_name3": "定例会",
              "councils": [
                { "council_id": 45, "name": "令和　７年　　９月　定例会（第３回）" }
              ]
            },
            {
              "council_type_path": "/0/1/3/7/",
              "council_type_name3": "臨時会",
              "councils": [
                { "council_id": 43, "name": "令和　７年　　５月　臨時会（第１回）" }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

- `council_type_path` が `/0/1/3/6/` → 定例会、`/0/1/3/7/` → 臨時会
- `council_id` は 1 始まりの連番（2025年時点で最大 45）
- 掲載範囲: 平成30年（2018年）〜現在

### Step 2: 日程一覧（schedule_id）の取得

```
POST https://ssp.kaigiroku.net/dnp/search/minutes/get_schedule
Body: tenant_id=426&council_id={council_id}
```

レスポンス構造:

```json
{
  "council_schedules": [
    {
      "schedule_id": 2,
      "name": "03月05日－01号",
      "page_no": 4
    }
  ]
}
```

- `schedule_id` は会議内の日ごとの会議録 ID
- `name` は「MM月DD日－NN号」形式（開催日の特定に使用可能）

### Step 3: 会議録本文の取得

```
POST https://ssp.kaigiroku.net/dnp/search/minutes/get_minute
Body: tenant_id=426&council_id={council_id}&schedule_id={schedule_id}&page_no=1&limit=100
```

レスポンス構造:

```json
{
  "tenant_minutes": [
    {
      "minute_id": 1,
      "title": "（名簿）",
      "page_no": 4,
      "body": "<pre>平成３０年　　３月　定例会（第１回）\n\n1.会議事件は次のとおりである。\n..."
    },
    {
      "minute_id": 2,
      "title": "議長（川尻竹藏）",
      "page_no": 5,
      "body": "<pre>○議長（川尻竹藏）　おはようございます。..."
    }
  ]
}
```

- `body` は `<pre>` タグで囲まれたプレーンテキスト
- `title` フィールドに発言者名が格納される（最初の要素は名簿等のメタ情報）
- `limit` パラメータで取得件数を制御（デフォルト値は未確認、100 程度を推奨）
- `page_no` でページネーションが可能（大規模な会議録に対応）

---

## 会議録のパース

### メタ情報

`body` の先頭行から抽出:

```
平成３０年　　３月　定例会（第１回）
```

- 開催年: 全角数字で元号年 `令和X年` または `平成X年`
- 会議種別: `定例会` または `臨時会`
- 回数: `（第X回）`

`councils/view` API でも会議名を取得可能:

```
POST https://ssp.kaigiroku.net/dnp/search/councils/view
Body: tenant_id=426&council_id={council_id}
```

```json
{
  "council": {
    "tenant_name": "美波町",
    "council_id": 1,
    "name": "平成３０年　　３月　定例会（第１回）"
  }
}
```

### 発言者パターン

`title` フィールドおよび `body` の先頭行から抽出:

```
議長（川尻竹藏）
副議長（〇〇〇〇）
〇番（〇〇〇〇）
町長（〇〇〇〇）
教育長（〇〇〇〇）
〇〇課長（〇〇〇〇）
```

`body` 内の発言マーカーは `○` 始まり:

```
○議長（川尻竹藏）　おはようございます。…
○3番（〇〇〇〇）　…
```

#### パース用正規表現（案）

```typescript
// title フィールドから役職・氏名を抽出
const speakerPattern = /^(.+?)（(.+?)）/;
// 例: "議長（川尻竹藏）" → role="議長", name="川尻竹藏"

// body 内の発言行の検出
const speechLinePattern = /^○(.+?)（(.+?)）/m;

// 開催日の抽出（全角）
const datePattern = /(?:令和|平成)(\d+)年\s*(\d+)月\s*(\d+)日/;

// 年度（元号）の抽出
const yearPattern = /(?:令和|平成)(\d+)年\s*(\d+)月\s*定例会|臨時会/;
```

---

## 取得対象の会議

掲載されている会議は本会議（定例会・臨時会）のみ。委員会の会議録は含まれない。

| council_type_path | 会議種別 |
| --- | --- |
| `/0/1/3/6/` | 定例会 |
| `/0/1/3/7/` | 臨時会 |

---

## 注意事項

- API は POST リクエストのみ受け付ける（GET では 400 エラー）
- JSONP 形式は使用しない（型は `application/x-www-form-urlencoded`）
- `tenant_id=426` は必須パラメータ（省略すると Internal Error）
- 自治体サイトへの直接アクセスは不要（`/gikai/docs/562.html` はリンクページのみ）
- レート制限: ssp.kaigiroku.net は外部 SaaS のため、リクエスト間に 1〜2 秒の待機を設ける

---

## 推奨アプローチ

1. `councils/index` で council_id の全量リストを取得（1 リクエスト）
2. 各 council_id に対して `minutes/get_schedule` で schedule_id 一覧を取得
3. 各 schedule_id に対して `minutes/get_minute` で発言本文を取得
4. `tenant_minutes` 配列を順番に処理し、`title` を発言者名、`body` を発言内容としてパース
5. 差分更新: council_id は連番なので、前回取得済みの最大 ID 以降のみ取得する差分更新が可能
