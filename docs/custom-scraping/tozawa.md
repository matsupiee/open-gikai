# 戸沢村議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/tozawa/WebView/rd/council.html
- 分類: DiscussVision Smart（ぎょうせい提供）の REST API 経由
- 文字コード: UTF-8
- テナント ID: `486`
- 特記: 会議録テキスト（議事録全文）は公開されていない。発言者ごとの分割もなく、各 schedule に対して `content` が `"本会議"` のみの playlist が 1 件ずつ存在するだけで、発言内容のサマリーも提供されていない。

---

## システム構成

DiscussVision Smart は SPA 構成のオンライン議会中継プラットフォーム。
静的 HTML は骨格のみで、会議データはすべて REST API（`/dvsapi/`）から取得される。

| 項目 | 値 |
| --- | --- |
| テナント ID | `486` |
| API ベース URL | `https://smart.discussvision.net/dvsapi/` |
| 通信方式 | JSON（`callback` パラメータを付与すると JSONP 形式） |

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議名一覧（リダイレクタ） | `https://smart.discussvision.net/smart/tenant/tozawa/WebView/rd/council.html` |
| 会議名一覧（実体） | `https://smart.discussvision.net/smart/tenant/tozawa/WebView/rd/council_1.html` |
| 日程・発言一覧 | `https://smart.discussvision.net/smart/tenant/tozawa/WebView/rd/schedule.html?council_id={council_id}&schedule_id={schedule_id}` |
| 発言詳細（動画） | `https://smart.discussvision.net/smart/tenant/tozawa/WebView/rd/speech.html?council_id={council_id}&schedule_id={schedule_id}&playlist_id={playlist_id}&speaker_id={speaker_id}` |
| 検索結果 | `https://smart.discussvision.net/smart/tenant/tozawa/WebView/rd/result.html` |

HTML ページ自体にコンテンツは含まれない。データはすべて下記の API から取得する。

---

## API エンドポイント

### 年度一覧の取得

```
GET https://smart.discussvision.net/dvsapi/yearlist?tenant_id=486
```

**レスポンス例:**

```json
[
  {"label": "令和8年", "value": 2026},
  {"label": "令和7年", "value": 2025},
  {"label": "令和6年", "value": 2024},
  {"label": "令和5年", "value": 2023},
  {"label": "令和4年", "value": 2022},
  {"label": "令和3年", "value": 2021},
  {"label": "令和2年", "value": 2020},
  {"label": "令和元年/平成31年", "value": 2019}
]
```

利用可能な年度: 令和元年/平成31年（2019）〜令和8年（2026）

---

### 会議一覧の取得

```
GET https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=486&year={year}
```

**パラメータ:**

| パラメータ | 説明 |
| --- | --- |
| `tenant_id` | `486`（固定） |
| `year` | 西暦年（例: `2024`） |

**レスポンス構造:**

```json
[
  {
    "council_id": "48",
    "year": "2024-01-23",
    "label": "令和6年第1回臨時会",
    "schedules": [
      {
        "schedule_id": "1",
        "label": "01月23日　本会議",
        "is_newest": false,
        "playlist": [
          {
            "playlist_id": "1",
            "speaker_img": null,
            "speaker": null,
            "speaker_id": "0",
            "content": "本会議",
            "movie_name1": "tozawa/2024/0123010101.mp4",
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

**階層構造:**

```
council（会議）
  └─ schedule（日程・開催日）
       └─ playlist（発言者単位のコンテンツ）
```

**注意**: 戸沢村議会では各 schedule に対して playlist が常に 1 件のみで、`speaker` は `null`、`content` は `"本会議"` のみ。発言者ごとの分割は行われていない。

---

### キーワード検索

```
GET https://smart.discussvision.net/dvsapi/councilrd/search?tenant_id=486&keywords={keyword}&logical_op=AND&from={YYYY-MM-DD}&to={YYYY-MM-DD}
```

**パラメータ:**

| パラメータ | 説明 |
| --- | --- |
| `tenant_id` | `486`（固定） |
| `keywords` | 検索キーワード（スペース区切りで複数指定可） |
| `logical_op` | `AND` または `OR` |
| `from` | 検索開始日（`YYYY-MM-DD` 形式） |
| `to` | 検索終了日（`YYYY-MM-DD` 形式） |
| `council_id` | council ID での絞り込み（省略可） |
| `schedule_id` | schedule ID での絞り込み（省略可） |

---

### 会議録テキストの取得

```
GET https://smart.discussvision.net/dvsapi/minute/text?tenant_id=486&council_id={id}&schedule_id={id}&playlist_id={id}
```

**注意**: 戸沢村議会の全データにおいて `minute_text` フィールドはすべて空配列 `[]` であり、`vtt_name` も全データ `null`。会議録テキストは API 経由では取得できない。`minute/text` エンドポイントもエラーコード 2004 を返す。

---

### 発言者一覧

```
GET https://smart.discussvision.net/dvsapi/speaker/list?tenant_id=486&search_index=&speaker_id=
```

**注意**: 戸沢村議会では発言者一覧は空（`speaker_list: []`）。発言者情報が登録されていない。

---

## データ範囲

| 年度 | councils 数 | schedules 数 | playlist 件数 |
| --- | --- | --- | --- |
| 2019（令和元年/平成31年） | 9 | 13 | 13 |
| 2020（令和2年） | 10 | 14 | 14 |
| 2021（令和3年） | 9 | 13 | 13 |
| 2022（令和4年） | 10 | 14 | 14 |
| 2023（令和5年） | 9 | 13 | 13 |
| 2024（令和6年） | 10 | 15 | 15 |
| 2025（令和7年） | 8 | 13 | 13 |
| 2026（令和8年） | 2 | 3 | 3 |
| **合計** | **67** | **98** | **98** |

---

## 会議種別（council の label パターン）

| 種別 | label 例 |
| --- | --- |
| 定例会（本会議） | `令和6年第1回定例会` |
| 臨時会（本会議） | `令和6年第1回臨時会` |

schedule の `label` には開催日と内容が含まれる（例: `03月07日　本会議`、`12月04日　本会議`）。

---

## 取得可能なデータフィールド

| フィールド | 説明 | 備考 |
| --- | --- | --- |
| `council_id` | 会議 ID | 通し番号（最古: 不明、2019年時点で存在するIDから開始） |
| `schedule_id` | 日程 ID | council 内での番号 |
| `playlist_id` | 発言順の連番 | 常に `"1"` のみ（発言者分割なし） |
| `speaker` | 発言者氏名 | 全データ `null`（発言者情報未登録） |
| `speaker_id` | 発言者 ID | 全データ `"0"`（発言者なし） |
| `content` | 発言内容サマリー | 全データ `"本会議"` のみ（詳細な内容なし） |
| `movie_name1` | 動画ファイルパス | 例: `tozawa/2024/0123010101.mp4` |
| `movie_released` | 公開状態 | `"2"` が公開済み |
| `vtt_name` | 字幕（WebVTT）ファイル名 | 全データ `null`（字幕なし） |

---

## スクレイピング戦略

### Step 1: 年度リストの取得

```typescript
const res = await fetch(
  "https://smart.discussvision.net/dvsapi/yearlist?tenant_id=486"
);
const years = await res.json();
// [{label: "令和8年", value: 2026}, ...]
```

### Step 2: 年度ごとに全会議データを取得

```typescript
for (const year of years) {
  const res = await fetch(
    `https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=486&year=${year.value}`
  );
  const councils = await res.json();
  // councils[] を処理
}
```

各 council は `council_id`、`year`（開始日）、`label`（会議名）を持つ。ページネーションはなく、1 リクエストで該当年の全件が返る。

### Step 3: playlist アイテムからレコードを生成

```typescript
for (const council of councils) {
  for (const schedule of council.schedules) {
    for (const playlist of schedule.playlist) {
      const record = {
        council_id: council.council_id,
        schedule_id: schedule.schedule_id,
        playlist_id: playlist.playlist_id,
        council_name: council.label,
        schedule_name: schedule.label,
        date: council.year, // YYYY-MM-DD（開始日）
        speaker: playlist.speaker, // 全データ null
        speaker_id: playlist.speaker_id,
        content: playlist.content, // 全データ "本会議"
        movie_path: playlist.movie_name1,
        is_released: playlist.movie_released === "2",
      };
    }
  }
}
```

### 開催日の抽出

`council.year` は `"2024-01-23"` 形式（会議の開始日）。日ごとの詳細は `schedule.label` から取得する。

```typescript
// スケジュールラベルから日付を抽出
const dateMatch = schedule.label.match(/^(\d{2})月(\d{2})日/);
// council.year の年部分と組み合わせて完全な日付を構成
const year = council.year.substring(0, 4);
const date = `${year}-${dateMatch[1]}-${dateMatch[2]}`;
```

---

## 注意事項

- **会議録テキストは非公開**: 全データで `minute_text` が空配列、`vtt_name` が `null`。`minute/text` API もエラーコード 2004 を返す。
- **発言者情報なし**: 全 playlist で `speaker` が `null`、`speaker_id` が `"0"`。発言者ごとの分割が行われておらず、個別の発言者を識別できない。
- **content が固定値**: 全 playlist の `content` が `"本会議"` のみで、議事内容のサマリーも提供されていない。
- **映像のみの配信**: 実質的に議会映像のメタデータ（会議名、開催日、動画ファイルパス）のみが API 経由で取得可能。
- **`callback` パラメータは任意**: `callback` を省略すると JSON 形式で直接返るため、JSONP パースは不要。
- **`council.year` はイベント開始日**: `year` フィールドは `YYYY-MM-DD` 形式で、各 schedule の `label` に開催日と議事内容が含まれる。
- **レート制限**: 自治体サービスのため、リクエスト間に 1〜2 秒の待機時間を設ける。
- **差分更新**: `council_id` は通し番号のため、前回取得時の最大 `council_id` 以降のみを取得することで差分更新が可能。

---

## 推奨アプローチ

1. **API 直接叩き**: SPA だが REST API が公開されているため、Playwright 等のブラウザ自動化は不要。`fetch` で JSON を直接取得可能。
2. **年度ループで全量取得**: `yearlist` API で年度一覧を取得し、各年度の `councilrd/all` を順次取得する。
3. **`council_id` で差分管理**: `council_id` の連番を利用して既取得データをスキップする。
4. **メタデータのみ保存**: テキスト全文も発言者情報もサマリーも提供されないため、会議名（`council.label`）、日程名（`schedule.label`）、開催日、動画ファイルパスのみを保存する。
