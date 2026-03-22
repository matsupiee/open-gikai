# 中土佐町議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/nakatosa/WebView/rd/council_1.html
- 分類: NTT-AT が提供する DiscussVisionSmart（`smart.discussvision.net`）による議会映像配信システム
- テナント ID: 182
- データ範囲: 平成 28 年（2016）〜現在
- 文字コード: UTF-8
- 特記: **テキスト形式の会議録は提供されていない**。映像配信専用システムであり、全期間にわたって `minute_text` が空。

---

## ステータス

**テキスト会議録なし（映像配信のみ）**

全年・全会議を通じて `minute_text` フィールドが空配列であることを API で確認済み。
テキストスクレイピングの対象外とする。

---

## システム構成

### フロントエンド

| ページ | URL |
| --- | --- |
| 会議名一覧（映像） | `https://smart.discussvision.net/smart/tenant/nakatosa/WebView/rd/council_1.html` |
| 会議名一覧（会議録） | `https://smart.discussvision.net/smart/tenant/nakatosa/WebView/rd/council_2.html` |
| 条件検索 | `https://smart.discussvision.net/smart/tenant/nakatosa/WebView/rd/search.html` |

- jQuery + JSONP ベースの SPA 構成。会議一覧はページ読み込み後に API で動的に描画される。
- `customize_rd.js` の `COUNCIL = "council_1.html"` 設定により、エントリーポイントは映像配信ページ（`council_1.html`）。
- 静的 HTML のみでは会議データを取得できない。

### テナント設定

テナント ID は `tenant.js` で定義される:

```
https://smart.discussvision.net/smart/tenant/nakatosa/WebView/js/tenant.js
```

```javascript
document.write('<input type="hidden" name="tenant_id" value="182">');
```

### API

ベース URL: `https://smart.discussvision.net/dvsapi/`

すべてのエンドポイントは JSONP 形式（`callback` パラメータ指定）で応答する。

---

## API エンドポイント

### 年一覧の取得

```
GET /dvsapi/yearlist?tenant_id=182&callback={fn}
```

**レスポンス例:**

```json
[
  { "label": "令和8年", "value": 2026 },
  { "label": "令和7年", "value": 2025 },
  { "label": "令和6年", "value": 2024 },
  { "label": "令和5年", "value": 2023 },
  { "label": "令和4年", "value": 2022 },
  { "label": "令和3年", "value": 2021 },
  { "label": "令和2年", "value": 2020 },
  { "label": "令和元年／平成31年", "value": 2019 },
  { "label": "平成30年", "value": 2018 },
  { "label": "平成29年", "value": 2017 },
  { "label": "平成28年", "value": 2016 }
]
```

対象年範囲: 平成 28 年（2016）〜令和 8 年（2026）（計 11 年）

### 会議一覧の取得

```
GET /dvsapi/councilrd/all?tenant_id=182&year={year}&callback={fn}
```

**レスポンス構造:**

```json
[
  {
    "council_id": "72",
    "year": "2025-03-03",
    "label": "令和7年3月定例会（通常会議）",
    "schedules": [
      {
        "schedule_id": "2",
        "label": "3月13日　個別質問",
        "is_newest": false,
        "playlist": [
          {
            "playlist_id": "1",
            "speaker_img": null,
            "speaker": "高橋雄造議員",
            "speaker_id": "13",
            "content": "1.町行政の姿勢について\n2.県道鷹川中土佐線の改良計画について\n3.町内にある音楽愛好家（グループ）の活動支援について",
            "movie_name1": "nakatosa/2025/2025031301.mp4",
            "movie_name2": null,
            "movie_name3": null,
            "time_duration": null,
            "movie_released": "2",
            "vtt_name": null
          }
        ],
        "minute_text": []
      }
    ]
  }
]
```

**主要フィールドの説明:**

| フィールド | 内容 |
| --- | --- |
| `council_id` | 会議 ID（全期間で連番） |
| `schedule_id` | 日程 ID（会議内で連番） |
| `playlist_id` | プレイリスト ID（同日の発言者ごと） |
| `speaker` | 発言者氏名（個別質問時のみ設定。開会・閉会等は null） |
| `speaker_id` | 発言者 ID |
| `content` | 質問・議題の概要（数行程度のテキスト。全文ではない） |
| `movie_name1` | 動画ファイルパス（例: `nakatosa/2025/2025031301.mp4`） |
| `vtt_name` | 字幕ファイルパス（全レコードで null） |
| `minute_text` | テキスト会議録（全レコードで空配列） |
| `movie_released` | 配信状態（`"2"` = 公開済み） |

### テキスト会議録の取得

```
GET /dvsapi/minute/text?tenant_id=182&council_id={id}&schedule_id={id}&playlist_id={id}&callback={fn}
```

全レコードで `error_code: 2004`（データなし）が返る見込み。

### キーワード検索

```
GET /dvsapi/councilrd/search?tenant_id=182&keywords={kw}&logical_op=AND&from={yyyy/mm/dd}&to={yyyy/mm/dd}&callback={fn}
```

- `keywords`: スペース区切りで複数指定
- `logical_op`: `AND` / `OR`
- `from`, `to`: 期間絞り込み（省略可）
- `group_id`, `speaker_id`, `council_id`, `schedule_id`, `playlist_id`: 絞り込み（省略可）

検索は `content`（概要）フィールドに対して行われる。全文テキスト会議録は存在しないため、検索精度は低い。

---

## 会議種別

定例会（3 月・6 月・9 月・12 月）と臨時会（随時）が存在する。委員会の記録は含まれず、本会議のみ。

中土佐町議会では「通常会議」と「臨時会議」の区分が使われている（例: 「令和7年3月定例会（通常会議）」「令和6年12月定例会（第1回臨時会議）」）。

---

## 取得可能なデータ

| データ種別 | 取得可否 | 備考 |
| --- | --- | --- |
| 会議名・日付 | ○ | `label`、`year` フィールド |
| 日程名 | ○ | `schedules[].label` |
| 発言者氏名 | △ | 個別質問のみ。開会・閉会・採決等は null |
| 質問概要 | ○ | `content` フィールド（数行程度） |
| 全文テキスト会議録 | × | 全期間で未提供 |
| 動画 URL | ○ | `movie_name1`（MP4 パス） |
| 字幕（VTT） | × | 全レコードで null |

---

## 注意事項

- DiscussVisionSmart は NTT-AT が提供する SaaS 型サービスのため、システム仕様がバージョンアップで変更される可能性がある
- `content` フィールドの質問概要は数行程度の要約であり、全文会議録の代替にはならない
- API は JSONP のみ対応。`callback` パラメータを省略するとエラーになる
- `movie_released` が `"2"` 以外の場合は未公開の可能性がある
- 約 300 自治体で導入されているシステムのため、他テナントと同一の API 構造を持つ

---

## 推奨アプローチ

テキスト会議録が存在しないため、**現時点ではスクレイピング対象外**とする。

将来的にテキスト会議録が追加された場合の実装方針:

1. `yearlist` API で対象年一覧を取得（`/dvsapi/yearlist?tenant_id=182`）
2. `councilrd/all` API で各年の会議・日程・プレイリストを列挙
3. `minute/text` API で `minute_text` が空でないレコードを特定してテキストを取得
4. メタ情報（日付・会議名・発言者）は `councilrd/all` レスポンスから抽出
5. レート制限: SaaS サービスのため、過度なリクエストは IP ブロックのリスクがある。リクエスト間隔は 2〜3 秒以上を推奨
