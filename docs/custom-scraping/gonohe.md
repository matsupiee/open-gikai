# 五戸町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.gonohe.aomori.jp/chosei/gikai/gikai_kaigiroku.html
- 分類: 町公式サイト内の静的 HTML ページに PDF ファイルを直接掲載
- 文字コード: UTF-8
- 特記: 年別のHTMLページに定例会・臨時会ごとのPDFリンクを掲載。会議録は1回の会議につき1つのPDFファイルとして公開。会議録検索システムは未導入。平成24年（2012年）以降のデータが公開されている。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.gonohe.aomori.jp/chosei/gikai/gikai_kaigiroku.html` |
| 令和7年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/2025-0602-1755-70.html` |
| 令和6年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/2024-0105-1410-70.html` |
| 令和5年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/2023-0417-1144-70.html` |
| 令和4年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/2022-0127-1130-70.html` |
| 令和3年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/2021-0115-1307-70.html` |
| 令和2年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/2020-0501-1910-70.html` |
| 令和元年（平成31年） | `https://www.town.gonohe.aomori.jp/chosei/gikai/2019-0304-1337-70.html` |
| 平成30年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/2018-0501-1431-70.html` |
| 平成29年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/2017-0119-1019-70.html` |
| 平成28年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/gikai_kaigiroku_H28.html` |
| 平成27年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/gikai_kaigiroku_H27.html` |
| 平成26年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/gikai_kaigiroku_H26.html` |
| 平成25年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/gikai_kaigiroku_H25.html` |
| 平成24年 | `https://www.town.gonohe.aomori.jp/chosei/gikai/gikai_kaigiroku_H24.html` |
| PDF ファイル | `https://www.town.gonohe.aomori.jp/chosei/gikai/gonohe-gikai-kaigiroku{期}-{回}.pdf` |

年別ページの URL パターンは統一されておらず、2つの形式が混在:
- 令和元年以降: `{YYYY}-{MMDD}-{HHMM}-70.html`（CMS タイムスタンプ形式）
- 平成28年以前: `gikai_kaigiroku_H{和暦年}.html`

---

## HTML 構造

### 一覧ページ（会議録トップ）

```
div.main_box
  h1: "議会会議録"
  div.main_body2
    h2.main_box_h2 > a[href="{年度ページURL}"]: "令和{N}年" / "平成{N}年"
    p: "　　第{N}回～第{M}回"
```

年別リンクは `<h2 class="main_box_h2">` 内の `<a>` タグで提供される。

### 年度別ページ

各年度ページ内で `<p>` タグ内にPDFリンクが並ぶ。`<h2>` 等による会議単位の構造化はなく、フラットな `<p>` の列挙。

```
div.main_box
  h1: "議会会議録　令和{N}年"
  div.main_body2
    p > a[href="./gonohe-gikai-kaigiroku{期}-{回}.pdf"]:
      "第{回}回 定例会　令和{N}年{月}月{日}日"
      img.wcv_ww_fileicon[alt="PDFファイル"]
      span.wcv_ww_filesize: "({size}KB)"
```

### PDF ファイル名の命名規則

ファイル名は `gonohe-gikai-kaigiroku{期}-{通し番号}.pdf` の形式:

- `gonohe-gikai-kaigiroku18-13.pdf`（第18期第13回）
- `gonohe-gikai-kaigiroku18-1.pdf`（第18期第1回）
- `gonohe-gikai-kaigiroku17-38.pdf`（第17期第38回）
- `gonohe-gikai-kaigiroku_16-9.pdf`（第16期第9回、アンダースコア区切り）

注意: 第16期以前はハイフンの前にアンダースコアが入る形式（`kaigiroku_16-9`）が使用されている。

### リンクテキストから取得できるメタデータ

- 回次: 「第{N}回」
- 会議種別: 「定例会」または「臨時会」
- 開催日: 「令和{N}年{月}月{日}日」または「平成{N}年{月}月{日}日～{日}日」

---

## ページネーション

なし。年度別ページに当該年の全会議録が1ページにまとめて掲載される。

---

## スクレイピング方針

### 1. 年度ページ一覧の取得

一覧ページ (`gikai_kaigiroku.html`) にアクセスし、`h2.main_box_h2 > a` リンクから年度別ページの URL を収集する。

### 2. 各年度ページの解析

年度別ページにアクセスし、以下を抽出:

- `<a>` タグの `href` 属性から `.pdf` で終わるリンクを取得
- リンクテキストから会議種別（定例会/臨時会）、回次、開催日を正規表現で抽出

### 3. PDF のダウンロードとテキスト抽出

- PDF の URL は相対パスで `./gonohe-gikai-kaigiroku{期}-{回}.pdf` 形式
- ベース URL: `https://www.town.gonohe.aomori.jp/chosei/gikai/`
- 1回の会議につき1つのPDF（全議事内容を含む）
- PDFをダウンロードし、テキスト抽出を行う

### 4. メタデータの構成

リンクテキストから以下を解析:
- 会議種別: 「定例会」または「臨時会」
- 回次: 「第{N}回」
- 開催日: 和暦の日付文字列（例: 「令和7年8月28日」「平成28年12月8日～13日」）

### 注意事項

- 年度ページの URL パターンが令和元年以降とそれ以前で異なるため、一覧ページからリンクを動的に取得する必要がある
- PDF ファイル名の区切り文字が期によって異なる（ハイフン `18-13` vs アンダースコア+ハイフン `_16-9`）
- 一部の定例会では開催日が範囲指定（「12月8日～13日」）となっている
- 令和6年のページには前年度の第38回（令和6年1月29日開催だが第17期の通し番号）も含まれており、年度と期の境界に注意が必要
