# 西原村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.vill.nishihara.kumamoto.jp/gikai/list00557.html
- 分類: 村公式サイト内での直接公開（外部の会議録検索システムは使用していない）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式で提供。令和5年以降は会議ごとに個別の記事ページ（kiji）を経由してPDFにアクセスする。平成24年〜令和4年分は1つの記事ページにまとめてPDFが列挙されている。

---

## URL 構造

| ページ | URL |
| --- | --- |
| 定例会会議録一覧 | `https://www.vill.nishihara.kumamoto.jp/gikai/list00557.html` |
| 臨時会会議録一覧 | `https://www.vill.nishihara.kumamoto.jp/gikai/list00558.html` |
| 平成24年〜令和4年まとめページ一覧 | `https://www.vill.nishihara.kumamoto.jp/gikai/list00651.html` |
| 各会議録詳細ページ | `https://www.vill.nishihara.kumamoto.jp/gikai/kiji{ID}/index.html` |
| 各会議録 PDF | `https://www.vill.nishihara.kumamoto.jp/gikai/kiji{ID}/{ファイル名}.pdf` |

### 詳細ページ URL 例

- 令和7年第4回定例会: `https://www.vill.nishihara.kumamoto.jp/gikai/kiji0031869/index.html`
- 令和7年第1回臨時会: `https://www.vill.nishihara.kumamoto.jp/gikai/kiji0031766/index.html`
- 平成24年〜令和4年まとめ: `https://www.vill.nishihara.kumamoto.jp/gikai/kiji003295/index.html`

---

## ページ構造

### 一覧ページ

- 各会議録が `<li>` 要素としてリスト表示される
- 「もっと見る」ボタンによる追加読み込み方式（JavaScript autopager）
- 次ページは `rel="next1"` 属性で指定され、AJAX で動的読み込みされる
- 各 `<li>` にはタイトル（会議名）と更新日、詳細ページへのリンクが含まれる

### 詳細ページ（令和5年以降）

- 1会議録 = 1記事ページ
- PDF へのリンクが1件のみ掲載（`<a href="...pdf">` 形式）
- 「前の記事へ」「次の記事へ」ナビゲーションリンクあり
- PDF ファイル名はランダムなサフィックス付き（例: `3_1869_2857_up_qg74xpay.pdf`）

### 詳細ページ（平成24年〜令和4年まとめページ）

- 1記事ページ（kiji003295）に平成24年〜令和4年の全会議録54件を集約
- `<ul>` 内の `<li>` に各 PDF へのリンクが列挙される
- リンク形式: `<a href="{PDFパス}">{会議名}（PDF：{ファイルサイズ}）</a>`
- 定例会・臨時会が混在

---

## スクレイピング戦略

### Step 1: 詳細ページ URL の収集

#### 令和5年以降（定例会・臨時会）

1. 定例会一覧ページ `list00557.html` と臨時会一覧ページ `list00558.html` を取得
2. `<li>` 内の `<a href="/gikai/kiji{ID}/index.html">` を抽出して詳細ページ URL を収集
3. 「もっと見る」ページネーション対応:
   - `#nextload1` リンク（`rel="next1"` 属性）の href から次ページ URL を取得
   - 次ページが存在しなくなるまで繰り返す

#### 平成24年〜令和4年

- まとめページ一覧 `list00651.html` から `kiji003295/index.html` へのリンクを収集
- `kiji003295/index.html` 内の全 PDF リンクを一括取得

### Step 2: PDF リンクの取得

各詳細ページ（`kiji{ID}/index.html`）にアクセスし、PDF ファイルへのリンクを抽出する。

```
// PDF リンクの抽出パターン
const pdfLinks = $('a[href$=".pdf"]');
```

### Step 3: メタ情報の取得

詳細ページのタイトル（`<title>` タグまたはページ見出し）から以下を抽出:

- 会議種別: `定例会` / `臨時会`
- 年度: `令和X年` / `平成XX年`
- 回数: `第X回`
- 最終更新日: ページの更新日表示から取得

---

## 注意事項

- PDF ファイル名にはランダムなサフィックスが含まれており、ファイル名からメタ情報を推定することは困難。必ずページタイトルから取得すること
- 「もっと見る」ボタンの次ページ読み込みは JavaScript で実装されているため、静的 HTML 取得では全件を一度に取得できない。ページネーション URL を手動で追跡する必要がある
- 平成24年〜令和4年分は `kiji003295` の単一ページに集約されているため、個別の詳細ページは存在しない
- リクエスト間には適切な待機時間（1〜2秒）を設けること

---

## 推奨アプローチ

1. **一覧ページの全件取得**: autopager のページネーションを追跡し、定例会・臨時会の全詳細ページ URL を収集する
2. **平成24年〜令和4年の一括取得**: `kiji003295/index.html` の PDF リンクを一括取得し、ファイル名からメタ情報を補完する
3. **PDF の直接ダウンロード**: 各詳細ページから PDF URL を抽出し、PDFをダウンロードしてテキスト抽出する
4. **差分更新**: 詳細ページの更新日と既取得済みの kiji ID を比較して差分のみ取得する
