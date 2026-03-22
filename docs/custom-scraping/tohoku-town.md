# 東北町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku.html
- 分類: 町公式サイト内の静的 HTML ページに PDF ファイルを直接掲載
- 文字コード: UTF-8
- 特記: 一般質問の会議録を議員別にPDFで公開。最新年度はトップページに掲載し、過去年度は年度別の個別ページにリンク。会議録検索システムは未導入。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（最新年度） | `https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku.html` |
| 過去の会議録一覧 | `https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku-01.html` |
| 令和6年 | `https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku-06.html` |
| 令和5年 | `https://www.town.tohoku.lg.jp/chousei/gikai/gikai_kaigiroku-05.html` |
| PDF ファイル | `https://www.town.tohoku.lg.jp/chousei/gikai/file/gikai_kaigiroku-r{和暦年2桁}-{連番}.pdf` |

年度別ページの URL パターン: `gikai_kaigiroku-{和暦年2桁}.html`

---

## HTML 構造

### トップページ（最新年度の会議録）

```
div.contents-left
  h2: "会議録の閲覧"
  h4: "一般質問"
  p > a[href="file/gikai_kaigiroku-r07-13.pdf"]: "令和7年第4回定例会(一般質問)大崎昭子議員【PDF】"
  p > a[href="file/gikai_kaigiroku-r07-11.pdf"]: "令和7年第4回定例会(一般質問)斗賀高太郎議員【PDF】"
  ...
  p > a[href="gikai_kaigiroku-01.html"]: "過去の一般質問はこちら"
```

### 過去の会議録一覧ページ

```
div.contents-left
  h2: "過去の会議録の閲覧"
  h4: "一般質問"
  p > a[href="gikai_kaigiroku-05.html"]: "令和5年"
  p > a[href="gikai_kaigiroku-06.html"]: "令和6年"
```

### 年度別ページ

```
div.contents-left
  h2: "令和6年の会議録の閲覧"
  h4: "一般質問"
  p > a[href="file/gikai_kaigiroku-r06-10.pdf"]: "令和6年第4回定例会(一般質問)蛯澤正雄議員【PDF】"
  p > a[href="file/gikai_kaigiroku-r06-11.pdf"]: "令和6年第4回定例会(一般質問)斗賀高太郎議員【PDF】"
  ...
```

### PDF リンクテキストの形式

```
令和{N}年第{回}回定例会(一般質問){議員名}議員【PDF】
```

リンクテキストから以下のメタデータを抽出可能:
- 年度（和暦）: 「令和{N}年」
- 定例会回次: 「第{回}回定例会」
- 議員名: 「{議員名}議員」

### PDF ファイル名の命名規則

`gikai_kaigiroku-r{和暦年2桁}-{連番2桁}.pdf`

- 例: `gikai_kaigiroku-r07-13.pdf`（令和7年、連番13）
- 例: `gikai_kaigiroku-r06-01.pdf`（令和6年、連番01）

連番は年度内の通し番号で、定例会の回次や議員とは直接対応しない。

---

## ページネーション

なし。各ページに当該年度の全会議録リンクが1ページにまとめて掲載される。

ただし、年度をまたぐ構造になっており、トップページ（最新年度）と過去年度ページ群に分かれる。過去の会議録一覧ページから各年度ページへのリンクを辿る必要がある。

---

## スクレイピング方針

### 1. トップページの解析

トップページ (`gikai_kaigiroku.html`) にアクセスし、以下を取得:

- `div.contents-left` 内の `<p> > <a>` タグで `href` が `file/` で始まるリンクから、最新年度のPDF URLを収集
- `href` が `gikai_kaigiroku-01.html` のリンクから過去の会議録一覧ページのURLを取得

### 2. 過去の会議録一覧ページの解析

過去の会議録一覧ページ (`gikai_kaigiroku-01.html`) にアクセスし、年度別ページへのリンクを収集:

- `div.contents-left` 内の `<p> > <a>` タグで `href` が `gikai_kaigiroku-{NN}.html` パターンのリンクを取得

### 3. 各年度ページの解析

年度別ページにアクセスし、PDF リンクを収集:

- `div.contents-left` 内の `<p> > <a>` タグで `href` が `file/` で始まるリンクを取得

### 4. PDF のダウンロードとテキスト抽出

- PDF の URL は相対パス `file/{filename}.pdf` 形式
- ベース URL: `https://www.town.tohoku.lg.jp/chousei/gikai/`
- PDF をダウンロードし、テキスト抽出を行う

### 5. メタデータの構成

リンクテキストから以下を正規表現で解析:

```
/令和(\d+)年第(\d+)回定例会\(一般質問\)(.+?)議員/
```

- 年度: 「令和{N}年」 → 西暦に変換（令和N年 = 2018 + N）
- 会議種別: 「定例会」（一般質問のみ公開のため固定）
- 回次: 「第{N}回」
- 議員名: 質問者名

### 注意事項

- 公開されているのは一般質問の会議録のみ（本会議全体の会議録は非公開）
- 議員別にPDFが分かれているため、同一定例会でも複数のPDFが存在する
- 過去の会議録一覧ページの年度リンクは新しい年度が追加される可能性があるため、動的に取得する
- 連番はファイル名の一部であり、メタデータとしての意味は持たない
