# 氷川町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.hikawa.kumamoto.jp/gikai/list00412.html
- 分類: 町公式サイト内に年度別リスト形式で会議録を掲載（外部の専用会議録検索システムは使用していない）
- 文字コード: UTF-8
- 掲載範囲: 令和8年〜平成24年（計15年度分）

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（年度一覧） | `https://www.town.hikawa.kumamoto.jp/gikai/list00412.html` |
| 年度別一覧ページ | `https://www.town.hikawa.kumamoto.jp/gikai/list{5桁ID}.html` |
| 会議録詳細ページ | `https://www.town.hikawa.kumamoto.jp/gikai/kiji{7桁ID}/index.html` |
| 会議録 PDF | `https://www.town.hikawa.kumamoto.jp/gikai/kiji{7桁ID}/3_{7桁ID}_{数字}_up_{ランダム文字列}.pdf` |

---

## 年度別一覧ページの URL マッピング

| 年度 | URL |
| --- | --- |
| 令和8年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00836.html` |
| 令和7年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00815.html` |
| 令和6年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00782.html` |
| 令和5年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00723.html` |
| 令和4年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00705.html` |
| 令和3年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00668.html` |
| 令和2年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00435.html` |
| 平成31年/令和元年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00436.html` |
| 平成30年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00437.html` |
| 平成29年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00438.html` |
| 平成28年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00439.html` |
| 平成27年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00440.html` |
| 平成26年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00441.html` |
| 平成25年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00442.html` |
| 平成24年 | `https://www.town.hikawa.kumamoto.jp/gikai/list00443.html` |

---

## ページ構造

### 年度別一覧ページ

- `<ul>` / `<li>` / `<a>` のリスト構造
- 各 `<li>` に会議録詳細ページへのリンク（`kiji{7桁ID}/index.html`）
- リンクテキストは会議名（例: `令和7年第8回氷川町議会臨時会会議録`）
- 更新日（最終更新日）が各リンクに付随

### 会議録詳細ページ（`kiji{ID}/index.html`）

- 1会議につき1ページ
- 会議録本文は HTML ではなく **PDF ファイル** として提供
- 1つの会議録が複数の PDF（第1号、第2号、第3号など）に分かれる場合がある
- 各 PDF リンクには号数とファイルサイズが付記される

**PDF リンクの例:**

```
令和6年第5回氷川町議会定例会会議録(第1号)（PDF：554.2キロバイト）
→ https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/3_6193_5726_up_ubwtka57.pdf

令和6年第5回氷川町議会定例会会議録（第2号）（PDF：778.1キロバイト）
→ https://www.town.hikawa.kumamoto.jp/gikai/kiji0036193/3_6193_5784_up_uc7bwu84.pdf
```

---

## スクレイピング戦略

### Step 1: 年度別一覧ページから会議録詳細リンクを収集

上記のマッピングテーブルに記載した15件の年度別 URL を順にアクセスし、各ページに含まれる `kiji{ID}/index.html` リンクを抽出する。

- Cheerio で `<a>` タグを取得し、`/gikai/kiji\d+/index\.html` パターンにマッチする href を収集
- リンクテキスト（会議名）も同時に取得する

### Step 2: 会議録詳細ページから PDF リンクを収集

Step 1 で取得した各 `kiji{ID}/index.html` にアクセスし、PDF ファイルへのリンクを抽出する。

- Cheerio で `href` が `.pdf` で終わるリンクを全件取得
- リンクテキスト（号数）も同時に取得する
- 1会議に複数 PDF がある場合は全件取得する

### Step 3: PDF のダウンロードとテキスト抽出

Step 2 で取得した PDF URL からファイルをダウンロードし、テキストを抽出する。

- PDF のテキスト抽出には `pdf-parse` 等を使用
- PDF 内のメタ情報（会議名、開催日）は PDF 本文またはリンクテキストから取得

---

## 注意事項

- 会議録本文は全て PDF 形式のため、HTML パースではなく PDF テキスト抽出が必要
- PDF のファイル名にランダム文字列（`up_{ランダム}`）が含まれるため、URL のパターンマッチングによる直接推測は不可。必ず詳細ページを経由してリンクを取得すること
- 年度別一覧ページの URL は連番ではなく飛び番のため、上記マッピングテーブルを使用する
- 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
- JavaScript の折りたたみメニューが実装されているが、各年度ページは独立した URL で提供されているため JavaScript 実行は不要

---

## 推奨アプローチ

1. **年度 URL をハードコード**: 年度別一覧 URL は15件のみで固定のため、上記マッピングテーブルをコードに直接記述する
2. **2段階クロール**: 年度一覧 → 会議録詳細 → PDF の順に段階的にクロールする
3. **PDF テキスト抽出**: 会議録本文はすべて PDF のため、`pdf-parse` 等でテキスト化してから構造解析を行う
4. **号数の保持**: 1会議が複数 PDF に分かれる場合、号数情報をメタデータとして保持する
