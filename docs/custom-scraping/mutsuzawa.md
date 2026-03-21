# 睦沢町議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/mutsuzawa/WebView/rd/council_1.html
- 分類: DiscussVision Smart（ぎょうせい提供）の REST API 経由
- 文字コード: UTF-8
- テナント ID: `590`
- 特記: 会議録テキスト（議事録全文）は公開されていない。発言内容のサマリー（`content` フィールド）と発言者情報のみ API から取得可能。

---

## システム構成

DiscussVision Smart は SPA 構成のオンライン議会中継プラットフォーム。
静的 HTML は骨格のみで、会議データはすべて REST API（`/dvsapi/`）から取得される。

| 項目 | 値 |
| --- | --- |
| テナント ID | `590` |
| API ベース URL | `https://smart.discussvision.net/dvsapi/` |
| 通信方式 | JSON（`callback` パラメータを付与すると JSONP 形式） |

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議名一覧 | `https://smart.discussvision.net/smart/tenant/mutsuzawa/WebView/rd/council_1.html` |
| 日程・発言一覧 | `https://smart.discussvision.net/smart/tenant/mutsuzawa/WebView/rd/schedule.html?council_id={council_id}&schedule_id={schedule_id}` |
| 発言詳細（動画） | `https://smart.discussvision.net/smart/tenant/mutsuzawa/WebView/rd/speech.html?council_id={council_id}&schedule_id={schedule_id}&playlist_id={playlist_id}&speaker_id={speaker_id}` |
| 検索結果 | `https://smart.discussvision.net/smart/tenant/mutsuzawa/WebView/rd/result.html` |

HTML ページ自体にコンテンツは含まれない。データはすべて下記の API から取得する。

---

## API エンドポイント

### 年度一覧の取得

```
GET https://smart.discussvision.net/dvsapi/yearlist?tenant_id=590
```

**レスポンス例:**

```json
[
  {"label": "令和8年", "value": 2026},
  {"label": "令和7年", "value": 2025},
  {"label": "令和6年", "value": 2024},
  {"label": "令和5年", "value": 2023},
  {"label": "令和4年", "value": 2022},
  {"label": "令和3年", "value": 2021}
]
```

利用可能な年度: 令和3年（2021）〜令和8年（2026）

---

### 会議一覧の取得

```
GET https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=590&year={year}
```

**パラメータ:**

| パラメータ | 説明 |
| --- | --- |
| `tenant_id` | `590`（固定） |
| `year` | 西暦年（例: `2024`） |

**レスポンス構造:**

```json
[
  {
    "council_id": "14",
    "year": "2024-01-22",
    "label": "令和6年第1回臨時会",
    "schedules": [
      {
        "schedule_id": "1",
        "label": "01月22日　本会議",
        "is_newest": false,
        "playlist": [
          {
            "playlist_id": "1",
            "speaker_img": null,
            "speaker": null,
            "speaker_id": "0",
            "content": "臨時議長の紹介\n開会宣告\n開議宣告\n...",
            "movie_name1": "mutsuzawa/2024/0122010101.mp4",
            "movie_released": "2",
            "vtt_name": null
          },
          {
            "playlist_id": "2",
            "speaker": "丸山克雄議員",
            "speaker_id": "7",
            "content": "日程第３　一般質問\n1.教育行政全般について\n2.奨学金事業について",
            "movie_name1": "mutsuzawa/2021/0909000102.mp4",
            "movie_released": "2"
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

---

### キーワード検索

```
GET https://smart.discussvision.net/dvsapi/councilrd/search?tenant_id=590&keywords={keyword}&logical_op=AND&from={YYYY-MM-DD}&to={YYYY-MM-DD}
```

**パラメータ:**

| パラメータ | 説明 |
| --- | --- |
| `tenant_id` | `590`（固定） |
| `keywords` | 検索キーワード（スペース区切りで複数指定可） |
| `logical_op` | `AND` または `OR` |
| `from` | 検索開始日（`YYYY-MM-DD` 形式） |
| `to` | 検索終了日（`YYYY-MM-DD` 形式） |
| `council_id` | council ID での絞り込み（省略可） |
| `schedule_id` | schedule ID での絞り込み（省略可） |

---

### 会議録テキストの取得

```
GET https://smart.discussvision.net/dvsapi/minute/text?tenant_id=590&council_id={id}&schedule_id={id}&playlist_id={id}
```

**注意**: 睦沢町議会の全データにおいて `minute_text` フィールドはすべて空配列 `[]` であり、`vtt_name` も全データ `null`。会議録テキストは API 経由では取得できない。`minute/text` エンドポイントもエラーコード 2004 を返す。

---

## データ範囲

| 年度 | councils 数 | schedules 数 | playlist 件数 |
| --- | --- | --- | --- |
| 2021（令和3年） | 3 | 4 | 24 |
| 2022（令和4年） | 6 | 10 | 49 |
| 2023（令和5年） | 4 | 9 | 33 |
| 2024（令和6年） | 7 | 11 | 61 |
| 2025（令和7年） | 6 | 10 | 49 |
| 2026（令和8年） | 1 | 3 | 3 |
| **合計** | **27** | **47** | **219** |

---

## 会議種別（council の label パターン）

| 種別 | label 例 |
| --- | --- |
| 定例会（本会議） | `令和6年第1回定例会` |
| 臨時会（本会議） | `令和6年第1回臨時会` |

schedule の `label` には開催日と内容が含まれる（例: `09月09日　本会議`、`03月05日　本会議`）。

---

## 取得可能なデータフィールド

| フィールド | 説明 | 備考 |
| --- | --- | --- |
| `council_id` | 会議 ID | 通し番号（最古: 1、最新: 27 以降） |
| `schedule_id` | 日程 ID | council 内での番号 |
| `playlist_id` | 発言順の連番 | schedule 内での 1 始まりの番号 |
| `speaker` | 発言者氏名 | 一般質問の発言者に設定（`null` の場合もあり） |
| `speaker_id` | 発言者 ID | `"0"` は発言者なし（議事進行等） |
| `content` | 発言内容サマリー | 議題名・質問テーマ等（改行 `\n` 区切り） |
| `movie_name1` | 動画ファイルパス | 例: `mutsuzawa/2024/0122010101.mp4` |
| `movie_released` | 公開状態 | `"2"` が公開済み |
| `vtt_name` | 字幕（WebVTT）ファイル名 | 全データ `null`（字幕なし） |

---

## 発言者一覧（実データより）

| 議員名 | 備考 |
| --- | --- |
| 丸山克雄議員 | 2021〜2023 |
| 島貫　孝議員 | 2021〜2025 |
| 田邉明佳議員 | 2021、2024〜2025 |
| 米倉英希議員 | 2021〜2025 |
| 酒井康雄議員 | 2021〜2024 |
| 麻生安夫議員 | 2021 |
| 久我政史議員 | 2022 |
| 久我眞澄議員 | 2022、2024〜2025 |
| 小川清隆議員 | 2022、2024 |
| 三橋優一議員 | 2024〜2025 |
| 伊原邦雄議員 | 2024 |
| 松島和子議員 | 2024〜2025 |
| 田中リエ議員 | 2024〜2025 |

---

## スクレイピング戦略

### Step 1: 年度リストの取得

```typescript
const res = await fetch(
  "https://smart.discussvision.net/dvsapi/yearlist?tenant_id=590"
);
const years = await res.json();
// [{label: "令和8年", value: 2026}, ...]
```

### Step 2: 年度ごとに全会議データを取得

```typescript
for (const year of years) {
  const res = await fetch(
    `https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=590&year=${year.value}`
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
        speaker: playlist.speaker, // null の場合あり
        speaker_id: playlist.speaker_id,
        content: playlist.content, // 発言内容サマリー
        movie_path: playlist.movie_name1,
        is_released: playlist.movie_released === "2",
      };
    }
  }
}
```

### 開催日の抽出

`council.year` は `"2024-01-22"` 形式（会議の開始日）。日ごとの詳細は `schedule.label` から取得する。

```typescript
// スケジュールラベルから日付を抽出
const dateMatch = schedule.label.match(/^(\d{2})月(\d{2})日/);
// council.year の年部分と組み合わせて完全な日付を構成
const year = council.year.substring(0, 4);
const date = `${year}-${dateMatch[1]}-${dateMatch[2]}`;
```

---

## 注意事項

- **会議録テキストは非公開**: 全データで `minute_text` が空配列、`vtt_name` が `null`。発言内容のサマリー（`content`）のみ取得可能であり、詳細な発言全文は存在しない。
- **`callback` パラメータは任意**: `callback` を省略すると JSON 形式で直接返るため、JSONP パースは不要。
- **`council.year` はイベント開始日**: `year` フィールドは `YYYY-MM-DD` 形式で、各 schedule の `label` に開催日と議事内容が含まれる。
- **発言者の形式**: `speaker` フィールドは `"{氏名}議員"` 形式。`null` または `speaker_id === "0"` の場合は個人の発言として識別できない（開会宣告、議案審議等）。
- **動画公開状態の確認**: `movie_released === "2"` が公開済みの目安。
- **レート制限**: 自治体サービスのため、リクエスト間に 1〜2 秒の待機時間を設ける。
- **差分更新**: `council_id` は通し番号のため、前回取得時の最大 `council_id` 以降のみを取得することで差分更新が可能。

---

## 推奨アプローチ

1. **API 直接叩き**: SPA だが REST API が公開されているため、Playwright 等のブラウザ自動化は不要。`fetch` で JSON を直接取得可能。
2. **年度ループで全量取得**: `yearlist` API で年度一覧を取得し、各年度の `councilrd/all` を順次取得する。
3. **`council_id` で差分管理**: `council_id` の連番を利用して既取得データをスキップする。
4. **発言内容のみ保存**: テキスト全文は提供されないため、`content`（サマリー）、`speaker`（発言者）、`council.label`（会議名）、`schedule.label`（日程名）を組み合わせてレコードを構成する。
