# 滑川町議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/namegawa/WebView/rd/council_1.html
- 分類: DiscussVision Smart システム（REST JSON API 経由でデータ取得）
- 文字コード: UTF-8
- テナント ID: `570`
- 特記: 動画配信システムと連動した会議録管理。HTML ページはシェル的な構造で、コンテンツは JSONP API から取得される

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議名一覧 | `https://smart.discussvision.net/smart/tenant/namegawa/WebView/rd/council_1.html` |
| 日程一覧 | `https://smart.discussvision.net/smart/tenant/namegawa/WebView/rd/schedule.html?council_id={council_id}&schedule_id={schedule_id}&year={year}` |
| 発言内容 | `https://smart.discussvision.net/smart/tenant/namegawa/WebView/rd/speech.html?council_id={council_id}&schedule_id={schedule_id}&playlist_id={playlist_id}` |
| 検索結果 | `https://smart.discussvision.net/smart/tenant/namegawa/WebView/rd/result.html` |

HTML ページ自体にコンテンツは含まれない。データはすべて下記の API から JSONP 形式で取得する。

---

## API エンドポイント

ベース URL: `https://smart.discussvision.net/dvsapi/`

| API | エンドポイント | 主なパラメータ |
| --- | --- | --- |
| 年一覧取得 | `GET /yearlist` | `tenant_id` |
| 会議一覧取得 | `GET /councilrd/all` | `tenant_id`, `year`, `council_id`（省略可） |
| キーワード検索 | `GET /councilrd/search` | `tenant_id`, `keywords`, `logical_op`, `from`, `to`, `council_id`, `schedule_id`, `playlist_id` |
| 議員一覧取得 | `GET /speaker/list` | `tenant_id`, `search_index`, `speaker_id` |

すべて JSONP 形式。クエリパラメータに `callback={関数名}` を付与するとコールバック形式で返る。スクレイパーでは `callback` を付けず JSON として直接取得するか、レスポンスのラッパー部分を除去して使う。

---

## 年度範囲

`/yearlist` API の返却値（2026年3月時点）:

| ラベル | value（西暦） |
| --- | --- |
| 令和8年 | 2026 |
| 令和7年 | 2025 |
| 令和6年 | 2024 |
| 令和5年 | 2023 |
| 令和4年 | 2022 |
| 令和3年 | 2021 |
| 令和2年 | 2020 |

データは令和2年（2020年）から提供されている。

---

## データ構造

### `/councilrd/all` レスポンス

`year` パラメータで年を指定すると、その年の全会議が返る。

```json
[
  {
    "council_id": "19",
    "year": "2024-03-13",
    "label": "令和６年第２４０回滑川町議会定例会",
    "schedules": [
      {
        "schedule_id": "1",
        "label": "03月05日　本会議",
        "is_newest": false,
        "playlist": [
          {
            "playlist_id": "1",
            "speaker": null,
            "speaker_id": "0",
            "content": "本会議　午前10時開会\n\n１　開会及び開議の宣告\n...",
            "movie_name1": "namegawa/W_r06/0305-001.mp4",
            "movie_released": "2",
            "vod_unreleased_comment": "作成中"
          },
          {
            "playlist_id": "1",
            "speaker": "赤沼正副議員",
            "speaker_id": "17",
            "content": "１　町史編集について\n２　町道整備（補修等）について",
            "movie_name1": "namegawa/W_r06/0306-001.mp4",
            "movie_released": "2"
          }
        ],
        "minute_text": []
      }
    ]
  }
]
```

### フィールドの意味

| フィールド | 説明 |
| --- | --- |
| `council_id` | 会議 ID（連番）。令和2年が `1` から始まり、順次増加 |
| `year` | 会議の開催開始日（ISO 形式） |
| `label` | 会議名（例: `令和６年第２４０回滑川町議会定例会`） |
| `schedule_id` | 日程 ID（会議内の連番） |
| `schedule.label` | 日程名（例: `03月05日　本会議`） |
| `playlist_id` | 発言単位の ID（日程内の連番） |
| `speaker` | 発言者名（一般質問など発言者が特定できる場合のみ設定。`null` の場合はその他の議事） |
| `speaker_id` | 発言者 ID（`"0"` は発言者未特定） |
| `content` | 発言内容テキスト（改行区切りで議題・発言要旨が記載） |
| `movie_name1` | 動画ファイルパス |
| `movie_released` | 動画公開状態（`"2"` = 公開済み） |

---

## 会議種別

会議名ラベルから判別できる会議種別（実データより）:

- `定例会` 本会議
- `臨時会` 本会議
- `予算審査特別委員会`
- `総務経済建設常任委員会`（スケジュール名に含まれる）
- `文教厚生常任委員会`（スケジュール名に含まれる）

---

## スクレイピング戦略

### Step 1: 年一覧の取得

```
GET https://smart.discussvision.net/dvsapi/yearlist?tenant_id=570
```

取得した `value`（西暦）リストを以降のループで使用する。

### Step 2: 会議一覧の取得（年ごと）

```
GET https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=570&year={year}
```

各 `year` 値に対して実行し、全会議データ（`council_id`、`schedules`、`playlist` 含む）を取得する。ページネーションはなく、1 リクエストで該当年の全件が返る。

### Step 3: コンテンツのパース

API レスポンスの各 `playlist` エントリから以下を抽出する:

- **会議名**: `council.label`（例: `令和６年第２４０回滑川町議会定例会`）
- **開催日**: `schedule.label` 先頭の日付部分（例: `03月05日`）または `council.year` フィールド
- **日程名**: `schedule.label`（例: `03月05日　本会議`）
- **発言者**: `playlist.speaker`（`null` の場合は発言者なし）
- **発言内容**: `playlist.content`（改行区切りのテキスト）

### 開催日の抽出

`council.year` は `"2024-03-13"` 形式（会議の最終日または主要日）。日ごとの詳細は `schedule.label` から取得する。

```typescript
// スケジュールラベルから日付を抽出
const dateMatch = schedule.label.match(/^(\d{2})月(\d{2})日/);
// council.year の年部分と組み合わせて完全な日付を構成
const year = council.year.substring(0, 4);
const date = `${year}-${dateMatch[1]}-${dateMatch[2]}`;
```

### 発言者の取り扱い

`speaker` フィールドが `null` または `speaker_id` が `"0"` の場合、その `playlist` エントリは個人の発言として識別できない（開会宣告、議案審議、議長進行など）。

一般質問や議案質疑で発言者が特定されている場合、`speaker` フィールドに `"{氏名}議員"` 形式で設定されている。

```
// 発言者あり例
"speaker": "赤沼正副議員"
"speaker": "阿部弘明議員"

// 発言者なし例
"speaker": null
"speaker_id": "0"
```

---

## 注意事項

- `minute_text` フィールドは現状すべて空配列 `[]` であり、会議録テキストは `content` フィールドのみに含まれる
- `content` は発言要旨・議題名であり、逐語的な発言録ではない（動画の字幕や詳細会議録は別途提供されていない）
- `movie_released` が `"2"` 以外（例: `"1"` = 未公開）の場合は動画が非公開。コンテンツ取得自体は可能
- 令和2年（2020年）以前のデータは提供されていない

---

## 推奨アプローチ

1. **年ごとのバッチ取得**: `yearlist` API で年リストを取得し、各年の `councilrd/all` を呼び出して全データを収集する
2. **差分更新**: `council_id` は通し番号のため、前回取得済みの最大 `council_id` 以降のみ取得する差分更新が可能
3. **レート制限**: リクエスト間に 1〜2 秒の待機時間を設ける
4. **`councilrd/search` の活用**: キーワード検索や期間・議員絞り込みが必要な場合は `/councilrd/search` エンドポイントを使用する（全件取得の場合は `keywords` を空にする）
