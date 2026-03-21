# 安芸太田町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.akiota.jp/site/gikai/list26-80.html
- 分類: 町公式サイト内での直接公開（会議録検索システム未導入）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式で提供。年度別の一覧ページから各回の定例会・臨時会の PDF にアクセスする構造。令和2年（2020年）以降の会議録が公開されている。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（年度別リンク） | `https://www.akiota.jp/site/gikai/list26-80.html` |
| 年度別会議録ページ | `https://www.akiota.jp/site/gikai/{ページID}.html` |
| 会議録 PDF | `https://www.akiota.jp/uploaded/life/{ページID}_{ファイルID}_misc.pdf` |

### 年度別ページ URL 一覧

| 年度 | URL |
| --- | --- |
| 令和8年（2026年） | `https://www.akiota.jp/site/gikai/17653.html` |
| 令和7年（2025年） | `https://www.akiota.jp/site/gikai/14987.html` |
| 令和6年（2024年） | `https://www.akiota.jp/site/gikai/12064.html` |
| 令和5年（2023年） | `https://www.akiota.jp/site/gikai/8069.html` |
| 令和4年（2022年） | `https://www.akiota.jp/site/gikai/8068.html` |
| 令和3年（2021年） | `https://www.akiota.jp/site/gikai/1374.html` |
| 令和2年（2020年） | `https://www.akiota.jp/site/gikai/1372.html` |

---

## ページ構造

### 一覧ページ（list26-80.html）

- 年度ごとのリンクが `<li>` 要素で表示される
- 各 `<li>` に更新日（`<span class="article_date">`）とタイトルリンク（`<span class="article_title">`）が含まれる
- ページネーションなし（全年度が1ページに表示）

### 年度別ページ（例: 14987.html）

- `<h2>` タグで会議回次・種別ごとにセクション分けされている（例: `<h2>第1回定例会</h2>`、`<h2>第2回臨時会</h2>`）
- 各セクション内に `<div class="file_pdf">` があり、その中に PDF リンクが列挙される
- PDF リンクのテキスト形式: `令和X年第Y回安芸太田町議会{定例会|臨時会}会議録（M月D日）  [PDFファイル／{サイズ}KB]`
- 定例会は年4回（3月・6月・9月・12月）、臨時会は不定期

### PDF リンクの HTML 構造

```html
<h2>第1回定例会</h2>
<div class="file_pdf">
  <a href="/uploaded/life/17650_39314_misc.pdf">令和7年第1回安芸太田町議会定例会会議録（2月21日）  [PDFファイル／401KB]</a>
  <a href="/uploaded/life/17650_39315_misc.pdf">令和7年第1回安芸太田町議会定例会会議録（2月25日）  [PDFファイル／599KB]</a>
  ...
</div>
<h2>第2回臨時会</h2>
<div class="file_pdf">
  <a href="/uploaded/life/17650_39320_misc.pdf">令和7年第2回安芸太田町議会臨時会会議録（4月14日）  [PDFファイル／371KB]</a>
</div>
```

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

1. 一覧ページ `list26-80.html` を取得
2. `<span class="article_title">` 内の `<a>` タグから年度別ページの URL を抽出
3. 新しい年度ページが追加される可能性があるため、毎回一覧ページをチェックする

```typescript
// 年度ページ URL の抽出パターン
const yearPageLinks = $('span.article_title a');
// href 例: /site/gikai/14987.html
```

### Step 2: PDF リンクの収集

各年度別ページにアクセスし、PDF ファイルへのリンクを抽出する。

1. `<div class="file_pdf">` 内の `<a href="...pdf">` を全件取得
2. 直前の `<h2>` タグから会議種別（定例会 / 臨時会）と回次を取得

```typescript
// PDF リンクの抽出パターン
const pdfLinks = $('div.file_pdf a[href$=".pdf"]');
```

### Step 3: メタ情報の抽出

PDF リンクのテキストから以下を正規表現で抽出する。

```typescript
// リンクテキストからのメタ情報抽出
const metaPattern = /^(令和|平成)(\d+)年第(\d+)回安芸太田町議会(定例会|臨時会)会議録（(\d+)月(\d+)日）/;
// グループ: [1]元号, [2]年, [3]回次, [4]会議種別, [5]月, [6]日
```

抽出可能な情報:

- 元号・年: `令和X年` / `平成XX年`
- 回次: `第Y回`
- 会議種別: `定例会` / `臨時会`
- 開催日: `M月D日`

### Step 4: PDF のダウンロードとテキスト抽出

- 各 PDF をダウンロードし、PDF パーサー（pdf-parse 等）でテキストを抽出する
- PDF 内の発言者・発言内容の構造解析が必要

---

## 注意事項

- 会議録検索システムは未導入のため、全文検索機能はサイト側に存在しない。全件を PDF からテキスト抽出する必要がある
- PDF の URL パターン `/uploaded/life/{ページID}_{ファイルID}_misc.pdf` のページ ID とファイル ID は連番だが、欠番がある可能性がある。必ず HTML ページからリンクを収集すること
- 年度ページの URL（`/site/gikai/{ID}.html`）の ID は連番ではなく、新年度追加時に予測不能
- 1つの定例会が複数日にわたる場合、日付ごとに個別の PDF として分割されている
- リクエスト間には適切な待機時間（1〜2秒）を設けること

---

## 推奨アプローチ

1. **一覧ページから年度ページを全件取得**: `list26-80.html` のリンクを起点に、全年度ページ URL を収集する
2. **年度ページから PDF リンクを一括取得**: 各年度ページの `div.file_pdf` 内のリンクを全件抽出する
3. **リンクテキストからメタ情報を抽出**: 正規表現でリンクテキストから会議名・日付を取得し、PDF ダウンロード前にメタ情報を確定させる
4. **PDF テキスト抽出**: ダウンロードした PDF から本文テキストを抽出し、発言者・発言内容を解析する
5. **差分更新**: 年度ページの更新日（`<span class="article_date">`）と既取得済みの PDF URL を比較して差分のみ取得する
