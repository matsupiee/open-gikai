# 砥部町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/
- 分類: 専用検索システムなし。公式ホームページ上で年度別ページに定例会・臨時会ごとの会議録 PDF を直接掲載
- 文字コード: UTF-8
- 特記: 会議録と会議結果の 2 種類の PDF を各会議ごとに提供。ページネーションなし

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 年度一覧（インデックス） | `https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/` |
| 年度別会議録ページ | `https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/{ページID}.html` |
| 会議録 PDF | `https://www.town.tobe.ehime.jp/material/files/group/17/{番号}.pdf` |

### 年度別ページ ID 一覧

| 年度 | ページ ID |
| --- | --- |
| 令和8年 | 5259 |
| 令和7年 | 4550 |
| 令和6年 | 3677 |
| 令和5年 | 455 |
| 令和4年 | 609 |
| 令和3年 | 1018 |
| 令和2年 | 1039 |
| 平成31年（令和元年） | 1079 |
| 平成30年 | 1128 |
| 平成29年 | 1114 |
| 平成28年 | 1166 |
| 平成27年 | 1167 |
| 平成26年 | 1165 |
| 平成25年 | 1191 |
| 平成24年 | 1190 |
| 平成23年 | 1189 |
| 平成22年 | 1188 |
| 平成21年 | 1276 |
| 平成20年 | 1272 |
| 平成19年 | 1275 |
| 平成18年 | 1274 |
| 平成17年 | 1273 |

---

## HTML 構造

### 年度別ページの構造

各年度ページは、会議を新しい順（第 N 回定例会 → 第 N 回臨時会の降順）に列挙する。

```html
<!-- 会議セクション例 -->
<h2>令和6年定例会・臨時会</h2>

<h3>第4回定例会（12月5日から12月13日まで）</h3>
<p><a href="//www.town.tobe.ehime.jp/material/files/group/17/116.pdf">第4回定例会会議録 (PDFファイル: 880.6KB)</a></p>
<p><a href="//www.town.tobe.ehime.jp/material/files/group/17/117.pdf">第4回定例会会議結果 (PDFファイル: 254.5KB)</a></p>

<h3>第3回定例会（9月5日から9月13日まで）</h3>
<p><a href="//www.town.tobe.ehime.jp/material/files/group/17/105.pdf">第3回定例会会議録 (PDFファイル: ...)</a></p>
<p><a href="//www.town.tobe.ehime.jp/material/files/group/17/107.pdf">第3回定例会会議結果 (PDFファイル: ...)</a></p>
```

### PDF リンクの識別

アンカーテキストで「会議録」と「会議結果」を区別できる。

| アンカーテキストパターン | 種別 |
| --- | --- |
| `{会議名}会議録 (PDFファイル: {サイズ})` | 会議録（本文） |
| `{会議名}会議結果 (PDFファイル: {サイズ})` | 会議結果（議決一覧等） |

PDF の URL は `//www.town.tobe.ehime.jp/material/files/group/17/{番号}.pdf` の形式で、番号は連番だが年度・会議との対応関係は規則的ではない（ページ内リンクから取得する）。

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

インデックスページ（`/teireikai/`）から年度別ページへのリンクを抽出する。

- `<a>` タグのテキストが「令和〇年定例会・臨時会」「平成〇〇年定例会・臨時会」に一致するものを取得
- 各リンクの `href` から年度別ページ ID を取得

**収集方法:**

```typescript
// インデックスページからリンク抽出
const indexUrl = "https://www.town.tobe.ehime.jp/soshikikarasagasu/gikaijimukyoku/teireikai/";
// aタグのhrefが /teireikai/{数字}.html にマッチするものを抽出
const yearPagePattern = /\/teireikai\/(\d+)\.html/;
```

### Step 2: 各年度ページから PDF リンクを収集

年度別ページ（`/teireikai/{ページID}.html`）を取得し、全 PDF リンクを抽出する。

- h3 見出し（会議名と開催期間）と直後の `<p><a>` リンクを対応付けて取得
- 会議名から定例会・臨時会・回次を抽出
- アンカーテキストに「会議録」が含まれるリンクのみを会議録 PDF として収集

**メタ情報の抽出:**

```typescript
// 会議名パターン
const sessionPattern = /第(\d+)回(定例会|臨時会)/;
// 例: "第4回定例会（12月5日から12月13日まで）" → { round: 4, type: "定例会" }

// 開催期間パターン
const periodPattern = /（(\d+)月(\d+)日(?:から(\d+)月(\d+)日まで)?）/;
```

### Step 3: 会議録 PDF のダウンロード

PDF URL は `//www.town.tobe.ehime.jp/material/files/group/17/{番号}.pdf` 形式のプロトコル相対 URL のため、スキームを補完して `https:` に変換する。

---

## 注意事項

- PDF URL はプロトコル相対（`//` で始まる）なので `https:` を補完すること
- 年度別ページ ID は連番ではなく不規則なため、必ずインデックスページからリンクを取得すること
- 各年度ページにページネーションはなく、1 ページに年度内の全会議が掲載される
- 平成17年（2005年）まで会議録 PDF が提供されており、全年度で同一の HTML 構造が使われている
- 会議録 PDF は本文テキストを含む（OCR 済み or テキスト PDF）ため、テキスト抽出が必要

---

## 推奨アプローチ

1. **インデックスページからページ ID を動的取得**: ページ ID は不規則なため、ハードコードせずインデックスページから毎回収集する
2. **アンカーテキストで種別を判定**: 「会議録」と「会議結果」はテキストで明確に区別されるため、正規表現でフィルタリングする
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 取得済み PDF URL をキャッシュし、未取得のもののみダウンロードする
