# 小豆島町議会 カスタムスクレイピング方針

## 概要

- サイト: https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/index.html
- 分類: 年別リンク形式（独自 CMS、専用検索システムなし）
- 文字コード: UTF-8
- 会議録形式: **すべて PDF ファイル**（HTML テキスト形式の会議録なし）
- 対象期間: 平成18年（2006年）〜 令和8年（2026年）

---

## URL 構造

| ページ | URL パターン |
| --- | --- |
| 年別インデックス | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/index.html` |
| 年別一覧ページ | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/{ページID}.html` |
| 会議録 PDF | `https://www.town.shodoshima.lg.jp/material/files/group/{グループID}/{ファイル名}.pdf` |

---

## 年別一覧ページの URL マッピング

インデックスページから各年のページ ID を収集する。各年ページの URL は連番ではなく任意の数値 ID が割り当てられている。

| 年 | ページID | URL |
| --- | --- | --- |
| 令和8年（2026年） | 9368 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/9368.html` |
| 令和7年（2025年） | 8814 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/8814.html` |
| 令和6年（2024年） | 8342 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/8342.html` |
| 令和5年（2023年） | 7973 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/7973.html` |
| 令和4年（2022年） | 6744 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/6744.html` |
| 令和3年（2021年） | 5691 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/5691.html` |
| 令和2年（2020年） | 4420 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/4420.html` |
| 令和元年/平成31年（2019年） | 3543 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3543.html` |
| 平成30年（2018年） | 3544 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3544.html` |
| 平成29年（2017年） | 3545 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3545.html` |
| 平成28年（2016年） | 3546 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3546.html` |
| 平成27年（2015年） | 3547 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3547.html` |
| 平成26年（2014年） | 3548 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3548.html` |
| 平成25年（2013年） | 3549 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3549.html` |
| 平成24年（2012年） | 3550 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3550.html` |
| 平成23年（2011年） | 3551 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3551.html` |
| 平成22年（2010年） | 3552 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3552.html` |
| 平成21年（2009年） | 3553 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3553.html` |
| 平成20年（2008年） | 3554 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3554.html` |
| 平成19年（2007年） | 3555 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3555.html` |
| 平成18年（2006年） | 3556 | `https://www.town.shodoshima.lg.jp/gyousei/choseijoho/gikai/kaigiroku/3556.html` |

---

## 年別一覧ページの HTML 構造

各年ページは `<h2>` 見出し + `<p><a>` リンクの繰り返しで構成される。テーブルやリストタグは使用されていない。

```html
<h2>3月定例会</h2>
<p><a href="//www.town.shodoshima.lg.jp/material/files/group/20/R603kaigiroku1.pdf">2月28日 (PDFファイル: 359.1KB)</a></p>
<p><a href="//www.town.shodoshima.lg.jp/material/files/group/20/R603kaigiroku2.pdf">3月14日 (PDFファイル: 423.3KB)</a></p>

<h2>6月定例会</h2>
<p><a href="//www.town.shodoshima.lg.jp/material/files/group/20/kaigiroku_240613.pdf">6月13日 (PDFファイル: 513.9KB)</a></p>
```

### 見出し（`<h2>`）で分類される会議種別の例

- 1月臨時会 / 2月臨時会 / 4月臨時会 / 5月臨時会 / 7月臨時会 / 8月臨時会 / 10月臨時会 / 11月臨時会
- 3月定例会 / 6月定例会 / 9月定例会 / 12月定例会

### ページネーション

なし。各年の全会議録が単一ページに表示される。

---

## PDF ファイルの命名規則

ファイル名に一定の規則はなく、年代・担当者によって様式が異なる。代表的なパターン：

| パターン | 例 | 備考 |
| --- | --- | --- |
| `kaigiroku_YYMMDD.pdf` | `kaigiroku_240613.pdf` | 近年の標準形式 |
| `RYYY-M{会議種別}No{N}.pdf` | `R5-3teireikaikaigirokuNo1.pdf` | 令和年代の定例会 |
| `RYY{月}kaigiroku{N}.pdf` | `R603kaigiroku1.pdf` | 令和6年3月定例会 |
| `{グループID}-{年}{月}.pdf` | `0619-3.pdf` | 平成年代（group/22） |
| ランダム数値.pdf | `81497072.pdf` | 古い年代の一部 |

PDF ファイルの格納先は主に 2 種類：
- `/material/files/group/20/` — 近年分および一部の古い会議録
- `/material/files/group/22/` — 平成年代の一部

---

## スクレイピング戦略

### Step 1: 年別一覧ページの URL リストを収集

インデックスページ `index.html` の `<a href>` から年別ページの URL を抽出する。

- 年別ページの URL は固定（上記マッピング表参照）
- 今後の年追加に備え、インデックスページから動的に取得することを推奨

```typescript
// 抽出対象: /gyousei/choseijoho/gikai/kaigiroku/{数値ID}.html にマッチするリンク
const yearPagePattern = /\/gyousei\/choseijoho\/gikai\/kaigiroku\/(\d+)\.html/;
```

### Step 2: 各年ページから PDF リンクを収集

年別ページを取得し、`<h2>` 見出しと `<a href="*.pdf">` リンクを Cheerio で抽出する。

```typescript
// h2 見出し（会議種別）を取得
const sessionType = $("h2").text(); // 例: "3月定例会"

// PDF リンクを取得
const pdfLinks = $('a[href$=".pdf"]').map((_, el) => ({
  url: $(el).attr("href"),
  label: $(el).text().trim(), // 例: "3月14日 (PDFファイル: 423.3KB)"
}));
```

`<h2>` と `<p><a>` の DOM 順序を利用して、各 PDF がどの会議種別に属するかを対応付ける。

### Step 3: PDF からテキストを抽出

**この自治体の会議録はすべて PDF 形式**のため、HTML テキストとして直接スクレイピングすることはできない。PDF からのテキスト抽出が必要。

- PDF テキスト抽出ライブラリ（例: `pdf-parse`, `pdfjs-dist`）を使用する
- OCR が必要な場合は別途対応を検討する（スキャン PDF の可能性）

### Step 4: PDF テキストのパース

PDF から抽出したテキストの構造は PDF ごとに異なる可能性があるが、一般的な議会会議録の構造に準じていると想定される。

---

## 注意事項

- **PDF のみ**: HTML テキスト形式の会議録は存在しない。テキスト検索・発言者抽出には PDF パースが必須
- **ファイル名の非一貫性**: 年代・会議によってファイル命名規則が異なるため、ファイル名からのメタ情報抽出は困難。年別一覧ページの `<h2>` 見出しと `<a>` テキスト（日付）から会議種別・開催日を取得する
- **プロトコル相対 URL**: PDF リンクが `//www.town.shodoshima.lg.jp/...` 形式（プロトコル省略）で記載されているケースがある。`https:` を補完する必要がある
- **レート制限**: 自治体サイトのため、リクエスト間に適切な待機時間（1〜2 秒）を設ける
- **将来の年追加**: 毎年インデックスページに新しい年別リンクが追加されるため、定期クロール時はインデックスページから動的にリンクを取得する

---

## 推奨アプローチ

1. **インデックスページから動的に年別 URL を収集**: ハードコードより動的取得を優先し、将来の年追加に自動対応する
2. **`<h2>` と `<a>` の DOM 順序で会議種別を対応付け**: Cheerio の `.nextUntil("h2")` 等を活用する
3. **PDF テキスト抽出**: `pdf-parse` 等のライブラリで本文テキストを取得し、議会会議録の標準的な発言者パターンでパースする
4. **差分更新**: 取得済みの PDF URL をキャッシュし、未取得の PDF のみを処理する
