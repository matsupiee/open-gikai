# 中泊町議会（青森県） カスタムスクレイピング方針

## 概要

- サイト: https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/index.html
- 分類: 町公式サイトで年度別に PDF ファイルとして会議録を公開
- 文字コード: UTF-8
- 特記: 年度ごとに個別ページがあり、各ページ内に定例会・臨時会の PDF リンクが掲載される

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/index.html` |
| 年度別会議録ページ | `https://www.town.nakadomari.lg.jp/gyoseijoho/gikai/kaigiroku/{ページID}.html` |
| PDF ファイル | `https://www.town.nakadomari.lg.jp/material/files/group/12/{ファイル名}.pdf` |

---

## ページ構造

### 会議録一覧ページ（index.html）

年度別の会議録ページへのリンクがリスト形式（`<ul>` > `<li>` > `<a>`）で掲載されている。

- ページネーションなし
- 全年度のリンクが単一ページ内に存在

### 年度別ページのリンク一覧

| href | テキスト |
| --- | --- |
| `/gyoseijoho/gikai/kaigiroku/5392.html` | 令和8年会議録 |
| `/gyoseijoho/gikai/kaigiroku/5135.html` | 令和7年会議録 |
| `/gyoseijoho/gikai/kaigiroku/4883.html` | 令和6年会議録 |
| `/gyoseijoho/gikai/kaigiroku/4803.html` | 令和5年会議録 |
| `/gyoseijoho/gikai/kaigiroku/2760.html` | 令和4年会議録 |

---

## HTML 構造

### 年度別ページの構造

`<h3>` タグで定例会・臨時会の見出しがあり、その下に PDF リンクが `<a>` タグで掲載される。

```html
<h2>令和7年会議録</h2>

<h3>令和7年第1回中泊町議会臨時会</h3>
<a href="//www.town.nakadomari.lg.jp/material/files/group/12/reiwa7nenndai1kainakadomarimatigikairinnjikai.pdf">
  令和7年第1回中泊町議会臨時会会議録 (PDFファイル: 190.9KB)
</a>

<h3>令和7年第1回中泊町議会定例会</h3>
<a href="//www.town.nakadomari.lg.jp/material/files/group/12/reiwa7nenndai1kainakadomarigikaiteireikai.pdf">
  令和7年第1回中泊町議会定例会会議録 (PDFファイル: 750.9KB)
</a>
<a href="//www.town.nakadomari.lg.jp/material/files/group/12/...pdf">
  予算特別委員会 (PDFファイル: XXX.XKB)
</a>
```

### PDF リンクの特徴

- href はプロトコル相対 URL（`//www.town.nakadomari.lg.jp/...`）で記述
- ファイルはすべて `/material/files/group/12/` ディレクトリに格納
- ファイル名はローマ字表記（例: `reiwa7nenndai1kainakadomarigikaiteireikai.pdf`）
- リンクテキストにファイルサイズが `(PDFファイル: XXX.XKB)` 形式で含まれる

---

## ページネーション

なし。会議録一覧ページ・年度別ページともに全データが単一ページ内に表示される。

---

## 会議種別

- **定例会**: 年4回（第1回〜第4回）
- **臨時会**: 不定期
- **特別委員会**: 予算特別委員会、決算特別委員会（定例会に付随）

---

## 掲載年度範囲

令和4年（2022年）〜 令和8年（2026年）

---

## スクレイピング方針

### Step 1: 年度別ページ URL の収集

会議録一覧ページ `index.html` から、年度別ページへのリンクをすべて収集する。

- リンクは `/gyoseijoho/gikai/kaigiroku/{ページID}.html` 形式
- `<ul>` > `<li>` > `<a>` のリスト構造からリンクを抽出
- ページネーション処理は不要

### Step 2: 各年度ページから PDF リンクの収集

年度別ページを取得し、`<h3>` 見出しと PDF リンクを収集する。

- `<h3>` タグから会議種別（定例会・臨時会）と回次を抽出
- `<a href>` から PDF の URL を収集（プロトコル相対 URL に注意）
- リンクテキストから会議録のタイトルを取得

```typescript
// h3 見出しから会議情報を抽出
const sessionPattern = /令和(\d+)年第(\d+)回中泊町議会(定例会|臨時会)/;

// PDF リンクの収集
const pdfLinks = $('a[href$=".pdf"]');
pdfLinks.each((_, el) => {
  const href = $(el).attr("href"); // "//www.town.nakadomari.lg.jp/material/files/group/12/xxx.pdf"
  const url = href?.startsWith("//") ? `https:${href}` : href;
  const text = $(el).text(); // "令和7年第1回中泊町議会定例会会議録 (PDFファイル: 750.9KB)"
});
```

### Step 3: PDF のダウンロードとテキスト抽出

1. 収集した PDF URL からファイルをダウンロード
2. pdf-parse 等でテキストを抽出
3. 会議録のメタ情報（会議名、開催日、会議種別）とともに保存

---

## 注意事項

- **プロトコル相対 URL**: PDF リンクの href が `//www.town.nakadomari.lg.jp/...` 形式のため、`https:` を先頭に付与する必要がある
- **ページ ID の不規則性**: 年度別ページの ID（`5392.html`、`5135.html` 等）に規則性がなく、URL を推測できない。必ず一覧ページからリンクを収集する
- **特別委員会の扱い**: 定例会の PDF とは別に、予算特別委員会・決算特別委員会の PDF が掲載される場合がある
- **ファイル名のローマ字表記**: PDF ファイル名がローマ字（ヘボン式ではなく訓令式寄り）で命名されており、ファイル名からのメタ情報抽出は困難。リンクテキストや `<h3>` 見出しからメタ情報を取得すること

---

## 推奨アプローチ

1. **一覧ページを起点にする**: `index.html` の 1 リクエストで全年度ページの URL を収集できる
2. **h3 見出しを活用**: 会議種別・回次の判定に `<h3>` テキストを使う
3. **PDF 一括取得**: 全ページが PDF 公開のため、パーサーの分岐は不要
4. **レート制限**: 自治体サイトのため、リクエスト間に 1〜2 秒の待機時間を設ける
5. **差分更新**: 既取得 URL のリストと比較し、新規 URL のみを取得する
