# 蘭越町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.rankoshi.hokkaido.jp/administration/town/detail.html?content=301
- 分類: 独自 CMS による PDF 公開（会議録は全て PDF ファイル）
- 文字コード: UTF-8
- 特記: Google Tag Manager（GTM-T5QWXB7）使用

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録一覧（年度別リンク集） | `https://www.town.rankoshi.hokkaido.jp/administration/town/detail.html?content=301` |
| 年度別会議録ページ | `https://www.town.rankoshi.hokkaido.jp/administration/town/detail.html?content={コンテンツID}` |
| 会議録 PDF | `https://www.town.rankoshi.hokkaido.jp/common/img/content/content_{YYYYMMdd}_{HHmmss}.pdf` |

---

## 年度別コンテンツ ID

| 年度 | コンテンツ ID | URL |
| --- | --- | --- |
| 令和8年 | 867 | `detail.html?content=867` |
| 令和7年 | 778 | `detail.html?content=778` |
| 令和6年 | 656 | `detail.html?content=656` |
| 令和5年 | 550 | `detail.html?content=550` |
| 令和4年 | 467 | `detail.html?content=467` |
| 令和3年 | 295 | `detail.html?content=295` |
| 令和2年 | 293 | `detail.html?content=293` |
| 令和元年 | 299 | `detail.html?content=299` |

※ コンテンツ ID は連番ではなく不規則。新年度が追加される際に新しい ID が付与される。

---

## 会議の種類

本会議のみ掲載（委員会の会議録は公開されていない）。

- **定例会**: 第1回〜第4回（3月、6月、9月、12月）
- **臨時会**: 第1回〜第5回（年により回数が異なる）

---

## HTML 構造

### 一覧ページ（content=301）

年度別のリンクが `ul.c-circleList` 内の `li > a` 要素で列挙される。

```html
<ul class="c-circleList">
  <li><a href="/administration/town/detail.html?content=867" target="_blank">令和８年　蘭越町議会会議録</a></li>
  <li><a href="/administration/town/detail.html?content=778" target="_blank">令和７年　蘭越町議会会議録</a></li>
  ...
</ul>
```

### 年度別ページ（例: content=656）

会議種別ごとに `h1.c-secTtl` の見出しで区切られ、その直後に `ul.c-fileList` で PDF リンクが列挙される。

```html
<div class="index_block _block cassette-item">
  <h1 class="c-secTtl">
    <span class="c-secTtl_label">令和６年蘭越町議会第４回定例会</span>
  </h1>
</div>
<div class="list_block _block cassette-item list02">
  <ul class="c-fileList">
    <li><a href="../../common/img/content/content_20250120_111334.pdf" target="_blank">１２月１２日　１日目(PDF／466KB)</a></li>
  </ul>
</div>
```

#### 見出しパターン

```
令和{N}年蘭越町議会第{M}回定例会
令和{N}年蘭越町議会第{M}回臨時会
令和{N}年度蘭越町議会第{M}回定例会  ※ "年度" 表記のケースもある
```

#### PDF リンクテキストパターン

```
{月}{日}日　{N}日目(PDF／{サイズ}KB)
```

- 月日は全角数字だが、半角が混在するケースもある（例: `9月１７日`）

---

## スクレイピング戦略

### Step 1: 年度別ページ URL の収集

会議録一覧ページ `detail.html?content=301` から各年度ページへのリンクを抽出する。

**収集方法:**

1. `content=301` のページを取得
2. `ul.c-circleList` 内の `a[href]` から `content={ID}` のリンクを全て抽出
3. 各リンクからコンテンツ ID と年度名を取得

### Step 2: PDF URL の収集

各年度ページから会議種別・開催日・PDF URL を抽出する。

**収集方法:**

1. 各年度ページを取得
2. `h1.c-secTtl span.c-secTtl_label` から会議種別（定例会/臨時会、回数）を抽出
3. 直後の `ul.c-fileList li a[href]` から PDF の相対パスを取得
4. リンクテキストから開催日と日目を抽出
5. 相対パスを絶対 URL に変換: `https://www.town.rankoshi.hokkaido.jp/common/img/content/content_{timestamp}.pdf`

### Step 3: PDF のダウンロードとテキスト抽出

PDF ファイルをダウンロードし、テキストを抽出する。

- PDF のテキスト抽出には `pdf-parse` 等のライブラリを使用
- PDF ファイルサイズは 200KB〜1.2MB 程度

### Step 4: 会議録のパース

#### メタ情報

年度ページの HTML から以下を抽出:

- 会議種別: `h1.c-secTtl` の見出しテキスト（例: `令和６年蘭越町議会第４回定例会`）
- 開催日: PDF リンクテキストから（例: `１２月１２日`）

#### パース用正規表現（案）

```typescript
// 会議種別の抽出（HTML 見出しから）
const sessionPattern = /(?:令和|平成)(\d+)年度?蘭越町議会第(\d+)回(定例会|臨時会)/;
// 例: 令和６年蘭越町議会第４回定例会 → year="6", number="4", type="定例会"

// 開催日の抽出（PDF リンクテキストから）
const datePattern = /([０-９0-9]+)月([０-９0-9]+)日/;
// 例: １２月１２日 → month="１２", day="１２"

// PDF URL の抽出
const pdfPattern = /href="([^"]*content_\d{8}_\d{6}\.pdf)"/;
```

---

## ページネーション

ページネーションなし。各年度ページに当該年度の全会議録 PDF リンクが一覧表示される。

---

## 注意事項

- 会議録は全て **PDF 形式** で公開されており、HTML 形式の会議録本文は存在しない
- PDF からのテキスト抽出が必要なため、発言者パターンや本文構造は PDF 内容に依存する
- PDF ファイル名のタイムスタンプ（`content_YYYYMMdd_HHmmss`）はアップロード日時であり、会議の開催日とは異なる
- リンクテキスト内の数字表記に全角・半角の混在がある（例: `9月１７日` vs `１２月１２日`）
- 年度ページの見出しに「年」と「年度」の表記揺れがある（例: `令和６年蘭越町議会` vs `令和６年度蘭越町議会`）
- 検索機能は会議録専用のものはなく、サイト全体のサイト内検索のみ

---

## 推奨アプローチ

1. **2段階クロール**: まず一覧ページから年度ページ URL を収集し、次に各年度ページから PDF URL を収集する
2. **PDF テキスト抽出**: HTML ベースの会議録がないため、PDF からのテキスト抽出が必須
3. **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
4. **差分更新**: 一覧ページの年度リンクを監視し、新しいコンテンツ ID が追加された場合や既存年度ページの PDF リンク数が増えた場合のみ追加取得する
5. **メタ情報の正規化**: 全角数字・半角数字の混在を正規化し、開催日を統一フォーマット（YYYY-MM-DD）に変換する
