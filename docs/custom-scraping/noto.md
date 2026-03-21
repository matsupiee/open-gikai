# 能登町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/index.html
- 分類: 町公式ホームページによる年度別 PDF 直接公開（専用検索システムなし）
- 文字コード: UTF-8
- 特記: 専用の議会会議録検索システムではなく、議会事務局のページで年度別に PDF を直接公開している

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 年度一覧トップ | `https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/index.html` |
| 各年度ページ | `https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/{ページID}.html` |
| PDF ファイル | `https://www.town.noto.lg.jp/material/files/group/14/{ファイル名}.pdf` |

※ 各年度ページの ID は連番ではなく不規則な数値のため、年度一覧トップから都度取得する必要がある。

---

## 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和8年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/5117.html |
| 令和7年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/3430.html |
| 令和6年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1401.html |
| 令和5年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1358.html |
| 令和4年（12月） | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1357.html |
| 令和4年（1月～11月） | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1443.html |
| 令和3年（12月） | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1442.html |
| 令和3年（1月～11月） | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1439.html |
| 令和2年（12月） | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1438.html |
| 令和2年（1月～11月） | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1325.html |
| 令和元年・平成31年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1773.html |
| 平成30年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1355.html |
| 平成30年（改選後） | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1322.html |
| 平成29年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1353.html |
| 平成28年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1348.html |
| 平成27年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1347.html |
| 平成26年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1320.html |
| 平成25年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1318.html |
| 平成24年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1317.html |
| 平成23年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1315.html |
| 平成22年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1312.html |
| 平成21年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1394.html |
| 平成20年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1393.html |
| 平成19年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1392.html |
| 平成18年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1396.html |
| 平成17年 | https://www.town.noto.lg.jp/kakuka/1013/gyomu/1/1/1397.html |

※ 令和2年〜令和4年は年度途中でページが分割されており、同一年度に複数のページが存在する。

---

## HTML 構造

### 年度一覧ページ

年度一覧トップページは `pageListDynBlock`、`pageEntity` クラスのリスト要素で構成される。各年度ページへのリンクは `<a>` タグで直接記載されている。

```html
<a href="/kakuka/1013/gyomu/1/1/3430.html">令和7年 能登町議会会議録</a>
```

### 年度別ページ（PDF 一覧）

各年度ページは「関連ファイル」セクションに PDF リンクが列挙されており、詳細ページへの遷移なく直接 PDF を参照できる。

```html
<a href="//www.town.noto.lg.jp/material/files/group/14/R7_1kaigiroku.pdf">
第1回能登町議会1月会議録 (PDFファイル: 301.0KB)
</a>
```

- href はプロトコル相対 URL（`//www.town.noto.lg.jp/...`）で記載されている
- リンクテキストに会議名とファイルサイズが含まれる
- ページネーションなし（1ページに全件表示）

---

## 会議名のテキストパターン

### 令和期（近年）

```
第1回能登町議会1月会議録
第2回能登町議会3月定例会議録
第3回能登町議会5月会議録
第4回能登町議会6月定例会議録
第5回能登町議会9月定例会議録
第6回能登町議会12月定例会議録
```

- 年間 6 回開催（2月・3月・5月・6月・9月・12月が多い）
- 定例会は「定例会議録」、臨時会相当は「会議録」のみ

### 平成期（古い年度）

```
平成17年第1回能登町議会臨時会
平成17年第1回能登町議会定例会
平成17年第2回能登町議会臨時会
平成17年第2回能登町議会定例会
```

- 年号が会議名に含まれる
- 「定例会」「臨時会」の区別が明示されている

### パース用正規表現（案）

```typescript
// 令和期: 「第N回能登町議会M月[定例]会議録」
const recentPattern = /第(\d+)回能登町議会(\d+)月(定例)?会議録/;

// 平成期: 「平成N年第M回能登町議会(定例会|臨時会)」
const historicPattern = /(?:平成|令和)(\d+)年第(\d+)回能登町議会(定例会|臨時会)/;

// PDF リンクのテキストからファイルサイズを除去
const titlePattern = /^(.+?)\s*\(PDFファイル:.+\)$/;
```

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

年度一覧トップ（`index.html`）から各年度ページへの `<a>` タグを Cheerio で抽出する。

- URL が `/kakuka/1013/gyomu/1/1/` で始まり `index.html` 以外のページを収集
- ページ ID は不規則なため、静的に保持するか毎回一覧ページから取得する

### Step 2: 各年度ページから PDF リンクを収集

各年度ページの `<a>` タグを全て抽出し、href が `/material/files/group/14/` を含むものを PDF リンクとして収集する。

- href はプロトコル相対 URL のため、`https:` を先頭に付与して正規化する
- リンクテキストから会議名（ファイルサイズ除去後）を抽出する

```typescript
// href の正規化
const href = $a.attr("href") ?? "";
const url = href.startsWith("//") ? `https:${href}` : href;

// リンクテキストから会議名を抽出
const rawText = $a.text().trim();
const title = rawText.replace(/\s*\(PDFファイル:.*?\)$/, "").trim();
```

### Step 3: PDF のダウンロードと登録

収集した PDF URL と会議名を元にレコードを作成する。会議録の日付は PDF 内容から取得するか、会議名の月情報を参考にする。

---

## 注意事項

- 令和2年〜令和4年は年度が複数ページに分割されているため、同じ年度のページを重複なく全て処理する
- 平成30年は「改選後」として別ページが存在する
- PDF ファイルのパスに `group/14/` が含まれるが、年度によってファイル命名規則が異なる（例: `R7_1kaigiroku.pdf`、`0000024411.pdf`）
- レート制限: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
- PDF は OCR が必要な場合があるため、テキスト抽出可否を事前確認することを推奨
