# 藤崎町議会（青森県） カスタムスクレイピング方針

## 概要

- サイト: https://www.town.fujisaki.lg.jp/index.cfm/9,17429,html
- 分類: 町公式サイト（ColdFusion CMS）で会議録を PDF 公開。年度ごと・会期ごとにページを分けて掲載
- 文字コード: UTF-8
- 特記: 検索機能なし。平成21年（2009年）から令和8年（2026年）まで18年分の会議録を公開

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会カテゴリトップ | `https://www.town.fujisaki.lg.jp/index.cfm/9,0,83,html` |
| 定例会・臨時会一覧 | `https://www.town.fujisaki.lg.jp/index.cfm/9,0,83,221,html` |
| 年度別ページ | `https://www.town.fujisaki.lg.jp/index.cfm/9,{ContentID},html` |
| PDF ファイル | `https://www.town.fujisaki.lg.jp/index.cfm/9,{ContentID},c,html/{ContentID}/{ファイル名}.pdf` |

### 年度別ページの ContentID 一覧

| 年度 | URL |
| --- | --- |
| 平成21年 | `/index.cfm/9,1213,83,221,html` |
| 平成22年 | `/index.cfm/9,1212,83,221,html` |
| 平成23年 | `/index.cfm/9,1276,83,221,html` |
| 平成24年 | `/index.cfm/9,4246,83,221,html` |
| 平成25年 | `/index.cfm/9,4388,83,221,html` |
| 平成26年 | `/index.cfm/9,5230,83,221,html` |
| 平成27年 | `/index.cfm/9,6107,83,221,html` |
| 平成28年 | `/index.cfm/9,7319,83,221,html` |
| 平成29年 | `/index.cfm/9,8777,83,221,html` |
| 平成30年 | `/index.cfm/9,10010,83,221,html` |
| 令和元年 | `/index.cfm/9,11186,83,221,html` |
| 令和2年 | `/index.cfm/9,12539,83,221,html` |
| 令和3年 | `/index.cfm/9,14290,83,221,html` |
| 令和4年 | `/index.cfm/9,15736,83,221,html` |
| 令和5年 | `/index.cfm/9,17429,83,221,html` |
| 令和6年 | `/index.cfm/9,18933,83,221,html` |
| 令和7年 | `/index.cfm/9,20469,83,221,html` |
| 令和8年 | `/index.cfm/9,21976,83,221,html` |

---

## HTML 構造

### 年度別ページの本文構造

各年度ページは `<div class="contentBody">` 内に `<table>` で会期ごとのセクションを構成している。

```html
<div class="content">
  <section>
    <h2 class="titleOfContent">令和5年　定例会・臨時会</h2>
    <div class="contentBodyBox">
      <div class="contentBody">
        <table border="1" ...>
          <tbody>
            <tr>
              <td style="text-align: center;">
                <p>令和5年第1回定例会</p>
                <p>(令和5年3月定例会)</p>
              </td>
              <td>
                <p>1&nbsp;<a href="/index.cfm/9,17429,c,html/17429/20230222-092339.pdf"
                   title="令和5年第1回定例会日程表 [74KB pdfファイル]">
                   令和5年第1回定例会日程表 [74KB pdfファイル]
                   <img src="/images/icons/pdf.gif"></a></p>
                <p>2&nbsp;<a href="...">...</a></p>
                <!-- 以下、番号付きで PDF リンクが続く -->
              </td>
            </tr>
            <!-- 次の会期の <tr> が続く -->
          </tbody>
        </table>
      </div>
    </div>
  </section>
</div>
```

### テーブル構造の詳細

- 各 `<tr>` が1つの会期（定例会 or 臨時会）に対応
- 左 `<td>`: 会期名（「令和5年第1回定例会」「(令和5年3月定例会)」）
- 右 `<td>`: 番号付き PDF リンクのリスト（`<p>` タグで1行ずつ）
- PDF リンクの `<a>` タグに `title` 属性あり（ファイル名とサイズ情報を含む）
- PDF アイコン画像: `<img src="/images/icons/pdf.gif">`

### PDF の種類（リンクテキストで区別）

| 種類 | リンクテキストの例 |
| --- | --- |
| 日程表 | `令和5年第1回定例会日程表` |
| 議案目録 | `令和5年第1回定例会議案目録` |
| 一般質問通告表 | `令和5年第1回定例会一般質問通告表` |
| **会議録** | `令和5年第1回定例会会議録（開会）` |
| **会議録** | `令和5年第1回定例会会議録（一般質問）` |
| **会議録** | `令和5年第1回定例会会議録（議案審議）` |
| **会議録** | `令和5年第1回定例会会議録（予算特別委員会1日）` |
| 議決結果 | `令和5年第1回定例会議決結果` |

スクレイピング対象は「会議録」を含むリンクのみ。

---

## ページネーション

ページネーションなし。各年度ページに当該年度の全会期分が1ページにまとめて掲載されている。

---

## スクレイピング方針

### Step 1: 年度別ページ URL の取得

定例会・臨時会一覧ページ (`/index.cfm/9,0,83,221,html`) から年度別ページへのリンクを取得する。リンクは `/index.cfm/9,{ContentID},83,221,html` のパターン。

### Step 2: 各年度ページから会議録 PDF リンクを抽出

1. `<div class="contentBody">` 内の `<table>` を取得
2. 各 `<tr>` をイテレーションし、左 `<td>` から会期名を取得
3. 右 `<td>` 内の `<a>` タグで `.pdf` を含むリンクを抽出
4. リンクテキストまたは `title` 属性に「会議録」を含むもののみをフィルタリング
5. PDF の URL は相対パスのため、`https://www.town.fujisaki.lg.jp` をベースに絶対 URL を構築

### Step 3: PDF のダウンロードとテキスト抽出

- PDF URL パターン: `/index.cfm/9,{ContentID},c,html/{ContentID}/{ファイル名}.pdf`
- ファイル名は `YYYYMMDD-HHMMSS.pdf`（タイムスタンプ形式）または `r05-02t-02-0606.pdf`（年度・会期コード形式）の2パターンが混在
- PDF からテキストを抽出して保存

### 会議録のメタデータ

リンクテキストと会期名から以下を推定:

- **年度**: ページタイトル（例: 「令和5年」）
- **会期**: テーブル左列（例: 「令和5年第1回定例会」「(令和5年3月定例会)」）
- **種別**: リンクテキストの括弧内（例: 「開会」「一般質問」「議案審議」「予算特別委員会1日」）
