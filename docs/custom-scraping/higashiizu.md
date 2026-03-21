# 東伊豆町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.higashiizu.lg.jp/gikai/kaigiroku/index.html
- 分類: 独自 PDF ベースの会議録公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は HTML ページ上のリンクから直接 PDF をダウンロードする形式。全文テキスト検索機能なし。

---

## URL 構造

| ページ | URL |
| --- | --- |
| 会議録トップ | `https://www.town.higashiizu.lg.jp/gikai/kaigiroku/index.html` |
| 本会議の会議録一覧 | `https://www.town.higashiizu.lg.jp/gikai/kaigiroku/1130.html` |
| 委員会の会議録一覧 | `https://www.town.higashiizu.lg.jp/gikai/kaigiroku/1131.html` |
| PDF ファイル | `https://www.town.higashiizu.lg.jp/material/files/group/13/{ファイル名}.pdf` |

PDF のパスはすべて `/material/files/group/13/` 配下に格納されているが、ファイル名に規則性はなく、日付やハッシュ値など混在している。

---

## ページ構造

### 本会議一覧ページ（1130.html）

- 年度ごとに `h2` 見出しで区切られている（例: 「令和7年（2025年）本会議」）
- 各会議録は `a` タグで直接リンクされており、`ul/li` は使用されていない
- リンクテキストの形式: `{日付} {会議種別} (PDFファイル: {サイズ})`
- 例: `令和7年12月3日 第4回定例会 (PDFファイル: 1.2MB)`

**掲載年度範囲**: 令和2年（2020年）〜令和7年（2025年）現在

**会議種別**:
- 定例会（年4回: 第1〜4回）
- 臨時会（不定期: 第1〜n回）

### 委員会一覧ページ（1131.html）

- 年度ごとに `h2` 見出し（例: 「令和7年（2025年）」）
- 各委員会カテゴリは `h3` 見出しで分類
- リンク形式は本会議と同様

**委員会カテゴリ**:
- 常任委員会（総務経済常任委員会 / 文教厚生常任委員会）
- 議会改革特別委員会
- 決算審査特別委員会
- 予算審査特別委員会

---

## スクレイピング戦略

### Step 1: PDF リンクの収集

本会議・委員会それぞれの一覧ページ（2ページのみ）を取得し、PDF リンクを抽出する。

- `https://www.town.higashiizu.lg.jp/gikai/kaigiroku/1130.html`（本会議）
- `https://www.town.higashiizu.lg.jp/gikai/kaigiroku/1131.html`（委員会）

**抽出方法**:

1. 各一覧ページを Cheerio でパース
2. `a[href$=".pdf"]` でPDFリンクを抽出
3. `href` が `//` で始まる場合は `https:` を補完する
4. 直前の `h2`・`h3` 見出しテキストから年度・会議カテゴリを取得

```typescript
// PDF リンクの抽出例
const links = $('a[href$=".pdf"]').map((_, el) => {
  const href = $(el).attr('href') ?? '';
  const url = href.startsWith('//') ? `https:${href}` : href;
  const label = $(el).text().trim();
  return { url, label };
}).get();
```

**メタ情報の取得（見出しから逆引き）**:

```typescript
// 直前の h2/h3 見出しを取得する例
$('h2, h3, a[href$=".pdf"]').each((_, el) => {
  const tag = el.tagName.toLowerCase();
  if (tag === 'h2') currentYear = $(el).text().trim();
  else if (tag === 'h3') currentCategory = $(el).text().trim();
  else {
    // PDF リンクとして処理
  }
});
```

### Step 2: メタ情報の抽出

リンクテキストから会議情報をパースする。

**リンクテキスト形式**:
```
令和7年12月3日 第4回定例会 (PDFファイル: 1.2MB)
```

**抽出すべき情報**:
- 開催日: `令和X年X月X日` 形式
- 会議名: `第X回定例会` / `第X回臨時会` / 委員会名

**パース用正規表現（案）**:

```typescript
// 開催日の抽出
const datePattern = /(?:令和|平成)(\d+)年(\d+)月(\d+)日/;

// 会議種別の抽出
const sessionPattern = /第(\d+)回(定例会|臨時会)/;

// ファイルサイズの除去（パース前に除去推奨）
const cleanLabel = label.replace(/\(PDFファイル:.*?\)/, '').trim();
```

### Step 3: PDF のダウンロードとテキスト抽出

収集した PDF URL からファイルをダウンロードし、テキストを抽出する。

- PDF は `https://www.town.higashiizu.lg.jp/material/files/group/13/` 配下に格納
- ファイルサイズ: 90KB〜3.3MB 程度
- テキスト抽出には `pdf-parse` 等のライブラリを使用

---

## 注意事項

- **ページネーションなし**: 各一覧ページは1ページのみ。年度が増えるとページ内に追記される構造
- **ファイル名に規則性なし**: 令和6年以前は SHA-1 ハッシュ値をファイル名とするものが多く、ファイル名から会議日時を推定できない。リンクテキストからのパースが必須
- **href が `//` から始まる**: プロトコル相対 URL のため、`https:` を補完する必要がある
- **PDF 内のテキスト構造**: 会議録は PDF 形式のみで提供されており、HTML テキストとしての本文は存在しない
- **掲載範囲**: 令和2年（2020年）以降のみ公開。それ以前の会議録は掲載されていない

---

## 推奨アプローチ

1. **2ページのみ取得**: 一覧ページは本会議・委員会の2ページのみのため、クロールコストは極めて低い
2. **差分更新**: 取得済み PDF の URL リストを保持し、新規 URL のみをダウンロード対象とする
3. **レート制限**: 自治体サイトのため、PDF ダウンロード間に適切な待機時間（1〜2 秒）を設ける
4. **PDF テキスト抽出の失敗考慮**: スキャン PDF の可能性があるため、テキスト抽出が空の場合は OCR 処理等のフォールバックを検討する
