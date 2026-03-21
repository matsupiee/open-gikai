# 下仁田町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.shimonita.lg.jp/m08/m02/index.html
- 分類: PDF 年別公開（既存アダプターでは対応不可）
- 文字コード: UTF-8（BOM 付き）
- 特記: 検索機能なし。会議録は PDF ファイルで公開されており、HTML 本文の会議録ページは存在しない

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（年別リンク集） | `https://www.town.shimonita.lg.jp/m08/m02/index.html` |
| 年別ページ（令和6年の例） | `https://www.town.shimonita.lg.jp/gikai/m01/m02/2024_gikai_kaigiroku.html` |
| PDF ファイル（新しい年） | `https://www.town.shimonita.lg.jp/gikai/m01/m02/{YYYYMMDD}_{type}.pdf` |
| PDF ファイル（古い年） | `https://www.town.shimonita.lg.jp/gikai/content/{YYYYMMDD}{type}.pdf` |

### 年別ページの URL 一覧

年別ページの URL はパターンが統一されておらず、すべてトップページ（`index.html`）から取得する必要がある。

| 年 | URL |
| --- | --- |
| 令和7年 | `/gikai/m01/m02/20250509165638.html` |
| 令和6年 | `/gikai/m01/m02/2024_gikai_kaigiroku.html` |
| 令和5年 | `/gikai/m01/m02/2023_gikai_kaigiroku.html` |
| 令和4年 | `/gikai/m01/m02/2022_gikai_kaigiroku.html` |
| 令和3年 | `/gikai/m01/m02/20210520160951.html` |
| 令和2年 | `/gikai/m01/m02/2020.html` |
| 令和元年 | `/gikai/m01/m02/20190520150618.html` |
| 平成30年 | `/gikai/m01/m02/20180521111536.html` |
| 平成29年 | `/gikai/m01/m02/20170303113755.html` |
| 平成28年 | `/gikai/m01/m02/2016gijiroku.html` |
| 平成27年 | `/gikai/m01/m02/20160224111937.html` |
| 平成26年 | `/gikai/m01/m02/010.html` |
| 平成25年 | `/gikai/m01/m02/09.html` |
| 平成24年 | `/gikai/m01/m02/08.html` |

---

## 検索パラメータ

検索機能は存在しない。すべての会議録は年別ページから PDF リンクとして提供される。

---

## HTML 構造の詳細

### トップページ（年別リンク集）

年別ページへのリンクは `ul.menu_list > li.linkList > a` で構成される。

```html
<ul class="menu_list">
  <li class="linkList"><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20250509165638.html">令和7年版</a></li>
  <li class="linkList"><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/2024_gikai_kaigiroku.html">令和6年版</a></li>
  ...
</ul>
```

### 年別ページ（新しい形式: 令和2年〜）

会議種別ごとに `<p>` タグで見出し + `<table>` で PDF リンクを表示。

```html
<p>【令和6年12月定例会】</p>
<table border="1">
  <tbody>
    <tr>
      <td><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20241209_teirei.pdf">会議録第1号12月9日</a></td>
      <td><a href="https://www.town.shimonita.lg.jp/gikai/m01/m02/20241210_teirei.pdf">会議録第2号12月10日</a></td>
    </tr>
  </tbody>
</table>
```

- 会議種別の見出し: `【{和暦}年{月}月{定例会|臨時会}】` 形式
- PDF リンクのテキスト: `会議録第{N}号{M}月{D}日` 形式

### 年別ページ（古い形式: 平成24年〜平成30年頃）

Excel/Word 由来のスタイル付きテーブルで構成。2列構成で左セルに会議種別名、右セルに PDF リンク。

```html
<table border="0" cellspacing="0" cellpadding="0" width="481">
  <tbody>
    <tr>
      <td class="xl67" rowspan="3" style="background-color: #daeef3">
        <span style="font-family: ＭＳ Ｐゴシック">平成26年12月定例会</span>
      </td>
      <td class="xl66">
        <span style="font-family: ＭＳ Ｐゴシック">
          <a href="https://www.town.shimonita.lg.jp/gikai/content/20141205teirei.pdf">会議録第１号　12月5日 （263KB）</a>
        </span>
      </td>
    </tr>
  </tbody>
</table>
```

- 会議種別セルが `rowspan` で結合されている
- ファイルサイズが括弧内に記載されている場合がある（例: `（263KB）`）

---

## PDF ファイル名パターン

PDF の URL パスとファイル名の命名規則は年代によって異なる。

### 新しい形式（令和元年〜）

- パス: `/gikai/m01/m02/`
- ファイル名: `{YYYYMMDD}_{type}.pdf`
- 定例会: `20241209_teirei.pdf`
- 臨時会: `20240722_rinji.pdf`

### 古い形式（平成24年〜平成30年頃）

- パス: `/gikai/content/` または `/gikai/m01/m02/`
- ファイル名: `{YYYYMMDD}{type}.pdf`（アンダースコアなし）
- 定例会: `20141205teirei.pdf`
- 臨時会: `20141125rrinnji.pdf`（typo: `rrinnji` と二重 r）
- 一部例外あり: `0310teirei01.pdf`（年なし + 連番）、`20140606teire.pdf`（`i` 欠落）

---

## スクレイピング戦略

### Step 1: 年別ページ URL の収集

トップページ `https://www.town.shimonita.lg.jp/m08/m02/index.html` から年別ページへのリンクを抽出する。

**収集方法:**

1. トップページの `ul.menu_list > li.linkList > a` からすべてのリンクを取得
2. リンクテキスト（例: `令和6年版`）から年情報を抽出

### Step 2: PDF リンクの収集

各年別ページから PDF ファイルへのリンクとメタ情報を抽出する。

**収集方法:**

1. 年別ページの `article.article` 内のすべての `<a>` タグから `.pdf` で終わるリンクを抽出
2. リンクの前にある会議種別見出し（`【...定例会】` または `【...臨時会】`、もしくはテーブル内の会議種別セル）を取得
3. リンクテキストから会議録番号と日付を抽出

**抽出する情報:**

- PDF の URL
- 会議種別（定例会 / 臨時会）
- 開催月
- 会議録番号（第N号）
- 開催日

### Step 3: PDF のダウンロードとテキスト抽出

PDF ファイルをダウンロードし、テキストを抽出する。

- PDF パーサー（pdf-parse 等）でテキストを抽出
- 会議録 PDF のため、発言者・発言内容のパースが必要

### Step 4: テキストのパース

PDF から抽出したテキストをパースして構造化する。

※ PDF の内部構造はダウンロードして確認する必要がある。以下は一般的な議会会議録 PDF のパターンに基づく想定。

#### メタ情報の抽出（想定）

PDF 冒頭に以下のような情報が含まれることが多い:

- 会議名（例: 令和6年第4回下仁田町議会定例会会議録）
- 開催日（例: 令和6年12月9日）
- 開催場所
- 出席議員

#### 発言者パターン（想定）

一般的な議会会議録 PDF では以下のパターンが使われることが多い:

```
○議長（氏名）
○N番（氏名）
○町長（氏名）
```

※ 実際のパターンは PDF をダウンロードして確認が必要。

---

## ページネーション

なし。各年別ページに当該年のすべての会議録 PDF リンクが一覧で掲載されている。

---

## 注意事項

- **PDF 形式のみ**: HTML 形式の会議録は存在しない。PDF のダウンロードとテキスト抽出が必須
- **URL パターンの不統一**: 年別ページの URL、PDF ファイルの URL ともにパターンが統一されていない。トップページからのリンク収集が必須
- **古い年の HTML が複雑**: 平成26年以前のページは Excel/Word 由来のインラインスタイルが大量に含まれる
- **ファイル名の typo**: 古い PDF ファイル名に typo がある（`rrinnji`、`teire` など）。ファイル名からの会議種別判定ではなく、リンク周辺のテキストから判定すべき
- **PDF パス変更**: 古い年は `/gikai/content/`、新しい年は `/gikai/m01/m02/` とパスが異なる
- **会議種別**: 定例会（3月・6月・9月・12月）と臨時会のみ。常任委員会等の会議録は公開されていない

---

## 推奨アプローチ

1. **2段階クロール**: トップページ → 年別ページ → PDF リンクの2段階でリンクを収集
2. **リンクテキストベースの解析**: ファイル名パターンが不統一のため、`<a>` タグのテキストおよび周辺の会議種別見出しからメタ情報を抽出する
3. **PDF テキスト抽出の事前検証**: 実際に数件の PDF をダウンロードし、テキスト抽出の品質（文字化け、レイアウト崩れ等）を検証してからパーサーを実装する
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: トップページの年別リンク一覧を監視し、新しい年が追加された場合のみ追加クロールを行う
