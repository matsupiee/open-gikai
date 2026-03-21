# 下呂市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.gero.lg.jp/site/gikai/list69.html
- 分類: 市役所公式サイト内での独自管理（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式のみで提供。HTML による発言録閲覧は不可。会議録の作成には 2 ヶ月程度要する。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録検索トップ | `https://www.city.gero.lg.jp/site/gikai/list69.html` |
| 年度別インデックス | `https://www.city.gero.lg.jp/site/gikai/list69-{ID}.html` |
| 年度別会議録一覧 | `https://www.city.gero.lg.jp/site/gikai/{記事ID}.html` |
| 会議録詳細（各回） | `https://www.city.gero.lg.jp/site/gikai/{記事ID}.html` |
| 会議録 PDF（目次） | `https://www.city.gero.lg.jp/uploaded/attachment/{ID}.pdf` |
| 会議録 PDF（本文） | `https://www.city.gero.lg.jp/uploaded/attachment/{ID}.pdf` |

---

## 年度別インデックス URL 一覧

| 年度 | URL |
| --- | --- |
| 令和8年 | `https://www.city.gero.lg.jp/site/gikai/list69-560.html` |
| 令和7年 | `https://www.city.gero.lg.jp/site/gikai/list69-533.html` |
| 令和6年 | `https://www.city.gero.lg.jp/site/gikai/list69-478.html` |
| 令和5年 | `https://www.city.gero.lg.jp/site/gikai/list69-459.html` |
| 令和4年 | `https://www.city.gero.lg.jp/site/gikai/list69-393.html` |
| 令和3年 | `https://www.city.gero.lg.jp/site/gikai/list69-338.html` |
| 令和2年 | `https://www.city.gero.lg.jp/site/gikai/list69-196.html` |
| 令和元年 | `https://www.city.gero.lg.jp/site/gikai/list69-198.html` |
| 平成31年 | `https://www.city.gero.lg.jp/site/gikai/list69-199.html` |
| 平成30年 | `https://www.city.gero.lg.jp/site/gikai/list69-200.html` |
| 平成29年 | `https://www.city.gero.lg.jp/site/gikai/list69-201.html` |

---

## ページ構成

### 年度別インデックスページ

各年度の `list69-{ID}.html` には、その年度の「年度別会議録一覧」へのリンクが 1 件掲載される。

例（令和7年）:
- テキスト: 「令和7年下呂市議会会議録」
- リンク先: `/site/gikai/32094.html`

### 年度別会議録一覧ページ

各年の会議録が以下の区分でまとめられる。

**本会議（定例会・臨時会）**: 年 4〜7 件程度
**常任委員会**:
- 民生教育まちづくり常任委員会
- 総務産業建設常任委員会
- 予算決算常任委員会

各会議に「議案内容」ページへのリンク（`/site/gikai/{記事ID}.html`）が付く。

### 会議録詳細ページ（各回）

各回の議案内容ページには以下が含まれる。

- 開催日時（例: 「日時　令和7年1月28日（火曜日）午前9時00分」）
- 会期
- 議事日程（表形式）
- 上程議案一覧と審議結果
- 関連ファイルダウンロード
  - 会議録目次（PDF）: `/uploaded/attachment/{ID}.pdf`
  - 会議録本文（PDF）: `/uploaded/attachment/{ID}.pdf`

---

## 会議録 PDF の特性

- Microsoft Word で作成後に PDF 化（`MS-Mincho` / `MS-Gothic` フォント使用）
- テキスト抽出可能な PDF（スキャン画像ではない）
- A4 判（595.2×841.8 ポイント）
- ToUnicode マッピングあり → PDF テキスト抽出ツールで処理可能

---

## スクレイピング戦略

### Step 1: 年度別インデックスからリンク収集

`list69.html` に記載された全年度インデックス URL（令和8年〜平成29年）を起点とする。

1. `list69.html` から年度別インデックスページ（`list69-{ID}.html`）の URL を抽出
2. 各インデックスページから年度別会議録一覧ページ（`/site/gikai/{記事ID}.html`）の URL を抽出

### Step 2: 年度別会議録一覧から各回のリンクを収集

年度別会議録一覧ページ（例: `/site/gikai/32094.html`）から、各会議（定例会・臨時会・委員会）の議案内容ページへのリンクを抽出する。

- 「【定例会・臨時会】」「【常任委員会（付託案件審査）】」などの見出しで区分される
- 各会議のリンクは `/site/gikai/{記事ID}.html` 形式

### Step 3: 議案内容ページから PDF URL を取得

各議案内容ページの「関連ファイルダウンロード」セクションから PDF リンクを抽出する。

- 目次 PDF と本文 PDF の 2 ファイルが提供されるのが基本
- URL パターン: `/uploaded/attachment/{ID}.pdf`

### Step 4: PDF から会議録テキストを抽出

取得した本文 PDF に対して PDF テキスト抽出処理を実施する。

- `pdftotext` や `pdf-parse` 等の標準的な PDF テキスト抽出ツールを使用可能
- Word 原稿由来のため、テキストレイヤーが正確に保持されている

---

## メタ情報の抽出

| 情報 | 取得元 | 記述形式 |
| --- | --- | --- |
| 開催日 | 議案内容ページ本文 | 「日時　令和X年X月X日（曜日）午前X時X分」 |
| 会議名 | 年度別一覧ページのリンクテキスト | 「第X回定例会（X月X日〜X月X日）」等 |
| 会議種別 | 見出し区分 | 「定例会・臨時会」「常任委員会」等 |

---

## 注意事項

- 会議録は HTML ではなく **PDF のみで提供**されるため、テキスト検索・発言者抽出には PDF 処理が必要
- 会議録の公開まで **開催から約 2 ヶ月**のタイムラグがある
- 年度別インデックスページの `list69-{ID}.html` の ID は連番ではなく、システム内の記事 ID のため、`list69.html` から都度取得する
- 委員会の会議録は本会議と同一の年度別一覧ページに掲載されるが、本会議（定例会・臨時会）と区別して管理する
- 令和8年は会議録作成中のため、ページが存在しても PDF がまだ掲載されていない場合がある

---

## 推奨アプローチ

1. **年度ごとに処理**: `list69.html` → 年度別インデックス → 年度別一覧 → 各回議案ページ → PDF の順にクロール
2. **PDF テキスト抽出**: Word 原稿由来の高品質な PDF のため、標準的なツールで処理可能
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 議案内容ページの「更新日」を利用して、既取得ページの再取得を回避する
5. **PDF の有無確認**: ページが存在しても PDF が未掲載の場合（開催後 2 ヶ月以内）は スキップして後日再試行する
