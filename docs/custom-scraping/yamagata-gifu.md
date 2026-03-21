# 岐阜県山県市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.yamagata.gifu.jp/site/gikai/list59.html
- 分類: 公式ウェブサイトによる年度別 PDF 公開（専用の会議録検索システムは利用していない）
- 文字コード: UTF-8
- 特記: 会議録は年度ごとの個別ページに PDF ファイルとして掲載。専用検索システムなし。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（全年度） | `https://www.city.yamagata.gifu.jp/site/gikai/list59.html` |
| 年度別会議録ページ | `https://www.city.yamagata.gifu.jp/site/gikai/{ページID}.html` |
| 会議録 PDF | `https://www.city.yamagata.gifu.jp/uploaded/attachment/{ファイルID}.pdf` |

---

## 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和7年 | `https://www.city.yamagata.gifu.jp/site/gikai/50179.html` |
| 令和6年 | `https://www.city.yamagata.gifu.jp/site/gikai/43611.html` |
| 令和5年 | `https://www.city.yamagata.gifu.jp/site/gikai/37094.html` |
| 令和4年 | `https://www.city.yamagata.gifu.jp/site/gikai/27201.html` |
| 令和3年 | `https://www.city.yamagata.gifu.jp/site/gikai/22884.html` |
| 令和2年 | `https://www.city.yamagata.gifu.jp/site/gikai/9991.html` |
| 平成31年/令和元年 | `https://www.city.yamagata.gifu.jp/site/gikai/4001.html` |
| 平成30年 | `https://www.city.yamagata.gifu.jp/site/gikai/1780.html` |
| 平成29年 | `https://www.city.yamagata.gifu.jp/site/gikai/1794.html` |
| 平成28年 | `https://www.city.yamagata.gifu.jp/site/gikai/1793.html` |
| 平成27年 | `https://www.city.yamagata.gifu.jp/site/gikai/1791.html` |
| 平成26年 | `https://www.city.yamagata.gifu.jp/site/gikai/1790.html` |
| 平成25年 | `https://www.city.yamagata.gifu.jp/site/gikai/1789.html` |
| 平成24年 | `https://www.city.yamagata.gifu.jp/site/gikai/1788.html` |
| 平成23年 | `https://www.city.yamagata.gifu.jp/site/gikai/1792.html` |
| 平成22年 | `https://www.city.yamagata.gifu.jp/site/gikai/1781.html` |
| 平成21年 | `https://www.city.yamagata.gifu.jp/site/gikai/1782.html` |
| 平成20年 | `https://www.city.yamagata.gifu.jp/site/gikai/1783.html` |
| 平成19年 | `https://www.city.yamagata.gifu.jp/site/gikai/1784.html` |
| 平成18年 | `https://www.city.yamagata.gifu.jp/site/gikai/1785.html` |
| 平成17年 | `https://www.city.yamagata.gifu.jp/site/gikai/1786.html` |
| 平成16年 | `https://www.city.yamagata.gifu.jp/site/gikai/1787.html` |

---

## 会議録の構成

### 会議種別

各年度ページには定例会と臨時会の会議録が掲載される。委員会の会議録は別ページ（`/site/gikai/8565.html`）で管理されており、本一覧には含まれない。

- **定例会**: 年4回（第1回〜第4回）
- **臨時会**: 年により0〜3回

### PDF ファイルの特性

- 生成ツール: PScript5.dll（Microsoft Word 等からの PS 変換） + Acrobat Distiller
- 1つの PDF が1定例会・臨時会全体（複数日分）をまとめて収録
- 1ファイルあたり 150〜200 ページ程度
- `pdftotext` によるテキスト抽出が可能（文字情報あり、スキャン PDF ではない）

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

会議録一覧ページ `list59.html` から全年度ページの URL を取得し、各年度ページから PDF リンクを収集する。

1. `list59.html` を取得し、サイドバーの「会議録」セクションから年度別ページへのリンク（`/site/gikai/{ID}.html`）を抽出する
2. 各年度ページを取得し、`/uploaded/attachment/{ID}.pdf` 形式のリンクと会議名（「第N回定例会」「第N回臨時会」）を対にして収集する
3. ページネーションはなし

**リンク抽出（Cheerio 例）:**

```typescript
// 年度別ページから PDF リンクを抽出
const links = $("a[href$='.pdf']").map((_, el) => ({
  name: $(el).text().trim(),
  url: `https://www.city.yamagata.gifu.jp${$(el).attr("href")}`,
})).get();
```

### Step 2: PDF のダウンロードとテキスト抽出

PDF をダウンロードし、`pdftotext`（Poppler）でテキストに変換する。

```bash
pdftotext -layout input.pdf output.txt
```

- `-layout` オプションで段組みレイアウトを維持しつつテキスト化
- スキャン PDF ではないためテキスト層あり、OCR 不要

### Step 3: テキストのパース

#### PDF 構造

1つの PDF は複数の会議日（第1号、第2号…）を含む。各会議日は以下の構造を持つ:

```
令和７年２月27日

開  会（午前10時00分）
（中略：目次・出席者一覧）

令和７年２月２７日
山県市議会定例会会議録
（第 １ 号）

○議事日程 ...

○議長（𠮷田茂広）  日程第○...（発言内容）
○委員長（武藤孝成）  ...（発言内容）
○３番  吉田昌樹議員質疑...（発言内容）
```

#### メタ情報の抽出

```
令和７年第１回
山県市議会定例会会議録
```

- 年号・回次・会議種別を冒頭部から抽出
- 各会議日の開始は `令和X年X月X日（X曜日）第X号` の行で識別

#### 発言者パターン

```
○議長（𠮷田茂広）
○副議長（加藤義信）
○議会運営委員会委員長（武藤孝成）
○市長（林宏優）
○副市長（久保田聡）
○３番  吉田昌樹議員質疑
○１１番  山崎　通議員質問
○谷村理事兼総務課長答弁
○服部市民環境課長答弁
```

- 役職者: `○役職名（氏名）` の形式
- 議員（質疑・質問・討論）: `○議席番号番  氏名議員{質疑|質問|発言|反対討論|賛成討論}` の形式
- 行政職員（答弁）: `○氏名役職名答弁` の形式（括弧なし）
- 傍聴者の発言: `〔「異議なし」と呼ぶ者あり〕` のような括弧内記述（発言者として扱わない）

#### パース用正規表現（案）

```typescript
// 発言者行の検出（○ で始まる行）
const speakerLinePattern = /^○(.+)/;

// 役職者（議長・市長等）の氏名抽出
const officialPattern = /^○(.+?)（(.+?)）/;
// 例: ○議長（𠮷田茂広） → role="議長", name="𠮷田茂広"

// 議員の発言（議席番号付き）
const memberPattern = /^○(\d+)番\s+(.+?)議員/;
// 例: ○３番  吉田昌樹議員質疑 → number="3", name="吉田昌樹"

// 行政職員の答弁（括弧なし・「答弁」で終わる）
const officialAnswerPattern = /^○(.+?答弁)$/;
// 例: ○谷村理事兼総務課長答弁 → role="谷村理事兼総務課長答弁"

// 会議日の区切り（第N号）
const sessionPattern = /^(?:令和|平成)\d+年\d+月\d+日（.曜日）第\d+号/;

// 開催日の抽出
const datePattern = /(?:令和|平成)(\d+)年(\d+)月(\d+)日/;
```

---

## 注意事項

- **委員会会議録は別管理**: 本年度別ページには本会議（定例会・臨時会）のみ掲載。委員会は `/site/gikai/8565.html` 配下で管理されているが、委員会会議録の PDF 公開状況は別途確認が必要。
- **目次部分に注意**: PDF 冒頭の目次には発言者名が「林市長提案説明……12」のようにページ参照付きで列挙される。本文パース時に目次行を誤検出しないよう注意する。
- **文字の揺れ**: `pdftotext` 変換後、全角スペースや行内の余分な空白が含まれる場合がある。正規化が必要。
- **異体字**: 議長氏名に `𠮷`（吉の異体字、U+20BB7）等の CJK 拡張文字が含まれる場合がある。UTF-8 で正しく扱えるかを確認する。
- **ページ区切り文字**: `pdftotext` の出力にはページ区切り（フォームフィード `\f`）が挿入される。`－ N －` のようなページ番号行も含まれるため、パース時に除去する。

---

## 推奨アプローチ

1. **URL リストの事前確定**: 年度別ページ URL は上記テーブルで全量把握済み。動的な URL 変動はないため、リストを静的に保持してよい。
2. **PDF キャッシュ**: PDF は更新頻度が低い（年度終了後は固定）ため、ダウンロード済みのものはキャッシュして再取得を避ける。
3. **pdftotext によるテキスト化**: OCR 不要。`pdftotext -layout` で段組みを維持したテキストを取得し、正規表現でパースする。
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける。
5. **差分更新**: 年度ページの「更新日」を確認し、変更がない年度の PDF は再取得をスキップする。
