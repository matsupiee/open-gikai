# 大館市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku
- 分類: 公式サイト内で PDF 形式で公開（専用の検索システムなし）
- 文字コード: UTF-8
- 特記: 会議録は各定例会・臨時会ごとに PDF ファイルとして公開されている。HTML テキスト版は存在しない。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（最新年度） | `https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku` |
| 過去年度ページ（令和） | `https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku/p{ページID}` |
| 過去年度ページ（平成） | `https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku/h{年}` |
| 平成31年・令和元年 | `https://www.city.odate.lg.jp/city/handbook/handbook13/page56/kaigiroku/r1` |
| PDF ファイル | `https://www.city.odate.lg.jp/uploads/public/pages_{ページID}_00/{ファイル名}.pdf` |

### 年度別ページ URL 一覧

| 年度 | URL |
| --- | --- |
| 令和7年（最新） | `/city/handbook/handbook13/page56/kaigiroku` |
| 令和6年 | `/city/handbook/handbook13/page56/kaigiroku/p12038` |
| 令和5年 | `/city/handbook/handbook13/page56/kaigiroku/p11169` |
| 令和4年 | `/city/handbook/handbook13/page56/kaigiroku/p10337` |
| 令和3年 | `/city/handbook/handbook13/page56/kaigiroku/p9547` |
| 令和2年 | `/city/handbook/handbook13/page56/kaigiroku/p8960` |
| 平成31年・令和元年 | `/city/handbook/handbook13/page56/kaigiroku/r1` |
| 平成30年 | `/city/handbook/handbook13/page56/kaigiroku/h30` |
| 平成29年 | `/city/handbook/handbook13/page56/kaigiroku/h29` |
| 平成28年 | `/city/handbook/handbook13/page56/kaigiroku/h28` |
| 平成27年 | `/city/handbook/handbook13/page56/kaigiroku/h27` |
| 平成26年 | `/city/handbook/handbook13/page56/kaigiroku/h26` |
| 平成25年 | `/city/handbook/handbook13/page56/kaigiroku/h25` |
| 平成24年 | `/city/handbook/handbook13/page56/kaigiroku/h24` |
| 平成23年 | `/city/handbook/handbook13/page56/kaigiroku/h23` |
| 平成22年 | `/city/handbook/handbook13/page56/kaigiroku/h22` |
| 平成21年 | `/city/handbook/handbook13/page56/kaigiroku/h21` |
| 平成20年 | `/city/handbook/handbook13/page56/kaigiroku/h20` |
| 平成19年 | `/city/handbook/handbook13/page56/kaigiroku/h19` |
| 平成18年 | `/city/handbook/handbook13/page56/kaigiroku/h18` |

---

## PDF ファイル命名規則

PDF ファイル名は年代によって異なる命名規則が使われている。

### 令和7年（最新年度）

```
R07年{月}月定例会{日}日目.pdf
```

例:
- `R07年03月定例会01日目.pdf`
- `R07年06月定例会04日目(2).pdf`（修正版は括弧付き連番）
- `令和07年第１回臨時会.pdf`（臨時会は別形式）

### 令和6年

```
令和06年{月}月定例会{日}日目.pdf
令和06年度{月}月定例会{日}日目.pdf
```

例:
- `令和06年03月定例会01日目.pdf`
- `令和06年度09月定例会01日目.pdf`（「年度」が入る場合あり）
- `令和06年03月定例会04日目(修).pdf`（修正版）

### 平成30年

```
{通し番号}_{年月}.no{日}.pdf
{通し番号}_{年月}kaigiroku{日}.pdf
```

例:
- `001_3003.no1.pdf`（3月定例会1日目）
- `009_3009kaigiroku01.pdf`（9月定例会1日目）

### 平成18年

```
{通し番号}_{年}.{月}no{日}.pdf
{通し番号}_{年}.rinji{回}.pdf
```

例:
- `001_18.03no1.pdf`（3月定例会1日目）
- `007_18.rinji2.pdf`（第2回臨時会）

---

## PDF 格納ディレクトリ

各年度ページのページ ID に対応するディレクトリに PDF が格納されている。

```
/uploads/public/pages_{ページID（10桁ゼロ埋め）}_00/
```

| 年度 | ディレクトリ |
| --- | --- |
| 令和7年（トップ） | `/uploads/public/pages_0000000775_00/` |
| 令和6年 | `/uploads/public/pages_0000012038_00/` |
| 平成30年 | `/uploads/public/pages_0000000777_00/` |
| 平成18年 | `/uploads/public/pages_0000000789_00/` |

---

## 会議の種別

- **定例会**: 年4回（3月、6月、9月、12月）
- **臨時会**: 不定期（年によって開催回数が異なる）

各定例会は複数日（通常4〜6日間）にわたり、日ごとに1つの PDF が作成される。

---

## スクレイピング戦略

### Step 1: 年度別ページの巡回と PDF リンクの収集

1. トップページ（令和7年）および過去年度ページ（上記 URL 一覧）を順に取得
2. 各ページの HTML から PDF へのリンク（`<a href="...pdf">` ）を Cheerio で抽出
3. リンクテキストから会議名・開催日のメタ情報を併せて取得

**HTML 構造:**

各年度ページは定義リスト形式（`<dt>`/`<dd>`）で構成されており、PDF リンクは `<a>` タグとして配置されている。

### Step 2: PDF のダウンロード

収集した PDF の URL リストに基づき、全 PDF をダウンロードする。

- ファイルサイズは 300KB〜1.5MB 程度
- 平成18年〜令和7年で推定 300〜400 件の PDF

### Step 3: PDF からテキスト抽出

PDF からテキストを抽出し、会議録データとしてパースする。

- `pdf-parse` や `pdfjs-dist` 等のライブラリを使用
- PDF は本会議の会議録（議事録形式）で、発言者と発言内容が記載されている

### Step 4: 会議録のパース

#### メタ情報

PDF のファイル名およびリンクテキストから以下を抽出:

- 開催年月: ファイル名の年月部分から取得
- 会議種別: 「定例会」「臨時会」
- 開催日目: 「01日目」等

#### 発言の構造（PDF テキストから抽出）

PDF 内のテキストは議事録形式で、発言者名と発言内容が記載されている。具体的なフォーマットは PDF の内容に依存するため、サンプル PDF を取得して確認する必要がある。

---

## ページネーション

なし。各年度ページは単一ページで全会議録の PDF リンクを表示している。

---

## 注意事項

- **PDF 形式のみ**: HTML テキスト版の会議録は提供されていないため、PDF からのテキスト抽出が必須
- **ファイル名の命名規則が統一されていない**: 年代によってファイル名の形式が大きく異なるため、ファイル名からのメタ情報抽出には年代ごとの対応が必要
- **修正版 PDF**: 一部の PDF には `(修)` や `(2)` 等の修正版マーカーが付与されている
- **年度ページ URL の規則性がない**: 令和年代のページ ID（`p12038` 等）には規則性がなく、トップページから各年度へのリンクを辿る必要がある

---

## 推奨アプローチ

1. **トップページからリンクを辿る**: 年度別ページの URL に規則性がないため、トップページから全年度ページへのリンクを収集し、各ページの PDF リンクを取得する
2. **PDF テキスト抽出**: `pdf-parse` 等を使用して PDF からテキストを抽出し、発言者・発言内容をパースする
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 各年度ページの PDF リンク数を前回取得時と比較し、新規追加分のみをダウンロードする
5. **ファイル名パースは年代別に分岐**: 命名規則が年代で異なるため、メタ情報抽出ロジックは年代ごとに分岐させる
