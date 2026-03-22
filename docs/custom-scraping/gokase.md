# 五ヶ瀬町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.gokase.miyazaki.jp/kakuka/gikai/honkaigi/kaigiroku/index.html
- 分類: 自治体 CMS（SMART CMS）による PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録は PDF 形式で年度ごとにページ分割。1 PDF = 1 定例会/臨時会の全会議録

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（トップ） | `https://www.town.gokase.miyazaki.jp/kakuka/gikai/honkaigi/kaigiroku/index.html` |
| 年度別会議録ページ | `https://www.town.gokase.miyazaki.jp/kakuka/gikai/honkaigi/kaigiroku/{slug}.html` |
| PDF ファイル | `https://www.town.gokase.miyazaki.jp/material/files/group/9/{filename}.pdf` |

### 年度別ページの slug 一覧

| 年度 | slug | URL |
| --- | --- | --- |
| 平成29年 | `H29kaigiroku` | `.../kaigiroku/H29kaigiroku.html` |
| 平成30年 | `H30kaigiroku` | `.../kaigiroku/H30kaigiroku.html` |
| 平成31・令和元年 | `790` | `.../kaigiroku/790.html` |
| 令和2年 | `1042` | `.../kaigiroku/1042.html` |
| 令和3年 | `1216` | `.../kaigiroku/1216.html` |
| 令和4年 | `1321` | `.../kaigiroku/1321.html` |
| 令和5年 | `1647` | `.../kaigiroku/1647.html` |
| 令和6年 | `1849` | `.../kaigiroku/1849.html` |
| 令和7年 | `2052` | `.../kaigiroku/2052.html` |

※ 平成29〜30年は `H{和暦}kaigiroku` 形式、令和元年以降は CMS の数値 ID 形式。新年度のページが追加されると slug は予測不可能なため、トップページから動的に取得する必要がある。

---

## PDF ファイル名パターン

PDF のファイル名に統一的な命名規則はなく、年度によって異なる。以下に代表的なパターンを示す。

### 平成29年（旧形式）

```
H29_1_teireikaikaigiroku.pdf    → 第1回定例会
H29_2_teireikaikaigiroku.pdf    → 第2回定例会
H29_1_rinnjikaigiroku.pdf       → 第1回臨時会
H29_3_teireikaikaigiroku.pdf    → 第3回定例会
H29_4_teireikaikaigiroku.pdf    → 第4回定例会
```

### 令和2年（過渡期）

```
R2_1_rinjikaigiroku.pdf         → 第1回臨時会
R2_2_rinjikaigiroku.pdf         → 第2回臨時会
R2_1_kaigiroku.pdf              → 第1回定例会
R02_2_kaigiroku.pdf             → 第2回定例会（R02 表記の揺れあり）
R02_3_rinjikaigiroku.pdf        → 第3回臨時会
R02_3_kaigiroku.pdf             → 第3回定例会
R02_4_kaigiroku.pdf             → 第4回定例会
```

### 令和6年（新形式）

```
teireikai0601.pdf               → 第1回定例会
rinnjikai0601.pdf               → 第1回臨時会
06062kaigiroku.pdf              → 第2回定例会
202409gijiroku.pdf              → 第3回定例会（西暦+月形式）
0604kaigiroku.pdf               → 第4回定例会
```

### 令和7年（最新形式）

```
0701kaigiroku.pdf               → 第1回定例会
0701rinnjikaikaigiroku.pdf      → 第1回臨時会
0702teirei.pdf                  → 第2回定例会
0702rinnjikaikaigiroku.pdf      → 第2回臨時会
0703rinnjikaikaigiroku.pdf      → 第3回臨時会
0703kaigiroku.pdf               → 第3回定例会
202512kaigiroku.pdf             → 第4回定例会（西暦+月形式）
```

※ ファイル名に統一性がないため、ファイル名からのメタ情報抽出は困難。リンクテキストからメタ情報を取得する方針とする。

---

## HTML 構造

### トップページ（年度一覧）

年度別ページへのリンクが `ul.level1col2` 内の `li.page > a` として並ぶ。

```html
<ul class="level1col2 clearfix">
  <li class="page">
    <a href=".../H29kaigiroku.html">平成29年会議録</a>
  </li>
  <li class="page">
    <a href=".../1849.html">令和6年会議録</a>
  </li>
  ...
</ul>
```

### 年度別ページ（PDF リンク）

PDF リンクは 2 種類の HTML 形式が混在する。

**旧形式（平成29年〜令和3年頃）:**

```html
<div class="wysiwyg">
  <p><a target="_blank" class="icon2" href="//www.town.gokase.miyazaki.jp/material/files/group/9/{filename}.pdf">
    令和2年第1回(3月)定例会会議録(PDFファイル:2.1MB)
  </a></p>
</div>
```

**新形式（令和4年頃〜）:**

```html
<p class="file-link-item"><a class="pdf" href="//www.town.gokase.miyazaki.jp/material/files/group/9/{filename}.pdf">
  令和6年第1回(3月)定例会会議録 (PDFファイル: 1.7MB)
</a></p>
```

### リンクテキストのパターン

```
{元号}{年}年第{回数}回({月})定例会会議録 (PDFファイル: {サイズ})
{元号}{年}年第{回数}回({月})臨時会会議録 (PDFファイル: {サイズ})
```

※ 旧形式ではファイルサイズ表記の括弧前にスペースがない場合がある: `(PDF:1.6MB)` vs `(PDFファイル: 1.7MB)`

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

トップページ `index.html` の `ul.level1col2` から各年度ページへのリンクを収集する。

```typescript
// セレクタ
const yearLinks = $("ul.level1col2 li.page a");
// 各リンクの href と text を取得
// text 例: "令和6年会議録" → 年度情報の抽出に使用
```

### Step 2: PDF URL とメタ情報の収集

各年度ページから PDF リンクを収集する。旧形式・新形式の両方に対応する必要がある。

```typescript
// 旧形式: div.wysiwyg 内の a.icon2[href$=".pdf"]
// 新形式: p.file-link-item a.pdf[href$=".pdf"]
// 統合セレクタ:
const pdfLinks = $('a.icon2[href$=".pdf"], a.pdf[href$=".pdf"]');
```

**リンクテキストからのメタ情報抽出:**

```typescript
const metaPattern = /^(.+?)年第(\d+)回\((\d+)月\)(定例会|臨時会)会議録/;
// グループ: [1]=元号+年, [2]=回数, [3]=月, [4]=会議種別
// 例: "令和6年第1回(3月)定例会会議録" → 元号年="令和6", 回=1, 月=3, 種別="定例会"
```

### Step 3: PDF のダウンロードとテキスト抽出

- PDF を一時ディレクトリにダウンロード
- `pdf-parse` 等のライブラリでテキスト抽出
- 1 PDF に 1 定例会/臨時会分の全会議録が含まれるため、PDF 単位で処理する

---

## 注意事項

- PDF ファイルの URL はプロトコル相対（`//www.town.gokase.miyazaki.jp/...`）で記述されているため、`https:` を先頭に付与する必要がある
- PDF ファイル名の命名規則が年度ごとに異なるため、ファイル名ではなくリンクテキストからメタ情報を取得する
- 年度別ページの slug（URL パス）は H29/H30 以外は CMS の数値 ID で予測不可能。新年度のページは必ずトップページから動的に取得する
- 1 PDF に定例会/臨時会全体の会議録がまとまっており、日ごとの分割はされていない
- PDF のサイズは 200KB〜2.5MB 程度

---

## 推奨アプローチ

1. **2 段階クロール**: トップページ → 年度別ページ → PDF URL の順で収集
2. **リンクテキストからメタ情報を抽出**: PDF ファイル名は不統一のため、リンクテキストを正規表現でパースして元号・年・回数・月・会議種別を取得する
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: トップページの年度リンク一覧を取得し、最新年度のページのみ再クロールすることで差分更新が可能
5. **PDF テキスト抽出**: PDF 内のテキストは `pdf-parse` 等で抽出し、発言者・発言内容の構造化は PDF の内容に応じて別途検討する
