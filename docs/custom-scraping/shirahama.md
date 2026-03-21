# 白浜町議会 カスタムスクレイピング方針

## 概要

- 自治体コード: 304018
- サイト: https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/index.html
- 分類: 独自 CMS（Joruri CMS 系）による HTML 公開、PDF ダウンロード形式
- 文字コード: UTF-8
- 特記: 「最新の会議録」と「過去の会議録」の 2 セクション構成

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/index.html` |
| 最新の会議録 | `https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/saishinnokaigiroku/{ID}.html` |
| 過去の会議録（年度インデックス） | `https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/kako/index.html` |
| 過去の会議録（年度別詳細） | `https://www.town.shirahama.wakayama.jp/soshiki/gikai/gyomu/kaigiroku/kako/{ID}.html` |
| PDF ファイル | `https://www.town.shirahama.wakayama.jp/material/files/group/51/{yyyymmdd}kaigiroku.pdf` |

---

## セクション構成

### 最新の会議録

直近の定例会・臨時会の会議録 PDF を掲載するページ。ID は数値（例: `3106`）。

### 過去の会議録

年度インデックスページ（`kako/index.html`）に、平成 23 年から現在までの年度別リンクが列挙されている。

| 年度 | URL |
| --- | --- |
| 平成 23 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1453977741188.html` |
| 平成 24 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1453887052594.html` |
| 平成 25 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1453886671067.html` |
| 平成 26 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1453886669501.html` |
| 平成 27 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1455925893181.html` |
| 平成 28 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1461217632508.html` |
| 平成 29 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1487923872164.html` |
| 平成 30 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1516321984249.html` |
| 令和元年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1547525225424.html` |
| 令和 2 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1588214201347.html` |
| 令和 3 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1643877066513.html` |
| 令和 4 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/1682403413181.html` |
| 令和 5 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/2785.html` |
| 令和 6 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/2786.html` |
| 令和 7 年 | `/soshiki/gikai/gyomu/kaigiroku/kako/3196.html` |

---

## PDF ファイル命名規則

PDF ファイルは `material/files/group/51/` 配下に格納されており、主なパターンは以下の通り:

| パターン | 例 |
| --- | --- |
| `{yyyymmdd}kaigiroku.pdf` | `20240903kaigiroku.pdf`（8 桁） |
| `{yymmdd}kaigiroku.pdf` | `240611kaigiroku.pdf`（6 桁） |

※ ファイル名の日付桁数が年度によって異なるため、リンク href から直接取得するのが確実。

各年度詳細ページには、定例会・臨時会ごとに開催日ごとの PDF リンクが列挙される。例（令和 6 年）:

- 第 1 号 1 月 24 日: `20240124kaigiroku.pdf`
- 第 1 号 2 月 27 日: `20240227kaigiroku.pdf`
- 第 1 号 6 月 11 日: `240611kaigiroku.pdf`
- 第 1 号 9 月 3 日: `20240903kaigiroku.pdf`
- 第 1 号 12 月 3 日: `20241203kaigiroku.pdf`

---

## スクレイピング戦略

### Step 1: 年度インデックスの取得

`kako/index.html` を取得し、各年度の詳細ページ URL を抽出する。

- 年度リンクは `<a href="/soshiki/gikai/gyomu/kaigiroku/kako/{ID}.html">` 形式
- 平成 23 年から現在まで（随時追加される）

### Step 2: 各年度詳細ページから PDF リンクを収集

各年度詳細ページを取得し、PDF へのリンク（`href` が `.pdf` で終わるもの）を全て抽出する。

- PDF URL: `//www.town.shirahama.wakayama.jp/material/files/group/51/...` 形式（プロトコル相対 URL）
- リンクテキストから開催日（例: `第1号 9月3日`）を取得

### Step 3: 最新の会議録の取得

`saishinnokaigiroku/index.html` が示す詳細ページ（例: `3106.html`）から最新の PDF リンクを収集する。

- 公開済み最新年度ページが `kako/` にも追加されるため、二重取得に注意

### Step 4: PDF のダウンロード

収集した PDF URL からダウンロードする。

---

## 注意事項

- ページ本体のコンテンツが JavaScript により動的に描画される場合があるため、一部ページでは静的 HTML での取得が困難な可能性がある
- 「最新の会議録」と「過去の会議録」は内容が重複する場合があるため、URL の重複排除を行う
- PDF ファイル名の日付桁数（6 桁・8 桁）が混在しているため、href から直接 URL を取得すること
- レート制限: リクエスト間に 1〜2 秒の待機時間を設ける

---

## 推奨アプローチ

1. `kako/index.html` から年度別詳細ページ URL を全量取得
2. 各年度ページの PDF リンクを Cheerio で抽出（`a[href$=".pdf"]`）
3. 最新ページ（`saishinnokaigiroku/` 配下）も同様に処理し、重複を排除
4. 全 PDF を収集してダウンロード
