# 上勝町議会 カスタムスクレイピング方針

## 概要

- サイト: http://www.kamikatsu.jp/gikai/
- 分類: Joruri CMS による HTML 公開（専用検索システムなし）
- 文字コード: UTF-8
- 特記: Google Analytics (G-18HENSPCQE) 使用。専用の会議録検索システムはなく、議員紹介・議決書・議会だより・お知らせを公式サイト内で直接公開している形式。テキスト形式の会議録（発言録）は存在せず、主なコンテンツは PDF ファイル。TLS 証明書に問題があるため HTTP でのアクセスが必要（`rejectUnauthorized: false` 等の対応が必要な場合あり）。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会トップ | `http://www.kamikatsu.jp/gikai/` |
| お知らせ一覧（p.1） | `http://www.kamikatsu.jp/gikai/docs/` |
| お知らせ一覧（p.N） | `http://www.kamikatsu.jp/gikai/docs/index.pN.html` |
| 記事詳細 | `http://www.kamikatsu.jp/gikai/docs/{YYYYMMDD}{5桁連番}/` |
| 議員紹介 | `http://www.kamikatsu.jp/gikai/shokai/` |
| 議決書カテゴリ（最新10件） | `http://www.kamikatsu.jp/gikai/category/zokusei/giketusho/` |
| 議決書一覧（全件） | `http://www.kamikatsu.jp/gikai/category/zokusei/giketusho/more.html` |
| 議決書（年別一覧） | `http://www.kamikatsu.jp/gikai/hongaiyou/H{和暦年}.html` |
| 議会だよりバックナンバー（最新10件） | `http://www.kamikatsu.jp/gikai/category/zokusei/gikaidayori/` |
| 議会だより全件一覧 | `http://www.kamikatsu.jp/gikai/category/zokusei/gikaidayori/more.html` |
| 議会だより（タグ別） | `http://www.kamikatsu.jp/gikai/tag/{年号}{年}議会だより/` |

---

## コンテンツの種類と構造

### 1. 議決書（`/gikai/category/zokusei/giketusho/`）

本会議の議決内容を PDF で公開している。テキスト形式の会議録（発言録）ではない。

**一覧ページの HTML 構造:**

```html
<section class="categoryGiketusho">
  <div class="docs">
    <ul>
      <li>
        <span class="title_link"><a href="/gikai/docs/2014011600034/">平成25年第5回定例会(12月)</a></span>
        (<span class="publish_date">2013年12月20日</span> <span class="group">総務課</span>)
      </li>
    </ul>
  </div>
  <div class="more">
    <a href="/gikai/category/zokusei/giketusho/more.html">一覧へ</a>
  </div>
</section>
```

- トップカテゴリページには最新10件のみ表示
- `more.html` に全件一覧あり（ページネーションなし・全件一覧）
- 年別一覧ページ（`/gikai/hongaiyou/H{和暦年}.html`）は平成22年〜平成25年のみ存在（以降は別方式）

**詳細ページの HTML 構造:**

```html
<article class="contentGpArticleDoc">
  <div class="date">
    <p class="publishedAt">公開日 2013年12月20日</p>
  </div>
  <div class="body">
    <div class="text-beginning">
      <p><a class="iconFile iconPdf" href="file_contents/H25_teireikai_5th.pdf">
        平成25年第5回定例会（12月）.pdf(72.8KBytes)
      </a></p>
    </div>
  </div>
</article>
```

- 本文は PDF ファイルへのリンクのみ（HTML テキスト形式なし）
- PDF の URL は `file_contents/{ファイル名}.pdf`（相対パス）
- フルパスは `http://www.kamikatsu.jp/gikai/docs/{記事ID}/file_contents/{ファイル名}.pdf`

### 2. 議会だより（`/gikai/category/zokusei/gikaidayori/`）

各号の PDF を公開。テキスト形式の会議録ではない。

- 100号（令和7年11月）まで確認済み（2026年3月時点）
- 平成17年〜現在まで公開
- タグ（`/gikai/tag/{年号}{年}議会だより/`）で年別に絞り込み可能

**詳細ページの HTML 構造:**

```html
<article class="contentGpArticleDoc">
  <div class="date">
    <p class="publishedAt">公開日 2026年02月01日</p>
  </div>
  <div class="body">
    <table class="gikaibox">
      <tr>
        <td><img alt="100_.jpg" src="file_contents/thumb/100_.jpg" /></td>
        <td>
          <h2>議会だより上勝<br />第100号</h2>
          <h3>令和７年11月</h3>
          <a class="iconFile iconPdf" href="file_contents/100.pdf">100.pdf[PDF：3.25MB]</a>
        </td>
      </tr>
    </table>
  </div>
  <div class="tags">
    <ul>
      <li><a href="/gikai/tag/令和7年議会だより/">令和7年議会だより</a></li>
    </ul>
  </div>
</article>
```

### 3. お知らせ（`/gikai/docs/`）

定例会の会議日程・議会だより・その他お知らせを混在して掲載。

**一覧ページのページネーション:**

```html
<div class="pagination" page_uri="/gikai/docs/">
  <span class="previous_page disabled">前へ</span>
  <em class="current" aria-current="page">1</em>
  <a rel="next" href="/gikai/docs/index.p2.html">2</a>
  <a href="/gikai/docs/index.p3.html">3</a>
  <a href="/gikai/docs/index.p4.html">4</a>
  <a class="next_page" rel="next" href="/gikai/docs/index.p2.html">次へ</a>
</div>
```

- ページネーション URL パターン: `/gikai/docs/index.p{N}.html`（N は 2 以上）
- 1ページあたりの件数: 約20件

---

## スクレイピング戦略

### 重要な前提

**このサイトには発言録（テキスト形式の会議録）は存在しない。** 議決書・議会だよりはすべて PDF 形式での公開であり、テキスト抽出には PDF パース処理が必要となる。

### Step 1: 記事 URL の収集

**議決書の場合:**

1. `/gikai/category/zokusei/giketusho/more.html` にアクセスして全件一覧を取得
2. `<a href="/gikai/docs/{記事ID}/">` のパターンでリンクを抽出

**議会だよりの場合:**

1. `/gikai/category/zokusei/gikaidayori/more.html` にアクセスして全件一覧を取得
2. または タグ別ページ `/gikai/tag/{年号}{年}議会だより/` を年ごとに巡回
3. `<a href="/gikai/docs/{記事ID}/">` のパターンでリンクを抽出

**お知らせ（一般記事）の場合:**

1. `/gikai/docs/` から開始し、ページネーションで全ページを巡回
2. URL パターン: `/gikai/docs/index.p{N}.html`（N=2,3,4,...）
3. `<div class="pagination">` 内に `次へ` リンクがなくなるまで繰り返す

### Step 2: PDF URL の取得

各記事詳細ページから PDF ファイルの URL を取得する。

```typescript
// 議決書・議会だより詳細ページから PDF リンクを抽出
const pdfLinks = $('a.iconFile.iconPdf');
// href は相対パス "file_contents/{ファイル名}.pdf"
// フル URL: `${記事ページURL}file_contents/{ファイル名}.pdf`
```

### Step 3: メタ情報のパース

**記事タイトルの抽出:**

```typescript
const title = $('h1').text().trim();
// 例: "平成25年第5回定例会(12月)" or "議会だより上勝100号"
```

**公開日の抽出:**

```typescript
const publishedAt = $('p.publishedAt').text().replace('公開日 ', '').trim();
// 例: "2013年12月20日"
```

**タグ（年別分類）の抽出（議会だよりのみ）:**

```typescript
const tags = $('div.tags a').map((_, el) => $(el).text()).get();
// 例: ["令和7年議会だより"]
```

---

## 記事 ID の構造

URL の記事 ID は `{YYYYMMDD}{5桁連番}` の形式。

例: `/gikai/docs/2014011600034/`
- `20140116`: 登録日（2014年01月16日）
- `00034`: 連番

この ID 体系から「前回取得済み最大 ID 以降のみ取得」する差分更新は困難。代わりに公開日（`publishedAt`）ベースで差分判定する。

---

## 注意事項

- **TLS 証明書エラー**: `www.kamikatsu.jp` は TLS 証明書の SAN（Subject Alternative Name）に問題があるため HTTPS でのアクセスがブロックされる場合がある。HTTP でアクセスするか、証明書検証をスキップする設定が必要。
- **会議録（発言録）なし**: テキスト形式の会議録は公開されていない。議決書は審議結果のみを記載した PDF であり、発言内容は含まれない。
- **PDF のみのコンテンツ**: すべての主要コンテンツは PDF。テキスト抽出には PDF パースライブラリ（例: `pdf-parse`）が必要。
- **更新頻度**: 定例会は年4回程度（3月・6月・9月・12月）。議会だよりも年4回程度発行。
- **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける。
- **CMS**: Joruri CMS（徳島県産オープンソース CMS）を使用。ページ構造は Joruri の標準テンプレートに基づく。

---

## 推奨アプローチ

1. **PDF 取得を主目的とする**: テキスト会議録がないため、PDF を収集して後段で OCR / PDF パースを行うパイプラインとして設計する
2. **カテゴリ別に分けて収集**: 議決書と議会だよりは別カテゴリとして独立して収集する
3. **`more.html` を起点にする**: カテゴリ一覧の `more.html` には全件が掲載されているためページネーション処理不要
4. **公開日ベースの差分更新**: 前回取得時の最新公開日を記録し、それ以降の記事のみ取得する
