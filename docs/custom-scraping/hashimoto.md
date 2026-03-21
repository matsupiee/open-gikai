# 橋本市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/index.html
- 自治体コード: 302031
- 分類: 年度別 PDF 公開（専用検索システムなし）
- 文字コード: UTF-8
- 特記: SMART CMS ベース。年度フォルダ構造でページが整理されており、各会議ページに PDF が直接リンクされている

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/index.html` |
| 年度別一覧 | `https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/{年度フォルダ}/index.html` |
| 会議詳細 | `https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/{年度フォルダ}/{ID}.html` |
| PDF ファイル | `https://www.city.hashimoto.lg.jp/material/files/group/27/{ファイル名}.pdf` |
| バックナンバー | `https://www.city.hashimoto.lg.jp/shigikai/kaigiannai/kaigiroku/back_number/index.html` |

---

## 年度フォルダ一覧

| 年度 | フォルダ名 |
| --- | --- |
| 令和8年 | `R7kaigiroku_1` |
| 令和7年 | `R7kaigiroku` |
| 令和6年 | `R6kaigiroku` |
| 令和5年 | `R5kaigiroku` |
| 令和4年 | `R4kaigiroku` |
| 令和3年 | `R3kaigiroku` |
| 令和2年 | `R2` |
| 令和元年（平成31年） | `h31` |
| 平成30年 | `h30` |
| 平成29年 | `H29` |
| 平成28年 | `H28` |
| 平成27年 | `H27` |
| 平成26年 | `H26` |
| 平成25年 | `h25` |
| 平成24年 | `h24` |
| 平成23年 | `h23` |
| 平成22年以前 | バックナンバーページを参照 |

※ バックナンバーページでは平成18年（2006年）まで遡れることを確認済み。

---

## 会議種別

- 定例会（3月、6月、9月、12月）
- 臨時会（不定期）

---

## PDF ファイル命名規則

ファイルは `material/files/group/27/` 配下に格納されており、ファイル名は日付と会議種別を組み合わせた日本語ローマ字混在形式。

例:
- `20250206mokuji.pdf` → 2025年2月6日 目次
- `202502062gaturinnjikai.pdf` → 2025年2月 臨時会

各会議ページには「目次 PDF」と「会議録 PDF」が別々に掲載される場合がある。

---

## スクレイピング戦略

### Step 1: 年度別一覧ページの取得

トップページ (`index.html`) から各年度フォルダへのリンクを収集する。

- 各年度フォルダの `index.html` に定例会・臨時会ごとの会議リンクが掲載される
- バックナンバーページ (`back_number/index.html`) も別途クロールする

### Step 2: 会議詳細ページの取得

各年度の `index.html` から会議詳細ページ（ID 番号付き）へのリンクを抽出する。

令和7年の例:
- 2月臨時会: `/R7kaigiroku/20430.html`
- 3月定例会: `/R7kaigiroku/20632.html`
- 6月定例会: `/R7kaigiroku/20431.html`
- 9月定例会: `/R7kaigiroku/20432.html`
- 12月定例会: `/R7kaigiroku/20433.html`

### Step 3: PDF リンクの抽出

各会議詳細ページから `material/files/group/27/*.pdf` へのリンクを抽出する。

1 会議ページに複数 PDF が掲載されることがある（目次・本文で分割）。

---

## 注意事項

- 年度フォルダ名は大文字・小文字が混在しており統一されていない（`R6kaigiroku` と `h31` など）
- バックナンバーページでは URL パターンが異なる（タイムスタンプ型: `1359697078064.html`、年月型: `kaigiroku201009.html`）
- テキスト検索システムは存在しないため、全 PDF のダウンロードが必要
- PDF は会議の日付・内容を日本語で命名しているが、命名規則は一貫していない

---

## 推奨アプローチ

1. **年度フォルダを固定リストで管理**: フォルダ名の命名規則が不規則なため、既知のフォルダ名リストをコードで保持する
2. **レート制限**: リクエスト間に 1〜2 秒の待機時間を設ける
3. **PDF 全件ダウンロード**: 検索システムがないため、全 PDF をダウンロードしてテキスト抽出を行う
4. **バックナンバー対応**: 別途バックナンバーページをクロールし、異なる URL パターンにも対応する
