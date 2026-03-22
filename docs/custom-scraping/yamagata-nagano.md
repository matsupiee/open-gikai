# 長野県山形村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.yamagata.nagano.jp/government/diet/minutes/
- 分類: 公式ウェブサイトによる年度別 PDF 公開（専用の会議録検索システムは利用していない）
- 文字コード: UTF-8
- 特記: 会議録は年度ごとの個別ページに PDF ファイルとして掲載。検索機能なし。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（全年度） | `https://www.vill.yamagata.nagano.jp/government/diet/minutes/` |
| 年度別会議録ページ | `https://www.vill.yamagata.nagano.jp/docs/{ページID}.html` |
| 会議録 PDF（近年） | `https://www.vill.yamagata.nagano.jp/fs/{数字スラッシュ区切り}/_/{日本語ファイル名}.pdf` |
| 会議録 PDF（過去） | `https://www.vill.yamagata.nagano.jp/fs/{数字スラッシュ区切り}/_/{ローマ字ファイル名}.pdf` |

---

## 年度別ページ一覧

| 年度 | URL |
| --- | --- |
| 令和7年 | `https://www.vill.yamagata.nagano.jp/docs/310380.html` |
| 令和6年 | `https://www.vill.yamagata.nagano.jp/docs/289719.html` |
| 令和5年 | `https://www.vill.yamagata.nagano.jp/docs/65994.html` |
| 令和4年 | `https://www.vill.yamagata.nagano.jp/docs/50506.html` |
| 令和3年 | `https://www.vill.yamagata.nagano.jp/docs/39524.html` |
| 令和2年 | `https://www.vill.yamagata.nagano.jp/docs/5181.html` |
| 平成31年/令和元年 | `https://www.vill.yamagata.nagano.jp/docs/2262.html` |
| 平成30年 | `https://www.vill.yamagata.nagano.jp/docs/2257.html` |
| 平成29年 | `https://www.vill.yamagata.nagano.jp/docs/2256.html` |
| 平成28年 | `https://www.vill.yamagata.nagano.jp/docs/2251.html` |
| 平成27年 | `https://www.vill.yamagata.nagano.jp/docs/2246.html` |
| 平成26年 | `https://www.vill.yamagata.nagano.jp/docs/2245.html` |
| 平成25年 | `https://www.vill.yamagata.nagano.jp/docs/2244.html` |
| 平成24年 | `https://www.vill.yamagata.nagano.jp/docs/2243.html` |
| 平成23年 | `https://www.vill.yamagata.nagano.jp/docs/2241.html` |

---

## 会議録の構成

### 会議種別

各年度ページには定例会と臨時会の会議録が掲載される。

- **定例会**: 年3〜4回（第1回〜第4回）
- **臨時会**: 年により0〜5回

### PDF ファイルの種類

各会議につき、以下の種類の PDF が公開される:

| 種類 | ファイル名パターン（近年） | ファイル名パターン（過去） |
| --- | --- | --- |
| 目次 | `...会議録目次.pdf` | `{N}teireikaimokuji.pdf` / `{N}rinjikaimokuji.pdf` |
| 本文（第N号） | `...（第N号）.pdf` | `{N}teireikaino{号数}.pdf` / `{N}rinjikai.pdf` |
| 一般質問総括表 | `...一般質問総括表（第N号）.pdf` | `{N}teireikaiippansitumon.pdf` |

- 近年（令和以降）は日本語ファイル名、過去（平成23年頃）はローマ字ファイル名
- 定例会は通常3〜4号、臨時会は1〜2号で構成
- 目次・一般質問総括表はスクレイピング対象外（本文 PDF のみ取得すればよい）

### PDF ファイルの特性

- 1つの PDF が1会議日分（第N号）を収録
- `pdftotext` によるテキスト抽出が可能（文字情報あり、スキャン PDF ではない）

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

会議録一覧ページから全年度ページの URL を取得し、各年度ページから PDF リンクを収集する。

1. 一覧ページ `/government/diet/minutes/` を取得し、`/docs/{ID}.html` 形式の年度別ページへのリンクを抽出する
2. 各年度ページを取得し、`.pdf` で終わるリンクを収集する
3. 目次 PDF（`目次.pdf` / `mokuji.pdf`）と一般質問総括表 PDF（`一般質問総括表` / `ippansitumon`）を除外し、本文 PDF のみを対象とする
4. ページネーションはなし

**リンク抽出（Cheerio 例）:**

```typescript
// 年度別ページから本文 PDF リンクを抽出（目次・一般質問総括表を除外）
const links = $("a[href$='.pdf']")
  .map((_, el) => ({
    name: $(el).text().trim(),
    url: new URL($(el).attr("href")!, "https://www.vill.yamagata.nagano.jp").href,
  }))
  .get()
  .filter((link) =>
    !link.url.includes("mokuji") &&
    !link.url.includes("目次") &&
    !link.url.includes("ippansitumon") &&
    !link.url.includes("一般質問総括表")
  );
```

### Step 2: PDF のダウンロードとテキスト抽出

PDF をダウンロードし、`pdftotext`（Poppler）でテキストに変換する。

```bash
pdftotext -layout input.pdf output.txt
```

- `-layout` オプションで段組みレイアウトを維持しつつテキスト化
- スキャン PDF ではないためテキスト層あり、OCR 不要

### Step 3: テキストのパース

#### メタ情報の抽出

PDF ファイル名から会議情報を抽出できる:

- 近年: `令和７年山形村議会第１回定例会（第１号）.pdf` → 年度・回次・会議種別・号数
- 過去: `1teireikaino1.pdf` → 回次・号数（年度は親ページから取得）

#### 発言者パターン

山形村議会の会議録は一般的な地方議会の形式に準拠すると想定:

```
○議長（氏名）
○副議長（氏名）
○N番（氏名）
○村長（氏名）
```

- `○` で始まり、役職 or 議席番号 + 括弧内に氏名
- 発言内容は発言者行の後に続くテキスト

#### パース用正規表現（案）

```typescript
// 発言者の抽出（役職者）
const officialPattern = /^○(.+?)（(.+?)）/;
// 例: ○議長（氏名） → role="議長", name="氏名"

// 議員の発言（議席番号付き）
const memberPattern = /^○(\d+)番[　\s]*(.+?)(?:議員|君)?/;

// 開催日の抽出
const datePattern = /(?:令和|平成)(\d+)年(\d+)月(\d+)日/;

// 会議名の抽出（PDF ファイル名から）
const sessionPattern = /第(\d+)回(定例会|臨時会)（第(\d+)号）/;
```

---

## 注意事項

- **PDF ファイル名のエンコーディング**: 近年の PDF は日本語ファイル名を使用しており、URL エンコーディングが必要。HTTP リクエスト時に正しくエンコードされることを確認する。
- **ファイル名パターンの変遷**: 平成23年頃はローマ字ファイル名（`teireikaino1.pdf`）、近年は日本語ファイル名（`第１回定例会（第１号）.pdf`）と異なるパターンが混在する。両方に対応する必要がある。
- **文字の揺れ**: `pdftotext` 変換後、全角スペースや行内の余分な空白が含まれる場合がある。正規化が必要。
- **ページ区切り文字**: `pdftotext` の出力にはページ区切り（フォームフィード `\f`）が挿入される。パース時に除去する。
- **委員会会議録**: 一覧ページには本会議（定例会・臨時会）のみ掲載。委員会会議録の公開状況は別途確認が必要。

---

## 推奨アプローチ

1. **URL リストの事前確定**: 年度別ページ URL は上記テーブルで全量把握済み。一覧ページからの動的取得も可能だが、静的リストとしても保持できる。
2. **PDF キャッシュ**: PDF は更新頻度が低い（年度終了後は固定）ため、ダウンロード済みのものはキャッシュして再取得を避ける。
3. **pdftotext によるテキスト化**: OCR 不要。`pdftotext -layout` で段組みを維持したテキストを取得し、正規表現でパースする。
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける。
5. **差分更新**: 年度ページの PDF リンク数を確認し、前回取得時から増加している場合のみ新規 PDF を取得する。
