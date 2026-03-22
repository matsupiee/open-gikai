# 北川村議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.kitagawamura.jp/life/list.php?hdnSKBN=B&hdnCat=800
- 分類: 村公式サイト CMS による PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: PDF 形式で定例会・臨時会の会期日程・審議結果を公開。会議録（全文書き起こし）は公開されておらず、審議結果の要約 PDF のみ

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 議会カテゴリ一覧 | `https://www.kitagawamura.jp/life/list.php?hdnSKBN=B&hdnCat=800` |
| 記事詳細 | `https://www.kitagawamura.jp/life/dtl.php?hdnKey={ID}` |
| PDF ダウンロード | `https://www.kitagawamura.jp/download/?t=LD&id={ページID}&fid={ファイルID}` |

---

## サイト構造

### 一覧ページ (`list.php`)

- カテゴリ `hdnCat=800` で議会関連の記事を一覧表示
- ページネーションは確認されず、全記事が 1 ページに表示される
- 各記事は `<a href="/life/dtl.php?hdnKey={ID}">` のリンクで詳細ページへ遷移
- 記事にはタイトル・担当課・掲載日が表示される
- 担当が「議会事務局」の記事が議会関連

### 詳細ページ (`dtl.php`)

- `hdnKey` パラメータで記事を特定
- PDF は `<div class="file_link">` 内の `<p class="icon-pdf">` で囲まれたリンクとして配置
- ダウンロード URL は `/download/?t=LD&id={ページID}&fid={ファイルID}` 形式

### 公開されている議会情報の種類

| 種類 | 例 |
| --- | --- |
| 定例会 会期日程・審議結果 | 令和7年第4回定例会 会期日程・審議結果 |
| 定例会 会期及び審議の予定 | 令和7年第4回北川村議会定例会 会期及び審議の予定 |
| 臨時会 会期日程・審議結果 | 令和7年第3回臨時会 会期日程・審議結果 |
| 臨時会 会期及び審議の予定 | 令和7年第3回臨時会 会期及び審議の予定 |

※ 議会の本会議全文書き起こし（会議録）は公開されていない。審議結果 PDF のみが対象となる。

---

## スクレイピング戦略

### Step 1: 議会関連記事の収集

一覧ページ `list.php?hdnSKBN=B&hdnCat=800` から議会事務局担当の記事リンクを抽出する。

**収集方法:**

1. 一覧ページの HTML を取得
2. `<a href="/life/dtl.php?hdnKey={ID}">` を抽出
3. 担当が「議会事務局」の記事のみをフィルタリング
4. タイトルに「定例会」「臨時会」を含む記事を対象とする

**抽出用セレクタ（Cheerio）:**

```typescript
// 記事リンクの抽出
const articles = $("div.list p a")
  .map((_, el) => {
    const href = $(el).attr("href");
    const spans = $(el).find("span");
    const title = spans.eq(0).text().trim();
    const meta = spans.eq(1).text().trim();
    return { href, title, meta };
  })
  .get();

// 議会事務局の記事のみフィルタ
const councilArticles = articles.filter(
  (a) => a.meta.includes("議会事務局") && /定例会|臨時会/.test(a.title)
);
```

### Step 2: 詳細ページから PDF リンクの取得

各詳細ページ `dtl.php?hdnKey={ID}` から PDF ダウンロードリンクを抽出する。

**抽出用セレクタ（Cheerio）:**

```typescript
// PDF リンクの抽出
const pdfLinks = $("div.file_link p.icon-pdf a")
  .map((_, el) => ({
    url: $(el).attr("href"), // "/download/?t=LD&id={ページID}&fid={ファイルID}"
    label: $(el).text().trim(), // "令和7年第4回定例会 会期日程・審議結果（PDF：132KB）"
  }))
  .get();
```

### Step 3: PDF のダウンロードとテキスト抽出

- PDF URL: `https://www.kitagawamura.jp/download/?t=LD&id={ページID}&fid={ファイルID}`
- PDF からテキストを抽出し、会議のメタ情報と審議結果を構造化する

#### メタ情報の抽出

タイトルから以下を正規表現で抽出:

```typescript
// タイトルからメタ情報を抽出
const titlePattern = /(?:令和|平成)(\d+)年第(\d+)回(定例会|臨時会)/;
// 例: "令和7年第4回定例会 会期日程・審議結果"
// → 年="7", 回="4", 種別="定例会"

// 日付付きタイトルの場合
const datePattern = /(?:令和|平成)(\d+)年(\d+)月(\d+)日/;
// 例: "令和6年第4回定例会(令和6年12月17日～18日)"
```

---

## 注意事項

- 北川村は小規模自治体（高知県安芸郡）のため、議会の本会議会議録（全文書き起こし）はウェブ上で公開されていない
- 公開されているのは会期日程と審議結果の要約 PDF のみ
- 農業委員会議事録も同一カテゴリで公開されているが、村議会とは別組織のため対象外とする
- PDF ファイルサイズは 30KB〜200KB 程度と小さく、内容は審議結果の一覧表が中心
- ページ ID（`hdnKey`）は連番だが全カテゴリ共通のため、議会関連以外の記事も含まれる

---

## 推奨アプローチ

1. **一覧ページから一括取得**: カテゴリ一覧ページにページネーションがないため、1 回のリクエストで全記事を取得可能
2. **担当課でフィルタリング**: 「議会事務局」担当の記事のみを対象とし、ノイズを排除
3. **PDF テキスト抽出**: 審議結果 PDF からテキストを抽出して構造化データに変換
4. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
5. **差分更新**: 掲載日でソートされているため、前回取得以降の新着記事のみを処理する差分更新が可能
