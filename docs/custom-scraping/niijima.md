# 新島村議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/niijima/WebView/rd/council_1.html
- 分類: DiscussVision Smart（ぎょうせい提供）の REST API 経由
- 文字コード: UTF-8
- テナント ID: `188`
- 特記: 発言内容の検索、会議名一覧、発言一覧などの機能を提供。定例会の一般質問では発言者ごとの分割がされているが、会議録テキスト（`minute_text`）は全データ空配列で、字幕（VTT）も未提供。

---

## システム構成

DiscussVision Smart は SPA 構成のオンライン議会中継プラットフォーム。
静的 HTML は骨格のみで、会議データはすべて REST API（`/dvsapi/`）から取得される。

| 項目 | 値 |
| --- | --- |
| テナント ID | `188` |
| API ベース URL | `https://smart.discussvision.net/dvsapi/` |
| 通信方式 | JSON（`callback` パラメータを付与すると JSONP 形式） |
| 注意 | JSON レスポンスに制御文字が含まれる場合がある（`strict=False` でパースする必要あり） |

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議名一覧（リダイレクタ） | `https://smart.discussvision.net/smart/tenant/niijima/WebView/rd/council.html` |
| 会議名一覧（実体） | `https://smart.discussvision.net/smart/tenant/niijima/WebView/rd/council_1.html` |
| 日程・発言一覧 | `https://smart.discussvision.net/smart/tenant/niijima/WebView/rd/schedule.html?council_id={council_id}&schedule_id={schedule_id}` |
| 発言詳細（動画） | `https://smart.discussvision.net/smart/tenant/niijima/WebView/rd/speech.html?council_id={council_id}&schedule_id={schedule_id}&playlist_id={playlist_id}&speaker_id={speaker_id}` |
| 検索結果 | `https://smart.discussvision.net/smart/tenant/niijima/WebView/rd/result.html` |

HTML ページ自体にコンテンツは含まれない。データはすべて下記の API から取得する。

---

## API エンドポイント

### 年度一覧の取得

```
GET https://smart.discussvision.net/dvsapi/yearlist?tenant_id=188
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
  {"label": "令和元年/平成31年", "value": 2019},
  {"label": "平成30年", "value": 2018},
  {"label": "平成29年", "value": 2017},
  {"label": "平成28年", "value": 2016},
  {"label": "平成27年", "value": 2015},
  {"label": "平成26年", "value": 2014},
  {"label": "平成25年", "value": 2013},
  {"label": "平成24年", "value": 2012}
]
```

利用可能な年度: 平成24年（2012）〜令和8年（2026）

---

### 会議一覧の取得

```
GET https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=188&year={year}
```

**パラメータ:**

| パラメータ | 説明 |
| --- | --- |
| `tenant_id` | `188`（固定） |
| `year` | 西暦年（例: `2024`） |

**レスポンス構造:**

```json
[
  {
    "council_id": "92",
    "year": "2024-01-19",
    "label": "令和6年第1回臨時会",
    "schedules": [
      {
        "schedule_id": "1",
        "label": "01月19日　臨時会",
        "is_newest": false,
        "playlist": [
          {
            "playlist_id": "1",
            "speaker_img": null,
            "speaker": null,
            "speaker_id": "0",
            "content": "開会\n会議録署名議員の指名\n会期の決定\n議案の上程、説明、質疑、討論、採決\n閉会",
            "movie_name1": "niijima/2024/0119010101.mp4",
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

**注意**: 定例会の一般質問日の schedule では発言者ごとに playlist が分割される（`speaker` に議員名が入る）。それ以外の日程（開会・閉会、委員会等）では playlist が 1 件で `speaker` は `null`。

---

### キーワード検索

```
GET https://smart.discussvision.net/dvsapi/councilrd/search?tenant_id=188&keywords={keyword}&logical_op=AND&from={YYYY-MM-DD}&to={YYYY-MM-DD}
```

**パラメータ:**

| パラメータ | 説明 |
| --- | --- |
| `tenant_id` | `188`（固定） |
| `keywords` | 検索キーワード（スペース区切りで複数指定可） |
| `logical_op` | `AND` または `OR` |
| `from` | 検索開始日（`YYYY-MM-DD` 形式） |
| `to` | 検索終了日（`YYYY-MM-DD` 形式） |
| `council_id` | council ID での絞り込み（省略可） |
| `schedule_id` | schedule ID での絞り込み（省略可） |

---

### 会議録テキストの取得

```
GET https://smart.discussvision.net/dvsapi/minute/text?tenant_id=188&council_id={id}&schedule_id={id}&playlist_id={id}
```

**注意**: 新島村議会の全データにおいて `minute_text` フィールドはすべて空配列 `[]` であり、`vtt_name` も全データ `null`。`minute/text` エンドポイントはエラーコード 2004 を返す。会議録テキストは API 経由では取得できない。

---

### 発言者一覧

```
GET https://smart.discussvision.net/dvsapi/speaker/list?tenant_id=188&search_index=&speaker_id=
```

**注意**: 新島村議会では発言者一覧は空（`speaker_list: []`）。発言者情報は playlist の `speaker` フィールドから取得する。

---

## データ範囲

| 年度 | councils 数 | schedules 数 | playlist 件数 | うち発言者名あり |
| --- | --- | --- | --- | --- |
| 2012（平成24年） | 6 | 18 | 28 | 10 |
| 2013（平成25年） | 7 | 19 | 27 | 8 |
| 2014（平成26年） | 8 | 20 | 37 | 16 |
| 2015（平成27年） | 7 | 24 | 35 | 11 |
| 2016（平成28年） | 6 | 16 | 31 | 14 |
| 2017（平成29年） | 8 | 21 | 39 | 17 |
| 2018（平成30年） | 5 | 16 | 37 | 19 |
| 2019（令和元年/平成31年） | 10 | 20 | 39 | 18 |
| 2020（令和2年） | 9 | 22 | 49 | 25 |
| 2021（令和3年） | 9 | 18 | 42 | 23 |
| 2022（令和4年） | 7 | 16 | 40 | 22 |
| 2023（令和5年） | 8 | 15 | 43 | 25 |
| 2024（令和6年） | 7 | 15 | 43 | 26 |
| 2025（令和7年） | 5 | 15 | 45 | 28 |
| 2026（令和8年） | 2 | 5 | 5 | 0 |
| **合計** | **104** | **260** | **540** | **262** |

---

## 会議種別（council の label パターン）

| 種別 | label 例 |
| --- | --- |
| 定例会 | `令和6年第1回定例会` |
| 臨時会 | `令和6年第1回臨時会` |

---

## 日程種別（schedule の label パターン）

| 種別 | 説明 |
| --- | --- |
| 本会議 | 定例会の本会議（一般質問含む） |
| 臨時会 | 臨時会の本会議 |
| 予算特別委員会 | 予算審査 |
| 決算特別委員会 | 決算審査 |
| 総務常任委員会 | 常任委員会 |
| 経済常任委員会 | 常任委員会 |
| 議会運営委員会 | 議会運営 |
| 議会広報編集委員会 | 広報編集 |
| 港湾空港等整備促進特別委員会 | 特別委員会（過去に存在） |

---

## 取得可能なデータフィールド

| フィールド | 説明 | 備考 |
| --- | --- | --- |
| `council_id` | 会議 ID | 通し番号 |
| `schedule_id` | 日程 ID | council 内での番号 |
| `playlist_id` | 発言順の連番 | 一般質問日は発言者ごとに分割 |
| `speaker` | 発言者氏名 | 一般質問日のみ（例: `前田壽夫議員`）。それ以外は `null` |
| `speaker_id` | 発言者 ID | 発言者なしの場合は `"0"` |
| `content` | 発言内容サマリー | 議題・質問項目の概要（改行区切り） |
| `movie_name1` | 動画ファイルパス | 例: `niijima/2024/0119010101.mp4` |
| `movie_released` | 公開状態 | `"2"` が公開済み |
| `vtt_name` | 字幕（WebVTT）ファイル名 | 全データ `null`（字幕なし） |

---

## スクレイピング戦略

### Step 1: 年度リストの取得

```typescript
const res = await fetch(
  "https://smart.discussvision.net/dvsapi/yearlist?tenant_id=188"
);
const years = await res.json();
// [{label: "令和8年", value: 2026}, ...]
```

### Step 2: 年度ごとに全会議データを取得

```typescript
for (const year of years) {
  const res = await fetch(
    `https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=188&year=${year.value}`
  );
  const text = await res.text();
  // JSON に制御文字が含まれる可能性があるため、パース前にサニタイズする
  const councils = JSON.parse(text.replace(/[\x00-\x1f\x7f]/g, (c) => (c === "\n" ? "\n" : "")));
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
        speaker: playlist.speaker, // 一般質問日のみ氏名あり
        speaker_id: playlist.speaker_id,
        content: playlist.content, // 議題・質問項目の概要
        movie_path: playlist.movie_name1,
        is_released: playlist.movie_released === "2",
      };
    }
  }
}
```

### 開催日の抽出

`council.year` は `"2024-01-19"` 形式（会議の開始日）。日ごとの詳細は `schedule.label` から取得する。

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
- **発言者情報は一般質問日のみ**: 定例会の一般質問日では発言者ごとに playlist が分割され `speaker` に議員名（例: `前田壽夫議員`）が入る。それ以外の日程では `speaker` は `null`。
- **content に議題概要が含まれる**: 戸沢村等とは異なり、`content` に議題や質問項目の概要テキストが含まれる（改行区切り）。
- **JSON レスポンスに制御文字**: API レスポンスの JSON に制御文字（`\n` 以外）が含まれる場合があり、strict モードでのパースに失敗する。サニタイズが必要。
- **`callback` パラメータは任意**: `callback` を省略すると JSON 形式で直接返るため、JSONP パースは不要。
- **`council.year` はイベント開始日**: `year` フィールドは `YYYY-MM-DD` 形式で、各 schedule の `label` に開催日と議事内容が含まれる。
- **レート制限**: 自治体サービスのため、リクエスト間に 1〜2 秒の待機時間を設ける。
- **差分更新**: `council_id` は通し番号のため、前回取得時の最大 `council_id` 以降のみを取得することで差分更新が可能。

---

## 推奨アプローチ

1. **API 直接叩き**: SPA だが REST API が公開されているため、Playwright 等のブラウザ自動化は不要。`fetch` で JSON を直接取得可能。
2. **年度ループで全量取得**: `yearlist` API で年度一覧を取得し、各年度の `councilrd/all` を順次取得する。
3. **`council_id` で差分管理**: `council_id` の連番を利用して既取得データをスキップする。
4. **メタデータ + 議題概要を保存**: 会議録全文は非公開だが、会議名、日程名、開催日、発言者名、議題概要（`content`）、動画ファイルパスを保存する。
5. **発言者名の正規化**: `speaker` フィールドの値は `{氏名}議員` 形式。`議員` サフィックスを除去して氏名のみを抽出する。
