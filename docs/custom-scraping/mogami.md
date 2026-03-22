# 最上町議会 カスタムスクレイピング方針

## 概要

- サイト: https://smart.discussvision.net/smart/tenant/mogami/WebView/rd/council_1.html
- 分類: DiscussVision Smart（動画中継プラットフォーム）の REST API 経由
- 文字コード: UTF-8
- 特記: 会議録テキスト（議事録）は公開されていない。発言内容のサマリー（`content` フィールド）と発言者情報のみ API から取得可能。全期間にわたって `minute_text` が空、`vtt_name` が null。

---

## システム構成

DiscussVision Smart は SPA 構成のオンライン議会中継プラットフォーム。
静的 HTML は骨格のみで、会議データはすべて JSONP 形式の REST API（`/dvsapi/`）から取得される。

| 項目 | 値 |
| --- | --- |
| テナント ID | `87` |
| API ベース URL | `https://smart.discussvision.net/dvsapi/` |
| 通信方式 | JSONP（`callback` パラメータでコールバック関数名を指定） |
| テナント設定ファイル | `https://smart.discussvision.net/smart/tenant/mogami/WebView/js/tenant.js` |

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| リダイレクト元 | `https://smart.discussvision.net/smart/tenant/mogami/WebView/rd/council.html` |
| 会議名一覧（映像） | `https://smart.discussvision.net/smart/tenant/mogami/WebView/rd/council_1.html` |
| 会議名一覧（会議録） | `https://smart.discussvision.net/smart/tenant/mogami/WebView/rd/council_2.html` |
| 日程・発言一覧 | `https://smart.discussvision.net/smart/tenant/mogami/WebView/rd/schedule.html?council_id={council_id}&schedule_id={schedule_id}` |
| 発言詳細（動画） | `https://smart.discussvision.net/smart/tenant/mogami/WebView/rd/speech.html?council_id={council_id}&schedule_id={schedule_id}&playlist_id={playlist_id}&speaker_id={speaker_id}` |

---

## API エンドポイント

### 年度一覧の取得

```
GET https://smart.discussvision.net/dvsapi/yearlist?tenant_id=87&callback={fn}
```

**レスポンス例（JSONP）:**

```json
[
  {"label": "令和8年", "value": 2026},
  {"label": "令和7年", "value": 2025},
  {"label": "令和6年", "value": 2024},
  {"label": "令和5年", "value": 2023},
  {"label": "令和4年", "value": 2022},
  {"label": "令和3年", "value": 2021},
  {"label": "令和2年", "value": 2020},
  {"label": "令和元年／平成31年", "value": 2019},
  {"label": "平成30年", "value": 2018}
]
```

利用可能な年度: 平成30年（2018）〜令和8年（2026）

---

### 会議一覧の取得

```
GET https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=87&year={year}&callback={fn}
```

**パラメータ:**

| パラメータ | 説明 |
| --- | --- |
| `tenant_id` | `87`（固定） |
| `year` | 西暦年（例: `2024`） |

**レスポンス構造:**

```json
[
  {
    "council_id": "88",
    "year": "2024-03-15",
    "label": "令和6年3月定例会",
    "schedules": [
      {
        "schedule_id": "1",
        "label": "03月07日　本会議",
        "is_newest": false,
        "playlist": [
          {
            "playlist_id": "1",
            "speaker_img": null,
            "speaker": "佐沢 浩議員",
            "speaker_id": "2",
            "content": "・一般質問に対する答弁の真意...",
            "movie_name1": "mogami/2024/0307010101.mp4",
            "movie_released": "2",
            "vtt_name": null,
            "information_link": ""
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
GET https://smart.discussvision.net/dvsapi/councilrd/search?tenant_id=87&keywords={keyword}&logical_op=AND&from={YYYY-MM-DD}&to={YYYY-MM-DD}&callback={fn}
```

**パラメータ:**

| パラメータ | 説明 |
| --- | --- |
| `tenant_id` | `87`（固定） |
| `keywords` | 検索キーワード（スペース区切りで複数指定可） |
| `logical_op` | `AND` または `OR` |
| `from` | 検索開始日（`YYYY-MM-DD` 形式） |
| `to` | 検索終了日（`YYYY-MM-DD` 形式） |

---

### 会議録テキストの取得

```
GET https://smart.discussvision.net/dvsapi/minute/text?tenant_id=87&council_id={id}&schedule_id={id}&playlist_id={id}&callback={fn}
```

**注意**: 最上町議会の全データにおいて `minute_text` および `vtt_name` フィールドはいずれも空（`[]` / `null`）であり、会議録テキストは API 経由では取得できない。

---

## データ範囲

| 年度 | councils 数 | schedules 数 | playlist 件数 |
| --- | --- | --- | --- |
| 2018（平成30年） | 9 | 27 | 65 |
| 2019（令和元年） | 10 | 32 | 78 |
| 2020（令和2年） | 11 | 44 | 89 |
| 2021（令和3年） | 10 | 33 | 66 |
| 2022（令和4年） | 7 | 27 | 79 |
| 2023（令和5年） | 9 | 27 | 55 |
| 2024（令和6年） | 6 | 15 | 30 |
| 2025（令和7年） | 6 | 20 | 40 |
| 2026（令和8年） | 3 | 9 | 9 |
| **合計** | **71** | **234** | **511** |

council_id の範囲: 30（最古）〜 101（最新）

---

## 会議種別（council の label パターン）

| 種別 | label 例 |
| --- | --- |
| 定例会 | `令和6年3月定例会`、`令和6年12月定例会` |
| 臨時会 | `令和6年1月臨時会` |
| ゆめ議会 | `令和6年最上中学校3年生による「ゆめ議会」` |

schedule の `label` には開催日と内容が含まれる（例: `03月07日　本会議`、`03月07日　予算特別委員会`）。

---

## 取得可能なデータフィールド

| フィールド | 説明 | 備考 |
| --- | --- | --- |
| `council_id` | 会議 ID | 全期間通しの連番（最古: 30、最新: 101） |
| `schedule_id` | 日程 ID | council 内での番号 |
| `playlist_id` | 発言順の連番 | schedule 内での 1 始まりの番号 |
| `speaker` | 発言者氏名 | 議員名が設定される（null の場合あり） |
| `speaker_id` | 発言者 ID | `0` は発言者なし（議事進行等） |
| `content` | 発言内容サマリー | 一般質問の質問テーマ等（`/` 区切り） |
| `movie_name1` | 動画ファイルパス | 例: `mogami/2024/0307010101.mp4` |
| `movie_released` | 公開状態 | `"2"` が公開済み |
| `vtt_name` | 字幕（WebVTT）ファイル名 | 全データ `null`（字幕なし） |
| `minute_text` | 会議録テキスト | 全データ `[]`（テキストなし） |

---

## スクレイピング戦略

### Step 1: 年度リストの取得

```typescript
const res = await fetch(
  "https://smart.discussvision.net/dvsapi/yearlist?tenant_id=87&callback=cb"
);
// JSONP をパースして年度リストを取得
// 例: [{label: "令和8年", value: 2026}, ...]
```

### Step 2: 年度ごとに全会議データを取得

```typescript
for (const year of YEAR_LIST) {
  const res = await fetch(
    `https://smart.discussvision.net/dvsapi/councilrd/all?tenant_id=87&year=${year}&callback=cb`
  );
  // JSONP をパース → councils[] を処理
}
```

各 council は `council_id`、`year`（開始日）、`label`（会議名）を持つ。

### Step 3: playlist アイテムからレコードを生成

```typescript
for (const council of councils) {
  for (const schedule of council.schedules) {
    for (const playlist of schedule.playlist) {
      const record = {
        council_id:    council.council_id,
        schedule_id:   schedule.schedule_id,
        playlist_id:   playlist.playlist_id,
        council_name:  council.label,
        schedule_name: schedule.label,
        date:          council.year,         // YYYY-MM-DD（開始日）
        speaker:       playlist.speaker,     // null の場合あり
        speaker_id:    playlist.speaker_id,
        content:       playlist.content,     // 発言内容サマリー
        movie_path:    playlist.movie_name1, // 動画ファイルパス
        is_released:   playlist.movie_released === "2",
      };
    }
  }
}
```

---

## JSONP パースの実装例

```typescript
async function fetchJsonp(url: string): Promise<unknown> {
  const callbackName = `cb_${Date.now()}`;
  const fullUrl = `${url}&callback=${callbackName}`;

  const res = await fetch(fullUrl);
  const text = await res.text();

  // "callbackName(JSON)" の形式から JSON 部分を抽出
  const match = text.match(/^[^(]+\(([\s\S]*)\)$/);
  if (!match) throw new Error(`Invalid JSONP response: ${text.slice(0, 100)}`);
  return JSON.parse(match[1]);
}
```

---

## 注意事項

- **会議録テキストは非公開**: 全データで `minute_text`・`vtt_name` が空。発言内容のサマリー（`content`）のみ取得可能であり、詳細な発言全文は存在しない。
- **JSONP 形式**: API は JSONP 形式のみ対応。`callback` パラメータが必須。
- **council.year はイベント開始日**: `year` フィールドは `YYYY-MM-DD` 形式だが、実際の開催日は各 schedule の `label` に含まれる。
- **ゆめ議会**: 最上中学校3年生による模擬議会（「ゆめ議会」）が毎年開催されており、通常の議会とは区別が必要。
- **レート制限**: 自治体サービスのため、リクエスト間に 1〜2 秒の待機時間を設ける。
- **差分更新**: `council_id` は通し番号のため、前回取得時の最大 `council_id` 以降のみを取得することで差分更新が可能。

---

## 推奨アプローチ

1. **API 直接叩き**: SPA だが REST API が公開されているため、Playwright 等のブラウザ自動化は不要。JSONP の `fetch` + テキストパースで対応可能。
2. **年度ループで全量取得**: `yearlist` API で年度一覧を取得し、各年度の `councilrd/all` を順次取得する。
3. **council_id で差分管理**: `council_id` の連番を利用して既取得データをスキップする。
4. **発言内容のみ保存**: テキスト全文は提供されないため、`content`（サマリー）、`speaker`（発言者）、`council.label`（会議名）、`schedule.label`（日程名）を組み合わせてレコードを構成する。
