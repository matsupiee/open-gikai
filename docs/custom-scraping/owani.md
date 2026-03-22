# 大鰐町議会 カスタムスクレイピング方針

## 概要

- サイト: http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/
- 分類: 町公式サイト内の静的 HTML ページに PDF ファイルを直接掲載
- 文字コード: UTF-8
- 特記: 年度別のHTMLページに定例会・臨時会ごとのPDFリンクを掲載。会議録（一般質問）はPDF形式で公開。会議録検索システムは未導入。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 定例会・臨時会一覧（トップ） | `http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/` |
| 令和8年 定例会・臨時会 | `http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/R8teireikairinjikai.html` |
| 令和7年 定例会・臨時会 | `http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/R7teireikairinjikai.html` |
| 令和6年 定例会・臨時会 | `http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/R6teireikairinjikai.html` |
| 令和5年 定例会・臨時会 | `http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/R5teireikairinjikai.html` |
| PDF ファイル | `http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/files/{filename}.pdf` |

年度別ページの URL パターン: `R{和暦年}teireikairinjikai.html`

---

## HTML 構造

### 一覧ページ（定例会・臨時会トップ）

```
div#cont_wrap > div.inner > div.cont
  h1: "定例会・臨時会"
  div.detail > div.cat_news
    h2: "更新情報"
    ul
      li[datetime="YYYY-MM-DD"]
        span.date: "YYYY年MM月DD日"
        a.tit[href="R{N}teireikairinjikai.html"]: "令和{N}年　定例会・臨時会"
```

### 年度別ページ

各年度ページ内で `<h2>` が会議の区切りとなり、その直後の `<ol>` にPDFリンクが並ぶ。

```
div#cont_wrap > div.inner > div.cont
  h1: "令和{N}年　定例会・臨時会"
  div.detail
    h2: "令和{N}年第{回}回定例会（令和{N}年{月}月）"
    ol
      li > a[href="files/{filename}.pdf"]: "会期日程.pdf"
      li > a[href="files/{filename}.pdf"]: "議案目録.pdf"
      li > a[href="files/{filename}.pdf"]: "一般質問通告者表.pdf"
      li > a[href="files/{filename}.pdf"]: "会議録（一般質問）.pdf"  ← スクレイピング対象
      li > a[href="files/{filename}.pdf"]: "会議結果.pdf"

    h2: "令和{N}年第{回}回臨時会（令和{N}年{月}月{日}日）"
    ol
      li > a[href="files/{filename}.pdf"]: "議案目録.pdf"
      li > a[href="files/{filename}.pdf"]: "会議結果.pdf"
```

### PDF ファイル名の命名規則

ファイル名は統一されておらず、複数のパターンが混在する:

- `{西暦年}_{月}_kaigiroku.pdf`（例: `2025_12_kaigiroku.pdf`）
- `{西暦年}_{月}_teirei_kaigiroku.pdf`（例: `2025_9_teirei_kaigiroku.pdf`）
- `{西暦年}_{月}_ippannsitumonkaigiroku.pdf`（例: `2025_3_ippannsitumonkaigiroku.pdf`）
- `{YYYYMMDD}-{HHMMSS}.pdf`（タイムスタンプ形式、例: `20250314-150432.pdf`）

### 会議録の種類

- **定例会**: 会期日程、議案目録、一般質問通告者表、会議録（一般質問）、会議結果 の最大5種類のPDF
- **臨時会**: 議案目録、会議結果 の2種類のPDF（会議録は通常なし）

スクレイピング対象は「会議録（一般質問）」のPDFのみ。リンクテキストに「会議録」を含むものを抽出する。

---

## ページネーション

なし。年度別ページに当該年度の全会議情報が1ページにまとめて掲載される。

---

## スクレイピング方針

### 1. 年度ページ一覧の取得

一覧ページ (`/gyousei/gikai/teireikairinjikai/`) にアクセスし、`a.tit` リンクから年度別ページの URL を収集する。

### 2. 各年度ページの解析

年度別ページにアクセスし、以下を抽出:

- `<h2>` タグから会議名（定例会/臨時会の区分、回次、開催時期）
- 各 `<h2>` 直後の `<ol>` 内のリンクから、リンクテキストに「会議録」を含む `<a>` タグの `href` 属性を取得

### 3. PDF のダウンロードとテキスト抽出

- PDF の URL は相対パスで `files/{filename}.pdf` 形式
- ベース URL: `http://www.town.owani.lg.jp/gyousei/gikai/teireikairinjikai/`
- PDFをダウンロードし、テキスト抽出を行う

### 4. メタデータの構成

`<h2>` テキストから以下を解析:
- 会議種別: 「定例会」または「臨時会」
- 回次: 「第{N}回」
- 開催時期: 「令和{N}年{月}月」または「令和{N}年{月}月{日}日」

### 注意事項

- 臨時会には通常「会議録」PDFが存在しない（議案目録と会議結果のみ）
- PDFファイル名の命名規則が統一されていないため、ファイル名からのメタデータ抽出は不可。`<h2>` テキストとリンクテキストを基にメタデータを構成する
- 旧URL（`/sp/index.cfm/9,13137,46,160,html`）は404を返す。現行URLを使用すること
