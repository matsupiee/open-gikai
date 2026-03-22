# 本山町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.motoyama.kochi.jp/soshikikarasagasu/gikaijimukyoku/teireirinnji/teireikairinzikaikaigiroku/index.html
- 分類: 自治体公式サイトに PDF を直接掲載（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: SMART CMS（自治体向け CMS）を使用。会議録は PDF 形式で年度別ページに掲載。令和4年〜令和7年分が公開されている。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.motoyama.kochi.jp/soshikikarasagasu/gikaijimukyoku/teireirinnji/teireikairinzikaikaigiroku/index.html` |
| 令和7年会議録 | `.../teireikairinzikaikaigiroku/3349.html` |
| 令和6年会議録 | `.../teireikairinzikaikaigiroku/1133.html` |
| 令和5年会議録 | `.../teireikairinzikaikaigiroku/2258.html` |
| 令和4年会議録 | `.../teireikairinzikaikaigiroku/2259.html` |
| PDF ファイル | `//www.town.motoyama.kochi.jp/material/files/group/12/{ファイル名}.pdf` |

---

## ページ構造

### トップページ（年度一覧）

`<ul class="level1col2">` 内に各年度ページへのリンクが `<li class="page">` で列挙される。

```html
<li class="page">
  <a href=".../3349.html">令和7年定例会・臨時会会議録</a>
</li>
```

### 年度別ページ

`<div class="free-layout-area">` 内に会議ごとのセクションが `<h3>` で区切られ、以下の構造で繰り返される。

```html
<!-- 会議名 -->
<h3>第9回本山町議会定例会会議録</h3>

<!-- 会期 -->
<div class="wysiwyg">
  <p>会期：令和6年12月3日～12月12日</p>
</div>

<!-- PDF リンク（1つ以上） -->
<p class="file-link-item">
  <a class="pdf" href="//www.town.motoyama.kochi.jp/material/files/group/12/061203.pdf">
    12月3日 開会日 (PDFファイル: 348.1KB)
  </a>
</p>
<p class="file-link-item">
  <a class="pdf" href="//www.town.motoyama.kochi.jp/material/files/group/12/061210.pdf">
    12月10日 一般質問 (PDFファイル: 1.1MB)
  </a>
</p>
```

---

## PDF ファイル命名規則

ファイル名に統一的な規則はなく、複数のパターンが混在している。

| パターン | 例 |
| --- | --- |
| `YYMMDD` | `061203.pdf`（令和6年12月3日） |
| `RYYMMDD` | `R061018.pdf`（令和6年10月18日） |
| `RY_MM_DD` | `R7_09_02.pdf`（令和7年9月2日） |
| `Y_M_D` | `6_6_4.pdf`（令和6年6月4日） |
| `RY_M_D` | `R6_3_5.pdf`（令和6年3月5日） |
| `YYYYMMDD` | `20240131.pdf`（2024年1月31日） |
| `M_D` | `3_4.pdf`（3月4日） |

---

## 会議の種別

PDF リンクのテキストおよび `<h3>` タイトルから以下の会議種別・議事種別が確認できる。

### 会議種別（h3 タイトルから抽出）

- 定例会: `第N回本山町議会定例会会議録`
- 臨時会: `第N回本山町議会臨時会会議録`

### 議事種別（PDF リンクテキストから抽出）

- 開会日（定例会開会日）
- 一般質問
- 議案審議
- 予算審査特別委員会（`令和X年度予算審査特別委員会`）
- 決算審査特別委員会（`令和X年度決算審査特別委員会`）
- 臨時会（`N月臨時会`）
- 一般質問・議案審議（複合）

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

トップページ `index.html` から `<ul class="level1col2">` 内のリンクを抽出し、各年度ページの URL を取得する。

**収集方法:**

1. トップページを取得
2. `ul.level1col2 li.page a` セレクタで年度ページリンクを抽出
3. リンクテキストから年度（令和X年）を取得

### Step 2: PDF リンクの収集

各年度ページから PDF リンクとメタ情報を抽出する。

**収集方法:**

1. 各年度ページの `div.free-layout-area` を取得
2. `<h3>` で会議セクションを分割
3. 各セクション内から以下を抽出:
   - 会議名: `<h3>` テキスト（例: `第9回本山町議会定例会会議録`）
   - 会期: `div.wysiwyg p` テキスト（例: `会期：令和6年12月3日～12月12日`）
   - PDF URL: `p.file-link-item a.pdf` の `href` 属性
   - PDF ラベル: `p.file-link-item a.pdf` のテキスト（例: `12月10日 一般質問`）

### Step 3: PDF のダウンロードとテキスト抽出

各 PDF をダウンロードし、テキストを抽出する。

- PDF URL は `//www.town.motoyama.kochi.jp/...` 形式（プロトコル省略）なので `https:` を付与する
- PDF からのテキスト抽出には `pdf-parse` 等のライブラリを使用

### Step 4: 会議録のパース

#### メタ情報

`<h3>` と `div.wysiwyg` から以下を抽出:

```typescript
// 会議名の抽出
const meetingPattern = /第(\d+)回本山町議会(定例会|臨時会)会議録/;

// 会期の抽出（単日）
const singleDatePattern = /会期：(令和\d+年\d+月\d+日)$/;

// 会期の抽出（期間）
const dateRangePattern = /会期：(令和\d+年\d+月\d+日)～(\d+月\d+日)/;
```

#### PDF リンクテキストからの日付・議事種別の抽出

```typescript
// "12月3日 開会日" → date: "12月3日", type: "開会日"
// "9月10日 一般質問" → date: "9月10日", type: "一般質問"
// "11月臨時会" → type: "臨時会"
const labelPattern = /^(\d+月\d+日)\s*(.+?)(?:\s*\(PDFファイル.*\))?$/;
const rinjiPattern = /^(\d+月)臨時会/;
```

---

## 注意事項

- PDF ファイル名に統一規則がないため、URL からの日付推定は不可。リンクテキストから日付を取得する必要がある
- PDF URL はプロトコル省略形式（`//www.town.motoyama.kochi.jp/...`）なので `https:` プレフィックスが必要
- 全 PDF が `/material/files/group/12/` ディレクトリに格納されている
- 年度ページの URL に使われる番号（1133, 2258, 2259, 3349）は CMS のページ ID であり、連番ではない
- 新年度が追加された場合、トップページに新しいリンクが増える形式

---

## 推奨アプローチ

1. **トップページ起点**: トップページから年度ページを自動検出するため、新年度追加時に URL のハードコードが不要
2. **PDF テキスト抽出**: 会議録は PDF 形式のみで HTML 本文は存在しないため、PDF パーサーが必須
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 各年度ページの「更新日」（`p.update` 要素）を記録しておき、更新があったページのみ再クロールする
