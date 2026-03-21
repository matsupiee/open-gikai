# 鏡石町議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/kagamiishi/WebView/rd/council_1.html
- 分類: DiscussVision Smart システム（REST JSON API 経由でデータ取得）
- 文字コード: UTF-8
- テナント ID: `685`
- 特記: 動画配信システムと連動した議会映像配信。HTML ページはシェル的な構造で、コンテンツは JSON API から取得される。公式サイト（https://www.town.kagamiishi.fukushima.jp/gikai/）でも PDF 形式で会議録を公開している

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議名一覧 | `https://smart.discussvision.net/smart/tenant/kagamiishi/WebView/rd/council_1.html` |
| 日程一覧（発言者選択） | `https://smart.discussvision.net/smart/tenant/kagamiishi/WebView/rd/schedule.html?council_id={council_id}&schedule_id={schedule_id}&year={year}` |
| 発言内容（映像再生） | `https://smart.discussvision.net/smart/tenant/kagamiishi/WebView/rd/speech.html?council_id={council_id}&schedule_id={schedule_id}&playlist_id={playlist_id}` |
| 検索結果 | `https://smart.discussvision.net/smart/tenant/kagamiishi/WebView/rd/result.html` |

HTML ページ自体にコンテンツは含まれない。データはすべて下記の API から JSON 形式で取得する。

---

## API エンドポイント

ベース URL: `https://smart.discussvision.net/dvsapi/`

| API | エンドポイント | 主なパラメータ |
| --- | --- | --- |
| 年一覧取得 | `GET /yearlist` | `tenant_id` |
| 会議一覧取得 | `GET /councilrd/all` | `tenant_id`, `year`, `council_id`（省略可） |
| キーワード検索 | `GET /councilrd/search` | `tenant_id`, `keywords`, `logical_op`, `from`, `to`, `group_id`, `speaker_id`, `council_id`, `schedule_id`, `playlist_id` |
| 議員一覧取得 | `GET /speaker/list` | `tenant_id`, `search_index`, `speaker_id` |
| 会議録テキスト | `GET /minute/text` | `tenant_id`, `council_id`, `schedule_id`, `playlist_id` |

JSONP 対応。`callback` パラメータなしで JSON として直接取得可能。

---

## 年度範囲

`/yearlist` API の返却値（2026年3月時点）:

| ラベル | value（西暦） |
| --- | --- |
| 令和7年 | 2025 |

現時点では令和7年（2025年）のデータのみ提供されている。今後追加される可能性がある。

---

## データ構造

### `/councilrd/all` レスポンス

`year` パラメータで年を指定すると、その年の全会議が返る。

```json
[
  {
    "council_id": "1",
    "year": "2025-06-13",
    "label": "令和7年6月鏡石町議会定例会（第8回）",
    "schedules": [
      {
        "schedule_id": "2",
        "label": "06月12日　一般質問（1日目）",
        "is_newest": false,
        "playlist": [
          {
            "playlist_id": "1",
            "speaker_img": "komiyama_yasuko.jpg",
            "speaker": "込山靖子議員",
            "speaker_id": "8",
            "content": "１．子宮頸がんワクチンの危険性について\n２．太陽光パネルの自然環境への影響について\n３．一人暮らしの高齢者に対するサービスについて",
            "movie_name1": "kagamiishi/2025/0612000201.mp4",
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
| `council_id` | 会議 ID（連番）。令和7年が `1` から始まる |
| `year` | 会議の開催日（ISO 形式、最終日の場合あり） |
| `label` | 会議名（例: `令和7年6月鏡石町議会定例会（第8回）`） |
| `schedule_id` | 日程 ID（会議内の連番） |
| `schedule.label` | 日程名（例: `06月12日　一般質問（1日目）`） |
| `playlist_id` | 発言単位の ID（日程内の連番） |
| `speaker` | 発言者名（例: `込山靖子議員`）。`null` の場合は発言者未特定 |
| `speaker_id` | 発言者 ID（`"0"` は発言者未特定） |
| `speaker_img` | 発言者の画像ファイル名 |
| `content` | 発言内容テキスト（改行区切りで議題・質問項目が記載） |
| `movie_name1` | 動画ファイルパス |
| `movie_released` | 動画公開状態（`"2"` = 公開済み） |
| `minute_text` | 会議録テキスト（現状すべて空配列 `[]`） |

---

## 会議種別

会議名ラベルから判別できる会議種別（実データより）:

- `定例会` - 例: `令和7年6月鏡石町議会定例会（第8回）`

現時点では定例会の一般質問のみが確認されている。臨時会・委員会のデータは今後追加される可能性がある。

---

## 確認済みの議員一覧（2025年時点）

| speaker_id | 氏名 | 画像ファイル名 |
| --- | --- | --- |
| 1 | 畑　幸一 | hata_kouichi.jpg |
| 2 | 中畑伸子 | nakahata_nobuko.jpg |
| 3 | 熊倉正麿 | kumakura_shouma.jpg |
| 4 | 東　悟 | azuma_satoru.jpg |
| 5 | 根本廣嗣 | nemoto_hirotsugu.jpg |
| 6 | 町島洋一 | machishima_youichi.jpg |
| 7 | 稲田和朝 | inada_kazutomo.jpg |
| 8 | 込山靖子 | komiyama_yasuko.jpg |
| 9 | 吉田孝司 | yoshida_kouji.jpg |
| 10 | 小林政次 | kobayashi_masatsugu.jpg |
| 11 | 円谷　寛 | tsumuraya_hiroshi.jpg |

---

## 会議録テキストの状況

- `minute_text` フィールドは現状すべて空配列 `[]`
- `/minute/text` API は `error_code: 2004` を返す
- **会議録テキスト（逐語録）は DiscussVision Smart システム上では提供されていない**
- `content` フィールドには質問項目・議題名のみが記載されており、詳細な発言録ではない
- speech.html には「会議録」タブの UI 要素が存在するが、データが未登録の状態

---

## スクレイピング戦略

### Step 1: 年一覧の取得

```
GET https://smart.discussvision.net/dvsapi/yearlist?tenant_id=685
```

取得した `value`（西暦）リストを以降のループで使用する。

### Step 2: 会議一覧の取得（年ごと）

```
GET https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=685&year={year}
```

各 `year` 値に対して実行し、全会議データ（`council_id`、`schedules`、`playlist` 含む）を取得する。ページネーションはなく、1 リクエストで該当年の全件が返る。

### Step 3: コンテンツのパース

API レスポンスの各 `playlist` エントリから以下を抽出する:

- **会議名**: `council.label`（例: `令和7年6月鏡石町議会定例会（第8回）`）
- **開催日**: `schedule.label` 先頭の日付部分（例: `06月12日`）と `council.year` の年部分を組み合わせる
- **日程名**: `schedule.label`（例: `06月12日　一般質問（1日目）`）
- **発言者**: `playlist.speaker`（`null` の場合は発言者なし）
- **発言内容**: `playlist.content`（改行区切りのテキスト）

### 開催日の抽出

`council.year` は `"2025-06-13"` 形式。日ごとの詳細は `schedule.label` から取得する。

```typescript
// スケジュールラベルから日付を抽出
const dateMatch = schedule.label.match(/^(\d{2})月(\d{2})日/);
// council.year の年部分と組み合わせて完全な日付を構成
const year = council.year.substring(0, 4);
const date = `${year}-${dateMatch[1]}-${dateMatch[2]}`;
```

### 発言者の取り扱い

`speaker` フィールドが `null` または `speaker_id` が `"0"` の場合、その `playlist` エントリは個人の発言として識別できない（開会宣告、議案審議、議長進行など）。

一般質問で発言者が特定されている場合、`speaker` フィールドに `"{氏名}議員"` 形式で設定されている。

```
// 発言者あり例
"speaker": "込山靖子議員"
"speaker": "吉田孝司議員"

// 発言者なし例
"speaker": null
"speaker_id": "0"
```

---

## 注意事項

- `minute_text` フィールドは現状すべて空配列 `[]` であり、逐語的な会議録テキストは提供されていない
- `content` は質問項目・議題名のみで、発言の逐語録ではない
- `/minute/text` API は `error_code: 2004` を返す（会議録データ未登録）
- 公式サイト（https://www.town.kagamiishi.fukushima.jp/gikai/）で PDF 形式の会議録が公開されている可能性がある。逐語録が必要な場合は公式サイト側を別途調査する
- 現時点では令和7年（2025年）のデータのみ。データ蓄積は新しく、今後年次が追加される見込み
- ライブ中継フィルタ機能あり（`COUNCIL_VIEW_SWITCH = 1` で有効化）

---

## 推奨アプローチ

1. **年ごとのバッチ取得**: `yearlist` API で年リストを取得し、各年の `councilrd/all` を呼び出して全データを収集する
2. **差分更新**: `council_id` は通し番号のため、前回取得済みの最大 `council_id` 以降のみ取得する差分更新が可能
3. **レート制限**: リクエスト間に 1〜2 秒の待機時間を設ける
4. **PDF 会議録の調査**: 逐語録が必要な場合、公式サイトの PDF 会議録を別途スクレイピング対象とすることを検討する
5. **`councilrd/search` の活用**: キーワード検索や期間・議員絞り込みが必要な場合は `/councilrd/search` エンドポイントを使用する
