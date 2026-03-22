# 田子町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.takko.lg.jp/index.cfm/13,0,45,190,html
- 分類: 町公式サイト内の ColdFusion ベース CMS に PDF ファイルを直接掲載
- 文字コード: UTF-8
- 特記: 年度別のHTMLページに定例会・臨時会ごとのPDFリンクを掲載。議案審議結果一覧としてPDF形式で公開。会議録検索システムは未導入。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議事録トップ（年度一覧） | `https://www.town.takko.lg.jp/index.cfm/13,0,45,190,html` |
| 令和8年分 | `https://www.town.takko.lg.jp/index.cfm/13,13166,45,190,html` |
| 令和7年分 | `https://www.town.takko.lg.jp/index.cfm/13,11939,45,190,html` |
| 令和6年分 | `https://www.town.takko.lg.jp/index.cfm/13,10401,45,190,html` |
| 令和5年分 | `https://www.town.takko.lg.jp/index.cfm/13,9700,45,190,html` |
| 令和4年分 | `https://www.town.takko.lg.jp/index.cfm/13,8195,45,190,html` |
| PDF ファイル | `https://www.town.takko.lg.jp/_resources/content/{年度ID}/{タイムスタンプ}.pdf` |

URL パターン: `/index.cfm/13,{年度別ID},45,190,html`

年度別ID は年度ごとに異なる数値（規則性なし）。

---

## HTML 構造

### 一覧ページ（議事録トップ）

```
div#page_body
  h1: "議事録"
  ul
    li > a[href="/index.cfm/13,{ID},45,190,html"]: "議案審議結果一覧（令和{N}年分）"
    li > a[href="/index.cfm/13,{ID},45,190,html"]: "議案審議結果一覧（令和{N}年分）"
    ...
```

全年度分のリンクが1ページにリスト形式で掲載される。

### 年度別ページ

各年度ページ内で `<h3>` が会議区分（定例会/臨時会）の見出しとなり、その配下の `<li>` にPDFリンクが並ぶ。

```
div#page_body
  h3: "〇定例会"
  ul
    li > a[href="/_resources/content/{ID}/{タイムスタンプ}.pdf"]: "第１回定例会"
    li > a[href="/_resources/content/{ID}/{タイムスタンプ}.pdf"]: "第２回定例会"
    li > a[href="/_resources/content/{ID}/{タイムスタンプ}.pdf"]: "第３回定例会"
    li > a[href="/_resources/content/{ID}/{タイムスタンプ}.pdf"]: "第４回定例会"

  h3: "〇臨時会"
  ul
    li > a[href="/_resources/content/{ID}/{タイムスタンプ}.pdf"]: "第１回臨時会"
    li > a[href="/_resources/content/{ID}/{タイムスタンプ}.pdf"]: "第２回臨時会"
```

### PDF ファイル名の命名規則

タイムスタンプ形式で統一されている:

- `{YYYYMMDD}-{HHMMSS}.pdf`（例: `20250317-141754.pdf`）

### PDF の内容

- **定例会**: 議案審議結果一覧をPDFに集約
- **臨時会**: 議案審議結果一覧をPDFに集約

各PDFは当該会議の議案審議結果をまとめた文書。

---

## ページネーション

なし。一覧ページに全年度分のリンクが掲載され、各年度ページにも当該年度の全会議PDFリンクが1ページにまとめて掲載される。

---

## スクレイピング方針

### 1. 年度ページ一覧の取得

一覧ページ (`/index.cfm/13,0,45,190,html`) にアクセスし、`<ul>` 内の `<a>` リンクから年度別ページの URL を収集する。リンクテキストに「議案審議結果一覧」を含むものを対象とする。

### 2. 各年度ページの解析

年度別ページにアクセスし、以下を抽出:

- `<h3>` タグから会議区分（定例会/臨時会）
- 各 `<h3>` 配下の `<ul>` 内の `<a>` タグから PDF の `href` 属性とリンクテキスト（会議名・回次）を取得

### 3. PDF のダウンロードとテキスト抽出

- PDF の URL は相対パスで `/_resources/content/{年度ID}/{タイムスタンプ}.pdf` 形式
- ベース URL: `https://www.town.takko.lg.jp`
- 全PDFをダウンロード対象とする（定例会・臨時会ともに議案審議結果）

### 4. メタデータの構成

`<h3>` テキストとリンクテキストから以下を解析:
- 会議種別: 「定例会」または「臨時会」（`<h3>` から判定）
- 回次: 「第{N}回」（リンクテキストから抽出）
- 年度: 年度別ページのタイトルまたは一覧ページのリンクテキストから「令和{N}年」を抽出

### 注意事項

- ColdFusion CMS ベースのサイトのため、URL がカンマ区切りのパラメータ形式（`/index.cfm/13,{ID},45,190,html`）になっている
- 年度別ページのID（`13166`, `11939` 等）に規則性がないため、一覧ページから動的にリンクを取得する必要がある
- PDFファイルのリンクには PDF アイコン画像（`/images/icons/pdf.gif`）が含まれる場合がある
- すべてのPDFが議案審議結果一覧であり、会議録（発言録）ではない点に注意
