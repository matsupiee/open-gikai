# 中標津町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.nakashibetsu.jp/gikai/
- 分類: 自治体公式サイト（CMS）によるPDF公開（会議録検索システム未導入）
- 文字コード: UTF-8
- 特記: 会議録検索システムは未導入。一般質問・意見書や議会だよりをPDF形式で公開。本会議の逐語録（全文記録）は公開されていない。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `https://www.nakashibetsu.jp/gikai/` |
| 一般質問・意見書 一覧 | `https://www.nakashibetsu.jp/gikai/ippansitumon-ikensyo/` |
| 一般質問 定例会別 | `https://www.nakashibetsu.jp/gikai/ippansitumon-ikensyo/ippannsitumon/{年度}/{定例会コード}/` |
| 議会だより 最新号 | `https://www.nakashibetsu.jp/gikai/gikaidayori/` |
| 議会だより バックナンバー | `https://www.nakashibetsu.jp/gikai/back/` |
| 行政報告 年度別 | `https://www.nakashibetsu.jp/gikai/gyouseihoukoku/{年度}/` |
| 委員会活動レポート | `https://www.nakashibetsu.jp/gikai/iinkaikatudourepo-to/` |
| 委員会代表質問 | `https://www.nakashibetsu.jp/gikai/iinkaidaihyousitumon/` |

### 年度コード

| 年度 | コード |
| --- | --- |
| 令和7年 | `reiwa07` |
| 令和6年 | `reiwa6` |
| 令和5年 | `reiwa5` |
| 令和4年 | `reiwa4` |
| 令和3年 | `reiwa3` |
| 令和2年 | `reiwa2` |

※ 令和7年以降は `reiwa07` のようにゼロ埋め、令和6年以前は `reiwa6` のようにゼロ埋めなし（不統一）。

### 定例会コード

| 月 | コード（令和4年〜） | コード（令和3年以前） |
| --- | --- | --- |
| 3月 | `R{YY}03teireikai` | `R{YY}03teirei` |
| 6月 | `R{YY}06teireikai` | `R{YY}06teirei` |
| 9月 | `R{YY}09teireikai` | `R{YY}09teirei` |
| 12月 | `R{YY}12teireikai` | `R{YY}12teirei` |

※ 令和4年以降は `teireikai`、令和3年以前は `teirei` と末尾が異なる。

---

## 公開コンテンツの種類

### 1. 一般質問（PDF）

各定例会の一般質問を個別PDFで公開。

- URL 例: `/file/contents/5857/48136/{ファイル名}.pdf`
- 全文掲載版と通告番号別の個別PDFがある
- 質問者は「通告1　阿部隆弘議員」のような形式で表記
- 質問内容のテキストがPDF内に含まれる
- 令和2年9月定例会以降のデータが存在

### 2. 意見書（PDF）

- URL 例: `/file/contents/3435/{ID}/R{YY}{MM}ikensyo.pdf`
- ファイル命名規則: `R{年}{月}ikensyo.pdf` または `ikensyo{月}.pdf`（年度により不統一）

### 3. 議会だより（PDF）

- URL 例: `/file/contents/385/{ID}/{号数}.pdf` または `/file/contents/384/{ID}/{ファイル名}.pdf`
- NO.53（平成14年5月）〜 NO.148（令和8年1月）まで約22年分のバックナンバーが存在
- 各号は全体版PDFと個別ページPDF（P01〜P16等）に分割

### 4. 行政報告

- 年度別ページに掲載（令和2年〜令和7年）
- 詳細は各年度ページ内にPDFで掲載

### 5. 委員会活動レポート

- 総務経済常任委員会、文教厚生常任委員会（令和6年9月〜）
- 総務文教常任委員会、厚生常任委員会、産業建設常任委員会（〜令和6年8月）
- 視察（研修）報告書

---

## スクレイピング戦略

### Step 1: 一般質問PDFリンクの収集

一般質問・意見書一覧ページから各定例会ページへのリンクを収集し、定例会ページ内のPDFリンクを抽出する。

**収集方法:**

1. `https://www.nakashibetsu.jp/gikai/ippansitumon-ikensyo/` にアクセス
2. `/gikai/ippansitumon-ikensyo/ippannsitumon/{年度}/{定例会コード}/` 形式のリンクを全て抽出
3. 各定例会ページにアクセスし、PDF リンク（`/file/contents/.../*.pdf`）を抽出
4. 全文掲載版PDFと個別通告PDFの両方を収集

### Step 2: 議会だよりPDFリンクの収集

1. `https://www.nakashibetsu.jp/gikai/back/` にアクセス（単一ページに全バックナンバー掲載）
2. PDF リンクを全て抽出

### Step 3: 意見書PDFリンクの収集

1. `https://www.nakashibetsu.jp/gikai/ippansitumon-ikensyo/` から意見書PDFリンクを直接抽出
2. `/file/contents/3435/{ID}/*.pdf` パターンのリンクを収集

### Step 4: PDFのダウンロードとテキスト抽出

1. 収集した全PDFをダウンロード
2. PDFからテキストを抽出（pdftotext 等を使用）
3. 一般質問PDFについては以下のメタ情報を抽出:
   - 定例会名（3月/6月/9月/12月）
   - 年度（令和X年）
   - 質問者名
   - 質問内容

### Step 5: テキストのパース

#### 一般質問PDFの発言者パターン

```
通告1　阿部隆弘議員
通告2　○○○○議員
```

- 「通告{番号}　{氏名}議員」形式で質問者を識別

#### パース用正規表現（案）

```typescript
// 通告番号と質問者名の抽出
const speakerPattern = /通告(\d+)\s*[　\s]*(.+?)議員/;
// 例: 通告1　阿部隆弘議員 → number="1", name="阿部隆弘"

// 定例会名の抽出（URLパスから）
const sessionPattern = /R(\d{2})(\d{2})teire(?:ikai|i)/;
// 例: R0703teireikai → year="07", month="03"
```

---

## 注意事項

- **会議録（逐語録）は未公開**: 本会議の全文記録（発言の一問一答形式）は公開されていない。取得できるのは一般質問の要約版PDFのみ。
- **URL パターンの不統一**: 年度コード（ゼロ埋めの有無）や定例会コード（`teireikai` / `teirei`）が年度により異なるため、リンクの直接生成ではなくページからのリンク抽出が必要。
- **PDFファイルのID部分が不規則**: `/file/contents/{カテゴリID}/{ファイルID}/` のファイルIDは連番ではなく、ページから動的に取得する必要がある。
- **ページネーションなし**: 一般質問一覧・議会だよりバックナンバーとも単一ページに全件掲載されているため、ページネーション処理は不要。

---

## 推奨アプローチ

1. **リンク収集を優先**: URL パターンが不統一なため、一覧ページからのリンク抽出でPDF URLを収集する
2. **一般質問PDFを主要ターゲットに**: 会議録検索システムがないため、一般質問PDFが最も議会活動の詳細を把握できるコンテンツ
3. **PDF テキスト抽出の品質確認**: PDFの作成方法（スキャン画像 vs テキスト埋め込み）により抽出精度が変わるため、サンプルPDFで事前確認が必要
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: 一覧ページを定期的にチェックし、新規PDFリンクのみをダウンロードする
