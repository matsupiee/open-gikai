# 河北町議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/kahoku/WebView/rd/council_1.html
- 分類: DiscussVision Smart（議会映像配信・会議録検索システム）
- 文字コード: UTF-8
- テナント ID: `396`
- 特記: 議会映像配信が主体。会議録テキスト（`minute/text` API）は未登録（error_code 2004）。発言内容の要約テキスト・発言者情報は API から取得可能。

---

## URL 構造

### フロントエンド（HTML）

| ページ | URL パターン |
| --- | --- |
| 会議名一覧 | `https://smart.discussvision.net/smart/tenant/kahoku/WebView/rd/council_1.html` |
| 発言一覧（日程別） | `https://smart.discussvision.net/smart/tenant/kahoku/WebView/rd/schedule.html?year={年}&council_id={会議ID}&schedule_id={日程ID}` |
| 発言内容（個別） | `https://smart.discussvision.net/smart/tenant/kahoku/WebView/rd/speech.html?year={年}&council_id={会議ID}&schedule_id={日程ID}&playlist_id={プレイリストID}&speaker_id={発言者ID}` |
| 検索結果 | `https://smart.discussvision.net/smart/tenant/kahoku/WebView/rd/result.html?keyword={キーワード}` |

### バックエンド API（JSONP）

ベース URL: `https://smart.discussvision.net/dvsapi/`

| API | エンドポイント | 主要パラメータ |
| --- | --- | --- |
| 年度一覧 | `yearlist` | `tenant_id` |
| 会議・日程・発言一覧 | `councilrd/all` | `year`, `tenant_id`, `group_desc`, `council_desc`, `schedule_desc`, `council_id`, `schedule_id` |
| キーワード検索 | `councilrd/search` | `tenant_id`, `keywords`, `logical_op`, `from`, `to`, `group_id`, `speaker_id`, `council_id`, `schedule_id`, `playlist_id` |
| 発言者一覧 | `speaker/list` | `tenant_id`, `search_index`, `speaker_id` |
| 会議録テキスト | `minute/text` | `tenant_id`, `council_id`, `schedule_id`, `playlist_id` |
| ライブ情報 | `councilrd/live` | `tenant_id`, `council_id` |

---

## 検索パラメータ

### year（年度一覧）

`yearlist` API で取得可能。現在の範囲:

| label | value |
| --- | --- |
| 令和8年 | 2026 |
| 令和7年 | 2025 |
| 令和6年 | 2024 |
| 令和5年 | 2023 |
| 令和4年 | 2022 |
| 令和3年 | 2021 |
| 令和2年 | 2020 |
| 令和元年/平成31年 | 2019 |
| 平成30年 | 2018 |

### 会議種別（API レスポンスから動的取得）

会議名は `councilrd/all` の `label` フィールドで返される。固定 ID ではなく、`council_id` は連番で管理される。

主な会議種別パターン:
- `{年}月臨時会`（例: 令和6年1月臨時会）
- `{年}月定例会`（例: 令和6年3月定例会）

### 日程種別（schedule の label）

- `{月日} 開会`
- `{月日} 一般質問`
- `{月日} 予算審査特別委員会`
- `{月日} 決算審査特別委員会`
- `{月日} 閉会`
- `{月日} 臨時会`

---

## データ構造

### `councilrd/all` レスポンス

```json
[
  {
    "council_id": "98",
    "year": "2024-03-15",
    "label": "令和6年3月定例会",
    "schedules": [
      {
        "schedule_id": "2",
        "label": "03月08日　一般質問",
        "is_newest": false,
        "playlist": [
          {
            "playlist_id": "1",
            "speaker": "吉田芳美議員",
            "speaker_id": "20",
            "content": "１　新型コロナウイルス...\n２　町道の整備事業...",
            "movie_name1": "kahoku/2024/0308000201.mp4",
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

### 主要フィールド

| フィールド | 説明 |
| --- | --- |
| `council_id` | 会議 ID（連番文字列） |
| `year` | 会議の日付（`YYYY-MM-DD` 形式） |
| `label` | 会議名（例: 令和6年3月定例会） |
| `schedule_id` | 日程 ID |
| `schedules[].label` | 日程名（例: 03月08日 一般質問） |
| `playlist[].speaker` | 発言者名（例: 吉田芳美議員）、null の場合あり |
| `playlist[].speaker_id` | 発言者 ID |
| `playlist[].content` | 発言内容の要約（議題一覧）、改行区切り |
| `playlist[].movie_name1` | 動画ファイルパス |
| `playlist[].movie_released` | 公開状態（`"2"` = 公開済み） |
| `minute_text` | 会議録テキスト（現状は常に空配列） |

---

## スクレイピング戦略

### Step 1: 年度一覧の取得

```
GET https://smart.discussvision.net/dvsapi/yearlist?tenant_id=396
```

全年度の `value`（西暦年）を取得する。

### Step 2: 会議・日程・発言者の全量取得

各年度について `councilrd/all` を呼び出し、会議構造を取得する。

```
GET https://smart.discussvision.net/dvsapi/councilrd/all?year={年}&tenant_id=396&group_desc=false&council_desc=false&schedule_desc=false&council_id=&schedule_id=
```

レスポンスから以下を抽出:
- **会議情報**: `council_id`, `label`, `year`
- **日程情報**: `schedule_id`, `label`
- **発言者情報**: `speaker`, `speaker_id`, `content`

### Step 3: 会議録テキストの取得（将来対応）

`minute/text` API は現状 error_code 2004（データなし）を返す。将来的にテキストが登録される可能性があるため、以下のエンドポイントで定期的に確認する。

```
GET https://smart.discussvision.net/dvsapi/minute/text?tenant_id=396&council_id={会議ID}&schedule_id={日程ID}&playlist_id={プレイリストID}
```

### Step 4: キーワード検索による補完

`councilrd/search` API でキーワード検索が可能。発言内容の `content` フィールドに対して検索される。

```
GET https://smart.discussvision.net/dvsapi/councilrd/search?tenant_id=396&keywords={キーワード}&logical_op=and&from=&to=&group_id=&speaker_id=&council_id=&schedule_id=&playlist_id=
```

レスポンスには `hits`（件数）と `councils`（検索結果の会議構造）が含まれる。

---

## 注意事項

- **会議録テキストが存在しない**: 現時点では `minute/text` API は全ての会議でデータなし（error_code 2004）を返す。取得できるのは発言の要約テキスト（`content` フィールド = 議題一覧）のみ。
- **API は JSONP 形式**: ブラウザからは JSONP で呼ばれるが、サーバーサイドからは通常の JSON として取得可能。
- **動画のみの会議**: 臨時会や開会・閉会は `speaker` が null で、`content` に議事次第のみが記載される。
- **発言者名の形式**: `{氏名}議員`（例: 吉田芳美議員）。役職付きの表記はなく、議員名のみ。
- **`council_id` は連番**: 全年度通しの連番（36〜115+）で管理される。年度ごとにリセットされない。

---

## 推奨アプローチ

1. **API ベースで取得**: HTML スクレイピングは不要。全データが REST API（`/dvsapi/`）から JSON で取得可能。
2. **全年度の一括取得**: `yearlist` → 各年度の `councilrd/all` で会議構造の全量を取得（年度数 = 9、リクエスト数 = 10 程度）。
3. **レート制限**: リクエスト間に 1〜2 秒の待機時間を設ける。
4. **差分更新**: `council_id` の連番を利用し、前回取得済みの最大 ID 以降のみを取得する差分更新が可能。
5. **会議録テキストの監視**: `minute/text` API を定期的にチェックし、テキストが登録された場合は自動取得に切り替える。
