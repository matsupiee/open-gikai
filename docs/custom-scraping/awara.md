# あわら市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.awara.lg.jp/gikai/kaigiroku/index.html
- 分類: 独自 CMS による PDF 公開（専用検索データベースなし）
- 文字コード: UTF-8
- 特記: 専用の議会会議録検索システムは存在しない。年度別ページに PDF が直接添付されている形式。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.city.awara.lg.jp/gikai/kaigiroku/index.html` |
| 年度別ページ（令和2年〜） | `https://www.city.awara.lg.jp/gikai/kaigiroku/p{6桁数字}.html` |
| 年度別ページ（平成27〜30年） | `https://www.city.awara.lg.jp/gikai/kaigiroku/{2桁年}kaigiroku.html` |
| PDF | `https://www.city.awara.lg.jp/gikai/kaigiroku/{ページID}_d/fil/{ファイル名}.pdf` |

---

## 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和7年 | `/gikai/kaigiroku/p014799.html` |
| 令和6年 | `/gikai/kaigiroku/p014488.html` |
| 令和5年 | `/gikai/kaigiroku/p013367.html` |
| 令和4年 | `/gikai/kaigiroku/p012867.html` |
| 令和3年 | `/gikai/kaigiroku/p012497.html` |
| 令和2年 | `/gikai/kaigiroku/p011421.html` |
| 令和元年（平成31年） | `/gikai/kaigiroku/p010075.html` |
| 平成30年 | `/gikai/kaigiroku/30kaigiroku.html` |
| 平成29年 | `/gikai/kaigiroku/29kaigiroku.html` |
| 平成28年 | `/gikai/kaigiroku/28kaigiroku.html` |
| 平成27年 | `/gikai/kaigiroku/27kaigiroku.html` |
| 平成26年 | `/gikai/kaigiroku/p004992.html` |
| 平成25年 | `/gikai/kaigiroku/p004381.html` |
| 平成24年 | `/gikai/kaigiroku/p003740.html` |
| 平成23年 | `/gikai/kaigiroku/p002808.html` |
| 平成22年 | `/gikai/kaigiroku/p001810.html` |
| 平成21年 | `/gikai/kaigiroku/p001172.html` |
| 平成20年 | `/gikai/kaigiroku/p000957.html` |
| 平成19年 | `/gikai/kaigiroku/p000956.html` |
| 平成18年 | `/gikai/kaigiroku/p000955.html` |
| 平成17年 | `/gikai/kaigiroku/p000951.html` |
| 平成16年 | `/gikai/kaigiroku/p000958.html` |

---

## 会議種別と開催構造

各年度ページに定例会・臨時会の会議録が列挙されている。年によって開催回数は異なる。

- **定例会**: 3月・6月・9月・12月の年4回が基本
- **臨時会**: 年1〜2回程度（開催月は年度により異なる）

会議には通し番号が付与されている（第1回〜順番に増加）。令和6年時点で第120回台に達している。

### 令和6年の例（第120〜124回）

| 回次 | 種別 | 開催月 |
| --- | --- | --- |
| 第120回 | 3月定例会 | 3月 |
| 第121回 | 4月臨時会 | 4月 |
| 第122回 | 6月定例会 | 6月 |
| 第123回 | 9月定例会 | 9月 |
| 第124回 | 12月定例会 | 12月 |

---

## PDF URL パターン

年度ページ URL に `_d/fil/` を付加したディレクトリ配下に PDF が格納されている。

| 年度パターン | PDF URL 例 |
| --- | --- |
| `p{数字}.html` 形式（令和系） | `https://www.city.awara.lg.jp/gikai/kaigiroku/p014488_d/fil/120kaigiroku.pdf` |
| `{2桁年}kaigiroku.html` 形式（平成27〜30年） | `https://www.city.awara.lg.jp/gikai/kaigiroku/30kaigiroku_d/fil/1.pdf` |
| `p{数字}.html` 形式（旧平成系） | `https://www.city.awara.lg.jp/gikai/kaigiroku/p000958_d/fil/001.pdf` |

ファイル名は年度・時期によって命名規則が異なる：

- 令和系: `{回次}kaigiroku.pdf` または `{回次}gijiroku.pdf`（例: `120kaigiroku.pdf`, `125gijiroku.pdf`）
- 平成27〜30年: `{連番}.pdf`（例: `1.pdf`, `2.pdf`, `3.pdf`）
- 旧平成系: `{3桁連番}.pdf`（例: `001.pdf`, `002.pdf`）

---

## スクレイピング戦略

### Step 1: 年度別ページの一覧取得

トップページ `https://www.city.awara.lg.jp/gikai/kaigiroku/index.html` から全年度のリンクを収集する。

- リンクは既知のため、上記「年度別ページ一覧」テーブルをハードコードしても可
- ページネーションなし

### Step 2: 年度別ページから PDF リンクを収集

各年度ページを取得し、PDF へのリンク（`<a href="...\.pdf">` など）を Cheerio で抽出する。

- テーブル形式で会議名・回次・PDF リンクが列挙されている
- ページネーションなし（1 年分が単一ページに収まる）
- 相対パスで記載されているため、ベース URL を補完して絶対 URL に変換する

### Step 3: PDF のダウンロードと処理

収集した PDF URL から会議録 PDF をダウンロードする。

- PDF はテキスト抽出可能な形式かどうか事前確認が必要（スキャン PDF の場合は OCR が必要になる可能性あり）
- メタ情報（年度・回次・会議種別・開催月）は年度ページの HTML から取得する

---

## 注意事項

- 専用の全文検索システムは存在しないため、PDF を直接ダウンロードして処理する必要がある
- 年度によって PDF ファイルの命名規則が異なる（令和系・平成27〜30年・旧平成系の3パターン）
- 令和元年（平成31年）ページは平成31年・令和元年の両年分が同一ページにまとまっている
- 平成16年（2004年）が最古の会議録（あわら市の市制施行は2004年3月1日）
- レート制限: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける

---

## 推奨アプローチ

1. **年度ページ一覧をハードコード**: トップページのリンクは固定のため、上記テーブルを静的リストとして保持する
2. **各年度ページから PDF リンクを動的収集**: Cheerio で `a[href$=".pdf"]` セレクタにより PDF リンクを抽出
3. **メタ情報の付与**: 年度・回次・種別（定例会/臨時会）を HTML の会議名テキストからパースして PDF に紐付ける
4. **差分更新**: 既にダウンロード済みの PDF URL を記録し、新規分のみ取得する
