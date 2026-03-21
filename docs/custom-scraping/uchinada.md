# 内灘町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.uchinada.lg.jp/site/gikai/list99-130.html
- 分類: 独自 CMS による PDF 公開（標準的な会議録検索システムは使用していない）
- 文字コード: UTF-8
- 特記: 本会議会議録は複数期間に分割して公開。委員会等会議録（要旨）も提供している。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 本会議会議録 インデックス | `https://www.town.uchinada.lg.jp/site/gikai/list99-130.html` |
| 本会議会議録 期間別一覧（令和6年～） | `https://www.town.uchinada.lg.jp/site/gikai/22389.html` |
| 本会議会議録 期間別一覧（令和3年～令和5年） | `https://www.town.uchinada.lg.jp/site/gikai/22385.html` |
| 本会議会議録 期間別一覧（平成30年～令和2年） | `https://www.town.uchinada.lg.jp/site/gikai/22382.html` |
| 本会議会議録 期間別一覧（平成27年～平成29年） | `https://www.town.uchinada.lg.jp/site/gikai/22381.html` |
| 本会議会議録 期間別一覧（平成24年～平成26年） | `https://www.town.uchinada.lg.jp/site/gikai/22380.html` |
| 各会議録ページ（PDF リンク） | `https://www.town.uchinada.lg.jp/soshiki/gikai/{ID}.html` |
| PDF ファイル | `https://www.town.uchinada.lg.jp/uploaded/attachment/{ID}.pdf` |
| 委員会等会議録 インデックス | `https://www.town.uchinada.lg.jp/soshiki/gikai/12083.html` |
| 委員会等会議録 委員会別一覧 | `https://www.town.uchinada.lg.jp/soshiki/gikai/{ID}.html` |

---

## ページ構成

### 本会議会議録

インデックスページ（`list99-130.html`）から期間別の一覧ページ（`site/gikai/*.html`）へリンクしており、各期間ページが個別会議録ページ（`soshiki/gikai/*.html`）へのリンクを持つ 3 階層構造。

```
インデックス（list99-130.html）
└── 期間別一覧（site/gikai/*.html）× 5 ページ
    └── 会議録ページ（soshiki/gikai/*.html）× 会議ごと
        └── PDF ファイル（uploaded/attachment/*.pdf）× 開催日ごと
```

各会議録ページには複数の PDF が掲載されており、1 会議（例: 令和6年12月会議）が複数の開催日（例: 12月3日・5日・12日）に分割されている。

#### 本会議会議録ページの例（`/soshiki/gikai/19094.html`）

- ページタイトル: `令和6年内灘町議会12月会議会議録`
- PDF リンクのリンクテキスト形式: `{内容}【{月日}】`
  - 例: `再開・提案理由の説明【12月3日】`
  - 例: `町政一般質問【12月5日】`
  - 例: `委員長報告・採決【12月12日】`
- PDF URL: `/uploaded/attachment/{数値ID}.pdf`
- ファイルサイズ: リンクテキスト内に `[PDFファイル／{サイズ}KB]` 形式で記載

### 委員会等会議録

インデックスページ（`soshiki/gikai/12083.html`）から委員会別ページ、さらに年度別ページ、そして PDF へという 4 階層構造。

```
委員会インデックス（soshiki/gikai/12083.html）
└── 委員会別ページ（soshiki/gikai/*.html）× 委員会ごと
    └── 年度別ページ（soshiki/gikai/*.html）× 年度ごと
        └── PDF ファイル（uploaded/attachment/*.pdf）× 開催日ごと
```

#### 委員会の種別（2026年3月時点）

| 委員会名 |
| --- |
| 全員協議会（要旨） |
| 議会運営委員会（要旨） |
| 総務産業建設常任委員会（要旨） |
| 文教福祉常任委員会（要旨） |
| 令和6年能登半島地震災害復興対策特別委員会（要旨） |

---

## スクレイピング戦略

### Step 1: 会議録ページ URL の収集（本会議）

1. 5 つの期間別一覧ページ（`site/gikai/*.html`）を取得する
2. 各一覧ページから会議録ページ（`soshiki/gikai/*.html`）へのリンク一覧を抽出する
   - リンクテキストの形式: `令和{年}年内灘町議会{月}月会議会議録`
   - 各ページはページネーションなし

### Step 2: 会議録ページ URL の収集（委員会）

1. 委員会インデックス（`soshiki/gikai/12083.html`）から委員会別ページの URL を取得する
2. 各委員会別ページから年度別ページの URL を取得する
3. 各年度別ページから PDF リンクを抽出する

### Step 3: PDF リンクの抽出

各会議録ページ（`soshiki/gikai/*.html`）から PDF リンクを抽出する。

- `href` が `/uploaded/attachment/*.pdf` の `<a>` タグを抽出
- リンクテキストから会議内容と開催日（`【{月日}】` 部分）を取得する
- ファイルサイズはリンクテキストに含まれる `[PDFファイル／{N}KB]` から取得可能

```typescript
// PDF リンクの抽出（Cheerio 使用）
$('a[href^="/uploaded/attachment/"]').each((_, el) => {
  const href = $(el).attr('href');
  const text = $(el).text(); // 例: "町政一般質問【12月5日】[PDFファイル／689KB]"
  const url = `https://www.town.uchinada.lg.jp${href}`;
  // 日付を抽出: 【月日】パターン
  const dateMatch = text.match(/【(\d+月\d+日)】/);
});
```

### Step 4: メタ情報の取得

各会議録ページの `<h1>` タグからページタイトルを取得する。

```
令和{年}年内灘町議会{月}月会議会議録
```

- 会議名: `内灘町議会{月}月会議`
- 開催年: `令和{年}年`（元号 → 西暦変換が必要）

---

## 注意事項

- PDF はテキスト抽出可能な形式であるが、会議録の本文（発言記録）が含まれる
- 委員会等会議録は「要旨」であり、本会議会議録とは形式・内容が異なる
- 期間別一覧ページの URL（`site/gikai/*.html`）は変更されない固定 URL と推定されるが、新しい期間ページが追加される可能性がある
- リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **固定 URL から開始**: インデックスページ 2 つ（本会議・委員会）を起点にクロールする
2. **全量取得**: ページネーションがないため、全 URL を一度に収集してからダウンロードする
3. **PDF の保存**: `uploaded/attachment/{ID}.pdf` の ID は数値連番のため、新規 ID の差分取得が可能
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
