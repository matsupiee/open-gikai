# 美浦村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/
- 分類: 標準 CMS（スタティック HTML）による年度別会議録公開
- 文字コード: UTF-8
- 形式: **PDF 形式のみ公開**（HTML 検索・閲覧不可）

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ | `https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/` |
| 年度別会議録 | `https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page{ID}.html` |
| PDF ファイル | `https://www.vill.miho.lg.jp/data/doc/{TIMESTAMP}_doc_165_{INDEX}.pdf` |

### ページ ID 例

- 2024年（令和6年）: `page013511.html`
- 2023年（令和5年）: `page012797.html`
- 2022年（令和4年）: `page011488.html`
- 2021年（令和3年）: `page009503.html`

---

## 会議録の構成

各年度ページには、以下の形式で会議録が掲載される：

### ファイル形式

- 形式: **PDF 形式のみ**
- 分類: 定例会（第1〜4回）、臨時会（臨時）

### 2024年の会議録例

```
- 令和6年第4回定例会 [PDF形式／717.5KB]
- 令和6年第2回臨時会 [PDF形式／246.12KB]
- 令和6年第3回定例会 [PDF形式／959.75KB]
- 令和6年第2回定例会 [PDF形式／696.02KB]
- 令和6年第1回定例会 [PDF形式／927.87KB]
- 令和6年第1回臨時会 [PDF形式／270.02KB]
```

### 会議名パターン

```
令和{年}年第{回}回{定例会|臨時会}
```

- 年: 元号 + 数字（例：6年 = 令和6年）
- 回: 数字（1〜4回程度）
- 会議種別: 定例会 or 臨時会

---

## スクレイピング戦略

### 制約事項

**美浦村は HTML ベースの会議検索機能を提供しておらず、会議録は PDF のみの公開である。**

このため、以下のアプローチが必須：

1. 年度別ページを列挙
2. 各年度ページの HTML から PDF リンクを抽出
3. PDF ファイルをダウンロード
4. PDF の OCR または テキスト抽出で内容を解析

### Step 1: 年度別ページ URL の収集

年度別ページのトップ（`https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/`）から、各年度へのリンク（`page{ID}.html`）を抽出する。

```typescript
// トップページのパース例
const topPage = await fetch(
  "https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/"
);
const $ = cheerio.load(await topPage.text());

// 年度リンクを抽出 (例: page013511.html)
const yearLinks = [];
$("div.dirIndex h2 a").each((_, el) => {
  const href = $(el).attr("href");
  if (href) yearLinks.push(href);
});
```

### Step 2: 年度別ページから PDF リンク抽出

各年度ページの `div.fileDL` セクション内にある PDF リンクを抽出。

```typescript
// 年度別ページのパース例
const yearPage = await fetch("https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/page013511.html");
const $ = cheerio.load(await yearPage.text());

// PDF ダウンロードリンクを抽出
const pdfLinks = [];
$("div.fileDL a.icon_blank").each((_, el) => {
  const href = $(el).attr("href");
  const text = $(el).text();
  if (href && href.includes(".pdf")) {
    pdfLinks.push({
      url: href,
      label: text,  // 例: "令和6年第4回定例会 [PDF形式／717.5KB]"
    });
  }
});
```

### Step 3: PDF メタ情報の抽出

PDF ファイル名から会議情報を抽出：

```typescript
// ファイル名パターン: {TIMESTAMP}_doc_165_{INDEX}.pdf
const parseFileName = (url: string) => {
  const match = url.match(/(\d+)_doc_165_(\d+)\.pdf/);
  if (match) {
    return {
      timestamp: match[1],      // Unix timestamp (秒)
      fileIndex: match[2],      // 0, 1, 2, ... (年度内の会議順)
    };
  }
  return null;
};

// HTML テキスト（`label`）から会議名を抽出
const parseLabel = (label: string) => {
  // 例: "令和6年第4回定例会 [PDF形式／717.5KB]"
  const match = label.match(/(令和\d+年第\d+回(?:定例会|臨時会))/);
  if (match) {
    return match[1];
  }
  return null;
};
```

### Step 4: PDF ダウンロード・OCR 処理

PDF ファイルをダウンロードし、テキスト抽出または OCR を実施：

```typescript
import { PDFDocument } from "pdf-lib";
// または
import pdfParse from "pdf-parse";

const downloadAndExtract = async (pdfUrl: string) => {
  const response = await fetch(pdfUrl);
  const buffer = await response.arrayBuffer();

  // pdfParse を使用する場合
  const data = await pdfParse(buffer);
  const fullText = data.text;  // 全ページのテキスト

  return fullText;
};
```

### Step 5: PDF テキストのパース

PDF テキストから発言者・議題等を抽出。**パターンは自治体により異なるため、実装前にサンプル PDF を確認すること。**

想定される構造：
- ページトップ: 会議名、開催日時
- 目次: 議題一覧
- 本文: 発言者ごとの発言内容

```typescript
// 概略パターン例（要確認）
const parseContent = (text: string) => {
  // 会議名・開催日抽出
  const dateMatch = text.match(/令和(\d+)年(\d+)月(\d+)日/);

  // 発言者抽出（PDF の場合、スペース or 改行で区切られることが多い）
  const speakers = [];
  const lines = text.split(/\n/);

  lines.forEach((line) => {
    // 括弧を含む名前パターンを検出
    const nameMatch = line.match(/(.+?)(?:\s+|　)(.+)/);
    if (nameMatch) {
      speakers.push({
        role: nameMatch[1],
        name: nameMatch[2],
      });
    }
  });

  return { dateMatch, speakers };
};
```

---

## 注意事項

### 1. PDF のみの公開という制約

- 検索機能が HTML で提供されていない
- 全会議録を網羅するにはすべての年度ページにアクセスする必要がある
- 各年度ページの更新タイミングは遅延する可能性あり（掲載日を確認すること）

### 2. PDF テキスト抽出の難題

- スキャン PDF の可能性：OCR 処理が必要
- デジタル PDF でもレイアウト依存により正規表現が複雑化する可能性
- 最初のサンプル PDF （複数年度）を詳細に検査してからスクリプト化する

### 3. ファイル URL の変動性

- `{TIMESTAMP}_doc_165_{INDEX}.pdf` の URL 形式は時間経過で変わる可能性
- 差分更新時は「前回取得済みの年度」のみを再確認するが、**ファイル URL は毎回異なる**ため、URL のハッシュ化やメタデータに基づく重複排除が必要

### 4. レート制限

- 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
- PDF ダウンロード時は追加の遅延（3〜5 秒）を検討

---

## 推奨アプローチ

1. **パイロット取得**: 2024年、2023年のサンプル PDF を手動ダウンロードし、テキスト抽出結果を確認
2. **正規表現設計**: PDF から得られた実テキストに基づいて発言者・議題抽出パターンを設計
3. **段階的実装**:
   - Step 1: 年度ページ URL リスト作成
   - Step 2: PDF リンク抽出
   - Step 3: PDF テキスト抽出
   - Step 4: 発言内容パース（複数サンプルでテスト）
4. **差分更新**: トップページの「最新掲載日」を監視し、新規年度が追加された際のみ再取得する設計
5. **テスト**: 年度ごと、会議種別ごとにサンプルケースを準備して正規表現の正確性を検証

---

## リファレンス

- 公式サイト: https://www.vill.miho.lg.jp/
- 議会のページ: https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/
- 会議録トップ: https://www.vill.miho.lg.jp/gyousei/mihomura-annai/gikai/gikaikaigiroku/
