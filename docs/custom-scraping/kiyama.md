# 基山町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.kiyama.lg.jp/gikai/list01207.html
- 分類: 自治体独自 CMS（`kiji[番号]/index.html` 形式の詳細ページ + PDF リンク）
- 文字コード: UTF-8
- 特記: jQuery autopager による「もっと見る」動的読み込みあり、Google Analytics 導入

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.kiyama.lg.jp/gikai/list01207.html` |
| 年度別一覧（令和7年） | `https://www.town.kiyama.lg.jp/gikai/list02253.html` |
| 年度別一覧（令和6年） | `https://www.town.kiyama.lg.jp/gikai/list02233.html` |
| 年度別一覧（平成24年以前） | `https://www.town.kiyama.lg.jp/gikai/list01514.html` |
| 会議録詳細ページ | `https://www.town.kiyama.lg.jp/kiji[番号]/index.html` |

---

## 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和7年 | `https://www.town.kiyama.lg.jp/gikai/list02253.html` |
| 令和6年 | `https://www.town.kiyama.lg.jp/gikai/list02233.html` |
| 令和5年 | `https://www.town.kiyama.lg.jp/gikai/list01631.html` |
| 令和4年 | `https://www.town.kiyama.lg.jp/gikai/list01611.html` |
| 令和3年 | `https://www.town.kiyama.lg.jp/gikai/list01600.html` |
| 令和2年 | `https://www.town.kiyama.lg.jp/gikai/list01599.html` |
| 令和元年 | `https://www.town.kiyama.lg.jp/gikai/list01575.html` |
| 平成24年以前（平成20〜24年） | `https://www.town.kiyama.lg.jp/gikai/list01514.html` |

トップページの左側メニューから令和7年〜平成24年以前の各年度ページへリンクされている（約10年分）。

---

## 会議録の提供形式

各会議録の詳細ページ（`kiji[番号]/index.html`）に PDF リンクが掲載される形式。

**令和6年の会議構成（6件）:**

| 開催時期 | 会議種別 | kiji番号 |
| --- | --- | --- |
| 2025年3月 | 第4回定例会 | kiji0036218 |
| 2025年2月 | 第3回定例会 | kiji0035750 |
| 2024年9月 | 第2回定例会 | kiji0035597 |
| 2024年9月 | 第2回臨時会 | kiji0035646 |
| 2024年7月 | 第1回定例会 | kiji0035443 |
| 2024年4月 | 第1回臨時会 | kiji0035442 |

**kiji 番号の特徴:**
- 7桁の数字で構成（例: `kiji0036218`）
- 新しい会議録ほど番号が大きい（連番に近い）
- 最古（平成20年相当）は `kiji003102` 程度

---

## 会議種別

| 種別 | 開催頻度 |
| --- | --- |
| 定例会 | 年4回（第1〜第4回） |
| 臨時会 | 不定期（年1〜2回程度） |

---

## ページネーション

「もっと見る」ボタンによる jQuery autopager での動的読み込み。ただし1年度あたりの件数は6件程度のため、1ページに全件表示される場合がほとんど。JavaScript を無効にしても基本的なリンクは取得可能。

---

## スクレイピング戦略

### Step 1: 年度ページ URL の収集

トップページ（`/gikai/list01207.html`）の左サイドメニューから各年度ページへのリンクを抽出する。

- リンク形式: `list[番号].html`（相対パス）
- 平成20年〜現在まで各年度のページが存在

### Step 2: 年度別ページから会議録詳細ページ URL を収集

各年度ページから `kiji[番号]/index.html` 形式のリンクを抽出する。

- 1年度あたり4〜6件程度
- JavaScript による動的読み込みが実装されているが、初期表示で全件取得できる場合が多い
- 動的読み込みが必要な場合はページ送りパラメータを確認する

### Step 3: 会議録詳細ページから PDF リンクを収集

`kiji[番号]/index.html` ページ内の PDF リンクを抽出する。

- PDF URL パターンは詳細ページごとに異なる可能性があるため、`<a href="...pdf">` パターンで汎用的に抽出する

### Step 4: PDF のダウンロードと解析

- 詳細ページのタイトルや本文から会議種別・開催日を取得

---

## 注意事項

- 平成20年（2008年）から掲載あり（最古: `kiji003102` 相当）
- 年度ページの URL は `list[番号].html` 形式で、番号と年度の対応は規則的ではないため、トップページから動的に取得する
