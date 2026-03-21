# 須崎市議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.city.susaki.lg.jp/gijiroku/
- 分類: 独自 CMS による HTML 公開（既存アダプターでは対応不可）
- 文字コード: UTF-8
- 特記: Google Analytics (gtag) 使用。会議録本文は HTML ではなく PDF のみ提供。

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 会議録トップ（開催別） | `https://www.city.susaki.lg.jp/gijiroku/` |
| 本会議会議録一覧 | `https://www.city.susaki.lg.jp/gijiroku/?hdnKatugi=3000` |
| 委員会会議録一覧 | `https://www.city.susaki.lg.jp/gijiroku/?hdnKatugi=4000` |
| 会議録詳細（PDF リンクあり） | `https://www.city.susaki.lg.jp/gijiroku/giji_dtl.php?hdnKatugi={カテゴリ}&hdnID={ID}` |
| PDF ファイル | `https://www.city.susaki.lg.jp/gijiroku/data/{ランダムID}/downfile{数値}.pdf` |

---

## カテゴリコード（hdnKatugi）

| hdnKatugi | 分類 |
| --- | --- |
| `1000` | 開催別 |
| `2000` | 議決一覧 |
| `3000` | 本会議会議録 |
| `4000` | 委員会会議録 |
| `5000` | 議員提出議案 |
| `6000` | 一般質問通告表 |
| `7000` | 議長交際費 |
| `8000` | 政務活動費収支報告書 |

スクレイピング対象は `3000`（本会議）と `4000`（委員会）。

---

## 年度選択の仕組み

年度切り替えはページ内の `<a onclick="javascript:fncYearSet(元号, 年)">` リンクで行われる。JavaScript の `fncYearSet` 関数が hidden フォームを書き換えてページを再送信する仕組み。

利用可能な年度範囲:

| 元号 | 年範囲 |
| --- | --- |
| 令和 | 2〜8 年 |
| 平成 | 18〜31 年 |

デフォルト表示は最新年度（令和 8 年）。

**注意**: 年度切り替えは JavaScript によるフォーム送信のため、直接 GET パラメータでの年度指定は機能しない。Playwright 等のブラウザ自動化を使うか、POST リクエストのパラメータを解析して直接送信する必要がある。

---

## 会議録一覧ページの HTML 構造

```html
<!-- リスト形式（テーブルではない） -->
<a href="./giji_dtl.php?hdnKatugi=3000&hdnID=489">
  第491回11月臨時会・第492回11月臨時会・第493回12月定例会
</a>
```

- 各会議録はアンカータグのリンク形式で列挙される
- テーブルは使用されていない（ul/li または p タグのリスト）
- リンクテキストに会議名（定例会・臨時会の回数と月）が含まれる
- 年度内に複数の定例会が 1 つのリンクにまとめられる場合がある

---

## 会議録詳細ページの HTML 構造

`giji_dtl.php?hdnKatugi={カテゴリ}&hdnID={ID}` のページ。

```html
<h2>第490回9月定例会</h2>
<!-- 開催日は括弧内に記載 -->
<!-- (開催日:2025/09/03) -->

<!-- 本会議の場合：PDF リンク 1 件 -->
<a href="../data/fd_19ejh8s2b9203k/downfile9548642254.pdf">
  第490回9月定例会（152KB）
</a>

<!-- 委員会の場合：複数の委員会ごとに PDF リンクが存在 -->
<a href="../data/fd_19csl58185jpri/downfile1976074138.pdf">
  総務文教委員会（901KB）
</a>
<a href="../data/fd_19csl58185jpri/downfile1681979482.pdf">
  産業厚生委員会（867KB）
</a>
```

**メタ情報の抽出:**

- 会議名: `<h2>` タグのテキスト（例: `第490回9月定例会`）
- 開催日: タイトル付近の `(開催日:YYYY/MM/DD)` 形式のテキスト
- PDF リンク: `.pdf` を含む `<a>` タグの `href` 属性（相対パス）

---

## PDF ファイルの URL 形式

```
https://www.city.susaki.lg.jp/gijiroku/data/{ランダムID}/downfile{数値}.pdf
```

- ディレクトリ名（`fd_199bc5j7ugejf4` 等）はランダムな英数字文字列
- ファイル名（`downfile9274949321.pdf` 等）も推測不可能な数値
- URL の規則性がなく、詳細ページから取得する必要がある

---

## ページネーション

**なし**。年度単位でページが切り替わる仕組みで、1 年度分のデータがすべて 1 ページに表示される。

---

## スクレイピング戦略

### Step 1: 年度 × カテゴリの組み合わせで一覧ページを取得

年度切り替えが JavaScript フォーム送信のため、以下のいずれかの方法で対応する:

**方法 A: Playwright による JavaScript 実行（推奨）**

```typescript
for (const category of ["3000", "4000"]) {
  for (const { gengou, year } of YEAR_LIST) {
    // fncYearSet を click でトリガー or JS 直接実行
    await page.goto(`https://www.city.susaki.lg.jp/gijiroku/?hdnKatugi=${category}`);
    await page.evaluate(`fncYearSet('${gengou}', '${year}')`);
    await page.waitForNavigation();
    // 一覧を取得
  }
}
```

**方法 B: POST パラメータの直接送信**

JavaScript の `fncYearSet` 関数がどの hidden フィールドを書き換えるかを事前に調査し、対応する POST リクエストを直接送信する。

### Step 2: 詳細ページの hdnID を収集

一覧ページの `<a href="./giji_dtl.php?hdnKatugi=...&hdnID=...">` からリンクを全件抽出し、`hdnID` の値を収集する。

```typescript
const links = await page.$$eval('a[href*="giji_dtl.php"]', (els) =>
  els.map((el) => el.getAttribute("href"))
);
// href から hdnID を正規表現で抽出
const hdnIdPattern = /hdnID=(\d+)/;
```

### Step 3: 詳細ページから PDF リンクを取得

各 `giji_dtl.php` ページにアクセスし、PDF リンクを収集する。

```typescript
const pdfLinks = await page.$$eval('a[href$=".pdf"]', (els) =>
  els.map((el) => ({
    url: new URL(el.getAttribute("href")!, baseUrl).href,
    label: el.textContent?.trim(),
  }))
);
```

- 本会議（hdnKatugi=3000）: 1 件の PDF（定例会・臨時会をまとめた場合は 1 PDF に複数回分が含まれる）
- 委員会（hdnKatugi=4000）: 委員会ごとに複数の PDF（例: 総務文教委員会、産業厚生委員会）

### Step 4: メタ情報の抽出

```typescript
// 会議名
const title = await page.$eval("h2", (el) => el.textContent?.trim());
// 例: "第490回9月定例会"

// 開催日
const dateText = await page.content();
const dateMatch = dateText.match(/開催日:(\d{4})\/(\d{2})\/(\d{2})/);
// YYYY/MM/DD 形式
```

---

## 年度リスト（定数定義用）

```typescript
const YEAR_LIST = [
  // 令和
  { gengou: "令和", year: "8" },
  { gengou: "令和", year: "7" },
  { gengou: "令和", year: "6" },
  { gengou: "令和", year: "5" },
  { gengou: "令和", year: "4" },
  { gengou: "令和", year: "3" },
  { gengou: "令和", year: "2" },
  // 平成
  { gengou: "平成", year: "31" }, // 令和元年
  { gengou: "平成", year: "30" },
  { gengou: "平成", year: "29" },
  { gengou: "平成", year: "28" },
  { gengou: "平成", year: "27" },
  { gengou: "平成", year: "26" },
  { gengou: "平成", year: "25" },
  { gengou: "平成", year: "24" },
  { gengou: "平成", year: "23" },
  { gengou: "平成", year: "22" },
  { gengou: "平成", year: "21" },
  { gengou: "平成", year: "20" },
  { gengou: "平成", year: "19" },
  { gengou: "平成", year: "18" },
];
```

---

## 注意事項

- **会議録本文は HTML 非公開**: 会議録はすべて PDF 形式のみ。テキスト抽出が必要な場合は PDF パースが必要。
- **PDF URL は推測不可能**: ディレクトリ名・ファイル名ともにランダムなため、詳細ページから取得する必要がある。
- **1 リンクに複数回分が含まれる場合がある**: 「第491回11月臨時会・第492回11月臨時会・第493回12月定例会」のように複数の定例会・臨時会が 1 つの hdnID にまとめられている場合がある。
- **委員会名は詳細ページで確認**: 委員会一覧には個別委員会名（総務文教委員会、産業厚生委員会等）が表示されず、詳細ページに記載される。
- **レート制限**: 自治体サイトのため、リクエスト間に 1〜2 秒の待機時間を設ける。

---

## 推奨アプローチ

1. **Playwright を使用**: 年度切り替えが JavaScript フォーム送信のため、静的クロールではなく Playwright でブラウザを操作する。
2. **全年度 × カテゴリのマトリクスで網羅**: 年度（令和 2〜8 年、平成 18〜31 年）× カテゴリ（3000・4000）の全組み合わせを処理する。
3. **hdnID をキーに差分管理**: 詳細ページの hdnID で既取得データを管理し、新しい ID のみ追加取得する差分更新が可能。
4. **PDF の保存と解析を分離**: PDF ダウンロードとテキスト抽出は別ステップで処理し、再クロールを最小化する。
