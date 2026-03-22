# 三戸町議会 カスタムスクレイピング方針

## 基本情報

| 項目 | 内容 |
|------|------|
| 自治体名 | 青森県三戸町 |
| 会議録URL | https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/index.html |
| 会議録形式 | PDF |
| 文字コード | UTF-8 |
| 使用システム | 自治体独自CMS（SMART CMS） |
| 収録範囲 | 令和3年（2021年）頃〜現在 |

## サイト構造

### 会議録インデックスページ

- URL: `https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/index.html`
- 年度別に会議録ページへのリンクを掲載
- 確認済みの年度別ページ:
  - 令和3年会議録: `/choseijoho/gikai/gikaijouhou/3/3882.html`
  - 令和4年会議録: `/choseijoho/gikai/gikaijouhou/3/3881.html`
  - 令和5年会議録: `/choseijoho/gikai/gikaijouhou/3/4246.html`
  - 令和6年会議録: `/choseijoho/gikai/gikaijouhou/3/4758.html`
  - 令和7年会議録: `/choseijoho/gikai/gikaijouhou/3/5145.html`
  - 令和8年会議録: `/choseijoho/gikai/gikaijouhou/3/5655.html`

### 年度別ページ（例: 令和6年会議録）

- URL: `https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/4758.html`
- ページ内に会議録PDFへの直接リンクが一覧表示される
- ページネーションなし（1ページに全件表示）
- 令和6年分として第515回〜第521回の議会会議録が掲載

### PDF リンクの HTML 構造

```html
<p class="file-link-item">
  <a class="pdf" href="//www.town.sannohe.aomori.jp/material/files/group/13/521kaigiroku.pdf">
    第521回三戸町議会定例会（令和6年12月議会）会議録 (PDFファイル: 665.5KB)
  </a>
</p>
```

- PDFリンクは `p.file-link-item > a.pdf` で取得可能
- リンクの `href` はプロトコル相対URL（`//www.town.sannohe.aomori.jp/...`）

### PDF の URL パターン

```
https://www.town.sannohe.aomori.jp/material/files/group/13/{ファイル名}.pdf
```

- `/material/files/group/13/` 配下に格納
- ファイル名パターン例:
  - `521kaigiroku.pdf` — 定例会・臨時会の会議録
  - `519teireikai.pdf` — 定例会会議録
  - `519kessantokubetu.pdf` — 決算特別委員会会議録
  - `516yosantokubetu.pdf` — 予算特別委員会会議録
  - `515rinjikaikaigiroku.pdf` — 臨時会会議録

### 令和6年 PDF 一覧

| 回次 | 会議名 | ファイル名 |
|------|--------|-----------|
| 第521回 | 定例会（令和6年12月議会） | 521kaigiroku.pdf |
| 第520回 | 臨時会（令和6年10月11日議会） | 520rinjikai.pdf |
| 第519回 | 定例会（決算特別委員会） | 519kessantokubetu.pdf |
| 第519回 | 定例会（令和6年9月議会） | 519teireikai.pdf |
| 第518回 | 臨時会（令和6年8月5日議会） | 518kaigiroku.pdf |
| 第517回 | 定例会（令和6年6月議会） | 517kaigiroku.pdf |
| 第516回 | 定例会（予算特別委員会） | 516yosantokubetu.pdf |
| 第516回 | 定例会（令和6年3月議会） | 516teireikaikaigiroku.pdf |
| 第515回 | 臨時会（令和6年1月29日議会） | 515rinjikaikaigiroku.pdf |

## ページネーション

なし。年度別ページ内に全PDFリンクが一覧表示される。

## スクレイピング方針

### 全体フロー

```
1. 会議録インデックスページをクロール
   ↓
2. 年度別ページのURLを収集
   ↓
3. 各年度別ページからPDFリンクを収集
   ↓
4. PDFをダウンロード
   ↓
5. PDFからテキストを抽出
```

### Step 1: インデックスページのクロール

- `https://www.town.sannohe.aomori.jp/choseijoho/gikai/gikaijouhou/3/index.html` を取得
- `.link-item a.icon` または `.free-layout-area a` で年度別ページへのリンクを抽出
- URLパターン: `/choseijoho/gikai/gikaijouhou/3/{数字ID}.html`

### Step 2: 年度別ページの解析

- 各年度別ページのHTMLを取得
- `p.file-link-item a.pdf` セレクタでPDFリンクを抽出
- リンクテキストから会議名・回次・開催時期を抽出
  - パターン: `第{回次}回三戸町議会{定例会|臨時会}（{開催時期}）会議録`

### Step 3: PDFのダウンロードとテキスト抽出

- `href` のプロトコル相対URLに `https:` を付与してダウンロード
- PDF解析ライブラリでテキストを抽出

## メタデータ抽出

| フィールド | 抽出元 | 抽出方法 |
|-----------|--------|---------|
| 会議名 | PDFリンクテキスト | `第○回三戸町議会(定例会\|臨時会)` を正規表現で抽出 |
| 回次 | PDFリンクテキスト | `第(\d+)回` を正規表現で抽出 |
| 開催時期 | PDFリンクテキスト | 括弧内の `令和○年○月議会` / `令和○年○月○日議会` を抽出 |
| 会議種別 | PDFリンクテキスト | `定例会` / `臨時会` / `特別委員会` を判定 |
| 年度 | 年度別ページタイトル | `令和○年会議録` から年度を抽出 |

## 注意事項

- PDFリンクの `href` はプロトコル相対URL（`//www.town.sannohe.aomori.jp/...`）のため、`https:` を先頭に付与する必要がある
- 同一回次で複数のPDFが存在する場合がある（例: 第519回は定例会と決算特別委員会の2ファイル、第516回は定例会と予算特別委員会の2ファイル）
- ファイル名の命名規則が統一されていない（`kaigiroku`, `teireikai`, `rinjikai`, `rinjikaikaigiroku` など）
- サイトへのアクセス間隔は適切に設定すること（1秒以上のウェイト推奨）
- 年度別ページのURLはCMSの数字IDベースのため、新年度追加時にIDの予測は不可能（インデックスページから辿る必要がある）
