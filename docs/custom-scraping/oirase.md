# おいらせ町議会（青森県） カスタムスクレイピング方針

## 概要

- サイト: https://www.town.oirase.aomori.jp/site/gikai/
- 分類: 町公式サイトで会議録を PDF で直接公開。検索システムなし
- 文字コード: UTF-8
- 特記: 平成25年（2013年）以降の定例会・臨時会の会議録を年度別ページで掲載。全会議録が PDF ファイルで提供される

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.oirase.aomori.jp/site/gikai/list19-60.html` |
| 年度別会議録ページ | `https://www.town.oirase.aomori.jp/site/gikai/{ページスラグ}.html` |
| PDF ファイル | `https://www.town.oirase.aomori.jp/uploaded/attachment/{ID}.pdf` |

---

## ページ構造

### 会議録一覧ページ（list19-60.html）

年度別の会議録ページへのリンクが一覧で掲載されている。

- 各リンクは `<li>` 要素内に掲載日とページリンクを含む
- ページネーションなし（全年度が単一ページに収まる）

```html
<div class="list_ddd">
  <ul>
    <li>
      <span class="span_b">2026年2月3日更新</span>
      <span class="span_a"><a href="/site/gikai/kaigiroku2025.html">議会会議録の閲覧(令和７年)</a></span>
    </li>
    <li>
      <span class="span_b">2024年12月5日更新</span>
      <span class="span_a"><a href="/site/gikai/kaigiroku2024.html">議会会議録の閲覧(令和６年)</a></span>
    </li>
    <!-- ... -->
  </ul>
</div>
```

### 年度別ページのリンク一覧

| href | テキスト |
| --- | --- |
| `/site/gikai/kaigiroku2025.html` | 議会会議録の閲覧(令和７年) |
| `/site/gikai/kaigiroku2024.html` | 議会会議録の閲覧(令和６年) |
| `/site/gikai/kaigiroku2023.html` | 議会会議録の閲覧(令和５年) |
| `/site/gikai/kaigiroku2022.html` | 議会会議録の閲覧(令和４年) |
| `/site/gikai/kaigiroku2021.html` | 議会会議録の閲覧(令和３年) |
| `/site/gikai/12gatugikai.html` | 議会会議録の閲覧(令和2年) |
| `/site/gikai/kaigiroku-31.html` | 議会会議録の閲覧(平成31年・令和元年) |
| `/site/gikai/kaigiroku-30.html` | 議会会議録の閲覧（平成30年） |
| `/site/gikai/kaigiroku-29.html` | 議会会議録の閲覧（平成29年） |
| `/site/gikai/gikai-kaigiroku28.html` | 議会会議録の閲覧（平成28年） |
| `/site/gikai/gikai-kaigiroku27.html` | 議会会議録の閲覧（平成27年） |
| `/site/gikai/gikai-kaigiroku26.html` | 議会会議録の閲覧（平成26年） |
| `/site/gikai/gikaikaigiroku.html` | 議会会議録の閲覧（平成25年） |

---

## HTML 構造

### 年度別ページ（令和7年の例: kaigiroku2025.html）

各定例会・臨時会が `<h3>` 見出しで区切られ、その下に `<table>` で会議日程と PDF リンクが掲載される。

```html
<h2>令和７年議会会議録</h2>

<h3>第４回定例会（12月4日から12月10日まで）</h3>
<table>
  <caption>会議録</caption>
  <tbody>
    <tr>
      <td><strong>１２月　４日(木曜日)</strong></td>
      <td>本会議（開会）</td>
      <td><a href="/uploaded/attachment/26229.pdf">令和７年第４回定例会（第１号） [PDFファイル／373KB]</a></td>
    </tr>
    <tr>
      <td><strong>１２月　８日(月曜日)</strong></td>
      <td>本会議（一般質問）</td>
      <td><a href="/uploaded/attachment/26230.pdf">令和７年第４回定例会（第２号） [PDFファイル／1014KB]</a></td>
    </tr>
    <!-- ... -->
  </tbody>
</table>

<h3>第１回臨時会（５月２日）</h3>
<table>
  <tbody>
    <tr>
      <td><strong>５月　２日(金曜日)</strong></td>
      <td>本会議（開会、議案審議、閉会）</td>
      <td><a href="/uploaded/attachment/25091.pdf">令和７年第１回臨時会（第１号） [PDFファイル／644KB]</a></td>
    </tr>
  </tbody>
</table>
```

### テーブル構造

各行は 3 列で構成される:

| 列 | 内容 | 例 |
| --- | --- | --- |
| 1列目 | 開催日（全角数字、曜日付き） | `１２月　４日(木曜日)` |
| 2列目 | 会議種別 | `本会議（開会）`、`本会議（一般質問）`、`予算特別委員会` |
| 3列目 | PDF リンク | `令和７年第４回定例会（第１号） [PDFファイル／373KB]` |

### 古い年度のページ（平成25年の例: gikaikaigiroku.html）

テーブル構造はほぼ同じだが、HTML のスタイル属性が異なる。`<th>` タグが使われている場合がある。

```html
<h3>平成25年第4回（12月）定例会</h3>
<table>
  <tbody>
    <tr>
      <th>12月5日（木曜日）　</th>
      <td>定例会開会</td>
      <td><a href="/uploaded/attachment/816.pdf">平成25年第4回定例会（1日目）H25.12.05 [PDFファイル／390KB]</a></td>
    </tr>
  </tbody>
</table>
```

臨時会は `<ul><li>` でリスト形式の場合もある:

```html
<h3>平成25年第2回臨時会</h3>
<ul>
  <li><a href="/uploaded/attachment/752.pdf">平成25年第2回臨時会（H25.06.28） [PDFファイル／316KB]</a></li>
</ul>
```

---

## ページネーション

なし。各年度ページに当該年度の全会議録が掲載されている。一覧ページにも全年度のリンクが 1 ページに収まっている。

---

## 掲載年度範囲

平成25年（2013年）〜 令和7年（2025年）

---

## 会議種別

- 定例会（年4回: 3月・6月・9月・12月）
- 臨時会
- 予算特別委員会（3月定例会に付随）
- 決算特別委員会（9月定例会に付随）

---

## PDF リンクテキストのフォーマット

年度によって書式が異なる:

### 新しい年度（令和以降）

```
令和{N}年第{X}回定例会（第{Y}号） [PDFファイル／{サイズ}]
令和{N}年第{X}回臨時会（第{Y}号） [PDFファイル／{サイズ}]
令和{N}年予算特別委員会（第{Y}号） [PDFファイル／{サイズ}]
令和{N}年決算特別委員会（第{Y}号） [PDFファイル／{サイズ}]
```

### 古い年度（平成25年）

```
平成{N}年第{X}回定例会（{Y}日目）H{N}.{MM}.{DD} [PDFファイル／{サイズ}]
平成{N}年第{X}回臨時会（H{N}.{MM}.{DD}） [PDFファイル／{サイズ}]
```

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

会議録一覧ページ `list19-60.html` から、年度別ページへのリンクをすべて収集する。

- リンクは `.list_ddd ul li span.span_a a` セレクタで取得可能
- 全リンクが単一ページ内に存在するため、ページネーション処理は不要

### Step 2: 各年度ページから PDF リンクを収集

各年度別ページを取得し、PDF リンクを抽出する。

```typescript
// PDF リンクの収集
const pdfLinks = $('a[href$=".pdf"]');
```

### Step 3: メタ情報の抽出

- `<h3>` 見出しから定例会名・臨時会名・会期を取得
- テーブル行から開催日・会議種別を取得
- PDF リンクテキストから会議号数を取得

```typescript
// h3 見出しの解析
const sessionPattern = /第(\d+)回(定例会|臨時会)（(.+?)）/;

// PDF リンクテキストの解析（新形式）
const pdfTextPattern = /(令和|平成)(\d+)年第(\d+)回(定例会|臨時会)（第(\d+)号）/;

// PDF リンクテキストの解析（旧形式）
const pdfTextPatternOld = /(平成)(\d+)年第(\d+)回(定例会|臨時会)（(\d+)日目）H\d+\.\d+\.\d+/;

// 開催日の抽出（テーブル1列目から）
// 全角数字のため正規化が必要
const dateCell = row.find('td:first-child, th:first-child').text().trim();
```

### Step 4: PDF のダウンロードとテキスト抽出

1. PDF をダウンロード（`/uploaded/attachment/{ID}.pdf`）
2. pdf-parse 等でテキスト化

---

## 注意事項

- **全角数字**: 開催日の数字が全角で記述されている（例: `１２月　４日`）。正規化処理が必要
- **ページスラグの不規則性**: 年度別ページのスラグに統一的な命名規則がない（`kaigiroku2025`、`12gatugikai`、`kaigiroku-31`、`gikai-kaigiroku28`、`gikaikaigiroku` など）。URL を推測できないため、必ず一覧ページからリンクを収集する
- **HTML 構造の年度間差異**: 新しい年度は `<td>` のみ、古い年度は `<th>` を使用。臨時会は `<ul><li>` 形式の場合がある
- **特別委員会の扱い**: 予算特別委員会・決算特別委員会は定例会とは別の会議録として掲載されるが、同じテーブル内に含まれる
- **全て PDF 公開**: HTML 直接公開はなく、全年度で PDF ファイルとして提供される

---

## 推奨アプローチ

1. **一覧ページを起点にする**: `list19-60.html` の 1 リクエストで全年度ページの URL を収集できる
2. **年度ページごとに PDF リンクを収集**: 各年度ページから `a[href$=".pdf"]` で PDF リンクを一括取得
3. **メタ情報は h3 見出しとテーブル行から取得**: PDF リンクテキストだけでなく、見出しとテーブルの情報も活用する
4. **レート制限**: 自治体サイトのため、リクエスト間に 1〜2 秒の待機時間を設ける
5. **差分更新**: 既取得 PDF URL のリストと比較し、新規 URL のみを取得する
