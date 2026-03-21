# 南越前町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.minamiechizen.lg.jp/tyougikai/kaigiroku/index.html
- 分類: 独自 CMS による PDF 公開（標準的な会議録検索システムは不使用）
- 文字コード: UTF-8
- 特記: 会議録は年度別ページで一覧化され、各会議録は HTML 中間ページ経由で単一 PDF として提供される

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.town.minamiechizen.lg.jp/tyougikai/kaigiroku/index.html` |
| 年度別一覧 | `https://www.town.minamiechizen.lg.jp/tyougikai/kaigiroku/{年度コード}/index.html` |
| 会議録詳細（HTML 中間ページ） | `https://www.town.minamiechizen.lg.jp/tyougikai/kaigiroku/{年度コード}/p{ID}.html` |
| 会議録 PDF | `https://www.town.minamiechizen.lg.jp/tyougikai/kaigiroku/{年度コード}/p{ID}_d/fil/gikai1.pdf` |

### 年度コード一覧

| 年度コード | 対象年度 |
| --- | --- |
| `r7` | 令和7年度（2025年度） |
| `r6` | 令和6年度（2024年度） |
| `r5` | 令和5年度（2023年度） |
| `r4` | 令和4年度（2022年度） |
| `r3` | 令和3年度（2021年度） |
| `r2` | 令和2年度（2020年度） |
| `r1` | 令和元年度（2019年度） |
| `h30` | 平成30年度（2018年度） |

---

## 会議種別

- 定例会（3月・6月・9月・12月に開催）
- 臨時会（随時開催、年に複数回）

---

## 年度・会期構造

年度別インデックスページに会議録リンクが列挙されている。ページネーションはなく、1ページに全件表示される。

### 令和7年度の例（r7/index.html）

| 会議名 | リンク |
| --- | --- |
| 令和8年1月臨時会 | `/tyougikai/kaigiroku/r7/p011315.html` |
| 令和7年12月定例会 | `/tyougikai/kaigiroku/r7/p011284.html` |
| 令和7年9月定例会 | `/tyougikai/kaigiroku/r7/p011193.html` |
| 令和7年7月臨時会 | `/tyougikai/kaigiroku/r7/p011130.html` |
| 令和7年6月定例会 | `/tyougikai/kaigiroku/r7/p011123.html` |
| 令和7年5月臨時会 | `/tyougikai/kaigiroku/r7/p011068.html` |

### 令和6年度の例（r6/index.html）

| 会議名 | リンク |
| --- | --- |
| 令和7年3月定例会 | `/tyougikai/kaigiroku/r6/p011003.html` |
| 令和6年12月定例会 | `/tyougikai/kaigiroku/r6/p010808.html` |
| 令和6年11月臨時会 | `/tyougikai/kaigiroku/r6/p010751.html` |
| 令和6年10月臨時会 | `/tyougikai/kaigiroku/r6/p010732.html` |
| 令和6年9月定例会 | `/tyougikai/kaigiroku/r6/p010702.html` |
| 令和6年7月臨時会 | `/tyougikai/kaigiroku/r6/p010639.html` |
| 令和6年6月定例会 | `/tyougikai/kaigiroku/r6/p010611.html` |
| 令和6年5月臨時会 | `/tyougikai/kaigiroku/r6/p010607.html` |
| 令和6年4月臨時会 | `/tyougikai/kaigiroku/r6/p010545.html` |

---

## PDF の構成

各会議録は **単一の PDF ファイル（`gikai1.pdf`）** として提供される。定例会・臨時会ともに日程ごとの分割はなく、会期全体が1ファイルにまとめられている。

HTML 中間ページは PDF への自動リダイレクト機能を持ち、PDF リンクの URL パターンは以下の通り：

```
https://www.town.minamiechizen.lg.jp/tyougikai/kaigiroku/{年度コード}/p{ID}_d/fil/gikai1.pdf
```

---

## スクレイピング戦略

### Step 1: 年度別インデックスページから会議録リンクを収集

全年度コード（`h30`, `r1`, `r2`, `r3`, `r4`, `r5`, `r6`, `r7`）に対して年度別一覧ページを取得し、各会議録 HTML ページへのリンク（`p{ID}.html`）を収集する。

- ページネーションなし、1ページに全件表示
- リンクテキストから会議名（定例会/臨時会）と開催年月を抽出可能

**収集方法:**

1. 各年度コードで `/{年度コード}/index.html` を取得
2. `<a href="p{ID}.html">` パターンのリンクを Cheerio で抽出
3. リンクテキスト（例: `令和6年12月定例会　会議録`）から会議名・年月を正規表現でパース

### Step 2: PDF URL の構築

HTML 中間ページを取得せず、URL パターンから直接 PDF URL を構築できる：

```
p{ID}.html → p{ID}_d/fil/gikai1.pdf
```

ただし、将来的に複数 PDF が存在するケースに備え、HTML 中間ページから `<a href="...pdf">` を抽出する方法も安全。

### Step 3: PDF のダウンロードとテキスト抽出

- PDF をダウンロードして `pdfjs-dist` 等でテキスト抽出
- 会議録本文から発言者・発言内容を構造化

---

## メタ情報の抽出

年度別一覧ページのリンクテキストから以下を抽出できる：

```
令和6年12月定例会　会議録
令和6年11月臨時会　会議録
```

#### パース用正規表現（案）

```typescript
// 会議名から年・月・会議種別を抽出
const titlePattern = /^(令和|平成)(\d+)年(\d+)月(定例会|臨時会)\s*会議録$/;
// 例: "令和6年12月定例会　会議録"
// → era="令和", eraYear=6, month=12, sessionType="定例会"

// 開催日の抽出（PDF 本文中）
const datePattern = /(?:令和|平成)(\d+)年(\d+)月(\d+)日/;
```

---

## 注意事項

- HTML 中間ページは PDF への自動リダイレクトを含むため、PDFリンクは直接 URL パターンから構築するほうが効率的
- 年度コードは日本の年度区切り（4月始まり）に従う。例えば `r6` には令和6年4月〜令和7年3月の会議録が含まれる
- ID（`p{ID}`）は連番ではなくサイト全体での通し番号のため、欠番が存在しうる
- 公開されている最古の年度は平成30年度（2018年度）

---

## 推奨アプローチ

1. **年度別インデックスを順に取得**: `h30` から最新年度まで順に一覧ページをクロール
2. **PDF URL を直接構築**: `p{ID}_d/fil/gikai1.pdf` のパターンで HTML 中間ページへのアクセスを省略
3. **リンクテキストからメタ情報を取得**: 会議名・開催年月は一覧ページのリンクテキストから取得できるため、PDF 本文のパースを最小化できる
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: 年度別インデックスを定期取得し、既取得の ID リストと比較して新規分のみダウンロード
