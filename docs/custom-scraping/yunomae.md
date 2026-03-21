# 湯前町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.yunomae.lg.jp/gikai/list00557.html
- 分類: 独自 CMS による PDF 公開（専用の会議録検索システムなし）
- 文字コード: UTF-8
- 特記: 専用の会議録検索システムは使用されていない。公式サイト上で年度別に PDF ファイルとして会議録を公開している

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.town.yunomae.lg.jp/gikai/list00557.html` |
| 年度別一覧ページ | `https://www.town.yunomae.lg.jp/gikai/list{番号}.html` |
| 年度別会議録詳細ページ | `https://www.town.yunomae.lg.jp/gikai/kiji{番号}/index.html` |
| 会議録 PDF | `https://www.town.yunomae.lg.jp/gikai/kiji{番号}/{ファイル名}.pdf` |

---

## 年度別ページ一覧

会議録トップページ（`list00557.html`）から各年度のページへリンクされている。

| 年度 | URL |
| --- | --- |
| 令和8年 | `https://www.town.yunomae.lg.jp/gikai/list00985.html` |
| 令和7年 | `https://www.town.yunomae.lg.jp/gikai/list00962.html` |
| 令和6年 | `https://www.town.yunomae.lg.jp/gikai/list00911.html` |
| 令和5年 | `https://www.town.yunomae.lg.jp/gikai/list00886.html` |
| 令和4年 | `https://www.town.yunomae.lg.jp/gikai/list00855.html` |
| 令和3年 | `https://www.town.yunomae.lg.jp/gikai/list00839.html` |
| 令和2年 | `https://www.town.yunomae.lg.jp/gikai/list00832.html` |
| 平成31年/令和元年 | `https://www.town.yunomae.lg.jp/gikai/list00576.html` |

公開されている最古の年度は平成31年（令和元年）。

---

## ページ構造

### 年度別一覧ページ（`list{番号}.html`）

- 各年度ページは対応する会議録詳細ページ（`kiji{番号}/index.html`）へのリンクを 1 件掲載している
- リンクのタイトル形式: `{元号}X年湯前町議会会議録`（例: 「令和7年湯前町議会会議録」）

### 年度別会議録詳細ページ（`kiji{番号}/index.html`）

- 1 ページに当該年度の全会議録（定例会・臨時会）が列挙される
- 各会議録は PDF ファイルとして直接リンクされる
- 構造: `<ul>/<li>` のリスト形式、各セクションは「■」記号で識別

---

## 会議の種類

| 会議種別 | 特徴 |
| --- | --- |
| 定例会 | 年 4 回（3月・6月・9月・12月）、複数日にわたる |
| 臨時会 | 年に複数回、1日開催が多い |

令和6年の例: 定例会 4 回 + 臨時会 5 回 = 計 9 会議

---

## PDF ファイルのURLパターン

```
https://www.town.yunomae.lg.jp/gikai/kiji{kiji番号}/{ファイル名}.pdf
```

ファイル名の命名規則: `3_{kiji番号下4桁}[_{連番}]_up_{ランダム文字列}.pdf`

例:
- `3_4429_up_lhegyoei.pdf`
- `3_4429_7547_up_81ajmzjx.pdf`
- `3_4967_7551_up_a1e1iqiy.pdf`

ファイル名は固定ではなくランダム文字列を含むため、PDF の URL は各詳細ページから動的に取得する必要がある。

---

## スクレイピング戦略

### Step 1: 年度別一覧ページから kiji URL を収集

会議録トップページ `list00557.html` から各年度の `list{番号}.html` リンクを抽出し、各年度ページに遷移して `kiji{番号}/index.html` の URL を収集する。

**収集方法:**

1. `https://www.town.yunomae.lg.jp/gikai/list00557.html` を取得
2. `//www.town.yunomae.lg.jp/gikai/list\d+\.html` にマッチするリンクを抽出（年度別ページ）
3. 各年度ページから `kiji\d+/index\.html` へのリンクを抽出

### Step 2: 各年度会議録詳細ページから PDF URL を収集

`kiji{番号}/index.html` ページを取得し、`<li>` 要素内の `.pdf` リンクを全て抽出する。

**収集方法:**

1. 各詳細ページを取得
2. Cheerio 等で `a[href$=".pdf"]` セレクタを使用して PDF リンクを抽出
3. セクション名（「■」で始まるテキスト）を取得して会議種別・回次を特定

### Step 3: PDF のダウンロードとテキスト抽出

取得した PDF URL から直接 PDF をダウンロードし、テキストを抽出する。

**メタ情報の抽出:**

- 年度・会議種別: 詳細ページの「■」セクション名から取得（例: 「■令和7年第3回定例会（3月6日～3月14日）」）
- 開催日: セクション名に含まれる日付から抽出

---

## 注意事項

- ページネーションは存在しない（各年度の全会議録が 1 ページに掲載）
- PDF ファイル名にはランダム文字列が含まれるため、URLの推測は不可。必ず詳細ページを経由して取得する
- JavaScript の autopager 機能が実装されているが、年度リスト（8 件）は初期表示で全て確認可能
- 平成31年以前の会議録は公開されていない
- PDF ファイルサイズは数十 KB〜数 MB と幅がある（定例会は大きく、臨時会は小さい傾向）

---

## 推奨アプローチ

1. **トップページから年度リストを取得**: `list00557.html` から全年度の `list{番号}.html` URL を抽出
2. **各年度ページから kiji URL を取得**: 各年度ページを順にクロールして詳細ページの URL を収集
3. **詳細ページから PDF URL を抽出**: `kiji{番号}/index.html` から `.pdf` リンクを全て取得
4. **PDF をダウンロードしてテキスト抽出**: 各 PDF をダウンロードし、会議録テキストを抽出
5. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
