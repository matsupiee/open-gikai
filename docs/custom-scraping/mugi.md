# 牟岐町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.tokushima-mugi.lg.jp/soshiki/mugi/gikaijimukyoku/
- 分類: 独自 CMS による PDF 公開（討議net SSP・DB-Search 等の専用会議録検索システムは未導入）
- 文字コード: UTF-8
- 特記: 本会議の一般質問・答弁および町長議案説明を議員ごとに個別 PDF で公開する方式。会議録テキストの HTML 公開はなく、PDF のみ。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会事務局トップ | `https://www.town.tokushima-mugi.lg.jp/soshiki/mugi/gikaijimukyoku/` |
| 新着情報一覧（ページ 1） | `https://www.town.tokushima-mugi.lg.jp/soshiki/mugi/gikaijimukyoku/more.html` |
| 新着情報一覧（ページ N） | `https://www.town.tokushima-mugi.lg.jp/soshiki/mugi/gikaijimukyoku/more.pN.html` |
| 議会定例会・臨時会カテゴリ | `https://www.town.tokushima-mugi.lg.jp/category/gikai/teirei/` |
| 定例会・臨時会一覧（ページ 1） | `https://www.town.tokushima-mugi.lg.jp/category/gikai/teirei/more@docs_1.html` |
| 定例会・臨時会一覧（ページ N） | `https://www.town.tokushima-mugi.lg.jp/category/gikai/teirei/more@docs_1.pN.html` |
| 各会議の詳細ページ | `https://www.town.tokushima-mugi.lg.jp/doc/{記事ID}/` |
| 会議録 PDF | `https://www.town.tokushima-mugi.lg.jp/doc/{記事ID}/file_contents/{ファイル名}.pdf` |

---

## 一覧ページの構造

### ページネーション

新着情報一覧・定例会カテゴリともに複数ページ構成。

- 新着情報一覧: 4 ページ（令和 8 年〜平成 22 年、計 60 件程度）
- 定例会カテゴリ一覧: 4 ページ

ページ URL パターン:
```
more.html       → 1 ページ目
more.p2.html    → 2 ページ目
more.p3.html    → 3 ページ目
more.p4.html    → 4 ページ目
```

### 収録年度

- 最古: 平成 22 年（2010 年）
- 最新: 令和 8 年（2026 年）現在も更新中

### 一覧でのリンク形式

各エントリは会議名（例：「令和７年　第４回牟岐町議会定例会」）をテキストとして `/doc/{記事ID}/` にリンクする形式。日付・会議種別はテキストから判定する。

---

## 各会議詳細ページの構造

### メタ情報

ページ本文（プレーンテキスト形式）に以下が記載される:

```
令和７年１２月９日（火）開会：９時３０分　散会：１１時２０分
```

- 開催日: 全角数字で `令和X年XX月XX日（曜日）` 形式
- 会議名: ページタイトルおよびパンくずリストから取得（例：「令和７年第４回牟岐町議会定例会」）

### 議員出欠テーブル

`<table>` タグで記述。列構成: 議席番号 / 氏名 / 出欠。

```html
<table>
  <tr><th>議席</th><th>氏名</th><th>出欠</th></tr>
  <tr><td>１番</td><td>喜田　俊司</td><td>出席</td></tr>
  ...
</table>
```

議員数: 8 名（現在）。

### 議事日程テーブル

`<table>` タグで記述。列構成: 日程番号 / 案件名。

### PDF リンクの配置

メインコンテンツ内に `<a href="file_contents/...">` 形式で PDF へのリンクが列挙される。

---

## PDF ファイルの命名規則

PDF ファイル名には 2 種類のパターンが確認されている。

### パターン A（新形式・令和 5 年以降）

```
file_contents/00.pdf    → 町長議案説明
file_contents/01.pdf    → 一般質問（議員 1 人目）
file_contents/02.pdf    → 一般質問（議員 2 人目）
file_contents/03.pdf    → 一般質問（議員 3 人目）
file_contents/04.pdf    → 一般質問（議員 4 人目）
```

例（令和 7 年第 4 回定例会）:
```
https://www.town.tokushima-mugi.lg.jp/doc/2026011400026/file_contents/00.pdf
https://www.town.tokushima-mugi.lg.jp/doc/2026011400026/file_contents/01.pdf
```

### パターン B（旧形式・平成 30 年以前）

```
file_contents/{記事ID}_docs_{別ID}_file_contents_{議員名ローマ字}.pdf
```

例（平成 30 年第 1 回定例会）:
```
https://www.town.tokushima-mugi.lg.jp/doc/2018050100029/file_contents/2018050100029_docs_2018042600018_file_contents_horiuchi.pdf
https://www.town.tokushima-mugi.lg.jp/doc/2018050100029/file_contents/2018050100029_docs_2018042600018_file_contents_fujimoto.pdf
```

ファイル名に議員の姓がローマ字で含まれる。

---

## スクレイピング戦略

### Step 1: 会議一覧の収集

定例会カテゴリ一覧ページをページネーションに従ってクロールし、各会議詳細ページの URL（`/doc/{記事ID}/`）を収集する。

**クロール先:**
- `https://www.town.tokushima-mugi.lg.jp/category/gikai/teirei/more@docs_1.html`
- `https://www.town.tokushima-mugi.lg.jp/category/gikai/teirei/more@docs_1.p2.html`
- `https://www.town.tokushima-mugi.lg.jp/category/gikai/teirei/more@docs_1.p3.html`
- `https://www.town.tokushima-mugi.lg.jp/category/gikai/teirei/more@docs_1.p4.html`

各ページ内の `<a href="/doc/.../">` リンクを Cheerio で抽出する。

### Step 2: 各会議詳細ページの取得

詳細ページから以下を抽出する:

1. 会議名・開催日（ページタイトルおよび本文テキストから）
2. `file_contents/` 配下の PDF リンク一覧

**PDF リンクの抽出:**

```typescript
// Cheerio を使った抽出例
const pdfLinks = $('a[href*="file_contents/"]')
  .map((_, el) => $(el).attr('href'))
  .get()
  .filter(href => href?.endsWith('.pdf'));
```

### Step 3: PDF の取得とテキスト抽出

各 PDF を取得し、テキスト抽出ライブラリ（`pdf-parse` 等）でテキストを抽出する。

**注意点:**
- PDF は議員ごとに個別ファイル（一般質問 + 答弁）で分割されている
- `00.pdf` は町長議案説明のため、会議録本文としての優先度は低い
- `01.pdf` 以降が一般質問・答弁の本体

### Step 4: PDF テキストのパース

PDF テキストから発言者・発言内容を抽出する。ただし PDF の構造はサイト内で統一されておらず、テキストレイアウトが可変のため、以下の点に注意する。

**発言者パターン（推定）:**

会議録 PDF の具体的な内部形式は未確認のため、実装時に実際の PDF を確認の上パターンを策定する。徳島県内の他自治体の例を参考に、以下のような形式が想定される:

```
○議長（氏名）
○X番（氏名）
○町長（氏名）
```

---

## 注意事項

- PDF 内のテキスト構造は実装時に実際の PDF を精査して確定する必要がある
- 旧形式（パターン B）ではファイル名の予測が困難なため、詳細ページの HTML から PDF リンクを動的に取得する方式が確実
- 会議の種類（定例会・臨時会）はリンクテキストおよびページタイトルから判定可能
- リクエスト間には 1〜2 秒の待機時間を設ける
- 最古記録は平成 22 年（2010 年）で、全期間で 60 件程度の会議エントリが存在する

---

## 推奨アプローチ

1. **一覧ページから全 doc ID を収集**: カテゴリ一覧の全ページをクロールして会議一覧を構築する
2. **詳細ページから PDF リンクを動的取得**: ファイル名パターンに依存せず、HTML から `file_contents/*.pdf` リンクを抽出する
3. **PDF テキスト抽出**: `pdf-parse` 等でテキスト化し、発言ブロックに分割する
4. **差分更新**: 記事 ID はタイムスタンプベースのため、前回取得済みの最新 ID を記録し、新規分のみ取得する差分更新が可能
