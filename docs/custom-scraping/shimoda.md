# 下田市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.shimoda.shizuoka.jp/category/090100kaigiroku/index.html
- 分類: PDF リンク集方式（専用の会議録検索システムなし）
- 文字コード: UTF-8
- 特記: 専用の会議録検索システムは導入されていない。各定例会・臨時会の会議録を PDF 形式で公開しており、一覧ページから個別の会期ページへリンクし、そこから PDF を直接ダウンロードする形式。検索機能はない。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（令和元年度以降） | `https://www.city.shimoda.shizuoka.jp/category/090100kaigiroku/index.html` |
| 会議録一覧（平成31年度以前） | `https://www.city.shimoda.shizuoka.jp/category/h28_kaigiroku/index.html` |
| 個別会期ページ | `https://www.city.shimoda.shizuoka.jp/category/090100kaigiroku/{ID}.html` |
| 個別会期ページ（旧） | `https://www.city.shimoda.shizuoka.jp/category/h28_kaigiroku/{ID}.html` |
| PDF ファイル | `https://www.city.shimoda.shizuoka.jp/file/{ファイル名}.pdf` |

### 個別会期ページの ID 例

| ID | 会期 |
| --- | --- |
| `158774` | 令和8年1月臨時会 |
| `158773` | 令和7年12月定例会 |
| `157640` | 令和6年12月定例会 |
| `157395` | 令和6年9月定例会 |

ID は数値だが連番ではなく、会期ごとにランダムに割り振られている。

---

## コンテンツ構造

### 一覧ページ

- 令和元年度以降は `090100kaigiroku` カテゴリ、平成31年度以前は `h28_kaigiroku` カテゴリで管理される
- 各会期（定例会・臨時会）へのリンクが時系列で一覧表示される
- ページネーションなし（全件が単一ページに掲載）
- 対応年度: 平成16年度（2004年）〜現在

### 個別会期ページ

1会期ページに複数日程（第1日・第2日・第3日...）が含まれ、日程ごとに以下の PDF がリンクされる:

| PDF の種類 | ファイル名パターン |
| --- | --- |
| 議決案件名簿 | `{年度}.{月}議決案件名簿.pdf` |
| 会期日程 | `{年度}.{月}会期日程{連番}.pdf` |
| 議事日程 | `議事日程（{YYMMDD}）.pdf` |
| 会議録本文 | `会議録本文（{YYMMDD}）.pdf` |
| 出席者一覧 | `出席者一覧表（{YYMMDD}）.pdf` |

スクレイピング対象として最も重要なのは**会議録本文 PDF**。

### PDF URL 例（令和6年12月定例会）

```
https://www.city.shimoda.shizuoka.jp/file/会議録本文（061205）.pdf
https://www.city.shimoda.shizuoka.jp/file/会議録本文（061206）.pdf
https://www.city.shimoda.shizuoka.jp/file/会議録本文（061209）.pdf
https://www.city.shimoda.shizuoka.jp/file/会議録本文（061213）.pdf
```

ファイル名の括弧内は `YYMMDD` 形式（例: `061205` = 令和6年12月5日）。

---

## スクレイピング戦略

### Step 1: 会期ページ URL の収集

一覧ページを 2 つ取得し、個別会期ページへのリンクを抽出する。

1. `https://www.city.shimoda.shizuoka.jp/category/090100kaigiroku/index.html`（令和元年度以降）
2. `https://www.city.shimoda.shizuoka.jp/category/h28_kaigiroku/index.html`（平成31年度以前）

各ページから `category/090100kaigiroku/{ID}.html` および `category/h28_kaigiroku/{ID}.html` 形式のリンクを Cheerio で抽出する。

### Step 2: 個別会期ページから PDF リンクを収集

各会期ページにアクセスし、会議録本文 PDF へのリンクを抽出する。

- `/file/` で始まるリンクのうち、リンクテキストに「会議録本文」を含むものを対象とする
- 相対パスの場合は `https://www.city.shimoda.shizuoka.jp` を補完して絶対 URL に変換する

### Step 3: PDF のダウンロードとテキスト抽出

取得した会議録本文 PDF を順次ダウンロードしてテキストを抽出する。

---

## 注意事項

- PDF ファイル名に日本語や括弧が含まれる場合があるため、URL エンコードが必要
- ファイル名末尾に全角スペースが混入している例が確認されている（例: `出席者一覧表（061206）　.pdf`）
- 各 PDF のサイズは 44KB〜528KB 程度（会議の長さによって差がある）
- 平成31年度以前と令和元年度以降でカテゴリパスが異なるため、両方の一覧ページを取得する必要がある
- 検索機能がないため差分更新は難しく、既存の取得済み URL リストとの突き合わせで重複ダウンロードを防ぐ

---

## 推奨アプローチ

1. **2つの一覧ページをクロール**: 令和元年度以降・平成31年度以前の一覧ページから会期ページ URL を全量収集する
2. **会議録本文のみを対象とする**: 議事日程・出席者一覧は収集対象外とし、「会議録本文」リンクに絞る
3. **URL ベースの重複排除**: 取得済み PDF URL を管理し、再ダウンロードを防ぐ
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **URL エンコード**: 日本語ファイル名を含む PDF URL は `encodeURI` 等で適切にエンコードする
