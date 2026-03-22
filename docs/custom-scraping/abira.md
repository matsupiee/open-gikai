# 安平町 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.abira.lg.jp/gyosei/kaigiroku
- 分類: 独自 CMS による HTML + PDF 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: 会議録本文は PDF で提供。ページネーションは bootpag（jQuery プラグイン）による DOM 切り替え方式（全データが単一 HTML に含まれる）

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（全体） | `https://www.town.abira.lg.jp/gyosei/kaigiroku` |
| カテゴリ別一覧 | `https://www.town.abira.lg.jp/gyosei/kaigiroku/{カテゴリ名}` |
| 会議録詳細（全体から） | `https://www.town.abira.lg.jp/gyosei/kaigiroku/{数値ID}` |
| 会議録詳細（カテゴリから） | `https://www.town.abira.lg.jp/gyosei/kaigiroku/{カテゴリ名}/{数値ID}` |
| PDF ファイル | `https://www.town.abira.lg.jp/webopen/content/{数値ID}/{ファイル名}.pdf` |

---

## カテゴリ一覧

会議録一覧ページからリンクされているカテゴリ（一部抜粋）:

| カテゴリ slug | 会議体名称 |
| --- | --- |
| `gikai` | 議会本会議（定例会、臨時会） |
| `soumu` | 総務常任委員会 |
| `keizai` | 経済常任委員会 |
| `kyoiku` | 教育委員会 |
| `nogyo` | 農業委員会 |
| `senkyo` | 選挙管理委員会 |
| `kotei` | 固定資産評価審査委員会 |
| `bosai` | 防災会議 |
| `kaikaku` | 行政改革推進委員会 |
| `yosan` | 予算審査特別委員会 |
| `kessan` | 決算審査特別委員会 |
| `gikaikaikaku` | 議会改革推進特別委員会 |
| `kokai` | 情報公開・個人情報保護審査会 |
| `kaigo` | 介護保険運営協議会 |
| `kenkohoken` | 国民健康保険運営協議会 |
| `kodomo` | 子ども・子育て会議 |
| `kankyo` | 環境審議会 |
| `kotsu` | 交通体系審議会 |
| `toshikei` | 都市計画審議会 |
| `handotai` | 半導体関連産業振興協議会 |

他多数（全 42 カテゴリ程度）。

---

## ページネーション

### 方式

jQuery bootpag プラグインによる **クライアントサイドページネーション**。

```javascript
$(".kaigiroku_P2paging").bootpag({
  total: 17, page: 1, maxVisible: 5, leaps: true
}).on("page", function(event, num){
  $(".kaigiroku_P2page_selection").hide();
  $("#kaigiroku_P2page-" + num).show();
});
```

- 全 17 ページ分のデータが **単一 HTML** に `<div id="kaigiroku_P2page-{N}">` として埋め込まれている
- サーバーサイドページネーションではないため、1 回の HTTP リクエストで全件取得可能

### カテゴリページのページネーション

カテゴリ別ページ（例: `/gyosei/kaigiroku/gikai`）も同様の bootpag 方式。議会本会議は全 4 ページ（32 件）。

---

## HTML 構造

### 一覧ページ

各ページ区画は `<dl class="dl-news-list">` で構成:

```html
<div id="kaigiroku_P2page-1">
  <dl class="dl-news-list">
    <dt>2026年03月04日</dt>
    <dd>
      <a href="/gyosei/kaigiroku/1925">
        【開催結果】令和７年第8回安平町議会定例会（令和７年１２月１７～１８日開催）
      </a>
    </dd>
    <dt>2026年02月05日</dt>
    <dd>
      <a href="/gyosei/kaigiroku/1920">
        【開催結果】令和7年度第1回総合教育会議（令和８年１月28日開催）
      </a>
    </dd>
    ...
  </dl>
</div>
```

- `<dt>`: 掲載日（`YYYY年MM月DD日` 形式）
- `<dd><a href="...">`: 会議録タイトル + 詳細ページへのリンク

### 詳細ページ

```html
<article class="entry entry-single">
  <div class="entry-content">
    <p>次のとおり...を開催しましたので、会議録を公表します。</p>
    <ul>
      <li>
        <a href="//www.town.abira.lg.jp/webopen/content/{ID}/{ファイル名}.pdf">
          令和７年第８回安平町議会定例会会議録（令和７年１２月１７日）
        </a>
      </li>
    </ul>
  </div>
</article>
```

- 会議録本文は **PDF ファイル** として提供（HTML での本文表示なし）
- PDF URL パターン: `//www.town.abira.lg.jp/webopen/content/{数値ID}/{ファイル名}.pdf`
- 複数日開催の場合、日ごとに個別の PDF が用意される

---

## PDF ファイル命名規則

| パターン | 例 | 説明 |
| --- | --- | --- |
| `R{年}{月}-{連番}.pdf.pdf` | `R0712-01.pdf.pdf` | 令和7年12月開催・1日目（拡張子が二重の場合あり） |
| `R{年}{月}-{連番}.pdf` | `R0408-01.pdf` | 令和4年8月開催・1日目 |
| `R{年}{月}.pdf` | `R0701.pdf` | 単日開催 |
| `{月}{種別}.pdf` | `09rinji.pdf` | 9月臨時会 |

命名規則は統一されていないため、詳細ページの `<a>` タグから都度抽出する必要がある。

---

## スクレイピング戦略

### Step 1: 会議録 ID の収集

一覧ページ `https://www.town.abira.lg.jp/gyosei/kaigiroku` から全件の数値 ID を抽出する。

**ポイント:**
- bootpag によるクライアントサイドページネーションのため、1 回の GET で全 17 ページ分（約 165 件）の `<dd><a href="/gyosei/kaigiroku/{ID}">` を取得可能
- 正規表現: `/gyosei/kaigiroku/(\d+)` で ID を抽出
- ID 範囲: 1524〜1925（2022年〜2026年時点）

**収集方法:**

1. `https://www.town.abira.lg.jp/gyosei/kaigiroku` を GET
2. HTML 全体から `href="/gyosei/kaigiroku/{数値ID}"` を正規表現で抽出
3. 重複を排除してリスト化

### Step 2: 詳細ページから PDF URL を取得

各 ID の詳細ページ `https://www.town.abira.lg.jp/gyosei/kaigiroku/{ID}` にアクセスし、PDF リンクを抽出する。

**抽出方法:**

```typescript
// PDF リンクの抽出
const pdfPattern = /href="(\/\/www\.town\.abira\.lg\.jp\/webopen\/content\/\d+\/[^"]+\.pdf[^"]*)"/g;

// または Cheerio で
const pdfLinks = $('a[href*="/webopen/content/"]')
  .map((_, el) => $(el).attr('href'))
  .get()
  .filter(href => href.endsWith('.pdf') || href.includes('.pdf'));
```

**メタ情報の抽出:**

```typescript
// タイトルからメタ情報を抽出
// 例: 【開催結果】令和７年第8回安平町議会定例会（令和７年１２月１７～１８日開催）
const titlePattern = /【開催結果】(.+?)（(.+?)開催）/;
// group1: "令和７年第8回安平町議会定例会"
// group2: "令和７年１２月１７～１８日"

// PDF リンクテキストから個別日付を抽出
// 例: 令和７年第８回安平町議会定例会会議録（令和７年１２月１７日）
const pdfDatePattern = /（(.+?)）$/;
```

### Step 3: PDF のダウンロードとテキスト抽出

PDF をダウンロードし、テキストを抽出する。

- PDF URL は protocol-relative（`//www.town.abira.lg.jp/...`）のため、`https:` を先頭に付加する必要がある
- 一部 PDF は拡張子が `.pdf.pdf` と二重になっているが、そのまま有効な URL

---

## 注意事項

- 会議録本文は PDF のみで提供されるため、HTML パースだけでは本文を取得できない
- PDF のテキスト抽出ライブラリ（pdf-parse 等）が必要
- PDF 命名規則が統一されていないため、ファイル名からの日付・会議種別の推定は不安定 → 詳細ページのタイトルおよびリンクテキストからメタ情報を取得すべき
- 全データが単一 HTML に含まれるため、一覧ページの取得は 1 リクエストで完了する

---

## 推奨アプローチ

1. **一覧ページの一括取得**: 単一 HTML に全件が含まれるため、1 リクエストで全 ID を収集
2. **カテゴリ別の取得も可能**: 議会本会議のみ取得する場合は `/gyosei/kaigiroku/gikai` から 32 件を取得
3. **レート制限**: 自治体サイトのため、詳細ページ・PDF 取得時はリクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 数値 ID は昇順のため、前回取得済みの最大 ID 以降のみを取得する差分更新が可能
5. **PDF テキスト抽出**: pdf-parse 等のライブラリを使用して PDF からテキストを抽出する
