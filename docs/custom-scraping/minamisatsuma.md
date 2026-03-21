# 南さつま市議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/minamisatsuma/WebView/rd/council_1.html
- 分類: DiscussVision 社 `smart.discussvision.net` による映像配信システム
- テナント ID: 320
- データ範囲: 平成 29 年（2017）〜現在
- 特記: **テキスト形式の会議録は提供されていない**。映像配信専用システムであり、全期間にわたって `minute_text` が空。

---

## ステータス

**テキスト会議録なし（映像配信のみ）**

全年・全会議を通じて `minute_text` フィールドが空であることを API で確認済み。
テキストスクレイピングの対象外とする。

---

## システム構成

### フロントエンド

| ページ | URL |
| --- | --- |
| 会議名一覧 | `https://smart.discussvision.net/smart/tenant/minamisatsuma/WebView/rd/council_1.html` |
| 条件検索 | `https://smart.discussvision.net/smart/tenant/minamisatsuma/WebView/rd/search.html` |

- jQuery + JSONP ベースの SPA 構成。会議一覧はページ読み込み後に API で動的に描画される。
- 静的 HTML のみでは会議データを取得できない。

### API

ベース URL: `https://smart.discussvision.net/dvsapi/`

すべてのエンドポイントは JSONP 形式（`callback` パラメータ指定）で応答する。

---

## API エンドポイント

### 年一覧の取得

```
GET /dvsapi/yearlist?tenant_id=320&callback={fn}
```

**レスポンス例:**

```json
[
  { "label": "令和8年", "value": 2026 },
  { "label": "令和7年", "value": 2025 },
  ...
  { "label": "平成29年", "value": 2017 }
]
```

### 会議一覧の取得

```
GET /dvsapi/councilrd/all?tenant_id=320&year={year}&callback={fn}
```

**レスポンス構造:**

```json
[
  {
    "council_id": "38",
    "year": "2025-02-19",
    "label": "令和7年第2回定例会",
    "schedules": [
      {
        "schedule_id": "2",
        "label": "2月20日　一般質問",
        "is_newest": false,
        "playlist": [
          {
            "playlist_id": "1",
            "speaker": "加藤彰",
            "speaker_id": "24",
            "speaker_img": "21kato-akira.jpg",
            "content": "１．認知症地域共生への取組\n２．家族介護・認知症カフェ",
            "movie_name1": "minamisatsuma/2025/2025022001.mp4",
            "vtt_name": null,
            "movie_released": "2"
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
| `council_id` | 会議 ID（年度内で連番） |
| `schedule_id` | 日程 ID（会議内で連番） |
| `playlist_id` | プレイリスト ID（同日の発言者ごと） |
| `speaker` | 発言者氏名（一般質問時のみ設定。開会・閉会等は null） |
| `speaker_id` | 発言者 ID |
| `content` | 質問・議題の概要（数行程度のテキスト。全文ではない） |
| `movie_name1` | 動画ファイルパス |
| `vtt_name` | 字幕ファイルパス（全レコードで null） |
| `minute_text` | テキスト会議録（全レコードで空配列） |
| `movie_released` | 配信状態（`"2"` = 公開済み） |

### テキスト会議録の取得（未実装）

```
GET /dvsapi/minute/text?tenant_id=320&council_id={id}&schedule_id={id}&playlist_id={id}&callback={fn}
```

全レコードで `error_code: 2004`（データなし）が返る。

### キーワード検索

```
GET /dvsapi/councilrd/search?tenant_id=320&keywords={kw}&logical_op=AND&from={yyyy/mm/dd}&to={yyyy/mm/dd}&callback={fn}
```

- `keywords`: スペース区切りで複数指定
- `logical_op`: `AND` / `OR`
- `from`, `to`: 期間絞り込み（省略可）
- `group_id`, `speaker_id`, `council_id`, `schedule_id`, `playlist_id`: 絞り込み（省略可）

検索は `content`（概要）フィールドに対して行われる。全文テキスト会議録は存在しないため、検索精度は低い。

---

## 取得可能なデータ

| データ種別 | 取得可否 | 備考 |
| --- | --- | --- |
| 会議名・日付 | ○ | `label`、`year` フィールド |
| 日程名 | ○ | `schedules[].label` |
| 発言者氏名 | △ | 一般質問のみ。開会・閉会・採決等は null |
| 質問概要 | ○ | `content` フィールド（数行程度） |
| 全文テキスト会議録 | ✕ | 全期間で未提供 |
| 動画 URL | ○ | `movie_name1`（MP4 パス） |
| 字幕（VTT） | ✕ | 全レコードで null |

---

## 注意事項

- `announcement` には「配信される映像及び音声は、南さつま市議会の公式記録ではありません」と明記されている。
- `content` フィールドの質問概要は数行程度の要約であり、全文会議録の代替にはならない。
- API は JSONP のみ対応。`callback` パラメータを省略するとエラーになる。
- `movie_released` が `"2"` 以外の場合は未公開の可能性がある。

---

## 推奨アプローチ

テキスト会議録が存在しないため、**現時点ではスクレイピング対象外**とする。

将来的にテキスト会議録が追加された場合の実装方針:

1. `yearlist` API で対象年一覧を取得
2. `councilrd/all` API で各年の会議・日程・プレイリストを列挙
3. `minute/text` API で `minute_text` が空でないレコードを特定してテキストを取得
4. メタ情報（日付・会議名・発言者）は `councilrd/all` レスポンスから抽出
