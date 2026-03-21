# 甲良町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/index.html
- 分類: 公式ウェブサイト上での年度別 PDF 公開（統合的な会議録検索システムなし）
- 文字コード: UTF-8
- 特記:
  - 独立した会議録検索システムは存在しない
  - 年度ごとのページに PDF リストが掲載される形式
  - 令和8年から平成19年度までの会議録を公開

---

## URL 構造

### インデックスページ（年度一覧）

| ページ | URL |
| --- | --- |
| 年度一覧 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/index.html` |

### 年度別ページ

| 年度 | URL |
| --- | --- |
| 令和8年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2849.html` |
| 令和7年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2686.html` |
| 令和6年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2472.html` |
| 令和5年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2299.html` |
| 令和4年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/2092.html` |
| 令和3年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1611820493656.html` |
| 令和2年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1580445852377.html` |
| 平成31年・令和元年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1550801173655.html` |
| 平成30年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1517357788877.html` |
| 平成29年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1485738952886.html` |
| 平成28年 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1453705146379.html` |
| 平成27年度 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1432867442153.html` |
| 平成26年度 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1392958375822.html` |
| 平成25年度 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/kaigiroku.html` |
| 平成24年度 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1386036184983.html` |
| 平成23年度 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1385969843202.html` |
| 平成22年度 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1385976715649.html` |
| 平成21年度 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1385979266666.html` |
| 平成20年度 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1386031928472.html` |
| 平成19年度 | `https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/1386033219831.html` |

年度ページの URL は規則的なパターンがなく、短い数値 ID（令和4年以降）またはタイムスタンプ形式の ID（令和3年以前）が使われている。新年度のページが追加された際は年度一覧ページから URL を取得する必要がある。

### PDF ファイル格納場所

全 PDF は以下のディレクトリに格納されている:

```
https://www.kouratown.jp/material/files/group/17/[ファイル名].pdf
```

---

## PDF ファイルの命名規則

年度・時期によって命名規則が異なり、統一されていない。

### 令和4年以降（新しい形式）

| 種別 | パターン例 |
| --- | --- |
| 日付形式 | `20250129nittei.pdf`、`20250221.pdf` |
| 月日+内容（ローマ字） | `6gatu9nitikaigiroku.pdf`、`9gatuteireikaigiketukeltuka.pdf` |
| 年号+月日+内容（詳細） | `reiwa7nenn9gatu4kateireikaikaigiroku.pdf` |

ファイル名の形式は会期や担当者によって大きく異なる。

### 平成19年度〜平成20年代

| 種別 | パターン例 |
| --- | --- |
| 年号略称+月+内容+日付 | `h19_12giji_situmon01.pdf`、`h20_0305kaigiroku.pdf` |
| 臨時会 | ファイル名に `rinji` が含まれる例あり |

---

## 会議の種別

本会議のみが掲載されており、委員会等の会議録は掲載されていない。

### 開催パターン

年間を通じて以下の会議が開催される:

| 時期 | 種別 | 備考 |
| --- | --- | --- |
| 3月 | 定例会（3日程度） | |
| 6月 | 定例会（2〜3日程度） | |
| 9月 | 定例会（3日程度） | |
| 12月 | 定例会（3日程度） | |
| 随時 | 臨時会（1日程度） | 年によって1〜2回開催 |

各会期のページには会議録 PDF のほかに「日程」「一般質問」「議決結果」の資料 PDF も掲載されている。

---

## 年度別ページの HTML 構造

各年度ページには会期ごとにセクションが分かれており、PDF へのリンクがリスト形式で掲載されている。

```html
<!-- 会期名の見出し（例） -->
<h3>令和7年3月定例会</h3>

<!-- PDFリンクのリスト -->
<ul>
  <li>
    <a href="//www.kouratown.jp/material/files/group/17/20250221.pdf">
      日程 (PDFファイル: XXkb)
    </a>
  </li>
  <li>
    <a href="//www.kouratown.jp/material/files/group/17/20250303.pdf">
      一般質問 (PDFファイル: XXkb)
    </a>
  </li>
  <li>
    <a href="//www.kouratown.jp/material/files/group/17/20250321kekka.pdf">
      議案等（議決結果） (PDFファイル: XXkb)
    </a>
  </li>
  <li>
    <a href="//www.kouratown.jp/material/files/group/17/3636.pdf">
      3月6日会議録 (PDFファイル: XXkb)
    </a>
  </li>
  <!-- ... -->
</ul>
```

リンクテキストには `(PDFファイル: XXkb)` というファイルサイズ情報が含まれる。リンクテキストから「日程」「一般質問」「議案等（議決結果）」と「会議録」を区別できる。

---

## スクレイピング戦略

検索システムが存在しないため、年度別ページを順に巡回して PDF リンクを収集する。

### Step 1: 年度一覧ページから年度別 URL を収集

インデックスページを取得し、`<a>` タグから年度別ページの URL を抽出する。

```
GET https://www.kouratown.jp/cyonososhiki/gikaijimukyoku/gijikakari/chogikai/kaigiroku/index.html
```

### Step 2: 各年度ページから PDF リンクを収集

各年度ページを取得し、`material/files/group/17/` を含む `<a>` タグの `href` 属性を抽出する。

取得情報:
- PDF の URL（ファイル名から開催日・種別の推定を試みる）
- リンクテキスト（開催日・会議名・種別）
- 所属する会議名（直近の見出し要素から取得）

### Step 3: 会議録 PDF の特定

リンクテキストに「会議録」を含むもの、または「日程」「一般質問」「議決結果（議案等）」を含まないものを会議録 PDF として扱う。

### Step 4: PDF のダウンロードとテキスト抽出

収集した会議録 PDF の URL から PDF をダウンロードし、テキストを抽出する。

---

## 注意事項

- **差分更新**: 年度一覧ページおよび各年度ページは随時更新される。新しい会議録が追加された場合は該当年度ページのみ再取得すれば十分で、過去年度のページは変更されない。
- **PDF のみ**: テキスト形式での提供はなく、全データが PDF 形式。OCR が必要な場合がある（スキャン画像の PDF が含まれる可能性を考慮すること）。
- **ファイル命名の不統一**: 年度・担当者によってファイル名パターンが大きく異なるため、ファイル名からの情報抽出は補助的な手段にとどめ、リンクテキストを主な情報源とすること。
- **group/17 でフィルタ**: PDF へのリンクはすべて `material/files/group/17/` 配下にあるため、このパスでフィルタリングすることで PDF 以外のリンクを除外できる。
- **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける。
