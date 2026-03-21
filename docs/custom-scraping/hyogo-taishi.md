# 太子町（兵庫）議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/index.html
- 分類: 公式ウェブサイト上での年度別 PDF 公開（統一的な検索システムなし）
- 文字コード: UTF-8
- 特記:
  - 独立した会議録検索システムは存在しない
  - 年度ごとのページに PDF リストが掲載される形式
  - 大阪府の太子町（`town.taishi.osaka.jp`）とは別の自治体（兵庫県揖保郡）

---

## URL 構造

### インデックスページ（年度一覧）

| ページ | URL |
| --- | --- |
| 年度一覧（令和元年〜現在） | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/index.html` |
| 年度一覧（平成28年以前） | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/index.html` |

### 年度別ページ

| 年度 | URL |
| --- | --- |
| 令和7年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/7320.html` |
| 令和6年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/6702.html` |
| 令和5年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/5785.html` |
| 令和4年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/1653884101338.html` |
| 令和3年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/1590727432082.html` |
| 令和2年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/1622774139059.html` |
| 令和元年（平成31年） | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/1559606029718.html` |
| 平成30年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/1464844345550.html` |
| 平成29年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/1496218284753.html` |
| 平成28年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1527750665433.html` |
| 平成27年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1434353020169.html` |
| 平成26年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1423106100796.html` |
| 平成25年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1423207850486.html` |
| 平成24年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1423207925727.html` |
| 平成23年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1423207968906.html` |
| 平成22年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1424219315440.html` |
| 平成21年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1424221578851.html` |
| 平成20年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1424224285621.html` |
| 平成19年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1424225799347.html` |
| 平成18年 | `https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/1424227846454.html` |

年度ページの URL は規則的なパターンがなく、短い数値 ID（令和5年以降）またはタイムスタンプ形式の ID（令和4年以前）が使われている。新年度のページが追加された際は年度一覧ページから URL を取得する必要がある。

### PDF ファイル格納場所

全 PDF は以下のディレクトリに格納されている:

```
https://www.town.hyogo-taishi.lg.jp/material/files/group/16/[ファイル名].pdf
```

---

## PDF ファイルの命名規則

令和元年以降と平成28年以前で命名規則が異なる。

### 令和元年以降

| 種別 | パターン | 例 |
| --- | --- | --- |
| 本文（各開催日） | `R[令和年]-[月]-[日].pdf` | `R7-12-19.pdf` |
| 目次 | `R[令和年]-[月]kaigirokumokuji.pdf` | `R7-12kaigirokumokuji.pdf` |

ただし、年度によって若干の表記揺れあり（例: `R6-12mokuji_.pdf`、`R06-09mokuji.pdf` など）。

### 平成28年以前

8桁の数字のみ（例: `56576362.pdf`）で、日付や会議名との対応関係はファイル名から判断できない。

---

## 会議の種別

本会議のみが掲載されており、委員会等の会議録は掲載されていない。

### 開催パターン

年間を通じて以下の会議が開催される:

| 時期 | 種別 | 備考 |
| --- | --- | --- |
| 3月 | 定例会（1〜5日程度） | 2月下旬から開始するケースあり |
| 6月 | 定例会（3〜4日程度） | |
| 9月 | 定例会（3〜4日程度） | 8月下旬から開始するケースあり |
| 12月 | 定例会（3〜4日程度） | 11月下旬から開始するケースあり |
| 随時 | 臨時会（1日程度） | 5月・8月など、年によって異なる |

---

## 年度別ページの HTML 構造

各年度ページには会議ごとにセクションが分かれており、PDF へのリンクがリスト形式で掲載されている。

```html
<!-- 会議名の見出し（例） -->
<h3>第518回太子町議会定例会（12月）</h3>

<!-- PDFリンクのリスト -->
<ul>
  <li>
    <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R7-12kaigirokumokuji.pdf">
      目次 (PDFファイル: XXkb)
    </a>
  </li>
  <li>
    <a href="//www.town.hyogo-taishi.lg.jp/material/files/group/16/R7-11-28.pdf">
      第1日（令和7年11月28日） (PDFファイル: XXkb)
    </a>
  </li>
  <!-- ... -->
</ul>
```

リンクテキストには `(PDFファイル: XXkb)` というファイルサイズ情報が含まれる。

---

## スクレイピング戦略

検索システムが存在しないため、年度別ページを順に巡回して PDF リンクを収集する。

### Step 1: 年度一覧ページから年度別 URL を収集

2つのインデックスページ（令和元年以降・平成28年以前）を取得し、`<a>` タグから年度別ページの URL を抽出する。

```
GET https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/index.html
GET https://www.town.hyogo-taishi.lg.jp/soshikikarasagasu/taishityougikai/honkaiginnokaigiroku/honkaigikaigiroku/index.html
```

### Step 2: 各年度ページから PDF リンクを収集

各年度ページを取得し、`material/files/group/16/` を含む `<a>` タグの `href` 属性を抽出する。

取得情報:
- PDF の URL（ファイル名から開催日・年度を推定）
- リンクテキスト（開催日・会議名）
- 所属する会議名（直近の見出し要素から取得）

### Step 3: PDF のダウンロードとテキスト抽出

収集した PDF URL から PDF をダウンロードし、テキストを抽出する。

- 目次 PDF（`mokuji` を含むファイル名）はスキップ可
- 本文 PDF のみを処理対象とする

---

## 注意事項

- **差分更新**: 年度一覧ページおよび各年度ページは随時更新される。新しい会議録が追加された場合は年度ページのみ再取得すれば十分で、過去年度のページは変更されない（ただし令和4年以前のページは ID がタイムスタンプ形式で予測不可能なため、常にインデックスページから URL を取得する）。
- **PDF のみ**: テキスト形式での提供はなく、全データが PDF 形式。OCR が必要な場合がある（スキャン画像の PDF が含まれる可能性を考慮すること）。
- **ファイル命名の揺れ**: 令和元年以降でも年度によって目次 PDF のファイル名パターンが統一されていないため、`material/files/group/16/` 配下のリンクを包括的に取得することが重要。
- **大阪府太子町との混同に注意**: 大阪府南河内郡太子町（`town.taishi.osaka.jp`）は別自治体。ファイル名やシステムは全く異なる。
- **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける。
